/**
 * DashboardStatsRow.test.tsx
 * Component tests for the Module 7 stats row UI.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardStatsRow } from '@/components/artisan/DashboardStatsRow'
import type { ArtisanOrderCounts, ArtisanRevenueSummary, ArtisanPerformanceMetrics } from '@/lib/api'

const mockCounts: ArtisanOrderCounts = {
  total:     50,
  pending:   5,
  delivered: 40,
  cancelled: 3,
  rejected:  1,
  returned:  1,
  refunded:  0,
  newToday:  2,
  byStatus:  {},
}

const mockRevenue: ArtisanRevenueSummary = {
  allTime:   120000,
  current:   15000,
  previous:  12000,
  pending:   3000,
  growthPct: 25,
  period:    '30days',
}

const mockPerformance: ArtisanPerformanceMetrics = {
  fulfillmentRate:  88,
  cancellationRate: 5,
  rejectionRate:    3,
  returnRate:       2,
  avgOrderValue:    1500,
  avgHandlingHours: 24,
  avgRating:        4.5,
  totalReviews:     120,
  totalOrders:      50,
  totalDelivered:   40,
  totalCancelled:   3,
  totalRejected:    1,
  totalReturned:    1,
  topProducts:      [],
}

describe('DashboardStatsRow', () => {
  it('renders all six stat cards', () => {
    render(<DashboardStatsRow orderCounts={mockCounts} revenue={mockRevenue} performance={mockPerformance} loading={false} />)

    // Check specific card labels rendered in the DOM
    expect(screen.getByText('Total Orders')).toBeInTheDocument()
    expect(screen.getByText('Pending Action')).toBeInTheDocument()
    expect(screen.getByText('Delivered')).toBeInTheDocument()
    expect(screen.getByText('Revenue (Period)')).toBeInTheDocument()
  })

  it('displays correct numeric values', () => {
    render(<DashboardStatsRow orderCounts={mockCounts} revenue={mockRevenue} performance={mockPerformance} loading={false} />)

    expect(screen.getByText('50')).toBeInTheDocument()  // total orders
    expect(screen.getByText('5')).toBeInTheDocument()   // pending
    expect(screen.getByText('40')).toBeInTheDocument()  // delivered
  })

  it('shows new-today sub-label when newToday > 0', () => {
    render(<DashboardStatsRow orderCounts={mockCounts} revenue={mockRevenue} performance={mockPerformance} loading={false} />)
    expect(screen.getByText('2 new today')).toBeInTheDocument()
  })

  it('shows growth percentage chip when growthPct is positive', () => {
    render(<DashboardStatsRow orderCounts={mockCounts} revenue={mockRevenue} performance={mockPerformance} loading={false} />)
    expect(screen.getByText('+25.0%')).toBeInTheDocument()
  })

  it('renders skeleton loaders when loading=true', () => {
    const { container } = render(
      <DashboardStatsRow orderCounts={null} revenue={null} performance={null} loading={true} />
    )
    // StatSkeleton components have animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('handles zero counts without crashing', () => {
    const zeroCounts: ArtisanOrderCounts = {
      total: 0, pending: 0, delivered: 0, cancelled: 0,
      rejected: 0, returned: 0, refunded: 0, newToday: 0, byStatus: {},
    }
    const zeroRevenue: ArtisanRevenueSummary = {
      allTime: 0, current: 0, previous: 0, pending: 0, growthPct: 0, period: '30days',
    }
    const zeroPerf: ArtisanPerformanceMetrics = {
      fulfillmentRate: 0, cancellationRate: 0, rejectionRate: 0, returnRate: 0,
      avgOrderValue: 0, avgHandlingHours: 0, avgRating: 0, totalReviews: 0,
      totalOrders: 0, totalDelivered: 0, totalCancelled: 0, totalRejected: 0, totalReturned: 0,
      topProducts: [],
    }
    expect(() =>
      render(<DashboardStatsRow orderCounts={zeroCounts} revenue={zeroRevenue} performance={zeroPerf} loading={false} />)
    ).not.toThrow()
  })
})
