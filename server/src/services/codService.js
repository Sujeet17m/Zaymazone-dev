import Order from '../models/Order.js'
import User from '../models/User.js'
import CodConfig from '../models/CodConfig.js'

/**
 * COD Service - Core business logic for Cash on Delivery
 * Handles fee calculation, eligibility checks, and risk assessment
 */
class CodService {
    /**
     * Get the active COD configuration, or return sensible defaults.
     * @returns {Promise<Object>} Active config document or default values
     */
    async getActiveConfig() {
        try {
            const config = await CodConfig.findOne({ isActive: true }).sort({ createdAt: -1 })
            if (config) return config

            // Return a plain default object if no config exists in DB
            return {
                baseFee: 25,
                percentageFee: 0,
                maxFee: 100,
                minOrderAmount: 0,
                maxOrderAmount: 50000,
                applicableStates: [],
                blockedStates: [],
                riskConfig: {
                    maxReturnCount: 3,
                    newAccountDays: 7,
                    newAccountHighValueThreshold: 10000,
                    rapidOrderWindowMinutes: 60,
                    rapidOrderCount: 2
                }
            }
        } catch (error) {
            console.error('Error fetching COD config:', error)
            // Fallback defaults on DB error
            return {
                baseFee: 25,
                percentageFee: 0,
                maxFee: 100,
                minOrderAmount: 0,
                maxOrderAmount: 50000,
                applicableStates: [],
                blockedStates: [],
                riskConfig: {
                    maxReturnCount: 3,
                    newAccountDays: 7,
                    newAccountHighValueThreshold: 10000,
                    rapidOrderWindowMinutes: 60,
                    rapidOrderCount: 2
                }
            }
        }
    }

    /**
     * Calculate COD fee for a given order subtotal and state.
     * Formula: totalFee = min(baseFee + subtotal * percentageFee/100, maxFee)
     *
     * @param {number} subtotal - Order subtotal in INR
     * @param {string} [state] - Delivery state (for future per-state config)
     * @param {Object} [config] - Pre-loaded config (optional, avoids extra DB call)
     * @returns {Promise<Object>} Fee breakdown
     */
    async calculateCodFee(subtotal, state = null, config = null) {
        const cfg = config || await this.getActiveConfig()

        const baseFee = cfg.baseFee || 25
        const percentageFee = cfg.percentageFee || 0
        const maxFee = cfg.maxFee || 100

        const percentageAmount = Math.round((subtotal * percentageFee) / 100)
        const rawTotal = baseFee + percentageAmount
        const totalFee = Math.min(rawTotal, maxFee)

        return {
            baseFee,
            percentageFee,
            percentageAmount,
            totalFee,
            breakdown: {
                description: 'COD Handling Fee',
                baseFee: `₹${baseFee} (fixed)`,
                percentagePart: percentageFee > 0
                    ? `₹${percentageAmount} (${percentageFee}% of ₹${subtotal})`
                    : null,
                capApplied: rawTotal > maxFee,
                finalFee: totalFee
            }
        }
    }

    /**
     * Check if COD is eligible for a given order.
     *
     * @param {number} subtotal - Order subtotal in INR
     * @param {string} [state] - Delivery state
     * @param {string} [userId] - User ID to check risk status
     * @returns {Promise<Object>} { eligible: boolean, reason: string|null }
     */
    async isCodEligible(subtotal, state = null, userId = null) {
        const config = await this.getActiveConfig()

        // Check order amount limits
        if (subtotal < config.minOrderAmount) {
            return {
                eligible: false,
                reason: `COD is not available for orders below ₹${config.minOrderAmount}`
            }
        }

        if (subtotal > config.maxOrderAmount) {
            return {
                eligible: false,
                reason: `COD is not available for orders above ₹${config.maxOrderAmount}`
            }
        }

        // Check state restrictions
        if (state) {
            const normalizedState = state.trim().toLowerCase()

            if (config.blockedStates && config.blockedStates.length > 0) {
                const isBlocked = config.blockedStates.some(
                    s => s.trim().toLowerCase() === normalizedState
                )
                if (isBlocked) {
                    return {
                        eligible: false,
                        reason: `COD is not available in ${state}`
                    }
                }
            }

            if (config.applicableStates && config.applicableStates.length > 0) {
                const isApplicable = config.applicableStates.some(
                    s => s.trim().toLowerCase() === normalizedState
                )
                if (!isApplicable) {
                    return {
                        eligible: false,
                        reason: `COD is not available in ${state}`
                    }
                }
            }
        }

        // Check user risk status
        if (userId) {
            const riskProfile = await this.assessCodRisk(userId, { subtotal })
            if (riskProfile.isHighRisk) {
                return {
                    eligible: false,
                    reason: `COD is not available for your account due to: ${riskProfile.flagReason}`
                }
            }
        }

        return { eligible: true, reason: null }
    }

