import { Router } from 'express'
import {
  assignments as assignmentsStore,
  members as membersStore,
  users as usersStore,
  calendars as calendarsStore,
} from '../data/store.js'
import {
  authMiddleware,
  requireApprovedUser,
  canManageCalendar,
} from '../middleware/auth.js'
import { isEmailConfigured, sendMail } from '../lib/email.js'

const router = Router()

function getTomorrowDateString() {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

router.post('/due-tomorrow', authMiddleware, requireApprovedUser, async (req, res) => {
  const calendarId = req.body?.calendarId || req.query.calendarId
  if (!calendarId) {
    return res.status(400).json({ error: 'calendarId is required' })
  }

  const membership = await membersStore.get(calendarId, req.user.id)
  if (!membership || !canManageCalendar(membership.role)) {
    return res.status(403).json({ error: 'Only calendar owners can send notifications' })
  }

  if (!isEmailConfigured()) {
    return res.status(503).json({
      error: 'Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS on the server.',
    })
  }

  const calendar = await calendarsStore.getById(calendarId)
  const tomorrow = getTomorrowDateString()
  const dueAssignments = (await assignmentsStore.getByCalendar(calendarId)).filter(
    (a) => a.date === tomorrow
  )
  const memberRows = await membersStore.getByCalendar(calendarId)
  const recipients = []
  for (const m of memberRows) {
    const u = await usersStore.getById(m.userId)
    if (u && u.email && String(u.email).trim() && !u.banned) {
      recipients.push(u)
    }
  }

  const calendarName = calendar?.name || 'Assignment Planner'
  const subject = `Assignments due tomorrow (${tomorrow}) – ${calendarName}`
  const assignmentList =
    dueAssignments.length === 0
      ? 'No assignments are due tomorrow.'
      : dueAssignments
          .map(
            (a) =>
              `• ${a.subject}${a.description ? ': ' + a.description.replace(/\n/g, ' ').slice(0, 80) + (a.description.length > 80 ? '…' : '') : ''}`
          )
          .join('\n')

  let sent = 0
  let failed = 0

  for (const user of recipients) {
    try {
      const text = `Hi ${user.fullName || user.username},\n\nAssignments due tomorrow (${tomorrow}) in ${calendarName}:\n\n${assignmentList}\n\n— Assignment Planner`
      await sendMail({
        to: user.email,
        subject,
        text,
        html: `<p>Hi ${user.fullName || user.username},</p><p>Assignments due tomorrow (${tomorrow}) in <strong>${calendarName}</strong>:</p><pre>${assignmentList.replace(/</g, '&lt;')}</pre><p>— Assignment Planner</p>`,
      })
      sent++
    } catch (err) {
      console.error('Notify email failed for', user.email, err)
      failed++
    }
  }

  res.json({
    ok: true,
    tomorrow,
    assignmentCount: dueAssignments.length,
    sent,
    failed,
    message: `Emails sent to ${sent} user(s).${failed ? ` ${failed} failed.` : ''}`,
  })
})

export default router
