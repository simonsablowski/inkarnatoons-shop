// E-Mail-Versand über Resend (https://resend.com). Ohne RESEND_API_KEY werden
// die Mails nur ins Log geschrieben, damit lokal alles funktioniert.
import { config } from "./config.js";
import { escapeHtml as e } from "./http.js";

async function send(env, { to, subject, html, replyTo }) {
  if (!to) return { skipped: "no_recipient" };
  if (!env.RESEND_API_KEY) {
    console.log(`[mail:dry-run] to=${to} subject=${subject}`);
    return { skipped: "no_api_key" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html, reply_to: replyTo }),
  });
  if (!res.ok) console.error("[mail] failed", res.status, await res.text());
  return { ok: res.ok };
}

const T = {
  de: {
    confirmSubject: (id) => `Deine Bestellung ${id} im ${config.shopName}`,
    hello: (n) => (n ? `Hallo ${n},` : "Hallo,"),
    confirmIntro: "vielen Dank für deine Bestellung. Die Zahlung ist eingegangen. Wir melden uns, sobald das Paket unterwegs ist.",
    shippedSubject: (id) => `Deine Bestellung ${id} ist unterwegs`,
    shippedIntro: "dein Paket ist auf dem Weg zu dir.",
    tracking: "Sendungsnummer",
    order: "Bestellnummer", subtotal: "Zwischensumme", shipping: "Versand", total: "Gesamt", shipTo: "Lieferadresse",
    customs: "Bei Lieferungen in Länder außerhalb der EU können Zölle und Einfuhrabgaben anfallen. Diese trägt die Empfängerin oder der Empfänger.",
    link: "Bestellübersicht ansehen", questions: "Bei Fragen antworte einfach auf diese E-Mail.",
  },
  en: {
    confirmSubject: (id) => `Your order ${id} at the ${config.shopName}`,
    hello: (n) => (n ? `Hello ${n},` : "Hello,"),
    confirmIntro: "thank you for your order. We have received your payment and will let you know when the parcel is on its way.",
    shippedSubject: (id) => `Your order ${id} is on its way`,
    shippedIntro: "your parcel is on its way to you.",
    tracking: "Tracking number",
    order: "Order number", subtotal: "Subtotal", shipping: "Shipping", total: "Total", shipTo: "Delivery address",
    customs: "For deliveries to countries outside the EU, customs duties and import taxes may apply. These are paid by the recipient.",
    link: "View order summary", questions: "If you have questions, reply to this email.",
  },
};

const money = (cents, l, currency) => new Intl.NumberFormat(l === "de" ? "de-DE" : "en-GB", { style: "currency", currency }).format(cents / 100);

function addressLines(order) {
  let a = null;
  try { a = order.shipping_address ? JSON.parse(order.shipping_address) : null; } catch { /* leer */ }
  if (!a) return [];
  return [order.customer_name, a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state, a.country].filter(Boolean);
}

function layout(inner) {
  return `<!doctype html><html><body style="margin:0;background:#6f766c;font-family:Helvetica,Arial,sans-serif;color:#141414">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#fbf4e2">
  <p style="font-size:20px;font-weight:bold;color:#c4121a;margin:0 0 24px">${e(config.shopName)}</p>
  ${inner}
  </div></body></html>`;
}

function itemsTable(order, t, l) {
  const rows = order.items
    .map((i) => `<tr><td style="padding:6px 0">${i.quantity} × ${e(i.name)}${i.variant_label ? ` (${e(i.variant_label)})` : ""}</td>
      <td style="padding:6px 0;text-align:right;white-space:nowrap">${money(i.unit_cents * i.quantity, l, order.currency)}</td></tr>`)
    .join("");
  const sum = (label, cents, bold) => `<tr><td style="padding:6px 0;${bold ? "font-weight:bold;border-top:2px solid #141414" : ""}">${label}</td>
      <td style="padding:6px 0;text-align:right;${bold ? "font-weight:bold;border-top:2px solid #141414" : ""}">${money(cents, l, order.currency)}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:15px">${rows}
    ${sum(t.subtotal, order.subtotal_cents)}${sum(t.shipping, order.shipping_cents)}${sum(t.total, order.total_cents, true)}</table>`;
}

function orderLink(env, order, t, l) {
  return `<p><a href="${env.PUBLIC_URL}/success.html?order=${order.id}&t=${order.token}&lang=${l}" style="color:#c4121a">${t.link}</a></p>`;
}

export function sendOrderConfirmation(env, order) {
  const l = order.language === "de" ? "de" : "en";
  const t = T[l];
  const addr = addressLines(order).map(e).join("<br>");
  const html = layout(`<p>${e(t.hello(order.customer_name))}</p><p>${t.confirmIntro}</p>
    <p><strong>${t.order}:</strong> ${e(order.id)}</p>
    ${itemsTable(order, t, l)}
    ${addr ? `<p><strong>${t.shipTo}</strong><br>${addr}</p>` : ""}
    ${order.shipping_zone === "de" || order.shipping_zone === "eu" ? "" : `<p style="font-size:13px">${t.customs}</p>`}
    ${orderLink(env, order, t, l)}<p>${t.questions}</p>`);
  return send(env, { to: order.email, subject: t.confirmSubject(order.id), html, replyTo: env.SHOP_EMAIL });
}

export function sendShippedNotice(env, order) {
  const l = order.language === "de" ? "de" : "en";
  const t = T[l];
  const html = layout(`<p>${e(t.hello(order.customer_name))}</p><p>${t.shippedIntro}</p>
    <p><strong>${t.order}:</strong> ${e(order.id)}</p>
    ${order.tracking ? `<p><strong>${t.tracking}:</strong> ${e(order.tracking)}</p>` : ""}
    ${orderLink(env, order, t, l)}<p>${t.questions}</p>`);
  return send(env, { to: order.email, subject: t.shippedSubject(order.id), html, replyTo: env.SHOP_EMAIL });
}

export function sendShopNotification(env, order) {
  const t = T.de;
  const addr = addressLines(order).map(e).join("<br>");
  const html = layout(`<p>Neue bezahlte Bestellung <strong>${e(order.id)}</strong></p>
    ${itemsTable(order, t, "de")}
    <p><strong>Lieferadresse</strong><br>${addr || "(fehlt)"}</p>
    <p>${e(order.email || "")}${order.phone ? `<br>${e(order.phone)}` : ""}</p>
    <p>Gewicht inkl. Verpackung: ${order.weight_g} g · Zahlung: ${e(order.payment_method || "–")}</p>
    <p><a href="${env.PUBLIC_URL}/admin.html" style="color:#c4121a">Zur Verwaltung</a></p>`);
  return send(env, { to: env.SHOP_EMAIL, subject: `Neue Bestellung ${order.id}`, html, replyTo: order.email });
}
