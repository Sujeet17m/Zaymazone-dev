
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import User from '../models/User.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../../../.env') })

const checkAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log('Connected to MongoDB')

        const fs = await import('fs')
        const users = await User.find({}, 'name email role isAdmin firebaseUid').lean()

        let output = '\n--- User List ---\n'
        users.forEach(user => {
            output += `Name: ${user.name}\n`
            output += `Email: ${user.email}\n`
            output += `Role: ${user.role}\n`
            output += `Firebase UID: ${user.firebaseUid}\n`
            output += '-----------------\n'
        })
        output += `\nTotal Users: ${users.length}\n`

        await fs.promises.writeFile('admin_users.txt', output)
        console.log('User list written to admin_users.txt')

    } catch (error) {
        console.error('Error:', error)
    } finally {
        await mongoose.disconnect()
        console.log('Disconnected from MongoDB')
    }
}

checkAdmin()
