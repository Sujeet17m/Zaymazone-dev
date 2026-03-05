/**
 * Invoice — Module 3: Automatic Bill Generation
 *
 * Persisted, immutable invoice document generated for every monetary event.
 * Provides a clean audit trail and enables accurate refund & fee statements.
 *
 * ── Invoice types ────────────────────────────────────────────────────────────
 *   sale              → issued when an order is placed (primary bill)
 *   cancellation_note → credit note when buyer cancels; includes fee deduction
 *   rejection_note    → credit note when seller rejects; full refund, no fee
 *   refund_note       → supplementary note for post-delivery partial refunds
 *
 * ── Invoice number format ─────────────────────────────────────────────────────
 *   sale              → INV-{YEAR}-{000001}
 *   cancellation_note → CN-{YEAR}-{000001}
 *   rejection_note    → RN-{YEAR}-{000001}
 *   refund_note       → REF-{YEAR}-{000001}
 *
 * ── Status lifecycle ─────────────────────────────────────────────────────────
 *   issued  → void     (e.g. test order, admin void)
 *   issued  → credited (replaced by a credit note)
 */

import mongoose from 'mongoose'

// ── Line-item sub-schema ──────────────────────────────────────────────────────

const lineItemSchema = new mongoose.Schema(
  {
    label:       { type: String, required: true },
    description: { type: String, default: '' },
    /**
     * Positive = charge added to the total (product, shipping, fee, tax)
     * Negative = credit / deduction (discount, refund, cancellation reduction)
     */
    amount: { type: Number, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'product',
        'shipping',
        'cod_fee',
        'tax',
        'discount',
        'cancellation_fee',
        'refund',
        'total',
      ],
    },
    isBold:  { type: Boolean, default: false },
    isFree:  { type: Boolean, default: false },
  },
  { _id: false }
)

// ── Buyer address snapshot sub-schema ─────────────────────────────────────────

const buyerSnapshotSchema = new mongoose.Schema(
  {
    fullName:     String,
    email:        String,
    phone:        String,
    addressLine1: String,
    addressLine2: String,
    city:         String,
    state:        String,
    zipCode:      String,
    country:      { type: String, default: 'India' },
  },
  { _id: false }
)

// ── Order-item snapshot sub-schema ────────────────────────────────────────────

const itemSnapshotSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true },
    quantity:  { type: Number, required: true, min: 1 },
    price:     { type: Number, required: true, min: 0 },
    image:     { type: String },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    artisanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artisan' },
  },
  { _id: false }
)

// ── Main invoice schema ───────────────────────────────────────────────────────

const invoiceSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    invoiceNumber: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },

    // ── Type & status ─────────────────────────────────────────────────────────
    type: {
      type:     String,
      required: true,
      enum:     ['sale', 'cancellation_note', 'rejection_note', 'refund_note'],
      default:  'sale',
      index:    true,
    },
    status: {
      type:     String,
      required: true,
      enum:     ['issued', 'void', 'credited'],
      default:  'issued',
      index:    true,
    },

    // ── Order & user references ───────────────────────────────────────────────
    orderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Order',   required: true, index: true },
    orderNumber: { type: String,                                          required: true, index: true },
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },

    /**
     * For credit notes (cancellation_note / rejection_note) this links back to
     * the original sale invoice that this document supersedes.
     */
    originalInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },

    // ── Financial snapshot ────────────────────────────────────────────────────
    subtotal:    { type: Number, required: true, min: 0 },
    shippingCost:{ type: Number, default: 0,     min: 0 },
    codFee:      { type: Number, default: 0,     min: 0 },
    tax:         { type: Number, default: 0,     min: 0 },
    discount:    { type: Number, default: 0,     min: 0 },
    /**
     * For sale invoices:   total amount billed to buyer.
     * For credit notes:    total refund amount (after any fee deduction).
     */
    grandTotal:  { type: Number, required: true, min: 0 },

    // ── Cancellation / rejection specific ─────────────────────────────────────
    cancellationFee:    { type: Number, default: 0, min: 0 },
    cancellationTier:   { type: String }, // grace|placed|confirmed|processing
    refundableAmount:   { type: Number, default: 0, min: 0 },
    cancellationReason: { type: String, maxLength: 500 },
    rejectionReason:    { type: String, maxLength: 500 },
    isCodOrder:         { type: Boolean, default: false },
    feeWaived:          { type: Boolean, default: false },

    // ── Line items ─────────────────────────────────────────────────────────────
    lineItems: [lineItemSchema],

    // ── Snapshots ─────────────────────────────────────────────────────────────
    buyerSnapshot: { type: buyerSnapshotSchema },
    itemSnapshots: [itemSnapshotSchema],

    // ── Payment snapshot ──────────────────────────────────────────────────────
    paymentMethod: { type: String },
    paymentStatus: { type: String },
    paymentId:     { type: String },  // gateway txn ID

    // ── Shipping snapshot ─────────────────────────────────────────────────────
    shippingZone:          { type: String },
    shippingZoneLabel:     { type: String },
    suggestedCourier:      { type: String },
    estimatedDeliveryDays: { type: String },

    // ── Timestamps ─────────────────────────────────────────────────────────────
    issuedAt:  { type: Date, default: Date.now },
    voidedAt:  { type: Date },
    creditedAt:{ type: Date },

    /** User (admin) who performed a void or regeneration */
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    notes: { type: String, maxLength: 500 },
  },
  {
    timestamps: true,
    // Enforce strict schema — no ad-hoc fields allowed
    strict: true,
  }
)

// ── Pre-save: auto-generate invoice number ───────────────────────────────────

invoiceSchema.pre('save', async function (next) {
  if (!this.isNew || this.invoiceNumber) return next()

  const year = new Date().getFullYear()
  const prefix =
    this.type === 'sale'              ? 'INV'
    : this.type === 'cancellation_note' ? 'CN'
    : this.type === 'rejection_note'    ? 'RN'
    : 'REF'                              // refund_note

  const count = await mongoose.model('Invoice').countDocuments({
    type:      this.type,
    issuedAt:  { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) },
  })

  this.invoiceNumber = `${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
  next()
})

// ── Indexes ───────────────────────────────────────────────────────────────────

invoiceSchema.index({ orderId: 1, type: 1 })
invoiceSchema.index({ userId: 1, issuedAt: -1 })
invoiceSchema.index({ status: 1, type: 1, issuedAt: -1 })
invoiceSchema.index({ orderNumber: 1, type: 1 })

export default mongoose.model('Invoice', invoiceSchema)
