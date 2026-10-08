import { html, raw } from "../html.js";
import { t } from "../copy.js";
import { icon } from "../icons.js";
import { StatusChip, Thumb, EmptyState, InitialAvatar, Banner } from "../components.js";
import { session as sessionOf, job as jobOf } from "../status.js";
import { dayLabel, expiryLabel } from "../dates.js";
import { laneLabel } from "../lanes.js";

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
        ${Thumb({ src: j.thumb && store.model.thumbs?.[j.thumb], size: 40 })}
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
