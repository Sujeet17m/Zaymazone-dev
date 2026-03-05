/**
 * onboarding.routes.test.js
 *
 * Module 15 — Integration tests for POST /api/onboarding/artisan.
 * All external dependencies (Firebase auth, Mongoose models, bcrypt,
 * emailService) are mocked.  No real DB or network is used.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ── Mock external dependencies before importing the router ───────────────────

vi.mock('../../middleware/firebase-auth.js', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { _id: 'mock-user-id-123', uid: 'mock-firebase-uid', email: 'test@example.com' }
    next()
  },
}))

const mockArtisan = {
  _id: 'artisan-id-abc',
  name:  'Test Artisan',
  email: 'artisan@test.com',
  businessInfo: { businessName: 'Test Crafts' },
  approvalStatus: 'pending',
  save: vi.fn().mockResolvedValue(undefined),
}

vi.mock('../../models/Artisan.js', () => ({
  default: class MockArtisan {
    constructor(data) {
      // Provide defaults first so the route can overwrite them freely
      this._id            = 'artisan-id-abc'
      this.approvalStatus = 'pending'
      this.businessInfo   = {}
      this.verification   = {}
      // Spread caller data (name, email, etc.) without getters blocking assignment
      Object.assign(this, data)
    }
    static findOne = vi.fn()
    save = vi.fn().mockResolvedValue(undefined)
  },
}))

vi.mock('../../models/User.js', () => ({
  default: { findOne: vi.fn(), findById: vi.fn() },
}))

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password-$2b$12'),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue('hashed-password-$2b$12'),
}))

vi.mock('../../services/emailService.js', () => ({
  default: {
    sendArtisanOnboardingSubmitted: vi.fn().mockResolvedValue({}),
    sendOrderConfirmationEmail:    vi.fn().mockResolvedValue({}),
  },
  sendArtisanOnboardingSubmitted: vi.fn().mockResolvedValue({}),
}))

// ── Import router after mocks are registered ──────────────────────────────────

import Artisan from '../../models/Artisan.js'
import onboardingRouter from '../../routes/onboarding.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/onboarding', onboardingRouter)
  return app
}

// ── Minimal valid payload ──────────────────────────────────────────────────────

const VALID_PAYLOAD = {
  businessName:     'Handmade Crafts Co.',
  ownerName:        'Ramesh Kumar',
  email:            'artisan@example.com',
  password:         'securePass123',
  phone:            '9876543210',
  address: {
    village:  'Kutch',
    district: 'Bhuj',
    state:    'Gujarat',
    pincode:  '370001',
  },
  sellerType:    'non-gst',
  categories:    ['pottery', 'textiles'],
  story:         'Crafting for 20 years.',
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('POST /api/onboarding/artisan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Validation guards ──────────────────────────────────────────────────────

  it('returns 400 when businessName is missing', async () => {
    const { businessName: _, ...body } = VALID_PAYLOAD

    const res = await request(buildApp())
      .post('/api/onboarding/artisan')
      .send(body)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/businessName/i)
  })

  it('returns 400 when ownerName is missing', async () => {
    const { ownerName: _, ...body } = VALID_PAYLOAD

    const res = await request(buildApp())
      .post('/api/onboarding/artisan')
      .send(body)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when address.state is missing', async () => {
    const body = {
      ...VALID_PAYLOAD,
      address: { village: 'Kutch', district: 'Bhuj', pincode: '370001' },
    }

    const res = await request(buildApp())
      .post('/api/onboarding/artisan')
      .send(body)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when password is too short (< 6 chars)', async () => {
    const body = { ...VALID_PAYLOAD, password: 'abc' }

    const res = await request(buildApp())
      .post('/api/onboarding/artisan')
      .send(body)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/password/i)
  })

  it('returns 400 when email format is invalid', async () => {
    const body = { ...VALID_PAYLOAD, email: 'not-an-email' }

    const res = await request(buildApp())
      .post('/api/onboarding/artisan')
      .send(body)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/email/i)
  })

  it('returns 400 when phone does not match Indian 10-digit format', async () => {
    const invalidPhones = ['1234567890', '55555', '+919876543210', 'abcdefghij']

    for (const phone of invalidPhones) {
      const res = await request(buildApp())
        .post('/api/onboarding/artisan')
        .send({ ...VALID_PAYLOAD, phone })

      expect(res.status).toBe(400)
      expect(res.body.message).toMatch(/phone/i)
    }
  })

  it('returns 400 when phone starts with 5 (not valid Indian prefix)', async () => {
    const res = await request(buildApp())
      .post('/api/onboarding/artisan')
      .send({ ...VALID_PAYLOAD, phone: '5123456789' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/phone/i)
  })

  // ── Duplicate email guard ──────────────────────────────────────────────────

  it('returns 400 when email is already taken (existing artisan update, email collision)', async () => {
    // findOne(userId) returns existing artisan
    const existingArtisan = {
      ...mockArtisan,
      email: 'different@example.com',   // different email
      save: vi.fn().mockResolvedValue(undefined),
    }
    Artisan.findOne
      .mockResolvedValueOnce(existingArtisan) // existing artisan by userId
      .mockResolvedValueOnce({ _id: 'other-artisan-id' }) // duplicate email check

    const res = await request(buildApp())
      .post('/api/onboarding/artisan')
      .send({ ...VALID_PAYLOAD, email: 'already-taken@example.com' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/already registered/i)
  })

  // ── Happy path: new artisan ────────────────────────────────────────────────

  it('returns 200 and creates a new pending artisan profile', async () => {
    // No existing artisan
    Artisan.findOne.mockResolvedValueOnce(null)

    const res = await request(buildApp())
      .post('/api/onboarding/artisan')
      .send(VALID_PAYLOAD)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/pending admin approval/i)
    expect(res.body.artisan).toBeDefined()
    expect(res.body.artisan.approvalStatus).toBe('pending')
  })

  // ── Happy path: update existing artisan ───────────────────────────────────

  it('returns 200 when updating an existing artisan profile', async () => {
    const updateableArtisan = {
      _id:    mockArtisan._id,
      userId: 'mock-user-id-123',
      email:  VALID_PAYLOAD.email,  // same email — no collision check
      businessInfo: {},
      verification: {},
      save: vi.fn().mockResolvedValue(undefined),
    }
    // 1st call: findOne by userId → returns existing
    Artisan.findOne.mockResolvedValueOnce(updateableArtisan)

    const res = await request(buildApp())
      .post('/api/onboarding/artisan')
      .send(VALID_PAYLOAD)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ── GET /api/onboarding/artisan/status ────────────────────────────────────────

describe('GET /api/onboarding/artisan/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when artisan profile does not exist', async () => {
    Artisan.findOne.mockResolvedValueOnce(null)

    const res = await request(buildApp()).get('/api/onboarding/artisan/status')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/not found/i)
  })

  it('returns artisan status when profile exists', async () => {
    Artisan.findOne.mockResolvedValueOnce({
      _id:            'artisan-id-abc',
      name:           'Ramesh Kumar',
      approvalStatus: 'pending',
      avatar:         '',
      businessInfo:   { businessName: 'Handmade Crafts Co.' },
    })

    const res = await request(buildApp()).get('/api/onboarding/artisan/status')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.artisan.approvalStatus).toBe('pending')
    expect(res.body.artisan.businessName).toBe('Handmade Crafts Co.')
  })
})
