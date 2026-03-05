/**
 * LedgerEntry Model — Module 4
 *
 * Immutable double-entry-style accounting log.  Every monetary event
 * creates one or more ledger rows so the books always balance.
 *
 * Entry types:
 *  SALE               — order delivered (revenue recognised)
 *  COMMISSION         — platform's share of a sale
 *  LOGISTICS          — courier cost charged against artisan
 *  COD_FEE            — COD handling fee (platform revenue)
 *  COD_RETURN         — buyer returned COD shipment (reversal)
 *  UPI_REFUND         — UPI payment refunded to buyer
 *  SETTLEMENT         — payout transferred to artisan
 *  ADJUSTMENT         — manual correction
 *  CANCELLATION_FEE   — fee retained by platform when order is cancelled
 *  CANCELLATION_REFUND— net refund issued to buyer after cancellation fee deduction
 */

import mongoose from 'mongoose'

const ENTRY_TYPES = [
	'SALE',
	'COMMISSION',
	'LOGISTICS',
	'COD_FEE',
	'COD_RETURN',
	'UPI_REFUND',
	'SETTLEMENT',
	'ADJUSTMENT',
	'CANCELLATION_FEE',
	'CANCELLATION_REFUND',
]

const ACCOUNTS = [
	'platform_revenue',      // money the platform keeps
	'seller_payable',        // amount owed to artisan
	'logistics_payable',     // amount owed to courier
	'buyer_receivable',      // amount expected from buyer (COD)
	'refund_payable',        // amount owed back to buyer
	'cancellation_reserve',  // cancellation fees collected by platform
]

const ledgerEntrySchema = new mongoose.Schema({
	// ── Classification ───────────────────────────────────────────────────────
	entryType: {
		type: String,
		required: true,
		enum: ENTRY_TYPES,
		index: true
	},

	/** Which account is being credited/debited */
	account: {
		type: String,
		required: true,
		enum: ACCOUNTS,
		index: true
	},

	/**
	 * Positive  = credit (money flows IN to the account)
	 * Negative  = debit  (money flows OUT of the account)
	 */
	amount: { type: Number, required: true },

	// ── References ───────────────────────────────────────────────────────────
	orderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
	orderNumber:  { type: String, index: true },
	artisanId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Artisan', index: true },
	settlementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', index: true },
	upiPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'UpiPayment' },

	// ── Meta ─────────────────────────────────────────────────────────────────
	description: { type: String, required: true, maxLength: 300 },
	note:        { type: String, maxLength: 500 },
	createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

}, {
	timestamps: true,
	// Never allow updates — ledger entries are immutable
	strict: true,
})

// Indexes for fast aggregation queries
ledgerEntrySchema.index({ artisanId: 1, createdAt: -1 })
ledgerEntrySchema.index({ account: 1,  createdAt: -1 })
ledgerEntrySchema.index({ entryType: 1, createdAt: -1 })
ledgerEntrySchema.index({ orderId: 1, entryType: 1 })

export default mongoose.model('LedgerEntry', ledgerEntrySchema)
