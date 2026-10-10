// Produktkatalog (Cloudflare D1)

const LIST_SQL = `
  SELECT p.id, p.slug, p.world, p.category, p.name_de, p.name_en, p.price_cents, p.is_unique, p.active, p.sort, p.created_at,
    (SELECT COALESCE(SUM(stock),0) FROM variants v WHERE v.product_id = p.id) AS stock,
    (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.id) AS variant_count,
    (SELECT path FROM images i WHERE i.product_id = p.id ORDER BY i.sort, i.id LIMIT 1) AS image
  FROM products p`;

const SORTS = {
  // Standard: günstigste zuerst. Später soll hier "neueste zuerst" stehen (wie newest).
  default: "p.price_cents ASC, p.sort ASC, p.id ASC",
  newest: "p.created_at DESC, p.id DESC",
  price_asc: "p.price_cents ASC, p.id ASC",
  price_desc: "p.price_cents DESC, p.id ASC",
};

export async function listProducts(db, { world, category, q, inStock, maxCents, sort, includeInactive } = {}) {
  const where = [];
  const vals = [];
  const add = (sql, v) => { vals.push(v); where.push(sql.replaceAll("?", `?${vals.length}`)); };
  if (!includeInactive) where.push("p.active = 1");
  if (world) add("p.world = ?", world);
  if (category) add("p.category = ?", category);
  if (q) add("(p.name_de LIKE ? OR p.name_en LIKE ? OR p.desc_de LIKE ? OR p.desc_en LIKE ?)", `%${q.replace(/[%_]/g, "")}%`);
  if (Number.isFinite(maxCents)) add("p.price_cents <= ?", maxCents);
  if (inStock) where.push("EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.stock > 0)");
  const sql = `${LIST_SQL} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${SORTS[sort] || SORTS.default} LIMIT 500`;
  const { results } = await db.prepare(sql).bind(...vals).all();
  return results;
}

export async function getProduct(db, key, { bySlug = true, includeInactive = false } = {}) {
  const p = await db
    .prepare(`SELECT * FROM products WHERE ${bySlug ? "slug" : "id"} = ?1 ${includeInactive ? "" : "AND active = 1"}`)
    .bind(key)
    .first();
  if (!p) return null;
  const [v, i] = await db.batch([
    db.prepare(`SELECT id, label, sku, stock, sort FROM variants WHERE product_id = ?1 ORDER BY sort, id`).bind(p.id),
    db.prepare(`SELECT id, path, sort FROM images WHERE product_id = ?1 ORDER BY sort, id`).bind(p.id),
  ]);
  return { ...p, variants: v.results, images: i.results };
}

export async function listCategories(db) {
  const { results } = await db.prepare(`SELECT slug, name_de, name_en FROM categories ORDER BY sort, slug`).all();
  return results;
}

// Der Bestand wird nach außen nur grob gezeigt: genaue Zahl erst, wenn es knapp wird.
export async function listWorlds(db) {
  const { results } = await db
    .prepare(
      `SELECT w.slug, w.name, w.tagline_de, w.tagline_en, w.image, w.title_image, w.figure_image,
         (SELECT COUNT(*) FROM products p WHERE p.world = w.slug AND p.active = 1) AS product_count
       FROM worlds w ORDER BY w.sort, w.slug`
    )
    .all();
  return results;
}

export function publicStock(n) {
  return { available: n > 0, low: n > 0 && n <= 3, left: n > 0 && n <= 3 ? n : null };
}
