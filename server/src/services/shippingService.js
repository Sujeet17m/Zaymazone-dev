/**
 * shippingService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Module 3: Logistics & Shipping Cost Engine
 *
 * Reusable utility module for:
 *  - Weight-based shipping calculation
 *  - Zone-based (inter-state / intra-state) rate differentiation
 *  - Charge separation: product price | shipping fee | COD fee
 *  - Courier booking flags: prepaid vs COD shipment
 *  - Invoice-level breakdown generation
 */

// ─── Zone Configuration ───────────────────────────────────────────────────────

/**
 * Indian state → zone mapping.
 * Zones: local | metro | tier2 | rest_of_india | remote
 *
 * 'local'         – same city / same state (intra-state)
 * 'metro'         – major metro hubs (Delhi, Mumbai, Bangalore, etc.)
 * 'tier2'         – large tier-2 cities / states
 * 'rest_of_india' – standard inter-state
 * 'remote'        – North-East, J&K, Andaman, Lakshadweep
 */
const STATE_ZONES = {
    // Metro states / UTs
    'delhi': 'metro',
    'maharashtra': 'metro',
    'karnataka': 'metro',
    'tamil nadu': 'metro',
    'telangana': 'metro',
    'west bengal': 'metro',
    'gujarat': 'metro',

    // Tier-2 states
    'rajasthan': 'tier2',
    'madhya pradesh': 'tier2',
    'uttar pradesh': 'tier2',
    'andhra pradesh': 'tier2',
    'kerala': 'tier2',
    'haryana': 'tier2',
    'punjab': 'tier2',
    'odisha': 'tier2',
    'jharkhand': 'tier2',
    'chhattisgarh': 'tier2',
    'bihar': 'tier2',
    'assam': 'tier2',
    'goa': 'tier2',
    'himachal pradesh': 'tier2',
    'uttarakhand': 'tier2',

    // Remote / difficult terrain
    'jammu and kashmir': 'remote',
    'ladakh': 'remote',
    'arunachal pradesh': 'remote',
    'nagaland': 'remote',
    'manipur': 'remote',
    'mizoram': 'remote',
    'tripura': 'remote',
    'meghalaya': 'remote',
    'sikkim': 'remote',
    'andaman and nicobar islands': 'remote',
    'lakshadweep': 'remote',
}

/**
 * Shipping rates per zone.
 * baseCharge: flat base for first 500g
 * perExtra500g: added per additional 500g (or part thereof)
 * freeShippingThreshold: subtotal above which shipping is waived
 */
const ZONE_RATES = {
    local: {
        label: 'Local / Intra-State',
        baseCharge: 40,
        perExtra500g: 10,
        freeShippingThreshold: 1500,
        estimatedDays: '1-2',
    },
    metro: {
        label: 'Metro City',
        baseCharge: 60,
        perExtra500g: 15,
        freeShippingThreshold: 1500,
        estimatedDays: '2-3',
    },
    tier2: {
        label: 'Tier-2 City',
        baseCharge: 80,
        perExtra500g: 20,
        freeShippingThreshold: 1500,
        estimatedDays: '3-5',
    },
    rest_of_india: {
        label: 'Rest of India',
        baseCharge: 80,
        perExtra500g: 20,
        freeShippingThreshold: 1500,
        estimatedDays: '4-6',
    },
    remote: {
        label: 'Remote / Hill Area',
        baseCharge: 120,
        perExtra500g: 30,
        freeShippingThreshold: 2000,
        estimatedDays: '7-10',
    },
}

/** Default COD handling fee (used if codService is unavailable) */
const DEFAULT_COD_FEE = 25

/** Default weight in grams when product weight is missing/unparseable */
const DEFAULT_ITEM_WEIGHT_GRAMS = 500

/** Origin state for Zaymazone (artisan hub) */
const ORIGIN_STATE = 'rajasthan'

// ─── Courier Suggestion Rules ─────────────────────────────────────────────────

const COURIER_RULES = {
    metro: { prepaid: 'Blue Dart', cod: 'Delhivery' },
    tier2: { prepaid: 'Delhivery', cod: 'DTDC' },
    rest_of_india: { prepaid: 'DTDC', cod: 'India Post' },
    remote: { prepaid: 'India Post', cod: 'India Post' },
    local: { prepaid: 'Delhivery', cod: 'Delhivery' },
}

