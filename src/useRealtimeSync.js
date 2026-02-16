import { useEffect, useRef } from 'react'

const EVENTS_PATH = '/api/events'
const TOKEN_KEY = 'grade-planner-token'
const SUBJECTS_CHANGED_EVENT = 'grade-planner-subjects-changed'

const MIN_RECONNECT_MS = 1000
const MAX_RECONNECT_MS = 30000

/**
 * Subscribe to SSE events for real-time sync. When assignments or subjects change
 * on the server (e.g. another user), the provided callbacks run.
 * @param {object} options
 * @param {boolean} options.enabled - Only connect when true (e.g. user is logged in)
 * @param {() => void | Promise<void>} options.onAssignmentsChanged - Called when assignments.changed is received
 * @param {() => void} [options.onSubjectsChanged] - Called when subjects.changed is received (default: dispatch custom event)
 * @param {() => void} [options.onReconnect] - Called after reconnecting; use to refetch assignments and subjects
 */
export function useRealtimeSync({ enabled, onAssignmentsChanged, onSubjectsChanged, onReconnect }) {
  const onAssignmentsRef = useRef(onAssignmentsChanged)
  const onSubjectsRef = useRef(onSubjectsChanged)
  const onReconnectRef = useRef(onReconnect)
  const reconnectAttemptRef = useRef(0)
  const eventSourceRef = useRef(null)
  const timeoutRef = useRef(null)

  onAssignmentsRef.current = onAssignmentsChanged
  onSubjectsRef.current = onSubjectsChanged
  onReconnectRef.current = onReconnect

  useEffect(() => {
    if (!enabled) return

    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    const url = `${EVENTS_PATH}?token=${encodeURIComponent(token)}`
    let isFirstConnect = true

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
          // ignore parse errors (e.g. ping comment)
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
