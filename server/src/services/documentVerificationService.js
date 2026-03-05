/**
 * documentVerificationService.js  (Module 2 – Document Verification Workflow)
 *
 * Responsibilities
 * ─────────────────
 * 1. Run automated checks (type, size, clarity proxy) the moment a file lands.
 * 2. Decide whether to auto-approve or enqueue for manual admin review.
 * 3. Expose admin helpers: review queue, approve, reject, full audit log.
 * 4. Keep Artisan.verification.isVerified & documentVerification flags in sync.
 */

import path from 'path'
import crypto from 'crypto'
import DocumentVerification from '../models/DocumentVerification.js'
import Artisan from '../models/Artisan.js'
import Product from '../models/Product.js'
import emailService from './emailService.js'

// ── Auto-check rule table ─────────────────────────────────────────────────────

/**
 * Per document-type validation rules:
 *   allowedMimes   – whitelist of MIME types
 *   maxBytes       – hard upper limit (server already enforces multer limit)
 *   minBytes       – lower bound; files smaller than this are likely blank/corrupt
 *   autoApprove    – if all checks pass, immediately approve without admin review
 *   requiredForVerification – counts toward the overall "verified" badge
 */
const RULES = {
  aadhaar_proof: {
    allowedMimes:  ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    allowedExts:   ['.jpg', '.jpeg', '.png', '.pdf'],
    maxBytes:       5 * 1024 * 1024,   // 5 MB
    minBytes:       5 * 1024,          // 5 KB  (blank-file guard)
    autoApprove:   false,              // always queue for human review
    requiredForVerification: true,
  },
  pan_proof: {
    allowedMimes:  ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    allowedExts:   ['.jpg', '.jpeg', '.png', '.pdf'],
    maxBytes:       5 * 1024 * 1024,
    minBytes:       5 * 1024,
    autoApprove:   false,
    requiredForVerification: true,
  },
  gst_certificate: {
    allowedMimes:  ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    allowedExts:   ['.jpg', '.jpeg', '.png', '.pdf'],
    maxBytes:      10 * 1024 * 1024,   // 10 MB
    minBytes:       10 * 1024,
    autoApprove:   false,
    requiredForVerification: true,
  },
  business_license: {
    allowedMimes:  ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    allowedExts:   ['.jpg', '.jpeg', '.png', '.pdf'],
    maxBytes:      10 * 1024 * 1024,
    minBytes:       5 * 1024,
    autoApprove:   false,
    requiredForVerification: false,
  },
  bank_proof: {
    allowedMimes:  ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    allowedExts:   ['.jpg', '.jpeg', '.png', '.pdf'],
    maxBytes:       5 * 1024 * 1024,
    minBytes:       5 * 1024,
    autoApprove:   false,
    requiredForVerification: false,
  },
  craft_video: {
    allowedMimes:  ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    allowedExts:   ['.mp4', '.mov', '.avi'],
    maxBytes:     100 * 1024 * 1024,   // 100 MB
    minBytes:     100 * 1024,          // 100 KB  (blank guard)
    autoApprove:   false,
    requiredForVerification: false,
  },
  profile_photo: {
    allowedMimes:  ['image/jpeg', 'image/jpg', 'image/png'],
    allowedExts:   ['.jpg', '.jpeg', '.png'],
    maxBytes:       5 * 1024 * 1024,
    minBytes:       10 * 1024,
    autoApprove:   true,               // safe to auto-approve a profile picture
    requiredForVerification: true,
  },
}

// Documents that MUST be approved for the artisan to earn the verified badge
const REQUIRED_TYPES = Object.entries(RULES)
  .filter(([, r]) => r.requiredForVerification)
  .map(([type]) => type)

// ── Core: automated checks ────────────────────────────────────────────────────

/**
 * Runs every automated validation rule for the given document type.
 *
 * @param {{ originalname, mimetype, size }} file – Multer file object
 * @param {string} documentType
 * @returns {{ passed: boolean, results: Array<{checkName, passed, message}> }}
 */
