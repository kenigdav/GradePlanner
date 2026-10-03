import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'files')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const ASSIGNMENTS_FILE = path.join(DATA_DIR, 'assignments.json')
const SUBJECTS_FILE = path.join(DATA_DIR, 'subjects.json')
const CALENDARS_FILE = path.join(DATA_DIR, 'calendars.json')
const MEMBERS_FILE = path.join(DATA_DIR, 'calendar_members.json')
const INVITES_FILE = path.join(DATA_DIR, 'calendar_invites.json')
const CALENDAR_SUBJECTS_FILE = path.join(DATA_DIR, 'calendar_subjects.json')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJson(filePath, defaultVal = []) {
  ensureDir()
  if (!fs.existsSync(filePath)) return defaultVal
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return defaultVal
  }
}

function writeJson(filePath, data) {
  ensureDir()
  const tmpPath = `${filePath}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmpPath, filePath)
}

export const users = {
  getAll() {
    return readJson(USERS_FILE, [])
  },
  getById(id) {
    return users.getAll().find((u) => u.id === id) ?? null
  },
  getByUsername(username) {
    return users.getAll().find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null
  },
  getByEmail(email) {
    return users.getAll().find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null
  },
  create(user) {
    const all = users.getAll()
    const newUser = { ...user, id: randomUUID() }
    all.push(newUser)
    writeJson(USERS_FILE, all)
    return newUser
  },
  update(id, updates) {
    const all = users.getAll()
    const i = all.findIndex((u) => u.id === id)
    if (i === -1) return null
    all[i] = { ...all[i], ...updates }
    writeJson(USERS_FILE, all)
    return all[i]
  },
  delete(id) {
    const all = users.getAll().filter((u) => u.id !== id)
    if (all.length === users.getAll().length) return false
    writeJson(USERS_FILE, all)
    return true
  },
}

export const calendars = {
  getAll() {
    return readJson(CALENDARS_FILE, [])
  },
  getById(id) {
    return calendars.getAll().find((c) => c.id === id) ?? null
  },
  getForUser(userId) {
    const memberCalendarIds = new Set(
      members.getAll().filter((m) => m.userId === userId).map((m) => m.calendarId)
    )
    return calendars.getAll().filter((c) => memberCalendarIds.has(c.id))
  },
  create(calendar) {
    const all = calendars.getAll()
    const newOne = {
      id: randomUUID(),
      name: calendar.name,
      createdByUserId: calendar.createdByUserId,
      createdAt: new Date().toISOString(),
    }
    all.push(newOne)
    writeJson(CALENDARS_FILE, all)
    return newOne
  },
  update(id, updates) {
    const all = calendars.getAll()
    const i = all.findIndex((c) => c.id === id)
    if (i === -1) return null
    if (updates.name !== undefined) all[i].name = updates.name
    writeJson(CALENDARS_FILE, all)
    return all[i]
  },
  delete(id) {
    const before = calendars.getAll()
    const after = before.filter((c) => c.id !== id)
    if (after.length === before.length) return false
    writeJson(CALENDARS_FILE, after)
    writeJson(MEMBERS_FILE, members.getAll().filter((m) => m.calendarId !== id))
    writeJson(INVITES_FILE, invites.getAll().filter((inv) => inv.calendarId !== id))
    writeJson(ASSIGNMENTS_FILE, assignments.getAll().filter((a) => a.calendarId !== id))
    writeJson(CALENDAR_SUBJECTS_FILE, calendarSubjects.getAll().filter((s) => s.calendarId !== id))
    return true
  },
}

export const members = {
  getAll() {
    return readJson(MEMBERS_FILE, [])
  },
  getByCalendar(calendarId) {
    return members.getAll().filter((m) => m.calendarId === calendarId)
  },
  get(calendarId, userId) {
    return members.getAll().find((m) => m.calendarId === calendarId && m.userId === userId) ?? null
  },
  add({ calendarId, userId, role }) {
    const all = members.getAll()
    const existing = all.find((m) => m.calendarId === calendarId && m.userId === userId)
    if (existing) {
      existing.role = role
      writeJson(MEMBERS_FILE, all)
      return existing
    }
    const row = { calendarId, userId, role }
    all.push(row)
    writeJson(MEMBERS_FILE, all)
    return row
  },
  updateRole(calendarId, userId, role) {
    const all = members.getAll()
    const i = all.findIndex((m) => m.calendarId === calendarId && m.userId === userId)
    if (i === -1) return null
    all[i].role = role
    writeJson(MEMBERS_FILE, all)
    return all[i]
  },
  remove(calendarId, userId) {
    const all = members.getAll()
    const next = all.filter((m) => !(m.calendarId === calendarId && m.userId === userId))
    if (next.length === all.length) return false
    writeJson(MEMBERS_FILE, next)
    return true
  },
  countOwners(calendarId) {
    return members.getAll().filter((m) => m.calendarId === calendarId && m.role === 'owner').length
  },
}

export const invites = {
  getAll() {
    return readJson(INVITES_FILE, [])
  },
  getById(id) {
    return invites.getAll().find((i) => i.id === id) ?? null
  },
  getByToken(token) {
    return invites.getAll().find((i) => i.token === token) ?? null
  },
  getByCalendar(calendarId) {
    return invites.getAll().filter((i) => i.calendarId === calendarId)
  },
  create(invite) {
    const all = invites.getAll()
    const row = {
      id: randomUUID(),
      calendarId: invite.calendarId,
      email: invite.email,
      role: invite.role,
      token: invite.token,
      invitedByUserId: invite.invitedByUserId,
      status: invite.status || 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: invite.expiresAt || null,
    }
    all.push(row)
    writeJson(INVITES_FILE, all)
    return row
  },
  update(id, updates) {
    const all = invites.getAll()
    const i = all.findIndex((inv) => inv.id === id)
    if (i === -1) return null
    all[i] = { ...all[i], ...updates }
    writeJson(INVITES_FILE, all)
    return all[i]
  },
}

export const assignments = {
  getAll() {
    return readJson(ASSIGNMENTS_FILE, [])
  },
  getByCalendar(calendarId) {
    return assignments.getAll().filter((a) => a.calendarId === calendarId)
  },
  getById(id) {
    return assignments.getAll().find((a) => a.id === id) ?? null
  },
  create(assignment) {
    const all = assignments.getAll()
    const newOne = {
      ...assignment,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    }
    all.push(newOne)
    writeJson(ASSIGNMENTS_FILE, all)
    return newOne
  },
  update(id, updates) {
    const all = assignments.getAll()
    const i = all.findIndex((a) => a.id === id)
    if (i === -1) return null
    all[i] = { ...all[i], ...updates }
    writeJson(ASSIGNMENTS_FILE, all)
    return all[i]
  },
  delete(id) {
    const all = assignments.getAll().filter((a) => a.id !== id)
    writeJson(ASSIGNMENTS_FILE, all)
    return true
  },
}

/** Legacy global subjects (unused by multi-calendar flow). */
export const subjects = {
  getAll() {
    return readJson(SUBJECTS_FILE, [])
  },
  add(name) {
    const trimmed = (name && String(name).trim()) || ''
    if (!trimmed) return null
    const all = subjects.getAll()
    const lower = trimmed.toLowerCase()
    if (all.some((s) => s.toLowerCase() === lower)) return trimmed
    all.push(trimmed)
    writeJson(SUBJECTS_FILE, all)
    return trimmed
  },
  remove(name) {
    const trimmed = (name && String(name).trim()) || ''
    if (!trimmed) return false
    const all = subjects.getAll().filter((s) => s.toLowerCase() !== trimmed.toLowerCase())
    if (all.length === subjects.getAll().length) return false
    writeJson(SUBJECTS_FILE, all)
    return true
  },
}

export const calendarSubjects = {
  getAll() {
    return readJson(CALENDAR_SUBJECTS_FILE, [])
  },
  getByCalendar(calendarId) {
    return calendarSubjects
      .getAll()
      .filter((s) => s.calendarId === calendarId)
      .map((s) => s.name)
      .sort((a, b) => a.localeCompare(b))
  },
  add(calendarId, name) {
    const trimmed = (name && String(name).trim()) || ''
    if (!trimmed) return null
    const all = calendarSubjects.getAll()
    const lower = trimmed.toLowerCase()
    if (all.some((s) => s.calendarId === calendarId && s.name.toLowerCase() === lower)) {
      return trimmed
    }
    all.push({ calendarId, name: trimmed })
    writeJson(CALENDAR_SUBJECTS_FILE, all)
    return trimmed
  },
  remove(calendarId, name) {
    const trimmed = (name && String(name).trim()) || ''
    if (!trimmed) return false
    const all = calendarSubjects.getAll()
    const next = all.filter(
      (s) => !(s.calendarId === calendarId && s.name.toLowerCase() === trimmed.toLowerCase())
    )
    if (next.length === all.length) return false
    writeJson(CALENDAR_SUBJECTS_FILE, next)
    return true
  },
}
