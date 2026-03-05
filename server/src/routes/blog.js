import { Router } from 'express'
import { z } from 'zod'
import mongoose from 'mongoose'
import BlogPost from '../models/BlogPost.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Validation schemas
const createBlogPostSchema = z.object({
	title: z.string().min(1).max(200),
	excerpt: z.string().min(1).max(500),
	content: z.string().min(1),
	featuredImage: z.string().url(),
	images: z.array(z.string().url()).optional().default([]),
	author: z.object({
		name: z.string().min(1),
		bio: z.string().optional().default(''),
		avatar: z.string().url().optional().default(''),
		role: z.string().optional().default('Writer')
	}),
	category: z.enum(['Traditional Crafts', 'Textiles', 'Metal Crafts', 'Pottery', 'Sustainability', 'Community Impact', 'Innovation', 'Business']),
	tags: z.array(z.string()).optional().default([]),
	status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
	featured: z.boolean().optional().default(false),
	readTime: z.string().optional().default('5 min read'),
	seoTitle: z.string().max(60).optional(),
	seoDescription: z.string().max(160).optional()
})

const updateBlogPostSchema = createBlogPostSchema.partial()

// GET /api/blog - Get all blog posts with filtering and pagination
router.get('/', async (req, res) => {
	try {
		const {
			page = 1,
			limit = 10,
			category,
			status = 'published',
			featured,
			search,
			author,
			tags,
			sort = '-publishedAt'
		} = req.query

		const query = { isActive: true }
		
		// Filter by status (only published for public, all for admin)
		if (status) query.status = status
		
		// Filter by category
		if (category && category !== 'All') query.category = category
		
		// Filter by featured
		if (featured !== undefined) query.featured = featured === 'true'
		
		// Filter by author
		if (author) query['author.name'] = new RegExp(author, 'i')
		
		// Filter by tags
		if (tags) {
			const tagArray = tags.split(',').map(tag => tag.trim())
			query.tags = { $in: tagArray }
		}
		
		// Search functionality
		if (search) {
			query.$text = { $search: search }
		}

		const skip = (parseInt(page) - 1) * parseInt(limit)
		
		const [posts, total] = await Promise.all([
			BlogPost.find(query)
				.sort(sort)
				.skip(skip)
				.limit(parseInt(limit))
				.lean(),
			BlogPost.countDocuments(query)
		])

		const totalPages = Math.ceil(total / parseInt(limit))
		
		res.json({
			posts,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
				total,
				totalPages,
				hasNext: parseInt(page) < totalPages,
				hasPrev: parseInt(page) > 1
			}
		})
	} catch (error) {
		res.status(500).json({ error: 'Server error' })
	}
})

// GET /api/blog/categories - Get all categories with post counts
router.get('/categories', async (req, res) => {
	try {
		const categories = await BlogPost.aggregate([
			{ $match: { status: 'published', isActive: true } },
			{ $group: { _id: '$category', count: { $sum: 1 } } },
			{ $sort: { count: -1 } }
		])
		
		// Return just category names for the frontend
		const categoryNames = categories.map(cat => cat._id)
		
		res.json(categoryNames)
	} catch (error) {
		res.status(500).json({ error: 'Server error' })
	}
})

// GET /api/blog/tags - Get popular tags
router.get('/tags', async (req, res) => {
	try {
		const tags = await BlogPost.aggregate([
			{ $match: { status: 'published', isActive: true } },
			{ $unwind: '$tags' },
			{ $group: { _id: '$tags', count: { $sum: 1 } } },
			{ $sort: { count: -1 } },
			{ $limit: 20 }
		])
		
		res.json(tags.map(tag => ({
			name: tag._id,
			count: tag.count
		})))
	} catch (error) {
		res.status(500).json({ error: 'Server error' })
	}
})

// GET /api/blog/featured - Get featured posts
router.get('/featured', async (req, res) => {
	try {
		const posts = await BlogPost.find({
			status: 'published',
			featured: true,
			isActive: true
		})
		.sort('-publishedAt')
		.limit(6)
		.lean()
		
		res.json(posts)
	} catch (error) {
		res.status(500).json({ error: 'Server error' })
	}
})

