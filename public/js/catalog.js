// Startseite (alle Produktwelten) und Übersicht einer Produktwelt mit Kategorien, Suche,
// Sortierung und Filtern. Der Zustand steht in der Adresse.
import { start, api, t, loc, lang, config, productCard, worldOf, brandName, esc } from "./shop.js";
import { mountPlayer, mountSupport } from "./film.js";

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

// Kopfbereich: Startseite zeigt die Themenwelten, eine Welt zeigt ihren eigenen Titel.
// Er wird nur neu aufgebaut, wenn Welt oder Sprache wechseln, damit ein laufender Film
// beim Filtern der Artikel nicht abbricht.
let heroKey = null;
function renderHero(s) {
  const hero = document.querySelector("#hero");
  const world = worldOf(s.world);
  document.title = world ? `${world.name} · ${brandName()}` : brandName();
  const hasFilm = world && world.slug === config().film.world;
  document.querySelector("#list-title").hidden = Boolean(world) && !hasFilm;
  document.querySelector("#list-title").textContent = hasFilm ? t("world.merch") : t("home.all");
  const key = `${world?.slug || ""}|${lang()}`;
  if (key === heroKey) return;
  heroKey = key;
  document.body.dataset.world = world?.slug || "";
  if (world && world.slug === config().film.world) {
    // Judas & Jesus: Titelkarte und daneben der Film zum Ansehen
    hero.innerHTML = `<section class="spiral hero with-film"><div class="wrap">
      <div class="hero-title">
        <h1 class="sr-only">${esc(world.name)}</h1>
        <img src="/img/titelkarte.jpg" alt="${esc(world.name)}" width="1400" height="1220">
        <p>${t("hero.line")}</p>
      </div>
      <div class="hero-film" id="film">
        <h2>${t("film.heading")}</h2>
        <div class="player" id="player"></div>
        <p class="film-note" id="film-note"></p>
        <div class="support" id="support"></div>
      </div>
    </div></section>`;
    mountPlayer(document.querySelector("#player"), document.querySelector("#film-note"));
    mountSupport(document.querySelector("#support"));
  } else if (world) {
    hero.innerHTML = `<section class="pagehead plain"><div class="wrap"><h1>${esc(world.name)}</h1><p>${esc(loc(world, "tagline"))}</p></div></section>`;
  } else {
    hero.innerHTML = `<section class="pagehead plain home"><div class="wrap">
      <h1>${esc(brandName())}</h1><p>${t("home.line")}</p>
      <div class="worlds">${config().worlds.map(worldTile).join("")}</div>
    </div></section>`;
  }
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
