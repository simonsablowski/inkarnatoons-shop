// Lädt die Filmdateien aus shop.config.json ("film.versions") in den Speicher des Shops.
//
//   npm run film:upload                       lädt in den lokalen Testshop (npm run dev muss laufen)
//   npm run film:upload -- --target online    lädt in den Online-Shop
//   --only <id>     nur diese Fassung (z. B. --only film)
//   --force         auch hochladen, wenn dieselbe Datei schon im Speicher liegt
//   --part-mb <n>   Größe der Stücke in MB (Standard 8, mindestens 5). Kleiner hilft bei wackliger Leitung.
//
// Bricht die Übertragung ab (z. B. weil die Leitung weg ist), einfach denselben Befehl noch einmal
// ausführen: Das Skript merkt sich die fertigen Stücke in import/.upload-stand.json und macht dort weiter.
//
// Jede Fassung nennt unter "upload" ihre Quelle: eine Datei oder einen Ordner. Bei einem Ordner
// werden alle Dateien darin in der Reihenfolge ihrer Namen aneinandergehängt (teil-00, teil-01, …).
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, openSync, readSync, closeSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { gunzipSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(ROOT, "shop.config.json"), "utf8"));
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : null);
const KNOWN = ["target", "only", "force", "part-mb"];
const unknown = argv.filter((a) => a.startsWith("--") && !KNOWN.includes(a.slice(2)));
if (unknown.length) { console.error(`Unbekannter Schalter: ${unknown.join(", ")}. Erlaubt sind: ${KNOWN.map((k) => "--" + k).join(", ")}`); process.exit(1); }
if (option("target") && !["local", "online"].includes(option("target"))) { console.error("--target erwartet local oder online."); process.exit(1); }
const TARGET = option("target") === "online" ? "online" : "local";
const PART_MB = Math.max(5, Math.min(90, Number(option("part-mb")) || 8));
let PART = PART_MB * 1024 * 1024;

// Stand angefangener Übertragungen, damit ein Abbruch nicht von vorn beginnen muss
const STATE_FILE = join(ROOT, "import", ".upload-stand.json");
const readState = () => { try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return {}; } };
function saveState(state) {
  try { mkdirSync(dirname(STATE_FILE), { recursive: true }); writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch { /* egal */ }
}
const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;

async function connect() {
  let base, token;
  if (TARGET === "online") {
    base = readFileSync(join(ROOT, "wrangler.toml"), "utf8").match(/PUBLIC_URL\s*=\s*"([^"]+)"/)?.[1];
    token = process.env.ADMIN_TOKEN;
    if (!token) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      token = (await rl.question(`Passwort der Verwaltung für ${base}: `)).trim();
      rl.close();
    }
  } else {
    base = "http://localhost:8788";
    const vars = existsSync(join(ROOT, ".dev.vars")) ? readFileSync(join(ROOT, ".dev.vars"), "utf8") : "";
    token = vars.match(/^ADMIN_TOKEN=(.*)$/m)?.[1]?.trim();
    if (!token) throw new Error("In .dev.vars fehlt ADMIN_TOKEN.");
  }
  return { base, token };
}

// Quelle einer Fassung: eine Datei oder alle Dateien eines Ordners, nach Namen sortiert
function sourceFiles(upload) {
  const path = join(ROOT, upload);
  if (!existsSync(path)) return null;
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).filter((n) => !n.startsWith(".")).sort().map((n) => join(path, n));
}

