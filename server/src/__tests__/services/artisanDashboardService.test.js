/**
 * artisanDashboardService.test.js
 *
 * Unit tests for Module 2 — Artisan Dashboard service.
 * All MongoDB calls are mocked; no real DB connection is used.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'

// ── Mock mongoose models before importing the service ────────────────────────
vi.mock('../../models/Order.js', () => {
  return {
    default: {
      aggregate: vi.fn(),
      countDocuments: vi.fn(),
      find: vi.fn(),
    },
  }
})

vi.mock('../../models/Product.js', () => {
  return {
    default: {
      find: vi.fn(),
      aggregate: vi.fn(),
    },
  }
})

import Order from '../../models/Order.js'
import Product from '../../models/Product.js'
import {
  getOrderCounts,
  getRevenueSummary,
  getRevenueTrend,
  getPerformanceMetrics,
} from '../../services/artisanDashboardService.js'

const MOCK_ARTISAN_ID = new mongoose.Types.ObjectId().toString()

// ── getOrderCounts ─────────────────────────────────────────────────────────────

describe('getOrderCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns correct counts for a typical artisan', async () => {
    Order.aggregate.mockResolvedValueOnce([
      { _id: 'placed',    count: 3 },
      { _id: 'confirmed', count: 5 },
      { _id: 'delivered', count: 20 },
      { _id: 'cancelled', count: 2 },
      { _id: 'rejected',  count: 1 },
    ])
    Order.countDocuments.mockResolvedValueOnce(2)

    const result = await getOrderCounts(MOCK_ARTISAN_ID)

    expect(result.total).toBe(31)
    expect(result.delivered).toBe(20)
    expect(result.cancelled).toBe(2)
    expect(result.rejected).toBe(1)
    expect(result.newToday).toBe(2)
    // placed + confirmed are both ACTIVE_STATUSES
    expect(result.pending).toBeGreaterThanOrEqual(8)
    expect(result.byStatus).toMatchObject({ placed: 3, delivered: 20 })
  })

  it('returns zeros when artisan has no orders', async () => {
    Order.aggregate.mockResolvedValueOnce([])
    Order.countDocuments.mockResolvedValueOnce(0)

    const result = await getOrderCounts(MOCK_ARTISAN_ID)

    expect(result.total).toBe(0)
    expect(result.pending).toBe(0)
    expect(result.delivered).toBe(0)
    expect(result.newToday).toBe(0)
    expect(result.byStatus).toEqual({})
  })

  it('defaults missing status counts to 0 without throwing', async () => {
    Order.aggregate.mockResolvedValueOnce([{ _id: 'delivered', count: 5 }])
    Order.countDocuments.mockResolvedValueOnce(0)

    const result = await getOrderCounts(MOCK_ARTISAN_ID)

    expect(result.cancelled).toBe(0)
    expect(result.rejected).toBe(0)
    expect(result.returned).toBe(0)
    expect(result.refunded).toBe(0)
  })

  it('accepts a mongoose ObjectId directly without coercion error', async () => {
    const oid = new mongoose.Types.ObjectId()
    Order.aggregate.mockResolvedValueOnce([])
    Order.countDocuments.mockResolvedValueOnce(0)

    await expect(getOrderCounts(oid)).resolves.not.toThrow()
  })
})

// ── getRevenueSummary ─────────────────────────────────────────────────────────

describe('getRevenueSummary', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns all revenue fields for a standard period', async () => {
    // allTime, current, previous, pending — all return one aggregation result
    Order.aggregate
      .mockResolvedValueOnce([{ total: 50000 }])  // allTime
      .mockResolvedValueOnce([{ total: 8000  }])  // current period
      .mockResolvedValueOnce([{ total: 6000  }])  // previous period
      .mockResolvedValueOnce([{ total: 1200  }])  // pending

    const result = await getRevenueSummary(MOCK_ARTISAN_ID, '30days')

    expect(result.allTime).toBe(50000)
    expect(result.current).toBe(8000)
    expect(result.previous).toBe(6000)
    expect(result.pending).toBe(1200)
    expect(result.growthPct).toBeCloseTo(((8000 - 6000) / 6000) * 100, 1)
    expect(result.period).toBe('30days')
  })

  it('sets growthPct to 100 when previous period revenue was 0', async () => {
    Order.aggregate
      .mockResolvedValueOnce([{ total: 10000 }])
      .mockResolvedValueOnce([{ total: 3000  }])
      .mockResolvedValueOnce([])                  // no previous orders
      .mockResolvedValueOnce([{ total: 500   }])

    const result = await getRevenueSummary(MOCK_ARTISAN_ID, '7days')

    expect(result.previous).toBe(0)
    expect(result.growthPct).toBe(100)
  })

  it('handles empty result sets without throwing', async () => {
    Order.aggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await getRevenueSummary(MOCK_ARTISAN_ID, '90days')

    expect(result.allTime).toBe(0)
    expect(result.current).toBe(0)
    expect(result.growthPct).toBe(0)
  })

  it('echoes requested period in result', async () => {
    Order.aggregate.mockResolvedValue([])

    const r7   = await getRevenueSummary(MOCK_ARTISAN_ID, '7days')
    const r1y  = await getRevenueSummary(MOCK_ARTISAN_ID, '1year')

    expect(r7.period).toBe('7days')
    expect(r1y.period).toBe('1year')
  })
})

// ── getRevenueTrend ────────────────────────────────────────────────────────────

describe('getRevenueTrend', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns an array of trend points for 7days', async () => {
    const mockTrend = [
      { date: '2026-02-19', revenue: 1200, orderCount: 3 },
      { date: '2026-02-20', revenue: 800,  orderCount: 2 },
    ]
    Order.aggregate.mockResolvedValueOnce(mockTrend)

    const result = await getRevenueTrend(MOCK_ARTISAN_ID, '7days')

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0]).toMatchObject({ date: '2026-02-19', revenue: 1200 })
  })

  it('returns an empty array when no orders exist', async () => {
    Order.aggregate.mockResolvedValueOnce([])

    const result = await getRevenueTrend(MOCK_ARTISAN_ID, '30days')

    expect(result).toEqual([])
  })
})

// ── getPerformanceMetrics ─────────────────────────────────────────────────────

describe('getPerformanceMetrics', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('computes fulfillment rate correctly', async () => {
    // Promise.all fires 5 aggregations in this order:
    //   1) Order.aggregate — status breakdown
    //   2) Order.aggregate — avg order value (delivered)
    //   3) Order.aggregate — avg handling time (placed→shipped)
    //   4) Product.aggregate — avg rating / total reviews
    //   5) Order.aggregate — top 5 products by revenue
    Order.aggregate
      .mockResolvedValueOnce([                        // 1 — status breakdown
        { _id: 'delivered', count: 80 },
        { _id: 'cancelled', count: 10 },
        { _id: 'rejected',  count: 5  },
        { _id: 'returned',  count: 5  },
      ])
      .mockResolvedValueOnce([{ avgValue: 1500 }])   // 2 — avg order value
      .mockResolvedValueOnce([{ avgHours: 24   }])   // 3 — avg handling hours
    Product.aggregate.mockResolvedValueOnce([{ avgRating: 4.6, totalReviews: 42 }]) // 4
    Order.aggregate.mockResolvedValueOnce([           // 5 — top products
      { productId: 'p1', productName: 'Vase', totalRevenue: 5000, totalSold: 10, orderCount: 8 },
    ])

    const result = await getPerformanceMetrics(MOCK_ARTISAN_ID)

    // total=100, delivered=80, cancelled=10, rejected=5 → finalised=95 → rate=80/95≈84.2
    expect(result.fulfillmentRate).toBeCloseTo(84.2, 0)
    expect(result.cancellationRate).toBe(10)
    expect(result.rejectionRate).toBe(5)
    expect(result.avgOrderValue).toBe(1500)
    expect(result.avgHandlingHours).toBe(24)
    expect(result.avgRating).toBe(4.6)
    expect(result.totalReviews).toBe(42)
    expect(result.topProducts).toHaveLength(1)
  })

  it('returns safe defaults when no orders are present', async () => {
    // Must mock all 5 Promise.all calls even when empty
    Order.aggregate
      .mockResolvedValueOnce([])   // 1 — no status data
      .mockResolvedValueOnce([])   // 2 — no avg order value
      .mockResolvedValueOnce([])   // 3 — no handling time
    Product.aggregate.mockResolvedValueOnce([])  // 4 — no ratings
    Order.aggregate.mockResolvedValueOnce([])    // 5 — no top products

    const result = await getPerformanceMetrics(MOCK_ARTISAN_ID)

    expect(result.totalOrders).toBe(0)
    // No finalised orders → fulfillmentRate defaults to 100 per service logic
    expect(result.fulfillmentRate).toBe(100)
    expect(result.cancellationRate).toBe(0)
    expect(result.avgRating).toBe(0)
    expect(result.topProducts).toEqual([])
  })
})
