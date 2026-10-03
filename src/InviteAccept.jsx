import { useEffect, useState } from 'react'
import { invitesApi } from './api'
import { useAuth } from './AuthContext'
import { useCalendar } from './CalendarContext'
import './InviteAccept.css'

function getInviteTokenFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('invite') || ''
  } catch {
    return ''
  }
}

export function clearInviteFromUrl() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('invite')) return
  url.searchParams.delete('invite')
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}

export function InviteAccept({ onNeedAuth }) {
  const { user, updateUser } = useAuth()
  const { setActiveCalendarId, refreshCalendars } = useCalendar()
  const [token] = useState(() => getInviteTokenFromUrl())
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('loading')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('none')
      return
    }
    let cancelled = false
    invitesApi
      .preview(token)
      .then((data) => {
        if (cancelled) return
        setPreview(data)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Invite not found')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (!token || status === 'none') return null

  const handleAccept = async () => {
    if (!user) {
      onNeedAuth?.(token, preview)
      return
    }
    setAccepting(true)
    setError('')
    try {
      const result = await invitesApi.accept(token)
      if (result.user) updateUser(result.user)
      await refreshCalendars()
      if (result.calendar?.id) setActiveCalendarId(result.calendar.id)
      clearInviteFromUrl()
      setStatus('accepted')
    } catch (err) {
      setError(err.message || 'Failed to accept invite')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="invite-accept">
      {status === 'loading' && <p>Loading invite...</p>}
      {status === 'error' && <p className="invite-accept-error">{error}</p>}
      {status === 'accepted' && (
        <p className="invite-accept-ok">You joined {preview?.calendarName || 'the calendar'}.</p>
      )}
      {status === 'ready' && preview && (
        <>
          <h2>Calendar invite</h2>
          <p>
            You&apos;re invited to <strong>{preview.calendarName}</strong> as <strong>{preview.role}</strong>
            {preview.email ? <> (for {preview.email})</> : null}.
          </p>
          {error && <p className="invite-accept-error">{error}</p>}
          <button type="button" className="btn btn-primary" onClick={handleAccept} disabled={accepting}>
            {!user ? 'Sign in to accept' : accepting ? 'Accepting…' : 'Accept invite'}
          </button>
        </>
      )}
    </div>
  )
}

export function readInviteToken() {
  return getInviteTokenFromUrl()
}
