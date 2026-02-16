import { Router } from 'express'
import { assignments as assignmentsStore } from '../data/store.js'
import { authMiddleware, requireRole, canEditAssignments } from '../middleware/auth.js'
import * as sse from '../lib/sse.js'

const router = Router()

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const list = await assignmentsStore.getAll()
    res.json(list)
  } catch (err) {
    next(err)
  }
})

router.post('/', authMiddleware, requireRole('contributor', 'administrator'), async (req, res, next) => {
  try {
    const body = req.body || {}
    const assignment = await assignmentsStore.create({
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
    sse.broadcast('assignments.changed')
    res.status(201).json(assignment)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', authMiddleware, requireRole('contributor', 'administrator'), async (req, res, next) => {
  try {
    const { id } = req.params
    const all = await assignmentsStore.getAll()
    const existing = all.find((a) => a.id === id)
    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' })
    }
    const updates = req.body || {}
    const allowed = ['date', 'subject', 'description', 'images', 'videos', 'pdfs', 'links']
    const patch = {}
    for (const k of allowed) {
      if (updates[k] !== undefined) patch[k] = updates[k]
    }
    const updated = await assignmentsStore.update(id, patch)
    sse.broadcast('assignments.changed')
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', authMiddleware, requireRole('contributor', 'administrator'), async (req, res, next) => {
  try {
    const { id } = req.params
    const all = await assignmentsStore.getAll()
    const existing = all.find((a) => a.id === id)
    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' })
    }
    await assignmentsStore.delete(id)
    sse.broadcast('assignments.changed')
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
