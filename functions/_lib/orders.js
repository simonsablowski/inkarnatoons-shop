// Warenkorb bewerten, Bestand reservieren und wieder freigeben, Bestellungen speichern
import { config, lang as pickLang } from "./config.js";
import { shippingFor } from "./shipping.js";

const NOW = `strftime('%Y-%m-%dT%H:%M:%SZ','now')`;
const MAX_LINES = 50;
const MAX_QTY = 20;

// Eingabe aus dem Browser säubern: [{ variantId, qty }]
export function parseItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINES) return null;
  const merged = new Map();
  for (const it of raw) {
    const id = Number(it?.variantId);
    const qty = Number(it?.qty);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(qty) || qty <= 0) return null;
    merged.set(id, Math.min(MAX_QTY, (merged.get(id) || 0) + qty));
  }
  return [...merged].map(([variantId, qty]) => ({ variantId, qty }));
}

// Preise, Gewicht und Verfügbarkeit kommen immer aus der Datenbank, nie aus dem Browser.
export async function priceCart(db, items, country, language = "de") {
  const l = pickLang(language);
  const ids = items.map((i) => i.variantId);
  const { results } = await db
    .prepare(
      `SELECT v.id AS variant_id, v.label, v.sku, v.stock, p.id AS product_id, p.slug, p.name_de, p.name_en,
              p.price_cents, p.weight_g, p.active,
              (SELECT path FROM images i WHERE i.product_id = p.id ORDER BY i.sort, i.id LIMIT 1) AS image
       FROM variants v JOIN products p ON p.id = v.product_id
       WHERE v.id IN (${ids.map((_, i) => `?${i + 1}`).join(",")})`
    )
    .bind(...ids)
    .all();
  const byId = new Map(results.map((r) => [r.variant_id, r]));

  const lines = [];
  const issues = [];
  let subtotal = 0;
  let weight = 0;
  for (const it of items) {
    const r = byId.get(it.variantId);
    if (!r || !r.active) { issues.push({ variantId: it.variantId, code: "unavailable" }); continue; }
    if (r.stock <= 0) issues.push({ variantId: it.variantId, code: "sold_out" });
    else if (r.stock < it.qty) issues.push({ variantId: it.variantId, code: "not_enough", available: r.stock });
    const line = {
      variantId: r.variant_id, productId: r.product_id, slug: r.slug, sku: r.sku,
      name: l === "de" ? r.name_de : r.name_en, variantLabel: r.label, image: r.image,
      qty: it.qty, unitCents: r.price_cents, totalCents: r.price_cents * it.qty, maxQty: Math.min(r.stock, MAX_QTY),
    };
    lines.push(line);
    subtotal += line.totalCents;
    weight += r.weight_g * it.qty;
  }
  const shipping = country ? shippingFor(country, weight, subtotal) : null;
  return {
    lines, issues, currency: config.currency, subtotalCents: subtotal, itemsWeightG: weight, shipping,
    totalCents: shipping?.ok ? subtotal + shipping.cents : null,
  };
}

export function newOrderId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `${config.orderPrefix}-${s}`;
}

export function newToken() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Zieht den Bestand für alle Positionen ab. Jede Position ist eine einzelne
// SQL-Anweisung mit Bedingung (stock >= Menge), damit zwei gleichzeitige Käufer
// nie dasselbe Stück bekommen. Schlägt eine Position fehl, werden die bereits
// abgezogenen wieder gutgeschrieben.
export async function reserveStock(db, lines) {
  const done = [];
  for (const line of lines) {
    const res = await db
      .prepare(`UPDATE variants SET stock = stock - ?2 WHERE id = ?1 AND stock >= ?2`)
      .bind(line.variantId, line.qty)
      .run();
    if (res.meta.changes !== 1) {
      await restoreStock(db, done);
      return { ok: false, variantId: line.variantId };
    }
    done.push(line);
  }
  return { ok: true };
}

async function restoreStock(db, lines) {
  if (!lines.length) return;
  await db.batch(lines.map((l) => db.prepare(`UPDATE variants SET stock = stock + ?2 WHERE id = ?1`).bind(l.variantId, l.qty)));
}

