import { Router } from 'express'
import {
  invites as invitesStore,
  calendars as calendarsStore,
  members as membersStore,
  users as usersStore,
} from '../data/store.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function isExpired(invite) {
  if (!invite.expiresAt) return false
  return new Date(invite.expiresAt).getTime() < Date.now()
}

router.get('/:token', async (req, res, next) => {
  try {
    const invite = await invitesStore.getByToken(req.params.token)
    if (!invite || invite.status !== 'pending') {
      return res.status(404).json({ error: 'Invite not found or no longer valid' })
    }
    if (isExpired(invite)) {
      await invitesStore.update(invite.id, { status: 'revoked' })
      return res.status(410).json({ error: 'This invite has expired' })
    }
    const calendar = await calendarsStore.getById(invite.calendarId)
    if (!calendar) {
      return res.status(404).json({ error: 'Calendar not found' })
    }
    res.json({
      email: invite.email,
      role: invite.role,
      calendarId: invite.calendarId,
      calendarName: calendar.name,
      expiresAt: invite.expiresAt,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/accept', authMiddleware, async (req, res, next) => {
  try {
    const token = (req.body?.token != null && String(req.body.token).trim()) || ''
    if (!token) {
      return res.status(400).json({ error: 'Invite token is required' })
    }
    if (req.user.banned) {
      return res.status(403).json({ error: 'Account has been banned' })
    }

    const invite = await invitesStore.getByToken(token)
    if (!invite || invite.status !== 'pending') {
      return res.status(404).json({ error: 'Invite not found or no longer valid' })
    }
    if (isExpired(invite)) {
      await invitesStore.update(invite.id, { status: 'revoked' })
      return res.status(410).json({ error: 'This invite has expired' })
    }

    if (req.user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return res.status(403).json({
        error: `This invite was sent to ${invite.email}. Sign in with that email to accept.`,
      })
    }

    const calendar = await calendarsStore.getById(invite.calendarId)
    if (!calendar) {
      return res.status(404).json({ error: 'Calendar not found' })
    }

    await membersStore.add({
      calendarId: invite.calendarId,
      userId: req.user.id,
      role: invite.role,
    })
    await invitesStore.update(invite.id, { status: 'accepted' })

    // Invited users should not stay stuck on pending global approval
    if (req.user.role === 'pending') {
      await usersStore.update(req.user.id, { role: 'viewer' })
    }

    const refreshed = await usersStore.getById(req.user.id)
    res.json({
      calendar: { ...calendar, myRole: invite.role },
      user: {
        id: refreshed.id,
        fullName: refreshed.fullName,
        email: refreshed.email,
        username: refreshed.username,
        role: refreshed.role,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
