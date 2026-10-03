// Use external PostgreSQL when DATABASE_URL is set; otherwise use local files.
// Both backends expose the same async API.

function wrapSyncStore(store) {
  const out = {}
  for (const [method, fn] of Object.entries(store)) {
    out[method] = (...args) => Promise.resolve(fn.apply(store, args))
  }
  return out
}

let users, assignments, subjects, calendars, members, invites, calendarSubjects

if (process.env.DATABASE_URL) {
  const db = await import('./store-db.js')
  users = db.users
  assignments = db.assignments
  subjects = db.subjects
  calendars = db.calendars
  members = db.members
  invites = db.invites
  calendarSubjects = db.calendarSubjects
} else {
  const file = await import('./store-file.js')
  users = wrapSyncStore(file.users)
  assignments = wrapSyncStore(file.assignments)
  subjects = wrapSyncStore(file.subjects)
  calendars = wrapSyncStore(file.calendars)
  members = wrapSyncStore(file.members)
  invites = wrapSyncStore(file.invites)
  calendarSubjects = wrapSyncStore(file.calendarSubjects)
}

export { users, assignments, subjects, calendars, members, invites, calendarSubjects }
