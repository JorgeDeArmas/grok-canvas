// Manager viewer: copy-link, approve / redo, iPhone screenshot.
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || "/opt/cursor/artifacts/screenshots";
const MEDIA = process.env.MEDIA_DIR || "";
const ORIGIN = "https://jorgedearmas.github.io";
const API = "https://creator-portal-api.example.workers.dev";
const html = fs.readFileSync(path.join(ROOT, "manager.html"), "utf8");
assert.match(html, /default-src 'none'; script-src 'unsafe-inline'/);
assert.doesNotMatch(html, /\beval\s*\(|new\s+Function|document\.write|insertAdjacentHTML|#k=/);
assert.match(html, /previewUrlOk/);
assert.match(html, /searchParams\.get\("ticket"\)/);

const LINK = "https://jorgedearmas.github.io/grok-canvas/portal.html#b=sessblob&k=SESSIONKEY&t=tok-live-michelle";
const fixture = {
  type: "manager", version: 1, apiBase: API,
  portals: [{
    id: "sess-1", creatorName: "Michelle", shootDate: "2026-10-11", link: LINK,
    jobs: [{ job_id: "FF-010", name: "Selladora", status: "uploaded" }]
  }]
};

const keyBytes = webcrypto.getRandomValues(new Uint8Array(32));
const keyText = Buffer.from(keyBytes).toString("base64url");
const key = await webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(fixture))));
const blob = JSON.stringify({ iv: Buffer.from(iv).toString("base64"), ct: Buffer.from(ct).toString("base64") });

const state = {
  sessions: [{
    id: "sess-1", creator_name: "Michelle", shoot_date: "2026-10-11", revoked_at: null,
    jobs: [{ job_id: "FF-010", name: "Selladora", status: "uploaded" }],
    takes: [{ id: "take-1", job_id: "FF-010", shot: 1, take: 1, status: "uploaded", redo_reason: "" }]
  }]
};

function json(route, status, obj) {
  return route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": ORIGIN, "access-control-allow-headers": "authorization,content-type" }, body: JSON.stringify(obj) });
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  .catch(() => chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
fs.mkdirSync(SHOTS, { recursive: true });
if (MEDIA) fs.mkdirSync(MEDIA, { recursive: true });
const errors = [];
const ctx = await browser.newContext({ locale: "es-ES", permissions: ["clipboard-read", "clipboard-write"], ...devices["iPhone 13"] });
await ctx.route("**/*", (route) => {
  const r = route.request(); const u = new URL(r.url());
  if (u.origin === ORIGIN && u.pathname === "/grok-canvas/manager.html") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
  if (u.origin === ORIGIN && u.pathname === "/grok-canvas/scenes/mgrtest.json") return route.fulfill({ status: 200, contentType: "application/json", body: blob });
  if (u.origin === API) {
    if (r.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": ORIGIN, "access-control-allow-headers": "authorization,content-type,range" } });
    if (u.pathname === "/manager/takes/take-1/file" && u.searchParams.get("ticket") === "tix-1") {
      return route.fulfill({ status: 200, contentType: "video/mp4", headers: { "access-control-allow-origin": ORIGIN, "accept-ranges": "bytes" }, body: Buffer.from("x") });
    }
    const auth = (r.headers()["authorization"] || "");
    if (!auth.includes("mgr-token")) return json(route, 401, { error: "no" });
    if (u.pathname === "/manager/sessions") return json(route, 200, { sessions: state.sessions });
    if (u.pathname === "/manager/takes/take-1/url") return json(route, 200, { url: `${API}/manager/takes/take-1/file?ticket=tix-1` });
    if (u.pathname === "/manager/takes/take-1/approve" && r.method() === "POST") {
      state.sessions[0].takes[0].status = "approved";
      state.sessions[0].jobs[0].status = "approved";
      return json(route, 200, { status: "approved" });
    }
    if (u.pathname === "/manager/takes/take-1/redo" && r.method() === "POST") {
      const body = JSON.parse(r.postData() || "{}");
      state.sessions[0].takes[0].status = "redo";
      state.sessions[0].takes[0].redo_reason = body.reason || "otra toma";
      state.sessions[0].jobs[0].status = "redo";
      return json(route, 200, { status: "redo" });
    }
    return json(route, 404, { error: "no" });
  }
  errors.push("unexpected " + u.origin + u.pathname); return route.abort();
});
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("pageerror " + e.message));
await page.addInitScript(() => {
  window.__copied = [];
  const write = (t) => { window.__copied.push(String(t)); return Promise.resolve(); };
  if (navigator.clipboard) navigator.clipboard.writeText = write;
  else Object.defineProperty(navigator, "clipboard", { value: { writeText: write } });
});
await page.goto(`${ORIGIN}/grok-canvas/manager.html#b=mgrtest&k=${keyText}&m=mgr-token`);
await page.waitForSelector("[data-portal]");
assert.match(await page.locator("h1").innerText(), /Portales/);
await page.waitForFunction(() => {
  const v = document.querySelector("[data-vid='take-1']");
  return v && v.src && v.src.includes("ticket=tix-1");
});
assert.match(await page.locator("[data-portal]").innerText(), /Michelle/);
await page.click("[data-copy]");
const copied = await page.evaluate(() => window.__copied);
assert.deepEqual(copied, [LINK]);
await page.screenshot({ path: path.join(SHOTS, "manager.png"), fullPage: true });
if (MEDIA) { try { fs.copyFileSync(path.join(SHOTS, "manager.png"), path.join(MEDIA, "manager.png")); } catch (e) {} }
await page.click("[data-approve='take-1']");
await page.waitForTimeout(200);
assert.equal(state.sessions[0].takes[0].status, "approved");
await page.click("[data-redo='take-1']");
await page.fill("[data-reason='take-1']", "se ve oscuro");
await page.click("[data-redo='take-1']");
await page.waitForTimeout(200);
assert.equal(state.sessions[0].takes[0].status, "redo");
assert.equal(state.sessions[0].takes[0].redo_reason, "se ve oscuro");
assert.match(await page.locator("[data-take='take-1']").innerText(), /oscuro/);
await ctx.close();
await browser.close();
assert.deepEqual(errors, []);
assert.ok(fs.existsSync(path.join(SHOTS, "manager.png")));
if (MEDIA) assert.ok(fs.existsSync(path.join(MEDIA, "manager.png")));
console.log("manager viewer OK");
