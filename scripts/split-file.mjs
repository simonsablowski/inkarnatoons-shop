// Zerlegt eine große Datei in Teile von 300 MB, damit sie sich einzeln übertragen lassen.
//   npm run split -- "import/olaf/meine-datei.mp4"
// Die Teile landen in import/teile/ und heißen wie die Datei mit der Endung .teil-00, .teil-01, …
// Die Originaldatei bleibt unverändert.
import { openSync, readSync, writeSync, closeSync, statSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv[2];
if (!arg) { console.error('Bitte eine Datei angeben, z. B.: npm run split -- "import/olaf/film.mp4"'); process.exit(1); }
const file = isAbsolute(arg) ? arg : join(ROOT, arg);
if (!existsSync(file)) { console.error(`Datei nicht gefunden: ${file}`); process.exit(1); }

const PART = 300 * 1024 * 1024, BLOCK = 8 * 1024 * 1024;
const size = statSync(file).size;
const outDir = join(ROOT, "import", "teile");
mkdirSync(outDir, { recursive: true });
const src = openSync(file, "r");
const buf = Buffer.allocUnsafe(BLOCK);
let part = 0, written = 0, out = null;
for (;;) {
  const n = readSync(src, buf, 0, Math.min(BLOCK, PART - (written % PART || 0)), null);
  if (n === 0) break;
  if (written % PART === 0) {
    if (out !== null) closeSync(out);
    out = openSync(join(outDir, `${basename(file)}.teil-${String(part++).padStart(2, "0")}`), "w");
  }
  writeSync(out, buf, 0, n);
  written += n;
}
if (out !== null) closeSync(out);
closeSync(src);
console.log(`${basename(file)}: ${(size / 1048576).toFixed(0)} MB in ${part} Teil(en) nach import/teile/ geschrieben.`);
