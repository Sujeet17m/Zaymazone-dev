/**
 * Settlement Service — Module 4
 *
 * Core accounting engine for Zaymazone.
 *
 * Responsibilities:
 *  1. Calculate artisan settlement for a given date range
 *  2. Generate weekly settlement reports for all artisans
 *  3. Post immutable ledger entries for every monetary event
 *  4. Handle refund adjustments (UPI refunds, COD returns)
 *  5. Summarise platform P&L
 *
 * Commission tiers (configurable via env):
 *   PLATFORM_COMMISSION_RATE  — default 10% of gross
 *   LOGISTICS_DEDUCTION       — shipping cost borne by platform, passed through
 */

import mongoose from 'mongoose'
import Order      from '../models/Order.js'
import Artisan    from '../models/Artisan.js'
import Settlement from '../models/Settlement.js'
import LedgerEntry from '../models/LedgerEntry.js'

// ── Configuration ────────────────────────────────────────────────────────────

const COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.10')

/**
 * Return the ISO week string for a given date, e.g. "2026-W08"
 */
function isoWeekLabel(date) {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
	const dayNum = d.getUTCDay() || 7
	d.setUTCDate(d.getUTCDate() + 4 - dayNum)
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
	const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
	return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/**
 * Monday 00:00:00 UTC of the ISO week containing `date`
 */
function weekStart(date) {
	const d = new Date(date)
	const day = d.getUTCDay() || 7          // treat Sunday as 7
	d.setUTCDate(d.getUTCDate() - (day - 1))
	d.setUTCHours(0, 0, 0, 0)
	return d
}

/**
 * Sunday 23:59:59.999 UTC of the same ISO week
 */
function weekEnd(date) {
	const s = weekStart(date)
	const e = new Date(s)
	e.setUTCDate(s.getUTCDate() + 6)
	e.setUTCHours(23, 59, 59, 999)
	return e
}

/**
 * Build a deterministic settlementId string.
 * Format: SET-<YYYY-Www>-<artisanId[0..5]>
 */
function buildSettlementId(weekLabel, artisanId) {
	return `SET-${weekLabel}-${artisanId.toString().slice(-6).toUpperCase()}`
}

// ── Core Calculation ─────────────────────────────────────────────────────────

/**
 * Calculate the settlement details for ONE artisan over a date range.
 *
 * @param {string|ObjectId} artisanId
 * @param {Date} from  — inclusive start
 * @param {Date} to    — inclusive end
 * @returns {object}   settlement data (not yet persisted)
 */
export async function calculateSettlement(artisanId, from, to) {
	const aid = new mongoose.Types.ObjectId(artisanId)

	// ── 1. Delivered orders in period ────────────────────────────────────────
	const deliveredOrders = await Order.find({
		'items.artisanId': aid,
		status: 'delivered',
		deliveredAt: { $gte: from, $lte: to },
	}).lean()

	// ── 2. Returned / Refunded COD orders ────────────────────────────────────
	const codReturnOrders = await Order.find({
		'items.artisanId': aid,
		paymentMethod: 'cod',
		status: { $in: ['returned', 'refunded'] },
		updatedAt: { $gte: from, $lte: to },
	}).lean()

	// ── 3. UPI orders refunded in period ─────────────────────────────────────
	const upiRefundOrders = await Order.find({
		'items.artisanId': aid,
		paymentMethod: { $in: ['upi_prepaid', 'upi'] },
		paymentStatus: 'refunded',
		refundedAt: { $gte: from, $lte: to },
	}).lean()
	// ── 4. Module 5: Cancelled orders in period (for fee accounting) ────────────────
	const cancelledOrders = await Order.find({
		'items.artisanId': aid,
		status: 'cancelled',
		cancelledAt: { $gte: from, $lte: to },
	}).lean()
	// ── 4. Revenue helpers ───────────────────────────────────────────────────

	/**
	 * For multi-artisan orders we only count items belonging to this artisan.
	 */
	function artisanItemTotal(order) {
		return order.items
			.filter(i => i.artisanId?.toString() === aid.toString())
			.reduce((sum, i) => sum + i.price * i.quantity, 0)
	}

	const grossRevenue = deliveredOrders.reduce((s, o) => s + artisanItemTotal(o), 0)

	const platformCommission = Math.round(grossRevenue * COMMISSION_RATE * 100) / 100

	// Logistics: use saved shippingCost on the order (platform absorbs then charges)
	const logisticsCost = deliveredOrders.reduce((s, o) => s + (o.shippingCost || 0), 0)

	// COD fee collected goes to platform — shown in ledger but NOT deducted from artisan
	const codFeeCollected = deliveredOrders
		.filter(o => o.paymentMethod === 'cod')
		.reduce((s, o) => s + (o.codFee || 0), 0)

	// Module 5: Cancellation fees from cancelled orders in this period
	const cancellationFeesCollected = cancelledOrders
		.reduce((s, o) => s + (o.cancellationFee || 0), 0)

	const codReturnsDeducted = codReturnOrders
		.reduce((s, o) => s + artisanItemTotal(o), 0)

	const upiRefundsDeducted = upiRefundOrders
		.reduce((s, o) => s + (o.refundAmount || artisanItemTotal(o)), 0)

	const netPayable = Math.max(
		0,
		grossRevenue
		- platformCommission
		- logisticsCost
		- codReturnsDeducted
		- upiRefundsDeducted
	)

	return {
		artisanId: aid,
		periodStart: from,
		periodEnd:   to,
		weekLabel:   isoWeekLabel(from),
		grossRevenue,
		platformCommission,
		commissionRate: COMMISSION_RATE,
		logisticsCost,
		codFeeCollected,
		cancellationFeesCollected,   // Module 5
		codReturnsDeducted,
		upiRefundsDeducted,
		adjustments:     [],
		totalAdjustments: 0,
		netPayable,
		orderCount: deliveredOrders.length,
		orders:     deliveredOrders.map(o => o._id),
		refundedOrders: [...codReturnOrders, ...upiRefundOrders].map(o => o._id),
		cancelledOrders: cancelledOrders.map(o => o._id),   // Module 5
	}
}

// ── Persist Settlement ────────────────────────────────────────────────────────

/**
 * Upsert a Settlement document and create matching LedgerEntry rows.
 * Idempotent — running twice for the same artisan + week updates the draft.
 *
 * @param {string|ObjectId} artisanId
 * @param {Date} referenceDate  — any date within the target week
 * @param {'draft'|'pending'} initialStatus
 */
export async function generateSettlement(artisanId, referenceDate = new Date(), initialStatus = 'pending') {
	const from = weekStart(referenceDate)
	const to   = weekEnd(referenceDate)
	const data = await calculateSettlement(artisanId, from, to)
	const settlementId = buildSettlementId(data.weekLabel, artisanId)

	// Upsert settlement
	const settlement = await Settlement.findOneAndUpdate(
		{ settlementId },
		{
			$set: {
				...data,
				settlementId,
				// Only update status if still draft (don't overwrite approved/paid)
			},
			$setOnInsert: { status: initialStatus },
		},
		{ upsert: true, new: true, setDefaultsOnInsert: true }
	)

	// Post ledger entries (skip if already present for this settlement)
	const existing = await LedgerEntry.findOne({ settlementId: settlement._id })
	if (!existing && data.grossRevenue > 0) {
		await postSettlementLedger(settlement, data)
	}

	return settlement
}

// ── Weekly Batch ──────────────────────────────────────────────────────────────

/**
 * Generate settlements for ALL approved artisans for a given week.
 * Returns a summary array.
 *
 * @param {Date} referenceDate  — any date within the target week
 */
export async function generateWeeklySettlements(referenceDate = new Date()) {
	const artisans = await Artisan.find({ approvalStatus: 'approved', isActive: true })
		.select('_id name email payment')
		.lean()

	const results = []
	for (const artisan of artisans) {
		try {
			const s = await generateSettlement(artisan._id, referenceDate, 'pending')
			results.push({
				artisanId:  artisan._id,
				artisanName: artisan.name,
				settlementId: s.settlementId,
				netPayable:  s.netPayable,
				status:      s.status,
			})
		} catch (err) {
			results.push({
				artisanId:   artisan._id,
				artisanName: artisan.name,
				error:       err.message,
			})
		}
	}
	return results
}

// ── Refund Adjustments ────────────────────────────────────────────────────────

/**
 * Record a UPI refund.
 * Updates the order, posts a REFUND ledger entry, and recalculates any
 * open/draft settlement that covers the order's delivery date.
 *
 * @param {string|ObjectId} orderId
 * @param {number} refundAmount    — ₹ amount to refund
 * @param {string} reason
 * @param {string|ObjectId} [adminId]
 */
export async function processUpiRefund(orderId, refundAmount, reason, adminId) {
	const order = await Order.findById(orderId)
	if (!order) throw new Error('Order not found')
	if (!['upi_prepaid', 'upi'].includes(order.paymentMethod)) {
		throw new Error('Order is not a UPI payment')
	}
	if (order.paymentStatus === 'refunded') {
		throw new Error('Order already refunded')
	}

	const refAmt = refundAmount ?? order.total
	order.paymentStatus = 'refunded'
	order.refundAmount  = refAmt
	order.refundReason  = reason
	order.refundedAt    = new Date()
	order.status        = 'refunded'
	await order.save()

	// Ledger: debit seller_payable (money leaves platform to buyer)
	await LedgerEntry.create({
		entryType:   'UPI_REFUND',
		account:     'refund_payable',
		amount:      -refAmt,
		orderId:     order._id,
		orderNumber: order.orderNumber,
		artisanId:   order.items[0]?.artisanId,
		description: `UPI refund issued for order ${order.orderNumber}`,
		note:        reason,
		createdBy:   adminId,
	})

	// Also negate the original SALE ledger entry on seller_payable
	await LedgerEntry.create({
		entryType:   'UPI_REFUND',
		account:     'seller_payable',
		amount:      -refAmt,
		orderId:     order._id,
		orderNumber: order.orderNumber,
		artisanId:   order.items[0]?.artisanId,
		description: `Seller payable reversed: UPI refund for ${order.orderNumber}`,
		note:        reason,
		createdBy:   adminId,
	})

	// Regenerate affected settlement as draft so admin can review
	if (order.items[0]?.artisanId) {
		const refDate = order.deliveredAt || order.createdAt
		await regenerateDraftIfOpen(order.items[0].artisanId, refDate)
	}

	return order
}

/**
 * Record a COD return.
 * Marks order returned and reverses the artisan payable in the ledger.
 */
export async function processCodReturn(orderId, reason, adminId) {
	const order = await Order.findById(orderId)
	if (!order) throw new Error('Order not found')
	if (order.paymentMethod !== 'cod') {
		throw new Error('Order is not a COD payment')
	}

	order.status       = 'returned'
	order.refundReason = reason
	await order.save()

	const itemTotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0)

	await LedgerEntry.create({
		entryType:   'COD_RETURN',
		account:     'seller_payable',
		amount:      -itemTotal,
		orderId:     order._id,
		orderNumber: order.orderNumber,
		artisanId:   order.items[0]?.artisanId,
		description: `COD return for order ${order.orderNumber}`,
		note:        reason,
		createdBy:   adminId,
	})

	if (order.items[0]?.artisanId) {
		const refDate = order.deliveredAt || order.createdAt
		await regenerateDraftIfOpen(order.items[0].artisanId, refDate)
	}

	return order
}

