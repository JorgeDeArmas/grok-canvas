import { html, raw } from "../html.js";
import { t } from "../copy.js";
import { icon } from "../icons.js";
import { Thumb, Segmented, EmptyState } from "../components.js";
import { jorgeVideos, loadTicks } from "../model.js";
import { dayLabel, isOverdue, isToday, overdueLabel } from "../dates.js";
import { thumbSrc } from "../core.js";

export function filmedMap(store) {
  const ticks = { ...(store.model.ticks || {}), ...loadTicks(store.filmBlob || store.rootBlob) };
  const map = {};
  for (const [id, pair] of Object.entries(ticks)) {
    map[id] = Array.isArray(pair) ? !!pair[0] : !!pair;
  }
  return map;
}

export function grabarBadge(store) {
  const now = store.now || new Date();
  const filmed = filmedMap(store);
  return jorgeVideos(store.model).filter((v) => {
    if (filmed[v.id] || v.status === "filmed") return false;
    if (v.status !== "to_film" || !v.ready) return false;
    return isToday(v.day, now) || isOverdue(v.day, now) || v.day === "sin-fecha";
  }).length;
}

export function render(store) {
  const filmed = filmedMap(store);
  const all = jorgeVideos(store.model);
  const seg = store.route.seg === "grabados" ? "grabados" : "todo";
  const list = all.filter((v) => {
    const done = filmed[v.id] || v.status === "filmed";
    return seg === "grabados" ? done : !done;
  });
  const now = store.now || new Date();
  const groups = groupDays(list, now);
  const empty = !list.length
    ? (seg === "grabados"
      ? EmptyState({ icon: "video", tone: "neutral", title: t("empty.grabar.done.title"), body: t("empty.grabar.done.body") })
      : EmptyState({ icon: "circle-check", title: t("empty.grabar.todo.title"), body: store.model.ownerToken ? t("empty.grabar.todo.body.owner") : t("empty.grabar.todo.body.mac") }))
    : raw("");
  return html`
    <div style="padding:0 16px 8px">${Segmented({ options: [
      { id: "todo", label: t("grb.todo"), count: all.filter((v) => !(filmed[v.id] || v.status === "filmed")).length },
      { id: "grabados", label: t("grb.done"), count: all.filter((v) => filmed[v.id] || v.status === "filmed").length },
    ], value: seg, act: "grabar-seg" })}</div>
    ${empty}
    ${groups.map((g) => html`
      <div class="day-h ${g.bad ? "bad" : ""}">${icon("calendar", { size: 16 })} ${g.label}
        <span class="prog">${t("grb.progress", { done: g.done, total: g.items.length })}</span></div>
      ${placeGroups(g.items).map((p) => html`
        ${p.place ? html`<div class="list-meta" style="padding:0 16px 6px">${icon("map-pin", { size: 14 })} ${p.place}</div>` : raw("")}
        <div class="card">${p.items.map((v) => videoCard(store, v, filmed[v.id]))}</div>
      `)}
    `)}
  `;
}

function groupDays(list, now) {
  const map = {};
  for (const v of list) {
    const key = v.day || "sin-fecha";
    if (!map[key]) {
      const bad = isOverdue(key, now);
      map[key] = {
        key, bad,
        label: bad ? overdueLabel(key, now) : dayLabel(key, { now, header: true }),
        items: [], done: 0,
      };
    }
    map[key].items.push(v);
  }
  return Object.values(map).sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

function placeGroups(items) {
  const places = [...new Set(items.map((v) => v.place || ""))];
  if (places.length <= 1) return [{ place: "", items }];
  return places.map((place) => ({ place, items: items.filter((v) => (v.place || "") === place) }));
}

function videoCard(store, v, filmed) {
  const name = (store.model.products || []).find((p) => p.id === v.product)?.name || v.productName || v.title;
  const th = thumbSrc(v.thumb) || thumbSrc(store.model.thumbs?.[v.product]);
  const ready = v.ready !== false && v.status !== "preparing";
  return html`<div class="list-row" style="align-items:flex-start">
    ${Thumb({ src: th, size: 56 })}
    <div class="list-body">
      <div class="list-title">${name}</div>
      <div class="list-meta">${v.title}</div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        ${ready
          ? html`<button class="btn secondary md" data-act="open-board:${v.id}">${t("grb.openBoard")}</button>
                 <button class="btn ${filmed ? "success" : "secondary"} md" data-act="tick:${v.id}">${filmed ? t("grb.filmed") : t("grb.mark")}</button>`
          : html`<span class="chip neutral">${t("grb.preparing")}</span>`}
      </div>
    </div>
  </div>`;
}
