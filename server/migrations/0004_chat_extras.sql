-- Chat extras: photo messages, replies, deleting, reactions (read receipts use conversation_reads).

ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'photo'));
ALTER TABLE messages ADD COLUMN object_key TEXT;                    -- R2 key, for photo messages
ALTER TABLE messages ADD COLUMN reply_to_id TEXT REFERENCES messages (id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN deleted_at INTEGER;                 -- deleted for everyone; body and photo are wiped

-- One reaction per member per message; reacting again replaces it.
CREATE TABLE message_reactions (
  message_id TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id)
);
