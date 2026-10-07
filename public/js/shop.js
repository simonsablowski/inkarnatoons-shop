// Gemeinsame Bausteine aller Seiten: Sprache, API-Aufrufe, Warenkorb, Wunschliste, Kopf- und Fußzeile
export const LANGS = ["de", "en"];
let dict = {};
let current = "de";
let shopConfig = null;

function storageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* egal */ } }
function readJson(k, fallback) { try { return JSON.parse(storageGet(k)) ?? fallback; } catch { return fallback; } }

// ---------- Sprache ----------
export function detectLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (LANGS.includes(q)) return q;
  const saved = storageGet("jj-lang");
  if (LANGS.includes(saved)) return saved;
  return (navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en";
}
export const lang = () => current;
export function t(key, vars = {}) {
  let s = dict[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}
export const loc = (obj, field) => obj[`${field}_${current}`] || obj[`${field}_de`] || "";
export const money = (cents) =>
  new Intl.NumberFormat(current === "de" ? "de-DE" : "en-GB", { style: "currency", currency: shopConfig?.currency || "EUR" }).format(cents / 100);
export function countryName(code) {
  try { return new Intl.DisplayNames([current], { type: "region" }).of(code) || code; } catch { return code; }
}
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr.trim(), t(key.trim()));
    }
  });
  root.querySelectorAll("[data-lang-only]").forEach((el) => { el.hidden = el.dataset.langOnly !== current; });
}

// ---------- API ----------
export async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `http_${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}
export const config = () => shopConfig;
export const errorText = (err) => (dict[`error.${err.message}`] ? t(`error.${err.message}`) : t("error.generic"));

// ---------- Warenkorb und Wunschliste (im Browser gespeichert) ----------
const changed = () => document.dispatchEvent(new CustomEvent("shop:changed"));
export const cart = {
  items: () => readJson("jj-cart", []).filter((i) => Number.isInteger(i.variantId) && i.qty > 0),
  count: () => cart.items().reduce((n, i) => n + i.qty, 0),
  save(items) { storageSet("jj-cart", JSON.stringify(items)); changed(); },
  add(variantId, qty, max = 20) {
    const items = cart.items();
    const hit = items.find((i) => i.variantId === variantId);
    if (hit) hit.qty = Math.min(max, hit.qty + qty);
    else items.push({ variantId, qty: Math.min(max, qty) });
    cart.save(items);
  },
  set(variantId, qty) {
    cart.save(cart.items().map((i) => (i.variantId === variantId ? { ...i, qty } : i)).filter((i) => i.qty > 0));
  },
  clear() { cart.save([]); },
};
export const wishlist = {
  slugs: () => readJson("jj-wishlist", []).filter((s) => typeof s === "string"),
  has: (slug) => wishlist.slugs().includes(slug),
  toggle(slug) {
    const s = wishlist.slugs();
    storageSet("jj-wishlist", JSON.stringify(s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
    changed();
    return wishlist.has(slug);
  },
};

// ---------- Bausteine ----------
const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" stroke-linejoin="round"/></svg>`;
const BAG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2L5 8z" stroke-linejoin="round"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>`;

export function heartButton(slug, extraClass = "") {
  const on = wishlist.has(slug);
  return `<button type="button" class="heart ${extraClass}" data-wish="${esc(slug)}" aria-pressed="${on}" aria-label="${esc(t(on ? "wish.remove" : "wish.add"))}">${HEART}</button>`;
}

