/**
 * api.helpers.test.ts
 *
 * Unit tests for pure helper / utility functions derived from the API layer.
 * Tests the TypeScript interface shapes and formatting helpers
 * that are used throughout the artisan dashboard.
 */

import { describe, it, expect } from 'vitest'

// ── Currency formatter (mirrors the helper in ArtisanDashboard.tsx) ───────────

const fmt = (n: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

describe('fmt (INR currency formatter)', () => {
  it('formats 1000 as ₹1,000', () => {
    expect(fmt(1000)).toMatch(/1,000/)
  })

  it('formats 0 correctly', () => {
    expect(fmt(0)).toMatch(/0/)
  })

  it('formats 100000 with Indian grouping', () => {
    expect(fmt(100000)).toMatch(/1,00,000/)
  })

  it('includes ₹ symbol', () => {
    expect(fmt(500)).toMatch(/₹|INR/)
  })

  it('does not include decimal places', () => {
    expect(fmt(1500)).not.toMatch(/\./)
  })
})

// ── Date formatter (mirrors fmtDate in ArtisanDashboard.tsx) ─────────────────

const fmtDate = (d: string): string =>
  new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

describe('fmtDate', () => {
  it('formats an ISO date string to readable format', () => {
    const result = fmtDate('2026-02-25T10:00:00.000Z')
    expect(result).toMatch(/Feb|25|2026/)
  })

  it('handles midnight UTC correctly', () => {
    expect(() => fmtDate('2026-01-01T00:00:00.000Z')).not.toThrow()
  })
})

// ── STATUS_LABEL map completeness ─────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  placed:           'Placed',
  confirmed:        'Confirmed',
  processing:       'Processing',
  packed:           'Packed',
  shipped:          'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
  rejected:         'Rejected',
  returned:         'Returned',
  refunded:         'Refunded',
}

const ALL_ORDER_STATUSES = [
  'placed', 'confirmed', 'processing', 'packed', 'shipped',
  'out_for_delivery', 'delivered', 'cancelled', 'rejected', 'returned', 'refunded',
]

describe('STATUS_LABEL completeness', () => {
  it.each(ALL_ORDER_STATUSES)('has a label for status "%s"', (status) => {
    expect(STATUS_LABEL[status]).toBeDefined()
    expect(STATUS_LABEL[status].length).toBeGreaterThan(0)
  })

  it('maps all 11 order statuses', () => {
    expect(Object.keys(STATUS_LABEL)).toHaveLength(11)
  })
})

// ── ArtisanDashboardBundle interface shape validation ─────────────────────────

import type {
  ArtisanOrderCounts,
  ArtisanRevenueSummary,
  ArtisanDashboardBundle,
  ArtisanPerformanceMetrics,
} from '@/lib/api'

describe('ArtisanDashboardBundle type shape', () => {
  it('satisfies the expected interface structure at compile time', () => {
    // This is a compile-time type check; if it builds, the test passes.
    const bundle: ArtisanDashboardBundle = {
      orderCounts: {
        total: 10, pending: 2, delivered: 7, cancelled: 1,
        rejected: 0, returned: 0, refunded: 0, newToday: 1, byStatus: {},
      },
      revenue: {
        allTime: 50000, current: 8000, previous: 6000, pending: 1000, growthPct: 33.3, period: '30days',
      },
      performance: {
        fulfillmentRate: 85, cancellationRate: 5, rejectionRate: 3,
        returnRate: 2, avgOrderValue: 1500, avgHandlingHours: 24,
        totalOrders: 100, totalDelivered: 85, totalCancelled: 5,
        totalRejected: 3, totalReturned: 2,
        avgRating: 4.5, totalReviews: 60,
        topProducts: [],
      },
      trend: [{ date: '2026-02-25', revenue: 1200, orderCount: 3 }],
      recentOrders: [],
      lowStockProducts: [],
      generatedAt: new Date().toISOString(),
    }

    expect(bundle.orderCounts.total).toBe(10)
    expect(bundle.revenue.growthPct).toBeCloseTo(33.3, 1)
    expect(bundle.trend).toHaveLength(1)
  })
})

// ── Percentage clamping edge cases ────────────────────────────────────────────

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10))
}

describe('clampPct', () => {
  it('clamps values above 100 to 100', () => {
    expect(clampPct(120)).toBe(100)
  })

  it('clamps negative values to 0', () => {
    expect(clampPct(-5)).toBe(0)
  })

  it('preserves mid-range values', () => {
    expect(clampPct(75.5)).toBeCloseTo(75.5, 1)
  })
})