// GET /api/blog/:id - Get single blog post by ID or slug
router.get('/:identifier', async (req, res) => {
	try {
		const { identifier } = req.params
		
		// Try to find by ID first, then by slug
		const query = mongoose.Types.ObjectId.isValid(identifier) 
			? { _id: identifier } 
			: { slug: identifier }
		
		query.isActive = true
		query.status = 'published' // Only published posts for public
		
		const post = await BlogPost.findOne(query).lean()
		
		if (!post) {
			return res.status(404).json({ error: 'Blog post not found' })
		}
		
		// Increment view count
		await BlogPost.findByIdAndUpdate(post._id, { $inc: { views: 1 } })
		
		res.json(post)
	} catch (error) {
		res.status(500).json({ error: 'Server error' })
	}
})

// GET /api/blog/:id/related - Get related posts
router.get('/:identifier/related', async (req, res) => {
	try {
		const { identifier } = req.params
		const { limit = 3 } = req.query
		
		const query = mongoose.Types.ObjectId.isValid(identifier) 
			? { _id: identifier } 
			: { slug: identifier }
		
		const currentPost = await BlogPost.findOne(query).lean()
		
		if (!currentPost) {
			return res.status(404).json({ error: 'Blog post not found' })
		}
		
		// Find related posts by category and tags
		const relatedPosts = await BlogPost.find({
			_id: { $ne: currentPost._id },
			status: 'published',
			isActive: true,
			$or: [
				{ category: currentPost.category },
				{ tags: { $in: currentPost.tags } }
			]
		})
		.sort('-publishedAt')
		.limit(parseInt(limit))
		.lean()
		
		res.json(relatedPosts)
	} catch (error) {
		res.status(500).json({ error: 'Server error' })
	}
})

// POST /api/blog - Create new blog post (Auth required)
router.post('/', requireAuth, async (req, res) => {
	try {
		const parsed = createBlogPostSchema.safeParse(req.body)
		if (!parsed.success) {
			return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors })
		}
		
		// Check if the author is an approved artisan
		const artisan = await mongoose.model('Artisan').findOne({ userId: req.user.id })
		const isApprovedArtisan = artisan && artisan.approvalStatus === 'approved'
		
		const postData = {
			...parsed.data,
			authorId: req.user.id,
			approvalStatus: isApprovedArtisan ? 'approved' : 'pending',
			isActive: isApprovedArtisan
		}
		
		const post = new BlogPost(postData)
		await post.save()
		
		res.status(201).json({ message: 'Blog post created successfully', post })
	} catch (error) {
		if (error.code === 11000) {
			return res.status(400).json({ error: 'A post with this title already exists' })
		}
		res.status(500).json({ error: 'Server error' })
	}
})

// PUT /api/blog/:id - Update blog post (Auth required)
router.put('/:id', requireAuth, async (req, res) => {
	try {
		const parsed = updateBlogPostSchema.safeParse(req.body)
		if (!parsed.success) {
			return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors })
		}
		
		const post = await BlogPost.findByIdAndUpdate(
			req.params.id,
			parsed.data,
			{ new: true, runValidators: true }
		)
		
		if (!post) {
			return res.status(404).json({ error: 'Blog post not found' })
		}
		
		res.json({ message: 'Blog post updated successfully', post })
	} catch (error) {
		res.status(500).json({ error: 'Server error' })
	}
})

// PATCH /api/blog/:id/like - Like a blog post
router.patch('/:id/like', async (req, res) => {
	try {
		const post = await BlogPost.findByIdAndUpdate(
			req.params.id,
			{ $inc: { likes: 1 } },
			{ new: true }
		)
		
		if (!post) {
			return res.status(404).json({ error: 'Blog post not found' })
		}
		
		res.json({ message: 'Post liked successfully', likes: post.likes })
	} catch (error) {
		res.status(500).json({ error: 'Server error' })
	}
})

// DELETE /api/blog/:id - Delete blog post (Auth required)
router.delete('/:id', requireAuth, async (req, res) => {
	try {
		const post = await BlogPost.findByIdAndUpdate(
			req.params.id,
			{ isActive: false },
			{ new: true }
		)
		
		if (!post) {
			return res.status(404).json({ error: 'Blog post not found' })
		}
		
		res.json({ message: 'Blog post deleted successfully' })
	} catch (error) {
		res.status(500).json({ error: 'Server error' })
	}
})

export default router
