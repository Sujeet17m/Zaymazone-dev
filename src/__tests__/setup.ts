// Frontend test setup — imported automatically before every test file
import '@testing-library/jest-dom'
import React from 'react'
import { vi, beforeAll, afterAll } from 'vitest'

// ── Radix UI / jsdom pointer-events polyfills ────────────────────────────────
// Radix UI components (Select, Popover, etc.) use pointer capture APIs that
// jsdom does not implement. Stub them so component tests don't crash.
window.Element.prototype.hasPointerCapture  ??= vi.fn(() => false) as unknown as (pointerId: number) => boolean
window.Element.prototype.setPointerCapture  ??= vi.fn() as unknown as (pointerId: number) => void
window.Element.prototype.releasePointerCapture ??= vi.fn() as unknown as (pointerId: number) => void
window.Element.prototype.scrollTo           ??= vi.fn() as unknown as () => void
// ResizeObserver is used by some Radix components
if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe()   { /* noop */ }
    unobserve() { /* noop */ }
    disconnect(){ /* noop */ }
  }
}

// ── Global mocks ─────────────────────────────────────────────────────────────

// Mock react-router-dom Link / useNavigate so component renders don't crash
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement('a', { href: to }, children),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
  }
})

// Mock useToast globally so every component test doesn't need to wire a Toaster
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
    dismiss: vi.fn(),
    toasts: [],
  }),
}))

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid', email: 'artisan@test.com', displayName: 'Test Artisan' },
    signOut: vi.fn(),
    loading: false,
  }),
}))

// Suppress console.error noise from component prop-type warnings during tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') || args[0].includes('act('))
    )
      return
    originalError(...args)
  }
})
afterAll(() => {
  console.error = originalError
})
