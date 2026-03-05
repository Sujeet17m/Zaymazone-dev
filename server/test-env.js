import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Explicitly load .env file
const result = dotenv.config({ path: join(__dirname, '.env') })

if (result.error) {
    console.error('Error loading .env file:', result.error)
} else {
    console.log('✅ .env file loaded successfully')
}

console.log('=== Environment Variables Test ===')
console.log('NODE_ENV:', process.env.NODE_ENV)
console.log('PORT:', process.env.PORT)
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI)
console.log('MONGODB_URI value:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 30) + '...' : 'NOT SET')
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET)
console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.substring(0, 50) + '...' : 'NOT SET')
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID)
console.log('==================================')
