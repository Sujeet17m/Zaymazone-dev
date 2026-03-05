// ── Module 12: Email Template Metadata ───────────────────────────────────────
// Mirrors the 15 templates in server/src/services/emailTemplates.js
// and extends them with:
//   - placeholder schemas (for dynamic content documentation)
//   - sample data (for live UI preview)
//   - i18n display strings (multi-language ready)
//   - category classification

export type TemplateLang = 'en' | 'hi' | 'mr';

export interface PlaceholderField {
  key: string;
  type: 'string' | 'number' | 'date' | 'array' | 'object' | 'url';
  required: boolean;
  description: string;
  /** Sample value used for live preview in the admin UI */
  sample: string | number | object;
}

export interface EmailTemplateI18n {
  /** Display name shown in the admin UI */
  name: string;
  /** Short description of when this email is sent */
  description: string;
  /** Subject line description */
  subjectPattern: string;
}

export type TemplateCategory = 'order' | 'artisan' | 'user' | 'admin';

export interface EmailTemplateMeta {
  id: string;               // matches the key in renderTemplate()
  category: TemplateCategory;
  accentColor: string;      // brand color used in the template header
  icon: string;             // emoji icon for the admin UI
  i18n: Record<TemplateLang, EmailTemplateI18n>;
  placeholders: PlaceholderField[];
  /** Flat key→value sample data ready to pass to the backend renderer */
  samplePayload: Record<string, unknown>;
}

// ── Order category ────────────────────────────────────────────────────────────

const orderConfirmation: EmailTemplateMeta = {
  id: 'order_confirmation',
  category: 'order',
  accentColor: '#8B4513',
  icon: '🧾',
  i18n: {
    en: {
      name: 'Order Confirmation',
      description: 'Sent to the buyer immediately after a successful order is placed.',
      subjectPattern: 'Order Confirmed – {orderNumber} | Zaymazone',
    },
    hi: {
      name: 'ऑर्डर की पुष्टि',
      description: 'खरीदारी सफल होने के बाद ग्राहक को भेजा जाता है।',
      subjectPattern: 'ऑर्डर की पुष्टि हुई – {orderNumber} | Zaymazone',
    },
    mr: {
      name: 'ऑर्डर पुष्टी',
      description: 'खरेदी यशस्वी झाल्यावर ग्राहकाला पाठवले जाते.',
      subjectPattern: 'ऑर्डर पुष्टी – {orderNumber} | Zaymazone',
    },
  },
  placeholders: [
    { key: 'userName',       type: 'string', required: true,  description: 'Full name of the buyer',                    sample: 'Priya Sharma' },
    { key: 'orderNumber',    type: 'string', required: true,  description: 'Unique order identifier',                   sample: 'ZM-2026-00142' },
    { key: 'orderDate',      type: 'date',   required: true,  description: 'ISO date when the order was placed',        sample: '2026-03-01T10:30:00Z' },
    { key: 'totalAmount',    type: 'number', required: true,  description: 'Total amount paid in INR',                  sample: 1850 },
    { key: 'paymentMethod',  type: 'string', required: true,  description: 'Payment method used (upi, cod, card, etc)', sample: 'upi' },
    { key: 'items',          type: 'array',  required: true,  description: 'Array of {name, quantity, price} objects',  sample: [{ name: 'Madhubani Painting', quantity: 1, price: 1850 }] },
    { key: 'shippingAddress',type: 'object', required: true,  description: 'Delivery address object',                   sample: { fullName: 'Priya Sharma', addressLine1: '12 MG Road', city: 'Pune', state: 'Maharashtra', zipCode: '411001' } },
  ],
  samplePayload: {
    userName: 'Priya Sharma',
    orderNumber: 'ZM-2026-00142',
    orderDate: '2026-03-01T10:30:00Z',
    totalAmount: 1850,
    paymentMethod: 'upi',
    items: [
      { name: 'Madhubani Painting', quantity: 1, price: 1850 },
    ],
    shippingAddress: {
      fullName: 'Priya Sharma',
      addressLine1: '12 MG Road',
      city: 'Pune',
      state: 'Maharashtra',
      zipCode: '411001',
      country: 'India',
    },
  },
};

