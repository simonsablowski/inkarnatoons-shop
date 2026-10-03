// Druckansicht für Rechnung und Adressaufkleber. Aufruf aus der Verwaltung:
//   /print.html?order=JJ-ABC123&doc=invoice   oder   &doc=label
const params = new URLSearchParams(location.search);
const kind = params.get("doc") === "label" ? "label" : "invoice";
let token = "";
try { token = sessionStorage.getItem("jj-admin") || ""; } catch { /* egal */ }

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const T = {
  de: {
    invoice: "Rechnung", number: "Rechnungsnummer", date: "Rechnungsdatum", order: "Bestellnummer", delivery: "Lieferdatum",
    deliveryValue: "entspricht dem Rechnungsdatum", pos: "Pos.", item: "Artikel", qty: "Menge", unit: "Einzelpreis", sum: "Gesamt",
    shipping: "Versand", net: "Nettobetrag", vat: (r) => `Umsatzsteuer ${r} %`, total: "Rechnungsbetrag", totalGross: "Rechnungsbetrag (brutto)",
    small: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.", paid: (m, d) => `Der Rechnungsbetrag wurde am ${d}${m ? ` per ${m}` : ""} bezahlt.`,
    thanks: "Vielen Dank für deine Bestellung.", taxNumber: "Steuernummer", vatId: "USt-IdNr.",
  },
  en: {
    invoice: "Invoice", number: "Invoice number", date: "Invoice date", order: "Order number", delivery: "Delivery date",
    deliveryValue: "same as invoice date", pos: "No.", item: "Item", qty: "Qty", unit: "Unit price", sum: "Total",
    shipping: "Shipping", net: "Net amount", vat: (r) => `VAT ${r} %`, total: "Invoice total", totalGross: "Invoice total (gross)",
    small: "No VAT is charged in accordance with § 19 UStG (German small business regulation).", paid: (m, d) => `The invoice amount was paid on ${d}${m ? ` by ${m}` : ""}.`,
    thanks: "Thank you for your order.", taxNumber: "Tax number", vatId: "VAT ID",
  },
};
const METHODS = { card: { de: "Kreditkarte", en: "credit card" }, paypal: { de: "PayPal", en: "PayPal" }, test: { de: "Testzahlung", en: "test payment" } };

function addressLines(order, l) {
  let a = null;
  try { a = order.shipping_address ? JSON.parse(order.shipping_address) : null; } catch { /* leer */ }
  if (!a) return { lines: [order.customer_name || ""], country: order.country };
  const country = a.country || order.country;
  return { lines: [order.customer_name, a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state].filter(Boolean), country };
}
// Ländername für die Anschrift: im Inland weglassen, sonst ausgeschrieben
function countryLine(code, locale) {
  if (!code || code === "DE") return "";
  try { return new Intl.DisplayNames([locale], { type: "region" }).of(code) || code; } catch { return code; }
}

