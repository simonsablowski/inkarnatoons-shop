// Gemeinsame Logik für das Anlegen und Ändern von Produkten in der Verwaltung
import { clean } from "./http.js";

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const int = (v, min = 0, max = 100000000) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

export async function readProduct(request, env) {
  const b = await request.json().catch(() => null);
  if (!b) return { error: "invalid_body" };
  const name_de = clean(b.name_de, 200);
  const name_en = clean(b.name_en, 200) || name_de;
  if (!name_de) return { error: "name_required" };
  const slug = slugify(b.slug || name_de);
  if (!slug) return { error: "slug_required" };
  const category = clean(b.category, 60);
  const cat = await env.DB.prepare(`SELECT slug FROM categories WHERE slug = ?1`).bind(category).first();
  if (!cat) return { error: "category_unknown" };
  const price_cents = int(b.price_cents);
  const weight_g = int(b.weight_g, 0, 100000);
  if (price_cents === null) return { error: "price_invalid" };
  if (weight_g === null) return { error: "weight_invalid" };

  let variants = Array.isArray(b.variants) ? b.variants.slice(0, 40) : [];
  variants = variants.map((v, i) => ({
    id: Number.isInteger(v.id) ? v.id : null,
    label: clean(v.label, 60),
    sku: clean(v.sku, 60) || null,
    stock: int(v.stock, 0, 1000000),
    sort: i * 10,
  }));
  if (variants.some((v) => v.stock === null)) return { error: "stock_invalid" };
  if (!variants.length) variants = [{ id: null, label: "", sku: null, stock: 0, sort: 0 }];
  if (variants.length > 1 && variants.some((v) => !v.label)) return { error: "variant_label_required" };

  return {
    slug, category, name_de, name_en,
    desc_de: clean(b.desc_de, 5000), desc_en: clean(b.desc_en, 5000),
    price_cents, weight_g, is_unique: b.is_unique ? 1 : 0, active: b.active ? 1 : 0, sort: int(b.sort, 0, 100000) ?? 0,
    variants,
  };
}

// Varianten abgleichen: vorhandene ändern, neue anlegen, nicht mehr genannte löschen
export async function saveVariants(db, productId, variants) {
  const { results: existing } = await db.prepare(`SELECT id FROM variants WHERE product_id = ?1`).bind(productId).all();
  const known = new Set(existing.map((r) => r.id));
  const keep = new Set();
  const stmts = [];
  for (const v of variants) {
    if (v.id && known.has(v.id)) {
      keep.add(v.id);
      stmts.push(db.prepare(`UPDATE variants SET label = ?2, sku = ?3, stock = ?4, sort = ?5 WHERE id = ?1`).bind(v.id, v.label, v.sku, v.stock, v.sort));
    } else {
      stmts.push(db.prepare(`INSERT INTO variants (product_id, label, sku, stock, sort) VALUES (?1, ?2, ?3, ?4, ?5)`).bind(productId, v.label, v.sku, v.stock, v.sort));
    }
  }
  for (const id of known) if (!keep.has(id)) stmts.push(db.prepare(`DELETE FROM variants WHERE id = ?1`).bind(id));
  if (stmts.length) await db.batch(stmts);
}
