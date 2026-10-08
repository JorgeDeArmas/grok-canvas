import { sha256Hex, apiBaseOk, TOKEN_RE } from "./core.js";

const CONCURRENCY = 3;
const RETRIES = 4;

export function openUploadsDb(name) {
  return new Promise((res, rej) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("uploads");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function idbGet(dbName, key) {
  const db = await openUploadsDb(dbName);
  return new Promise((res, rej) => {
    const q = db.transaction("uploads").objectStore("uploads").get(key);
    q.onsuccess = () => res(q.result || null);
    q.onerror = () => rej(q.error);
  });
}

export async function idbSet(dbName, key, val) {
  const db = await openUploadsDb(dbName);
  return new Promise((res, rej) => {
    const q = db.transaction("uploads", "readwrite").objectStore("uploads").put(val, key);
    q.onsuccess = () => res();
    q.onerror = () => rej(q.error);
  });
}

export async function idbDel(dbName, key) {
  const db = await openUploadsDb(dbName);
  return new Promise((res, rej) => {
    const q = db.transaction("uploads", "readwrite").objectStore("uploads").delete(key);
    q.onsuccess = () => res();
    q.onerror = () => rej(q.error);
  });
}

export function recKey(job, shot, take) {
  return `${job}:${shot}:${take}`;
}

export function sameFile(rec, file) {
  if (!rec || !file) return false;
  if (rec.size !== file.size) return false;
  if (rec.name && rec.lastModified != null) {
    return rec.name === file.name && rec.lastModified === file.lastModified;
  }
  return true;
}

async function api(base, token, path, opts = {}) {
  const origin = apiBaseOk(base);
  if (!origin) throw Object.assign(new Error("api"), { status: 0 });
  const headers = { "content-type": "application/json" };
  if (token && TOKEN_RE.test(token)) headers.authorization = "Bearer " + token;
  const res = await fetch(origin + path, {
    method: opts.method || "POST",
    headers: { ...headers, ...(opts.headers || {}) },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    referrerPolicy: "no-referrer",
    credentials: "omit",
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || String(res.status));
    err.status = res.status; err.body = data; throw err;
  }
  return data;
}

function partAuth(url, token) {
  const headers = {};
  try {
    const u = new URL(url, location.href);
    const h = u.hostname.toLowerCase();
    if ((h.endsWith(".workers.dev") || h === "localhost" || h === "127.0.0.1") && token) {
      headers.authorization = "Bearer " + token;
    }
  } catch { /* ignore */ }
  return headers;
}

async function putPart(url, blob, token) {
  let last;
  for (let i = 0; i < RETRIES; i++) {
    try {
      const res = await fetch(url, {
        method: "PUT", body: blob, referrerPolicy: "no-referrer", credentials: "omit",
        headers: partAuth(url, token),
      });
      if (res.ok) {
        return { etag: (res.headers.get("etag") || res.headers.get("ETag") || "ok").replace(/"/g, ""), sha: await sha256Hex(await blob.arrayBuffer()) };
      }
      last = new Error("http " + res.status);
    } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 400 * Math.pow(2, i)));
  }
  throw last;
}

let wakeLock = null;
export async function wake(on) {
  try {
    if (on && navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen");
    else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* optional */ }
}

export async function runUpload({ dbName, key, file, base, token, onProgress }) {
  if (!file || !String(file.type || "").startsWith("video/")) {
    const e = new Error("onlyVideo"); e.code = "onlyVideo"; throw e;
  }
  const [job, shot, take] = key.split(":");
  let rec = await idbGet(dbName, key);
  if (rec && rec.uploadId && !sameFile(rec, file) && rec.name) {
    const e = new Error("notSame"); e.code = "notSame"; throw e;
  }
  await wake(true);
  const unload = (ev) => { ev.preventDefault(); ev.returnValue = ""; };
  addEventListener("beforeunload", unload);
  try {
    if (!rec || !rec.uploadId) {
      const init = await api(base, token, "/upload/init", {
        body: { job, shot: Number(shot), take: Number(take), size: file.size, mime: file.type || "video/mp4" },
      });
      rec = {
        uploadId: init.uploadId, key: init.key, partSize: init.partSize,
        size: file.size, mime: file.type, parts: {}, done: false,
        name: file.name, lastModified: file.lastModified,
      };
      await idbSet(dbName, key, rec);
    }
    const partSize = rec.partSize || 8 * 1024 * 1024;
    const total = Math.max(1, Math.ceil(file.size / partSize));
    const pending = [];
    for (let n = 1; n <= total; n++) if (!rec.parts[n]) pending.push(n);
    let doneN = total - pending.length;
    onProgress && onProgress(doneN / total);
    async function worker() {
      while (pending.length) {
        const n = pending.shift();
        const start = (n - 1) * partSize;
        const blob = file.slice(start, Math.min(start + partSize, file.size));
        const signed = await api(base, token, "/upload/sign", { body: { uploadId: rec.uploadId, partNumbers: [n] } });
        const url = (signed.urls && signed.urls[0] && signed.urls[0].url) || "";
        const put = await putPart(url, blob, token);
        rec.parts[n] = { etag: put.etag, sha: put.sha };
        await idbSet(dbName, key, rec);
        doneN += 1;
        onProgress && onProgress(doneN / total);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length || 1) }, () => worker()));
    const etags = Object.keys(rec.parts).map(Number).sort((a, b) => a - b)
      .map((n) => ({ partNumber: n, etag: rec.parts[n].etag, sha256: rec.parts[n].sha }));
    await api(base, token, "/upload/complete", { body: { uploadId: rec.uploadId, etags, size: file.size } });
    rec.done = true;
    await idbSet(dbName, key, rec);
    await idbDel(dbName, key);
    onProgress && onProgress(1);
  } finally {
    removeEventListener("beforeunload", unload);
    await wake(false);
  }
}

export async function hasIncomplete(dbName) {
  const db = await openUploadsDb(dbName);
  return new Promise((res, rej) => {
    const q = db.transaction("uploads").objectStore("uploads").getAll();
    q.onsuccess = () => res((q.result || []).some((r) => r && !r.done));
    q.onerror = () => rej(q.error);
  });
}
