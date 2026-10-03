import { useState } from 'react'
import { useCalendar } from './CalendarContext'
import './CalendarPicker.css'

export function CalendarPicker() {
  const { calendars, createCalendar, setActiveCalendarId, loading, error } = useCalendar()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

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

  return (
    <div className="calendar-picker">
      <h1>Your calendars</h1>
      <p className="calendar-picker-hint">
        Create a calendar for a class or group, then invite people by email and assign them owner, editor, or viewer.
      </p>
      {error && <p className="calendar-picker-error">{error}</p>}
      {loading ? (
        <p className="calendar-picker-loading">Loading calendars...</p>
      ) : calendars.length === 0 ? (
        <p className="calendar-picker-empty">You don&apos;t have any calendars yet. Create one to get started.</p>
      ) : (
        <ul className="calendar-picker-list">
          {calendars.map((c) => (
            <li key={c.id}>
              <button type="button" className="calendar-picker-item" onClick={() => setActiveCalendarId(c.id)}>
                <span className="calendar-picker-item-name">{c.name}</span>
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
