/**
 * Admin Email Queue API
 * Routes:
 *   GET  /api/admin/email-queue           – list jobs (filterable, paginated)
 *   GET  /api/admin/email-queue/stats     – aggregate counts per status
 *   POST /api/admin/email-queue/:jobId/retry – manually retry a failed job
 */

import express from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import EmailQueue from '../models/EmailQueue.js'
import emailService from '../services/emailService.js'

const router = express.Router()

// All routes require admin authentication
router.use(requireAuth, requireAdmin)

// ── GET /api/admin/email-queue/stats ──────────────────────────────────────────
router.get('/stats', async (_req, res) => {
  try {
    const stats = await emailService.getQueueStats()
    res.json({ success: true, stats })
  } catch (error) {
    console.error('[emailQueue] stats error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch stats' })
  }
})

// ── GET /api/admin/email-queue ────────────────────────────────────────────────
// Query params: status, type, page, limit
router.get('/', async (req, res) => {
  try {
    const {
      status,
      type,
      page    = 1,
      limit   = 20,
      sortBy  = 'createdAt',
      order   = 'desc',
    } = req.query

    const query = {}
    if (status) query.status = status
    if (type)   query.type   = type

    const skip    = (parseInt(page, 10) - 1) * parseInt(limit, 10)
    const sortDir = order === 'asc' ? 1 : -1

    const [jobs, total] = await Promise.all([
      EmailQueue.find(query)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      EmailQueue.countDocuments(query),
    ])

    res.json({
      success: true,
      total,
      page:  parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      jobs,
    })
  } catch (error) {
    console.error('[emailQueue] list error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch email queue' })
  }
})

// ── POST /api/admin/email-queue/:jobId/retry ──────────────────────────────────
router.post('/:jobId/retry', async (req, res) => {
  try {
    const job = await emailService.retryJob(req.params.jobId)

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or is not in a retriable state (must be failed)',
      })
    }

    res.json({
      success: true,
      message: 'Job re-queued for immediate retry',
      job: {
        _id:          job._id,
        type:         job.type,
        to:           job.to,
        status:       job.status,
        attempts:     job.attempts,
        nextRetryAt:  job.nextRetryAt,
      },
    })
  } catch (error) {
    console.error('[emailQueue] retry error:', error)
    res.status(500).json({ success: false, message: 'Failed to retry job' })
  }
})

export default router
