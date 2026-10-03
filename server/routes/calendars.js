import { Router } from 'express'
import { randomBytes } from 'crypto'
import {
  calendars as calendarsStore,
  members as membersStore,
  invites as invitesStore,
  users as usersStore,
  assignments as assignmentsStore,
} from '../data/store.js'
import {
  authMiddleware,
  requireApprovedUser,
  requireCalendarMember,
  requireCalendarRole,
  CALENDAR_ROLES,
  INVITE_ROLES,
} from '../middleware/auth.js'
import { isEmailConfigured, sendMail } from '../lib/email.js'
import { generateJoinCode, normalizeJoinCode } from '../lib/joinCode.js'
import * as sse from '../lib/sse.js'

const router = Router()

const INVITE_DAYS = 14

async function ensureJoinCode(calendar) {
  if (!calendar) return null
  if (calendar.joinCode) return calendar
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateJoinCode(8)
    const taken = await calendarsStore.getByJoinCode(code)
    if (taken) continue
    return calendarsStore.update(calendar.id, { joinCode: code })
  }
  throw new Error('Could not generate a unique join code')
}

async function allocateJoinCode() {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateJoinCode(8)
    const taken = await calendarsStore.getByJoinCode(code)
    if (!taken) return code
  }
  throw new Error('Could not generate a unique join code')
}

function publicUser(u) {
  if (!u) return null
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    username: u.username,
  }
}

function invitePublic(inv, calendarName) {
  return {
    id: inv.id,
    calendarId: inv.calendarId,
    calendarName: calendarName || null,
    email: inv.email || '',
    invitedUsername: inv.invitedUsername || null,
    inviteVia: inv.invitedUsername ? 'username' : 'email',
    role: inv.role,
    status: inv.status,
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
  }
}

function appBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
  const origin = req.get('origin') || req.get('referer')
  if (origin) {
    try {
      return new URL(origin).origin
    } catch {
      /* ignore */
    }
  }
  return `${req.protocol}://${req.get('host')}`
}

router.get('/', authMiddleware, requireApprovedUser, async (req, res, next) => {
  try {
    const list = await calendarsStore.getForUser(req.user.id)
    // Heal only orphaned calendars (created but never got a membership row).
    // Do NOT re-add creators who left intentionally while other members remain.
    const all = await calendarsStore.getAll()
    const knownIds = new Set(list.map((c) => c.id))
    for (const c of all) {
      if (c.createdByUserId === req.user.id && !knownIds.has(c.id)) {
        const rows = await membersStore.getByCalendar(c.id)
        if (rows.length === 0) {
          await membersStore.add({
            calendarId: c.id,
            userId: req.user.id,
            role: 'owner',
          })
          list.push(c)
          knownIds.add(c.id)
        }
      }
    }
    const today = new Date().toISOString().slice(0, 10)
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + 42)
    const horizonStr = horizon.toISOString().slice(0, 10)

    const withRole = await Promise.all(
      list.map(async (c) => {
        let membership = await membersStore.get(c.id, req.user.id)
        if (membership && c.createdByUserId === req.user.id && membership.role !== 'owner') {
          const owners = await membersStore.countOwners(c.id)
          if (owners === 0) {
            membership = await membersStore.updateRole(c.id, req.user.id, 'owner')
          }
        }
        const withCode = await ensureJoinCode(c)
        const assignmentDates = (await assignmentsStore.getByCalendar(c.id))
          .map((a) => a.date)
          .filter((d) => d >= today && d <= horizonStr)
        const previewDates = [...new Set(assignmentDates)]
        return {
          ...withCode,
          myRole: membership?.role || null,
          previewDates,
        }
      })
    )
    res.json(withRole)
  } catch (err) {
    next(err)
  }
})

router.post('/', authMiddleware, requireApprovedUser, async (req, res, next) => {
  try {
    const name = (req.body?.name != null && String(req.body.name).trim()) || ''
    if (!name) {
      return res.status(400).json({ error: 'Calendar name is required' })
    }
    const joinCode = await allocateJoinCode()
    const calendar = await calendarsStore.create({
      name,
      createdByUserId: req.user.id,
      joinCode,
    })
    await membersStore.add({
      calendarId: calendar.id,
      userId: req.user.id,
      role: 'owner',
    })
    res.status(201).json({ ...calendar, myRole: 'owner' })
  } catch (err) {
    next(err)
  }
})