const orderStatusUpdate: EmailTemplateMeta = {
  id: 'order_status_update',
  category: 'order',
  accentColor: '#8B4513',
  icon: '📦',
  i18n: {
    en: {
      name: 'Order Status Update',
      description: 'Sent whenever an order status changes (shipped, delivered, etc.).',
      subjectPattern: 'Order Update: {newStatus} – {orderNumber}',
    },
    hi: {
      name: 'ऑर्डर स्थिति अपडेट',
      description: 'जब भी ऑर्डर की स्थिति बदले तब भेजा जाता है।',
      subjectPattern: 'ऑर्डर अपडेट: {newStatus} – {orderNumber}',
    },
    mr: {
      name: 'ऑर्डर स्थिती अपडेट',
      description: 'ऑर्डर स्थिती बदलल्यावर पाठवले जाते.',
      subjectPattern: 'ऑर्डर अपडेट: {newStatus} – {orderNumber}',
    },
  },
  placeholders: [
    { key: 'userName',        type: 'string', required: true,  description: 'Full name of the buyer',                   sample: 'Priya Sharma' },
    { key: 'orderNumber',     type: 'string', required: true,  description: 'Unique order identifier',                  sample: 'ZM-2026-00142' },
    { key: 'newStatus',       type: 'string', required: true,  description: 'New order status (shipped, delivered, etc)', sample: 'shipped' },
    { key: 'trackingNumber',  type: 'string', required: false, description: 'Courier tracking number (if available)',   sample: 'DELHIVERY123456' },
    { key: 'courierService',  type: 'string', required: false, description: 'Courier company name',                    sample: 'Delhivery' },
  ],
  samplePayload: {
    userName: 'Priya Sharma',
    orderNumber: 'ZM-2026-00142',
    newStatus: 'shipped',
    trackingNumber: 'DELHIVERY123456',
    courierService: 'Delhivery',
  },
};

const orderRejection: EmailTemplateMeta = {
  id: 'order_rejection',
  category: 'order',
  accentColor: '#c0392b',
  icon: '❌',
  i18n: {
    en: { name: 'Order Rejected', description: 'Sent when an artisan rejects an order.', subjectPattern: 'Order Rejected – {orderNumber} | Zaymazone' },
    hi: { name: 'ऑर्डर अस्वीकृत', description: 'जब एक कारीगर ऑर्डर अस्वीकार करे।', subjectPattern: 'ऑर्डर अस्वीकृत – {orderNumber}' },
    mr: { name: 'ऑर्डर नाकारला', description: 'कारागीराने ऑर्डर नाकारल्यावर पाठवले जाते.', subjectPattern: 'ऑर्डर नाकारला – {orderNumber}' },
  },
  placeholders: [
    { key: 'userName',    type: 'string', required: true, description: 'Full name of the buyer',             sample: 'Priya Sharma' },
    { key: 'orderNumber', type: 'string', required: true, description: 'Unique order identifier',            sample: 'ZM-2026-00142' },
    { key: 'orderDate',   type: 'date',   required: true, description: 'Date the order was originally placed', sample: '2026-03-01T10:30:00Z' },
    { key: 'totalAmount', type: 'number', required: true, description: 'Total amount of the rejected order', sample: 1850 },
    { key: 'reason',      type: 'string', required: true, description: 'Reason for rejection provided by the artisan', sample: 'Product is temporarily out of stock.' },
  ],
  samplePayload: {
    userName: 'Priya Sharma', orderNumber: 'ZM-2026-00142',
    orderDate: '2026-03-01T10:30:00Z', totalAmount: 1850,
    reason: 'Product is temporarily out of stock.',
  },
};

