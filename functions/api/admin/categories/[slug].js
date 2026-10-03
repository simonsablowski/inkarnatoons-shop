// /api/admin/categories/:slug
//   PUT     { name_de, name_en }   Kategorie umbenennen (die Adresse bleibt gleich)
//   DELETE  Kategorie löschen, nur wenn ihr keine Produkte mehr zugeordnet sind
import { json, error, requireAdmin, clean } from "../../../_lib/http.js";

export async function onRequestPut({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const b = await request.json().catch(() => null);
  const name_de = clean(b?.name_de, 80);
  if (!name_de) return error("name_required");
  const res = await env.DB
    .prepare(`UPDATE categories SET name_de = ?2, name_en = ?3 WHERE slug = ?1`)
    .bind(params.slug, name_de, clean(b.name_en, 80) || name_de)
    .run();
  return res.meta.changes === 1 ? json({ ok: true }) : error("not_found", 404);
}

export async function onRequestDelete({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM products WHERE category = ?1`).bind(params.slug).first();
  if (n.n > 0) return error("category_in_use", 409);
  const res = await env.DB.prepare(`DELETE FROM categories WHERE slug = ?1`).bind(params.slug).run();
  return res.meta.changes === 1 ? json({ ok: true }) : error("not_found", 404);
}
