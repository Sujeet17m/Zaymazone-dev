/**
 * emailTemplates.js
 *
 * Centralised HTML email templates for Zaymazone.
 *
 * Each exported function accepts a `payload` object and returns
 * { subject, html }.   The payload shape is documented per template.
 *
 * Design notes:
 *  - Inline-CSS only (maximum email client compatibility)
 *  - Brand accent  #8B4513 (saddle-brown)
 *  - Success green #27ae60
 *  - Danger red    #c0392b
 */

const COMPANY   = 'Zaymazone'
const YEAR      = new Date().getFullYear()
const FOOTER_TEXT = `
  <div style="text-align:center;padding:20px;color:#888;font-size:12px;border-top:1px solid #e8e8e8;margin-top:24px;">
    <p>&copy; ${YEAR} ${COMPANY}. All rights reserved.</p>
    <p>This is an automated message. Please do not reply directly to this email.</p>
    <p>Zaymazone — Supporting Indian Artisans</p>
  </div>`

/** Wraps content in the standard email shell */
function shell(accentColor = '#8B4513', headerTitle, bodyHtml) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${headerTitle}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#333;background:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0f0f0;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:${accentColor};padding:28px 24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:1px;">${COMPANY}</h1>
            <h2 style="color:rgba(255,255,255,.9);margin:8px 0 0;font-size:18px;font-weight:400;">${headerTitle}</h2>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 28px 8px;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr><td>${FOOTER_TEXT}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** Formats a date as "1 March 2026" */
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Formats currency as ₹1,23,456 */
function fmtCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN')
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ORDER CONFIRMATION
// payload: { userName, orderNumber, orderDate, totalAmount, paymentMethod,
//            items[{name,quantity,price}], shippingAddress }
// ─────────────────────────────────────────────────────────────────────────────
export function orderConfirmation(payload) {
  const { userName, orderNumber, orderDate, totalAmount, paymentMethod, items = [], shippingAddress = {} } = payload
  const subject = `Order Confirmed – ${orderNumber} | ${COMPANY}`

  const itemRows = items.map(i =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">${i.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:center;">${i.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;">${fmtCurrency(i.price * i.quantity)}</td>
    </tr>`
  ).join('')

  const body = `
    <p>Dear ${userName},</p>
    <p>Thank you for your order! We've received it and it's being processed by our artisans.</p>

    <div style="background:#f9f9f9;border-radius:6px;padding:20px;margin:16px 0;">
      <p style="margin:0 0 4px;"><strong>Order Number:</strong> <span style="color:#8B4513;">${orderNumber}</span></p>
      <p style="margin:0 0 4px;"><strong>Order Date:</strong> ${fmtDate(orderDate)}</p>
      <p style="margin:0 0 4px;"><strong>Payment Method:</strong> ${String(paymentMethod).replace(/_/g,' ').toUpperCase()}</p>
    </div>

    <h3 style="color:#8B4513;border-bottom:2px solid #f0f0f0;padding-bottom:6px;">Items Ordered</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
      <thead>
        <tr style="background:#f9f9f9;">
          <th style="padding:8px 0;text-align:left;">Product</th>
          <th style="padding:8px 0;text-align:center;">Qty</th>
          <th style="padding:8px 0;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:10px 0;font-weight:bold;text-align:right;">Total:</td>
          <td style="padding:10px 0;font-weight:bold;text-align:right;color:#8B4513;">${fmtCurrency(totalAmount)}</td>
        </tr>
      </tfoot>
    </table>

    <h3 style="color:#8B4513;border-bottom:2px solid #f0f0f0;padding-bottom:6px;margin-top:20px;">Shipping Address</h3>
    <p style="margin:4px 0;">${shippingAddress.fullName || ''}</p>
    <p style="margin:4px 0;">${shippingAddress.addressLine1 || shippingAddress.street || ''}</p>
    <p style="margin:4px 0;">${shippingAddress.city || ''}, ${shippingAddress.state || ''} ${shippingAddress.zipCode || ''}</p>
    <p style="margin:4px 0;">${shippingAddress.country || 'India'}</p>

    <p style="margin-top:20px;">We'll email you again when your order ships. Thank you for supporting our artisans!</p>`

  return { subject, html: shell('#8B4513', 'Order Confirmation', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ORDER STATUS UPDATE
// payload: { userName, orderNumber, newStatus, trackingNumber?, courierService? }
// ─────────────────────────────────────────────────────────────────────────────
export function orderStatusUpdate(payload) {
  const { userName, orderNumber, newStatus, trackingNumber, courierService } = payload
  const subject = `Order Update: ${String(newStatus).replace(/_/g,' ').toUpperCase()} – ${orderNumber}`

  const statusMessages = {
    confirmed:        'Your order has been confirmed and is being prepared by the artisan.',
    processing:       'Your order is currently being processed.',
    packed:           'Your order has been carefully packed and is ready to ship.',
    shipped:          'Great news! Your order is on its way.',
    out_for_delivery: 'Your order is out for delivery today.',
    delivered:        'Your order has been delivered. We hope you love it!',
    cancelled:        'Your order has been cancelled.',
    returned:         'Your order return has been processed.',
    refunded:         'Your refund has been processed.',
  }

  const accentColor = ['cancelled','returned'].includes(newStatus) ? '#c0392b'
                    : newStatus === 'delivered' ? '#27ae60'
                    : '#8B4513'

  const trackingBlock = trackingNumber ? `
    <div style="background:#eafbea;border:1px solid #27ae60;border-radius:6px;padding:16px;margin-top:16px;">
      <h4 style="margin:0 0 8px;color:#27ae60;">Tracking Information</h4>
      <p style="margin:0 0 4px;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
      ${courierService ? `<p style="margin:0;"><strong>Courier:</strong> ${courierService}</p>` : ''}
    </div>` : ''

  const body = `
    <p>Dear ${userName},</p>
    <div style="background:#f9f9f9;border-left:4px solid ${accentColor};border-radius:4px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 8px;color:${accentColor};">Order ${orderNumber} — ${String(newStatus).replace(/_/g,' ').toUpperCase()}</h3>
      <p style="margin:0;">${statusMessages[newStatus] || 'Your order status has been updated.'}</p>
    </div>
    ${trackingBlock}
    <p style="margin-top:16px;">You can track your order anytime by visiting your <a href="https://zaymazone.com/orders" style="color:#8B4513;">orders page</a>.</p>`

  return { subject, html: shell(accentColor, 'Order Update', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ORDER REJECTION (by seller)
// payload: { userName, orderNumber, orderDate, totalAmount, reason }
// ─────────────────────────────────────────────────────────────────────────────
export function orderRejection(payload) {
  const { userName, orderNumber, orderDate, totalAmount, reason } = payload
  const subject = `Order Rejected – ${orderNumber} | ${COMPANY}`

  const body = `
    <p>Dear ${userName},</p>
    <div style="background:#fff3f3;border:1px solid #e74c3c;border-left:4px solid #c0392b;border-radius:4px;padding:16px;margin:16px 0;">
      <strong>We regret to inform you that your order has been rejected by the seller.</strong>
    </div>
    <p><strong>Order Number:</strong> <span style="color:#c0392b;">${orderNumber}</span></p>
    <p><strong>Order Date:</strong> ${fmtDate(orderDate)}</p>
    <p><strong>Total Amount:</strong> ${fmtCurrency(totalAmount)}</p>
    <p><strong>Rejection Reason:</strong></p>
    <div style="background:#fff;border:1px solid #ddd;padding:12px 16px;border-radius:4px;font-style:italic;color:#555;">${reason}</div>
    <div style="background:#eafbea;border:1px solid #27ae60;border-radius:4px;padding:16px;margin-top:16px;">
      <strong>What happens next?</strong>
      <ul style="margin:8px 0;padding-left:20px;">
        <li>If you paid online, a full refund will be initiated within <strong>5–7 business days</strong>.</li>
        <li>COD orders will not incur any charge.</li>
        <li>You can browse similar products from other artisans on ${COMPANY}.</li>
      </ul>
    </div>
    <p style="margin-top:16px;">We apologise for the inconvenience and hope to serve you better next time.</p>`

  return { subject, html: shell('#c0392b', 'Order Rejected', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PAYMENT CONFIRMATION
// payload: { userName, orderNumber, paymentId, amount, paymentDate }
// ─────────────────────────────────────────────────────────────────────────────
export function paymentConfirmation(payload) {
  const { userName, orderNumber, paymentId, amount, paymentDate } = payload
  const subject = `Payment Received – ${orderNumber} | ${COMPANY}`

  const body = `
    <p>Dear ${userName},</p>
    <p>We've successfully received your payment for order <strong>${orderNumber}</strong>.</p>
    <div style="background:#f9f9f9;border-radius:6px;padding:20px;margin:16px 0;">
      <p style="margin:0 0 4px;"><strong>Order Number:</strong> ${orderNumber}</p>
      <p style="margin:0 0 4px;"><strong>Payment ID:</strong> <code>${paymentId}</code></p>
      <p style="margin:0 0 4px;"><strong>Amount:</strong> ${fmtCurrency(amount)}</p>
      <p style="margin:0;"><strong>Payment Date:</strong> ${fmtDate(paymentDate || new Date())}</p>
    </div>
    <p>Your order is now confirmed and will be processed soon. Thank you!</p>`

  return { subject, html: shell('#27ae60', 'Payment Received', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. REFUND NOTIFICATION
// payload: { userName, orderNumber, refundId, refundAmount, refundDate }
// ─────────────────────────────────────────────────────────────────────────────
export function refundNotification(payload) {
  const { userName, orderNumber, refundId, refundAmount, refundDate } = payload
  const subject = `Refund Processed – ${orderNumber} | ${COMPANY}`

  const body = `
    <p>Dear ${userName},</p>
    <p>Your refund for order <strong>${orderNumber}</strong> has been processed.</p>
    <div style="background:#f9f9f9;border-radius:6px;padding:20px;margin:16px 0;">
      <p style="margin:0 0 4px;"><strong>Order Number:</strong> ${orderNumber}</p>
      <p style="margin:0 0 4px;"><strong>Refund ID:</strong> <code>${refundId}</code></p>
      <p style="margin:0 0 4px;"><strong>Refund Amount:</strong> ${fmtCurrency(refundAmount)}</p>
      <p style="margin:0;"><strong>Refund Date:</strong> ${fmtDate(refundDate || new Date())}</p>
    </div>
    <p>The refund will be credited to your original payment method within <strong>5–7 business days</strong>.</p>`

  return { subject, html: shell('#6c757d', 'Refund Processed', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ARTISAN ONBOARDING SUBMITTED (to artisan)
// payload: { artisanName, businessName, submittedAt }
// ─────────────────────────────────────────────────────────────────────────────
export function artisanOnboardingSubmitted(payload) {
  const { artisanName, businessName, submittedAt } = payload
  const subject = `Application Received – ${COMPANY}`

  const body = `
    <p>Dear ${artisanName},</p>
    <p>Thank you for applying to sell on <strong>${COMPANY}</strong>! We've successfully received your application for <strong>${businessName}</strong>.</p>
    <div style="background:#f9f9f9;border-left:4px solid #8B4513;border-radius:4px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 4px;"><strong>Business Name:</strong> ${businessName}</p>
      <p style="margin:0;"><strong>Submitted On:</strong> ${fmtDate(submittedAt || new Date())}</p>
    </div>
    <h3 style="color:#8B4513;">What happens next?</h3>
    <ol style="padding-left:20px;">
      <li>Our team will review your application (typically within 2–3 business days).</li>
      <li>You'll receive an email once your application is approved or if we need more information.</li>
      <li>Once approved, you can start listing your products and receiving orders.</li>
    </ol>
    <p>If you have any questions in the meantime, feel free to reach out to our support team.</p>
    <p>Thank you for supporting handcrafted Indian artistry!</p>`

  return { subject, html: shell('#8B4513', 'Application Received', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ARTISAN APPROVED
// payload: { artisanName, businessName, approvedAt, dashboardUrl? }
// ─────────────────────────────────────────────────────────────────────────────
export function artisanApproved(payload) {
  const { artisanName, businessName, approvedAt, dashboardUrl = 'https://zaymazone.com/artisan-dashboard' } = payload
  const subject = `Congratulations! Your Application is Approved – ${COMPANY}`

  const body = `
    <p>Dear ${artisanName},</p>
    <p style="font-size:16px;">🎉 <strong>Your application to sell on ${COMPANY} has been approved!</strong></p>
    <div style="background:#eafbea;border:1px solid #27ae60;border-radius:6px;padding:20px;margin:16px 0;">
      <p style="margin:0 0 4px;"><strong>Business Name:</strong> ${businessName}</p>
      <p style="margin:0;"><strong>Approved On:</strong> ${fmtDate(approvedAt || new Date())}</p>
    </div>
    <h3 style="color:#27ae60;">Get started in 3 easy steps:</h3>
    <ol style="padding-left:20px;">
      <li><strong>Sign in</strong> to your artisan dashboard at <a href="${dashboardUrl}" style="color:#8B4513;">${dashboardUrl}</a></li>
      <li><strong>Complete your profile</strong> — add a photo, bio, and your craft story.</li>
      <li><strong>List your products</strong> — set prices, upload photos and start selling!</li>
    </ol>
    <p>Welcome aboard, and congratulations on joining the ${COMPANY} family. We're proud to showcase your craft to customers across India!</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background:#8B4513;color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:bold;">Go to Dashboard</a>
    </div>`

  return { subject, html: shell('#27ae60', 'Application Approved!', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. ARTISAN REJECTED
// payload: { artisanName, businessName, rejectedAt, reason }
// ─────────────────────────────────────────────────────────────────────────────
export function artisanRejected(payload) {
  const { artisanName, businessName, rejectedAt, reason } = payload
  const subject = `Application Update – ${COMPANY}`

  const body = `
    <p>Dear ${artisanName},</p>
    <p>Thank you for your interest in selling on <strong>${COMPANY}</strong>. After careful review, we are unable to approve your application for <strong>${businessName}</strong> at this time.</p>
    <div style="background:#fff3f3;border:1px solid #e74c3c;border-left:4px solid #c0392b;border-radius:4px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;"><strong>Review Date:</strong> ${fmtDate(rejectedAt || new Date())}</p>
      <p style="margin:0 0 4px;"><strong>Reason:</strong></p>
      <div style="font-style:italic;color:#555;margin-top:6px;">${reason}</div>
    </div>
    <h3 style="color:#8B4513;">Can I reapply?</h3>
    <p>Yes! You're welcome to address the concerns above and resubmit your application through the seller registration page. Our team will be happy to review it again.</p>
    <p>If you believe this decision was made in error or need clarification, please contact our support team and quote your application details.</p>
    <p>We appreciate your understanding and wish you success in your craft.</p>`

  return { subject, html: shell('#c0392b', 'Application Update', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. WELCOME USER (regular customer after sign-up)
// payload: { userName }
// ─────────────────────────────────────────────────────────────────────────────
export function welcomeUser(payload) {
  const { userName } = payload
  const subject = `Welcome to ${COMPANY}!`

  const body = `
    <p>Dear ${userName},</p>
    <p>Welcome to <strong>${COMPANY}</strong> — your destination for authentic handcrafted treasures from skilled artisans across India!</p>
    <h3 style="color:#8B4513;">Here's what you can do:</h3>
    <ul style="padding-left:20px;">
      <li>🛍️  Browse and buy unique handcrafted products</li>
      <li>🎨  Discover the stories of skilled artisans</li>
      <li>❤️  Save favourites to your wishlist</li>
      <li>🚚  Track your orders in real-time</li>
    </ul>
    <p>Start exploring and find something truly unique today!</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="https://zaymazone.com/shop" style="display:inline-block;background:#8B4513;color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:bold;">Start Shopping</a>
    </div>`

  return { subject, html: shell('#8B4513', `Welcome to ${COMPANY}!`, body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. EMAIL VERIFICATION
// payload: { userName, verificationUrl, expiresInHours? }
// ─────────────────────────────────────────────────────────────────────────────
export function verificationEmail(payload) {
  const { userName, verificationUrl, expiresInHours = 24 } = payload
  const subject = `Verify your email – ${COMPANY}`

  const body = `
    <p>Dear ${userName},</p>
    <p>Please verify your email address to activate your ${COMPANY} account.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${verificationUrl}" style="display:inline-block;background:#8B4513;color:#fff;padding:14px 32px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:16px;">Verify Email Address</a>
    </div>
    <p style="font-size:13px;color:#666;">This link expires in <strong>${expiresInHours} hours</strong>. If you did not create an account, you can safely ignore this email.</p>
    <p style="font-size:12px;color:#999;word-break:break-all;">Or copy this link: ${verificationUrl}</p>`

  return { subject, html: shell('#8B4513', 'Verify Your Email', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. ARTISAN VERIFICATION SUCCESS (all required docs approved → badge granted)
// payload: { artisanName, businessName, badgeId, tier, verifiedAt,
//            verificationScore, documentsVerified[], dashboardUrl? }
// ─────────────────────────────────────────────────────────────────────────────
export function artisanVerificationSuccess(payload) {
  const {
    artisanName,
    businessName,
    badgeId,
    tier              = 'standard',
    verifiedAt,
    verificationScore = 100,
    documentsVerified = [],
    dashboardUrl      = 'https://zaymazone.com/artisan-dashboard',
  } = payload

  const isPremium    = tier === 'premium'
  const badgeLabel   = isPremium ? '\u2b50 Zaymazone Premium Verified Artisan' : '\u2714\ufe0f Zaymazone Verified Artisan'
  const accentColor  = isPremium ? '#B8860B' : '#27ae60'   // gold for premium, green for standard
  const subject      = `You're now a Verified Artisan on ${COMPANY}! \u2714`

  const docList = documentsVerified.length
    ? documentsVerified
        .map(d => `<li style="margin-bottom:4px;">${d.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</li>`)
        .join('')
    : '<li>All required documents</li>'

  const body = `
    <p>Dear ${artisanName},</p>
    <p style="font-size:16px;">\uD83C\uDF89 <strong>Congratulations! Your documents have been verified and you are now a Certified Verified Artisan on ${COMPANY}.</strong></p>

    <!-- Badge card -->
    <div style="background:linear-gradient(135deg,${accentColor} 0%,#1a7a45 100%);border-radius:10px;padding:24px;margin:20px 0;text-align:center;" ${isPremium ? 'style="background:linear-gradient(135deg,#B8860B 0%,#8B6914 100%);"' : ''}>
      <div style="color:#fff;font-size:22px;font-weight:bold;letter-spacing:1px;">${COMPANY}</div>
      <div style="color:rgba(255,255,255,.9);font-size:14px;margin:6px 0 14px;">VERIFIED ARTISAN CERTIFICATE</div>
      <div style="background:rgba(255,255,255,.15);border-radius:6px;padding:14px 20px;display:inline-block;">
        <div style="color:#fff;font-size:18px;font-weight:bold;">${artisanName}</div>
        <div style="color:rgba(255,255,255,.85);font-size:13px;">${businessName}</div>
      </div>
      <div style="margin-top:14px;color:rgba(255,255,255,.9);font-size:13px;">${badgeLabel}</div>
      <div style="margin-top:6px;color:rgba(255,255,255,.7);font-size:11px;">Badge ID: <code style="background:rgba(0,0,0,.2);padding:2px 6px;border-radius:3px;">${badgeId ? badgeId.slice(0,16) + '&hellip;' : 'N/A'}</code></div>
      <div style="color:rgba(255,255,255,.7);font-size:11px;margin-top:4px;">Verified: ${fmtDate(verifiedAt || new Date())} &nbsp;|&nbsp; Score: ${verificationScore}/100</div>
    </div>

    <h3 style="color:${accentColor};">Documents approved</h3>
    <ul style="padding-left:20px;color:#555;">${docList}</ul>

    <h3 style="color:${accentColor};">What this means for you</h3>
    <ul style="padding-left:20px;">
      <li>A <strong>Verified badge</strong> will appear on your seller profile and all your product listings.</li>
      <li>Customers can shop with greater confidence, increasing your sales potential.</li>
      <li>You gain access to <strong>priority support</strong> and featured promotion slots.</li>
    </ul>

    <p>Head to your dashboard to see your new badge in action!</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background:${accentColor};color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:bold;">Go to Dashboard</a>
    </div>`

  return { subject, html: shell(accentColor, 'Verification Complete!', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. NEW ORDER — ARTISAN NOTIFICATION (Module 5)
// payload: { artisanName, businessName, orderNumber, orderDate, items[{name,
//            quantity,price}], buyerName, buyerCity, buyerState, orderTotal,
//            dashboardUrl? }
// ─────────────────────────────────────────────────────────────────────────────
export function newOrderArtisan(payload) {
  const {
    artisanName,
    businessName,
    orderNumber,
    orderDate,
    items         = [],
    buyerName     = 'A customer',
    buyerCity     = '',
    buyerState    = '',
    orderTotal    = 0,
    dashboardUrl  = 'https://zaymazone.com/artisan-dashboard',
  } = payload

  const accentColor = '#8B4513'
  const subject     = `🛍️ New Order ${orderNumber} — ${COMPANY}`

  const itemRows = items.map(i => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:10px 8px;">${i.name}</td>
      <td style="padding:10px 8px;text-align:center;">${i.quantity}</td>
      <td style="padding:10px 8px;text-align:right;">${fmtCurrency(i.price)}</td>
      <td style="padding:10px 8px;text-align:right;">${fmtCurrency(i.price * i.quantity)}</td>
    </tr>`).join('')

  const body = `
    <p>Dear ${artisanName},</p>
    <p>🎉 <strong>You have received a new order!</strong> Please review the details below and begin preparing the shipment.</p>

    <div style="background:#fdf6ee;border-left:4px solid ${accentColor};border-radius:4px;padding:16px 20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="color:#888;font-size:13px;">Order Number</td><td style="text-align:right;font-weight:bold;">${orderNumber}</td></tr>
        <tr><td style="color:#888;font-size:13px;">Order Date</td><td style="text-align:right;">${fmtDate(orderDate || new Date())}</td></tr>
        <tr><td style="color:#888;font-size:13px;">Buyer</td><td style="text-align:right;">${buyerName}${buyerCity ? `, ${buyerCity}` : ''}${buyerState ? `, ${buyerState}` : ''}</td></tr>
        <tr><td style="color:#888;font-size:13px;">Shop</td><td style="text-align:right;">${businessName}</td></tr>
      </table>
    </div>

    <h3 style="color:${accentColor};">Order Items</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f7f7f7;">
          <th style="padding:10px 8px;text-align:left;">Product</th>
          <th style="padding:10px 8px;text-align:center;">Qty</th>
          <th style="padding:10px 8px;text-align:right;">Unit Price</th>
          <th style="padding:10px 8px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr style="background:#fdf6ee;font-weight:bold;">
          <td colspan="3" style="padding:12px 8px;text-align:right;">Order Total</td>
          <td style="padding:12px 8px;text-align:right;color:${accentColor};">${fmtCurrency(orderTotal)}</td>
        </tr>
      </tfoot>
    </table>

    <p style="margin-top:20px;">Please fulfil this order within your stated dispatch time. If you have any issues with stock or availability, update the order status promptly.</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background:${accentColor};color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:bold;">View Order in Dashboard</a>
    </div>`

  return { subject, html: shell(accentColor, 'New Order Received!', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. ORDER CANCELLED — ARTISAN NOTIFICATION (Module 5)
// payload: { artisanName, businessName, orderNumber, orderDate, items[{name,
//            quantity,price}], cancelledBy ('buyer'|'admin'|'system'),
//            cancellationReason, refundableAmount, dashboardUrl? }
// ─────────────────────────────────────────────────────────────────────────────
export function orderCancelledArtisan(payload) {
  const {
    artisanName,
    businessName,
    orderNumber,
    orderDate,
    items               = [],
    cancelledBy         = 'buyer',
    cancellationReason  = 'Not specified',
    refundableAmount    = 0,
    dashboardUrl        = 'https://zaymazone.com/artisan-dashboard',
  } = payload

  const accentColor = '#c0392b'
  const subject     = `❌ Order ${orderNumber} Cancelled — ${COMPANY}`

  const actorLabel = cancelledBy === 'admin' ? 'Zaymazone Admin'
    : cancelledBy === 'system' ? 'Automated system'
    : 'The buyer'

  const itemRows = items.map(i => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:8px;">${i.name}</td>
      <td style="padding:8px;text-align:center;">${i.quantity}</td>
      <td style="padding:8px;text-align:right;">${fmtCurrency(i.price * i.quantity)}</td>
    </tr>`).join('')

  const body = `
    <p>Dear ${artisanName},</p>
    <p>We regret to inform you that order <strong>${orderNumber}</strong> has been <strong style="color:${accentColor};">cancelled</strong>.</p>

    <div style="background:#fff5f5;border-left:4px solid ${accentColor};border-radius:4px;padding:16px 20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="color:#888;font-size:13px;">Order Number</td><td style="text-align:right;font-weight:bold;">${orderNumber}</td></tr>
        <tr><td style="color:#888;font-size:13px;">Order Date</td><td style="text-align:right;">${fmtDate(orderDate || new Date())}</td></tr>
        <tr><td style="color:#888;font-size:13px;">Cancelled By</td><td style="text-align:right;">${actorLabel}</td></tr>
        <tr><td style="color:#888;font-size:13px;">Reason</td><td style="text-align:right;">${cancellationReason}</td></tr>
        ${refundableAmount > 0 ? `<tr><td style="color:#888;font-size:13px;">Refund Amount</td><td style="text-align:right;color:#27ae60;font-weight:bold;">${fmtCurrency(refundableAmount)}</td></tr>` : ''}
      </table>
    </div>

    <h3 style="color:${accentColor};">Affected Items</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
      <thead><tr style="background:#f7f7f7;">
        <th style="padding:8px;text-align:left;">Product</th>
        <th style="padding:8px;text-align:center;">Qty</th>
        <th style="padding:8px;text-align:right;">Subtotal</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <p style="margin-top:20px;">Your inventory levels have been automatically restocked. No further action is required on your part.</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background:${accentColor};color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:bold;">View Orders</a>
    </div>`

  return { subject, html: shell(accentColor, 'Order Cancelled', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. RETURN REQUEST — ARTISAN NOTIFICATION (Module 5)
// payload: { artisanName, businessName, orderNumber, orderDate, items[{name,
//            quantity,price}], buyerName, returnReason, deliveredAt,
//            dashboardUrl? }
// ─────────────────────────────────────────────────────────────────────────────
export function orderReturnArtisan(payload) {
  const {
    artisanName,
    businessName,
    orderNumber,
    orderDate,
    items        = [],
    buyerName    = 'The buyer',
    returnReason = 'Not specified',
    deliveredAt,
    dashboardUrl = 'https://zaymazone.com/artisan-dashboard',
  } = payload

  const accentColor = '#e67e22'
  const subject     = `↩️ Return Request for Order ${orderNumber} — ${COMPANY}`

  const itemRows = items.map(i => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:8px;">${i.name}</td>
      <td style="padding:8px;text-align:center;">${i.quantity}</td>
      <td style="padding:8px;text-align:right;">${fmtCurrency(i.price * i.quantity)}</td>
    </tr>`).join('')

  const body = `
    <p>Dear ${artisanName},</p>
    <p>⚠️ <strong>A return has been requested</strong> for order <strong>${orderNumber}</strong> from your shop <em>${businessName}</em>.</p>

    <div style="background:#fff9f0;border-left:4px solid ${accentColor};border-radius:4px;padding:16px 20px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="color:#888;font-size:13px;">Order Number</td><td style="text-align:right;font-weight:bold;">${orderNumber}</td></tr>
        <tr><td style="color:#888;font-size:13px;">Order Date</td><td style="text-align:right;">${fmtDate(orderDate || new Date())}</td></tr>
        ${deliveredAt ? `<tr><td style="color:#888;font-size:13px;">Delivered On</td><td style="text-align:right;">${fmtDate(deliveredAt)}</td></tr>` : ''}
        <tr><td style="color:#888;font-size:13px;">Return Reason</td><td style="text-align:right;">${returnReason}</td></tr>
        <tr><td style="color:#888;font-size:13px;">Buyer</td><td style="text-align:right;">${buyerName}</td></tr>
      </table>
    </div>

    <h3 style="color:${accentColor};">Items Being Returned</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
      <thead><tr style="background:#f7f7f7;">
        <th style="padding:8px;text-align:left;">Product</th>
        <th style="padding:8px;text-align:center;">Qty</th>
        <th style="padding:8px;text-align:right;">Value</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <p style="margin-top:20px;">Our support team will review this request and reach out via the dashboard within 24 hours. Please ensure you are available to coordinate pickup arrangements.</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;background:${accentColor};color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:bold;">Review Return Request</a>
    </div>`

  return { subject, html: shell(accentColor, 'Return Request Received', body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. ADMIN CRITICAL ORDER ALERT (Module 5)
// payload: { alertType ('high_value'|'bulk_cancellation'|'return_spike'|
//            'payment_failure'|'fraud_flag'|'artisan_cancellation'),
//            orderNumber?, orderDate?, totalAmount?, buyerEmail?,
//            artisanName?, details, adminDashboardUrl? }
// ─────────────────────────────────────────────────────────────────────────────
export function adminOrderAlert(payload) {
  const {
    alertType          = 'high_value',
    orderNumber        = 'N/A',
    orderDate,
    totalAmount        = 0,
    buyerEmail         = 'unknown',
    artisanName        = 'unknown',
    details            = {},
    adminDashboardUrl  = 'https://zaymazone.com/admin',
  } = payload

  const ALERT_META = {
    high_value:           { color: '#8e44ad', icon: '💎', label: 'High-Value Order' },
    bulk_cancellation:    { color: '#c0392b', icon: '🚫', label: 'Bulk Cancellation Spike' },
    return_spike:         { color: '#e67e22', icon: '↩️', label: 'Return Rate Spike' },
    payment_failure:      { color: '#c0392b', icon: '💳', label: 'Payment Failure' },
    fraud_flag:           { color: '#c0392b', icon: '🚨', label: 'Fraud Flag' },
    artisan_cancellation: { color: '#e67e22', icon: '🏪', label: 'Artisan Cancelled Order' },
  }
  const meta        = ALERT_META[alertType] ?? { color: '#8B4513', icon: '⚠️', label: 'Order Alert' }
  const accentColor = meta.color
  const subject     = `${meta.icon} Admin Alert: ${meta.label} — ${COMPANY}`

  const detailRows = Object.entries(details)
    .map(([k, v]) => `<tr><td style="color:#888;font-size:13px;padding:6px 0;">${k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</td><td style="text-align:right;font-weight:bold;">${v}</td></tr>`)
    .join('')

  const body = `
    <p>This is an automated alert from the ${COMPANY} order management system.</p>

    <div style="background:#fff5f5;border:2px solid ${accentColor};border-radius:6px;padding:20px;margin:20px 0;">
      <div style="font-size:22px;margin-bottom:8px;">${meta.icon} <strong style="color:${accentColor};">${meta.label}</strong></div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="color:#888;font-size:13px;padding:6px 0;">Order Number</td><td style="text-align:right;font-weight:bold;">${orderNumber}</td></tr>
        ${orderDate ? `<tr><td style="color:#888;font-size:13px;padding:6px 0;">Order Date</td><td style="text-align:right;">${fmtDate(orderDate)}</td></tr>` : ''}
        ${totalAmount ? `<tr><td style="color:#888;font-size:13px;padding:6px 0;">Order Total</td><td style="text-align:right;font-weight:bold;color:${accentColor};">${fmtCurrency(totalAmount)}</td></tr>` : ''}
        <tr><td style="color:#888;font-size:13px;padding:6px 0;">Buyer Email</td><td style="text-align:right;">${buyerEmail}</td></tr>
        <tr><td style="color:#888;font-size:13px;padding:6px 0;">Artisan</td><td style="text-align:right;">${artisanName}</td></tr>
        ${detailRows}
      </table>
    </div>

    <p>Immediate review may be required. Click below to view the order in the admin dashboard.</p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${adminDashboardUrl}" style="display:inline-block;background:${accentColor};color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:bold;">Open Admin Dashboard</a>
    </div>`

  return { subject, html: shell(accentColor, `${meta.icon} ${meta.label}`, body) }
}

/**
 * Render a template by name.
 * Returns { subject, html } or throws if the template name is unknown.
 */
export function renderTemplate(type, payload) {
  const map = {
    // Buyer-facing
    order_confirmation:            orderConfirmation,
    order_status_update:           orderStatusUpdate,
    order_rejection:               orderRejection,
    payment_confirmation:          paymentConfirmation,
    refund_notification:           refundNotification,
    // Module 5 — artisan & admin order alerts
    new_order_artisan:             newOrderArtisan,
    order_cancelled_artisan:       orderCancelledArtisan,
    order_return_artisan:          orderReturnArtisan,
    admin_order_alert:             adminOrderAlert,
    // Artisan lifecycle
    artisan_onboarding_submitted:  artisanOnboardingSubmitted,
    artisan_approved:              artisanApproved,
    artisan_rejected:              artisanRejected,
    artisan_verification_success:  artisanVerificationSuccess,
    // User lifecycle
    welcome_user:                  welcomeUser,
    verification_email:            verificationEmail,
  }
  const fn = map[type]
  if (!fn) throw new Error(`Unknown email template: "${type}"`)
  return fn(payload)
}
