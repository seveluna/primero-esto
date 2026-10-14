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

INSERT OR IGNORE INTO shopping_items (id, household_id, source_item_id, name, quantity, unit, category)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
       household_id, id, name, quantity, unit, category
FROM items
WHERE status = 'consumed';
