/**
 * Settlement Routes — Module 4
 * Base path: /api/settlements  (mounted in index.js)
 *
 * ─── Seller endpoints (JWT from artisan signin) ──────────────────────────────
 *  GET    /api/settlements/my                     — paginated list for logged-in artisan
 *  GET    /api/settlements/my/:settlementId       — single settlement detail
 *  GET    /api/settlements/my/ledger              — artisan ledger entries
 *  POST   /api/settlements/my/:settlementId/dispute — raise a dispute
 *
 * ─── Admin endpoints (Firebase auth + admin role) ───────────────────────────
 *  GET    /api/settlements                        — all settlements (filterable)
 *  POST   /api/settlements/generate-weekly        — generate this week's batch
 *  POST   /api/settlements/generate/:artisanId    — generate for one artisan
 *  PATCH  /api/settlements/:settlementId/approve  — approve a settlement
 *  PATCH  /api/settlements/:settlementId/paid     — mark as paid
 *  POST   /api/settlements/refund/upi             — process UPI refund
 *  POST   /api/settlements/refund/cod             — process COD return
 *  GET    /api/settlements/platform/summary       — platform P&L summary
 *  GET    /api/settlements/ledger                 — full ledger (admin)
 */

import { Router } from 'express'
import { z }      from 'zod'
import mongoose   from 'mongoose'
import Settlement  from '../models/Settlement.js'
import LedgerEntry from '../models/LedgerEntry.js'
import Artisan     from '../models/Artisan.js'
import Order       from '../models/Order.js'
import settlementService from '../services/settlementService.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { authenticateToken }         from '../middleware/firebase-auth.js'
import { validate, idSchema, paginationSchema } from '../middleware/validation.js'

const router = Router()

// ── Shared helpers ────────────────────────────────────────────────────────────

const settlementIdParamSchema = z.object({ settlementId: z.string().min(1) })
const mongoIdParamSchema      = z.object({ id: idSchema })
const artisanIdParamSchema    = z.object({ artisanId: idSchema })

function parseDateRange(query) {
	const now  = new Date()
	const from = query.from ? new Date(query.from) : new Date(now.getFullYear(), now.getMonth(), 1)
	const to   = query.to   ? new Date(query.to)   : now
	return { from, to }
}

// ── SELLER: List my settlements ───────────────────────────────────────────────
router.get('/my', requireAuth, async (req, res) => {
	try {
		// req.user.sub is the artisan's _id (set by JWT middleware from artisan signin)
		const artisanId = new mongoose.Types.ObjectId(req.user.sub)

		const page  = Math.max(1, parseInt(req.query.page)  || 1)
		const limit = Math.min(50, parseInt(req.query.limit) || 10)
		const filter = { artisanId }
		if (req.query.status) filter.status = req.query.status

		const [settlements, total] = await Promise.all([
			Settlement.find(filter)
				.sort({ periodStart: -1 })
				.skip((page - 1) * limit)
				.limit(limit)
				.lean(),
			Settlement.countDocuments(filter),
		])

		res.json({
			settlements,
			pagination: {
				page, limit, total,
				pages:    Math.ceil(total / limit),
				hasNext:  page < Math.ceil(total / limit),
				hasPrev:  page > 1,
			},
		})
	} catch (err) {
		console.error('GET /settlements/my error:', err)
		res.status(500).json({ error: 'Failed to fetch settlements' })
	}
})

// ── SELLER: My ledger entries  ← MUST be before /my/:settlementId ────────────
router.get('/my/ledger', requireAuth, async (req, res) => {
	try {
		const artisanId = new mongoose.Types.ObjectId(req.user.sub)

		const page  = Math.max(1, parseInt(req.query.page)  || 1)
		const limit = Math.min(100, parseInt(req.query.limit) || 20)
		const filter = { artisanId }
		if (req.query.entryType) filter.entryType = req.query.entryType.toUpperCase()

		const { from, to } = parseDateRange(req.query)
		filter.createdAt = { $gte: from, $lte: to }

		const [entries, total] = await Promise.all([
			LedgerEntry.find(filter)
				.sort({ createdAt: -1 })
				.skip((page - 1) * limit)
				.limit(limit)
				.populate('orderId', 'orderNumber status')
				.lean(),
			LedgerEntry.countDocuments(filter),
		])

		res.json({
			entries,
			pagination: {
				page, limit, total,
				pages:   Math.ceil(total / limit),
				hasNext: page < Math.ceil(total / limit),
				hasPrev: page > 1,
			},
		})
	} catch (err) {
		console.error('GET /settlements/my/ledger error:', err)
		res.status(500).json({ error: 'Failed to fetch ledger' })
	}
})

