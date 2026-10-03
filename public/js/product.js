// Detailansicht eines Artikels
import { start, api, t, loc, money, config, cart, heartButton, esc } from "./shop.js";

const view = document.querySelector("#view");
const slug = new URLSearchParams(location.search).get("p");
let product = null;
let chosen = null; // gewählte Variante

function stockLine(v) {
  if (!v) return "";
  if (!v.stock.available) return `<p class="stockline low">${t(product.isUnique ? "product.sold" : "product.soldout")}</p>`;
  if (product.isUnique) return `<p class="stockline">${t("badge.unique")}</p>`;
  if (v.stock.low) return `<p class="stockline low">${t("product.low", { n: v.stock.left })}</p>`;
  return `<p class="stockline">${t("product.inStock")}</p>`;
}

function render() {
  if (!product) {
    view.innerHTML = `<div class="empty"><p>${t("product.notFound")}</p><p><a class="btn" href="/">${t("product.back")}</a></p></div>`;
    return;
  }
  const name = loc(product, "name");
  document.title = `${name} · Judas & Jesus Shop`;
  const cat = config().categories.find((c) => c.slug === product.category);
  const multi = product.variants.length > 1;
  if (!multi) chosen = product.variants[0];
  const canBuy = chosen && chosen.stock.available;
  const maxQty = chosen ? Math.max(1, chosen.maxQty) : 1;

  view.innerHTML = `<div class="detail">
    <div class="gallery">
      <div class="main-pic">${product.images[0] ? `<img id="main-img" src="${esc(product.images[0])}" alt="${esc(name)}">` : ""}</div>
      ${product.images.length > 1 ? `<div class="thumbs">${product.images.map((src, i) => `<button type="button" data-img="${esc(src)}" aria-pressed="${i === 0}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>` : ""}
    </div>
    <div class="info">
      <p class="crumb"><a href="/">${t("product.back")}</a>${cat ? ` / <a href="/?category=${cat.slug}">${esc(loc(cat, "name"))}</a>` : ""}</p>
      <h1>${esc(name)}</h1>
      <p class="price">${money(product.priceCents)}</p>
      <p class="small">${t("product.priceNote", { link: `<a href="/legal.html#versand">${t("product.shippingLink")}</a>` })}</p>
      ${multi ? `<fieldset style="border:0;padding:0;margin:18px 0 0"><legend style="font-weight:600;padding:0">${t("product.option")}</legend>
        <div class="options">${product.variants.map((v) => `<label><input type="radio" name="variant" value="${v.id}" ${v.stock.available ? "" : "disabled"} ${chosen?.id === v.id ? "checked" : ""}><span>${esc(v.label)}</span></label>`).join("")}</div></fieldset>` : ""}
      <div id="stock">${multi && !chosen ? "" : stockLine(chosen)}</div>
      <div class="buyrow">
        ${product.isUnique ? "" : `<div class="qty"><button type="button" data-step="-1" aria-label="−">−</button><input type="number" id="qty" value="1" min="1" max="${maxQty}" aria-label="${esc(t("product.qty"))}"><button type="button" data-step="1" aria-label="+">+</button></div>`}
        <button type="button" class="btn" id="add" ${multi && !chosen ? "" : canBuy ? "" : "disabled"}>${t("product.add")}</button>
        ${heartButton(product.slug, "inline")}
      </div>
      <p id="msg" class="small" aria-live="polite"></p>
      <div class="desc">${esc(loc(product, "desc"))}</div>
    </div>
  </div>`;
}

view.addEventListener("click", (e) => {
  const thumb = e.target.closest("[data-img]");
  if (thumb) {
    document.querySelector("#main-img").src = thumb.dataset.img;
    view.querySelectorAll("[data-img]").forEach((b) => b.setAttribute("aria-pressed", String(b === thumb)));
    return;
  }
  const step = e.target.closest("[data-step]");
  if (step) {
    const q = document.querySelector("#qty");
    q.value = Math.max(1, Math.min(Number(q.max) || 20, (Number(q.value) || 1) + Number(step.dataset.step)));
    return;
  }
  if (e.target.closest("#add")) {
    const msg = document.querySelector("#msg");
    if (!chosen) { msg.textContent = t("product.chooseOption"); return; }
    const qty = Math.max(1, Number(document.querySelector("#qty")?.value) || 1);
    cart.add(chosen.id, qty, chosen.maxQty);
    msg.innerHTML = t("product.added", { link: `<a href="/cart.html">${t("product.toCart")}</a>` });
  }
});
view.addEventListener("change", (e) => {
  if (e.target.name === "variant") {
    chosen = product.variants.find((v) => v.id === Number(e.target.value));
    render();
  }
});

start(async () => {
  if (!product && slug) {
    try { product = (await api(`/api/products/${encodeURIComponent(slug)}`)).product; } catch { product = null; }
  }
  render();
});
