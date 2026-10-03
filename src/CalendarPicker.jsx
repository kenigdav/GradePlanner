import { useState, useEffect, useCallback } from 'react'
import { useCalendar } from './CalendarContext'
import { calendarsApi, invitesApi } from './api'
import './CalendarPicker.css'

function formatPreviewDate(dateStr) {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function CalendarPicker() {
  const { calendars, createCalendar, setActiveCalendarId, loading, error, refreshCalendars } = useCalendar()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState('')
  const [pendingInvites, setPendingInvites] = useState([])
  const [invitesLoading, setInvitesLoading] = useState(true)
  const [inviteActionId, setInviteActionId] = useState(null)
  const [inviteError, setInviteError] = useState('')

  const loadPending = useCallback(async () => {
    setInvitesLoading(true)
    setInviteError('')
    try {
      const list = await invitesApi.listPending()
      setPendingInvites(list)
    } catch (err) {
      setPendingInvites([])
      setInviteError(err.message || 'Failed to load invites')
    } finally {
      setInvitesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  const handleCreate = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    setCreateError('')
    try {
      await createCalendar(trimmed)
      setName('')
    } catch (err) {
      setCreateError(err.message || 'Failed to create calendar')
    } finally {
      setCreating(false)
    }
  }

  const handleJoinCode = async (e) => {
    e.preventDefault()
    const code = joinCode.trim()
    if (!code) return
    setJoining(true)
    setJoinError('')
    setJoinSuccess('')
    try {
      const calendar = await calendarsApi.joinWithCode(code)
      await refreshCalendars()
      setJoinCode('')
      setJoinSuccess(
        calendar.alreadyMember
          ? `You're already in ${calendar.name}.`
          : `Joined ${calendar.name}.`
      )
      if (calendar.id) setActiveCalendarId(calendar.id)
    } catch (err) {
      setJoinError(err.message || 'Failed to join with that code')
    } finally {
      setJoining(false)
    }
  }

  const handleJoin = async (invite) => {
    setInviteActionId(invite.id)
    setInviteError('')
    try {
      const result = await invitesApi.accept(invite.token)
      await refreshCalendars()
      await loadPending()
      if (result.calendar?.id) setActiveCalendarId(result.calendar.id)
    } catch (err) {
      setInviteError(err.message || 'Failed to join calendar')
    } finally {
      setInviteActionId(null)
    }
  }

  const handleDecline = async (invite) => {
    setInviteActionId(invite.id)
    setInviteError('')
    try {
      await invitesApi.decline(invite.token)
      await loadPending()
    } catch (err) {
      setInviteError(err.message || 'Failed to decline invite')
    } finally {
      setInviteActionId(null)
    }
  }

  return (
    <div className="calendar-picker">
      <h1>Your calendars</h1>
      <p className="calendar-picker-hint">
        Create a calendar, invite people by username, or join with a calendar code.
      </p>

      {(pendingInvites.length > 0 || invitesLoading) && (
        <section className="calendar-picker-invites">
          <h2>Invites for you</h2>
          {invitesLoading ? (
            <p className="calendar-picker-loading">Loading invites...</p>
          ) : (
            <ul className="calendar-invite-list">
              {pendingInvites.map((inv) => (
                <li key={inv.id} className="calendar-invite-card">
                  <div className="calendar-invite-card-main">
                    <span className="calendar-invite-name">{inv.calendarName}</span>
                    <span className="calendar-invite-owner">Owner: {inv.ownerName}</span>
                    <span className="calendar-invite-role">Invited as {inv.role}</span>
                  </div>
                  <div className="calendar-invite-preview" aria-label="Calendar preview">
                    {inv.previewAssignments?.length > 0 ? (
                      <ul>
                        {inv.previewAssignments.map((a, i) => (
                          <li key={`${a.date}-${a.subject}-${i}`}>
                            <span className="calendar-invite-preview-date">{formatPreviewDate(a.date)}</span>
                            <span>{a.subject}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="calendar-invite-preview-empty">No upcoming assignments yet</p>
                    )}
                  </div>
                  <div className="calendar-invite-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={inviteActionId === inv.id}
                      onClick={() => handleJoin(inv)}
                    >
                      {inviteActionId === inv.id ? 'Joining…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={inviteActionId === inv.id}
                      onClick={() => handleDecline(inv)}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {inviteError && <p className="calendar-picker-error">{inviteError}</p>}
      {error && <p className="calendar-picker-error">{error}</p>}

      <form className="calendar-picker-create" onSubmit={handleJoinCode}>
        <h2>Join with code</h2>
        <div className="calendar-picker-create-row">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB12CD34"
            aria-label="Calendar join code"
            disabled={joining}
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button type="submit" className="btn btn-primary" disabled={joining || !joinCode.trim()}>
            {joining ? 'Joining…' : 'Join'}
          </button>
        </div>
        {joinError && <p className="calendar-picker-error">{joinError}</p>}
        {joinSuccess && <p className="calendar-picker-success">{joinSuccess}</p>}
      </form>

      {loading ? (
        <p className="calendar-picker-loading">Loading calendars...</p>
      ) : calendars.length === 0 ? (
        <p className="calendar-picker-empty">You don&apos;t have any calendars yet. Create one or join with a code.</p>
      ) : (
        <ul className="calendar-picker-list">
          {calendars.map((c) => (
            <li key={c.id}>
              <button type="button" className="calendar-picker-item" onClick={() => setActiveCalendarId(c.id)}>
                <span className="calendar-picker-item-main">
                  <span className="calendar-picker-item-name">{c.name}</span>
                  {c.joinCode && (
                    <span className="calendar-picker-item-code">Code: {c.joinCode}</span>
                  )}
                </span>
                <span className="calendar-picker-item-role">{c.myRole}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="calendar-picker-create" onSubmit={handleCreate}>
        <h2>Create a calendar</h2>
        <div className="calendar-picker-create-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Period 3 Science"
            aria-label="Calendar name"
            disabled={creating}
          />
          <button type="submit" className="btn btn-primary" disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
        {createError && <p className="calendar-picker-error">{createError}</p>}
      </form>
    </div>
  )
}
