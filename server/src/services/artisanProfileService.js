/**
 * artisanProfileService.js
 *
 * Module 4 – Artisan Profile Sync & Live Tracking
 *
 * Provides:
 *  • normalizePublicArtisan(raw)  – converts Artisan doc → safe public shape
 *  • normalizeDashboardArtisan(raw) – same doc → augmented dashboard shape
 *  • calculateCompletionScore(raw) – weighted profile-completeness (0-100)
 *  • recordAuditEntry(opts)        – writes immutable ProfileAuditLog row
 *  • getProfileHistory(artisanId, opts) – paginated audit-log query
 */
import ProfileAuditLog from '../models/ProfileAuditLog.js';

// ─── Public normalizer ────────────────────────────────────────────────────────
/**
 * Returns the `Artisan` frontend interface shape from a raw Mongoose lean doc.
 * Sensitive fields (password, bankDetails, GST/PAN/Aadhaar numbers, email,
 * internal flags) are stripped before sending to public consumers.
 *
 * @param {Object} a  Raw Artisan lean document
 * @returns {Object}  Safe public representation
 */
export function normalizePublicArtisan(a) {
  return {
    _id:           a._id?.toString(),
    name:          a.name ?? '',
    bio:           a.bio  ?? '',
    location: {
      city:    a.location?.city    ?? '',
      state:   a.location?.state   ?? '',
      country: a.location?.country ?? 'India',
    },
    avatar:        a.avatar        ?? '',
    coverImage:    a.coverImage    ?? '',
    specialties:   Array.isArray(a.specialties) ? a.specialties : [],
    experience:    a.experience    ?? 0,
    rating:        a.rating        ?? 0,
    totalRatings:  a.totalRatings  ?? 0,
    totalProducts: a.totalProducts ?? 0,
    totalSales:    a.totalSales    ?? 0,
    isActive:      Boolean(a.isActive),
    joinedDate:    a.joinedDate    ?? a.createdAt,
    socials: {
      instagram: a.socials?.instagram ?? '',
      facebook:  a.socials?.facebook  ?? '',
      website:   a.socials?.website   ?? '',
    },
    verification: {
      isVerified: Boolean(a.verification?.isVerified),
      verifiedAt: a.verification?.verifiedAt ?? null,
    },
    // Verified badge public face (tier/displayText only, no badgeId exposed)
    verifiedBadge: a.verifiedBadge?.badgeId
      ? {
          tier:        a.verifiedBadge.tier        ?? 'standard',
          displayText: a.verifiedBadge.displayText ?? 'Zaymazone Verified Artisan',
          issuedAt:    a.verifiedBadge.issuedAt    ?? null,
        }
      : null,
    approvalStatus: a.approvalStatus ?? 'pending',
  };
}

// ─── Dashboard normalizer ─────────────────────────────────────────────────────
/**
 * Converts raw Artisan doc to the richer "ArtisanProfile" shape consumed by
 * the ArtisanProfile.tsx dashboard page.  Field names match the TypeScript
 * interface defined in that file.
 *
 * @param {Object} a  Raw Artisan lean document
 * @returns {Object}  Dashboard profile payload
 */
