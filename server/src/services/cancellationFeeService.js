/**
 * Cancellation Fee Service — Module 5
 *
 * Defines the rules, calculates the fee, adjusts the refund amount, and
 * writes immutable ledger entries so every cancellation is fully auditable.
 *
 * ─── Fee Tiers ───────────────────────────────────────────────────────────────
 *
 *  Tier        | Condition                       | Fee  | Min  | Max
 *  ------------|--------------------------------|------|------|------
 *  grace       | < GRACE_MINUTES after placement | 0 %  | ₹ 0  | ₹ 0
 *  placed      | status=placed, after grace      | 0 %  | ₹ 0  | ₹ 0
 *  confirmed   | status=confirmed                | 2 %  | ₹ 25 | ₹ 250
 *  processing  | status=processing (admin only)  | 5 %  | ₹ 50 | ₹ 500
 *
 * ─── Refund Rules ────────────────────────────────────────────────────────────
 *  COD orders   → fee is always ₹ 0 (buyer never paid); logged for transparency
 *  Prepaid      → refundableAmount = order.total − cancellationFee
 *
 * ─── Ledger Entries ──────────────────────────────────────────────────────────
 *  CANCELLATION_FEE    → cancellation_reserve  (+fee, platform retains)
 *  CANCELLATION_REFUND → refund_payable         (−refundableAmount, owed to buyer)
 */

import Order       from '../models/Order.js'
import Product     from '../models/Product.js'
import LedgerEntry from '../models/LedgerEntry.js'

// ── Configuration ─────────────────────────────────────────────────────────────

/** Minutes after order placement during which cancellation is always free */
const GRACE_MINUTES = parseInt(process.env.CANCELLATION_GRACE_MINUTES || '30', 10)

/**
 * Prepaid payment methods — these require an actual refund to the buyer.
 * COD is excluded; the buyer never paid, so there's nothing to refund.
 */
const PREPAID_METHODS = new Set([
  'zoho_card', 'zoho_upi', 'zoho_netbanking', 'zoho_wallet',
  'razorpay', 'upi', 'upi_prepaid',
  'paytm', 'paytm_upi', 'paytm_card', 'paytm_netbanking', 'paytm_wallet',
])

/**
 * Rule tiers indexed by order status.
 * Each tier defines:
 *   feePercent  — percentage of order.subtotal to charge (0–1)
 *   minFee      — minimum fee in ₹
 *   maxFee      — maximum fee in ₹ (Infinity = no cap)
 *   label       — human-readable description shown on invoice
 */
