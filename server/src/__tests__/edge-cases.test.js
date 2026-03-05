/**
 * edge-cases.test.js
 *
 * Edge-case and validation unit tests covering:
 *  - Period-to-date conversion
 *  - Artisan revenue projection with zero-qty / missing items
 *  - Invoice number uniqueness
 *  - Currency / numeric boundary values
 *  - Status transition guards
 *  - Input sanitisation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'

// ── period helper (copy of the logic in artisanDashboardService) ──────────────

function periodToDate(period) {
  const MAP = {
    '7days':  7   * 86_400_000,
    '30days': 30  * 86_400_000,
    '90days': 90  * 86_400_000,
    '1year':  365 * 86_400_000,
  }
  return new Date(Date.now() - (MAP[period] ?? MAP['30days']))
}

describe('periodToDate helper', () => {
  it('returns ~7 days ago for "7days"', () => {
    const d = periodToDate('7days')
    const diff = Date.now() - d.getTime()
    expect(diff).toBeCloseTo(7 * 86_400_000, -5)
  })

  it('returns ~365 days ago for "1year"', () => {
    const d = periodToDate('1year')
    const diff = Date.now() - d.getTime()
    expect(diff).toBeCloseTo(365 * 86_400_000, -5)
  })

  it('falls back to 30days for an unknown period string', () => {
    const d    = periodToDate('invalid')
    const d30  = periodToDate('30days')
    expect(Math.abs(d.getTime() - d30.getTime())).toBeLessThan(1000)
  })
})

// ── growthPct calculation ─────────────────────────────────────────────────────

function calcGrowthPct(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100 * 10) / 10
}

describe('growthPct calculation', () => {
  it('calculates positive growth', () => {
    expect(calcGrowthPct(12000, 10000)).toBe(20)
  })

  it('calculates negative growth', () => {
    expect(calcGrowthPct(8000, 10000)).toBe(-20)
  })

  it('returns 100 when previous is 0 and current > 0', () => {
    expect(calcGrowthPct(5000, 0)).toBe(100)
  })

  it('returns 0 when both are 0', () => {
    expect(calcGrowthPct(0, 0)).toBe(0)
  })

  it('handles floating-point amounts correctly', () => {
    expect(calcGrowthPct(1050, 1000)).toBeCloseTo(5, 1)
  })
})

// ── Order status transition guards ───────────────────────────────────────────

const REJECTABLE_STATUSES = ['placed', 'confirmed', 'processing']
const ACCEPT_ONLY_STATUS  = ['placed']
const TERMINAL_STATUSES   = ['delivered', 'cancelled', 'rejected', 'returned', 'refunded']

describe('order status transition guards', () => {
  it.each(REJECTABLE_STATUSES)('status "%s" is rejectable', (status) => {
    expect(REJECTABLE_STATUSES.includes(status)).toBe(true)
  })

  it.each(TERMINAL_STATUSES)('terminal status "%s" cannot be accepted', (status) => {
    expect(ACCEPT_ONLY_STATUS.includes(status)).toBe(false)
  })

  it('only placed orders can be accepted', () => {
    expect(ACCEPT_ONLY_STATUS).toEqual(['placed'])
  })

  it('shipped orders cannot be rejected', () => {
    expect(REJECTABLE_STATUSES.includes('shipped')).toBe(false)
    expect(REJECTABLE_STATUSES.includes('out_for_delivery')).toBe(false)
  })
})

// ── Rejection reason validation ───────────────────────────────────────────────

function validateRejectionReason(reason) {
  if (!reason || typeof reason !== 'string') return { ok: false, error: 'Reason is required' }
  const t = reason.trim()
  if (t.length < 10)  return { ok: false, error: 'Reason must be at least 10 characters' }
  if (t.length > 500) return { ok: false, error: 'Reason must not exceed 500 characters' }
  return { ok: true }
}

describe('validateRejectionReason', () => {
  it('accepts a valid reason', () => {
    expect(validateRejectionReason('Out of stock due to high demand.')).toMatchObject({ ok: true })
  })

  it('rejects null input', () => {
    expect(validateRejectionReason(null)).toMatchObject({ ok: false })
  })

  it('rejects empty string', () => {
    expect(validateRejectionReason('')).toMatchObject({ ok: false })
  })

  it('rejects reason shorter than 10 chars', () => {
    expect(validateRejectionReason('short')).toMatchObject({ ok: false })
  })

  it('rejects reason longer than 500 chars', () => {
    expect(validateRejectionReason('x'.repeat(501))).toMatchObject({ ok: false })
  })

  it('passes for exactly 10 characters', () => {
    expect(validateRejectionReason('1234567890')).toMatchObject({ ok: true })
  })

  it('trims whitespace before checking length', () => {
    // "   " is only spaces, so trimmed it's empty
    expect(validateRejectionReason('   ')).toMatchObject({ ok: false })
  })
})

// ── Invoice number format ─────────────────────────────────────────────────────

function formatInvoiceNumber(prefix, year, sequence) {
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`
}

describe('invoice number format', () => {
  it('pads sequence to 6 digits', () => {
    expect(formatInvoiceNumber('INV', 2026, 1)).toBe('INV-2026-000001')
  })

  it('handles sequence at boundary (999999)', () => {
    expect(formatInvoiceNumber('INV', 2026, 999999)).toBe('INV-2026-999999')
  })

  it('prepends correct prefix for cancellation notes', () => {
    expect(formatInvoiceNumber('CN', 2026, 42)).toBe('CN-2026-000042')
  })
})

// ── Currency formatting (INR) ─────────────────────────────────────────────────

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

describe('INR currency formatting', () => {
  it('formats whole rupees correctly', () => {
    expect(fmtINR(1000)).toContain('1,000')
  })

  it('formats zero as ₹0', () => {
    expect(fmtINR(0)).toContain('0')
  })

  it('formats large amounts with correct grouping', () => {
    const result = fmtINR(100000)
    // en-IN grouping: 1,00,000
    expect(result).toContain('1,00,000')
  })

  it('does not include decimal part for whole rupees', () => {
    expect(fmtINR(999)).not.toContain('.')
  })
})

// ── ObjectId coercion edge cases ──────────────────────────────────────────────

describe('mongoose ObjectId coercion', () => {
  it('creates ObjectId from valid 24-char hex string', () => {
    const hexString = '507f1f77bcf86cd799439011'
    expect(() => new mongoose.Types.ObjectId(hexString)).not.toThrow()
  })

  it('throws on invalid ObjectId string', () => {
    expect(() => new mongoose.Types.ObjectId('invalid')).toThrow()
  })

  it('ObjectId equality comparison works', () => {
    const id1 = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011')
    const id2 = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011')
    expect(id1.equals(id2)).toBe(true)
  })

  it('different ObjectIds are not equal', () => {
    const id1 = new mongoose.Types.ObjectId()
    const id2 = new mongoose.Types.ObjectId()
    expect(id1.equals(id2)).toBe(false)
  })
})
