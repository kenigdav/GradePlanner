import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'files')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const ASSIGNMENTS_FILE = path.join(DATA_DIR, 'assignments.json')
const SUBJECTS_FILE = path.join(DATA_DIR, 'subjects.json')

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
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
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
}

export const assignments = {
  getAll() {
    return readJson(ASSIGNMENTS_FILE, [])
  },
  create(assignment) {
    const all = assignments.getAll()
    const newOne = { ...assignment, id: randomUUID() }
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
