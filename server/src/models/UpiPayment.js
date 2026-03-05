import mongoose from 'mongoose'

const upiPaymentSchema = new mongoose.Schema({
    // Order Reference
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    orderNumber: {
        type: String,
        required: true,
        index: true
    },

    // Payment Details
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    paymentMode: {
        type: String,
        default: 'upi_prepaid',
        enum: ['upi_prepaid']
    },

    // UPI Specific Fields
    upiId: {
        type: String,
        trim: true
    }, // Customer's UPI ID (optional, for record keeping)
    utr: {
        type: String,
        unique: true,
        sparse: true,
        // index defined via schema.index() at bottom — do not add index:true here
        uppercase: true,
        trim: true
    }, // Unique Transaction Reference from bank

    // Payment Status Lifecycle
    paymentStatus: {
        type: String,
        required: true,
        default: 'pending',
        enum: ['pending', 'verified', 'failed', 'refunded'],
        index: true
    },

    // UPI Intent & QR Code
    upiIntentUrl: {
        type: String,
        required: true
    }, // UPI deep link for payment apps
    qrCodeData: {
        type: String,
        required: true
    }, // Base64 QR code image data

    // Merchant Details
    merchantUpiId: {
        type: String,
        required: true
    }, // Merchant's UPI ID
    merchantName: {
        type: String,
        default: 'Zaymazone'
    },

    // Verification Details (Admin Only)
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }, // Admin user who verified
    verifiedAt: {
        type: Date
    },
    verificationNotes: {
        type: String,
        maxLength: 500
    },

    // Failure Details
    failureReason: {
        type: String,
        maxLength: 500
    },
    failedAt: {
        type: Date
    },

    // Refund Details
    refundAmount: {
        type: Number,
        min: 0
    },
    refundedAt: {
        type: Date
    },
    refundReason: {
        type: String,
        maxLength: 500
    },
    refundedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Customer Payment Receipt Screenshot
    receiptScreenshot: {
        type: String,   // base64 data URL (e.g. "data:image/jpeg;base64,...")
        default: null
    },
    receiptUploadedAt: {
        type: Date,
        default: null
    },

    // Additional Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },

    // Expiry
    expiresAt: {
        type: Date,
        required: true,
        // index defined via schema.index() at bottom — do not add index:true here
    }, // Payment intent expiry (typically 15-30 minutes)

    // Status History
    statusHistory: [{
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
}, { timestamps: true })

// Pre-save middleware to update status history
upiPaymentSchema.pre('save', function (next) {
    // Update status history when status changes
    if (this.isModified('paymentStatus') && this.paymentStatus) {
        const existingStatus = this.statusHistory.find(h => h.status === this.paymentStatus)
        if (!existingStatus) {
            this.statusHistory.push({
                status: this.paymentStatus,
                timestamp: new Date(),
                note: `Payment status updated to ${this.paymentStatus}`
            })
        }
    }

    // Set timestamps based on status
    if (this.paymentStatus === 'verified' && !this.verifiedAt) {
        this.verifiedAt = new Date()
    }

    if (this.paymentStatus === 'failed' && !this.failedAt) {
        this.failedAt = new Date()
    }

    if (this.paymentStatus === 'refunded' && !this.refundedAt) {
        this.refundedAt = new Date()
    }

    next()
})

// Instance methods
upiPaymentSchema.methods.verify = function (adminUserId, notes = '') {
    this.paymentStatus = 'verified'
    this.verifiedBy = adminUserId
    this.verifiedAt = new Date()
    this.verificationNotes = notes
    return this.save()
}

upiPaymentSchema.methods.markFailed = function (reason) {
    this.paymentStatus = 'failed'
    this.failureReason = reason
    this.failedAt = new Date()
    return this.save()
}

upiPaymentSchema.methods.refund = function (adminUserId, amount, reason) {
    this.paymentStatus = 'refunded'
    this.refundAmount = amount
    this.refundReason = reason
    this.refundedBy = adminUserId
    this.refundedAt = new Date()
    return this.save()
}

upiPaymentSchema.methods.isExpired = function () {
    return new Date() > this.expiresAt
}

upiPaymentSchema.methods.canBeVerified = function () {
    return this.paymentStatus === 'pending' && !this.isExpired()
}

// Static methods
upiPaymentSchema.statics.findByOrder = function (orderId) {
    return this.find({ orderId })
        .sort({ createdAt: -1 })
        .populate('verifiedBy', 'name email')
        .populate('refundedBy', 'name email')
}

upiPaymentSchema.statics.findPendingPayments = function (options = {}) {
    const { page = 1, limit = 20 } = options
    const skip = (page - 1) * limit

    return this.find({ paymentStatus: 'pending' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('orderId', 'orderNumber total userId')
        .populate('orderId.userId', 'name email')
}

upiPaymentSchema.statics.findByUtr = function (utr) {
    return this.findOne({ utr: utr.toUpperCase() })
        .populate('orderId', 'orderNumber total')
        .populate('verifiedBy', 'name email')
}

// Indexes for performance
upiPaymentSchema.index({ orderId: 1, createdAt: -1 })
upiPaymentSchema.index({ paymentStatus: 1, createdAt: -1 })
upiPaymentSchema.index({ utr: 1 }, { unique: true, sparse: true })
upiPaymentSchema.index({ expiresAt: 1 })

export default mongoose.model('UpiPayment', upiPaymentSchema)
