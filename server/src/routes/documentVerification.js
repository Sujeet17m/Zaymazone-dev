/**
 * documentVerification.js  (Module 2 – Document Verification Workflow)
 *
 * Routes
 * ──────
 *  POST   /api/document-verification/upload            – artisan uploads a document
 *  GET    /api/document-verification/status            – artisan: own verification status
 *  GET    /api/document-verification/rules             – public: per-type upload rules
 *
 *  (admin)
 *  GET    /api/document-verification/admin/status/:artisanId – full status for any artisan
 *  GET    /api/document-verification/admin/queue             – manual review queue
 *  GET    /api/document-verification/admin/logs              – full audit log
 *  PATCH  /api/document-verification/admin/:docId/approve    – approve a document
 *  PATCH  /api/document-verification/admin/:docId/reject     – reject a document
 */

import express from 'express'
import multer  from 'multer'
import path    from 'path'
import fs      from 'fs'

import { authenticateToken }                from '../middleware/firebase-auth.js'
import { requireAuth, requireAdmin }        from '../middleware/auth.js'
import Artisan                              from '../models/Artisan.js'
import DocumentVerification                 from '../models/DocumentVerification.js'
import { documentVerificationService as dv } from '../services/documentVerificationService.js'

const router = express.Router()

// ── Multer setup ──────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'doc-verification')

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    cb(null, UPLOAD_DIR)
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${file.fieldname}-${unique}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },   // hard cap 100 MB (craft videos)
  fileFilter: (_req, file, cb) => {
    const ALLOWED_MIMES = [
      'image/jpeg', 'image/jpg', 'image/png',
      'application/pdf',
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
    ]
    if (ALLOWED_MIMES.includes(file.mimetype)) return cb(null, true)
    cb(new Error(`File type ${file.mimetype} is not permitted`))
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve the artisan record for the currently authenticated user */
async function _resolveArtisan(userId) {
  return Artisan.findOne({ userId })
}

// ── Artisan routes ────────────────────────────────────────────────────────────

/**
 * POST /api/document-verification/upload
 *
 * Body (multipart/form-data):
 *   file         – the document file
 *   documentType – one of the valid enum values
 *
 * Triggers auto-verification immediately after the file lands on disk.
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' })
    }

    const { documentType } = req.body
    if (!documentType) {
      return res.status(400).json({ success: false, message: 'documentType is required' })
    }

    const validTypes = Object.keys(dv.RULES)
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({
        success:       false,
        message:       `Invalid documentType. Must be one of: ${validTypes.join(', ')}`,
        validTypes,
      })
    }

    // Resolve artisan
    const artisan = await _resolveArtisan(req.user._id)
    if (!artisan) {
      return res.status(404).json({ success: false, message: 'Artisan profile not found. Please complete onboarding first.' })
    }

    // Run auto-checks and persist
    const docRecord = await dv.processUpload(artisan._id, documentType, req.file)

    const isAutoFailed  = docRecord.status === 'auto_failed'
    const isQueued      = docRecord.status === 'manual_review'
    const isApproved    = docRecord.status === 'approved'

    return res.status(201).json({
      success:          true,
      message:          isAutoFailed
        ? 'Document uploaded but failed automated checks. It has been flagged for admin review.'
        : isApproved
          ? 'Document uploaded and automatically approved.'
          : 'Document uploaded successfully and queued for admin review.',
      documentId:       docRecord._id,
      documentType:     docRecord.documentType,
      status:           docRecord.status,
      autoCheckResults: docRecord.autoCheckResults,
      failedChecks:     docRecord.autoCheckResults.filter(r => !r.passed),
      isQueued,
      isAutoFailed,
    })
  } catch (err) {
    console.error('[docVerify] Upload error:', err)

    // Clean up the uploaded file if processing failed
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => {})
    }

    return res.status(500).json({ success: false, message: 'Upload failed', error: err.message })
  }
})

/**
 * GET /api/document-verification/status
 *
 * Returns the authenticated artisan's full verification status including
 * per-document checklist and the overall isVerified flag.
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const artisan = await _resolveArtisan(req.user._id)
    if (!artisan) {
      return res.status(404).json({ success: false, message: 'Artisan profile not found' })
    }

    const status = await dv.getVerificationStatus(artisan._id)

    return res.json({ success: true, ...status })
  } catch (err) {
    console.error('[docVerify] Status error:', err)
    return res.status(500).json({ success: false, message: 'Failed to fetch verification status', error: err.message })
  }
})

/**
 * GET /api/document-verification/badge/:artisanId
 *
 * Public: returns the verified badge data for any artisan.
 * Used by product listing cards and artisan profile pages to display the badge.
 * No authentication required — badge info is public.
 */
router.get('/badge/:artisanId', async (req, res) => {
  try {
    const result = await dv.getBadge(req.params.artisanId)
    return res.json({ success: true, ...result })
  } catch (err) {
    const httpStatus = err.status || 500
    return res.status(httpStatus).json({ success: false, message: err.message })
  }
})

/**
 * GET /api/document-verification/rules
 *
 * Public endpoint that returns the per-document-type upload requirements.
 * Used by the frontend to build the upload form dynamically.
 */
router.get('/rules', (_req, res) => {
  const rules = Object.entries(dv.RULES).map(([type, r]) => ({
    documentType:            type,
    allowedMimes:            r.allowedMimes,
    allowedExtensions:       r.allowedExts,
    maxSizeBytes:            r.maxBytes,
    minSizeBytes:            r.minBytes,
    maxSizeMB:               +(r.maxBytes / 1024 / 1024).toFixed(0),
    requiresManualReview:    !r.autoApprove,
    requiredForVerification: r.requiredForVerification,
  }))

  return res.json({
    success:       true,
    requiredTypes: dv.REQUIRED_TYPES,
    rules,
  })
})

// ── Admin routes ──────────────────────────────────────────────────────────────

/**
 * GET /api/document-verification/admin/status/:artisanId
 *
 * Admin: full verification status for any artisan.
 */
router.get(
  '/admin/status/:artisanId',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const artisan = await Artisan.findById(req.params.artisanId).lean()
      if (!artisan) {
        return res.status(404).json({ success: false, message: 'Artisan not found' })
      }

      const status = await dv.getVerificationStatus(req.params.artisanId)
      return res.json({ success: true, ...status })
    } catch (err) {
      console.error('[docVerify] Admin status error:', err)
      return res.status(500).json({ success: false, message: 'Failed to fetch verification status', error: err.message })
    }
  }
)