/** Join a calendar with its public join code (no owner approval). */
router.post('/join', authMiddleware, requireApprovedUser, async (req, res, next) => {
  try {
    const code = normalizeJoinCode(req.body?.code)
    if (!code || code.length < 4) {
      return res.status(400).json({ error: 'Enter a valid calendar join code' })
    }
    let calendar = await calendarsStore.getByJoinCode(code)
    if (!calendar) {
      return res.status(404).json({ error: 'No calendar found with that code' })
    }
    const existing = await membersStore.get(calendar.id, req.user.id)
    if (existing) {
      return res.json({ ...calendar, myRole: existing.role, alreadyMember: true })
    }
    await membersStore.add({
      calendarId: calendar.id,
      userId: req.user.id,
      role: 'viewer',
    })
    calendar = await ensureJoinCode(calendar)
    res.status(201).json({ ...calendar, myRole: 'viewer', alreadyMember: false })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', authMiddleware, requireApprovedUser, requireCalendarMember, async (req, res, next) => {
  try {
    let calendar = await calendarsStore.getById(req.calendarId)
    if (!calendar) return res.status(404).json({ error: 'Calendar not found' })
    calendar = await ensureJoinCode(calendar)
    res.json({ ...calendar, myRole: req.membership.role })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', authMiddleware, requireApprovedUser, requireCalendarMember, requireCalendarRole('owner'), async (req, res, next) => {
  try {
    const name = (req.body?.name != null && String(req.body.name).trim()) || ''
    if (!name) {
      return res.status(400).json({ error: 'Calendar name is required' })
    }
    const updated = await calendarsStore.update(req.calendarId, { name })
    if (!updated) return res.status(404).json({ error: 'Calendar not found' })
    res.json({ ...updated, myRole: req.membership.role })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', authMiddleware, requireApprovedUser, requireCalendarMember, requireCalendarRole('owner'), async (req, res, next) => {
  try {
    const ok = await calendarsStore.delete(req.calendarId)
    if (!ok) return res.status(404).json({ error: 'Calendar not found' })
    sse.broadcast('calendars.changed', { calendarId: req.calendarId })
    sse.broadcast('assignments.changed', { calendarId: req.calendarId })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.get('/:id/members', authMiddleware, requireApprovedUser, requireCalendarMember, async (req, res, next) => {
  try {
    const memberRows = await membersStore.getByCalendar(req.calendarId)
    const enriched = await Promise.all(
      memberRows.map(async (m) => {
        const u = await usersStore.getById(m.userId)
        return {
          userId: m.userId,
          role: m.role,
          user: publicUser(u),
        }
      })
    )
    res.json(enriched)
  } catch (err) {
    next(err)
  }
})

/**
 * Invite an existing user by username. They must accept/decline on their home screen.
 */
router.post(
  '/:id/members',
  authMiddleware,
  requireApprovedUser,
  requireCalendarMember,
  requireCalendarRole('owner'),
  async (req, res, next) => {
    try {
      const username =
        (req.body?.username != null && String(req.body.username).trim().replace(/^@+/, '')) || ''
      const role = req.body?.role || 'viewer'
      if (!username) {
        return res.status(400).json({ error: 'Username is required' })
      }
      if (!INVITE_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Invite role must be editor or viewer' })
      }

      const target = await usersStore.getByUsername(username)
      if (!target) {
        return res.status(404).json({ error: 'No user found with that username' })
      }
      if (target.banned) {
        return res.status(400).json({ error: 'That user cannot be invited' })
      }
      if (target.id === req.user.id) {
        return res.status(400).json({ error: 'You are already in this calendar' })
      }

      const already = await membersStore.get(req.calendarId, target.id)
      if (already) {
        return res.status(409).json({ error: 'That user is already a member of this calendar' })
      }

      const pending = (await invitesStore.getByCalendar(req.calendarId)).filter((i) => {
        if (i.status !== 'pending') return false
        return (
          (i.invitedUsername && i.invitedUsername.toLowerCase() === target.username.toLowerCase()) ||
          (i.email && target.email && i.email.toLowerCase() === target.email.toLowerCase())
        )
      })
      for (const old of pending) {
        await invitesStore.update(old.id, { status: 'revoked' })
      }

      const token = randomBytes(24).toString('hex')
      const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const invite = await invitesStore.create({
        calendarId: req.calendarId,
        email: target.email || '',
        invitedUsername: target.username,
        role,
        token,
        invitedByUserId: req.user.id,
        status: 'pending',
        expiresAt,
      })

      const calendar = await calendarsStore.getById(req.calendarId)
      res.status(201).json({
        ...invitePublic(invite, calendar?.name),
        user: publicUser(target),
        message: `@${target.username} will see this invite on their home screen to accept or decline.`,
      })
    } catch (err) {
      next(err)
    }
  }
)

router.patch(
  '/:id/members/:userId',
  authMiddleware,
  requireApprovedUser,
  requireCalendarMember,
  requireCalendarRole('owner'),
  async (req, res, next) => {
    try {
      const { userId } = req.params
      const role = req.body?.role
      if (!CALENDAR_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Role must be owner, editor, or viewer' })
      }
      const existing = await membersStore.get(req.calendarId, userId)
      if (!existing) return res.status(404).json({ error: 'Member not found' })
      if (existing.role === 'owner' && role !== 'owner') {
        const owners = await membersStore.countOwners(req.calendarId)
        if (owners <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last owner' })
        }
      }
      const updated = await membersStore.updateRole(req.calendarId, userId, role)
      const u = await usersStore.getById(userId)
      res.json({ userId, role: updated.role, user: publicUser(u) })
    } catch (err) {
      next(err)
    }
  }
)

router.delete(
  '/:id/members/:userId',
  authMiddleware,
  requireApprovedUser,
  requireCalendarMember,
  async (req, res, next) => {
    try {
      const { userId } = req.params
      const isSelf = userId === req.user.id
      const isOwner = req.membership.role === 'owner' // app admins get owner via requireCalendarMember
      if (!isSelf && !isOwner) {
        return res.status(403).json({ error: 'Only owners can remove other members' })
      }
      const existing = await membersStore.get(req.calendarId, userId)
      if (!existing) return res.status(404).json({ error: 'Member not found' })
      if (existing.role === 'owner') {
        const owners = await membersStore.countOwners(req.calendarId)
        if (owners <= 1) {
          return res.status(400).json({ error: 'Cannot remove the last owner. Transfer ownership or delete the calendar.' })
        }
      }
      await membersStore.remove(req.calendarId, userId)

      // If they had an invite that was closed while they were a member, reopen it
      // so leave → rejoin via invite works again.
      try {
        const removedUser = await usersStore.getById(userId)
        if (removedUser) {
          const allInvites = await invitesStore.getByCalendar(req.calendarId)
          for (const inv of allInvites) {
            if (inv.status !== 'accepted') continue
            const emailMatch =
              inv.email &&
              removedUser.email &&
              inv.email.toLowerCase() === removedUser.email.toLowerCase()
            const usernameMatch =
              inv.invitedUsername &&
              removedUser.username &&
              inv.invitedUsername.toLowerCase() === removedUser.username.toLowerCase()
            if (emailMatch || usernameMatch) {
              const expired = inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()
              await invitesStore.update(inv.id, { status: expired ? 'revoked' : 'pending' })
            }
          }
        }
      } catch {
        /* invite reopen is best-effort */
      }

      sse.broadcast('calendars.changed', { calendarId: req.calendarId })
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  }
)

router.get(
  '/:id/invites',
  authMiddleware,
  requireApprovedUser,
  requireCalendarMember,
  requireCalendarRole('owner'),
  async (req, res, next) => {
    try {
      const calendar = await calendarsStore.getById(req.calendarId)
      const list = await invitesStore.getByCalendar(req.calendarId)
      res.json(list.filter((i) => i.status === 'pending').map((i) => invitePublic(i, calendar?.name)))
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/:id/invites',
  authMiddleware,
  requireApprovedUser,
  requireCalendarMember,
  requireCalendarRole('owner'),
  async (req, res, next) => {
    try {
      const emailInput = (req.body?.email != null && String(req.body.email).trim().toLowerCase()) || ''
      const usernameInput =
        (req.body?.username != null && String(req.body.username).trim()) || ''
      const role = req.body?.role || 'viewer'

      if (!emailInput && !usernameInput) {
        return res.status(400).json({ error: 'Email or username is required' })
      }
      if (emailInput && usernameInput) {
        return res.status(400).json({ error: 'Provide either email or username, not both' })
      }
      if (emailInput && !emailInput.includes('@')) {
        return res.status(400).json({ error: 'A valid email is required' })
      }
      if (!INVITE_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Invite role must be editor or viewer' })
      }

      let email = emailInput
      let invitedUsername = null
      let existingUser = null

      if (usernameInput) {
        existingUser = await usersStore.getByUsername(usernameInput)
        if (!existingUser) {
          return res.status(404).json({ error: 'No user found with that username' })
        }
        if (existingUser.banned) {
          return res.status(400).json({ error: 'That user cannot be invited' })
        }
        invitedUsername = existingUser.username
        email = existingUser.email || ''
      } else {
        existingUser = await usersStore.getByEmail(email)
      }

      if (existingUser) {
        const already = await membersStore.get(req.calendarId, existingUser.id)
        if (already) {
          return res.status(409).json({ error: 'That user is already a member of this calendar' })
        }
      }

      const pending = (await invitesStore.getByCalendar(req.calendarId)).filter((i) => {
        if (i.status !== 'pending') return false
        if (invitedUsername) {
          return (
            (i.invitedUsername && i.invitedUsername.toLowerCase() === invitedUsername.toLowerCase()) ||
            (email && i.email && i.email.toLowerCase() === email.toLowerCase())
          )
        }
        return i.email && i.email.toLowerCase() === email
      })
      for (const old of pending) {
        await invitesStore.update(old.id, { status: 'revoked' })
      }

      const token = randomBytes(24).toString('hex')
      const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const invite = await invitesStore.create({
        calendarId: req.calendarId,
        email,
        invitedUsername,
        role,
        token,
        invitedByUserId: req.user.id,
        status: 'pending',
        expiresAt,
      })

      const calendar = await calendarsStore.getById(req.calendarId)
      const inviteUrl = `${appBaseUrl(req)}/?invite=${encodeURIComponent(token)}`
      let emailSent = false
      let emailError = null

      // Username invites show on the home screen; still email if we have an address + SMTP
      if (email && isEmailConfigured()) {
        try {
          const inviter = req.user.fullName || req.user.username
          const viaNote = invitedUsername
            ? `\nYou can also join from the home screen after signing in as ${invitedUsername}.`
            : ''
          await sendMail({
            to: email,
            subject: `You're invited to ${calendar.name} on Assignment Planner`,
            text: `${inviter} invited you to the calendar "${calendar.name}" as ${role}.\n\nOpen this link to accept:\n${inviteUrl}${viaNote}\n\nThis invite expires in ${INVITE_DAYS} days.`,
            html: `<p>${inviter} invited you to the calendar <strong>${calendar.name}</strong> as <strong>${role}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p>${invitedUsername ? `<p>Or join from the home screen after signing in as <strong>${invitedUsername}</strong>.</p>` : ''}<p>This invite expires in ${INVITE_DAYS} days.</p>`,
          })
          emailSent = true
        } catch (err) {
          console.error('Invite email failed:', err)
          emailError = err.message || 'Failed to send email'
        }
      }

      res.status(201).json({
        ...invitePublic(invite, calendar.name),
        inviteUrl: invitedUsername ? null : inviteUrl,
        emailSent,
        emailError,
        message: invitedUsername
          ? `${invitedUsername} will see this invite on their home screen.`
          : undefined,
      })
    } catch (err) {
      next(err)
    }
  }
)

router.delete(
  '/:id/invites/:inviteId',
  authMiddleware,
  requireApprovedUser,
  requireCalendarMember,
  requireCalendarRole('owner'),
  async (req, res, next) => {
    try {
      const invite = await invitesStore.getById(req.params.inviteId)
      if (!invite || invite.calendarId !== req.calendarId) {
        return res.status(404).json({ error: 'Invite not found' })
      }
      await invitesStore.update(invite.id, { status: 'revoked' })
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  }
)

export default router
