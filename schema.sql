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
  expiry_date TEXT NOT NULL,
  date_kind TEXT NOT NULL DEFAULT 'caducidad',
  status TEXT NOT NULL DEFAULT 'available',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id)
);
CREATE INDEX IF NOT EXISTS idx_items_household ON items(household_id, status, expiry_date);

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
