import { apiRequest } from '@/lib/api';

// Base API configuration
let API_BASE_URL: string;

try {
  const envUrl = import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : undefined);
  API_BASE_URL = envUrl || (import.meta.env.DEV ? 'http://localhost:4000/api' : 'https://zaymazone-dev.onrender.com/api');
} catch (error) {
  API_BASE_URL = import.meta.env.DEV ? 'http://localhost:4000/api' : 'https://zaymazone-dev.onrender.com/api';
}

// Helper function to handle API responses
async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Something went wrong');
  }
  return response.json();
}

// Helper function to convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
  });
}

// Helper function to handle file uploads
async function uploadFile(file: File, type: 'document' | 'image' | 'video') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  return handleResponse(response);
}

export interface SellerFormData {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  address: {
    village: string;
    district: string;
    state: string;
    pincode: string;
  };
  yearsOfExperience: string;
  profilePhoto: File | null;
  productPhotos: File[];
  sellerType: string;
  gstNumber: string;
  gstCertificate: File | null;
  aadhaarNumber: string;
  aadhaarProof: File | null;
  panNumber: string;
  categories: string[];
  productDescription: string;
  materials: string;
  priceRange: {
    min: string;
    max: string;
  };
  stockQuantity: string;
  pickupAddress: {
    sameAsMain: boolean;
    address: string;
  };
  dispatchTime: string;
  packagingType: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  paymentFrequency: string;
  story: string;
  /** URL of the already-uploaded video (empty string = not provided) */
  craftVideo: string;
}

