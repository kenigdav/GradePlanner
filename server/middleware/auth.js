import jwt from 'jsonwebtoken'
import { users } from '../data/store.js'

const JWT_SECRET = process.env.JWT_SECRET || 'grade-planner-secret-change-in-production'

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export function authMiddleware(req, res, next) {
  const run = async () => {
    const auth = req.headers.authorization
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    const decoded = verifyToken(token)
    if (!decoded?.userId) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    const user = await users.getById(decoded.userId)
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }
    await users.update(user.id, { lastSeenAt: new Date().toISOString() })
    req.user = await users.getById(user.id)
    next()
  }
  run().catch(next)
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}

export function canEditAssignments(role) {
  return role === 'contributor' || role === 'administrator'
}

export function canManageUsers(role) {
  return role === 'contributor' || role === 'administrator'
}

export function canChangeAnyUserRole(role) {
  return role === 'administrator'
}
