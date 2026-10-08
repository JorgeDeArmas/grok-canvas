import { html, setHtml } from "./html.js";
import { t } from "./copy.js";
import { AppBar, TabBar, HeroCard, ShortcutTile, StatusChip, SayBox, DoLine } from "./components.js";
import { renderBoard, normalizeBoard } from "./board.js";

const DEMO_BOARD = normalizeBoard({
  type: "board",
  version: 2,
  name: "Producto A",
  job: "demo-a",
  beats: [
    { shot: 1, vo: "Mira esto, es el producto que uso todos los días.", do_es: "Muestra el pack de frente, sonríe." },
    { shot: 2, vo: "Lo abres y ya está listo.", do_es: "Abre el pack con las dos manos." },
  ],
  script: "Mira esto, es el producto que uso todos los días.\nLo abres y ya está listo.",
  shots: [{ shot: 1, takes: 1 }, { shot: 2, takes: 1 }],
});

function render() {
  const el = document.getElementById("app");
  if (!el) return;
  setHtml(el, html`
    <div class="banner info" role="status">${t("por.demo")}</div>
    ${AppBar({ title: t("tab.dashboard"), variant: "large" })}
    <div class="screen">
      ${HeroCard({ title: "Producto A", meta: "Elige guion", icon: "pen-line", tone: "accent", action: t("act.pick"), act: "noop" })}
      <div class="tiles" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0">
        ${ShortcutTile({ icon: "play", label: t("tab.feed"), sub: "3 videos hoy", act: "noop" })}
        ${ShortcutTile({ icon: "layout-grid", label: t("nav.boards"), sub: "2 boards", act: "noop" })}
      </div>
      <h2 class="section-h">${t("dash.todo")}</h2>
      <div class="card"><div class="list-row"><div class="list-body"><div class="list-title">Producto A</div></div>${StatusChip({ tone: "accent", label: "Elige guion" })}</div></div>
      <h2 class="section-h">${t("nav.boards")}</h2>
      ${renderBoard(DEMO_BOARD, { role: "viewer" })}
      <p class="list-meta">${t("board.scenes")} · ${t("up.section")}</p>
    </div>
    ${TabBar({
      items: [
        { id: "dashboard", label: t("tab.dashboard"), icon: "layout-dashboard" },
        { id: "grabar", label: t("tab.grabar"), icon: "video" },
        { id: "creadoras", label: t("tab.creadoras"), icon: "users" },
      ],
      current: "dashboard",
    })}
  `);
}

render();
