import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema({
	productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
	name: { type: String, required: true }, // snapshot of product name
	price: { type: Number, required: true }, // snapshot of price at time of order
	quantity: { type: Number, required: true, min: 1 },
	artisanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artisan', required: true },
	image: { type: String } // snapshot of first product image
})

const orderSchema = new mongoose.Schema({
	orderNumber: { type: String, required: true, unique: true },
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	items: [orderItemSchema],
	subtotal: { type: Number, required: true, min: 0 },
	shippingCost: { type: Number, default: 0, min: 0 },
	tax: { type: Number, default: 0, min: 0 },
	discount: { type: Number, default: 0, min: 0 },
	total: { type: Number, required: true, min: 0 },

	// Shipping Address - Enhanced
	shippingAddress: {
		fullName: { type: String, required: true },
		phone: { type: String, required: true },
		email: { type: String, required: true },
		addressLine1: { type: String, required: true },
		addressLine2: { type: String },
		city: { type: String, required: true },
		state: { type: String, required: true },
		zipCode: { type: String, required: true },
		country: { type: String, default: 'India' },
		landmark: { type: String },
		addressType: { type: String, enum: ['home', 'office', 'other'], default: 'home' }
	},

	// Billing Address
	billingAddress: {
		fullName: { type: String, required: true },
		phone: { type: String, required: true },
		email: { type: String, required: true },
		addressLine1: { type: String, required: true },
		addressLine2: { type: String },
		city: { type: String, required: true },
		state: { type: String, required: true },
		zipCode: { type: String, required: true },
		country: { type: String, default: 'India' },
		landmark: { type: String },
		addressType: { type: String, enum: ['home', 'office', 'other'], default: 'home' }
	},

	// Payment - Enhanced for Multiple Payment Gateways
	paymentMethod: {
		type: String,
		required: true,
		enum: ['cod', 'zoho_card', 'zoho_upi', 'zoho_netbanking', 'zoho_wallet', 'razorpay', 'upi', 'upi_prepaid', 'paytm', 'paytm_upi', 'paytm_card', 'paytm_netbanking', 'paytm_wallet']
	},
	paymentStatus: {
		type: String,
		default: 'pending',
		enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled']
	},
	paymentGateway: { type: String, enum: ['zoho', 'paytm', 'razorpay', 'cod'], default: 'cod' }, // Track which gateway was used
	paymentId: { type: String }, // Generic payment ID

	// Zoho Payments
	zohoPaymentId: { type: String },
	zohoOrderId: { type: String },

	// Paytm Payments
	paytmOrderId: { type: String },
	paytmTxnId: { type: String },
	paytmTxnToken: { type: String },
	paytmBankTxnId: { type: String },
	paytmRefundId: { type: String },
	upiPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'UpiPayment' },

	paymentGatewayResponse: { type: mongoose.Schema.Types.Mixed }, // Store gateway response
	paidAt: { type: Date },
	refundedAt: { type: Date },
	refundAmount: { type: Number, min: 0 },
	refundReason: { type: String },

	// Order Status - Enhanced with more statuses
	status: {
		type: String,
		default: 'placed',
		enum: ['placed', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded', 'rejected']
	},
	statusHistory: [{
		status: { type: String, required: true },
		timestamp: { type: Date, default: Date.now },
		note: { type: String }
	}],

	// Tracking - Enhanced
	trackingNumber: { type: String },
	courierService: { type: String }, // e.g., "Blue Dart", "DTDC"
	estimatedDelivery: { type: Date },
	actualDelivery: { type: Date },
	deliveredAt: { type: Date },
	cancelledAt: { type: Date },
	cancellationReason: { type: String },

	// ── Module 4: Seller Rejection with Reason ────────────────────────────────
	rojectionReason: { type: String }, // Mandatory reason logged when seller rejects an order
	rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Artisan' }, // Which artisan rejected
	rejectedAt: { type: Date }, // Timestamp of rejection

	// ── Module 5: Cancellation Fee Engine ────────────────────────────────────
	/**
	 * Fee retained by the platform when a buyer cancels a confirmed order.
	 * For COD orders this is ₹0 (no payment collected yet); for prepaid orders
	 * the fee is deducted from the refund.
	 */
	cancellationFee: { type: Number, default: 0, min: 0 },
	/** Refund actually issued to the buyer = total − cancellationFee */
	refundableAmount: { type: Number, min: 0 },
	/** True when an admin/system waived the fee (e.g. platform at fault) */
	cancellationFeeWaived: { type: Boolean, default: false },
	/** Which rule tier was applied (e.g. 'grace', 'placed', 'confirmed') */
	cancellationTier: { type: String },

	// COD-specific fields
	codFee: { type: Number, default: 0, min: 0 }, // COD handling fee
	codCollectedAt: { type: Date }, // When COD cash was collected on delivery
	codRiskFlags: {
		isFlagged: { type: Boolean, default: false },
		isHighRisk: { type: Boolean, default: false },
		flagReason: { type: String },
		returnCount: { type: Number, default: 0 }, // User's historical COD return count
		flaggedAt: { type: Date },
		reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		reviewedAt: { type: Date },
		reviewNote: { type: String }
	},

	// ── Module 3: Shipping Engine Fields ──────────────────────────────────────
	shippingZone: {
		type: String,
		enum: ['local', 'metro', 'tier2', 'rest_of_india', 'remote'],
		default: 'rest_of_india'
	},
	totalWeight: { type: Number, default: 0, min: 0 }, // Total order weight in grams
	shippingBreakdown: { type: mongoose.Schema.Types.Mixed }, // Detailed shipping calculation
	courierFlags: {
		isPrepaid: { type: Boolean, default: true },
		isCod: { type: Boolean, default: false },
		bookingType: { type: String, enum: ['prepaid', 'cod'], default: 'prepaid' },
		suggestedCourier: { type: String }, // e.g., "Blue Dart", "DTDC"
		zone: { type: String },
		zoneLabel: { type: String }
	},

	// Additional Info
	notes: { type: String, maxLength: 500 },
	isGift: { type: Boolean, default: false },
	giftMessage: { type: String, maxLength: 200 }
}, { timestamps: true })

