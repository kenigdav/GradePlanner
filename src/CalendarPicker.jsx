import { useState, useEffect, useCallback, useMemo } from 'react'
import { useCalendar } from './CalendarContext'
import { calendarsApi, invitesApi } from './api'
import './CalendarPicker.css'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toDateKey(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

function MiniMonthPreview({ previewDates = [] }) {
  const now = useMemo(() => new Date(), [])
  const year = now.getFullYear()
  const month = now.getMonth()
  const todayKey = toDateKey(year, month, now.getDate())
  const dateSet = useMemo(() => new Set(previewDates), [previewDates])

  const monthLabel = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="invite-tile-month" aria-hidden="true">
      <div className="invite-tile-month-label">{monthLabel}</div>
      <div className="invite-tile-weekdays">
        {WEEKDAYS.map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="invite-tile-days">
        {cells.map((day, i) => {
          if (day == null) return <span key={`e-${i}`} className="invite-tile-day invite-tile-day--empty" />
          const key = toDateKey(year, month, day)
          const hasWork = dateSet.has(key)
          const isToday = key === todayKey
          return (
            <span
              key={key}
              className={[
                'invite-tile-day',
                hasWork ? 'invite-tile-day--busy' : '',
                isToday ? 'invite-tile-day--today' : '',
              ].filter(Boolean).join(' ')}
            >
              {day}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function InviteTile({ invite, busy, onAccept, onDecline }) {
  return (
    <li className="invite-tile">
      <div className="invite-tile-surface">
        <header className="invite-tile-header">
          <h3 className="invite-tile-name">{invite.calendarName}</h3>
          <p className="invite-tile-meta">
            {invite.ownerName}
            <span className="invite-tile-dot" aria-hidden="true">·</span>
            <span className="invite-tile-role">{invite.role}</span>
          </p>
        </header>

        <MiniMonthPreview previewDates={invite.previewDates || []} />

        <div className="invite-tile-upcoming">
          {invite.previewAssignments?.length > 0 ? (
            <ul>
              {invite.previewAssignments.slice(0, 3).map((a, i) => (
                <li key={`${a.date}-${a.subject}-${i}`}>
                  <span className="invite-tile-upcoming-date">{formatPreviewDate(a.date)}</span>
                  <span className="invite-tile-upcoming-subject">{a.subject}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="invite-tile-upcoming-empty">No upcoming assignments</p>
          )}
        </div>

        <div className="invite-tile-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={onAccept}
          >
            {busy ? 'Joining…' : 'Accept'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={onDecline}
          >
            Decline
          </button>
        </div>
      </div>
    </li>
  )
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
      const list = await refreshCalendars()
      setJoinCode('')
      setJoinSuccess(
        calendar.alreadyMember
          ? `You're already in ${calendar.name}.`
          : `Joined ${calendar.name}.`
      )
      if (calendar.id && list.some((c) => c.id === calendar.id)) {
        setActiveCalendarId(calendar.id)
      } else if (calendar.id) {
        setJoinError('Joined, but the calendar list did not update. Refresh the page.')
      }
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
      const list = await refreshCalendars()
      await loadPending()
      const id = result.calendar?.id
      if (id && list.some((c) => c.id === id)) {
        setActiveCalendarId(id)
      }
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
            <ul className="invite-tile-grid">
              {pendingInvites.map((inv) => (
                <InviteTile
                  key={inv.id}
                  invite={inv}
                  busy={inviteActionId === inv.id}
                  onAccept={() => handleJoin(inv)}
                  onDecline={() => handleDecline(inv)}
                />
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
