// Setzt eine in Teilen abgelegte Filmfassung wieder zu einer abspielbaren MP4-Datei zusammen.
//   npm run film:join -- thumbnail
// Die Kennung (film, rough, layout, thumbnail) steht in shop.config.json unter film.versions.
// Geschrieben wird neben den Teileordner, z. B. import/film/01-thumbnail-animatic-layoutton.mp4.
import { readFileSync, existsSync, statSync, readdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const versions = JSON.parse(readFileSync(join(ROOT, "shop.config.json"), "utf8")).film?.versions || [];
const id = process.argv[2];
const v = versions.find((x) => x.id === id);
if (!v) { console.error(`Bitte eine Fassung angeben: ${versions.map((x) => x.id).join(", ")}`); process.exit(1); }
const dir = join(ROOT, v.upload || "");
if (!v.upload || !existsSync(dir)) { console.error(`Quelle „${v.upload}“ nicht gefunden.`); process.exit(1); }
if (!statSync(dir).isDirectory()) { console.log(`Diese Fassung ist schon eine einzelne Datei: ${v.upload}`); process.exit(0); }

const out = `${dir}.mp4`;
writeFileSync(out, "");
for (const name of readdirSync(dir).filter((n) => !n.startsWith(".")).sort()) {
  const data = readFileSync(join(dir, name));
  appendFileSync(out, name.endsWith(".gz") ? gunzipSync(data) : data);
}
console.log(`Geschrieben: ${v.upload}.mp4 (${(statSync(out).size / 1048576).toFixed(0)} MB)`);
