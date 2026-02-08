import React from 'react'

export class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          background: '#0f0f12',
          color: '#e8e8ec',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}>
          <div>
            <h1 style={{ marginBottom: 12 }}>Something went wrong</h1>
            <p style={{ color: '#8b8b96', marginBottom: 16 }}>
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                background: '#7c6ef6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
