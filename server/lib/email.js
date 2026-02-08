import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10)
const SMTP_SECURE = process.env.SMTP_SECURE === 'true'
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || 'noreply@localhost'

let transporter = null

function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null
  if (transporter) return transporter
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return transporter
}

export function isEmailConfigured() {
  return !!getTransporter()
}

export async function sendMail({ to, subject, text, html }) {
  const transport = getTransporter()
  if (!transport) {
    throw new Error('Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.')
  }
  await transport.sendMail({
    from: FROM_EMAIL,
    to,
    subject,
    text: text || undefined,
    html: html || undefined,
  })
}
