-- Part 1: onboarding and verification (PRD 3.1, 4.1).
-- Timestamps are unix epoch milliseconds.
-- Members sign in with a phone number or an email address; each is its own account.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,                          -- E.164, +234…
  email TEXT UNIQUE,                          -- lowercased
  status TEXT NOT NULL DEFAULT 'onboarding'
    CHECK (status IN ('onboarding', 'ineligible', 'active', 'suspended')),
  date_of_birth TEXT,                         -- YYYY-MM-DD; locked once set so the age gate can't be retried
  first_name TEXT,
  gender TEXT CHECK (gender IN ('woman', 'man')),
  city TEXT,
  id_step_completed_at INTEGER,               -- set when an ID is submitted or the step is skipped
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE TABLE otp_challenges (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  destination TEXT NOT NULL,                  -- the normalised phone number or email address
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX otp_challenges_destination_created ON otp_challenges (destination, created_at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                -- SHA-256 of the bearer token; the token itself is never stored
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,                   -- R2 key
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX photos_user ON photos (user_id, position);

-- One row per submission. The latest row per (user, kind) is the current state.
CREATE TABLE verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('liveness', 'government_id')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed')),
  document_type TEXT CHECK (document_type IN ('nin', 'drivers_licence', 'passport', 'voters_card')),
  object_key TEXT NOT NULL,                   -- R2 key of the selfie or document image
  failure_reason TEXT,
  submitted_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT
);
CREATE INDEX verifications_user_kind ON verifications (user_id, kind, submitted_at);
CREATE INDEX verifications_queue ON verifications (status, submitted_at);
