import QRCode from 'qrcode'

/**
 * UPI Service - Handles UPI payment intent generation and QR code creation
 */

/**
 * Generate UPI payment intent URL
 * @param {string} merchantUpiId - Merchant's UPI ID (e.g., merchant@paytm)
 * @param {string} merchantName - Merchant's business name
 * @param {number} amount - Transaction amount in INR
 * @param {string} orderNumber - Order number for tracking
 * @param {string} transactionNote - Optional transaction note
 * @returns {string} UPI intent URL
 */
export function generateUpiIntent(merchantUpiId, merchantName, amount, orderNumber, transactionNote = '') {
    // UPI URL format: upi://pay?pa=<merchant_upi_id>&pn=<merchant_name>&am=<amount>&tr=<transaction_ref>&tn=<transaction_note>
    const params = new URLSearchParams({
        pa: merchantUpiId, // Payee Address (merchant UPI ID)
        pn: merchantName, // Payee Name
        am: amount.toFixed(2), // Amount (fixed to 2 decimal places)
        tr: orderNumber, // Transaction Reference (Order Number)
        tn: transactionNote || `Payment for Order ${orderNumber}`, // Transaction Note
        cu: 'INR' // Currency
    })

    return `upi://pay?${params.toString()}`
}

/**
 * Generate QR code from UPI intent URL
 * @param {string} upiIntentUrl - UPI payment intent URL
 * @param {object} options - QR code generation options
 * @returns {Promise<string>} Base64 data URL of QR code image
 */
export async function generateQrCode(upiIntentUrl, options = {}) {
    try {
        const defaultOptions = {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            width: 300,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            ...options
        }

        // Generate QR code as data URL (base64)
        const qrCodeDataUrl = await QRCode.toDataURL(upiIntentUrl, defaultOptions)
        return qrCodeDataUrl
    } catch (error) {
        console.error('Error generating QR code:', error)
        throw new Error('Failed to generate QR code')
    }
}

/**
 * Validate UTR (Unique Transaction Reference) format
 * UTR is typically 12-digit alphanumeric string from banks
 * @param {string} utr - UTR to validate
 * @returns {boolean} True if valid format
 */
export function validateUtr(utr) {
    if (!utr || typeof utr !== 'string') {
        return false
    }

    // Remove whitespace and convert to uppercase
    const cleanUtr = utr.trim().toUpperCase()

    // UTR format: typically 12 alphanumeric characters
    // Some banks use different formats, so we'll be flexible
    const utrRegex = /^[A-Z0-9]{10,16}$/

    return utrRegex.test(cleanUtr)
}

/**
 * Check payment status (placeholder for future payment gateway integration)
 * This is a mock implementation. In production, integrate with actual payment gateway API
 * @param {string} utr - Unique Transaction Reference
 * @returns {Promise<object>} Payment status information
 */
export async function checkPaymentStatus(utr) {
    // TODO: Integrate with actual UPI payment gateway API
    // For now, return mock data for manual verification
    return {
        utr: utr,
        status: 'pending_verification',
        message: 'Manual verification required. Admin must verify payment using UTR.',
        requiresManualVerification: true
    }
}

/**
 * Calculate payment expiry time
 * @param {number} minutes - Minutes until expiry (default: 30)
 * @returns {Date} Expiry timestamp
 */
export function calculateExpiryTime(minutes = 30) {
    const expiryTime = new Date()
    expiryTime.setMinutes(expiryTime.getMinutes() + minutes)
    return expiryTime
}

/**
 * Format amount for UPI (ensure 2 decimal places)
 * @param {number} amount - Amount to format
 * @returns {string} Formatted amount
 */
export function formatAmount(amount) {
    return parseFloat(amount).toFixed(2)
}

/**
 * Sanitize UPI ID
 * @param {string} upiId - UPI ID to sanitize
 * @returns {string} Sanitized UPI ID
 */
export function sanitizeUpiId(upiId) {
    if (!upiId || typeof upiId !== 'string') {
        throw new Error('Invalid UPI ID')
    }

    // Remove whitespace and convert to lowercase
    const cleanUpiId = upiId.trim().toLowerCase()

    // Validate UPI ID format: username@provider
    const upiIdRegex = /^[a-z0-9._-]+@[a-z0-9]+$/

    if (!upiIdRegex.test(cleanUpiId)) {
        throw new Error('Invalid UPI ID format. Expected format: username@provider')
    }

    return cleanUpiId
}

export default {
    generateUpiIntent,
    generateQrCode,
    validateUtr,
    checkPaymentStatus,
    calculateExpiryTime,
    formatAmount,
    sanitizeUpiId
}