export const sellerApi = {
  // Complete seller onboarding with approval workflow
  async completeOnboarding(formData: SellerFormData) {
    // Get Firebase token (preferred) or fallback to JWT token
    const firebaseToken = localStorage.getItem('firebase_id_token');
    const jwtToken = localStorage.getItem('token');
    const token = firebaseToken || jwtToken;
    
    console.log('=== Onboarding Submission Debug ===');
    console.log('Firebase token exists:', !!firebaseToken);
    console.log('JWT token exists:', !!jwtToken);
    console.log('Using token type:', firebaseToken ? 'Firebase' : jwtToken ? 'JWT' : 'None');
    
    if (!token) {
      const errorMsg = 'Please sign in to submit your application. No authentication token found.';
      console.error(errorMsg);
      console.log('LocalStorage contents:', {
        firebase_id_token: localStorage.getItem('firebase_id_token'),
        token: localStorage.getItem('token'),
        user: localStorage.getItem('user')
      });
      throw new Error(errorMsg);
    }
    
    // Prepare JSON payload with all form data
    const payload = {
      businessName: formData.businessName,
      ownerName: formData.ownerName,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      address: formData.address,
      yearsOfExperience: formData.yearsOfExperience,
      sellerType: formData.sellerType,
      gstNumber: formData.gstNumber,
      aadhaarNumber: formData.aadhaarNumber,
      panNumber: formData.panNumber,
      categories: formData.categories,
      productDescription: formData.productDescription,
      materials: formData.materials,
      priceRange: formData.priceRange,
      stockQuantity: formData.stockQuantity,
      pickupAddress: formData.pickupAddress,
      dispatchTime: formData.dispatchTime,
      packagingType: formData.packagingType,
      bankName: formData.bankName,
      accountNumber: formData.accountNumber,
      ifscCode: formData.ifscCode,
      upiId: formData.upiId,
      paymentFrequency: formData.paymentFrequency,
      story: formData.story,
      profilePhoto: formData.profilePhoto ? await fileToBase64(formData.profilePhoto) : null,
      productPhotos: formData.productPhotos ? await Promise.all(formData.productPhotos.map(f => fileToBase64(f))) : [],
      gstCertificate: formData.gstCertificate ? await fileToBase64(formData.gstCertificate) : null,
      aadhaarProof: formData.aadhaarProof ? await fileToBase64(formData.aadhaarProof) : null,
      // craftVideo is already a URL from VideoUpload — send it directly, no base64 conversion
      craftVideo: formData.craftVideo || null
    };

    const payloadSize = JSON.stringify(payload).length;
    console.log('Submitting onboarding...');
    console.log('Token preview:', token.substring(0, 30) + '...');
    console.log('Payload size:', (payloadSize / 1024).toFixed(2), 'KB');

    const response = await fetch(`${API_BASE_URL}/onboarding/artisan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    console.log('Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Onboarding failed:', errorText);
      throw new Error(errorText || `Server error: ${response.status}`);
    }

    const result = await response.json();
    console.log('Onboarding successful:', result);
    return result;
  },

  // Register seller (legacy - kept for compatibility)
  async registerSeller(formData: SellerFormData) {
    const data = new FormData();
    
    // Add basic fields
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'address' || key === 'priceRange' || key === 'pickupAddress') {
        data.append(key, JSON.stringify(value));
      } else if (key === 'profilePhoto' || key === 'gstCertificate' || key === 'aadhaarProof' || key === 'craftVideo') {
        if (value) data.append(key, value);
      } else if (key === 'productPhotos') {
        if (Array.isArray(value)) {
          value.forEach((file, index) => {
            data.append(`productPhotos`, file);
          });
        }
      } else if (key === 'categories') {
        if (Array.isArray(value)) {
          value.forEach(cat => data.append('categories', cat));
        }
      } else {
        data.append(key, String(value));
      }
    });

    const finalData = {
      businessName: formData.businessName,
      ownerName: formData.ownerName,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      yearsOfExperience: formData.yearsOfExperience,
      sellerType: formData.sellerType,
      gstNumber: formData.gstNumber,
      aadhaarNumber: formData.aadhaarNumber,
      panNumber: formData.panNumber,
      categories: formData.categories,
      productDescription: formData.productDescription,
      materials: formData.materials,
      priceRange: formData.priceRange,
      stockQuantity: formData.stockQuantity,
      pickupAddress: formData.pickupAddress,
      dispatchTime: formData.dispatchTime,
      packagingType: formData.packagingType,
      bankName: formData.bankName,
      accountNumber: formData.accountNumber,
      ifscCode: formData.ifscCode,
      upiId: formData.upiId,
      paymentFrequency: formData.paymentFrequency,
      story: formData.story
    };

    const response = await fetch(`${API_BASE_URL}/sellers/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(finalData),
    });

    return handleResponse(response);
  },

  // Check whether an email is already registered in either account type.
  // Returns { existsAsCustomer, existsAsArtisan } booleans.
  async checkEmail(email: string): Promise<{ existsAsCustomer: boolean; existsAsArtisan: boolean }> {
    const response = await fetch(
      `${API_BASE_URL}/auth/check-email?email=${encodeURIComponent(email)}`
    );
    return handleResponse(response);
  },

  // Verify GST number
  async verifyGST(gstNumber: string) {
    const response = await fetch(`${API_BASE_URL}/verify/gst/${gstNumber}`);
    return handleResponse(response);
  },

  // Verify bank account and save form
  async verifyBankAccount(formData: SellerFormData) {
    return apiRequest('/api/verify/bank-account', {
      method: 'POST',
      body: {
        accountNumber: formData.accountNumber,
        ifscCode: formData.ifscCode,
        bankName: formData.bankName,
        name: formData.ownerName || formData.businessName,
        bio: formData.story || '',
        location: {
          city: formData.address.district || formData.address.village,
          state: formData.address.state,
          country: 'India'
        },
        specialties: formData.categories || [],
        experience: parseInt(formData.yearsOfExperience) || 0,
        socials: {},
        documentType: formData.aadhaarNumber ? 'aadhar' : 'pan',
        documentNumber: formData.aadhaarNumber || formData.panNumber,
        email: formData.email
      }
    });
  }
};

