// POST /api/checkout { items:[{variantId, qty}], country, lang }
// Reserviert den Bestand, legt die Bestellung an und leitet zu Stripe Checkout weiter.
import { parseItems, priceCart, reserveStock, createOrder, releaseOrder, releaseExpired, markPaid, newOrderId, newToken } from "../_lib/orders.js";
import { config, isCountry, lang } from "../_lib/config.js";
import { createCheckoutSession } from "../_lib/stripe.js";
import { json, error } from "../_lib/http.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const items = parseItems(body.items);
  if (!items) return error("invalid_items");
  if (!isCountry(body.country)) return error("country_not_served");
  const language = lang(body.lang);

  const fake = !env.STRIPE_SECRET_KEY && env.DEV_FAKE_PAYMENT === "1";
  if (!env.STRIPE_SECRET_KEY && !fake) return error("payments_not_configured", 503);

  await releaseExpired(env.DB);

  const cart = await priceCart(env.DB, items, body.country, language);
  if (cart.issues.length) return error("cart_changed", 409, { issues: cart.issues });
  if (!cart.shipping.ok) return error(cart.shipping.error, 422);

  const reserved = await reserveStock(env.DB, cart.lines);
  if (!reserved.ok) return error("cart_changed", 409, { issues: [{ variantId: reserved.variantId, code: "sold_out" }] });

  // Stripe hält die Bezahlseite so lange offen; der Bestand bleibt etwas länger reserviert.
  const stripeExpires = Math.floor(Date.now() / 1000) + config.payments.holdMinutes * 60;
  const order = {
    id: newOrderId(), token: newToken(), language, country: body.country, currency: config.currency,
    subtotalCents: cart.subtotalCents, shippingCents: cart.shipping.cents, totalCents: cart.totalCents,
    weightG: cart.shipping.weightG, zone: cart.shipping.zone,
    holdExpiresAt: new Date((stripeExpires + 300) * 1000).toISOString().replace(/\.\d+Z$/, "Z"),
  };
  await createOrder(env.DB, order, cart.lines);

  if (fake) {
    await markPaid(env.DB, order.id, { email: "test@example.com", name: "Testbestellung", paymentMethod: "test",
      address: { line1: "Teststraße 1", postal_code: "10245", city: "Berlin", country: order.country } });
    return json({ ok: true, url: `/success.html?order=${order.id}&t=${order.token}&lang=${language}` });
  }

  const session = await createCheckoutSession(env, order, cart.lines, stripeExpires);
  if (!session.ok) {
    await releaseOrder(env.DB, order.id, "cancelled");
    return error("payment_unavailable", 502);
  }
  return json({ ok: true, url: session.url });
}
