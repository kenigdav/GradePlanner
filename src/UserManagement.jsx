import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { usersApi } from './api'
import './UserManagement.css'

const ROLES = [
  { value: 'pending', label: 'Pending' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'administrator', label: 'Administrator' },
]

const ONLINE_MS = 5 * 60 * 1000 // 5 minutes

function isUserOnline(user, me) {
  if (user.id === me?.id) return true
  if (!user.lastSeenAt) return false
  return Date.now() - new Date(user.lastSeenAt).getTime() < ONLINE_MS
}

export function UserManagement({ onClose }) {
  const { user: me, canChangeRoles, isAdmin, isContributor } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ fullName: '', email: '', username: '', password: '', role: 'viewer' })

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const list = await usersApi.list()
      setUsers(list)
    } catch (err) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleUpdateRole = async (userId, role) => {
    try {
      await usersApi.updateRole(userId, role)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to update role')
    }
  }

  const handleBan = async (userId, banned) => {
    try {
      await usersApi.updateBan(userId, banned)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to update ban status')
    }
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    setError('')
    const role = canChangeRoles ? addForm.role : 'viewer'
    try {
      await usersApi.create(addForm.fullName, addForm.email, addForm.username, addForm.password, role)
      setShowAdd(false)
      setAddForm({ fullName: '', email: '', username: '', password: '', role: 'viewer' })
      await load()
    } catch (err) {
      setError(err.message || 'Failed to add user')
    }
  }

  const canChangeThisUser = (u) => {
    if (u.id === me?.id) return false
    if (canChangeRoles) return true
    return u.role === 'pending'
  }

  return (
    <div className="user-management">
      <div className="user-management-header">
        <h2>{isAdmin ? 'User management' : isContributor ? 'Approve viewers' : 'Users'}</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">×</button>
      </div>
      {canChangeRoles && (
        <button type="button" className="btn btn-primary btn-add-user" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : 'Add user'}
        </button>
      )}
      {showAdd && (
        <form className="user-management-add" onSubmit={handleAddUser}>
          <label><span>Full name</span><input value={addForm.fullName} onChange={(e) => setAddForm((f) => ({ ...f, fullName: e.target.value }))} required /></label>
          <label><span>Email</span><input type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} required /></label>
          <label><span>Username</span><input value={addForm.username} onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))} required /></label>
          <label><span>Password</span><input type="password" value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} required /></label>
          {canChangeRoles && (
            <label>
              <span>Role</span>
              <select value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="viewer">Viewer</option>
                <option value="contributor">Contributor</option>
                <option value="administrator">Administrator</option>
              </select>
            </label>
          )}
          <button type="submit" className="btn btn-primary">Add user</button>
        </form>
      )}
      {error && <p className="user-management-error">{error}</p>}
      {loading ? (
        <p className="user-management-loading">Loading users...</p>
      ) : (
        <div className="user-management-list">
          {users.map((u) => (
            <div key={u.id} className={`user-management-row ${u.banned ? 'user-management-row--banned' : ''}`}>
              <div className="user-management-info">
                <span className="user-management-name">
                  <span
                    className={`user-management-status-dot ${isUserOnline(u, me) ? 'user-management-status-dot--online' : 'user-management-status-dot--offline'}`}
                    title={isUserOnline(u, me) ? 'Online' : 'Offline'}
                    aria-hidden
                  />
                  {u.fullName}
                </span>
                <span className="user-management-meta">{u.username} · {u.email}</span>
                {u.banned && <span className="user-management-badge user-management-badge--banned">Banned</span>}
              </div>
              <div className="user-management-actions">
                <div className="user-management-role">
                {canChangeThisUser(u) ? (
                  canChangeRoles ? (
                    <select
                      value={u.role}
                      onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleUpdateRole(u.id, 'viewer')}
                    >
                      Approve as viewer
                    </button>
                  )
                ) : (
                  <span className="user-management-role-label">{ROLES.find((r) => r.value === u.role)?.label ?? u.role}</span>
                )}
                </div>
                {isAdmin && u.id !== me?.id && (
                  <button
                    type="button"
                    className={`btn btn-sm ${u.banned ? 'btn-unban' : 'btn-ban'}`}
                    onClick={() => handleBan(u.id, !u.banned)}
                  >
                    {u.banned ? 'Unban' : 'Ban'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
