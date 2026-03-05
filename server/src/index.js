// ── Module 7: startup env-var validation ────────────────────────────────────
// Crash early with a clear message rather than a cryptic runtime error.
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env before everything else
dotenv.config({ path: join(__dirname, '../.env') })

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'

const REQUIRED_ENV_VARS = [
	'MONGODB_URI',
	'JWT_SECRET',
	'FIREBASE_PROJECT_ID',
]
const OPTIONAL_ENV_VARS = [
	'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET',
	'UPI_MERCHANT_ID', 'UPI_MERCHANT_NAME', 'UPI_VPA',
	'EMAIL_USER', 'EMAIL_PASS',
]

function validateEnv() {
	const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k])
	if (missing.length) {
		console.error('❌ FATAL: Missing required environment variables:', missing.join(', '))
		console.error('   Copy .env.example to .env and fill in the values before starting.')
		process.exit(1)
	}
	const missingOptional = OPTIONAL_ENV_VARS.filter((k) => !process.env[k])
	if (missingOptional.length) {
		console.warn('⚠️  Optional env vars not set (some features disabled):', missingOptional.join(', '))
	}
}

validateEnv()

import authRouter from './routes/auth.js'
import firebaseAuthRouter from './routes/firebase-auth.js'
import productsRouter from './routes/products.js'
import artisansRouter from './routes/artisans.js'
import blogRouter from './routes/blog.js'
import ordersRouter from './routes/orders.js'
import paymentsRouter from './routes/payments.js'
import paytmPaymentsRouter from './routes/paytmPayments.js'
import upiPaymentsRouter from './routes/upiPayments.js'
import cartRouter from './routes/cart.js'
import reviewsRouter from './routes/reviews.js'
import wishlistRouter from './routes/wishlist.js'
import addressesRouter from './routes/addresses.js'
import imagesRouter from './routes/images.js'
import usersRouter from './routes/users.js'
import verifyRouter from './routes/verify.js'
import sellerOnboardingRouter from './routes/seller-onboarding.js'
import onboardingRouter from './routes/onboarding.js'
import adminApprovalsRouter from './routes/admin-approvals.js'
import codRouter from './routes/cod.js'
import shippingRouter from './routes/shipping.js'
import settlementRouter from './routes/settlement.js'
import emailQueueRouter from './routes/emailQueue.js'
import documentVerificationRouter from './routes/documentVerification.js'
import orderAlertsRouter from './routes/orderAlerts.js'
import { errorHandler, notFoundHandler, requestLogger } from './middleware/errorHandler.js'
import { sanitize } from './middleware/validation.js'
import { initGridFS } from './services/imageService.js'
import emailService from './services/emailService.js'
import { uploadImageToGridFS } from './services/imageService.js'
import fs from 'fs'

const app = express()

// Trust proxy for rate limiting
app.set('trust proxy', 1)

// Security & parsing
// Disable cross-origin resource policy to allow images to be loaded from other origins
// Disable default cross-origin policies to allow images to be loaded from any origin
app.use(helmet({
	contentSecurityPolicy: false,
	crossOriginResourcePolicy: false,
	crossOriginEmbedderPolicy: false,
	crossOriginOpenerPolicy: false,
}))

// More permissive CORS for development and production
const allowedOrigins = [
	'http://localhost:8080',
	'http://localhost:8081',
	'http://127.0.0.1:8080',
	'http://127.0.0.1:8081',
	'http://localhost:5173',
	'https://zaymazone.com',
	'https://www.zaymazone.com',
	'https://zaymazone-dev.netlify.app',
	'https://zaymazone.netlify.app',
	'https://zaymazone-taupe.vercel.app',
	'https://zaymazone-backend.onrender.com',
	'https://zaymazone-test.vercel.app'
]

