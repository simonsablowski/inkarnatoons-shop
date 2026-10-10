-- Kurztexte unter den Kacheln nach Olafs Vorgaben (zweizeilig)

UPDATE worlds SET
  tagline_en = 'Merch, original drawings' || char(10) || 'and the film to watch',
  tagline_de = 'Merch, Originalzeichnungen' || char(10) || 'und der Film zum Ansehen'
WHERE slug = 'judas-jesus';

UPDATE worlds SET
  tagline_en = 'Coming in 2027' || char(10) || 'Wordless comic book, 90 pages',
  tagline_de = 'Erscheint 2027' || char(10) || 'Comic ohne Worte, 90 Seiten'
WHERE slug = 'wild-wolf';

UPDATE worlds SET
  tagline_en = 'Coming soon' || char(10) || 'Deck of cards, 53 animals',
  tagline_de = 'Demnächst erhältlich' || char(10) || 'Kartenspiel, 53 Tiere'
WHERE slug = 'schwarzer-peter';
