// GET /api/config – öffentliche Einstellungen für die Oberfläche
import { config, COUNTRIES } from "../_lib/config.js";
import { listCategories, listWorlds } from "../_lib/catalog.js";
import { json } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  return json({
    ok: true,
    shopName: config.shopName,
    brand: { name: config.brand.name, suffix: config.brand.suffix, logo: config.brand.logo || "" },
    theme: { lower: config.theme?.lower === "black" ? "black" : "white" },
    ageGate: { enabled: config.ageGate?.enabled === true, minAge: config.ageGate?.minAge || 16, rememberDays: config.ageGate?.rememberDays || 30, exitUrl: config.ageGate?.exitUrl || "" },
    film: { world: config.film.world, provider: config.film.provider, id: config.film.id },
    kofi: { name: config.kofi?.name || "", show: config.kofi?.show !== false },
    worlds: await listWorlds(env.DB),
    currency: config.currency,
    languages: config.languages,
    paymentMethods: config.payments.methods,
    freeShippingFromCents: config.shipping.freeShippingFromCents,
    countries: COUNTRIES,
    packagingWeightG: config.shipping.packagingWeightG || 0,
    zones: config.shipping.zones.map((z) => ({ id: z.id, name: z.name, countries: z.countries, rates: z.rates })),
    categories: await listCategories(env.DB),
  });
}