function runAutoChecks(file, documentType) {
  const rule    = RULES[documentType]
  const results = []

  if (!rule) {
    results.push({ checkName: 'knownType', passed: false, message: `Unknown document type: ${documentType}` })
    return { passed: false, results }
  }

  // 1 ── MIME type check
  const mimeOk = rule.allowedMimes.includes(file.mimetype)
  results.push({
    checkName: 'fileType',
    passed:    mimeOk,
    message:   mimeOk
      ? `MIME type ${file.mimetype} is allowed`
      : `MIME type ${file.mimetype} is not allowed for ${documentType}. Expected: ${rule.allowedMimes.join(', ')}`,
  })

  // 2 ── File extension check
  const ext    = path.extname(file.originalname || '').toLowerCase()
  const extOk  = rule.allowedExts.includes(ext)
  results.push({
    checkName: 'fileExtension',
    passed:    extOk,
    message:   extOk
      ? `Extension ${ext} is valid`
      : `Extension ${ext} is not permitted. Allowed: ${rule.allowedExts.join(', ')}`,
  })

  // 3 ── Maximum size check
  const maxOk = file.size <= rule.maxBytes
  results.push({
    checkName: 'maxFileSize',
    passed:    maxOk,
    message:   maxOk
      ? `File size (${_fmtBytes(file.size)}) is within limit`
      : `File size (${_fmtBytes(file.size)}) exceeds the ${_fmtBytes(rule.maxBytes)} limit`,
  })

  // 4 ── Minimum size check (blank / corrupt file guard)
  const minOk = file.size >= rule.minBytes
  results.push({
    checkName: 'minFileSize',
    passed:    minOk,
    message:   minOk
      ? `File size (${_fmtBytes(file.size)}) meets minimum requirement`
      : `File appears to be blank or corrupt – size (${_fmtBytes(file.size)}) is below minimum (${_fmtBytes(rule.minBytes)})`,
  })

  // 5 ── MIME / extension consistency check (guards against renamed files)
  const mimeExtCombos = {
    'image/jpeg':       ['.jpg', '.jpeg'],
    'image/jpg':        ['.jpg', '.jpeg'],
    'image/png':        ['.png'],
    'application/pdf':  ['.pdf'],
    'video/mp4':        ['.mp4'],
    'video/quicktime':  ['.mov'],
    'video/x-msvideo':  ['.avi'],
  }
  const expectedExts = mimeExtCombos[file.mimetype] || []
  const consistent   = expectedExts.length === 0 || expectedExts.includes(ext)
  results.push({
    checkName: 'mimeExtConsistency',
    passed:    consistent,
    message:   consistent
      ? 'MIME type and file extension are consistent'
      : `MIME type ${file.mimetype} does not match extension ${ext}. Possible spoofed file.`,
  })

  const passed = results.every(r => r.passed)
  return { passed, results }
}

// ── Core: process a new upload ────────────────────────────────────────────────

/**
 * Called immediately after a document is uploaded via any route.
 * Creates the DocumentVerification record, runs auto-checks and sets the
 * initial status.
 *
 * @param {string|ObjectId} artisanId
 * @param {string}          documentType  – key from RULES
 * @param {{ path, originalname, mimetype, size }} file  – Multer file object
 * @returns {DocumentVerification}  – the persisted verification record
 */
async function processUpload(artisanId, documentType, file) {
  // 1 – Run automated validation
  const { passed, results } = runAutoChecks(file, documentType)

  // 2 – Determine initial status
  let status
  const rule = RULES[documentType]
  if (!passed) {
    status = 'auto_failed'
  } else if (rule?.autoApprove) {
    status = 'approved'
  } else {
    // All checks passed but requires human sign-off → queue for manual review
    status = 'manual_review'
  }

  // 3 – Persist the record
  const docRecord = await DocumentVerification.create({
    artisanId,
    documentType,
    fileUrl:      file.path,
    originalName: file.originalname || '',
    mimeType:     file.mimetype     || '',
    fileSize:     file.size         || 0,
    status,
    autoCheckResults: results,
    uploadedAt:   new Date(),
    // Pre-populate adminReview for auto-approved docs
    ...(status === 'approved' ? {
      adminReview: {
        decision:   'approved',
        notes:      'Automatically approved by system',
        reviewedAt: new Date(),
      }
    } : {}),
  })

  // 4 – Sync the artisan verification flags
  await _syncArtisanVerification(artisanId)

  console.log(`[docVerify] Processed ${documentType} for artisan ${artisanId} → ${status}`)
  return docRecord
}

