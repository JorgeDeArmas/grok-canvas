/** Host check, AES-GCM, fetch, sanitizers, copy/share. No secrets in logs. */

export const CANVAS_HOST = "jorgedearmas.github.io";
export const CANVAS_PATH = "/grok-canvas/";
export const THUMB_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
export const BLOB_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const KEY_RE = /^[A-Za-z0-9_-]{43}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TOKEN_RE = /^[A-Za-z0-9_-]{16,256}$/;
export const ITEM_ID_RE = /^[a-z0-9:_.-]{1,120}$/i;
export const VIDEO_ID_RE = /^rec:[a-z0-9]{2,24}$/;
export const MEDIA_NAME_RE = /^media\/m[a-f0-9]{16}\.enc$/i;
export const MEDIA_PATH_RE = /\/media\/m[a-f0-9]{16}\.enc$/i;
export const PID_RE = /^[A-Za-z0-9_-]{1,40}$/;

const SAFE_MIME = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/webm", "video/quicktime",
]);

export function okHost(hostname = (typeof location !== "undefined" ? location.hostname : "")) {
  const h = String(hostname || "").toLowerCase();
  return h.endsWith("github.io") || h === "localhost" || h === "127.0.0.1";
}

export function b64ToBytes(t) {
  const bin = atob(String(t || ""));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function b64urlToBytes(t) {
  const s = String(t || "").replace(/-/g, "+").replace(/_/g, "/");
  const p = "=".repeat((4 - (s.length % 4)) % 4);
  return b64ToBytes(s + p);
}

export function bytesToB64url(bytes) {
  let bin = "";
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function txt(s, max = 120) {
  return String(s ?? "")
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function cleanMultiline(s, max = 20000) {
  return String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, max);
}

export function parseHash(hash = (typeof location !== "undefined" ? location.hash : "")) {
  const h = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  const get = (k) => h.get(k) || "";
  return { b: get("b"), k: get("k"), f: get("f"), m: get("m"), t: get("t"), r: get("r"), p: get("p") };
}

export function hashIsKeys(hash) {
  const p = parseHash(hash);
  return !!(p.b && p.k);
}

export async function importAesKey(keyText, extractable = false) {
  const raw = b64urlToBytes(keyText);
  if (raw.byteLength !== 32) throw new Error("key");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", extractable, ["decrypt"]);
}

export async function decryptScene(blob, keyOrText) {
  const key = typeof keyOrText === "string" ? await importAesKey(keyOrText, false) : keyOrText;
  const iv = b64ToBytes(blob.iv);
  const ct = b64ToBytes(blob.ct);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(plain));
}

export async function decryptMedia(buf, keyOrText) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.byteLength < 28) throw new Error("decrypt");
  const key = typeof keyOrText === "string" ? await importAesKey(keyOrText, false) : keyOrText;
  const iv = bytes.subarray(0, 12);
  const ct = bytes.subarray(12);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
}

export async function fetchScene(b, { cache = "no-store" } = {}) {
  const id = String(b || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!BLOB_RE.test(id)) throw new Error("blob");
  const here = typeof location !== "undefined" ? location.pathname : "";
  const base = here.includes("/app/")
    ? new URL("../scenes/", location.href).href
    : new URL("scenes/", location.href).href;
  const url = `${base}${id}.json?t=${Date.now()}`;
  const res = await fetch(url, { cache, referrerPolicy: "no-referrer", credentials: "omit" });
  if (res.status === 404) {
    const err = new Error("404");
    err.status = 404;
    throw err;
  }
  if (!res.ok) throw new Error("http");
  const json = await res.json();
  if (!json || typeof json.iv !== "string" || typeof json.ct !== "string") throw new Error("shape");
  return json;
}

export function safeHttpsUrl(raw, allowHosts) {
  const t = String(raw || "").trim();
  if (!t || t.length > 2048) return "";
  let u;
  try { u = new URL(t); } catch { return ""; }
  if (u.protocol !== "https:" || u.username || u.password) return "";
  if (allowHosts && allowHosts.length) {
    const host = u.hostname.toLowerCase();
    const ok = allowHosts.some((h) => (h.startsWith("*.") ? host.endsWith(h.slice(1)) : host === h));
    if (!ok) return "";
  }
  return u.href;
}

