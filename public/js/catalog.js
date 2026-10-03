// Startseite (alle Produktwelten) und Übersicht einer Produktwelt mit Kategorien, Suche,
// Sortierung und Filtern. Der Zustand steht in der Adresse.
import { start, api, t, loc, config, productCard, worldOf, brandName, esc } from "./shop.js";

const form = document.querySelector("#filters");
const grid = document.querySelector("#grid");
const KEYS = ["world", "category", "q", "sort", "max", "instock"];
const state = () => Object.fromEntries(new URLSearchParams(location.search));

function writeState(next) {
  const url = new URL(location.href);
  for (const k of KEYS) {
    if (next[k] && !(k === "sort" && next[k] === "default")) url.searchParams.set(k, next[k]);
    else url.searchParams.delete(k);
  }
  history.replaceState(null, "", url);
}

function readForm() {
  const s = state();
  return { world: s.world || "", category: s.category || "", q: form.q.value.trim(), sort: form.sort.value, max: form.max.value, instock: form.instock.checked ? "1" : "" };
}

function worldTile(w) {
  const pic = w.image ? `<img src="${esc(w.image)}" alt="" loading="lazy">` : `<span class="world-name">${esc(w.name)}</span>`;
  return `<a class="world-tile${w.image ? "" : " no-image"}" href="/?world=${w.slug}">
    <div class="pic">${pic}</div>
    <div class="body"><h3>${esc(w.name)}</h3><p>${esc(loc(w, "tagline"))}</p>
    <span class="small">${w.product_count ? t("world.items", { n: w.product_count }) : t("world.soon")}</span></div>
  </a>`;
}

// Kopfbereich: Startseite zeigt die Produktwelten, eine Welt zeigt ihren eigenen Titel
function renderHero(s) {
  const hero = document.querySelector("#hero");
  const world = worldOf(s.world);
  document.body.dataset.world = world?.slug || "";
  if (world?.slug === "judas-jesus") {
    hero.innerHTML = `<section class="spiral hero"><div class="wrap">
      <h1 class="sr-only">Judas &amp; Jesus</h1>
      <img src="/img/titelkarte.jpg" alt="Judas &amp; Jesus" width="1400" height="1220">
      <p>${t("hero.line")}</p>
      <p style="margin-top:16px"><a class="btn secondary small-btn" href="/film.html">${t("nav.film")}</a></p>
    </div></section>`;
  } else if (world) {
    hero.innerHTML = `<section class="pagehead plain"><div class="wrap"><h1>${esc(world.name)}</h1><p>${esc(loc(world, "tagline"))}</p></div></section>`;
  } else {
    hero.innerHTML = `<section class="pagehead plain home"><div class="wrap">
      <h1>${esc(brandName())}</h1><p>${t("home.line")}</p>
      <div class="worlds">${config().worlds.map(worldTile).join("")}</div>
    </div></section>`;
  }
  document.title = world ? `${world.name} · ${brandName()}` : brandName();
  document.querySelector("#list-title").hidden = Boolean(world);
}

async function render() {
  const s = state();
  form.q.value = s.q || "";
  form.sort.value = s.sort || "default";
  form.max.value = s.max || "";
  form.instock.checked = s.instock === "1";
  renderHero(s);
  try {
    const p = new URLSearchParams();
    for (const k of KEYS) if (s[k]) p.set(k, s[k]);
    const [{ products }, inWorld] = await Promise.all([
      api(`/api/products?${p}`),
      // Für die Kategorie-Auswahl: welche Kategorien kommen in dieser Welt überhaupt vor?
      api(`/api/products${s.world ? `?world=${encodeURIComponent(s.world)}` : ""}`),
    ]);
    const used = new Set(inWorld.products.map((x) => x.category));
    document.querySelector("#chips").innerHTML =
      `<button type="button" class="chip" data-cat="" aria-pressed="${!s.category}">${t("nav.all")}</button>` +
      config().categories.filter((c) => used.has(c.slug) || c.slug === s.category)
        .map((c) => `<button type="button" class="chip" data-cat="${c.slug}" aria-pressed="${s.category === c.slug}">${esc(loc(c, "name"))}</button>`).join("");
    grid.innerHTML = products.map(productCard).join("");
    document.querySelector("#count").textContent = t("list.count", { n: products.length });
    document.querySelector("#empty").hidden = products.length > 0;
  } catch {
    grid.innerHTML = `<p class="notice error">${t("list.error")}</p>`;
  }
}

let timer;
form.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { writeState(readForm()); render(); }, 250); });
form.addEventListener("submit", (e) => e.preventDefault());
document.querySelector("#chips").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-cat]");
  if (!chip) return;
  writeState({ ...readForm(), category: chip.dataset.cat });
  render();
});
document.querySelector("#reset").addEventListener("click", () => { writeState({ world: state().world }); render(); });

start(render);
