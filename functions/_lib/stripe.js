// Stripe-Anbindung ohne SDK (direkt über die REST-API, läuft so in Workers).
// Karte und PayPal laufen beide über Stripe Checkout. PayPal muss im
// Stripe-Dashboard unter Settings → Payment methods aktiviert sein.
import { config } from "./config.js";

function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

const SHIPPING_LABEL = { de: "Versand", en: "Shipping" };

export async function createCheckoutSession(env, order, lines, expiresAt) {
  const l = order.language === "de" ? "de" : "en";
  const currency = config.currency.toLowerCase();
  const params = {
    mode: "payment",
    locale: l,
    client_reference_id: order.id,
    payment_method_types: Object.fromEntries(config.payments.methods.map((m, i) => [i, m])),
    line_items: Object.fromEntries(
      lines.map((line, i) => [
        i,
        {
          quantity: line.qty,
          price_data: {
            currency,
            unit_amount: line.unitCents,
            product_data: { name: line.variantLabel ? `${line.name} (${line.variantLabel})` : line.name },
          },
        },
      ])
    ),
    // Die Versandkosten wurden für genau dieses Land berechnet, deshalb ist nur dieses Land wählbar.
    shipping_address_collection: { allowed_countries: { 0: order.country } },
    shipping_options: {
      0: {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: SHIPPING_LABEL[l],
          fixed_amount: { amount: order.shippingCents, currency },
        },
      },
    },
    phone_number_collection: { enabled: true },
    metadata: { order_id: order.id },
    payment_intent_data: { metadata: { order_id: order.id }, description: `${config.shopName} ${order.id}` },
    expires_at: expiresAt,
    success_url: `${env.PUBLIC_URL}/success.html?order=${order.id}&t=${order.token}&lang=${l}`,
    cancel_url: `${env.PUBLIC_URL}/cart.html?cancelled=${order.id}&t=${order.token}&lang=${l}`,
  };
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: form(params),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("[stripe] session failed", data?.error?.message);
    return { ok: false, message: data?.error?.message };
  }
  await env.DB.prepare(`UPDATE orders SET stripe_session_id = ?2 WHERE id = ?1`).bind(order.id, data.id).run();
  return { ok: true, url: data.url, id: data.id };
}

// Zahlungsart (card, paypal) einer bezahlten Sitzung nachschlagen
export async function paymentMethodType(env, paymentIntentId) {
  if (!paymentIntentId || !env.STRIPE_SECRET_KEY) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}?expand[]=payment_method`, {
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    const data = await res.json();
    return data?.payment_method?.type || null;
  } catch {
    return null;
  }
}

// Prüft die Stripe-Signatur (Header "Stripe-Signature") mit HMAC-SHA256
export async function verifyWebhook(payload, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((s) => s.length === expected.length && timingSafe(s, expected));
}

function timingSafe(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