export const CANCELLATION_TIERS = {
  grace: {
    feePercent: 0,
    minFee:     0,
    maxFee:     0,
    label:      'Cancelled within free-cancellation window (no fee)',
  },
  placed: {
    feePercent: 0,
    minFee:     0,
    maxFee:     0,
    label:      'Cancelled before confirmation (no fee)',
  },
  confirmed: {
    feePercent: 0.02,    // 2%
    minFee:     25,
    maxFee:     250,
    label:      'Cancellation fee (order already confirmed — 2% of subtotal)',
  },
  processing: {
    feePercent: 0.05,    // 5%
    minFee:     50,
    maxFee:     500,
    label:      'Cancellation fee (order in processing — 5% of subtotal)',
  },
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Pure calculation — does NOT touch the database.
 *
 * @param {object} order  — Mongoose Order document (or plain object with the same shape)
 * @returns {object}  fee breakdown ready to show to the user or pass to processOrderCancellation
 *
 * Example response:
 * {
 *   tier:             'confirmed',
 *   feePercent:        0.02,
 *   grossFee:          96,       // before min/max clamp
 *   cancellationFee:   96,       // after clamp
 *   isCod:             false,
 *   totalPaid:         4800,
 *   refundableAmount:  4704,
 *   isWithinGrace:     false,
 *   minutesSincePlaced: 145,
 *   ruleLabel:        'Cancellation fee (order already confirmed — 2% of subtotal)',
 * }
 */
export function calculateCancellationFee(order) {
  const now            = new Date()
  const placedAt       = order.createdAt ? new Date(order.createdAt) : now
  const minutesSince   = (now - placedAt) / 60_000
  const isWithinGrace  = minutesSince < GRACE_MINUTES

  const isCod = !PREPAID_METHODS.has(order.paymentMethod)

  // Determine which rule tier applies
  let tier
  if (isWithinGrace) {
    tier = 'grace'
  } else if (order.status === 'placed') {
    tier = 'placed'
  } else if (order.status === 'confirmed') {
    tier = 'confirmed'
  } else if (order.status === 'processing') {
    tier = 'processing'
  } else {
    // Fallback — should not reach here if caller validates status first
    tier = 'placed'
  }

  const rule      = CANCELLATION_TIERS[tier]
  const subtotal  = order.subtotal || 0

  // For COD orders: no actual refund, so fee is always ₹0 (nothing was paid)
  if (isCod) {
    return {
      tier,
      feePercent:        rule.feePercent,
      grossFee:          0,
      cancellationFee:   0,
      isCod:             true,
      totalPaid:         0,
      refundableAmount:  0,
      isWithinGrace,
      minutesSincePlaced: Math.floor(minutesSince),
      ruleLabel:         rule.label,
    }
  }

  // Compute gross fee, then clamp to [minFee, maxFee]
  const grossFee = Math.round(subtotal * rule.feePercent * 100) / 100
  let cancellationFee = 0
  if (grossFee > 0) {
    cancellationFee = Math.min(Math.max(grossFee, rule.minFee), rule.maxFee)
  }

  const totalPaid        = order.total || 0
  const refundableAmount = Math.max(0, Math.round((totalPaid - cancellationFee) * 100) / 100)

  return {
    tier,
    feePercent:         rule.feePercent,
    grossFee,
    cancellationFee,
    isCod:              false,
    totalPaid,
    refundableAmount,
    isWithinGrace,
    minutesSincePlaced: Math.floor(minutesSince),
    ruleLabel:          rule.label,
  }
}

/**
 * Full cancellation pipeline — persists changes to the database.
 *
 * 1. Loads and validates the order
 * 2. Calculates the fee
 * 3. Updates the order document
 * 4. Restores product stock
 * 5. Posts ledger entries
 *
 * @param {string}        orderId
 * @param {string}        reason          — buyer's cancellation reason
 * @param {string|ObjectId} userId        — must match order.userId (or be admin)
 * @param {object}        [options]
 * @param {boolean}       [options.isAdmin=false]  — skip owner check; allow processing-stage cancel
 * @param {boolean}       [options.waiveFee=false] — override fee to ₹0 (admin action)
 * @param {string|ObjectId} [options.adminId]      — admin who triggered the action
 *
 * @returns {{ order, feeBreakdown }}
 */
export async function processOrderCancellation(orderId, reason, userId, options = {}) {
  const { isAdmin = false, waiveFee = false, adminId = null } = options

  // ── 1. Load order ──────────────────────────────────────────────────────────
  const query = { _id: orderId }
  if (!isAdmin) query.userId = userId   // non-admins can only cancel their own orders

  const order = await Order.findOne(query)
  if (!order) throw new Error('Order not found')

  // ── 2. Validate state ──────────────────────────────────────────────────────
  const cancellableStatuses = isAdmin
    ? ['placed', 'confirmed', 'processing']
    : ['placed', 'confirmed']

  if (!cancellableStatuses.includes(order.status)) {
    throw new Error(`Order cannot be cancelled at this stage (status: ${order.status})`)
  }

  if (order.status === 'cancelled') {
    throw new Error('Order is already cancelled')
  }

  // ── 3. Calculate fee ───────────────────────────────────────────────────────
  let feeBreakdown = calculateCancellationFee(order)

  if (waiveFee) {
    feeBreakdown = {
      ...feeBreakdown,
      cancellationFee:  0,
      refundableAmount: feeBreakdown.totalPaid,
      ruleLabel:        feeBreakdown.ruleLabel + ' [fee waived by admin]',
    }
  }

  // ── 4. Update order ────────────────────────────────────────────────────────
  order.status               = 'cancelled'
  order.cancelledAt          = new Date()
  order.cancellationReason   = reason || 'Cancelled by customer'
  order.cancellationFee      = feeBreakdown.cancellationFee
  order.refundableAmount     = feeBreakdown.refundableAmount
  order.cancellationFeeWaived = waiveFee
  order.cancellationTier     = feeBreakdown.tier

  // For prepaid orders, mark as refunded if refund is owed
  if (!feeBreakdown.isCod) {
    order.refundAmount  = feeBreakdown.refundableAmount
    order.refundReason  = reason || 'Order cancelled'
    if (feeBreakdown.refundableAmount > 0) {
      order.paymentStatus = 'refunded'
      order.refundedAt    = new Date()
    } else {
      order.paymentStatus = 'cancelled'
    }
  } else {
    order.paymentStatus = 'cancelled'
  }

  order.statusHistory.push({
    status:    'cancelled',
    timestamp: new Date(),
    note:      `Cancelled — ${reason || 'No reason provided'}. Fee: ₹${feeBreakdown.cancellationFee}`,
  })

  await order.save()

  // ── Module 3: Generate cancellation credit note (non-blocking) ───────────
  // Dynamic import avoids circular dependency: invoiceService → Order model
  setImmediate(async () => {
    try {
      const { generateCancellationNote } = await import('./invoiceService.js')
      await generateCancellationNote(order, feeBreakdown)
    } catch (invErr) {
      console.error('[invoiceService] Failed to generate cancellation note:', invErr)
    }
  })

  // ── 5. Restore product stock ───────────────────────────────────────────────
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: {
        stock:      item.quantity,
        salesCount: -item.quantity,
      },
    })
  }

  // ── 6. Post ledger entries ─────────────────────────────────────────────────
  await _postCancellationLedger(order, feeBreakdown, adminId || userId)

  return { order, feeBreakdown }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Post immutable double-entry ledger rows for a cancelled order.
 *
 * Entries created:
 *   CANCELLATION_FEE    → cancellation_reserve  (+ fee amount, platform keeps)
 *   CANCELLATION_REFUND → refund_payable         (− refundable, platform owes buyer)
 *
 * COD orders skip the refund entry (no money was collected).
 */