// Liest die Dateien nacheinander und liefert Stücke von genau PART Bytes (das letzte ist kleiner).
// Teile mit der Endung .gz sind gepackt und werden beim Lesen entpackt.
function* blocks(file) {
  if (file.endsWith(".gz")) { yield gunzipSync(readFileSync(file)); return; }
  const fd = openSync(file, "r");
  try {
    for (;;) {
      const buf = Buffer.allocUnsafe(4 * 1024 * 1024);
      const n = readSync(fd, buf, 0, buf.length, null);
      if (n === 0) break;
      yield buf.subarray(0, n);
    }
  } finally { closeSync(fd); }
}
function* pieces(files, skip = 0) {
  let index = 0;
  let buf = Buffer.allocUnsafe(PART), filled = 0;
  for (const file of files) {
    for (let block of blocks(file)) {
      while (block.length) {
        const n = Math.min(block.length, PART - filled);
        block.copy(buf, filled, 0, n);
        filled += n;
        block = block.subarray(n);
        if (filled === PART) { if (index++ >= skip) yield buf; buf = Buffer.allocUnsafe(PART); filled = 0; }
      }
    }
  }
  if (filled && index >= skip) yield buf.subarray(0, filled);
}
const sizeOf = (file) => (file.endsWith(".gz") ? gunzipSync(readFileSync(file)).length : statSync(file).size);

// Grobe Prüfung einer MP4-Datei: Welche Bild- und Tonformate stecken darin? Browser spielen H.264-Bild mit AAC-Ton.
// Gelesen werden nur Anfang und Ende der Datei, dort steht das Inhaltsverzeichnis.
function inspect(file) {
  const size = statSync(file).size, span = Math.min(size, 8 * 1024 * 1024);
  const fd = openSync(file, "r");
  const head = Buffer.alloc(span), tail = Buffer.alloc(span);
  try { readSync(fd, head, 0, span, 0); readSync(fd, tail, 0, span, Math.max(0, size - span)); } finally { closeSync(fd); }
  const text = head.toString("latin1") + (size > span ? tail.toString("latin1") : "");
  const has = (code) => text.includes(code);
  const count = (code) => text.split(code).length - 1;
  const video = ["avc1", "avc3", "hvc1", "hev1", "apcn", "apch", "mp4v"].filter(has);
  const audio = ["mp4a", "ac-3", "ec-3", "lpcm", "sowt", "twos", "in24"].filter(has);
  const audioTracks = (text.match(/hdlr[\s\S]{8}soun/g) || []).length;
  const notes = [];
  if (!video.some((v) => v.startsWith("avc"))) notes.push(`Bildformat ${video.join("/") || "unbekannt"} statt H.264: läuft wahrscheinlich nicht in allen Browsern`);
  if (audio.length && !audio.includes("mp4a")) notes.push(`Tonformat ${audio.join("/")} statt AAC: Browser bleiben wahrscheinlich stumm`);
  else if (audio.some((x) => x !== "mp4a")) notes.push(`mehrere Tonformate (${audio.join(", ")}): Browser spielen nur die erste Tonspur`);
  if (audioTracks > 1) notes.push(`${audioTracks} Tonspuren: Browser spielen nur die erste`);
  if (!head.subarray(0, 4 * 1024 * 1024).includes("moov") && size > span) notes.push("Inhaltsverzeichnis steht am Dateiende: Der Film startet etwas verzögert");
  return { video, audio, notes };
}

