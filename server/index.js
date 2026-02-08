import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import { seedDefaultAdmin, seedDefaultSubjects } from './data/seed.js'
import authRoutes from './routes/auth.js'
import subjectRoutes from './routes/subjects.js'
import userRoutes from './routes/users.js'
import assignmentRoutes from './routes/assignments.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

try {
  seedDefaultAdmin()
  seedDefaultSubjects()
} catch (err) {
  console.error('Failed to seed:', err)
}

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/assignments', assignmentRoutes)
app.use('/api/subjects', subjectRoutes)

// Production: serve built frontend and SPA fallback
const isProduction = process.env.NODE_ENV === 'production'
if (isProduction) {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
