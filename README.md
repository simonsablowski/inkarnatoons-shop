# Inkarnatoons Shop (Projekt jj-shop)

Online-Shop mit mehreren Themenwelten unter einem gemeinsamen Dach: Judas & Jesus (Merch und Film ansehen), Wild Wolf, King of Fools und das Kartenspiel Schwarzer Peter. Deutsch und Englisch, mit weltweitem Versand. Der Name des Dachs ist vorläufig und steht in `shop.config.json` unter `brand`.
Cloudflare Pages liefert die Seite aus, Pages Functions bilden die API, eine D1-Datenbank speichert Produkte, Bestände und Bestellungen, ein R2-Speicher die hochgeladenen Produktfotos. Bezahlt wird über Stripe Checkout (Kreditkarte und PayPal).

## Was der Shop kann

- Startseite mit den Themenwelten als Kacheln. Jede Welt hat ihre eigene Übersicht.
- Die Übersicht von Judas & Jesus zeigt neben der Titelkarte den Film zum kostenlosen Anschauen, darunter das Merch.
- Produktübersicht mit Kategorien, Suche, Sortierung, Höchstpreis und „nur lieferbare Artikel“. Die Filter stehen in der Adresse und lassen sich verlinken.
- Detailansicht mit Bildergalerie, Varianten (z. B. Größen) und Bestandsanzeige. Einzelstücke (Originalzeichnungen) werden als solche gekennzeichnet und nach dem Verkauf als „Verkauft“ gezeigt.
- Altersabfrage ab 18 vor allen Seiten des Shops (Selbstauskunft). Die Seite mit Impressum und Datenschutz bleibt ohne Abfrage erreichbar.
- Wunschliste und Warenkorb ohne Kundenkonto. Beide liegen nur im Browser.
- Versandkosten nach Lieferland (Zone) und Gesamtgewicht, berechnet auf dem Server.
- Bezahlung per Kreditkarte und PayPal über Stripe Checkout. Die Lieferadresse wird dort abgefragt.
- Bestandsführung: Beim Gang zur Kasse wird die Ware reserviert. Wird nicht bezahlt, geht sie nach gut einer halben Stunde zurück in den Bestand.
- Bestätigungsmail an die Kundin oder den Kunden (in der gewählten Sprache), Benachrichtigung an den Shop, Versandmail mit Sendungsnummer.
- Verwaltung unter `/admin.html`: Produkte anlegen und ändern, Bestände pflegen, Fotos hochladen, Bestellungen ansehen, als versendet markieren, stornieren.
- Rechnung (A4) und Adressaufkleber pro Bestellung als Druckansicht, mit fortlaufender Rechnungsnummer.
- Keine Cookies, kein Tracking, keine externen Schriften.

## Lokal entwickeln

Einmalig (Windows-Eingabeaufforderung):
```
npm install
copy .dev.vars.example .dev.vars
npm run db:local
npm run seed:local
```
Danach jedes Mal:
```
npm run dev
```
Seite: http://localhost:8788, Verwaltung: http://localhost:8788/admin.html (Passwort aus `.dev.vars`).

`npm run seed:local` füllt den Shop mit acht Platzhalterprodukten. Solange in `.dev.vars` kein Stripe-Schlüssel steht und `DEV_FAKE_PAYMENT=1` gesetzt ist, wird eine Bestellung lokal sofort als bezahlt markiert. So lässt sich der ganze Ablauf ohne Stripe ausprobieren.

## Einstellungen ändern

Alles Wichtige steht in `shop.config.json`:

