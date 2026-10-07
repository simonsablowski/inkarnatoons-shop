// /api/admin/upload – große Dateien (Filme) in Teilen in den R2-Speicher laden.
// Wird vom Skript scripts/upload-film.mjs benutzt, weil eine einzelne Anfrage höchstens 100 MB groß sein darf.
//   POST ?key=film/name.mp4&action=create                 → { uploadId }
//   PUT  ?key=…&uploadId=…&part=1   (Body: Teil der Datei) → { part: { partNumber, etag } }
//   POST ?key=…&uploadId=…&action=complete  { parts:[…] }  → fertig
//   POST ?key=…&uploadId=…&action=abort
// Alle Teile außer dem letzten müssen gleich groß sein.
import { json, error, requireAdmin } from "../../_lib/http.js";

const KEY = /^film\/[a-z0-9][a-z0-9._-]{0,80}\.(mp4|webm)$/;
const TYPES = { mp4: "video/mp4", webm: "video/webm" };

function read(request) {
  const q = new URL(request.url).searchParams;
  const key = q.get("key") || "";
  return { key: KEY.test(key) ? key : null, uploadId: q.get("uploadId") || "", action: q.get("action") || "", part: Number(q.get("part")) };
}

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const { key, uploadId, action } = read(request);
  if (!key) return error("upload_key_invalid");
  try {
    if (action === "create") {
      const up = await env.MEDIA.createMultipartUpload(key, { httpMetadata: { contentType: TYPES[key.split(".").pop()] } });
      return json({ ok: true, uploadId: up.uploadId });
    }
    if (!uploadId) return error("upload_id_missing");
    const up = env.MEDIA.resumeMultipartUpload(key, uploadId);
    if (action === "abort") { await up.abort(); return json({ ok: true }); }
    if (action === "complete") {
      const body = await request.json().catch(() => null);
      if (!Array.isArray(body?.parts) || !body.parts.length) return error("upload_parts_missing");
      const obj = await up.complete(body.parts.map((p) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) })));
      return json({ ok: true, key, size: obj.size, url: `/media/${key}` });
    }
    return error("upload_action_unknown");
  } catch (err) {
    return error("upload_failed", 500, { detail: String(err?.message || err) });
  }
}

export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const { key, uploadId, part } = read(request);
  if (!key) return error("upload_key_invalid");
  if (!uploadId || !Number.isInteger(part) || part < 1 || part > 1000) return error("upload_part_invalid");
  try {
    const data = await request.arrayBuffer();
    if (!data.byteLength) return error("upload_part_empty");
    const done = await env.MEDIA.resumeMultipartUpload(key, uploadId).uploadPart(part, data);
    return json({ ok: true, part: { partNumber: done.partNumber, etag: done.etag } });
  } catch (err) {
    return error("upload_failed", 500, { detail: String(err?.message || err) });
  }
}
