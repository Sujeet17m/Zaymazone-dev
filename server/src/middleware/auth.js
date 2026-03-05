import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export function requireAuth(req, res, next) {
	const header = req.headers.authorization || ''
	const token = header.startsWith('Bearer ') ? header.slice(7) : null
	if (!token) return res.status(401).json({ error: 'Unauthorized', code: 'NO_TOKEN' })
	
	try {
		const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
		req.user = payload
		return next()
	} catch (err) {
		if (err.name === 'TokenExpiredError') {
			return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' })
		}
		return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' })
	}
}

// Middleware to check if user is active
export async function requireActiveUser(req, res, next) {
	try {
		const user = await User.findById(req.user.sub).select('isActive role')
		if (!user || !user.isActive) {
			return res.status(401).json({ error: 'Account deactivated' })
		}
		req.userDoc = user
		next()
	} catch (error) {
		return res.status(500).json({ error: 'Server error' })
	}
}

// Middleware to check admin role
export async function requireAdmin(req, res, next) {
	try {
		if (!req.userDoc) {
			const user = await User.findById(req.user.sub).select('role isActive')
			if (!user || !user.isActive) {
				return res.status(401).json({ error: 'Account deactivated' })
			}
			req.userDoc = user
		}
		
		if (req.userDoc.role !== 'admin') {
			return res.status(403).json({ error: 'Admin access required' })
		}
		next()
	} catch (error) {
		return res.status(500).json({ error: 'Server error' })
	}
}

// Middleware to check artisan role
export function requireArtisan(req, res, next) {
	if (req.userDoc?.role !== 'artisan' && req.userDoc?.role !== 'admin') {
		return res.status(403).json({ error: 'Artisan access required' })
	}
	next()
}

// Optional auth - doesn't fail if no token
export function optionalAuth(req, res, next) {
	const header = req.headers.authorization || ''
	const token = header.startsWith('Bearer ') ? header.slice(7) : null
	
	if (token) {
		try {
			const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
			req.user = payload
		} catch {
			// Invalid token, but continue without auth
		}
	}
	
	next()
}


