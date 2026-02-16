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

function rowToAssignment(row) {
  if (!row) return null
  return {
    id: row.id,
    date: row.date,
    subject: row.subject,
    description: row.description || '',
    images: row.images || [],
    videos: row.videos || [],
    pdfs: row.pdfs || [],
    links: row.links || [],
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name,
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
      const col = k === 'fullName' ? 'full_name' : k === 'passwordHash' ? 'password_hash' : k === 'lastSeenAt' ? 'last_seen_at' : k
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

export const assignments = {
  async getAll() {
    await ensureSchema()
    const res = await getPool().query('SELECT * FROM assignments ORDER BY date, subject')
    return res.rows.map(rowToAssignment)
  },
  async create(assignment) {
    await ensureSchema()
    const id = randomUUID()
    await getPool().query(
      `INSERT INTO assignments (id, date, subject, description, images, videos, pdfs, links, created_by_user_id, created_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        assignment.date,
        assignment.subject,
        assignment.description || '',
        JSON.stringify(assignment.images || []),
        JSON.stringify(assignment.videos || []),
        JSON.stringify(assignment.pdfs || []),
        JSON.stringify(assignment.links || []),
        assignment.createdByUserId,
        assignment.createdByName,
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
      const col = k
      setClauses.push(`${col} = $${i}`)
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
