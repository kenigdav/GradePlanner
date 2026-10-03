import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { calendarsApi } from './api'
import { useAuth } from './AuthContext'

const CalendarContext = createContext(null)

export function CalendarProvider({ children }) {
  const { user, isAdmin } = useAuth()
  const [calendars, setCalendars] = useState([])
  const [activeCalendarId, setActiveCalendarIdState] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastUserIdRef = useRef(null)

  const activeCalendar = calendars.find((c) => c.id === activeCalendarId) || null
  const myRole = activeCalendar?.myRole || null
  // App administrators can manage any calendar they belong to.
  const canEdit = isAdmin || myRole === 'owner' || myRole === 'editor'
  const canManage = isAdmin || myRole === 'owner'

  const setActiveCalendarId = useCallback((id) => {
    setActiveCalendarIdState(id)
  }, [])

  const refreshCalendars = useCallback(async () => {
    if (!user) {
      setCalendars([])
      return []
    }
    setLoading(true)
    setError('')
    try {
      const list = await calendarsApi.list()
      setCalendars(list)
      return list
    } catch (err) {
      setCalendars([])
      if (user.role !== 'pending') {
        setError(err.message || 'Failed to load calendars')
      }
      return []
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    // Clear legacy persisted selection from older builds.
    try {
      localStorage.removeItem('grade-planner-active-calendar')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!user) {
      lastUserIdRef.current = null
      setCalendars([])
      setActiveCalendarIdState(null)
      return
    }
    // On login / account switch, always land on the home screen.
    if (lastUserIdRef.current !== user.id) {
      lastUserIdRef.current = user.id
      setActiveCalendarIdState(null)
    }
    refreshCalendars()
  }, [user, refreshCalendars])

  // Drop stale selection when the active id isn't in the user's calendar list.
  useEffect(() => {
    if (!activeCalendarId) return
    if (loading) return
    if (!calendars.some((c) => c.id === activeCalendarId)) {
      setActiveCalendarId(null)
    }
  }, [activeCalendarId, calendars, loading, setActiveCalendarId])

  const createCalendar = async (name) => {
    const created = await calendarsApi.create(name)
    await refreshCalendars()
    // Stay on home — user opens the calendar by pressing its preview.
    return created
  }

  return (
    <CalendarContext.Provider
      value={{
        calendars,
        activeCalendar,
        activeCalendarId,
        setActiveCalendarId,
        myRole,
        canEdit,
        canManage,
        loading,
        error,
        refreshCalendars,
        createCalendar,
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar() {
  const ctx = useContext(CalendarContext)
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider')
  return ctx
}
