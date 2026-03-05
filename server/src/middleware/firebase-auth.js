import jwt from 'jsonwebtoken';
import { verifyFirebaseToken } from '../lib/firebase-admin.js';
import User from '../models/User.js';
import Artisan from '../models/Artisan.js';

// Middleware to authenticate requests with Firebase tokens or JWT tokens
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    console.log('Auth middleware - Authorization header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth middleware - No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    console.log('Auth middleware - Token extracted:', token ? `Present (${token.substring(0, 20)}...)` : 'Missing');

    // Try Firebase token first (preferred method)
    try {
      console.log('Auth middleware - Trying Firebase token verification...');
      const firebaseUser = await verifyFirebaseToken(token);
      console.log('Auth middleware - Firebase user verified:', firebaseUser.uid);

      // Find user by Firebase UID first
      let user = await User.findOne({ firebaseUid: firebaseUser.uid });

      // If not found by UID, try to find by email (for existing users created before Firebase)
      if (!user) {
        console.log('Auth middleware - User not found by UID, checking email:', firebaseUser.email);
        user = await User.findOne({ email: firebaseUser.email });

        if (user) {
          // Update existing user with Firebase UID
          console.log('Auth middleware - Found existing user by email, updating with Firebase UID');
          user.firebaseUid = firebaseUser.uid;
          user.authProvider = 'firebase';
          user.isEmailVerified = firebaseUser.emailVerified || user.isEmailVerified;
          user.lastLogin = new Date();
          await user.save();
          console.log('Auth middleware - Existing user updated with Firebase UID:', user._id);
        }
      }

      if (!user) {
        console.log('Auth middleware - Creating new user for Firebase UID:', firebaseUser.uid);
        // Create new user from Firebase data
        user = new User({
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.name || firebaseUser.email.split('@')[0],
          avatar: firebaseUser.picture || '',
          authProvider: 'firebase',
          isEmailVerified: firebaseUser.emailVerified || false,
          lastLogin: new Date()
        });
        await user.save();
        console.log('Auth middleware - New user created with ID:', user._id);
      } else {
        console.log('Auth middleware - Existing user found:', user._id, 'Role:', user.role);
        // Update last login
        user.lastLogin = new Date();
        await user.save();
      }

      req.user = user;
      req.firebaseUser = firebaseUser;
      console.log('Auth middleware - User attached to request:', user._id, 'Role:', user.role, 'IsAdmin:', user.isAdmin);
      return next();

    } catch (firebaseError) {
      console.log('Auth middleware - Firebase token verification failed:', firebaseError.message);

      // If Firebase token verification fails, try JWT token (for backward compatibility)
      try {
        if (!process.env.JWT_SECRET) {
          throw new Error('JWT_SECRET not configured');
        }

        console.log('Auth middleware - Trying JWT token verification...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        let user = await User.findById(decoded.sub || decoded.userId);

        // If not found in User collection, try Artisan collection
        if (!user) {
          console.log('Auth middleware - User not found, checking Artisan collection...');
          const artisan = await Artisan.findById(decoded.sub || decoded.userId);

          if (artisan && artisan.isActive && artisan.approvalStatus === 'approved') {
            console.log('Auth middleware - Artisan found and approved:', artisan._id);
            // Create a user-like object for artisan
            user = {
              _id: artisan.userId || artisan._id,
              email: artisan.email,
              name: artisan.name,
              isActive: artisan.isActive,
              firebaseUid: null,
              authProvider: 'artisan-jwt'
            };
          }
        }

        if (!user || !user.isActive) {
          console.log('Auth middleware - No valid user/artisan found');
          return res.status(401).json({ error: 'User not found or inactive' });
        }

        req.user = user;
        console.log('Auth middleware - Authentication successful for:', user._id);
        return next();

      } catch (jwtError) {
        console.log('Auth middleware - Both token verifications failed:', {
          firebase: firebaseError.message,
          jwt: jwtError.message
        });

        // In development, provide more detailed error information
        if (process.env.NODE_ENV === 'development') {
          return res.status(401).json({
            error: 'Invalid token',
            details: {
              firebase: firebaseError.message,
              jwt: jwtError.message,
              tokenPrefix: token.substring(0, 20)
            }
          });
        }

        return res.status(401).json({ error: 'Invalid token' });
      }
    }

  } catch (error) {
    console.error('Authentication middleware error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Optional authentication - continues even if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without user
    }

    const token = authHeader.substring(7);

    // Try Firebase token first
    try {
      const firebaseUser = await verifyFirebaseToken(token);
      const user = await User.findOne({ firebaseUid: firebaseUser.uid });

      if (user) {
        req.user = user;
        req.firebaseUser = firebaseUser;
      }

    } catch (firebaseError) {
      // Try JWT token
      try {
        if (process.env.JWT_SECRET) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findById(decoded.userId);

          if (user && user.isActive) {
            req.user = user;
          }
        }
      } catch (jwtError) {
        // Continue without user
      }
    }

    return next();

  } catch (error) {
    console.error('Optional auth middleware error:', error);
    return next(); // Continue even on error
  }
};

export {
  authenticateToken,
  optionalAuth,
  authenticateToken as requireAuth // Alias for backward compatibility
};