import { Router } from 'express'
import { z } from 'zod'
import Product from '../models/Product.js'
import Artisan from '../models/Artisan.js'
import Category from '../models/Category.js'
import BlogPost from '../models/BlogPost.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'
import { authenticateToken } from '../middleware/firebase-auth.js'
import { validate, paginationSchema, searchSchema } from '../middleware/validation.js'

const router = Router()

const upsertSchema = z.object({
	name: z.string().min(1).max(200),
	description: z.string().max(4000).optional().default(''),
	price: z.number().nonnegative(),
	originalPrice: z.number().nonnegative().optional(),
	images: z.array(z.string()).optional().default([]),
	artisanId: z.string().regex(/^[0-9a-fA-F]{24}$/),
	category: z.enum(['pottery', 'textiles', 'jewelry', 'woodwork', 'metalwork', 'paintings', 'crafts', 'toys']),
	subcategory: z.string().optional(),
	materials: z.array(z.string()).optional().default([]),
	colors: z.array(z.string()).optional().default([]),
	tags: z.array(z.string()).optional().default([]),
	stockCount: z.number().int().nonnegative().optional().default(0),
	inStock: z.boolean().optional().default(true),
	dimensions: z.string().optional(),
	weight: z.string().optional(),
	shippingTime: z.string().optional(),
	featured: z.boolean().optional().default(false),
	isHandmade: z.boolean().optional().default(true)
})

// Enhanced products listing with search, filter, and pagination
router.get('/', 
	validate(z.object({
		...paginationSchema.shape,
		...searchSchema.shape,
		featured: z.coerce.boolean().optional(),
		sortBy: z.enum(['name', 'price', 'rating', 'createdAt', 'salesCount']).optional().default('createdAt')
	}), 'query'),
	async (req, res) => {
		try {
			const {
				page = 1,
				limit = 20,
				q,
				category,
				minPrice,
				maxPrice,
				artisanId,
				inStock,
				featured,
				sortBy = 'createdAt',
				order = 'desc'
			} = req.validatedQuery

			// Build filter
			const filter = { 
				isActive: true,
				approvalStatus: 'approved'
			}

			if (q) {
				filter.$text = { $search: q }
			}

			if (category) {
				filter.category = category
			}

			if (minPrice !== undefined || maxPrice !== undefined) {
				filter.price = {}
				if (minPrice !== undefined) filter.price.$gte = minPrice
				if (maxPrice !== undefined) filter.price.$lte = maxPrice
			}

			if (artisanId) {
				filter.artisanId = artisanId
			}

			if (inStock) {
				filter.stock = { $gt: 0 }
			}

			if (featured !== undefined) {
				filter.featured = featured
			}

			// Build sort
			const sort = {}
			if (q && !sortBy) {
				sort.score = { $meta: 'textScore' }
			} else {
				sort[sortBy] = order === 'desc' ? -1 : 1
			}

			// Execute query with pagination
			const skip = (page - 1) * limit
			const [products, total] = await Promise.all([
				Product.find(filter)
					.sort(sort)
					.skip(skip)
					.limit(limit)
					.populate('artisanId', 'name location.city location.state bio avatar rating totalProducts')
					.lean(),
				Product.countDocuments(filter)
			])

			// Transform products to match frontend interface
			const transformedProducts = products.map(product => ({
				id: product._id.toString(),
				name: product.name,
				description: product.description,
				price: product.price,
				originalPrice: product.originalPrice,
				images: Array.isArray(product.images) ? product.images : [],
				category: product.category,
				subcategory: product.subcategory,
				materials: Array.isArray(product.materials) ? product.materials : [],
				dimensions: product.dimensions,
				weight: product.weight,
				colors: Array.isArray(product.colors) ? product.colors : [],
				inStock: product.inStock ?? ((product.stock ?? product.stockCount ?? 0) > 0),
				stockCount: product.stock ?? product.stockCount ?? 0,
				artisan: product.artisanId ? {
					id: product.artisanId._id.toString(), 
					name: product.artisanId.name,
					location: `${product.artisanId.location.city}, ${product.artisanId.location.state}`,
					bio: product.artisanId.bio,
					avatar: product.artisanId.avatar,
					rating: product.artisanId.rating,
					totalProducts: product.artisanId.totalProducts
				} : null,
				rating: product.rating,
				reviewCount: product.reviewCount,
				tags: Array.isArray(product.tags) ? product.tags : [],
				isHandmade: product.isHandmade,
				shippingTime: product.shippingTime,
				featured: product.featured,
				// Enhanced features
				images360: product.images360 || [],
				videos: product.videos || [],
				sizeGuide: product.sizeGuide || null,
				careInstructions: product.careInstructions || null
			}))

			const totalPages = Math.ceil(total / limit)

			return res.json({
				products: transformedProducts,
				pagination: {
					page,
					limit,
					total,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1
				}
			})
		} catch (error) {
			console.error('Products list error:', error)
			return res.status(500).json({ error: 'Server error' })
		}
	}
)

