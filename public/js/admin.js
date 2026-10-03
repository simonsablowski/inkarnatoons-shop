// Verwaltung: Produkte anlegen und ändern, Bestände pflegen, Bilder hochladen, Bestellungen bearbeiten.
// Das Passwort bleibt nur für diese Browsersitzung gespeichert.
const $ = (s) => document.querySelector(s);
let token = "";
try { token = sessionStorage.getItem("jj-admin") || ""; } catch { /* egal */ }
let categories = [];

const money = (c, cur = "EUR") => new Intl.NumberFormat("de-DE", { style: "currency", currency: cur }).format(c / 100);
const dateTime = (iso) => new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUS = { pending_payment: "Zahlung offen", paid: "bezahlt", shipped: "versendet", cancelled: "storniert", expired: "abgelaufen" };
const ERRORS = {
  name_required: "Bitte einen Namen eingeben.", slug_taken: "Diese Adresse (Slug) wird schon von einem anderen Produkt verwendet.",
  price_invalid: "Der Preis ist ungültig.", weight_invalid: "Das Gewicht ist ungültig.", stock_invalid: "Ein Bestand ist ungültig.",
  variant_label_required: "Bei mehreren Varianten braucht jede eine Bezeichnung (z. B. S, M, L).", category_unknown: "Bitte eine Kategorie wählen.",
  image_type_unsupported: "Bitte JPG, PNG oder WebP hochladen.", image_too_large: "Das Bild ist größer als 8 MB.",
  not_paid: "Die Bestellung ist noch nicht bezahlt.", cannot_cancel: "Diese Bestellung kann nicht mehr storniert werden.",
};

async function api(path, opts = {}) {
  const headers = { authorization: `Bearer ${token}`, ...(opts.headers || {}) };
  if (typeof opts.body === "string") headers["content-type"] = "application/json";
  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error("unauthorized"); }
  if (!res.ok || data.ok === false) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}
function fail(err) {
  const el = $("#panel-error");
  el.textContent = ERRORS[err.message] || `Das hat nicht funktioniert (${err.message}).`;
  el.hidden = false;
  el.scrollIntoView({ block: "nearest" });
}
const clearError = () => { $("#panel-error").hidden = true; };

// ---------- Produkte ----------
async function loadProducts() {
  const data = await api("/api/admin/products");
  categories = data.categories;
  const catName = Object.fromEntries(categories.map((c) => [c.slug, c.name_de]));
  $("#product-rows").innerHTML = data.products.map((p) => `<tr>
      <td>${p.image ? `<img src="${esc(p.image)}" alt="">` : ""}</td>
      <td><strong>${esc(p.name_de)}</strong><br><span class="small">/${esc(p.slug)}${p.is_unique ? " · Einzelstück" : ""}</span></td>
      <td>${esc(catName[p.category] || p.category)}</td>
      <td>${money(p.price_cents)}</td>
      <td>${p.variants.map((v) => `<div class="variant-stock">${p.variants.length > 1 ? `<span>${esc(v.label)}</span>` : ""}<input type="number" class="stock-input" min="0" value="${v.stock}" data-product="${p.id}" data-variant="${v.id}" aria-label="Bestand ${esc(p.name_de)} ${esc(v.label)}"></div>`).join("")}</td>
      <td>${p.active ? "ja" : "<strong>Entwurf</strong>"}</td>
      <td><button type="button" class="btn secondary small-btn" data-edit="${p.id}">Bearbeiten</button></td>
    </tr>`).join("") || `<tr><td colspan="7">Noch keine Produkte.</td></tr>`;
}

const EMPTY = { id: null, name_de: "", name_en: "", slug: "", category: "", desc_de: "", desc_en: "", price_cents: 0, weight_g: 0, is_unique: 0, active: 0, sort: 0, variants: [{ id: null, label: "", sku: "", stock: 0 }], images: [] };

