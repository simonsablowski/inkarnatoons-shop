// /api/admin/taxonomy – Themenwelten und Kategorien
//   GET   beide Listen
//   PUT   { worlds:[slug, …], categories:[slug, …] }   Reihenfolge festlegen
//   POST  { worlds:[{ name, tagline_de?, tagline_en? }], categories:[{ name_de, name_en? }] }
//         legt fehlende Einträge an. Vorhandene (gleicher Name oder gleiche Adresse) bleiben unverändert.
import { json, error, requireAdmin, clean } from "../../_lib/http.js";
import { slugify } from "../../_lib/adminProducts.js";

export async function lists(db) {
  const [w, c] = await db.batch([
    db.prepare(`SELECT slug, name, tagline_de, tagline_en, image, sort,
                  (SELECT COUNT(*) FROM products p WHERE p.world = worlds.slug) AS product_count
                FROM worlds ORDER BY sort, slug`),
    db.prepare(`SELECT slug, name_de, name_en, sort,
                  (SELECT COUNT(*) FROM products p WHERE p.category = categories.slug) AS product_count
                FROM categories ORDER BY sort, slug`),
  ]);
  return { worlds: w.results, categories: c.results };
}

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  return json({ ok: true, ...(await lists(env.DB)) });
}

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body) return error("invalid_body");
  const have = await lists(env.DB);
  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const created = { worlds: [], categories: [] };
  const stmts = [];

  let sort = Math.max(0, ...have.worlds.map((w) => w.sort));
  for (const w of Array.isArray(body.worlds) ? body.worlds.slice(0, 30) : []) {
    const name = clean(w?.name, 80);
    const slug = slugify(name);
    if (!slug || have.worlds.some((x) => x.slug === slug || same(x.name, name))) continue;
    sort += 10;
    stmts.push(env.DB.prepare(`INSERT INTO worlds (slug, name, tagline_de, tagline_en, sort) VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(slug, name, clean(w.tagline_de, 200), clean(w.tagline_en, 200), sort));
    have.worlds.push({ slug, name, sort });
    created.worlds.push(slug);
  }

  sort = Math.max(0, ...have.categories.map((c) => c.sort));
  for (const c of Array.isArray(body.categories) ? body.categories.slice(0, 50) : []) {
    const name_de = clean(c?.name_de, 80);
    const slug = slugify(name_de);
    if (!slug || have.categories.some((x) => x.slug === slug || same(x.name_de, name_de))) continue;
    sort += 10;
    stmts.push(env.DB.prepare(`INSERT INTO categories (slug, name_de, name_en, sort) VALUES (?1, ?2, ?3, ?4)`)
      .bind(slug, name_de, clean(c.name_en, 80) || name_de, sort));
    have.categories.push({ slug, name_de, sort });
    created.categories.push(slug);
  }

  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, created, ...(await lists(env.DB)) });
}

export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body) return error("invalid_body");
  const stmts = [];
  const order = (list, table) => {
    if (!Array.isArray(list)) return;
    list.slice(0, 100).forEach((slug, i) => stmts.push(env.DB.prepare(`UPDATE ${table} SET sort = ?2 WHERE slug = ?1`).bind(String(slug), (i + 1) * 10)));
  };
  order(body.worlds, "worlds");
  order(body.categories, "categories");
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, ...(await lists(env.DB)) });
}
