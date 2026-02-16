/**
 * In-memory SSE broadcaster. Registers client response streams and sends
 * server-sent events when assignments or subjects change.
 */

const clients = new Set()
const PING_INTERVAL_MS = 30000

/**
 * Register an SSE client. res must be an Express response that has been
 * set up for streaming (headers, flush). Call the returned unregister
 * function when the client disconnects.
 * @param {import('express').Response} res
 * @returns {() => void} unregister function
 */
export function registerClient(res) {
  clients.add(res)
  return () => {
    clients.delete(res)
  }
}

/**
 * Broadcast an event to all registered SSE clients.
 * @param {string} type - Event type (e.g. 'assignments.changed', 'subjects.changed')
 * @param {object} [payload] - Optional payload (will be JSON-serialized)
 */
export function broadcast(type, payload = {}) {
  const data = JSON.stringify({ type, ...payload })
  const message = `data: ${data}\n\n`
  for (const res of clients) {
    try {
      res.write(message)
    } catch (err) {
      clients.delete(res)
    }
  }
}

let pingInterval

function startPingInterval() {
  if (pingInterval) return
  pingInterval = setInterval(() => {
    for (const res of clients) {
      try {
        res.write(': ping\n\n')
      } catch {
        clients.delete(res)
      }
    }
  }, PING_INTERVAL_MS)
}

function stopPingInterval() {
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }
}

/**
 * Start the keep-alive ping interval. Call once when the first client is expected.
 */
export function ensurePingInterval() {
  if (clients.size > 0) startPingInterval()
}

/**
 * Stop the keep-alive ping interval when no clients remain.
 */
export function maybeStopPingInterval() {
  if (clients.size === 0) stopPingInterval()
}
