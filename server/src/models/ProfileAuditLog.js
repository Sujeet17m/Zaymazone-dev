/**
 * ProfileAuditLog — immutable history of every artisan profile change.
 * One document per mutating action; records previous and new values for
 * each changed field so the dashboard can show a complete edit timeline.
 */
import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

// ── Sub-schema ────────────────────────────────────────────────────────────────
const fieldChangeSchema = new Schema(
  {
    field:         { type: String, required: true },
    previousValue: { type: Schema.Types.Mixed },
    newValue:      { type: Schema.Types.Mixed },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────
const profileAuditLogSchema = new Schema(
  {
    artisanId: {
      type: Schema.Types.ObjectId,
      ref: 'Artisan',
      required: true,
      index: true,
    },

    /** The actor who triggered the change (artisan self or admin UID/email). */
    changedBy: {
      userId:    { type: String },          // Firebase UID or Mongo ObjectId str
      userEmail: { type: String },
      role:      { type: String, enum: ['artisan', 'admin', 'system'], default: 'artisan' },
    },

    /** High-level event category. */
    action: {
      type: String,
      required: true,
      enum: [
        'profile_update',        // artisan edited their own profile
        'admin_update',          // admin edited artisan profile
        'status_change',         // approval / isActive toggled
        'verification_change',   // isVerified / documentVerification updated
        'badge_issued',          // verifiedBadge generated
        'password_change',       // password / credential rotation
      ],
    },

    /** List of top-level field names that were modified in this event. */
    changedFields: [{ type: String }],

    /** Granular before/after values per field. */
    changes: [fieldChangeSchema],

    /** Network / device context for security audit. */
    ipAddress: { type: String },
    userAgent:  { type: String },
  },
  {
    // createdAt is the audit timestamp — no updatedAt needed (immutable log)
    timestamps: { createdAt: true, updatedAt: false },
    // Prevent accidental updates to audit records
    strict: true,
  }
);

// Enforce immutability at the schema level: reject any save() that has isNew=false
profileAuditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('ProfileAuditLog records are immutable'));
  }
  next();
});

// Compound index for efficient per-artisan timeline queries (newest first)
profileAuditLogSchema.index({ artisanId: 1, createdAt: -1 });

// TTL: retain audit logs for 2 years then auto-purge (optional — remove if you
//      want permanent retention; set to 0 as sentinel value to disable purge)
// profileAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63_072_000 });

export default models.ProfileAuditLog || model('ProfileAuditLog', profileAuditLogSchema);
