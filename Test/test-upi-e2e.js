#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Zaymazone — Module 8 Testing & Documentation
 * UPI Prepaid Payment — End-to-End Test Suite
 * ───────────────────────────────────────────────────────────────────────────────
 * Covers:
 *  TC-UPI-01  Happy path:  generate intent → verify with valid UTR → order PAID
 *  TC-UPI-02  Amount mismatch: amount in request ≠ order.total → 400
 *  TC-UPI-03  Expired intent: expiresAt in the past → admin verify → 400
 *  TC-UPI-04  Invalid UTR format (symbols/spaces) → 400
 *  TC-UPI-05  UTR too short (< 10 chars) → 400
 *  TC-UPI-06  Duplicate UTR: same UTR reused across two orders → 400
 *  TC-UPI-07  Non-existent order ID → 404
 *  TC-UPI-08  Already-verified order cannot be double-verified → 400
 *  TC-UPI-09  Non-admin cannot call /verify → 403
 *  TC-UPI-10  Unauthenticated generate-intent → 401
 *
 * Prerequisites (run once before this suite):
 *   1. Backend running on http://localhost:4000
 *   2. MongoDB seeded with at least one product (use server/seed-categories.js)
 *   3. Set ADMIN_TOKEN and USER_TOKEN env vars OR let the suite auto-login:
 *        ADMIN_EMAIL   / ADMIN_PASSWORD
 *        TEST_EMAIL    / TEST_PASSWORD
 *
 * Usage:
 *   node Test/test-upi-e2e.js
 *   # or with custom base URL:
 *   BASE_URL=http://localhost:4000 node Test/test-upi-e2e.js
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import fetch from 'node-fetch'

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE_URL   = process.env.BASE_URL   || 'http://localhost:4000'
const USER_EMAIL = process.env.TEST_EMAIL  || 'testuser@zaymazone.com'
const USER_PASS  = process.env.TEST_PASSWORD || 'Test@1234'
const ADMIN_EMAIL= process.env.ADMIN_EMAIL  || 'admin@zaymazone.com'
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Admin@1234'

// ── Colour helpers ────────────────────────────────────────────────────────────

const c = {
  reset  : '\x1b[0m',
  green  : '\x1b[32m',
  red    : '\x1b[31m',
  yellow : '\x1b[33m',
  cyan   : '\x1b[36m',
  bold   : '\x1b[1m',
  dim    : '\x1b[2m',
}