export function normalizeDashboardArtisan(a) {
  const score = calculateCompletionScore(a);
  return {
    _id:            a._id?.toString(),
    fullName:       a.name                                    ?? '',
    email:          a.email                                   ?? '',
    mobileNumber:   a.businessInfo?.contact?.phone            ?? '',
    profilePic:     a.avatar                                  ?? '',
    bannerImage:     a.coverImage                              ?? '',
    shopName:        a.businessInfo?.businessName              ?? '',
    sellerType:     a.businessInfo?.sellerType                ?? 'non-gst',
    village:        a.businessInfo?.contact?.address?.village ?? '',
    district:       a.businessInfo?.contact?.address?.district ?? '',
    state:          a.businessInfo?.contact?.address?.state   ?? a.location?.state ?? '',
    pincode:        a.businessInfo?.contact?.address?.pincode ?? '',
    gstNumber:      a.businessInfo?.gstNumber                 ?? '',
    panNumber:      a.businessInfo?.panNumber                 ?? '',
    aadhaarNumber:  a.verification?.documentNumber            ?? '',
    productCategories: Array.isArray(a.specialties) ? a.specialties : [],
    productDescription: a.productInfo?.description            ?? '',
    materials:      a.productInfo?.materials                  ?? '',
    priceRange:     a.productInfo?.priceRange                 ?? { min: 0, max: 0 },
    stockQuantity:  a.productInfo?.stockQuantity              ?? 0,
    productPhotos:  Array.isArray(a.productInfo?.photos) ? a.productInfo.photos : [],
    shippingDetails: {
      pickupAddress: a.logistics?.pickupAddress ?? { sameAsMain: true, address: '' },
      dispatchTime:  a.logistics?.dispatchTime  ?? '',
      packagingType: a.logistics?.packagingType ?? '',
    },
    bankDetails: {
      accountNumber: a.verification?.bankDetails?.accountNumber ?? '',
      ifscCode:      a.verification?.bankDetails?.ifscCode      ?? '',
      bankName:      a.verification?.bankDetails?.bankName      ?? '',
    },
    upiId:           a.payment?.upiId            ?? '',
    paymentFrequency: a.payment?.paymentFrequency ?? '',
    bio:             a.bio                        ?? '',
    experience:      a.experience                 ?? 0,
    socials: {
      instagram: a.socials?.instagram ?? '',
      facebook:  a.socials?.facebook  ?? '',
      website:   a.socials?.website   ?? '',
    },
    approvalStatus: a.approvalStatus ?? 'pending',
    isActive:       Boolean(a.isActive),
    isVerified:     Boolean(a.verification?.isVerified),
    verifiedBadge:  a.verifiedBadge?.badgeId
      ? {
          tier:        a.verifiedBadge.tier        ?? 'standard',
          displayText: a.verifiedBadge.displayText ?? 'Zaymazone Verified Artisan',
          issuedAt:    a.verifiedBadge.issuedAt    ?? null,
        }
      : null,
    stats: {
      totalProducts: a.totalProducts ?? 0,
      totalSales:    a.totalSales    ?? 0,
      averageRating: a.rating        ?? 0,
      totalReviews:  a.totalRatings  ?? 0,
    },
    pendingChanges: a.pendingChanges ?? { hasChanges: false, changedFields: [] },
    completionScore: score.score,
    completionBreakdown: score.breakdown,
    createdAt: a.createdAt?.toISOString?.() ?? a.joinedDate?.toISOString?.() ?? null,
    updatedAt: a.updatedAt?.toISOString?.()  ?? null,
  };
}

// ─── Completion scorer ────────────────────────────────────────────────────────
/**
 * Calculates a weighted profile-completion score (0-100) broken down into
 * labelled sections so the dashboard can render a per-section checklist.
 *
 * Section weights:
 *   identity  20 pts  • name, bio, avatar, experience
 *   location  10 pts  • city, state, country
 *   business  20 pts  • businessName, sellerType, phone, village/district/state/pincode
 *   products  15 pts  • specialties(≥1), description, materials, priceRange, photos(≥1)
 *   documents 20 pts  • aadhaarProof, gstCertificate or gstNumber, bankDetails or upiId
 *   payment   10 pts  • upiId or bankAccount IFSC
 *   social     5 pts  • any one of instagram / facebook / website
 *
 * @param {Object} a  Raw Artisan lean document
 * @returns {{ score: number, breakdown: Object }}
 */