const paymentConfirmation: EmailTemplateMeta = {
  id: 'payment_confirmation',
  category: 'order',
  accentColor: '#27ae60',
  icon: '💳',
  i18n: {
    en: { name: 'Payment Confirmation', description: 'Sent after a successful payment is captured.', subjectPattern: 'Payment Received – {orderNumber} | Zaymazone' },
    hi: { name: 'भुगतान की पुष्टि', description: 'सफल भुगतान के बाद भेजा जाता है।', subjectPattern: 'भुगतान प्राप्त – {orderNumber}' },
    mr: { name: 'पेमेंट पुष्टी', description: 'यशस्वी पेमेंटनंतर पाठवले जाते.', subjectPattern: 'पेमेंट मिळाले – {orderNumber}' },
  },
  placeholders: [
    { key: 'userName',    type: 'string', required: true, description: "Buyer's name",           sample: 'Priya Sharma' },
    { key: 'orderNumber', type: 'string', required: true, description: 'Related order number',   sample: 'ZM-2026-00142' },
    { key: 'paymentId',   type: 'string', required: true, description: 'Gateway payment ID',     sample: 'pay_PQ9XY7Z34' },
    { key: 'amount',      type: 'number', required: true, description: 'Amount paid in INR',     sample: 1850 },
    { key: 'paymentDate', type: 'date',   required: true, description: 'Date of payment',        sample: '2026-03-01T10:35:00Z' },
  ],
  samplePayload: { userName: 'Priya Sharma', orderNumber: 'ZM-2026-00142', paymentId: 'pay_PQ9XY7Z34', amount: 1850, paymentDate: '2026-03-01T10:35:00Z' },
};

const refundNotification: EmailTemplateMeta = {
  id: 'refund_notification',
  category: 'order',
  accentColor: '#6c757d',
  icon: '↩️',
  i18n: {
    en: { name: 'Refund Processed', description: 'Sent when a refund has been initiated to the buyer.', subjectPattern: 'Refund Processed – {orderNumber} | Zaymazone' },
    hi: { name: 'रिफंड प्रोसेस हुआ', description: 'जब रिफंड शुरू हो तब भेजा जाता है।', subjectPattern: 'रिफंड प्रोसेस हुआ – {orderNumber}' },
    mr: { name: 'परतावा प्रक्रिया', description: 'परतावा सुरू झाल्यावर पाठवले जाते.', subjectPattern: 'परतावा केला – {orderNumber}' },
  },
  placeholders: [
    { key: 'userName',     type: 'string', required: true, description: "Buyer's name",           sample: 'Priya Sharma' },
    { key: 'orderNumber',  type: 'string', required: true, description: 'Related order number',   sample: 'ZM-2026-00142' },
    { key: 'refundId',     type: 'string', required: true, description: 'Refund transaction ID',  sample: 'rfnd_ABC12345' },
    { key: 'refundAmount', type: 'number', required: true, description: 'Refund amount in INR',   sample: 1850 },
    { key: 'refundDate',   type: 'date',   required: true, description: 'Date refund was issued', sample: '2026-03-02T09:00:00Z' },
  ],
  samplePayload: { userName: 'Priya Sharma', orderNumber: 'ZM-2026-00142', refundId: 'rfnd_ABC12345', refundAmount: 1850, refundDate: '2026-03-02T09:00:00Z' },
};

// ── Artisan lifecycle ─────────────────────────────────────────────────────────

const artisanOnboardingSubmitted: EmailTemplateMeta = {
  id: 'artisan_onboarding_submitted',
  category: 'artisan',
  accentColor: '#8B4513',
  icon: '📋',
  i18n: {
    en: { name: 'Artisan Application Received', description: 'Sent to the artisan after they submit their seller registration.', subjectPattern: 'Application Received – Zaymazone' },
    hi: { name: 'आवेदन प्राप्त', description: 'कारीगर द्वारा पंजीकरण जमा होने पर भेजा जाता है।', subjectPattern: 'आवेदन प्राप्त – Zaymazone' },
    mr: { name: 'अर्ज मिळाला', description: 'कारागीराने नोंदणी केल्यावर पाठवले जाते.', subjectPattern: 'अर्ज मिळाला – Zaymazone' },
  },
  placeholders: [
    { key: 'artisanName',  type: 'string', required: true,  description: "Artisan's full name",          sample: 'Rajan Sharma' },
    { key: 'businessName', type: 'string', required: true,  description: "Business or shop name",        sample: 'Sharma Handicrafts' },
    { key: 'submittedAt',  type: 'date',   required: false, description: 'Date application was received', sample: '2026-03-01T08:00:00Z' },
  ],
  samplePayload: { artisanName: 'Rajan Sharma', businessName: 'Sharma Handicrafts', submittedAt: '2026-03-01T08:00:00Z' },
};