export function productCard(p) {
  const name = loc(p, "name");
  const cat = shopConfig.categories.find((c) => c.slug === p.category);
  const world = worldOf(p.world);
  const label = [world?.name, cat ? loc(cat, "name") : ""].filter(Boolean).join(", ");
  const badges = [];
  if (!p.stock.available) badges.push(`<span class="badge out">${t(p.isUnique ? "badge.sold" : "badge.soldout")}</span>`);
  else if (p.isUnique) badges.push(`<span class="badge">${t("badge.unique")}</span>`);
  else if (p.stock.low && !p.hasOptions) badges.push(`<span class="badge low">${t("badge.low", { n: p.stock.left })}</span>`);
  return `<article class="card${p.stock.available ? "" : " soldout"}">
    <a class="card-link" href="/product.html?p=${encodeURIComponent(p.slug)}">
      <div class="pic">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" width="600" height="600">` : ""}</div>
      <div class="body">
        <span class="cat">${esc(label)}</span>
        <h3>${esc(name)}</h3>
        <span class="price">${money(p.priceCents)}</span>
      </div>
    </a>
    <div class="badges">${badges.join("")}</div>
    ${heartButton(p.slug)}
  </article>`;
}

export const worldOf = (slug) => shopConfig.worlds.find((w) => w.slug === slug);
export const brandName = () => `${shopConfig.brand.name} ${shopConfig.brand.suffix}`.trim();
// Schriftzug des Shops: die gezeichnete Bilddatei aus shop.config.json ("brand.logo"), sonst der Name als Text
export const brandMark = (cls = "") =>
  shopConfig.brand.logo ? `<img${cls ? ` class="${cls}"` : ""} src="${esc(shopConfig.brand.logo)}" alt="${esc(brandName())}">` : esc(brandName());
// Titel einer Themenwelt: der gezeichnete Schriftzug, sonst der Name als Text
export const worldTitle = (w, tag = "h1") =>
  w.title_image ? `<${tag} class="sr-only">${esc(w.name)}</${tag}><img class="lettering" src="${esc(w.title_image)}" alt="">` : `<${tag}>${esc(w.name)}</${tag}>`;

function renderShell() {
  const here = location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
  const world = new URLSearchParams(location.search).get("world");
  const isHome = here === "/";
  const header = document.querySelector("#site-header");
  if (header) {
    header.className = "topbar";
    header.innerHTML = `<div class="wrap topbar-inner">
      <a class="brand" href="/">${brandMark()}</a>
      <nav class="mainnav" aria-label="Produktwelten">
        ${shopConfig.worlds.map((w) => `<a href="/?world=${w.slug}"${isHome && world === w.slug ? ' aria-current="page"' : ""}>${esc(w.name)}</a>`).join("")}
      </nav>
      <div class="tools">
        <div class="lang" role="group" aria-label="Sprache / Language">
          ${LANGS.map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === current}">${l.toUpperCase()}</button>`).join("")}
        </div>
        <a class="iconlink" href="/wishlist.html" aria-label="${esc(t("nav.wishlist"))}">${HEART}<span class="count" data-count="wishlist"></span></a>
        <a class="iconlink" href="/cart.html" aria-label="${esc(t("nav.cart"))}">${BAG}<span class="count" data-count="cart"></span></a>
      </div>
    </div>`;
  }
  const footer = document.querySelector("#site-footer");
  if (footer) {
    footer.className = "footer";
    footer.innerHTML = `<div class="wrap footer-inner">
      <p>${t("footer.claim")}</p>
      <nav>
        <a href="/legal.html#versand">${t("footer.shipping")}</a>
        <a href="/legal.html#agb">${t("footer.terms")}</a>
        <a href="/legal.html#datenschutz">${t("footer.privacy")}</a>
        <a href="/legal.html#impressum">${t("footer.legal")}</a>
      </nav>
    </div>`;
  }
  // Seitentitel: "… · Judas & Jesus Shop" aus den HTML-Dateien durch den aktuellen Shopnamen ersetzen
  document.title = document.title.replace(/Judas & Jesus Shop$/, brandName());
  updateCounts();
}

function updateCounts() {
  const n = { cart: cart.count(), wishlist: wishlist.slugs().length };
  document.querySelectorAll("[data-count]").forEach((el) => {
    el.textContent = n[el.dataset.count];
    el.dataset.n = n[el.dataset.count];
  });
}

// ---------- Altersabfrage ----------
// Der Shop ist erst ab dem eingestellten Mindestalter zugänglich. Die Abfrage ist eine Selbstauskunft:
// Wer bestätigt, wird für die eingestellte Zahl von Tagen in diesem Browser nicht erneut gefragt.
// Die Seite „Versand, Zahlung und Rechtliches“ bleibt ohne Abfrage erreichbar (Impressum, Datenschutz).
const AGE_KEY = "jj-age-ok";
const gateExempt = () => document.documentElement.hasAttribute("data-no-age-gate");

function ageConfirmed() {
  const gate = shopConfig.ageGate;
  if (!gate?.enabled || gateExempt()) return true;
  const saved = readJson(AGE_KEY, null);
  return Boolean(saved && saved.minAge >= gate.minAge && Date.now() - saved.at < gate.rememberDays * 86400000);
}

function showAgeGate(onConfirm) {
  const gate = shopConfig.ageGate;
  document.querySelector("#age-gate")?.remove();
  const el = document.createElement("div");
  el.id = "age-gate";
  el.className = "age-gate";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "age-gate-title");
  const ask = () => {
    el.innerHTML = `<div class="age-box">
      <p class="age-brand">${esc(brandName())}</p>
      <h1 id="age-gate-title">${t("age.title", { n: gate.minAge })}</h1>
      <p>${t("age.text")}</p>
      <p class="age-question">${t("age.question", { n: gate.minAge })}</p>
      <div class="age-actions">
        <button type="button" class="btn" id="age-yes">${t("age.yes", { n: gate.minAge })}</button>
        <button type="button" class="btn secondary" id="age-no">${t("age.no")}</button>
      </div>
      <div class="age-foot">
        <div class="lang" role="group" aria-label="Sprache / Language">
          ${LANGS.map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === current}">${l.toUpperCase()}</button>`).join("")}
        </div>
        <a href="/legal.html#impressum">${t("footer.legal")}</a>
        <a href="/legal.html#datenschutz">${t("footer.privacy")}</a>
      </div>
    </div>`;
    el.querySelector("#age-yes").addEventListener("click", () => {
      storageSet(AGE_KEY, JSON.stringify({ minAge: gate.minAge, at: Date.now() }));
      el.remove();
      document.documentElement.classList.add("age-ok");
      onConfirm();
    });
    el.querySelector("#age-no").addEventListener("click", () => {
      el.innerHTML = `<div class="age-box">
        <p class="age-brand">${esc(brandName())}</p>
        <h1 id="age-gate-title">${t("age.deniedTitle", { n: gate.minAge })}</h1>
        <p>${t("age.denied", { n: gate.minAge })}</p>
        <div class="age-actions">
          ${gate.exitUrl ? `<a class="btn" href="${esc(gate.exitUrl)}">${t("age.leave")}</a>` : ""}
          <button type="button" class="btn secondary" id="age-back">${t("age.back")}</button>
        </div>
      </div>`;
      el.querySelector("#age-back").addEventListener("click", ask);
      el.querySelector("a, button").focus();
    });
    el.querySelector("#age-yes").focus();
  };
  document.body.append(el);
  ask();
}

// Startet eine Seite: lädt Sprache und Einstellungen, baut Kopf- und Fußzeile und ruft render() auf.
// Beim Sprachwechsel wird render() erneut aufgerufen.
export async function start(render) {
  async function load(l) {
    current = LANGS.includes(l) ? l : "en";
    const [d, c] = await Promise.all([
      fetch(`/i18n/${current}.json`).then((r) => r.json()),
      shopConfig ? Promise.resolve(shopConfig) : api("/api/config"),
    ]);
    dict = d;
    shopConfig = c;
    storageSet("jj-lang", current);
    document.documentElement.lang = current;
    renderShell();
    applyStatic();
    if (!ageConfirmed()) return showAgeGate(() => render?.());
    document.documentElement.classList.add("age-ok");
    await render?.();
  }
  document.addEventListener("click", (e) => {
    const langBtn = e.target.closest("[data-lang]");
    if (langBtn) {
      const url = new URL(location.href);
      url.searchParams.delete("lang");
      history.replaceState(null, "", url);
      load(langBtn.dataset.lang);
      return;
    }
    const wish = e.target.closest("[data-wish]");
    if (wish) {
      e.preventDefault();
      const on = wishlist.toggle(wish.dataset.wish);
      wish.setAttribute("aria-pressed", String(on));
      wish.setAttribute("aria-label", t(on ? "wish.remove" : "wish.add"));
    }
  });
  document.addEventListener("shop:changed", updateCounts);
  window.addEventListener("storage", updateCounts);
  await load(detectLang());
}
