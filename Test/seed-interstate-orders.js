#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Zaymazone — Module 8 Testing & Documentation
 * Interstate Shipping Scenarios — Mock Order Seeder
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE
 * ───────
 * Creates a set of realistic mock orders that exercise every shipping zone
 * the Zaymazone logistics engine supports.  Each order uses a different
 * destination state, verifying that:
 *   • The correct shipping zone is assigned   (local / metro / tier2 / remote)
 *   • The correct courier is suggested        (Blue Dart / Delhivery / DTDC / India Post)
 *   • The correct base-charge is applied      (₹40 / ₹60 / ₹80 / ₹120)
 *   • Free-shipping threshold is respected    (₹1,500 for most zones; ₹2,000 remote)
 *   • COD fee is correct for COD orders
 *
 * SHIPPING MATRIX (Origin: Rajasthan)
 * ────────────────────────────────────────────────────────────────────────────
 *  #   Destination            Zone          Payment   Expected Base Charge
 *  1   Rajasthan (same state) local         COD       ₹40 or FREE if ≥₹1500
 *  2   Delhi                  metro         UPI       ₹60 or FREE if ≥₹1500
 *  3   Uttar Pradesh          tier2         COD       ₹80 or FREE if ≥₹1500
 *  4   Maharashtra (Mumbai)   metro         UPI       ₹60 or FREE if ≥₹1500
 *  5   Jammu and Kashmir      remote        COD       ₹120 or FREE if ≥₹2000
 *  6   Tamil Nadu             metro         UPI       ₹60 or FREE if ≥₹1500
 *  7   Bihar (Patna)          tier2         COD       ₹80 or FREE if ≥₹1500
 *  8   Arunachal Pradesh      remote        UPI       ₹120 or FREE if ≥₹2000
 * ────────────────────────────────────────────────────────────────────────────
 *
 * USAGE
 * ─────
 *   node Test/seed-interstate-orders.js
 *   BASE_URL=http://localhost:4000 node Test/seed-interstate-orders.js
 *
 *   # Dry-run (print expected values without calling the API):
 *   DRY_RUN=true node Test/seed-interstate-orders.js
 *
 * ENV VARS
 * ────────
 *   BASE_URL       — backend base URL            (default: http://localhost:4000)
 *   TEST_EMAIL     — test user email             (default: testuser@zaymazone.com)
 *   TEST_PASSWORD  — test user password          (default: Test@1234)
 *   ADMIN_EMAIL    — admin email                 (default: admin@zaymazone.com)
 *   ADMIN_PASSWORD — admin password              (default: Admin@1234)
 *   DRY_RUN        — set to "true" to skip API calls
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import fetch from 'node-fetch'

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE_URL    = process.env.BASE_URL       || 'http://localhost:4000'
const USER_EMAIL  = process.env.TEST_EMAIL     || 'testuser@zaymazone.com'
const USER_PASS   = process.env.TEST_PASSWORD  || 'Test@1234'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL    || 'admin@zaymazone.com'
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'Admin@1234'
const DRY_RUN     = process.env.DRY_RUN === 'true'

// ── Colour helpers ────────────────────────────────────────────────────────────

const c = {
  r: '\x1b[0m', g: '\x1b[32m', re: '\x1b[31m',
  y: '\x1b[33m', cy: '\x1b[36m', b: '\x1b[1m', d: '\x1b[2m',
  mag: '\x1b[35m',
}

const ok   = m => console.log(`  ${c.g}✔${c.r} ${m}`)
const err  = m => console.log(`  ${c.re}✘${c.r} ${m}`)
const note = m => console.log(`  ${c.cy}ℹ${c.r} ${c.d}${m}${c.r}`)
const hr   = m => console.log(`\n${c.b}${c.cy}${m}${c.r}`)
const row  = (label, value) =>
  console.log(`    ${c.d}${label.padEnd(22)}${c.r}${value}`)

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function api(method, path, body = null, token = null) {
  if (DRY_RUN) {
    return { status: 200, data: { _dryRun: true } }
  }
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
  } catch (e) {
    return { status: 0, data: { error: e.message } }
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function loginUser() {
  const { status, data } = await api('POST', '/api/auth/signin', { email: USER_EMAIL, password: USER_PASS })
  if (status !== 200) throw new Error(`User login failed (${status}): ${JSON.stringify(data)}`)
  return data.token || data.idToken || data.accessToken
}

async function loginAdmin() {
  const { status, data } = await api('POST', '/api/auth/signin', { email: ADMIN_EMAIL, password: ADMIN_PASS })
  if (status !== 200) throw new Error(`Admin login failed (${status}): ${JSON.stringify(data)}`)
  return data.token || data.idToken || data.accessToken
}

// ── Product helper ────────────────────────────────────────────────────────────

async function getFirstProduct() {
  const { data } = await api('GET', '/api/products?limit=1&isActive=true')
  const product = data?.products?.[0] || data?.[0]
  if (!product) throw new Error('No active product found – seed the DB first')
  return product
}

// ── Shipping expectation calculator (mirrors shippingService.js logic) ────────

const STATE_ZONES = {
  'rajasthan': 'local',
  'delhi': 'metro',
  'uttar pradesh': 'tier2',
  'maharashtra': 'metro',
  'jammu and kashmir': 'remote',
  'tamil nadu': 'metro',
  'bihar': 'tier2',
  'arunachal pradesh': 'remote',
}

const ZONE_RATES = {
  local  : { label: 'Local / Intra-State',  baseCharge: 40,  freeThreshold: 1500, days: '1-2' },
  metro  : { label: 'Metro City',            baseCharge: 60,  freeThreshold: 1500, days: '2-3' },
  tier2  : { label: 'Tier-2 City',           baseCharge: 80,  freeThreshold: 1500, days: '3-5' },
  remote : { label: 'Remote / Hill Area',    baseCharge: 120, freeThreshold: 2000, days: '7-10' },
}

const COURIERS = {
  local  : { prepaid: 'Delhivery',  cod: 'Delhivery' },
  metro  : { prepaid: 'Blue Dart',  cod: 'Delhivery' },
  tier2  : { prepaid: 'Delhivery',  cod: 'DTDC' },
  remote : { prepaid: 'India Post', cod: 'India Post' },
}

function expectShipping(state, subtotal, paymentMethod) {
  const zone      = STATE_ZONES[state.toLowerCase()] || 'rest_of_india'
  const rates     = ZONE_RATES[zone]   || ZONE_RATES.tier2
  const courier   = COURIERS[zone]     || COURIERS.tier2
  const isFree    = subtotal >= rates.freeThreshold
  const charge    = isFree ? 0 : rates.baseCharge
  const suggested = courier[paymentMethod === 'cod' ? 'cod' : 'prepaid']
  return { zone, label: rates.label, charge, isFree, suggested, days: rates.days }
}

// ── Mock order scenarios ──────────────────────────────────────────────────────

/**
 * List of interstate shipping test scenarios.
 * Each contains:
 *  - id:          scenario ID
 *  - description: human-readable name
 *  - state:       destination state
 *  - city:        destination city
 *  - zipCode:     indicative PIN
 *  - payment:     'cod' or 'upi_prepaid'
 *  - subtotal:    will be determined by product price; listed for display only
 */
const SCENARIOS = [
  {
    id          : 'SHIP-01',
    description : 'Intra-state delivery (Jaipur → Jodhpur)',
    state       : 'Rajasthan',
    city        : 'Jodhpur',
    zipCode     : '342001',
    payment     : 'cod',
  },
  {
    id          : 'SHIP-02',
    description : 'Metro delivery — National Capital (Rajasthan → Delhi)',
    state       : 'Delhi',
    city        : 'New Delhi',
    zipCode     : '110001',
    payment     : 'upi_prepaid',
  },
  {
    id          : 'SHIP-03',
    description : 'Tier-2 inter-state (Rajasthan → Lucknow, UP)',
    state       : 'Uttar Pradesh',
    city        : 'Lucknow',
    zipCode     : '226001',
    payment     : 'cod',
  },
  {
    id          : 'SHIP-04',
    description : 'Metro delivery — Financial Capital (Rajasthan → Mumbai)',
    state       : 'Maharashtra',
    city        : 'Mumbai',
    zipCode     : '400001',
    payment     : 'upi_prepaid',
  },
  {
    id          : 'SHIP-05',
    description : 'Remote zone — J&K (highest shipping cost, COD edge case)',
    state       : 'Jammu and Kashmir',
    city        : 'Srinagar',
    zipCode     : '190001',
    payment     : 'cod',
  },
  {
    id          : 'SHIP-06',
    description : 'Metro delivery — South India (Rajasthan → Chennai)',
    state       : 'Tamil Nadu',
    city        : 'Chennai',
    zipCode     : '600001',
    payment     : 'upi_prepaid',
  },
  {
    id          : 'SHIP-07',
    description : 'Tier-2 — East India (Rajasthan → Patna, Bihar)',
    state       : 'Bihar',
    city        : 'Patna',
    zipCode     : '800001',
    payment     : 'cod',
  },
  {
    id          : 'SHIP-08',
    description : 'Remote North-East (Rajasthan → Itanagar, Arunachal Pradesh)',
    state       : 'Arunachal Pradesh',
    city        : 'Itanagar',
    zipCode     : '791111',
    payment     : 'upi_prepaid',
  },
]

// ── Print expected values table ───────────────────────────────────────────────

function printExpectationTable(productPrice) {
  hr('Expected Shipping Outcomes (based on product price ₹' + productPrice + ')')
  console.log()
  console.log(
    `  ${'ID'.padEnd(9)} ${'State'.padEnd(25)} ${'Zone'.padEnd(17)} ` +
    `${'Base Charge'.padEnd(12)} ${'Free?'.padEnd(7)} ${'Courier'.padEnd(14)} Days`
  )
  console.log('  ' + '─'.repeat(92))

  for (const s of SCENARIOS) {
    const exp = expectShipping(s.state, productPrice, s.payment)
    const freeStr = exp.isFree ? `YES (≥₹${exp.charge === 0 ? ZONE_RATES[exp.zone]?.freeThreshold : 0})` : 'NO'
    const chargeStr = exp.isFree ? `FREE` : `₹${exp.charge}`
    console.log(
      `  ${c.y}${s.id.padEnd(9)}${c.r} ` +
      `${s.state.padEnd(25)} ` +
      `${c.mag}${exp.zone.padEnd(17)}${c.r} ` +
      `${chargeStr.padEnd(12)} ` +
      `${(exp.isFree ? c.g : c.d) + freeStr.padEnd(7) + c.r} ` +
      `${exp.suggested.padEnd(14)} ` +
      `${exp.days}`
    )
  }
  console.log()
}

// ── Create one order via the most appropriate endpoint ────────────────────────

async function createOrder(scenario, product, userToken, adminToken) {
  const productId = product._id || product.id
  const price     = product.price

  const shippingAddress = {
    fullName    : `Test Customer — ${scenario.id}`,
    phone       : '9000000001',
    email       : USER_EMAIL,
    addressLine1: '1 Artisan Lane',
    city        : scenario.city,
    state       : scenario.state,
    zipCode     : scenario.zipCode,
    country     : 'India',
    addressType : 'home',
  }

  let resultOrder = null
  let resultStatus = null

  if (scenario.payment === 'cod') {
    // ── COD path ────────────────────────────────────────────────────────────
    const { status, data } = await api('POST', '/api/cod/orders', {
      items               : [{ productId, quantity: 1 }],
      shippingAddress,
      useShippingAsBilling: true,
      notes               : `[${scenario.id}] ${scenario.description}`,
    }, userToken)

    resultStatus = status
    resultOrder  = data

  } else {
    // ── UPI Prepaid path: create order first, then generate intent ───────────
    const { status: os, data: orderData } = await api('POST', '/api/orders', {
      items               : [{ productId, quantity: 1 }],
      shippingAddress,
      paymentMethod       : 'upi_prepaid',
      useShippingAsBilling: true,
      notes               : `[${scenario.id}] ${scenario.description}`,
    }, userToken)

    resultStatus = os
    resultOrder  = orderData

    if (os === 201) {
      // Generate UPI intent
      const { status: is, data: intentData } = await api(
        'POST', '/api/upi-payments/generate-intent',
        { orderId: orderData._id || orderData.id, amount: orderData.total },
        userToken
      )
      if (is === 201) {
        resultOrder._upiIntent = {
          upiPaymentId : intentData.upiPaymentId,
          upiIntentUrl : intentData.upiIntentUrl,
          expiresAt    : intentData.expiresAt,
        }
      }
    }
  }

  return { status: resultStatus, order: resultOrder }
}

// ── Validate shipping charges in order response ───────────────────────────────

function validateShipping(scenario, order, productPrice) {
  const exp = expectShipping(scenario.state, productPrice, scenario.payment)
  const issues = []

  if (order.shippingBreakdown) {
    const sb = order.shippingBreakdown

    if (exp.isFree && sb.isFreeShipping !== true) {
      issues.push(`Expected isFreeShipping=true for subtotal ≥ ₹${ZONE_RATES[exp.zone]?.freeThreshold}`)
    }
    if (!exp.isFree && sb.baseCharge !== undefined && sb.baseCharge !== exp.charge) {
      issues.push(`Expected baseCharge=₹${exp.charge} but got ₹${sb.baseCharge}`)
    }
    if (sb.shippingZone && sb.shippingZone !== exp.zone) {
      issues.push(`Expected zone=${exp.zone} but got ${sb.shippingZone}`)
    }
  } else if (order.shippingCost !== undefined) {
    // Fallback: at least check free-shipping
    if (exp.isFree && order.shippingCost !== 0) {
      issues.push(`Expected shippingCost=0 (free shipping) but got ₹${order.shippingCost}`)
    }
  }

  return issues
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  hr('══════════════════════════════════════════════════════════════')
  hr('  Zaymazone › Interstate Shipping Mock Order Seeder (M8)      ')
  hr('══════════════════════════════════════════════════════════════')
  note(`Target : ${BASE_URL}   DRY_RUN: ${DRY_RUN}`)

  if (DRY_RUN) {
    note('DRY_RUN=true — no API calls will be made')
  }

  // ── Pre-flight ─────────────────────────────────────────────────────────────
  hr('1. Pre-flight checks')
  if (!DRY_RUN) {
    const health = await api('GET', '/health')
    if (health.status !== 200) {
      err('Backend not reachable. Start the server and retry.')
      process.exit(1)
    }
    ok('Backend healthy')
  }

  let userToken, adminToken, product

  if (!DRY_RUN) {
    try { userToken  = await loginUser();  ok(`User  token obtained`) }
    catch (e) { err(`User login: ${e.message}`); process.exit(1) }

    try { adminToken = await loginAdmin(); ok(`Admin token obtained`) }
    catch (e) { err(`Admin login: ${e.message}`); process.exit(1) }

    try {
      product = await getFirstProduct()
      ok(`Using product: "${product.name}" (₹${product.price})`)
    }
    catch (e) { err(`Get product: ${e.message}`); process.exit(1) }
  } else {
    // Fake product for dry-run
    product = { _id: 'dryrun000', name: 'Sample Artisan Product', price: 850 }
    ok(`Dry-run product: "${product.name}" (₹${product.price})`)
  }

  // ── Print expectation table ────────────────────────────────────────────────
  printExpectationTable(product.price)

  // ── Create orders ──────────────────────────────────────────────────────────
  hr('2. Seeding interstate mock orders')
  const seeded   = []
  const failures = []

  for (const scenario of SCENARIOS) {
    process.stdout.write(
      `  ${c.y}[${scenario.id}]${c.r} ${scenario.description.padEnd(58)} `
    )

    if (DRY_RUN) {
      const exp = expectShipping(scenario.state, product.price, scenario.payment)
      console.log(
        `${c.d}DRY-RUN${c.r}  zone=${c.mag}${exp.zone}${c.r}  ` +
        `charge=${exp.isFree ? c.g + 'FREE' : c.d + '₹' + exp.charge}${c.r}`
      )
      seeded.push({ scenario, order: null, exp })
      continue
    }

    try {
      const { status, order } = await createOrder(scenario, product, userToken, adminToken)

      if (status === 201 || status === 200) {
        const exp    = expectShipping(scenario.state, product.price, scenario.payment)
        const issues = validateShipping(scenario, order, product.price)

        console.log(
          `${c.g}✔${c.r}  ` +
          `#${(order.orderNumber || 'N/A').padEnd(26)} ` +
          `zone=${c.mag}${exp.zone}${c.r}  ` +
          `shipping=₹${order.shippingCost ?? '?'}  ` +
          `total=₹${order.total ?? '?'}`
        )

        if (issues.length > 0) {
          issues.forEach(i => note(`     ⚠ ${i}`))
        }

        seeded.push({ scenario, order, exp, issues })
      } else {
        console.log(`${c.re}✘ HTTP ${status}${c.r}`)
        note(`     ${JSON.stringify(order).slice(0, 150)}`)
        failures.push({ scenario, status, error: order })
      }
    } catch (e) {
      console.log(`${c.re}✘ Error${c.r}`)
      note(`     ${e.message}`)
      failures.push({ scenario, status: 0, error: e.message })
    }
  }

  // ── Summary report ─────────────────────────────────────────────────────────
  hr('3. Seeder Summary')
  console.log()

  if (seeded.length > 0) {
    console.log(`  ${c.b}Seeded Orders:${c.r}`)
    for (const s of seeded) {
      row(`${s.scenario.id}`, `${s.scenario.state.padEnd(26)} zone=${s.exp?.zone}`)
    }
  }

  if (failures.length > 0) {
    console.log(`\n  ${c.b}${c.re}Failures:${c.r}`)
    for (const f of failures) {
      row(`${f.scenario.id}`, `HTTP ${f.status} — ${f.scenario.description}`)
    }
  }

  console.log()
  console.log(
    `  Total: ${seeded.length + failures.length}  |  ` +
    `${c.g}✔ ${seeded.length} seeded${c.r}  |  ` +
    `${c.re}✘ ${failures.length} failed${c.r}`
  )

  if (!DRY_RUN && failures.length === 0) {
    hr('══ All interstate shipping mock orders created successfully! ══')
    console.log(`  View them in the Admin panel → Orders tab`)
    console.log(`  Or via: GET ${BASE_URL}/api/admin/orders`)
  }
  console.log()
}

run().catch(e => {
  err(`Fatal: ${e.message}`)
  process.exit(1)
})
