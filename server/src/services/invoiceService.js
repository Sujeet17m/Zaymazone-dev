/**
 * invoiceService — Module 3: Automatic Bill Generation
 *
 * Generates, persists, and manages Invoice documents for every significant
 * order monetary event. All generation functions are idempotent: calling them
 * multiple times for the same event does NOT create duplicate invoices.
 *
 * ── Public API ────────────────────────────────────────────────────────────────
 *
 *  generateForOrder(order)
 *      Issue a primary "sale" invoice when an order is placed.
 *      Skips if a sale invoice already exists for the order.
 *
 *  generateCancellationNote(order, feeBreakdown)
 *      Issue a "cancellation_note" credit note when a buyer cancels.
 *      Marks the original sale invoice as "credited".
 *      Skips if a cancellation_note already exists for the order.
 *
 *  generateRejectionNote(order)
 *      Issue a "rejection_note" credit note when a seller rejects.
 *      Full refund, no cancellation fee. Marks original as "credited".
 *      Skips if a rejection_note already exists for the order.
 *
 *  voidInvoice(invoiceId, adminId)
 *      Mark a single invoice as "void" (admin action).
 *
 *  regenerateForOrder(orderId, adminId)
 *      Void any existing sale invoice and re-issue a fresh one.
 *      Useful when order data was corrected post-placement.
 *
 *  getInvoicesForOrder(orderId)
 *      Return all invoices (all types) for an order, newest first.
 *
 * ── Automatic hooks (non-blocking, fire-and-forget) ──────────────────────────
 *  Called from:
 *   - orders.js  (POST /api/orders)            → generateForOrder
 *   - cancellationFeeService.js                → generateCancellationNote
 *   - seller.js  (POST /orders/:id/reject)     → generateRejectionNote
 */

import Invoice       from '../models/Invoice.js'
import shippingService from './shippingService.js'

// ─── Helper: build buyer snapshot from order ──────────────────────────────────

function _buyerSnapshot(order) {
  const addr = order.shippingAddress || {}
  return {
    fullName:     addr.fullName     || '',
    email:        addr.email        || '',
    phone:        addr.phone        || '',
    addressLine1: addr.addressLine1 || addr.street || '',
    addressLine2: addr.addressLine2 || '',
    city:         addr.city         || '',
    state:        addr.state        || '',
    zipCode:      addr.zipCode      || '',
    country:      addr.country      || 'India',
  }
}

// ─── Helper: build item snapshots from order ──────────────────────────────────

function _itemSnapshots(order) {
  return (order.items || []).map(item => ({
    name:      item.name      || '',
    quantity:  item.quantity  || 1,
    price:     item.price     || 0,
    image:     item.image     || '',
    productId: item.productId,
    artisanId: item.artisanId,
  }))
}

// ─── Helper: derive zone label from order ─────────────────────────────────────

function _zoneLabel(order) {
  const zone = order.shippingZone || 'rest_of_india'
  const rates = shippingService.ZONE_RATES[zone]
  return rates?.label || zone.replace(/_/g, ' ')
}

// ─── Helper: courier data from order ─────────────────────────────────────────

function _courierInfo(order) {
  return {
    suggestedCourier:      order.courierFlags?.suggestedCourier    || null,
    estimatedDeliveryDays: (shippingService.ZONE_RATES[order.shippingZone || 'rest_of_india']?.estimatedDays) || null,
  }
}

// ─── 1. Sale Invoice ──────────────────────────────────────────────────────────

/**
 * Generate and persist a primary "sale" invoice for a newly placed order.
 * Idempotent: if one already exists, the existing document is returned.
 *
 * @param {object} order  Mongoose Order document or plain lean object
 * @returns {Promise<Invoice>}
 */
