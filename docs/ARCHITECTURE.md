# Zaymazone — System Architecture

## Overview

Zaymazone is a full-stack artisan e-commerce platform built with:

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, Shadcn/UI
- **Backend**: Node.js + Express, ES Modules, Zod validation
- **Database**: MongoDB (Mongoose ODM)
- **Auth**: Firebase Authentication (ID tokens verified server-side)
- **Payments**: Razorpay / UPI / COD
- **Deployment**: Vercel (frontend) + Render (backend)

---

## Module Catalogue

| Module | Name | Description |
|--------|------|-------------|
| 1 | Auth & Onboarding | Firebase auth, artisan registration, ID/bank verification |
| 2 | Artisan Dashboard & Analytics | Real-time KPIs, revenue, performance metrics, order counts |
| 3 | Invoice Generation | Automatic idempotent billing: sale, cancellation, rejection notes |
| 4 | Seller Order Actions | Accept / reject orders with validation and email notifications |
| 5 | Product Management | CRUD for artisan products, image upload, stock tracking |
| 6 | Buyer Orders | Place orders, track status, cancel, view history |
| 7 | Dashboard UI | React component layer for Module 2 analytics |
| 8 | Payments | Razorpay integration, UPI, COD, signature verification |
| 9 | Shipping | Zone-based shipping calculator, courier suggestions |
| 10 | Admin Panel | Artisan approvals, user management, platform stats |
| 11 | Testing & Documentation | Vitest test suite, API reference, architecture docs |

---

## Folder Structure

```
Zaymazone-dev/
├── src/                        ← React frontend (Vite + TypeScript)
│   ├── components/
│   │   ├── artisan/            ← Dashboard UI components (Module 7)
│   │   │   ├── AcceptOrderModal.tsx
│   │   │   ├── RejectionReasonModal.tsx
│   │   │   ├── DashboardStatsRow.tsx
│   │   │   └── ArtisanAnalyticsCharts.tsx
│   │   └── ui/                 ← Shadcn/UI primitives
│   ├── contexts/               ← AuthContext (Firebase user state)
│   ├── hooks/                  ← Custom React hooks
│   ├── lib/
│   │   ├── api.ts              ← Typed API client (all HTTP calls)
│   │   └── security.ts         ← Client-side security helpers
│   ├── pages/                  ← Route-level page components
│   │   ├── ArtisanDashboard.tsx
│   │   ├── ArtisanOrders.tsx
│   │   └── ...
│   └── __tests__/              ← Frontend Vitest test suite
│       ├── setup.ts
│       ├── api.helpers.test.ts
│       └── components/
├── server/                     ← Express API (Node.js + ES Modules)
│   └── src/
│       ├── middleware/
│       │   ├── firebase-auth.js  ← Token verification
│       │   └── auth.js           ← Role guard helpers
│       ├── models/               ← Mongoose schemas
│       │   ├── Order.js
│       │   ├── Invoice.js
│       │   ├── Artisan.js
│       │   ├── Product.js
│       │   └── User.js
│       ├── routes/               ← Express routers (one per domain)
│       │   ├── seller.js         ← Module 2 + 4 endpoints
│       │   ├── orders.js         ← Module 6 endpoints
│       │   └── ...
│       ├── services/             ← Business logic layer
│       │   ├── artisanDashboardService.js   ← Module 2
│       │   ├── invoiceService.js            ← Module 3
│       │   ├── shippingService.js           ← Module 9
│       │   ├── emailService.js
│       │   └── cancellationFeeService.js
│       └── __tests__/            ← Backend Vitest test suite
│           ├── edge-cases.test.js
│           ├── services/
│           │   ├── artisanDashboardService.test.js
│           │   └── invoiceService.test.js
│           └── routes/
│               └── seller.routes.test.js
└── docs/
    ├── API_REFERENCE.md
    ├── ARCHITECTURE.md          ← this file
    └── PAYMENT_MODULE.md
```

---

## Request / Response Lifecycle