// Pre-save middleware to generate order number and update status history
orderSchema.pre('save', async function (next) {
	if (!this.orderNumber) {
		const year = new Date().getFullYear()
		const count = await mongoose.model('Order').countDocuments({
			createdAt: {
				$gte: new Date(year, 0, 1),
				$lt: new Date(year + 1, 0, 1)
			}
		})
		this.orderNumber = `ZM-${year}-${String(count + 1).padStart(6, '0')}`
	}

	// Update status history when status changes
	if (this.isModified('status') && this.status) {
		const existingStatus = this.statusHistory.find(h => h.status === this.status)
		if (!existingStatus) {
			this.statusHistory.push({
				status: this.status,
				timestamp: new Date(),
				note: `Order status updated to ${this.status}`
			})
		}
	}

	// Set timestamps based on status
	if (this.status === 'delivered' && !this.deliveredAt) {
		this.deliveredAt = new Date()
		this.actualDelivery = new Date()
	}

	if (this.status === 'cancelled' && !this.cancelledAt) {
		this.cancelledAt = new Date()
	}

		if (this.status === 'rejected' && !this.rejectedAt) {
			this.rejectedAt = new Date()
		}

	next()
})

// Instance methods
orderSchema.methods.updateStatus = function (newStatus, note = '', updatedBy = null) {
	this.status = newStatus
	this.statusHistory.push({
		status: newStatus,
		timestamp: new Date(),
		note: note || `Order status updated to ${newStatus}`,
		updatedBy: updatedBy
	})
	return this.save()
}

orderSchema.methods.canBeCancelled = function () {
	return ['placed', 'confirmed', 'processing'].includes(this.status)
}

orderSchema.methods.canBeReturned = function () {
	return this.status === 'delivered' &&
		this.deliveredAt &&
		(new Date() - this.deliveredAt) <= (7 * 24 * 60 * 60 * 1000) // 7 days
}

// Static methods
orderSchema.statics.findByUser = function (userId, options = {}) {
	const { page = 1, limit = 10, status } = options
	const query = { userId }

	if (status) {
		query.status = status
	}

	return this.find(query)
		.sort({ createdAt: -1 })
		.skip((page - 1) * limit)
		.limit(limit)
		.populate('items.productId', 'name images category')
		.populate('userId', 'name email')
}

orderSchema.statics.getOrderStats = function (userId) {
	return this.aggregate([
		{ $match: { userId: new mongoose.Types.ObjectId(userId) } },
		{
			$group: {
				_id: '$status',
				count: { $sum: 1 },
				totalAmount: { $sum: '$total' }
			}
		}
	])
}

// Indexes - Enhanced
orderSchema.index({ userId: 1, createdAt: -1 })
orderSchema.index({ status: 1 })
orderSchema.index({ paymentStatus: 1 })
orderSchema.index({ 'items.artisanId': 1 })
orderSchema.index({ zohoPaymentId: 1 })
orderSchema.index({ zohoOrderId: 1 })
orderSchema.index({ paytmOrderId: 1 })
orderSchema.index({ paytmTxnId: 1 })
orderSchema.index({ paymentMethod: 1 })
orderSchema.index({ 'codRiskFlags.isFlagged': 1 })
orderSchema.index({ 'codRiskFlags.isHighRisk': 1 })

export default mongoose.model('Order', orderSchema)