import { logEvent } from "./security";

// Determine API base URL based on environment
const getApiBaseUrl = () => {
	// Sanitize and validate environment variable
	let apiUrl = import.meta.env.VITE_API_URL;

	// Handle potential malformed URLs with comma-separated values
	if (apiUrl && typeof apiUrl === 'string') {
		// If there are multiple URLs (comma-separated), take the first valid one
		if (apiUrl.includes(',')) {
			const urls = apiUrl.split(',').map(url => url.trim());
			apiUrl = urls.find(url =>
				url.startsWith('http') &&
				!url.includes('%20') &&
				url.includes('zaymazone-backend.onrender.com')
			) || urls[0];
		}

		// Clean up URL
		apiUrl = apiUrl.replace(/\s+/g, '').replace('/api', '');

		// Validate URL format
		if (apiUrl.startsWith('http') && !apiUrl.includes('%20')) {
			return apiUrl;
		}
	}

	// In development, use localhost
	if (import.meta.env.DEV) {
		return "http://localhost:4000";
	}

	// Fallback to localhost for development
	const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
	const isLocalhost = currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1');

	if (isLocalhost) {
		return "http://localhost:4000";
	}

	// Production fallback
	return "https://zaymazone-dev.onrender.com";
};

const API_BASE_URL = getApiBaseUrl();
const TOKEN_KEY = "auth_token";
const FIREBASE_TOKEN_KEY = "firebase_id_token";

export function getAuthToken(): string | null {
	try {
		// Check both 'auth_token' and 'token' for backward compatibility, and 'admin_token' for admin panel
		return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token') || localStorage.getItem('admin_token');
	} catch {
		return null;
	}
}

export function setAuthToken(token: string | null): void {
	try {
		if (token) localStorage.setItem(TOKEN_KEY, token);
		else localStorage.removeItem(TOKEN_KEY);
	} catch {
		// ignore
	}
}

export function getFirebaseToken(): string | null {
	try {
		return localStorage.getItem(FIREBASE_TOKEN_KEY);
	} catch {
		return null;
	}
}