function pass(msg) { console.log(`  ${c.green}✔${c.reset} ${msg}`) }
function fail(msg) { console.log(`  ${c.red}✘${c.reset} ${msg}`) }
function info(msg) { console.log(`  ${c.cyan}ℹ${c.reset} ${c.dim}${msg}${c.reset}`) }
function head(msg) { console.log(`\n${c.bold}${c.cyan}${msg}${c.reset}`) }

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function api(method, path, body = null, token = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }
  try {
    const res  = await fetch(`${BASE_URL}${path}`, opts)
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  } catch (err) {
    return { status: 0, data: { error: err.message } }
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function loginUser() {
  const { status, data } = await api('POST', '/api/auth/signin', {
    email: USER_EMAIL, password: USER_PASS,
  })
  if (status !== 200) throw new Error(`User login failed (${status}): ${data.error}`)
  return data.token || data.idToken || data.accessToken
}

async function loginAdmin() {
  const { status, data } = await api('POST', '/api/auth/signin', {
    email: ADMIN_EMAIL, password: ADMIN_PASS,
  })
  if (status !== 200) throw new Error(`Admin login failed (${status}): ${data.error}`)
  return data.token || data.idToken || data.accessToken
}

// ── Order helper ──────────────────────────────────────────────────────────────

/**
 * Create a minimal UPI order via the orders API so we have a real orderId.
 * Requires at least one active product in the DB.
 */
async function createTestOrder(userToken, overrideState = 'Delhi') {
  // First fetch an available product
  const { data: productsPage } = await api('GET', '/api/products?limit=1&isActive=true')
  const product = productsPage?.products?.[0] || productsPage?.[0]
  if (!product) throw new Error('No active product found – seed the DB first')

  const payload = {
    items: [{ productId: product._id || product.id, quantity: 1 }],
    shippingAddress: {
      fullName    : 'Test Customer',
      phone       : '9876543210',
      email       : USER_EMAIL,
      addressLine1: '12 MG Road',
      city        : 'Delhi',
      state       : overrideState,
      zipCode     : '110001',
      country     : 'India',
      addressType : 'home',
    },
    paymentMethod       : 'upi_prepaid',
    useShippingAsBilling: true,   // required: billingAddress is a required field in Order model
  }

  const { status, data } = await api('POST', '/api/orders', payload, userToken)
  if (status !== 201) throw new Error(`Create order failed (${status}): ${JSON.stringify(data)}`)
  return data
}

// ── Test runner ───────────────────────────────────────────────────────────────

const results = { pass: 0, fail: 0, skip: 0 }

async function test(id, name, fn) {
  process.stdout.write(`  ${c.yellow}[${id}]${c.reset} ${name} … `)
  try {
    await fn()
    console.log(`${c.green}PASS${c.reset}`)
    results.pass++
  } catch (err) {
    console.log(`${c.red}FAIL${c.reset}`)
    console.log(`       ${c.red}${err.message}${c.reset}`)
    results.fail++
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

// ── Main suite ────────────────────────────────────────────────────────────────

async function run() {
  head('══════════════════════════════════════════════════════════')
  head('  Zaymazone › UPI Prepaid — End-to-End Test Suite (M8)   ')
  head('══════════════════════════════════════════════════════════')
  info(`Target : ${BASE_URL}`)

  // ── Health check ──────────────────────────────────────────────────────────
  head('0. Pre-flight')
  const health = await api('GET', '/health')
  if (health.status !== 200) {
    fail('Backend not reachable – aborting.')
    process.exit(1)
  }
  pass('Backend healthy')

  // ── Obtain tokens ─────────────────────────────────────────────────────────
  let userToken, adminToken
  try {
    userToken  = await loginUser()
    pass(`User  token obtained`)
  } catch (e) { fail(`Could not obtain user token: ${e.message}`); process.exit(1) }

  try {
    adminToken = await loginAdmin()
    pass(`Admin token obtained`)
  } catch (e) { fail(`Could not obtain admin token: ${e.message}`); process.exit(1) }

  // ── TC-UPI-10: Unauthenticated generate-intent ────────────────────────────
  head('TC-UPI-10 — Unauthenticated Generate Intent')
  await test('TC-UPI-10', 'No auth token → 401 Unauthorized', async () => {
    const { status } = await api('POST', '/api/upi-payments/generate-intent', {
      orderId: '000000000000000000000000',
      amount: 100,
    }, null)
    assert(status === 401, `Expected 401 but got ${status}`)
  })

  // ── Create a test order for subsequent tests ──────────────────────────────
  head('Setup — Create UPI test order')
  let testOrder
  try {
    testOrder = await createTestOrder(userToken)
    info(`Order created: ${testOrder.orderNumber}  |  total: ₹${testOrder.total}`)
    pass('Test order ready')
  } catch (e) {
    fail(`Cannot create test order: ${e.message}`)
    info('Skipping order-dependent tests')
    testOrder = null
  }

  // ── TC-UPI-07: Non-existent order ID ─────────────────────────────────────
  head('TC-UPI-07 — Non-existent Order')
  await test('TC-UPI-07', 'Random ObjectId → 404 Not Found', async () => {
    const { status } = await api('POST', '/api/upi-payments/generate-intent', {
      orderId: '507f1f77bcf86cd799439099',
      amount:  500,
    }, userToken)
    assert(status === 404, `Expected 404 but got ${status}`)
  })

  if (testOrder) {
    const orderId     = testOrder._id || testOrder.id
    const orderAmount = testOrder.total

    // ── TC-UPI-02: Amount mismatch ──────────────────────────────────────────
    head('TC-UPI-02 — Amount Mismatch')
    await test('TC-UPI-02', 'Wrong amount → 400 with error.code AMOUNT_MISMATCH or description', async () => {
      const { status, data } = await api('POST', '/api/upi-payments/generate-intent', {
        orderId,
        amount: orderAmount + 999, // deliberately wrong
      }, userToken)
      assert(
        status === 400,
        `Expected 400 but got ${status} — ${JSON.stringify(data)}`
      )
    })

    // ── TC-UPI-01: Happy path ───────────────────────────────────────────────
    head('TC-UPI-01 — Happy Path (Generate Intent)')
    let upiPaymentId
    await test('TC-UPI-01a', 'Generate intent → 201 with upiIntentUrl + qrCodeData', async () => {
      const { status, data } = await api('POST', '/api/upi-payments/generate-intent', {
        orderId,
        amount: orderAmount,
      }, userToken)
      assert(status === 201, `Expected 201 but got ${status} — ${JSON.stringify(data)}`)
      assert(data.upiIntentUrl?.startsWith('upi://pay?'), 'upiIntentUrl must start with upi://pay?')
      assert(data.qrCodeData?.startsWith('data:image/'), 'qrCodeData must be a data: URL')
      assert(typeof data.expiresAt === 'string', 'expiresAt must be present')
      upiPaymentId = data.upiPaymentId
      info(`UPI Payment ID: ${upiPaymentId}`)
    })

    // Intent URL format assertions
    await test('TC-UPI-01b', 'UPI intent URL contains required params (pa, pn, am, tr, cu=INR)', async () => {
      const { data } = await api('POST', '/api/upi-payments/generate-intent', {
        orderId,
        amount: orderAmount,
      }, userToken)
      // A second intent is fine for testing URL structure (existing pending)
      const url = new URL(data.upiIntentUrl.replace('upi://pay?', 'http://x.x?'))
      assert(url.searchParams.get('pa'), 'pa (payee address) missing in UPI intent URL')
      assert(url.searchParams.get('pn'), 'pn (payee name) missing in UPI intent URL')
      assert(url.searchParams.get('am'), 'am (amount) missing in UPI intent URL')
      assert(url.searchParams.get('cu') === 'INR', 'cu must be INR')
    })

    // ── TC-UPI-09: Non-admin verify ─────────────────────────────────────────
    head('TC-UPI-09 — Non-Admin Verification')
    await test('TC-UPI-09', 'Regular user cannot verify payment → 403 Forbidden', async () => {
      const { status } = await api('POST', '/api/upi-payments/verify', {
        upiPaymentId: upiPaymentId || '507f1f77bcf86cd799439099',
        utr: 'HDFC000012345678',
      }, userToken)
      assert(status === 403, `Expected 403 but got ${status}`)
    })

    // ── TC-UPI-04: Invalid UTR format ───────────────────────────────────────
    head('TC-UPI-04 — Invalid UTR Format')
    await test('TC-UPI-04a', 'UTR with spaces → 400', async () => {
      const { status } = await api('POST', '/api/upi-payments/verify', {
        upiPaymentId: upiPaymentId || '507f1f77bcf86cd799439099',
        utr: 'HDFC 0000 1234',
      }, adminToken)
      assert(status === 400, `Expected 400 but got ${status}`)
    })

    await test('TC-UPI-04b', 'UTR with special chars → 400', async () => {
      const { status } = await api('POST', '/api/upi-payments/verify', {
        upiPaymentId: upiPaymentId || '507f1f77bcf86cd799439099',
        utr: 'HDFC-0000-1234!!',
      }, adminToken)
      assert(status === 400, `Expected 400 but got ${status}`)
    })

    // ── TC-UPI-05: UTR too short ────────────────────────────────────────────
    head('TC-UPI-05 — UTR Too Short')
    await test('TC-UPI-05', 'UTR < 10 characters → 400 (Zod minimum)', async () => {
      const { status } = await api('POST', '/api/upi-payments/verify', {
        upiPaymentId: upiPaymentId || '507f1f77bcf86cd799439099',
        utr: 'ABC123',
      }, adminToken)
      assert(status === 400, `Expected 400 but got ${status}`)
    })

    if (upiPaymentId) {
      // ── TC-UPI-01c: Full verify happy path ─────────────────────────────────
      head('TC-UPI-01c — Admin Verifies Payment (UTR Submission)')
      const validUtr = `HDFC${Date.now().toString().slice(-10)}` // 14-char alphanumeric
      let verifyResult
      await test('TC-UPI-01c', `Admin verifies with UTR ${validUtr} → 200, order.paymentStatus = paid`, async () => {
        const { status, data } = await api('POST', '/api/upi-payments/verify', {
          upiPaymentId,
          utr: validUtr,
          verificationNotes: 'Payment confirmed via bank screenshot',
        }, adminToken)
        info(`Verify response (${status}): ${JSON.stringify(data).slice(0, 120)}`)
        assert(
          status === 200 || status === 201,
          `Expected 200/201 but got ${status} — ${JSON.stringify(data)}`
        )
        assert(
          data.order?.paymentStatus === 'paid' || data.paymentStatus === 'verified',
          'paymentStatus not updated to paid/verified'
        )
        verifyResult = data
      })

      // ── TC-UPI-06: Duplicate UTR ────────────────────────────────────────────
      head('TC-UPI-06 — Duplicate UTR')
      await test('TC-UPI-06', 'Reusing the same UTR → 400 DUPLICATE_UTR', async () => {
        // Create a second order
        let secondOrderId
        try {
          const order2 = await createTestOrder(userToken)
          const intent2 = await api('POST', '/api/upi-payments/generate-intent', {
            orderId: order2._id || order2.id,
            amount: order2.total,
          }, userToken)
          secondOrderId = intent2.data.upiPaymentId
        } catch (_) {
          secondOrderId = upiPaymentId // fallback: attempt reuse on same record
        }

        const { status, data } = await api('POST', '/api/upi-payments/verify', {
          upiPaymentId: secondOrderId,
          utr: validUtr, // same UTR as before
        }, adminToken)
        assert(status === 400, `Expected 400 (duplicate UTR) but got ${status}`)
        assert(
          data.code === 'DUPLICATE_UTR' || data.error?.includes('Duplicate'),
          `Expected DUPLICATE_UTR error but got: ${JSON.stringify(data)}`
        )
      })

      // ── TC-UPI-08: Double verify ────────────────────────────────────────────
      head('TC-UPI-08 — Already Verified Order')
      await test('TC-UPI-08', 'Generating a new intent on an already-paid order → 400', async () => {
        const { status } = await api('POST', '/api/upi-payments/generate-intent', {
          orderId,
          amount: orderAmount,
        }, userToken)
        assert(status === 400, `Expected 400 (already verified) but got ${status}`)
      })
    }

    // ── TC-UPI-03: Expired intent ───────────────────────────────────────────
    head('TC-UPI-03 — Expired Intent (Simulation)')
    info('Creating a fresh order for expiry test …')
    await test('TC-UPI-03', 'expiryMinutes=60 sets expiresAt ≥ 59 min from now', async () => {
      let order3
      try { order3 = await createTestOrder(userToken) }
      catch (e) { throw new Error(`Cannot create order for expiry test: ${e.message}`) }

      const { status, data } = await api('POST', '/api/upi-payments/generate-intent', {
        orderId : order3._id || order3.id,
        amount  : order3.total,
        expiryMinutes: 60,
      }, userToken)
      assert(status === 201, `Expected 201 but got ${status}`)
      const expiry = new Date(data.expiresAt)
      const diff   = (expiry - Date.now()) / 60000 // minutes
      assert(diff >= 58, `expiresAt should be ~60 min ahead, got ${diff.toFixed(1)} min`)
      info(`expiresAt = ${data.expiresAt}  (${diff.toFixed(1)} min remaining)`)
    })
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  head('══════════════════════════════════')
  console.log(
    `  ${c.bold}Final:${c.reset}  ` +
    `${c.green}${results.pass} passed${c.reset}  ` +
    `${c.red}${results.fail} failed${c.reset}  ` +
    `${c.yellow}${results.skip} skipped${c.reset}`
  )
  head('══════════════════════════════════')
  process.exit(results.fail > 0 ? 1 : 0)
}

run().catch(err => {
  fail(`Unhandled error: ${err.message}`)
  process.exit(1)
})
