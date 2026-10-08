# Hinweise für Claude

Diese Datei fasst zusammen, was beim Arbeiten an diesem Projekt wichtig ist und nicht schon aus Code und README hervorgeht. Technische Details stehen in der README.

## Projekt und Beteiligte

- Online-Shop „Inkarnatoons Shop“ für die Filmemacher Olaf Encke und Claudia Romero (Inkarnatoons). Mehrere Themenwelten: Judas & Jesus (Merch und der Film zum kostenlosen Ansehen), Wild Wolf, King of Fools, Kartenspiel Schwarzer Peter.
- Simon Sablowski baut den Shop für die beiden. Er hat am Film mitgearbeitet. Wünsche von Olaf und Claudia kommen meist über Simon, oft als weitergeleitete Chatnachrichten.
- Live unter https://shop.inkarnatoons.com (CNAME bei STRATO auf judas-jesus-shop.pages.dev).

## Zusammenarbeit mit Simon

- Mit Simon auf Deutsch sprechen, immer „du“. Fließende, ganze Sätze, keine Gedankenstriche, keine Stichwort-Stakkatos.
- Git: Commit-Nachrichten immer auf Englisch, kurz, im Imperativ. Claude committet und pusht direkt auf `main`. Autor: Simon Sablowski <simonsablowski@users.noreply.github.com>.
- Simon arbeitet unter Windows im Ordner `D:\Development\inkarnatoons-shop`. Nach einem Push sagt Claude ihm, was er ausführen muss, in der Regel:
  ```
  git pull
  npm run db:remote   (nur wenn es eine neue Datei in migrations/ gibt)
  npm run deploy
  ```
- Claude deployt nicht selbst und hat keinen Zugang zu Cloudflare. Den Online-Shop kann Claude aus seiner Umgebung meist nicht abrufen, Simon prüft das Ergebnis im Browser.
- Große Dateien (Videos, Olafs Rohdateien) sind nicht im Repository, sondern nur in Simons Ordner unter `import/` (siehe `.gitignore`). Wenn die Sitzung mit Simons Rechner verbunden ist, lassen sie sich dort lesen und schreiben. Dateien über 400 MB lassen sich nicht direkt holen, dafür gibt es `npm run split` (zerlegt) und `npm run film:join` (setzt zusammen).
- Vor größeren Änderungen am Aussehen lokal testen (`npm run dev`, siehe README) und Bildschirmfotos ansehen. Die Altersabfrage erscheint zuerst, im Test auf `#age-yes` klicken. Das Chromium in der Testumgebung spielt kein H.264 ab, Videos lassen sich dort also nicht abspielen.

## Feste Regeln

- **Cloudflare-Namen nicht ändern:** Pages-Projekt `judas-jesus-shop`, D1-Datenbank `judas-jesus-shop`, R2-Speicher `judas-jesus-shop-media`. Sie lassen sich bei Cloudflare nicht umbenennen und stehen in `wrangler.toml`, `package.json` und `scripts/setup-cloudflare.mjs`. `database_id` und `PUBLIC_URL` in `wrangler.toml` sind die echten Werte.
- **Gestaltung nach Olafs Vorgaben:** sachlich, flächig, comicartig 2D. Nur Schwarz, Weiß und ein Rot (`--red: #e2001a`, gemessen aus Olafs Zeichnungen). Eine Schrift (Figtree) für alles, auch Preise und Überschriften. Gezeichnet sind nur der Schriftzug des Shops (`public/img/marke/logo.png`) und die Titel in den Kacheln der Themenwelten. Keine runden Ecken, keine Schatten. Oben schwarz, unten weiß. Andere Farbvarianten für den unteren Bereich wurden ausprobiert und verworfen.
- **Altersabfrage ab 18** vor allen Seiten außer der Rechtsseite. Der Film enthält Nacktheit und erotische Inhalte, das Publikum sind vor allem Erwachsene.
- **Zwei Originalzeichnungen werden nicht in den Shop aufgenommen:** „Secret Snapshot Toilet“ und „Mary M. Wanna Be Cool“ zeigen die Figur als Jugendliche. Claude hilft nicht dabei, diese Motive zu veröffentlichen oder zu verkaufen, auch nicht in abgewandelter Form. Die übrigen Zeichnungen zeigen die erwachsene Figur und sind in Ordnung.
- **Produkttexte nur auf Englisch:** Name und Beschreibung der Produkte pflegen Olaf und Claudia auf Englisch. Die Oberfläche des Shops ist zweisprachig (Deutsch und Englisch).
- **Keine fremde Musik:** Keine Musik ohne Rechte veröffentlichen, auch nicht verfremdet oder „per KI bearbeitet“.

