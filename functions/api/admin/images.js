// /api/admin/images
//   POST   ?product=ID   Bilddatei im Body (Content-Type image/jpeg, image/png oder image/webp)
//   PUT    { product, order:[imageId, ...] }   Reihenfolge festlegen (erstes Bild = Titelbild)
//   DELETE ?id=IMAGE_ID
import { json, error, requireAdmin } from "../../_lib/http.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 8 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const productId = Number(new URL(request.url).searchParams.get("product"));
  const type = (request.headers.get("content-type") || "").split(";")[0];
  const ext = TYPES[type];
  if (!ext) return error("image_type_unsupported", 415);
  const product = await env.DB.prepare(`SELECT id, slug FROM products WHERE id = ?1`).bind(productId).first();
  if (!product) return error("not_found", 404);
  const data = await request.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX_BYTES) return error("image_too_large", 413);

  const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = `products/${product.slug}-${rand}.${ext}`;
  await env.MEDIA.put(key, data, { httpMetadata: { contentType: type } });
  const next = await env.DB.prepare(`SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM images WHERE product_id = ?1`).bind(productId).first();
  const res = await env.DB.prepare(`INSERT INTO images (product_id, path, sort) VALUES (?1, ?2, ?3)`).bind(productId, `/media/${key}`, next.n).run();
  return json({ ok: true, id: res.meta.last_row_id, path: `/media/${key}` });
}

export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const b = await request.json().catch(() => ({}));
  if (!Number.isInteger(b.product) || !Array.isArray(b.order) || !b.order.every(Number.isInteger)) return error("invalid_body");
  if (b.order.length) {
    await env.DB.batch(b.order.map((id, i) => env.DB.prepare(`UPDATE images SET sort = ?3 WHERE id = ?2 AND product_id = ?1`).bind(b.product, id, i)));
  }
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const id = Number(new URL(request.url).searchParams.get("id"));
  const img = await env.DB.prepare(`SELECT path FROM images WHERE id = ?1`).bind(id).first();
  if (!img) return error("not_found", 404);
  await env.DB.prepare(`DELETE FROM images WHERE id = ?1`).bind(id).run();
  if (img.path.startsWith("/media/")) await env.MEDIA.delete(img.path.slice(7));
  return json({ ok: true });
}