export function safeTikTokUrl(raw) {
  return safeHttpsUrl(raw, ["www.tiktok.com", "shop.tiktok.com"]);
}

export function safeGmailUrl(raw) {
  return safeHttpsUrl(raw, ["mail.google.com"]);
}

export function apiBaseOk(raw) {
  try {
    const u = new URL(String(raw || ""));
    if (u.protocol !== "https:" || u.username || u.password) return "";
    const h = u.hostname.toLowerCase();
    if (h.endsWith(".workers.dev") || h === "localhost" || h === "127.0.0.1") return u.origin;
  } catch { /* ignore */ }
  return "";
}

export function previewUrlOk(raw) {
  try {
    const u = new URL(String(raw || ""));
    if (u.protocol !== "https:" || u.username || u.password) return "";
    const h = u.hostname.toLowerCase();
    if (!(h.endsWith(".workers.dev") || h === "localhost" || h === "127.0.0.1")) return "";
    if (!u.pathname.includes("/manager/takes/") || !u.pathname.endsWith("/file")) return "";
    if (!u.searchParams.get("ticket")) return "";
    return u.href;
  } catch { return ""; }
}

export function safeMediaUrl(raw, origin = (typeof location !== "undefined" ? location.origin : "")) {
  const t = String(raw || "").trim();
  if (!t || t.length > 2048 || /[\u0000-\u001F\u007F\\\s]/.test(t)) return "";
  if (MEDIA_NAME_RE.test(t)) {
    try { return new URL(t, origin || "https://jorgedearmas.github.io/grok-canvas/").href; } catch { return ""; }
  }
  let u;
  try { u = new URL(t, origin || undefined); } catch { return ""; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return "";
  const host = u.hostname.toLowerCase();
  const same = origin && u.origin === origin;
  if (host !== "cdn.jsdelivr.net" && !same) return "";
  if (!MEDIA_PATH_RE.test(u.pathname)) return "";
  return u.href;
}

export function safeMime(raw, fallback) {
  const mime = String(raw ?? "").trim().toLowerCase().split(";")[0].trim();
  if (SAFE_MIME.has(mime)) return mime;
  return fallback && SAFE_MIME.has(fallback) ? fallback : (fallback || "application/octet-stream");
}

export function thumbSrc(v) {
  const s = String(v || "");
  return THUMB_RE.test(s) && s.length < 60000 ? s : "";
}

export function asMedia(v, kind) {
  if (v && typeof v === "object" && v.enc === true) {
    const src = safeMediaUrl(v.src);
    if (!src) return null;
    return { enc: true, src, mime: safeMime(v.mime, kind === "video" ? "video/mp4" : "image/jpeg") };
  }
  if (kind !== "video") {
    const t = thumbSrc(v);
    return t || null;
  }
  return null;
}

export function boardUrl(raw) {
  try {
    const u = new URL(String(raw || ""));
    if (u.protocol !== "https:" || u.username || u.password) return "";
    if (u.hostname.toLowerCase() !== CANVAS_HOST) return "";
    if (!u.pathname.startsWith(CANVAS_PATH)) return "";
    return u.href;
  } catch { return ""; }
}

export function parseBoardRef(raw) {
  const href = boardUrl(raw);
  if (!href) return null;
  const u = new URL(href);
  const h = parseHash(u.hash);
  if (!BLOB_RE.test(h.b) || !h.k) return null;
  if (h.t || h.m) return { blocked: true };
  const path = u.pathname.toLowerCase();
  if (/portal\.html|manager\.html|comando\.html|hub\.html$/.test(path)) return { blocked: true };
  return { b: h.b, k: h.k, f: UUID_RE.test(h.f) ? h.f : "" };
}

export function sameOriginCanvasUrl(raw, origin) {
  try {
    const u = new URL(String(raw || ""), origin);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return "";
    if (origin && u.origin !== new URL(origin).origin && u.hostname !== "localhost") {
      if (u.hostname !== CANVAS_HOST) return "";
    }
    if (!u.pathname.includes("/grok-canvas/")) return "";
    return u.href;
  } catch { return ""; }
}

export async function copyText(text) {
  const s = String(text ?? "");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(s);
      return true;
    }
  } catch { /* fallback */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return !!ok;
  } catch {
    return false;
  }
}

