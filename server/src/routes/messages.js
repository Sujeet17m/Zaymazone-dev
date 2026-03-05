import { Router }  from 'express'
import { z }        from 'zod'
import Conversation from '../models/Message.js'
import Artisan      from '../models/Artisan.js'
import User         from '../models/User.js'
import { authenticateToken } from '../middleware/firebase-auth.js'
import { optionalAuth }      from '../middleware/auth.js'

const router = Router()

/** Resolve Artisan document from an authenticated request (mirrors seller.js helper). */
async function getArtisanForRequest(req) {
	let artisan = await Artisan.findOne({ userId: req.user._id })
	if (artisan) return artisan

	const email = (req.user.email || '').toLowerCase().trim()
	if (email) {
		artisan = await Artisan.findOne({ email })
		if (artisan) {
			artisan.userId = req.user._id
			await artisan.save()
			return artisan
		}
	}
	return null
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER-FACING — POST /api/messages
// Creates a new inquiry thread.  Auth optional (guests can inquire too).
// ─────────────────────────────────────────────────────────────────────────────
const newInquirySchema = z.object({
	artisanId:   z.string().min(1),
	subject:     z.string().min(5).max(200),
	message:     z.string().min(10).max(2000),
	customerName:  z.string().min(1).max(100).optional(),
	customerEmail: z.string().email().optional(),
	productId:   z.string().optional(),
	orderId:     z.string().optional(),
})

router.post('/', optionalAuth, async (req, res) => {
	try {
		const parsed = newInquirySchema.safeParse(req.body)
		if (!parsed.success) {
			return res.status(400).json({
				error: 'Invalid request',
				details: parsed.error.errors.map(e => e.message),
			})
		}

		const { artisanId, subject, message, productId, orderId } = parsed.data
		let customerName  = parsed.data.customerName
		let customerEmail = parsed.data.customerEmail
		let customerId    = null

		// If authenticated, use user data
		if (req.user) {
			customerId    = req.user._id
			customerName  = req.user.name  || customerName  || 'Customer'
			customerEmail = req.user.email || customerEmail || ''
		}

		if (!customerName || !customerEmail) {
			return res.status(400).json({ error: 'customerName and customerEmail are required for guest inquiries' })
		}

		const artisan = await Artisan.findById(artisanId)
		if (!artisan) return res.status(404).json({ error: 'Artisan not found' })

		const conversation = await Conversation.create({
			artisanId,
			customerId,
			customerName,
			customerEmail,
			subject,
			productId: productId || undefined,
			orderId:   orderId   || undefined,
			status:    'open',
			unreadByArtisan: 1,
			lastMessageAt:   new Date(),
			thread: [{
				sender:        'customer',
				senderId:      customerId,
				content:       message,
				readByArtisan: false,
			}],
		})

		return res.status(201).json({
			message: 'Inquiry sent successfully',
			conversationId: conversation._id,
		})
	} catch (err) {
		console.error('[messages] POST /:', err)
		return res.status(500).json({ error: 'Failed to send inquiry' })
	}
})

// ─────────────────────────────────────────────────────────────────────────────
// ARTISAN-FACING — all routes below require artisan auth
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/messages  — inbox list
router.get('/', authenticateToken, async (req, res) => {
	try {
		const artisan = await getArtisanForRequest(req)
		if (!artisan) return res.status(404).json({ error: 'Artisan profile not found' })

		const { status = 'all', page = '1', limit = '20', search = '' } = req.query
		const pageNum  = Math.max(1, parseInt(page))
		const limitNum = Math.min(50, Math.max(1, parseInt(limit)))

		const filter = { artisanId: artisan._id }
		if (status !== 'all') filter.status = status
		if (search) {
			filter.$or = [
				{ customerName:  { $regex: search, $options: 'i' } },
				{ customerEmail: { $regex: search, $options: 'i' } },
				{ subject:       { $regex: search, $options: 'i' } },
			]
		}

		const [conversations, total] = await Promise.all([
			Conversation.find(filter)
				.select('customerName customerEmail subject status unreadByArtisan lastMessageAt thread createdAt productId orderId')
				.sort({ lastMessageAt: -1 })
				.skip((pageNum - 1) * limitNum)
				.limit(limitNum)
				.lean(),
			Conversation.countDocuments(filter),
		])

		// Attach last message preview to each conversation
		const inbox = conversations.map(c => ({
			...c,
			lastMessage: c.thread[c.thread.length - 1]?.content?.slice(0, 120) || '',
			messageCount: c.thread.length,
			thread: undefined, // don't send full thread in list view
		}))

		const unreadTotal = await Conversation.aggregate([
			{ $match: { artisanId: artisan._id } },
			{ $group: { _id: null, total: { $sum: '$unreadByArtisan' } } },
		])

		return res.json({
			conversations: inbox,
			pagination: {
				page: pageNum,
				limit: limitNum,
				total,
				pages: Math.ceil(total / limitNum),
			},
			unreadTotal: unreadTotal[0]?.total || 0,
		})
	} catch (err) {
		console.error('[messages] GET /:', err)
		return res.status(500).json({ error: 'Failed to load messages' })
	}
})

// GET /api/messages/:id  — full thread
router.get('/:id', authenticateToken, async (req, res) => {
	try {
		const artisan = await getArtisanForRequest(req)
		if (!artisan) return res.status(404).json({ error: 'Artisan profile not found' })

		const conversation = await Conversation.findOne({
			_id: req.params.id,
			artisanId: artisan._id,
		}).lean()

		if (!conversation) return res.status(404).json({ error: 'Conversation not found' })

		return res.json({ conversation })
	} catch (err) {
		console.error('[messages] GET /:id:', err)
		return res.status(500).json({ error: 'Failed to load conversation' })
	}
})

// POST /api/messages/:id/reply  — artisan sends a reply
const replySchema = z.object({
	content: z.string().min(1).max(2000),
})

router.post('/:id/reply', authenticateToken, async (req, res) => {
	try {
		const artisan = await getArtisanForRequest(req)
		if (!artisan) return res.status(404).json({ error: 'Artisan profile not found' })

		const parsed = replySchema.safeParse(req.body)
		if (!parsed.success) {
			return res.status(400).json({
				error: 'content is required',
				details: parsed.error.errors.map(e => e.message),
			})
		}

		const conversation = await Conversation.findOne({
			_id: req.params.id,
			artisanId: artisan._id,
		})

		if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
		if (conversation.status === 'closed') {
			return res.status(400).json({ error: 'Cannot reply to a closed conversation' })
		}

		conversation.thread.push({
			sender:        'artisan',
			senderId:      artisan._id,
			content:       parsed.data.content,
			readByArtisan: true,
		})

		conversation.status        = 'replied'
		conversation.lastMessageAt = new Date()

		// Mark all customer messages as read since artisan is actively replying
		conversation.thread.forEach(m => {
			if (m.sender === 'customer') m.readByArtisan = true
		})
		conversation.unreadByArtisan = 0

		await conversation.save()

		return res.json({
			message: 'Reply sent',
			thread: conversation.thread,
		})
	} catch (err) {
		console.error('[messages] POST /:id/reply:', err)
		return res.status(500).json({ error: 'Failed to send reply' })
	}
})

// PATCH /api/messages/:id/read  — mark conversation as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
	try {
		const artisan = await getArtisanForRequest(req)
		if (!artisan) return res.status(404).json({ error: 'Artisan profile not found' })

		const conversation = await Conversation.findOne({
			_id: req.params.id,
			artisanId: artisan._id,
		})
		if (!conversation) return res.status(404).json({ error: 'Conversation not found' })

		conversation.thread.forEach(m => {
			if (m.sender === 'customer') m.readByArtisan = true
		})
		conversation.unreadByArtisan = 0
		await conversation.save()

		return res.json({ message: 'Marked as read' })
	} catch (err) {
		console.error('[messages] PATCH /:id/read:', err)
		return res.status(500).json({ error: 'Failed to mark as read' })
	}
})