| Einstellung | Bedeutung |
|---|---|
| `brand.name`, `brand.suffix`, `shopName` | Name des gemeinsamen Dachs in Kopfzeile, Seitentiteln und E-Mails |
| `ageGate.enabled`, `ageGate.minAge`, `ageGate.rememberDays`, `ageGate.exitUrl` | Altersabfrage vor dem Shop: an/aus, Mindestalter (18), wie viele Tage sich der Browser die Bestätigung merkt, und wohin der Link für Jüngere führt |
| `currency` | Währung des Shops (EUR) |
| `seller` | Firmenname, Anschrift, Steuernummer, USt-IdNr. für Rechnung und Adressaufkleber |
| `tax.mode`, `tax.ratePercent` | `vat` weist die enthaltene Umsatzsteuer aus, `small_business` druckt den Hinweis nach § 19 UStG |
| `invoice.prefix` | Anfang der Rechnungsnummer, z. B. `RE-` ergibt `RE-2026-0001` |
| `label.widthMm`, `label.heightMm` | Größe des Adressaufklebers, passend zum Etikettendrucker |
| `film.world`, `film.provider`, `film.id` | Welt, auf deren Übersicht der Film erscheint, und die Videoquelle: `youtube`, `vimeo` oder `file` mit Video-ID bzw. Dateiadresse. Leer zeigt einen Platzhalter |
| `film.versions` | Mehrere Fassungen zum Umschalten (fertiger Film, Animatics). Sind Fassungen eingetragen, gelten sie anstelle von `provider` und `id`. Siehe „Filme hochladen“ |
| `kofi.name`, `kofi.show` | Name der Ko-fi-Seite für den Button „Auf Ko-fi unterstützen“ unter dem Film. Ohne Namen erscheint er als Platzhalter, `show: false` blendet ihn aus |
| `payments.methods` | Zahlarten in Stripe Checkout: `card`, `paypal` |
| `payments.holdMinutes` | So lange bleibt die Bezahlseite offen (Stripe verlangt mindestens 30 Minuten) |
| `shipping.zones` | Versandzonen mit Ländern und Preisstufen nach Gewicht (Preise in Cent) |
| `shipping.packagingWeightG` | Gewicht der Verpackung, wird zu jeder Bestellung addiert |
| `shipping.freeShippingFromCents` | Warenwert, ab dem der Versand kostenlos ist (`null` = nie) |
| `shipping.excludedCountries` | Länder, in die nicht geliefert wird |

Die Versandpreise sind ein Vorschlag auf Basis der DHL-Preise für Privatkunden mit Online-Frankierung (DHL Paket 2, 5, 10 und 20 kg, Stand 3.10.2026) und sollten vor dem Start geprüft werden. Das Gewicht jedes Produkts wird in der Verwaltung gepflegt. Ist eine Bestellung schwerer als die höchste Stufe einer Zone, kann sie nicht bestellt werden und der Warenkorb zeigt einen Hinweis.

Themenwelten und Kategorien werden in der Verwaltung gepflegt (siehe unten). Texte der Oberfläche stehen in `public/i18n/de.json` und `public/i18n/en.json`. Rechtstexte (AGB, Widerruf, Datenschutz, Impressum) sind in `public/legal.html` noch Platzhalter.

Nach jeder Änderung neu deployen.

## Produkte und Bestände pflegen

In der Verwaltung unter „Produkte & Bestand“:

1. „Neues Produkt anlegen“, Name, Kategorie, Preis und Gewicht eintragen, speichern.
2. Danach Fotos hochladen. Das erste Bild ist das Titelbild in der Übersicht.
3. Varianten: Ein Produkt ohne Auswahl hat eine Variante ohne Bezeichnung. Für T-Shirts je Größe eine Variante mit eigenem Bestand anlegen.
4. „Im Shop sichtbar“ ankreuzen, sobald das Produkt fertig ist. Vorher bleibt es ein Entwurf.

Der Bestand lässt sich auch direkt in der Produktliste ändern. Bezahlte Bestellungen verringern ihn automatisch, Stornierungen buchen ihn zurück.

## Themenwelten und Kategorien pflegen

In der Verwaltung unter „Themenwelten & Kategorien“ lassen sich Themenwelten anlegen, umbenennen, mit Kurztext (deutsch und englisch), Kachelbild, gezeichnetem Schriftzug und Figur versehen und mit den Pfeilen in die gewünschte Reihenfolge bringen. Die Reihenfolge gilt für die Kacheln auf der Startseite und für das Menü. Kategorien lassen sich dort ebenfalls anlegen, umbenennen und sortieren. Löschen geht nur, solange keine Produkte zugeordnet sind. Die Adresse einer Themenwelt (`/?world=…`) bleibt beim Umbenennen gleich, damit Links weiter funktionieren.

## Aussehen: Schwarz, Weiß, Rot

Der Shop ist bewusst sachlich und flächig gehalten: nur Schwarz, Weiß und ein einziger Rotton, eine Schrift für alles (auch Preise), keine runden Ecken, keine Schatten. Gezeichnet sind nur der Schriftzug des Shops und die Titel der Themenwelten, beides Bilddateien.

