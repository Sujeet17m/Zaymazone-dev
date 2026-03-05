/**
 * VideoUpload.tsx — Module 15 (enhanced for artisan onboarding)
 *
 * Accepts only web-playable video formats: MP4, WebM, MOV (QuickTime), OGG
 * Max input size : 30 MB  (before compression)
 * Max output size:  8 MB  (hard cap after compression; keeps GridFS lean)
 * Max duration   : 60 s   (1 minute — adequate for a craft showcase)
 * Compression    : canvas + MediaRecorder re-encode at 360p / 350 kbps;
 *                  video plays at 4× speed so a 60 s clip compresses in ~15 s;
 *                  rAF draws every 2nd frame to halve CPU draw calls;
 *                  runs automatically when the raw file > COMPRESS_THRESHOLD (2 MB)
 */

import React, { useRef, useState } from 'react'
import { Upload, X, Film, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { imagesApi } from '@/lib/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime', // .mov
]
const ACCEPTED_EXTENSIONS = '.mp4,.webm,.ogg,.mov'

const MAX_RAW_SIZE_MB = 30                          // reject input > 30 MB outright
const COMPRESS_THRESHOLD_MB = 2                     // auto-compress when > 2 MB
const MAX_OUTPUT_SIZE_MB = 8                        // hard cap after compression (GridFS-friendly)
const MAX_DURATION_S = 60                           // 1 minute
const TARGET_HEIGHT_PX = 360                        // 360p — lighter on CPU
const TARGET_BITRATE_BPS = 350_000                  // 350 kbps
const TARGET_FPS = 20                               // 20 fps
const COMPRESS_PLAYBACK_RATE = 4.0                  // play at 4× for ~4× faster compression

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoUploadProps {
  /** Currently selected video URL (empty string = none) */
  value: string
  /** Called with the uploaded URL (or empty string when cleared) */
  onChange: (url: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Probe a File for duration without rendering it into the DOM. */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration) }
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read video metadata')) }
    v.src = url
  })
}

/** Probe video dimensions. */
function getVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({ width: v.videoWidth, height: v.videoHeight })
    }
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read video dimensions')) }
    v.src = url
  })
}

/**
 * Re-encode a video through canvas + MediaRecorder.
 * Returns a new File (video/webm) at ≤ TARGET dimensions and TARGET_BITRATE.
 * `onProgress` receives 0-100 as the video plays through.
 */
interface HTMLVideoElementWithCapture extends HTMLVideoElement {
  captureStream?(): MediaStream;
}

