import { html, raw } from "../html.js";
import { t } from "../copy.js";
import { icon } from "../icons.js";
import { laneLabel, laneId } from "../lanes.js";
import { EmptyState } from "../components.js";
import { compactCount } from "../dates.js";
import { loadWant, loadFeedAvatar } from "../model.js";

export function normalizeFeed(scene) {
  const avatars = (scene.avatars || []).map((a) => ({
    ...a, id: laneId(a.id) || a.id, label: laneLabel(a.id) || a.label,
  }));
  return { ...scene, avatars, cards: scene.cards || scene.items || [] };
}

export function render(store) {
  const feed = store.feed;
  if (!feed) return html`<div class="feed-root" style="padding:80px 16px">${EmptyState({ icon: "play", tone: "neutral", title: t("err.decrypt.title"), body: t("err.decrypt.body"), action: t("common.retry"), act: "retry" })}</div>`;
  const lane = store.feedLane || loadFeedAvatar() || (feed.default_avatar && laneId(feed.default_avatar)) || "all";
  const cards = (feed.cards || []).filter((c) => {
    if (lane !== "all" && lane !== "todos") {
      const av = (c.avatars || [feed.default_avatar]).map(laneId);
      if (!av.includes(lane)) return false;
    }
    return passFilters(c, store.feedFilter || {});
  });
  const lanes = [
    ...(feed.avatars || []).map((a) => ({ id: a.id, label: laneLabel(a.id) || a.label })),
    { id: "all", label: t("fed.all") },
  ];
  if (!cards.length) {
    const emptyLane = (feed.avatars || []).find((a) => a.id === lane);
    return html`<div class="feed-root" style="min-height:100dvh;padding:80px 16px;background:#000;color:#fff">
      ${top(store, lanes, lane)}
      ${EmptyState({ icon: "play", title: emptyLane?.empty || t("empty.feed.filter.title"), body: emptyLane ? "" : t("empty.feed.filter.body") })}
    </div>`;
  }
  return html`<div class="feed-root" style="background:#000;color:#fff;min-height:100dvh">
    ${top(store, lanes, lane)}
    <div id="feed-snap" style="height:calc(100dvh - 96px);overflow-y:auto;scroll-snap-type:y mandatory">
      ${cards.map((c, i) => card(store, c, i))}
    </div>
  </div>`;
}

function top(store, lanes, lane) {
  return html`<div style="position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;padding:calc(8px + var(--safe-t)) 8px 8px;background:#000">
    ${store.single ? raw("") : html`<button class="icon-btn" data-act="back" style="color:#fff">${icon("chevron-left", { label: t("nav.back") })}</button>`}
    <div style="flex:1;display:flex;gap:4px;overflow:auto">
      ${lanes.map((l) => html`<button class="filter-chip" style="${l.id === lane ? "background:#fff;color:#000" : "background:rgba(255,255,255,.16);color:#fff"}" data-act="feed-lane" data-id="${l.id}">${l.label}</button>`)}
    </div>
    <button class="pill-btn" style="color:#fff" data-act="feed-filters">${icon("sliders-horizontal", { size: 18 })} ${t("fed.filters")}</button>
  </div>`;
}

function passFilters(c, f) {
  if (f.creator && c.creator !== f.creator && c.handle !== f.creator) return false;
  return true;
}

function card(store, c, i) {
  const want = loadWant(store.feedBlob || store.rootBlob);
  const pid = c.product?.id;
  const wanted = pid && want[pid];
  const line = c.product?.line || firstLine(c);
  return html`<article class="feed-card" data-i="${i}" style="scroll-snap-align:start;min-height:100%;position:relative;background:#111">
    <div class="ph" style="position:absolute;inset:0;background:#111" data-cover="${c.cover?.src || c.cover || ""}"></div>
    <div style="position:absolute;left:12px;right:72px;bottom:24px">
      <div style="font-weight:700">${c.creator || c.handle || ""}</div>
      ${line ? html`<div style="opacity:.9;margin-top:4px">${line}</div>` : raw("")}
      ${c.product ? html`<button class="filter-chip" style="margin-top:8px;background:rgba(255,255,255,.16);color:#fff" data-act="product-pill:${pid}">${icon("shopping-cart", { size: 14 })} ${c.product.name || ""}</button>` : raw("")}
      ${c.score != null ? html`<span class="chip" style="margin-top:8px;background:rgba(255,255,255,.16);color:#fff">${t("fed.score")} ${c.score}</span>` : raw("")}
    </div>
    <div style="position:absolute;right:8px;bottom:24px;display:flex;flex-direction:column;align-items:center;gap:12px;color:#fff">
      ${metric("eye", c.views)} ${metric("heart", c.likes)} ${metric("message-circle", c.comments)}
      ${metric("repeat-2", c.shares)} ${metric("bookmark", c.saves)}
      <button class="icon-btn" style="color:#fff" data-act="note-feed:${c.id || i}">${icon("message-square-text")}</button>
      ${pid ? html`<button class="icon-btn" style="color:#fff;flex-direction:column" data-act="want:${pid}">${icon("circle-plus")}<span style="font-size:11px">${wanted ? t("fed.wanted") : t("fed.want")}</span></button>` : raw("")}
      ${c.href ? html`<a class="icon-btn" style="color:#fff;text-decoration:none" href="${c.href}" target="_blank" rel="noopener noreferrer">${icon("external-link")}</a>` : raw("")}
    </div>
  </article>`;
}

function metric(name, n) {
  if (n == null) return raw("");
  return html`<div style="text-align:center">${icon(name, { size: 24 })}<div style="font-size:11px">${compactCount(n)}</div></div>`;
}

function firstLine(c) {
  const sales = c.product?.sales || c.sales;
  return sales != null ? String(sales) : "";
}
