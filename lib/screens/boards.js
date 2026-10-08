import { html, raw } from "../html.js";
import { t } from "../copy.js";
import { icon } from "../icons.js";
import { Segmented, StatusChip, Thumb, EmptyState } from "../components.js";
import { video as videoOf, VIDEO_SECTION_ORDER } from "../status.js";
import { laneLabel, boardDisplayTitle } from "../lanes.js";
import { loadLane } from "../model.js";

const SECTION_COPY = {
  problem: "brd.problem", to_film: "brd.toFilm", editing: "brd.editing",
  published: "brd.published", retired: "brd.retired",
};

export function render(store) {
  const data = store.boards || { boards: [], lanes: [], products: {} };
  const lane = store.boardsLane || loadLane() || "all";
  const lanes = data.lanes || [];
  const all = (data.boards || []).filter((b) => b.kind !== "guide");
  const guides = (data.boards || []).filter((b) => b.kind === "guide");
  const filtered = lane === "all" ? all : all.filter((b) => b.lane === lane);
  const opts = [
    { id: "all", label: t("brd.all"), count: all.length },
    ...lanes.map((l) => ({ id: l.id, label: laneLabel(l.id) || l.label, count: all.filter((b) => b.lane === l.id).length })),
  ];
  if (!filtered.length && !guides.length) {
    return html`${Segmented({ options: opts, value: lane, act: "boards-lane" })}
      ${EmptyState({ icon: "layout-grid", title: lane === "all" ? t("empty.boards.title") : t("empty.boards.lane.title", { lane: laneLabel(lane) }) })}`;
  }
  const sections = {};
  for (const b of filtered) {
    const id = VIDEO_SECTION_ORDER.includes(b.status) ? b.status : "other";
    (sections[id] = sections[id] || []).push(b);
  }
  return html`
    <div style="padding:0 0 8px">${Segmented({ options: opts, value: lane, act: "boards-lane" })}</div>
    ${VIDEO_SECTION_ORDER.map((sid) => section(store, sid, sections[sid] || [], data, lane))}
    ${sections.other ? section(store, "other", sections.other, data, lane) : raw("")}
    ${guides.length ? html`<h2 class="section-h">${t("brd.guides")}</h2><div class="card">${guides.map((b) => row(store, b, data, lane))}</div>` : raw("")}
  `;
}

function section(store, sid, items, data, lane) {
  if (!items.length) return raw("");
  const title = sid === "other" ? t("brd.other") : t(SECTION_COPY[sid] || "brd.other");
  const byP = {};
  for (const b of items) (byP[b.product] = byP[b.product] || []).push(b);
  return html`<section class="section">
    <h2 class="section-h">${title}</h2>
    ${Object.entries(byP).map(([pid, boards]) => {
      const prod = data.products?.[pid] || { name: boards[0].title };
      return html`<div class="card" style="margin-bottom:8px">
        <div class="list-row">
          ${Thumb({ src: prod.thumb || boards[0].thumb })}
          <div class="list-body"><div class="list-title">${prod.name}</div></div>
          ${lane === "all" ? html`<span class="chip neutral">${laneLabel(boards[0].lane)}</span>` : raw("")}
        </div>
        ${boards.map((b) => row(store, b, data, lane))}
      </div>`;
    })}
  </section>`;
}

function row(store, b) {
  const st = videoOf(b.status, b.status);
  const title = boardDisplayTitle(b.title, b.lane);
  const status = b.missing
    ? html`<span class="chip warn">${t("brd.missing")}</span>
        <span class="btn tertiary" data-act="ask-board:${b.id}">${t("brd.ask")}</span>`
    : b.viewer === "canvas"
      ? html`<span class="chip neutral">${t("brd.old")}</span> ${icon("external-link", { size: 16 })}`
      : StatusChip({ tone: st.tone, icon: st.icon, label: st.label });
  return html`<button type="button" class="list-row board-row" data-act="open-lib-board:${b.id}">
    <div class="list-body">
      <div class="list-title">${title}</div>
      <div class="board-row-meta">
        ${b.kind === "ai" ? icon("sparkles", { size: 16 }) : raw("")}
        ${status}
      </div>
      ${b.problem ? html`<div class="list-meta ${b.status === "problem" ? "bad" : ""}">${b.problem}</div>` : raw("")}
    </div>
    <div class="list-trail">${icon("chevron-right", { size: 18 })}</div>
  </button>`;
}