// Public endpoints for page content and categories - MUST BE BEFORE /:id route
router.get('/page-content/:pageId', async (req, res) => {
	try {
		const { pageId } = req.params
		
		// For now, return mock data. In production, this would come from a database
		const pageContents = {
			shop: {
				title: "Shop Artisan Crafts",
				description: "Discover authentic handcrafted treasures from skilled artisans across India"
			},
			artisans: {
				title: "Meet Our Artisans",
				description: "Discover the talented craftspeople behind our beautiful products. Each artisan brings decades of experience and passion to their craft, preserving ancient traditions while creating contemporary masterpieces."
			},
			categories: {
				title: "Explore Categories",
				description: "Browse our curated collection of handcrafted products organized by traditional craft categories"
			},
			blog: {
				title: "Craft Stories & Insights",
				description: "Read about the stories behind the crafts, artisan journeys, and insights into India's rich craft heritage"
			}
		}

		const content = pageContents[pageId]
		if (!content) {
			return res.status(404).json({ error: 'Page content not found' })
		}

		res.json(content)
	} catch (error) {
		console.error('Get page content error:', error)
		res.status(500).json({ error: 'Failed to fetch page content' })
	}
})

// Get artisans endpoint
router.get('/artisans', async (req, res) => {
	try {
		console.log('🔍 Starting artisans endpoint...')
		
		// Get artisans from database
		const artisans = await Artisan.find({ 
			isActive: true,
			approvalStatus: 'approved'
		}).limit(20)
		
		console.log(`🔍 Found ${artisans.length} artisans`)
		
		// Transform artisans to match frontend interface
		const baseUrl = `${req.protocol}://${req.get('host')}`
		const transformedArtisans = artisans.map(artisan => ({
			id: artisan._id.toString(),
			name: artisan.name,
			specialty: artisan.specialties && artisan.specialties.length > 0 ? artisan.specialties[0] : 'Artisan',
			location: `${artisan.location.city}, ${artisan.location.state}`,
			experience: `${artisan.experience} years`,
			rating: artisan.rating || 0,
			products: artisan.totalProducts || 0,
			image: artisan.coverImage ? `${baseUrl}/api/images/${artisan.coverImage.split('/').pop()}` : '/placeholder.svg',
			avatar: artisan.avatar || '/placeholder.svg',
			description: artisan.bio || '',
			achievements: [
				'Verified Artisan', 
				`${artisan.totalProducts || 0} Products`, 
				`${artisan.experience || 0}+ Years Experience`
			],
			joinedYear: artisan.joinedDate ? new Date(artisan.joinedDate).getFullYear().toString() : undefined,
			specialties: artisan.specialties || []
		}))
		
		res.json({ artisans: transformedArtisans })
	} catch (error) {
		console.error('❌ Get artisans error:', error)
		res.status(500).json({ error: 'Server error' })
	}
})

// Get single product with artisan details
router.get('/:id', optionalAuth, async (req, res) => {
	try {
		const product = await Product.findById(req.params.id)
			.populate('artisanId', 'name bio location.city location.state rating totalProducts avatar')
			.lean()

		if (!product || !product.isActive) {
			return res.status(404).json({ error: 'Product not found' })
		}

		// Transform product to match frontend interface
		const transformedProduct = {
			id: product._id.toString(),
			name: product.name,
			description: product.description,
			price: product.price,
			originalPrice: product.originalPrice,
			images: Array.isArray(product.images) ? product.images : [],
			category: product.category,
			subcategory: product.subcategory,
			materials: Array.isArray(product.materials) ? product.materials : [],
			dimensions: product.dimensions,
			weight: product.weight,
			colors: Array.isArray(product.colors) ? product.colors : [],
			inStock: product.inStock ?? ((product.stock ?? product.stockCount ?? 0) > 0),
			stockCount: product.stock ?? product.stockCount ?? 0,
			artisan: product.artisanId ? {
				id: product.artisanId._id.toString(),
				name: product.artisanId.name,
				location: `${product.artisanId.location.city}, ${product.artisanId.location.state}`,
				bio: product.artisanId.bio,
				avatar: product.artisanId.avatar,
				rating: product.artisanId.rating,
				totalProducts: product.artisanId.totalProducts
			} : null,
			rating: product.rating,
			reviewCount: product.reviewCount,
			tags: Array.isArray(product.tags) ? product.tags : [],
			isHandmade: product.isHandmade,
			shippingTime: product.shippingTime,
			featured: product.featured,
			// Enhanced features
			images360: product.images360 || [],
			videos: product.videos || [],
			sizeGuide: product.sizeGuide || null,
			careInstructions: product.careInstructions || null,
			model3d: product.model3d || null,
			model3d: product.model3d || null
		}

		// Increment view count (fire and forget)
		Product.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }).exec()

		return res.json(transformedProduct)
	} catch (error) {
		console.error('Get product error:', error)
		return res.status(500).json({ error: 'Server error' })
	}
})

