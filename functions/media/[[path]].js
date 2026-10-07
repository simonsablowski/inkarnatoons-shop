// GET /media/... – liefert hochgeladene Bilder und Videos aus dem R2-Speicher.
// Teilabrufe (Range) werden unterstützt, damit man in Videos spulen kann und sie sofort starten.
const key = (params) => (Array.isArray(params.path) ? params.path.join("/") : String(params.path || ""));

function baseHeaders(obj, k) {
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("accept-ranges", "bytes");
  // Bilder haben zufällige Namen und ändern sich nie. Videos behalten ihren Namen, wenn sie ersetzt werden.
  headers.set("cache-control", k.startsWith("film/") ? "public, max-age=3600" : "public, max-age=31536000, immutable");
  return headers;
}

export async function onRequestGet({ env, params, request }) {
  const k = key(params);
  if (request.headers.get("if-none-match")) {
    const head = await env.MEDIA.head(k);
    if (!head) return new Response("Not found", { status: 404 });
    if (request.headers.get("if-none-match") === head.httpEtag) return new Response(null, { status: 304, headers: baseHeaders(head, k) });
  }
  const wantsRange = request.headers.has("range");
  let obj;
  try {
    obj = await env.MEDIA.get(k, wantsRange ? { range: request.headers } : undefined);
  } catch {
    return new Response("Range not satisfiable", { status: 416 });
  }
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = baseHeaders(obj, k);
  if (wantsRange && obj.range) {
    const offset = obj.range.offset ?? Math.max(0, obj.size - (obj.range.suffix ?? 0));
    const length = obj.range.length ?? obj.size - offset;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set("content-length", String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("content-length", String(obj.size));
  return new Response(obj.body, { headers });
}

export async function onRequestHead({ env, params }) {
  const k = key(params);
  const head = await env.MEDIA.head(k);
  if (!head) return new Response(null, { status: 404 });
  const headers = baseHeaders(head, k);
  headers.set("content-length", String(head.size));
  return new Response(null, { headers });
}
