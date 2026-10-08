import {
  BLOB_RE, KEY_RE, UUID_RE, TOKEN_RE, parseHash, fetchScene, decryptScene,
  importAesKey, extractCanvasLink, classifyLink, bytesToB64url, okHost,
} from "./core.js";

const DB = "comando";
const VER = 1;

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("keys")) db.createObjectStore("keys", { keyPath: "role" });
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function store(name, mode = "readonly") {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

function req(q) {
  return new Promise((res, rej) => {
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}

export async function getKey(role) {
  return req((await store("keys")).get(role));
}

export async function allKeys() {
  return req((await store("keys")).getAll());
}

export async function putKey(row) {
  return req((await store("keys", "readwrite")).put(row));
}

export async function deleteKey(role) {
  return req((await store("keys", "readwrite")).delete(role));
}

export async function getMeta(key) {
  return req((await store("meta")).get(key));
}

export async function setMeta(key, val) {
  return req((await store("meta", "readwrite")).put(val, key));
}

export async function settings() {
  return (await getMeta("settings")) || { theme: "auto", installDismissedAt: 0, tabsWithFeed: false };
}

export async function saveSettings(patch) {
  const cur = await settings();
  const next = { ...cur, ...patch };
  await setMeta("settings", next);
  return next;
}

async function importStoredKey(keyText) {
  try {
    const cryptoKey = await importAesKey(keyText, false);
    return { key: cryptoKey, keyMode: "crypto" };
  } catch (e) {
    return { key: keyText, keyMode: "raw" };
  }
}

async function persistKey(row) {
  try {
    await putKey(row);
    return row;
  } catch (e) {
    if (row.key && typeof row.key !== "string") {
      throw e;
    }
    throw e;
  }
}

export let pendingInstallLink = "";

export function setPendingInstallLink(url) {
  pendingInstallLink = url || "";
}

function validHash(h) {
  if (!BLOB_RE.test(h.b)) return "incomplete";
  try {
    if (b64urlToBytesSafe(h.k).byteLength !== 32) return "incomplete";
  } catch { return "incomplete"; }
  if (h.f && !UUID_RE.test(h.f)) return "incomplete";
  if (h.m && !TOKEN_RE.test(h.m)) return "incomplete";
  if (h.t && !TOKEN_RE.test(h.t)) return "incomplete";
  return "";
}

function b64urlToBytesSafe(t) {
  const s = String(t || "").replace(/-/g, "+").replace(/_/g, "/");
  const p = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s + p);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function importFromHash(hash, { persist = true, sourceUrl = "" } = {}) {
  const h = typeof hash === "string" ? parseHash(hash) : hash;
  const bad = validHash(h);
  if (bad) return { ok: false, error: "incomplete" };
  let blob;
  try { blob = await fetchScene(h.b); }
  catch (e) {
    if (!navigator.onLine) return { ok: false, error: "offline" };
    return { ok: false, error: e.status === 404 ? "keyChanged" : "decrypt" };
  }
  let scene;
  try { scene = await decryptScene(blob, h.k); }
  catch { return { ok: false, error: "decrypt" }; }
  const type = scene && scene.type;
  const now = Date.now();
  let storedMode = "crypto";
  async function storeRole(role, b, k, extra = {}) {
    let keyObj;
    try {
      keyObj = await importAesKey(k, false);
      await persistKey({ role, b, key: keyObj, type, addedAt: now, lastOkAt: now, ...extra });
    } catch {
      storedMode = "raw";
      await persistKey({ role, b, key: k, type, addedAt: now, lastOkAt: now, keyMode: "raw", ...extra });
    }
  }
  const rootTypes = type === "hub" || type === "comando";
  if (rootTypes && persist) {
    const existing = await allKeys();
    const keep = new Set(["root"]);
    await storeRole("root", h.b, h.k);
    const ring = scene.keyring || {};
    for (const [role, ref] of Object.entries(ring)) {
      if (!ref || !ref.b || !ref.k) continue;
      keep.add(role);
      await storeRole(role, ref.b, ref.k, role === "feed" ? { f: ref.f || h.f || "" } : {});
    }
    for (const row of existing) {
      if (!keep.has(row.role) && !String(row.role).startsWith("board:")) await deleteKey(row.role);
    }
    if (storedMode === "raw") await saveSettings({ keyMode: "raw" });
    if (sourceUrl) pendingInstallLink = sourceUrl;
    return { ok: true, type, scene, role: "root", strip: true, blobId: h.b };
  }
  const sub = { filming: "filming", boards: "boards", "creator-feed": "feed", board: `board:${h.b}`, manager: null }[type];
  const hasRoot = !!(await getKey("root"));
  if (hasRoot && persist && sub) {
    await storeRole(sub, h.b, h.k, type === "creator-feed" ? { f: h.f || "" } : {});
    return { ok: true, type, scene, role: sub, strip: true, blobId: h.b, memoryM: h.m || "" };
  }
  return {
    ok: true, type, scene, role: sub || type, strip: false, blobId: h.b, keyText: h.k,
    single: !hasRoot, memoryM: h.m || "", memoryT: h.t || "", f: h.f || "",
  };
}

export async function importFromPastedText(text) {
  const url = extractCanvasLink(text);
  if (!url) return { ok: false, error: "nourl" };
  const kind = classifyLink(url);
  if (kind.kind === "creator") return { ok: false, error: "creator" };
  if (kind.kind === "single") return { ok: false, error: "single" };
  if (kind.kind !== "root") return { ok: false, error: "nourl" };
  if (!navigator.onLine) return { ok: false, error: "offline" };
  return importFromHash(kind.hash, { persist: true, sourceUrl: url });
}

export async function decryptSceneFor(roleOrB) {
  let row;
  if (BLOB_RE.test(roleOrB) && !(await getKey(roleOrB))) {
    const all = await allKeys();
    row = all.find((r) => r.b === roleOrB) || await getKey("board:" + roleOrB);
  } else {
    row = await getKey(roleOrB);
  }
  if (!row) throw new Error("nokey");
  const blob = await fetchScene(row.b);
  const scene = await decryptScene(blob, row.key);
  row.lastOkAt = Date.now();
  await putKey(row);
  await setMeta("lastOk:" + row.role, { updatedAt: scene.updatedAt || "", at: Date.now() });
  return { scene, row };
}

export async function forgetPhone() {
  const names = ["comando", "owner-uploads"];
  for (const n of names) {
    await new Promise((res, rej) => {
      const r = indexedDB.deleteDatabase(n);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
      r.onblocked = () => res();
    });
  }
  try {
    for (const name of await caches.keys()) {
      if (name === "scenes-v1" || name === "media-v1") await caches.delete(name);
    }
  } catch { /* ignore */ }
  const lsKeys = [];
  for (let i = 0; i < localStorage.length; i++) lsKeys.push(localStorage.key(i));
  for (const k of lsKeys) {
    if (/^(hub-done:|hub-picks:|rec-ticks:|rec-sync:|creatorFeed\.avatar|boards:lane|boards:av|boards:kind|feed-want:)/.test(k)) {
      localStorage.removeItem(k);
    }
  }
  pendingInstallLink = "";
}

export { openDb, store, req };
