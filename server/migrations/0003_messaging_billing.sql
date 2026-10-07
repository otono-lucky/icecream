-- Part 4: messaging, the messaging subscription, and report/block (PRD 3.4, 3.8, 3.9, 4.4, 4.7).
-- Timestamps are unix epoch milliseconds. Money is kobo (₦1 = 100 kobo).

CREATE TABLE subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('weekly', 'monthly', 'yearly')),
  -- "cancelled" means it won't renew; messaging still works until current_period_end.
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')),
  current_period_end INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_subscription_code TEXT,
  provider_email_token TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE payments (
  reference TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('weekly', 'monthly', 'yearly')),
  amount_kobo INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
  provider TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX payments_user ON payments (user_id, created_at);

-- One conversation per pair of members; member_a is always the smaller id.
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  member_a TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  member_b TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL,
  UNIQUE (member_a, member_b)
);
CREATE INDEX conversations_a ON conversations (member_a, last_message_at);
CREATE INDEX conversations_b ON conversations (member_b, last_message_at);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX messages_conversation ON messages (conversation_id, created_at);

CREATE TABLE conversation_reads (
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  last_read_at INTEGER NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);

-- A block hides both members from each other everywhere. The blocked member is never told.
CREATE TABLE blocks (
  blocker_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reported_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('fraud', 'misrepresentation', 'harassment', 'other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  created_at INTEGER NOT NULL
);
CREATE INDEX reports_queue ON reports (status, created_at);
