// Filmplayer für die Übersichtsseite von Judas & Jesus. Die Videoquelle steht in shop.config.json unter "film".
// Videos von YouTube oder Vimeo werden erst nach einem Klick geladen, vorher fließen keine Daten dorthin.
import { t, loc, config, esc } from "./shop.js";

const PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>`;
const POSTER = `<img src="/img/szene-tuer.jpg" alt="">`;

function embedUrl(film) {
  const id = encodeURIComponent(film.id);
  if (film.provider === "youtube") return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  if (film.provider === "vimeo") return `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1`;
  return null;
}

// Mehrere Fassungen (fertiger Film und Animatics): Auswahl über dem Player, abgespielt wird die eigene Videodatei.
function mountVersions(player, note, picker, versions) {
  let current = versions[0];
  const show = (autoplay) => {
    player.innerHTML = `<video controls playsinline preload="${autoplay ? "auto" : "none"}"${current.poster ? ` poster="${esc(current.poster)}"` : ""} src="${esc(current.src)}"${autoplay ? " autoplay" : ""}></video>`;
    note.textContent = loc(current, "note");
    picker.innerHTML = versions.map((v) => `<button type="button" class="chip" data-version="${esc(v.id)}" aria-pressed="${v === current}">${esc(loc(v, "title"))}</button>`).join("");
  };
  picker.hidden = versions.length < 2;
  picker.onclick = (e) => {
    const id = e.target.closest("[data-version]")?.dataset.version;
    const next = versions.find((v) => v.id === id);
    if (!next || next === current) return;
    current = next;
    show(true);
  };
  show(false);
}

export function mountPlayer(player, note, picker) {
  const film = config().film;
  if (film.versions?.length && picker) return mountVersions(player, note, picker, film.versions);
  if (picker) picker.hidden = true;
  note.textContent = film.id ? t("film.note") : "";
  if (!film.id) {
    player.innerHTML = `<div class="poster" style="cursor:default">${POSTER}<span class="soon">${t("film.soon")}</span></div>`;
  } else if (film.provider === "file") {
    player.innerHTML = `<video controls preload="metadata" poster="/img/szene-tuer.jpg" src="${esc(film.id)}"></video>`;
  } else if (embedUrl(film)) {
    player.innerHTML = `<button type="button" class="poster" id="play">${POSTER}<span class="play">${PLAY}${t("film.play")}</span></button>`;
    note.textContent = `${t("film.note")} ${t(`film.consent.${film.provider}`)}`;
    player.querySelector("#play").addEventListener("click", () => {
      player.innerHTML = `<iframe src="${embedUrl(film)}" title="Judas &amp; Jesus" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    });
  }
}

// Freiwillige Unterstützung über Ko-fi. Es ist ein einfacher Link: Bis zum Klick werden keine Daten an Ko-fi übertragen.
// Ohne eingetragenen Namen erscheint der Button als Platzhalter ohne Link.
const CUP = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V7z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M16 9h1.5a2.5 2.5 0 0 1 0 5H16" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M10 13.6s-2.3-1.4-2.3-3a1.3 1.3 0 0 1 2.3-.8 1.3 1.3 0 0 1 2.3.8c0 1.6-2.3 3-2.3 3z" fill="currentColor"/></svg>`;

export function mountSupport(el) {
  const kofi = config().kofi;
  if (!kofi?.show) { el.hidden = true; return; }
  const name = (kofi.name || "").trim();
  const button = name
    ? `<a class="btn kofi" href="https://ko-fi.com/${encodeURIComponent(name)}" target="_blank" rel="noopener">${CUP}${t("support.button")}</a>`
    : `<span class="btn kofi" role="link" aria-disabled="true">${CUP}${t("support.button")}</span>`;
  el.innerHTML = `<p class="support-text">${t("support.text")}</p>${button}${name ? "" : `<p class="support-placeholder">${t("support.placeholder")}</p>`}`;
}