/**
 * GET /api/document-verification/admin/queue
 *
 * Admin: paginated list of documents awaiting manual review.
 * Query params: page, limit, documentType, artisanId
 */
router.get(
  '/admin/queue',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { page, limit, documentType, artisanId } = req.query

      const result = await dv.getManualReviewQueue({ page, limit, documentType, artisanId })

      return res.json({ success: true, ...result })
    } catch (err) {
      console.error('[docVerify] Admin queue error:', err)
      return res.status(500).json({ success: false, message: 'Failed to fetch review queue', error: err.message })
    }
  }
)

/**
 * PATCH /api/document-verification/admin/:docId/approve
 *
 * Admin: approve a document.
 * Body: { notes }
 */
router.patch(
  '/admin/:docId/approve',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { notes = '' } = req.body
      const adminId        = req.user.sub   // JWT payload "sub" = user._id

      const doc = await dv.approveDocument(req.params.docId, adminId, notes)

      return res.json({
        success:  true,
        message:  `Document approved`,
        document: {
          _id:          doc._id,
          documentType: doc.documentType,
          artisanId:    doc.artisanId,
          status:       doc.status,
          adminReview:  doc.adminReview,
        },
      })
    } catch (err) {
      const httpStatus = err.status || 500
      console.error('[docVerify] Admin approve error:', err)
      return res.status(httpStatus).json({ success: false, message: err.message })
    }
  }
)

/**
 * PATCH /api/document-verification/admin/:docId/reject
 *
 * Admin: reject a document and optionally flag specific issues.
 * Body: { reason, flaggedReasons: string[] }
 */
router.patch(
  '/admin/:docId/reject',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { reason = '', flaggedReasons = [] } = req.body

      if (!reason) {
        return res.status(400).json({ success: false, message: 'rejection reason is required' })
      }

      const adminId = req.user.sub

      const doc = await dv.rejectDocument(req.params.docId, adminId, reason, flaggedReasons)

      return res.json({
        success:  true,
        message:  'Document rejected',
        document: {
          _id:          doc._id,
          documentType: doc.documentType,
          artisanId:    doc.artisanId,
          status:       doc.status,
          adminReview:  doc.adminReview,
        },
      })
    } catch (err) {
      const httpStatus = err.status || 500
      console.error('[docVerify] Admin reject error:', err)
      return res.status(httpStatus).json({ success: false, message: err.message })
    }
  }
)

/**
 * GET /api/document-verification/admin/logs
 *
 * Admin: full audit log with optional filters.
 * Query params: page, limit, artisanId, documentType, status
 */
router.get(
  '/admin/logs',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { page, limit, artisanId, documentType, status } = req.query

      const result = await dv.getVerificationLogs({ page, limit, artisanId, documentType, status })

      return res.json({ success: true, ...result })
    } catch (err) {
      console.error('[docVerify] Admin logs error:', err)
      return res.status(500).json({ success: false, message: 'Failed to fetch logs', error: err.message })
    }
  }
)

/**
 * GET /api/document-verification/admin/:docId
 *
 * Admin: fetch a single document record by ID.
 */
router.get(
  '/admin/:docId',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const doc = await DocumentVerification.findById(req.params.docId)
        .populate('artisanId', 'name email businessInfo.businessName approvalStatus')
        .populate('adminReview.reviewedBy', 'name email')
        .lean()

      if (!doc) {
        return res.status(404).json({ success: false, message: 'Document record not found' })
      }

      return res.json({ success: true, document: doc })
    } catch (err) {
      console.error('[docVerify] Admin get-single error:', err)
      return res.status(500).json({ success: false, message: 'Failed to fetch document', error: err.message })
    }
  }
)

export default router
