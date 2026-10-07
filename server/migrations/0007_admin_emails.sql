-- Emails from the icecream team to members: one at a time from a member's page, or in bulk.
-- Timestamps are unix epoch milliseconds.

-- One row per send: a single email to one member, or an announcement to many.
CREATE TABLE email_campaigns (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins (id),
  kind TEXT NOT NULL CHECK (kind IN ('single', 'bulk')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,                         -- plain text; {name} becomes the member's first name
  audience TEXT,                              -- bulk only: the filters used, as JSON
  link_base TEXT,                             -- bulk only: the API's address, for unsubscribe links
  recipient_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX email_campaigns_created ON email_campaigns (created_at);

-- Each email to send. Bulk emails go out a few at a time (the mail account has a daily limit),
-- so they wait here as "queued" until a background run picks them up.
CREATE TABLE email_outbox (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES email_campaigns (id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER,
  sent_at INTEGER
);
CREATE INDEX email_outbox_queue ON email_outbox (status, created_at);
CREATE INDEX email_outbox_campaign ON email_outbox (campaign_id, status);

-- Members who unsubscribed from announcements. Emails about their own account still reach them.
ALTER TABLE users ADD COLUMN announcements_opt_out_at INTEGER;

-- Allow "email_sent" in the team history. SQLite can't change a CHECK, so the table is rebuilt.
PRAGMA defer_foreign_keys = true;
CREATE TABLE admin_actions_new (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins (id),
  action TEXT NOT NULL CHECK (action IN (
    'verification_passed', 'verification_failed', 'report_actioned', 'report_dismissed', 'member_suspended', 'member_restored',
    'email_sent'
  )),
  target_user_id TEXT,
  target_id TEXT,
  note TEXT,
  created_at INTEGER NOT NULL
);
INSERT INTO admin_actions_new SELECT id, admin_id, action, target_user_id, target_id, note, created_at FROM admin_actions;
DROP TABLE admin_actions;
ALTER TABLE admin_actions_new RENAME TO admin_actions;
CREATE INDEX admin_actions_target ON admin_actions (target_user_id, created_at);
