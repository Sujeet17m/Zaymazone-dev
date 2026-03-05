// ── Module 7: production-safe error handler ──────────────────────────────────
// Only expose error details in development; log sanitised info in production.
const isProd = process.env.NODE_ENV === 'production'

export const errorHandler = (err, req, res, next) => {
	// Structured log — stack trace only in development
	if (isProd) {
		console.error('[errorHandler]', {
			name: err.name,
			message: err.message,
			code: err.code,
			path: req.path,
			method: req.method,
			timestamp: new Date().toISOString(),
		})
	} else {
		console.error('Error:', err)
	}

	// Mongoose validation error
	if (err.name === 'ValidationError') {
		const errors = Object.values(err.errors).map(error => ({
			field: error.path,
			message: error.message
		}))
		return res.status(400).json({
			error: 'Validation failed',
			details: errors
		})
	}
	
	// Mongoose cast error (invalid ObjectId)
	if (err.name === 'CastError') {
		return res.status(400).json({
			error: 'Invalid ID format'
		})
	}
	
	// MongoDB duplicate key error
	if (err.code === 11000) {
		const field = Object.keys(err.keyValue)[0]
		return res.status(409).json({
			error: `${field} already exists`
		})
	}
	
	// JWT errors
	if (err.name === 'JsonWebTokenError') {
		return res.status(401).json({
			error: 'Invalid token',
			code: 'INVALID_TOKEN'
		})
	}
	
	if (err.name === 'TokenExpiredError') {
		return res.status(401).json({
			error: 'Token expired',
			code: 'TOKEN_EXPIRED'
		})
	}
	
	// Default server error
	res.status(500).json({
		error: 'Internal server error',
		...(process.env.NODE_ENV === 'development' && { details: err.message })
	})
}

// 404 handler — only applied to /api/* paths.
// Frontend SPA routes are handled by the client-side router; they must never
// receive a 404 from the API server.  Non-API paths that reach this middleware
// (e.g. direct asset requests in production) receive a user-friendly message.
export const notFoundHandler = (req, res) => {
	if (req.path.startsWith('/api/')) {
		return res.status(404).json({
			error: 'API endpoint not found',
			code: 'ROUTE_NOT_FOUND',
			path: req.path,
			method: req.method,
			availableAt: 'GET / for a list of all endpoints'
		})
	}
	// For non-API paths return a minimal 404 — in production the reverse-proxy
	// should serve index.html for all SPA routes before requests hit Express.
	return res.status(404).json({
		error: 'Not found',
		code: 'NOT_FOUND',
		path: req.path
	})
}

// Request logging middleware
export const requestLogger = (req, res, next) => {
	const start = Date.now()
	
	res.on('finish', () => {
		const duration = Date.now() - start
		const log = {
			method: req.method,
			url: req.url,
			status: res.statusCode,
			duration: `${duration}ms`,
			userAgent: req.get('User-Agent'),
			ip: req.ip || req.connection.remoteAddress,
			timestamp: new Date().toISOString()
		}
		
		// Log to console (in production, you might want to use a proper logger)
		if (res.statusCode >= 400) {
			console.error('HTTP Error:', log)
		} else {
			console.log('HTTP Request:', log)
		}
	})
	
	next()
}