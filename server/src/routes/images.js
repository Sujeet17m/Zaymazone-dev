import { Router } from 'express'
import { getImageByFilename, getImageStream, uploadImageToGridFS } from '../services/imageService.js'
import multer from 'multer'
import fs from 'fs'
import path from 'path'

import cors from 'cors'

const router = Router()
// Remove helmet's cross-origin policies that conflict
router.use((req, res, next) => {
  res.removeHeader('Cross-Origin-Opener-Policy')
  res.removeHeader('Cross-Origin-Resource-Policy')
  next()
})
// Apply permissive CORS for images
router.use(cors({ origin: '*' }))

// Handle preflight for all image routes
router.options('*', (req, res) => res.sendStatus(200))

// Configure multer for memory storage
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit (increased for videos and documents)
  fileFilter: (req, file, cb) => {
    // Accept images, documents (PDF, DOC), and videos
    const allowedMimeTypes = [
      'image/',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/'
    ];
    
    const isAllowed = allowedMimeTypes.some(type => file.mimetype.startsWith(type));
    
    if (isAllowed) {
      cb(null, true)
    } else {
      cb(new Error('Only image, document (PDF/DOC), and video files are allowed'))
    }
  }
})

// Upload image endpoint
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const { category = 'other' } = req.body
    const { buffer, originalname, mimetype, size } = req.file

    // Generate unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const extension = path.extname(originalname)
    const filename = `${timestamp}-${random}${extension}`

    // Save to temp file first
    const tempPath = path.join(process.cwd(), 'temp', filename)
    await fs.promises.mkdir(path.dirname(tempPath), { recursive: true })
    await fs.promises.writeFile(tempPath, buffer)

    // Upload to GridFS
    const result = await uploadImageToGridFS(tempPath, filename, category)

    // Clean up temp file
    await fs.promises.unlink(tempPath)

    res.json({
      success: true,
      image: {
        id: result.id,
        filename: result.filename,
        url: `${req.protocol}://${req.get('host')}/api/images/${result.filename}`,
        contentType: result.contentType,
        size: result.size
      }
    })
  } catch (error) {
    console.error('Image upload error:', error)
    res.status(500).json({ error: 'Failed to upload image' })
  }
})

// Serve image by filename
router.get('/:filename', async (req, res) => {
  try {
    // CORS middleware applied, no further headers needed
    
    const { filename } = req.params
    
    // Find image metadata
    const imageDoc = await getImageByFilename(filename)
    if (!imageDoc) {
      return res.status(404).json({ error: 'Image not found' })
    }

    // Set proper headers
    res.set('Content-Type', imageDoc.contentType)
    res.set('Content-Length', imageDoc.size)
    res.set('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
    res.set('Cross-Origin-Resource-Policy', 'cross-origin') // allow cross-origin img loads

    // Stream image from GridFS
    const downloadStream = getImageStream(imageDoc.gridfsId)
    
    downloadStream.on('error', (error) => {
      console.error('Error streaming image:', error)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error serving image' }) // CORS headers already applied
      }
    })

    downloadStream.pipe(res)
    
  } catch (error) {
    console.error('Image serve error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server error' }) // CORS headers already applied
    }
  }
})

// Get image metadata
router.get('/:filename/info', async (req, res) => {
  try {
    const { filename } = req.params
    const imageDoc = await getImageByFilename(filename)
    
    if (!imageDoc) {
      return res.status(404).json({ error: 'Image not found' })
    }

    res.json({
      id: imageDoc._id,
      filename: imageDoc.filename,
      originalName: imageDoc.originalName,
      contentType: imageDoc.contentType,
      size: imageDoc.size,
      category: imageDoc.category,
      uploadDate: imageDoc.uploadDate
    })
  } catch (error) {
    console.error('Get image info error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router