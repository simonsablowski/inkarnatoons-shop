// /api/admin/worlds/:slug
//   PUT     { name, tagline_de, tagline_en }   Themenwelt ändern (die Adresse bleibt gleich)
//   DELETE  Themenwelt löschen, nur wenn ihr keine Produkte mehr zugeordnet sind
import { json, error, requireAdmin, clean } from "../../../_lib/http.js";

export async function onRequestPut({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const b = await request.json().catch(() => null);
  const name = clean(b?.name, 80);
  if (!name) return error("name_required");
  const res = await env.DB
    .prepare(`UPDATE worlds SET name = ?2, tagline_de = ?3, tagline_en = ?4 WHERE slug = ?1`)
    .bind(params.slug, name, clean(b.tagline_de, 200), clean(b.tagline_en, 200))
    .run();
  return res.meta.changes === 1 ? json({ ok: true }) : error("not_found", 404);
}

export async function onRequestDelete({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const world = await env.DB.prepare(`SELECT image, title_image, figure_image, (SELECT COUNT(*) FROM products p WHERE p.world = worlds.slug) AS n FROM worlds WHERE slug = ?1`).bind(params.slug).first();
  if (!world) return error("not_found", 404);
  if (world.n > 0) return error("world_in_use", 409);
  await env.DB.prepare(`DELETE FROM worlds WHERE slug = ?1`).bind(params.slug).run();
  for (const img of [world.image, world.title_image, world.figure_image]) {
    if (img?.startsWith("/media/")) await env.MEDIA.delete(img.slice(7));
  }
  return json({ ok: true });
}
