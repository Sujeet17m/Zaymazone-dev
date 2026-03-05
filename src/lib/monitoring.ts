/**
 * monitoring.ts — Module 15: Error Monitoring
 *
 * Lightweight error reporting utility.
 * - In development: logs to console.error with full context.
 * - In production:  sends to a configurable reporting endpoint AND hooks
 *   into window.__SENTRY__ if the Sentry SDK is loaded.
 *
 * Usage:
 *   import { reportError } from '@/lib/monitoring'
 *   reportError(new Error('Something failed'), { userId: '123' })
 */

type ErrorContext = Record<string, unknown>

export interface ErrorReport {
  message:   string
  stack?:    string
  context?:  ErrorContext
  timestamp: string
  url:       string
  userAgent: string
}

/** Send an error to the configured monitoring endpoint. */
export function reportError(error: unknown, context?: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(String(error))

  if (import.meta.env.PROD) {
    const payload: ErrorReport = {
      message:   err.message,
      stack:     err.stack,
      context,
      timestamp: new Date().toISOString(),
      url:       typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    }

    // Hook into Sentry SDK if it is present (loaded via CDN or installed package)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sentry = (window as any).__SENTRY__
    if (sentry?.captureException) {
      sentry.captureException(err, { extra: context })
      return
    }

    // Fallback: POST to VITE_ERROR_REPORTING_URL if configured
    const endpoint = import.meta.env.VITE_ERROR_REPORTING_URL
    if (endpoint) {
      fetch(endpoint, {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        body:      JSON.stringify(payload),
        // keepalive ensures the request continues even if the page is being unloaded
        keepalive: true,
      }).catch(() => {
        // Swallow fetch errors so the error reporter never causes more errors
      })
    }
  } else {
    // Development: rich console output for easy debugging
    console.error('[Monitoring] Unhandled error:', err.message)
    if (context && Object.keys(context).length > 0) {
      console.error('[Monitoring] Context:', context)
    }
    if (err.stack) {
      console.error('[Monitoring] Stack:', err.stack)
    }
  }
}

/**
 * reportUnhandledRejection — attach to window.onunhandledrejection so that
 * promise rejections without a .catch() handler are also captured.
 *
 * Call once in your app entry point:
 *   import { attachGlobalHandlers } from '@/lib/monitoring'
 *   attachGlobalHandlers()
 */
export function attachGlobalHandlers(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    reportError(event.reason, { type: 'unhandledRejection' })
  })

  window.addEventListener('error', (event: ErrorEvent) => {
    reportError(event.error ?? new Error(event.message), {
      type:    'globalError',
      source:  event.filename,
      lineno:  event.lineno,
      colno:   event.colno,
    })
  })
}