export function calculateCompletionScore(a) {
  const sections = {
    identity: {
      max: 20,
      items: [
        { label: 'Full name',          done: Boolean(a.name?.trim()), pts: 6 },
        { label: 'Bio',                done: Boolean(a.bio?.trim()),  pts: 5 },
        { label: 'Profile photo',      done: Boolean(a.avatar?.trim()), pts: 5 },
        { label: 'Years of experience', done: (a.experience ?? 0) > 0, pts: 4 },
      ],
    },
    location: {
      max: 10,
      items: [
        { label: 'City',    done: Boolean(a.location?.city?.trim()), pts: 3 },
        { label: 'State',   done: Boolean(a.location?.state?.trim()), pts: 4 },
        { label: 'Country', done: Boolean(a.location?.country?.trim()), pts: 3 },
      ],
    },
    business: {
      max: 20,
      items: [
        { label: 'Shop / business name', done: Boolean(a.businessInfo?.businessName?.trim()), pts: 5 },
        { label: 'Seller type',          done: Boolean(a.businessInfo?.sellerType), pts: 3 },
        { label: 'Phone number',         done: Boolean(a.businessInfo?.contact?.phone?.trim()), pts: 4 },
        { label: 'Village / district',   done: Boolean(a.businessInfo?.contact?.address?.village?.trim()), pts: 4 },
        { label: 'Pincode',              done: Boolean(a.businessInfo?.contact?.address?.pincode?.trim()), pts: 4 },
      ],
    },
    products: {
      max: 15,
      items: [
        { label: 'Product specialties (≥1)', done: (a.specialties?.length ?? 0) > 0, pts: 4 },
        { label: 'Product description',      done: Boolean(a.productInfo?.description?.trim()), pts: 4 },
        { label: 'Materials used',           done: Boolean(a.productInfo?.materials?.trim()), pts: 3 },
        { label: 'Price range',              done: (a.productInfo?.priceRange?.max ?? 0) > 0, pts: 2 },
        { label: 'Product photos (≥1)',      done: (a.productInfo?.photos?.length ?? 0) > 0, pts: 2 },
      ],
    },
    documents: {
      max: 20,
      items: [
        {
          label: 'Aadhaar proof uploaded',
          done: Boolean(a.documentVerification?.aadhaarProof || a.documents?.aadhaarProof),
          pts: 7,
        },
        {
          label: 'GST certificate / GST number',
          done: Boolean(
            a.documentVerification?.gstCertificate ||
            a.documents?.gstCertificate           ||
            a.businessInfo?.gstNumber?.trim()
          ),
          pts: 7,
        },
        {
          label: 'Bank account details',
          done: Boolean(
            a.documentVerification?.bankDetails ||
            (a.verification?.bankDetails?.accountNumber?.trim() &&
             a.verification?.bankDetails?.ifscCode?.trim())
          ),
          pts: 6,
        },
      ],
    },
    payment: {
      max: 10,
      items: [
        { label: 'UPI ID',              done: Boolean(a.payment?.upiId?.trim()), pts: 5 },
        { label: 'IFSC code',           done: Boolean(a.verification?.bankDetails?.ifscCode?.trim()), pts: 5 },
      ],
    },
    social: {
      max: 5,
      items: [
        {
          label: 'Any social link (Instagram / Facebook / Website)',
          done: Boolean(
            a.socials?.instagram?.trim() ||
            a.socials?.facebook?.trim()  ||
            a.socials?.website?.trim()
          ),
          pts: 5,
        },
      ],
    },
  };

  let totalPts  = 0;
  let totalMax  = 0;
  const breakdown = {};

  for (const [key, section] of Object.entries(sections)) {
    let earned = 0;
    const missing = [];
    for (const item of section.items) {
      if (item.done) {
        earned += item.pts;
      } else {
        missing.push(item.label);
      }
    }
    totalPts += earned;
    totalMax += section.max;
    breakdown[key] = {
      score:   earned,
      max:     section.max,
      percent: Math.round((earned / section.max) * 100),
      missing,
    };
  }

  return {
    score:     Math.round((totalPts / totalMax) * 100),
    breakdown,
  };
}

// ─── Audit helpers ────────────────────────────────────────────────────────────
/**
 * Appends one immutable row to ProfileAuditLog.
 * Non-blocking; errors are logged but not re-thrown so callers are unaffected.
 *
 * @param {Object} opts
 * @param {string|Object} opts.artisanId
 * @param {{ userId?: string, userEmail?: string, role?: string }} opts.changedBy
 * @param {string} opts.action
 * @param {string[]} opts.changedFields
 * @param {Array<{field, previousValue, newValue}>} [opts.changes]
 * @param {string} [opts.ipAddress]
 * @param {string} [opts.userAgent]
 */
export async function recordAuditEntry({
  artisanId,
  changedBy = {},
  action,
  changedFields = [],
  changes = [],
  ipAddress,
  userAgent,
}) {
  try {
    await ProfileAuditLog.create({
      artisanId,
      changedBy: {
        userId:    changedBy.userId    ?? null,
        userEmail: changedBy.userEmail ?? null,
        role:      changedBy.role      ?? 'artisan',
      },
      action,
      changedFields,
      changes,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });
  } catch (err) {
    console.error('[artisanProfileService] recordAuditEntry failed:', err.message);
    // Intentionally swallowed — audit failure must never break the API response
  }
}

/**
 * Returns paginated audit history for one artisan.
 *
 * @param {string|Object} artisanId
 * @param {{ page?: number, limit?: number }} [opts]
 * @returns {Promise<{ logs: Object[], total: number, page: number, totalPages: number }>}
 */
export async function getProfileHistory(artisanId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    ProfileAuditLog.find({ artisanId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProfileAuditLog.countDocuments({ artisanId }),
  ]);
  return {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}
