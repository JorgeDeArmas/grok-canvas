/**
 * Creator portal. Import boundary (SEC-07): core, html, dates, copy, status,
 * icons, components, board, upload, lanes. Never keyring/outbox/model/worker-api/screens.
 */
import { html, raw, setHtml } from "./html.js";
import { t } from "./copy.js";
import { icon } from "./icons.js";
import {
  okHost, parseHash, fetchScene, decryptScene, importAesKey, txt, TOKEN_RE, apiBaseOk,
} from "./core.js";
import { dayLabel } from "./dates.js";
import { ErrorState, AppBar } from "./components.js";
import { normalizeBoard, renderBoard, portalPlp } from "./board.js";
import { runUpload, idbGet, recKey } from "./upload.js";

const FORBIDDEN = ["managerToken", "ownerToken", "keyring", "editor_brief"];

const root = () => document.getElementById("app");
const store = {
  scene: null,
  live: null,
  productId: "",
  uploads: {},
  error: null,
  inactive: false,
};

function stripForbidden(scene) {
  const out = { ...scene };
  for (const k of FORBIDDEN) delete out[k];
  if (Array.isArray(out.products)) {
    out.products = out.products.map((p) => {
      const copy = { ...p };
      delete copy.editor_brief;
      return copy;
    });
  }
  return out;
}

function secret() {
  return parseHash(location.hash);
}

async function api(path) {
  const base = apiBaseOk(store.scene && store.scene.apiBase);
  const tok = secret().t;
  if (!base || !TOKEN_RE.test(tok)) throw Object.assign(new Error("api"), { status: 0 });
  const res = await fetch(base + path, {
    referrerPolicy: "no-referrer",
    credentials: "omit",
    headers: { authorization: "Bearer " + tok },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { error: text }; }
  if (!res.ok) {
    const err = new Error((body && (body.message || body.error)) || String(res.status));
    err.status = res.status;
    throw err;
  }
  return body;
}

function render() {
  const el = root();
  if (!el) return;
  if (!okHost()) {
    setHtml(el, ErrorState({ icon: "link-2-off", title: t("err.host.title") }));
    return;
  }
  if (store.inactive) {
    setHtml(el, ErrorState({
      icon: "link-2-off",
      title: t("err.portalInactive.title"),
      body: t("err.portalInactive.body"),
    }));
    return;
  }
  if (store.error) {
    setHtml(el, ErrorState({ title: t(`err.${store.error}.title`), body: t(`err.${store.error}.body`), act: "retry" }));
    return;
  }
  if (!store.scene) {
    setHtml(el, html`<p class="status">${t("common.loading")}</p>`);
    return;
  }
  const board = normalizeBoard(store.scene);
  if (store.productId) {
    const product = (board.products || []).find((p) => p.id === store.productId) || board;
    setHtml(el, html`
      ${AppBar({ title: product.name || t("por.hi", { name: board.creatorName || "" }), back: true, variant: "compact" })}
      <div class="screen">${renderBoard(board, { role: "creator", live: store.live, uploads: store.uploads, product })}</div>
    `);
    return;
  }
  setHtml(el, html`<div class="screen" style="padding-top:calc(16px + env(safe-area-inset-top))">${portalPlp(store.scene, store.live)}</div>`);
}

function setProduct(id) {
  store.productId = id || "";
  const h = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (id) h.set("p", id); else h.delete("p");
  history.pushState({ p: id }, "", "#" + h.toString());
  render();
}

async function refreshLive() {
  const tok = secret().t;
  if (!tok || !apiBaseOk(store.scene && store.scene.apiBase)) return;
  try {
    store.live = await api("/s/" + encodeURIComponent(tok));
    store.inactive = false;
  } catch (e) {
    if (e.status === 403) store.inactive = true;
  }
  render();
}

async function doUpload(el, file) {
  const key = el.getAttribute("data-file") || el.dataset.file;
  if (!key) return;
  const [job, shot, take] = key.split(":");
  try {
    await runUpload({
      dbName: "portal-uploads",
      key: recKey(job, shot, take),
      file,
      base: store.scene.apiBase,
      token: secret().t,
      onProgress: (p) => { store.uploads[key] = { progress: p }; render(); },
    });
    store.uploads[key] = null;
    await refreshLive();
  } catch (e) {
    store.uploads[key] = { paused: true, progress: store.uploads[key]?.progress || 0 };
    render();
    const alert = document.createElement("p");
    alert.setAttribute("role", "alert");
    alert.textContent = t(e.status === 403 ? "up.inactive" : e.status === 409 ? "up.closed" : e.code === "onlyVideo" ? "up.onlyVideo" : "up.startFailed");
    root()?.appendChild(alert);
    if (e.status === 403) store.inactive = true;
  }
}

async function boot() {
  if (!okHost()) { render(); return; }
  const { b, k, t: tok, p } = secret();
  if (!b || !k) {
    store.error = "incomplete";
    render();
    return;
  }
  try {
    const blob = await fetchScene(b);
    const key = await importAesKey(k, false);
    const scene = stripForbidden(await decryptScene(blob, key));
    store.scene = scene;
    store.productId = p || "";
    await refreshLive();
    render();
  } catch (e) {
    store.error = navigator.onLine ? "decrypt" : "offlineFirst";
    render();
  }
}

root()?.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-act], [data-open]");
  if (!el) return;
  if (el.tagName === "INPUT" && el.type === "file") return;
  ev.preventDefault();
  const act = el.getAttribute("data-act") || "";
  if (act === "back" || act === "sheet-close") {
    if (store.productId) { setProduct(""); return; }
    history.back();
    return;
  }
  if (act.startsWith("open-pdp:")) { setProduct(act.slice(9)); return; }
  if (el.dataset.open) { setProduct(el.dataset.open); return; }
  if (act === "retry") { store.error = null; boot(); return; }
  if (act === "copy-script") {
    navigator.clipboard?.writeText(store.scene?.script || "");
  }
});
root()?.addEventListener("change", (ev) => {
  if (ev.target.matches("input[type=file]") && ev.target.files?.[0]) {
    doUpload(ev.target, ev.target.files[0]);
  }
});
addEventListener("popstate", () => {
  store.productId = parseHash().p || "";
  render();
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshLive(); });
setInterval(() => { if (!document.hidden) refreshLive(); }, 60000);

boot();
export { store, render, boot, dayLabel };
