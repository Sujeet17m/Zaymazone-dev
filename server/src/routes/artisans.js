import { Router } from 'express'
import { z } from 'zod'
import Artisan from '../models/Artisan.js'
import { authenticateToken } from '../middleware/firebase-auth.js'
import {
	normalizePublicArtisan,
	normalizeDashboardArtisan,
	calculateCompletionScore,
	recordAuditEntry,
	getProfileHistory,
} from '../services/artisanProfileService.js'

const router = Router()

/**
 * Resolve the Artisan document for the authenticated user.
 * Primary lookup:  userId === req.user._id  (normal Firebase path)
 * Fallback lookup: email === req.user.email  (legacy / onboarding-created accounts)
 */
async function findArtisanForUser(req) {
	let artisan = await Artisan.findOne({ userId: req.user._id }).lean()
	if (artisan) return artisan
	const email = (req.user.email || req.firebaseUser?.email || '').toLowerCase().trim()
	if (email) {
		artisan = await Artisan.findOne({ email }).lean()
	}
	return artisan || null
}

const upsertSchema = z.object({
	name: z.string().min(1).max(200),
	bio: z.string().max(4000).optional().default(''),
	location: z.string().max(200).optional().default(''),
	socials: z.record(z.string(), z.string().url()).optional().default({}),
})

// Artisan profile schema for updates - only editable fields
const artisanProfileUpdateSchema = z.object({
	profilePic: z.string().optional(),
	bannerImage: z.string().optional(),
	mobileNumber: z.string().optional(),
	email: z.string().email().optional(),
	bio: z.string().max(1000).optional(),
	experience: z.number().min(0).max(100).optional(),
	socials: z.object({
		instagram: z.string().url().or(z.literal('')).optional(),
		facebook: z.string().url().or(z.literal('')).optional(),
		website: z.string().url().or(z.literal('')).optional(),
	}).optional(),
	shippingDetails: z.object({
		pickupAddress: z.object({
			sameAsMain: z.boolean(),
			address: z.string().optional()
		}).optional(),
		dispatchTime: z.string().optional(),
		packagingType: z.string().optional()
	}).optional()
}).partial()

router.get('/', async (_req, res) => {
	const items = await Artisan.find({ 
		isActive: true, 
		'verification.isVerified': true 
	}).limit(200).lean()
	return res.json(items)
})

// Artisan profile routes (must come before /:id route)

// ── GET /profile/completion ───────────────────────────────────────────────────
// Returns weighted completion score + per-section breakdown for the dashboard.
router.get('/profile/completion', authenticateToken, async (req, res) => {
	try {
		const artisan = await findArtisanForUser(req)
		if (!artisan) return res.status(404).json({ error: 'Artisan profile not found' })
		const { score, breakdown } = calculateCompletionScore(artisan)
		res.json({ score, breakdown })
	} catch (error) {
		console.error('Error computing completion score:', error)
		res.status(500).json({ error: 'Failed to compute completion score' })
	}
})

// ── GET /profile/history ──────────────────────────────────────────────────────
// Returns paginated audit history for the signed-in artisan.
router.get('/profile/history', authenticateToken, async (req, res) => {
	try {
		const artisan = await findArtisanForUser(req)
		if (!artisan) return res.status(404).json({ error: 'Artisan profile not found' })

		const page  = Math.max(1, parseInt(req.query.page)  || 1)
		const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20))

		const result = await getProfileHistory(artisan._id, { page, limit })
		res.json(result)
	} catch (error) {
		console.error('Error fetching profile history:', error)
		res.status(500).json({ error: 'Failed to fetch profile history' })
	}
})

// ── GET /profile ──────────────────────────────────────────────────────────────
// Get current user's artisan profile (any approval status — artisan can always
// view their own profile including while pending or rejected).
router.get('/profile', authenticateToken, async (req, res) => {
	try {
		// Look up by userId first (Firebase path), then fall back to email
		// (legacy / onboarding-created accounts) — no approval restriction so
		// pending and rejected artisans can also view their own profile.
		const artisan = await findArtisanForUser(req)

		if (!artisan) {
			return res.status(404).json({ error: 'Artisan profile not found' })
		}

		res.json(normalizeDashboardArtisan(artisan))
	} catch (error) {
		console.error('Error fetching artisan profile:', error)
		res.status(500).json({ error: 'Failed to fetch artisan profile' })
	}
})

