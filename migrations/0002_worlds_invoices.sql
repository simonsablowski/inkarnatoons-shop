-- Produktwelten (gemeinsames Dach für mehrere Marken) und Rechnungsnummern

CREATE TABLE worlds (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tagline_de  TEXT NOT NULL DEFAULT '',
  tagline_en  TEXT NOT NULL DEFAULT '',
  image       TEXT,                       -- Bild für die Kachel auf der Startseite
  sort        INTEGER NOT NULL DEFAULT 0
);

INSERT INTO worlds (slug, name, tagline_de, tagline_en, image, sort) VALUES
  ('judas-jesus', 'Judas & Jesus', 'DVDs, Originalzeichnungen und T-Shirts zum Zeichentrickfilm', 'DVDs, original drawings and T-shirts from the animated film', '/img/titelkarte.jpg', 10),
  ('kartenspiel', 'Kartenspiel',   'Platzhalter: Beschreibung folgt', 'Placeholder: description to follow', NULL, 20),
  ('wild-wolf',   'Wild Wolf',     'Platzhalter: Beschreibung folgt', 'Placeholder: description to follow', NULL, 30);

ALTER TABLE products ADD COLUMN world TEXT NOT NULL DEFAULT 'judas-jesus';
CREATE INDEX idx_products_world ON products(world, active);

ALTER TABLE orders ADD COLUMN paid_at TEXT;
ALTER TABLE orders ADD COLUMN invoice_number TEXT;
CREATE UNIQUE INDEX idx_orders_invoice ON orders(invoice_number) WHERE invoice_number IS NOT NULL;

-- Fortlaufender Zähler für Rechnungsnummern
CREATE TABLE counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT INTO counters (name, value) VALUES ('invoice', 0);

INSERT INTO categories (slug, name_de, name_en, sort) VALUES ('spiele', 'Spiele', 'Games', 35);
