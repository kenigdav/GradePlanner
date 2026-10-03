import { useState } from 'react'
import { useAuth } from './AuthContext'
import './Auth.css'

export function Register({ onSwitchToLogin, inviteToken, inviteEmail, onRegistered }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState(inviteEmail || '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await register(fullName, email, username, password, inviteToken || undefined)
      onRegistered?.(result)
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>Assignment Planner</h1>
      <h2>Register</h2>
      <p className="auth-hint">
        {inviteToken
          ? 'Create your account to accept the calendar invite. Use the invited email address.'
          : 'Your account will be pending until approved by a contributor or administrator.'}
      </p>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <p className="auth-error">{error}</p>}
        <label>
          <span>Full name</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            readOnly={!!inviteEmail}
          />
        </label>
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
            autoComplete="new-password"
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account?{' '}
        <button type="button" className="btn-link" onClick={onSwitchToLogin}>
          Sign in
        </button>
      </p>
    </div>
  )
}
