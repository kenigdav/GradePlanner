import { Router } from 'express'
import { assignments as assignmentsStore } from '../data/store.js'
import { authMiddleware, requireRole, canEditAssignments } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, (req, res) => {
  res.json(assignmentsStore.getAll())
})

router.post('/', authMiddleware, requireRole('contributor', 'administrator'), (req, res) => {
  const body = req.body || {}
  const assignment = assignmentsStore.create({
    date: body.date,
    subject: body.subject,
    description: body.description || '',
    images: body.images || [],
    createdByUserId: req.user.id,
    createdByName: req.user.fullName || req.user.username || 'Unknown',
  })
  res.status(201).json(assignment)
})

router.patch('/:id', authMiddleware, requireRole('contributor', 'administrator'), (req, res) => {
  const { id } = req.params
  const existing = assignmentsStore.getAll().find((a) => a.id === id)
  if (!existing) {
    return res.status(404).json({ error: 'Assignment not found' })
  }
  const updates = req.body || {}
  const allowed = ['date', 'subject', 'description', 'images']
  const patch = {}
  for (const k of allowed) {
    if (updates[k] !== undefined) patch[k] = updates[k]
  }
  const updated = assignmentsStore.update(id, patch)
  res.json(updated)
})

router.delete('/:id', authMiddleware, requireRole('contributor', 'administrator'), (req, res) => {
  const { id } = req.params
  const existing = assignmentsStore.getAll().find((a) => a.id === id)
  if (!existing) {
    return res.status(404).json({ error: 'Assignment not found' })
  }
  assignmentsStore.delete(id)
  res.status(204).send()
})

export default router