const artisanApproved: EmailTemplateMeta = {
  id: 'artisan_approved',
  category: 'artisan',
  accentColor: '#27ae60',
  icon: '✅',
  i18n: {
    en: { name: 'Artisan Approved', description: 'Sent when admin approves the artisan application.', subjectPattern: "Congratulations! Your Application is Approved – Zaymazone" },
    hi: { name: 'कारीगर अनुमोदित', description: 'जब एडमिन आवेदन स्वीकार करे।', subjectPattern: 'बधाई हो! आपका आवेदन स्वीकृत हुआ' },
    mr: { name: 'कारागीर मंजूर', description: 'अॅडमिनने अर्ज मंजूर केल्यावर पाठवले जाते.', subjectPattern: 'अभिनंदन! तुमचा अर्ज मंजूर' },
  },
  placeholders: [
    { key: 'artisanName',  type: 'string', required: true,  description: "Artisan's full name",      sample: 'Rajan Sharma' },
    { key: 'businessName', type: 'string', required: true,  description: 'Business or shop name',    sample: 'Sharma Handicrafts' },
    { key: 'approvedAt',   type: 'date',   required: false, description: 'Approval date',            sample: '2026-03-03T11:00:00Z' },
    { key: 'dashboardUrl', type: 'url',    required: false, description: 'Artisan dashboard link',   sample: 'https://zaymazone.com/artisan-dashboard' },
  ],
  samplePayload: { artisanName: 'Rajan Sharma', businessName: 'Sharma Handicrafts', approvedAt: '2026-03-03T11:00:00Z', dashboardUrl: 'https://zaymazone.com/artisan-dashboard' },
};

const artisanRejected: EmailTemplateMeta = {
  id: 'artisan_rejected',
  category: 'artisan',
  accentColor: '#c0392b',
  icon: '🚫',
  i18n: {
    en: { name: 'Artisan Application Rejected', description: 'Sent when the artisan application is declined with a reason.', subjectPattern: 'Application Update – Zaymazone' },
    hi: { name: 'आवेदन अस्वीकृत', description: 'जब एडमिन आवेदन अस्वीकार करे।', subjectPattern: 'आवेदन अपडेट – Zaymazone' },
    mr: { name: 'अर्ज नाकारला', description: 'अॅडमिनने अर्ज नाकारल्यावर पाठवले जाते.', subjectPattern: 'अर्ज अपडेट – Zaymazone' },
  },
  placeholders: [
    { key: 'artisanName',  type: 'string', required: true, description: "Artisan's full name",    sample: 'Rajan Sharma' },
    { key: 'businessName', type: 'string', required: true, description: 'Business or shop name',  sample: 'Sharma Handicrafts' },
    { key: 'rejectedAt',   type: 'date',   required: true, description: 'Rejection date',         sample: '2026-03-03T11:00:00Z' },
    { key: 'reason',       type: 'string', required: true, description: 'Reason for rejection',   sample: 'Incomplete document submission — Aadhaar card image was blurry.' },
  ],
  samplePayload: { artisanName: 'Rajan Sharma', businessName: 'Sharma Handicrafts', rejectedAt: '2026-03-03T11:00:00Z', reason: 'Incomplete document submission — Aadhaar card image was blurry.' },
};

