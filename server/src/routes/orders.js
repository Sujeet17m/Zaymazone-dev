import { Router } from 'express'
import { z } from 'zod'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Cart from '../models/Cart.js'
import codService from '../services/codService.js'
import shippingService from '../services/shippingService.js'
import { calculateCancellationFee, processOrderCancellation } from '../services/cancellationFeeService.js'
import invoiceService from '../services/invoiceService.js'
import emailService from '../services/emailService.js'
import Artisan from '../models/Artisan.js'
import { authenticateToken } from '../middleware/firebase-auth.js'
import { requireAuth } from '../middleware/auth.js'
import { validate, idSchema, paginationSchema } from '../middleware/validation.js'
import { apiLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// ── Artisan-specific routes (use JWT auth from artisan signin) ─────────────────

// GET /api/orders/artisan-orders — orders containing this artisan's products
router.get('/artisan-orders', requireAuth, async (req, res) => {
	try {
		const artisanId = req.user.sub
		const { page = 1, limit = 20, status } = req.query

		const filter = { 'items.artisanId': artisanId }
		if (status) filter.status = status

		const orders = await Order.find(filter)
			.populate('userId', 'name email')
			.populate('items.productId', 'name images price')
			.sort({ createdAt: -1 })
			.limit(Number(limit))
			.skip((Number(page) - 1) * Number(limit))
			.lean()

		// Filter items to only show this artisan's items in each order
		const artisanOrders = orders.map(order => ({
			...order,
			items: order.items.filter(item =>
				item.artisanId?.toString() === artisanId.toString()
			)
		}))

		const total = await Order.countDocuments(filter)

		res.json({
			orders: artisanOrders,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
				total,
				pages: Math.ceil(total / limit)
			}
		})
	} catch (error) {
		console.error('Artisan orders error:', error)
		res.status(500).json({ error: 'Failed to fetch artisan orders' })
	}
})

// GET /api/orders/artisan-analytics — analytics for this artisan
router.get('/artisan-analytics', requireAuth, async (req, res) => {
	try {
		const artisanId = req.user.sub

		const [totalOrdersAgg, monthlyRevenue, topProducts] = await Promise.all([
			// Total orders and revenue
			Order.aggregate([
				{ $match: { 'items.artisanId': artisanId } },
				{ $unwind: '$items' },
				{ $match: { 'items.artisanId': artisanId } },
				{
					$group: {
						_id: '$_id',
						revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
						status: { $first: '$status' }
					}
				},
				{
					$group: {
						_id: null,
						totalOrders: { $sum: 1 },
						totalRevenue: { $sum: '$revenue' },
						ordersByStatus: {
							$push: { status: '$status' }
						}
					}
				}
			]),
			// Monthly revenue
			Order.aggregate([
				{ $match: { 'items.artisanId': artisanId } },
				{ $unwind: '$items' },
				{ $match: { 'items.artisanId': artisanId } },
				{
					$group: {
						_id: {
							year: { $year: '$createdAt' },
							month: { $month: '$createdAt' },
							orderId: '$_id'
						},
						revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
					}
				},
				{
					$group: {
						_id: { year: '$_id.year', month: '$_id.month' },
						revenue: { $sum: '$revenue' },
						orders: { $sum: 1 }
					}
				},
				{ $sort: { '_id.year': 1, '_id.month': 1 } },
				{ $limit: 12 }
			]),
			// Top products
			Order.aggregate([
				{ $match: { 'items.artisanId': artisanId } },
				{ $unwind: '$items' },
				{ $match: { 'items.artisanId': artisanId } },
				{
					$group: {
						_id: '$items.productId',
						name: { $first: '$items.name' },
						totalSold: { $sum: '$items.quantity' },
						revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
					}
				},
				{ $sort: { totalSold: -1 } },
				{ $limit: 5 }
			])
		])

		const summary = totalOrdersAgg[0] || { totalOrders: 0, totalRevenue: 0, ordersByStatus: [] }

		// Count by status
		const statusCounts = summary.ordersByStatus.reduce((acc, { status }) => {
			acc[status] = (acc[status] || 0) + 1
			return acc
		}, {})

		res.json({
			totalOrders: summary.totalOrders,
			totalRevenue: summary.totalRevenue,
			ordersByStatus: Object.entries(statusCounts).map(([_id, count]) => ({ _id, count })),
			monthlyRevenue,
			topProducts
		})
	} catch (error) {
		console.error('Artisan analytics error:', error)
		res.status(500).json({ error: 'Failed to fetch artisan analytics' })
	}
})


