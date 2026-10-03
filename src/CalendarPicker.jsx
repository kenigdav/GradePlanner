import { useState, useEffect, useCallback, useMemo } from 'react'
import { useCalendar } from './CalendarContext'
import { calendarsApi, invitesApi } from './api'
import './CalendarPicker.css'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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

  const monthLabel = now.toLocaleDateString('en-US', { month: 'short' })
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="cal-tile-month" aria-hidden="true">
      <div className="cal-tile-month-label">{monthLabel}</div>
      <div className="cal-tile-weekdays">
        {WEEKDAYS.map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="cal-tile-days">
        {cells.map((day, i) => {
          if (day == null) return <span key={`e-${i}`} className="cal-tile-day cal-tile-day--empty" />
          const key = toDateKey(year, month, day)
          const hasWork = dateSet.has(key)
          const isToday = key === todayKey
          return (
            <span
              key={key}
              className={[
                'cal-tile-day',
                hasWork ? 'cal-tile-day--busy' : '',
                isToday ? 'cal-tile-day--today' : '',
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

function CalendarTile({
  variant,
  name,
  subtitle,
  previewDates,
  busy,
  onOpen,
  onAccept,
  onDecline,
}) {
  const isPending = variant === 'pending'
  const surface = (
    <div className={`cal-tile-surface cal-tile-surface--${variant}`}>
      <header className="cal-tile-header">
        <h3 className="cal-tile-name">{name}</h3>
        {subtitle && <p className="cal-tile-sub">{subtitle}</p>}
      </header>
      <MiniMonthPreview previewDates={previewDates || []} />
      <span className={`cal-tile-badge cal-tile-badge--${variant}`}>
        {isPending ? 'Invite' : 'Joined'}
      </span>
    </div>
  )

  return (
    <li className={`cal-tile cal-tile--${variant}`}>
      {isPending ? (
        surface
      ) : (
        <button type="button" className="cal-tile-open" onClick={onOpen} aria-label={`Open ${name}`}>
          {surface}
        </button>
      )}

      {isPending && (
        <div className="cal-tile-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onAccept}>
            {busy ? 'Joining…' : 'Accept'}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onDecline}>
            Decline
          </button>
        </div>
      )}
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
      setJoinSuccess(`Created “${trimmed}”. Open it from your calendars below.`)
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
          ? `You're already in ${calendar.name}. Open it below.`
          : `Joined ${calendar.name}. Open it below.`
      )
    } catch (err) {
      setJoinError(err.message || 'Failed to join with that code')
    } finally {
      setJoining(false)
    }
  }

  const handleAccept = async (invite) => {
    setInviteActionId(invite.id)
    setInviteError('')
    try {
      await invitesApi.accept(invite.token)
      await refreshCalendars()
      await loadPending()
      setJoinSuccess(`Joined ${invite.calendarName}. Open it below.`)
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

  const showGrid = pendingInvites.length > 0 || calendars.length > 0 || invitesLoading || loading

  return (
    <div className="calendar-picker">
      <h1>Your calendars</h1>
      <p className="calendar-picker-hint">
        Open a joined calendar, or accept an invite. Create one or join with a code anytime.
      </p>

      {inviteError && <p className="calendar-picker-error">{inviteError}</p>}
      {error && <p className="calendar-picker-error">{error}</p>}
      {joinSuccess && <p className="calendar-picker-success">{joinSuccess}</p>}

      {showGrid && (
        <section className="calendar-picker-gallery" aria-label="Calendars">
          <div className="calendar-picker-legend" aria-hidden="true">
            <span className="calendar-picker-legend-item calendar-picker-legend-item--joined">Joined</span>
            <span className="calendar-picker-legend-item calendar-picker-legend-item--pending">Invite</span>
          </div>

          {(loading || invitesLoading) && calendars.length === 0 && pendingInvites.length === 0 ? (
            <p className="calendar-picker-loading">Loading calendars...</p>
          ) : (
            <ul className="cal-tile-grid">
              {calendars.map((c) => (
                <CalendarTile
                  key={`joined-${c.id}`}
                  variant="joined"
                  name={c.name}
                  subtitle={c.myRole}
                  previewDates={c.previewDates}
                  onOpen={() => setActiveCalendarId(c.id)}
                />
              ))}
              {pendingInvites.map((inv) => (
                <CalendarTile
                  key={`invite-${inv.id}`}
                  variant="pending"
                  name={inv.calendarName}
                  subtitle={inv.role}
                  previewDates={inv.previewDates}
                  busy={inviteActionId === inv.id}
                  onAccept={() => handleAccept(inv)}
                  onDecline={() => handleDecline(inv)}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {!loading && !invitesLoading && calendars.length === 0 && pendingInvites.length === 0 && (
        <p className="calendar-picker-empty">
          No calendars yet. Create one or join with a code.
        </p>
      )}

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
      </form>

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