export function setFirebaseToken(token: string | null): void {
	try {
		if (token) localStorage.setItem(FIREBASE_TOKEN_KEY, token);
		else localStorage.removeItem(FIREBASE_TOKEN_KEY);
	} catch {
		// ignore
	}
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function apiRequest<T>(path: string, options: {
	method?: HttpMethod;
	body?: unknown;
	auth?: boolean;
} = {}): Promise<T> {
	const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (options.auth) {
		// Admin token takes priority — prevents a regular Firebase session from overriding admin JWT
		const adminToken = (() => { try { return localStorage.getItem('admin_token'); } catch { return null; } })();
		// Only fallback to Firebase/JWT when no admin token is present
		const firebaseToken = adminToken ? null : getFirebaseToken();
		const jwtToken = getAuthToken();
		const token = adminToken || firebaseToken || jwtToken;
		if (token) headers["Authorization"] = `Bearer ${token}`;
	}
	const res = await fetch(url, {
		method: options.method || "GET",
		headers,
		body: options.body ? JSON.stringify(options.body) : undefined,
	});
	if (!res.ok) {
		let errorMessage = `Request failed: ${res.status}`;
		let errorCode: string | undefined;
		try {
			const errorData = await res.json();
			errorMessage = errorData.error || errorData.message || errorMessage;
			errorCode = errorData.code;
		} catch {
			const text = await res.text().catch(() => "");
			errorMessage = text || errorMessage;
		}
		logEvent({ level: "warn", message: "API error", context: { url, status: res.status, body: errorMessage } });

		// On 401, purge stale credentials.
		// For artisan JWT sessions ('token' key) only purge if the token is actually expired —
		// a 401 from a single endpoint should not kill a valid artisan session.
		if (res.status === 401 && options.auth) {
			try {
				const artisanToken = localStorage.getItem('token');
				const artisanTokenExpired = (() => {
					if (!artisanToken) return true;
					try {
						const base64 = artisanToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
						const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
						const payload = JSON.parse(atob(padded));
						return !payload.exp || payload.exp * 1000 <= Date.now();
					} catch { return true; }
				})();

				// Always clear Firebase tokens — they may be stale
				localStorage.removeItem('auth_token');
				localStorage.removeItem('firebase_id_token');
				localStorage.removeItem('admin_token');

				// Only clear artisan session if the token is actually expired
				if (artisanTokenExpired) {
					localStorage.removeItem('token');
					localStorage.removeItem('refreshToken');
					localStorage.removeItem('user');
					// Redirect to sign-in unless we're already there
					if (typeof window !== 'undefined' && !window.location.pathname.includes('/sign-in') && !window.location.pathname.includes('/admin')) {
						window.location.href = '/sign-in';
					}
				}
			} catch { /* ignore storage errors */ }
		}

		const err = new Error(errorMessage) as Error & { code?: string };
		if (errorCode) err.code = errorCode;
		throw err;
	}
	const contentType = res.headers.get("content-type") || "";
	if (contentType.includes("application/json")) return (await res.json()) as T;
	return undefined as unknown as T;
}

// Type definitions
export interface User {
	id: string;
	name: string;
	email: string;
	role: 'user' | 'artisan' | 'admin';
	avatar?: string;
	phone?: string;
	address?: {
		street: string;
		city: string;
		state: string;
		zipCode: string;
		country: string;
	};
	preferences?: {
		newsletter: boolean;
		notifications: boolean;
		language: string;
	};
	isEmailVerified?: boolean;
	authProvider?: 'firebase' | 'local';
	firebaseUid?: string;
	lastLogin?: string;
	createdAt?: string;
}

export interface Product {
	id: string;
	_id?: string;
	name: string;
	description: string;
	price: number;
	originalPrice?: number;
	images: string[];
	category: string;
	subcategory: string;
	materials: string[];
	dimensions: string;
	weight: string;
	colors: string[];
	inStock: boolean;
	stockCount: number;
	artisan: {
		id: string;
		name: string;
		location: string;
		bio: string;
		avatar: string;
		rating: number;
		totalProducts: number;
	} | null;
	rating: number;
	reviewCount: number;
	tags: string[];
	isHandmade: boolean;
	shippingTime: string;
	featured: boolean;
	// New enhanced features
	images360?: Array<{
		angle: number;
		url: string;
		alt: string;
	}>;
	has360View?: boolean;
	videos?: Array<{
		type: 'demonstration' | 'making-of' | 'usage';
		title: string;
		url: string;
		thumbnail: string;
		duration: number;
		fileSize: number;
		uploadedAt: string;
	}>;
	sizeGuide?: {
		category: 'clothing' | 'jewelry' | 'accessories' | 'home-decor';
		measurements: Array<{
			name: string;
			unit: 'cm' | 'inches';
			description: string;
			howToMeasure: string;
		}>;
		sizeChart: Array<{
			size: string;
			measurements: Record<string, number>;
			bodyType: 'slim' | 'regular' | 'plus';
		}>;
		visualGuide?: string;
	};
	careInstructions?: {
		materials: string[];
		washing?: {
			method?: string;
			temperature?: string;
			detergent?: string;
			specialNotes?: string;
		};
		drying?: {
			method?: string;
			temperature?: string;
			specialNotes?: string;
		};
		ironing?: {
			temperature?: string;
			method?: string;
			specialNotes?: string;
		};
		storage?: string;
		cleaning?: string;
		warnings?: string[];
		icons?: string[];
		videoTutorial?: string;
	};
	model3d?: {
		url: string;
		format: string;
		thumbnail: string;
		title: string;
		description: string;
	};
}

export interface CartItem {
	productId: Product;
	quantity: number;
	addedAt: string;
}

export interface Cart {
	items: CartItem[];
	total: number;
	itemCount: number;
	updatedAt: string;
}

export interface Order {
	_id: string;
	id: string;
	orderNumber: string;
	items: Array<{
		productId: string;
		name: string;
		price: number;
		quantity: number;
		artisanId: string;
		image: string;
	}>;
	subtotal: number;
	shippingCost: number;
	codFee: number;
	tax: number;
	total: number;
	// Module 3: Shipping Engine fields
	shippingZone?: 'local' | 'metro' | 'tier2' | 'rest_of_india' | 'remote';
	totalWeight?: number;
	shippingBreakdown?: ShippingBreakdown | null;
	courierFlags?: CourierFlags | null;
	shippingAddress: {
		fullName: string;
		street?: string;
		addressLine1?: string;
		addressLine2?: string;
		city: string;
		state: string;
		zipCode: string;
		country: string;
		phone: string;
		email?: string;
	};
	billingAddress?: {
		fullName: string;
		street?: string;
		addressLine1?: string;
		addressLine2?: string;
		city: string;
		state: string;
		zipCode: string;
		country: string;
		phone: string;
		email?: string;
	};
	paymentMethod: 'cod' | 'zoho_card' | 'zoho_upi' | 'zoho_netbanking' | 'zoho_wallet' | 'razorpay' | 'upi' | 'upi_prepaid' | 'paytm';
	paymentStatus: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled';
	status: 'placed' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned' | 'refunded' | 'rejected';
	statusHistory: Array<{
		status: string;
		timestamp: string;
		note?: string;
		updatedBy?: string;
	}>;
	// Module 4: Seller rejection fields
	rejectionReason?: string;
	rejectedAt?: string;
	rejectedBy?: string;
	// Module 5: Cancellation fee fields
	cancellationFee?: number;
	refundableAmount?: number;
	cancellationFeeWaived?: boolean;
	cancellationTier?: 'grace' | 'placed' | 'confirmed' | 'processing';
	cancellationReason?: string;
	trackingNumber?: string;
	courierService?: string;
	zohoOrderId?: string;
	zohoPaymentId?: string;
	createdAt: string;
	updatedAt?: string;
}

/**
 * Module 5 — returned by GET /api/orders/:id/cancellation-preview
 * Displayed in a confirmation dialog before the buyer commits to cancellation.
 */
export interface CancellationFeePreview {
	orderNumber:        string;
	orderStatus:        string;
	paymentMethod:      string;
	tier:               'grace' | 'placed' | 'confirmed' | 'processing';
	feePercent:         number;
	grossFee:           number;
	cancellationFee:    number;
	isCod:              boolean;
	totalPaid:          number;
	refundableAmount:   number;
	isWithinGrace:      boolean;
	minutesSincePlaced: number;
	ruleLabel:          string;
}

// ── Module 3: Invoice types ──────────────────────────────────────────────────

export type InvoiceType   = 'sale' | 'cancellation_note' | 'rejection_note' | 'refund_note'
export type InvoiceStatus = 'issued' | 'void' | 'credited'

export interface InvoiceLineItem {
	label:       string;
	description: string;
	amount:      number;
	type:        string;
	isBold?:     boolean;
	isFree?:     boolean;
}

export interface Invoice {
	_id:              string;
	invoiceNumber:    string;
	type:             InvoiceType;
	status:           InvoiceStatus;
	orderId:          string;
	orderNumber:      string;
	userId:           string;
	originalInvoiceId?: string;

	// Financial
	subtotal:          number;
	shippingCost:      number;
	codFee:            number;
	tax:               number;
	discount:          number;
	grandTotal:        number;
	cancellationFee:   number;
	cancellationTier?: string;
	refundableAmount:  number;
	isCodOrder:        boolean;
	feeWaived?:        boolean;

	// Credit/Rejection note reasons
	cancellationReason?: string;
	rejectionReason?:    string;

	// Line items
	lineItems:         InvoiceLineItem[];

	// Item snapshots — embedded product details at time of invoice creation
	itemSnapshots?:    Array<{
		name:       string;
		quantity:   number;
		unitPrice:  number;
		productId?: string;
		image?:     string;
	}>;

	// Buyer snapshot
	buyerSnapshot: {
		fullName:     string;
		email:        string;
		phone:        string;
		addressLine1: string;
		city:         string;
		state:        string;
		zipCode:      string;
		country:      string;
	};

	// Shipping
	shippingZone:          string;
	shippingZoneLabel:     string;
	estimatedDeliveryDays?: number;

	// Timestamps
	issuedAt:    string;
	voidedAt?:   string;
	creditedAt?: string;
	notes?:      string;
}


// ─── Module 2: Artisan Dashboard Types ────────────────────────────────────────

export interface ArtisanOrderCounts {
	total:     number;
	pending:   number;   // in-flight (placed + confirmed + processing + packed + shipped + out_for_delivery)
	delivered: number;
	cancelled: number;
	rejected:  number;
	returned:  number;
	refunded:  number;
	newToday:  number;
	byStatus:  Record<string, number>;
}

export interface ArtisanRevenueSummary {
	allTime:    number;   // lifetime earned
	current:    number;   // current period earned
	previous:   number;   // previous same-length period earned
	pending:    number;   // revenue locked in active orders
	growthPct:  number;   // % change current vs previous
	period:     '7days' | '30days' | '90days' | '1year';
}

export interface ArtisanRevenueTrendPoint {
	date:       string;  // YYYY-MM-DD or YYYY-MM for 1year
	revenue:    number;
	orderCount: number;
}

export interface ArtisanTopProduct {
	productId:    string;
	productName:  string;
	totalRevenue: number;
	totalSold:    number;
	orderCount:   number;
}

export interface ArtisanPerformanceMetrics {
	fulfillmentRate:   number;   // % delivered out of finalised orders
	cancellationRate:  number;   // % of total orders cancelled
	rejectionRate:     number;   // % of total orders rejected
	returnRate:        number;   // % of delivered orders returned
	avgOrderValue:     number;   // ₹ mean artisan revenue per delivered order
	avgHandlingHours:  number;   // hours placed→shipped
	totalOrders:       number;
	totalDelivered:    number;
	totalCancelled:    number;
	totalRejected:     number;
	totalReturned:     number;
	avgRating:         number;
	totalReviews:      number;
	topProducts:       ArtisanTopProduct[];
}

export interface ArtisanDashboardBundle {
	orderCounts:       ArtisanOrderCounts;
	revenue:           ArtisanRevenueSummary;
	performance:       ArtisanPerformanceMetrics;
	trend:             ArtisanRevenueTrendPoint[];
	recentOrders:      Order[];
	lowStockProducts:  Array<{ _id: string; name: string; stock: number; price: number; images?: string[] }>;
	generatedAt:       string;
}

export interface Review {
	id: string;
	userId: string;
	productId: string;
	orderId: string;
	rating: number;
	title?: string;
	comment: string;
	images?: string[];
	isVerified: boolean;
	response?: {
		message: string;
		respondedBy: string;
		respondedAt: string;
	};
	createdAt: string;
}

export interface Pagination {
	page: number;
	limit: number;
	total: number;
	pages: number; // Total number of pages
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
}

// UPI Payment Interfaces
export interface UpiPayment {
	_id: string;
	orderId: string;
	orderNumber: string;
	amount: number;
	paymentMode: 'upi_prepaid';
	utr?: string;
	paymentStatus: 'pending' | 'verified' | 'failed' | 'refunded';
	upiIntentUrl: string;
	qrCodeData: string;
	merchantUpiId: string;
	merchantName: string;
	verifiedBy?: string;
	verifiedAt?: string;
	verificationNotes?: string;
	failureReason?: string;
	failedAt?: string;
	refundAmount?: number;
	refundedAt?: string;
	refundReason?: string;
	refundedBy?: string;
	receiptScreenshot?: string | null;
	receiptUploadedAt?: string | null;
	metadata?: any;
	expiresAt: string;
	statusHistory: Array<{
		status: string;
		timestamp: string;
		note?: string;
		updatedBy?: string;
	}>;
	createdAt: string;
	updatedAt: string;
}

export interface GenerateUpiIntentRequest {
	orderId: string;
	amount: number;
	merchantUpiId?: string;
	expiryMinutes?: number;
}

export interface GenerateUpiIntentResponse {
	success: boolean;
	upiPaymentId: string;
	upiIntentUrl: string;
	qrCodeData: string;
	amount: string;
	orderNumber: string;
	merchantUpiId: string;
	merchantName: string;
	expiresAt: string;
	message: string;
}

export interface UpiPaymentsByOrderResponse {
	orderId: string;
	orderNumber: string;
	payments: UpiPayment[];
}


export interface Address {
	fullName: string;
	street?: string;
	addressLine1?: string;
	addressLine2?: string;
	city: string;
	state: string;
	zipCode: string;
	country: string;
	phone: string;
	email?: string;
}

export interface BlogPost {
	id: string;
	title: string;
	slug: string;
	content: string;
	excerpt: string;
	author: {
		id: string;
		name: string;
		avatar?: string;
	};
	category: string;
	tags: string[];
	featuredImage?: string;
	publishedAt: string;
	updatedAt: string;
	isPublished: boolean;
	likes: number;
	views: number;
	readingTime: number;
}

export interface Artisan {
	_id: string;
	name: string;
	bio: string;
	location: {
		city: string;
		state: string;
		country: string;
	};
	avatar: string;
	coverImage: string;
	specialties: string[];
	experience: number;
	rating: number;
	totalRatings: number;
	totalProducts: number;
	totalSales: number;
	verification: {
		isVerified: boolean;
		verifiedAt?: Date;
	};
	isActive: boolean;
	joinedDate: Date;
}

// API Functions
export const authApi = {
	signUp: (data: { name: string; email: string; password: string }) =>
		apiRequest<{ token: string; user: User }>(
			"/api/auth/signup",
			{ method: "POST", body: data }
		),
	signIn: (data: { email: string; password: string }) =>
		apiRequest<{ token: string; user: User }>(
			"/api/auth/signin",
			{ method: "POST", body: data }
		),
};

// Firebase Auth API Functions
export const firebaseAuthApi = {
	syncUser: (data: { idToken: string; role?: 'user' | 'artisan' | 'admin' }) =>
		apiRequest<{ message: string; user: User; accessToken?: string }>(
			"/api/firebase-auth/sync",
			{ method: "POST", body: data }
		),
	getCurrentUser: (idToken: string) =>
		apiRequest<{ user: User }>(
			"/api/firebase-auth/me",
			{ method: "GET", auth: true }
		),
	updateProfile: (data: {
		name?: string;
		phone?: string;
		address?: Partial<User['address']>;
		preferences?: Partial<User['preferences']>;
		avatar?: string;
	}, idToken: string) =>
		apiRequest<{ message: string; user: User }>(
			"/api/firebase-auth/profile",
			{ method: "PATCH", body: data, auth: true }
		),
	deleteAccount: (idToken: string) =>
		apiRequest<{ message: string }>(
			"/api/firebase-auth/account",
			{ method: "DELETE", auth: true }
		),
};

export const productsApi = {
	getAll: (params?: {
		page?: number;
		limit?: number;
		category?: string;
		q?: string;
		minPrice?: number;
		maxPrice?: number;
		artisanId?: string;
	}) => {
		const searchParams = new URLSearchParams();
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					searchParams.append(key, value.toString());
				}
			});
		}
		const queryString = searchParams.toString();
		return apiRequest<{ products: Product[]; pagination: Pagination }>(`/api/products${queryString ? `?${queryString}` : ''}`);
	},

	getById: (id: string) =>
		apiRequest<Product>(`/api/products/${id}`),

	create: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) =>
		apiRequest<Product>("/api/products", {
			method: "POST",
			body: data,
			auth: true
		}),

	update: (id: string, data: Partial<Product>) =>
		apiRequest<Product>(`/api/products/${id}`, {
			method: "PUT",
			body: data,
			auth: true
		}),

	delete: (id: string) =>
		apiRequest<void>(`/api/products/${id}`, {
			method: "DELETE",
			auth: true
		}),
};

