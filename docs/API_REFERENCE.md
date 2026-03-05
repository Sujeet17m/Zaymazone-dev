# Zaymazone API Reference

Complete reference for all backend REST endpoints. The base URL is configurable via `VITE_API_URL` (default `http://localhost:4000`).

---

## Authentication

Most endpoints require a **Firebase ID token** sent in the `Authorization` header:

```
Authorization: Bearer <firebase_id_token>
```

Routes marked `Auth` require any authenticated user. Routes marked `Artisan` additionally require an approved artisan profile.

---

## Module 1 — Auth & Artisan Onboarding

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | — | Register a new buyer account |
| POST | `/api/auth/signin` | — | Sign in and receive a JWT |
| POST | `/api/firebase-auth/sync` | Auth | Sync Firebase user with MongoDB |
| PATCH | `/api/firebase-auth/profile` | Auth | Update profile (name, phone, avatar) |
| POST | `/api/artisans` | Auth | Submit artisan onboarding application |
| GET | `/api/artisans/:id` | — | Get public artisan profile |
| GET | `/api/artisans` | — | List approved artisans (paginated) |
| PUT | `/api/artisans/:id` | Auth | Update artisan profile |

---

## Module 2 — Artisan Dashboard & Analytics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/seller/dashboard` | Artisan | Full dashboard bundle (counts + revenue + performance + trend + recent orders + low stock) |
| GET | `/api/seller/orders/counts` | Artisan | Order status counts for the authenticated artisan |
| GET | `/api/seller/analytics/revenue` | Artisan | Revenue summary for a given period |
| GET | `/api/seller/analytics/revenue/trend` | Artisan | Daily/weekly revenue trend points |
| GET | `/api/seller/analytics/performance` | Artisan | KPI metrics (fulfillment rate, avg rating, top products, etc.) |

### Query Parameters

**`GET /api/seller/dashboard`**  
| Parameter | Type | Values | Default |
|-----------|------|--------|---------|
| `period` | string | `7days`, `30days`, `90days`, `1year` | `30days` |

**`GET /api/seller/analytics/revenue`**  
Same `period` parameter as above.

**`GET /api/seller/analytics/revenue/trend`**  
Same `period` parameter; groups by day (`7days`/`30days`) or week (`90days`/`1year`).

### Response: Dashboard Bundle

```json
{
  "orderCounts": {
    "total": 42, "pending": 3, "delivered": 35,
    "cancelled": 2, "rejected": 1, "returned": 1,
    "newToday": 2, "byStatus": { "placed": 2, "confirmed": 1 }
  },
  "revenue": {
    "allTime": 125000, "current": 18000, "previous": 15000,
    "pending": 2500, "growthPct": 20.0, "period": "30days"
  },
  "performance": {
    "fulfillmentRate": 89.5, "cancellationRate": 4.8, "avgRating": 4.6,
    "topProducts": [ { "productName": "Terracotta Vase", "totalRevenue": 12500 } ]
  },
  "trend": [ { "date": "2026-02-01", "revenue": 1200, "orderCount": 3 } ],
  "recentOrders": [],
  "lowStockProducts": [],
  "generatedAt": "2026-02-26T10:00:00.000Z"
}
```

---

## Module 3 — Invoice Generation

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/invoices/:orderId` | Auth | Get all invoices for an order (newest first) |
| GET | `/api/invoices/doc/:invoiceId` | Auth | Get a single invoice document |
| POST | `/api/invoices/:orderId/regenerate` | Admin | Void & re-generate the sale invoice |
| POST | `/api/invoices/:invoiceId/void` | Admin | Mark an invoice as void |

Invoices are generated **automatically** (fire-and-forget) when:
- An order is placed → `sale` invoice
- An order is cancelled → `cancellation_note` credit note
- A seller rejects an order → `rejection_note` credit note

All generation is **idempotent**; calling again for the same event returns the existing document.

---

## Module 4 — Seller Order Actions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/seller/orders/:id/accept` | Artisan | Accept a `placed` order |
| POST | `/api/seller/orders/:id/reject` | Artisan | Reject with a mandatory reason |

### POST `/api/seller/orders/:id/accept`

**Request Body (optional)**
```json
{ "note": "Will dispatch within 2 business days" }
```

**Success Response** `200`
```json
{ "message": "Order accepted", "order": { "_id": "...", "status": "confirmed" } }
```

**Errors**
- `404` — Order not found or does not belong to this artisan
- `400` — Order is not in `placed` status

### POST `/api/seller/orders/:id/reject`

**Request Body**
```json
{
  "reason": "Product is currently out of stock due to high seasonal demand.",
  "category": "out_of_stock"
}
```

**Validation**: `reason` is required and must be ≥ 10 characters.

**Success Response** `200`
```json
{ "message": "Order rejected", "order": { "_id": "...", "status": "rejected" } }
```

**Errors**
- `400` — Missing or too-short reason
- `404` — Order not found

---

## Module 5 — Products

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | — | List all products (filters: `category`, `minPrice`, `maxPrice`, `artisanId`, `q`) |
| GET | `/api/products/:id` | — | Get a single product |
| POST | `/api/products` | Artisan | Create a product |
| PUT | `/api/products/:id` | Artisan | Update a product |
| DELETE | `/api/products/:id` | Artisan | Delete a product |

---

## Module 6 — Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | Auth | Place a new order |
| GET | `/api/orders/my-orders` | Auth | Buyer's order history |
| GET | `/api/orders/:id` | Auth | Get a single order |
| PATCH | `/api/orders/:id/cancel` | Auth | Cancel an order |

---

## Module 7 — Artisan Dashboard UI

No direct API endpoints — the UI consumes Module 2 endpoints. See [ARCHITECTURE.md](ARCHITECTURE.md) for the frontend data flow.

---

## Module 8 — Payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/payments/create-order` | Auth | Create a Razorpay/UPI payment order |
| POST | `/api/payments/verify` | Auth | Verify payment signature after checkout |
| GET | `/api/payments/order/:orderId/status` | Auth | Poll current payment status |

---

## Module 9 — Shipping

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/shipping/calculate` | — | Calculate shipping cost for cart + address |
| GET | `/api/shipping/zones` | — | List available shipping zones with labels |

---

## Module 10 — Admin Panel

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/artisans` | Admin | List all artisan applications |
| PATCH | `/api/admin/artisans/:id/approve` | Admin | Approve an artisan profile |
| PATCH | `/api/admin/artisans/:id/reject` | Admin | Reject an artisan application |
| GET | `/api/admin/users` | Admin | List all users |
| GET | `/api/admin/orders` | Admin | List all orders |
| GET | `/api/admin/stats` | Admin | Platform-wide statistics |

---

## Error Response Format

All error responses follow this shape:

```json
{
  "error": "Human-readable message",
  "details": "Optional technical detail"
}
```

Common HTTP status codes:
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Missing or invalid token |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate entry) |
| 500 | Internal server error |
