# Judas & Jesus Shop

Online-Shop für Merchandise zum Zeichentrickfilm Judas & Jesus (DVDs, Originalzeichnungen, T-Shirts), auf Deutsch und Englisch, mit weltweitem Versand.
Cloudflare Pages liefert die Seite aus, Pages Functions bilden die API, eine D1-Datenbank speichert Produkte, Bestände und Bestellungen, ein R2-Speicher die hochgeladenen Produktfotos. Bezahlt wird über Stripe Checkout (Kreditkarte und PayPal).

## Was der Shop kann

- Produktübersicht mit Kategorien, Suche, Sortierung, Höchstpreis und „nur lieferbare Artikel“. Die Filter stehen in der Adresse und lassen sich verlinken.
- Detailansicht mit Bildergalerie, Varianten (z. B. Größen) und Bestandsanzeige. Einzelstücke (Originalzeichnungen) werden als solche gekennzeichnet und nach dem Verkauf als „Verkauft“ gezeigt.
- Wunschliste und Warenkorb ohne Kundenkonto. Beide liegen nur im Browser.
- Versandkosten nach Lieferland (Zone) und Gesamtgewicht, berechnet auf dem Server.
- Bezahlung per Kreditkarte und PayPal über Stripe Checkout. Die Lieferadresse wird dort abgefragt.
- Bestandsführung: Beim Gang zur Kasse wird die Ware reserviert. Wird nicht bezahlt, geht sie nach gut einer halben Stunde zurück in den Bestand.
- Bestätigungsmail an die Kundin oder den Kunden (in der gewählten Sprache), Benachrichtigung an den Shop, Versandmail mit Sendungsnummer.
- Verwaltung unter `/admin.html`: Produkte anlegen und ändern, Bestände pflegen, Fotos hochladen, Bestellungen ansehen, als versendet markieren, stornieren.
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
| `currency` | Währung des Shops (EUR) |
| `payments.methods` | Zahlarten in Stripe Checkout: `card`, `paypal` |
| `payments.holdMinutes` | So lange bleibt die Bezahlseite offen (Stripe verlangt mindestens 30 Minuten) |
| `shipping.zones` | Versandzonen mit Ländern und Preisstufen nach Gewicht (Preise in Cent) |
| `shipping.packagingWeightG` | Gewicht der Verpackung, wird zu jeder Bestellung addiert |
| `shipping.freeShippingFromCents` | Warenwert, ab dem der Versand kostenlos ist (`null` = nie) |
| `shipping.excludedCountries` | Länder, in die nicht geliefert wird |

Die Versandpreise in der Datei sind Platzhalter. Das Gewicht jedes Produkts wird in der Verwaltung gepflegt. Ist eine Bestellung schwerer als die höchste Stufe einer Zone, kann sie nicht bestellt werden und der Warenkorb zeigt einen Hinweis.

Die Kategorien stehen in der Tabelle `categories` (siehe `migrations/0001_init.sql`). Texte der Oberfläche stehen in `public/i18n/de.json` und `public/i18n/en.json`. Rechtstexte (AGB, Widerruf, Datenschutz, Impressum) sind in `public/legal.html` noch Platzhalter.

Nach jeder Änderung neu deployen.

## Produkte und Bestände pflegen

In der Verwaltung unter „Produkte & Bestand“:

1. „Neues Produkt anlegen“, Name, Kategorie, Preis und Gewicht eintragen, speichern.
2. Danach Fotos hochladen. Das erste Bild ist das Titelbild in der Übersicht.
3. Varianten: Ein Produkt ohne Auswahl hat eine Variante ohne Bezeichnung. Für T-Shirts je Größe eine Variante mit eigenem Bestand anlegen.
4. „Im Shop sichtbar“ ankreuzen, sobald das Produkt fertig ist. Vorher bleibt es ein Entwurf.

Der Bestand lässt sich auch direkt in der Produktliste ändern. Bezahlte Bestellungen verringern ihn automatisch, Stornierungen buchen ihn zurück.

## Einrichtung bei Cloudflare (einmalig)

Am einfachsten in einem Schritt:
```
npm install
npm run setup:cloudflare
```
Das Skript meldet dich bei Cloudflare an, legt Datenbank, Bildspeicher und Pages-Projekt an, trägt die `database_id` in `wrangler.toml` ein, spielt Schema und Platzhalterprodukte ein, setzt ein Passwort für die Verwaltung und deployt. Es kann beliebig oft laufen. Spätere Deployments: `npm run deploy`.

Hinweis: Der Ordnername enthält ein `&`. Damit funktionieren unter Windows `npx wrangler …` und die üblichen npm-Starter nicht. Deshalb rufen alle Skripte wrangler direkt über node auf, und einzelne Befehle laufen über `npm run wrangler -- …`.

Die einzelnen Schritte von Hand:

```
npm install
npm run wrangler -- login
npm run wrangler -- d1 create judas-jesus-shop
npm run wrangler -- r2 bucket create judas-jesus-shop-media
```
Die ausgegebene `database_id` in `wrangler.toml` eintragen, dann:
```
npm run db:remote
npm run wrangler -- pages project create judas-jesus-shop --production-branch main
```
R2 muss im Cloudflare-Konto einmal aktiviert werden (Dashboard → R2).

Secrets setzen (jeweils wird nach dem Wert gefragt):
```
npm run wrangler -- pages secret put ADMIN_TOKEN            # Passwort für /admin.html
npm run wrangler -- pages secret put SHOP_EMAIL             # Adresse für Bestellbenachrichtigungen
npm run wrangler -- pages secret put RESEND_API_KEY         # E-Mail-Versand
npm run wrangler -- pages secret put STRIPE_SECRET_KEY      # zuerst Testschlüssel sk_test_...
npm run wrangler -- pages secret put STRIPE_WEBHOOK_SECRET  # whsec_...
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

### Verwaltung absichern

`/admin.html` ist mit `ADMIN_TOKEN` geschützt. Zusätzlich lässt sich in Cloudflare Zero Trust eine Access-Regel für `/admin.html` und `/api/admin/*` anlegen, die nur bestimmte E-Mail-Adressen zulässt.

## Offene Punkte vor dem Start

- Echte Produkte, Fotos, Texte, Preise und Gewichte.
- Echte Versandtarife und Entscheidung, in welche Länder geliefert wird.
- Rechtstexte: AGB, Widerrufsbelehrung, Datenschutzerklärung, Impressum.
- Umsatzsteuer: Alle Preise gelten bisher als Bruttopreise für alle Länder. Ob für Verkäufe in andere EU-Länder das OSS-Verfahren nötig ist und wie Lieferungen in Drittländer besteuert werden, sollte die Steuerberatung der Betreiber klären.
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
```

Überverkäufe sind ausgeschlossen: Der Bestand wird in einer einzigen Datenbankanweisung geprüft und abgezogen.
