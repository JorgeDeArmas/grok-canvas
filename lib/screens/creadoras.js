import { html, raw } from "../html.js";
import { t } from "../copy.js";
import { icon } from "../icons.js";
import { StatusChip, Thumb, EmptyState, InitialAvatar, Banner } from "../components.js";
import { session as sessionOf, job as jobOf } from "../status.js";
import { dayLabel, expiryLabel } from "../dates.js";
import { laneLabel } from "../lanes.js";
import { asMedia, thumbSrc } from "../core.js";

export function mergeSessions(model, live) {
  const scene = (model.creators || []).filter((c) => c.kind !== "owner");
  const liveMap = Object.fromEntries(((live && live.sessions) || []).filter((s) => s.kind !== "owner").map((s) => [s.id, s]));
  const ids = new Set([...scene.map((c) => c.id), ...Object.keys(liveMap)]);
  const out = [];
  for (const id of ids) {
    const s = scene.find((c) => c.id === id) || {};
    const l = liveMap[id] || {};
    out.push({
      ...s, ...l,
      id: s.id || l.id,
      creatorName: s.creatorName || l.creator_name,
      shootDate: s.shootDate || l.shoot_date,
      expiresAt: s.expiresAt || l.expires_at,
      revoked: !!(s.revoked || l.revoked_at),
      revoked_at: l.revoked_at || s.revoked_at,
      jobs: unionJobs(s.jobs, l.jobs),
      takes: l.takes || s.takes || [],
      link: s.link,
      kind: l.kind || s.kind || "creator",
    });
  }
  return out.filter((s) => s.kind !== "owner");
}

function unionJobs(a = [], b = []) {
  const map = {};
  for (const j of [...a, ...b]) map[j.job_id || j.id] = { ...map[j.job_id || j.id], ...j };
  return Object.values(map);
}

export function creadorasBadge(store) {
  if (!store.model?.managerToken) return 0;
  const list = mergeSessions(store.model, store.live);
  const now = store.now || new Date();
  let n = 0;
  for (const s of list) {
    if (s.revoked) continue;
    n += (s.takes || []).filter((t) => t.status === "uploaded").length;
    const st = sessionOf(s, now);
    if (st.id === "expiring" && /vence hoy/i.test(st.label)) {
      if ((s.jobs || []).some((j) => j.status !== "approved")) n += 1;
    }
  }
  return n;
}

export function render(store) {
  const list = mergeSessions(store.model, store.live);
  const now = store.now || new Date();
  const active = list.filter((s) => !s.revoked && sessionOf(s, now).id !== "expired");
  const past = list.filter((s) => s.revoked || sessionOf(s, now).id === "expired");
  const can = !!store.model.managerToken;
  return html`
    ${store.creadorasError ? Banner({ tone: "warn", icon: "triangle-alert", text: t("banner.creadoras.failed"), cta: t("status.retry"), ctaAct: "retry-creadoras" }) : raw("")}
    ${store.offline ? Banner({ tone: "neutral", icon: "wifi-off", text: t("banner.creadoras.offline") }) : raw("")}
    ${!can ? Banner({ tone: "info", icon: "info", text: t("cre.readonly") }) : raw("")}
    ${!active.length ? EmptyState({ icon: "users", tone: "accent", title: t("empty.creadoras.title"), body: t("empty.creadoras.body") }) : raw("")}
    ${active.map((s) => sessionCard(store, s, can, now))}
    ${past.length ? html`<button class="see-more" data-act="toggle-past">${t("cre.past")}</button>` : raw("")}
    ${store.pastOpen ? past.map((s) => sessionCard(store, s, can, now)) : raw("")}
  `;
}