const artisanVerificationSuccess: EmailTemplateMeta = {
  id: 'artisan_verification_success',
  category: 'artisan',
  accentColor: '#27ae60',
  icon: '🏅',
  i18n: {
    en: { name: 'Artisan Verified (Badge Granted)', description: 'Sent when an artisan earns the Verified Artisan badge.', subjectPattern: "You're now a Verified Artisan on Zaymazone! ✔" },
    hi: { name: 'सत्यापित कारीगर (बैज प्रदान)', description: 'जब कारीगर को वेरिफाइड बैज मिले।', subjectPattern: 'आप Zaymazone पर सत्यापित कारीगर हैं!' },
    mr: { name: 'सत्यापित कारागीर (बॅज मिळाला)', description: 'कारागीराला व्हेरिफाइड बॅज मिळाल्यावर पाठवले जाते.', subjectPattern: 'तुम्ही Zaymazone वर सत्यापित कारागीर आहात!' },
  },
  placeholders: [
    { key: 'artisanName',        type: 'string', required: true,  description: "Artisan's full name",          sample: 'Rajan Sharma' },
    { key: 'businessName',       type: 'string', required: true,  description: 'Business or shop name',        sample: 'Sharma Handicrafts' },
    { key: 'badgeId',            type: 'string', required: true,  description: 'Unique badge identifier',      sample: 'badge_a1b2c3d4e5f6' },
    { key: 'tier',               type: 'string', required: false, description: 'Badge tier: standard|premium', sample: 'standard' },
    { key: 'verifiedAt',         type: 'date',   required: true,  description: 'Verification date',            sample: '2026-03-05T14:00:00Z' },
    { key: 'verificationScore',  type: 'number', required: false, description: 'Score out of 100',             sample: 95 },
    { key: 'documentsVerified',  type: 'array',  required: false, description: 'List of approved document keys', sample: ['aadhaar_card', 'bank_statement', 'gst_certificate'] },
    { key: 'dashboardUrl',       type: 'url',    required: false, description: 'Artisan dashboard URL',        sample: 'https://zaymazone.com/artisan-dashboard' },
  ],
  samplePayload: {
    artisanName: 'Rajan Sharma', businessName: 'Sharma Handicrafts',
    badgeId: 'badge_a1b2c3d4e5f6', tier: 'standard',
    verifiedAt: '2026-03-05T14:00:00Z', verificationScore: 95,
    documentsVerified: ['aadhaar_card', 'bank_statement', 'gst_certificate'],
    dashboardUrl: 'https://zaymazone.com/artisan-dashboard',
  },
};

const newOrderArtisan: EmailTemplateMeta = {
  id: 'new_order_artisan',
  category: 'artisan',
  accentColor: '#8B4513',
  icon: '🛍️',
  i18n: {
    en: { name: 'New Order Notification (Artisan)', description: 'Sent to the artisan when they receive a new order.', subjectPattern: '🛍️ New Order {orderNumber} — Zaymazone' },
    hi: { name: 'नया ऑर्डर (कारीगर)', description: 'कारीगर को नया ऑर्डर मिलने पर भेजा जाता है।', subjectPattern: '🛍️ नया ऑर्डर {orderNumber}' },
    mr: { name: 'नवीन ऑर्डर (कारागीर)', description: 'कारागीराला नवीन ऑर्डर मिळाल्यावर पाठवले जाते.', subjectPattern: '🛍️ नवीन ऑर्डर {orderNumber}' },
  },
  placeholders: [
    { key: 'artisanName',  type: 'string', required: true,  description: "Artisan's name",          sample: 'Rajan Sharma' },
    { key: 'businessName', type: 'string', required: true,  description: 'Shop name',               sample: 'Sharma Handicrafts' },
    { key: 'orderNumber',  type: 'string', required: true,  description: 'Order ID',                sample: 'ZM-2026-00142' },
    { key: 'orderDate',    type: 'date',   required: true,  description: 'Date order was placed',   sample: '2026-03-01T10:30:00Z' },
    { key: 'items',        type: 'array',  required: true,  description: '{name, quantity, price}', sample: [{ name: 'Madhubani Painting', quantity: 1, price: 1850 }] },
    { key: 'buyerName',    type: 'string', required: false, description: "Buyer's name",            sample: 'Priya Sharma' },
    { key: 'buyerCity',    type: 'string', required: false, description: "Buyer's city",            sample: 'Pune' },
    { key: 'buyerState',   type: 'string', required: false, description: "Buyer's state",           sample: 'Maharashtra' },
    { key: 'orderTotal',   type: 'number', required: true,  description: 'Total order value (INR)', sample: 1850 },
    { key: 'dashboardUrl', type: 'url',    required: false, description: 'Dashboard link',          sample: 'https://zaymazone.com/artisan-dashboard' },
  ],
  samplePayload: {
    artisanName: 'Rajan Sharma', businessName: 'Sharma Handicrafts',
    orderNumber: 'ZM-2026-00142', orderDate: '2026-03-01T10:30:00Z',
    items: [{ name: 'Madhubani Painting', quantity: 1, price: 1850 }],
    buyerName: 'Priya Sharma', buyerCity: 'Pune', buyerState: 'Maharashtra',
    orderTotal: 1850, dashboardUrl: 'https://zaymazone.com/artisan-dashboard',
  },
};

