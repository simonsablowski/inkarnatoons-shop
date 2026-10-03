// GET  /api/orders/:id?t=token          Bestellübersicht für die Käuferin oder den Käufer
// POST /api/orders/:id?t=token {action:"cancel"}  abgebrochene Zahlung: Reservierung sofort freigeben
import { getOrder, releaseOrder } from "../../_lib/orders.js";
import { json, error, safeEqual } from "../../_lib/http.js";

async function load(request, env, id) {
  const token = new URL(request.url).searchParams.get("t") || "";
  const order = await getOrder(env.DB, id);
  if (!order || !(await safeEqual(token, order.token))) return null;
  return order;
}

export async function onRequestGet({ request, env, params }) {
  const o = await load(request, env, params.id);
  if (!o) return error("not_found", 404);
  return json({
    ok: true,
    order: {
      id: o.id, status: o.status, currency: o.currency, country: o.country, subtotalCents: o.subtotal_cents,
      shippingCents: o.shipping_cents, totalCents: o.total_cents, tracking: o.tracking, zone: o.shipping_zone,
      items: o.items.map((i) => ({ name: i.name, variantLabel: i.variant_label, qty: i.quantity, unitCents: i.unit_cents })),
    },
  });
}

export async function onRequestPost({ request, env, params }) {
  const o = await load(request, env, params.id);
  if (!o) return error("not_found", 404);
  const body = await request.json().catch(() => ({}));
  if (body.action !== "cancel") return error("invalid_action");
  // Die Stripe-Sitzung läuft von selbst ab; eine späte Zahlung würde der Webhook trotzdem verbuchen.
  const released = await releaseOrder(env.DB, o.id, "cancelled");
  return json({ ok: true, released });
}
