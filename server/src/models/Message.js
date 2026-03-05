import mongoose from 'mongoose'

const messageEntrySchema = new mongoose.Schema({
	sender:        { type: String, enum: ['customer', 'artisan'], required: true },
	senderId:      { type: mongoose.Schema.Types.ObjectId }, // userId or artisanId
	content:       { type: String, required: true, maxlength: 2000 },
	readByArtisan: { type: Boolean, default: false },
}, { timestamps: true })

const conversationSchema = new mongoose.Schema({
	artisanId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Artisan',
		required: true,
		index: true,
	},
	customerId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		index: true,
	},
	customerName:  { type: String, required: true },
	customerEmail: { type: String, required: true },

	// Optional: link to the product/order the inquiry is about
	productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
	orderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

	subject: { type: String, required: true, maxlength: 200 },

	status: {
		type: String,
		enum: ['open', 'replied', 'closed'],
		default: 'open',
		index: true,
	},

	// Unread counter from the artisan's perspective
	unreadByArtisan: { type: Number, default: 1, min: 0 },

	lastMessageAt: { type: Date, default: Date.now, index: true },

	thread: [messageEntrySchema],
}, { timestamps: true })

// Compound index for fast artisan inbox query
conversationSchema.index({ artisanId: 1, lastMessageAt: -1 })

const Conversation = mongoose.model('Conversation', conversationSchema)
export default Conversation