// ── Admin: review queue ───────────────────────────────────────────────────────

/**
 * Returns documents currently waiting for a human admin to decide.
 *
 * @param {{ page, limit, documentType, artisanId }} opts
 */
async function getManualReviewQueue({
  page         = 1,
  limit        = 20,
  documentType = null,
  artisanId    = null,
} = {}) {
  const query = { status: { $in: ['manual_review', 'auto_failed'] } }
  if (documentType) query.documentType = documentType
  if (artisanId)    query.artisanId    = artisanId

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10)

  const [docs, total] = await Promise.all([
    DocumentVerification.find(query)
      .sort({ uploadedAt: 1 })                       // oldest first (FIFO)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('artisanId', 'name email businessInfo.businessName approvalStatus')
      .lean(),
    DocumentVerification.countDocuments(query),
  ])

  return {
    total,
    page:  parseInt(page, 10),
    pages: Math.ceil(total / parseInt(limit, 10)),
    docs,
  }
}

// ── Admin: approve a document ─────────────────────────────────────────────────

/**
 * @param {string|ObjectId} docId
 * @param {string|ObjectId} adminId
 * @param {string}          notes
 */
async function approveDocument(docId, adminId, notes = '') {
  const doc = await DocumentVerification.findById(docId)
  if (!doc) throw Object.assign(new Error('Document not found'), { status: 404 })

  if (doc.status === 'approved') {
    return doc  // idempotent – already approved
  }

  doc.status      = 'approved'
  doc.adminReview = {
    reviewedBy:  adminId,
    decision:    'approved',
    notes,
    reviewedAt:  new Date(),
    flaggedReasons: [],
  }
  await doc.save()

  await _syncArtisanVerification(doc.artisanId)

  console.log(`[docVerify] Document ${docId} (${doc.documentType}) approved by admin ${adminId}`)
  return doc
}

// ── Admin: reject a document ──────────────────────────────────────────────────

/**
 * @param {string|ObjectId} docId
 * @param {string|ObjectId} adminId
 * @param {string}          reason         – primary rejection reason (shown to artisan)
 * @param {string[]}        flaggedReasons – machine-readable flags (e.g. ['blurry', 'expired'])
 */
async function rejectDocument(docId, adminId, reason = '', flaggedReasons = []) {
  const doc = await DocumentVerification.findById(docId)
  if (!doc) throw Object.assign(new Error('Document not found'), { status: 404 })

  doc.status      = 'rejected'
  doc.adminReview = {
    reviewedBy:     adminId,
    decision:       'rejected',
    notes:          reason,
    flaggedReasons,
    reviewedAt:     new Date(),
  }
  await doc.save()

  await _syncArtisanVerification(doc.artisanId)

  console.log(`[docVerify] Document ${docId} (${doc.documentType}) rejected by admin ${adminId} — ${reason}`)
  return doc
}

// ── Artisan: verification status ─────────────────────────────────────────────

/**
 * Returns a full verification status report for one artisan.
 * The report includes:
 *   - latest document record for every type that has been uploaded
 *   - a checklist showing approved / pending / rejected / missing per required type
 *   - overall isVerified flag
 *
 * @param {string|ObjectId} artisanId
 */
async function getVerificationStatus(artisanId) {
  const latestDocs = await DocumentVerification.latestPerType(artisanId)

  // Build a map: documentType → latest record
  const byType = {}
  for (const doc of latestDocs) {
    byType[doc.documentType] = doc
  }

  // Build checklist
  const checklist = REQUIRED_TYPES.map(type => {
    const doc = byType[type]
    return {
      documentType:   type,
      status:         doc ? doc.status : 'not_uploaded',
      uploadedAt:     doc ? doc.uploadedAt : null,
      documentId:     doc ? doc._id : null,
    }
  })

  const allRequiredApproved = checklist.every(c => c.status === 'approved')
  const pendingCount        = checklist.filter(c => ['manual_review', 'auto_passed', 'pending_auto'].includes(c.status)).length
  const rejectedCount       = checklist.filter(c => c.status === 'rejected' || c.status === 'auto_failed').length

  return {
    artisanId,
    isVerified:        allRequiredApproved,
    checklist,
    pendingCount,
    rejectedCount,
    allDocuments:      latestDocs,    // full records for UI display
  }
}