export async function share({ url, title, text } = {}) {
  const payload = {};
  if (url) payload.url = String(url);
  if (title) payload.title = String(title);
  if (text) payload.text = String(text);
  if (navigator.share) {
    try { await navigator.share(payload); return "shared"; } catch (e) {
      if (e && e.name === "AbortError") return "abort";
    }
  }
  if (url && await copyText(url)) return "copied";
  return "fail";
}

export function mailboxUrl(uuid) {
  if (!UUID_RE.test(uuid)) return "";
  return `https://webhook.site/${uuid}`;
}

export async function postMailbox(uuid, body, { plain = false, keepalive = false } = {}) {
  const url = mailboxUrl(uuid);
  if (!url) throw new Error("mailbox");
  const headers = { "content-type": plain ? "text/plain;charset=UTF-8" : "application/json" };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: plain ? JSON.stringify(body) : JSON.stringify(body),
    redirect: "error",
    referrerPolicy: "no-referrer",
    credentials: "omit",
    keepalive: !!keepalive,
    mode: "cors",
  });
  return res;
}

export function extractCanvasLink(text) {
  const re = /https:\/\/jorgedearmas\.github\.io\/grok-canvas\/[^\s<>"']+/gi;
  const m = String(text || "").match(re);
  return m ? m[0] : "";
}

export function classifyLink(href) {
  try {
    const u = new URL(href);
    if (u.hostname !== CANVAS_HOST || !u.pathname.startsWith(CANVAS_PATH)) return { kind: "foreign" };
    const path = u.pathname.slice(CANVAS_PATH.length);
    const h = parseHash(u.hash);
    if (h.t || /portal\.html$/.test(path)) return { kind: "creator", hash: h, path };
    const root = /^(comando\.html|hub\.html|app\/|app\/index\.html)?$/.test(path) || path === "app" || path === "app/";
    if (root && h.b && h.k) return { kind: "root", hash: h, path };
    if (h.b && h.k) return { kind: "single", hash: h, path };
    return { kind: "other", hash: h, path };
  } catch {
    return { kind: "invalid" };
  }
}

export function placeholderTitle(s) {
  return /^(producto|video|item)$/i.test(String(s || "").trim());
}

export function sha256Hex(buf) {
  return crypto.subtle.digest("SHA-256", buf).then((d) =>
    [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

/** Decrypt feed covers and previews after render. Key is the scene key (text or CryptoKey). */
export async function hydrateFeedMedia(root, keyOrText) {
  if (!root || !keyOrText || typeof root.querySelectorAll !== "function") return;
  await hydrateEncNodes(root.querySelectorAll("[data-enc]"), keyOrText);
}

export async function hydrateEncNodes(nodes, keyOrText) {
  if (!keyOrText || !nodes) return;
  await Promise.all([...nodes].map((el) => hydrateEncNode(el, keyOrText)));
}

async function hydrateEncNode(el, keyOrText) {
  const src = el.getAttribute("data-enc");
  if (!src || el.dataset.hydrated === src) return;
  el.dataset.hydrated = src;
  try {
    const res = await fetch(src, { credentials: "omit", referrerPolicy: "no-referrer" });
    if (!res.ok) throw new Error("http");
    const plain = await decryptMedia(new Uint8Array(await res.arrayBuffer()), keyOrText);
    const mime = el.getAttribute("data-mime") || "application/octet-stream";
    const url = URL.createObjectURL(new Blob([plain], { type: mime }));
    if (el.dataset.blob) URL.revokeObjectURL(el.dataset.blob);
    el.dataset.blob = url;
    if ("src" in el) el.src = url;
    el.hidden = false;
    if (el.tagName === "VIDEO") {
      el.muted = true;
      try { await el.play(); } catch { /* autoplay can fail; the cover stays */ }
    }
  } catch {
    el.dataset.hydrated = "";
  }
}
