// Detailansicht eines Artikels
import { start, api, t, loc, money, config, cart, heartButton, worldOf, brandName, esc } from "./shop.js";

const view = document.querySelector("#view");
const slug = new URLSearchParams(location.search).get("p");
let product = null;
let chosen = null; // gewählte Variante
let shown = 0; // Nummer des angezeigten Bildes

const GLASS = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/></svg>`;
const ICON = {
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg>`,
  minus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"/></svg>`,
  prev: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8"/></svg>`,
  next: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l8 8-8 8"/></svg>`,
};

// Großansicht: Das Bild füllt den Bildschirm. Ein Klick oder Tipp holt die angeklickte Stelle nah heran,
// dann lässt es sich mit Maus oder Finger verschieben. Zweiter Klick zeigt wieder das ganze Bild.
function openZoom() {
  const images = product.images;
  const opener = document.activeElement;
  const el = document.createElement("div");
  el.className = "zoom";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", t("zoom.label"));
  el.innerHTML = `<div class="zoom-stage"><img alt="${esc(loc(product, "name"))}" draggable="false"></div>
    <div class="zoom-bar">
      <button type="button" data-z="toggle" aria-label="${esc(t("zoom.in"))}">${ICON.plus}</button>
      <button type="button" data-z="close" aria-label="${esc(t("zoom.close"))}">${ICON.close}</button>
    </div>
    ${images.length > 1 ? `<button type="button" class="zoom-nav prev" data-z="prev" aria-label="${esc(t("zoom.prev"))}">${ICON.prev}</button>
      <button type="button" class="zoom-nav next" data-z="next" aria-label="${esc(t("zoom.next"))}">${ICON.next}</button>` : ""}`;
  const stage = el.querySelector(".zoom-stage");
  const img = stage.querySelector("img");
  const toggle = el.querySelector('[data-z="toggle"]');
  let zoomed = false;

  function setZoom(on, fx = 0.5, fy = 0.5) {
    if (on === zoomed) return;
    if (on) {
      const fit = img.getBoundingClientRect();
      // mindestens doppelt so groß wie eingepasst, bei hoch aufgelösten Bildern bis zur vollen Auflösung (höchstens vierfach)
      const width = Math.round(Math.max(fit.width * 2, Math.min(img.naturalWidth || 0, fit.width * 4)));
      img.style.width = `${width}px`;
      el.classList.add("in");
      const now = img.getBoundingClientRect();
      stage.scrollLeft = now.width * fx - stage.clientWidth / 2;
      stage.scrollTop = now.height * fy - stage.clientHeight / 2;
    } else {
      el.classList.remove("in");
      img.style.width = "";
    }
    zoomed = on;
    toggle.innerHTML = on ? ICON.minus : ICON.plus;
    toggle.setAttribute("aria-label", t(on ? "zoom.out" : "zoom.in"));
  }
  function show(i) {
    shown = (i + images.length) % images.length;
    setZoom(false);
    img.src = images[shown];
  }
  function close() {
    el.remove();
    document.removeEventListener("keydown", onKey);
    document.documentElement.style.overflow = "";
    render();
    (document.querySelector("#open-zoom") || opener)?.focus();
  }
  function onKey(e) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft" && images.length > 1) show(shown - 1);
    else if (e.key === "ArrowRight" && images.length > 1) show(shown + 1);
    else if (e.key === "Tab") {
      // Tastaturfokus bleibt in der Großansicht
      const btns = [...el.querySelectorAll("button")];
      const i = btns.indexOf(document.activeElement);
      e.preventDefault();
      btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
    }
  }

  // Mit gedrückter Maustaste verschieben. Auf Touchgeräten übernimmt das der Browser selbst.
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop, moved: false };
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    if (!zoomed) return;
    stage.classList.add("dragging");
    stage.scrollLeft = drag.left - dx;
    stage.scrollTop = drag.top - dy;
  });
  window.addEventListener("pointerup", () => { stage.classList.remove("dragging"); setTimeout(() => { drag = null; }, 0); });
  stage.addEventListener("click", (e) => {
    if (drag?.moved) return;
    if (e.target !== img) { if (!zoomed) close(); return; }
    const r = img.getBoundingClientRect();
    setZoom(!zoomed, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });
  el.addEventListener("click", (e) => {
    const z = e.target.closest("[data-z]")?.dataset.z;
    if (z === "close") close();
    else if (z === "toggle") setZoom(!zoomed);
    else if (z === "prev") show(shown - 1);
    else if (z === "next") show(shown + 1);
  });
  document.addEventListener("keydown", onKey);
  document.documentElement.style.overflow = "hidden";
  document.body.append(el);
  img.src = images[shown];
  el.querySelector('[data-z="close"]').focus();
}

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
  document.title = `${name} · ${brandName()}`;
  const world = worldOf(product.world);
  const cat = config().categories.find((c) => c.slug === product.category);
  const multi = product.variants.length > 1;
  if (!multi) chosen = product.variants[0];
  const canBuy = chosen && chosen.stock.available;
  const maxQty = chosen ? Math.max(1, chosen.maxQty) : 1;

  view.innerHTML = `<div class="detail">
    <div class="gallery">
      ${product.images[0] ? `<button type="button" class="main-pic" id="open-zoom" aria-label="${esc(t("zoom.open"))}"><img id="main-img" src="${esc(product.images[shown] || product.images[0])}" alt="${esc(name)}"><span class="zoom-hint">${GLASS}${t("zoom.open")}</span></button>` : `<div class="main-pic" style="cursor:default"></div>`}
      ${product.images.length > 1 ? `<div class="thumbs">${product.images.map((src, i) => `<button type="button" data-img="${esc(src)}" aria-pressed="${i === shown}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>` : ""}
    </div>
    <div class="info">
      <p class="crumb"><a href="/">${t("product.back")}</a>${world ? ` / <a href="/?world=${world.slug}">${esc(world.name)}</a>` : ""}${cat ? ` / <a href="/?${world ? `world=${world.slug}&` : ""}category=${cat.slug}">${esc(loc(cat, "name"))}</a>` : ""}</p>
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
    shown = Math.max(0, product.images.indexOf(thumb.dataset.img));
    document.querySelector("#main-img").src = thumb.dataset.img;
    view.querySelectorAll("[data-img]").forEach((b) => b.setAttribute("aria-pressed", String(b === thumb)));
    return;
  }
  if (e.target.closest("#open-zoom")) return openZoom();
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
