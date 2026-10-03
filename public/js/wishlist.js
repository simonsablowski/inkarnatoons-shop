// Wunschliste: zeigt die gemerkten Artikel
import { start, api, wishlist, productCard } from "./shop.js";

async function render() {
  const slugs = wishlist.slugs();
  let products = [];
  if (slugs.length) {
    try { products = (await api("/api/products")).products.filter((p) => slugs.includes(p.slug)); } catch { /* leer anzeigen */ }
  }
  document.querySelector("#grid").innerHTML = products.map(productCard).join("");
  document.querySelector("#empty").hidden = products.length > 0;
}
// Entfernte Artikel sofort ausblenden
document.addEventListener("shop:changed", render);
start(render);
