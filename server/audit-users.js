
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import User from './src/models/User.js'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// .env is in the same directory as this script (server/)
dotenv.config({ path: join(__dirname, '.env') })

const auditUsers = async () => {
    try {
        console.log('Connecting to MongoDB...')
        await mongoose.connect(process.env.MONGODB_URI)
        console.log('Connected.')

        const users = await User.find({}, 'name email role isAdmin').sort({ createdAt: -1 }).lean()

        let output = '--- User Audit Log ---\n\n'
        let adminFound = false

        users.forEach(user => {
            const isAdmin = user.role === 'admin' || user.isAdmin === true
            if (isAdmin) adminFound = true

            output += `Name: ${user.name}\n`
            output += `Email: ${user.email}\n`
            output += `Role: ${user.role}\n`
            output += `IsAdmin: ${user.isAdmin}\n`
            output += '--------------------------\n'
        })

        output += `\nTotal Users: ${users.length}\n`
        output += `Admin Found: ${adminFound ? 'YES' : 'NO'}\n`

        await fs.promises.writeFile('user_audit.txt', output)
        console.log('Audit complete. Check user_audit.txt')

    } catch (error) {
        console.error('Error:', error)
        await fs.promises.writeFile('user_audit_error.txt', error.stack || error.message)
    } finally {
        await mongoose.disconnect()
        process.exit(0)
    }
}

auditUsers()
