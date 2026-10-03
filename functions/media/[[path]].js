// GET /media/... – liefert hochgeladene Produktbilder aus dem R2-Speicher
export async function onRequestGet({ env, params, request }) {
  const key = Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  if (request.headers.get("if-none-match") === obj.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { headers });
}
