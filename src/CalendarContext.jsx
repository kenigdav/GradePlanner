import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { calendarsApi } from './api'
import { useAuth } from './AuthContext'

const CalendarContext = createContext(null)
const ACTIVE_KEY = 'grade-planner-active-calendar'

export function CalendarProvider({ children }) {
  const { user } = useAuth()
  const [calendars, setCalendars] = useState([])
  const [activeCalendarId, setActiveCalendarIdState] = useState(() => localStorage.getItem(ACTIVE_KEY) || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activeCalendar = calendars.find((c) => c.id === activeCalendarId) || null
  const myRole = activeCalendar?.myRole || null
  const canEdit = myRole === 'owner' || myRole === 'editor'
  const canManage = myRole === 'owner'

  const setActiveCalendarId = useCallback((id) => {
    setActiveCalendarIdState(id)
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  }, [])

  const refreshCalendars = useCallback(async () => {
    if (!user) {
      setCalendars([])
      return []
    }
    // Do not gate on local pending role — invite accept upgrades the user on the
    // server first, and React state may still say pending for one render.
    setLoading(true)
    setError('')
    try {
      const list = await calendarsApi.list()
      setCalendars(list)
      const stored = localStorage.getItem(ACTIVE_KEY)
      if (stored && list.some((c) => c.id === stored)) {
        setActiveCalendarIdState(stored)
      } else if (list.length === 1) {
        setActiveCalendarId(list[0].id)
      } else if (stored && !list.some((c) => c.id === stored)) {
        setActiveCalendarId(null)
      }
      return list
    } catch (err) {
      // Pending users without membership get 403 — treat as empty list
      setCalendars([])
      if (user.role !== 'pending') {
        setError(err.message || 'Failed to load calendars')
      }
      return []
    } finally {
      setLoading(false)
    }
  }, [user, setActiveCalendarId])

  useEffect(() => {
    if (!user) {
      setCalendars([])
      setActiveCalendarIdState(null)
      localStorage.removeItem(ACTIVE_KEY)
      return
    }
    refreshCalendars()
  }, [user, refreshCalendars])

  // Drop stale selection when the active id isn't in the user's calendar list
  useEffect(() => {
    if (!activeCalendarId) return
    if (loading) return
    if (calendars.length === 0) {
      setActiveCalendarId(null)
      return
    }
    if (!calendars.some((c) => c.id === activeCalendarId)) {
      setActiveCalendarId(null)
    }
  }, [activeCalendarId, calendars, loading, setActiveCalendarId])

  const createCalendar = async (name) => {
    const created = await calendarsApi.create(name)
    await refreshCalendars()
    setActiveCalendarId(created.id)
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
