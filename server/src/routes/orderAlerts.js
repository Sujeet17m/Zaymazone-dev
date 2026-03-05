/**
 * orderAlerts.js — Module 5: Order Email Alert Delivery Tracking API
 *
 * Provides admin endpoints for monitoring and managing the order email alert
 * pipeline.  All routes require admin authentication (JWT via requireAuth).
 *
 * Routes
 * ──────
 *   GET  /api/order-alerts/stats          – per-type delivery stats
 *   GET  /api/order-alerts/queue          – recent order-alert jobs (all statuses)
 *   GET  /api/order-alerts/failed         – failed order alert jobs, paginated
 *   POST /api/order-alerts/:jobId/retry   – manually retry one failed job
 *   POST /api/order-alerts/retry-all      – retry every failed order alert job
 */
import { Router }    from 'express'
import EmailQueue     from '../models/EmailQueue.js'
import emailService   from '../services/emailService.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// All order-alert management routes are admin-only
router.use(requireAuth)

// ── ORDER_ALERT_TYPES ─────────────────────────────────────────────────────────
// The subset of EmailQueue types that belong to Module 5
const ORDER_ALERT_TYPES = [
  'order_confirmation',
  'order_status_update',
  'order_rejection',
  'payment_confirmation',
  'refund_notification',
  'new_order_artisan',
  'order_cancelled_artisan',
  'order_return_artisan',
  'admin_order_alert',
]

// ── GET /stats ────────────────────────────────────────────────────────────────
/**
 * Returns delivery counts grouped by (emailType × status).
 *
 * Response shape:
 * {
 *   overall: { queued, sending, sent, failed, retrying, total },
 *   byType: {
 *     new_order_artisan:       { queued, sent, failed, retrying, total },
 *     order_cancelled_artisan: { ... },
 *     ...
 *   },
 *   failureRate: "3.2%"
 * }
 */
router.get('/stats', async (req, res) => {
  try {
    const agg = await EmailQueue.aggregate([
      { $match: { type: { $in: ORDER_ALERT_TYPES } } },
      {
        $group: {
          _id:   { type: '$type', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ])

    const byType  = {}
    const overall = { queued: 0, sending: 0, sent: 0, failed: 0, retrying: 0, total: 0 }

    for (const row of agg) {
      const { type, status } = row._id
      byType[type]          = byType[type] ?? { queued: 0, sending: 0, sent: 0, failed: 0, retrying: 0, total: 0 }
      byType[type][status]  = (byType[type][status] ?? 0) + row.count
      byType[type].total   += row.count
      overall[status]       = (overall[status] ?? 0)      + row.count
      overall.total        += row.count
    }

    const failureRate = overall.total > 0
      ? ((overall.failed / overall.total) * 100).toFixed(1) + '%'
      : '0.0%'

    res.json({ overall, byType, failureRate })
  } catch (error) {
    console.error('orderAlerts /stats error:', error)
    res.status(500).json({ error: 'Failed to fetch alert stats' })
  }
})

// ── GET /queue ────────────────────────────────────────────────────────────────
/**
 * Returns a paginated list of order alert queue entries across all statuses.
 *
 * Query params: page (default 1), limit (default 20), status, type
 */
router.get('/queue', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1)
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const skip   = (page - 1) * limit

    const filter = { type: { $in: ORDER_ALERT_TYPES } }
    if (req.query.status) filter.status = req.query.status
    if (req.query.type && ORDER_ALERT_TYPES.includes(req.query.type)) {
      filter.type = req.query.type
    }

    const [jobs, total] = await Promise.all([
      EmailQueue.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-payload')  // omit large payload from list view
        .lean(),
      EmailQueue.countDocuments(filter),
    ])

    res.json({
      jobs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('orderAlerts /queue error:', error)
    res.status(500).json({ error: 'Failed to fetch alert queue' })
  }
})

// ── GET /failed ───────────────────────────────────────────────────────────────
/**
 * Returns failed order alert jobs with full payload for diagnosis.
 *
 * Query params: page (default 1), limit (default 20), type
 */
router.get('/failed', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1)
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const skip   = (page - 1) * limit

    const filter = {
      type:   { $in: ORDER_ALERT_TYPES },
      status: 'failed',
    }
    if (req.query.type && ORDER_ALERT_TYPES.includes(req.query.type)) {
      filter.type = req.query.type
    }

    const [jobs, total] = await Promise.all([
      EmailQueue.find(filter)
        .sort({ failedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailQueue.countDocuments(filter),
    ])

    res.json({
      jobs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('orderAlerts /failed error:', error)
    res.status(500).json({ error: 'Failed to fetch failed alerts' })
  }
})

// ── POST /:jobId/retry ────────────────────────────────────────────────────────
/**
 * Manually retry one failed or retrying order alert job.
 * Resets it to `queued` and immediately triggers an inline delivery attempt.
 */
router.post('/:jobId/retry', async (req, res) => {
  try {
    const { jobId } = req.params

    // Validate that the job exists and belongs to an order-alert type
    const job = await EmailQueue.findOne({
      _id:  jobId,
      type: { $in: ORDER_ALERT_TYPES },
    })

    if (!job) {
      return res.status(404).json({ error: 'Order alert job not found' })
    }

    if (!['failed', 'retrying'].includes(job.status)) {
      return res.status(400).json({
        error:  `Job cannot be retried: current status is "${job.status}"`,
        status: job.status,
      })
    }

    const retried = await emailService.retryJob(jobId)
    res.json({ message: 'Retry triggered', job: retried })
  } catch (error) {
    console.error('orderAlerts /:jobId/retry error:', error)
    res.status(500).json({ error: error.message || 'Failed to retry job' })
  }
})

// ── POST /retry-all ───────────────────────────────────────────────────────────
/**
 * Retry ALL failed order alert jobs.
 * Useful after fixing an SMTP issue to flush the entire failed queue.
 * Returns counts of how many jobs were queued for retry.
 */
router.post('/retry-all', async (req, res) => {
  try {
    const failedJobs = await EmailQueue.find({
      type:   { $in: ORDER_ALERT_TYPES },
      status: 'failed',
    }).select('_id').lean()

    if (!failedJobs.length) {
      return res.json({ message: 'No failed order alert jobs to retry', retried: 0 })
    }

    // Reset all to queued in bulk — let the background worker pick them up
    const result = await EmailQueue.updateMany(
      { _id: { $in: failedJobs.map(j => j._id) } },
      {
        $set: {
          status:      'queued',
          nextRetryAt: new Date(),
          lastError:   null,
        },
      }
    )

    console.log(`[orderAlerts] retry-all: reset ${result.modifiedCount} failed job(s) to queued`)
    res.json({
      message: `${result.modifiedCount} failed job(s) queued for retry`,
      retried: result.modifiedCount,
    })
  } catch (error) {
    console.error('orderAlerts /retry-all error:', error)
    res.status(500).json({ error: 'Failed to retry jobs' })
  }
})

// ── GET /:jobId ───────────────────────────────────────────────────────────────
/**
 * Returns full detail of one order alert job including payload,
 * all attempts, and error history.
 */
router.get('/:jobId', async (req, res) => {
  try {
    const job = await EmailQueue.findOne({
      _id:  req.params.jobId,
      type: { $in: ORDER_ALERT_TYPES },
    }).lean()

    if (!job) {
      return res.status(404).json({ error: 'Order alert job not found' })
    }

    res.json(job)
  } catch (error) {
    console.error('orderAlerts /:jobId error:', error)
    res.status(500).json({ error: 'Failed to fetch job' })
  }
})

export default router
