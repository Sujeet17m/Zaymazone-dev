import mongoose from 'mongoose'

/**
 * CodConfig - Logistics configuration for Cash on Delivery fee calculation.
 * Supports base fee + percentage fee model with per-state overrides.
 */
const codConfigSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        default: 'default',
        trim: true
    },

    // Fee structure
    baseFee: {
        type: Number,
        default: 25,
        min: 0,
        description: 'Fixed COD handling fee in INR'
    },
    percentageFee: {
        type: Number,
        default: 0,
        min: 0,
        max: 10,
        description: 'Percentage of order subtotal added as COD fee'
    },
    maxFee: {
        type: Number,
        default: 100,
        min: 0,
        description: 'Maximum cap on total COD fee in INR'
    },

    // Order amount eligibility
    minOrderAmount: {
        type: Number,
        default: 0,
        min: 0,
        description: 'Minimum order subtotal to allow COD'
    },
    maxOrderAmount: {
        type: Number,
        default: 10000,
        min: 0,
        description: 'Maximum order subtotal to allow COD'
    },

    // Geographic restrictions
    applicableStates: {
        type: [String],
        default: [],
        description: 'List of states where COD is available. Empty = all states.'
    },
    blockedStates: {
        type: [String],
        default: [],
        description: 'List of states where COD is NOT available.'
    },

    // Risk thresholds
    riskConfig: {
        maxReturnCount: {
            type: Number,
            default: 3,
            description: 'Number of COD returns before flagging user as high-risk'
        },
        newAccountDays: {
            type: Number,
            default: 7,
            description: 'Account age in days considered "new" for risk assessment'
        },
        newAccountHighValueThreshold: {
            type: Number,
            default: 3000,
            description: 'Order value threshold for new accounts to trigger risk flag'
        },
        rapidOrderWindowMinutes: {
            type: Number,
            default: 60,
            description: 'Time window in minutes to detect rapid COD order placement'
        },
        rapidOrderCount: {
            type: Number,
            default: 2,
            description: 'Number of COD orders within window to trigger risk flag'
        }
    },

    isActive: {
        type: Boolean,
        default: true
    },

    description: {
        type: String,
        maxLength: 500
    }
}, { timestamps: true })

// Indexes
codConfigSchema.index({ isActive: 1 })

export default mongoose.model('CodConfig', codConfigSchema)
