import pg from 'pg'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(__dirname, 'schema.sql')

let pool
let schemaInited = false

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    pool = new pg.Pool({ connectionString: url })
  }
  return pool
}

async function ensureSchema() {
  if (schemaInited) return
  const sql = fs.readFileSync(schemaPath, 'utf8')
  const client = await getPool().connect()
  try {
    await client.query(sql)
    schemaInited = true
  } finally {
    client.release()
  }
}

function rowToUser(row) {
  if (!row) return null
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    banned: row.banned ?? false,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
  }
}

function rowToCalendar(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    joinCode: row.join_code || null,
  }
}

function rowToMember(row) {
  if (!row) return null
  return {
    calendarId: row.calendar_id,
    userId: row.user_id,
    role: row.role,
  }
}

function rowToInvite(row) {
  if (!row) return null
  return {
    id: row.id,
    calendarId: row.calendar_id,
    email: row.email || '',
    invitedUsername: row.invited_username || null,
    role: row.role,
    token: row.token,
    invitedByUserId: row.invited_by_user_id,
    status: row.status,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  }
}

function rowToAssignment(row) {
  if (!row) return null
  return {
    id: row.id,
    calendarId: row.calendar_id || null,
    date: row.date,
    subject: row.subject,
    description: row.description || '',
    images: row.images || [],
    videos: row.videos || [],
    pdfs: row.pdfs || [],
    links: row.links || [],
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  }
}

export const users = {
  async getAll() {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM users ORDER BY username')
    return res.rows.map(rowToUser)
  },
  async getById(id) {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM users WHERE id = $1', [id])
    return rowToUser(res.rows[0])
  },
  async getByUsername(username) {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username])
    return rowToUser(res.rows[0])
  },
  async getByEmail(email) {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email])
    return rowToUser(res.rows[0])
  },
  async create(user) {
    await ensureSchema()
    const id = user.id || randomUUID()
    await getPool().query(
      `INSERT INTO users (id, full_name, email, username, password_hash, role, banned)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        user.fullName,
        user.email,
        user.username,
        user.passwordHash,
        user.role,
        user.banned ?? false,
      ]
    )
    return this.getById(id)
  },
  async update(id, updates) {
    await ensureSchema()
    const allowed = ['fullName', 'email', 'username', 'passwordHash', 'role', 'banned', 'lastSeenAt']
    const setClauses = []
    const values = []
    let i = 1
    for (const k of allowed) {
      if (updates[k] === undefined) continue
      const col =
        k === 'fullName' ? 'full_name' : k === 'passwordHash' ? 'password_hash' : k === 'lastSeenAt' ? 'last_seen_at' : k
      setClauses.push(`${col} = $${i}`)
      values.push(updates[k])
      i++
    }
    if (setClauses.length === 0) return this.getById(id)
    values.push(id)
    await getPool().query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = $${i}`, values)
    return this.getById(id)
  },
  async delete(id) {
    await ensureSchema()
    const res = await getPool().query('DELETE FROM users WHERE id = $1', [id])
    return (res.rowCount ?? 0) > 0
  },
}

export const calendars = {
  async getAll() {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM calendars ORDER BY name')
    return res.rows.map(rowToCalendar)
  },
  async getById(id) {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM calendars WHERE id = $1', [id])
    return rowToCalendar(res.rows[0])
  },
  async getByJoinCode(joinCode) {
    await ensureSchema()
    const res = await getPool().query(
      'SELECT * FROM calendars WHERE UPPER(join_code) = UPPER($1)',
      [joinCode]
    )
    return rowToCalendar(res.rows[0])
  },
  async getForUser(userId) {
    await ensureSchema()
    const res = await getPool().query(
      `SELECT c.* FROM calendars c
       INNER JOIN calendar_members m ON m.calendar_id = c.id
       WHERE m.user_id = $1
       ORDER BY c.name`,
      [userId]
    )
    return res.rows.map(rowToCalendar)
  },
  async create(calendar) {
    await ensureSchema()
    const id = randomUUID()
    await getPool().query(
      `INSERT INTO calendars (id, name, created_by_user_id, created_at, join_code)
       VALUES ($1, $2, $3, NOW(), $4)`,
      [id, calendar.name, calendar.createdByUserId, calendar.joinCode || null]
    )
    return this.getById(id)
  },
  async update(id, updates) {
    await ensureSchema()
    const allowed = ['name', 'joinCode']
    const setClauses = []
    const values = []
    let i = 1
    for (const k of allowed) {
      if (updates[k] === undefined) continue
      const col = k === 'joinCode' ? 'join_code' : k
      setClauses.push(`${col} = $${i}`)
      values.push(updates[k])
      i++
    }
    if (setClauses.length === 0) return this.getById(id)
    values.push(id)
    await getPool().query(`UPDATE calendars SET ${setClauses.join(', ')} WHERE id = $${i}`, values)
    return this.getById(id)
  },
  async delete(id) {
    await ensureSchema()
    const client = await getPool().connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM calendar_subjects WHERE calendar_id = $1', [id])
      await client.query('DELETE FROM assignments WHERE calendar_id = $1', [id])
      await client.query('DELETE FROM calendar_invites WHERE calendar_id = $1', [id])
      await client.query('DELETE FROM calendar_members WHERE calendar_id = $1', [id])
      const res = await client.query('DELETE FROM calendars WHERE id = $1', [id])
      await client.query('COMMIT')
      return (res.rowCount ?? 0) > 0
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },
}

