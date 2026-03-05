/**
 * DocumentVerification.js  (Module 2 – Document Verification Workflow)
 *
 * One record per document submission.  An artisan may upload multiple
 * documents; each gets its own record so we can track them independently
 * and build a full audit trail.
 *
 * Status lifecycle
 * ─────────────────
 *  pending_auto   → document received, auto-checks not yet run
 *  auto_passed    → all automated checks passed (may still need manual review)
 *  auto_failed    → one or more automated checks failed
 *  manual_review  → queued for a human admin to inspect
 *  approved       → admin (or auto) approved the document
 *  rejected       → admin (or auto) rejected the document
 */

import mongoose from 'mongoose'

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const autoCheckResultSchema = new mongoose.Schema({
  checkName:  { type: String, required: true },   // e.g. "fileType", "fileSize", "format"
  passed:     { type: Boolean, required: true },
  message:    { type: String, default: '' },       // human-readable detail
}, { _id: false })

const adminReviewSchema = new mongoose.Schema({
  reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decision:        { type: String, enum: ['approved', 'rejected'] },
  notes:           { type: String, default: '' },
  flaggedReasons:  [{ type: String }],             // e.g. ["blurry", "expired", "mismatch"]
  reviewedAt:      { type: Date },
}, { _id: false })

// ── Main schema ────────────────────────────────────────────────────────────────

const documentVerificationSchema = new mongoose.Schema({
  artisanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artisan',
    required: true,
    index: true,
  },

  // The logical document slot this file fills
  documentType: {
    type: String,
    required: true,
    enum: [
      'aadhaar_proof',
      'pan_proof',
      'gst_certificate',
      'business_license',
      'bank_proof',
      'craft_video',
      'profile_photo',
    ],
    index: true,
  },

  // Where the file is stored (path within uploads dir or GridFS object-id string)
  fileUrl:      { type: String, required: true },
  originalName: { type: String, default: '' },
  mimeType:     { type: String, default: '' },
  fileSize:     { type: Number, default: 0 },        // bytes

  status: {
    type: String,
    required: true,
    enum: ['pending_auto', 'auto_passed', 'auto_failed', 'manual_review', 'approved', 'rejected'],
    default: 'pending_auto',
    index: true,
  },

  // Results from each automated check
  autoCheckResults: [autoCheckResultSchema],

  // Populated if a human admin reviewed this document
  adminReview: { type: adminReviewSchema, default: () => ({}) },

  // When the file was originally uploaded
  uploadedAt: { type: Date, default: Date.now },

  // Free-form metadata for future extensibility
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },

}, { timestamps: true })

// ── Indexes ────────────────────────────────────────────────────────────────────

// Used for manual-review queue pagination
documentVerificationSchema.index({ status: 1, updatedAt: -1 })

// Allows fast "latest doc of type X for artisan Y" queries
documentVerificationSchema.index({ artisanId: 1, documentType: 1, uploadedAt: -1 })

// ── Statics ────────────────────────────────────────────────────────────────────

/**
 * Returns the most recent document record of each type for a given artisan.
 * Useful for building a full-coverage verification status report.
 */
documentVerificationSchema.statics.latestPerType = async function (artisanId) {
  return this.aggregate([
    { $match: { artisanId: new mongoose.Types.ObjectId(artisanId) } },
    { $sort:  { uploadedAt: -1 } },
    {
      $group: {
        _id:    '$documentType',
        doc: { $first: '$$ROOT' },
      }
    },
    { $replaceRoot: { newRoot: '$doc' } },
  ])
}

export default mongoose.model('DocumentVerification', documentVerificationSchema)