router.post('/', requireAuth, async (req, res) => {
	const parsed = upsertSchema.safeParse(req.body)
	if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message })
	const existsArtisan = await Artisan.findById(parsed.data.artisanId)
	if (!existsArtisan) return res.status(400).json({ error: 'Invalid artisanId' })

	// If artisan is approved, auto-approve the product
	const productData = {
		...parsed.data,
		approvalStatus: existsArtisan.approvalStatus === 'approved' ? 'approved' : 'pending',
		isActive: existsArtisan.approvalStatus === 'approved'
	}

	const created = await Product.create(productData)
	return res.status(201).json(created)
})

router.put('/:id', requireAuth, async (req, res) => {
	const parsed = upsertSchema.partial().safeParse(req.body)
	if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message })
	const updated = await Product.findByIdAndUpdate(req.params.id, parsed.data, { new: true })
	if (!updated) return res.status(404).json({ error: 'Not found' })
	return res.json(updated)
})

router.delete('/:id', requireAuth, async (req, res) => {
	const deleted = await Product.findByIdAndDelete(req.params.id)
	if (!deleted) return res.status(404).json({ error: 'Not found' })
	return res.status(204).end()
})

// Artisan routes
// Get artisan's products
router.get('/artisan/my-products',
	authenticateToken,
	validate(paginationSchema, 'query'),
	async (req, res) => {
		try {
			const { page, limit, sort, order } = req.validatedQuery
			const skip = (page - 1) * limit
			
			const sortObj = {}
			if (sort) {
				sortObj[sort] = order === 'asc' ? 1 : -1
			} else {
				sortObj.createdAt = -1
			}
			
			const products = await Product.find({ artisanId: req.user._id })
				.sort(sortObj)
				.skip(skip)
				.limit(limit)
				.populate('artisanId', 'name')
				.select('-__v')
				.lean()
			
			const total = await Product.countDocuments({ artisanId: req.user._id })
			
			res.json({
				products,
				pagination: {
					page,
					limit,
					total,
					pages: Math.ceil(total / limit)
				}
			})
		} catch (error) {
			console.error('Error fetching artisan products:', error)
			res.status(500).json({ error: 'Failed to fetch products' })
		}
	}
)

