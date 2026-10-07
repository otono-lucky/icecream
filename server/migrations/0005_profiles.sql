-- Part 2: the profile (PRD 3.2, 4.2). One row per member; each section's columns are filled as it's answered.

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  marital_status TEXT CHECK (marital_status IN ('never_married', 'divorced', 'separated', 'widowed')),
  has_children INTEGER CHECK (has_children IN (0, 1)),
  children_count INTEGER CHECK (children_count BETWEEN 1 AND 20),
  children_live_with TEXT CHECK (children_live_with IN ('all', 'some', 'none')),
  open_to_partner_children TEXT CHECK (open_to_partner_children IN ('yes', 'maybe', 'no')),
  faith TEXT CHECK (faith IN ('christian', 'muslim', 'traditional', 'other', 'none')),
  faith_practice TEXT CHECK (faith_practice IN ('devout', 'practising', 'occasional', 'not_religious')),
  partner_faith_importance TEXT CHECK (partner_faith_importance IN ('must_match', 'prefer_match', 'doesnt_matter')),
  relocate TEXT CHECK (relocate IN ('yes', 'maybe', 'no')),
  occupation TEXT,
  typical_week TEXT,
  looking_for TEXT CHECK (looking_for IN ('marriage', 'committed', 'companionship')),
  own_words TEXT,
  published_at INTEGER,                       -- set once every section is done and the member publishes
  updated_at INTEGER NOT NULL
);
