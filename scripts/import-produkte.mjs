// Übernimmt die Produktliste aus Google Sheets in den Shop.
//
//   npm run import                       Probelauf gegen den lokalen Shop: zeigt nur, was passieren würde
//   npm run import -- --write        legt Produkte lokal an bzw. ändert sie
//   npm run import -- --target online --write     dasselbe im Shop bei Cloudflare
//
// Weitere Schalter:
//   --file liste.csv     statt Google Sheets eine CSV-Datei lesen (in Sheets: Datei → Herunterladen → CSV, Blatt „Produkte“)
//   --stock             bei schon vorhandenen Produkten auch den Bestand aus der Liste übernehmen (sonst bleibt er, wie er ist)
//   --replace-images          bei schon vorhandenen Produkten die Bilder ersetzen (sonst werden nur Produkte ohne Bilder bestückt)
//   --delete-others     Produkte löschen, die nicht in der Liste stehen (z. B. die Platzhalter)
//
// Die Einstellungen (Tabelle, Blattname, Bilderordner) stehen in shop.config.json unter "import".
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, extname, basename } from "node:path";
import { createInterface } from "node:readline/promises";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const config = JSON.parse(readFileSync(join(ROOT, "shop.config.json"), "utf8"));
const settings = config.import || {};
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : null);
const KNOWN = ["write", "target", "file", "stock", "replace-images", "delete-others"];
const unknown = argv.filter((a) => a.startsWith("--") && !KNOWN.includes(a.slice(2)));
if (unknown.length) { console.error(`Unbekannter Schalter: ${unknown.join(", ")}. Erlaubt sind: ${KNOWN.map((k) => "--" + k).join(", ")}`); process.exit(1); }
if (option("target") && !["local", "online"].includes(option("target"))) { console.error("--target erwartet local oder online."); process.exit(1); }
const WRITE = flag("write");
const TARGET = option("target") === "online" ? "online" : "local";

