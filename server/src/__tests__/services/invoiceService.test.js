/**
 * invoiceService.test.js
 *
 * Unit tests for Module 3 — Automatic Bill / Invoice Generation.
 * Verifies idempotency, correct invoice types, and credit-note logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Invoice model & shippingService ──────────────────────────────────────
vi.mock('../../models/Invoice.js', () => {
  const mockSave = vi.fn().mockResolvedValue(true)
  const MockInvoice = vi.fn().mockImplementation((data) => ({ ...data, save: mockSave }))
  MockInvoice.findOne = vi.fn()
  MockInvoice.findById = vi.fn()
  MockInvoice.find = vi.fn()
  MockInvoice.create = vi.fn().mockImplementation(async (data) => ({
    ...data,
    _id: 'inv-test-id',
    invoiceNumber: 'ZM-INV-2026-000001',
    save: mockSave,
  }))
  MockInvoice.prototype.save = mockSave
  return { default: MockInvoice }
})

vi.mock('../../services/shippingService.js', () => ({
  default: {
    calculateShipping: vi.fn().mockResolvedValue({ charge: 0, method: 'standard' }),
    ZONE_RATES: {
      rest_of_india: { label: 'Rest of India', estimatedDays: '5-7' },
      metro:         { label: 'Metro',         estimatedDays: '2-3' },
      local:         { label: 'Local',         estimatedDays: '1-2' },
      tier2:         { label: 'Tier 2',        estimatedDays: '3-5' },
      remote:        { label: 'Remote',        estimatedDays: '7-10' },
    },
  },
}))

import Invoice from '../../models/Invoice.js'
import {
  generateForOrder,
  generateCancellationNote,
  generateRejectionNote,
  getInvoicesForOrder,
} from '../../services/invoiceService.js'

// ── Fixture helpers ───────────────────────────────────────────────────────────

const makeOrder = (overrides = {}) => ({
  _id: 'order-001',
  orderNumber: 'ZM-20260001',
  total: 2500,
  status: 'placed',
  paymentMethod: 'cod',
  items: [
    {
      artisanId: 'artisan-1',
      productId: 'prod-1',
      name: 'Terracotta Vase',
      price: 1250,
      quantity: 2,
    },
  ],
  shippingAddress: {
    fullName: 'Aarav Sharma',
    email: 'aarav@test.com',
    phone: '9876543210',
    street: '12 MG Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    zipCode: '400001',
  },
  createdAt: new Date('2026-02-25'),
  ...overrides,
})

// ── generateForOrder ──────────────────────────────────────────────────────────

describe('generateForOrder', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a sale invoice when none exists', async () => {
    Invoice.findOne.mockResolvedValueOnce(null) // no existing invoice

    const invoice = await generateForOrder(makeOrder())

    expect(Invoice.create).toHaveBeenCalledOnce()
    const callArg = Invoice.create.mock.calls[0][0]
    expect(callArg.type).toBe('sale')
    expect(callArg.orderId).toBe('order-001')
    expect(callArg.grandTotal).toBe(2500)
  })

  it('is idempotent — skips creation when sale invoice already exists', async () => {
    Invoice.findOne.mockResolvedValueOnce({ _id: 'inv-existing', type: 'sale' })

    const result = await generateForOrder(makeOrder())

    // Constructor must NOT be called with new data
    expect(Invoice).not.toHaveBeenCalled()
    expect(result._id).toBe('inv-existing')
  })

  it('captures correct buyer snapshot fields', async () => {
    Invoice.findOne.mockResolvedValueOnce(null)

    await generateForOrder(makeOrder())

    const callArg = Invoice.create.mock.calls[0][0]
    expect(callArg.buyerSnapshot).toMatchObject({
      fullName: 'Aarav Sharma',
      email: 'aarav@test.com',
      city: 'Mumbai',
    })
  })

  it('handles order with no items gracefully', async () => {
    Invoice.findOne.mockResolvedValueOnce(null)
    const emptyOrder = makeOrder({ items: [], total: 0 })

    await expect(generateForOrder(emptyOrder)).resolves.not.toThrow()
  })
})

// ── generateCancellationNote ─────────────────────────────────────────────────

describe('generateCancellationNote', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a cancellation_note credit note', async () => {
    Invoice.findOne.mockResolvedValueOnce(null) // no existing cancellation_note
    Invoice.findOne.mockResolvedValueOnce(null) // no existing original sale invoice
    const feeBreakdown = { cancellationFee: 50, refundableAmount: 2450, reason: 'buyer_request' }

    await generateCancellationNote(makeOrder(), feeBreakdown)

    const callArg = Invoice.create.mock.calls[0][0]
    expect(callArg.type).toBe('cancellation_note')
    expect(callArg.orderId).toBe('order-001')
  })

  it('is idempotent — does not duplicate credit notes', async () => {
    Invoice.findOne.mockResolvedValueOnce({ _id: 'cn-1', type: 'cancellation_note' })

    const feeBreakdown = { cancellationFee: 0, refundAmount: 2500 }
    const result = await generateCancellationNote(makeOrder(), feeBreakdown)

    expect(Invoice).not.toHaveBeenCalled()
    expect(result._id).toBe('cn-1')
  })
})

// ── generateRejectionNote ─────────────────────────────────────────────────────

describe('generateRejectionNote', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a full-refund rejection_note credit note', async () => {
    Invoice.findOne.mockResolvedValueOnce(null) // no existing rejection_note
    Invoice.findOne.mockResolvedValueOnce(null) // no existing original sale invoice
    // Use online payment so isCod=false → grandTotal equals totalPaid (full refund)
    const rejectedOrder = makeOrder({ status: 'rejected', rejectionReason: 'Out of stock', paymentMethod: 'upi' })

    await generateRejectionNote(rejectedOrder)

    const callArg = Invoice.create.mock.calls[0][0]
    expect(callArg.type).toBe('rejection_note')
    // Full refund — no cancellation fee
    expect(callArg.cancellationFee ?? 0).toBe(0)
    expect(callArg.grandTotal).toBe(rejectedOrder.total)
  })

  it('is idempotent when rejection note already exists', async () => {
    Invoice.findOne.mockResolvedValueOnce({ _id: 'rn-1', type: 'rejection_note' })

    await generateRejectionNote(makeOrder())

    expect(Invoice).not.toHaveBeenCalled()
  })
})

// ── getInvoicesForOrder ───────────────────────────────────────────────────────

describe('getInvoicesForOrder', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns all invoices for an order, newest first', async () => {
    const mockInvoices = [
      { _id: 'inv-2', type: 'cancellation_note', createdAt: new Date('2026-02-26') },
      { _id: 'inv-1', type: 'sale',              createdAt: new Date('2026-02-25') },
    ]
    const leanMock = vi.fn().mockResolvedValue(mockInvoices)
    const sortMock = vi.fn().mockReturnValue({ lean: leanMock })
    Invoice.find.mockReturnValueOnce({ sort: sortMock })

    const result = await getInvoicesForOrder('order-001')

    expect(Invoice.find).toHaveBeenCalledWith({ orderId: 'order-001' })
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('cancellation_note')
  })

  it('returns empty array when no invoices exist', async () => {
    const leanMock = vi.fn().mockResolvedValue([])
    const sortMock = vi.fn().mockReturnValue({ lean: leanMock })
    Invoice.find.mockReturnValueOnce({ sort: sortMock })

    const result = await getInvoicesForOrder('order-999')

    expect(result).toEqual([])
  })
})
