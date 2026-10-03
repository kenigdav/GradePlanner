import { Router } from 'express'
import {
  invites as invitesStore,
  calendars as calendarsStore,
  members as membersStore,
  users as usersStore,
  assignments as assignmentsStore,
} from '../data/store.js'
import { authMiddleware, requireApprovedUser } from '../middleware/auth.js'

const router = Router()

function isExpired(invite) {
  if (!invite.expiresAt) return false
  return new Date(invite.expiresAt).getTime() < Date.now()
}

function inviteMatchesUser(invite, user) {
  const email = (user.email || '').toLowerCase()
  const username = (user.username || '').toLowerCase()
  if (invite.invitedUsername && invite.invitedUsername.toLowerCase() === username) return true
  if (invite.email && email && invite.email.toLowerCase() === email) return true
  return false
}

async function getOwnerName(calendar) {
  const memberRows = await membersStore.getByCalendar(calendar.id)
  const owners = memberRows.filter((m) => m.role === 'owner')
  const preferred =
    owners.find((m) => m.userId === calendar.createdByUserId) || owners[0] || null
  if (!preferred) {
    const creator = await usersStore.getById(calendar.createdByUserId)
    return creator?.fullName || creator?.username || 'Unknown'
  }
  const u = await usersStore.getById(preferred.userId)
  return u?.fullName || u?.username || 'Unknown'
}

async function buildInvitePreview(invite) {
  const calendar = await calendarsStore.getById(invite.calendarId)
  if (!calendar) return null
  const ownerName = await getOwnerName(calendar)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = (await assignmentsStore.getByCalendar(calendar.id))
    .filter((a) => a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.subject.localeCompare(b.subject))
    .slice(0, 3)
    .map((a) => ({ date: a.date, subject: a.subject }))

  return {
    id: invite.id,
    token: invite.token,
    role: invite.role,
    inviteVia: invite.invitedUsername ? 'username' : 'email',
    invitedUsername: invite.invitedUsername || null,
    email: invite.email || '',
    expiresAt: invite.expiresAt,
    calendarId: calendar.id,
    calendarName: calendar.name,
    ownerName,
    previewAssignments: upcoming,
  }
}

router.get('/pending', authMiddleware, requireApprovedUser, async (req, res, next) => {
  try {
    const list = await invitesStore.getPendingForUser(req.user.email, req.user.username)
    const previews = []
    for (const invite of list) {
      if (isExpired(invite)) {
        await invitesStore.update(invite.id, { status: 'revoked' })
        continue
      }
      const already = await membersStore.get(invite.calendarId, req.user.id)
      if (already) {
        await invitesStore.update(invite.id, { status: 'accepted' })
        continue
      }
      const preview = await buildInvitePreview(invite)
      if (preview) previews.push(preview)
    }
    res.json(previews)
  } catch (err) {
    next(err)
  }
})

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
    const preview = await buildInvitePreview(invite)
    if (!preview) {
      return res.status(404).json({ error: 'Calendar not found' })
    }
    res.json(preview)
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

    if (!inviteMatchesUser(invite, req.user)) {
      const target = invite.invitedUsername
        ? `username ${invite.invitedUsername}`
        : invite.email
      return res.status(403).json({
        error: `This invite was sent to ${target}. Sign in with that account to accept.`,
      })
    }

    const calendar = await calendarsStore.getById(invite.calendarId)
    if (!calendar) {
      return res.status(404).json({ error: 'Calendar not found' })
    }

    const existing = await membersStore.get(invite.calendarId, req.user.id)
    if (!existing) {
      await membersStore.add({
        calendarId: invite.calendarId,
        userId: req.user.id,
        role: invite.role,
      })
    }
    await invitesStore.update(invite.id, { status: 'accepted' })

    if (req.user.role === 'pending') {
      await usersStore.update(req.user.id, { role: 'viewer' })
    }

    const membership = existing || (await membersStore.get(invite.calendarId, req.user.id))
    const refreshed = await usersStore.getById(req.user.id)
    res.json({
      calendar: { ...calendar, myRole: membership?.role || invite.role },
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

router.post('/decline', authMiddleware, requireApprovedUser, async (req, res, next) => {
  try {
    const token = (req.body?.token != null && String(req.body.token).trim()) || ''
    if (!token) {
      return res.status(400).json({ error: 'Invite token is required' })
    }
    const invite = await invitesStore.getByToken(token)
    if (!invite || invite.status !== 'pending') {
      return res.status(404).json({ error: 'Invite not found or no longer valid' })
    }
    if (!inviteMatchesUser(invite, req.user)) {
      return res.status(403).json({ error: 'This invite is not for your account' })
    }
    await invitesStore.update(invite.id, { status: 'revoked' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