router.get('/categories', async (req, res) => {
	try {
		console.log('🔍 Starting categories endpoint...')
		
		// Get categories from database
		console.log('🔍 Fetching categories from database...')
		try {
			const categories = await Category.find({ isActive: true })
				.sort({ featured: -1, displayOrder: 1, name: 1 })
			console.log(`🔍 Found ${categories.length} categories`)

			// Transform for frontend compatibility  
			console.log('🔍 Transforming categories for frontend...')
			const transformedCategories = categories.map(cat => ({
				id: cat.slug,
				_id: cat._id,
				name: cat.name,
				slug: cat.slug,
				description: cat.description,
				image: cat.image,
				icon: cat.icon,
				subcategories: cat.subcategories,
				featured: cat.featured,
				productCount: cat.productCount,
				artisanCount: cat.artisanCount,
				displayOrder: cat.displayOrder,
				createdAt: cat.createdAt,
				updatedAt: cat.updatedAt
			}))
			console.log('🔍 Categories transformed successfully')

			res.json({ categories: transformedCategories })
			console.log('🔍 Categories response sent successfully')
		} catch (dbError) {
			console.warn('⚠️  Database error fetching categories, returning mock data:', dbError.message)
			
			// Return mock categories when database is unavailable
			const mockCategories = [
				{
					id: 'pottery',
					_id: '1',
					name: 'Pottery & Ceramics',
					slug: 'pottery',
					description: 'Beautiful handcrafted pottery and ceramic pieces',
					image: 'https://via.placeholder.com/300x300?text=Pottery',
					icon: 'Palette',
					subcategories: ['Bowls', 'Vases', 'Plates', 'Decorative'],
					featured: true,
					productCount: 45,
					artisanCount: 12,
					displayOrder: 1,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'textiles',
					_id: '2',
					name: 'Textiles & Fabrics',
					slug: 'textiles',
					description: 'Traditional handwoven textiles and fabrics',
					image: 'https://via.placeholder.com/300x300?text=Textiles',
					icon: 'Layers',
					subcategories: ['Sarees', 'Scarves', 'Dhurries', 'Cushions'],
					featured: true,
					productCount: 38,
					artisanCount: 15,
					displayOrder: 2,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'jewelry',
					_id: '3',
					name: 'Jewelry & Accessories',
					slug: 'jewelry',
					description: 'Handcrafted jewelry and accessories',
					image: 'https://via.placeholder.com/300x300?text=Jewelry',
					icon: 'Sparkles',
					subcategories: ['Necklaces', 'Earrings', 'Bracelets', 'Rings'],
					featured: true,
					productCount: 52,
					artisanCount: 18,
					displayOrder: 3,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				{
					id: 'woodwork',
					_id: '4',
					name: 'Woodwork & Carvings',
					slug: 'woodwork',
					description: 'Intricate wooden crafts and carvings',
					image: 'https://via.placeholder.com/300x300?text=Woodwork',
					icon: 'Hammer2',
					subcategories: ['Boxes', 'Figurines', 'Furniture', 'Decorative'],
					featured: false,
					productCount: 28,
					artisanCount: 8,
					displayOrder: 4,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
			]
			
			res.json({ categories: mockCategories })
		}
	} catch (error) {
		console.error('❌ Get categories error:', error)
		// Return proper error response
		res.status(500).json({ error: 'Server error' })
	}
})

// Get blogs endpoint
router.get('/blogs', async (req, res) => {
	try {
		console.log('🔍 Starting blogs endpoint...')
		
		try {
			// Try to get blogs from database
			console.log('🔍 Fetching blogs from database...')
			const blogs = await BlogPost.find({ isPublished: true })
				.select('_id title slug excerpt content author image category tags publishedAt views')
				.sort({ publishedAt: -1 })
				.limit(12)
			console.log(`🔍 Found ${blogs.length} blogs`)
			
			res.json({ blogs })
			console.log('🔍 Blogs response sent successfully')
		} catch (dbError) {
			console.warn('⚠️  Database error fetching blogs, returning mock data:', dbError.message)
			
			// Return mock blogs when database is unavailable
			const mockBlogs = [
				{
					_id: '1',
					title: 'The Art of Handcrafted Pottery',
					slug: 'art-of-handcrafted-pottery',
					excerpt: 'Discover the timeless techniques and traditions behind handcrafted pottery',
					content: 'Full article content here...',
					author: 'Rajesh Kumar',
					image: 'https://via.placeholder.com/600x400?text=Pottery+Art',
					category: 'Pottery',
					tags: ['pottery', 'handcraft', 'traditional'],
					publishedAt: new Date(Date.now() - 7*24*60*60*1000).toISOString(),
					views: 234
				},
				{
					_id: '2',
					title: 'Sustainable Textiles: Traditional Weaving',
					slug: 'sustainable-textiles-traditional-weaving',
					excerpt: 'Learn about eco-friendly textile production and traditional weaving methods',
					content: 'Full article content here...',
					author: 'Priya Sharma',
					image: 'https://via.placeholder.com/600x400?text=Textiles',
					category: 'Textiles',
					tags: ['textiles', 'sustainable', 'weaving'],
					publishedAt: new Date(Date.now() - 5*24*60*60*1000).toISOString(),
					views: 456
				},
				{
					_id: '3',
					title: 'Contemporary Jewelry Design with Traditional Roots',
					slug: 'contemporary-jewelry-traditional-roots',
					excerpt: 'Blending modern aesthetics with age-old jewelry craftsmanship',
					content: 'Full article content here...',
					author: 'Arjun Patel',
					image: 'https://via.placeholder.com/600x400?text=Jewelry',
					category: 'Jewelry',
					tags: ['jewelry', 'design', 'craftsmanship'],
					publishedAt: new Date(Date.now() - 3*24*60*60*1000).toISOString(),
					views: 567
				}
			]
			
			res.json({ blogs: mockBlogs })
		}
	} catch (error) {
		console.error('❌ Get blogs error:', error)
		res.status(500).json({ error: 'Server error' })
	}
})

export default router