app.use(cors({
	origin: function (origin, callback) {
		// Allow requests with no origin (like mobile apps or curl requests)
		if (!origin) return callback(null, true)

		const isAllowed =
			allowedOrigins.indexOf(origin) !== -1 ||
			origin.includes('github.dev') ||
			origin.endsWith('.vercel.app') ||
			origin.endsWith('.netlify.app')
		if (isAllowed) {
			callback(null, true)
		} else {
			console.log('CORS blocked for origin:', origin)
			callback(new Error('Not allowed by CORS'))
		}
	},
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
	optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}))

app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ extended: true, limit: '20mb' }))
app.use(morgan('combined'))
app.use(requestLogger)
app.use(sanitize)

// Global rate limit
app.use(rateLimit({
	windowMs: 60 * 1000,
	max: 120,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests, please slow down.' },
}))

// Health
app.get('/', (_req, res) => res.json({
	name: 'Zaymazone API',
	version: '1.0.0',
	status: 'ok',
	endpoints: {
		health: 'GET /health',
		auth: ['POST /api/auth/signup', 'POST /api/auth/signin'],
		products: ['GET /api/products', 'GET /api/products/:id', 'POST /api/products', 'PUT /api/products/:id', 'DELETE /api/products/:id'],
		artisans: ['GET /api/artisans', 'GET /api/artisans/:id', 'POST /api/artisans', 'PUT /api/artisans/:id', 'DELETE /api/artisans/:id'],
		orders: ['GET /api/orders/my-orders', 'GET /api/orders/:id', 'POST /api/orders', 'PATCH /api/orders/:id/cancel'],
		payments: ['POST /api/payments/create-order', 'POST /api/payments/verify', 'POST /api/payments/webhook', 'POST /api/payments/refund', 'GET /api/payments/methods'],
		cart: ['GET /api/cart', 'POST /api/cart/add', 'PATCH /api/cart/item/:productId', 'DELETE /api/cart/item/:productId'],
		reviews: ['GET /api/reviews/product/:productId', 'GET /api/reviews/my-reviews', 'POST /api/reviews', 'PATCH /api/reviews/:id'],
		wishlist: ['GET /api/wishlist', 'POST /api/wishlist/add', 'DELETE /api/wishlist/item/:productId', 'DELETE /api/wishlist/clear'],
		images: ['GET /api/images/:filename', 'GET /api/images/:filename/info'],
		verify: ['GET /api/verify/bank-account', 'POST /api/verify/bank-account'],
		sellerOnboarding: ['POST /api/seller-onboarding']
	}
}))
// Health — Module 7: full readiness probe
app.get('/health', async (_req, res) => {
	const dbState = mongoose.connection.readyState
	// 0=disconnected 1=connected 2=connecting 3=disconnecting
	const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown'
	const missingEnv = REQUIRED_ENV_VARS.filter((k) => !process.env[k])
	const healthy = dbState === 1 && missingEnv.length === 0
	res.status(healthy ? 200 : 503).json({
		ok: healthy,
		timestamp: new Date().toISOString(),
		uptime: Math.floor(process.uptime()),
		db: { status: dbStatus },
		env: { missing: missingEnv },
		version: process.env.npm_package_version || '1.0.0',
	})
})

// Database seeding endpoint
// Module 7: guarded by SEED_SECRET env var — callers must pass ?secret=<SEED_SECRET>
// In production set SEED_SECRET to a strong random value; leave it unset to disable entirely.
app.post('/api/seed', async (req, res) => {
	const secret = process.env.SEED_SECRET
	if (!secret) {
		return res.status(403).json({ error: 'Seeding disabled. Set SEED_SECRET env var to enable.' })
	}
	if (req.query.secret !== secret && req.headers['x-seed-secret'] !== secret) {
		return res.status(403).json({ error: 'Invalid seed secret.' })
	}
	try {
		console.log('🌱 Starting database seeding via API...')
		const { seedDatabase } = await import('../scripts/seed.js')
		await seedDatabase()
		res.json({ message: 'Database seeded successfully' })
	} catch (error) {
		console.error('Error seeding database:', error)
		res.status(500).json({ error: 'Failed to seed database' })
	}
})