- **Rotton:** steht einmal in `public/css/style.css` als `--red` und gilt überall.
- **Unterer Bereich weiß oder schwarz:** `theme.lower` in `shop.config.json` (`"white"` oder `"black"`). Zum Ausprobieren ohne Änderung die Adresse mit `?lower=black` oder `?lower=white` aufrufen, das gilt, solange der Tab offen ist.
- **Schriftzug des Shops:** Bilddatei (weiß auf Schwarz oder mit transparentem Hintergrund) nach `public/img/marke/` legen und den Pfad in `shop.config.json` unter `brand.logo` eintragen, z. B. `"/img/marke/logo.png"`. Ohne Eintrag steht der Name als Text da.
- **Bilder der Themenwelten:** in der Verwaltung unter „Themenwelten & Kategorien“ je Welt drei Plätze: Kachel (Bild auf der Startseite), Schriftzug (gezeichneter Titel, ersetzt den Namen als Text) und Figur (steht gespiegelt links neben der Kachel und ragt nur ein Stück hinein, z. B. Maria Magdalena bei Judas & Jesus, am besten PNG ohne Hintergrund).
- **Großansicht:** Auf der Produktseite öffnet ein Klick auf das Bild die Großansicht. Ein weiterer Klick holt die angeklickte Stelle nah heran, bei hoch aufgelösten Bildern bis zur vollen Auflösung. Für gute Detailansichten Bilder mit etwa 2500 bis 3000 Pixeln an der langen Seite hochladen (höchstens 8 MB). Mehrere Bilder je Produkt sind möglich, etwa eine zusätzliche Nahaufnahme.

## Produktliste aus Google Sheets übernehmen

Die Produktliste liegt in Google Sheets (Blatt „Produkte“, Aufbau wie in der Vorlage). Welche Tabelle gelesen wird, steht in `shop.config.json` unter `import`. Die Tabelle muss für „Jeder, der über den Link verfügt“ lesbar sein. Die Produktbilder liegen im Ordner `import/bilder`, ihre Dateinamen stehen in der Spalte „Bilddateien“.

```
npm run import                                  # Probelauf gegen den lokalen Shop, ändert nichts
npm run import -- --write                   # übernimmt die Produkte lokal (dazu muss npm run dev laufen)
npm run import -- --target online                 # Probelauf gegen den Shop bei Cloudflare
npm run import -- --target online --write     # übernimmt die Produkte online, fragt nach dem Passwort der Verwaltung
```

Der Probelauf listet jede Zeile mit Fehlern (✗, die Zeile wird übersprungen) und Hinweisen (!). Produkte werden über ihren Namen wiedererkannt (wird ein Produkt in der Liste umbenannt, legt der Import es neu an): Beim erneuten Import werden vorhandene geändert, neue angelegt. Fehlende Themenwelten und Kategorien legt der Import selbst an.

| Schalter | Wirkung |
|---|---|
| `--stock` | übernimmt bei vorhandenen Produkten auch die Stückzahlen aus der Liste. Ohne den Schalter bleibt der Bestand im Shop unangetastet, damit ein erneuter Import keine Verkäufe überschreibt |
| `--replace-images` | ersetzt bei vorhandenen Produkten die Bilder. Ohne den Schalter bekommen nur Produkte ohne Bilder welche |
| `--delete-others` | löscht Produkte, die nicht in der Liste stehen, zum Beispiel die Platzhalter |
| `--file liste.csv` | liest eine CSV-Datei statt Google Sheets (in Sheets: Datei → Herunterladen → CSV) |

„Zum Start dabei?“ = nein legt das Produkt als Entwurf an, es ist dann im Shop nicht sichtbar.

Name und Beschreibung dürfen in nur einer Sprache ausgefüllt sein, zum Beispiel nur auf Englisch. Der Text gilt dann für beide Sprachen des Shops. Die Adresse eines Produkts richtet sich nach dem englischen Namen, ersatzweise nach dem deutschen.

## Rechnung, Adressaufkleber und Film

In der Verwaltung unter „Bestellungen“ öffnen die Links „Rechnung“ und „Adressaufkleber“ eine Druckansicht in einem neuen Tab. Über den Druckdialog lässt sich die Rechnung drucken oder als PDF speichern, der Aufkleber geht an den Etikettendrucker. Die Rechnungsnummer wird beim Zahlungseingang fortlaufend vergeben. Die Rechnung erscheint in der Sprache der Bestellung. Der Film steht auf der Übersichtsseite von Judas & Jesus. Bei YouTube und Vimeo lädt das Video erst nach einem Klick, vorher werden keine Daten dorthin übertragen.

