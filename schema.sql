CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'ud',
  category TEXT NOT NULL DEFAULT 'otros',
  expiry_date TEXT NOT NULL,
  date_kind TEXT NOT NULL DEFAULT 'caducidad',
  stored_on TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id)
);
CREATE INDEX IF NOT EXISTS idx_items_household ON items(household_id, status, expiry_date);

CREATE TABLE IF NOT EXISTS shopping_items (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  source_item_id TEXT UNIQUE,
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'ud',
  category TEXT NOT NULL DEFAULT 'otros',
  checked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id)
);
CREATE INDEX IF NOT EXISTS idx_shopping_household ON shopping_items(household_id, checked, category, created_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id)
);
CREATE INDEX IF NOT EXISTS idx_push_household ON push_subscriptions(household_id);

CREATE TABLE IF NOT EXISTS notification_events (
  item_id TEXT NOT NULL,
  days_before INTEGER NOT NULL,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, days_before)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  household_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS claimed_households (
  household_id TEXT PRIMARY KEY,
  FOREIGN KEY (household_id) REFERENCES households(id)
);

CREATE TABLE IF NOT EXISTS household_links (
  token_hash TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
