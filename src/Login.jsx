import { useState } from 'react'
import { useAuth } from './AuthContext'
import './Auth.css'

export function Login({ onSwitchToRegister }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      const msg = err.message || 'Login failed'
      const isNetwork = msg === 'Failed to fetch' || msg.includes('NetworkError')
      setError(isNetwork ? 'Cannot reach server. Start the API: in a terminal run "cd server && npm run dev"' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>Assignment Planner</h1>
      <h2>Sign in</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <p className="auth-error">{error}</p>}
        <label>
          <span>Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="auth-switch">
        Don&apos;t have an account?{' '}
        <button type="button" className="btn-link" onClick={onSwitchToRegister}>
          Register
        </button>
      </p>
    </div>
  )
}
