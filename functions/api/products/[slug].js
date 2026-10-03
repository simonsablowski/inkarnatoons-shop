// GET /api/products/:slug – Detailansicht
import { getProduct, publicStock } from "../../_lib/catalog.js";
import { json, error } from "../../_lib/http.js";

export async function onRequestGet({ params, env }) {
  const p = await getProduct(env.DB, params.slug);
  if (!p) return error("not_found", 404);
  return json({
    ok: true,
    product: {
      slug: p.slug, category: p.category, name_de: p.name_de, name_en: p.name_en, desc_de: p.desc_de, desc_en: p.desc_en,
      priceCents: p.price_cents, weightG: p.weight_g, isUnique: !!p.is_unique,
      images: p.images.map((i) => i.path),
      variants: p.variants.map((v) => ({ id: v.id, label: v.label, stock: publicStock(v.stock), maxQty: Math.min(v.stock, 20) })),
    },
  });
}
