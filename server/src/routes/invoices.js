/**
 * Invoices router — Module 3: Automatic Bill Generation
 *
 * All routes here work with the persisted Invoice model.
 *
 * ── Endpoints ─────────────────────────────────────────────────────────────────
 *  GET  /api/invoices/order/:orderId    All invoices for one order
 *  GET  /api/invoices                   Paginated list (admin only)
 *  GET  /api/invoices/:invoiceId        Single invoice (owner or admin)
 *  POST /api/invoices/:invoiceId/void   Void an invoice (admin only)
 *  POST /api/invoices/:invoiceId/regenerate  Regenerate sale invoice (admin only)
 */

import express from 'express'
import Invoice from '../models/Invoice.js'
import invoiceService from '../services/invoiceService.js'
import { authenticateToken } from '../middleware/firebase-auth.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = express.Router()

// ─── GET /api/invoices/order/:orderId ─────────────────────────────────────────
// Returns all invoices (all types) for a given order.
// Customers can only query their own orders; admins see everything.

router.get('/order/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params

    const invoices = await Invoice.find({ orderId }).sort({ issuedAt: -1 }).lean()

    if (!invoices.length) {
      return res.json({ success: true, invoices: [] })
    }

    const isAdmin = req.user?.role === 'admin'

    // Ownership check for non-admins
    if (!isAdmin) {
      const userId = req.user._id.toString()
      if (invoices[0].userId.toString() !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
    }

    res.json({ success: true, count: invoices.length, invoices })
  } catch (err) {
    console.error('[invoices] GET /order/:orderId', err)
    res.status(500).json({ success: false, message: 'Failed to retrieve invoices', error: err.message })
  }
})

// ─── GET /api/invoices ────────────────────────────────────────────────────────
// Paginated list — admin only. Supports filter by type, status, date range.

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      page    = 1,
      limit   = 30,
      type,
      status,
      userId,
      orderNumber,
      from,   // ISO date string
      to,     // ISO date string
      search,
    } = req.query

    const filter = {}

    if (type)        filter.type        = type
    if (status)      filter.status      = status
    if (userId)      filter.userId      = userId
    if (orderNumber) filter.orderNumber = { $regex: orderNumber, $options: 'i' }

    if (from || to) {
      filter.issuedAt = {}
      if (from) filter.issuedAt.$gte = new Date(from)
      if (to)   filter.issuedAt.$lte = new Date(to)
    }

    // Free-text: search invoice number or order number
    if (search) {
      const rx = { $regex: search, $options: 'i' }
      filter.$or = [{ invoiceNumber: rx }, { orderNumber: rx }]
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit)
    const total = await Invoice.countDocuments(filter)
    const invoices = await Invoice.find(filter)
      .sort({ issuedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          total,
          page:       parseInt(page),
          limit:      parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    })
  } catch (err) {
    console.error('[invoices] GET /', err)
    res.status(500).json({ success: false, message: 'Failed to list invoices', error: err.message })
  }
})

// ─── GET /api/invoices/:invoiceId ─────────────────────────────────────────────
// Single invoice — customers can only access their own.

router.get('/:invoiceId', authenticateToken, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId).lean()

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    const isAdmin = req.user?.role === 'admin'
    if (!isAdmin && invoice.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    res.json({ success: true, invoice })
  } catch (err) {
    console.error('[invoices] GET /:invoiceId', err)
    res.status(500).json({ success: false, message: 'Failed to retrieve invoice', error: err.message })
  }
})

// ─── POST /api/invoices/:invoiceId/void ──────────────────────────────────────
// Admin only — mark invoice as void.

router.post('/:invoiceId/void', requireAuth, requireAdmin, async (req, res) => {
  try {
    const invoice = await invoiceService.voidInvoice(req.params.invoiceId, req.user._id)
    res.json({ success: true, invoice })
  } catch (err) {
    console.error('[invoices] POST /:invoiceId/void', err)
    const status = err.message.includes('not found') ? 404
                 : err.message.includes('cannot be voided') ? 422
                 : 500
    res.status(status).json({ success: false, message: err.message })
  }
})

// ─── POST /api/invoices/:invoiceId/regenerate ─────────────────────────────────
// Admin only — void existing sale invoice and issue a fresh one.

router.post('/:invoiceId/regenerate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const existing = await Invoice.findById(req.params.invoiceId).lean()
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    const newInvoice = await invoiceService.regenerateForOrder(existing.orderId, req.user._id)
    res.json({ success: true, invoice: newInvoice })
  } catch (err) {
    console.error('[invoices] POST /:invoiceId/regenerate', err)
    const status = err.message.includes('not found') ? 404 : 500
    res.status(status).json({ success: false, message: err.message })
  }
})

export default router
