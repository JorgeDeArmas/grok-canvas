import { seal } from "./seal.mjs";
import { CATALOG, TOKENS } from "./fixtures.mjs";

const ORIGIN = "http://127.0.0.1:4173";

function isWorkers(url) {
  try { return new URL(url).hostname.endsWith(".workers.dev"); }
  catch { return false; }
}

function isR2(url) {
  try { return new URL(url).hostname.endsWith(".r2.cloudflarestorage.com"); }
  catch { return false; }
}

const PIN = {
  boards: { blobId: TOKENS.BRD_B, keyText: TOKENS.BRD_K },
  feed: { blobId: TOKENS.FEED_B, keyText: TOKENS.FEED_K },
  filming: { blobId: TOKENS.FIL_B, keyText: TOKENS.FIL_K },
  board: { blobId: "boardblob01xx", keyText: "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD" },
  canvas: { blobId: TOKENS.CANVAS_B, keyText: TOKENS.CANVAS_K },
  charts: { blobId: TOKENS.CHARTS_B, keyText: TOKENS.CHARTS_K },
};

export async function installSite(page, { scenes = {}, worker } = {}) {
  const sealed = {};
  for (const [name, scene] of Object.entries(scenes)) {
    sealed[name] = await seal(typeof scene === "function" ? scene() : scene, PIN[name] || {});
  }
  const requests = [];

  await page.route((url) => String(url).includes("/scenes/"), async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split("/").pop().replace(/\.json$/, "");
    const hit = Object.values(sealed).find((s) => s.blobId === id);
    if (hit) return route.fulfill({ contentType: "application/json", body: JSON.stringify(hit.blob) });
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.route(isWorkers, async (route) => {
    requests.push({ url: route.request().url(), method: route.request().method(), headers: route.request().headers(), postData: route.request().postData() });
    if (worker) return worker(route);
    return route.fulfill({ status: 200, contentType: "application/json", body: "{\"sessions\":[]}" });
  });
  await page.route(isR2, async (route) => {
    return route.fulfill({ status: 200, headers: { etag: "\"etag1\"" }, body: "ok" });
  });
  await page.route((url) => String(url).includes("webhook.site"), async (route) => {
    requests.push({ url: route.request().url(), method: route.request().method(), postData: route.request().postData() });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route((url) => String(url).includes("cdn.jsdelivr.net"), (route) => route.fulfill({ status: 404, body: "" }));

  return { sealed, requests, tokens: TOKENS };
}

export function catalog(name) {
  return CATALOG[name]();
}

export async function openApp(page, sealedRoot, extra = "") {
  await page.goto(`/app/${sealedRoot.hash}${extra}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#app", { timeout: 10_000 });
  await page.waitForFunction(() => {
    const app = document.getElementById("app");
    if (!app) return false;
    return !!(
      app.querySelector("nav.tabbar") ||
      app.querySelector("[data-act=paste]") ||
      app.querySelector(".empty") ||
      app.querySelector(".hero")
    );
  }, null, { timeout: 15_000 });
}

export { ORIGIN };
