/**
 * Production-grade Error Boundary
 * Handles API errors, network issues, and unexpected crashes
 */

import React from 'react';
import { C } from '@/theme/colors';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorCount: number;
}

export class ProductionErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    this.setState(prev => ({
      error,
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    // Call user-provided error handler
    this.props.onError?.(error, errorInfo);

    // Report to analytics/monitoring (TODO: add Sentry integration)
    if (typeof window !== 'undefined') {
      // window.reportError?.({
      //   error: error.message,
      //   stack: error.stack,
      //   context: errorInfo.componentStack,
      // });
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        this.props.fallback || (
          <div
            style={{
              minHeight: '100vh',
              background: C.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            <div
              style={{
                maxWidth: '500px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: '12px',
                padding: '32px',
                textAlign: 'center',
              }}
            >
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '12px' }}>
                Something went wrong
              </h1>

              <p style={{ color: C.textSecondary, marginBottom: '20px', fontSize: '14px' }}>
                We encountered an unexpected error. Please try again or contact support.
              </p>

              {process.env.NODE_ENV === 'development' && (
                <details
                  style={{
                    marginBottom: '20px',
                    padding: '12px',
                    background: C.bg,
                    borderRadius: '8px',
                    textAlign: 'left',
                  }}
                >
                  <summary style={{ cursor: 'pointer', fontWeight: 500, color: C.text }}>
                    Error Details (Development Only)
                  </summary>
                  <pre
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: C.bg,
                      borderRadius: '4px',
                      overflow: 'auto',
                      fontSize: '12px',
                      color: C.textSecondary,
                      maxHeight: '200px',
                    }}
                  >
                    {this.state.error.message}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={this.resetError}
                  style={{
                    padding: '10px 20px',
                    background: C.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Try Again
                </button>

                <button
                  onClick={() => (window.location.href = '/')}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    color: C.primary,
                    border: `1px solid ${C.primary}`,
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Functional error boundary hook (for function components)
// ──────────────────────────────────────────────────────────────────────────────

interface ApiErrorProps {
  error: any | null;
  isLoading?: boolean;
  onRetry?: () => void;
  fallback?: React.ReactNode;
}

export function ApiErrorDisplay({ error, isLoading, onRetry, fallback }: ApiErrorProps) {
  if (!error) return null;

  const errorMessage = error?.message || 'An unknown error occurred';
  const statusCode = error?.status;

  return (
    fallback || (
      <div
        style={{
          padding: '16px',
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#991b1b',
          fontSize: '14px',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '8px' }}>
          {statusCode ? `Error ${statusCode}` : 'Error'}
        </div>
        <div style={{ marginBottom: '12px' }}>{errorMessage}</div>

        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              background: '#991b1b',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {isLoading ? 'Retrying...' : 'Try Again'}
          </button>
        )}
      </div>
    )
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Loading state component
// ──────────────────────────────────────────────────────────────────────────────

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div
        style={{
          width: '16px',
          height: '16px',
          border: `2px solid ${C.border}`,
          borderTopColor: C.primary,
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }}
      />
      <span style={{ color: C.textSecondary, fontSize: '14px' }}>{message}</span>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LoadingSpinner message="Loading..." />
    </div>
  );
}