## Inhalte und Stand

- **Produkte:** Sie kommen aus einem Google Sheet (ID steht in `shop.config.json` unter `import`) und werden mit `npm run import` eingespielt, Bilder aus `import/bilder`. Olaf und Claudia pflegen das Sheet. Geplant sind zum Start etwa 25 Produkte.
- **Themenwelten:** Kachel, Schriftzug und Figur werden in der Verwaltung (`/admin.html`) hochgeladen und liegen in R2. Olafs Kacheln für Judas & Jesus, Wild Wolf und Schwarzer Peter sowie die einzelne Maria Magdalena (Figur, gespiegelt links neben der Judas & Jesus Kachel) sind eingebaut. King of Fools hat noch keine Kachel. Die Kacheln enthalten den gezeichneten Titel schon selbst.
- **Film:** Vier Fassungen in `shop.config.json` unter `film.versions` (Reihenfolge: Film, Rough Animation, Layout-Animatic, Thumbnail-Animatic). Die Videos liegen in R2 unter `film/…`, Upload mit `npm run film:upload -- --target online`. Der Hauptfilm ist die Originaldatei (H.264, Stereo als erste und 5.1 als zweite Tonspur, Browser spielen Stereo).
- **Musikrechte, offen:**
  - Das Thumbnail-Animatic enthielt fremde Musik. Es gibt eine stumme Fassung und eine, deren Bild an den Ton des Layout-Animatics angepasst ist. Im Moment zeigt `film.versions` auf die Layout-Ton-Fassung. Ob Simon sie schon hochgeladen hat, ist offen.
  - Claudia hat im Layout-Animatic fremde Musik gefunden: 0:55 bis 1:28 (Stimme von Peter Alexander), 14:23 bis 14:41 (Bollywood), 14:59 bis 15:04 (Disney). Das betrifft auch die Thumbnail-Fassung mit Layout-Ton.
  - Claudia will die Musikschnitte selbst von Hand machen. Ob die betroffenen Abschnitte bis dahin stummgeschaltet werden, ist offen. Claude hat es angeboten, Simon hat noch nicht entschieden.
- **Ko-fi:** Der Button ist ein Platzhalter, bis der Name der Ko-fi-Seite feststeht (`kofi.name`).

## Noch nicht erledigt

- Stripe (Testlauf) und Resend (E-Mail) sind nicht eingerichtet, bisher nur lokal mit `DEV_FAKE_PAYMENT` getestet.
- Firmendaten (`seller`), Steuerart, Rechtstexte, Verpackungsregister, Jugendschutz beim Versand der FSK-16-DVD: Das müssen Olaf und Claudia klären.
- Ob Stripe, PayPal und Ko-fi erotische Inhalte erlauben, ist ungeklärt.
- Versand: eine günstigere Stufe für kleine Sendungen fehlt, die Tarife basieren auf DHL Paket für Privatkunden.
- Formate der Zeichnungen stehen bisher nur im Sheet unter „Anmerkungen“ und werden im Shop nicht angezeigt (eine Spalte „Format“ wurde angeboten).
- Die Domain inkarnatoons.com läuft am 29. Oktober 2026 ab (Registrar Cronon/STRATO) und muss verlängert werden.