async function _postCancellationLedger(order, feeBreakdown, actorId) {
  const entries = []

  //
  // Cancellation fee entry — even if ₹0, post it for a complete audit trail
  //
  entries.push({
    entryType:   'CANCELLATION_FEE',
    account:     'cancellation_reserve',
    amount:      feeBreakdown.cancellationFee,
    orderId:     order._id,
    orderNumber: order.orderNumber,
    artisanId:   order.items[0]?.artisanId,
    description: `Cancellation fee for order ${order.orderNumber} [tier: ${feeBreakdown.tier}]`,
    note:        feeBreakdown.ruleLabel,
    createdBy:   actorId,
  })

  //
  // Cancellation also cancels the platform revenue credit if fee > 0
  //
  if (feeBreakdown.cancellationFee > 0) {
    entries.push({
      entryType:   'CANCELLATION_FEE',
      account:     'platform_revenue',
      amount:      feeBreakdown.cancellationFee,
      orderId:     order._id,
      orderNumber: order.orderNumber,
      artisanId:   order.items[0]?.artisanId,
      description: `Cancellation fee credited to platform revenue for order ${order.orderNumber}`,
      note:        feeBreakdown.ruleLabel,
      createdBy:   actorId,
    })
  }

  //
  // Refund due to buyer (only for prepaid orders)
  //
  if (!feeBreakdown.isCod && feeBreakdown.refundableAmount > 0) {
    entries.push({
      entryType:   'CANCELLATION_REFUND',
      account:     'refund_payable',
      amount:      -feeBreakdown.refundableAmount,      // money leaves platform
      orderId:     order._id,
      orderNumber: order.orderNumber,
      artisanId:   order.items[0]?.artisanId,
      description: `Refund payable to buyer for cancelled order ${order.orderNumber}`,
      note:        `Total paid: ₹${feeBreakdown.totalPaid} — Fee: ₹${feeBreakdown.cancellationFee} = Refund: ₹${feeBreakdown.refundableAmount}`,
      createdBy:   actorId,
    })
  }

  if (entries.length > 0) {
    await LedgerEntry.insertMany(entries)
  }
}

export default {
  CANCELLATION_TIERS,
  GRACE_MINUTES,
  calculateCancellationFee,
  processOrderCancellation,
}
