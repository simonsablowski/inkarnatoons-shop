// GET  /api/admin/orders/:id   Bestellung mit Verkäuferdaten für Rechnung und Adressaufkleber
// POST /api/admin/orders/:id
//   { action: "ship", tracking, notify }   als versendet markieren, optional Versandmail schicken
//   { action: "cancel" }                   stornieren und Bestand zurückbuchen (Erstattung separat in Stripe)
import { json, error, requireAdmin, clean } from "../../../_lib/http.js";
import { getOrder, releaseOrder, assignInvoiceNumber } from "../../../_lib/orders.js";
import { config } from "../../../_lib/config.js";
import { sendShippedNotice } from "../../../_lib/mail.js";

export async function onRequestGet({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  await assignInvoiceNumber(env.DB, params.id); // für ältere Bestellungen ohne Nummer
  const order = await getOrder(env.DB, params.id);
  if (!order) return error("not_found", 404);
  const { _hinweis, ...seller } = config.seller;
  return json({
    ok: true,
    order: { ...order, token: undefined },
    seller,
    tax: { mode: config.tax.mode, ratePercent: config.tax.ratePercent },
    label: { widthMm: config.label.widthMm, heightMm: config.label.heightMm },
    shopName: config.shopName,
  });
}

export async function onRequestPost({ request, env, params, waitUntil }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const order = await getOrder(env.DB, params.id);
  if (!order) return error("not_found", 404);

  if (body.action === "ship") {
    if (order.status !== "paid" && order.status !== "shipped") return error("not_paid", 409);
    await env.DB
      .prepare(`UPDATE orders SET status = 'shipped', tracking = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?1`)
      .bind(order.id, clean(body.tracking, 120) || null)
      .run();
    if (body.notify) waitUntil(sendShippedNotice(env, await getOrder(env.DB, order.id)));
    return json({ ok: true });
  }
  if (body.action === "cancel") {
    const released = await releaseOrder(env.DB, order.id, "cancelled", ["pending_payment", "paid"]);
    return released ? json({ ok: true }) : error("cannot_cancel", 409);
  }
  return error("invalid_action");
}