// ── Ledger Helpers ────────────────────────────────────────────────────────────

/**
 * Post all ledger rows for a newly calculated settlement.
 * Called once per settlement; guarded against duplicates in generateSettlement.
 */
async function postSettlementLedger(settlement, data) {
	const entries = []
	const sid = settlement._id
	const aid = data.artisanId

	if (data.grossRevenue > 0) {
		// Credit seller_payable with gross revenue
		entries.push({
			entryType:    'SALE',
			account:      'seller_payable',
			amount:       data.grossRevenue,
			artisanId:    aid,
			settlementId: sid,
			description:  `Gross revenue for ${data.weekLabel} — ${data.orderCount} orders`,
		})
		// Credit platform_revenue with commission
		entries.push({
			entryType:    'COMMISSION',
			account:      'platform_revenue',
			amount:       data.platformCommission,
			artisanId:    aid,
			settlementId: sid,
			description:  `Platform commission (${(data.commissionRate * 100).toFixed(0)}%) for ${data.weekLabel}`,
		})
		// Debit seller_payable for commission
		entries.push({
			entryType:    'COMMISSION',
			account:      'seller_payable',
			amount:       -data.platformCommission,
			artisanId:    aid,
			settlementId: sid,
			description:  `Commission deducted from seller payout for ${data.weekLabel}`,
		})
	}

	if (data.logisticsCost > 0) {
		entries.push({
			entryType:    'LOGISTICS',
			account:      'logistics_payable',
			amount:       data.logisticsCost,
			artisanId:    aid,
			settlementId: sid,
			description:  `Logistics cost for ${data.weekLabel}`,
		})
		entries.push({
			entryType:    'LOGISTICS',
			account:      'seller_payable',
			amount:       -data.logisticsCost,
			artisanId:    aid,
			settlementId: sid,
			description:  `Logistics deducted from seller payout for ${data.weekLabel}`,
		})
	}

	if (data.codFeeCollected > 0) {
		entries.push({
			entryType:    'COD_FEE',
			account:      'platform_revenue',
			amount:       data.codFeeCollected,
			artisanId:    aid,
			settlementId: sid,
			description:  `COD handling fees collected for ${data.weekLabel}`,
		})
	}

	if (data.netPayable > 0) {
		// When actually paid, a SETTLEMENT entry will be added
		// For now, record the gross payable as a seller_payable position
	}

	if (entries.length > 0) {
		await LedgerEntry.insertMany(entries)
	}
}

