import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { users } from '../data/store.js'
import { authMiddleware, requireRole, canChangeAnyUserRole } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, requireRole('viewer', 'contributor', 'administrator'), async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'administrator'
    let list = await users.getAll()
    if (!isAdmin) {
      list = list.filter((u) => !u.banned)
    }
    const all = list.map((u) => {
      const base = {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        username: u.username,
        role: u.role,
        lastSeenAt: u.lastSeenAt || null,
      }
      if (isAdmin) base.banned = !!u.banned
      return base
    })
    res.json(all)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/role', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params
    const { role } = req.body || {}
    const target = await users.getById(id)
    if (!target) {
      return res.status(404).json({ error: 'User not found' })
    }
    const validRoles = ['pending', 'viewer', 'contributor', 'administrator']
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }
    const me = req.user
    if (canChangeAnyUserRole(me.role)) {
      await users.update(id, { role })
      return res.json(await users.getById(id))
    }
    if (me.role === 'contributor') {
      if (target.role !== 'pending' || role !== 'viewer') {
        return res.status(403).json({ error: 'Contributors can only approve pending users as viewers' })
      }
      await users.update(id, { role: 'viewer' })
      return res.json(await users.getById(id))
    }
    return res.status(403).json({ error: 'Insufficient permissions' })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', authMiddleware, requireRole('administrator'), async (req, res, next) => {
  try {
    const { id } = req.params
    const { banned } = req.body || {}
    if (typeof banned !== 'boolean') {
      return res.status(400).json({ error: 'banned must be true or false' })
    }
    const target = await users.getById(id)
    if (!target) {
      return res.status(404).json({ error: 'User not found' })
    }
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot ban yourself' })
    }
    await users.update(id, { banned })
    const updated = await users.getById(id)
    res.json({
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      username: updated.username,
      role: updated.role,
      banned: !!updated.banned,
    })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', authMiddleware, requireRole('administrator'), async (req, res, next) => {
  try {
    const { id } = req.params
    const target = await users.getById(id)
    if (!target) {
      return res.status(404).json({ error: 'User not found' })
    }
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot remove yourself from the list' })
    }
    await users.delete(id)
    return res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.post('/', authMiddleware, requireRole('contributor', 'administrator'), async (req, res, next) => {
  try {
    const { fullName, email, username, password, role } = req.body || {}
    if (!fullName || !email || !username || !password) {
      return res.status(400).json({ error: 'Full name, email, username and password required' })
    }
    const me = req.user
    const allowedRole = me.role === 'administrator' ? role : 'viewer'
    if (!allowedRole || !['viewer', 'contributor', 'administrator'].includes(allowedRole)) {
      return res.status(400).json({ error: 'Valid role required (viewer, contributor, or administrator)' })
    }
    if (me.role === 'contributor' && allowedRole !== 'viewer') {
      return res.status(403).json({ error: 'Contributors can only add viewers' })
    }
    if (await users.getByUsername(username)) {
      return res.status(400).json({ error: 'Username already taken' })
    }
    if (await users.getByEmail(email)) {
      return res.status(400).json({ error: 'Email already registered' })
    }
    const passwordHash = bcrypt.hashSync(password, 10)
    const user = await users.create({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      username: username.trim(),
      passwordHash,
      role: allowedRole,
      banned: false,
    })
    res.status(201).json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role,
    })
  } catch (err) {
    next(err)
  }
})

export default router
