// /api/admin/products
//   GET   Liste aller Produkte (auch Entwürfe) mit Varianten und Beständen
//   POST  neues Produkt anlegen
import { listProducts, listCategories } from "../../_lib/catalog.js";
import { json, error, requireAdmin } from "../../_lib/http.js";
import { readProduct, saveVariants } from "../../_lib/adminProducts.js";

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const products = await listProducts(env.DB, { includeInactive: true });
  const { results: variants } = await env.DB.prepare(`SELECT id, product_id, label, sku, stock FROM variants ORDER BY sort, id`).all();
  const byProduct = new Map();
  for (const v of variants) (byProduct.get(v.product_id) || byProduct.set(v.product_id, []).get(v.product_id)).push(v);
  return json({
    ok: true,
    categories: await listCategories(env.DB),
    products: products.map((p) => ({ ...p, variants: byProduct.get(p.id) || [] })),
  });
}

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const p = await readProduct(request, env);
  if (p.error) return error(p.error);
  try {
    const res = await env.DB
      .prepare(
        `INSERT INTO products (slug, category, name_de, name_en, desc_de, desc_en, price_cents, weight_g, is_unique, active, sort)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
      )
      .bind(p.slug, p.category, p.name_de, p.name_en, p.desc_de, p.desc_en, p.price_cents, p.weight_g, p.is_unique, p.active, p.sort)
      .run();
    const id = res.meta.last_row_id;
    await saveVariants(env.DB, id, p.variants);
    return json({ ok: true, id });
  } catch (err) {
    if (String(err).includes("UNIQUE")) return error("slug_taken", 409);
    throw err;
  }
}
