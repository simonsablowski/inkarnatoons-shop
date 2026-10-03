// Versandkosten nach Zone (Zielland) und Gesamtgewicht. Tarife stehen in shop.config.json.
import { config, isCountry } from "./config.js";

export function zoneFor(country) {
  if (!isCountry(country)) return null;
  const zones = config.shipping.zones;
  return zones.find((z) => Array.isArray(z.countries) && z.countries.includes(country)) || zones.find((z) => z.countries === "*") || null;
}

// Liefert { ok, zone, cents, weightG } oder { ok:false, error }
export function shippingFor(country, itemsWeightG, subtotalCents) {
  const zone = zoneFor(country);
  if (!zone) return { ok: false, error: "country_not_served" };
  const weightG = itemsWeightG + (config.shipping.packagingWeightG || 0);
  const rate = [...zone.rates].sort((a, b) => a.maxWeightG - b.maxWeightG).find((r) => weightG <= r.maxWeightG);
  if (!rate) return { ok: false, error: "too_heavy", zone: zone.id, weightG };
  const free = config.shipping.freeShippingFromCents;
  const cents = free != null && subtotalCents >= free ? 0 : rate.cents;
  return { ok: true, zone: zone.id, zoneName: zone.name, cents, weightG };
}
