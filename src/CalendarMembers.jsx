import { useState, useEffect } from 'react'
import { calendarsApi } from './api'
import { useAuth } from './AuthContext'
import { useCalendar } from './CalendarContext'
import './CalendarMembers.css'

const ROLE_OPTIONS = ['owner', 'editor', 'viewer']
const INVITE_ROLES = ['editor', 'viewer']

export function CalendarMembers({ onClose }) {
  const { user } = useAuth()
  const { activeCalendar, canManage, refreshCalendars, setActiveCalendarId } = useCalendar()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteMode, setInviteMode] = useState('username')
  const [inviteValue, setInviteValue] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteResult, setInviteResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const calendarId = activeCalendar?.id

  const load = async () => {
    if (!calendarId) return
    setLoading(true)
    setError('')
    try {
      const memberList = await calendarsApi.listMembers(calendarId)
      setMembers(memberList)
      if (canManage) {
        const inviteList = await calendarsApi.listInvites(calendarId)
        setInvites(inviteList)
      } else {
        setInvites([])
      }
    } catch (err) {
      setError(err.message || 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [calendarId, canManage])

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!calendarId || !inviteValue.trim()) return
    setBusy(true)
    setError('')
    setInviteResult(null)
    try {
      const payload =
        inviteMode === 'username'
          ? { username: inviteValue.trim(), role: inviteRole }
          : { email: inviteValue.trim(), role: inviteRole }
      const result = await calendarsApi.createInvite(calendarId, payload)
      setInviteResult(result)
      setInviteValue('')
      await load()
    } catch (err) {
      setError(err.message || 'Failed to send invite')
    } finally {
      setBusy(false)
    }
  }

  const handleRoleChange = async (userId, role) => {
    setBusy(true)
    setError('')
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

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      setInviteResult((prev) => (prev ? { ...prev, copied: true } : prev))
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

      {error && <p className="calendar-members-error">{error}</p>}
      {loading ? (
        <p className="calendar-members-loading">Loading...</p>
      ) : (
        <ul className="calendar-members-list">
          {members.map((m) => (
            <li key={m.userId} className="calendar-members-row">
              <div className="calendar-members-info">
                <span className="calendar-members-name">{m.user?.fullName || m.user?.username || 'Unknown'}</span>
                <span className="calendar-members-email">
                  @{m.user?.username}{m.user?.email ? ` · ${m.user.email}` : ''}
                </span>
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
          <form className="calendar-members-invite" onSubmit={handleInvite}>
            <h3>Invite someone</h3>
            <div className="calendar-members-mode">
              <button
                type="button"
                className={`btn btn-sm ${inviteMode === 'username' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setInviteMode('username'); setInviteValue(''); setInviteResult(null) }}
              >
                Username
              </button>
              <button
                type="button"
                className={`btn btn-sm ${inviteMode === 'email' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setInviteMode('email'); setInviteValue(''); setInviteResult(null) }}
              >
                Email
              </button>
            </div>
            <div className="calendar-members-invite-row">
              <input
                type={inviteMode === 'email' ? 'email' : 'text'}
                value={inviteValue}
                onChange={(e) => setInviteValue(e.target.value)}
                placeholder={inviteMode === 'email' ? 'email@example.com' : 'username'}
                required
                disabled={busy}
                autoComplete={inviteMode === 'email' ? 'email' : 'username'}
              />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} disabled={busy}>
                {INVITE_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary" disabled={busy || !inviteValue.trim()}>
                Invite
              </button>
            </div>
            <p className="calendar-members-invite-hint">
              {inviteMode === 'username'
                ? 'They’ll see a join preview on their home screen after signing in.'
                : 'They’ll get an invite link by email (if email is configured).'}
            </p>
          </form>

          {inviteResult && (
            <div className="calendar-members-invite-result">
              {inviteResult.inviteVia === 'username' || inviteResult.invitedUsername ? (
                <p>{inviteResult.message || `Invite sent to @${inviteResult.invitedUsername}.`}</p>
              ) : inviteResult.emailSent ? (
                <p>Invite email sent to {inviteResult.email}.</p>
              ) : (
                <p>
                  Invite created{inviteResult.emailError ? ` (email not sent: ${inviteResult.emailError})` : ' (email not configured)'}.
                  {inviteResult.inviteUrl ? ' Share this link:' : ''}
                </p>
              )}
              {inviteResult.inviteUrl && (
                <div className="calendar-members-link-row">
                  <code>{inviteResult.inviteUrl}</code>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => copyLink(inviteResult.inviteUrl)}>
                    {inviteResult.copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          )}

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