// PATCH /api/messages/:id/close  — close a conversation
router.patch('/:id/close', authenticateToken, async (req, res) => {
	try {
		const artisan = await getArtisanForRequest(req)
		if (!artisan) return res.status(404).json({ error: 'Artisan profile not found' })

		const conversation = await Conversation.findOneAndUpdate(
			{ _id: req.params.id, artisanId: artisan._id },
			{ status: 'closed' },
			{ new: true, select: 'status' }
		)
		if (!conversation) return res.status(404).json({ error: 'Conversation not found' })

		return res.json({ message: 'Conversation closed', status: conversation.status })
	} catch (err) {
		console.error('[messages] PATCH /:id/close:', err)
		return res.status(500).json({ error: 'Failed to close conversation' })
	}
})

// PATCH /api/messages/:id/reopen  — reopen a closed conversation
router.patch('/:id/reopen', authenticateToken, async (req, res) => {
	try {
		const artisan = await getArtisanForRequest(req)
		if (!artisan) return res.status(404).json({ error: 'Artisan profile not found' })

		const conversation = await Conversation.findOneAndUpdate(
			{ _id: req.params.id, artisanId: artisan._id },
			{ status: 'open' },
			{ new: true, select: 'status' }
		)
		if (!conversation) return res.status(404).json({ error: 'Conversation not found' })

		return res.json({ message: 'Conversation reopened', status: conversation.status })
	} catch (err) {
		console.error('[messages] PATCH /:id/reopen:', err)
		return res.status(500).json({ error: 'Failed to reopen conversation' })
	}
})

export default router
