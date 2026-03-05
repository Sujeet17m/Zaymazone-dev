import mongoose from 'mongoose'

/**
 * EmailQueue — persisted email job log.
 *
 * Every email the system wants to send is first persisted here.  The
 * email service then picks jobs up and attempts delivery, updating
 * status after each attempt.
 *
 * Idempotency:
 *   Each job carries an `idempotencyKey` = sha256(type + entityId).
 *   A unique sparse index prevents the same logical email from being
 *   enqueued twice, which eliminates duplicates during onboarding
 *   re-submissions and concurrent order webhooks.
 *
 * Statuses:
 *   queued   – created, not yet attempted
 *   sending  – attempt in flight (reset to queued/failed on process restart)
 *   sent     – delivered successfully
 *   failed   – all retries exhausted
 *   retrying – transient failure, will be retried
 */
const emailQueueSchema = new mongoose.Schema(
  {
    // Deduplication key — unique per logical email event
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Which template to render
    type: {
      type: String,
      required: true,
      enum: [
        // ── Buyer-facing order emails ─────────────────────────────────────
        'order_confirmation',
        'order_status_update',
        'order_rejection',
        'payment_confirmation',
        'refund_notification',
        // ── Artisan-facing order alerts (Module 5) ────────────────────────
        'new_order_artisan',          // artisan receives a new order
        'order_cancelled_artisan',    // artisan notified of cancellation
        'order_return_artisan',       // artisan notified of return request
        // ── Admin critical alerts (Module 5) ─────────────────────────────
        'admin_order_alert',          // high-value / fraud / return-spike
        // ── Artisan lifecycle ─────────────────────────────────────────────
        'artisan_onboarding_submitted',
        'artisan_approved',
        'artisan_rejected',
        'artisan_verification_success',
        // ── User lifecycle ────────────────────────────────────────────────
        'welcome_user',
        'verification_email',
      ],
    },

    // Recipient
    to: { type: String, required: true, lowercase: true, trim: true },

    // Template payload — all variables the template needs
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Processing state
    status: {
      type: String,
      enum: ['queued', 'sending', 'sent', 'failed', 'retrying'],
      default: 'queued',
      index: true,
    },

    // Retry bookkeeping
    attempts:   { type: Number, default: 0 },
    maxAttempts:{ type: Number, default: 3 },
    nextRetryAt:{ type: Date,   default: null },
    lastError:  { type: String, default: null },

    // Audit
    sentAt:     { type: Date, default: null },
    failedAt:   { type: Date, default: null },

    // Correlation — which document triggered this email
    entityType: { type: String, default: null },  // 'order' | 'artisan' | 'user'
    entityId:   { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  {
    timestamps: true,
    // Auto-expire sent emails after 90 days to keep the collection lean
    // Failed jobs are kept for manual inspection (no TTL on them)
  }
)

// Index to efficiently poll for jobs that are ready to be processed
emailQueueSchema.index({ status: 1, nextRetryAt: 1 })

// Helper: reset any "sending" jobs left behind by a crashed process
emailQueueSchema.statics.resetStaleSendingJobs = async function () {
  const staleCutoff = new Date(Date.now() - 5 * 60 * 1000) // 5 min
  await this.updateMany(
    { status: 'sending', updatedAt: { $lt: staleCutoff } },
    { $set: { status: 'retrying', nextRetryAt: new Date() } }
  )
}

const EmailQueue = mongoose.model('EmailQueue', emailQueueSchema)
export default EmailQueue