/**
 * If an artisan has an open (draft/pending) settlement covering `refDate`,
 * regenerate it so refund changes are reflected.
 */
async function regenerateDraftIfOpen(artisanId, refDate) {
	const from  = weekStart(refDate)
	const to    = weekEnd(refDate)
	const label = isoWeekLabel(from)
	const sid   = buildSettlementId(label, artisanId)

	const existing = await Settlement.findOne({ settlementId: sid })
	if (existing && ['draft', 'pending'].includes(existing.status)) {
		await generateSettlement(artisanId, refDate, existing.status)
	}
}

// ── Platform Summary ──────────────────────────────────────────────────────────

/**
 * Aggregate platform P&L from the ledger for a date range.
 */
export async function getPlatformSummary(from, to) {
	const pipeline = [
		{
			$match: {
				createdAt: { $gte: from, $lte: to },
			}
		},
		{
			$group: {
				_id: { account: '$account', entryType: '$entryType' },
				total: { $sum: '$amount' },
				count: { $sum: 1 },
			}
		},
		{ $sort: { '_id.account': 1, '_id.entryType': 1 } },
	]
	const rows = await LedgerEntry.aggregate(pipeline)

	// Build per-account totals for quick-access dashboard cards
	const totals = {
		platform_revenue:     0,
		seller_payable:       0,
		logistics_payable:    0,
		buyer_receivable:     0,
		refund_payable:       0,
		cancellation_reserve: 0,   // Module 5: cancellation fees retained
	}
	for (const r of rows) {
		if (totals[r._id.account] !== undefined) {
			totals[r._id.account] += r.total
		}
	}

	return { rows, totals }
}

