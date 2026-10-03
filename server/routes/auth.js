import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { users, invites as invitesStore, members as membersStore, calendars as calendarsStore } from '../data/store.js'
import { authMiddleware, signToken } from '../middleware/auth.js'

function inviteExpired(invite) {
  if (!invite?.expiresAt) return false
  return new Date(invite.expiresAt).getTime() < Date.now()
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    role: user.role,
  }
}

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
    return res.json({ token, user: publicUser(user) })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Sign in failed. Please try again.' })
  }
})

router.post('/register', async (req, res, next) => {
  try {
    const { fullName, email, username, password, inviteToken } = req.body || {}
    if (!fullName || !email || !username || !password) {
      return res.status(400).json({ error: 'Full name, email, username and password required' })
    }
    if (await users.getByUsername(username)) {
      return res.status(400).json({ error: 'Username already taken' })
    }
    const normalizedEmail = email.trim().toLowerCase()
    if (await users.getByEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    let invite = null
    if (inviteToken) {
      invite = await invitesStore.getByToken(String(inviteToken).trim())
      if (!invite || invite.status !== 'pending' || inviteExpired(invite)) {
        return res.status(400).json({ error: 'Invite is invalid or expired' })
      }
      if (invite.email.toLowerCase() !== normalizedEmail) {
        return res.status(400).json({ error: `Register with the invited email (${invite.email})` })
      }
    }

    const passwordHash = bcrypt.hashSync(password, 10)
    const user = await users.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      username: username.trim(),
      passwordHash,
      role: invite ? 'viewer' : 'pending',
    })

    let acceptedCalendar = null
    if (invite) {
      await membersStore.add({
        calendarId: invite.calendarId,
        userId: user.id,
        role: invite.role,
      })
      await invitesStore.update(invite.id, { status: 'accepted' })
      const calendar = await calendarsStore.getById(invite.calendarId)
      if (calendar) acceptedCalendar = { ...calendar, myRole: invite.role }
    }

    const token = signToken({ userId: user.id })
    res.status(201).json({
      token,
      user: publicUser(user),
      acceptedCalendar,
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
