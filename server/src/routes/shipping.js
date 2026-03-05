/**
 * shipping.js — Route: /api/shipping
 * ─────────────────────────────────────────────────────────────────────────────
 * Module 3: Logistics & Shipping Cost Engine
 *
 * Endpoints:
 *   POST /api/shipping/estimate  – Calculate shipping for a cart/order (public)
 *   GET  /api/shipping/zones     – Return zone reference data
 *   GET  /api/shipping/rates     – Return full rate table
 */

import { Router } from 'express'
import { z } from 'zod'
import Product from '../models/Product.js'
import shippingService from '../services/shippingService.js'
import codService from '../services/codService.js'
import { validate } from '../middleware/validation.js'
import { apiLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// Apply rate limiting
router.use(apiLimiter)

// ─── Validation Schemas ───────────────────────────────────────────────────────

const estimateSchema = z.object({
    items: z.array(z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(100),
    })).min(1, 'At least one item is required'),
    toState: z.string().min(1, 'Destination state is required'),
    paymentMethod: z.enum([
        'cod', 'upi', 'upi_prepaid', 'zoho_card', 'zoho_upi',
        'zoho_netbanking', 'zoho_wallet', 'paytm', 'paytm_upi',
        'paytm_card', 'paytm_netbanking', 'paytm_wallet'
    ]).default('upi_prepaid'),
    userId: z.string().optional(),
})

// ─── POST /api/shipping/estimate ─────────────────────────────────────────────

/**
 * Public endpoint — estimate shipping cost for a set of items.
 * Used by Checkout.tsx to show live shipping cost before order placement.
 *
 * Body: { items: [{productId, quantity}], toState, paymentMethod, userId? }
 *
 * Returns:
 * {
 *   shippingCharge, codFee, totalWeight, zone, zoneLabel,
 *   isFreeShipping, freeShippingThreshold, estimatedDeliveryDays,
 *   breakdown: { ... },
 *   courierFlags: { isPrepaid, isCod, bookingType, suggestedCourier },
 *   subtotal
 * }
 */
router.post('/estimate', validate(estimateSchema), async (req, res) => {
    try {
        const { items, toState, paymentMethod, userId } = req.validatedBody

        // Fetch product details (weight, price, name)
        const productIds = items.map(i => i.productId)
        const products = await Product.find({
            _id: { $in: productIds },
            isActive: true,
        }).select('_id name price weight')

        if (products.length === 0) {
            return res.status(400).json({ error: 'No valid products found' })
        }

        // Build enriched items with weight + calculate subtotal
        let subtotal = 0
        const enrichedItems = []

        for (const item of items) {
            const product = products.find(p => p._id.toString() === item.productId)
            if (!product) continue

            subtotal += product.price * item.quantity
            enrichedItems.push({
                productId: item.productId,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
                weight: product.weight || '',
            })
        }

        if (enrichedItems.length === 0) {
            return res.status(400).json({ error: 'No valid products found' })
        }

        // Fetch dynamic COD fee from codService if COD payment
        let codFeeOverride = null
        if (paymentMethod === 'cod') {
            try {
                const feeResult = await codService.calculateCodFee(subtotal, toState)
                codFeeOverride = feeResult.totalFee
            } catch {
                // Fall back to default COD fee in shippingService
            }
        }

        // Calculate shipping
        const result = shippingService.calculateShipping({
            items: enrichedItems,
            subtotal,
            toState,
            paymentMethod,
            codFeeOverride,
        })

        return res.json({
            success: true,
            subtotal,
            ...result,
            itemCount: enrichedItems.length,
        })
    } catch (error) {
        console.error('Shipping estimate error:', error)
        return res.status(500).json({ error: 'Failed to calculate shipping estimate' })
    }
})

// ─── GET /api/shipping/zones ──────────────────────────────────────────────────

/**
 * Return zone classification map for reference.
 * Useful for admin dashboards and documentation.
 */
router.get('/zones', (req, res) => {
    const zones = {}
    for (const [state, zone] of Object.entries(shippingService.STATE_ZONES)) {
        if (!zones[zone]) zones[zone] = []
        zones[zone].push(state)
    }

    return res.json({
        success: true,
        originState: shippingService.ORIGIN_STATE,
        zones,
        zoneDetails: shippingService.ZONE_RATES,
    })
})

// ─── GET /api/shipping/rates ──────────────────────────────────────────────────

/**
 * Return full shipping rate table.
 * Useful for showing customers expected shipping costs.
 */
router.get('/rates', (req, res) => {
    return res.json({
        success: true,
        rates: shippingService.ZONE_RATES,
        courierRules: shippingService.COURIER_RULES,
        defaultCodFee: shippingService.DEFAULT_COD_FEE,
        note: 'Free shipping applies when subtotal meets the zone threshold',
    })
})

export default router
