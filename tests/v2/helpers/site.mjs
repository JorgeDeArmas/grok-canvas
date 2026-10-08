import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seal } from "./seal.mjs";
import { CATALOG, TOKENS } from "./fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".mjs": "text/javascript; charset=utf-8",
};

export async function installSite(page, { scenes = {}, media = {}, extraHosts = [], worker } = {}) {
  const sealed = {};
  for (const [name, scene] of Object.entries(scenes)) {
    sealed[name] = await seal(typeof scene === "function" ? scene() : scene);
  }
  const requests = [];
  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    requests.push({ url: req.url(), method: req.method(), headers: req.headers(), postData: req.postData() });
    if (url.hostname === "jorgedearmas.github.io" && url.pathname.startsWith("/grok-canvas/")) {
      const rel = decodeURIComponent(url.pathname.replace("/grok-canvas/", ""));
      if (rel.startsWith("scenes/") && rel.endsWith(".json")) {
        const id = rel.slice("scenes/".length, -5);
        const hit = Object.values(sealed).find((s) => s.blobId === id);
        if (hit) return route.fulfill({ contentType: "application/json", body: JSON.stringify(hit.blob) });
        return route.fulfill({ status: 404, body: "{}" });
      }
      const file = path.join(ROOT, rel === "" || rel.endsWith("/") ? path.join(rel, "index.html") : rel);
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        const ext = path.extname(file);
        return route.fulfill({ contentType: MIME[ext] || "application/octet-stream", body: fs.readFileSync(file) });
      }
      if (rel === "app" || rel === "app/") {
        return route.fulfill({ contentType: "text/html", body: fs.readFileSync(path.join(ROOT, "app/index.html")) });
      }
      return route.fulfill({ status: 404, body: "missing " + rel });
    }
    if (url.hostname === "webhook.site") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    if (url.hostname.endsWith(".workers.dev") || extraHosts.includes(url.hostname)) {
      if (worker) return worker(route);
      return route.fulfill({ status: 200, contentType: "application/json", body: "{\"sessions\":[]}" });
    }
    if (url.hostname.endsWith(".r2.cloudflarestorage.com")) {
      return route.fulfill({ status: 200, headers: { etag: "\"etag1\"" }, body: "ok" });
    }
    if (url.hostname === "cdn.jsdelivr.net") {
      return route.fulfill({ status: 404, body: "" });
    }
    return route.abort("blockedbyclient");
  });
  return { sealed, requests, tokens: TOKENS };
}

export function catalog(name) {
  return CATALOG[name]();
}

export async function openApp(page, sealedRoot, extra = "") {
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/app/${sealedRoot.hash}${extra}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
}