export const imagesApi = {
	upload: (file: File) => {
		const url = `${API_BASE_URL}/api/images/upload`;
		const form = new FormData();
		form.append('image', file);

		// Attach auth token if available
		const headers: Record<string, string> = {};
		try {
			const firebaseToken = getFirebaseToken();
			const jwt = getAuthToken();
			const token = firebaseToken || jwt;
			if (token) headers['Authorization'] = `Bearer ${token}`;
		} catch {
			// Ignore localStorage errors in SSR or restricted environments
		}

		return fetch(url, {
			method: 'POST',
			body: form,
			headers,
		}).then(async (res) => {
			if (!res.ok) {
				const text = await res.text().catch(() => 'Upload failed');
				throw new Error(text || `Upload failed: ${res.status}`);
			}
			return res.json();
		});
	}
};

export const cartApi = {
	get: () =>
		apiRequest<Cart>("/api/cart", { auth: true }),

	add: (productId: string, quantity: number = 1) =>
		apiRequest<{ message: string; cart: Cart }>("/api/cart/add", {
			method: "POST",
			body: { productId, quantity },
			auth: true
		}),

	updateItem: (productId: string, quantity: number) =>
		apiRequest<{ message: string; cart: Cart }>(`/api/cart/item/${productId}`, {
			method: "PATCH",
			body: { quantity },
			auth: true
		}),

	removeItem: (productId: string) =>
		apiRequest<{ message: string }>(`/api/cart/item/${productId}`, {
			method: "DELETE",
			auth: true
		}),

	clear: () =>
		apiRequest<{ message: string }>("/api/cart/clear", {
			method: "DELETE",
			auth: true
		}),
};

export const ordersApi = {
	getMyOrders: (params?: { page?: number; limit?: number }) => {
		const searchParams = new URLSearchParams();
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					searchParams.append(key, value.toString());
				}
			});
		}
		const queryString = searchParams.toString();
		return apiRequest<{ orders: Order[]; pagination: Pagination }>(`/api/orders/my-orders${queryString ? `?${queryString}` : ''}`, { auth: true });
	},

	getById: (id: string) =>
		apiRequest<Order>(`/api/orders/${id}`, { auth: true }),

	create: (data: {
		items: Array<{ productId: string; quantity: number }>;
		shippingAddress: Order['shippingAddress'];
		billingAddress?: Order['billingAddress'];
		useShippingAsBilling?: boolean;
		paymentMethod: Order['paymentMethod'];
		paymentId?: string;
		zohoPaymentId?: string;
		zohoOrderId?: string;
		notes?: string;
		isGift?: boolean;
		giftMessage?: string;
	}) =>
		apiRequest<Order>("/api/orders", {
			method: "POST",
			body: data,
			auth: true
		}),

	cancel: (id: string, reason?: string) =>
		apiRequest<{ message: string; order: Order; feeBreakdown: CancellationFeePreview }>(`/api/orders/${id}/cancel`, {
			method: "PATCH",
			body: { reason: reason || '' },
			auth: true
		}),

	getCancellationPreview: (id: string) =>
		apiRequest<CancellationFeePreview>(`/api/orders/${id}/cancellation-preview`, { auth: true }),
};