async function compressVideo(
  file: File,
  onProgress: (pct: number) => void,
): Promise<File> {
  // Check MediaRecorder availability
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder API not available in this browser')
  }

  // Pick best supported codec
  const mimeType =
    MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' :
    MediaRecorder.isTypeSupported('video/webm;codecs=vp8')      ? 'video/webm;codecs=vp8'      :
    MediaRecorder.isTypeSupported('video/webm')                 ? 'video/webm'                 :
    null

  if (!mimeType) {
    throw new Error('No supported WebM codec found in this browser')
  }

  const dims = await getVideoDimensions(file)

  const scaleRatio = Math.min(1, TARGET_HEIGHT_PX / (dims.height || TARGET_HEIGHT_PX))
  const targetW = Math.round((dims.width  || 854) * scaleRatio)
  const targetH = Math.round((dims.height || 480) * scaleRatio)

  const canvas  = document.createElement('canvas')
  canvas.width  = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')!

  const video = document.createElement('video') as HTMLVideoElementWithCapture
  video.muted       = true   // muted so autoplay is allowed
  video.playsInline = true
  video.crossOrigin = 'anonymous'

  const objectUrl = URL.createObjectURL(file)
  video.src = objectUrl

  return new Promise<File>((resolve, reject) => {
    video.onloadedmetadata = () => {
      const canvasStream = canvas.captureStream(TARGET_FPS)

      // Attempt to add audio track via HTMLMediaElement.captureStream
      try {
        const mediaStream: MediaStream | undefined = video.captureStream?.()
        if (mediaStream) {
          mediaStream.getAudioTracks().forEach(t => canvasStream.addTrack(t))
        }
      } catch {
        // Audio capture not available — video-only is fine
      }

      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: TARGET_BITRATE_BPS,
      })

      const chunks: BlobPart[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      recorder.onstop = () => {
        URL.revokeObjectURL(objectUrl)
        const blob = new Blob(chunks, { type: 'video/webm' })
        const baseName = file.name.replace(/\.[^.]+$/, '')
        const compressed = new File([blob], `${baseName}-compressed.webm`, {
          type: 'video/webm',
          lastModified: Date.now(),
        })
        resolve(compressed)
      }

      recorder.onerror = (e) => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error(`Compression recorder error: ${String(e)}`))
      }

      // ── Optimised draw loop ──────────────────────────────────────────────
      // Skip every other rAF call to halve CPU draw calls while keeping the
      // MediaRecorder fed at a reasonable cadence.
      let rafId: number
      let skipNext = false
      const drawFrame = () => {
        if (video.ended || video.paused) {
          cancelAnimationFrame(rafId)
          if (recorder.state !== 'inactive') recorder.stop()
          return
        }
        skipNext = !skipNext
        if (!skipNext) {
          ctx.drawImage(video, 0, 0, targetW, targetH)
        }
        if (video.duration > 0) {
          // Progress reflects wall-clock playback at 4×, so currentTime advances fast
          onProgress(Math.min(99, Math.round((video.currentTime / video.duration) * 100)))
        }
        rafId = requestAnimationFrame(drawFrame)
      }

      recorder.start(250) // emit data every 250 ms
      // ── 4× playback: compress a 60 s video in ~15 s ──────────────────────
      video.playbackRate = COMPRESS_PLAYBACK_RATE
      video.play()
        .then(() => { rafId = requestAnimationFrame(drawFrame) })
        .catch((e) => { URL.revokeObjectURL(objectUrl); reject(e) })

      video.onended = () => {
        cancelAnimationFrame(rafId)
        if (recorder.state !== 'inactive') recorder.stop()
      }
    }

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load video for compression'))
    }
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

type UploadPhase = 'idle' | 'validating' | 'compressing' | 'uploading' | 'done'