// ── SELLER: Single settlement detail ─────────────────────────────────────────
router.get('/my/:settlementId', requireAuth, async (req, res) => {
	try {
		const artisanId = new mongoose.Types.ObjectId(req.user.sub)

		const s = await Settlement.findOne({
			settlementId: req.params.settlementId,
			artisanId,
		}).populate('orders', 'orderNumber status total createdAt')
		  .populate('refundedOrders', 'orderNumber status total refundAmount refundedAt')
		  .lean()

		if (!s) return res.status(404).json({ error: 'Settlement not found' })
		res.json(s)
	} catch (err) {
		console.error('GET /settlements/my/:id error:', err)
		res.status(500).json({ error: 'Failed to fetch settlement' })
	}
})

// ── SELLER: Raise a dispute ───────────────────────────────────────────────────
router.post(
	'/my/:settlementId/dispute',
	requireAuth,
	validate(z.object({ note: z.string().min(10).max(500) })),
	async (req, res) => {
		try {
			const artisanId = new mongoose.Types.ObjectId(req.user.sub)

			const s = await Settlement.findOne({
				settlementId: req.params.settlementId,
				artisanId,
			})
			if (!s) return res.status(404).json({ error: 'Settlement not found' })
			if (!['approved', 'pending'].includes(s.status)) {
				return res.status(400).json({ error: `Cannot dispute a ${s.status} settlement` })
			}

			const updated = await settlementService.disputeSettlement(
				req.params.settlementId,
				req.validatedBody.note,
				req.user.sub,
			)
			res.json({ success: true, settlement: updated })
		} catch (err) {
			console.error('POST /settlements/my/:id/dispute error:', err)
			res.status(500).json({ error: err.message || 'Failed to raise dispute' })
		}
	}
)

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES (Firebase auth)
// ═══════════════════════════════════════════════════════════════════════════════

// Require Firebase auth for all routes below
router.use(authenticateToken)

// ── ADMIN: List all settlements ───────────────────────────────────────────────
router.get('/', async (req, res) => {
	if (!req.user?.role || !['admin'].includes(req.user.role)) {
		// Fall through to artisan check (artisan can only see their own via /my)
		return res.status(403).json({ error: 'Admin access required' })
	}
	try {
		const page   = Math.max(1, parseInt(req.query.page)  || 1)
		const limit  = Math.min(100, parseInt(req.query.limit) || 20)
		const filter = {}
		if (req.query.status)    filter.status    = req.query.status
		if (req.query.artisanId) {
			filter.artisanId = new mongoose.Types.ObjectId(req.query.artisanId)
		}
		if (req.query.from || req.query.to) {
			const { from, to } = parseDateRange(req.query)
			filter.periodStart = { $gte: from }
			filter.periodEnd   = { $lte: to }
		}

		const [settlements, total] = await Promise.all([
			Settlement.find(filter)
				.sort({ periodStart: -1 })
				.skip((page - 1) * limit)
				.limit(limit)
				.populate('artisanId', 'name email payment')
				.lean(),
			Settlement.countDocuments(filter),
		])

		res.json({
			settlements,
			pagination: {
				page, limit, total,
				pages:   Math.ceil(total / limit),
				hasNext: page < Math.ceil(total / limit),
				hasPrev: page > 1,
			},
		})
	} catch (err) {
		console.error('GET /settlements error:', err)
		res.status(500).json({ error: 'Failed to fetch settlements' })
	}
})

// ── ADMIN: Generate weekly batch ──────────────────────────────────────────────
router.post('/generate-weekly', async (req, res) => {
	if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
	try {
		const refDate = req.body.date ? new Date(req.body.date) : new Date()
		if (isNaN(refDate)) return res.status(400).json({ error: 'Invalid date' })

		const results = await settlementService.generateWeeklySettlements(refDate)
		res.json({
			success: true,
			generated: results.filter(r => !r.error).length,
			results,
		})
	} catch (err) {
		console.error('POST /settlements/generate-weekly error:', err)
		res.status(500).json({ error: err.message || 'Failed to generate settlements' })
	}
})

// ── ADMIN: Generate for one artisan ──────────────────────────────────────────
router.post(
	'/generate/:artisanId',
	validate(artisanIdParamSchema, 'params'),
	async (req, res) => {
		if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
		try {
			const refDate = req.body.date ? new Date(req.body.date) : new Date()
			const s = await settlementService.generateSettlement(
				req.validatedParams.artisanId,
				refDate,
				'pending',
			)
			res.json({ success: true, settlement: s })
		} catch (err) {
			console.error('POST /settlements/generate/:artisanId error:', err)
			res.status(500).json({ error: err.message || 'Failed to generate settlement' })
		}
	}
)

// ── ADMIN: Approve a settlement ───────────────────────────────────────────────
router.patch('/:settlementId/approve', async (req, res) => {
	if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
	try {
		const s = await settlementService.approveSettlement(
			req.params.settlementId,
			req.user._id,
		)
		res.json({ success: true, settlement: s })
	} catch (err) {
		console.error('PATCH /settlements/:id/approve error:', err)
		res.status(400).json({ error: err.message || 'Failed to approve settlement' })
	}
})

