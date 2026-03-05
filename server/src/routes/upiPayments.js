import { Router } from 'express'
import { z } from 'zod'
import UpiPayment from '../models/UpiPayment.js'
import Order from '../models/Order.js'
import { authenticateToken } from '../middleware/firebase-auth.js'
import requireAdmin from '../middleware/adminAuth.js'
import { validate, idSchema } from '../middleware/validation.js'
import { apiLimiter } from '../middleware/rateLimiter.js'
import * as upiService from '../services/upiService.js'

const router = Router()

// Validation schemas
const generateIntentSchema = z.object({
    orderId: idSchema,
    amount: z.number().positive().min(1),
    merchantUpiId: z.string().optional(), // Optional, will use default from env
    expiryMinutes: z.number().int().min(5).max(60).optional().default(30)
})

const verifyPaymentSchema = z.object({
    upiPaymentId: idSchema,
    utr: z.string().min(10).max(16).regex(/^[A-Za-z0-9]+$/, 'UTR must be alphanumeric only (no spaces or symbols)'),
    amount: z.number().positive().optional(), // Actual amount paid (for partial payment detection)
    verificationNotes: z.string().max(500).optional()
})

const updateStatusSchema = z.object({
    status: z.enum(['pending', 'verified', 'failed', 'refunded']),
    reason: z.string().max(500).optional(),
    refundAmount: z.number().positive().optional()
})

// Validation schema for receipt upload
const uploadReceiptSchema = z.object({
    receiptScreenshot: z.string().min(100, 'Receipt screenshot must be a valid base64 data URL')
})

// Apply rate limiting
router.use(apiLimiter)

/**
 * POST /api/upi-payments/:id/upload-receipt
 * Customer uploads payment receipt screenshot (base64 data URL)
 * Authenticated users only — must own the payment
 */
router.post('/:id/upload-receipt',
    authenticateToken,
    validate(z.object({ id: idSchema }), 'params'),
    validate(uploadReceiptSchema),
    async (req, res) => {
        try {
            const { receiptScreenshot } = req.validatedBody
            const payment = await UpiPayment.findById(req.validatedParams.id).populate('orderId', 'userId')

            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' })
            }

            // Verify caller owns this payment
            const orderUserId = payment.orderId?.userId?.toString()
            const callerId = req.user._id?.toString()
            if (!orderUserId || orderUserId !== callerId) {
                return res.status(403).json({ error: 'Not authorized to upload receipt for this payment' })
            }

            if (payment.paymentStatus !== 'pending') {
                return res.status(400).json({ error: `Cannot upload receipt — payment is already ${payment.paymentStatus}` })
            }

            payment.receiptScreenshot = receiptScreenshot
            payment.receiptUploadedAt = new Date()
            payment.statusHistory.push({
                status: 'pending',
                timestamp: new Date(),
                note: 'Customer uploaded payment receipt screenshot'
            })
            await payment.save()

            res.json({ success: true, message: 'Receipt uploaded successfully' })
        } catch (error) {
            console.error('Receipt upload error:', error)
            res.status(500).json({ error: 'Failed to upload receipt' })
        }
    }
)

/**
 * POST /api/upi-payments/generate-intent
 * Generate UPI payment intent and QR code for an order
 * Authenticated users only
 */
