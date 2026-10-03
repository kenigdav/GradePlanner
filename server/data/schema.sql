-- Grade Planner PostgreSQL schema (run automatically when DATABASE_URL is set)

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  banned BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS calendars (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_members (
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (calendar_id, user_id)
);

CREATE INDEX IF NOT EXISTS calendar_members_user_id ON calendar_members (user_id);

CREATE TABLE IF NOT EXISTS calendar_invites (
  id UUID PRIMARY KEY,
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  invited_username TEXT,
  role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE calendar_invites ADD COLUMN IF NOT EXISTS invited_username TEXT;
ALTER TABLE calendar_invites ALTER COLUMN email SET DEFAULT '';

CREATE INDEX IF NOT EXISTS calendar_invites_calendar_id ON calendar_invites (calendar_id);
CREATE INDEX IF NOT EXISTS calendar_invites_email_lower ON calendar_invites (LOWER(email));
CREATE INDEX IF NOT EXISTS calendar_invites_username_lower ON calendar_invites (LOWER(invited_username));

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY,
  date TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]',
  videos JSONB NOT NULL DEFAULT '[]',
  pdfs JSONB NOT NULL DEFAULT '[]',
  links JSONB NOT NULL DEFAULT '[]',
  created_by_user_id UUID NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calendar_id UUID
);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS calendar_id UUID;
CREATE INDEX IF NOT EXISTS assignments_calendar_id ON assignments (calendar_id);

-- Legacy global subjects table (unused by new calendars; kept for compatibility)
CREATE TABLE IF NOT EXISTS subjects (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS calendar_subjects (
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  PRIMARY KEY (calendar_id, name)
);
