# Zaymazone

> A modern artisan e-commerce platform connecting buyers with local artisans — empowering creators to showcase and sell their handcrafted products online.

---

## Features

### For Shoppers
- Browse handcrafted collections (pottery, textiles, toys, jewellery, leather, woodwork)
- Filter & sort products by category, price, material, and region
- View artisan profiles with bios, stories, and product galleries
- Smooth cart and checkout flow with COD, UPI, and Razorpay support
- Real-time order tracking and email notifications

### For Artisans
- Easy seller onboarding with ID and bank verification
- Upload and manage products from a personal dashboard
- Real-time sales analytics, revenue charts, and KPI metrics
- Accept or reject individual orders with mandatory reason logging
- Automatic invoice generation for every transaction

### For Admins
- Artisan approval workflow
- Full user/order/product management panel
- Platform-wide statistics

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, Shadcn/UI |
| Backend | Node.js + Express, ES Modules |
| Database | MongoDB (Mongoose ODM) |
| Auth | Firebase Authentication |
| Payments | Razorpay, UPI, COD |
| Testing | Vitest, @testing-library/react, supertest |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Project Structure

```
Zaymazone-dev/
├── src/                      # React frontend
│   ├── components/artisan/   # Artisan dashboard UI components
│   ├── contexts/             # AuthContext (Firebase)
│   ├── lib/api.ts            # Typed HTTP client for all endpoints
│   ├── pages/                # Route-level pages
│   └── __tests__/            # Frontend test suite (45 tests)
├── server/
│   └── src/
│       ├── middleware/       # Firebase token verification, role guards
│       ├── models/           # Mongoose schemas (Order, Invoice, Artisan, …)
│       ├── routes/           # Express routers
│       ├── services/         # Business logic (dashboard, invoices, shipping)
│       └── __tests__/        # Backend test suite (71 tests)
├── docs/
│   ├── API_REFERENCE.md      # Full endpoint reference
│   ├── ARCHITECTURE.md       # System architecture & module map
│   └── PAYMENT_MODULE.md     # Razorpay / UPI integration guide
└── supabase/                 # Supabase config (image storage)
```

---

## Modules

| # | Module | Key Files |
|---|--------|-----------|
| 1 | Auth & Artisan Onboarding | `routes/auth.js`, `routes/artisans.js` |
| 2 | Artisan Dashboard & Analytics | `services/artisanDashboardService.js`, `routes/seller.js` |
| 3 | Automatic Invoice Generation | `services/invoiceService.js` |
| 4 | Seller Order Accept/Reject | `routes/seller.js` (POST `/orders/:id/accept|reject`) |
| 5 | Product Management | `routes/products.js` |
| 6 | Buyer Orders | `routes/orders.js` |
| 7 | Dashboard UI | `src/components/artisan/` |
| 8 | Payments | `routes/payments.js`, `services/paymentService.js` |
| 9 | Shipping | `services/shippingService.js` |
| 10 | Admin Panel | `routes/admin.js` |
| 11 | Testing & Documentation | `server/src/__tests__/`, `src/__tests__/`, `docs/` |

---

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- Firebase project with service account key
- npm v9+

### 1 — Clone and install

```bash
git clone https://github.com/yourusername/zaymazone.git
cd zaymazone

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

### 2 — Environment variables

Create `server/.env`:

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/zaymazone
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CORS_ORIGIN=http://localhost:8080
RESEND_API_KEY=re_xxxx           # optional: email notifications
```

Create `.env` (frontend):

```env
VITE_API_URL=http://localhost:4000
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### 3 — Start development servers

```bash
# Terminal 1 — Backend API
cd server && npm run dev

# Terminal 2 — Frontend
npm run dev
```

Frontend: `http://localhost:8080`  
Backend API: `http://localhost:4000`

---

## API Reference

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for the full endpoint reference.

Quick overview:

| Base Path | Description |
|-----------|-------------|
| `/api/auth` | Registration and sign-in |
| `/api/artisans` | Artisan profiles |
| `/api/seller/dashboard` | **Module 2** — analytics bundle |
| `/api/seller/orders/:id/accept` | **Module 4** — accept order |
| `/api/seller/orders/:id/reject` | **Module 4** — reject order |
| `/api/invoices/:orderId` | **Module 3** — invoice lookup |
| `/api/products` | Product catalogue |
| `/api/orders` | Buyer orders |
| `/api/payments` | Payment flow |
| `/api/admin` | Admin operations |

---

## Testing

The project has **116 tests** in total across backend and frontend.

```bash
# Run backend tests (71 tests)
cd server && npm test

# Run frontend tests (45 tests)
npm test

# Run with coverage
cd server && npm run test:coverage
npm run test:coverage
```

### Test files

**Backend** (`server/src/__tests__/`):
- `edge-cases.test.js` — 36 pure unit tests (helpers, validation, formatters)
- `services/artisanDashboardService.test.js` — 12 tests
- `services/invoiceService.test.js` — 10 tests
- `routes/seller.routes.test.js` — 13 integration tests (supertest)

**Frontend** (`src/__tests__/`):
- `api.helpers.test.ts` — 23 tests
- `components/AcceptOrderModal.test.tsx` — 7 tests
- `components/RejectionReasonModal.test.tsx` — 9 tests
- `components/DashboardStatsRow.test.tsx` — 6 tests

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for:
- Full system diagram
- Data model summaries
- Analytics aggregation pipeline design
- Invoice idempotency pattern
- Firebase auth flow

---

## Deployment

### Frontend (Vercel)

The `vercel.json` at the root is pre-configured. Set environment variables in the Vercel dashboard.

### Backend (Render / Railway)

1. Set all `server/.env` variables as environment secrets
2. Build command: `npm install`
3. Start command: `node src/index.js`

---

## Security

- **HTTPS** enforced in production
- **Firebase ID tokens** verified server-side on every protected request
- **Helmet** headers on all API responses
- **Zod** input validation on all route handlers
- **Rate limiting** via `express-rate-limit`
- **CORS** restricted to configured origins

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes and push
4. Open a Pull Request against `main`

Please ensure `npm test` passes in both root and `server/` before submitting.

---

## Branding

Colors: **Terracotta** (warmth) · **Forest Green** (trust) · **Beige** (simplicity)

Logo shapes: **Square** (craftsmanship) · **Circle** (community) · **Triangle** (growth)
