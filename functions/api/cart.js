// POST /api/cart { items:[{variantId, qty}], country, lang }
// Bewertet den Warenkorb: aktuelle Preise, Verfügbarkeit, Versandkosten für das Zielland.
import { parseItems, priceCart } from "../_lib/orders.js";
import { isCountry } from "../_lib/config.js";
import { json, error } from "../_lib/http.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const items = parseItems(body.items);
  if (!items) return error("invalid_items");
  const country = isCountry(body.country) ? body.country : null;
  if (body.country && !country) return error("country_not_served");
  const cart = await priceCart(env.DB, items, country, body.lang);
  return json({ ok: true, ...cart });
}
