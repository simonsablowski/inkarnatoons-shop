-- Themenwelten: Judas & Jesus, Wild Wolf, King of Fools, Kartenspiel Schwarzer Peter

INSERT INTO worlds (slug, name, tagline_de, tagline_en, image, sort) VALUES
  ('king-of-fools',   'King of Fools',               'Platzhalter: Beschreibung folgt', 'Placeholder: description to follow', NULL, 30),
  ('schwarzer-peter', 'Kartenspiel Schwarzer Peter', 'Platzhalter: Beschreibung folgt', 'Placeholder: description to follow', NULL, 40);

UPDATE products SET world = 'schwarzer-peter' WHERE world = 'kartenspiel';
DELETE FROM worlds WHERE slug = 'kartenspiel';
UPDATE worlds SET sort = 20 WHERE slug = 'wild-wolf';
UPDATE worlds SET tagline_de = 'Merch zum Zeichentrickfilm und der Film zum Ansehen',
                  tagline_en = 'Merch from the animated film, and the film to watch'
  WHERE slug = 'judas-jesus';
