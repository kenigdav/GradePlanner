import { useEffect, useRef } from 'react'

const EVENTS_PATH = '/api/events'
const TOKEN_KEY = 'grade-planner-token'
const SUBJECTS_CHANGED_EVENT = 'grade-planner-subjects-changed'

const MIN_RECONNECT_MS = 1000
const MAX_RECONNECT_MS = 30000

/**
 * Subscribe to SSE events for real-time sync.
 * @param {object} options
 * @param {boolean} options.enabled
 * @param {string|null} [options.calendarId] - Only react to events for this calendar (when present)
 * @param {() => void | Promise<void>} options.onAssignmentsChanged
 * @param {() => void} [options.onSubjectsChanged]
 * @param {() => void} [options.onCalendarsChanged]
 * @param {() => void} [options.onReconnect]
 */
export function useRealtimeSync({
  enabled,
  calendarId,
  onAssignmentsChanged,
  onSubjectsChanged,
  onCalendarsChanged,
  onReconnect,
}) {
  const onAssignmentsRef = useRef(onAssignmentsChanged)
  const onSubjectsRef = useRef(onSubjectsChanged)
  const onCalendarsRef = useRef(onCalendarsChanged)
  const onReconnectRef = useRef(onReconnect)
  const calendarIdRef = useRef(calendarId)
  const reconnectAttemptRef = useRef(0)
  const eventSourceRef = useRef(null)
  const timeoutRef = useRef(null)

  onAssignmentsRef.current = onAssignmentsChanged
  onSubjectsRef.current = onSubjectsChanged
  onCalendarsRef.current = onCalendarsChanged
  onReconnectRef.current = onReconnect
  calendarIdRef.current = calendarId

  useEffect(() => {
    if (!enabled) return

    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    const url = `${EVENTS_PATH}?token=${encodeURIComponent(token)}`
    let isFirstConnect = true

    function matchesCalendar(data) {
      if (!data.calendarId) return true
      if (!calendarIdRef.current) return true
      return data.calendarId === calendarIdRef.current
    }

    function connect() {
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.onopen = () => {
        reconnectAttemptRef.current = 0
        if (!isFirstConnect && onReconnectRef.current) {
          onReconnectRef.current()
        }
        isFirstConnect = false
      }

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'calendars.changed') {
            onCalendarsRef.current?.()
            return
          }
          if (!matchesCalendar(data)) return
          if (data.type === 'assignments.changed' && onAssignmentsRef.current) {
            onAssignmentsRef.current()
          } else if (data.type === 'subjects.changed') {
            if (onSubjectsRef.current) {
              onSubjectsRef.current()
            } else {
              window.dispatchEvent(new CustomEvent(SUBJECTS_CHANGED_EVENT))
            }
          }
        } catch (_) {
          // ignore parse errors
        }
      }

      es.onerror = () => {
        es.close()
        eventSourceRef.current = null
        const delay = Math.min(
          MIN_RECONNECT_MS * Math.pow(2, reconnectAttemptRef.current),
          MAX_RECONNECT_MS
        )
        reconnectAttemptRef.current += 1
        timeoutRef.current = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [enabled])
}