export const paymentsApi = {
	createPaymentOrder: (data: { orderId: string }) =>
		apiRequest<{
			success: boolean;
			paymentOrder: {
				zohoOrderId: string;
				amount: number;
				currency: string;
				paymentUrl: string;
				orderNumber: string;
			};
		}>("/api/payments/create-order", {
			method: "POST",
			body: data,
			auth: true
		}),

	verifyPayment: (data: {
		zohoPaymentId: string;
		zohoOrderId: string;
		paymentStatus: string;
	}) =>
		apiRequest<{
			success: boolean;
			paymentStatus: string;
			orderStatus: string;
			message: string;
		}>("/api/payments/verify", {
			method: "POST",
			body: data,
			auth: true
		}),

	getPaymentMethods: () =>
		apiRequest<{
			success: boolean;
			paymentMethods: Array<{
				id: string;
				name: string;
				description: string;
				fees?: string;
			}>;
		}>("/api/payments/methods"),

	getPaymentStatus: (orderId: string) =>
		apiRequest<{
			success: boolean;
			payment: {
				paymentStatus: string;
				paymentMethod: string;
				zohoPaymentId?: string;
				zohoOrderId?: string;
				paidAt?: string;
				refundedAt?: string;
				refundAmount?: number;
			};
		}>(`/api/payments/order/${orderId}/status`, { auth: true }),

	processRefund: (data: {
		orderId: string;
		refundAmount?: number;
		reason?: string;
	}) =>
		apiRequest<{
			success: boolean;
			refund: any;
			message: string;
		}>("/api/payments/refund", {
			method: "POST",
			body: data,
			auth: true
		})
};

// ─── COD API ─────────────────────────────────────────────────────────────────
export const codApi = {
	/** Check whether COD is available for the given subtotal + state */
	checkEligibility: (params: { subtotal: number; state?: string; userId?: string }) => {
		const query = new URLSearchParams();
		query.set('subtotal', String(params.subtotal));
		if (params.state) query.set('state', params.state);
		if (params.userId) query.set('userId', params.userId);
		return apiRequest<{
			eligible: boolean;
			reason: string | null;
			codFee: number;
			feeBreakdown: { baseFee: number; percentageFee: number; percentageAmount: number; totalFee: number };
			limits: { minOrderAmount: number; maxOrderAmount: number };
		}>(`/api/cod/eligibility?${query.toString()}`);
	},

	/** Get COD charge breakdown for an order */
	getCharges: (orderId: string) =>
		apiRequest<{
			orderNumber: string;
			status: string;
			paymentStatus: string;
			codCollectedAt?: string;
			charges: {
				subtotal: number;
				shippingCost: number;
				tax: number;
				discount: number;
				codFee: number;
				total: number;
				breakdown: Array<{ label: string; amount: number }>;
			};
		}>(`/api/cod/charges/${orderId}`, { auth: true }),

	/** Get invoice-level shipping + charge breakdown for any order */
	getInvoiceBreakdown: (orderId: string) =>
		apiRequest<{
			orderNumber: string;
			paymentMethod: string;
			paymentStatus: string;
			courierFlags: CourierFlags | null;
			shippingZone: string;
			zoneLabel: string;
			estimatedDeliveryDays: string;
			lineItems: Array<{ label: string; description: string; amount: number; type: string; isFree?: boolean; isBold?: boolean }>;
			summary: { subtotal: number; shippingCharge: number; codFee: number; tax: number; discount: number; total: number };
		}>(`/api/orders/${orderId}/invoice`, { auth: true }),
};

// UPI Payment APIs
export const upiPaymentsApi = {
	generateIntent: (data: GenerateUpiIntentRequest) =>
		apiRequest<GenerateUpiIntentResponse>("/api/upi-payments/generate-intent", {
			method: "POST",
			body: data,
			auth: true
		}),

	getPaymentStatus: (paymentId: string) =>
		apiRequest<UpiPayment>(`/api/upi-payments/${paymentId}`, {
			auth: true
		}),

	getPaymentsByOrder: (orderId: string) =>
		apiRequest<UpiPaymentsByOrderResponse>(`/api/upi-payments/order/${orderId}`, {
			auth: true
		}),

	// Admin-only endpoints
	getPendingPayments: () =>
		apiRequest<{ payments: UpiPayment[] }>("/api/upi-payments/pending", {
			auth: true
		}),

	verifyPayment: (data: { upiPaymentId: string; utr: string; verificationNotes?: string }) =>
		apiRequest<{
			success: boolean;
			payment: UpiPayment;
			order: any;
			message: string;
		}>("/api/upi-payments/verify", {
			method: "POST",
			body: data,
			auth: true
		}),

	updatePaymentStatus: (paymentId: string, data: { status: string; reason?: string; refundAmount?: number }) =>
		apiRequest<{
			success: boolean;
			payment: UpiPayment;
			message: string;
		}>(`/api/upi-payments/${paymentId}/status`, {
			method: "PATCH",
			body: data,
			auth: true
		}),

	uploadReceipt: (paymentId: string, receiptScreenshot: string) =>
		apiRequest<{ success: boolean; message: string }>(
			`/api/upi-payments/${paymentId}/upload-receipt`,
			{ method: "POST", body: { receiptScreenshot }, auth: true }
		)
};



// ─── Shipping API (Module 3) ──────────────────────────────────────────────────

export interface ShippingEstimateRequest {
	items: Array<{ productId: string; quantity: number }>;
	toState: string;
	paymentMethod: string;
	userId?: string;
}

export interface ShippingBreakdown {
	zone: string;
	zoneLabel: string;
	totalWeightGrams: number;
	totalWeightDisplay: string;
	baseCharge: number;
	weightCharge: number;
	extra500gBlocks: number;
	isFreeShipping: boolean;
	freeShippingThreshold: number;
	amountForFreeShipping: number;
	estimatedDeliveryDays: string;
}

export interface CourierFlags {
	isPrepaid: boolean;
	isCod: boolean;
	bookingType: 'prepaid' | 'cod';
	suggestedCourier: string;
	zone: string;
	zoneLabel: string;
}

export interface ShippingEstimateResponse {
	success: boolean;
	subtotal: number;
	shippingCharge: number;
	codFee: number;
	totalWeight: number;
	zone: string;
	zoneLabel: string;
	isFreeShipping: boolean;
	freeShippingThreshold: number;
	estimatedDeliveryDays: string;
	breakdown: ShippingBreakdown;
	courierFlags: CourierFlags;
	itemCount: number;
}

export const shippingApi = {
	estimate: (data: ShippingEstimateRequest) =>
		apiRequest<ShippingEstimateResponse>('/api/shipping/estimate', {
			method: 'POST',
			body: data,
		}),

	zones: () =>
		apiRequest<{ success: boolean; originState: string; zones: Record<string, string[]>; zoneDetails: Record<string, unknown> }>('/api/shipping/zones'),

	rates: () =>
		apiRequest<{ success: boolean; rates: Record<string, unknown>; courierRules: Record<string, unknown>; defaultCodFee: number }>('/api/shipping/rates'),
};

