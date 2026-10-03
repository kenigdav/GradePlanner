import jwt from 'jsonwebtoken'
import { users, members } from '../data/store.js'

const JWT_SECRET = process.env.JWT_SECRET || 'grade-planner-secret-change-in-production'

export const CALENDAR_ROLES = ['owner', 'editor', 'viewer']
export const INVITE_ROLES = ['editor', 'viewer']

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
    if (user.banned) {
      return res.status(403).json({ error: 'Account has been banned' })
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

export function requireApprovedUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' })
  if (req.user.role === 'pending') {
    return res.status(403).json({ error: 'Account pending approval' })
  }
  next()
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

export function canEditCalendar(membershipRole) {
  return membershipRole === 'owner' || membershipRole === 'editor'
}

export function canManageCalendar(membershipRole) {
  return membershipRole === 'owner'
}

/**
 * Loads membership for calendarId from params/query/body into req.membership.
 */
export function requireCalendarMember(req, res, next) {
  const run = async () => {
    const calendarId =
      req.params.calendarId || req.params.id || req.query.calendarId || req.body?.calendarId
    if (!calendarId) {
      return res.status(400).json({ error: 'calendarId is required' })
    }
    const membership = await members.get(calendarId, req.user.id)
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this calendar' })
    }
    req.calendarId = calendarId
    req.membership = membership
    next()
  }
  run().catch(next)
}

export function requireCalendarRole(...roles) {
  return (req, res, next) => {
    if (!req.membership) {
      return res.status(403).json({ error: 'Calendar membership required' })
    }
    if (!roles.includes(req.membership.role)) {
      return res.status(403).json({ error: 'Insufficient calendar permissions' })
    }
    next()
  }
}
