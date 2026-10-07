-- Part 3: expressing interest and passing (PRD 3.4, 4.3).
-- One row per (member, other member): the latest decision wins.
-- "interest" is shown to the other member (Interests received); "pass" never is.

CREATE TABLE decisions (
  from_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  to_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('interest', 'pass')),
  decided_at INTEGER NOT NULL,
  PRIMARY KEY (from_user_id, to_user_id)
);
CREATE INDEX decisions_received ON decisions (to_user_id, decision, decided_at);
