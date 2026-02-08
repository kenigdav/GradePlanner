/**
 * Stops processes on the API and Vite dev server ports (Windows + Unix).
 * Run with: node scripts/stop-dev.js
 */
import { execSync } from 'child_process'

const PORTS = [3001, 5173, 5174, 5175, 5176]

function stopPort(port) {
  try {
    if (process.platform === 'win32') {
      const cmd = `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`
      execSync('powershell', ['-NoProfile', '-Command', cmd], { stdio: 'ignore' })
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' })
    }
    console.log(`  Stopped process on port ${port}`)
  } catch {
    // Port may already be free
  }
}

console.log('Stopping dev servers (API and Vite ports)...')
PORTS.forEach(stopPort)
console.log('Done. Run "npm run dev:all" to start again.')
