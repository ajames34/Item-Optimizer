-- PostgreSQL schema
-- Run via: node src/db/migrate.js
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id             SERIAL  PRIMARY KEY,
  user_id        TEXT    NOT NULL DEFAULT '',
  item_name      TEXT    NOT NULL,
  brand          TEXT    NOT NULL,
  size           TEXT,
  condition      TEXT    DEFAULT 'New'
                         CHECK (condition IN ('New', 'Like New', 'Good', 'Fair')),
  purchase_price NUMERIC(10,2) DEFAULT 0,
  date_acquired  DATE,
  notes          TEXT,
  status         TEXT    DEFAULT 'In Stock'
                         CHECK (status IN ('In Stock', 'Sold')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id             SERIAL  PRIMARY KEY,
  user_id        TEXT    NOT NULL DEFAULT '',
  inventory_id   INTEGER NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
  sale_price     NUMERIC(10,2) NOT NULL CHECK (sale_price > 0),
  platform       TEXT    NOT NULL
                         CHECK (platform IN ('StockX', 'eBay', 'Poshmark', 'Depop')),
  platform_fee   NUMERIC(10,2) NOT NULL,
  shipping_cost  NUMERIC(10,2) DEFAULT 0,
  net_profit     NUMERIC(10,2) NOT NULL,
  date_sold      DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes — include user_id for efficient per-user queries
CREATE INDEX IF NOT EXISTS idx_inventory_user_id    ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status      ON inventory(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_user_id         ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_inventory_id    ON sales(inventory_id);
CREATE INDEX IF NOT EXISTS idx_sales_platform        ON sales(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_sales_date_sold       ON sales(user_id, date_sold);
