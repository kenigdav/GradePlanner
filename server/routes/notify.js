import { Router } from 'express'
import { assignments as assignmentsStore, users as usersStore } from '../data/store.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { isEmailConfigured, sendMail } from '../lib/email.js'

const router = Router()

function getTomorrowDateString() {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

router.post('/due-tomorrow', authMiddleware, requireRole('administrator'), async (req, res) => {
  if (!isEmailConfigured()) {
    return res.status(503).json({
      error: 'Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS on the server.',
    })
  }

  const tomorrow = getTomorrowDateString()
  const allAssignments = await assignmentsStore.getAll()
  const dueAssignments = allAssignments.filter((a) => a.date === tomorrow)
  const allUsers = await usersStore.getAll()
  const recipients = allUsers.filter((u) => u.email && String(u.email).trim() && !u.banned && u.role !== 'pending')

  const subject = `Assignments due tomorrow (${tomorrow}) – Assignment Planner`
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
      const text = `Hi ${user.fullName || user.username},\n\nAssignments due tomorrow (${tomorrow}):\n\n${assignmentList}\n\n— Assignment Planner`
      await sendMail({
        to: user.email,
        subject,
        text,
        html: `<p>Hi ${user.fullName || user.username},</p><p>Assignments due tomorrow (${tomorrow}):</p><pre>${assignmentList.replace(/</g, '&lt;')}</pre><p>— Assignment Planner</p>`,
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
