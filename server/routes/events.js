import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { users } from '../data/store.js'
import * as sse from '../lib/sse.js'

const router = Router()

/**
 * GET /api/events
 * SSE stream for real-time updates. Auth via query token (EventSource cannot set Authorization header).
 * Query: ?token=<jwt>
 */
router.get('/', async (req, res, next) => {
  const token = req.query.token
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Provide ?token=...' })
  }
  const decoded = verifyToken(token)
  if (!decoded?.userId) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  let user
  try {
    user = await users.getById(decoded.userId)
  } catch (err) {
    return next(err)
  }
  if (!user) {
    return res.status(401).json({ error: 'User not found' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const unregister = sse.registerClient(res)
  sse.ensurePingInterval()

  const onClose = () => {
    unregister()
    sse.maybeStopPingInterval()
  }

  res.on('close', onClose)
  res.on('error', onClose)
})

export default router