export const members = {
  async getAll() {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM calendar_members')
    return res.rows.map(rowToMember)
  },
  async getByCalendar(calendarId) {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM calendar_members WHERE calendar_id = $1', [calendarId])
    return res.rows.map(rowToMember)
  },
  async get(calendarId, userId) {
    await ensureSchema()
    const res = await getPool().query(
      'SELECT * FROM calendar_members WHERE calendar_id = $1 AND user_id = $2',
      [calendarId, userId]
    )
    return rowToMember(res.rows[0])
  },
  async add({ calendarId, userId, role }) {
    await ensureSchema()
    await getPool().query(
      `INSERT INTO calendar_members (calendar_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (calendar_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [calendarId, userId, role]
    )
    return this.get(calendarId, userId)
  },
  async updateRole(calendarId, userId, role) {
    await ensureSchema()
    const res = await getPool().query(
      'UPDATE calendar_members SET role = $1 WHERE calendar_id = $2 AND user_id = $3',
      [role, calendarId, userId]
    )
    if ((res.rowCount ?? 0) === 0) return null
    return this.get(calendarId, userId)
  },
  async remove(calendarId, userId) {
    await ensureSchema()
    const res = await getPool().query(
      'DELETE FROM calendar_members WHERE calendar_id = $1 AND user_id = $2',
      [calendarId, userId]
    )
    return (res.rowCount ?? 0) > 0
  },
  async countOwners(calendarId) {
    await ensureSchema()
    const res = await getPool().query(
      `SELECT COUNT(*)::int AS n FROM calendar_members
       WHERE calendar_id = $1 AND role = 'owner'`,
      [calendarId]
    )
    return res.rows[0]?.n ?? 0
  },
}

export const invites = {
  async getAll() {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM calendar_invites ORDER BY created_at DESC')
    return res.rows.map(rowToInvite)
  },
  async getById(id) {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM calendar_invites WHERE id = $1', [id])
    return rowToInvite(res.rows[0])
  },
  async getByToken(token) {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM calendar_invites WHERE token = $1', [token])
    return rowToInvite(res.rows[0])
  },
  async getByCalendar(calendarId) {
    await ensureSchema()
    const res = await getPool().query(
      'SELECT * FROM calendar_invites WHERE calendar_id = $1 ORDER BY created_at DESC',
      [calendarId]
    )
    return res.rows.map(rowToInvite)
  },
  async getPendingForUser(email, username) {
    await ensureSchema()
    const res = await getPool().query(
      `SELECT * FROM calendar_invites
       WHERE status = 'pending'
         AND (
           (email <> '' AND LOWER(email) = LOWER($1))
           OR (invited_username IS NOT NULL AND LOWER(invited_username) = LOWER($2))
         )
       ORDER BY created_at DESC`,
      [email || '', username || '']
    )
    return res.rows.map(rowToInvite)
  },
  async create(invite) {
    await ensureSchema()
    const id = randomUUID()
    await getPool().query(
      `INSERT INTO calendar_invites
         (id, calendar_id, email, invited_username, role, token, invited_by_user_id, status, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)`,
      [
        id,
        invite.calendarId,
        invite.email || '',
        invite.invitedUsername || null,
        invite.role,
        invite.token,
        invite.invitedByUserId,
        invite.status || 'pending',
        invite.expiresAt || null,
      ]
    )
    return this.getById(id)
  },
  async update(id, updates) {
    await ensureSchema()
    const allowed = ['status', 'role', 'email', 'invitedUsername']
    const setClauses = []
    const values = []
    let i = 1
    for (const k of allowed) {
      if (updates[k] === undefined) continue
      const col = k === 'invitedUsername' ? 'invited_username' : k
      setClauses.push(`${col} = $${i}`)
      values.push(updates[k])
      i++
    }
    if (setClauses.length === 0) return this.getById(id)
    values.push(id)
    await getPool().query(`UPDATE calendar_invites SET ${setClauses.join(', ')} WHERE id = $${i}`, values)
    return this.getById(id)
  },
}

export const assignments = {
  async getAll() {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM assignments ORDER BY date, subject')
    return res.rows.map(rowToAssignment)
  },
  async getByCalendar(calendarId) {
    await ensureSchema()
    const res = await getPool().query(
      'SELECT * FROM assignments WHERE calendar_id = $1 ORDER BY date, subject',
      [calendarId]
    )
    return res.rows.map(rowToAssignment)
  },
  async create(assignment) {
    await ensureSchema()
    const id = randomUUID()
    await getPool().query(
      `INSERT INTO assignments
         (id, calendar_id, date, subject, description, images, videos, pdfs, links,
          created_by_user_id, created_by_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12::timestamptz, NOW()))`,
      [
        id,
        assignment.calendarId || null,
        assignment.date,
        assignment.subject,
        assignment.description || '',
        JSON.stringify(assignment.images || []),
        JSON.stringify(assignment.videos || []),
        JSON.stringify(assignment.pdfs || []),
        JSON.stringify(assignment.links || []),
        assignment.createdByUserId,
        assignment.createdByName,
        assignment.createdAt || null,
      ]
    )
    return this.getById(id)
  },
  async getById(id) {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM assignments WHERE id = $1', [id])
    return rowToAssignment(res.rows[0])
  },
  async update(id, updates) {
    await ensureSchema()
    const existing = await this.getById(id)
    if (!existing) return null
    const allowed = ['date', 'subject', 'description', 'images', 'videos', 'pdfs', 'links']
    const setClauses = []
    const values = []
    let i = 1
    for (const k of allowed) {
      if (updates[k] === undefined) continue
      setClauses.push(`${k} = $${i}`)
      values.push(Array.isArray(updates[k]) ? JSON.stringify(updates[k]) : updates[k])
      i++
    }
    if (setClauses.length === 0) return existing
    values.push(id)
    await getPool().query(`UPDATE assignments SET ${setClauses.join(', ')} WHERE id = $${i}`, values)
    return this.getById(id)
  },
  async delete(id) {
    await ensureSchema()
    const res = await getPool().query('DELETE FROM assignments WHERE id = $1', [id])
    return (res.rowCount ?? 0) > 0
  },
}

/** Legacy global subjects. */
export const subjects = {
  async getAll() {
    await ensureSchema()
    const res = await getPool().query('SELECT name FROM subjects ORDER BY name')
    return res.rows.map((r) => r.name)
  },
  async add(name) {
    await ensureSchema()
    const trimmed = (name && String(name).trim()) || ''
    if (!trimmed) return null
    const existing = await getPool().query('SELECT 1 FROM subjects WHERE LOWER(name) = LOWER($1)', [trimmed])
    if (existing.rows.length > 0) return trimmed
    await getPool().query('INSERT INTO subjects (name) VALUES ($1)', [trimmed])
    return trimmed
  },
  async remove(name) {
    await ensureSchema()
    const trimmed = (name && String(name).trim()) || ''
    if (!trimmed) return false
    const res = await getPool().query('DELETE FROM subjects WHERE LOWER(name) = LOWER($1)', [trimmed])
    return (res.rowCount ?? 0) > 0
  },
}

export const calendarSubjects = {
  async getByCalendar(calendarId) {
    await ensureSchema()
    const res = await getPool().query(
      'SELECT name FROM calendar_subjects WHERE calendar_id = $1 ORDER BY name',
      [calendarId]
    )
    return res.rows.map((r) => r.name)
  },
  async add(calendarId, name) {
    await ensureSchema()
    const trimmed = (name && String(name).trim()) || ''
    if (!trimmed) return null
    const existing = await getPool().query(
      'SELECT 1 FROM calendar_subjects WHERE calendar_id = $1 AND LOWER(name) = LOWER($2)',
      [calendarId, trimmed]
    )
    if (existing.rows.length > 0) return trimmed
    await getPool().query('INSERT INTO calendar_subjects (calendar_id, name) VALUES ($1, $2)', [
      calendarId,
      trimmed,
    ])
    return trimmed
  },
  async remove(calendarId, name) {
    await ensureSchema()
    const trimmed = (name && String(name).trim()) || ''
    if (!trimmed) return false
    const res = await getPool().query(
      'DELETE FROM calendar_subjects WHERE calendar_id = $1 AND LOWER(name) = LOWER($2)',
      [calendarId, trimmed]
    )
    return (res.rowCount ?? 0) > 0
  },
}
