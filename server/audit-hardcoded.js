
import mongoose from 'mongoose'
import User from './src/models/User.js'
import fs from 'fs'

const MONGODB_URI = 'mongodb+srv://sujeet_db_intern:Sujeet_zayma123@zayma-test.w2omvt0.mongodb.net/?appName=zayma-test'

const auditUsers = async () => {
    try {
        console.log('Connecting to MongoDB (Hardcoded URI)...')
        await mongoose.connect(MONGODB_URI)
        console.log('Connected.')

        const users = await User.find({}, 'name email role isAdmin').sort({ createdAt: -1 }).lean()

        let output = '--- User Audit Log ---\n\n'

        users.forEach(user => {
            output += `Name: ${user.name}\n`
            output += `Email: ${user.email}\n`
            output += `Role: ${user.role}\n`
            output += `IsAdmin: ${user.isAdmin}\n`
            output += '--------------------------\n'
        })

        await fs.promises.writeFile('user_audit_hardcoded.txt', output)
        console.log(`Audit complete. Found ${users.length} users.`)

    } catch (error) {
        console.error('Error:', error)
    } finally {
        await mongoose.disconnect()
        process.exit(0)
    }
}

auditUsers()