// Paytm Payment APIs
export const paytmPaymentsApi = {
	createTransaction: (data: { orderId: string }) =>
		apiRequest<{
			success: boolean;
			transaction: {
				txnToken: string;
				orderId: string;
				amount: number;
				paymentUrl: string;
				mid: string;
				isMock?: boolean;
			};
			message: string;
		}>("/api/payments/paytm/create-transaction", {
			method: "POST",
			body: data,
			auth: true
		}),

	verifyTransaction: (data: {
		orderId: string;
		txnId?: string;
		checksum?: string;
	}) =>
		apiRequest<{
			success: boolean;
			paymentStatus: string;
			orderStatus: string;
			transaction?: {
				txnId: string;
				amount: string;
				paymentMode: string;
				bankName: string;
			};
			message: string;
		}>("/api/payments/paytm/verify", {
			method: "POST",
			body: data,
			auth: true
		}),

	processRefund: (data: {
		orderId: string;
		refundAmount?: number;
		reason?: string;
	}) =>
		apiRequest<{
			success: boolean;
			refund: {
				refundId: string;
				amount: number;
				status: string;
			};
			message: string;
		}>("/api/payments/paytm/refund", {
			method: "POST",
			body: data,
			auth: true
		}),

	getPaymentMethods: () =>
		apiRequest<{
			success: boolean;
			paymentMethods: Array<{
				id: string;
				name: string;
				description: string;
				logo: string;
				enabled: boolean;
			}>;
		}>("/api/payments/paytm/methods"),

	getStatus: () =>
		apiRequest<{
			success: boolean;
			configured: boolean;
			mockMode: boolean;
			environment: string;
			baseURL: string;
			merchantId: string;
		}>("/api/payments/paytm/status"),
};

export const reviewsApi = {
	getForProduct: (productId: string, params?: { page?: number; limit?: number }) => {
		const searchParams = new URLSearchParams();
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					searchParams.append(key, value.toString());
				}
			});
		}
		const queryString = searchParams.toString();
		return apiRequest<{
			reviews: Review[];
			pagination: Pagination;
			statistics: {
				averageRating: number;
				totalReviews: number;
				ratingDistribution: Array<{ _id: number; count: number }>;
			};
		}>(`/api/reviews/product/${productId}${queryString ? `?${queryString}` : ''}`);
	},

	getMyReviews: (params?: { page?: number; limit?: number }) => {
		const searchParams = new URLSearchParams();
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					searchParams.append(key, value.toString());
				}
			});
		}
		const queryString = searchParams.toString();
		return apiRequest<{ reviews: Review[]; pagination: Pagination }>(`/api/reviews/my-reviews${queryString ? `?${queryString}` : ''}`, { auth: true });
	},

	create: (data: {
		productId: string;
		orderId: string;
		rating: number;
		title?: string;
		comment: string;
		images?: string[];
	}) =>
		apiRequest<{ message: string; review: Review }>("/api/reviews", {
			method: "POST",
			body: data,
			auth: true
		}),

	update: (id: string, data: Partial<Review>) =>
		apiRequest<{ message: string; review: Review }>(`/api/reviews/${id}`, {
			method: "PATCH",
			body: data,
			auth: true
		}),

	delete: (id: string) =>
		apiRequest<{ message: string }>(`/api/reviews/${id}`, {
			method: "DELETE",
			auth: true
		}),

	respond: (id: string, message: string) =>
		apiRequest<{ message: string; review: Review }>(`/api/reviews/${id}/respond`, {
			method: "POST",
			body: { message },
			auth: true
		}),
};

export const artisansApi = {
	getAll: (params?: {
		page?: number;
		limit?: number;
		q?: string;
		location?: string;
		specialty?: string;
	}) => {
		const searchParams = new URLSearchParams();
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					searchParams.append(key, value.toString());
				}
			});
		}
		const queryString = searchParams.toString();
		return apiRequest<Artisan[]>(`/api/products/artisans${queryString ? `?${queryString}` : ''}`);
	},

	getById: (id: string) =>
		apiRequest<Artisan>(`/api/artisans/${id}`),
};

export const addressesApi = {
	getAll: () => apiRequest<Address[]>('/api/addresses', { auth: true }),

	add: (address: Address) =>
		apiRequest<{ address: Address }>('/api/addresses', {
			method: 'POST',
			body: address,
			auth: true
		}),

	update: (id: string, address: Address) =>
		apiRequest<{ address: Address }>(`/api/addresses/${id}`, {
			method: 'PUT',
			body: address,
			auth: true
		}),

	delete: (id: string) =>
		apiRequest<{ message: string }>(`/api/addresses/${id}`, {
			method: 'DELETE',
			auth: true
		}),

	setDefault: (id: string) =>
		apiRequest<{ message: string }>(`/api/addresses/${id}/default`, {
			method: 'PUT',
			auth: true
		}),
};

export const blogApi = {
	getAll: (params?: {
		page?: number;
		limit?: number;
		category?: string;
		tag?: string;
		search?: string;
		featured?: boolean;
	}) => {
		const searchParams = new URLSearchParams();
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					searchParams.append(key, value.toString());
				}
			});
		}
		const queryString = searchParams.toString();
		return apiRequest<{
			posts: BlogPost[];
			pagination: Pagination;
		}>(`/api/blog${queryString ? `?${queryString}` : ''}`);
	},

	getById: (id: string) =>
		apiRequest<BlogPost>(`/api/blog/${id}`),

	getCategories: () =>
		apiRequest<string[]>('/api/blog/categories'),

	getTags: () =>
		apiRequest<string[]>('/api/blog/tags'),

	getFeatured: () =>
		apiRequest<BlogPost[]>('/api/blog/featured'),

	like: (id: string) =>
		apiRequest<{ message: string; likes: number }>(`/api/blog/${id}/like`, {
			method: 'PATCH'
		}),

	getRelated: (id: string) =>
		apiRequest<BlogPost[]>(`/api/blog/${id}/related`),
};

// ─── Module 4: Settlement & Accounting ─────────────────────────────────────

export interface SettlementAdjustment {
	label: string;
	amount: number;
	note?: string;
}

export interface Settlement {
	_id: string;
	settlementId: string;
	artisanId: string;
	periodStart: string;
	periodEnd: string;
	weekLabel: string;
	grossRevenue: number;
	platformCommission: number;
	commissionRate: number;
	logisticsCost: number;
	codFeeCollected: number;
	codReturnsDeducted: number;
	upiRefundsDeducted: number;
	adjustments: SettlementAdjustment[];
	totalAdjustments: number;
	netPayable: number;
	orderCount: number;
	orders: string[] | Order[];
	refundedOrders: string[] | Order[];
	status: 'draft' | 'pending' | 'approved' | 'paid' | 'disputed' | 'cancelled';
	payoutReference?: string;
	paidAt?: string;
	paidBy?: string;
	approvedBy?: string;
	disputeNote?: string;
	createdAt: string;
	updatedAt: string;
}

export interface LedgerEntry {
	_id: string;
	entryType: 'SALE' | 'COMMISSION' | 'LOGISTICS' | 'COD_FEE' | 'COD_RETURN' | 'UPI_REFUND' | 'SETTLEMENT' | 'ADJUSTMENT';
	account: 'platform_revenue' | 'seller_payable' | 'logistics_payable' | 'buyer_receivable' | 'refund_payable';
	amount: number;
	orderId?: string | { _id: string; orderNumber: string; status: string };
	orderNumber?: string;
	artisanId?: string;
	settlementId?: string;
	upiPaymentId?: string;
	description: string;
	note?: string;
	createdBy?: string;
	createdAt: string;
}

export interface PlatformSummary {
	success: boolean;
	from: string;
	to: string;
	summary: Array<{
		_id: { account: string; entryType: string };
		total: number;
		count: number;
	}>;
	totals: {
		platform_revenue: number;
		seller_payable: number;
		logistics_payable: number;
		buyer_receivable: number;
		refund_payable: number;
	};
}

export interface SettlementPreview extends Omit<Settlement, '_id' | 'settlementId' | 'status' | 'createdAt' | 'updatedAt'> {
	artisanName?: string;
}

