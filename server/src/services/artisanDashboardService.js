/**
 * artisanDashboardService.js — Module 2: Artisan Dashboard
 *
 * All MongoDB aggregations for the artisan dashboard:
 *  - Order counts (total, pending, delivered, cancelled, rejected, …)
 *  - Revenue analytics with period comparison & growth %
 *  - Daily/monthly revenue trend
 *  - Performance metrics (fulfillment rate, avg handling time, return rate, …)
 *  - Full dashboard bundle (single round-trip call)
 */

import mongoose from 'mongoose'
import Order from '../models/Order.js'
import Product from '../models/Product.js'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Statuses that represent orders currently "in-flight" (pending revenue) */
const ACTIVE_STATUSES = ['placed', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery']

/** Terminal success status */
const COMPLETED_STATUS = 'delivered'

// ─── Helper: convert period string → Date ─────────────────────────────────────

function periodToDate(period) {
	switch (period) {
		case '7days':  return new Date(Date.now() - 7   * 86_400_000)
		case '30days': return new Date(Date.now() - 30  * 86_400_000)
		case '90days': return new Date(Date.now() - 90  * 86_400_000)
		case '1year':  return new Date(Date.now() - 365 * 86_400_000)
		default:       return new Date(Date.now() - 30  * 86_400_000)
	}
}

// ─── Helper: artisan-item revenue projection ──────────────────────────────────
// Sums price × quantity only for items belonging to this artisan.

function artisanRevenueProjection(artisanId) {
	return {
		$sum: {
			$map: {
				input: {
					$filter: {
						input: '$items',
						as: 'it',
						cond: { $eq: ['$$it.artisanId', artisanId] }
					}
				},
				as: 'it',
				in: { $multiply: ['$$it.price', '$$it.quantity'] }
			}
		}
	}
}

// ─── 1. Order Counts ──────────────────────────────────────────────────────────

/**
 * Returns order counts grouped by status, plus:
 *  - total       – all orders ever
 *  - pending     – currently active (in-flight) orders
 *  - delivered   – successfully completed
 *  - cancelled   – buyer-cancelled
 *  - rejected    – seller-rejected
 *  - returned    – returned after delivery
 *  - refunded    – refunded
 *  - newToday    – orders placed since midnight today
 *  - byStatus    – raw map { status → count }
 */
export async function getOrderCounts(artisanId) {
	const oid = typeof artisanId === 'string'
		? new mongoose.Types.ObjectId(artisanId)
		: artisanId

	const [grouped, newToday] = await Promise.all([
		Order.aggregate([
			{ $match: { 'items.artisanId': oid } },
			{ $group: { _id: '$status', count: { $sum: 1 } } }
		]),
		Order.countDocuments({
			'items.artisanId': oid,
			createdAt: { $gte: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })() }
		})
	])

	const byStatus = {}
	grouped.forEach(({ _id, count }) => { byStatus[_id] = count })

	const total     = grouped.reduce((s, c) => s + c.count, 0)
	const pending   = ACTIVE_STATUSES.reduce((s, st) => s + (byStatus[st] ?? 0), 0)
	const delivered = byStatus.delivered ?? 0
	const cancelled = byStatus.cancelled ?? 0
	const rejected  = byStatus.rejected  ?? 0
	const returned  = byStatus.returned  ?? 0
	const refunded  = byStatus.refunded  ?? 0

	return { total, pending, delivered, cancelled, rejected, returned, refunded, newToday, byStatus }
}

// ─── 2. Revenue Summary ───────────────────────────────────────────────────────

/**
 * Revenue breakdown for a given period with:
 *  - allTime    – total lifetime earned revenue (delivered)
 *  - current    – revenue in the current period
 *  - previous   – revenue in the previous equal-length period (for comparison)
 *  - pending    – revenue locked in active (in-flight) orders
 *  - growthPct  – % change: current vs previous
 *  - period     – echo of the requested period
 */