function variantRow(v) {
  return `<div class="variant-row" data-variant-id="${v.id ?? ""}">
    <input type="text" placeholder="Bezeichnung, z. B. M (leer bei nur einer Variante)" value="${esc(v.label)}" data-f="label" aria-label="Bezeichnung">
    <input type="text" placeholder="Artikelnummer (optional)" value="${esc(v.sku || "")}" data-f="sku" aria-label="Artikelnummer">
    <input type="number" min="0" value="${v.stock}" data-f="stock" aria-label="Bestand">
    <button type="button" class="linkish" data-remove-variant>entfernen</button>
  </div>`;
}

function openEditor(p) {
  clearError();
  const ed = $("#editor");
  ed.hidden = false;
  ed.innerHTML = `<form class="editor" id="product-form" data-id="${p.id ?? ""}">
    <h2>${p.id ? "Produkt bearbeiten" : "Neues Produkt"}</h2>
    <div class="row">
      <label><span>Name (Deutsch)</span><input type="text" name="name_de" value="${esc(p.name_de)}" required></label>
      <label><span>Name (Englisch)</span><input type="text" name="name_en" value="${esc(p.name_en)}"></label>
    </div>
    <div class="row">
      <label><span>Kategorie</span><select name="category">${categories.map((c) => `<option value="${c.slug}"${c.slug === p.category ? " selected" : ""}>${esc(c.name_de)}</option>`).join("")}</select></label>
      <label><span>Preis in € (inkl. MwSt.)</span><input type="number" name="price" min="0" step="0.01" value="${(p.price_cents / 100).toFixed(2)}" required></label>
      <label><span>Gewicht in Gramm (für den Versand)</span><input type="number" name="weight_g" min="0" step="1" value="${p.weight_g}" required></label>
      <label><span>Position in der Übersicht</span><input type="number" name="sort" min="0" step="1" value="${p.sort}"></label>
    </div>
    <label><span>Beschreibung (Deutsch)</span><textarea name="desc_de">${esc(p.desc_de)}</textarea></label>
    <label><span>Beschreibung (Englisch)</span><textarea name="desc_en">${esc(p.desc_en)}</textarea></label>
    <div>
      <span style="font-weight:600">Varianten und Bestand</span>
      <div id="variants" style="margin-top:8px">${p.variants.map(variantRow).join("")}</div>
      <button type="button" class="linkish" id="add-variant">Variante hinzufügen (z. B. weitere Größe)</button>
    </div>
    <label class="check"><input type="checkbox" name="is_unique"${p.is_unique ? " checked" : ""}><span style="font-weight:400">Einzelstück (z. B. Originalzeichnung, keine Mengenauswahl)</span></label>
    <label class="check"><input type="checkbox" name="active"${p.active ? " checked" : ""}><span style="font-weight:400">Im Shop sichtbar</span></label>
    <label><span>Adresse im Shop (Slug, leer lassen für automatisch)</span><input type="text" name="slug" value="${esc(p.slug)}"></label>
    <div>
      <span style="font-weight:600">Bilder</span>
      ${p.id ? `<div class="img-list" id="img-list" style="margin:8px 0">${p.images.map((i, n) => `<figure data-image="${i.id}"><img src="${esc(i.path)}" alt=""><figcaption class="small">${n === 0 ? "Titelbild · " : `<button type="button" class="linkish" data-first-image="${i.id}">nach vorn</button> · `}<button type="button" class="linkish" data-delete-image="${i.id}">löschen</button></figcaption></figure>`).join("") || '<span class="small">Noch keine Bilder.</span>'}</div>
      <input type="file" id="upload" accept="image/jpeg,image/png,image/webp" multiple>
      <p class="small">JPG, PNG oder WebP, am besten quadratisch und etwa 1600 px breit, höchstens 8 MB.</p>` : `<p class="small">Bilder kannst du hochladen, nachdem das Produkt gespeichert ist.</p>`}
    </div>
    <div class="actions">
      <button type="submit" class="btn">Speichern</button>
      <button type="button" class="btn secondary" id="close-editor">Schließen</button>
      ${p.id ? `<button type="button" class="linkish" id="delete-product" style="margin-left:auto">Produkt löschen</button>` : ""}
    </div>
  </form>`;
  ed.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function editProduct(id) {
  const { product } = await api(`/api/admin/products/${id}`);
  openEditor(product);
}

$("#tab-products").addEventListener("click", async (e) => {
  try {
    if (e.target.closest("#new-product")) return openEditor({ ...EMPTY, category: categories[0]?.slug });
    const edit = e.target.closest("[data-edit]");
    if (edit) return await editProduct(edit.dataset.edit);
    if (e.target.closest("#close-editor")) { $("#editor").hidden = true; return; }
    if (e.target.closest("#add-variant")) return $("#variants").insertAdjacentHTML("beforeend", variantRow({ id: null, label: "", sku: "", stock: 0 }));
    const rmV = e.target.closest("[data-remove-variant]");
    if (rmV) { if ($("#variants").children.length > 1) rmV.closest(".variant-row").remove(); return; }
    const id = $("#product-form")?.dataset.id;
    const delImg = e.target.closest("[data-delete-image]");
    if (delImg) { await api(`/api/admin/images?id=${delImg.dataset.deleteImage}`, { method: "DELETE" }); await editProduct(id); return loadProducts(); }
    const first = e.target.closest("[data-first-image]");
    if (first) {
      const ids = [...document.querySelectorAll("#img-list [data-image]")].map((f) => Number(f.dataset.image));
      const front = Number(first.dataset.firstImage);
      await api("/api/admin/images", { method: "PUT", body: JSON.stringify({ product: Number(id), order: [front, ...ids.filter((x) => x !== front)] }) });
      await editProduct(id);
      return loadProducts();
    }
    if (e.target.closest("#delete-product")) {
      if (!confirm("Dieses Produkt mit allen Bildern wirklich löschen?")) return;
      await api(`/api/admin/products/${id}`, { method: "DELETE" });
      $("#editor").hidden = true;
      return loadProducts();
    }
  } catch (err) { fail(err); }
});

$("#tab-products").addEventListener("submit", async (e) => {
  if (e.target.id !== "product-form") return;
  e.preventDefault();
  clearError();
  const f = e.target;
  const body = {
    name_de: f.name_de.value, name_en: f.name_en.value, slug: f.slug.value, category: f.category.value,
    desc_de: f.desc_de.value, desc_en: f.desc_en.value,
    price_cents: Math.round(Number(f.price.value) * 100), weight_g: Number(f.weight_g.value), sort: Number(f.sort.value) || 0,
    is_unique: f.is_unique.checked, active: f.active.checked,
    variants: [...f.querySelectorAll(".variant-row")].map((r) => ({
      id: r.dataset.variantId ? Number(r.dataset.variantId) : null,
      label: r.querySelector('[data-f="label"]').value, sku: r.querySelector('[data-f="sku"]').value, stock: Number(r.querySelector('[data-f="stock"]').value),
    })),
  };
  try {
    const id = f.dataset.id;
    const res = await api(id ? `/api/admin/products/${id}` : "/api/admin/products", { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
    await loadProducts();
    await editProduct(res.id);
  } catch (err) { fail(err); }
});

$("#tab-products").addEventListener("change", async (e) => {
  try {
    if (e.target.id === "upload") {
      const id = $("#product-form").dataset.id;
      for (const file of e.target.files) {
        await api(`/api/admin/images?product=${id}`, { method: "POST", body: file, headers: { "content-type": file.type } });
      }
      await editProduct(id);
      return loadProducts();
    }
    if (e.target.matches(".stock-input")) {
      clearError();
      await api(`/api/admin/products/${e.target.dataset.product}`, { method: "PATCH", body: JSON.stringify({ variantId: Number(e.target.dataset.variant), stock: Number(e.target.value) }) });
      e.target.style.background = "#cfe8c5";
      setTimeout(() => { e.target.style.background = ""; }, 900);
    }
  } catch (err) { fail(err); }
});

// ---------- Bestellungen ----------
function address(o) {
  let a = null;
  try { a = o.shipping_address ? JSON.parse(o.shipping_address) : null; } catch { /* leer */ }
  const lines = a ? [o.customer_name, a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state, a.country] : [o.country];
  return lines.filter(Boolean).map(esc).join("<br>") + (o.email ? `<br><a href="mailto:${esc(o.email)}">${esc(o.email)}</a>` : "") + (o.phone ? `<br>${esc(o.phone)}` : "");
}

async function loadOrders() {
  const { orders } = await api(`/api/admin/orders${$("#show-all").checked ? "?all=1" : ""}`);
  $("#order-rows").innerHTML = orders.map((o) => `<tr>
      <td><strong>${esc(o.id)}</strong></td>
      <td><span class="status ${o.status}">${STATUS[o.status] || o.status}</span>${o.tracking ? `<br><span class="small">${esc(o.tracking)}</span>` : ""}${o.note ? `<br><span class="small">${esc(o.note)}</span>` : ""}</td>
      <td>${dateTime(o.created_at)}</td>
      <td>${o.items.map((i) => `${i.quantity} × ${esc(i.name)}${i.variant_label ? ` (${esc(i.variant_label)})` : ""}${i.sku ? ` <span class="small">${esc(i.sku)}</span>` : ""}`).join("<br>")}<br><span class="small">${o.weight_g} g inkl. Verpackung</span></td>
      <td>${address(o)}</td>
      <td>${money(o.total_cents, o.currency)}<br><span class="small">davon Versand ${money(o.shipping_cents, o.currency)}${o.payment_method ? ` · ${esc(o.payment_method)}` : ""}</span></td>
      <td>${o.status === "paid" ? `<button type="button" class="btn small-btn" data-ship="${esc(o.id)}">Versendet</button><br>` : ""}${o.status === "paid" || o.status === "pending_payment" ? `<button type="button" class="linkish" data-cancel="${esc(o.id)}" style="margin-top:8px">stornieren</button>` : ""}</td>
    </tr>`).join("") || `<tr><td colspan="7">Keine Bestellungen.</td></tr>`;
}

$("#tab-orders").addEventListener("click", async (e) => {
  try {
    const ship = e.target.closest("[data-ship]");
    if (ship) {
      const tracking = prompt(`Sendungsnummer für ${ship.dataset.ship} (kann leer bleiben). Die Kundin oder der Kunde bekommt eine Versandmail.`);
      if (tracking === null) return;
      await api(`/api/admin/orders/${ship.dataset.ship}`, { method: "POST", body: JSON.stringify({ action: "ship", tracking, notify: true }) });
      return loadOrders();
    }
    const cancel = e.target.closest("[data-cancel]");
    if (cancel) {
      if (!confirm(`${cancel.dataset.cancel} wirklich stornieren? Der Bestand wird zurückgebucht.`)) return;
      await api(`/api/admin/orders/${cancel.dataset.cancel}`, { method: "POST", body: JSON.stringify({ action: "cancel" }) });
      await loadOrders();
      return loadProducts();
    }
  } catch (err) { fail(err); }
});
$("#show-all").addEventListener("change", () => loadOrders().catch(fail));

// ---------- Anmeldung und Reiter ----------
document.querySelector(".tabs").addEventListener("click", (e) => {
  const tab = e.target.closest("[data-tab]");
  if (!tab) return;
  clearError();
  document.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b === tab)));
  $("#tab-products").hidden = tab.dataset.tab !== "products";
  $("#tab-orders").hidden = tab.dataset.tab !== "orders";
  (tab.dataset.tab === "orders" ? loadOrders() : loadProducts()).catch(fail);
});

function show(loggedIn) {
  $("#login").hidden = loggedIn;
  $("#panel").hidden = !loggedIn;
  $("#logout").hidden = !loggedIn;
}
function logout() {
  token = "";
  try { sessionStorage.removeItem("jj-admin"); } catch { /* egal */ }
  show(false);
}
$("#login").addEventListener("submit", async (e) => {
  e.preventDefault();
  token = $("#token").value;
  try {
    await loadProducts();
    try { sessionStorage.setItem("jj-admin", token); } catch { /* egal */ }
    show(true);
  } catch (err) {
    $("#login-error").textContent = err.message === "admin_not_configured" ? "ADMIN_TOKEN ist noch nicht gesetzt." : "Anmeldung fehlgeschlagen.";
    $("#login-error").hidden = false;
  }
});
$("#logout").addEventListener("click", logout);
if (token) loadProducts().then(() => show(true)).catch(() => show(false));
