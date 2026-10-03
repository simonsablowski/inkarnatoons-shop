// GET /api/products?world=&category=&q=&instock=1&max=&sort=
import { listProducts, publicStock } from "../_lib/catalog.js";
import { json, clean } from "../_lib/http.js";

export async function onRequestGet({ request, env }) {
  const p = new URL(request.url).searchParams;
  const max = p.get("max") ? Math.round(Number(p.get("max")) * 100) : NaN;
  const rows = await listProducts(env.DB, {
    world: clean(p.get("world") || "", 60) || null,
    category: clean(p.get("category") || "", 60) || null,
    q: clean(p.get("q") || "", 80) || null,
    inStock: p.get("instock") === "1",
    maxCents: max,
    sort: p.get("sort") || "default",
  });
  return json({
    ok: true,
    products: rows.map((r) => ({
      slug: r.slug, world: r.world, category: r.category, name_de: r.name_de, name_en: r.name_en, priceCents: r.price_cents,
      isUnique: !!r.is_unique, image: r.image, hasOptions: r.variant_count > 1, stock: publicStock(r.stock),
    })),
  });
}
