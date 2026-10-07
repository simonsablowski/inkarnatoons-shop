// /api/admin/worlds/:slug/image?kind=tile|title|figure
//   POST    Bilddatei im Body (image/jpeg, image/png oder image/webp)
//   DELETE  Bild entfernen
// kind: tile = Kachelbild auf der Startseite (Standard), title = gezeichneter Schriftzug mit dem Namen,
//       figure = einzelne Figur neben der Kachel
import { json, error, requireAdmin } from "../../../../_lib/http.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const COLUMNS = { tile: "image", title: "title_image", figure: "figure_image" };
const MAX_BYTES = 8 * 1024 * 1024;

const column = (request) => COLUMNS[new URL(request.url).searchParams.get("kind") || "tile"];

async function removeOld(env, image) {
  if (image?.startsWith("/media/")) await env.MEDIA.delete(image.slice(7));
}

export async function onRequestPost({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const col = column(request);
  if (!col) return error("image_kind_unknown");
  const type = (request.headers.get("content-type") || "").split(";")[0];
  const ext = TYPES[type];
  if (!ext) return error("image_type_unsupported", 415);
  const world = await env.DB.prepare(`SELECT slug, ${col} AS old FROM worlds WHERE slug = ?1`).bind(params.slug).first();
  if (!world) return error("not_found", 404);
  const data = await request.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX_BYTES) return error("image_too_large", 413);

  const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = `worlds/${world.slug}-${col === "image" ? "" : col.replace("_image", "") + "-"}${rand}.${ext}`;
  await env.MEDIA.put(key, data, { httpMetadata: { contentType: type } });
  await env.DB.prepare(`UPDATE worlds SET ${col} = ?2 WHERE slug = ?1`).bind(world.slug, `/media/${key}`).run();
  await removeOld(env, world.old);
  return json({ ok: true, image: `/media/${key}` });
}

export async function onRequestDelete({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const col = column(request);
  if (!col) return error("image_kind_unknown");
  const world = await env.DB.prepare(`SELECT ${col} AS old FROM worlds WHERE slug = ?1`).bind(params.slug).first();
  if (!world) return error("not_found", 404);
  await env.DB.prepare(`UPDATE worlds SET ${col} = NULL WHERE slug = ?1`).bind(params.slug).run();
  await removeOld(env, world.old);
  return json({ ok: true });
}