export async function getRevenueSummary(artisanId, period = '30days') {
	const oid = typeof artisanId === 'string'
		? new mongoose.Types.ObjectId(artisanId)
		: artisanId

	const currentStart = periodToDate(period)
	const periodMs     = Date.now() - currentStart.getTime()
	const prevStart    = new Date(currentStart.getTime() - periodMs)
	const prevEnd      = currentStart

	// Reusable pipeline fragment for artisan revenue projection
	const revProj = artisanRevenueProjection(oid)

	const [allTime, current, previous, pending] = await Promise.all([
		// All-time earned
		Order.aggregate([
			{ $match: { 'items.artisanId': oid, status: COMPLETED_STATUS } },
			{ $project: { artisanRevenue: revProj } },
			{ $group: { _id: null, total: { $sum: '$artisanRevenue' } } }
		]),

		// Current period earned
		Order.aggregate([
			{
				$match: {
					'items.artisanId': oid,
					status: COMPLETED_STATUS,
					createdAt: { $gte: currentStart }
				}
			},
			{ $project: { artisanRevenue: revProj } },
			{ $group: { _id: null, total: { $sum: '$artisanRevenue' } } }
		]),

		// Previous period earned
		Order.aggregate([
			{
				$match: {
					'items.artisanId': oid,
					status: COMPLETED_STATUS,
					createdAt: { $gte: prevStart, $lt: prevEnd }
				}
			},
			{ $project: { artisanRevenue: revProj } },
			{ $group: { _id: null, total: { $sum: '$artisanRevenue' } } }
		]),

		// Pending revenue (in-flight)
		Order.aggregate([
			{ $match: { 'items.artisanId': oid, status: { $in: ACTIVE_STATUSES } } },
			{ $project: { artisanRevenue: revProj } },
			{ $group: { _id: null, total: { $sum: '$artisanRevenue' } } }
		])
	])

	const currentTotal  = current[0]?.total  ?? 0
	const previousTotal = previous[0]?.total ?? 0

	const growthPct = previousTotal === 0
		? (currentTotal > 0 ? 100 : 0)
		: Math.round(((currentTotal - previousTotal) / previousTotal) * 1000) / 10

	return {
		allTime:  allTime[0]?.total ?? 0,
		current:  currentTotal,
		previous: previousTotal,
		pending:  pending[0]?.total ?? 0,
		growthPct,
		period
	}
}

// ─── 3. Revenue Trend ─────────────────────────────────────────────────────────

/**
 * Daily (or monthly for 1year) revenue series — for chart rendering.
 * Each point: { date, revenue, orderCount }
 */
export async function getRevenueTrend(artisanId, period = '30days') {
	const oid = typeof artisanId === 'string'
		? new mongoose.Types.ObjectId(artisanId)
		: artisanId

	const since       = periodToDate(period)
	const groupFormat = period === '1year' ? '%Y-%m' : '%Y-%m-%d'
	const revProj     = artisanRevenueProjection(oid)

	const trend = await Order.aggregate([
		{
			$match: {
				'items.artisanId': oid,
				status: COMPLETED_STATUS,
				createdAt: { $gte: since }
			}
		},
		{
			$project: {
				date:           { $dateToString: { format: groupFormat, date: '$createdAt' } },
				artisanRevenue: revProj
			}
		},
		{
			$group: {
				_id:        '$date',
				revenue:    { $sum: '$artisanRevenue' },
				orderCount: { $sum: 1 }
			}
		},
		{ $sort: { _id: 1 } },
		{ $project: { _id: 0, date: '$_id', revenue: 1, orderCount: 1 } }
	])

	return trend
}

// ─── 4. Performance Metrics ───────────────────────────────────────────────────

/**
 * Calculated KPIs:
 *  - fulfillmentRate   – % of finalised orders that were delivered (not cancelled/rejected)
 *  - cancellationRate  – % of total orders cancelled
 *  - rejectionRate     – % of total orders rejected by seller
 *  - returnRate        – % of delivered orders returned
 *  - avgOrderValue     – average artisan-item revenue per delivered order (₹)
 *  - avgHandlingHours  – average hours from "placed" event → "shipped" event
 *  - topProducts       – top 5 by revenue (delivered orders)
 *  - avgRating         – average product rating
 *  - totalReviews      – total reviews across products
 */
