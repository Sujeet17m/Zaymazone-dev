/**
 * AcceptOrderModal.test.tsx
 * Component tests for the Module 7 Accept Order modal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AcceptOrderModal } from '@/components/artisan/AcceptOrderModal'
import type { Order } from '@/lib/api'

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    artisanDashboard: {
      acceptOrder: vi.fn(),
    },
  },
}))

import { api } from '@/lib/api'

const mockOrder: Order = {
  _id: 'order-123',
  id: 'order-123',
  orderNumber: 'ZM-2026-001',
  total: 2500,
  subtotal: 2500,
  shippingCost: 0,
  codFee: 0,
  tax: 0,
  status: 'placed',
  paymentStatus: 'pending',
  statusHistory: [],
  items: [{ name: 'Terracotta Vase', quantity: 2, price: 1250, productId: 'prod-123', artisanId: 'artisan-1', image: '' }],
  shippingAddress: { fullName: 'Test Buyer', email: 'buyer@test.com', city: 'Mumbai', state: 'MH', zipCode: '400001', street: '12 MG Rd', phone: '' },
  createdAt: '2026-02-25T10:00:00.000Z',
  paymentMethod: 'cod',
} as unknown as Order

describe('AcceptOrderModal', () => {
  let onClose: ReturnType<typeof vi.fn>
  let onAccepted: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onClose   = vi.fn()
    onAccepted = vi.fn()
    vi.clearAllMocks()
  })

  it('renders the modal when open=true', () => {
    render(<AcceptOrderModal open={true} order={mockOrder} onClose={onClose} onAccepted={onAccepted} />)
    // Use heading role to avoid ambiguity with the button that also reads "Accept Order"
    expect(screen.getByRole('heading', { name: /accept order/i })).toBeInTheDocument()
    expect(screen.getByText(/ZM-2026-001/)).toBeInTheDocument()
  })

  it('does not render content when open=false', () => {
    render(<AcceptOrderModal open={false} order={null} onClose={onClose} onAccepted={onAccepted} />)
    expect(screen.queryByText(/accept order/i)).not.toBeInTheDocument()
  })

  it('calls api.artisanDashboard.acceptOrder when confirmed', async () => {
    vi.mocked(api.artisanDashboard.acceptOrder).mockResolvedValueOnce({ message: 'Order accepted', order: { _id: 'order-123', orderNumber: 'ZM-2026-001', status: 'confirmed', acceptedAt: '' } })

    render(<AcceptOrderModal open={true} order={mockOrder} onClose={onClose} onAccepted={onAccepted} />)

    // Button text is "Accept Order" (with icon + text)
    const confirmBtn = screen.getByRole('button', { name: /accept order/i })
    await userEvent.click(confirmBtn)

    await waitFor(() => {
      expect(api.artisanDashboard.acceptOrder).toHaveBeenCalledWith('order-123', undefined)
    })
  })

  it('passes optional note to acceptOrder when provided', async () => {
    vi.mocked(api.artisanDashboard.acceptOrder).mockResolvedValueOnce({ message: 'ok', order: { _id: 'order-123', orderNumber: 'ZM-2026-001', status: 'confirmed', acceptedAt: '' } })

    render(<AcceptOrderModal open={true} order={mockOrder} onClose={onClose} onAccepted={onAccepted} />)

    const noteInput = screen.getByRole('textbox')
    await userEvent.type(noteInput, 'Will ship tomorrow')

    const confirmBtn = screen.getByRole('button', { name: /accept order/i })
    await userEvent.click(confirmBtn)

    await waitFor(() => {
      expect(api.artisanDashboard.acceptOrder).toHaveBeenCalledWith('order-123', 'Will ship tomorrow')
    })
  })

  it('calls onClose when cancel button is clicked', async () => {
    render(<AcceptOrderModal open={true} order={mockOrder} onClose={onClose} onAccepted={onAccepted} />)

    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    await userEvent.click(cancelBtn)

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows error toast and stays open on API failure', async () => {
    vi.mocked(api.artisanDashboard.acceptOrder).mockRejectedValueOnce(new Error('Server error'))

    render(<AcceptOrderModal open={true} order={mockOrder} onClose={onClose} onAccepted={onAccepted} />)

    const confirmBtn = screen.getByRole('button', { name: /accept order/i })
    await userEvent.click(confirmBtn)

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  it('calls onAccepted callback after successful acceptance', async () => {
    vi.mocked(api.artisanDashboard.acceptOrder).mockResolvedValueOnce({ message: 'ok', order: { _id: 'order-123', orderNumber: 'ZM-2026-001', status: 'confirmed', acceptedAt: '' } })

    render(<AcceptOrderModal open={true} order={mockOrder} onClose={onClose} onAccepted={onAccepted} />)

    await userEvent.click(screen.getByRole('button', { name: /accept order/i }))

    await waitFor(() => {
      expect(onAccepted).toHaveBeenCalledOnce()
    })
  })
})
