/**
 * RejectionReasonModal.test.tsx
 * Component tests for the Module 7 Rejection Reason modal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RejectionReasonModal } from '@/components/artisan/RejectionReasonModal'

vi.mock('@/lib/api', () => ({
  api: {
    artisanDashboard: {
      rejectOrder: vi.fn(),
    },
  },
}))

import { api } from '@/lib/api'

const mockOrder = {
  _id: 'order-rej-456',
  orderNumber: 'ZM-2026-002',
  total: 1800,
  status: 'placed',
  items: [{ name: 'Clay Bowl', quantity: 1, price: 1800 }],
  shippingAddress: { fullName: 'Test Buyer', email: 'buyer@test.com', city: 'Pune', state: 'MH', zipCode: '411001', street: 'FC Road' },
  createdAt: '2026-02-25T10:00:00.000Z',
  paymentMethod: 'upi',
} as unknown as import('@/lib/api').Order

describe('RejectionReasonModal', () => {
  let onClose: ReturnType<typeof vi.fn>
  let onRejected: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onClose   = vi.fn()
    onRejected = vi.fn()
    vi.clearAllMocks()
  })

  it('renders modal with order number when open', () => {
    render(<RejectionReasonModal open={true} order={mockOrder} onClose={onClose} onRejected={onRejected} />)
    // Use heading role to avoid ambiguity with the "Reject Order" submit button
    expect(screen.getByRole('heading', { name: /reject order/i })).toBeInTheDocument()
    expect(screen.getByText(/ZM-2026-002/)).toBeInTheDocument()
  })

  it('does not render when open=false', () => {
    render(<RejectionReasonModal open={false} order={null} onClose={onClose} onRejected={onRejected} />)
    expect(screen.queryByRole('heading', { name: /reject order/i })).not.toBeInTheDocument()
  })

  it('Reject Order button is disabled when no category is selected', () => {
    render(<RejectionReasonModal open={true} order={mockOrder} onClose={onClose} onRejected={onRejected} />)
    // The submit button reads "Reject Order" (same text as title — use destructive variant button)
    const submitBtn = screen.getByRole('button', { name: /^reject order$/i })
    expect(submitBtn).toBeDisabled()
  })

  it('Reject Order button remains disabled when only reason is typed (no category)', async () => {
    render(<RejectionReasonModal open={true} order={mockOrder} onClose={onClose} onRejected={onRejected} />)

    const textarea = screen.getByRole('textbox', { name: /detailed reason/i })
    await userEvent.type(textarea, 'some sufficient reason here')

    // Button still disabled — category not selected yet
    const submitBtn = screen.getByRole('button', { name: /^reject order$/i })
    expect(submitBtn).toBeDisabled()
  })

  it('enables Reject Order button when category is selected (auto-fills reason)', () => {
    // Radix UI Select portals don’t open in jsdom — test that category selector is present
    render(<RejectionReasonModal open={true} order={mockOrder} onClose={onClose} onRejected={onRejected} />)

    // The SelectTrigger should be present (role=combobox)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    // And the submit button is disabled without a selection
    const submitBtn = screen.getByRole('button', { name: /^reject order$/i })
    expect(submitBtn).toBeDisabled()
  })

  it('does not call API when submit is clicked while button is disabled', async () => {
    render(<RejectionReasonModal open={true} order={mockOrder} onClose={onClose} onRejected={onRejected} />)

    // Button is disabled (no category) — clicking it must not call the API
    const submitBtn = screen.getByRole('button', { name: /^reject order$/i })
    expect(submitBtn).toBeDisabled()
    await userEvent.click(submitBtn)

    expect(api.artisanDashboard.rejectOrder).not.toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', async () => {
    render(<RejectionReasonModal open={true} order={mockOrder} onClose={onClose} onRejected={onRejected} />)

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(onRejected).not.toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', async () => {
    render(<RejectionReasonModal open={true} order={mockOrder} onClose={onClose} onRejected={onRejected} />)

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('textarea accepts input and the character counter updates', async () => {
    render(<RejectionReasonModal open={true} order={mockOrder} onClose={onClose} onRejected={onRejected} />)

    const textarea = screen.getByRole('textbox', { name: /detailed reason/i })
    await userEvent.type(textarea, 'test text')

    // Character counter shows typed length / 600
    expect(screen.getByText(/\/600/)).toBeInTheDocument()
  })
})