router.post('/generate-intent',
    authenticateToken,
    validate(generateIntentSchema),
    async (req, res) => {
        try {
            const { orderId, amount, merchantUpiId, expiryMinutes } = req.validatedBody
            const userId = req.user._id

            // Validate order exists and belongs to user
            const order = await Order.findOne({ _id: orderId, userId })

            if (!order) {
                return res.status(404).json({ error: 'Order not found' })
            }

            // Validate amount matches order total
            if (Math.abs(amount - order.total) > 0.01) {
                return res.status(400).json({
                    error: 'Amount mismatch',
                    details: `Expected ${order.total}, received ${amount}`
                })
            }

            // Check if order already has a pending/verified UPI payment
            const existingPayment = await UpiPayment.findOne({
                orderId,
                paymentStatus: { $in: ['pending', 'verified'] }
            })

            if (existingPayment && existingPayment.paymentStatus === 'verified') {
                return res.status(400).json({
                    error: 'Order already has a verified payment',
                    payment: existingPayment
                })
            }

            // Use merchant UPI ID from env or request
            const merchantUpi = merchantUpiId || process.env.MERCHANT_UPI_ID || 'merchant@paytm'
            const merchantName = process.env.MERCHANT_NAME || 'Zaymazone'

            // Sanitize merchant UPI ID
            const sanitizedMerchantUpi = upiService.sanitizeUpiId(merchantUpi)

            // Generate UPI intent URL
            const upiIntentUrl = upiService.generateUpiIntent(
                sanitizedMerchantUpi,
                merchantName,
                amount,
                order.orderNumber,
                `Payment for Order ${order.orderNumber}`
            )

            // Generate QR code
            const qrCodeData = await upiService.generateQrCode(upiIntentUrl)

            // Calculate expiry time
            const expiresAt = upiService.calculateExpiryTime(expiryMinutes)

            // Create UPI payment record
            const upiPayment = new UpiPayment({
                orderId: order._id,
                orderNumber: order.orderNumber,
                amount,
                paymentMode: 'upi_prepaid',
                upiIntentUrl,
                qrCodeData,
                merchantUpiId: sanitizedMerchantUpi,
                merchantName,
                expiresAt,
                paymentStatus: 'pending',
                statusHistory: [{
                    status: 'pending',
                    timestamp: new Date(),
                    note: 'Payment intent generated'
                }]
            })

            await upiPayment.save()

            // Update order with UPI payment reference
            order.upiPaymentId = upiPayment._id
            order.paymentMethod = 'upi_prepaid'
            await order.save()

            res.status(201).json({
                success: true,
                upiPaymentId: upiPayment._id,
                upiIntentUrl,
                qrCodeData,
                amount: upiService.formatAmount(amount),
                orderNumber: order.orderNumber,
                merchantUpiId: sanitizedMerchantUpi,
                merchantName,
                expiresAt,
                message: 'UPI payment intent generated successfully'
            })

        } catch (error) {
            console.error('Error generating UPI intent:', error)
            res.status(500).json({
                error: 'Failed to generate UPI payment intent',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        }
    }
)

/**
 * POST /api/upi-payments/verify
 * Verify UPI payment using UTR (Admin only)
 */
router.post('/verify',
    authenticateToken,
    requireAdmin,
    validate(verifyPaymentSchema),
    async (req, res) => {
        try {
            const { upiPaymentId, utr, amount: paidAmount, verificationNotes } = req.validatedBody
            const adminUserId = req.user._id

            // Validate UTR format (alphanumeric only)
            if (!upiService.validateUtr(utr)) {
                return res.status(400).json({
                    error: 'Invalid UTR format',
                    code: 'INVALID_UTR',
                    details: 'UTR must be 10-16 alphanumeric characters (no spaces or symbols)'
                })
            }

            // Reject UTR with non-alphanumeric chars (extra safety beyond Zod)
            if (!/^[A-Za-z0-9]+$/.test(utr.trim())) {
                return res.status(400).json({
                    error: 'UTR contains invalid characters',
                    code: 'INVALID_UTR_FORMAT',
                    details: 'UTR must contain only letters and numbers'
                })
            }

            // Clean UTR
            const cleanUtr = utr.trim().toUpperCase()

            // ── Duplicate UTR Check ────────────────────────────────────────────
            const existingUtr = await UpiPayment.findOne({ utr: cleanUtr })
            if (existingUtr) {
                return res.status(400).json({
                    error: 'Duplicate UTR: this transaction reference has already been used',
                    code: 'DUPLICATE_UTR',
                    details: 'This UTR has already been verified for another payment. Each UTR can only be used once.',
                    existingPayment: {
                        id: existingUtr._id,
                        orderNumber: existingUtr.orderNumber,
                        amount: existingUtr.amount,
                        verifiedAt: existingUtr.verifiedAt
                    }
                })
            }

            // Find UPI payment
            const upiPayment = await UpiPayment.findById(upiPaymentId)
                .populate('orderId', 'orderNumber total userId')

            if (!upiPayment) {
                return res.status(404).json({ error: 'UPI payment not found' })
            }

            // Check if payment can be verified
            if (!upiPayment.canBeVerified()) {
                return res.status(400).json({
                    error: 'Payment cannot be verified',
                    code: 'PAYMENT_NOT_VERIFIABLE',
                    details: upiPayment.isExpired()
                        ? 'Payment intent has expired. Please generate a new payment link.'
                        : `Payment is already ${upiPayment.paymentStatus} and cannot be verified again.`
                })
            }

            // ── Partial Payment Detection ──────────────────────────────────────
            // If admin provides the actual paid amount, verify it matches the order
            if (paidAmount !== undefined) {
                const expectedAmount = upiPayment.amount
                const tolerance = 1 // ₹1 tolerance for rounding
                const shortfall = expectedAmount - paidAmount

                if (Math.abs(shortfall) > tolerance) {
                    return res.status(400).json({
                        error: shortfall > 0
                            ? `Partial payment detected: ₹${paidAmount} received, ₹${expectedAmount} expected`
                            : `Overpayment detected: ₹${paidAmount} received, ₹${expectedAmount} expected`,
                        code: shortfall > 0 ? 'PARTIAL_PAYMENT' : 'OVERPAYMENT',
                        details: {
                            paid: paidAmount,
                            expected: expectedAmount,
                            shortfall: Math.abs(shortfall),
                            action: shortfall > 0
                                ? 'Contact customer to collect remaining amount or process refund'
                                : 'Contact customer to process refund for excess amount'
                        }
                    })
                }
            }

            // Verify payment
            upiPayment.utr = cleanUtr
            await upiPayment.verify(adminUserId, verificationNotes)

            // Update order payment status
            const order = await Order.findById(upiPayment.orderId)
            if (order) {
                order.paymentStatus = 'paid'
                order.paidAt = new Date()
                order.statusHistory.push({
                    status: 'confirmed',
                    timestamp: new Date(),
                    note: 'Payment verified via UPI'
                })
                if (order.status === 'placed') {
                    order.status = 'confirmed'
                }
                await order.save()
            }

            res.json({
                success: true,
                message: 'Payment verified successfully',
                payment: {
                    id: upiPayment._id,
                    orderNumber: upiPayment.orderNumber,
                    amount: upiPayment.amount,
                    utr: upiPayment.utr,
                    paymentStatus: upiPayment.paymentStatus,
                    verifiedAt: upiPayment.verifiedAt,
                    verifiedBy: adminUserId
                },
                order: {
                    id: order._id,
                    orderNumber: order.orderNumber,
                    paymentStatus: order.paymentStatus,
                    status: order.status
                }
            })

        } catch (error) {
            console.error('Error verifying payment:', error)
            res.status(500).json({
                error: 'Failed to verify payment',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        }
    }
)

/**
 * PATCH /api/upi-payments/:id/status
 * Update payment status (Admin only)
 */
router.patch('/:id/status',
    authenticateToken,
    requireAdmin,
    validate(z.object({ id: idSchema }), 'params'),
    validate(updateStatusSchema),
    async (req, res) => {
        try {
            const { status, reason, refundAmount } = req.validatedBody
            const adminUserId = req.user._id
            const paymentId = req.validatedParams.id

            const upiPayment = await UpiPayment.findById(paymentId)
                .populate('orderId')

            if (!upiPayment) {
                return res.status(404).json({ error: 'UPI payment not found' })
            }

            // Update status based on new status
            if (status === 'failed') {
                await upiPayment.markFailed(reason || 'Payment failed')

                // Update order
                if (upiPayment.orderId) {
                    upiPayment.orderId.paymentStatus = 'failed'
                    await upiPayment.orderId.save()
                }
            } else if (status === 'refunded') {
                const refundAmt = refundAmount || upiPayment.amount
                await upiPayment.refund(adminUserId, refundAmt, reason || 'Refund processed')

                // Update order
                if (upiPayment.orderId) {
                    upiPayment.orderId.paymentStatus = 'refunded'
                    upiPayment.orderId.refundAmount = refundAmt
                    upiPayment.orderId.refundedAt = new Date()
                    upiPayment.orderId.refundReason = reason
                    await upiPayment.orderId.save()
                }
            } else {
                upiPayment.paymentStatus = status
                upiPayment.statusHistory.push({
                    status,
                    timestamp: new Date(),
                    note: reason || `Status updated to ${status}`,
                    updatedBy: adminUserId
                })
                await upiPayment.save()
            }

            res.json({
                success: true,
                message: `Payment status updated to ${status}`,
                payment: upiPayment
            })

        } catch (error) {
            console.error('Error updating payment status:', error)
            res.status(500).json({
                error: 'Failed to update payment status',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        }
    }
)


/**
 * GET /api/upi-payments/pending
 * List all pending UPI payments (Admin only)
 * IMPORTANT: This route must come BEFORE /:id to avoid matching 'pending' as an ID
 */
router.get('/pending',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 20

            const payments = await UpiPayment.findPendingPayments({ page, limit })
            const total = await UpiPayment.countDocuments({ paymentStatus: 'pending' })

            res.json({
                payments,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            })

        } catch (error) {
            console.error('Error fetching pending payments:', error)
            res.status(500).json({
                error: 'Failed to fetch pending payments',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        }
    }
)

/**
 * GET /api/upi-payments/:id
 * Get UPI payment details
 * Users can only view their own payments, admins can view any
 */
router.get('/:id',
    authenticateToken,
    validate(z.object({ id: idSchema }), 'params'),
    async (req, res) => {
        try {
            const paymentId = req.validatedParams.id
            const userId = req.user._id
            const isAdmin = req.user.role === 'admin' || req.user.isAdmin

            const upiPayment = await UpiPayment.findById(paymentId)
                .populate('orderId', 'orderNumber total userId')
                .populate('verifiedBy', 'name email')
                .populate('refundedBy', 'name email')

            if (!upiPayment) {
                return res.status(404).json({ error: 'UPI payment not found' })
            }

            // Check authorization
            if (!isAdmin && upiPayment.orderId.userId.toString() !== userId.toString()) {
                return res.status(403).json({ error: 'Access denied' })
            }

            res.json(upiPayment)

        } catch (error) {
            console.error('Error fetching payment:', error)
            res.status(500).json({
                error: 'Failed to fetch payment details',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        }
    }
)

/**
 * GET /api/upi-payments/order/:orderId
 * Get all UPI payments for a specific order
 */
router.get('/order/:orderId',
    authenticateToken,
    validate(z.object({ orderId: idSchema }), 'params'),
    async (req, res) => {
        try {
            const orderId = req.validatedParams.orderId
            const userId = req.user._id
            const isAdmin = req.user.role === 'admin' || req.user.isAdmin

            // Verify order belongs to user
            const order = await Order.findById(orderId)
            if (!order) {
                return res.status(404).json({ error: 'Order not found' })
            }

            if (!isAdmin && order.userId.toString() !== userId.toString()) {
                return res.status(403).json({ error: 'Access denied' })
            }

            const payments = await UpiPayment.findByOrder(orderId)

            res.json({
                orderId,
                orderNumber: order.orderNumber,
                payments
            })

        } catch (error) {
            console.error('Error fetching order payments:', error)
            res.status(500).json({
                error: 'Failed to fetch order payments',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        }
    }
)

export default router

