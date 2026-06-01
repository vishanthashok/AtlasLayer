"use client";

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          display: 'grid',
          placeItems: 'center',
          height: '100%',
          color: '#fca5a5',
          fontSize: '0.82rem',
          padding: '24px',
          textAlign: 'center',
          gap: 8,
        }}>
          <div style={{ fontWeight: 600 }}>Something went wrong</div>
          <div style={{ opacity: 0.7, maxWidth: 400 }}>{this.state.message}</div>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{
              marginTop: 8,
              padding: '6px 12px',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 4,
              color: '#fca5a5',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