function renderInvoice({ order, seller, tax }) {
  const l = order.language === "de" ? "de" : "en";
  const t = T[l];
  const locale = l === "de" ? "de-DE" : "en-GB";
  const money = (c) => new Intl.NumberFormat(locale, { style: "currency", currency: order.currency }).format(c / 100);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(order.paid_at || order.created_at));
  const { lines, country } = addressLines(order, l);
  const rows = order.items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.name)}${i.variant_label ? ` (${esc(i.variant_label)})` : ""}${i.sku ? `<br><span style="color:#555;font-size:8.5pt">${esc(i.sku)}</span>` : ""}</td>
      <td class="num">${i.quantity}</td><td class="num">${money(i.unit_cents)}</td><td class="num">${money(i.unit_cents * i.quantity)}</td></tr>`).join("");
  const gross = order.total_cents;
  const vat = tax.mode === "vat" ? Math.round(gross - gross / (1 + tax.ratePercent / 100)) : 0;
  const sums = tax.mode === "vat"
    ? `<tr><td>${t.net}</td><td class="num">${money(gross - vat)}</td></tr><tr><td>${t.vat(tax.ratePercent)}</td><td class="num">${money(vat)}</td></tr><tr class="total"><td>${t.totalGross}</td><td class="num">${money(gross)}</td></tr>`
    : `<tr class="total"><td>${t.total}</td><td class="num">${money(gross)}</td></tr>`;
  const method = METHODS[order.payment_method]?.[l] || "";
  const placeholder = /Platzhalter/.test(seller.name);
  document.title = `${t.invoice} ${order.invoice_number || order.id}`;
  return `<article class="invoice">
    <div class="seller-head"><strong>${esc(seller.name)}</strong>${placeholder ? ' <span class="placeholder-flag">(Platzhalter)</span>' : ""}<br>${esc(seller.street)}<br>${esc(seller.zip)} ${esc(seller.city)}<br>${esc(seller.email)}${seller.web ? `<br>${esc(seller.web)}` : ""}</div>
    <div class="address">
      <div class="return-line">${esc(seller.name)}, ${esc(seller.street)}, ${esc(seller.zip)} ${esc(seller.city)}</div>
      ${lines.map(esc).join("<br>")}${countryLine(country, l) ? `<br>${esc(countryLine(country, l))}` : ""}
    </div>
    <div class="meta">
      <h1>${t.invoice}</h1>
      <table>
        <tr><td>${t.number}</td><td>${esc(order.invoice_number || "–")}</td></tr>
        <tr><td>${t.date}</td><td>${date}</td></tr>
        <tr><td>${t.order}</td><td>${esc(order.id)}</td></tr>
        <tr><td>${t.delivery}</td><td>${t.deliveryValue}</td></tr>
      </table>
    </div>
    <table class="items">
      <thead><tr><th>${t.pos}</th><th>${t.item}</th><th class="num">${t.qty}</th><th class="num">${t.unit}</th><th class="num">${t.sum}</th></tr></thead>
      <tbody>${rows}<tr><td>${order.items.length + 1}</td><td>${t.shipping}</td><td class="num">1</td><td class="num">${money(order.shipping_cents)}</td><td class="num">${money(order.shipping_cents)}</td></tr></tbody>
    </table>
    <table class="sums">${sums}</table>
    <div class="notes">
      ${tax.mode === "small_business" ? `<p>${t.small}</p>` : ""}
      <p>${t.paid(method, date)}</p>
      <p>${t.thanks}</p>
    </div>
    <footer>
      <span>${esc(seller.name)}<br>${esc(seller.street)}, ${esc(seller.zip)} ${esc(seller.city)}</span>
      <span>${seller.taxNumber ? `${t.taxNumber}: ${esc(seller.taxNumber)}<br>` : ""}${seller.vatId ? `${t.vatId}: ${esc(seller.vatId)}` : ""}</span>
      <span>${esc(seller.bank || "")}</span>
    </footer>
  </article>`;
}

function renderLabel({ order, seller, label }) {
  const { lines, country } = addressLines(order, "en");
  // Bei Auslandssendungen steht das Zielland in Großbuchstaben in der letzten Zeile
  const c = countryLine(country, "en").toUpperCase();
  document.title = `Adressaufkleber ${order.id}`;
  const style = document.createElement("style");
  style.textContent = `@page { size: ${label.widthMm}mm ${label.heightMm}mm; margin: 0; } .label { width: ${label.widthMm}mm; height: ${label.heightMm}mm; }`;
  document.head.append(style);
  return `<article class="label">
    <div class="from">${esc(seller.name)} · ${esc(seller.street)} · ${esc(seller.zip)} ${esc(seller.city)}${c ? " · GERMANY" : ""}</div>
    <div class="to">${lines.map((x) => `<span>${esc(x)}</span>`).join("")}${c ? `<span class="country">${esc(c)}</span>` : ""}</div>
    <div class="ref">${esc(order.id)}</div>
  </article>`;
}

async function main() {
  const doc = document.querySelector("#doc");
  try {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(params.get("order") || "")}`, { headers: { authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || res.status);
    if (kind === "invoice") {
      const style = document.createElement("style");
      style.textContent = "@page { size: A4; margin: 0; }";
      document.head.append(style);
      doc.innerHTML = renderInvoice(data);
      document.querySelector("#hint").textContent = "Im Druckdialog „Als PDF speichern“ wählen, um die Rechnung als Datei abzulegen.";
    } else {
      doc.innerHTML = renderLabel(data);
      document.querySelector("#hint").textContent = `Etikett ${data.label.widthMm} × ${data.label.heightMm} mm. Im Druckdialog den Etikettendrucker und „Tatsächliche Größe“ wählen.`;
    }
  } catch (err) {
    doc.innerHTML = `<p class="error">${err.message === "unauthorized" || !token ? "Bitte zuerst in der Verwaltung anmelden und die Seite von dort öffnen." : "Die Bestellung konnte nicht geladen werden."}</p>`;
  }
}
document.querySelector("#print").addEventListener("click", () => window.print());
main();