export const settlementApi = {
	// ── Seller (JWT/requireAuth) endpoints ──────────────────────────────────
	myList: (params?: { page?: number; limit?: number; status?: Settlement['status'] }) => {
		const q = new URLSearchParams();
		if (params?.page) q.set('page', String(params.page));
		if (params?.limit) q.set('limit', String(params.limit));
		if (params?.status) q.set('status', params.status);
		return apiRequest<{ settlements: Settlement[]; pagination: Pagination }>(
			`/api/settlements/my${q.toString() ? '?' + q.toString() : ''}`,
			{ auth: true }
		);
	},

	myDetail: (settlementId: string) =>
		apiRequest<Settlement>(`/api/settlements/my/${settlementId}`, { auth: true }),

	myLedger: (params?: { page?: number; limit?: number; entryType?: LedgerEntry['entryType']; from?: string; to?: string }) => {
		const q = new URLSearchParams();
		if (params?.page) q.set('page', String(params.page));
		if (params?.limit) q.set('limit', String(params.limit));
		if (params?.entryType) q.set('entryType', params.entryType);
		if (params?.from) q.set('from', params.from);
		if (params?.to) q.set('to', params.to);
		return apiRequest<{ entries: LedgerEntry[]; pagination: Pagination }>(
			`/api/settlements/my/ledger${q.toString() ? '?' + q.toString() : ''}`,
			{ auth: true }
		);
	},

	dispute: (settlementId: string, note: string) =>
		apiRequest<{ success: boolean; settlement: Settlement }>(
			`/api/settlements/my/${settlementId}/dispute`,
			{ method: 'POST', body: { note }, auth: true }
		),

	// ── Admin endpoints ──────────────────────────────────────────────────────
	adminList: (params?: { page?: number; limit?: number; status?: Settlement['status']; artisanId?: string; from?: string; to?: string }) => {
		const q = new URLSearchParams();
		if (params?.page) q.set('page', String(params.page));
		if (params?.limit) q.set('limit', String(params.limit));
		if (params?.status) q.set('status', params.status);
		if (params?.artisanId) q.set('artisanId', params.artisanId);
		if (params?.from) q.set('from', params.from);
		if (params?.to) q.set('to', params.to);
		return apiRequest<{ settlements: Settlement[]; pagination: Pagination }>(
			`/api/settlements${q.toString() ? '?' + q.toString() : ''}`,
			{ auth: true }
		);
	},

	generateWeekly: (date?: string) =>
		apiRequest<{ success: boolean; generated: number; results: Settlement[] }>(
			'/api/settlements/generate-weekly',
			{ method: 'POST', body: date ? { date } : {}, auth: true }
		),

	generateForArtisan: (artisanId: string, date?: string) =>
		apiRequest<{ success: boolean; settlement: Settlement }>(
			`/api/settlements/generate/${artisanId}`,
			{ method: 'POST', body: date ? { date } : {}, auth: true }
		),

	approve: (settlementId: string) =>
		apiRequest<{ success: boolean; settlement: Settlement }>(
			`/api/settlements/${settlementId}/approve`,
			{ method: 'PATCH', auth: true }
		),

	markPaid: (settlementId: string, payoutReference: string) =>
		apiRequest<{ success: boolean; settlement: Settlement }>(
			`/api/settlements/${settlementId}/paid`,
			{ method: 'PATCH', body: { payoutReference }, auth: true }
		),

	processUpiRefund: (data: { orderId: string; refundAmount?: number; reason?: string }) =>
		apiRequest<{ success: boolean; message: string }>('/api/settlements/refund/upi', {
			method: 'POST',
			body: data,
			auth: true,
		}),

	processCodReturn: (data: { orderId: string; reason?: string }) =>
		apiRequest<{ success: boolean; message: string }>('/api/settlements/refund/cod', {
			method: 'POST',
			body: data,
			auth: true,
		}),

	platformSummary: (from?: string, to?: string) => {
		const q = new URLSearchParams();
		if (from) q.set('from', from);
		if (to) q.set('to', to);
		return apiRequest<PlatformSummary>(
			`/api/settlements/platform/summary${q.toString() ? '?' + q.toString() : ''}`,
			{ auth: true }
		);
	},

	adminLedger: (params?: { page?: number; limit?: number; account?: LedgerEntry['account']; entryType?: LedgerEntry['entryType']; artisanId?: string; from?: string; to?: string }) => {
		const q = new URLSearchParams();
		if (params?.page) q.set('page', String(params.page));
		if (params?.limit) q.set('limit', String(params.limit));
		if (params?.account) q.set('account', params.account);
		if (params?.entryType) q.set('entryType', params.entryType);
		if (params?.artisanId) q.set('artisanId', params.artisanId);
		if (params?.from) q.set('from', params.from);
		if (params?.to) q.set('to', params.to);
		return apiRequest<{ entries: LedgerEntry[]; pagination: Pagination }>(
			`/api/settlements/ledger${q.toString() ? '?' + q.toString() : ''}`,
			{ auth: true }
		);
	},

	preview: (artisanId: string, date?: string) => {
		const q = new URLSearchParams();
		if (date) q.set('date', date);
		return apiRequest<SettlementPreview>(
			`/api/settlements/preview/${artisanId}${q.toString() ? '?' + q.toString() : ''}`,
			{ auth: true }
		);
	},
};

