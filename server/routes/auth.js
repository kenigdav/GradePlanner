import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { users } from '../data/store.js'
import { authMiddleware, signToken } from '../middleware/auth.js'

const router = Router()

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }
    const user = await users.getByUsername(username)
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }
    if (user.role === 'pending') {
      return res.status(403).json({ error: 'Account pending approval' })
    }
    if (user.banned) {
      return res.status(403).json({ error: 'Account has been banned' })
    }
    if (!user.passwordHash || typeof user.passwordHash !== 'string') {
      console.error('Login: user missing passwordHash', user.id)
      return res.status(500).json({ error: 'Account configuration error. Please contact an administrator.' })
    }
    const ok = bcrypt.compareSync(password, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }
    const token = signToken({ userId: user.id })
    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Sign in failed. Please try again.' })
  }
})

router.post('/register', async (req, res, next) => {
  try {
    const { fullName, email, username, password } = req.body || {}
    if (!fullName || !email || !username || !password) {
      return res.status(400).json({ error: 'Full name, email, username and password required' })
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
      role: 'pending',
    })
    const token = signToken({ userId: user.id })
    res.status(201).json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.post('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {}
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password required' })
    }
    const user = req.user
    const ok = bcrypt.compareSync(currentPassword, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }
    const passwordHash = bcrypt.hashSync(newPassword, 10)
    await users.update(user.id, { passwordHash })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