// ── ADMIN: Mark as paid ───────────────────────────────────────────────────────
router.patch(
	'/:settlementId/paid',
	validate(z.object({
		payoutReference: z.string().min(3).max(100),
		note:            z.string().max(300).optional(),
	})),
	async (req, res) => {
		if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
		try {
			const s = await settlementService.markSettlementPaid(
				req.params.settlementId,
				req.validatedBody.payoutReference,
				req.user._id,
				req.validatedBody.note,
			)
			res.json({ success: true, settlement: s })
		} catch (err) {
			console.error('PATCH /settlements/:id/paid error:', err)
			res.status(400).json({ error: err.message || 'Failed to mark settlement as paid' })
		}
	}
)

// ── ADMIN: Process UPI refund ─────────────────────────────────────────────────
router.post(
	'/refund/upi',
	validate(z.object({
		orderId:      z.string().regex(/^[0-9a-fA-F]{24}$/),
		refundAmount: z.number().positive().optional(),
		reason:       z.string().min(3).max(300).optional(),
	})),
	async (req, res) => {
		if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
		try {
			const order = await settlementService.processUpiRefund(
				req.validatedBody.orderId,
				req.validatedBody.refundAmount,
				req.validatedBody.reason,
				req.user._id,
			)
			res.json({ message: 'UPI refund processed', order })
		} catch (err) {
			console.error('POST /settlements/refund/upi error:', err)
			res.status(400).json({ error: err.message || 'Failed to process UPI refund' })
		}
	}
)

// ── ADMIN: Process COD return ─────────────────────────────────────────────────
router.post(
	'/refund/cod',
	validate(z.object({
		orderId: z.string().regex(/^[0-9a-fA-F]{24}$/),
		reason:  z.string().min(3).max(300).optional(),
	})),
	async (req, res) => {
		if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
		try {
			const order = await settlementService.processCodReturn(
				req.validatedBody.orderId,
				req.validatedBody.reason,
				req.user._id,
			)
			res.json({ message: 'COD return processed', order })
		} catch (err) {
			console.error('POST /settlements/refund/cod error:', err)
			res.status(400).json({ error: err.message || 'Failed to process COD return' })
		}
	}
)

// ── ADMIN: Platform P&L summary ───────────────────────────────────────────────
router.get('/platform/summary', async (req, res) => {
	if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
	try {
		const { from, to } = parseDateRange(req.query)
		const { rows, totals } = await settlementService.getPlatformSummary(from, to)
		res.json({ success: true, from, to, summary: rows, totals })
	} catch (err) {
		console.error('GET /settlements/platform/summary error:', err)
		res.status(500).json({ error: 'Failed to fetch platform summary' })
	}
})

// ── ADMIN: Full ledger ────────────────────────────────────────────────────────
router.get('/ledger', async (req, res) => {
	if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
	try {
		const page  = Math.max(1, parseInt(req.query.page)  || 1)
		const limit = Math.min(200, parseInt(req.query.limit) || 50)
		const { from, to } = parseDateRange(req.query)

		const filter = { createdAt: { $gte: from, $lte: to } }
		if (req.query.account)    filter.account    = req.query.account
		if (req.query.entryType)  filter.entryType  = req.query.entryType.toUpperCase()
		if (req.query.artisanId)  filter.artisanId  = new mongoose.Types.ObjectId(req.query.artisanId)

		const [entries, total] = await Promise.all([
			LedgerEntry.find(filter)
				.sort({ createdAt: -1 })
				.skip((page - 1) * limit)
				.limit(limit)
				.populate('artisanId', 'name')
				.populate('orderId', 'orderNumber')
				.lean(),
			LedgerEntry.countDocuments(filter),
		])

		res.json({
			entries,
			pagination: {
				page, limit, total,
				pages:   Math.ceil(total / limit),
				hasNext: page < Math.ceil(total / limit),
				hasPrev: page > 1,
			},
		})
	} catch (err) {
		console.error('GET /settlements/ledger error:', err)
		res.status(500).json({ error: 'Failed to fetch ledger' })
	}
})

// ── ADMIN: Preview settlement (no save) ──────────────────────────────────────
router.get(
	'/preview/:artisanId',
	validate(artisanIdParamSchema, 'params'),
	async (req, res) => {
		if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
		try {
			const refDate = req.query.date ? new Date(req.query.date) : new Date()
			const data = await settlementService.calculateSettlement(
				req.validatedParams.artisanId,
				new Date(new Date(refDate).setUTCDate(refDate.getUTCDate() - (refDate.getUTCDay() || 7) + 1)),
				new Date(new Date(refDate).setUTCDate(refDate.getUTCDate() - (refDate.getUTCDay() || 7) + 7)),
			)
			res.json(data)
		} catch (err) {
			console.error('GET /settlements/preview/:artisanId error:', err)
			res.status(500).json({ error: err.message || 'Failed to preview settlement' })
		}
	}
)

export default router
