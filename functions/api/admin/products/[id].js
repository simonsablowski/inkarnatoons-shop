// /api/admin/products/:id
//   GET     Produkt mit Varianten und Bildern
//   PUT     Produkt speichern
//   PATCH   { variantId, stock }  nur den Bestand einer Variante setzen
//   DELETE  Produkt löschen (samt Varianten und Bildern)
import { getProduct } from "../../../_lib/catalog.js";
import { json, error, requireAdmin } from "../../../_lib/http.js";
import { readProduct, saveVariants } from "../../../_lib/adminProducts.js";

export async function onRequestGet({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const product = await getProduct(env.DB, Number(params.id), { bySlug: false, includeInactive: true });
  return product ? json({ ok: true, product }) : error("not_found", 404);
}

export async function onRequestPut({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const id = Number(params.id);
  const p = await readProduct(request, env);
  if (p.error) return error(p.error);
  try {
    const res = await env.DB
      .prepare(
        `UPDATE products SET slug = ?2, category = ?3, name_de = ?4, name_en = ?5, desc_de = ?6, desc_en = ?7,
           price_cents = ?8, weight_g = ?9, is_unique = ?10, active = ?11, sort = ?12,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
         WHERE id = ?1`
      )
      .bind(id, p.slug, p.category, p.name_de, p.name_en, p.desc_de, p.desc_en, p.price_cents, p.weight_g, p.is_unique, p.active, p.sort)
      .run();
    if (res.meta.changes !== 1) return error("not_found", 404);
  } catch (err) {
    if (String(err).includes("UNIQUE")) return error("slug_taken", 409);
    throw err;
  }
  await saveVariants(env.DB, id, p.variants);
  return json({ ok: true, id });
}

export async function onRequestPatch({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const b = await request.json().catch(() => ({}));
  const stock = Math.round(Number(b.stock));
  if (!Number.isInteger(b.variantId) || !Number.isFinite(stock) || stock < 0) return error("stock_invalid");
  const res = await env.DB
    .prepare(`UPDATE variants SET stock = ?3 WHERE id = ?2 AND product_id = ?1`)
    .bind(Number(params.id), b.variantId, stock)
    .run();
  return res.meta.changes === 1 ? json({ ok: true }) : error("not_found", 404);
}

export async function onRequestDelete({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const id = Number(params.id);
  const { results: imgs } = await env.DB.prepare(`SELECT path FROM images WHERE product_id = ?1`).bind(id).all();
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM images WHERE product_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM variants WHERE product_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM products WHERE id = ?1`).bind(id),
  ]);
  for (const i of imgs) if (i.path.startsWith("/media/")) await env.MEDIA.delete(i.path.slice(7));
  return json({ ok: true });
}