// ---------- Hilfen ----------
export function slugify(s) {
  return String(s || "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " und ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// CSV nach RFC 4180: Anführungszeichen, Kommas und Zeilenumbrüche in Zellen
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// "14,90 €", "1.234,50", "120 g", "24" → Zahl. Leer → null, unlesbar → NaN.
export function parseNumber(raw) {
  let s = String(raw ?? "").replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const yes = (v) => /^(ja|j|yes|y|x|1|true|wahr)$/i.test(String(v || "").trim());

// "S=5; M=12; L=2" → [{ label:"S", stock:5 }, …]
export function parseVariants(raw) {
  const out = [];
  for (const part of String(raw || "").split(/[;\n]+/).map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^(.+?)\s*[=:]\s*(\d+)\s*$/);
    if (!m) return { error: `„${part}“ hat nicht das Format Größe=Stückzahl` };
    out.push({ label: m[1].trim(), stock: Number(m[2]) });
  }
  return { variants: out };
}

// Produktarten der Vorlage und die Kategorien, die es im Shop dafür schon gibt
const KIND_TO_CATEGORY = {
  "dvd / film": "film", "originalzeichnung": "originale", "t-shirt": "shirts", "spiel": "spiele",
  "poster / druck": "poster", "postkarten": "postkarten", "buch / heft": "buecher", "sonstiges": "sonstiges",
};
const COLUMNS = {
  world: "themenwelt", kind: "produktart", name_de: "name (deutsch)", name_en: "name (englisch)",
  desc_de: "beschreibung (deutsch)", desc_en: "beschreibung (englisch)", price: "preis", weight: "gewicht",
  unique: "einzelst", stock: "stückzahl", variants: "varianten", sku: "artikelnummer", images: "bilddateien",
  launch: "zum start", notes: "anmerkungen",
};

// ---------- Liste lesen ----------
async function loadSheet() {
  const file = option("file");
  if (file) return { text: readFileSync(file, "utf8"), source: file };
  if (!settings.sheetId) throw new Error('In shop.config.json fehlt "import.sheetId".');
  const base = `https://docs.google.com/spreadsheets/d/${settings.sheetId}`;
  const name = settings.sheetName || "Produkte";
  // Der Export über die Blattnummer (gid) liefert die Zellen genau so, wie sie in der Tabelle stehen.
  let gid = settings.sheetGid ?? null;
  if (gid === null || gid === "") {
    const html = await fetch(`${base}/htmlview`).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    gid = html.match(new RegExp(`name:\\s*"${esc}"[^}]*?gid:\\s*"(\\d+)"`))?.[1] ?? html.match(new RegExp(`gid=(\\d+)[^>]*>\\s*${esc}\\s*<`))?.[1] ?? null;
  }
  const url = gid !== null ? `${base}/export?format=csv&gid=${gid}` : `${base}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) {
    throw new Error("Die Tabelle ist nicht lesbar. Bitte in Google Sheets unter „Freigeben“ auf „Jeder, der über den Link verfügt: Betrachter“ stellen, oder die Liste als CSV herunterladen und mit --file angeben.");
  }
  return { text, source: `Google Sheets, Blatt „${name}“${gid !== null ? "" : " (vereinfachter Abruf)"}`, simplified: gid === null };
}

function readProducts(text) {
  const rows = parseCsv(text);
  const header = (rows.shift() || []).map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [key, start] of Object.entries(COLUMNS)) col[key] = header.findIndex((h) => h.startsWith(start));
  const missing = ["world", "kind", "name_de", "price"].filter((k) => col[k] < 0);
  if (missing.length) throw new Error(`In der Tabelle fehlen Spalten: ${missing.map((k) => COLUMNS[k]).join(", ")}`);
  const get = (row, key) => (col[key] >= 0 ? String(row[col[key]] ?? "").trim() : "");

  const products = [];
  const seen = new Map();
  rows.forEach((row, i) => {
    if (!row.some((c) => String(c).trim())) return;
    const line = i + 2;
    const p = { line, errors: [], warnings: [] };
    p.world = get(row, "world"); p.kind = get(row, "kind");
    p.name_de = get(row, "name_de"); p.name_en = get(row, "name_en");
    p.desc_de = get(row, "desc_de"); p.desc_en = get(row, "desc_en");
    p.sku = get(row, "sku"); p.is_unique = yes(get(row, "unique")); p.active = yes(get(row, "launch"));
    p.slug = slugify(p.name_de);
    if (!p.name_de) p.errors.push("Name (Deutsch) fehlt");
    if (!p.world) p.errors.push("Themenwelt fehlt");
    if (!p.kind) p.errors.push("Produktart fehlt");
    if (p.slug && seen.has(p.slug)) p.errors.push(`gleicher Name wie in Zeile ${seen.get(p.slug)}`);
    seen.set(p.slug, line);

    const price = parseNumber(get(row, "price"));
    if (price === null) p.errors.push("Preis fehlt");
    else if (Number.isNaN(price) || price < 0) p.errors.push(`Preis „${get(row, "price")}“ ist keine Zahl`);
    else p.price_cents = Math.round(price * 100);

    const weight = parseNumber(get(row, "weight"));
    if (weight === null) { p.weight_g = 0; p.warnings.push("Gewicht fehlt, das Porto wird zu niedrig berechnet"); }
    else if (Number.isNaN(weight) || weight < 0) p.errors.push(`Gewicht „${get(row, "weight")}“ ist keine Zahl`);
    else p.weight_g = Math.round(weight);

    const parsed = parseVariants(get(row, "variants"));
    const stock = parseNumber(get(row, "stock"));
    if (parsed.error) p.errors.push(`Varianten: ${parsed.error}`);
    else if (parsed.variants.length) {
      p.variants = parsed.variants.map((v, n) => ({ ...v, sku: p.sku ? `${p.sku}-${slugify(v.label).toUpperCase()}` : "" }));
      if (stock !== null) p.warnings.push("Stückzahl und Varianten sind beide ausgefüllt, es gelten die Varianten");
    } else {
      if (Number.isNaN(stock)) p.errors.push(`Stückzahl „${get(row, "stock")}“ ist keine Zahl`);
      if (stock === null && !p.is_unique) p.warnings.push("Stückzahl fehlt, das Produkt erscheint als ausverkauft");
      p.variants = [{ label: "", sku: p.sku, stock: Math.round(stock ?? (p.is_unique ? 1 : 0)) }];
    }
    if (p.is_unique && (p.variants?.length > 1 || p.variants?.[0]?.stock > 1)) p.warnings.push("als Einzelstück markiert, aber Stückzahl größer als 1");
    if (!p.name_en) p.warnings.push("englischer Name fehlt, es wird der deutsche gezeigt");
    p.imageNames = get(row, "images").split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!p.imageNames.length) p.warnings.push("keine Bilder angegeben");
    products.push(p);
  });
  return products;
}

// ---------- Bilder ----------
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
function findImages(products) {
  const dir = join(ROOT, settings.imageDir || "import/bilder");
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => TYPES[extname(f).toLowerCase()]) : [];
  const byName = new Map();
  for (const f of files) { byName.set(f.toLowerCase(), f); byName.set(basename(f, extname(f)).toLowerCase(), f); }
  for (const p of products) {
    p.images = [];
    for (const name of p.imageNames) {
      const hit = byName.get(name.toLowerCase()) || byName.get(basename(name, extname(name)).toLowerCase());
      if (!hit) { p.warnings.push(`Bild „${name}“ liegt nicht im Ordner ${settings.imageDir || "import/bilder"}`); continue; }
      const path = join(dir, hit);
      if (statSync(path).size > 8 * 1024 * 1024) { p.warnings.push(`Bild „${hit}“ ist größer als 8 MB und wird übersprungen`); continue; }
      p.images.push({ name: hit, path, type: TYPES[extname(hit).toLowerCase()] });
    }
  }
  return dir;
}

// ---------- Shop ----------
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
  const api = async (path, opts = {}) => {
    const headers = { authorization: `Bearer ${token}`, ...(opts.headers || {}) };
    if (typeof opts.body === "string") headers["content-type"] = "application/json";
    let res;
    try { res = await fetch(base + path, { ...opts, headers }); }
    catch { throw new Error(TARGET === "local" ? "Der lokale Shop läuft nicht. Bitte in einem zweiten Fenster „npm run dev“ starten." : `${base} ist nicht erreichbar.`); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("Das Passwort der Verwaltung stimmt nicht.");
    if (!res.ok || data.ok === false) throw new Error(`${opts.method || "GET"} ${path}: ${data.error || res.status}`);
    return data;
  };
  return { base, api };
}

async function main() {
  console.log(`Ziel: ${TARGET === "online" ? "Shop bei Cloudflare" : "lokaler Shop"} · ${WRITE ? "Änderungen werden geschrieben" : "Probelauf, es wird nichts geändert"}\n`);
  const sheet = await loadSheet();
  const products = readProducts(sheet.text);
  const imageDir = findImages(products);
  console.log(`Quelle: ${sheet.source}, ${products.length} Produkte`);
  if (sheet.simplified) console.log("Hinweis: Beim vereinfachten Abruf können Zellen fehlen, wenn eine Spalte Zahlen und Text mischt. Sicherer ist es, die Blattnummer (gid aus der Adresse des Blatts „Produkte“) in shop.config.json unter import.sheetGid einzutragen.");
  if (!products.length) { console.log("\nDie Liste ist noch leer."); return; }

  const { base, api } = await connect();
  const tax = await api("/api/admin/taxonomy");
  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const worldSlug = (name) => tax.worlds.find((w) => same(w.name, name) || w.slug === slugify(name))?.slug;
  const categorySlug = (kind) => {
    const alias = KIND_TO_CATEGORY[kind.trim().toLowerCase()];
    return tax.categories.find((c) => c.slug === alias || same(c.name_de, kind) || c.slug === slugify(kind))?.slug;
  };
  const newWorlds = [...new Set(products.filter((p) => p.world && !worldSlug(p.world)).map((p) => p.world))];
  const newKinds = [...new Set(products.filter((p) => p.kind && !categorySlug(p.kind)).map((p) => p.kind))];

  const existing = new Map((await api("/api/admin/products")).products.map((p) => [p.slug, p]));
  const inSheet = new Set(products.map((p) => p.slug));
  const others = [...existing.values()].filter((p) => !inSheet.has(p.slug));

  // ---------- Bericht ----------
  for (const p of products) {
    const old = existing.get(p.slug);
    const state = p.errors.length ? "FEHLER   " : old ? "ändern   " : "neu      ";
    const stock = p.variants ? p.variants.map((v) => (v.label ? `${v.label}=${v.stock}` : v.stock)).join(" ") : "";
    console.log(`${state} Zeile ${String(p.line).padStart(3)}  ${p.name_de || "(ohne Name)"}  ·  ${p.world} / ${p.kind}  ·  ${p.price_cents != null ? (p.price_cents / 100).toFixed(2) + " €" : "?"}  ·  Bestand ${stock}  ·  ${p.images.length}/${p.imageNames.length} Bilder${p.active ? "" : "  ·  Entwurf (nicht zum Start)"}`);
    for (const e of p.errors) console.log(`           ✗ ${e}`);
    for (const w of p.warnings) console.log(`           ! ${w}`);
  }
  if (newWorlds.length) console.log(`\nNeue Themenwelten: ${newWorlds.join(", ")}`);
  if (newKinds.length) console.log(`Neue Kategorien: ${newKinds.join(", ")}`);
  if (others.length) console.log(`\nNicht in der Liste, aber im Shop (${flag("delete-others") ? "werden gelöscht" : "bleiben unverändert, löschen mit --delete-others"}): ${others.map((p) => p.name_de).join(", ")}`);

  const bad = products.filter((p) => p.errors.length);
  const good = products.filter((p) => !p.errors.length);
  console.log(`\n${good.length} Produkte in Ordnung, ${bad.length} mit Fehlern, ${products.reduce((n, p) => n + p.warnings.length, 0)} Hinweise.`);
  if (!WRITE) { console.log("Das war ein Probelauf. Mit „--write“ werden die Produkte ohne Fehler übernommen."); return; }

  // ---------- Schreiben ----------
  if (newWorlds.length || newKinds.length) {
    const res = await api("/api/admin/taxonomy", { method: "POST", body: JSON.stringify({ worlds: newWorlds.map((name) => ({ name })), categories: newKinds.map((name_de) => ({ name_de })) }) });
    tax.worlds = res.worlds; tax.categories = res.categories;
  }
  let created = 0, updated = 0, uploaded = 0;
  for (const [n, p] of good.entries()) {
    const old = existing.get(p.slug);
    let variants = p.variants;
    let oldFull = null;
    if (old) {
      oldFull = (await api(`/api/admin/products/${old.id}`)).product;
      // Varianten über ihre Bezeichnung wiedererkennen. Der Bestand im Shop bleibt, außer mit --stock.
      variants = p.variants.map((v) => {
        const hit = oldFull.variants.find((o) => same(o.label, v.label));
        return hit ? { ...v, id: hit.id, stock: flag("stock") ? v.stock : hit.stock } : v;
      });
    }
    const body = JSON.stringify({
      slug: p.slug, world: worldSlug(p.world), category: categorySlug(p.kind), name_de: p.name_de, name_en: p.name_en || p.name_de,
      desc_de: p.desc_de, desc_en: p.desc_en || p.desc_de, price_cents: p.price_cents, weight_g: p.weight_g,
      is_unique: p.is_unique, active: p.active, sort: (n + 1) * 10, variants,
    });
    const id = old ? (await api(`/api/admin/products/${old.id}`, { method: "PUT", body })).id : (await api("/api/admin/products", { method: "POST", body })).id;
    old ? updated++ : created++;

    const hasImages = oldFull?.images?.length > 0;
    if (p.images.length && (!hasImages || flag("replace-images"))) {
      if (hasImages) for (const img of oldFull.images) await api(`/api/admin/images?id=${img.id}`, { method: "DELETE" });
      for (const img of p.images) {
        await api(`/api/admin/images?product=${id}`, { method: "POST", body: readFileSync(img.path), headers: { "content-type": img.type } });
        uploaded++;
      }
    }
    process.stdout.write(`\r${n + 1}/${good.length} übernommen`);
  }
  let deleted = 0;
  if (flag("delete-others")) for (const p of others) { await api(`/api/admin/products/${p.id}`, { method: "DELETE" }); deleted++; }
  console.log(`\n\nFertig: ${created} neu, ${updated} geändert, ${uploaded} Bilder hochgeladen${deleted ? `, ${deleted} gelöscht` : ""}.`);
  if (bad.length) console.log(`${bad.length} Zeilen mit Fehlern wurden übersprungen (siehe oben).`);
  console.log(`Ansehen: ${base}/`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error(`\nAbgebrochen: ${err.message}`); process.exit(1); });
}
