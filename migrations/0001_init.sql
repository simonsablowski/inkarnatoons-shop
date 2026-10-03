-- Judas & Jesus Shop: Grundschema

CREATE TABLE categories (
  slug     TEXT PRIMARY KEY,
  name_de  TEXT NOT NULL,
  name_en  TEXT NOT NULL,
  sort     INTEGER NOT NULL DEFAULT 0
);

INSERT INTO categories (slug, name_de, name_en, sort) VALUES
  ('film',      'DVDs & Film',         'DVDs & film',        10),
  ('originale', 'Originalzeichnungen', 'Original drawings',  20),
  ('shirts',    'T-Shirts',            'T-shirts',           30),
  ('sonstiges', 'Sonstiges',           'Other',              40);

CREATE TABLE products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  category    TEXT NOT NULL REFERENCES categories(slug),
  name_de     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  desc_de     TEXT NOT NULL DEFAULT '',
  desc_en     TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  weight_g    INTEGER NOT NULL DEFAULT 0 CHECK (weight_g >= 0),
  is_unique   INTEGER NOT NULL DEFAULT 0,   -- Einzelstück (z. B. Originalzeichnung)
  active      INTEGER NOT NULL DEFAULT 0,   -- 0 = Entwurf, im Shop nicht sichtbar
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_products_category ON products(category, active);

-- Jedes Produkt hat mindestens eine Variante. Der Bestand hängt an der Variante
-- (z. B. T-Shirt-Größen). Produkte ohne Auswahl haben eine Variante mit leerem Label.
CREATE TABLE variants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label      TEXT NOT NULL DEFAULT '',
  sku        TEXT,
  stock      INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sort       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_variants_product ON variants(product_id);

CREATE TABLE images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,   -- "/img/..." (statisch) oder "/media/..." (Upload in R2)
  sort       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_images_product ON images(product_id);

CREATE TABLE orders (
  id                TEXT PRIMARY KEY,           -- z. B. JJ-7K2M9Q
  token             TEXT NOT NULL,              -- geheimer Teil des Links zur Bestellübersicht
  status            TEXT NOT NULL,              -- pending_payment | paid | shipped | cancelled | expired
  language          TEXT NOT NULL DEFAULT 'de',
  country           TEXT NOT NULL,
  email             TEXT,
  customer_name     TEXT,
  phone             TEXT,
  shipping_address  TEXT,                       -- JSON, kommt nach der Zahlung von Stripe
  subtotal_cents    INTEGER NOT NULL,
  shipping_cents    INTEGER NOT NULL,
  total_cents       INTEGER NOT NULL,
  currency          TEXT NOT NULL,
  weight_g          INTEGER NOT NULL DEFAULT 0,
  shipping_zone     TEXT,
  payment_method    TEXT,
  stripe_session_id TEXT,
  stripe_payment_id TEXT,
  hold_expires_at   TEXT,
  tracking          TEXT,
  note              TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_orders_status ON orders(status, created_at);

CREATE TABLE order_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id    INTEGER,
  product_id    INTEGER,
  name          TEXT NOT NULL,   -- Produktname zum Zeitpunkt der Bestellung
  variant_label TEXT NOT NULL DEFAULT '',
  sku           TEXT,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  unit_cents    INTEGER NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
