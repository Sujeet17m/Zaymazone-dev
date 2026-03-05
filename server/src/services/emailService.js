/**
 * emailService.js  (Module 1 â€” Mail System Stabilisation)
 *
 * Architecture
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Every email request is first PERSISTED to the EmailQueue collection
 * (status = "queued") and only then attempted.  This gives us:
 *
 *  1. No duplicate emails
 *     An idempotency key (SHA-256 of type + entityId) sits behind a
 *     unique index.  A second call for the same event silently returns
 *     the existing job instead of creating a duplicate.
 *
 *  2. No race conditions
 *     All in-flight work is committed to Mongo before delivery starts,
 *     so concurrent requests see a consistent state.
 *
 *  3. Status tracking
 *     Each job transitions: queued â†’ sending â†’ sent | failed | retrying
 *
 *  4. Automatic retries
 *     Up to 3 attempts with exponential back-off (1 min, 5 min, 15 min).
 *
 *  5. Reusable templates
 *     All HTML is produced by emailTemplates.js â€” one source of truth.
 *
 * Transport
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Configure via environment variables:
 *   EMAIL_ENABLED       true | false   (default false â€” logs only)
 *   SMTP_HOST           e.g. smtp.gmail.com
 *   SMTP_PORT           e.g. 587
 *   SMTP_SECURE         true | false
 *   SMTP_USER           sender address
 *   SMTP_PASS           app password / API key
 *   FROM_EMAIL          "Zaymazone <noreply@zaymazone.com>"
 *
 * Public API
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *   enqueue(type, to, payload, entityType?, entityId?, dedupExtra?)
 *   --- Buyer-facing ---
 *   sendOrderConfirmation(order, user)
 *   sendOrderStatusUpdate(order, user, newStatus, trackingInfo?)
 *   sendOrderRejectionNotification(order, user, reason)
 *   sendPaymentConfirmation(order, user, paymentDetails)
 *   sendRefundNotification(order, user, refundDetails)
 *   --- Artisan-facing order alerts (Module 5) ---
 *   sendNewOrderToArtisan(order, artisan)
 *   sendOrderCancelledToArtisan(order, artisan, reason, cancelledBy?, feeBreakdown?)
 *   sendReturnRequestToArtisan(order, artisan, returnReason, returnDetails?)
 *   --- Admin alerts (Module 5) ---
 *   sendAdminOrderAlert(alertType, order, details?)
 *   --- Artisan lifecycle ---
 *   sendArtisanOnboardingSubmitted(artisan)
 *   sendArtisanApproved(artisan)
 *   sendArtisanRejected(artisan, reason)
 *   sendVerificationSuccess(artisan, badge)
 *   --- User lifecycle ---
 *   sendWelcomeUser(user)
 *   sendVerificationEmail(user, verificationUrl)
 *   --- Queue management ---
 *   retryJob(jobId)
 *   getQueueStats()
 */

import crypto     from 'crypto'
import nodemailer from 'nodemailer'
import EmailQueue  from '../models/EmailQueue.js'
import { renderTemplate } from './emailTemplates.js'

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const QUEUE_POLL_MS   = parseInt(process.env.EMAIL_QUEUE_POLL_MS || '10000', 10)
const MAX_ATTEMPTS    = parseInt(process.env.EMAIL_MAX_ATTEMPTS  || '3',     10)
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000]

// â”€â”€â”€ Nodemailer transport factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildTransport() {
  if (process.env.EMAIL_ENABLED !== 'true') return null
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool: true,
    maxConnections: 3,
    rateDelta: 1000,
    rateLimit: 10,
  })
}

// â”€â”€â”€ Idempotency key â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function makeIdempotencyKey(type, entityId, extra = '') {
  const raw = `${type}:${String(entityId)}:${extra}`
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 40)
}

