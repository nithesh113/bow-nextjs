'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Production error boundary — wraps the AuthShell so a runtime exception
 * (e.g. hydration mismatch during deploy hot-swap) renders a recoverable
 * panel instead of Chrome's "This page couldn't load".
 *
 * Design rationale: Vercel cold-starts and chunk hashes change during
 * a deploy. If a user opens /register while the bundle hash invalidates
 * mid-render, we'd historically throw past React's error boundary and
 * end up with a blank screen. Wrapping the auth pages catches that.
 */

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class AuthErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (typeof window !== 'undefined') {
      console.error('[AuthErrorBoundary]', error, info?.componentStack)
    }
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        role="alert"
        style={{
          padding: 24,
          margin: 16,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          color: 'var(--text)',
          fontFamily: 'var(--font-inter, sans-serif)',
          maxWidth: 480,
          marginLeft: 'auto',
          marginRight: 'auto',
          marginTop: 32,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Something didn't load
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
          {this.state.error.message || 'An unexpected error occurred.'}
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16 }}>
          Try a hard refresh — Vercel was likely mid-deploy when the page
          was requested.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={this.handleReload}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
}