// ─── Utility: Weight Parsing ──────────────────────────────────────────────────

/**
 * Parse a product weight string into grams.
 * Handles: "800g", "1.2kg", "500 g", "2 KG", "1500", "0.5 kg"
 *
 * @param {string|number} weightStr - Weight value from Product.weight
 * @returns {number} Weight in grams
 */
export function parseWeight(weightStr) {
    if (!weightStr) return DEFAULT_ITEM_WEIGHT_GRAMS

    const str = String(weightStr).trim().toLowerCase()

    // Pure number → assume grams
    if (/^\d+(\.\d+)?$/.test(str)) {
        return Math.round(parseFloat(str))
    }

    // Match number + unit
    const match = str.match(/^(\d+(?:\.\d+)?)\s*(kg|g|gm|gram|grams|kilogram|kilograms)?/)
    if (!match) return DEFAULT_ITEM_WEIGHT_GRAMS

    const value = parseFloat(match[1])
    const unit = match[2] || 'g'

    if (unit.startsWith('kg') || unit.startsWith('kilo')) {
        return Math.round(value * 1000)
    }
    return Math.round(value)
}

// ─── Utility: Zone Classification ─────────────────────────────────────────────

/**
 * Determine shipping zone based on origin and destination states.
 *
 * @param {string} fromState - Origin state (default: Zaymazone hub)
 * @param {string} toState   - Destination state from shipping address
 * @returns {'local'|'metro'|'tier2'|'rest_of_india'|'remote'} Zone key
 */
export function getShippingZone(fromState = ORIGIN_STATE, toState = '') {
    const from = (fromState || '').trim().toLowerCase()
    const to = (toState || '').trim().toLowerCase()

    // Same state → local (intra-state)
    if (from === to) return 'local'

    // Look up destination zone
    const destZone = STATE_ZONES[to]
    if (destZone) return destZone

    // Partial match (e.g., "UP" → "uttar pradesh")
    const partialMatch = Object.keys(STATE_ZONES).find(
        key => key.includes(to) || to.includes(key)
    )
    if (partialMatch) return STATE_ZONES[partialMatch]

    // Default fallback
    return 'rest_of_india'
}

// ─── Core: Shipping Calculation ───────────────────────────────────────────────

/**
 * Calculate full shipping cost for an order.
 *
 * @param {Object} params
 * @param {Array<{weight?: string, quantity: number}>} params.items - Order items with weight
 * @param {number} params.subtotal - Order subtotal in INR
 * @param {string} params.toState  - Destination state
 * @param {string} params.paymentMethod - 'cod' | 'upi_prepaid' | other
 * @param {number} [params.codFeeOverride] - Override COD fee (from codService)
 * @param {string} [params.fromState]     - Origin state (default: Rajasthan)
 *
 * @returns {Object} Full shipping breakdown
 */
export function calculateShipping({
    items = [],
    subtotal = 0,
    toState = '',
    paymentMethod = 'upi_prepaid',
    codFeeOverride = null,
    fromState = ORIGIN_STATE,
}) {
    // 1. Determine zone
    const zone = getShippingZone(fromState, toState)
    const rates = ZONE_RATES[zone] || ZONE_RATES.rest_of_india

    // 2. Calculate total weight
    const totalWeightGrams = items.reduce((sum, item) => {
        const itemWeight = parseWeight(item.weight)
        const qty = item.quantity || 1
        return sum + (itemWeight * qty)
    }, 0) || DEFAULT_ITEM_WEIGHT_GRAMS

    // 3. Weight-based charge
    // First 500g: baseCharge. Each additional 500g (or part): perExtra500g
    const extraWeight = Math.max(0, totalWeightGrams - 500)
    const extra500gBlocks = Math.ceil(extraWeight / 500)
    const weightCharge = rates.baseCharge + (extra500gBlocks * rates.perExtra500g)

    // 4. Free shipping check
    const isFreeShipping = subtotal >= rates.freeShippingThreshold
    const shippingCharge = isFreeShipping ? 0 : weightCharge

    // 5. COD fee (only for COD payment method)
    const isCod = paymentMethod === 'cod'
    const codFee = isCod ? (codFeeOverride ?? DEFAULT_COD_FEE) : 0

    // 6. Courier booking flags
    const isPrepaid = !isCod
    const bookingType = isCod ? 'cod' : 'prepaid'
    const courierMap = COURIER_RULES[zone] || COURIER_RULES.rest_of_india
    const suggestedCourier = isCod ? courierMap.cod : courierMap.prepaid

    const courierFlags = {
        isPrepaid,
        isCod,
        bookingType,
        suggestedCourier,
        zone,
        zoneLabel: rates.label,
    }

    // 7. Detailed breakdown (for invoice)
    const breakdown = {
        zone,
        zoneLabel: rates.label,
        totalWeightGrams,
        totalWeightDisplay: totalWeightGrams >= 1000
            ? `${(totalWeightGrams / 1000).toFixed(2)} kg`
            : `${totalWeightGrams} g`,
        baseCharge: rates.baseCharge,
        weightCharge,
        extra500gBlocks,
        isFreeShipping,
        freeShippingThreshold: rates.freeShippingThreshold,
        amountForFreeShipping: Math.max(0, rates.freeShippingThreshold - subtotal),
        estimatedDeliveryDays: rates.estimatedDays,
    }

    return {
        shippingCharge,
        codFee,
        totalWeight: totalWeightGrams,
        zone,
        zoneLabel: rates.label,
        isFreeShipping,
        freeShippingThreshold: rates.freeShippingThreshold,
        estimatedDeliveryDays: rates.estimatedDays,
        breakdown,
        courierFlags,
    }
}