```
Browser (React)
    │
    │ HTTP + Firebase ID Token
    ▼
Express (server/src/index.js)
    │
    ├── Helmet, CORS, Rate Limiting, Body Parser
    │
    ├── authenticateToken (firebase-auth.js)
    │       └── Verifies Firebase ID token → attaches req.user
    │
    ├── Router (e.g., seller.js)
    │       └── Artisan.findOne({ userId: req.user._id })
    │               └── 404 if artisan not found / not approved
    │
    └── Service Layer
            ├── artisanDashboardService.js
            │       └── MongoDB aggregation pipelines
            ├── invoiceService.js
            │       └── Invoice.create / Invoice.findOne (idempotent)
            └── emailService.js
                    └── Resend API (fire-and-forget)
```

---

## Data Models

### Order
```
_id, orderNumber, userId, status, items[], total, shippingAddress,
paymentMethod, paymentStatus, statusHistory[], createdAt
```

Key `status` values: `placed → confirmed → shipped → out_for_delivery → delivered`  
Terminal states: `cancelled`, `rejected`, `returned`, `refunded`

### Invoice
```
_id, invoiceNumber, type (sale|cancellation_note|rejection_note),
status (issued|credited|void), orderId, userId, grandTotal,
lineItems[], buyerSnapshot, itemSnapshots, issuedAt
```

### Artisan
```
_id, userId, storeName, isApproved, verificationStatus,
bankDetails, products[], createdAt
```

### Product
```
_id, artisanId, name, price, stock, category, images[], rating, reviewCount
```

---

## Analytics Architecture (Module 2)

`artisanDashboardService.js` runs MongoDB aggregation pipelines entirely server-side, keeping the frontend thin:

```
getDashboardBundle(artisanId, period)
    │
    └── Promise.all([
          getOrderCounts(),       — $group by status + countDocuments for today
          getRevenueSummary(),    — 4x $match/$group for allTime/current/prev/pending
          getPerformanceMetrics() — 5x $aggregate (status, avgValue, handling, ratings, topProducts)
          getRevenueTrend(),      — daily/weekly $dateToString + $group
          Order.find().sort().lean()   — 5 recent orders
          Product.find().where('stock').lte(5)  — low stock alerts
        ])
```

All artisan-scoped queries use `{ 'items.artisanId': oid }` to efficiently filter within multi-artisan orders.

---

## Invoice Idempotency (Module 3)

Each generation function checks for an existing document **before** creating:

```js
const existing = await Invoice.findOne({ orderId, type })
if (existing) return existing          // idempotent — return existing
const note = await Invoice.create({…}) // create only if missing
```

This ensures safe re-calls from retry queues, webhooks, or admin regeneration.

---

## Authentication Flow

```
1. User signs in via Firebase (browser SDK)
2. Frontend gets ID token: firebase.auth().currentUser.getIdToken()
3. All API calls include: Authorization: Bearer <id_token>
4. authenticateToken middleware on Express:
     a. Verifies token with firebase-admin SDK
     b. Looks up MongoDB User by firebaseUid
     c. Attaches req.user = { _id, uid, email, role }
5. Artisan routes additionally call:
     Artisan.findOne({ userId: req.user._id })
     → 404 if not found
```

---

## Testing Strategy (Module 11)

### Backend (`server/src/__tests__/`)

| File | Pattern | Tests |
|------|---------|-------|
| `edge-cases.test.js` | Pure unit — no mocks | 36 |
| `services/artisanDashboardService.test.js` | Unit with mocked Mongoose models | 12 |
| `services/invoiceService.test.js` | Unit with mocked Invoice + shippingService | 10 |
| `routes/seller.routes.test.js` | Integration via supertest | 13 |

**Total backend**: 71 tests

### Frontend (`src/__tests__/`)

| File | Pattern | Tests |
|------|---------|-------|
| `api.helpers.test.ts` | Type/format utilities | 23 |
| `components/AcceptOrderModal.test.tsx` | React Testing Library | 7 |
| `components/RejectionReasonModal.test.tsx` | React Testing Library | 9 |
| `components/DashboardStatsRow.test.tsx` | React Testing Library | 6 |

**Total frontend**: 45 tests  
**Grand total**: **116 tests**

### Running Tests

```bash
# Backend
cd server && npm test

# Frontend
npm test

# With coverage
cd server && npm run test:coverage
npm run test:coverage
```