export async function getPerformanceMetrics(artisanId) {
	const oid = typeof artisanId === 'string'
		? new mongoose.Types.ObjectId(artisanId)
		: artisanId

	const revProj = artisanRevenueProjection(oid)

	const [counts, avgOrderValueAgg, handlingTimeAgg, ratingsAgg, topProductsAgg] = await Promise.all([
		// Status counts
		Order.aggregate([
			{ $match: { 'items.artisanId': oid } },
			{ $group: { _id: '$status', count: { $sum: 1 } } }
		]),

		// Avg artisan order value on delivered orders
		Order.aggregate([
			{ $match: { 'items.artisanId': oid, status: COMPLETED_STATUS } },
			{ $project: { artisanRevenue: revProj } },
			{ $group: { _id: null, avgValue: { $avg: '$artisanRevenue' } } }
		]),

		// Avg handling time: placed-event → shipped-event, in hours
		Order.aggregate([
			{
				$match: {
					'items.artisanId': oid,
					status: { $in: ['shipped', 'out_for_delivery', COMPLETED_STATUS] }
				}
			},
			{
				$project: {
					placedEvent: {
						$arrayElemAt: [
							{
								$filter: {
									input: '$statusHistory',
									as: 'h',
									cond: { $eq: ['$$h.status', 'placed'] }
								}
							},
							0
						]
					},
					shippedEvent: {
						$arrayElemAt: [
							{
								$filter: {
									input: '$statusHistory',
									as: 'h',
									cond: { $eq: ['$$h.status', 'shipped'] }
								}
							},
							0
						]
					}
				}
			},
			{
				$match: {
					'placedEvent.timestamp':  { $exists: true },
					'shippedEvent.timestamp': { $exists: true }
				}
			},
			{
				$project: {
					handlingHours: {
						$divide: [
							{ $subtract: ['$shippedEvent.timestamp', '$placedEvent.timestamp'] },
							3_600_000   // ms → hours
						]
					}
				}
			},
			{ $group: { _id: null, avgHours: { $avg: '$handlingHours' } } }
		]),

		// Product ratings
		Product.aggregate([
			{ $match: { artisanId: oid } },
			{
				$group: {
					_id:          null,
					avgRating:    { $avg: '$rating' },
					totalReviews: { $sum: '$reviewCount' }
				}
			}
		]),

		// Top 5 products by revenue (delivered)
		Order.aggregate([
			{ $match: { 'items.artisanId': oid, status: COMPLETED_STATUS } },
			{ $unwind: '$items' },
			{ $match: { 'items.artisanId': oid } },
			{
				$group: {
					_id:          '$items.productId',
					productName:  { $first: '$items.name' },
					totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
					totalSold:    { $sum: '$items.quantity' },
					orderCount:   { $sum: 1 }
				}
			},
			{ $sort: { totalRevenue: -1 } },
			{ $limit: 5 },
			{
				$project: {
					_id:         0,
					productId:   '$_id',
					productName: 1,
					totalRevenue: 1,
					totalSold:   1,
					orderCount:  1
				}
			}
		])
	])

	// Flatten status counts
	const byStatus     = {}
	counts.forEach(({ _id, count }) => { byStatus[_id] = count })

	const totalOrders    = counts.reduce((s, c) => s + c.count, 0)
	const deliveredCount = byStatus.delivered ?? 0
	const cancelledCount = byStatus.cancelled ?? 0
	const rejectedCount  = byStatus.rejected  ?? 0
	const returnedCount  = byStatus.returned  ?? 0

	// Fulfillment rate = delivered / (delivered + cancelled + rejected)
	const finalised = deliveredCount + cancelledCount + rejectedCount
	const fulfillmentRate = finalised > 0
		? Math.round((deliveredCount / finalised) * 1000) / 10
		: 100

	const cancellationRate = totalOrders > 0
		? Math.round((cancelledCount / totalOrders) * 1000) / 10
		: 0

	const rejectionRate = totalOrders > 0
		? Math.round((rejectedCount / totalOrders) * 1000) / 10
		: 0

	const returnRate = deliveredCount > 0
		? Math.round((returnedCount / deliveredCount) * 1000) / 10
		: 0

	const avgHandlingHours = Math.round((handlingTimeAgg[0]?.avgHours ?? 0) * 10) / 10

	return {
		fulfillmentRate,              // % e.g. 92.5
		cancellationRate,             // %
		rejectionRate,                // %
		returnRate,                   // %
		avgOrderValue: Math.round((avgOrderValueAgg[0]?.avgValue ?? 0) * 100) / 100,
		avgHandlingHours,             // hours (placed → shipped)
		totalOrders,
		totalDelivered: deliveredCount,
		totalCancelled: cancelledCount,
		totalRejected:  rejectedCount,
		totalReturned:  returnedCount,
		avgRating:    Math.round((ratingsAgg[0]?.avgRating    ?? 0) * 100) / 100,
		totalReviews:  ratingsAgg[0]?.totalReviews ?? 0,
		topProducts:   topProductsAgg
	}
}

// ─── 5. Full Dashboard Bundle (single round-trip) ─────────────────────────────

/**
 * Fetches all dashboard data in one call:
 *  { orderCounts, revenue, performance, trend, recentOrders, lowStockProducts, generatedAt }
 */
export async function getDashboardBundle(artisanId, period = '30days') {
	const oid = typeof artisanId === 'string'
		? new mongoose.Types.ObjectId(artisanId)
		: artisanId

	const [orderCounts, revenueSummary, performance, trend, recentOrders, lowStockProducts] =
		await Promise.all([
			getOrderCounts(oid),
			getRevenueSummary(oid, period),
			getPerformanceMetrics(oid),
			getRevenueTrend(oid, period),

			// 5 most-recent orders
			Order.find({ 'items.artisanId': oid })
				.sort({ createdAt: -1 })
				.limit(5)
				.populate('userId', 'name email')
				.select('orderNumber status total createdAt items shippingAddress')
				.lean(),

			// Low-stock products (stock ≤ 5)
			Product.find({ artisanId: oid })
				.where('stock').lte(5)
				.select('name stock images price')
				.limit(10)
				.lean()
		])

	return {
		orderCounts,
		revenue:          revenueSummary,
		performance,
		trend,
		recentOrders,
		lowStockProducts,
		generatedAt:      new Date().toISOString()
	}
}

export default {
	getOrderCounts,
	getRevenueSummary,
	getRevenueTrend,
	getPerformanceMetrics,
	getDashboardBundle
}
