// Bestellübersicht nach der Zahlung
import { start, api, t, money, cart, countryName, esc } from "./shop.js";

const params = new URLSearchParams(location.search);
const id = params.get("order");
const token = params.get("t");
let tries = 0;

async function render() {
  const view = document.querySelector("#view");
  let order;
  try { order = (await api(`/api/orders/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`)).order; }
  catch { document.querySelector("#title").textContent = t("success.notFound"); view.innerHTML = `<p><a class="btn" href="/">${t("cart.browse")}</a></p>`; return; }

  if (order.status === "paid" || order.status === "shipped") cart.clear();
  document.querySelector("#title").textContent = t(`success.title.${order.status}`);
  const text = order.status === "paid" ? t("success.paid") : order.status === "pending_payment" ? t("success.pending") : "";
  view.innerHTML = `${text ? `<p>${text}</p>` : ""}
    <p><strong>${t("success.order")}:</strong> ${esc(order.id)}${order.tracking ? `<br><strong>${t("success.tracking")}:</strong> ${esc(order.tracking)}` : ""}</p>
    <div class="summary" style="position:static;max-width:520px;margin:24px 0">
      <dl class="sums">
        ${order.items.map((i) => `<dt>${i.qty} × ${esc(i.name)}${i.variantLabel ? ` (${esc(i.variantLabel)})` : ""}</dt><dd>${money(i.unitCents * i.qty)}</dd>`).join("")}
        <dt>${t("cart.shipping")} (${esc(countryName(order.country))})</dt><dd>${money(order.shippingCents)}</dd>
        <dt class="total">${t("cart.total")}</dt><dd class="total">${money(order.totalCents)}</dd>
      </dl>
    </div>
    <p><a class="btn secondary" href="/">${t("cart.browse")}</a></p>`;
  // Stripe meldet die Zahlung über den Webhook, das kann ein paar Sekunden dauern
  if (order.status === "pending_payment" && tries++ < 15) setTimeout(render, 2000);
}
start(render);
