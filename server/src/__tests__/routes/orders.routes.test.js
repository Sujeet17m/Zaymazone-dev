/**
 * orders.routes.test.js
 *
 * Module 15 — Integration tests for critical order workflow routes:
 *   GET  /api/orders/artisan-orders
 *   PATCH /api/orders/:id/status   (artisan accept, ship, deliver)
 *
 * All external dependencies are mocked — no DB, no network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import mongoose from 'mongoose'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../middleware/firebase-auth.js', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { _id: 'admin-user-id', uid: 'firebase-uid', email: 'admin@test.com' }
    next()
  },
}))

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { sub: 'artisan-id-123', _id: 'artisan-id-123' }
    next()
  },
  optionalAuth: (_req, _res, next) => next(),
}))

// Pass-through validation: copy body/params/query to validated variants
vi.mock('../../middleware/validation.js', () => ({
  validate: (_schema, target) => (req, _res, next) => {
    if (target === 'params') req.validatedParams = req.params
    else if (target === 'query') req.validatedQuery = { page: 1, limit: 20, sort: 'createdAt', order: 'desc', ...req.query }
    else req.validatedBody = req.body
    next()
  },
  idSchema:         {},
  paginationSchema: {},
}))

vi.mock('../../middleware/rateLimiter.js', () => ({
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
}))

vi.mock('../../models/Order.js', () => ({
  default: {
    find:           vi.fn(),
    findById:       vi.fn(),
    countDocuments: vi.fn(),
    aggregate:      vi.fn(),
  },
}))

vi.mock('../../models/Product.js', () => ({
  default: {
    find:    vi.fn(),
    findOne: vi.fn(),
  },
}))

vi.mock('../../models/Cart.js', () => ({ default: { findOne: vi.fn() } }))
vi.mock('../../models/Artisan.js', () => ({ default: { find: vi.fn(), findOne: vi.fn() } }))
vi.mock('../../models/User.js',    () => ({ default: { findById: vi.fn(), findOne: vi.fn() } }))

vi.mock('../../services/codService.js', () => ({
  default: {
    isCodEligible:   vi.fn().mockResolvedValue({ eligible: true }),
    calculateCodFee: vi.fn().mockResolvedValue({ fee: 0 }),
  },
}))

vi.mock('../../services/shippingService.js', () => ({
  default: {
    calculateShipping:  vi.fn().mockResolvedValue({ cost: 50 }),
    getShippingOptions: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../../services/cancellationFeeService.js', () => ({
  calculateCancellationFee:  vi.fn().mockResolvedValue({ fee: 0 }),
  processOrderCancellation:  vi.fn().mockResolvedValue({ order: {}, feeBreakdown: {} }),
}))

vi.mock('../../services/invoiceService.js', () => ({
  default: {
    generateForOrder:          vi.fn().mockResolvedValue({}),
    generateRejectionNote:     vi.fn().mockResolvedValue({}),
    generateCancellationNote:  vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../../services/emailService.js', () => ({
  default: {
    sendOrderConfirmationEmail:    vi.fn().mockResolvedValue({}),
    sendOrderRejectionEmail:       vi.fn().mockResolvedValue({}),
    sendOrderRejectionNotification: vi.fn().mockResolvedValue({}),
    sendOrderCancelledToArtisan:   vi.fn().mockResolvedValue({}),
    sendAdminOrderAlert:           vi.fn().mockResolvedValue({}),
  },
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue({}),
}))

// ── Import router after mocks ──────────────────────────────────────────────────

import Order from '../../models/Order.js'
import ordersRouter from '../../routes/orders.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/orders', ordersRouter)
  return app
}

// ── Helper: minimal order stub ────────────────────────────────────────────────

function makeOrder(overrides = {}) {
  return {
    _id:            new mongoose.Types.ObjectId().toString(),
    status:         'confirmed',
    paymentMethod:  'cod',
    paymentStatus:  'pending',
    items:          [{ artisanId: 'artisan-id-123', name: 'Pottery Bowl', price: 500, quantity: 2 }],
    statusHistory:  [],
    save:           vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// ── GET /api/orders/artisan-orders ────────────────────────────────────────────

describe('GET /api/orders/artisan-orders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with an empty orders array when artisan has no orders', async () => {
    const mockFind = {
      populate: vi.fn().mockReturnThis(),
      sort:     vi.fn().mockReturnThis(),
      limit:    vi.fn().mockReturnThis(),
      skip:     vi.fn().mockReturnThis(),
      lean:     vi.fn().mockResolvedValue([]),
    }
    Order.find.mockReturnValue(mockFind)
    Order.countDocuments.mockResolvedValue(0)

    const res = await request(buildApp()).get('/api/orders/artisan-orders')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.orders)).toBe(true)
    expect(res.body.orders).toHaveLength(0)
    expect(res.body.pagination.total).toBe(0)
  })

  it('returns 200 and filters each order to only this artisan\'s items', async () => {
    const artisanId = 'artisan-id-123'
    const rawOrders = [
      {
        _id:    'order-1',
        status: 'placed',
        items: [
          { artisanId, name: 'Bowl', price: 400, quantity: 1 },
          { artisanId: 'other-artisan', name: 'Scarf', price: 200, quantity: 1 },
        ],
      },
    ]
    const mockFind = {
      populate: vi.fn().mockReturnThis(),
      sort:     vi.fn().mockReturnThis(),
      limit:    vi.fn().mockReturnThis(),
      skip:     vi.fn().mockReturnThis(),
      lean:     vi.fn().mockResolvedValue(rawOrders),
    }
    Order.find.mockReturnValue(mockFind)
    Order.countDocuments.mockResolvedValue(1)

    const res = await request(buildApp()).get('/api/orders/artisan-orders')

    expect(res.status).toBe(200)
    expect(res.body.orders).toHaveLength(1)
    // Items must be filtered — only this artisan's item should remain
    expect(res.body.orders[0].items).toHaveLength(1)
    expect(res.body.orders[0].items[0].name).toBe('Bowl')
  })

  it('supports ?status= filter query param', async () => {
    const mockFind = {
      populate: vi.fn().mockReturnThis(),
      sort:     vi.fn().mockReturnThis(),
      limit:    vi.fn().mockReturnThis(),
      skip:     vi.fn().mockReturnThis(),
      lean:     vi.fn().mockResolvedValue([]),
    }
    Order.find.mockReturnValue(mockFind)
    Order.countDocuments.mockResolvedValue(0)

    const res = await request(buildApp()).get('/api/orders/artisan-orders?status=delivered')

    expect(res.status).toBe(200)
    // Ensure Order.find was called with status filter
    expect(Order.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'delivered' })
    )
  })
})

// ── PATCH /api/orders/:id/status ──────────────────────────────────────────────

describe('PATCH /api/orders/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when order does not exist', async () => {
    Order.findById.mockResolvedValue(null)

    const res = await request(buildApp())
      .patch('/api/orders/nonexistent-order-id/status')
      .send({ status: 'confirmed' })

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('returns 400 when trying to ship a non-COD order with unpaid status', async () => {
    const order = makeOrder({ paymentMethod: 'razorpay', paymentStatus: 'pending' })
    Order.findById.mockResolvedValue(order)

    const res = await request(buildApp())
      .patch(`/api/orders/${order._id}/status`)
      .send({ status: 'shipped' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('PAYMENT_NOT_VERIFIED')
    expect(res.body.error).toMatch(/payment/i)
  })

  it('returns 400 when trying to ship a UPI order that is not yet paid', async () => {
    const order = makeOrder({ paymentMethod: 'upi', paymentStatus: 'pending' })
    Order.findById.mockResolvedValue(order)

    const res = await request(buildApp())
      .patch(`/api/orders/${order._id}/status`)
      .send({ status: 'shipped' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('PAYMENT_NOT_VERIFIED')
  })

  it('allows shipping a COD order even if paymentStatus is pending', async () => {
    const order = makeOrder({ paymentMethod: 'cod', paymentStatus: 'pending', status: 'packed' })
    Order.findById.mockResolvedValue(order)

    const res = await request(buildApp())
      .patch(`/api/orders/${order._id}/status`)
      .send({ status: 'shipped', trackingNumber: 'TRK123456' })

    expect(res.status).toBe(200)
    expect(order.shippedAt).toBeDefined()
  })

  it('marks deliveredAt and sets paymentStatus=paid for COD delivered orders', async () => {
    const order = makeOrder({ paymentMethod: 'cod', paymentStatus: 'pending', status: 'shipped' })
    Order.findById.mockResolvedValue(order)

    const res = await request(buildApp())
      .patch(`/api/orders/${order._id}/status`)
      .send({ status: 'delivered' })

    expect(res.status).toBe(200)
    expect(order.deliveredAt).toBeDefined()
    expect(order.paymentStatus).toBe('paid')
  })

  it('successfully confirms an order (placed → confirmed)', async () => {
    const order = makeOrder({ status: 'placed' })
    Order.findById.mockResolvedValue(order)

    const res = await request(buildApp())
      .patch(`/api/orders/${order._id}/status`)
      .send({ status: 'confirmed', note: 'Order confirmed by artisan' })

    expect(res.status).toBe(200)
    expect(order.status).toBe('confirmed')
    expect(order.statusHistory.length).toBeGreaterThan(0)
    expect(order.save).toHaveBeenCalled()
  })

  it('appends to statusHistory with timestamp and note', async () => {
    const order = makeOrder()
    Order.findById.mockResolvedValue(order)

    await request(buildApp())
      .patch(`/api/orders/${order._id}/status`)
      .send({ status: 'confirmed', note: 'Ready to pack' })

    const lastEntry = order.statusHistory[order.statusHistory.length - 1]
    expect(lastEntry.status).toBe('confirmed')
    expect(lastEntry.note).toBe('Ready to pack')
    expect(lastEntry.timestamp).toBeInstanceOf(Date)
  })
})
