import { Router } from 'express'
import { subjects } from '../data/store.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import * as sse from '../lib/sse.js'

const router = Router()

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const list = await subjects.getAll()
    res.json(list)
  } catch (err) {
    next(err)
  }
})

router.post('/', authMiddleware, requireRole('administrator'), async (req, res, next) => {
  try {
    const { subject } = req.body || {}
    const name = (subject != null && String(subject).trim()) || ''
    if (!name) {
      return res.status(400).json({ error: 'Subject name is required' })
    }
    const added = await subjects.add(name)
    if (!added) {
      return res.status(409).json({ error: 'Subject already exists' })
    }
    sse.broadcast('subjects.changed')
    res.status(201).json(await subjects.getAll())
  } catch (err) {
    next(err)
  }
})

router.delete('/', authMiddleware, requireRole('administrator'), async (req, res, next) => {
  try {
    const { subject } = req.body || {}
    const name = (subject != null && String(subject).trim()) || ''
    if (!name) {
      return res.status(400).json({ error: 'Subject name is required' })
    }
    const removed = await subjects.remove(name)
    if (!removed) {
      return res.status(404).json({ error: 'Subject not found' })
    }
    sse.broadcast('subjects.changed')
    res.json(await subjects.getAll())
  } catch (err) {
    next(err)
  }
})

export default router
