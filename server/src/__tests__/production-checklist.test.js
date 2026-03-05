/**
 * production-checklist.test.js
 *
 * Module 15 — Automated production readiness checks.
 *
 * These tests verify static properties of the codebase (source file contents,
 * env documentation) rather than runtime behaviour, so they never need a
 * running process or real DB connection.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = resolve(__dirname, '../../..')  // repo root: Zaymazone-dev/
const SERVER    = resolve(ROOT, 'server')

function readSource(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8')
}

// ── 1. .env.example completeness ─────────────────────────────────────────────

describe('.env.example completeness', () => {
  const envExample = readSource('server/.env.example')

  const REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'FIREBASE_PROJECT_ID']
  const IMPORTANT = ['PORT', 'NODE_ENV', 'RAZORPAY_KEY_ID', 'ADMIN_SECRET', 'SEED_SECRET']

  for (const v of REQUIRED) {
    it(`documents required var: ${v}`, () => {
      expect(envExample).toContain(v)
    })
  }

  for (const v of IMPORTANT) {
    it(`documents important var: ${v}`, () => {
      expect(envExample).toContain(v)
    })
  }

  it('is not empty (was previously an empty file)', () => {
    expect(envExample.trim().length).toBeGreaterThan(100)
  })
})

// ── 2. REQUIRED_ENV_VARS consistency ─────────────────────────────────────────

describe('REQUIRED_ENV_VARS in index.js match .env.example', () => {
  it('all vars listed in REQUIRED_ENV_VARS are documented in .env.example', () => {
    const indexJs    = readSource('server/src/index.js')
    const envExample = readSource('server/.env.example')

    // Extract the array contents of REQUIRED_ENV_VARS = [...]
    const match = indexJs.match(/REQUIRED_ENV_VARS\s*=\s*\[([^\]]+)\]/)
    expect(match, 'REQUIRED_ENV_VARS array not found in index.js').not.toBeNull()

    const vars = match[1].match(/'([^']+)'/g).map(s => s.replace(/'/g, ''))
    expect(vars.length).toBeGreaterThan(0)

    for (const v of vars) {
      expect(envExample, `${v} missing from .env.example`).toContain(v)
    }
  })
})

// ── 3. Security hardening ─────────────────────────────────────────────────────

describe('Security hardening in server/src/index.js', () => {
  const indexJs = readSource('server/src/index.js')

  it('global rate limiter has standardHeaders: true', () => {
    expect(indexJs).toContain('standardHeaders: true')
  })

  it('global rate limiter has legacyHeaders: false', () => {
    expect(indexJs).toContain('legacyHeaders: false')
  })

  it('seed endpoint is guarded by SEED_SECRET check', () => {
    expect(indexJs).toContain('SEED_SECRET')
  })

  it('validateEnv() is called at startup', () => {
    expect(indexJs).toContain('validateEnv()')
  })
})

// ── 4. Health endpoint quality ────────────────────────────────────────────────

describe('/health endpoint in server/src/index.js', () => {
  const indexJs = readSource('server/src/index.js')

  it('returns db status field', () => {
    expect(indexJs).toContain("db:")
  })

  it('returns uptime field', () => {
    expect(indexJs).toContain('uptime')
  })

  it('returns a 503 when the DB is not connected', () => {
    // Verify the unhealthy path returns 503 not 200
    expect(indexJs).toContain('503')
  })
})

// ── 5. Error handler sanitizes stack traces in production ─────────────────────

describe('errorHandler.js production log sanitization', () => {
  const errorHandler = readSource('server/src/middleware/errorHandler.js')

  it('has an isProd guard', () => {
    expect(errorHandler).toContain('isProd')
  })

  it('references production environment', () => {
    expect(errorHandler).toContain("'production'")
  })
})

// ── 6. No hardcoded secrets (basic static scan) ───────────────────────────────

describe('No hardcoded secrets in source files', () => {
  const patterns = [
    { label: 'hardcoded Razorpay test key',  re: /rzp_test_[A-Za-z0-9]{14,}/  },
    { label: 'hardcoded MongoDB Atlas URI',  re: /mongodb\+srv:\/\/[^"'\s]+:[^"'\s]+@/ },
  ]

  const sourceFiles = [
    'server/src/index.js',
    'server/src/routes/orders.js',
    'server/src/routes/onboarding.js',
    'server/src/routes/seller.js',
  ]

  for (const { label, re } of patterns) {
    it(`no ${label} in source files`, () => {
      for (const path of sourceFiles) {
        const source = readSource(path)
        expect(source, `found ${label} in ${path}`).not.toMatch(re)
      }
    })
  }
})

// ── 7. Critical files exist ───────────────────────────────────────────────────

describe('Critical file existence', () => {
  const requiredFiles = [
    'server/.env.example',
    'server/src/index.js',
    'server/src/middleware/errorHandler.js',
    'server/src/middleware/firebase-auth.js',
    'server/src/routes/onboarding.js',
    'server/src/routes/orders.js',
    'server/src/models/Artisan.js',
    'server/src/models/User.js',
    'server/src/models/Order.js',
    'server/src/models/UpiPayment.js',
  ]

  for (const f of requiredFiles) {
    it(`exists: ${f}`, () => {
      expect(existsSync(resolve(ROOT, f)), `Missing: ${f}`).toBe(true)
    })
  }
})

// ── 8. UpiPayment model — no duplicate indexes ────────────────────────────────

describe('UpiPayment.js mongoose index hygiene', () => {
  const upiPayment = readSource('server/src/models/UpiPayment.js')

  it('does not have both field-level and schema.index() for "utr"', () => {
    // We should have schema.index({utr:1}) but NOT "utr: { ..., index: true }" AND schema.index
    const fieldLevelUtr   = /utr:\s*\{[^}]*index:\s*true/s.test(upiPayment)
    const schemaIndexUtr  = /schema\.index\(\s*\{\s*utr/.test(upiPayment)

    // After fix: field-level index gone, schema.index remains
    if (schemaIndexUtr) {
      expect(fieldLevelUtr).toBe(false)
    }
  })

  it('does not have both field-level and schema.index() for "expiresAt"', () => {
    const fieldLevelExpires  = /expiresAt:\s*\{[^}]*index:\s*true/s.test(upiPayment)
    const schemaIndexExpires = /schema\.index\(\s*\{\s*expiresAt/.test(upiPayment)

    if (schemaIndexExpires) {
      expect(fieldLevelExpires).toBe(false)
    }
  })
})