// Update current user's artisan profile - only editable fields
router.put('/profile', authenticateToken, async (req, res) => {
	try {
		const parsed = artisanProfileUpdateSchema.safeParse(req.body)
		if (!parsed.success) {
			return res.status(400).json({ error: parsed.error.errors[0]?.message })
		}

		const updateData = parsed.data

		// Resolve artisan first so we can compare incoming values against current ones.
		// Primary: userId (Firebase); fallback: email (legacy accounts).
		const existing = await findArtisanForUser(req)
		if (!existing) {
			return res.status(404).json({ error: 'Artisan profile not found' })
		}

		// Helper: compare two scalar values for a true change (normalises to string)
		const scalarChanged = (incoming, current) =>
			String(incoming ?? '').trim() !== String(current ?? '').trim()

		// Build update object — only persist fields that actually changed
		const dbUpdate = {}
		const changedFields = []
		const pendingChangesData = {}

		if (updateData.profilePic !== undefined &&
				scalarChanged(updateData.profilePic, existing.avatar)) {
			dbUpdate.avatar = updateData.profilePic
			changedFields.push('profilePic')
			pendingChangesData.profilePic = updateData.profilePic
		}

		if (updateData.bannerImage !== undefined &&
				scalarChanged(updateData.bannerImage, existing.coverImage)) {
			dbUpdate.coverImage = updateData.bannerImage
			changedFields.push('bannerImage')
			pendingChangesData.bannerImage = updateData.bannerImage
		}

		if (updateData.email !== undefined &&
				scalarChanged(updateData.email.toLowerCase(), (existing.email ?? '').toLowerCase())) {
			dbUpdate.email = updateData.email
			changedFields.push('email')
			pendingChangesData.email = updateData.email
		}

		if (updateData.mobileNumber !== undefined &&
				scalarChanged(updateData.mobileNumber, existing.businessInfo?.contact?.phone)) {
			dbUpdate['businessInfo.contact.phone'] = updateData.mobileNumber
			changedFields.push('mobileNumber')
			pendingChangesData.mobileNumber = updateData.mobileNumber
		}

		if (updateData.bio !== undefined &&
				scalarChanged(updateData.bio, existing.bio)) {
			dbUpdate.bio = updateData.bio
			changedFields.push('bio')
			pendingChangesData.bio = updateData.bio
		}

		if (updateData.experience !== undefined &&
				Number(updateData.experience) !== Number(existing.experience ?? 0)) {
			dbUpdate.experience = updateData.experience
			changedFields.push('experience')
			pendingChangesData.experience = updateData.experience
		}

		if (updateData.socials !== undefined) {
			const socialChanges = {}
			let anySocialChanged = false
			if (updateData.socials.instagram !== undefined &&
					scalarChanged(updateData.socials.instagram, existing.socials?.instagram)) {
				dbUpdate['socials.instagram'] = updateData.socials.instagram
				socialChanges.instagram = updateData.socials.instagram
				anySocialChanged = true
			}
			if (updateData.socials.facebook !== undefined &&
					scalarChanged(updateData.socials.facebook, existing.socials?.facebook)) {
				dbUpdate['socials.facebook'] = updateData.socials.facebook
				socialChanges.facebook = updateData.socials.facebook
				anySocialChanged = true
			}
			if (updateData.socials.website !== undefined &&
					scalarChanged(updateData.socials.website, existing.socials?.website)) {
				dbUpdate['socials.website'] = updateData.socials.website
				socialChanges.website = updateData.socials.website
				anySocialChanged = true
			}
			if (anySocialChanged) {
				changedFields.push('socials')
				pendingChangesData.socials = socialChanges
			}
		}

		if (updateData.shippingDetails) {
			const pickupNew = updateData.shippingDetails.pickupAddress
			if (pickupNew !== undefined) {
				const pickupOld = existing.logistics?.pickupAddress
				const pickupChanged =
					Boolean(pickupNew.sameAsMain) !== Boolean(pickupOld?.sameAsMain) ||
					scalarChanged(pickupNew.address, pickupOld?.address)
				if (pickupChanged) {
					dbUpdate['logistics.pickupAddress'] = pickupNew
					changedFields.push('shippingDetails.pickupAddress')
					pendingChangesData.shippingPickupAddress = pickupNew
				}
			}
			if (updateData.shippingDetails.dispatchTime !== undefined &&
					scalarChanged(updateData.shippingDetails.dispatchTime, existing.logistics?.dispatchTime)) {
				dbUpdate['logistics.dispatchTime'] = updateData.shippingDetails.dispatchTime
				changedFields.push('shippingDetails.dispatchTime')
				pendingChangesData.shippingDispatchTime = updateData.shippingDetails.dispatchTime
			}
			if (updateData.shippingDetails.packagingType !== undefined &&
					scalarChanged(updateData.shippingDetails.packagingType, existing.logistics?.packagingType)) {
				dbUpdate['logistics.packagingType'] = updateData.shippingDetails.packagingType
				changedFields.push('shippingDetails.packagingType')
				pendingChangesData.shippingPackagingType = updateData.shippingDetails.packagingType
			}
		}

		// Accumulate changedFields with any previously tracked ones that weren't re-submitted
		// (preserves changes from an earlier partial save until admin acknowledges)
		const prevFields   = existing.pendingChanges?.changedFields ?? []
		const mergedFields = [...new Set([...prevFields, ...changedFields])]
		const prevChanges  = existing.pendingChanges?.changes ?? {}

		// Mark pending changes for admin awareness (no re-approval required)
		if (changedFields.length > 0) {
			dbUpdate['pendingChanges.hasChanges']    = true
			dbUpdate['pendingChanges.changedAt']     = new Date()
			dbUpdate['pendingChanges.changedFields'] = mergedFields
			dbUpdate['pendingChanges.changes']       = { ...prevChanges, ...pendingChangesData }
		}
		const updatedArtisan = await Artisan.findOneAndUpdate(
			{ _id: existing._id },
			{ $set: dbUpdate },
			{ new: true, runValidators: true }
		).lean()

		// ── Audit log (non-blocking) ──────────────────────────────────────────
		if (changedFields.length > 0) {
			setImmediate(() =>
				recordAuditEntry({
					artisanId:     updatedArtisan._id,
					changedBy: {
						userId:    req.user.uid   ?? req.user.sub,
						userEmail: req.user.email ?? null,
						role:      'artisan',
					},
					action:        'profile_update',
					changedFields,
					changes:       changedFields.map(f => ({
						field:         f,
						previousValue: null,   // full previous snapshot not tracked here
						newValue:      pendingChangesData[f] ?? null,
					})),
					ipAddress: req.ip,
					userAgent: req.headers['user-agent'],
				})
			)
		}

		// Return full updated dashboard profile so the client doesn't need a
		// separate re-fetch (maintains data freshness without an extra round-trip)
		res.json({
			message:        'Profile updated successfully.',
			changesTracked: changedFields.length > 0,
			profile:        normalizeDashboardArtisan(updatedArtisan),
		})
	} catch (error) {
		console.error('Error updating artisan profile:', error)
		res.status(500).json({ error: 'Failed to update artisan profile' })
	}
})

