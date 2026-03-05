// Quick script to check if admin user exists and has correct role
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

async function checkAdminUser() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'NOT SET');

        if (!process.env.MONGODB_URI) {
            console.error('❌ MONGODB_URI not found in environment variables');
            console.log('\nPlease check your .env file in the server directory');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const User = (await import('./src/models/User.js')).default;

        const email = 'admin@zaymazone.com';
        console.log(`🔍 Looking for user: ${email}\n`);

        const user = await User.findOne({ email });

        if (!user) {
            console.log('❌ User NOT found in database');
            console.log('\n📝 To create admin user:');
            console.log('1. First create a regular user by signing up in the app');
            console.log('2. Then run: node create-admin.js admin@zaymazone.com');
        } else {
            console.log('✅ User found in database\n');
            console.log('📋 User Details:');
            console.log('   ID:', user._id);
            console.log('   Name:', user.name);
            console.log('   Email:', user.email);
            console.log('   Role:', user.role);
            console.log('   Is Admin:', user.isAdmin);
            console.log('   Firebase UID:', user.firebaseUid || 'Not set');
            console.log('   Auth Provider:', user.authProvider);
            console.log('   Is Active:', user.isActive);
            console.log('   Created:', user.createdAt);

            if (user.role === 'admin') {
                console.log('\n✅ User has admin role!');
                console.log('\n📝 Next steps:');
                console.log('1. Log out from the application');
                console.log('2. Log back in with admin@zaymazone.com');
                console.log('3. The Firebase auth will now recognize this user and preserve admin role');
            } else {
                console.log('\n⚠️  User does NOT have admin role');
                console.log('Current role:', user.role);
                console.log('\n📝 To make this user admin:');
                console.log('Run: node create-admin.js admin@zaymazone.com');
            }
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkAdminUser();
