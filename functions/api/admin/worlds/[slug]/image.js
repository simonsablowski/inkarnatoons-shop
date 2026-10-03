// /api/admin/worlds/:slug/image
//   POST    Bilddatei im Body (image/jpeg, image/png oder image/webp): Bild der Kachel auf der Startseite
//   DELETE  Bild entfernen, die Kachel zeigt dann nur den Namen
import { json, error, requireAdmin } from "../../../../_lib/http.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 8 * 1024 * 1024;

async function removeOld(env, image) {
  if (image?.startsWith("/media/")) await env.MEDIA.delete(image.slice(7));
}

export async function onRequestPost({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const type = (request.headers.get("content-type") || "").split(";")[0];
  const ext = TYPES[type];
  if (!ext) return error("image_type_unsupported", 415);
  const world = await env.DB.prepare(`SELECT slug, image FROM worlds WHERE slug = ?1`).bind(params.slug).first();
  if (!world) return error("not_found", 404);
  const data = await request.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX_BYTES) return error("image_too_large", 413);

  const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = `worlds/${world.slug}-${rand}.${ext}`;
  await env.MEDIA.put(key, data, { httpMetadata: { contentType: type } });
  await env.DB.prepare(`UPDATE worlds SET image = ?2 WHERE slug = ?1`).bind(world.slug, `/media/${key}`).run();
  await removeOld(env, world.image);
  return json({ ok: true, image: `/media/${key}` });
}

export async function onRequestDelete({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const world = await env.DB.prepare(`SELECT image FROM worlds WHERE slug = ?1`).bind(params.slug).first();
  if (!world) return error("not_found", 404);
  await env.DB.prepare(`UPDATE worlds SET image = NULL WHERE slug = ?1`).bind(params.slug).run();
  await removeOld(env, world.image);
  return json({ ok: true });
}
