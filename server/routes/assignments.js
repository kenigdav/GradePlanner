import { Router } from 'express'
import {
  assignments as assignmentsStore,
  members as membersStore,
  calendars as calendarsStore,
} from '../data/store.js'
import {
  authMiddleware,
  requireApprovedUser,
  canEditCalendar,
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
    const list = await assignmentsStore.getByCalendar(ctx.calendarId)
    res.json(list)
  } catch (err) {
    next(err)
  }
})

router.post('/', authMiddleware, requireApprovedUser, async (req, res, next) => {
  try {
    const ctx = await loadMembership(req, res)
    if (!ctx) return
    if (!canEditCalendar(ctx.membership.role)) {
      return res.status(403).json({ error: 'Insufficient calendar permissions' })
    }
    const body = req.body || {}
    const assignment = await assignmentsStore.create({
      calendarId: ctx.calendarId,
      date: body.date,
      subject: body.subject,
      description: body.description || '',
      images: body.images || [],
      videos: body.videos || [],
      pdfs: body.pdfs || [],
      links: body.links || [],
      createdByUserId: req.user.id,
      createdByName: req.user.fullName || req.user.username || 'Unknown',
    })
    sse.broadcast('assignments.changed', { calendarId: ctx.calendarId })
    res.status(201).json(assignment)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', authMiddleware, requireApprovedUser, async (req, res, next) => {
  try {
    const existing = await assignmentsStore.getById(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' })
    }
    if (!existing.calendarId) {
      return res.status(403).json({ error: 'This assignment is not part of a shared calendar' })
    }
    const membership = await membersStore.get(existing.calendarId, req.user.id)
    if (!membership || !canEditCalendar(membership.role)) {
      return res.status(403).json({ error: 'Insufficient calendar permissions' })
    }
    const updates = req.body || {}
    const allowed = ['date', 'subject', 'description', 'images', 'videos', 'pdfs', 'links']
    const patch = {}
    for (const k of allowed) {
      if (updates[k] !== undefined) patch[k] = updates[k]
    }
    const updated = await assignmentsStore.update(req.params.id, patch)
    sse.broadcast('assignments.changed', { calendarId: existing.calendarId })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', authMiddleware, requireApprovedUser, async (req, res, next) => {
  try {
    const existing = await assignmentsStore.getById(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' })
    }
    if (!existing.calendarId) {
      return res.status(403).json({ error: 'This assignment is not part of a shared calendar' })
    }
    const membership = await membersStore.get(existing.calendarId, req.user.id)
    if (!membership || !canEditCalendar(membership.role)) {
      return res.status(403).json({ error: 'Insufficient calendar permissions' })
    }
    await assignmentsStore.delete(req.params.id)
    sse.broadcast('assignments.changed', { calendarId: existing.calendarId })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