// Unified API export
export const api = {
	// Auth
	signIn: authApi.signIn,
	signUp: authApi.signUp,

	// Products
	getProducts: productsApi.getAll,
	getProduct: productsApi.getById,
	createProduct: productsApi.create,
	updateProduct: productsApi.update,
	deleteProduct: productsApi.delete,

	// Cart
	getCart: cartApi.get,
	addToCart: cartApi.add,
	updateCartItem: cartApi.updateItem,
	removeFromCart: cartApi.removeItem,
	clearCart: cartApi.clear,

	// Orders
	getUserOrders: ordersApi.getMyOrders,
	getOrder: ordersApi.getById,
	createOrder: ordersApi.create,
	cancelOrder: ordersApi.cancel,
	getCancellationPreview: ordersApi.getCancellationPreview,

	// Payments
	createPaymentOrder: paymentsApi.createPaymentOrder,
	verifyPayment: paymentsApi.verifyPayment,
	getPaymentMethods: paymentsApi.getPaymentMethods,
	getPaymentStatus: paymentsApi.getPaymentStatus,
	processRefund: paymentsApi.processRefund,

	// Paytm Payments
	paytm: {
		createTransaction: paytmPaymentsApi.createTransaction,
		verifyTransaction: paytmPaymentsApi.verifyTransaction,
		processRefund: paytmPaymentsApi.processRefund,
		getPaymentMethods: paytmPaymentsApi.getPaymentMethods,
		getStatus: paytmPaymentsApi.getStatus,
	},

	// Settlements (Module 4)
	settlements: settlementApi,

	// Reviews
	getProductReviews: reviewsApi.getForProduct,
	createReview: reviewsApi.create,
	updateReview: reviewsApi.update,
	deleteReview: reviewsApi.delete,

	// Artisans
	getArtisans: artisansApi.getAll,
	getArtisan: artisansApi.getById,
	getArtisanProducts: () => apiRequest<{
		products: Product[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			pages: number;
		};
	}>('/api/products/artisan/my-products', { auth: true }),
	getArtisanCustomers: () => apiRequest<{
		customers: Array<{
			_id: string;
			name: string;
			email: string;
			phone: string;
			totalOrders: number;
			totalSpent: number;
			lastOrderDate: string;
			firstOrderDate: string;
			segment: string;
			loyaltyScore: number;
			daysSinceLastOrder: number;
			daysSinceFirstOrder: number;
			avgOrderValue: number;
		}>;
		pagination: {
			page: number;
			limit: number;
			total: number;
			pages: number;
		};
	}>('/api/orders/artisan/customers', { auth: true }),
	getArtisanReviews: () => apiRequest<{
		reviews: Array<{
			_id: string;
			rating: number;
			title?: string;
			comment: string;
			images?: string[];
			createdAt: string;
			userId: {
				name: string;
				avatar?: string;
			};
			productId: {
				name: string;
				images: string[];
			};
			orderId: {
				orderNumber: string;
			};
			response?: {
				message: string;
				respondedBy: {
					name: string;
				};
				respondedAt: string;
			};
		}>;
		pagination: {
			page: number;
			limit: number;
			total: number;
			pages: number;
		};
	}>('/api/reviews/artisan/my-reviews', { auth: true }),
	// Images
	uploadImage: imagesApi.upload,

	// Wishlist
	getWishlist: () => apiRequest<Product[]>('/api/wishlist', { auth: true }),
	addToWishlist: (productId: string) =>
		apiRequest<{ message: string }>('/api/wishlist/add', {
			method: 'POST',
			body: { productId },
			auth: true
		}),
	removeFromWishlist: (productId: string) =>
		apiRequest<{ message: string }>(`/api/wishlist/item/${productId}`, {
			method: 'DELETE',
			auth: true
		}),
	clearWishlist: () =>
		apiRequest<{ message: string }>('/api/wishlist/clear', {
			method: 'DELETE',
			auth: true
		}),

	// Addresses
	getUserAddresses: addressesApi.getAll,
	addAddress: addressesApi.add,
	updateAddress: addressesApi.update,
	deleteAddress: addressesApi.delete,
	setDefaultAddress: addressesApi.setDefault,

	// Blog
	getBlogPosts: blogApi.getAll,
	getBlogPost: blogApi.getById,
	getBlogCategories: blogApi.getCategories,
	getBlogTags: blogApi.getTags,
	getFeaturedBlogPosts: blogApi.getFeatured,
	likeBlogPost: blogApi.like,
	getRelatedBlogPosts: blogApi.getRelated,

	// Additional Artisan APIs
	updateOrderStatus: (orderId: string, status: string, note?: string, trackingNumber?: string) =>
		apiRequest<Order>(`/api/seller/orders/${orderId}/status`, {
			method: 'PATCH',
			body: { status, ...(note && { note }), ...(trackingNumber && { trackingNumber }) },
			auth: true
		}),

	// Module 4: Seller reject an order with a mandatory reason
	rejectOrder: (orderId: string, reason: string, predefinedCategory?: string) =>
		apiRequest<{
			message: string;
			order: {
				_id: string;
				orderNumber: string;
				status: string;
				rejectionReason: string;
				rejectedAt: string;
			};
		}>(`/api/seller/orders/${orderId}/reject`, {
			method: 'POST',
			body: { reason, ...(predefinedCategory && { predefinedCategory }) },
			auth: true
		}),

	// Module 4: Get stored rejection reason for an order
	getOrderRejectionReason: (orderId: string) =>
		apiRequest<{
			orderNumber: string;
			status: string;
			rejectionReason: string | null;
			rejectedAt: string | null;
		}>(`/api/seller/orders/${orderId}/rejection-reason`, { auth: true }),

	getArtisanProfile: () =>
		apiRequest<{
			_id: string;
			name: string;
			email: string;
			phone?: string;
			avatar?: string;
			bio?: string;
			location?: { city: string; state: string; country: string };
			specialization: string[];
			experience: number;
			languages: string[];
			socialLinks?: { website?: string; instagram?: string; facebook?: string };
			businessInfo?: {
				businessName?: string;
				gstNumber?: string;
				panNumber?: string;
				bankDetails?: { accountNumber?: string; ifscCode?: string; bankName?: string };
			};
			certifications: Array<{ name: string; issuer: string; year: number }>;
			skills: string[];
			workExperience: Array<{ role: string; organization: string; duration: string; description: string }>;
			education: Array<{ degree: string; institution: string; year: number }>;
			stats: { totalProducts: number; totalOrders: number; totalRevenue: number; averageRating: number; totalReviews: number };
			createdAt: string;
			updatedAt: string;
		}>('/api/artisans/profile', { auth: true }),

	updateArtisanProfile: (profileData: {
		name?: string;
		phone?: string;
		bio?: string;
		location?: { city: string; state: string; country: string };
		specialization?: string[];
		experience?: number;
		languages?: string[];
		socialLinks?: { website?: string; instagram?: string; facebook?: string };
		businessInfo?: {
			businessName?: string;
			gstNumber?: string;
			panNumber?: string;
			bankDetails?: { accountNumber?: string; ifscCode?: string; bankName?: string };
		};
		skills?: string[];
	}) =>
		apiRequest<{ message: string }>('/api/artisans/profile', {
			method: 'PUT',
			body: JSON.stringify(profileData),
			auth: true
		}),

	// Shipping (Module 3)
	shipping: shippingApi,

	// COD (Module 3)
	cod: {
		checkEligibility: codApi.checkEligibility,
		getCharges: codApi.getCharges,
		getInvoiceBreakdown: codApi.getInvoiceBreakdown,
	},

	// ── Module 3: Invoices API ───────────────────────────────────────────────────
	invoices: {
		/** All invoices (all types) for a single order — customer or admin. */
		getForOrder: (orderId: string) =>
			apiRequest<{ success: boolean; count: number; invoices: Invoice[] }>(
				`/api/invoices/order/${orderId}`,
				{ auth: true }
			),

		/** Single invoice by ID — customer (own) or admin. */
		getOne: (invoiceId: string) =>
			apiRequest<{ success: boolean; invoice: Invoice }>(
				`/api/invoices/${invoiceId}`,
				{ auth: true }
			),

		/** Paginated invoice list — admin only. */
		list: (params?: {
			page?:    number;
			limit?:   number;
			type?:    InvoiceType;
			status?:  InvoiceStatus;
			search?:  string;
			from?:    string;
			to?:      string;
		}) => {
			const q = new URLSearchParams()
			if (params?.page)   q.set('page',   String(params.page))
			if (params?.limit)  q.set('limit',  String(params.limit))
			if (params?.type)   q.set('type',   params.type)
			if (params?.status) q.set('status', params.status)
			if (params?.search) q.set('search', params.search)
			if (params?.from)   q.set('from',   params.from)
			if (params?.to)     q.set('to',     params.to)
			return apiRequest<{
				success: boolean;
				data: {
					invoices:   Invoice[];
					pagination: { total: number; page: number; limit: number; totalPages: number };
				}
			}>(`/api/invoices?${q.toString()}`, { auth: true })
		},

		/** Void an invoice — admin only. */
		void: (invoiceId: string) =>
			apiRequest<{ success: boolean; invoice: Invoice }>(
				`/api/invoices/${invoiceId}/void`,
				{ method: 'POST', auth: true }
			),

		/** Void the existing sale invoice and re-issue a fresh one — admin only. */
		regenerate: (invoiceId: string) =>
			apiRequest<{ success: boolean; invoice: Invoice }>(
				`/api/invoices/${invoiceId}/regenerate`,
				{ method: 'POST', auth: true }
			),
	},

	// ── Module 2: Artisan Dashboard API ─────────────────────────────────────────
	artisanDashboard: {
		/**
		 * Single-call bundle: order counts + revenue + performance + trend + recent orders.
		 * GET /api/seller/dashboard?period=30days
		 */
		getBundle: (period: '7days' | '30days' | '90days' | '1year' = '30days') =>
			apiRequest<ArtisanDashboardBundle>(
				`/api/seller/dashboard?period=${period}`,
				{ auth: true }
			),

		/**
		 * Order counts only (total, pending, delivered, cancelled, etc.)
		 * GET /api/seller/orders/counts
		 */
		getOrderCounts: () =>
			apiRequest<ArtisanOrderCounts>(
				'/api/seller/orders/counts',
				{ auth: true }
			),

		/**
		 * Revenue summary with period comparison and growth %.
		 * GET /api/seller/analytics/revenue?period=30days
		 */
		getRevenue: (period: '7days' | '30days' | '90days' | '1year' = '30days') =>
			apiRequest<ArtisanRevenueSummary>(
				`/api/seller/analytics/revenue?period=${period}`,
				{ auth: true }
			),

		/**
		 * Daily/monthly revenue trend for charts.
		 * GET /api/seller/analytics/revenue/trend?period=30days
		 */
		getRevenueTrend: (period: '7days' | '30days' | '90days' | '1year' = '30days') =>
			apiRequest<{ trend: ArtisanRevenueTrendPoint[]; period: string }>(
				`/api/seller/analytics/revenue/trend?period=${period}`,
				{ auth: true }
			),

		/**
		 * Performance KPIs: fulfillment rate, avg handling time, return rate, etc.
		 * GET /api/seller/analytics/performance
		 */
		getPerformance: () =>
			apiRequest<ArtisanPerformanceMetrics>(
				'/api/seller/analytics/performance',
				{ auth: true }
			),

		/**
		 * Paginated orders list for this artisan.
		 * GET /api/seller/orders?page=1&limit=100&status=all
		 */
		getOrders: (params?: { page?: number; limit?: number; status?: string }) => {
			const q = new URLSearchParams();
			if (params?.page)   q.set('page',   String(params.page));
			if (params?.limit)  q.set('limit',  String(params.limit));
			if (params?.status && params.status !== 'all') q.set('status', params.status);
			const qs = q.toString() ? `?${q.toString()}` : '';
			return apiRequest<{ orders: Order[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
				`/api/seller/orders${qs}`,
				{ auth: true }
			);
		},

		/**
		 * Accept (confirm) a placed order.
		 * POST /api/seller/orders/:orderId/accept
		 */
		acceptOrder: (orderId: string, note?: string) =>
			apiRequest<{
				message: string;
				order: { _id: string; orderNumber: string; status: string; acceptedAt: string };
			}>(`/api/seller/orders/${orderId}/accept`, {
				method: 'POST',
				body: note ? { note } : {},
				auth: true,
			}),

		/**
		 * Reject an order with a mandatory reason.
		 * POST /api/seller/orders/:orderId/reject
		 */
		rejectOrder: (orderId: string, reason: string, predefinedCategory?: string) =>
			apiRequest<{
				message: string;
				order: { _id: string; orderNumber: string; status: string; rejectionReason: string; rejectedAt: string };
			}>(`/api/seller/orders/${orderId}/reject`, {
				method: 'POST',
				body: { reason, ...(predefinedCategory && { predefinedCategory }) },
				auth: true,
			}),

		/**
		 * Cancel an order with a mandatory reason (artisan-initiated).
		 * PATCH /api/seller/orders/:orderId/status  { status: 'cancelled', reason, note }
		 */
		cancelOrder: (orderId: string, reason: string, note?: string) =>
			apiRequest<{ message: string; order: Order }>(`/api/seller/orders/${orderId}/status`, {
				method: 'PATCH',
				body: { status: 'cancelled', reason, ...(note && { note }) },
				auth: true,
			}),
	},

	// ── Messaging ────────────────────────────────────────────────────────────────
	messages: {
		/** Artisan inbox — list all conversations. */
		list: (params?: { status?: string; page?: number; limit?: number; search?: string }) => {
			const q = new URLSearchParams();
			if (params?.status) q.set('status', params.status);
			if (params?.page)   q.set('page',   String(params.page));
			if (params?.limit)  q.set('limit',  String(params.limit));
			if (params?.search) q.set('search', params.search);
			const qs = q.toString() ? `?${q.toString()}` : '';
			return apiRequest<{
				conversations: Array<{
					_id: string;
					customerName: string;
					customerEmail: string;
					subject: string;
					status: 'open' | 'replied' | 'closed';
					unreadByArtisan: number;
					lastMessageAt: string;
					lastMessage: string;
					messageCount: number;
					createdAt: string;
				}>;
				pagination: { page: number; limit: number; total: number; pages: number };
				unreadTotal: number;
			}>(`/api/messages${qs}`, { auth: true });
		},

		/** Full thread for one conversation. */
		get: (id: string) =>
			apiRequest<{
				conversation: {
					_id: string;
					customerName: string;
					customerEmail: string;
					subject: string;
					status: 'open' | 'replied' | 'closed';
					unreadByArtisan: number;
					lastMessageAt: string;
					createdAt: string;
					thread: Array<{
						_id: string;
						sender: 'customer' | 'artisan';
						content: string;
						readByArtisan: boolean;
						createdAt: string;
					}>;
				};
			}>(`/api/messages/${id}`, { auth: true }),

		/** Artisan sends a reply. */
		reply: (id: string, content: string) =>
			apiRequest<{ message: string; thread: unknown[] }>(`/api/messages/${id}/reply`, {
				method: 'POST',
				body: { content },
				auth: true,
			}),

		/** Mark conversation as read. */
		markRead: (id: string) =>
			apiRequest<{ message: string }>(`/api/messages/${id}/read`, {
				method: 'PATCH',
				auth: true,
			}),

		/** Close a conversation. */
		close: (id: string) =>
			apiRequest<{ message: string; status: string }>(`/api/messages/${id}/close`, {
				method: 'PATCH',
				auth: true,
			}),

		/** Reopen a closed conversation. */
		reopen: (id: string) =>
			apiRequest<{ message: string; status: string }>(`/api/messages/${id}/reopen`, {
				method: 'PATCH',
				auth: true,
			}),

		/** Customer sends a new inquiry. */
		sendInquiry: (body: {
			artisanId: string;
			subject: string;
			message: string;
			customerName?: string;
			customerEmail?: string;
			productId?: string;
			orderId?: string;
		}) =>
			apiRequest<{ message: string; conversationId: string }>('/api/messages', {
				method: 'POST',
				body,
				auth: true,
			}),
	},

	// ── Artisan Dashboard ────────────────────────────────────────────────────────

	/** Orders containing this artisan's products. Uses JWT from artisan signin. */
	getArtisanOrders: (params?: { page?: number; limit?: number; status?: string }) => {
		const query = new URLSearchParams();
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit));
		if (params?.status) query.set('status', params.status);
		const qs = query.toString() ? `?${query.toString()}` : '';
		return apiRequest<{ orders: Order[]; pagination: { page: number; limit: number; total: number; pages: number } }>(
			`/api/orders/artisan-orders${qs}`,
			{ auth: true }
		);
	},

	/** Analytics for this artisan's products and orders. */
	getArtisanAnalytics: () =>
		apiRequest<{
			totalOrders: number;
			totalRevenue: number;
			ordersByStatus: Array<{ _id: string; count: number }>;
			monthlyRevenue: Array<{ _id: { year: number; month: number }; revenue: number; orders: number }>;
			topProducts: Array<{ _id: string; name: string; totalSold: number; revenue: number }>;
		}>('/api/orders/artisan-analytics', { auth: true }),
};

// Utility function to handle image URLs
export function getImageUrl(path: string): string {
	if (!path) return '/placeholder.svg';

	// Rewrite localhost image URLs to the current API base (handles DB-stored localhost URLs)
	if (path.includes('localhost:4000/api/images/') || path.includes('127.0.0.1:4000/api/images/')) {
		const filename = path.split('/api/images/').pop() || '';
		return `${API_BASE_URL}/api/images/${filename}`;
	}

	// If it's already a full URL or data URL, return as is
	if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
		return path;
	}

	// If it's already an API image path, use it directly
	if (path.startsWith('/api/images/')) {
		return `${API_BASE_URL}${path}`;
	}

	// For all other paths (including /assets/ paths), serve from database via API
	// Extract filename from path
	const filename = path.split('/').pop() || path;
	return `${API_BASE_URL}/api/images/${filename}`;
}