import { Router } from 'express'
import {
  calendarSubjects,
  members as membersStore,
  calendars as calendarsStore,
} from '../data/store.js'
import {
  authMiddleware,
  requireApprovedUser,
  canManageCalendar,
} from '../middleware/auth.js'
import * as sse from '../lib/sse.js'

const router = Router()

async function loadMembership(req, res) {
  const calendarId = req.query.calendarId || req.body?.calendarId
  if (!calendarId) {
    res.status(400).json({ error: 'calendarId is required' })
    return null
  }
  let membership = await membersStore.get(calendarId, req.user.id)
  if (!membership) {
    const calendar = await calendarsStore.getById(calendarId)
    if (calendar && calendar.createdByUserId === req.user.id) {
      membership = await membersStore.add({
        calendarId,
        userId: req.user.id,
        role: 'owner',
      })
    }
  }
  if (!membership) {
    res.status(403).json({ error: 'You are not a member of this calendar' })
    return null
  }
  return { calendarId, membership }
}

router.get('/', authMiddleware, requireApprovedUser, async (req, res, next) => {
  try {
    const ctx = await loadMembership(req, res)
    if (!ctx) return
    const list = await calendarSubjects.getByCalendar(ctx.calendarId)
    res.json(list)
  } catch (err) {
    next(err)
  }
})

router.post('/', authMiddleware, requireApprovedUser, async (req, res, next) => {
  try {
    const ctx = await loadMembership(req, res)
    if (!ctx) return
    if (!canManageCalendar(ctx.membership.role, req.user)) {
      return res.status(403).json({ error: 'Only calendar owners can manage subjects' })
    }
    const { subject } = req.body || {}
    const name = (subject != null && String(subject).trim()) || ''
    if (!name) {
      return res.status(400).json({ error: 'Subject name is required' })
    }
    const added = await calendarSubjects.add(ctx.calendarId, name)
    if (!added) {
      return res.status(409).json({ error: 'Subject already exists' })
    }
    sse.broadcast('subjects.changed', { calendarId: ctx.calendarId })
    res.status(201).json(await calendarSubjects.getByCalendar(ctx.calendarId))
  } catch (err) {
    next(err)
  }
})

router.delete('/', authMiddleware, requireApprovedUser, async (req, res, next) => {
  try {
    const ctx = await loadMembership(req, res)
    if (!ctx) return
    if (!canManageCalendar(ctx.membership.role, req.user)) {
      return res.status(403).json({ error: 'Only calendar owners can manage subjects' })
    }
    const { subject } = req.body || {}
    const name = (subject != null && String(subject).trim()) || ''
    if (!name) {
      return res.status(400).json({ error: 'Subject name is required' })
    }
    const removed = await calendarSubjects.remove(ctx.calendarId, name)
    if (!removed) {
      return res.status(404).json({ error: 'Subject not found' })
    }
    sse.broadcast('subjects.changed', { calendarId: ctx.calendarId })
    res.json(await calendarSubjects.getByCalendar(ctx.calendarId))
  } catch (err) {
    next(err)
  }
})

export default router