export async function generateForOrder(order) {
  // Idempotency: don't double-issue
  const existing = await Invoice.findOne({ orderId: order._id, type: 'sale' })
  if (existing) {
    console.log(`[InvoiceService] Sale invoice already exists for order ${order.orderNumber}: ${existing.invoiceNumber}`)
    return existing
  }

  const subtotal    = order.subtotal     || 0
  const shipping    = order.shippingCost || 0
  const codFee      = order.codFee       || 0
  const tax         = order.tax          || 0
  const discount    = order.discount     || 0
  const grandTotal  = order.total        ||
    (subtotal + shipping + codFee + tax - discount)

  const isCod = order.paymentMethod === 'cod'
  const zLabel = _zoneLabel(order)

  // ── Build line items ────────────────────────────────────────────────────────
  const lineItems = [
    {
      label:       'Product Subtotal',
      description: `${(order.items || []).length} item(s)`,
      amount:      subtotal,
      type:        'product',
    },
    {
      label:       'Shipping Fee',
      description: shipping === 0
        ? `Free shipping (${zLabel})`
        : `${zLabel} — ${order.totalWeight
            ? (order.totalWeight >= 1000
                ? `${(order.totalWeight / 1000).toFixed(2)} kg`
                : `${order.totalWeight} g`)
            : 'standard weight'}`,
      amount:      shipping,
      type:        'shipping',
      isFree:      shipping === 0,
    },
  ]

  if (isCod && codFee > 0) {
    lineItems.push({
      label:       'COD Handling Fee',
      description: 'Cash on Delivery service charge',
      amount:      codFee,
      type:        'cod_fee',
    })
  }

  if (tax > 0) {
    lineItems.push({
      label:       'Tax (GST)',
      description: 'Goods & Services Tax',
      amount:      tax,
      type:        'tax',
    })
  }

  if (discount > 0) {
    lineItems.push({
      label:       'Discount',
      description: 'Applied discount / promo code',
      amount:      -discount,
      type:        'discount',
    })
  }

  lineItems.push({
    label:       isCod ? 'Amount Payable on Delivery' : 'Grand Total Paid',
    description: isCod ? 'Collect cash at doorstep' : 'Paid online before dispatch',
    amount:      grandTotal,
    type:        'total',
    isBold:      true,
  })

  // ── Persist ─────────────────────────────────────────────────────────────────
  const invoice = await Invoice.create({
    type:       'sale',
    status:     'issued',
    orderId:    order._id,
    orderNumber:order.orderNumber,
    userId:     order.userId,
    subtotal,
    shippingCost: shipping,
    codFee,
    tax,
    discount,
    grandTotal,
    isCodOrder: isCod,
    lineItems,
    buyerSnapshot:   _buyerSnapshot(order),
    itemSnapshots:   _itemSnapshots(order),
    paymentMethod:   order.paymentMethod   || '',
    paymentStatus:   order.paymentStatus   || 'pending',
    paymentId:       order.paymentId       || order.zohoPaymentId || order.paytmTxnId || '',
    shippingZone:          order.shippingZone || '',
    shippingZoneLabel:     zLabel,
    ..._courierInfo(order),
    issuedAt: new Date(),
  })

  console.log(`[InvoiceService] ✅ Sale invoice generated: ${invoice.invoiceNumber} for order ${order.orderNumber}`)
  return invoice
}

// ─── 2. Cancellation Credit Note ─────────────────────────────────────────────

/**
 * Issue a "cancellation_note" credit note when a buyer or admin cancels.
 * Marks the original sale invoice as "credited" (idempotent).
 *
 * @param {object} order         Mongoose Order document (post-save, status='cancelled')
 * @param {object} feeBreakdown  Result from calculateCancellationFee()
 * @returns {Promise<Invoice>}
 */