// ── Approve & Mark Paid ───────────────────────────────────────────────────────

export async function approveSettlement(settlementId, adminId) {
	const s = await Settlement.findOne({ settlementId })
	if (!s) throw new Error('Settlement not found')
	if (!['draft', 'pending'].includes(s.status)) {
		throw new Error(`Cannot approve settlement in status: ${s.status}`)
	}
	s.status     = 'approved'
	s.approvedBy = adminId
	s.approvedAt = new Date()
	return s.save()
}

export async function markSettlementPaid(settlementId, payoutReference, adminId, note) {
	const s = await Settlement.findOne({ settlementId })
	if (!s) throw new Error('Settlement not found')
	if (s.status !== 'approved') {
		throw new Error('Settlement must be approved before marking as paid')
	}
	s.status          = 'paid'
	s.payoutReference = payoutReference
	s.paidAt          = new Date()
	s.paidBy          = adminId
	s.paidNote        = note

	// Post final SETTLEMENT ledger entry
	await LedgerEntry.create({
		entryType:    'SETTLEMENT',
		account:      'seller_payable',
		amount:       -s.netPayable,
		artisanId:    s.artisanId,
		settlementId: s._id,
		description:  `Payout transferred for ${s.weekLabel} — ref: ${payoutReference}`,
		note:         note,
		createdBy:    adminId,
	})

	return s.save()
}

export async function disputeSettlement(settlementId, note, requesterId) {
	const s = await Settlement.findOne({ settlementId })
	if (!s) throw new Error('Settlement not found')
	s.status      = 'disputed'
	s.disputeNote = note
	s.disputedAt  = new Date()
	return s.save()
}

export default {
	calculateSettlement,
	generateSettlement,
	generateWeeklySettlements,
	processUpiRefund,
	processCodReturn,
	getPlatformSummary,
	approveSettlement,
	markSettlementPaid,
	disputeSettlement,
}
