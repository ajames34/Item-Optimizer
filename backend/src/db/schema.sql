-- SQLite schema (local dev fallback)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT    NOT NULL DEFAULT '',
  item_name      TEXT    NOT NULL,
  brand          TEXT    NOT NULL,
  size           TEXT,
  condition      TEXT    DEFAULT 'New'
                         CHECK (condition IN ('New', 'Like New', 'Good', 'Fair')),
  purchase_price REAL    DEFAULT 0,
  date_acquired  TEXT,
  notes          TEXT,
  status         TEXT    DEFAULT 'In Stock'
                         CHECK (status IN ('In Stock', 'Sold')),
  created_at     TEXT    DEFAULT (datetime('now')),
  updated_at     TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT    NOT NULL DEFAULT '',
  inventory_id   INTEGER NOT NULL REFERENCES inventory(id),
  sale_price     REAL    NOT NULL,
  platform       TEXT    NOT NULL
                         CHECK (platform IN ('StockX', 'eBay', 'Poshmark', 'Depop')),
  platform_fee   REAL    NOT NULL,
  shipping_cost  REAL    DEFAULT 0,
  net_profit     REAL    NOT NULL,
  date_sold      TEXT,
  notes          TEXT,
  created_at     TEXT    DEFAULT (datetime('now'))
);
