import { html, raw } from "./html.js";
import { t } from "./copy.js";
import { icon } from "./icons.js";
import { SayBox, DoLine, FileButton, ProgressBar, StatusChip } from "./components.js";
import { take as takeOf } from "./status.js";
import { asMedia, thumbSrc, cleanMultiline, txt } from "./core.js";
import { dayLabel, expiryLabel } from "./dates.js";

export function normalizeBoard(scene) {
  if (!scene) return null;
  const products = scene.type === "portal" ? (scene.products || []) : [scene];
  return {
    type: scene.type,
    version: scene.version || 1,
    id: scene.id,
    job: scene.job,
    name: txt(scene.name || scene.creatorName, 60),
    creatorName: txt(scene.creatorName, 40),
    shootDate: scene.shootDate,
    expiresAt: scene.expiresAt,
    thumb: asMedia(scene.thumb, "image"),
    lane: scene.lane,
    status: scene.status,
    refSrc: asMedia(scene.refSrc, "video"),
    beats: (scene.beats || []).map((b) => ({
      shot: Number(b.shot) || 0,
      vo: txt(b.vo, 400),
      do_es: txt(b.do_es, 500),
      refFrame: asMedia(b.refFrame, "image"),
      ourFrame: asMedia(b.ourFrame, "image"),
    })),
    script: cleanMultiline(scene.script, 20000),
    shots: (scene.shots || []).map((s) => ({ shot: Number(s.shot) || 0, takes: Number(s.takes || s.takesPerShot || 1) })),
    approvals: scene.approvals || null,
    mailbox: scene.mailbox,
    apiBase: scene.apiBase,
    products: products.map((p) => ({
      id: txt(p.id || p.job || scene.job, 16),
      name: txt(p.name, 48),
      thumb: asMedia(p.thumb, "image"),
      status: p.status,
      script: cleanMultiline(p.script, 20000),
      beats: p.beats,
      shots: p.shots,
      refSrc: asMedia(p.refSrc, "video"),
      blob: p.blob,
    })),
    raw: scene,
  };
}

export function renderBoard(board, { role = "viewer", live, uploads = {}, product } = {}) {
  const p = product || board;
  const beats = p.beats || board.beats || [];
  const shots = p.shots || board.shots || inferShots(beats);
  const approvals = board.approvals;
  return html`
    ${p.refSrc || board.refSrc ? html`<section class="section">
      <h2 class="section-h">${icon("film", { size: 16 })} ${t("board.ref")}</h2>
      <button class="card" style="width:100%;aspect-ratio:9/16;max-height:70vh;position:relative;background:var(--surface-pressed)" data-act="play-ref">
        <span class="icon-tile" style="position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);width:64px;height:64px;border-radius:99px;background:var(--primary);color:#fff">${icon("play", { size: 28 })}</span>
        <div style="position:absolute;left:0;right:0;bottom:16px;text-align:center;font-weight:600">${t("board.play")}</div>
      </button>
    </section>` : raw("")}
    <section class="section">
      <h2 class="section-h">${icon("list-ordered", { size: 16 })} ${t("board.scenes")}</h2>
      <div style="display:flex;gap:6px;overflow:auto;padding-bottom:8px">
        ${beats.map((b, i) => html`<button class="filter-chip" data-act="jump-scene:${i}">${i + 1}</button>`)}
      </div>
      ${beats.map((b, i) => sceneCard(b, i, beats.length))}
    </section>
    ${p.script || board.script ? html`<section class="section">
      <h2 class="section-h">${icon("file-text", { size: 16 })} ${t("board.script")}</h2>
      <div class="card" style="padding:16px">
        <pre class="script-block" style="white-space:pre-wrap;margin:0;font:15px/22px inherit;max-height:9.5em;overflow:hidden">${p.script || board.script}</pre>
        <button class="btn tertiary" data-act="script-expand">${t("board.seeAll")}</button>
        <button class="btn secondary md" data-act="copy-script">${icon("copy", { size: 16 })} ${t("board.copyScript")}</button>
      </div>
    </section>` : raw("")}
    ${approvals && approvals.length
      ? html`<section class="section"><h2 class="section-h">${t("up.approve")}</h2>
        ${approvals.map((a) => html`<div class="card" style="padding:12px;margin-bottom:8px">
          <div class="list-title">${a.label}</div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn primary md" data-act="go:${a.id}">${t("up.go")}</button>
            <button class="btn secondary md" data-act="changes:${a.id}">${t("up.changes")}</button>
          </div>
        </div>`)}</section>`
      : (role === "owner" || role === "creator") ? uploadSection(p, board, live, uploads, role) : raw("")}
  `;
}

function inferShots(beats) {
  return beats.map((b) => ({ shot: b.shot || 1, takes: 1 }));
}

function sceneCard(b, i, total) {
  return html`<article class="card" style="padding:12px;margin-bottom:12px" data-scene="${i}">
    <div class="list-meta">${t("board.sceneN", { n: i + 1, total })}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0">
      ${frame(b.refFrame, t("board.refCap"), i, "ref")}
      ${frame(b.ourFrame, t("board.oursCap"), i, "our")}
    </div>
    ${SayBox({ text: b.vo })}
    ${DoLine({ text: b.do_es })}
  </article>`;
}

