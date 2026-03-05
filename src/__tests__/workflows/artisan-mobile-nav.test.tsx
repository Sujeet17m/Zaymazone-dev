/**
 * artisan-mobile-nav.test.tsx
 *
 * Module 15 — Accessibility & workflow tests for ArtisanMobileBottomNav.
 * Covers rendering, badge display, active-item ARIA, click handlers,
 * and arrow-key keyboard navigation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArtisanMobileBottomNav } from '@/components/artisan/ArtisanMobileBottomNav'
import type { ArtisanSection } from '@/components/artisan/ArtisanSidebar'

// ── Default props helper ──────────────────────────────────────────────────────

function buildProps(overrides: Partial<React.ComponentProps<typeof ArtisanMobileBottomNav>> = {}) {
  return {
    activeSection: 'overview' as ArtisanSection,
    onNavigate:    vi.fn(),
    onMenuOpen:    vi.fn(),
    pendingOrders: 0,
    lowStockCount: 0,
    ...overrides,
  }
}

// ── Render tests ──────────────────────────────────────────────────────────────

describe('ArtisanMobileBottomNav — rendering', () => {
  it('renders exactly 5 navigation buttons', () => {
    render(<ArtisanMobileBottomNav {...buildProps()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
  })

  it('renders all expected labels', () => {
    render(<ArtisanMobileBottomNav {...buildProps()} />)
    expect(screen.getByText('Overview')).toBeTruthy()
    expect(screen.getByText('Orders')).toBeTruthy()
    expect(screen.getByText('Products')).toBeTruthy()
    expect(screen.getByText('Analytics')).toBeTruthy()
    expect(screen.getByText('More')).toBeTruthy()
  })

  it('wraps content in a <nav> with the correct aria-label', () => {
    const { container } = render(<ArtisanMobileBottomNav {...buildProps()} />)
    const nav = container.querySelector('nav')
    expect(nav).toBeTruthy()
    expect(nav!.getAttribute('aria-label')).toBe('Artisan dashboard navigation')
  })

  it('every button has data-nav-item="true" for keyboard routing', () => {
    render(<ArtisanMobileBottomNav {...buildProps()} />)
    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      expect(btn.getAttribute('data-nav-item')).toBe('true')
    }
  })
})

// ── Active-item ARIA ──────────────────────────────────────────────────────────

describe('ArtisanMobileBottomNav — active section ARIA', () => {
  it('sets aria-current="page" on the active section button', () => {
    render(<ArtisanMobileBottomNav {...buildProps({ activeSection: 'orders' })} />)
    const ordersBtn = screen.getByRole('button', { name: /orders/i })
    expect(ordersBtn.getAttribute('aria-current')).toBe('page')
  })

  it('does NOT set aria-current on inactive buttons', () => {
    render(<ArtisanMobileBottomNav {...buildProps({ activeSection: 'overview' })} />)
    const ordersBtn = screen.getByRole('button', { name: /^orders/i })
    expect(ordersBtn.getAttribute('aria-current')).toBeNull()
  })

  it('no button has aria-current when activeSection is "analytics"', () => {
    render(<ArtisanMobileBottomNav {...buildProps({ activeSection: 'analytics' })} />)
    const buttons = screen.getAllByRole('button')
    const currentButtons = buttons.filter(b => b.getAttribute('aria-current') === 'page')
    expect(currentButtons).toHaveLength(1)
    expect(currentButtons[0].textContent).toContain('Analytics')
  })
})

// ── Badge display ─────────────────────────────────────────────────────────────

describe('ArtisanMobileBottomNav — badge display', () => {
  it('shows pending orders count badge on the Orders button', () => {
    render(<ArtisanMobileBottomNav {...buildProps({ pendingOrders: 3 })} />)
    // Badge text is rendered as aria-hidden, check aria-label on the button
    const ordersBtn = screen.getByRole('button', { name: /orders, 3 pending/i })
    expect(ordersBtn).toBeTruthy()
  })

  it('shows low stock count badge on the Products button', () => {
    render(<ArtisanMobileBottomNav {...buildProps({ lowStockCount: 7 })} />)
    const productsBtn = screen.getByRole('button', { name: /products, 7 pending/i })
    expect(productsBtn).toBeTruthy()
  })

  it('caps displayable badge count at "9+" when value exceeds 9', () => {
    const { container } = render(
      <ArtisanMobileBottomNav {...buildProps({ pendingOrders: 12 })} />,
    )
    // badge span contains "9+" text
    const badgeSpans = container.querySelectorAll('.artisan-mobile-nav__badge')
    const badgeTexts = Array.from(badgeSpans).map(s => s.textContent)
    expect(badgeTexts).toContain('9+')
  })

  it('does not render any badge span when counts are zero', () => {
    const { container } = render(
      <ArtisanMobileBottomNav {...buildProps({ pendingOrders: 0, lowStockCount: 0 })} />,
    )
    const badges = container.querySelectorAll('.artisan-mobile-nav__badge')
    expect(badges).toHaveLength(0)
  })
})

// ── Click handlers ────────────────────────────────────────────────────────────

describe('ArtisanMobileBottomNav — click handlers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls onNavigate with "overview" when Overview is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<ArtisanMobileBottomNav {...buildProps({ onNavigate })} />)

    await user.click(screen.getByRole('button', { name: /^overview/i }))
    expect(onNavigate).toHaveBeenCalledWith('overview')
  })

  it('calls onNavigate with "orders" when Orders is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<ArtisanMobileBottomNav {...buildProps({ onNavigate })} />)

    await user.click(screen.getByRole('button', { name: /^orders/i }))
    expect(onNavigate).toHaveBeenCalledWith('orders')
  })

  it('calls onNavigate with "products" when Products is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<ArtisanMobileBottomNav {...buildProps({ onNavigate })} />)

    await user.click(screen.getByRole('button', { name: /^products/i }))
    expect(onNavigate).toHaveBeenCalledWith('products')
  })

  it('calls onMenuOpen (not onNavigate) when More is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onMenuOpen  = vi.fn()
    render(<ArtisanMobileBottomNav {...buildProps({ onNavigate, onMenuOpen })} />)

    await user.click(screen.getByRole('button', { name: /^more/i }))
    expect(onMenuOpen).toHaveBeenCalledTimes(1)
    expect(onNavigate).not.toHaveBeenCalled()
  })
})

// ── Keyboard navigation ────────────────────────────────────────────────────────

describe('ArtisanMobileBottomNav — keyboard navigation', () => {
  it('ArrowRight moves focus to the next button', () => {
    render(<ArtisanMobileBottomNav {...buildProps()} />)
    const buttons = screen.getAllByRole('button')

    // Focus first button and fire ArrowRight
    buttons[0].focus()
    fireEvent.keyDown(buttons[0], { key: 'ArrowRight' })

    expect(document.activeElement).toBe(buttons[1])
  })

  it('ArrowLeft moves focus to the previous button', () => {
    render(<ArtisanMobileBottomNav {...buildProps()} />)
    const buttons = screen.getAllByRole('button')

    buttons[2].focus()
    fireEvent.keyDown(buttons[2], { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(buttons[1])
  })

  it('ArrowRight wraps around from last to first button', () => {
    render(<ArtisanMobileBottomNav {...buildProps()} />)
    const buttons = screen.getAllByRole('button')
    const lastBtn = buttons[buttons.length - 1]

    lastBtn.focus()
    fireEvent.keyDown(lastBtn, { key: 'ArrowRight' })

    expect(document.activeElement).toBe(buttons[0])
  })

  it('ArrowLeft wraps around from first to last button', () => {
    render(<ArtisanMobileBottomNav {...buildProps()} />)
    const buttons = screen.getAllByRole('button')

    buttons[0].focus()
    fireEvent.keyDown(buttons[0], { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(buttons[buttons.length - 1])
  })

  it('ArrowDown behaves the same as ArrowRight', () => {
    render(<ArtisanMobileBottomNav {...buildProps()} />)
    const buttons = screen.getAllByRole('button')

    buttons[0].focus()
    fireEvent.keyDown(buttons[0], { key: 'ArrowDown' })

    expect(document.activeElement).toBe(buttons[1])
  })
})
