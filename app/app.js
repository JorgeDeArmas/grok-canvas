import { html, raw, setHtml } from "../lib/html.js";
import { t } from "../lib/copy.js";
import { icon } from "../lib/icons.js";
import { okHost, parseHash, hashIsKeys, copyText, share, classifyLink } from "../lib/core.js";
import { relativePast, clockTimeEt, expiryLabel, todayEt } from "../lib/dates.js";
import {
  importFromHash, importFromPastedText, decryptSceneFor, getKey, allKeys,
  forgetPhone, settings, saveSettings, pendingInstallLink, setPendingInstallLink,
} from "../lib/keyring.js";
import { enqueue, undo, retry as retryOut, listOutbox, pendingCount, oldestPendingAge, startLoop, sendNow, onOutbox, humanLabel } from "../lib/outbox.js";
import { adaptRoot, fromFilming, fromBoards, mergeFilming, loadDone, saveDone, loadPicks, savePicks, loadTicks, saveTicks, saveLane, loadLane, loadWant, saveWant, saveFeedAvatar, jorgeVideos } from "../lib/model.js";
import * as worker from "../lib/worker-api.js";
import { runUpload } from "../lib/upload.js";
import { AppBar, TabBar, Banner, toastHtml, Dialog, ErrorState, sheetChrome, Button, StatusChip, Thumb, InitialAvatar, SayBox } from "../lib/components.js";
import * as bienvenida from "../lib/screens/bienvenida.js";
import * as dashboard from "../lib/screens/dashboard.js";
import * as grabar from "../lib/screens/grabar.js";
import * as creadoras from "../lib/screens/creadoras.js";
import * as boards from "../lib/screens/boards.js";
import * as boardScreen from "../lib/screens/board-screen.js";
import * as feed from "../lib/screens/feed.js";
import * as ajustes from "../lib/screens/ajustes.js";
import * as note from "../lib/screens/note.js";
import { normalizeFeed } from "../lib/screens/feed.js";
import { grabarBadge } from "../lib/screens/grabar.js";
import { creadorasBadge } from "../lib/screens/creadoras.js";
import { VERSION } from "./version.js";

const TABS = ["dashboard", "grabar", "creadoras"];
const PUSH = new Set(["feed", "boards", "board", "ajustes", "bienvenida"]);
const store = {
  route: { name: "dashboard" },
  model: null,
  feed: null,
  boards: null,
  live: { sessions: [] },
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  now: new Date(),
  loading: true,
  settings: { theme: "auto", tabsWithFeed: false },
  rootBlob: "",
  single: false,
  overlay: null,
  toast: null,
  scroll: {},
};

const root = () => document.getElementById("app");
let typing = false;
let deferredPrompt = null;
let swReg = null;
let lastSwCheck = 0;
let memoryM = "";
let stripTimer = 0;

