// Widerrufsbelehrung und Muster-Widerrufsformular für die Bestellbestätigung (Textform).
// Derselbe Text steht in public/legal.html (Abschnitt #widerruf). Beide Stellen zusammen ändern.
import { config } from "./config.js";
import { escapeHtml as e } from "./http.js";

const s = config.seller;
const SELLER_LINE = `${s.name}, ${s.street}, ${s.zip} ${s.city}, E-Mail: ${s.email}`;

const SECTIONS = [
  {
    h: "Widerrufsrecht",
    blocks: [
      { p: "Verbraucher haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen." },
      { p: "Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag," },
      {
        ul: [
          "an dem Sie oder ein von Ihnen benannter Dritter, der nicht Beförderer ist, die Waren in Besitz genommen haben beziehungsweise hat;",
          "bei mehreren Waren, die Sie im Rahmen einer einheitlichen Bestellung bestellt haben und die getrennt geliefert werden, an dem Sie oder ein von Ihnen benannter Dritter die letzte Ware in Besitz genommen haben beziehungsweise hat.",
        ],
      },
      { p: `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${SELLER_LINE}) mittels einer eindeutigen Erklärung (zum Beispiel per Brief oder E-Mail) über Ihren Entschluss informieren, diesen Vertrag zu widerrufen. Sie können dafür das untenstehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.` },
      { p: "Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden." },
    ],
  },
  {
    h: "Folgen des Widerrufs",
    blocks: [
      { p: "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme zusätzlicher Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist." },
      { p: "Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart. In keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet." },
      { p: "Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist." },
      { p: "Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns zurückzusenden oder zu übergeben. Die Frist ist gewahrt, wenn Sie die Waren vor Ablauf der Frist von vierzehn Tagen absenden." },
      { p: "Sie tragen die unmittelbaren Kosten der Rücksendung der Waren." },
      { p: "Sie müssen für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser Wertverlust auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist." },
    ],
  },
  {
    h: "Ausschluss des Widerrufsrechts",
    blocks: [
      { p: "Das Widerrufsrecht besteht nicht bei Waren, die nicht vorgefertigt sind und für deren Herstellung eine individuelle Auswahl oder Bestimmung durch den Verbraucher maßgeblich ist oder die eindeutig auf die persönlichen Bedürfnisse des Verbrauchers zugeschnitten sind." },
      { p: "Das Widerrufsrecht besteht ferner nicht bei der Lieferung von Ton- oder Videoaufnahmen (zum Beispiel einer DVD) in einer versiegelten Packung, wenn die Versiegelung nach der Lieferung entfernt wurde." },
    ],
  },
  {
    h: "Muster-Widerrufsformular",
    blocks: [
      { p: "(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)" },
      { p: `An ${SELLER_LINE}:` },
      { p: "Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*):" },
      { p: "Bestellt am (*) / erhalten am (*):" },
      { p: "Name des/der Verbraucher(s):" },
      { p: "Anschrift des/der Verbraucher(s):" },
      { p: "Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):" },
      { p: "Datum:" },
      { p: "(*) Unzutreffendes streichen." },
    ],
  },
];

const NOTE_EN = "The legally binding cancellation policy and the model withdrawal form are provided in German.";

// HTML-Block für die Bestätigungsmail, am Ende unter einer Linie
export function cancellationHtml(l) {
  const body = SECTIONS.map((sec) =>
    `<p style="margin:16px 0 4px;font-weight:bold">${e(sec.h)}</p>` +
    sec.blocks.map((b) => (b.ul
      ? `<ul style="margin:4px 0;padding-left:20px">${b.ul.map((i) => `<li style="margin:2px 0">${e(i)}</li>`).join("")}</ul>`
      : `<p style="margin:4px 0">${e(b.p)}</p>`)).join("")).join("");
  return `<div style="margin-top:28px;border-top:2px solid #000000;padding-top:16px;font-size:13px;line-height:1.45">
    <p style="margin:0 0 4px;font-size:16px;font-weight:bold">Widerrufsbelehrung</p>
    ${l === "de" ? "" : `<p style="margin:4px 0">${NOTE_EN}</p>`}${body}</div>`;
}
