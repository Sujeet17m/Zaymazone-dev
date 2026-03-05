
import mongoose from 'mongoose'
import Artisan from './src/models/Artisan.js'
import User from './src/models/User.js'
import fs from 'fs'

const MONGODB_URI = 'mongodb+srv://sujeet_db_intern:Sujeet_zayma123@zayma-test.w2omvt0.mongodb.net/?appName=zayma-test'

const audit = async () => {
    try {
        await mongoose.connect(MONGODB_URI)
        console.log('Connected.')

        const artisans = await Artisan.find({}, 'name email userId approvalStatus isActive').lean()

        let output = '--- Artisan Audit ---\n\n'
        artisans.forEach(a => {
            output += `Name: ${a.name}\n`
            output += `Email: ${a.email}\n`
            output += `UserId: ${a.userId}\n`
            output += `ApprovalStatus: ${a.approvalStatus}\n`
            output += `IsActive: ${a.isActive}\n`
            output += '--------------------------\n'
        })
        output += `\nTotal Artisans: ${artisans.length}\n`

        await fs.promises.writeFile('artisan_audit.txt', output)
        console.log(`Done. Found ${artisans.length} artisans.`)
    } catch (error) {
        console.error('Error:', error.message)
        await fs.promises.writeFile('artisan_audit_error.txt', error.stack || error.message)
    } finally {
        await mongoose.disconnect()
        process.exit(0)
    }
}

audit()
