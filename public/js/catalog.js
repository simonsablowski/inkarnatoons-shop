// Produktübersicht mit Kategorien, Suche, Sortierung und Filtern. Der Zustand steht in der Adresse.
import { start, api, t, loc, config, productCard, esc } from "./shop.js";

const form = document.querySelector("#filters");
const grid = document.querySelector("#grid");
const state = () => Object.fromEntries(new URLSearchParams(location.search));

function writeState(next) {
  const url = new URL(location.href);
  for (const k of ["category", "q", "sort", "max", "instock"]) {
    if (next[k] && !(k === "sort" && next[k] === "default")) url.searchParams.set(k, next[k]);
    else url.searchParams.delete(k);
  }
  history.replaceState(null, "", url);
}

function readForm() {
  const s = state();
  return { category: s.category || "", q: form.q.value.trim(), sort: form.sort.value, max: form.max.value, instock: form.instock.checked ? "1" : "" };
}

async function render() {
  const s = state();
  form.q.value = s.q || "";
  form.sort.value = s.sort || "default";
  form.max.value = s.max || "";
  form.instock.checked = s.instock === "1";
  // Der große Titel steht nur auf der ungefilterten Startseite
  document.querySelector("#hero").hidden = Boolean(s.category || s.q);
  document.querySelector("#chips").innerHTML =
    `<button type="button" class="chip" data-cat="" aria-pressed="${!s.category}">${t("nav.all")}</button>` +
    config().categories.map((c) => `<button type="button" class="chip" data-cat="${c.slug}" aria-pressed="${s.category === c.slug}">${esc(loc(c, "name"))}</button>`).join("");
  document.querySelectorAll(".mainnav a").forEach((a) => {
    const c = new URL(a.href).searchParams.get("category") || "";
    if (c === (s.category || "")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  try {
    const p = new URLSearchParams();
    for (const k of ["category", "q", "sort", "max", "instock"]) if (s[k]) p.set(k, s[k]);
    const { products } = await api(`/api/products?${p}`);
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
document.querySelector("#reset").addEventListener("click", () => { writeState({}); render(); });

start(render);