// Routes
app.use('/api/auth', authRouter)
app.use('/api/firebase-auth', firebaseAuthRouter)
app.use('/api/products', productsRouter)
app.use('/api/artisans', artisansRouter)
app.use('/api/blog', blogRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/payments/paytm', paytmPaymentsRouter)
app.use('/api/upi-payments', upiPaymentsRouter)
app.use('/api/cart', cartRouter)
app.use('/api/reviews', reviewsRouter)
app.use('/api/wishlist', wishlistRouter)
app.use('/api/addresses', addressesRouter)
app.use('/api/images', imagesRouter)
app.use('/api/users', usersRouter)
app.use('/api/verify', verifyRouter)
app.use('/api/seller-onboarding', sellerOnboardingRouter)
app.use('/api/onboarding', onboardingRouter)
app.use('/api/admin-approvals', adminApprovalsRouter)
app.use('/api/cod', codRouter)
app.use('/api/shipping', shippingRouter)
app.use('/api/settlements', settlementRouter)

// Import and use admin routes
import adminRouter from './routes/admin.js'
import sellerRouter from './routes/seller.js'
import invoicesRouter from './routes/invoices.js'
import messagesRouter from './routes/messages.js'
app.use('/api/admin', adminRouter)
app.use('/api/admin/email-queue', emailQueueRouter)
app.use('/api/document-verification', documentVerificationRouter)
app.use('/api/seller', sellerRouter)
app.use('/api/invoices', invoicesRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/order-alerts', orderAlertsRouter)

// Serve uploaded files statically
app.use('/uploads', express.static(join(process.cwd(), 'uploads')))

// All assets are now served from database via /api/images/ endpoint
// Removed static asset serving middleware

// Error handling middleware (must be last)
app.use(notFoundHandler)
app.use(errorHandler)

// DB and server
const mongoUri = process.env.MONGODB_URI
const port = process.env.PORT || 4000

// Upload team images on startup
async function uploadTeamImagesOnStartup() {
	try {
		const teamImages = ['team1.jpg', 'team2.png', 'team3.jpg']
		const assetDir = join(process.cwd(), '../src/assets')

		console.log('Checking for team images to upload...')

		for (const imageName of teamImages) {
			const imagePath = join(assetDir, imageName)

			if (fs.existsSync(imagePath)) {
				try {
					await uploadImageToGridFS(imagePath, imageName, 'team')
					console.log(`✅ Uploaded team image: ${imageName}`)
				} catch (error) {
					// Image might already exist, that's ok
					console.log(`ℹ️  Team image ${imageName} may already exist`)
				}
			} else {
				console.log(`⚠️  Team image not found: ${imagePath}`)
			}
		}
	} catch (error) {
		console.error('Error uploading team images:', error)
	}
}

async function start() {
	try {
		console.log('🔌 Connecting to MongoDB...');
		try {
			await mongoose.connect(mongoUri)
			console.log('✅ Connected to MongoDB');

			initGridFS() // Initialize GridFS after database connection
			console.log('✅ GridFS initialized');

			// Start email queue worker (polls MongoDB queue, retries on failure)
			emailService.startQueueWorker()
			console.log('✅ Email queue worker started');

			// Upload team images if they exist
			await uploadTeamImagesOnStartup()
			console.log('✅ Team images checked');
		} catch (dbError) {
			console.warn('⚠️  MongoDB connection failed:', dbError.message)
			console.warn('⚠️  Server will continue without database features')
		}

		app.listen(port, '0.0.0.0', () => {
			console.log(`🚀 API listening on http://localhost:${port}`)
			console.log(`📡 Server started successfully at ${new Date().toISOString()}`)
		}).on('error', (err) => {
			console.error('❌ Server failed to start:', err)
			process.exit(1)
		})
	} catch (error) {
		console.error('❌ Failed to start server:', error)
		process.exit(1)
	}
}

start().catch((err) => {
	console.error('Failed to start server', err)
	process.exit(1)
})


