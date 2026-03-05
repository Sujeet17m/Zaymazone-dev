import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
	firebaseUid: { type: String, unique: true, sparse: true, index: true }, // Firebase UID for Firebase Auth users
	name: { type: String, required: true, trim: true, maxLength: 120 },
	email: { type: String, required: true, unique: true, lowercase: true, index: true, maxLength: 254 },
	passwordHash: { type: String }, // Optional - only for non-Firebase users
	authProvider: { type: String, enum: ['firebase', 'local'], default: 'firebase' }, // Track auth method
	role: { type: String, enum: ['user', 'artisan', 'admin'], default: 'user' },
	avatar: { type: String, default: '' },
	phone: { type: String, trim: true },
	// Address is fully optional — NOT required at login/registration.
	// It is only collected and validated during the checkout process.
	// Existing users without an address are handled gracefully (sub-document is undefined).
	address: {
		street: { type: String, trim: true },
		city: { type: String, trim: true },
		state: { type: String, trim: true },
		zipCode: { type: String, trim: true },
		country: { type: String, default: 'India' }
	},
	isEmailVerified: { type: Boolean, default: false },
	emailVerificationToken: { type: String },
	passwordResetToken: { type: String },
	passwordResetExpires: { type: Date },
	refreshTokens: [{
		token: { type: String, required: true },
		createdAt: { type: Date, default: Date.now },
		expiresAt: { type: Date, required: true },
		deviceInfo: { type: String } // Optional device/browser info
	}],
	preferences: {
		newsletter: { type: Boolean, default: true },
		notifications: { type: Boolean, default: true },
		language: { type: String, default: 'en' }
	},
	lastLogin: { type: Date },
	isActive: { type: Boolean, default: true }
}, { timestamps: true })

// Virtual for checking admin status
userSchema.virtual('isAdmin').get(function () {
	return this.role === 'admin'
})

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true })
userSchema.set('toObject', { virtuals: true })

// Indexes for performance
userSchema.index({ email: 1, isActive: 1 })
userSchema.index({ role: 1 })

export default mongoose.model('User', userSchema)


