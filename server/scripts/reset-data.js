import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data', 'files')

if (fs.existsSync(DATA_DIR)) {
  fs.rmSync(DATA_DIR, { recursive: true })
  console.log('Deleted server/data/files. Restart the server to seed a fresh admin (admin / blabla1).')
} else {
  console.log('No data folder found. Start the server once to create it and seed the default admin.')
}
