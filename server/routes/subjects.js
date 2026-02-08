import { Router } from 'express'
import { subjects } from '../data/store.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, (req, res) => {
  res.json(subjects.getAll())
})

router.post('/', authMiddleware, requireRole('administrator'), (req, res) => {
  const { subject } = req.body || {}
  const name = (subject != null && String(subject).trim()) || ''
  if (!name) {
    return res.status(400).json({ error: 'Subject name is required' })
  }
  const added = subjects.add(name)
  if (!added) {
    return res.status(409).json({ error: 'Subject already exists' })
  }
  res.status(201).json(subjects.getAll())
})

router.delete('/', authMiddleware, requireRole('administrator'), (req, res) => {
  const { subject } = req.body || {}
  const name = (subject != null && String(subject).trim()) || ''
  if (!name) {
    return res.status(400).json({ error: 'Subject name is required' })
  }
  const removed = subjects.remove(name)
  if (!removed) {
    return res.status(404).json({ error: 'Subject not found' })
  }
  res.json(subjects.getAll())
})

export default router
