import { useState, useEffect } from 'react'
import { calendarsApi } from './api'
import { useAuth } from './AuthContext'
import { useCalendar } from './CalendarContext'
import './CalendarMembers.css'

const ROLE_OPTIONS = ['owner', 'editor', 'viewer']
const INVITE_ROLES = ['editor', 'viewer']

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
  const [copied, setCopied] = useState(false)

  const calendarId = activeCalendar?.id || activeCalendarId
  const joinCode = activeCalendar?.joinCode || ''

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

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!calendarId) return
    const cleaned = username.trim().replace(/^@+/, '')
    if (!cleaned) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const result = await calendarsApi.addMember(calendarId, cleaned, addRole)
      const label = result.user?.username || result.invitedUsername || cleaned
      setSuccess(result.message || `Invite sent to @${label}. They can accept on their home screen.`)
      setUsername('')
      await load()
    } catch (err) {
      setError(err.message || 'Failed to invite member')
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

  const handleKick = async (member) => {
    const label = member.user?.fullName || member.user?.username || 'this member'
    if (!window.confirm(`Kick ${label} out of this calendar?`)) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await calendarsApi.removeMember(calendarId, member.userId)
      setSuccess(`Removed ${label} from the calendar.`)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to kick member')
    } finally {
      setBusy(false)
    }
  }

  const handleLeave = async () => {
    if (!window.confirm('Leave this calendar?')) return
    setBusy(true)
    setError('')
    try {
      await calendarsApi.removeMember(calendarId, user.id)
      await refreshCalendars()
      setActiveCalendarId(null)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to leave calendar')
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

  const copyJoinCode = async () => {
    if (!joinCode) return
    try {
      await navigator.clipboard.writeText(joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
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

      {joinCode && (
        <section className="calendar-members-section calendar-members-code">
          <div className="calendar-members-section-head">
            <h3>Join code</h3>
            <p>Anyone signed in can enter this code on the home screen to join as a viewer.</p>
          </div>
          <div className="calendar-members-code-row">
            <code className="calendar-members-code-value">{joinCode}</code>
            <button type="button" className="btn btn-sm btn-ghost" onClick={copyJoinCode}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </section>
      )}

      {error && <p className="calendar-members-error" role="alert">{error}</p>}
      {success && <p className="calendar-members-success" role="status">{success}</p>}

      <section className="calendar-members-section">
        <div className="calendar-members-section-head">
          <h3>People in this calendar</h3>
        </div>
        {loading ? (
          <p className="calendar-members-loading">Loading members...</p>
        ) : members.length === 0 ? (
          <p className="calendar-members-empty">No members yet.</p>
        ) : (
          <ul className="calendar-members-list">
            {members.map((m) => {
              const isSelf = m.userId === user.id
              const canKick = canManage && !isSelf
              return (
                <li
                  key={m.userId}
                  className={`calendar-members-row ${isSelf ? 'calendar-members-row--self' : ''} ${m.role === 'owner' ? 'calendar-members-row--owner' : ''}`}
                >
                  <div className="calendar-members-info">
                    <span className="calendar-members-name">
                      {m.user?.fullName || m.user?.username || 'Unknown'}
                      {isSelf ? ' (you)' : ''}
                    </span>
                    <span className="calendar-members-meta">@{m.user?.username}</span>
                  </div>
                  {canManage ? (
                    <select
                      className="calendar-members-select"
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
                    <span className={`calendar-members-role-badge calendar-members-role-badge--${m.role}`}>
                      {m.role}
                    </span>
                  )}
                  {canKick && (
                    <button
                      type="button"
                      className="btn btn-sm btn-kick"
                      disabled={busy}
                      onClick={() => handleKick(m)}
                    >
                      Kick
                    </button>
                  )}
                  {isSelf && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      disabled={busy}
                      onClick={handleLeave}
                    >
                      Leave
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {canManage && (
        <>
          <section className="calendar-members-section">
            <div className="calendar-members-section-head">
              <h3>Invite by username</h3>
              <p>They’ll see the invite on their home screen and can accept or decline.</p>
            </div>
            <form className="calendar-members-invite" onSubmit={handleInvite}>
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
                <select
                  className="calendar-members-select"
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  disabled={busy}
                  aria-label="Invite role"
                >
                  {INVITE_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button type="submit" className="btn btn-primary" disabled={busy || !username.trim()}>
                  Invite
                </button>
              </div>
            </form>
          </section>

          {invites.length > 0 && (
            <section className="calendar-members-section">
              <div className="calendar-members-section-head">
                <h3>Pending invites</h3>
              </div>
              <ul className="calendar-members-list">
                {invites.map((inv) => (
                  <li key={inv.id} className="calendar-members-row calendar-members-row--pending">
                    <div className="calendar-members-info">
                      <span className="calendar-members-name">{inviteLabel(inv)}</span>
                      <span className="calendar-members-meta">Waiting to accept</span>
                    </div>
                    <span className={`calendar-members-role-badge calendar-members-role-badge--${inv.role}`}>
                      {inv.role}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-kick"
                      disabled={busy}
                      onClick={() => handleRevoke(inv.id)}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