// ─── Invoice Breakdown Generator ─────────────────────────────────────────────

/**
 * Generate a clean, invoice-level charge breakdown for an order.
 * Clearly separates: product price | shipping fee | COD fee | tax | discount | total
 *
 * @param {Object} order - Mongoose Order document or plain order object
 * @returns {Object} Invoice breakdown with all line items
 */
export function generateInvoiceBreakdown(order) {
    const subtotal = order.subtotal || 0
    const shippingCharge = order.shippingCost || 0
    const codFee = order.codFee || 0
    const tax = order.tax || 0
    const discount = order.discount || 0
    const total = order.total || (subtotal + shippingCharge + codFee + tax - discount)

    const isCod = order.paymentMethod === 'cod'
    const zone = order.shippingZone || 'rest_of_india'
    const zoneRates = ZONE_RATES[zone] || ZONE_RATES.rest_of_india

    const lineItems = [
        {
            label: 'Product Subtotal',
            description: `${order.items?.length || 0} item(s)`,
            amount: subtotal,
            type: 'product',
        },
        {
            label: 'Shipping Fee',
            description: shippingCharge === 0
                ? `Free shipping (${zoneRates.label})`
                : `${zoneRates.label} · ${order.totalWeight ? (order.totalWeight >= 1000 ? `${(order.totalWeight / 1000).toFixed(2)} kg` : `${order.totalWeight} g`) : 'standard weight'}`,
            amount: shippingCharge,
            type: 'shipping',
            isFree: shippingCharge === 0,
        },
    ]

    if (isCod && codFee > 0) {
        lineItems.push({
            label: 'COD Handling Fee',
            description: 'Cash on Delivery service charge',
            amount: codFee,
            type: 'cod_fee',
        })
    }

    if (tax > 0) {
        lineItems.push({
            label: 'Tax',
            description: 'GST / applicable taxes',
            amount: tax,
            type: 'tax',
        })
    }

    if (discount > 0) {
        lineItems.push({
            label: 'Discount',
            description: 'Applied discount',
            amount: -discount,
            type: 'discount',
        })
    }

    lineItems.push({
        label: 'Total',
        description: isCod ? 'Pay on delivery' : 'Paid online',
        amount: total,
        type: 'total',
        isBold: true,
    })

    return {
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        courierFlags: order.courierFlags || null,
        shippingZone: zone,
        zoneLabel: zoneRates.label,
        estimatedDeliveryDays: zoneRates.estimatedDays,
        lineItems,
        summary: {
            subtotal,
            shippingCharge,
            codFee,
            tax,
            discount,
            total,
        },
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export default {
    parseWeight,
    getShippingZone,
    calculateShipping,
    generateInvoiceBreakdown,
    ZONE_RATES,
    STATE_ZONES,
    COURIER_RULES,
    DEFAULT_COD_FEE,
    ORIGIN_STATE,
}
