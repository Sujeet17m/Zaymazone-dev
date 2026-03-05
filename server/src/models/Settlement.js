/**
 * Settlement Model — Module 4
 *
 * Represents a weekly (or manually triggered) payout cycle for one artisan.
 * Captures every revenue component:  artisan payable, platform commission,
 * logistics cost, COD returns, UPI refunds, and net amounts.
 *
 * Sample JSON output:
 * {
 *   "settlementId": "SET-2026-W08-ART001",
 *   "artisanId": "...",
 *   "periodStart": "2026-02-09T00:00:00.000Z",
 *   "periodEnd":   "2026-02-15T23:59:59.999Z",
 *   "grossRevenue": 4800,
 *   "platformCommission": 480,
 *   "commissionRate": 0.10,
 *   "logisticsCost": 320,
 *   "codFeeCollected": 75,
 *   "codReturnsDeducted": 0,
 *   "upiRefundsDeducted": 0,
 *   "netPayable": 4000,
 *   "status": "approved",
 *   "orderCount": 5,
 *   "orders": ["orderId1", ...]
 * }
 */

import mongoose from 'mongoose'

const settlementSchema = new mongoose.Schema({
	settlementId: {
		type: String,
		required: true,
		unique: true,
		index: true
	},
	artisanId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Artisan',
		required: true,
		index: true
	},

	// ── Period ──────────────────────────────────────────────────────────────
	periodStart: { type: Date, required: true },
	periodEnd:   { type: Date, required: true },
	weekLabel:   { type: String }, // e.g. "2026-W08"

	// ── Revenue Components ───────────────────────────────────────────────────
	/** Sum of all item prices (snapshots) for delivered orders in this period */
	grossRevenue: { type: Number, required: true, min: 0, default: 0 },

	/** Platform commission deducted (grossRevenue × commissionRate) */
	platformCommission: { type: Number, required: true, min: 0, default: 0 },
	commissionRate: { type: Number, required: true, min: 0, max: 1, default: 0.10 },

	/** Shipping cost charged/borne by platform, deducted from artisan payout */
	logisticsCost: { type: Number, default: 0, min: 0 },

	/** COD fee collected from buyer (goes to platform, not artisan) */
	codFeeCollected: { type: Number, default: 0, min: 0 },

	// ── Deductions ───────────────────────────────────────────────────────────
	/** Total order value returned via COD during this period (deducted) */
	codReturnsDeducted: { type: Number, default: 0, min: 0 },

	/** Total UPI refunds issued during this period (deducted) */
	upiRefundsDeducted: { type: Number, default: 0, min: 0 },

	/** Any other manual adjustments (+/-) */
	adjustments: [{
		label:  { type: String, required: true },
		amount: { type: Number, required: true }, // negative = deduction
		note:   { type: String }
	}],
	totalAdjustments: { type: Number, default: 0 },

	// ── Net ─────────────────────────────────────────────────────────────────
	/**
	 * netPayable = grossRevenue
	 *            − platformCommission
	 *            − logisticsCost
	 *            − codReturnsDeducted
	 *            − upiRefundsDeducted
	 *            + totalAdjustments
	 *
	 * (codFeeCollected is platform revenue, not deducted from artisan here)
	 */
	netPayable: { type: Number, required: true, default: 0 },

	// ── Traceability ─────────────────────────────────────────────────────────
	orderCount:    { type: Number, default: 0 },
	orders:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
	refundedOrders:[{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],

	// ── Status Workflow ──────────────────────────────────────────────────────
	status: {
		type: String,
		enum: ['draft', 'pending', 'approved', 'paid', 'disputed', 'cancelled'],
		default: 'draft',
		index: true
	},

	/** Bank / UPI transfer details after payout */
	payoutReference: { type: String },
	paidAt:          { type: Date },
	paidBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	paidNote:        { type: String },

	/** Admin who approved */
	approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	approvedAt: { type: Date },

	/** Dispute details */
	disputeNote:     { type: String },
	disputedAt:      { type: Date },
	disputeResolvedAt: { type: Date },

}, { timestamps: true })

// Compound index for uniqueness per artisan × period
settlementSchema.index({ artisanId: 1, periodStart: 1, periodEnd: 1 })
settlementSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model('Settlement', settlementSchema)