// ── Admin: full audit log ─────────────────────────────────────────────────────

/**
 * Paginated log of all verification events, newest first.
 *
 * @param {{ page, limit, artisanId, documentType, status }} opts
 */
async function getVerificationLogs({
  page         = 1,
  limit        = 50,
  artisanId    = null,
  documentType = null,
  status       = null,
} = {}) {
  const query = {}
  if (artisanId)    query.artisanId    = artisanId
  if (documentType) query.documentType = documentType
  if (status)       query.status       = status

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10)

  const [logs, total] = await Promise.all([
    DocumentVerification.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('artisanId', 'name email')
      .populate('adminReview.reviewedBy', 'name email')
      .lean(),
    DocumentVerification.countDocuments(query),
  ])

  return {
    total,
    page:  parseInt(page, 10),
    pages: Math.ceil(total / parseInt(limit, 10)),
    logs,
  }
}

// ── Internal: sync artisan flags ──────────────────────────────────────────────

/**
 * After any status change, recompute:
 *   artisan.documentVerification.{field}  (boolean per doc type)
 *   artisan.verification.isVerified       (true only when all required docs approved)
 *
 * If the artisan just crossed the threshold for the first time also:
 *   • Generate and persist the verified badge
 *   • Fire the verification-success email (non-blocking)
 *   • Activate all previously-approved products belonging to the artisan
 */
async function _syncArtisanVerification(artisanId) {
  try {
    // Snapshot the previous verified state so we can detect transitions
    const prev = await Artisan.findById(artisanId)
      .select('verification.isVerified verifiedBadge name email businessInfo approvedAt')
      .lean()

    const wasVerifiedBefore = prev?.verification?.isVerified ?? false

    const latestDocs = await DocumentVerification.latestPerType(artisanId)

    // Build partial update for documentVerification boolean flags
    const docVerUpdate = {}
    for (const doc of latestDocs) {
      const fieldMap = {
        aadhaar_proof:    'aadhaarProof',
        pan_proof:        'aadharProof',
        gst_certificate:  'gstCertificate',
        business_license: 'gstCertificate',
        bank_proof:       'bankDetails',
        craft_video:      'craftVideo',
        profile_photo:    'profilePhoto',
      }
      const field = fieldMap[doc.documentType]
      if (field) docVerUpdate[`documentVerification.${field}`] = doc.status === 'approved'
    }

    // Determine verified state
    const approvedTypes  = latestDocs.filter(d => d.status === 'approved').map(d => d.documentType)
    const isVerified     = REQUIRED_TYPES.every(t => approvedTypes.includes(t))
    const justVerified   = isVerified && !wasVerifiedBefore

    // Generate badge when transitioning to verified
    let badgeUpdate = {}
    let badge       = prev?.verifiedBadge

    if (justVerified) {
      badge = _generateBadge(artisanId, approvedTypes, latestDocs)
      badgeUpdate = { verifiedBadge: badge }
    }

    await Artisan.findByIdAndUpdate(artisanId, {
      ...docVerUpdate,
      'verification.isVerified':  isVerified,
      ...(isVerified ? { 'verification.verifiedAt': new Date() } : {}),
      ...badgeUpdate,
    }, { new: false })

    if (justVerified) {
      console.log(`[docVerify] Artisan ${artisanId} achieved VERIFIED status ✅ Badge: ${badge.badgeId.slice(0, 12)}…`)

      // 1 ─ Fire success email (non-blocking, deduplicated via idempotency key)
      const artisanForEmail = prev        // has name, email, businessInfo
      emailService.sendVerificationSuccess(
        { ...artisanForEmail, _id: artisanId },
        badge
      ).catch(e => console.error('[docVerify] verification success email error:', e.message))

      // 2 ─ Activate all previously-approved products so they appear in storefront
      const productsResult = await Product.updateMany(
        { artisanId, approvalStatus: 'approved' },
        { isActive: true }
      )
      if (productsResult.modifiedCount > 0) {
        console.log(`[docVerify] Re-activated ${productsResult.modifiedCount} approved product(s) for artisan ${artisanId}`)
      }
    }
  } catch (err) {
    console.error('[docVerify] Failed to sync artisan verification flags:', err.message)
  }
}