// Validation schemas
const shippingAddressSchema = z.object({
	fullName: z.string().min(1).max(100),
	phone: z.string().min(10).max(15),
	email: z.union([z.string().email().max(100), z.literal(''), z.undefined()]).optional(),
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

const createOrderSchema = z.object({
	items: z.array(orderItemSchema).min(1).max(20),
	shippingAddress: shippingAddressSchema,
	billingAddress: shippingAddressSchema.optional(), // Add billing address support
	paymentMethod: z.enum(['cod', 'upi_prepaid', 'zoho_card', 'zoho_upi', 'zoho_netbanking', 'zoho_wallet', 'razorpay', 'upi', 'paytm', 'paytm_upi', 'paytm_card', 'paytm_netbanking', 'paytm_wallet']),
	paymentId: z.string().optional(),
	zohoPaymentId: z.string().optional(), // Zoho specific payment ID
	zohoOrderId: z.string().optional(), // Zoho order reference
	notes: z.string().max(500).optional(),
	isGift: z.boolean().default(false),
	giftMessage: z.string().max(200).optional(),
	useShippingAsBilling: z.boolean().default(false) // Use shipping address as billing
})

const updateOrderStatusSchema = z.object({
	status: z.enum(['placed', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded']),
	note: z.string().max(200).optional(),
	trackingNumber: z.string().optional(),
	courierService: z.string().max(100).optional() // Add courier service support
})

// Apply rate limiting to all order routes
router.use(apiLimiter)

// Get user's orders
router.get('/my-orders',
	authenticateToken,
	validate(paginationSchema, 'query'),
	async (req, res) => {
		try {
			const { page, limit, sort, order } = req.validatedQuery
			const skip = (page - 1) * limit

			const sortObj = {}
			if (sort) {
				sortObj[sort] = order === 'asc' ? 1 : -1
			} else {
				sortObj.createdAt = -1
			}

			const orders = await Order.find({ userId: req.user._id })
				.sort(sortObj)
				.skip(skip)
				.limit(limit)
				.populate('items.productId', 'name images')
				.select('-__v')
				.lean()

			const total = await Order.countDocuments({ userId: req.user._id })

			res.json({
				orders,
				pagination: {
					page,
					limit,
					total,
					pages: Math.ceil(total / limit)
				}
			})
		} catch (error) {
			console.error('Error fetching orders:', error)
			res.status(500).json({ error: 'Failed to fetch orders' })
		}
	}
)

// Get single order
router.get('/:id',
	authenticateToken,
	validate(z.object({ id: idSchema }), 'params'),
	async (req, res) => {
		try {
			const order = await Order.findOne({
				_id: req.validatedParams.id,
				userId: req.user._id
			})
				.populate('items.productId', 'name images category')
				.populate('items.artisanId', 'name location')
				.lean()

			if (!order) {
				return res.status(404).json({ error: 'Order not found' })
			}

			res.json(order)
		} catch (error) {
			console.error('Error fetching order:', error)
			res.status(500).json({ error: 'Failed to fetch order' })
		}
	}
)

// Get invoice breakdown for a single order
router.get('/:id/invoice',
	authenticateToken,
	validate(z.object({ id: idSchema }), 'params'),
	async (req, res) => {
		try {
			const order = await Order.findOne({
				_id: req.validatedParams.id,
				userId: req.user._id
			}).lean()

			if (!order) {
				return res.status(404).json({ error: 'Order not found' })
			}

			const breakdown = shippingService.generateInvoiceBreakdown(order)
			res.json(breakdown)
		} catch (error) {
			console.error('Error generating invoice breakdown:', error)
			res.status(500).json({ error: 'Failed to generate invoice breakdown' })
		}
	}
)

// Create new order
router.post('/',
	authenticateToken,
	validate(createOrderSchema),
	async (req, res) => {
		try {
			const orderData = req.validatedBody
			const userId = req.user._id

			// Validate products and calculate totals
			const productIds = orderData.items.map(item => item.productId)
			const products = await Product.find({
				_id: { $in: productIds },
				isActive: true
			}).populate('artisanId', '_id')

			if (products.length !== orderData.items.length) {
				return res.status(400).json({ error: 'Some products are not available' })
			}

			// Check stock and build order items
			const orderItems = []
			let subtotal = 0

			for (const orderItem of orderData.items) {
				const product = products.find(p => p._id.toString() === orderItem.productId)

				if (product.stock < orderItem.quantity) {
					return res.status(400).json({
						error: `Insufficient stock for ${product.name}. Available: ${product.stock}`
					})
				}

				// Check if product has artisan information
				if (!product.artisanId) {
					return res.status(400).json({
						error: `Product ${product.name} is missing artisan information. Please contact support.`
					})
				}

				const itemPrice = product.price * orderItem.quantity
				subtotal += itemPrice

				orderItems.push({
					productId: product._id,
					name: product.name,
					price: product.price,
					quantity: orderItem.quantity,
					artisanId: product.artisanId._id,
					image: product.images[0] || ''
				})
			}

			// ── COD Eligibility Guard ──────────────────────────────────────────────
			if (orderData.paymentMethod === 'cod') {
				const deliveryState = orderData.shippingAddress.state
				const eligibility = await codService.isCodEligible(
					subtotal,
					deliveryState,
					userId.toString()
				)
				if (!eligibility.eligible) {
					return res.status(400).json({
						error: eligibility.reason,
						code: 'COD_INELIGIBLE',
						reason: eligibility.reason
					})
				}
			}

			// ── Module 3: Shipping Cost Engine ───────────────────────────────────
			// Build enriched items with weight for shipping calculation
			const shippingItems = orderItems.map(item => {
				const product = products.find(p => p._id.toString() === item.productId.toString())
				return {
					...item,
					weight: product?.weight || '',
				}
			})

			// Fetch dynamic COD fee if COD payment
			let codFeeOverride = null
			if (orderData.paymentMethod === 'cod') {
				try {
					const feeResult = await codService.calculateCodFee(
						subtotal,
						orderData.shippingAddress.state
					)
					codFeeOverride = feeResult.totalFee
				} catch {
					// Fall back to default in shippingService
				}
			}

			// Calculate shipping using zone + weight engine
			const shippingResult = shippingService.calculateShipping({
				items: shippingItems,
				subtotal,
				toState: orderData.shippingAddress.state,
				paymentMethod: orderData.paymentMethod,
				codFeeOverride,
			})

			const shippingCost = shippingResult.shippingCharge
			const codFee = shippingResult.codFee
			const tax = Math.round(subtotal * 0.05) // 5% GST
			const total = subtotal + shippingCost + codFee + tax

			// Generate unique order number
			const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

			// Create order
			const order = new Order({
				orderNumber,
				userId,
				items: orderItems,
				subtotal,
				shippingCost,
				tax,
				codFee,
				total,
				// ── Module 3: Shipping fields
				shippingZone: shippingResult.zone,
				totalWeight: shippingResult.totalWeight,
				shippingBreakdown: shippingResult.breakdown,
				courierFlags: shippingResult.courierFlags,
				shippingAddress: orderData.shippingAddress,
				billingAddress: orderData.useShippingAsBilling ? orderData.shippingAddress : orderData.billingAddress,
				paymentMethod: orderData.paymentMethod,
				paymentId: orderData.paymentId,
				zohoPaymentId: orderData.zohoPaymentId,
				zohoOrderId: orderData.zohoOrderId,
				paymentStatus: 'pending',
				notes: orderData.notes,
				isGift: orderData.isGift,
				giftMessage: orderData.giftMessage,
				statusHistory: [{
					status: 'placed',
					timestamp: new Date(),
					note: 'Order placed successfully'
				}]
			})

			await order.save()

			// ── Buyer: order confirmation email ─────────────────────────────────────────
			emailService.sendOrderConfirmation(order, req.user).catch(e =>
				console.error('[orders] order confirmation email error:', e.message)
			)

			// ── Module 5: Artisan new-order alerts + admin high-value alert ───────
			setImmediate(async () => {
				try {
					// Collect unique artisan IDs from this order
					const artisanIds = [...new Set(
						(order.items || []).map(i => i.artisanId?.toString()).filter(Boolean)
					)]
					if (artisanIds.length) {
						const artisans = await Artisan.find({ _id: { $in: artisanIds } }, 'name email businessInfo').lean()
						for (const artisan of artisans) {
							emailService.sendNewOrderToArtisan(order, artisan).catch(e =>
								console.error('[orders] artisan new-order email error:', e.message)
							)
						}
					}
					// Admin alert for high-value orders (total > ₹5,000)
					if ((order.total ?? 0) >= 5000) {
						emailService.sendAdminOrderAlert('high_value', order, {
							shipping_zone:  order.shippingZone  || 'N/A',
							payment_method: order.paymentMethod || 'N/A',
						}).catch(e => console.error('[orders] admin high-value alert error:', e.message))
					}
				} catch (alertErr) {
					console.error('[orders] Module 5 post-order alerts error:', alertErr.message)
				}
			})

			// ── Module 3: Generate sale invoice (non-blocking) ─────────────────────
			setImmediate(async () => {
				try {
					await invoiceService.generateForOrder(order)
				} catch (invErr) {
					console.error('[invoiceService] Failed to generate sale invoice:', invErr)
				}
			})

			// Update product stock
			for (const item of orderItems) {
				await Product.findByIdAndUpdate(
					item.productId,
					{
						$inc: {
							stock: -item.quantity,
							salesCount: item.quantity
						}
					}
				)
			}

			// Clear cart after successful order
			await Cart.findOneAndUpdate(
				{ userId },
				{ $set: { items: [] } }
			)

			// Populate order for response
			const populatedOrder = await Order.findById(order._id)
				.populate('items.productId', 'name images')
				.lean()

			res.status(201).json(populatedOrder)
		} catch (error) {
			console.error('Error creating order:', error)
			res.status(500).json({ error: 'Failed to create order' })
		}
	}
)

// ── Module 5: Cancellation Fee Preview (GET before committing) ─────────────────────
// Returns the fee breakdown for a given order without mutating anything.
// The frontend shows this in a confirmation dialog before the user proceeds.
router.get('/:id/cancellation-preview',
	authenticateToken,
	validate(z.object({ id: idSchema }), 'params'),
	async (req, res) => {
		try {
			const order = await Order.findOne({
				_id: req.validatedParams.id,
				userId: req.user._id,
			})

			if (!order) {
				return res.status(404).json({ error: 'Order not found' })
			}

			const cancellableStatuses = ['placed', 'confirmed']
			if (!cancellableStatuses.includes(order.status)) {
				return res.status(400).json({
					error: 'Order cannot be cancelled at this stage',
					status: order.status,
				})
			}

			const feeBreakdown = calculateCancellationFee(order)

			return res.json({
				orderNumber:      order.orderNumber,
				orderStatus:      order.status,
				paymentMethod:    order.paymentMethod,
				...feeBreakdown,
			})
		} catch (error) {
			console.error('Error calculating cancellation fee preview:', error)
			res.status(500).json({ error: 'Failed to calculate cancellation fee' })
		}
	}
)

// ── Module 5: Cancel order ────────────────────────────────────────────────────────
// Buyers can cancel when status is 'placed' or 'confirmed'.
// The cancellation fee engine computes the fee, adjusts the refund, and logs
// immutable ledger entries so accounting stays complete.
router.patch('/:id/cancel',
	authenticateToken,
	validate(z.object({ id: idSchema }), 'params'),
	async (req, res) => {
		try {
			const { reason } = req.body

			const { order, feeBreakdown } = await processOrderCancellation(
				req.validatedParams.id,
				reason,
				req.user._id,
				{ isAdmin: false, waiveFee: false },
			)

			// ── Module 5: Cancellation emails (buyer rejection + artisan notice) ───
			setImmediate(async () => {
				try {
					// Buyer: rejection / refund awareness
					emailService.sendOrderRejectionNotification(order, req.user, reason || 'Cancelled by buyer')
						.catch(e => console.error('[orders] cancellation buyer email error:', e.message))
					// Artisan(s): cancellation notice
					const artisanIds = [...new Set(
						(order.items || []).map(i => i.artisanId?.toString()).filter(Boolean)
					)]
					if (artisanIds.length) {
						const artisans = await Artisan.find({ _id: { $in: artisanIds } }, 'name email businessInfo').lean()
						for (const artisan of artisans) {
							emailService.sendOrderCancelledToArtisan(order, artisan, reason || 'Cancelled by buyer', 'buyer', feeBreakdown)
								.catch(e => console.error('[orders] artisan cancellation email error:', e.message))
						}
					}
				} catch (alertErr) {
					console.error('[orders] Module 5 cancellation alerts error:', alertErr.message)
				}
			})

			return res.json({
				message:     'Order cancelled successfully',
				order,
				feeBreakdown,
			})
		} catch (error) {
			console.error('Error cancelling order:', error)
			const statusCode = error.message?.includes('not found') ? 404
				: error.message?.includes('cannot be cancelled') ? 400
				: 500
			return res.status(statusCode).json({ error: error.message || 'Failed to cancel order' })
		}
	}
)

// Admin routes for order management
router.get('/admin/all',
	authenticateToken,
	validate(paginationSchema, 'query'),
	async (req, res) => {
		try {
			const { page, limit, sort, order } = req.validatedQuery
			const skip = (page - 1) * limit

			const sortObj = {}
			if (sort) {
				sortObj[sort] = order === 'asc' ? 1 : -1
			} else {
				sortObj.createdAt = -1
			}

			const orders = await Order.find()
				.sort(sortObj)
				.skip(skip)
				.limit(limit)
				.populate('userId', 'name email')
				.populate('items.productId', 'name images')
				.select('-__v')
				.lean()

			const total = await Order.countDocuments()

			res.json({
				orders,
				pagination: {
					page,
					limit,
					total,
					pages: Math.ceil(total / limit)
				}
			})
		} catch (error) {
			console.error('Error fetching all orders:', error)
			res.status(500).json({ error: 'Failed to fetch orders' })
		}
	}
)

// Admin update order status
router.patch('/:id/status',
	authenticateToken,
	validate(z.object({ id: idSchema }), 'params'),
	validate(updateOrderStatusSchema),
	async (req, res) => {
		try {
			const { status, note, trackingNumber, courierService } = req.validatedBody

			const order = await Order.findById(req.validatedParams.id)

			if (!order) {
				return res.status(404).json({ error: 'Order not found' })
			}

			// Update order
			order.status = status
			if (trackingNumber) order.trackingNumber = trackingNumber
			if (courierService) order.courierService = courierService

			order.statusHistory.push({
				status,
				timestamp: new Date(),
				note: note || `Status updated to ${status}`
			})

			if (status === 'shipped') {
				// ── Shipment Payment Gate ──────────────────────────────────────────
				// Block shipping for non-COD orders until payment is verified
				if (order.paymentMethod !== 'cod' && order.paymentStatus !== 'paid') {
					return res.status(400).json({
						error: 'Cannot ship order: payment has not been verified yet.',
						code: 'PAYMENT_NOT_VERIFIED',
						paymentStatus: order.paymentStatus,
						paymentMethod: order.paymentMethod
					})
				}
				order.shippedAt = new Date()
			}

			if (status === 'delivered') {
				order.deliveredAt = new Date()
				order.actualDelivery = new Date()

				// COD-specific: mark cash collected and payment fulfilled
				if (order.paymentMethod === 'cod') {
					order.codCollectedAt = new Date()
					order.paymentStatus = 'paid'
					order.paidAt = new Date()
				}
			}

			if (status === 'cancelled') {
				// ── Module 5: Admin cancellation uses the fee engine ───────────────
				// waiveFee=true for admin-initiated cancellations (platform at fault)
				const { order: cancelledOrder, feeBreakdown } = await processOrderCancellation(
					order._id,
					note || 'Cancelled by admin',
					req.user._id,
					{ isAdmin: true, waiveFee: true, adminId: req.user._id },
				)
				// Module 5: buyer rejection + artisan notice + admin alert
				setImmediate(async () => {
					try {
						const buyer = cancelledOrder.userId || {}
						if (buyer.email) {
							emailService.sendOrderRejectionNotification(cancelledOrder, buyer, note || 'Cancelled by admin')
								.catch(e => console.error('[orders:admin] buyer rejection email error:', e.message))
						}
						const artisanIds = [...new Set(
							(cancelledOrder.items || []).map(i => i.artisanId?.toString()).filter(Boolean)
						)]
						if (artisanIds.length) {
							const artisans = await Artisan.find({ _id: { $in: artisanIds } }, 'name email businessInfo').lean()
							for (const artisan of artisans) {
								emailService.sendOrderCancelledToArtisan(cancelledOrder, artisan, note || 'Cancelled by admin', 'admin', feeBreakdown)
									.catch(e => console.error('[orders:admin] artisan cancellation email error:', e.message))
							}
						}
						// Admin self-alert for visibility in audit trail
						emailService.sendAdminOrderAlert('artisan_cancellation', cancelledOrder, {
							cancelled_by: 'admin',
							reason:        note || 'Cancelled by admin',
						}).catch(e => console.error('[orders:admin] admin cancel alert error:', e.message))
					} catch (alertErr) {
						console.error('[orders:admin] Module 5 cancel alerts error:', alertErr.message)
					}
				})
				return res.json({
					message:     'Order cancelled successfully',
					order:       cancelledOrder,
					feeBreakdown,
				})
			}

			await order.save()

			// ── Module 5: Status-change emails ─────────────────────────────────────────
			setImmediate(async () => {
				try {
					const savedOrder = order
					// Buyer: status update email for every transition
					if (savedOrder.userId?.email) {
						emailService.sendOrderStatusUpdate(
							savedOrder,
							{ email: savedOrder.userId.email, name: savedOrder.userId.name || 'Customer' },
							status,
							trackingNumber ? { trackingNumber, courierService } : {}
						).catch(e => console.error('[orders:status] buyer status email error:', e.message))
					}
					// On returned—notify each artisan of the return request
					if (status === 'returned') {
						const artisanIds = [...new Set(
							(savedOrder.items || []).map(i => i.artisanId?.toString()).filter(Boolean)
						)]
						if (artisanIds.length) {
							const artisans = await Artisan.find({ _id: { $in: artisanIds } }, 'name email businessInfo').lean()
							for (const artisan of artisans) {
								emailService.sendReturnRequestToArtisan(savedOrder, artisan, note || 'Return requested', {})
									.catch(e => console.error('[orders:status] artisan return email error:', e.message))
							}
						}
						// Admin: return spike alert
						emailService.sendAdminOrderAlert('return_spike', savedOrder, {
							return_reason: note || 'Return requested',
						}).catch(e => console.error('[orders:status] admin return alert error:', e.message))
					}
					// On refunded—buyer refund notification
					if (status === 'refunded' && savedOrder.userId?.email) {
						emailService.sendRefundNotification(
							savedOrder,
							{ email: savedOrder.userId.email, name: savedOrder.userId.name || 'Customer' },
							{ refundId: `REF-${savedOrder.orderNumber}`, amount: savedOrder.refundableAmount ?? savedOrder.total ?? 0 }
						).catch(e => console.error('[orders:status] buyer refund email error:', e.message))
					}
				} catch (alertErr) {
					console.error('[orders:status] Module 5 status-change alerts error:', alertErr.message)
				}
			})

			res.json({ message: 'Order status updated successfully', order })
		} catch (error) {
			console.error('Error updating order status:', error)
			res.status(500).json({ error: 'Failed to update order status' })
		}
	}
)

// Artisan routes
// Get artisan's orders
router.get('/artisan/my-orders',
	authenticateToken,
	validate(paginationSchema, 'query'),
	async (req, res) => {
		try {
			const { page, limit, sort, order } = req.validatedQuery
			const skip = (page - 1) * limit

			const sortObj = {}
			if (sort) {
				sortObj[sort] = order === 'asc' ? 1 : -1
			} else {
				sortObj.createdAt = -1
			}

			// Find orders where any item belongs to this artisan
			const orders = await Order.find({ 'items.artisanId': req.user._id })
				.sort(sortObj)
				.skip(skip)
				.limit(limit)
				.populate('items.productId', 'name images')
				.populate('userId', 'name email')
				.select('-__v')
				.lean()

			const total = await Order.countDocuments({ 'items.artisanId': req.user._id })

			res.json({
				orders,
				pagination: {
					page,
					limit,
					total,
					pages: Math.ceil(total / limit)
				}
			})
		} catch (error) {
			console.error('Error fetching artisan orders:', error)
			res.status(500).json({ error: 'Failed to fetch orders' })
		}
	}
)

// Get artisan analytics
router.get('/artisan/analytics',
	authenticateToken,
	async (req, res) => {
		try {
			const artisanId = req.user._id
			const { startDate, endDate } = req.query

			// Build date filter
			let dateFilter = {}
			if (startDate || endDate) {
				dateFilter.createdAt = {}
				if (startDate) dateFilter.createdAt.$gte = new Date(startDate)
				if (endDate) dateFilter.createdAt.$lte = new Date(endDate)
			}

			// Get total orders for this artisan
			const totalOrders = await Order.countDocuments({
				'items.artisanId': artisanId,
				...dateFilter
			})

			// Get total revenue for this artisan
			const revenueResult = await Order.aggregate([
				{ $unwind: '$items' },
				{
					$match: {
						'items.artisanId': artisanId,
						...(startDate || endDate ? { createdAt: dateFilter.createdAt } : {})
					}
				},
				{ $group: { _id: null, total: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } }
			])

			const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0

			// Get orders by status
			const ordersByStatus = await Order.aggregate([
				{ $unwind: '$items' },
				{
					$match: {
						'items.artisanId': artisanId,
						...(startDate || endDate ? { createdAt: dateFilter.createdAt } : {})
					}
				},
				{ $group: { _id: '$status', count: { $sum: 1 } } }
			])

			// Get monthly revenue for the last 12 months (or within date range)
			let monthlyRevenueQuery = [
				{ $unwind: '$items' },
				{
					$match: {
						'items.artisanId': artisanId,
						...(startDate || endDate ? { createdAt: dateFilter.createdAt } : { createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } })
					}
				},
				{
					$group: {
						_id: {
							year: { $year: '$createdAt' },
							month: { $month: '$createdAt' }
						},
						revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
						orders: { $sum: 1 }
					}
				},
				{ $sort: { '_id.year': 1, '_id.month': 1 } }
			]

			const monthlyRevenue = await Order.aggregate(monthlyRevenueQuery)

			// Get top products
			const topProducts = await Order.aggregate([
				{ $unwind: '$items' },
				{
					$match: {
						'items.artisanId': artisanId,
						...(startDate || endDate ? { createdAt: dateFilter.createdAt } : {})
					}
				},
				{
					$group: {
						_id: '$items.productId',
						name: { $first: '$items.name' },
						totalSold: { $sum: '$items.quantity' },
						revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
					}
				},
				{ $sort: { revenue: -1 } },
				{ $limit: 10 }
			])

			// Get daily revenue for chart (last 30 days or within date range)
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
			const dailyRevenueQuery = [
				{ $unwind: '$items' },
				{
					$match: {
						'items.artisanId': artisanId,
						createdAt: startDate ? dateFilter.createdAt : { $gte: thirtyDaysAgo }
					}
				},
				{
					$group: {
						_id: {
							$dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
						},
						revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
						orders: { $sum: 1 }
					}
				},
				{ $sort: { '_id': 1 } }
			]

			const dailyRevenue = await Order.aggregate(dailyRevenueQuery)

			res.json({
				totalOrders,
				totalRevenue,
				ordersByStatus,
				monthlyRevenue,
				topProducts,
				dailyRevenue,
				dateRange: {
					startDate: startDate || null,
					endDate: endDate || null
				}
			})
		} catch (error) {
			console.error('Error fetching artisan analytics:', error)
			res.status(500).json({ error: 'Failed to fetch analytics' })
		}
	}
)

// Get artisan customers
router.get('/artisan/customers',
	authenticateToken,
	validate(paginationSchema, 'query'),
	async (req, res) => {
		try {
			const { page, limit } = req.validatedQuery
			const skip = (page - 1) * limit
			const artisanId = req.user._id

			// Get unique customers who have ordered from this artisan
			const customers = await Order.aggregate([
				{ $unwind: '$items' },
				{ $match: { 'items.artisanId': artisanId } },
				{
					$group: {
						_id: '$userId',
						name: { $first: '$shippingAddress.fullName' },
						email: { $first: '$shippingAddress.email' },
						phone: { $first: '$shippingAddress.phone' },
						totalOrders: { $sum: 1 },
						totalSpent: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
						lastOrderDate: { $max: '$createdAt' },
						firstOrderDate: { $min: '$createdAt' },
						avgOrderValue: { $avg: { $multiply: ['$items.price', '$items.quantity'] } },
						orderDates: { $push: '$createdAt' }
					}
				},
				{ $sort: { lastOrderDate: -1 } },
				{ $skip: skip },
				{ $limit: limit }
			])

			// Calculate additional metrics for each customer
			const enhancedCustomers = customers.map(customer => {
				const daysSinceFirstOrder = Math.floor((new Date() - new Date(customer.firstOrderDate)) / (1000 * 60 * 60 * 24));
				const daysSinceLastOrder = Math.floor((new Date() - new Date(customer.lastOrderDate)) / (1000 * 60 * 60 * 24));

				// Determine customer segment
				let segment = 'New';
				if (customer.totalOrders >= 5 && customer.totalSpent > 5000) {
					segment = 'VIP';
				} else if (customer.totalOrders >= 3) {
					segment = 'Regular';
				} else if (daysSinceLastOrder > 90) {
					segment = 'At Risk';
				}

				// Calculate loyalty score (simple algorithm)
				const loyaltyScore = Math.min(100,
					(customer.totalOrders * 10) +
					(Math.max(0, 100 - daysSinceLastOrder)) +
					(Math.min(50, customer.totalSpent / 100))
				);

				return {
					...customer,
					segment,
					loyaltyScore: Math.round(loyaltyScore),
					daysSinceLastOrder,
					daysSinceFirstOrder,
					avgOrderValue: Math.round(customer.avgOrderValue)
				};
			});

			const total = await Order.distinct('userId', { 'items.artisanId': artisanId }).then(ids => ids.length)

			res.json({
				customers: enhancedCustomers,
				pagination: {
					page,
					limit,
					total,
					pages: Math.ceil(total / limit)
				}
			})
		} catch (error) {
			console.error('Error fetching artisan customers:', error)
			res.status(500).json({ error: 'Failed to fetch customers' })
		}
	}
)

export default router