/**
 * ErrorBoundary.tsx — Module 15: Production Error Safety Net
 *
 * React class component that catches render-phase errors and prevents the
 * entire app from unmounting. Integrates with the monitoring utility so
 * production errors are forwarded to the configured reporting endpoint.
 *
 * Usage (App.tsx):
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * Custom fallback:
 *   <ErrorBoundary fallback={<MyErrorPage />}>
 *     ...
 *   </ErrorBoundary>
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '@/lib/monitoring'

// ── Props / State ─────────────────────────────────────────────────────────────

interface Props {
  /** Content to render when no error has occurred. */
  children: ReactNode
  /** Optional custom fallback UI shown when an error is caught. */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

// ── Component ─────────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  /** Called during rendering when a descendant throws. */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  /** Called after the error is committed — ideal place to log/report. */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, {
      componentStack: info.componentStack ?? undefined,
      type: 'ReactErrorBoundary',
    })
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, error: undefined })
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center bg-background"
        >
          <div className="rounded-full bg-destructive/10 p-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-destructive"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-foreground">
            Something went wrong
          </h1>

          <p className="max-w-md text-muted-foreground">
            An unexpected error occurred. The issue has been reported. Please
            reload the page or try again later.
          </p>

          {this.state.error && import.meta.env.DEV && (
            <pre className="max-w-xl overflow-auto rounded bg-muted p-4 text-left text-xs text-muted-foreground">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}

          <button
            type="button"
            onClick={this.handleReload}
            className="mt-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
