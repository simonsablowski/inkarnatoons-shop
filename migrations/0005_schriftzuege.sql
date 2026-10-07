-- Gezeichnete Schriftzüge und Beifiguren der Themenwelten
-- image        Kachelbild auf der Startseite (wie bisher)
-- title_image  gezeichneter Schriftzug mit dem Namen der Themenwelt
-- figure_image einzelne Figur, die neben der Kachel steht (z. B. Maria Magdalena bei Judas & Jesus)

ALTER TABLE worlds ADD COLUMN title_image TEXT;
ALTER TABLE worlds ADD COLUMN figure_image TEXT;

-- Die Titelkarte war nur ein Platzhalter für die Kachel. Sie bleibt, bis das gezeichnete Kachelbild hochgeladen ist.
