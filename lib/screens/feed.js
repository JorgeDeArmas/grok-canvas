import { html, raw } from "../html.js";
import { t } from "../copy.js";
import { icon } from "../icons.js";
import { laneLabel, laneId } from "../lanes.js";
import { EmptyState } from "../components.js";
import { compactCount } from "../dates.js";
import { loadWant, loadFeedAvatar } from "../model.js";
import { asMedia, safeTikTokUrl } from "../core.js";

export function normalizeFeed(scene) {
  const avatars = (scene.avatars || []).map((a) => ({
    ...a, id: laneId(a.id) || a.id, label: laneLabel(a.id) || a.label,
  }));
  return { ...scene, avatars, cards: scene.cards || scene.items || [] };
}

export function render(store) {
  const feed = store.feed;
  if (!feed) return html`<div class="feed-root"><div class="feed-empty">${EmptyState({ icon: "play", tone: "neutral", title: t("err.decrypt.title"), body: t("err.decrypt.body"), action: t("common.retry"), act: "retry" })}</div></div>`;
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
    return html`<div class="feed-root">
      ${top(store, lanes, lane)}
      <div class="feed-empty">${EmptyState({ icon: "play", title: emptyLane?.empty || t("empty.feed.filter.title"), body: emptyLane ? "" : t("empty.feed.filter.body") })}</div>
    </div>`;
  }
  return html`<div class="feed-root">
    ${top(store, lanes, lane)}
    <div id="feed-snap">
      ${cards.map((c, i) => card(store, c, i))}
    </div>
  </div>`;
}

function top(store, lanes, lane) {
  return html`<div class="feed-top">
    ${store.single ? raw("") : html`<button class="icon-btn" data-act="back" style="color:#fff">${icon("chevron-left", { label: t("nav.back") })}</button>`}
    <div class="feed-lanes">
      ${lanes.map((l) => html`<button class="filter-chip" style="${l.id === lane ? "background:#fff;color:#000" : "background:rgba(255,255,255,.16);color:#fff"}" data-act="feed-lane" data-id="${l.id}">${l.label}</button>`)}
    </div>
    <button class="pill-btn" style="color:#fff" data-act="feed-filters">${icon("sliders-horizontal", { size: 18 })} ${t("fed.filters")}</button>
  </div>`;
}

function passFilters(c, f) {
  if (f.creator && c.creator !== f.creator && c.handle !== f.creator) return false;
  return true;
}

export function scoreText(score) {
  if (score == null || score === "") return "";
  if (typeof score === "number" && Number.isFinite(score)) return `${t("fed.score")} ${score}`;
  if (typeof score === "string") {
    const s = score.trim();
    if (!s || s === "[object Object]") return "";
    return `${t("fed.score")} ${s}`;
  }
  if (typeof score === "object") {
    const value = score.value;
    if (value == null || value === "" || typeof value === "object") return "";
    const label = typeof score.label === "string" && score.label.trim() && score.label !== "[object Object]"
      ? score.label.trim()
      : t("fed.score");
    return `${label} ${value}`;
  }
  return "";
}

function metricValue(card, key) {
  const bag = card.metrics || {};
  if (Object.prototype.hasOwnProperty.call(bag, key)) return bag[key];
  return card[key];
}

function productView(c) {
  const p = c.product;
  if (!p || typeof p !== "object") {
    return c.product_missing_label ? { missing: c.product_missing_label } : null;
  }
  const title = p.title || p.name || "";
  if (!title && !p.id) {
    return { missing: c.product_missing_label || p.missing || "Producto sin identificar" };
  }
  const line = p.line || [p.price, p.commission].filter((x) => x != null && x !== "").join(" · ");
  return {
    id: p.id,
    title: title || c.product_missing_label || "Producto sin identificar",
    line,
    image: asMedia(p.image, "image"),
  };
}

function card(store, c, i) {
  const want = loadWant(store.feedBlob || store.rootBlob);
  const product = productView(c);
  const pid = product && product.id;
  const wanted = pid && want[pid];
  const cover = asMedia(c.cover, "image");
  const preview = asMedia(c.preview, "video");
  const tt = safeTikTokUrl(c.url || c.href);
  const hook = c.hook || c.caption || "";
  return html`<article class="feed-card" data-i="${i}">
    <div class="feed-media">
      ${cover && cover.enc
        ? html`<img class="feed-cover" alt="" hidden data-enc="${cover.src}" data-mime="${cover.mime}">`
        : typeof cover === "string"
          ? html`<img class="feed-cover" alt="" src="${cover}">`
          : html`<div class="feed-cover ph"></div>`}
      ${preview && preview.enc
        ? html`<video class="feed-preview" hidden muted playsinline loop preload="metadata" data-enc="${preview.src}" data-mime="${preview.mime}"></video>`
        : raw("")}
    </div>
    <div class="feed-scrim"></div>
    <div class="feed-copy">
      <div class="feed-creator">${c.creator || c.handle || ""}</div>
      ${hook ? html`<div class="feed-hook">${hook}</div>` : raw("")}
      ${product ? productPill(product) : raw("")}
      ${tt ? html`<a class="feed-tt" href="${tt}" target="_blank" rel="noopener noreferrer">${t("fed.openTt")}</a>` : raw("")}
      ${pid ? html`<button type="button" class="want" data-act="want:${pid}">${wanted ? t("fed.wanted") : t("fed.want")}</button>` : raw("")}
    </div>
    <div class="feed-rail">
      ${metric("eye", metricValue(c, "views"))}
      ${metric("heart", metricValue(c, "likes"))}
      ${metric("message-circle", metricValue(c, "comments"))}
      ${metric("repeat-2", metricValue(c, "shares"))}
      ${metric("bookmark", metricValue(c, "saves"))}
      <button class="icon-btn" data-act="note-feed:${c.id || i}">${icon("message-square-text")}</button>
    </div>
  </article>`;
}

function productPill(p) {
  if (p.missing) return html`<div class="feed-pill">${icon("shopping-cart", { size: 14 })} ${p.missing}</div>`;
  const img = p.image && p.image.enc
    ? html`<img alt="" hidden width="40" height="40" data-enc="${p.image.src}" data-mime="${p.image.mime}">`
    : raw("");
  return html`<button type="button" class="feed-pill" data-act="product-pill:${p.id || ""}">
    ${img}
    <span class="feed-pill-txt">
      <span class="feed-pill-title">${p.title}</span>
      ${p.line ? html`<span class="feed-pill-line">${p.line}</span>` : raw("")}
    </span>
  </button>`;
}

function metric(name, n) {
  const label = n == null || n === "" ? "—" : compactCount(n);
  return html`<div class="metric">${icon(name, { size: 22 })}<div>${label}</div></div>`;
}
