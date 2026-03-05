/**
 * seller.routes.test.js
 *
 * Integration tests for the seller API routes (Module 2 & 4 endpoints).
 * Uses supertest against a self-contained Express app with fully mocked
 * MongoDB and Firebase authentication — no real DB/network calls.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import express from 'express'
import request from 'supertest'

// ── Mock all external dependencies before importing routes ───────────────────

vi.mock('../../middleware/firebase-auth.js', () => ({
  authenticateToken: (req, _res, next) => {
    // Inject a mock user and artisan — routes use req.user._id for Artisan.findOne
    req.user    = { _id: 'test-user-mongo-id', uid: 'test-firebase-uid', email: 'artisan@test.com' }
    req.artisan = {
      _id:    'artisan-mock-id-123',
      userId: 'test-user-mongo-id',
      isApproved: true,
    }
    next()
  },
}))

vi.mock('../../models/Artisan.js', () => ({
  default: {
    findOne: vi.fn().mockResolvedValue({
      _id:    'artisan-mock-id-123',
      userId: 'test-firebase-uid',
      isApproved: true,
    }),
  },
}))

vi.mock('../../models/Order.js', () => ({
  default: {
    aggregate:      vi.fn(),
    countDocuments: vi.fn(),
    // findOne returns a thenable with .populate() chaining
    findOne: vi.fn().mockReturnValue({
      populate: vi.fn().mockResolvedValue(null),
    }),
    find: vi.fn(),
  },
}))

vi.mock('../../models/Product.js', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock('../../models/User.js', () => ({
  default: { findOne: vi.fn(), findById: vi.fn() },
}))

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (_req, _res, next) => next(),
  optionalAuth: (_req, _res, next) => next(),
}))

vi.mock('../../services/artisanDashboardService.js', () => ({
  default: {
    getDashboardBundle:   vi.fn(),
    getOrderCounts:       vi.fn(),
    getRevenueSummary:    vi.fn(),
    getRevenueTrend:      vi.fn(),
    getPerformanceMetrics: vi.fn(),
  },
}))

vi.mock('../../services/invoiceService.js', () => ({
  default: {
    generateRejectionNote: vi.fn().mockResolvedValue({}),
    generateForOrder: vi.fn().mockResolvedValue({}),
    generateCancellationNote: vi.fn().mockResolvedValue({}),
  },
  generateRejectionNote: vi.fn().mockResolvedValue({}),
}))

vi.mock('../../services/emailService.js', () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue({}),
  sendOrderRejectionEmail:    vi.fn().mockResolvedValue({}),
}))

// ── Import mocked modules and build test app ─────────────────────────────────

import dashboardService from '../../services/artisanDashboardService.js'
import Order from '../../models/Order.js'
import sellerRouter from '../../routes/seller.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/seller', sellerRouter)
  return app
}

let app
beforeAll(() => { app = buildApp() })

// ── GET /api/seller/dashboard ─────────────────────────────────────────────────

describe('GET /api/seller/dashboard', () => {
  it('returns 200 with bundle data', async () => {
    const mockBundle = {
      orderCounts: { total: 15, pending: 3, delivered: 10 },
      revenue:     { allTime: 45000, current: 8000, growthPct: 20 },
      performance: { fulfillmentRate: 85, avgRating: 4.5 },
      trend:       [],
      recentOrders: [],
      lowStockProducts: [],
    }
    dashboardService.getDashboardBundle.mockResolvedValueOnce(mockBundle)

    const res = await request(app).get('/api/seller/dashboard?period=30days')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ orderCounts: { total: 15 } })
  })

  it('defaults period to 30days when not specified', async () => {
    dashboardService.getDashboardBundle.mockResolvedValueOnce({ orderCounts: {}, revenue: {}, performance: {}, trend: [], recentOrders: [], lowStockProducts: [] })

    await request(app).get('/api/seller/dashboard')

    expect(dashboardService.getDashboardBundle).toHaveBeenCalledWith(
      expect.anything(),
      '30days'
    )
  })

  it('returns 500 on service error', async () => {
    dashboardService.getDashboardBundle.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(app).get('/api/seller/dashboard')

    expect(res.status).toBe(500)
  })
})

// ── GET /api/seller/orders/counts ─────────────────────────────────────────────

describe('GET /api/seller/orders/counts', () => {
  it('returns 200 with order counts object', async () => {
    dashboardService.getOrderCounts.mockResolvedValueOnce({
      total: 50, pending: 5, delivered: 40, cancelled: 3, rejected: 2,
    })

    const res = await request(app).get('/api/seller/orders/counts')

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(50)
    expect(res.body.delivered).toBe(40)
  })
})

// ── GET /api/seller/analytics/revenue ────────────────────────────────────────

describe('GET /api/seller/analytics/revenue', () => {
  it('returns revenue summary with growth %', async () => {
    dashboardService.getRevenueSummary.mockResolvedValueOnce({
      allTime: 100000, current: 12000, previous: 10000, pending: 2000, growthPct: 20, period: '30days',
    })

    const res = await request(app).get('/api/seller/analytics/revenue?period=30days')

    expect(res.status).toBe(200)
    expect(res.body.growthPct).toBe(20)
  })

  it('silently defaults invalid period to 30days and returns 200', async () => {
    dashboardService.getRevenueSummary.mockResolvedValueOnce({
      allTime: 0, current: 0, previous: 0, pending: 0, growthPct: 0, period: '30days',
    })

    const res = await request(app).get('/api/seller/analytics/revenue?period=badvalue')

    expect(res.status).toBe(200)
    expect(dashboardService.getRevenueSummary).toHaveBeenCalledWith(
      expect.anything(), '30days'
    )
  })
})

// ── GET /api/seller/analytics/performance ────────────────────────────────────

describe('GET /api/seller/analytics/performance', () => {
  it('returns performance KPIs', async () => {
    dashboardService.getPerformanceMetrics.mockResolvedValueOnce({
      fulfillmentRate: 88, cancellationRate: 5, avgRating: 4.3, topProducts: [],
    })

    const res = await request(app).get('/api/seller/analytics/performance')

    expect(res.status).toBe(200)
    expect(res.body.fulfillmentRate).toBe(88)
  })
})

// ── POST /api/seller/orders/:id/accept ───────────────────────────────────────

describe('POST /api/seller/orders/:id/accept', () => {
  it('accepts a placed order and returns confirmed status', async () => {
    const mockOrder = {
      _id: 'order-abc',
      orderNumber: 'ZM-ACCEPT-001',
      status: 'placed',
      items: [{ artisanId: 'artisan-mock-id-123', price: 500, quantity: 1, productId: { name: 'Vase' } }],
      shippingAddress: { email: 'buyer@test.com', fullName: 'Test Buyer' },
      save: vi.fn().mockResolvedValue(true),
      statusHistory: [],
    }
    Order.findOne.mockReturnValueOnce({ populate: vi.fn().mockResolvedValue(mockOrder) })

    const res = await request(app)
      .post('/api/seller/orders/order-abc/accept')
      .send({ note: 'Will ship tomorrow' })

    expect(res.status).toBe(200)
    expect(mockOrder.save).toHaveBeenCalled()
  })

  it('returns 404 when order is not found', async () => {
    Order.findOne.mockReturnValueOnce({ populate: vi.fn().mockResolvedValue(null) })

    const res = await request(app)
      .post('/api/seller/orders/nonexistent/accept')
      .send({})

    expect(res.status).toBe(404)
  })

  it('returns 400 if order is not in placed status', async () => {
    Order.findOne.mockReturnValueOnce({ populate: vi.fn().mockResolvedValue({
      _id: 'order-xyz',
      status: 'delivered',
      items: [{ artisanId: 'artisan-mock-id-123' }],
    })})

    const res = await request(app)
      .post('/api/seller/orders/order-xyz/accept')
      .send({})

    expect(res.status).toBe(400)
  })
})

// ── POST /api/seller/orders/:id/reject ───────────────────────────────────────

describe('POST /api/seller/orders/:id/reject', () => {
  it('rejects a placed order with a valid reason', async () => {
    const mockOrder = {
      _id: 'order-rej',
      orderNumber: 'ZM-REJ-001',
      status: 'placed',
      items: [{ artisanId: 'artisan-mock-id-123', price: 800, quantity: 1 }],
      shippingAddress: { email: 'buyer@test.com', fullName: 'Test Buyer' },
      save: vi.fn().mockResolvedValue(true),
      statusHistory: [],
    }
    Order.findOne.mockReturnValueOnce({ populate: vi.fn().mockResolvedValue(mockOrder) })

    const res = await request(app)
      .post('/api/seller/orders/order-rej/reject')
      .send({ reason: 'Product is out of stock due to high demand.' })

    expect(res.status).toBe(200)
  })

  it('returns 400 when rejection reason is missing', async () => {
    const res = await request(app)
      .post('/api/seller/orders/order-rej/reject')
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 400 when rejection reason is too short', async () => {
    const res = await request(app)
      .post('/api/seller/orders/order-rej/reject')
      .send({ reason: 'short' })

    expect(res.status).toBe(400)
  })
})
