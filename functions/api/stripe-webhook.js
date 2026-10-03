// POST /api/stripe-webhook – Zahlungsereignisse von Stripe
import { verifyWebhook, paymentMethodType } from "../_lib/stripe.js";
import { getOrder, markPaid, releaseOrder } from "../_lib/orders.js";
import { json, error } from "../_lib/http.js";
import { sendOrderConfirmation, sendShopNotification } from "../_lib/mail.js";

export async function onRequestPost({ request, env, waitUntil }) {
  const payload = await request.text();
  const ok = await verifyWebhook(payload, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return error("invalid_signature", 400);

  const event = JSON.parse(payload);
  const session = event.data?.object;
  const orderId = session?.metadata?.order_id;
  if (!orderId) return json({ received: true });
  const order = await getOrder(env.DB, orderId);
  if (!order) return json({ received: true });

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (session.payment_status !== "paid") break; // Zahlung noch offen, das Erfolgsereignis folgt später
      const shipping = session.collected_information?.shipping_details || session.shipping_details || {};
      const customer = session.customer_details || {};
      const wasInactive = order.status === "cancelled" || order.status === "expired";
      const changed = await markPaid(env.DB, orderId, {
        email: customer.email, phone: customer.phone, name: shipping.name || customer.name,
        address: shipping.address || customer.address,
        paymentMethod: await paymentMethodType(env, session.payment_intent),
        paymentId: session.payment_intent,
      });
      if (changed) {
        if (wasInactive) {
          // Zahlung kam nach Abbruch oder Ablauf der Reservierung: Bestand war schon wieder frei.
          await env.DB.prepare(`UPDATE orders SET note = 'Zahlung nach Ablauf der Reservierung. Bestand bitte prüfen.' WHERE id = ?1`).bind(orderId).run();
          await env.DB.batch(order.items.filter((i) => i.variant_id).map((i) =>
            env.DB.prepare(`UPDATE variants SET stock = MAX(0, stock - ?2) WHERE id = ?1`).bind(i.variant_id, i.quantity)));
        }
        const updated = await getOrder(env.DB, orderId);
        waitUntil(Promise.all([sendOrderConfirmation(env, updated), sendShopNotification(env, updated)]));
      }
      break;
    }
    case "checkout.session.expired":
      await releaseOrder(env.DB, orderId, "expired");
      break;
    case "checkout.session.async_payment_failed":
      await releaseOrder(env.DB, orderId, "cancelled");
      break;
  }
  return json({ received: true });
}
