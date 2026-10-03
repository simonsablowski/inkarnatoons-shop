// Filmseite. Die Videoquelle steht in shop.config.json unter "film".
// Videos von YouTube oder Vimeo werden erst nach einem Klick geladen, vorher fließen keine Daten dorthin.
import { start, t, config, esc } from "./shop.js";

const PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>`;
const POSTER = `<img src="/img/titelkarte.jpg" alt="">`;

function embedUrl(film) {
  const id = encodeURIComponent(film.id);
  if (film.provider === "youtube") return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  if (film.provider === "vimeo") return `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1`;
  return null;
}

function render() {
  const film = config().film;
  const player = document.querySelector("#player");
  const consent = document.querySelector("#consent");
  document.querySelector("#to-shop").href = `/?world=${film.world}`;
  consent.textContent = "";
  document.querySelector("#intro").hidden = !film.id;

  if (!film.id) {
    player.innerHTML = `<div class="poster" style="cursor:default">${POSTER}<span class="soon">${t("film.soon")}</span></div>`;
  } else if (film.provider === "file") {
    player.innerHTML = `<video controls preload="metadata" poster="/img/titelkarte.jpg" src="${esc(film.id)}"></video>`;
  } else if (embedUrl(film)) {
    player.innerHTML = `<button type="button" class="poster" id="play">${POSTER}<span class="play">${PLAY}${t("film.play")}</span></button>`;
    consent.textContent = t(`film.consent.${film.provider}`);
    document.querySelector("#play").addEventListener("click", () => {
      player.innerHTML = `<iframe src="${embedUrl(film)}" title="Judas &amp; Jesus" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    });
  }
}
start(render);
