// GET /api/admin/orders?all=1 – Bestellungen (Standard: bezahlte und versendete, mit all=1 auch offene und abgebrochene)
import { json, requireAdmin } from "../../_lib/http.js";
import { releaseExpired } from "../../_lib/orders.js";

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  await releaseExpired(env.DB);
  const all = new URL(request.url).searchParams.get("all") === "1";
  const { results: orders } = await env.DB
    .prepare(`SELECT * FROM orders ${all ? "" : "WHERE status IN ('paid','shipped')"} ORDER BY created_at DESC LIMIT 300`)
    .all();
  const { results: items } = await env.DB
    .prepare(`SELECT * FROM order_items WHERE order_id IN (SELECT id FROM orders ORDER BY created_at DESC LIMIT 300)`)
    .all();
  const byOrder = new Map();
  for (const i of items) (byOrder.get(i.order_id) || byOrder.set(i.order_id, []).get(i.order_id)).push(i);
  return json({ ok: true, orders: orders.map((o) => ({ ...o, token: undefined, items: byOrder.get(o.id) || [] })) });
}