const orderCancelledArtisan: EmailTemplateMeta = {
  id: 'order_cancelled_artisan',
  category: 'artisan',
  accentColor: '#c0392b',
  icon: '🚫',
  i18n: {
    en: { name: 'Order Cancelled (Artisan)', description: "Sent to the artisan when one of their orders is cancelled.", subjectPattern: '❌ Order {orderNumber} Cancelled — Zaymazone' },
    hi: { name: 'ऑर्डर रद्द (कारीगर)', description: 'कारीगर का ऑर्डर रद्द होने पर भेजा जाता है।', subjectPattern: '❌ ऑर्डर {orderNumber} रद्द' },
    mr: { name: 'ऑर्डर रद्द (कारागीर)', description: 'कारागीराचा ऑर्डर रद्द झाल्यावर पाठवले जाते.', subjectPattern: '❌ ऑर्डर {orderNumber} रद्द' },
  },
  placeholders: [
    { key: 'artisanName',         type: 'string', required: true,  description: "Artisan's name",                         sample: 'Rajan Sharma' },
    { key: 'businessName',        type: 'string', required: true,  description: 'Shop name',                              sample: 'Sharma Handicrafts' },
    { key: 'orderNumber',         type: 'string', required: true,  description: 'Order ID',                               sample: 'ZM-2026-00142' },
    { key: 'orderDate',           type: 'date',   required: true,  description: 'Original order date',                   sample: '2026-03-01T10:30:00Z' },
    { key: 'items',               type: 'array',  required: true,  description: '{name, quantity, price}',               sample: [{ name: 'Madhubani Painting', quantity: 1, price: 1850 }] },
    { key: 'cancelledBy',         type: 'string', required: false, description: 'buyer | admin | system',                sample: 'buyer' },
    { key: 'cancellationReason',  type: 'string', required: false, description: 'Reason for cancellation',              sample: 'Customer changed their mind.' },
    { key: 'refundableAmount',    type: 'number', required: false, description: 'Refund amount if applicable',          sample: 1850 },
    { key: 'dashboardUrl',        type: 'url',    required: false, description: 'Dashboard link',                       sample: 'https://zaymazone.com/artisan-dashboard' },
  ],
  samplePayload: {
    artisanName: 'Rajan Sharma', businessName: 'Sharma Handicrafts',
    orderNumber: 'ZM-2026-00142', orderDate: '2026-03-01T10:30:00Z',
    items: [{ name: 'Madhubani Painting', quantity: 1, price: 1850 }],
    cancelledBy: 'buyer', cancellationReason: 'Customer changed their mind.',
    refundableAmount: 1850, dashboardUrl: 'https://zaymazone.com/artisan-dashboard',
  },
};