## Filme hochladen

Die Videodateien liegen im selben Speicher wie die Produktbilder (R2) und werden vom Shop selbst ausgeliefert, ohne YouTube oder Vimeo. Welche Fassungen es gibt, steht in `shop.config.json` unter `film.versions`: Titel, kurzer Satz, Adresse im Speicher (`src`), Standbild (`poster`) und die Quelle auf diesem Rechner (`upload`, eine Datei oder ein Ordner mit Teilen, die aneinandergehängt werden).

```
npm run film:upload -- --target online            # alle Fassungen hochladen, schon vorhandene werden übersprungen
npm run film:upload -- --target online --only film --force   # eine Fassung ersetzen
```

Das Skript fragt nach dem Passwort der Verwaltung und überträgt in Stücken von 20 MB, darum gehen auch sehr große Dateien. Ohne `--target online` lädt es in den lokalen Testshop (`npm run dev` muss laufen). Videos müssen MP4 mit H.264-Bild und AAC-Ton sein, damit sie in allen Browsern laufen. Die Rohdateien in `import/` werden nicht mit veröffentlicht.

## Änderungen einspielen (nach der ersten Einrichtung)

```
npm run db:remote     # neue Datenbankänderungen aus migrations/ einspielen
npm run deploy        # Seite und API deployen
```
`npm run seed:remote` ersetzt alle Produkte durch die Platzhalter aus `seed/demo.sql`.

## Einrichtung bei Cloudflare (einmalig)

Am einfachsten in einem Schritt:
```
npm install
npm run setup:cloudflare
```
Das Skript meldet dich bei Cloudflare an, legt Datenbank, Bildspeicher und Pages-Projekt an, trägt die `database_id` in `wrangler.toml` ein, spielt Schema und Platzhalterprodukte ein, setzt ein Passwort für die Verwaltung und deployt. Es kann beliebig oft laufen. Spätere Deployments: `npm run deploy`.

Die einzelnen Schritte von Hand:

```
npm install
npx wrangler login
npx wrangler d1 create judas-jesus-shop
npx wrangler r2 bucket create judas-jesus-shop-media
```
Die ausgegebene `database_id` in `wrangler.toml` eintragen, dann:
```
npm run db:remote
npx wrangler pages project create judas-jesus-shop --production-branch main
```
R2 muss im Cloudflare-Konto einmal aktiviert werden (Dashboard → R2).

Secrets setzen (jeweils wird nach dem Wert gefragt):
```
npx wrangler pages secret put ADMIN_TOKEN            # Passwort für /admin.html
npx wrangler pages secret put SHOP_EMAIL             # Adresse für Bestellbenachrichtigungen
npx wrangler pages secret put RESEND_API_KEY         # E-Mail-Versand
npx wrangler pages secret put STRIPE_SECRET_KEY      # zuerst Testschlüssel sk_test_...
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET  # whsec_...
```
In `wrangler.toml` `MAIL_FROM` und `PUBLIC_URL` auf die echte Adresse setzen. Deployen:
```
npm run deploy
```
Für eine Vorschau mit den Platzhalterprodukten: `npm run seed:remote`. Achtung, das Skript löscht vorher alle vorhandenen Produkte.

### Stripe

1. Unter *Settings → Payment methods* Karte und PayPal aktivieren. Ist PayPal dort nicht aktiv, lehnt Stripe die Bezahlseite ab. Zum Testen kann in `shop.config.json` vorübergehend nur `["card"]` stehen.
2. Unter *Developers → Webhooks* einen Endpunkt auf `https://<domain>/api/stripe-webhook` anlegen, mit den Ereignissen `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` und `checkout.session.expired`.
3. `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` als Secrets setzen.

Ablauf: Der Shop berechnet Preise und Versand auf dem Server, reserviert den Bestand und leitet zu Stripe weiter. Dort ist als Lieferland nur das im Warenkorb gewählte Land möglich, weil die Versandkosten dafür berechnet wurden. Erst wenn Stripe die Zahlung meldet, gilt die Bestellung als bezahlt und die Mails gehen raus. Erstattungen werden im Stripe-Dashboard ausgelöst.

