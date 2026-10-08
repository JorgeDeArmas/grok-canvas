const VERSION = "2.0.1+7a365e1";
const SHELL = "shell-" + VERSION;
const SCENES = "scenes-v1";
const MEDIA = "media-v1";
const PRECACHE = [
  "./",
  "./index.html",
  "./app.js",
  "./version.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "../lib/ui.css",
  "../lib/html.js",
  "../lib/copy.js",
  "../lib/core.js",
  "../lib/dates.js",
  "../lib/status.js",
  "../lib/lanes.js",
  "../lib/icons.js",
  "../lib/components.js",
  "../lib/keyring.js",
  "../lib/outbox.js",
  "../lib/model.js",
  "../lib/worker-api.js",
  "../lib/upload.js",
  "../lib/board.js",
  "../lib/screens/dashboard.js",
  "../lib/screens/grabar.js",
  "../lib/screens/creadoras.js",
  "../lib/screens/feed.js",
  "../lib/screens/boards.js",
  "../lib/screens/board-screen.js",
  "../lib/screens/ajustes.js",
  "../lib/screens/bienvenida.js",
  "../lib/screens/note.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(PRECACHE.map(async (u) => {
      const url = u + (u.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(VERSION);
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res.ok) await cache.put(u, res);
      } catch { /* skip missing shell file */ }
    }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("shell-") && name !== SHELL) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isScene(url) {
  return url.origin === self.location.origin && /\/scenes\/[^/]+\.json/.test(url.pathname);
}
function isMedia(url) {
  return /\/media\/m[a-f0-9]{16}\.enc$/i.test(url.pathname) &&
    (url.origin === self.location.origin || url.hostname === "cdn.jsdelivr.net");
}
function isApi(url) {
  return url.hostname.endsWith(".workers.dev") ||
    url.hostname.endsWith(".r2.cloudflarestorage.com") ||
    url.hostname === "webhook.site";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.mode === "navigate" && /\/(grok-canvas\/)?app\/?/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      return (await cache.match("./index.html", { ignoreSearch: true })) || fetch(req);
    })());
    return;
  }
  if (isApi(url)) return;
  if (isScene(url)) {
    event.respondWith(networkFirstScene(req));
    return;
  }
  if (isMedia(url)) {
    event.respondWith(cacheFirstMedia(req));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstShell(req));
  }
});

async function cacheFirstShell(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req, { ignoreSearch: true });
  return hit || fetch(req);
}

async function networkFirstScene(req) {
  const cache = await caches.open(SCENES);
  const key = req.url.split("?")[0];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(new Request(req, { signal: ctrl.signal, cache: "no-store" }));
    clearTimeout(t);
    if (res.ok) {
      const json = await res.clone().json().catch(() => null);
      if (json && typeof json.iv === "string" && typeof json.ct === "string" && Object.keys(json).length === 2) {
        await cache.put(key, res.clone());
        await lru(cache, 80);
      }
    }
    return res;
  } catch {
    return (await cache.match(key)) || Response.error();
  }
}

async function cacheFirstMedia(req) {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    const len = Number(res.headers.get("content-length") || 0);
    if (len && len <= 60 * 1024 * 1024) {
      await cache.put(req, res.clone());
      await lruBytes(cache, 200 * 1024 * 1024);
    }
  }
  return res;
}

async function lru(cache, max) {
  const keys = await cache.keys();
  while (keys.length > max) await cache.delete(keys.shift());
}

async function lruBytes(cache, maxBytes) {
  const keys = await cache.keys();
  let total = 0;
  const sizes = [];
  for (const k of keys) {
    const r = await cache.match(k);
    const n = Number(r?.headers.get("content-length") || 0);
    sizes.push({ k, n });
    total += n;
  }
  while (total > maxBytes && sizes.length) {
    const x = sizes.shift();
    await cache.delete(x.k);
    total -= x.n;
  }
}