function foldName(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Exact, or a shared prefix. Job names are cut at 48 characters and listing titles at 60. */
function namesMatch(a, b) {
  const x = foldName(a);
  const y = foldName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length <= y.length ? x : y;
  const long = x.length <= y.length ? y : x;
  return short.length >= 12 && long.startsWith(short);
}

function sameId(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  return !!x && x === y;
}

function imageFrom(value, thumbs, role) {
  if (value == null || value === "") return null;
  const direct = thumbSrc(value);
  if (direct) return { src: direct };
  if (typeof value === "string" && thumbs) {
    const via = thumbSrc(thumbs[value]);
    if (via) return { src: via };
    const mapped = asMedia(thumbs[value], "image");
    if (mapped && mapped.enc) return { enc: true, src: mapped.src, mime: mapped.mime, role };
  }
  const media = asMedia(value, "image");
  if (media && media.enc) return { enc: true, src: media.src, mime: media.mime, role };
  if (typeof media === "string" && media) return { src: media };
  return null;
}

function firstImage(values, thumbs, role) {
  for (const value of values) {
    const hit = imageFrom(value, thumbs, role);
    if (hit) return hit;
  }
  return null;
}

/**
 * Hub jobs are {job_id, name} with no photo. Listing thumbs are jpeg data URLs
 * keyed off the product, and board photos may be a jpeg or an encrypted file.
 * An encrypted hit is hydrated after render; otherwise the card keeps the grey placeholder.
 */
function jobThumb(store, j) {
  const model = store.model || {};
  const thumbs = model.thumbs || {};
  const own = firstImage(
    [j.thumb, j.image, j.cover, thumbs[j.job_id], j.product && thumbs[j.product]],
    thumbs,
    "root",
  );
  if (own) return own;
  const prod = (model.products || []).find((p) =>
    sameId(p.id, j.product) || sameId(p.id, j.product_id) || sameId(p.id, j.job_id) || namesMatch(p.name, j.name));
  if (prod) {
    const hit = firstImage([prod.thumb, thumbs[prod.id]], thumbs, "root");
    if (hit) return hit;
  }
  const video = (model.videos || []).find((v) =>
    namesMatch(v.productName, j.name) || namesMatch(v.title, j.name)
    || sameId(v.job, j.job_id) || sameId(v.product, j.job_id) || sameId(v.product, j.product));
  if (video) {
    const hit = firstImage([video.thumb, thumbs[video.product]], thumbs, "root");
    if (hit) return hit;
  }
  const data = store.boards || {};
  const boardThumbs = data.thumbs || {};
  const boardProducts = Object.entries(data.products || {}).map(([id, p]) => ({
    id, name: p && p.name, thumb: p && p.thumb,
  }));
  const listed = boardProducts.find((p) =>
    sameId(p.id, j.job_id) || sameId(p.id, j.product) || namesMatch(p.name, j.name));
  if (listed) {
    const hit = firstImage([listed.thumb, boardThumbs[listed.id]], boardThumbs, "boards");
    if (hit) return hit;
  }
  const board = (data.boards || []).find((b) =>
    sameId(b.product, j.job_id) || sameId(b.product, j.product) || sameId(b.id, j.job_id)
    || namesMatch(b.title, j.name) || namesMatch(b.name, j.name));
  if (!board) return "";
  const linked = boardProducts.find((p) => p.id === board.product);
  return firstImage(
    [board.thumb, linked && linked.thumb, boardThumbs[board.product]],
    boardThumbs,
    "boards",
  ) || "";
}

function jobThumbView(thumb) {
  if (thumb && thumb.enc) {
    return html`<img class="thumb" alt="" hidden width="40" height="40" data-enc="${thumb.src}" data-mime="${thumb.mime || "image/jpeg"}" data-key-role="${thumb.role || "root"}" style="width:40px;height:40px;border-radius:12px;object-fit:cover">`;
  }
  const src = thumb && thumb.src ? thumb.src : thumb || "";
  return Thumb({ src, size: 40 });
}

function sessionCard(store, s, can, now) {
  const st = sessionOf(s, now);
  const uploaded = (s.takes || []).filter((t) => t.status === "uploaded").length;
  return html`<article class="card" style="margin:12px 0;padding:12px 16px">
    <div class="list-row" style="padding:0">
      ${InitialAvatar({ name: s.creatorName })}
      <div class="list-body">
        <div class="list-title">${s.creatorName}</div>
        <div class="list-meta">${dayLabel(s.shootDate, { now })} · ${expiryLabel(s.expiresAt, now)}</div>
      </div>
      ${StatusChip({ tone: st.tone, icon: st.icon, label: st.label })}
    </div>
    ${(s.jobs || []).map((j) => {
      const js = jobOf(j.status || "sent", "approver");
      return html`<div class="list-row" style="padding:8px 0">
        ${jobThumbView(jobThumb(store, j))}
        <div class="list-body"><div class="list-title">${j.name || j.job_id}</div></div>
        ${StatusChip({ tone: js.tone, icon: js.icon, label: js.label })}
        ${j.board ? html`<button class="btn tertiary" data-act="creator-board:${s.id}:${j.job_id}">${t("cre.openBoard")}</button>` : raw("")}
      </div>`;
    })}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button class="btn secondary md" data-act="copy-link:${s.id}">${icon("copy", { size: 16 })} ${t("cre.copy")}</button>
      <button class="btn secondary md" data-act="share-link:${s.id}">${icon("share", { size: 16 })} ${t("cre.share")}</button>
      ${uploaded ? html`<button class="btn primary md" data-act="review:${s.id}">${t("cre.review")}</button>` : raw("")}
      ${can ? html`<button class="icon-btn" data-act="more-session:${s.id}" aria-label="${t("cre.more")}">${icon("ellipsis")}</button>` : raw("")}
    </div>
  </article>`;
}
