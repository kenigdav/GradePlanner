import React from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from './ErrorBoundary'
import { AuthProvider } from './AuthContext'
import App from './App.jsx'
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML = '<div style="padding:20;font-family:system-ui">No root element. Check index.html.</div>'
} else if (window.location.protocol === 'file:') {
  rootEl.innerHTML = `
    <div style="padding:40px;font-family:system-ui;max-width:400px;margin:0 auto;color:#e8e8ec;background:#18181d;border-radius:10px;margin-top:40px;">
      <h2 style="margin-top:0">Assignment Planner</h2>
      <p>This app must be run through a dev server so it can reach the API.</p>
      <p>From the project folder run: <code style="background:#0f0f12;padding:4px 8px;border-radius:4px;">npm run dev</code> or <code style="background:#0f0f12;padding:4px 8px;border-radius:4px;">npm run dev:all</code></p>
      <p>Then open the <strong>Local</strong> URL shown in the terminal (e.g. http://localhost:5173).</p>
    </div>
  `
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  )
}