function frame(media, cap, i, which) {
  const src = media && (typeof media === "string" ? media : "");
  return html`<button type="button" data-act="frame:${i}:${which}" style="background:none;padding:0;text-align:left;position:relative">
    <span class="frame-9x16">
      ${src ? html`<img class="thumb" alt="" src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`
        : html`<span class="thumb ph" data-enc="${media && media.src || ""}" style="width:100%;height:100%;border-radius:12px;display:block"></span>`}
      <span class="safe-zone" aria-hidden="true"><span class="safe45-label">${t("board.safe")}</span></span>
    </span>
    <div class="cap list-meta">${cap}</div>
  </button>`;
}

function uploadSection(p, board, live, uploads, role) {
  const job = p.id || board.job;
  const shots = p.shots || board.shots || [{ shot: 1, takes: 1 }];
  const takes = (live && live.takes) || [];
  return html`<section class="section">
    <h2 class="section-h">${icon("upload", { size: 16 })} ${t("up.section")}</h2>
    <p class="hint list-meta">${t("up.hint")}</p>
    <p class="hint list-meta" data-stay hidden>${role === "creator" ? t("up.stay.portal") : t("up.stay")}</p>
    <div class="card" style="padding:8px 16px">
      ${shots.flatMap((s) => Array.from({ length: s.takes || 1 }, (_, i) => takeRow(job, s.shot, i + 1, takes, uploads, role)))}
    </div>
  </section>`;
}

function takeRow(job, shot, take, liveTakes, uploads, role) {
  const key = `${job}:${shot}:${take}`;
  const live = liveTakes.find((x) => x.job_id === job && Number(x.shot) === Number(shot) && Number(x.take) === Number(take));
  const up = uploads[key];
  let state = "missing";
  if (up && up.progress != null && up.progress < 1) state = up.paused ? "paused" : "uploading";
  else if (live) state = live.status === "uploaded" || live.status === "approved" || live.status === "redo" || live.status === "pulled" ? live.status : "uploaded";
  const st = takeOf({ id: state, pct: up && up.progress }, role === "owner" ? "approver" : "creator");
  const closed = ["uploaded", "approved", "pulled"].includes(state) && state !== "redo";
  const shotPad = String(shot).padStart(2, "0");
  return html`<div class="list-row" data-take="${key}" style="flex-wrap:wrap">
    <div style="color:var(--${st.tone})">${icon(st.icon, { size: 28 })}</div>
    <div class="list-body">
      <div class="list-title">${t("up.take", { shot: shotPad, take })}</div>
      <div class="list-meta" style="color:var(--${st.tone})">${st.label}</div>
      ${live && live.redo_reason ? html`<div class="banner warn" style="margin:8px 0">${t("up.redoBanner", { reason: live.redo_reason })}</div>` : raw("")}
      ${state === "uploading" ? ProgressBar({ value: up?.progress || 0 }) : raw("")}
    </div>
    ${!closed && state !== "paused" ? FileButton({ label: t("up.button"), key, act: "upload" }) : raw("")}
    ${state === "paused" ? html`<button class="btn secondary lg full" data-act="resume:${key}">${t("up.resume")}</button>` : raw("")}
  </div>`;
}

function portalMeta(scene, now = new Date()) {
  if (scene.shootDate && scene.expiresAt) {
    const exp = new Date(scene.expiresAt);
    const expDay = Number.isNaN(+exp) ? "" : dayLabel(exp.toISOString().slice(0, 10), { now });
    return t("por.meta", { shoot: dayLabel(scene.shootDate, { now }), exp: expDay });
  }
  const n = (scene.products || []).length;
  return t("por.nProducts", { n });
}

export function portalPlp(scene, live) {
  const name = scene.creatorName || scene.name || "";
  return html`<h1 style="font-size:28px;font-weight:700;margin:0 0 8px">${t("por.hi", { name })}</h1>
    <p class="list-meta" data-por-meta>${portalMeta(scene)}</p>
    ${!(scene.products || []).length ? html`<p class="empty">${t("empty.portal.title")}</p>` : raw("")}
    <div class="card">${(scene.products || []).map((p) => {
      const st = takeOf({ id: mapPortalStatus(p.status, live, p.id) }, "creator");
      return html`<button type="button" class="list-row" data-act="open-pdp:${p.id}">
        ${p.thumb && typeof p.thumb === "string" ? html`<img class="thumb" alt="" src="${p.thumb}" style="width:48px;height:48px;border-radius:12px">` : html`<span class="thumb ph" style="width:48px;height:48px;border-radius:12px"></span>`}
        <div class="list-body"><div class="list-title">${p.name}</div></div>
        ${StatusChip({ tone: st.tone, icon: st.icon, label: st.label })}
        <span class="btn secondary md">${t("por.seeBoard")}</span>
      </button>`;
    })}</div>`;
}

function mapPortalStatus(status, live, job) {
  const j = ((live && live.jobs) || []).find((x) => x.job_id === job);
  const s = (j && j.status) || status || "sent";
  if (s === "sent" || s === "opened") return "missing";
  return s;
}