async function call(base, token, method, query, body) {
  const url = `${base}/api/admin/upload?${new URLSearchParams(query)}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { method, body, signal: AbortSignal.timeout(5 * 60 * 1000), headers: { authorization: `Bearer ${token}`, ...(typeof body === "string" ? { "content-type": "application/json" } : {}) } });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) throw Object.assign(new Error("Das Passwort der Verwaltung stimmt nicht."), { fatal: true });
      if (!res.ok || data.ok === false) throw new Error(`${data.error || "http_" + res.status}${data.detail ? ": " + data.detail : ""}`);
      return data;
    } catch (err) {
      if (err.fatal || attempt >= 8) throw err;
      const wait = Math.min(60, attempt * 5);
      process.stdout.write(`\n  Versuch ${attempt} fehlgeschlagen (${err.cause?.code || err.message}), neuer Versuch in ${wait} s `);
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
  }
}

const versions = (config.film?.versions || []).filter((v) => v.upload && v.src?.startsWith("/media/") && (!option("only") || v.id === option("only")));
if (!versions.length) { console.error("Keine passende Fassung mit \"upload\" in shop.config.json gefunden."); process.exit(1); }

const { base, token } = await connect();
console.log(`Ziel: ${base}\n`);
let failed = 0;
for (const v of versions) {
  const key = v.src.slice("/media/".length);
  const files = sourceFiles(v.upload);
  if (!files?.length) { console.log(`✗ ${v.id}: Quelle „${v.upload}“ nicht gefunden, übersprungen`); failed++; continue; }
  const total = files.reduce((n, f) => n + sizeOf(f), 0);
  if (!flag("force")) {
    const head = await fetch(`${base}/media/${key}`, { method: "HEAD" }).catch(() => null);
    if (head?.ok && Number(head.headers.get("content-length")) === total) { console.log(`= ${v.id}: liegt schon im Speicher (${mb(total)}), übersprungen`); continue; }
  }
  if (files.length === 1 && /\.(mp4|mov|m4v)$/i.test(files[0])) {
    const info = inspect(files[0]);
    console.log(`  ${v.id}: Bild ${info.video.join("/") || "?"}, Ton ${info.audio.join("/") || "?"}`);
    for (const n of info.notes) console.log(`  Hinweis: ${n}`);
  }
  // Angefangene Übertragung derselben Datei fortsetzen
  const state = readState();
  const fingerprint = `${total}:${files.map((f) => statSync(f).mtimeMs).join(",")}`;
  let job = state[key];
  if (job && job.fingerprint !== fingerprint) job = null;
  try {
    if (job) {
      PART = job.partBytes;
      console.log(`  Setze fort: ${job.parts.length} Stücke à ${mb(PART)} sind schon übertragen.`);
    } else {
      PART = PART_MB * 1024 * 1024;
      const { uploadId } = await call(base, token, "POST", { key, action: "create" });
      job = { uploadId, fingerprint, partBytes: PART, parts: [] };
      state[key] = job; saveState(state);
    }
    let sent = job.parts.length * PART;
    process.stdout.write(`↑ ${v.id}: ${mb(sent)} von ${mb(total)} `);
    for (const piece of pieces(files, job.parts.length)) {
      const { part } = await call(base, token, "PUT", { key, uploadId: job.uploadId, part: job.parts.length + 1 }, piece);
      job.parts.push(part);
      saveState(state);
      sent += piece.length;
      process.stdout.write(`\r↑ ${v.id}: ${mb(sent)} von ${mb(total)}   `);
    }
    await call(base, token, "POST", { key, uploadId: job.uploadId, action: "complete" }, JSON.stringify({ parts: job.parts }));
    delete state[key]; saveState(state);
    console.log(`\r✓ ${v.id}: ${mb(total)} hochgeladen → ${v.src}        `);
  } catch (err) {
    console.log(`\n✗ ${v.id}: ${err.message}`);
    if (/does not exist|NoSuchUpload|upload_id/i.test(err.message)) {
      // Die angefangene Übertragung gibt es im Speicher nicht mehr (abgelaufen): beim nächsten Mal von vorn
      delete state[key]; saveState(state);
      console.log("  Die angefangene Übertragung ist abgelaufen. Beim nächsten Aufruf beginnt sie neu.");
      failed++;
      continue;
    }
    if (job?.parts?.length) console.log(`  ${job.parts.length} Stücke sind schon oben. Denselben Befehl später noch einmal ausführen, dann geht es dort weiter.`);
    failed++;
    if (err.fatal) break;
  }
}
console.log(failed ? `\n${failed} Fassung(en) nicht hochgeladen.` : "\nFertig. Die Filme sind sofort im Shop zu sehen.");
process.exit(failed ? 1 : 0);