    /**
     * Assess COD risk for a user placing a new order.
     * Rules:
     *  1. Multiple returns: ≥ riskConfig.maxReturnCount returned COD orders → high risk
     *  2. New account + high-value order → flagged
     *  3. Rapid order placement: multiple COD orders in a short window → flagged
     *
     * @param {string} userId - MongoDB User ID
     * @param {Object} orderData - Incoming order data { subtotal }
     * @returns {Promise<Object>} Risk assessment result
     */
    async assessCodRisk(userId, orderData = {}) {
        const config = await this.getActiveConfig()
        const riskCfg = config.riskConfig || {}

        const maxReturnCount = riskCfg.maxReturnCount || 3
        const newAccountDays = riskCfg.newAccountDays || 7
        const newAccountHighValueThreshold = riskCfg.newAccountHighValueThreshold || 3000
        const rapidOrderWindowMinutes = riskCfg.rapidOrderWindowMinutes || 60
        const rapidOrderCount = riskCfg.rapidOrderCount || 2

        let isFlagged = false
        let isHighRisk = false
        let flagReason = null
        let returnCount = 0

        try {
            // Rule 1: Count returned COD orders for this user
            returnCount = await Order.countDocuments({
                userId,
                paymentMethod: 'cod',
                status: 'returned'
            })

            if (returnCount >= maxReturnCount) {
                isFlagged = true
                isHighRisk = true
                flagReason = `User has ${returnCount} returned COD orders (threshold: ${maxReturnCount})`
                return { isFlagged, isHighRisk, flagReason, returnCount }
            }

            // Rule 2: New account placing high-value COD order
            const user = await User.findById(userId).select('createdAt').lean()
            if (user) {
                const accountAgeDays = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                const subtotal = orderData.subtotal || 0

                if (accountAgeDays < newAccountDays && subtotal > newAccountHighValueThreshold) {
                    isFlagged = true
                    flagReason = `New account (${Math.floor(accountAgeDays)} days old) placing high-value COD order (₹${subtotal})`
                    return { isFlagged, isHighRisk, flagReason, returnCount }
                }
            }

            // Rule 3: Rapid COD order placement
            const windowStart = new Date(Date.now() - rapidOrderWindowMinutes * 60 * 1000)
            const recentCodOrders = await Order.countDocuments({
                userId,
                paymentMethod: 'cod',
                createdAt: { $gte: windowStart }
            })

            if (recentCodOrders >= rapidOrderCount) {
                isFlagged = true
                flagReason = `${recentCodOrders} COD orders placed within ${rapidOrderWindowMinutes} minutes`
                return { isFlagged, isHighRisk, flagReason, returnCount }
            }

        } catch (error) {
            console.error('Error assessing COD risk:', error)
            // Don't block order on assessment error
        }

        return { isFlagged, isHighRisk, flagReason, returnCount }
    }

    /**
     * Validate a COD-specific status transition.
     * COD orders follow a strict lifecycle: placed → confirmed → shipped → delivered → returned → refunded
     *
     * @param {string} currentStatus - Current order status
     * @param {string} newStatus - Proposed new status
     * @returns {boolean}
     */
    isValidCodStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            placed: ['confirmed', 'cancelled'],
            confirmed: ['shipped', 'cancelled'],
            shipped: ['delivered', 'returned', 'cancelled'],
            delivered: ['returned'],
            returned: ['refunded'],
            cancelled: [],   // terminal
            refunded: [],    // terminal
            // Legacy statuses that may exist
            processing: ['shipped', 'cancelled'],
            packed: ['shipped', 'cancelled'],
            out_for_delivery: ['delivered', 'returned']
        }

        return validTransitions[currentStatus]?.includes(newStatus) ?? false
    }

    /**
     * Get a full COD charge breakdown for an order.
     *
     * @param {Object} order - Mongoose order document or plain object
     * @returns {Object} Charge breakdown
     */
    getCodChargeBreakdown(order) {
        const subtotal = order.subtotal || 0
        const shippingCost = order.shippingCost || 0
        const tax = order.tax || 0
        const discount = order.discount || 0
        const codFee = order.codFee || 0
        const total = order.total || 0

        return {
            subtotal,
            shippingCost,
            tax,
            discount,
            codFee,
            total,
            breakdown: [
                { label: 'Subtotal', amount: subtotal },
                { label: 'Shipping', amount: shippingCost },
                { label: 'Tax (5%)', amount: tax },
                ...(discount > 0 ? [{ label: 'Discount', amount: -discount }] : []),
                { label: 'COD Handling Fee', amount: codFee },
                { label: 'Total Payable (Cash)', amount: total }
            ]
        }
    }

    /**
     * Re-assess risk after a return event and update the order's risk flags.
     *
     * @param {string} userId - User ID
     * @param {string} orderId - Order ID that was returned
     * @returns {Promise<Object>} Updated risk assessment
     */
    async handleReturnRiskUpdate(userId, orderId) {
        const risk = await this.assessCodRisk(userId, {})

        // Update the returned order's risk flags
        await Order.findByIdAndUpdate(orderId, {
            'codRiskFlags.isFlagged': risk.isFlagged,
            'codRiskFlags.isHighRisk': risk.isHighRisk,
            'codRiskFlags.flagReason': risk.flagReason,
            'codRiskFlags.returnCount': risk.returnCount,
            ...(risk.isFlagged ? { 'codRiskFlags.flaggedAt': new Date() } : {})
        })

        return risk
    }
}

export default new CodService()
