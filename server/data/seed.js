import bcrypt from 'bcryptjs'
import { users } from './store.js'

const DEFAULT_ADMIN_USERNAME = 'admin'
const DEFAULT_CONTRIBUTOR_USERNAME = 'Test 1'
const DEFAULT_CONTRIBUTOR_PASSWORD = 'blabla1'
const DEFAULT_ADMIN_PASSWORD = 'blabla1'

export async function seedDefaultAdmin() {
  try {
    const all = await users.getAll()
    const hasAdmin = all.some((u) => u.username && u.username.toLowerCase() === DEFAULT_ADMIN_USERNAME.toLowerCase())
    if (hasAdmin) return
    const hash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10)
    await users.create({
      fullName: 'Administrator',
      email: 'admin@localhost',
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash: hash,
      role: 'administrator',
      banned: false,
    })
    console.log('Seeded default admin (username: admin)')
  } catch (err) {
    console.error('Seed error:', err)
    throw err
  }
}

export async function seedDefaultContributor() {
  try {
    const all = await users.getAll()
    const hasContributor = all.some((u) => u.username && u.username.toLowerCase() === DEFAULT_CONTRIBUTOR_USERNAME.toLowerCase())
    if (hasContributor) return
    const hash = bcrypt.hashSync(DEFAULT_CONTRIBUTOR_PASSWORD, 10)
    await users.create({
      fullName: 'Test 1',
      email: 'test1@localhost',
      username: DEFAULT_CONTRIBUTOR_USERNAME,
      passwordHash: hash,
      role: 'contributor',
      banned: false,
    })
    console.log('Seeded default contributor (username: Test 1)')
  } catch (err) {
    console.error('Seed contributor error:', err)
    throw err
  }
}

/** Subjects are seeded per-calendar on create; no global subject seed. */
export async function seedDefaultSubjects() {
  return
}
