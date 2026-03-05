import { Router } from 'express'
import { z } from 'zod'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Cart from '../models/Cart.js'
import CodConfig from '../models/CodConfig.js'
import codService from '../services/codService.js'
import { authenticateToken } from '../middleware/firebase-auth.js'
import { validate, idSchema, paginationSchema } from '../middleware/validation.js'
import { apiLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// Apply rate limiting
router.use(apiLimiter)

// ─── Validation Schemas ─────────────────────────────────────────────────────
// NOTE: shippingAddressSchema is intentionally scoped to order creation only.
// Address is NOT required for COD eligibility checks or payment initiation —
// it is validated exclusively at the point of checkout (order placement).

const shippingAddressSchema = z.object({
    fullName: z.string().min(1).max(100),
    phone: z.string().min(10).max(15),
    email: z.string().email().min(1).max(100),
    addressLine1: z.string().min(1).max(200),
    addressLine2: z.string().optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    zipCode: z.string().min(1).max(20),
    country: z.string().default('India'),
    landmark: z.string().optional(),
    addressType: z.enum(['home', 'office', 'other']).default('home')
})

const orderItemSchema = z.object({
    productId: idSchema,
    quantity: z.number().int().min(1).max(10)
})

const createCodOrderSchema = z.object({
    items: z.array(orderItemSchema).min(1).max(20),
    shippingAddress: shippingAddressSchema,
    billingAddress: shippingAddressSchema.optional(),
    useShippingAsBilling: z.boolean().default(true),
    notes: z.string().max(500).optional(),
    isGift: z.boolean().default(false),
    giftMessage: z.string().max(200).optional()
})

const updateCodStatusSchema = z.object({
    status: z.enum(['confirmed', 'shipped', 'delivered', 'returned', 'cancelled', 'refunded']),
    note: z.string().max(500).optional(),
    trackingNumber: z.string().optional(),
    courierService: z.string().max(100).optional()
})

const updateRiskFlagSchema = z.object({
    isFlagged: z.boolean(),
    isHighRisk: z.boolean().optional(),
    flagReason: z.string().max(500).optional(),
    reviewNote: z.string().max(500).optional()
})

// ─── Helper: Build order number ──────────────────────────────────────────────

function generateOrderNumber() {
    return `COD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/cod/eligibility
 * Public endpoint — check if COD is available for a given subtotal and state.
 * Used by the frontend to show/hide COD option and display dynamic fee before order placement.
 *
 * Query params:
 *   subtotal  {number} - Order subtotal in INR
 *   state     {string} - Delivery state (optional)
 *   userId    {string} - User ID (optional, for risk check)
 */
router.get('/eligibility', async (req, res) => {
    try {
        const subtotal = parseFloat(req.query.subtotal) || 0
        const state = req.query.state || null
        const userId = req.query.userId || null

        if (subtotal < 0) {
            return res.status(400).json({ error: 'Invalid subtotal' })
        }

        const [eligibility, feeResult] = await Promise.all([
            codService.isCodEligible(subtotal, state, userId),
            codService.calculateCodFee(subtotal, state)
        ])

        res.json({
            eligible: eligibility.eligible,
            reason: eligibility.reason,
            codFee: feeResult.totalFee,
            feeBreakdown: feeResult.breakdown,
            limits: {
                // Expose limits so frontend can show dynamic warnings
                maxOrderAmount: 50000, // Will be overridden by DB config if available
                highValueWarningThreshold: 25000
            }
        })
    } catch (error) {
        console.error('Error checking COD eligibility:', error)
        res.status(500).json({ error: 'Failed to check COD eligibility' })
    }
})

/**
 * POST /api/cod/orders
 * Create a new COD order.
 * Flow: validate products → check eligibility → calculate fee → assess risk → create order
 */
router.post('/orders',
    authenticateToken,
    validate(createCodOrderSchema),
    async (req, res) => {
        try {
            const orderData = req.validatedBody
            const userId = req.user._id

            // 1. Validate products and build order items
            const productIds = orderData.items.map(item => item.productId)
            const products = await Product.find({
                _id: { $in: productIds },
                isActive: true
            }).populate('artisanId', '_id')

            if (products.length !== orderData.items.length) {
                return res.status(400).json({ error: 'Some products are not available' })
            }

            const orderItems = []
            let subtotal = 0

            for (const orderItem of orderData.items) {
                const product = products.find(p => p._id.toString() === orderItem.productId)

                if (product.stock < orderItem.quantity) {
                    return res.status(400).json({
                        error: `Insufficient stock for ${product.name}. Available: ${product.stock}`
                    })
                }

                if (!product.artisanId) {
                    return res.status(400).json({
                        error: `Product ${product.name} is missing artisan information`
                    })
                }

                subtotal += product.price * orderItem.quantity

                orderItems.push({
                    productId: product._id,
                    name: product.name,
                    price: product.price,
                    quantity: orderItem.quantity,
                    artisanId: product.artisanId._id,
                    image: product.images?.[0] || ''
                })
            }

            // 2. Check COD eligibility
            const deliveryState = orderData.shippingAddress.state
            const eligibility = await codService.isCodEligible(subtotal, deliveryState, userId.toString())

            if (!eligibility.eligible) {
                return res.status(400).json({
                    error: eligibility.reason,
                    code: 'COD_NOT_ELIGIBLE'
                })
            }

            // 3. Calculate COD fee
            const feeResult = await codService.calculateCodFee(subtotal, deliveryState)
            const codFee = feeResult.totalFee

            // 4. Calculate order totals
            const shippingCost = subtotal > 1000 ? 0 : 50
            const tax = Math.round(subtotal * 0.05)
            const total = subtotal + shippingCost + tax + codFee

            // 5. Assess risk (non-blocking — flagged orders are still created)
            const riskAssessment = await codService.assessCodRisk(userId.toString(), { subtotal })

            // 6. Create the order
            const order = new Order({
                orderNumber: generateOrderNumber(),
                userId,
                items: orderItems,
                subtotal,
                shippingCost,
                tax,
                codFee,
                total,
                shippingAddress: orderData.shippingAddress,
                billingAddress: orderData.useShippingAsBilling
                    ? orderData.shippingAddress
                    : (orderData.billingAddress || orderData.shippingAddress),
                paymentMethod: 'cod',
                paymentGateway: 'cod',
                paymentStatus: 'pending', // COD: pending until delivery
                notes: orderData.notes,
                isGift: orderData.isGift,
                giftMessage: orderData.giftMessage,
                codRiskFlags: {
                    isFlagged: riskAssessment.isFlagged,
                    isHighRisk: riskAssessment.isHighRisk,
                    flagReason: riskAssessment.flagReason,
                    returnCount: riskAssessment.returnCount,
                    ...(riskAssessment.isFlagged ? { flaggedAt: new Date() } : {})
                },
                statusHistory: [{
                    status: 'placed',
                    timestamp: new Date(),
                    note: 'COD order placed successfully'
                }]
            })

            await order.save()

            // 7. Deduct stock
            for (const item of orderItems) {
                await Product.findByIdAndUpdate(item.productId, {
                    $inc: { stock: -item.quantity, salesCount: item.quantity }
                })
            }

            // 8. Clear cart
            await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } })

            // 9. Populate and respond
            const populatedOrder = await Order.findById(order._id)
                .populate('items.productId', 'name images')
                .lean()

            res.status(201).json({
                ...populatedOrder,
                codCharges: codService.getCodChargeBreakdown(populatedOrder),
                riskAssessment: {
                    isFlagged: riskAssessment.isFlagged,
                    message: riskAssessment.isFlagged
                        ? 'Order flagged for review. It will be processed after verification.'
                        : null
                }
            })
        } catch (error) {
            console.error('Error creating COD order:', error)
            res.status(500).json({ error: 'Failed to create COD order' })
        }
    }
)

/**
 * GET /api/cod/orders/:id
 * Get a COD order with full charge breakdown.
 */
router.get('/orders/:id',
    authenticateToken,
    validate(z.object({ id: idSchema }), 'params'),
    async (req, res) => {
        try {
            const query = {
                _id: req.validatedParams.id,
                paymentMethod: 'cod'
            }

            // Non-admins can only see their own orders
            if (req.user.role !== 'admin') {
                query.userId = req.user._id
            }

            const order = await Order.findOne(query)
                .populate('items.productId', 'name images category')
                .populate('userId', 'name email')
                .lean()

            if (!order) {
                return res.status(404).json({ error: 'COD order not found' })
            }

            res.json({
                ...order,
                codCharges: codService.getCodChargeBreakdown(order)
            })
        } catch (error) {
            console.error('Error fetching COD order:', error)
            res.status(500).json({ error: 'Failed to fetch COD order' })
        }
    }
)

/**
 * PATCH /api/cod/orders/:id/status
 * Update COD order status with lifecycle validation.
 * Automatically marks payment as 'paid' on delivery and triggers risk re-assessment on return.
 */
router.patch('/orders/:id/status',
    authenticateToken,
    validate(z.object({ id: idSchema }), 'params'),
    validate(updateCodStatusSchema),
    async (req, res) => {
        try {
            const { status, note, trackingNumber, courierService } = req.validatedBody

            const order = await Order.findOne({
                _id: req.validatedParams.id,
                paymentMethod: 'cod'
            })

            if (!order) {
                return res.status(404).json({ error: 'COD order not found' })
            }

            // Validate COD-specific status transition
            if (!codService.isValidCodStatusTransition(order.status, status)) {
                return res.status(400).json({
                    error: `Invalid status transition from '${order.status}' to '${status}' for COD orders`,
                    currentStatus: order.status,
                    allowedTransitions: getAllowedTransitions(order.status),
                    code: 'INVALID_STATUS_TRANSITION'
                })
            }

            // Apply status-specific logic
            order.status = status
            order.statusHistory.push({
                status,
                timestamp: new Date(),
                note: note || `COD order status updated to ${status}`
            })

            if (status === 'shipped') {
                if (trackingNumber) order.trackingNumber = trackingNumber
                if (courierService) order.courierService = courierService
                order.shippedAt = new Date()
            }

            if (status === 'delivered') {
                order.deliveredAt = new Date()
                order.actualDelivery = new Date()
                order.codCollectedAt = new Date()   // Cash collected on delivery
                order.paymentStatus = 'paid'        // COD payment fulfilled
                order.paidAt = new Date()
            }

            if (status === 'cancelled') {
                order.cancelledAt = new Date()
                order.cancellationReason = note || 'Order cancelled'

                // Restore stock on cancellation
                for (const item of order.items) {
                    await Product.findByIdAndUpdate(item.productId, {
                        $inc: { stock: item.quantity, salesCount: -item.quantity }
                    })
                }
            }

            if (status === 'returned') {
                // Re-assess risk after return
                const risk = await codService.handleReturnRiskUpdate(
                    order.userId.toString(),
                    order._id.toString()
                )

                order.codRiskFlags = {
                    ...order.codRiskFlags,
                    isFlagged: risk.isFlagged,
                    isHighRisk: risk.isHighRisk,
                    flagReason: risk.flagReason,
                    returnCount: risk.returnCount,
                    ...(risk.isFlagged ? { flaggedAt: new Date() } : {})
                }
            }

            await order.save()

            res.json({
                message: `COD order status updated to '${status}'`,
                order,
                codCharges: codService.getCodChargeBreakdown(order.toObject())
            })
        } catch (error) {
            console.error('Error updating COD order status:', error)
            res.status(500).json({ error: 'Failed to update COD order status' })
        }
    }
)

/**
 * GET /api/cod/orders/:id/charges
 * Get itemized COD charge breakdown for an order.
 */
router.get('/orders/:id/charges',
    authenticateToken,
    validate(z.object({ id: idSchema }), 'params'),
    async (req, res) => {
        try {
            const query = {
                _id: req.validatedParams.id,
                paymentMethod: 'cod'
            }

            if (req.user.role !== 'admin') {
                query.userId = req.user._id
            }

            const order = await Order.findOne(query)
                .select('subtotal shippingCost tax discount codFee total orderNumber status paymentStatus codCollectedAt')
                .lean()

            if (!order) {
                return res.status(404).json({ error: 'COD order not found' })
            }

            res.json({
                orderNumber: order.orderNumber,
                status: order.status,
                paymentStatus: order.paymentStatus,
                codCollectedAt: order.codCollectedAt,
                charges: codService.getCodChargeBreakdown(order)
            })
        } catch (error) {
            console.error('Error fetching COD charges:', error)
            res.status(500).json({ error: 'Failed to fetch COD charges' })
        }
    }
)

/**
 * GET /api/cod/risk/:userId
 * Get COD risk profile for a user.
 * Users can view their own; admins can view any.
 */
router.get('/risk/:userId',
    authenticateToken,
    validate(z.object({ userId: idSchema }), 'params'),
    async (req, res) => {
        try {
            const targetUserId = req.validatedParams.userId

            // Authorization: users can only view their own risk profile
            if (req.user.role !== 'admin' && req.user._id.toString() !== targetUserId) {
                return res.status(403).json({ error: 'Access denied' })
            }

            const risk = await codService.assessCodRisk(targetUserId, {})

            // Get order history summary
            const [totalCodOrders, returnedCodOrders, flaggedOrders] = await Promise.all([
                Order.countDocuments({ userId: targetUserId, paymentMethod: 'cod' }),
                Order.countDocuments({ userId: targetUserId, paymentMethod: 'cod', status: 'returned' }),
                Order.countDocuments({ userId: targetUserId, paymentMethod: 'cod', 'codRiskFlags.isFlagged': true })
            ])

            res.json({
                userId: targetUserId,
                riskProfile: {
                    isFlagged: risk.isFlagged,
                    isHighRisk: risk.isHighRisk,
                    flagReason: risk.flagReason,
                    returnCount: risk.returnCount
                },
                orderHistory: {
                    totalCodOrders,
                    returnedCodOrders,
                    flaggedOrders,
                    returnRate: totalCodOrders > 0
                        ? `${Math.round((returnedCodOrders / totalCodOrders) * 100)}%`
                        : '0%'
                },
                codEligible: !risk.isHighRisk
            })
        } catch (error) {
            console.error('Error fetching COD risk profile:', error)
            res.status(500).json({ error: 'Failed to fetch risk profile' })
        }
    }
)

/**
 * GET /api/cod/admin/orders
 * Admin: List all COD orders with optional risk flag filter.
 */
router.get('/admin/orders',
    authenticateToken,
    validate(paginationSchema, 'query'),
    async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' })
            }

            const { page, limit } = req.validatedQuery
            const skip = (page - 1) * limit

            // Optional filters from query params
            const { status, flagged, highRisk } = req.query

            const query = { paymentMethod: 'cod' }
            if (status) query.status = status
            if (flagged === 'true') query['codRiskFlags.isFlagged'] = true
            if (highRisk === 'true') query['codRiskFlags.isHighRisk'] = true

            const [orders, total] = await Promise.all([
                Order.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .populate('userId', 'name email phone')
                    .populate('items.productId', 'name')
                    .select('-__v')
                    .lean(),
                Order.countDocuments(query)
            ])

            // Attach charge breakdown to each order
            const ordersWithCharges = orders.map(order => ({
                ...order,
                codCharges: codService.getCodChargeBreakdown(order)
            }))

            res.json({
                orders: ordersWithCharges,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                summary: {
                    total,
                    filters: { status, flagged, highRisk }
                }
            })
        } catch (error) {
            console.error('Error fetching admin COD orders:', error)
            res.status(500).json({ error: 'Failed to fetch COD orders' })
        }
    }
)

/**
 * PATCH /api/cod/admin/orders/:id/risk
 * Admin: Manually update risk flag on a COD order.
 */
router.patch('/admin/orders/:id/risk',
    authenticateToken,
    validate(z.object({ id: idSchema }), 'params'),
    validate(updateRiskFlagSchema),
    async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' })
            }

            const { isFlagged, isHighRisk, flagReason, reviewNote } = req.validatedBody

            const order = await Order.findOne({
                _id: req.validatedParams.id,
                paymentMethod: 'cod'
            })

            if (!order) {
                return res.status(404).json({ error: 'COD order not found' })
            }

            order.codRiskFlags = {
                ...order.codRiskFlags,
                isFlagged,
                isHighRisk: isHighRisk ?? order.codRiskFlags?.isHighRisk ?? false,
                flagReason: flagReason || order.codRiskFlags?.flagReason,
                reviewedBy: req.user._id,
                reviewedAt: new Date(),
                reviewNote: reviewNote || null,
                ...(isFlagged ? { flaggedAt: order.codRiskFlags?.flaggedAt || new Date() } : {})
            }

            await order.save()

            res.json({
                message: `Risk flag ${isFlagged ? 'set' : 'cleared'} for order ${order.orderNumber}`,
                order: {
                    _id: order._id,
                    orderNumber: order.orderNumber,
                    codRiskFlags: order.codRiskFlags
                }
            })
        } catch (error) {
            console.error('Error updating COD risk flag:', error)
            res.status(500).json({ error: 'Failed to update risk flag' })
        }
    }
)

// ─── Helper ──────────────────────────────────────────────────────────────────

function getAllowedTransitions(currentStatus) {
    const transitions = {
        placed: ['confirmed', 'cancelled'],
        confirmed: ['shipped', 'cancelled'],
        shipped: ['delivered', 'returned', 'cancelled'],
        delivered: ['returned'],
        returned: ['refunded'],
        cancelled: [],
        refunded: [],
        processing: ['shipped', 'cancelled'],
        packed: ['shipped', 'cancelled'],
        out_for_delivery: ['delivered', 'returned']
    }
    return transitions[currentStatus] || []
}

export default router