export async function generateCancellationNote(order, feeBreakdown) {
  // Idempotency
  const existing = await Invoice.findOne({ orderId: order._id, type: 'cancellation_note' })
  if (existing) {
    console.log(`[InvoiceService] Cancellation note already exists: ${existing.invoiceNumber}`)
    return existing
  }

  const {
    cancellationFee  = 0,
    refundableAmount = 0,
    totalPaid        = order.total || 0,
    tier             = order.cancellationTier || 'placed',
    isCod            = false,
    ruleLabel        = '',
  } = feeBreakdown || {}

  // ── Build line items ────────────────────────────────────────────────────────
  const lineItems = [
    {
      label:       'Original Order Total',
      description: `Order ${order.orderNumber} — now cancelled`,
      amount:      totalPaid,
      type:        'product',
    },
  ]

  if (cancellationFee > 0) {
    lineItems.push({
      label:       'Cancellation Fee Retained',
      description: ruleLabel || `Tier: ${tier}`,
      amount:      -cancellationFee,   // reduces refund
      type:        'cancellation_fee',
    })
  }

  if (isCod) {
    lineItems.push({
      label:       'Refund Due',
      description: 'COD order — no payment was collected',
      amount:      0,
      type:        'refund',
      isBold:      true,
    })
  } else {
    lineItems.push({
      label:       cancellationFee > 0 ? 'Net Refund Payable' : 'Full Refund Payable',
      description: refundableAmount > 0
        ? 'Credited to original payment source within 5–7 business days'
        : 'No refund amount (fee absorbed full payment)',
      amount:      refundableAmount,
      type:        'refund',
      isBold:      true,
    })
  }

  // ── Mark original sale invoice as credited ──────────────────────────────────
  const originalInvoice = await Invoice.findOne({ orderId: order._id, type: 'sale' })
  if (originalInvoice && originalInvoice.status === 'issued') {
    originalInvoice.status     = 'credited'
    originalInvoice.creditedAt = new Date()
    await originalInvoice.save()
  }

  // ── Persist credit note ─────────────────────────────────────────────────────
  const note = await Invoice.create({
    type:       'cancellation_note',
    status:     'issued',
    orderId:    order._id,
    orderNumber:order.orderNumber,
    userId:     order.userId,
    originalInvoiceId: originalInvoice?._id,

    subtotal:       order.subtotal     || 0,
    shippingCost:   order.shippingCost || 0,
    codFee:         order.codFee       || 0,
    tax:            order.tax          || 0,
    discount:       order.discount     || 0,
    grandTotal:     refundableAmount,   // refund is the "total" on a credit note

    cancellationFee,
    cancellationTier:   tier,
    refundableAmount,
    cancellationReason: order.cancellationReason || '',
    isCodOrder:         isCod,
    feeWaived:          order.cancellationFeeWaived || false,

    lineItems,
    buyerSnapshot:  _buyerSnapshot(order),
    itemSnapshots:  _itemSnapshots(order),
    paymentMethod:  order.paymentMethod || '',
    paymentStatus:  order.paymentStatus || '',
    paymentId:      order.paymentId || '',

    shippingZone:      order.shippingZone || '',
    shippingZoneLabel: _zoneLabel(order),
    ..._courierInfo(order),

    issuedAt: new Date(),
    notes: ruleLabel || '',
  })

  console.log(`[InvoiceService] ✅ Cancellation note generated: ${note.invoiceNumber} for order ${order.orderNumber}`)
  return note
}

// ─── 3. Rejection Credit Note ─────────────────────────────────────────────────

/**
 * Issue a "rejection_note" credit note when a seller rejects an order.
 * Full refund, no fee. Marks original sale invoice as "credited".
 *
 * @param {object} order  Mongoose Order document (post-save, status='rejected')
 * @returns {Promise<Invoice>}
 */