const orderReturnArtisan: EmailTemplateMeta = {
  id: 'order_return_artisan',
  category: 'artisan',
  accentColor: '#e67e22',
  icon: '↩️',
  i18n: {
    en: { name: 'Return Request (Artisan)', description: 'Sent to artisan when a buyer raises a return request.', subjectPattern: '↩️ Return Request for Order {orderNumber} — Zaymazone' },
    hi: { name: 'वापसी अनुरोध (कारीगर)', description: 'जब खरीदार वापसी का अनुरोध करे।', subjectPattern: '↩️ ऑर्डर {orderNumber} वापसी अनुरोध' },
    mr: { name: 'परत विनंती (कारागीर)', description: 'खरेदीदाराने परत विनंती केल्यावर पाठवले जाते.', subjectPattern: '↩️ ऑर्डर {orderNumber} परत विनंती' },
  },
  placeholders: [
    { key: 'artisanName',  type: 'string', required: true,  description: "Artisan's name",                  sample: 'Rajan Sharma' },
    { key: 'businessName', type: 'string', required: true,  description: 'Shop name',                       sample: 'Sharma Handicrafts' },
    { key: 'orderNumber',  type: 'string', required: true,  description: 'Order ID',                        sample: 'ZM-2026-00142' },
    { key: 'orderDate',    type: 'date',   required: true,  description: 'Original order date',            sample: '2026-03-01T10:30:00Z' },
    { key: 'items',        type: 'array',  required: true,  description: '{name, quantity, price}',        sample: [{ name: 'Madhubani Painting', quantity: 1, price: 1850 }] },
    { key: 'buyerName',    type: 'string', required: false, description: "Buyer's name",                   sample: 'Priya Sharma' },
    { key: 'returnReason', type: 'string', required: true,  description: 'Reason stated by the buyer',     sample: 'Product arrived damaged.' },
    { key: 'deliveredAt',  type: 'date',   required: false, description: 'Delivery date of the order',     sample: '2026-03-04T16:00:00Z' },
    { key: 'dashboardUrl', type: 'url',    required: false, description: 'Dashboard link',                 sample: 'https://zaymazone.com/artisan-dashboard' },
  ],
  samplePayload: {
    artisanName: 'Rajan Sharma', businessName: 'Sharma Handicrafts',
    orderNumber: 'ZM-2026-00142', orderDate: '2026-03-01T10:30:00Z',
    items: [{ name: 'Madhubani Painting', quantity: 1, price: 1850 }],
    buyerName: 'Priya Sharma', returnReason: 'Product arrived damaged.',
    deliveredAt: '2026-03-04T16:00:00Z', dashboardUrl: 'https://zaymazone.com/artisan-dashboard',
  },
};

// ── User lifecycle ────────────────────────────────────────────────────────────

const welcomeUser: EmailTemplateMeta = {
  id: 'welcome_user',
  category: 'user',
  accentColor: '#8B4513',
  icon: '👋',
  i18n: {
    en: { name: 'Welcome Email (Buyer)', description: 'Sent to new customers after successful sign-up.', subjectPattern: 'Welcome to Zaymazone!' },
    hi: { name: 'स्वागत ईमेल (खरीदार)', description: 'नए ग्राहकों को साइन-अप के बाद भेजा जाता है।', subjectPattern: 'Zaymazone में आपका स्वागत है!' },
    mr: { name: 'स्वागत ईमेल (खरेदीदार)', description: 'नवीन ग्राहकांना साइन-अप नंतर पाठवले जाते.', subjectPattern: 'Zaymazone मध्ये आपले स्वागत!' },
  },
  placeholders: [
    { key: 'userName', type: 'string', required: true, description: "Customer's full name", sample: 'Priya Sharma' },
  ],
  samplePayload: { userName: 'Priya Sharma' },
};

const verificationEmail: EmailTemplateMeta = {
  id: 'verification_email',
  category: 'user',
  accentColor: '#8B4513',
  icon: '📧',
  i18n: {
    en: { name: 'Email Verification', description: 'Sent to verify a new user\'s email address.', subjectPattern: 'Verify your email – Zaymazone' },
    hi: { name: 'ईमेल सत्यापन', description: 'नए उपयोगकर्ता का ईमेल सत्यापित करने के लिए।', subjectPattern: 'अपना ईमेल सत्यापित करें – Zaymazone' },
    mr: { name: 'ईमेल सत्यापन', description: 'नवीन वापरकर्त्याचा ईमेल सत्यापित करण्यासाठी.', subjectPattern: 'तुमचा ईमेल सत्यापित करा – Zaymazone' },
  },
  placeholders: [
    { key: 'userName',         type: 'string', required: true,  description: "User's full name",                        sample: 'Priya Sharma' },
    { key: 'verificationUrl',  type: 'url',    required: true,  description: 'One-time verification link',              sample: 'https://zaymazone.com/verify?token=abc123' },
    { key: 'expiresInHours',   type: 'number', required: false, description: 'Hours until the link expires (default 24)', sample: 24 },
  ],
  samplePayload: { userName: 'Priya Sharma', verificationUrl: 'https://zaymazone.com/verify?token=abc123xyz', expiresInHours: 24 },
};

