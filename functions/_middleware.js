// Leitet die technische Adresse des Projekts (judas-jesus-shop.pages.dev) dauerhaft auf die
// eigentliche Adresse des Shops um (PUBLIC_URL in wrangler.toml), mit Pfad und Parametern.
// Vorschau-Adressen einzelner Deployments (<kennung>.judas-jesus-shop.pages.dev) bleiben erreichbar.
const PAGES_HOST = "judas-jesus-shop.pages.dev";

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (url.hostname === PAGES_HOST && env.PUBLIC_URL) {
    const target = new URL(env.PUBLIC_URL);
    if (target.hostname !== PAGES_HOST) {
      target.pathname = url.pathname;
      target.search = url.search;
      // 301 für Seitenaufrufe, 308 für alles andere, damit Methode und Inhalt erhalten bleiben
      return Response.redirect(target.toString(), request.method === "GET" || request.method === "HEAD" ? 301 : 308);
    }
  }
  return next();
}