export const VideoUpload: React.FC<VideoUploadProps> = ({ value, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const [phase, setPhase]       = useState<UploadPhase>('idle')
  const [progress, setProgress] = useState(0)  // 0-100 during compressing/uploading
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const isBusy = phase === 'validating' || phase === 'compressing' || phase === 'uploading'

  // ── File pick handler ──────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset so the same file can be re-selected after an error
    e.target.value = ''
    if (!file) return
    await processFile(file)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (isBusy) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await processFile(file)
  }

  // ── Core processing pipeline ───────────────────────────────────────────────

  const processFile = async (file: File) => {
    setPhase('validating')
    setProgress(0)

    // 1. MIME type check
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      toast({
        title: 'Unsupported video format',
        description: 'Please upload an MP4, WebM, MOV, or OGG file.',
        variant: 'destructive',
      })
      setPhase('idle')
      return
    }

    // 2. Raw size check
    const rawMB = file.size / (1024 * 1024)
    if (rawMB > MAX_RAW_SIZE_MB) {
      toast({
        title: `File too large (${rawMB.toFixed(0)} MB)`,
        description: `Maximum accepted size before compression is ${MAX_RAW_SIZE_MB} MB. Please trim your video first.`,
        variant: 'destructive',
      })
      setPhase('idle')
      return
    }

    // 3. Duration check
    let duration: number
    try {
      duration = await getVideoDuration(file)
    } catch {
      toast({ title: 'Could not read video', description: 'The file may be corrupted.', variant: 'destructive' })
      setPhase('idle')
      return
    }

    if (!isFinite(duration) || duration > MAX_DURATION_S) {
      toast({
        title: `Video too long (${Math.round(duration)}s)`,
        description: `Please keep the craft video under ${MAX_DURATION_S} seconds (2 minutes).`,
        variant: 'destructive',
      })
      setPhase('idle')
      return
    }

    // 4. Compression (auto when > COMPRESS_THRESHOLD)
    let fileToUpload = file
    if (rawMB > COMPRESS_THRESHOLD_MB) {
      setPhase('compressing')
      toast({
        title: 'Compressing video…',
        description: `This takes roughly ${Math.round(duration)}s — equal to the video length.`,
      })
      try {
        fileToUpload = await compressVideo(file, (pct) => setProgress(pct))
      } catch (err) {
        // If browser can't compress, fall back to original but warn about size
        console.warn('[VideoUpload] compression failed, using original:', err)
        toast({
          title: 'Compression unavailable',
          description: 'Using original file. Ensure it is under 15 MB.',
        })
        fileToUpload = file
      }

      const compressedMB = fileToUpload.size / (1024 * 1024)
      if (compressedMB > MAX_OUTPUT_SIZE_MB) {
        toast({
          title: `Still too large after compression (${compressedMB.toFixed(1)} MB)`,
          description: `Please trim the video to under 2 minutes or use a lower-resolution recording (max ${MAX_OUTPUT_SIZE_MB} MB).`,
          variant: 'destructive',
        })
        setPhase('idle')
        return
      }
    }

    // 5. Upload
    setPhase('uploading')
    setProgress(0)

    // Show local preview from the original file while uploading
    const previewUrl = URL.createObjectURL(file)
    setLocalPreview(previewUrl)

    try {
      const result = await imagesApi.upload(fileToUpload)
      onChange(result.image.url)
      setPhase('done')
      toast({ title: 'Video uploaded', description: 'Craft video saved successfully.' })
    } catch (err) {
      console.error('[VideoUpload] upload error:', err)
      toast({ title: 'Upload failed', description: 'Could not save the video. Please try again.', variant: 'destructive' })
      setLocalPreview(null)
      setPhase('idle')
    }
  }

  // ── Clear ──────────────────────────────────────────────────────────────────

  const handleClear = () => {
    onChange('')
    setLocalPreview(null)
    setPhase('idle')
    setProgress(0)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const displayUrl = value || localPreview

  return (
    <div className="space-y-3">
      {/* Drop zone — hidden once a video is selected */}
      {!displayUrl && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !isBusy && fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center transition-all select-none
            ${isBusy
              ? 'opacity-60 cursor-not-allowed border-gray-300'
              : 'cursor-pointer border-gray-300 hover:border-primary hover:bg-primary/5'
            }
          `}
        >
          <div className="flex flex-col items-center gap-2">
            {isBusy ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <Film className="w-8 h-8 text-gray-400" />
            )}

            {phase === 'compressing' && (
              <>
                <p className="text-sm font-medium text-primary">
                  Compressing… {progress}%
                </p>
                <progress
                  className="w-full max-w-xs h-1.5 rounded-full [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-moz-progress-bar]:rounded-full"
                  value={progress}
                  max={100}
                />
              </>
            )}

            {phase === 'uploading' && (
              <p className="text-sm font-medium text-primary">Uploading…</p>
            )}

            {phase === 'validating' && (
              <p className="text-sm font-medium text-primary">Checking video…</p>
            )}

            {phase === 'idle' && (
              <>
                <div className="text-sm">
                  <span className="font-medium text-primary">Click to upload</span>
                  <span className="text-gray-500"> or drag and drop</span>
                </div>
                <p className="text-xs text-gray-500">
                  MP4, WebM, MOV or OGG · max {MAX_RAW_SIZE_MB} MB · max {MAX_DURATION_S}s
                </p>
                <p className="text-xs text-gray-400">
                  Videos over {COMPRESS_THRESHOLD_MB} MB are auto-compressed to 360p
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Browse button */}
      {!displayUrl && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {isBusy ? 'Processing…' : 'Browse Video'}
        </Button>
      )}

      {/* Preview + clear */}
      {displayUrl && (
        <div className="relative rounded-lg overflow-hidden border bg-black">
          <video
            src={displayUrl}
            controls
            className="w-full max-h-48 object-contain"
            playsInline
          />
          <button
            type="button"
            aria-label="Remove video"
            onClick={handleClear}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {phase === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Hidden input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Video upload input"
      />
    </div>
  )
}

export default VideoUpload
