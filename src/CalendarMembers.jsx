import { useState, useEffect } from 'react'
import { calendarsApi } from './api'
import { useAuth } from './AuthContext'
import { useCalendar } from './CalendarContext'
import './CalendarMembers.css'

const ROLE_OPTIONS = ['owner', 'editor', 'viewer']
const ADD_ROLES = ['owner', 'editor', 'viewer']

export function CalendarMembers({ onClose }) {
  const { user } = useAuth()
  const { activeCalendar, activeCalendarId, canManage, refreshCalendars, setActiveCalendarId } = useCalendar()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [addRole, setAddRole] = useState('viewer')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const calendarId = activeCalendar?.id || activeCalendarId

  const load = async () => {
    if (!calendarId) return
    setLoading(true)
    setError('')
    try {
      const memberList = await calendarsApi.listMembers(calendarId)
      setMembers(memberList)
      if (canManage) {
        try {
          const inviteList = await calendarsApi.listInvites(calendarId)
          setInvites(inviteList)
        } catch {
          setInvites([])
        }
      } else {
        setInvites([])
      }
    } catch (err) {
      setError(err.message || 'Failed to load members')
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [calendarId, canManage])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!calendarId) return
    const cleaned = username.trim().replace(/^@+/, '')
    if (!cleaned) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const added = await calendarsApi.addMember(calendarId, cleaned, addRole)
      const label = added.user?.username || cleaned
      setSuccess(`Added @${label} as ${addRole}.`)
      setUsername('')
      await load()
      await refreshCalendars()
    } catch (err) {
      setError(err.message || 'Failed to add member')
    } finally {
      setBusy(false)
    }
  }

  const handleRoleChange = async (userId, role) => {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await calendarsApi.updateMemberRole(calendarId, userId, role)
      await load()
      await refreshCalendars()
    } catch (err) {
      setError(err.message || 'Failed to update role')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (userId) => {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await calendarsApi.removeMember(calendarId, userId)
      if (userId === user.id) {
        await refreshCalendars()
        setActiveCalendarId(null)
        onClose()
        return
      }
      await load()
    } catch (err) {
      setError(err.message || 'Failed to remove member')
    } finally {
      setBusy(false)
    }
  }

  const handleRevoke = async (inviteId) => {
    setBusy(true)
    setError('')
    try {
      await calendarsApi.revokeInvite(calendarId, inviteId)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to revoke invite')
    } finally {
      setBusy(false)
    }
  }

  const inviteLabel = (inv) => {
    if (inv.invitedUsername) return `@${inv.invitedUsername}`
    return inv.email || 'Unknown'
  }

  return (
    <div className="calendar-members">
      <div className="calendar-members-header">
        <h2>Members — {activeCalendar?.name}</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">×</button>
      </div>

      {error && <p className="calendar-members-error">{error}</p>}
      {success && <p className="calendar-members-success">{success}</p>}
      {loading ? (
        <p className="calendar-members-loading">Loading...</p>
      ) : (
        <ul className="calendar-members-list">
          {members.map((m) => (
            <li key={m.userId} className="calendar-members-row">
              <div className="calendar-members-info">
                <span className="calendar-members-name">{m.user?.fullName || m.user?.username || 'Unknown'}</span>
                <span className="calendar-members-email">@{m.user?.username}</span>
              </div>
              {canManage ? (
                <select
                  value={m.role}
                  disabled={busy}
                  onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                  aria-label={`Role for ${m.user?.fullName || m.user?.username}`}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              ) : (
                <span className="calendar-members-role">{m.role}</span>
              )}
              {(canManage || m.userId === user.id) && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  disabled={busy}
                  onClick={() => handleRemove(m.userId)}
                >
                  {m.userId === user.id ? 'Leave' : 'Remove'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <>
          <form className="calendar-members-invite" onSubmit={handleAdd}>
            <h3>Add by username</h3>
            <div className="calendar-members-invite-row">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                required
                disabled={busy}
                autoComplete="username"
                aria-label="Username"
              />
              <select value={addRole} onChange={(e) => setAddRole(e.target.value)} disabled={busy}>
                {ADD_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary" disabled={busy || !username.trim()}>
                Add
              </button>
            </div>
            <p className="calendar-members-invite-hint">
              Enter their exact account username (no email). They get access right away.
              Use role <strong>owner</strong> if you want them to administer this calendar.
            </p>
          </form>

          {invites.length > 0 && (
            <div className="calendar-members-pending">
              <h3>Pending invites</h3>
              <ul>
                {invites.map((inv) => (
                  <li key={inv.id}>
                    <span>{inviteLabel(inv)} ({inv.role})</span>
                    <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => handleRevoke(inv.id)}>
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
