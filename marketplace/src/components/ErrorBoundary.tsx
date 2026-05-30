'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary — prevents entire app from crashing if one component fails.
 * Catches rendering errors, logs them, shows fallback UI.
 * Wrap around route segments or feature areas.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In production: never expose stack traces to browser console (visible to all users).
    // Send sanitized report to backend observability endpoint silently.
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
      // Full detail only in local dev
      console.error('[ErrorBoundary]', error, errorInfo);
    }

    // Fire-and-forget to backend — doesn't block UI recovery
    fetch('/api/v1/observability/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,         // No stack — avoids leaking internal paths
        component_stack: isDev ? errorInfo.componentStack : undefined,
        url: typeof window !== 'undefined' ? window.location.pathname : '',
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => { /* observability failure must never crash the app */ });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <h2 style={{ marginBottom: '1rem' }}>Something went wrong</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            This section encountered an error. The rest of the app is still working.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid #ccc',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