export async function createOrder(db, o, lines) {
  await db.batch([
    db
      .prepare(
        `INSERT INTO orders (id, token, status, language, country, subtotal_cents, shipping_cents, total_cents,
           currency, weight_g, shipping_zone, hold_expires_at)
         VALUES (?1, ?2, 'pending_payment', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
      )
      .bind(o.id, o.token, o.language, o.country, o.subtotalCents, o.shippingCents, o.totalCents, o.currency, o.weightG, o.zone, o.holdExpiresAt),
    ...lines.map((l) =>
      db
        .prepare(
          `INSERT INTO order_items (order_id, variant_id, product_id, name, variant_label, sku, quantity, unit_cents)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
        )
        .bind(o.id, l.variantId, l.productId, l.name, l.variantLabel, l.sku ?? null, l.qty, l.unitCents)
    ),
  ]);
}

export async function getOrder(db, id) {
  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(id).first();
  if (!order) return null;
  const { results } = await db.prepare(`SELECT * FROM order_items WHERE order_id = ?1 ORDER BY id`).bind(id).all();
  return { ...order, items: results };
}

// Beendet eine Bestellung (cancelled oder expired) und schreibt den Bestand zurück.
// Der Statuswechsel ist an den alten Status gebunden, damit der Bestand auch bei
// doppelt eintreffenden Webhooks nur einmal zurückgebucht wird.
export async function releaseOrder(db, id, newStatus, fromStatuses = ["pending_payment"]) {
  const res = await db
    .prepare(
      `UPDATE orders SET status = ?2, hold_expires_at = NULL, updated_at = ${NOW}
       WHERE id = ?1 AND status IN (${fromStatuses.map((s) => `'${s}'`).join(",")})`
    )
    .bind(id, newStatus)
    .run();
  if (res.meta.changes !== 1) return false;
  const { results } = await db.prepare(`SELECT variant_id, quantity FROM order_items WHERE order_id = ?1`).bind(id).all();
  await restoreStock(db, results.filter((r) => r.variant_id).map((r) => ({ variantId: r.variant_id, qty: r.quantity })));
  return true;
}

// Reservierungen, deren Zahlungsfrist abgelaufen ist, freigeben (falls der Stripe-Webhook einmal ausbleibt)
export async function releaseExpired(db) {
  const { results } = await db
    .prepare(`SELECT id FROM orders WHERE status = 'pending_payment' AND hold_expires_at < ${NOW} LIMIT 25`)
    .all();
  for (const r of results) await releaseOrder(db, r.id, "expired");
}

// Markiert eine Bestellung als bezahlt. Gibt true zurück, wenn sich der Status geändert hat.
export async function markPaid(db, id, d = {}) {
  const res = await db
    .prepare(
      `UPDATE orders SET status = 'paid', hold_expires_at = NULL, email = ?2, customer_name = ?3, phone = ?4,
         shipping_address = ?5, payment_method = ?6, stripe_payment_id = ?7, paid_at = ${NOW}, updated_at = ${NOW}
       WHERE id = ?1 AND status IN ('pending_payment','expired','cancelled')`
    )
    .bind(id, d.email ?? null, d.name ?? null, d.phone ?? null, d.address ? JSON.stringify(d.address) : null, d.paymentMethod ?? null, d.paymentId ?? null)
    .run();
  if (res.meta.changes !== 1) return false;
  await assignInvoiceNumber(db, id);
  return true;
}

// Vergibt eine fortlaufende Rechnungsnummer (z. B. RE-2026-0001), falls die Bestellung noch keine hat.
// Der Zähler wird in einer einzigen Anweisung erhöht und gelesen, damit keine Nummer doppelt vergeben wird.
export async function assignInvoiceNumber(db, id) {
  const o = await db.prepare(`SELECT invoice_number, paid_at, status FROM orders WHERE id = ?1`).bind(id).first();
  if (!o || o.invoice_number) return o?.invoice_number || null;
  if (!["paid", "shipped"].includes(o.status)) return null;
  const c = await db.prepare(`UPDATE counters SET value = value + 1 WHERE name = 'invoice' RETURNING value`).first();
  const year = (o.paid_at || new Date().toISOString()).slice(0, 4);
  const number = `${config.invoice.prefix}${year}-${String(c.value).padStart(4, "0")}`;
  await db.prepare(`UPDATE orders SET invoice_number = ?2, paid_at = COALESCE(paid_at, ${NOW}) WHERE id = ?1 AND invoice_number IS NULL`).bind(id, number).run();
  return number;
}
