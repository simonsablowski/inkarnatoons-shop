// Richtet den Shop bei Cloudflare ein und deployt ihn. Aufruf: npm run setup:cloudflare
// Das Skript kann beliebig oft laufen: Was schon vorhanden ist, wird übersprungen.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const NAME = "judas-jesus-shop";
const BUCKET = "judas-jesus-shop-media";
const TOML = new URL("../wrangler.toml", import.meta.url);

const step = (text) => console.log(`\n=== ${text}`);
// wrangler wird direkt über node gestartet, ohne Umweg über die Eingabeaufforderung.
// Das "&" im Ordnernamen bringt sonst die .cmd-Starter von npm durcheinander.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WRANGLER = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const args = (cmd) => (Array.isArray(cmd) ? cmd : cmd.split(" "));
// Ausgabe einsammeln (für Abfragen)
function read(cmd, input) {
  try {
    return { ok: true, out: execFileSync(process.execPath, [WRANGLER, ...args(cmd)], { cwd: ROOT, encoding: "utf8", input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] }) };
  } catch (err) {
    return { ok: false, out: `${err.stdout || ""}${err.stderr || ""}` };
  }
}
// Sichtbar ausführen (für Schritte, bei denen wrangler nachfragt oder Fortschritt zeigt)
function run(cmd) {
  execFileSync(process.execPath, [WRANGLER, ...args(cmd)], { cwd: ROOT, stdio: "inherit" });
}
function patchToml(pattern, replacement) {
  const before = readFileSync(TOML, "utf8");
  const after = before.replace(pattern, replacement);
  if (after !== before) writeFileSync(TOML, after);
  return after !== before;
}
function stop(message) {
  console.error(`\nAbgebrochen: ${message}`);
  process.exit(1);
}

step("Anmeldung bei Cloudflare prüfen");
let who = read("whoami");
if (!who.ok || /not authenticated|not logged in/i.test(who.out)) {
  console.log("Es öffnet sich ein Browserfenster. Bitte dort bei Cloudflare anmelden und den Zugriff erlauben.");
  run("login");
  who = read("whoami");
  if (!who.ok || /not authenticated|not logged in/i.test(who.out)) stop("Die Anmeldung hat nicht funktioniert.");
}
console.log("Angemeldet.");

step("Datenbank (D1)");
const findDb = () => {
  const res = read("d1 list --json");
  if (!res.ok) stop(`Die Datenbanken konnten nicht abgefragt werden.\n${res.out}`);
  const list = JSON.parse(res.out.slice(res.out.search(/\[\s*[{\]]/)));
  return list.find((d) => d.name === NAME);
};
let db = findDb();
if (!db) {
  const created = read(`d1 create ${NAME}`);
  if (!created.ok) stop(`Die Datenbank konnte nicht angelegt werden.\n${created.out}`);
  db = findDb();
  if (!db) stop("Die Datenbank wurde angelegt, taucht aber nicht in der Liste auf.");
  console.log("Datenbank angelegt.");
} else console.log("Datenbank ist schon vorhanden.");
if (patchToml(/database_id = "[^"]*"/, `database_id = "${db.uuid}"`)) console.log("database_id in wrangler.toml eingetragen.");

step("Bildspeicher (R2)");
const buckets = read("r2 bucket list");
if (!buckets.ok) stop(`R2 ist in diesem Cloudflare-Konto noch nicht aktiviert. Bitte im Dashboard unter „R2“ einmal aktivieren (kostenloses Kontingent, Cloudflare verlangt dafür eine Zahlungsmethode) und das Skript erneut starten.\n${buckets.out}`);
if (!buckets.out.includes(BUCKET)) {
  const created = read(`r2 bucket create ${BUCKET}`);
  if (!created.ok) stop(`Der Bildspeicher konnte nicht angelegt werden.\n${created.out}`);
  console.log("Bildspeicher angelegt.");
} else console.log("Bildspeicher ist schon vorhanden.");

step("Pages-Projekt");
let projects = read("pages project list");
if (!projects.ok) stop(`Die Pages-Projekte konnten nicht abgefragt werden.\n${projects.out}`);
if (!projects.out.includes(NAME)) {
  const created = read(`pages project create ${NAME} --production-branch main`);
  if (!created.ok) stop(`Das Pages-Projekt konnte nicht angelegt werden.\n${created.out}`);
  projects = read("pages project list");
  console.log("Pages-Projekt angelegt.");
} else console.log("Pages-Projekt ist schon vorhanden.");
// Ist der Wunschname vergeben, hängt Cloudflare ein Kürzel an die Adresse an.
const domain = projects.out.match(new RegExp(`${NAME}(-[a-z0-9]+)?\\.pages\\.dev`))?.[0];
if (domain && readFileSync(TOML, "utf8").includes(".pages.dev")) {
  if (patchToml(/PUBLIC_URL = "https:\/\/[^"]*\.pages\.dev"/, `PUBLIC_URL = "https://${domain}"`)) console.log(`PUBLIC_URL auf https://${domain} gesetzt.`);
}

step("Datenbankschema einspielen");
run(`d1 migrations apply ${NAME} --remote`);

step("Platzhalterprodukte");
const count = read(["d1", "execute", NAME, "--remote", "--json", "--command", "SELECT COUNT(*) AS c FROM products"]);
const empty = count.ok && /"c":\s*0\b/.test(count.out);
if (empty) {
  run(`d1 execute ${NAME} --remote --yes --file=seed/demo.sql`);
  console.log("Platzhalterprodukte eingespielt.");
} else console.log("Es gibt schon Produkte in der Datenbank, die Platzhalter werden nicht eingespielt.");

step("Passwort für die Verwaltung");
const secrets = read("pages secret list");
let password = null;
if (secrets.ok && secrets.out.includes("ADMIN_TOKEN")) console.log("ADMIN_TOKEN ist schon gesetzt.");
else {
  password = randomBytes(15).toString("base64url");
  const put = read("pages secret put ADMIN_TOKEN", password);
  if (!put.ok) stop(`Das Passwort konnte nicht gesetzt werden.\n${put.out}`);
}

step("Deployen");
run("pages deploy --branch main");

console.log(`\nFertig. Der Shop ist erreichbar unter https://${domain || `${NAME}.pages.dev`}`);
console.log(`Verwaltung: https://${domain || `${NAME}.pages.dev`}/admin.html`);
if (password) console.log(`\nPasswort für die Verwaltung (bitte jetzt notieren, es wird nicht noch einmal angezeigt):\n  ${password}`);
console.log("\nDie Bezahlung ist noch nicht eingerichtet. Dafür fehlen die Stripe-Schlüssel, siehe README.md, Abschnitt „Stripe“.");