function standalone() {
  return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function applyTheme() {
  const mode = store.settings.theme || "auto";
  if (mode === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", mode);
  const dark = mode === "dark" || (mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') || document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", store.route.name === "feed" ? "#000000" : (dark ? "#000000" : "#F2F2F7"));
}

function parseRoute(hash) {
  const h = String(hash || "").replace(/^#/, "");
  if (!h || h === "/") return { name: "dashboard" };
  if (!h.startsWith("/")) return { name: "import", raw: h };
  const parts = h.split("/").filter(Boolean);
  const name = parts[0] || "dashboard";
  if (name === "grabar") return { name: "grabar", seg: parts[1] === "grabados" ? "grabados" : "todo" };
  if (name === "creadoras" && parts[1] && parts[2] === "tomas") return { name: "creadoras", sheet: "review", sid: parts[1] };
  if (name === "producto") return { name: "dashboard", sheet: "product", pid: parts[1] };
  if (name === "board") return { name: "board", id: parts.slice(1).join("/") };
  if (["dashboard", "creadoras", "feed", "boards", "ajustes", "bienvenida"].includes(name)) return { name, rest: parts.slice(1) };
  return { name: "dashboard" };
}

function setRoute(route, { replace = false, href } = {}) {
  store.route = route;
  const hash = href || routeToHash(route);
  if (replace) history.replaceState({ route }, "", hash);
  else if (location.hash !== hash.replace(/^[^#]*/, "") && hash.startsWith("#")) history.pushState({ route }, "", hash);
  render();
}

function routeToHash(r) {
  if (r.name === "grabar" && r.seg === "grabados") return "#/grabar/grabados";
  if (r.name === "creadoras" && r.sheet === "review") return `#/creadoras/${r.sid}/tomas`;
  if (r.name === "dashboard" && r.sheet === "product") return `#/producto/${r.pid}`;
  if (r.name === "board") return `#/board/${r.id}`;
  return `#/${r.name}`;
}

function showTabs() {
  if (store.single) return false;
  if (PUSH.has(store.route.name) || store.route.name === "bienvenida") return false;
  return !!store.model;
}

function tabItems() {
  const items = [
    { id: "dashboard", label: t("tab.dashboard"), icon: "layout-dashboard", badge: 0 },
    { id: "grabar", label: t("tab.grabar"), icon: "video", badge: grabarBadge(store) },
    { id: "creadoras", label: t("tab.creadoras"), icon: "users", badge: creadorasBadge(store) },
  ];
  if (store.settings.tabsWithFeed) items.push({ id: "feed", label: t("tab.feed"), icon: "play", badge: 0 });
  if (store.route.name === "dashboard") items[0].badge = 0;
  items.forEach((it) => { if (!it.badge) it.badge = 0; });
  return items;
}

function statusLine() {
  if (!store.model) return null;
  const parts = [];
  if (store.refreshing) parts.push(t("status.updating"));
  else if (!store.online) parts.push(t("status.offline"));
  else if (store.refreshError) parts.push(t("status.failed"));
  else if (store.model.updatedAt) {
    const age = Date.now() - Date.parse(store.model.updatedAt);
    if (age > 3 * 3600 * 1000) parts.push(t("status.stale", { time: clockTimeEt(store.model.updatedAt, store.now) }));
    else parts.push(t("status.updated", { ago: relativePast(store.model.updatedAt, store.now) }));
  }
  let extra = "";
  if (!store.online) extra += `<span class="chip neutral">${icon("wifi-off", { size: 14 }).__html} ${t("status.offline")}</span>`;
  if (store.outboxN && store.outboxAge > 10000) {
    extra += `<button class="chip warn" data-act="outbox">${icon("inbox", { size: 14 }).__html} ${t("status.outbox", { n: store.outboxN })}</button>`;
  }
  if (store.refreshError && store.online) extra += `<button class="banner-act" data-act="refresh">${t("status.retry")}</button>`;
  return { html: parts.join(" · ") + extra, warn: !!store.refreshError };
}

function banners() {
  const out = [];
  if (store.keyChanged) out.push(Banner({ tone: "warn", icon: "link-2-off", text: t("banner.keychanged"), cta: t("banner.keychanged.cta"), ctaAct: "paste" }));
  if (store.swWaiting) out.push(Banner({ tone: "info", icon: "refresh-cw", text: t("banner.update"), cta: t("banner.update.cta"), ctaAct: "sw-update" }));
  if (!store.online && store.model) out.push(Banner({ tone: "neutral", icon: "wifi-off", text: t("banner.offline", { ago: relativePast(store.cachedAt || store.model.updatedAt, store.now) }) }));
  if (!standalone() && store.model && !store.installDismissed && out.length < 2) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (ios) out.push(Banner({ tone: "accent", icon: "smartphone", text: t("banner.install.ios"), cta: t("banner.install.cta.ios"), ctaAct: "install-how", dismissible: true }));
    else if (deferredPrompt) out.push(Banner({ tone: "accent", icon: "smartphone", text: t("banner.install.other"), cta: t("banner.install.cta"), ctaAct: "install-native", dismissible: true }));
  }
  return out.slice(0, 2);
}

export function render() {
  applyTheme();
  if (typing) return;
  const el = root();
  if (!el) return;
  if (!okHost()) {
    setHtml(el, ErrorState({ icon: "link-2-off", title: t("err.host.title") }));
    return;
  }
  const r = store.route;
  if (r.name === "bienvenida" || (!store.model && !store.single && !store.loading && !store.bootError)) {
    setHtml(el, bienvenida.render(store));
    return;
  }
  if (store.bootError && !store.model) {
    const e = store.bootError;
    setHtml(el, ErrorState({
      icon: e === "offlineFirst" ? "wifi-off" : "triangle-alert",
      title: t(`err.${e}.title`), body: t(`err.${e}.body`),
      action: t("common.retry"), act: "retry",
    }));
    return;
  }
  const isTab = showTabs();
  const title = {
    dashboard: t("tab.dashboard"), grabar: t("tab.grabar"), creadoras: t("tab.creadoras"),
    feed: t("tab.feed"), boards: t("nav.boards"), board: store.board?.name || t("nav.boards"),
    ajustes: t("nav.settings"),
  }[r.name] || t("tab.dashboard");
  const actions = [];
  if (["dashboard", "grabar", "creadoras", "boards", "board"].includes(r.name) && !store.single) {
    actions.push({ act: "note", icon: "message-square-text", label: t("nav.note") });
  }
  if (r.name === "dashboard") actions.push({ act: "ajustes", icon: "settings", label: t("nav.settings"), iconOnly: true });
  if (r.name === "grabar") actions.push({ act: "go-boards", icon: "layout-grid", label: t("nav.boards") });
  const back = PUSH.has(r.name) && r.name !== "bienvenida" && !store.single;
  const body = screenBody(r);
  const chrome = html`
    ${isTab || back || r.name === "ajustes" || r.name === "boards" || r.name === "board" || r.name === "feed" ? AppBar({
      title, variant: isTab ? "large" : "compact", back, actions: r.name === "feed" ? [] : actions,
      status: isTab ? statusLine() : null, collapsed: store.collapsed,
    }) : raw("")}
    ${banners()}
    <div class="screen ${PUSH.has(r.name) ? "push" : ""}" id="screen">${body}</div>
    ${isTab ? TabBar({ items: tabItems(), current: r.name }) : raw("")}
    ${overlayHtml()}
    ${store.toast ? toastHtml(store.toast.msg, store.toast.undo) : raw("")}
  `;
  setHtml(el, chrome);
}

function screenBody(r) {
  if (r.name === "dashboard") return dashboard.render(store);
  if (r.name === "grabar") return grabar.render(store);
  if (r.name === "creadoras") return creadoras.render(store);
  if (r.name === "boards") return boards.render(store);
  if (r.name === "board") return boardScreen.render(store);
  if (r.name === "feed") return feed.render(store);
  if (r.name === "ajustes") return ajustes.render(store);
  return dashboard.render(store);
}

function overlayHtml() {
  if (!store.overlay) return raw("");
  if (store.overlay.kind === "note") return note.render(store);
  if (store.overlay.kind === "dialog") return Dialog(store.overlay);
  if (store.overlay.kind === "sheet") return store.overlay.html;
  if (store.overlay.kind === "outbox") return outboxSheet();
  if (store.overlay.kind === "review") return reviewSheet();
  if (store.overlay.kind === "scripts") return scriptsSheet();
  if (store.overlay.kind === "product") return productSheet();
  if (store.overlay.kind === "install") return installSheet();
  if (store.overlay.kind === "actions") return actionSheet(store.overlay.actions);
  return raw("");
}

function actionSheet(actions) {
  return html`<div class="scrim" data-act="sheet-close"></div>
    <div class="sheet" role="dialog">
      <div class="grabber"></div>
      ${actions.map((a) => html`<button class="list-row" data-act="${a.act}" style="${a.kind === "destructive" ? "color:var(--bad)" : ""}">${icon(a.icon, { size: 20 })} <div class="list-body"><div class="list-title">${a.label}</div></div></button>`)}
      <button class="btn secondary lg full" style="margin:12px" data-act="sheet-close">${t("common.cancel")}</button>
    </div>`;
}

function outboxSheet() {
  const rows = store.outboxRows || [];
  const pending = rows.filter((r) => r.state !== "sent");
  return sheetChrome({
    title: t("out.title"),
    body: html`
      <p class="list-meta">${store.online ? t("out.waiting", { n: pending.length }) : t("out.offline")}</p>
      ${pending.map((r) => html`<div class="list-row">
        <div class="list-body"><div class="list-title">${humanLabel(r)}</div><div class="list-meta">${r.state === "failed" ? t("out.failed") : relativePast(r.createdAt, store.now)}</div></div>
        ${r.state === "failed" ? html`<button class="btn tertiary" data-act="out-retry:${r.id}">${t("out.retry")}</button>` : raw("")}
      </div>`)}
    `,
    footer: store.online ? Button({ kind: "primary", size: "lg", full: true, label: t("out.sendNow"), act: "send-now" }) : html`<p class="list-meta">${t("out.offline")}</p>`,
  });
}

function reviewSheet() {
  const sid = store.route.sid || store.overlay.sid;
  const list = creadoras.mergeSessions(store.model, store.live);
  const s = list.find((x) => x.id === sid);
  const takes = (s?.takes || []).filter((t) => t.status === "uploaded" || store.reviewAll);
  return sheetChrome({
    title: t("rev.title"), full: true,
    body: !takes.length ? html`<p>${t("empty.review.title")}</p>` : html`${takes.map((tk) => html`<div class="card" style="padding:12px;margin-bottom:12px">
      <div class="list-title">${tk.job_id} · ${tk.shot}/${tk.take}</div>
      <video controls playsinline style="width:100%;border-radius:12px;background:#000;margin:8px 0" data-take-id="${tk.id}"></video>
      <div style="display:flex;gap:8px">
        <button class="btn success md" data-act="approve:${tk.id}">${t("rev.approve")}</button>
        <button class="btn destructive md" data-act="redo-ask:${tk.id}">${t("rev.redo")}</button>
      </div>
    </div>`)}`,
  });
}

function scriptsSheet() {
  const job = store.overlay.job;
  const pack = store.model.scripts?.[job];
  if (!pack) return sheetChrome({ title: t("act.pick"), body: html`<p>${t("err.generic.title")}</p>` });
  const opts = (pack.options || []).slice(0, 3);
  const letter = store.scriptLetter || pack.picked || pack.recommended || (opts[0] && opts[0].letter) || "A";
  const cur = opts.find((o) => o.letter === letter) || opts[0] || {};
  return sheetChrome({
    title: pack.product || job,
    subtitle: t("scr.pickOne", { n: opts.length }),
    full: true,
    leading: pack.thumb ? Thumb({ src: store.model.thumbs?.[pack.thumb], size: 44 }) : raw(""),
    body: html`
      <div class="seg" role="tablist">${opts.map((o) => html`<button role="tab" ${o.letter === letter ? raw('aria-selected="true"') : raw("")} data-act="script-tab" data-id="${o.letter}">${o.letter}${o.letter === pack.recommended ? " ★" : ""}</button>`)}</div>
      <h3 style="font-size:20px;font-weight:700">Guion ${cur.letter} · ${cur.focus || ""}</h3>
      ${SayBox({ text: cur.hook, compact: true })}
      ${(cur.beats || []).map((b) => html`<div style="margin:12px 0">
        <div style="color:var(--link);font-size:13px;font-variant-numeric:tabular-nums">${b.t || ""}</div>
        ${SayBox({ text: b.vo, compact: true })}
        ${b.visual ? html`<div class="do"><div class="d">${b.visual}</div></div>` : raw("")}
      </div>`)}
    `,
    footer: pack.changeable === false
      ? html`<p class="list-meta" style="color:var(--good)">${t("scr.locked", { letter: pack.picked || letter })}</p>`
      : Button({ kind: "primary", size: "lg", full: true, label: t("scr.pickThis", { letter }), act: "pick:" + letter }),
  });
}

function productSheet() {
  const p = (store.model.products || []).find((x) => x.id === store.route.pid);
  if (!p) return sheetChrome({ title: t("prd.all"), body: html`<p>${t("empty.products.title")}</p>` });
  const st = p.stage;
  return sheetChrome({
    title: p.name,
    body: html`<p class="list-meta">${p.now || ""}</p>
      ${(p.detail || []).map((d) => html`<div class="list-row"><div class="list-body"><div class="list-title">${d[0]}</div><div class="list-meta">${d[1]}</div></div></div>`)}`,
  });
}

function installSheet() {
  const iosOther = /CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
  return sheetChrome({
    title: t("ins.title"),
    body: html`
      <div class="list-row">${icon("share", { size: 22 })} <div class="list-body"><div class="list-title">1. ${iosOther ? t("ins.step1.other") : t("ins.step1")}</div></div></div>
      <div class="list-row">${icon("square-plus", { size: 22 })} <div class="list-body"><div class="list-title">2. ${t("ins.step2")}</div></div></div>
      <div class="list-row">${icon("clapperboard", { size: 22 })} <div class="list-body"><div class="list-title">3. ${t("ins.step3")}</div></div></div>
      <p class="list-meta">${t("ins.hint")}</p>
    `,
    footer: pendingInstallLink ? Button({ kind: "primary", size: "lg", full: true, icon: "copy", label: t("ins.copy"), act: "copy-install-link" }) : raw(""),
  });
}

function toast(msg, undoKey) {
  store.toast = { msg, undo: undoKey };
  clearTimeout(store.toastTimer);
  store.toastTimer = setTimeout(() => { store.toast = null; render(); }, undoKey ? 6000 : 5000);
  render();
}

async function handleAct(act, el, ev) {
  if (!act) return;
  const [name, ...rest] = act.split(":");
  const arg = rest.join(":");
  if (name === "back") {
    if (history.state && history.length > 1) history.back();
    else setRoute({ name: store.route.name === "ajustes" ? "dashboard" : store.route.name === "board" ? "boards" : "dashboard" }, { replace: true });
    return;
  }
  if (name === "refresh") { await refreshRoot(); return; }
  if (name === "note") { store.overlay = { kind: "note" }; history.pushState({ sheet: "note" }, "", location.href); render(); return; }
  if (name === "sheet-close" || name === "cancel") { closeOverlay(); return; }
  if (name === "ajustes") { setRoute({ name: "ajustes" }); return; }
  if (name === "go-grabar") { setRoute({ name: "grabar" }); return; }
  if (name === "go-feed") {
    if (!store.hasFeedKey && !store.feed) { toast(t("toast.feedNeedLink")); return; }
    setRoute({ name: "feed" }); return;
  }
  if (name === "go-boards") { setRoute({ name: "boards" }); return; }
  if (name === "go-review") { setRoute({ name: "creadoras", sheet: "review", sid: arg }); store.overlay = { kind: "review", sid: arg }; render(); return; }
  if (name === "tab" || el?.dataset.tab) {
    const id = el.dataset.tab;
    if (id === store.route.name) { document.getElementById("screen")?.scrollTo(0, 0); return; }
    setRoute({ name: id }); return;
  }
  if (name === "paste") { await doPaste(); return; }
  if (name === "open-typed") { await doTyped(); return; }
  if (name === "task") { await doTask(arg); return; }
  if (name === "task-body") { openTask(arg); return; }
  if (name === "product") { setRoute({ name: "dashboard", sheet: "product", pid: arg }); store.overlay = { kind: "product" }; render(); return; }
  if (name === "grabar-seg") { setRoute({ name: "grabar", seg: el.dataset.id === "grabados" ? "grabados" : "todo" }); return; }
  if (name === "tick") { await doTick(arg); return; }
  if (name === "open-board") { openVideoBoard(arg); return; }
  if (name === "open-lib-board") { openLibBoard(arg); return; }
  if (name === "boards-lane") { store.boardsLane = el.dataset.id; saveLane(el.dataset.id); render(); return; }
  if (name === "feed-lane") { store.feedLane = el.dataset.id; saveFeedAvatar(el.dataset.id); render(); return; }
  if (name === "theme") { store.settings = await saveSettings({ theme: el.dataset.id }); applyTheme(); render(); return; }
  if (name === "copy-link") { await copySession(arg); return; }
  if (name === "share-link") { await shareSession(arg); return; }
  if (name === "more-session") { moreSession(arg); return; }
  if (name === "extend") { await doExtend(arg); return; }
  if (name === "revoke") { confirmRevoke(arg); return; }
  if (name === "confirm-revoke") { await doRevoke(arg); return; }
  if (name === "review") { store.overlay = { kind: "review", sid: arg }; history.pushState({ sheet: "review" }, "", `#/creadoras/${arg}/tomas`); render(); return; }
  if (name === "approve") { await doApprove(arg); return; }
  if (name === "redo-ask") { askRedo(arg); return; }
  if (name === "confirm-redo") { await doRedo(arg); return; }
  if (name === "forget") { confirmForget(); return; }
  if (name === "confirm-forget") { await doForget(); return; }
  if (name === "note-send") { await sendNote(); return; }
  if (name === "outbox") { store.outboxRows = await listOutbox(); store.overlay = { kind: "outbox" }; history.pushState({ sheet: "outbox" }, "", location.href); render(); return; }
  if (name === "send-now") { await sendNow(() => outboxCtx()); store.outboxRows = await listOutbox(); toast(t("toast.done")); render(); return; }
  if (name === "out-retry") { await retryOut(Number(arg)); store.outboxRows = await listOutbox(); render(); return; }
  if (name === "undo") { if (store.toast?.undo) await undo(store.toast.undo); store.toast = null; render(); return; }
  if (name === "pick") { await doPick(arg); return; }
  if (name === "script-tab") { store.scriptLetter = el.dataset.id; render(); return; }
  if (name === "want") { await doWant(arg); return; }
  if (name === "copy-script") { await copyText(store.board?.script || ""); toast(t("toast.copied.script")); return; }
  if (name === "copy-install-link") { await copyText(pendingInstallLink); toast(t("toast.copied.link")); return; }
  if (name === "install-how") { store.overlay = { kind: "install" }; history.pushState({ sheet: "install" }, "", location.href); render(); return; }
  if (name === "install-native" && deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; render(); return; }
  if (name === "banner-dismiss") { store.installDismissed = true; await saveSettings({ installDismissedAt: Date.now() }); render(); return; }
  if (name === "sw-update") { skipWaiting(); return; }
  if (name === "force-update") { await refreshRoot(); if (swReg) swReg.update(); toast(t("status.updating")); return; }
  if (name === "todo-more") { store.todoOpen = true; render(); return; }
  if (name === "products-all") { store.overlay = { kind: "sheet", html: productListSheet() }; render(); return; }
  if (name === "brands") { store.overlay = { kind: "sheet", html: brandsSheet(arg) }; render(); return; }
  if (name === "retry") { boot(); return; }
  if (name === "toggle-past") { store.pastOpen = !store.pastOpen; render(); return; }
  if (name === "upload" && ev?.target?.files?.[0]) { await doUpload(el, ev.target.files[0]); return; }
}

function productListSheet() {
  const products = store.model.products || [];
  return sheetChrome({
    title: t("prd.all"),
    body: html`${products.map((p) => html`<button class="list-row" data-act="product:${p.id}"><div class="list-title">${p.name}</div></button>`)}`,
  });
}

function brandsSheet(id) {
  const g = (store.model.brands?.groups || []).find((x) => x.id === id);
  return sheetChrome({
    title: g?.label || t("mar.title"),
    body: html`${(g?.items || []).map((it) => html`<div class="list-row"><div class="list-body"><div class="list-title">${it.title}</div><div class="list-meta">${it.meta || ""}</div></div></div>`)}
      ${!(g?.items || []).length ? html`<p>${t("empty.brands.title")}</p>` : raw("")}`,
  });
}

function closeOverlay() {
  store.overlay = null;
  if (store.route.sheet) {
    if (store.route.name === "creadoras") setRoute({ name: "creadoras" }, { replace: true });
    else setRoute({ name: "dashboard" }, { replace: true });
  } else render();
}

async function doPaste() {
  store.onbBusy = true; render();
  try {
    const text = await navigator.clipboard.readText();
    const r = await importFromPastedText(text);
    await afterImport(r);
  } catch {
    store.onbHold = true; store.onbBusy = false; render();
    document.getElementById("onb-text")?.focus();
  }
}

async function doTyped() {
  const text = store.onbText || document.getElementById("onb-text")?.value || "";
  store.onbBusy = true; render();
  const r = await importFromPastedText(text);
  await afterImport(r);
}

async function afterImport(r) {
  store.onbBusy = false;
  if (!r.ok) { store.onbError = r.error; render(); return; }
  if (r.strip) history.replaceState(null, "", location.pathname + "#/dashboard");
  store.route = { name: "dashboard" };
  await loadRoot();
}

async function doTask(id) {
  const task = (store.model.tasks || []).find((x) => x.id === id);
  if (!task || store.keyChanged) return;
  const a = task.action || { type: "done" };
  if (a.type === "scripts") { store.overlay = { kind: "scripts", job: a.scripts || task.open?.scripts }; store.scriptLetter = null; history.pushState({ sheet: "scripts" }, "", location.href); render(); return; }
  if (a.type === "route") { setRoute({ name: a.route || "feed" }); return; }
  if (a.type === "mail") { openMail(task); return; }
  if (a.type === "link" && a.href) { window.open(a.href, "_blank", "noopener,noreferrer"); return; }
  if (a.type === "board") { setRoute({ name: "board", id: a.id }); return; }
  const done = loadDone(store.rootBlob);
  done[task.id] = Date.now();
  saveDone(store.rootBlob, done);
  const ck = `approve:${a.type === "act" ? a.id : task.id}`;
  await enqueue({
    channel: "hub", kind: "approve",
    payload: { kind: "approve", blockId: a.type === "act" ? a.id : task.id, choice: "done" },
    coalesceKey: ck, grace: true,
  });
  toast(t("toast.done"), ck);
  render();
}

function openTask(id) {
  const task = (store.model.tasks || []).find((x) => x.id === id);
  if (!task) return;
  if (task.action?.type === "scripts") return doTask(id);
  store.overlay = { kind: "sheet", html: sheetChrome({ title: task.title, body: html`<p>${task.meta || ""}</p>` }) };
  render();
}

function openMail(task) {
  const mail = task.mail || task.action?.mail || {};
  store.overlay = { kind: "sheet", html: sheetChrome({
    title: task.title,
    body: html`<p>${mail.subject || ""}</p>`,
    footer: html`<a class="btn primary lg full" href="${mail.web || "https://mail.google.com"}" target="_blank" rel="noopener noreferrer">${t("mail.open")}</a>
      <button class="btn secondary lg full" data-act="copy-search">${t("mail.copy")}</button>`,
  }) };
  store.copySearch = mail.search || "";
  render();
}

async function doTick(id) {
  const blob = store.filmBlob || store.rootBlob;
  const map = loadTicks(blob);
  const cur = Array.isArray(map[id]) ? map[id][0] : (store.model.ticks?.[id]?.[0] || 0);
  const next = cur ? 0 : 1;
  map[id] = [next, Date.now()];
  saveTicks(blob, map);
  await enqueue({
    channel: "hub", kind: "ticks",
    payload: { kind: "ticks", v: 2, set: { [id]: map[id] } },
    coalesceKey: "ticks",
  });
  toast(next ? t("toast.filmed") : t("toast.unfilmed"), "ticks");
  render();
}

function openVideoBoard(id) {
  const v = jorgeVideos(store.model).find((x) => x.id === id);
  if (v?.boardRef?.b) { setRoute({ name: "board", id: "v:" + id }); loadBoard(v.boardRef); return; }
  if (v?.href) window.open(v.href, "_blank", "noopener,noreferrer");
}

function openLibBoard(id) {
  const b = (store.boards?.boards || []).find((x) => x.id === id);
  if (!b) return;
  if (b.missing) return;
  if (b.viewer === "canvas" && b.ref) {
    window.open(`../index.html#b=${b.ref.b}&k=${b.ref.k}`, "_blank", "noopener,noreferrer");
    return;
  }
  setRoute({ name: "board", id });
  if (b.ref) loadBoard(b.ref);
}

async function loadBoard(ref) {
  try {
    const { decryptScene, fetchScene } = await import("../lib/core.js");
    const blob = await fetchScene(ref.b);
    store.board = await decryptScene(blob, ref.k);
    store.boardRole = store.model?.ownerToken ? "owner" : "viewer";
    render();
  } catch {
    store.board = null; render();
  }
}

async function copySession(id) {
  const s = creadoras.mergeSessions(store.model, store.live).find((x) => x.id === id);
  if (!s?.link) return;
  const ok = await copyText(s.link);
  toast(ok ? t("toast.copied.link") : t("toast.copyFailed"));
}

async function shareSession(id) {
  const s = creadoras.mergeSessions(store.model, store.live).find((x) => x.id === id);
  if (!s?.link) return;
  const r = await share({ url: s.link });
  if (r === "copied") toast(t("toast.copied.link"));
}

function moreSession(id) {
  store.overlay = { kind: "actions", actions: [
    { label: t("cre.extend"), icon: "calendar-plus", act: "extend:" + id },
    { label: t("cre.revoke"), icon: "ban", act: "revoke:" + id, kind: "destructive" },
    { label: t("cre.newLink"), icon: "message-square-text", act: "note" },
  ] };
  render();
}

async function doExtend(id) {
  if (!store.online) { toast(t("toast.needOnline")); return; }
  try {
    const r = await worker.extendSession(store.model.portalApi, store.model.managerToken, id, 3);
    toast(t("toast.extended", { when: expiryLabel(r.expires_at, store.now) }));
    await refreshLive();
  } catch { toast(t("toast.actionFailed")); }
}

function confirmRevoke(id) {
  const s = creadoras.mergeSessions(store.model, store.live).find((x) => x.id === id);
  store.overlay = { kind: "dialog", title: t("cre.revokeTitle", { name: s?.creatorName || "" }), body: t("cre.revokeBody"), confirmLabel: t("cre.revokeCta"), confirmAct: "confirm-revoke:" + id };
  render();
}

async function doRevoke(id) {
  try {
    await worker.revokeSession(store.model.portalApi, store.model.managerToken, id);
    toast(t("toast.revoked"));
    closeOverlay();
    await refreshLive();
  } catch { toast(t("toast.actionFailed")); }
}

async function doApprove(id) {
  if (!store.online) { toast(t("toast.needOnline")); return; }
  try {
    await worker.approveTake(store.model.portalApi, store.model.managerToken, id);
    toast(t("toast.approved"));
    await refreshLive();
  } catch { toast(t("toast.actionFailed")); }
}

function askRedo(id) {
  store.overlay = { kind: "dialog", title: t("rev.redoTitle"), body: t("rev.redoHint"), confirmLabel: t("rev.redoCta"), confirmAct: "confirm-redo:" + id };
  store.redoId = id;
  render();
}

async function doRedo(id) {
  try {
    await worker.redoTake(store.model.portalApi, store.model.managerToken, id, "");
    toast(t("toast.redo"));
    closeOverlay();
    await refreshLive();
  } catch { toast(t("toast.actionFailed")); }
}

function confirmForget() {
  let body = t("aju.forgetBody");
  if (store.outboxN) body += " " + t("aju.forgetOutbox", { n: store.outboxN });
  store.overlay = { kind: "dialog", title: t("aju.forgetTitle"), body, confirmLabel: t("aju.forgetCta"), confirmAct: "confirm-forget" };
  render();
}

async function doForget() {
  await forgetPhone();
  store.model = null; store.feed = null; store.boards = null; store.keys = [];
  store.overlay = null;
  setRoute({ name: "bienvenida" }, { replace: true });
}

async function sendNote() {
  const ctx = store.noteContext;
  const text = (ctx ? `«${ctx}»: ` : "") + (store.noteText || "");
  await enqueue({ channel: store.route.name === "feed" ? "feed" : "hub", kind: "note", payload: { kind: "note", text } });
  store.noteText = ""; store.overlay = null;
  toast(store.online ? t("toast.noteSent") : t("toast.noteQueued"));
  render();
}

async function doPick(letter) {
  const job = store.overlay.job;
  const picks = loadPicks(store.rootBlob);
  picks[job] = { letter, at: Date.now() };
  savePicks(store.rootBlob, picks);
  const ck = `pick:${job}`;
  await enqueue({ channel: "hub", kind: "pick", payload: { kind: "pick", v: 1, job, letter }, coalesceKey: ck, grace: true });
  toast(t("toast.picked", { letter }), ck);
  closeOverlay();
}

async function doWant(pid) {
  const blob = store.feedBlob || store.rootBlob;
  const map = loadWant(blob);
  map[pid] = Date.now();
  saveWant(blob, map);
  const ck = `want:want:${pid}`;
  await enqueue({ channel: "feed", kind: "approve", payload: { kind: "approve", blockId: "want:" + pid, choice: "want" }, coalesceKey: ck, grace: true });
  toast(t("toast.want"), ck);
  render();
}

async function doUpload(el, file) {
  const key = el.getAttribute?.("data-file") || el.dataset?.file;
  if (!key) return;
  store.uploading = true;
  try {
    await runUpload({
      dbName: store.route.name === "board" ? "owner-uploads" : "portal-uploads",
      key, file, base: store.model.portalApi, token: store.model.ownerToken,
      onProgress: () => {},
    });
    toast(t("toast.uploadDone"));
  } catch (e) {
    toast(t(e.code === "onlyVideo" ? "up.onlyVideo" : e.status === 403 ? "up.inactive" : "up.startFailed"));
  }
  store.uploading = false;
}

function outboxCtx() {
  return { model: store.model, feedF: store.feedF, boardMailbox: store.board?.mailbox };
}

async function loadRoot() {
  const row = await getKey("root");
  if (!row) {
    store.loading = false;
    if (!store.single) store.route = { name: "bienvenida" };
    render();
    return;
  }
  store.rootBlob = row.b;
  try {
    const { scene } = await decryptSceneFor("root");
    store.model = adaptRoot(scene);
    store.bootError = null;
    store.keyChanged = false;
    if (scene.keyring?.filming && await getKey("filming")) {
      try {
        const f = await decryptSceneFor("filming");
        store.model = mergeFilming(store.model, fromFilming(f.scene));
        store.filmBlob = f.row.b;
      } catch { /* keep v3 videos */ }
    }
    store.hasFeedKey = !!(await getKey("feed"));
    store.keys = await allKeys();
    store.loading = false;
    render();
    prefetch();
    refreshLive();
  } catch (e) {
    store.loading = false;
    if (e.message === "404" || e.message === "decrypt") store.keyChanged = true;
    else if (!navigator.onLine) store.bootError = "offlineFirst";
    else store.bootError = "decrypt";
    render();
  }
}

async function refreshRoot() {
  store.refreshing = true; render();
  try { await loadRoot(); store.refreshError = false; }
  catch { store.refreshError = true; }
  store.refreshing = false; render();
}

async function refreshLive() {
  if (!store.model?.managerToken || !store.model.portalApi) return;
  try {
    const data = await worker.sessions(store.model.portalApi, store.model.managerToken);
    store.live = { sessions: worker.validateSessions(data) };
    store.creadorasError = false;
  } catch { store.creadorasError = true; }
  render();
}

async function prefetch() {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  idle(async () => {
    if (navigator.connection?.saveData) return;
    try {
      if (await getKey("boards")) {
        const { scene } = await decryptSceneFor("boards");
        store.boards = fromBoards(scene);
      }
    } catch { store.feedError = true; }
    try {
      if (await getKey("feed")) {
        const { scene, row } = await decryptSceneFor("feed");
        store.feed = normalizeFeed(scene);
        store.feedBlob = row.b;
        store.feedF = row.f;
        store.hasFeedKey = true;
      }
    } catch { /* ignore */ }
    render();
  });
}

async function consumeHash() {
  const hash = location.hash;
  if (!hashIsKeys(hash)) {
    store.route = parseRoute(hash);
    return;
  }
  const r = await importFromHash(hash, { persist: true, sourceUrl: location.href });
  if (!r.ok) {
    store.bootError = r.error === "offline" ? "offlineFirst" : r.error === "incomplete" ? "incomplete" : "decrypt";
    return;
  }
  memoryM = r.memoryM || "";
  if (r.type === "portal") { location.replace("../portal.html" + location.hash); return; }
  if (r.type && !["hub", "comando", "filming", "boards", "creator-feed", "board", "manager"].includes(r.type)) {
    location.replace("../index.html" + location.hash); return;
  }
  if (r.strip) {
    const dest = r.type === "filming" ? "#/grabar" : r.type === "boards" ? "#/boards" : r.type === "creator-feed" ? "#/feed" : r.type === "board" ? "#/board/" + r.blobId : r.type === "manager" ? "#/creadoras" : "#/dashboard";
    history.replaceState(null, "", location.pathname + dest);
    store.route = parseRoute(dest);
  } else {
    store.single = true;
    if (r.type === "filming") { store.model = fromFilming(r.scene); store.route = { name: "grabar" }; }
    else if (r.type === "boards") { store.boards = fromBoards(r.scene); store.route = { name: "boards" }; }
    else if (r.type === "creator-feed") { store.feed = normalizeFeed(r.scene); store.route = { name: "feed" }; }
    else if (r.type === "board") { store.board = r.scene; store.route = { name: "board", id: r.blobId }; }
    else if (r.type === "manager") { store.model = adaptRoot(r.scene); store.route = { name: "creadoras" }; memoryM = r.memoryM; }
    store.loading = false;
  }
}

function skipWaiting() {
  if (store.uploading || typing) {
    store.overlay = { kind: "dialog", title: t("upd.busy"), confirmLabel: t("common.understood"), confirmKind: "primary", confirmAct: "cancel" };
    render();
    return;
  }
  swReg?.waiting?.postMessage({ type: "SKIP_WAITING" });
}

async function registerSw() {
  if (!("serviceWorker" in navigator)) return;
  try {
    swReg = await navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" });
    const check = () => {
      if (Date.now() - lastSwCheck < 30 * 60 * 1000) return;
      lastSwCheck = Date.now();
      swReg.update();
    };
    check();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
    if (swReg.waiting) store.swWaiting = true;
    swReg.addEventListener("updatefound", () => {
      swReg.installing?.addEventListener("statechange", () => {
        if (swReg.waiting) { store.swWaiting = true; render(); }
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload());
  } catch { /* optional */ }
}

async function boot() {
  store.settings = await settings();
  store.installDismissed = store.settings.installDismissedAt && (Date.now() - store.settings.installDismissedAt) < 14 * 86400000;
  store.standalone = standalone();
  store.isDesktop = matchMedia("(min-width: 900px)").matches;
  store.now = new Date();
  store.online = navigator.onLine;
  if (!okHost()) { render(); return; }
  await consumeHash();
  if (!store.single && !store.bootError) {
    if (!location.hash || /^#\/(dashboard|grabar|creadoras)?$/.test(location.hash)) {
      if (!hashIsKeys(location.hash) && !store.route.sheet) {
        // cold start → dashboard unless deep link
        if (!location.hash || location.hash === "#/" || location.hash === "#/dashboard") store.route = { name: "dashboard" };
      }
    }
    await loadRoot();
  } else render();
  store.outboxN = await pendingCount();
  store.outboxAge = await oldestPendingAge();
  onOutbox(async () => {
    store.outboxN = await pendingCount();
    store.outboxAge = await oldestPendingAge();
    render();
  });
  startLoop(outboxCtx);
  registerSw();
  render();
}

root()?.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-act], [data-tab]");
  if (!el) return;
  if (el.tagName === "INPUT" && el.type === "file") return;
  ev.preventDefault();
  handleAct(el.getAttribute("data-act") || "", el, ev);
});
root()?.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.matches("input[type=file]")) handleAct("upload", el, ev);
  if (el.dataset.field === "onb") store.onbText = el.value;
  if (el.dataset.field === "note") store.noteText = el.value;
});
root()?.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.dataset.field === "onb") { store.onbText = el.value; typing = false; render(); }
  if (el.dataset.field === "note") store.noteText = el.value;
});
document.addEventListener("focusin", (ev) => {
  if (ev.target.matches("input, textarea")) typing = true;
});
document.addEventListener("focusout", (ev) => {
  if (ev.target.matches("input, textarea")) { typing = false; }
});
addEventListener("popstate", () => {
  if (store.overlay) { store.overlay = null; }
  store.route = parseRoute(location.hash);
  render();
});
addEventListener("online", () => { store.online = true; render(); });
addEventListener("offline", () => { store.online = false; render(); });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { store.now = new Date(); refreshRoot(); }
});
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; store.canNativeInstall = true; render(); });
setInterval(() => { store.now = new Date(); if (showTabs()) render(); }, 30000);
setInterval(() => { if (!document.hidden) refreshRoot(); }, 60000);

boot();
export { store, render, boot };