// Generic CRUD routes (must come after specific routes)
router.get('/:id', async (req, res) => {
	// Guard against non-ObjectId segments (e.g. /api/artisans/messages) hitting this wildcard
	if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
		return res.status(404).json({ error: 'Not found' })
	}
	const item = await Artisan.findById(req.params.id).lean()
	if (!item) return res.status(404).json({ error: 'Not found' })
	// Return only safe public fields — same normalised shape as the listing so
	// ArtisanDetailWithBackend.tsx and the artisan dashboard always receive an
	// identical structure regardless of which endpoint they call.
	return res.json(normalizePublicArtisan(item))
})

router.post('/', authenticateToken, async (req, res) => {
	const parsed = upsertSchema.safeParse(req.body)
	if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message })
	const created = await Artisan.create(parsed.data)
	return res.status(201).json(created)
})

router.put('/:id', authenticateToken, async (req, res) => {
	if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Not found' })
	const parsed = upsertSchema.partial().safeParse(req.body)
	if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message })
	const updated = await Artisan.findByIdAndUpdate(req.params.id, parsed.data, { new: true })
	if (!updated) return res.status(404).json({ error: 'Not found' })
	return res.json(updated)
})

router.delete('/:id', authenticateToken, async (req, res) => {
	if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Not found' })
	const deleted = await Artisan.findByIdAndDelete(req.params.id)
	if (!deleted) return res.status(404).json({ error: 'Not found' })
	return res.status(204).end()
})

export default router