// ── Admin ─────────────────────────────────────────────────────────────────────

const adminOrderAlert: EmailTemplateMeta = {
  id: 'admin_order_alert',
  category: 'admin',
  accentColor: '#c0392b',
  icon: '🚨',
  i18n: {
    en: { name: 'Admin Critical Order Alert', description: 'Sent to the admin email for high-value orders, fraud flags, bulk cancellations, etc.', subjectPattern: '⚠️ Admin Alert: {alertType} — Zaymazone' },
    hi: { name: 'एडमिन क्रिटिकल अलर्ट', description: 'उच्च-मूल्य ऑर्डर, धोखाधड़ी, आदि के लिए एडमिन को अलर्ट।', subjectPattern: '⚠️ एडमिन अलर्ट: {alertType}' },
    mr: { name: 'अॅडमिन क्रिटिकल अलर्ट', description: 'उच्च-मूल्य ऑर्डर, फसवणूक इत्यादींसाठी अॅडमिनला अलर्ट.', subjectPattern: '⚠️ अॅडमिन अलर्ट: {alertType}' },
  },
  placeholders: [
    { key: 'alertType',         type: 'string', required: true,  description: 'high_value | bulk_cancellation | return_spike | payment_failure | fraud_flag | artisan_cancellation', sample: 'high_value' },
    { key: 'orderNumber',       type: 'string', required: false, description: 'Related order number',           sample: 'ZM-2026-00142' },
    { key: 'orderDate',         type: 'date',   required: false, description: 'Order date',                    sample: '2026-03-01T10:30:00Z' },
    { key: 'totalAmount',       type: 'number', required: false, description: 'Order total (INR)',             sample: 25000 },
    { key: 'buyerEmail',        type: 'string', required: false, description: "Buyer's email",                 sample: 'priya@example.com' },
    { key: 'artisanName',       type: 'string', required: false, description: "Artisan's name",                sample: 'Rajan Sharma' },
    { key: 'details',           type: 'object', required: false, description: 'Extra key/value pairs for the alert table', sample: { note: 'First order above ₹20,000 threshold' } },
    { key: 'adminDashboardUrl', type: 'url',    required: false, description: 'Admin dashboard URL',          sample: 'https://zaymazone.com/admin' },
  ],
  samplePayload: {
    alertType: 'high_value', orderNumber: 'ZM-2026-00142',
    orderDate: '2026-03-01T10:30:00Z', totalAmount: 25000,
    buyerEmail: 'priya@example.com', artisanName: 'Rajan Sharma',
    details: { note: 'First order above ₹20,000 threshold' },
    adminDashboardUrl: 'https://zaymazone.com/admin',
  },
};

// ── Master catalog ────────────────────────────────────────────────────────────

export const EMAIL_TEMPLATES: EmailTemplateMeta[] = [
  orderConfirmation,
  orderStatusUpdate,
  orderRejection,
  paymentConfirmation,
  refundNotification,
  artisanOnboardingSubmitted,
  artisanApproved,
  artisanRejected,
  artisanVerificationSuccess,
  newOrderArtisan,
  orderCancelledArtisan,
  orderReturnArtisan,
  welcomeUser,
  verificationEmail,
  adminOrderAlert,
];

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  order:   'Order Notifications',
  artisan: 'Artisan Lifecycle',
  user:    'User Lifecycle',
  admin:   'Admin Alerts',
};

export const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  order:   'bg-blue-100 text-blue-800 border-blue-200',
  artisan: 'bg-amber-100 text-amber-800 border-amber-200',
  user:    'bg-green-100 text-green-800 border-green-200',
  admin:   'bg-red-100 text-red-800 border-red-200',
};

export const LANG_LABELS: Record<TemplateLang, string> = {
  en: '🇬🇧 English',
  hi: '🇮🇳 हिंदी',
  mr: '🇮🇳 मराठी',
};