export async function generateRejectionNote(order) {
  // Idempotency
  const existing = await Invoice.findOne({ orderId: order._id, type: 'rejection_note' })
  if (existing) {
    console.log(`[InvoiceService] Rejection note already exists: ${existing.invoiceNumber}`)
    return existing
  }

  const isCod     = order.paymentMethod === 'cod'
  const totalPaid = order.total || 0

  // ── Build line items ────────────────────────────────────────────────────────
  const lineItems = [
    {
      label:       'Original Order Total',
      description: `Order ${order.orderNumber} — rejected by seller`,
      amount:      totalPaid,
      type:        'product',
    },
    {
      label:       isCod ? 'No Refund Required' : 'Full Refund Payable',
      description: isCod
        ? 'COD order — no payment was collected'
        : 'Full refund to original payment source within 5–7 business days (seller rejection — no fee)',
      amount:      isCod ? 0 : totalPaid,
      type:        'refund',
      isBold:      true,
    },
  ]

  // ── Mark original sale invoice as credited ──────────────────────────────────
  const originalInvoice = await Invoice.findOne({ orderId: order._id, type: 'sale' })
  if (originalInvoice && originalInvoice.status === 'issued') {
    originalInvoice.status     = 'credited'
    originalInvoice.creditedAt = new Date()
    await originalInvoice.save()
  }

  // ── Persist rejection note ──────────────────────────────────────────────────
  const note = await Invoice.create({
    type:       'rejection_note',
    status:     'issued',
    orderId:    order._id,
    orderNumber:order.orderNumber,
    userId:     order.userId,
    originalInvoiceId: originalInvoice?._id,

    subtotal:     order.subtotal     || 0,
    shippingCost: order.shippingCost || 0,
    codFee:       order.codFee       || 0,
    tax:          order.tax          || 0,
    discount:     order.discount     || 0,
    grandTotal:   isCod ? 0 : totalPaid,   // refund on rejection note

    cancellationFee:   0,
    refundableAmount:  isCod ? 0 : totalPaid,
    rejectionReason:   order.rejectionReason || '',
    isCodOrder:        isCod,

    lineItems,
    buyerSnapshot: _buyerSnapshot(order),
    itemSnapshots: _itemSnapshots(order),
    paymentMethod: order.paymentMethod || '',
    paymentStatus: order.paymentStatus || '',
    paymentId:     order.paymentId     || '',

    shippingZone:      order.shippingZone || '',
    shippingZoneLabel: _zoneLabel(order),
    ..._courierInfo(order),

    issuedAt: new Date(),
    notes: order.rejectionReason ? `Seller rejection reason: ${order.rejectionReason}` : '',
  })

  console.log(`[InvoiceService] ✅ Rejection note generated: ${note.invoiceNumber} for order ${order.orderNumber}`)
  return note
}

// ─── 4. Void an invoice (admin) ───────────────────────────────────────────────

/**
 * Mark an invoice as "void". Only 'issued' invoices can be voided.
 *
 * @param {string|ObjectId} invoiceId
 * @param {string|ObjectId} adminId    User performing the void
 * @returns {Promise<Invoice>}
 */
export async function voidInvoice(invoiceId, adminId) {
  const invoice = await Invoice.findById(invoiceId)
  if (!invoice) throw new Error('Invoice not found')
  if (invoice.status !== 'issued') {
    throw new Error(`Invoice ${invoice.invoiceNumber} cannot be voided (current status: ${invoice.status})`)
  }

  invoice.status      = 'void'
  invoice.voidedAt    = new Date()
  invoice.processedBy = adminId || null
  await invoice.save()

  console.log(`[InvoiceService] Invoice ${invoice.invoiceNumber} voided by admin ${adminId}`)
  return invoice
}

// ─── 5. Regenerate sale invoice (admin) ──────────────────────────────────────

/**
 * Void any existing sale invoice for an order and issue a fresh one from the
 * latest order state. Use when order financial data was corrected post-placement.
 *
 * @param {string|ObjectId} orderId
 * @param {string|ObjectId} adminId
 * @returns {Promise<Invoice>}  The new invoice
 */
export async function regenerateForOrder(orderId, adminId) {
  const Order = (await import('../models/Order.js')).default

  const order = await Order.findById(orderId).lean()
  if (!order) throw new Error('Order not found')
  if (order.status === 'cancelled') throw new Error('Cannot regenerate invoice for a cancelled order')

  // Void existing sale invoice if present
  const existing = await Invoice.findOne({ orderId, type: 'sale', status: 'issued' })
  if (existing) {
    existing.status      = 'void'
    existing.voidedAt    = new Date()
    existing.processedBy = adminId || null
    await existing.save()
    console.log(`[InvoiceService] Voided old invoice ${existing.invoiceNumber} for regeneration`)
  }

  // Create a fresh invoice (bypass idempotency guard by voiding old one first)
  return generateForOrder({ ...order, _id: orderId })
}

// ─── 6. Get invoices for an order ────────────────────────────────────────────

/**
 * Return all invoices for a given order, sorted newest-first.
 *
 * @param {string|ObjectId} orderId
 * @returns {Promise<Invoice[]>}
 */
export async function getInvoicesForOrder(orderId) {
  return Invoice.find({ orderId }).sort({ issuedAt: -1 }).lean()
}

// ─── Default export ───────────────────────────────────────────────────────────

export default {
  generateForOrder,
  generateCancellationNote,
  generateRejectionNote,
  voidInvoice,
  regenerateForOrder,
  getInvoicesForOrder,
}
