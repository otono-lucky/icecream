-- The admin website (PRD 3.10): per-person admin accounts, their sessions, and a log of what they did.
-- Timestamps are unix epoch milliseconds.

-- Admins sign in with a code emailed to them, like members. Added with `npm run admin:add`.
CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,                 -- lowercased
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  disabled_at INTEGER                         -- set to stop someone signing in, keeping their history
);

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,                -- SHA-256 of the bearer token
  admin_id TEXT NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Every decision an admin makes, so the team can see who did what and why.
-- target_user_id has no foreign key on purpose: the record stays if the member's account is deleted.
CREATE TABLE admin_actions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins (id),
  action TEXT NOT NULL CHECK (action IN (
    'verification_passed', 'verification_failed', 'report_actioned', 'report_dismissed', 'member_suspended', 'member_restored'
  )),
  target_user_id TEXT,
  target_id TEXT,                             -- the verification or report it was about, if any
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX admin_actions_target ON admin_actions (target_user_id, created_at);

ALTER TABLE reports ADD COLUMN resolved_at INTEGER;
ALTER TABLE reports ADD COLUMN resolved_by TEXT REFERENCES admins (id);
ALTER TABLE reports ADD COLUMN resolution_note TEXT;
