import { authenticateToken } from './firebase-auth.js'

/**
 * Middleware to ensure only admin users can access protected routes
 * Must be used after authenticateToken middleware
 */
export const requireAdmin = async (req, res, next) => {
    try {
        // If user is not already authenticated, authenticate first
        if (!req.user) {
            await new Promise((resolve, reject) => {
                authenticateToken(req, res, (err) => {
                    if (err) reject(err)
                    else resolve()
                })
            })
        }

        // Check if user exists after authentication
        if (!req.user) {
            console.log('Admin auth - No user found in request')
            return res.status(401).json({ error: 'Authentication required' })
        }

        // Check admin status (either role === 'admin' or isAdmin virtual)
        const isAdmin = req.user.role === 'admin' || req.user.isAdmin === true

        if (!isAdmin) {
            console.log('Admin auth - Access denied for user:', req.user._id, 'role:', req.user.role)
            return res.status(403).json({
                error: 'Access denied. Admin privileges required.',
                code: 'ADMIN_REQUIRED'
            })
        }

        console.log('Admin auth - Access granted for admin:', req.user._id)
        next()

    } catch (error) {
        console.error('Admin authentication error:', error)
        return res.status(500).json({
            error: 'Authentication failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}

/**
 * Alternative middleware that can be used directly (includes authentication)
 */
export const adminOnly = [authenticateToken, requireAdmin]

export default requireAdmin
