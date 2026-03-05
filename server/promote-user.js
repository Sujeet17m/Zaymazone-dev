
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import User from './src/models/User.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from server directory
dotenv.config({ path: join(__dirname, '.env') })

// Helper to connect to DB
async function connectDB() {
    if (mongoose.connection.readyState === 1) return;

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI is not defined in .env');
    }

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');
}

const promoteUser = async () => {
    try {
        const email = process.argv[2];

        if (!email) {
            console.log('\n❌ Please provide an email address.');
            console.log('Usage: node promote-user.js <email>');
            process.exit(1);
        }

        await connectDB();

        const user = await User.findOne({ email });

        if (!user) {
            console.log(`\n❌ User with email "${email}" not found.`);
            process.exit(1);
        }

        if (user.role === 'admin') {
            console.log(`\n⚠️ User "${user.name}" (${email}) is already an ADMIN.`);
        } else {
            user.role = 'admin';
            await user.save();
            console.log(`\n✅ Successfully promoted "${user.name}" (${email}) to ADMIN.`);
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

promoteUser();