### E-Mail (Resend)

Konto bei resend.com anlegen, die Absender-Domain hinzufügen, die angezeigten DNS-Einträge (SPF/DKIM) beim Domain-Anbieter eintragen, API-Key erzeugen und als `RESEND_API_KEY` setzen. Ohne Key werden Mails nur ins Log geschrieben, Bestellungen funktionieren trotzdem.

### Eigene Domain

In Cloudflare Pages unter *Custom domains* die Domain hinzufügen und den genannten DNS-Eintrag beim Domain-Anbieter anlegen. Danach `PUBLIC_URL` in `wrangler.toml` anpassen, neu deployen und die Webhook-Adresse in Stripe ändern.

Der Shop läuft unter `shop.inkarnatoons.com` (CNAME-Eintrag bei STRATO, wo die Domain `inkarnatoons.com` liegt). Aufrufe der technischen Adresse `judas-jesus-shop.pages.dev` leitet `functions/_middleware.js` dauerhaft auf die Adresse aus `PUBLIC_URL` um.

### Verwaltung absichern

`/admin.html` ist mit `ADMIN_TOKEN` geschützt. Zusätzlich lässt sich in Cloudflare Zero Trust eine Access-Regel für `/admin.html` und `/api/admin/*` anlegen, die nur bestimmte E-Mail-Adressen zulässt.

## Offene Punkte vor dem Start

- Name des gemeinsamen Dachs und Domain.
- Firmendaten für Rechnung und Aufkleber (`seller`) und die Steuerart (`tax.mode`).
- Videoquelle für den Film und Name der Ko-fi-Seite.
- Echte Produkte, Fotos, Texte, Preise und Gewichte, auch für Wild Wolf, King of Fools und Schwarzer Peter.
- Versandtarife bestätigen (bisher DHL Paket für Privatkunden), Länderzuordnung der Zonen prüfen und entscheiden, in welche Länder geliefert wird.
- Rechtstexte: AGB, Widerrufsbelehrung, Datenschutzerklärung, Impressum.
- Umsatzsteuer: Alle Preise gelten bisher als Bruttopreise für alle Länder, und die Rechnung weist immer den deutschen Steuersatz aus, auch bei Lieferungen ins Ausland. Ob für Verkäufe in andere EU-Länder das OSS-Verfahren nötig ist und wie Lieferungen in Drittländer besteuert werden, sollte die Steuerberatung der Betreiber klären.
- Altersfreigabe: Die DVD trägt eine FSK-16-Kennzeichnung. Ob daraus Pflichten für den Versandhandel folgen, sollten die Betreiber prüfen lassen.
- Die Bilder in `public/img` sind kleine Web-Fassungen. Für den fertigen Shop werden Originaldateien in höherer Auflösung gebraucht.

## Aufbau

```
shop.config.json            Währung, Zahlarten, Versandzonen und -preise
wrangler.toml               Cloudflare-Konfiguration
migrations/                 Datenbankschema (D1)
seed/demo.sql               Platzhalterprodukte
functions/api/              API-Endpunkte
  config.js                 öffentliche Einstellungen, Kategorien, Länder
  products.js, products/    Produktliste mit Filtern, Detailansicht
  cart.js                   Warenkorb bewerten (Preise, Verfügbarkeit, Versand)
  checkout.js               Bestand reservieren, Bestellung anlegen, zu Stripe leiten
  orders/                   Bestellübersicht für Kundinnen und Kunden
  stripe-webhook.js         Zahlungsereignisse
  admin/                    Verwaltung (Produkte, Bilder, Bestellungen)
functions/media/            Auslieferung der hochgeladenen Bilder aus R2
functions/_lib/             gemeinsame Logik (Katalog, Bestellungen, Versand, Stripe, Mail)
public/                     Website (HTML, CSS, JS, Sprachdateien, Schriften, Bilder)
  print.html                Druckansicht für Rechnung und Adressaufkleber
scripts/setup-cloudflare.mjs  Ersteinrichtung bei Cloudflare
scripts/import-produkte.mjs   Import der Produktliste aus Google Sheets
import/bilder/                Produktbilder für den Import
```

Überverkäufe sind ausgeschlossen: Der Bestand wird in einer einzigen Datenbankanweisung geprüft und abgezogen.
