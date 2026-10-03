-- Platzhalterprodukte, damit der Shop gefüllt aussieht (npm run seed:local bzw. seed:remote).
-- Namen, Texte, Preise, Gewichte und Bestände sind erfunden und werden durch die echten Daten ersetzt.
-- Achtung: Das Skript löscht vorher alle vorhandenen Produkte.
DELETE FROM images; DELETE FROM variants; DELETE FROM products;

INSERT INTO products (id, slug, category, name_de, name_en, desc_de, desc_en, price_cents, weight_g, is_unique, active, sort) VALUES
 (1, 'judas-und-jesus-dvd', 'film', 'Judas & Jesus auf DVD', 'Judas & Jesus on DVD', 'Der Film auf DVD.

Platzhaltertext: Hier stehen später Laufzeit, Sprachen, Untertitel, Regionalcode und Bonusmaterial.', 'The film on DVD.

Placeholder text: running time, languages, subtitles, region code and extras will be listed here.', 1490, 120, 0, 1, 10),
 (2, 't-shirt-titelkarte', 'shirts', 'T-Shirt „Titelkarte“, schwarz', 'T-shirt "Title card", black', 'Schwarzes T-Shirt mit der Titelkarte des Films auf der Brust.

Platzhaltertext: Hier stehen später Material, Schnitt, Druckverfahren und Pflegehinweise.', 'Black T-shirt with the title card of the film on the chest.

Placeholder text: fabric, fit, print method and care instructions will be listed here.', 2400, 220, 0, 1, 20),
 (3, 't-shirt-judas-an-der-tuer', 'shirts', 'T-Shirt „Judas an der Tür“, natur', 'T-shirt "Judas at the door", natural', 'Naturfarbenes T-Shirt mit einer Szene aus dem Film.

Platzhaltertext: Hier stehen später Material, Schnitt, Druckverfahren und Pflegehinweise.', 'Natural-coloured T-shirt with a scene from the film.

Placeholder text: fabric, fit, print method and care instructions will be listed here.', 2400, 220, 0, 1, 30),
 (4, 'originalzeichnung-krippe', 'originale', 'Originalzeichnung „Krippe“', 'Original drawing "Manger"', 'Einzelstück aus der Produktion des Films.

Platzhaltertext: Hier stehen später Technik, Format, Signatur und die Szene, aus der das Blatt stammt.', 'One-off piece from the production of the film.

Placeholder text: technique, size, signature and the scene this sheet comes from will be listed here.', 18000, 300, 1, 1, 40),
 (5, 'originalzeichnung-altar', 'originale', 'Originalzeichnung „Altar“', 'Original drawing "Altar"', 'Einzelstück aus der Produktion des Films.

Platzhaltertext: Hier stehen später Technik, Format, Signatur und die Szene, aus der das Blatt stammt.', 'One-off piece from the production of the film.

Placeholder text: technique, size, signature and the scene this sheet comes from will be listed here.', 22000, 300, 1, 1, 50),
 (6, 'originalzeichnung-tuer', 'originale', 'Originalzeichnung „Tür“', 'Original drawing "Door"', 'Einzelstück aus der Produktion des Films. Dieses Blatt ist bereits verkauft.', 'One-off piece from the production of the film. This sheet has already been sold.', 16000, 300, 1, 1, 60),
 (7, 'poster-titelkarte', 'sonstiges', 'Poster „Titelkarte“', 'Poster "Title card"', 'Poster mit der Titelkarte des Films, gerollt verschickt.

Platzhaltertext: Hier stehen später Format, Papier und Druckverfahren.', 'Poster with the title card of the film, shipped rolled.

Placeholder text: size, paper and print method will be listed here.', 1200, 180, 0, 1, 70),
 (8, 'postkartenset', 'sonstiges', 'Postkartenset mit Filmszenen', 'Postcard set with film scenes', 'Sechs Postkarten mit Szenen aus dem Film im Umschlag.', 'Six postcards with scenes from the film in an envelope.', 800, 60, 0, 1, 80);

INSERT INTO products (id, slug, world, category, name_de, name_en, desc_de, desc_en, price_cents, weight_g, is_unique, active, sort) VALUES
 (9, 'kartenspiel', 'kartenspiel', 'spiele', 'Kartenspiel (Platzhalter)', 'Card game (placeholder)', 'Platzhalter für das Kartenspiel. Name, Beschreibung, Bilder und Preis folgen.', 'Placeholder for the card game. Name, description, pictures and price to follow.', 1500, 250, 0, 1, 90),
 (10, 'wild-wolf', 'wild-wolf', 'sonstiges', 'Wild Wolf (Platzhalter)', 'Wild Wolf (placeholder)', 'Platzhalter für Wild Wolf. Name, Beschreibung, Bilder und Preis folgen.', 'Placeholder for Wild Wolf. Name, description, pictures and price to follow.', 1500, 250, 0, 1, 100);

INSERT INTO variants (product_id, label, sku, stock, sort) VALUES
 (1, '', 'DVD-001', 40, 0),
 (2, 'S', 'TS-TITEL-S', 5, 10), (2, 'M', 'TS-TITEL-M', 12, 20), (2, 'L', 'TS-TITEL-L', 2, 30), (2, 'XL', 'TS-TITEL-XL', 0, 40),
 (3, 'S', 'TS-TUER-S', 4, 10), (3, 'M', 'TS-TUER-M', 8, 20), (3, 'L', 'TS-TUER-L', 6, 30), (3, 'XL', 'TS-TUER-XL', 3, 40),
 (4, '', 'ORIG-001', 1, 0),
 (5, '', 'ORIG-002', 1, 0),
 (6, '', 'ORIG-003', 0, 0),
 (7, '', 'POSTER-001', 30, 0),
 (8, '', 'PK-001', 25, 0),
 (9, '', 'KS-001', 20, 0),
 (10, '', 'WW-001', 20, 0);

INSERT INTO images (product_id, path, sort) VALUES
 (1, '/img/demo/dvd.jpg', 0), (1, '/img/dvd-cover.jpg', 1),
 (2, '/img/demo/shirt-titel.jpg', 0), (2, '/img/titelkarte.jpg', 1),
 (3, '/img/demo/shirt-tuer.jpg', 0), (3, '/img/szene-tuer.jpg', 1),
 (4, '/img/demo/original-krippe.jpg', 0),
 (5, '/img/demo/original-nagel.jpg', 0),
 (6, '/img/demo/original-tuer.jpg', 0),
 (7, '/img/demo/poster.jpg', 0),
 (8, '/img/demo/postkarten.jpg', 0), (8, '/img/szene-love-peace.jpg', 1), (8, '/img/szene-kreuz.jpg', 2),
 (9, '/img/platzhalter.svg', 0),
 (10, '/img/platzhalter.svg', 0);
