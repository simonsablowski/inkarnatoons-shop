// Warenkorb: Mengen ändern, Lieferland wählen, Versandkosten sehen, zur Kasse gehen
import { start, api, t, lang, money, config, cart, countryName, errorText, esc } from "./shop.js";

const view = document.querySelector("#view");
const params = new URLSearchParams(location.search);
let country = "";
let quote = null;
let notice = "";
let accepted = false;
try { country = localStorage.getItem("jj-country") || ""; } catch { /* egal */ }

function guessCountry() {
  const region = (navigator.language || "").split("-")[1]?.toUpperCase();
  return config().countries.includes(region) ? region : "";
}

async function refresh() {
  const items = cart.items();
  quote = null;
  if (items.length) {
    try { quote = await api("/api/cart", { method: "POST", body: JSON.stringify({ items, country: country || undefined, lang: lang() }) }); }
    catch (err) { notice = errorText(err); }
  }
  render();
}

function issueText(i) {
  return i.code === "not_enough" ? t("issue.not_enough", { n: i.available }) : t(`issue.${i.code}`);
}

function render() {
  if (!quote || !quote.lines.length) {
    view.innerHTML = `${notice ? `<p class="notice" style="margin-top:28px">${esc(notice)}</p>` : ""}
      <div class="empty"><p>${t("cart.empty")}</p><p><a class="btn" href="/">${t("cart.browse")}</a></p></div>`;
    return;
  }
  const issues = new Map(quote.issues.map((i) => [i.variantId, i]));
  const ship = quote.shipping;
  const blocked = quote.issues.length > 0 || !ship?.ok;
  const countries = config().countries.map((c) => [c, countryName(c)]).sort((a, b) => a[1].localeCompare(b[1], lang()));
  const outsideEu = ship?.ok && !["de", "eu"].includes(ship.zone);

  view.innerHTML = `<div class="cart">
    <div>
      ${notice ? `<p class="notice${quote.issues.length ? " error" : ""}">${esc(notice)}</p>` : ""}
      <ul class="lines">${quote.lines.map((l) => {
        const issue = issues.get(l.variantId);
        return `<li class="line">
          <a href="/product.html?p=${encodeURIComponent(l.slug)}">${l.image ? `<img src="${esc(l.image)}" alt="">` : ""}</a>
          <div>
            <h3><a href="/product.html?p=${encodeURIComponent(l.slug)}">${esc(l.name)}</a></h3>
            <span class="small">${l.variantLabel ? `${t("product.option")}: ${esc(l.variantLabel)} · ` : ""}${money(l.unitCents)}</span>
            <div class="controls">
              <div class="qty"><button type="button" data-id="${l.variantId}" data-step="-1" aria-label="−">−</button><input type="number" value="${l.qty}" min="1" max="${Math.max(1, l.maxQty)}" data-qty="${l.variantId}" aria-label="${esc(t("product.qty"))}"><button type="button" data-id="${l.variantId}" data-step="1" aria-label="+">+</button></div>
              <button type="button" class="linkish" data-remove="${l.variantId}">${t("cart.remove")}</button>
            </div>
            ${issue ? `<p class="issue">${issueText(issue)}</p>` : ""}
          </div>
          <span class="sum">${money(l.totalCents)}</span>
        </li>`;
      }).join("")}</ul>
    </div>
    <aside class="summary">
      <h2>${t("cart.summary")}</h2>
      <label><span>${t("cart.country")}</span>
        <select id="country"><option value="">${t("cart.chooseCountry")}</option>${countries.map(([c, n]) => `<option value="${c}"${c === country ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>
      </label>
      <dl class="sums">
        <dt>${t("cart.subtotal")}</dt><dd>${money(quote.subtotalCents)}</dd>
        <dt>${t("cart.shipping")}</dt><dd>${ship?.ok ? money(ship.cents) : ship ? "–" : t("cart.shippingPending")}</dd>
        <dt class="total">${t("cart.total")}</dt><dd class="total">${ship?.ok ? money(quote.totalCents) : money(quote.subtotalCents)}</dd>
      </dl>
      ${ship && !ship.ok ? `<p class="notice error">${t(`error.${ship.error}`)}</p>` : ""}
      <p class="small">${t("cart.vat")}${outsideEu ? ` ${t("cart.customs")}` : ""}</p>
      <label class="check"><input type="checkbox" id="terms"${accepted ? " checked" : ""}><span style="font-weight:400">${t("cart.terms", {
        terms: `<a href="/legal.html#agb" target="_blank">${t("cart.termsLink")}</a>`,
        withdrawal: `<a href="/legal.html#widerruf" target="_blank">${t("cart.withdrawalLink")}</a>`,
      })}</span></label>
      <button type="button" class="btn" id="checkout" ${blocked || !accepted ? "disabled" : ""}>${t("cart.checkout")}</button>
      <p class="small">${t("cart.payInfo")}</p>
    </aside>
  </div>`;
}

view.addEventListener("click", async (e) => {
  const step = e.target.closest("[data-step]");
  if (step) {
    const id = Number(step.dataset.id);
    const line = quote.lines.find((l) => l.variantId === id);
    notice = "";
    cart.set(id, Math.min(Math.max(1, line.maxQty), line.qty + Number(step.dataset.step)));
    return refresh();
  }
  const rm = e.target.closest("[data-remove]");
  if (rm) { notice = ""; cart.set(Number(rm.dataset.remove), 0); return refresh(); }
  const go = e.target.closest("#checkout");
  if (go) {
    go.disabled = true;
    go.textContent = t("cart.busy");
    try {
      const { url } = await api("/api/checkout", { method: "POST", body: JSON.stringify({ items: cart.items(), country, lang: lang() }) });
      location.href = url;
    } catch (err) {
      notice = errorText(err);
      await refresh();
    }
  }
});
view.addEventListener("change", (e) => {
  if (e.target.id === "country") {
    country = e.target.value;
    try { localStorage.setItem("jj-country", country); } catch { /* egal */ }
    notice = "";
    refresh();
  } else if (e.target.id === "terms") {
    accepted = e.target.checked;
    render();
  } else if (e.target.dataset.qty) {
    const id = Number(e.target.dataset.qty);
    cart.set(id, Math.max(1, Math.min(Number(e.target.max) || 20, Math.round(Number(e.target.value)) || 1)));
    refresh();
  }
});

start(async () => {
  if (!country) country = guessCountry();
  // Rückkehr von einer abgebrochenen Zahlung: Reservierung sofort freigeben
  const cancelled = params.get("cancelled");
  if (cancelled) {
    await api(`/api/orders/${encodeURIComponent(cancelled)}?t=${encodeURIComponent(params.get("t") || "")}`, { method: "POST", body: JSON.stringify({ action: "cancel" }) }).catch(() => {});
    notice = t("cart.cancelled");
    history.replaceState(null, "", "/cart.html");
    params.delete("cancelled");
  }
  await refresh();
});
