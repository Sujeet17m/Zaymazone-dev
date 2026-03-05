// Script to create an admin user for testing UPI payment verification
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../.env') })

async function createAdminUser() {
    try {
        console.log('🔌 Connecting to MongoDB...')
        await mongoose.connect(process.env.MONGODB_URI)
        console.log('✅ Connected to MongoDB')

        const User = (await import('./src/models/User.js')).default

        // Get email from command line argument or use default
        const email = process.argv[2] || 'admin@zaymazone.com'

        console.log(`\n🔍 Looking for user with email: ${email}`)

        let user = await User.findOne({ email })

        if (!user) {
            console.log('❌ User not found. Please provide an existing user email.')
            console.log('Usage: node create-admin.js <user-email>')
            console.log('Example: node create-admin.js user@example.com')
            process.exit(1)
        }

        console.log(`\n📝 Current user details:`)
        console.log(`   Name: ${user.name}`)
        console.log(`   Email: ${user.email}`)
        console.log(`   Current Role: ${user.role}`)
        console.log(`   Is Admin: ${user.isAdmin}`)

        if (user.role === 'admin') {
            console.log('\n✅ User is already an admin!')
        } else {
            user.role = 'admin'
            await user.save()
            console.log('\n✅ User successfully promoted to admin!')
            console.log(`   New Role: ${user.role}`)
            console.log(`   Is Admin: ${user.isAdmin}`)
        }

        console.log('\n🎉 Admin user setup complete!')
        console.log('\n📋 Next steps:')
        console.log('   1. Use this user to login and get admin token')
        console.log('   2. Set admin_token in Postman environment')
        console.log('   3. Test UPI payment verification endpoints')

        process.exit(0)
    } catch (error) {
        console.error('❌ Error:', error.message)
        process.exit(1)
    }
}

createAdminUser()
