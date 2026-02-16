import bcrypt from 'bcryptjs'
import { users, subjects } from './store.js'

const DEFAULT_ADMIN_USERNAME = 'admin'
const DEFAULT_SUBJECTS = [
  'Spanish', 'Science', 'Rohr Advisory A-Day', 'Rohr Advisory B-Day',
  'Musick Advisory A-Day', 'Musick Advisory B-Day', 'PE', 'Math', 'Algebra',
  'ELA', 'Social Studies', 'Music', 'Engineering', 'Philosophy',
]
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

export async function seedDefaultSubjects() {
  try {
    const all = await subjects.getAll()
    if (all.length > 0) return
    for (const name of DEFAULT_SUBJECTS) {
      await subjects.add(name)
    }
    console.log('Seeded default subjects')
  } catch (err) {
    console.error('Seed subjects error:', err)
    throw err
  }
}