// â”€â”€â”€ EmailService â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class EmailService {
  constructor() {
    this.isEnabled   = process.env.EMAIL_ENABLED === 'true'
    this.fromEmail   = process.env.FROM_EMAIL   || 'Zaymazone <noreply@zaymazone.com>'
    this.companyName = 'Zaymazone'
    this.transport   = buildTransport()
    this._workerTimer = null
  }


  // â”€â”€â”€ Core: enqueue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Persist an email job and attempt delivery.
   * Duplicate calls (same idempotency key) return the existing job silently.
   */
  async enqueue(type, to, payload, entityType = null, entityId = null, dedupExtra = '') {
    const idempotencyKey = makeIdempotencyKey(type, entityId ?? to, dedupExtra)

    let job
    try {
      job = await EmailQueue.create({
        idempotencyKey,
        type,
        to: to.toLowerCase().trim(),
        payload,
        entityType,
        entityId,
        maxAttempts: MAX_ATTEMPTS,
        nextRetryAt: new Date(),
        status: 'queued',
      })
      console.log(`[EmailService] Queued ${type} â†’ ${to} (${job._id})`)
    } catch (err) {
      if (err.code === 11000) {
        job = await EmailQueue.findOne({ idempotencyKey })
        console.log(`[EmailService] Duplicate suppressed: ${type} â†’ ${to} (job ${job?._id})`)
        return job
      }
      throw err
    }

    // Attempt inline delivery when the background worker is not running
    if (!this._workerTimer) {
      this._deliverJob(job).catch(e =>
        console.error('[EmailService] Inline delivery error:', e.message)
      )
    }

    return job
  }

  // â”€â”€â”€ Queue Worker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  startQueueWorker() {
    if (this._workerTimer) return

    // Reset stale "sending" jobs left by a crashed process
    EmailQueue.resetStaleSendingJobs().catch(e =>
      console.warn('[EmailService] Could not reset stale jobs:', e.message)
    )

    const poll = async () => {
      try {
        await this._processQueue()
      } catch (err) {
        console.error('[EmailService] Worker error:', err.message)
      } finally {
        this._workerTimer = setTimeout(poll, QUEUE_POLL_MS)
      }
    }

    this._workerTimer = setTimeout(poll, 0)
    console.log(`[EmailService] Queue worker started (poll every ${QUEUE_POLL_MS / 1000}s)`)
  }

  stopQueueWorker() {
    if (this._workerTimer) {
      clearTimeout(this._workerTimer)
      this._workerTimer = null
    }
  }

  async _processQueue() {
    const now  = new Date()
    const jobs = await EmailQueue.find({
      status:      { $in: ['queued', 'retrying'] },
      nextRetryAt: { $lte: now },
    }).sort({ nextRetryAt: 1 }).limit(20)

    for (const job of jobs) {
      await this._deliverJob(job)
    }
  }

  async _deliverJob(job) {
    // Atomically claim the job to prevent double-sending in concurrent workers
    const claimed = await EmailQueue.findOneAndUpdate(
      { _id: job._id, status: { $in: ['queued', 'retrying'] } },
      { $set: { status: 'sending' } },
      { new: true }
    )
    if (!claimed) return

    try {
      if (!this.isEnabled) {
        console.log(`[EmailService] Delivery skipped (EMAIL_ENABLED=false): ${job.type} â†’ ${job.to}`)
      } else {
        const { subject, html } = renderTemplate(job.type, job.payload)
        await this.transport.sendMail({
          from:    this.fromEmail,
          to:      job.to,
          subject,
          html,
        })
        console.log(`[EmailService] âœ… Sent ${job.type} â†’ ${job.to}`)
      }

      await EmailQueue.findByIdAndUpdate(job._id, {
        $set: { status: 'sent', sentAt: new Date(), lastError: null },
        $inc: { attempts: 1 },
      })
    } catch (err) {
      const attempts       = job.attempts + 1
      const hasMoreRetries = attempts < job.maxAttempts
      const delayMs        = RETRY_DELAYS_MS[attempts - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]

      console.error(`[EmailService] âŒ ${job.type} â†’ ${job.to} [${attempts}/${job.maxAttempts}]: ${err.message}`)

      await EmailQueue.findByIdAndUpdate(job._id, {
        $set: {
          status:      hasMoreRetries ? 'retrying' : 'failed',
          lastError:   err.message,
          failedAt:    hasMoreRetries ? null : new Date(),
          nextRetryAt: hasMoreRetries ? new Date(Date.now() + delayMs) : null,
        },
        $inc: { attempts: 1 },
      })
    }
  }

  // â”€â”€â”€ Admin helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async retryJob(jobId) {
    const job = await EmailQueue.findByIdAndUpdate(
      jobId,
      { $set: { status: 'queued', nextRetryAt: new Date(), lastError: null } },
      { new: true }
    )
    if (!job) throw new Error(`Email job ${jobId} not found`)
    await this._deliverJob(job)
    return job
  }

  async getQueueStats() {
    const stats = await EmailQueue.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
    const result = { queued: 0, sending: 0, sent: 0, failed: 0, retrying: 0, total: 0 }
    for (const s of stats) {
      result[s._id] = s.count
      result.total += s.count
    }
    return result
  }

  // â”€â”€â”€ Convenience wrappers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async sendOrderConfirmation(order, user) {
    return this.enqueue(
      'order_confirmation',
      user.email,
      {
        userName:       user.name,
        orderNumber:    order.orderNumber,
        orderDate:      order.createdAt,
        totalAmount:    order.total ?? order.totalAmount,
        paymentMethod:  order.paymentMethod,
        items: (order.items || []).map(i => ({
          name:     i.name || i.productId?.name || 'Product',
          quantity: i.quantity,
          price:    i.price,
        })),
        shippingAddress: order.shippingAddress || {},
      },
      'order', order._id
    )
  }

  async sendOrderStatusUpdate(order, user, newStatus, trackingInfo = {}) {
    return this.enqueue(
      'order_status_update',
      user.email,
      {
        userName:       user.name,
        orderNumber:    order.orderNumber,
        newStatus,
        trackingNumber: trackingInfo.trackingNumber,
        courierService: trackingInfo.courierService,
      },
      'order', order._id, newStatus
    )
  }

  async sendOrderRejectionNotification(order, user, reason) {
    return this.enqueue(
      'order_rejection',
      user.email,
      {
        userName:    user.name,
        orderNumber: order.orderNumber,
        orderDate:   order.createdAt,
        totalAmount: order.total ?? order.totalAmount,
        reason,
      },
      'order', order._id, 'rejection'
    )
  }

  async sendPaymentConfirmation(order, user, paymentDetails) {
    return this.enqueue(
      'payment_confirmation',
      user.email,
      {
        userName:    user.name,
        orderNumber: order.orderNumber,
        paymentId:   paymentDetails.paymentId,
        amount:      order.total ?? order.totalAmount,
        paymentDate: new Date(),
      },
      'order', order._id, 'payment'
    )
  }

  async sendRefundNotification(order, user, refundDetails) {
    return this.enqueue(
      'refund_notification',
      user.email,
      {
        userName:     user.name,
        orderNumber:  order.orderNumber,
        refundId:     refundDetails.refundId,
        refundAmount: refundDetails.amount,
        refundDate:   new Date(),
      },
      'order', order._id, `refund:${refundDetails.refundId}`
    )
  }

  async sendArtisanOnboardingSubmitted(artisan) {
    const email = artisan.email || artisan.businessInfo?.contact?.email
    if (!email) { console.warn('[EmailService] No email for artisan', artisan._id); return null }
    return this.enqueue(
      'artisan_onboarding_submitted',
      email,
      {
        artisanName:  artisan.name,
        businessName: artisan.businessInfo?.businessName || artisan.name,
        submittedAt:  artisan.createdAt || new Date(),
      },
      'artisan', artisan._id, 'submitted'
    )
  }

  async sendArtisanApproved(artisan) {
    const email = artisan.email || artisan.businessInfo?.contact?.email
    if (!email) { console.warn('[EmailService] No email for artisan', artisan._id); return null }
    return this.enqueue(
      'artisan_approved',
      email,
      {
        artisanName:  artisan.name,
        businessName: artisan.businessInfo?.businessName || artisan.name,
        approvedAt:   artisan.approvedAt || new Date(),
      },
      'artisan', artisan._id, 'approved'
    )
  }

  async sendArtisanRejected(artisan, reason) {
    const email = artisan.email || artisan.businessInfo?.contact?.email
    if (!email) { console.warn('[EmailService] No email for artisan', artisan._id); return null }
    return this.enqueue(
      'artisan_rejected',
      email,
      {
        artisanName:  artisan.name,
        businessName: artisan.businessInfo?.businessName || artisan.name,
        rejectedAt:   artisan.approvedAt || new Date(),
        reason,
      },
      'artisan', artisan._id, 'rejected'
    )
  }

  async sendWelcomeUser(user) {
    return this.enqueue(
      'welcome_user',
      user.email,
      { userName: user.name },
      'user', user._id
    )
  }

  async sendVerificationEmail(user, verificationUrl) {
    return this.enqueue(
      'verification_email',
      user.email,
      { userName: user.name, verificationUrl },
      'user', user._id, 'verification'
    )
  }

  // ─── Module 5: Artisan & Admin order alert wrappers ───────────────────────────

  /**
   * Notify an artisan that they have received a new order.
   * @param {Object} order    – saved Order document (lean or full)
   * @param {Object} artisan  – Artisan document (must have .email and .name)
   */
  async sendNewOrderToArtisan(order, artisan) {
    const email = artisan.email || artisan.businessInfo?.contact?.email
    if (!email) {
      console.warn('[EmailService] sendNewOrderToArtisan: no email for artisan', artisan._id)
      return null
    }
    // Build item list filtered to this artisan
    const artisanIdStr = artisan._id?.toString()
    const items = (order.items || [])
      .filter(i => !artisanIdStr || i.artisanId?.toString() === artisanIdStr)
      .map(i => ({ name: i.name || 'Product', quantity: i.quantity, price: i.price }))

    return this.enqueue(
      'new_order_artisan',
      email,
      {
        artisanName:  artisan.name,
        businessName: artisan.businessInfo?.businessName || artisan.name,
        orderNumber:  order.orderNumber,
        orderDate:    order.createdAt || new Date(),
        items:        items.length ? items : (order.items || []).map(i => ({ name: i.name || 'Product', quantity: i.quantity, price: i.price })),
        buyerName:    order.shippingAddress?.fullName || 'A customer',
        buyerCity:    order.shippingAddress?.city     || '',
        buyerState:   order.shippingAddress?.state    || '',
        orderTotal:   order.total ?? order.totalAmount ?? 0,
      },
      'order', order._id, `artisan:${artisan._id}:new`
    )
  }

  /**
   * Notify an artisan that one of their orders was cancelled.
   * @param {Object} order         – Order document
   * @param {Object} artisan       – Artisan document
   * @param {string} reason        – Cancellation reason
   * @param {'buyer'|'admin'|'system'} [cancelledBy='buyer']
   * @param {Object} [feeBreakdown]
   */
  async sendOrderCancelledToArtisan(order, artisan, reason = '', cancelledBy = 'buyer', feeBreakdown = {}) {
    const email = artisan.email || artisan.businessInfo?.contact?.email
    if (!email) {
      console.warn('[EmailService] sendOrderCancelledToArtisan: no email for artisan', artisan._id)
      return null
    }
    const artisanIdStr = artisan._id?.toString()
    const items = (order.items || [])
      .filter(i => !artisanIdStr || i.artisanId?.toString() === artisanIdStr)
      .map(i => ({ name: i.name || 'Product', quantity: i.quantity, price: i.price }))

    return this.enqueue(
      'order_cancelled_artisan',
      email,
      {
        artisanName:         artisan.name,
        businessName:        artisan.businessInfo?.businessName || artisan.name,
        orderNumber:         order.orderNumber,
        orderDate:           order.createdAt   || new Date(),
        items:               items.length ? items : (order.items || []).map(i => ({ name: i.name || 'Product', quantity: i.quantity, price: i.price })),
        cancelledBy,
        cancellationReason:  reason || order.cancellationReason || 'Not specified',
        refundableAmount:    feeBreakdown.refundableAmount ?? order.refundableAmount ?? 0,
      },
      'order', order._id, `artisan:${artisan._id}:cancelled`
    )
  }

  /**
   * Notify an artisan that a return request was submitted for their order.
   * @param {Object} order         – Order document
   * @param {Object} artisan       – Artisan document
   * @param {string} returnReason  – Buyer's stated return reason
   * @param {Object} [returnDetails]
   */
  async sendReturnRequestToArtisan(order, artisan, returnReason = 'Not specified', returnDetails = {}) {
    const email = artisan.email || artisan.businessInfo?.contact?.email
    if (!email) {
      console.warn('[EmailService] sendReturnRequestToArtisan: no email for artisan', artisan._id)
      return null
    }
    const artisanIdStr = artisan._id?.toString()
    const items = (order.items || [])
      .filter(i => !artisanIdStr || i.artisanId?.toString() === artisanIdStr)
      .map(i => ({ name: i.name || 'Product', quantity: i.quantity, price: i.price }))

    return this.enqueue(
      'order_return_artisan',
      email,
      {
        artisanName:  artisan.name,
        businessName: artisan.businessInfo?.businessName || artisan.name,
        orderNumber:  order.orderNumber,
        orderDate:    order.createdAt   || new Date(),
        items:        items.length ? items : (order.items || []).map(i => ({ name: i.name || 'Product', quantity: i.quantity, price: i.price })),
        buyerName:    order.shippingAddress?.fullName || 'The buyer',
        returnReason,
        deliveredAt:  order.deliveredAt ?? returnDetails.deliveredAt ?? null,
      },
      'order', order._id, `artisan:${artisan._id}:return`
    )
  }

  /**
   * Send a critical order alert to the platform Admin email.
   * The admin address is taken from the ADMIN_EMAIL env variable; if not set,
   * falls back to SMTP_USER (the sending address).
   *
   * @param {'high_value'|'bulk_cancellation'|'return_spike'|'payment_failure'|'fraud_flag'|'artisan_cancellation'} alertType
   * @param {Object} order
   * @param {Object} [details]  Extra key/value pairs shown in the alert table
   */
  async sendAdminOrderAlert(alertType, order, details = {}) {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER
    if (!adminEmail) {
      console.warn('[EmailService] sendAdminOrderAlert: ADMIN_EMAIL not configured, alert suppressed')
      return null
    }
    // Build artisanName from first item (best effort)
    const artisanName = details.artisanName
      || (order.items?.[0]?.artisanId?.name)
      || 'unknown'

    return this.enqueue(
      'admin_order_alert',
      adminEmail,
      {
        alertType,
        orderNumber:       order.orderNumber,
        orderDate:         order.createdAt ?? new Date(),
        totalAmount:       order.total ?? order.totalAmount ?? 0,
        buyerEmail:        order.shippingAddress?.email || details.buyerEmail || 'unknown',
        artisanName,
        details,
        adminDashboardUrl: process.env.ADMIN_DASHBOARD_URL || 'https://zaymazone.com/admin',
      },
      'order', order._id, `admin:${alertType}`
    )
  }

  /**
   * Sent once when all required documents are approved and the artisan earns the verified badge.
   * @param {Object} artisan  – populated Artisan document
   * @param {Object} badge    – verifiedBadge data (badgeId, tier, issuedAt, metadata)
   */
  async sendVerificationSuccess(artisan, badge = {}) {
    const email = artisan.email || artisan.businessInfo?.contact?.email
    if (!email) { console.warn('[EmailService] No email for artisan', artisan._id); return null }
    return this.enqueue(
      'artisan_verification_success',
      email,
      {
        artisanName:         artisan.name,
        businessName:        artisan.businessInfo?.businessName || artisan.name,
        badgeId:             badge.badgeId             || '',
        tier:                badge.tier                || 'standard',
        verifiedAt:          badge.issuedAt            || new Date(),
        verificationScore:   badge.metadata?.verificationScore ?? 100,
        documentsVerified:   badge.metadata?.documentsVerified || [],
      },
      'artisan', artisan._id, 'verification_success'
    )
  }
}

export default new EmailService()