// Page Content API
export const pageContentApi = {
  async getPageContent(pageId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/page-content/${pageId}`);
      return handleResponse(response);
    } catch (error) {
      console.warn(`Failed to fetch page content for ${pageId}, using defaults:`, error);
      // Return default content if API fails
      const defaults: Record<string, { title: string; description: string }> = {
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
      };
      return defaults[pageId] || defaults.shop;
    }
  },

  async getCategories() {
    try {
      const response = await fetch(`${API_BASE_URL}/products/categories`);
      return handleResponse(response);
    } catch (error) {
      console.warn('Failed to fetch categories, using defaults:', error);
      // Return default categories if API fails
      return {
        categories: [
          {
            id: "pottery",
            name: "Pottery & Ceramics",
            description: "Hand-thrown pottery, decorative ceramics, and traditional clay items crafted by master potters.",
            image: "pottery-category.jpg",
            icon: "Gift",
            productCount: 48,
            subcategories: ["Vases", "Dinnerware", "Tea Sets", "Decorative Items"],
            featured: true,
            artisanCount: 25
          },
          {
            id: "textiles",
            name: "Handwoven Textiles",
            description: "Traditional fabrics, sarees, scarves, and clothing created using ancient weaving techniques.",
            image: "textiles-category.jpg",
            icon: "ShirtIcon",
            productCount: 85,
            subcategories: ["Sarees", "Shawls", "Scarves", "Bedding", "Bags"],
            featured: true,
            artisanCount: 42
          },
          {
            id: "crafts",
            name: "Traditional Crafts",
            description: "Handmade decorative items, toys, and functional objects representing India's rich craft heritage.",
            image: "crafts-category.jpg",
            icon: "Palette",
            productCount: 67,
            subcategories: ["Wood Carving", "Metal Work", "Stone Inlay", "Paintings"],
            featured: true,
            artisanCount: 38
          },
          {
            id: "paintings",
            name: "Folk Paintings",
            description: "Traditional Indian paintings including Madhubani, Kalamkari, and other regional art forms.",
            image: "crafts-category.jpg",
            icon: "Palette",
            productCount: 29,
            subcategories: ["Madhubani", "Kalamkari", "Warli", "Miniature"],
            featured: false,
            artisanCount: 18
          }
        ]
      };
    }
  },

  async getArtisans() {
    try {
      const response = await fetch(`${API_BASE_URL}/products/artisans`);
      return handleResponse(response);
    } catch (error) {
      console.warn('Failed to fetch artisans, using defaults:', error);
      // Return default artisans if API fails
      return [
        {
          _id: '1',
          name: 'Rajesh Kumar',
          bio: 'Master potter with 20 years of experience in traditional pottery',
          avatar: 'https://via.placeholder.com/200x200?text=Rajesh',
          category: 'Pottery & Ceramics',
          specialty: 'Handwheel pottery',
          location: 'Jaipur, Rajasthan',
          productsCount: 45,
          rating: 4.8,
          reviews: 127,
          slug: 'rajesh-kumar'
        },
        {
          _id: '2',
          name: 'Priya Sharma',
          bio: 'Traditional textile weaver specializing in hand block prints',
          avatar: 'https://via.placeholder.com/200x200?text=Priya',
          category: 'Textiles & Fabrics',
          specialty: 'Hand block printing',
          location: 'Udaipur, Rajasthan',
          productsCount: 38,
          rating: 4.9,
          reviews: 95,
          slug: 'priya-sharma'
        }
      ];
    }
  },

  async getBlogs() {
    try {
      const response = await fetch(`${API_BASE_URL}/products/blogs`);
      return handleResponse(response);
    } catch (error) {
      console.warn('Failed to fetch blogs, using defaults:', error);
      // Return default blogs if API fails
      return {
        blogs: [
          {
            _id: '1',
            title: 'The Art of Handcrafted Pottery',
            slug: 'art-of-handcrafted-pottery',
            excerpt: 'Discover the timeless techniques and traditions behind handcrafted pottery',
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
            author: 'Priya Sharma',
            image: 'https://via.placeholder.com/600x400?text=Textiles',
            category: 'Textiles',
            tags: ['textiles', 'sustainable', 'weaving'],
            publishedAt: new Date(Date.now() - 5*24*60*60*1000).toISOString(),
            views: 456
          }
        ]
      };
    }
  }
};