// ── Internal: badge generator ─────────────────────────────────────────────────

/**
 * Builds the verified-badge payload that is stored on the Artisan document.
 *
 * Tier logic:
 *   premium  → artisan has approved: pan_proof + aadhaar_proof + gst_certificate
 *   standard → artisan meets the minimum required set
 *
 * @param {string|ObjectId}  artisanId
 * @param {string[]}         approvedTypes   – list of currently-approved documentTypes
 * @param {Object[]}         latestDocs      – raw DocumentVerification records
 * @returns {Object}  badge payload ready to save on Artisan.verifiedBadge
 */
function _generateBadge(artisanId, approvedTypes, latestDocs) {
  const now    = new Date()
  const rawKey = `badge:${String(artisanId)}:${now.toISOString()}`
  const badgeId = crypto.createHash('sha256').update(rawKey).digest('hex')

  // Score = (total approved docs / total possible doc types) * 100
  const totalPossible      = Object.keys(RULES).length
  const verificationScore  = Math.round((approvedTypes.length / totalPossible) * 100)

  // Premium tier: all three identity / tax documents present
  const premiumRequired = ['pan_proof', 'aadhaar_proof', 'gst_certificate']
  const tier = premiumRequired.every(t => approvedTypes.includes(t)) ? 'premium' : 'standard'

  const displayText = tier === 'premium'
    ? 'Zaymazone Premium Verified Artisan'
    : 'Zaymazone Verified Artisan'

  return {
    badgeId,
    tier,
    displayText,
    issuedAt: now,
    metadata: {
      documentsVerified:  approvedTypes,
      verificationScore,
      requiredCount:      REQUIRED_TYPES.length,
      approvedCount:      approvedTypes.length,
    },
  }
}

// ── Public: get badge data ──────────────────────────────────────────────────

/**
 * Return the active verified badge for an artisan (if any).
 * Also returns a public-safe summary for use on product and profile pages.
 *
 * @param {string|ObjectId} artisanId
 */
async function getBadge(artisanId) {
  const artisan = await Artisan.findById(artisanId)
    .select('verification.isVerified verification.verifiedAt verifiedBadge name businessInfo')
    .lean()

  if (!artisan) throw Object.assign(new Error('Artisan not found'), { status: 404 })

  const isVerified = artisan.verification?.isVerified ?? false

  if (!isVerified || !artisan.verifiedBadge?.badgeId) {
    return {
      artisanId: String(artisanId),
      isVerified: false,
      badge: null,
    }
  }

  const b = artisan.verifiedBadge
  return {
    artisanId:   String(artisanId),
    artisanName: artisan.name,
    businessName: artisan.businessInfo?.businessName || artisan.name,
    isVerified:  true,
    badge: {
      badgeId:           b.badgeId,
      tier:              b.tier,
      displayText:       b.displayText,
      issuedAt:          b.issuedAt,
      verificationScore: b.metadata?.verificationScore ?? 0,
      documentsVerified: b.metadata?.documentsVerified ?? [],
    },
  }
}

// ── Format helper ─────────────────────────────────────────────────────────────

function _fmtBytes(bytes) {
  if (bytes < 1024)               return `${bytes} B`
  if (bytes < 1024 * 1024)        return `${(bytes / 1024).toFixed(1)} KB`
  return                                 `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── Exports ───────────────────────────────────────────────────────────────────

export const documentVerificationService = {
  processUpload,
  runAutoChecks,
  getManualReviewQueue,
  approveDocument,
  rejectDocument,
  getVerificationStatus,
  getVerificationLogs,
  getBadge,
  RULES,
  REQUIRED_TYPES,
}
