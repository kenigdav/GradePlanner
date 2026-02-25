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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS subjects (
  name TEXT PRIMARY KEY
);
