// Command center: filming first, all creators on one page, approve/redo, no live hub.html.
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
const html = fs.readFileSync(path.join(ROOT, "comando.html"), "utf8");
assert.match(html, /default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'/);
assert.doesNotMatch(html, /\beval\s*\(|new\s+Function|document\.write|insertAdjacentHTML|#k=/);
assert.doesNotMatch(html, /como el donor|ACCIÓN:|Ver video donor/i);
assert.match(html, /Mi grabación/);
assert.match(html, /data-view="creators"/);
assert.match(html, /comando\.html|Comando/);
const preview = fs.readFileSync(path.join(ROOT, "preview.html"), "utf8");
assert.doesNotMatch(preview, /#b=[A-Za-z0-9_-]+&k=/);
assert.match(preview, /Graba en 1080p/);
assert.match(preview, /Mi grabación/);
assert.doesNotMatch(fs.readFileSync(path.join(ROOT, "hub.html"), "utf8").slice(0, 80), /Comando/);

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wAAAAD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9k=";
const LINK = "https://jorgedearmas.github.io/grok-canvas/portal.html#b=demoblob&k=DEMOKEY&t=tok-ana";
const fixture = {
  type: "comando", title: "Miércoles 7 oct", updatedAt: new Date().toISOString(),
  portalApi: API, mailbox: "12345678-1234-1234-1234-123456789abc",
  thumbs: { p1: JPEG },
  creators: [{
    id: "sess-demo-ana", creatorName: "Ana", shootDate: "2026-10-11",
    expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    link: LINK, jobs: [{ job_id: "FF-020", name: "Sérum", status: "uploaded" }]
  }, {
    id: "sess-demo-camila", creatorName: "Camila", shootDate: "2026-10-18",
    expiresAt: new Date(Date.now() + 9 * 86400000).toISOString(),
    link: "https://jorgedearmas.github.io/grok-canvas/portal.html#b=other&k=OTHERKEY&t=tok-camila",
    jobs: [{ job_id: "FF-021", name: "Crema", status: "sent" }]
  }],
  quick: [{ label: "Todos los boards", sub: "12 boards", href: "https://jorgedearmas.github.io/grok-canvas/boards.html#b=x&k=y" }],
  sections: [
    { id: "hoy", title: "Hoy te toca", lead: true, items: [
      { id: "ff:ff-003:film", verb: "Grabar", title: "Toplux", sub: "baño", tone: "good", group: "Grabar", href: "https://jorgedearmas.github.io/grok-canvas/board.html#b=x&k=y", hrefLabel: "Abrir", thumb: "p1" }
    ]},
    { id: "grabar", title: "Por grabar", items: [
      { id: "ff:ff-003:film2", verb: "Grabar", title: "Toplux", sub: "6 tomas", tone: "good", group: "Baño", href: "https://jorgedearmas.github.io/grok-canvas/board.html#b=x&k=y", hrefLabel: "Abrir", thumb: "p1" },
      { id: "ff:ff-004:film", verb: "Grabar", title: "Cortina", sub: "4 tomas", tone: "good", group: "Sala", href: "https://jorgedearmas.github.io/grok-canvas/board.html#b=z&k=y", hrefLabel: "Abrir" }
    ], empty: "Nada que grabar." },
    { id: "productos", title: "Productos de la semana", items: [
      { id: "prod:1", title: "Sérum", sub: "llegó", chip: { text: "Listo", tone: "good" } }
    ], empty: "Ningún producto." },
    { id: "marcas", title: "Marcas", items: [], empty: "Sin tratos." }
  ]
};

const keyBytes = webcrypto.getRandomValues(new Uint8Array(32));
const keyText = Buffer.from(keyBytes).toString("base64url");
const key = await webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(fixture))));
const blob = JSON.stringify({ iv: Buffer.from(iv).toString("base64"), ct: Buffer.from(ct).toString("base64") });

const state = {
  sessions: [{
    id: "sess-demo-ana", creator_name: "Ana", shoot_date: "2026-10-11",
    expires_at: fixture.creators[0].expiresAt, revoked_at: null,
    jobs: [{ job_id: "FF-020", name: "Sérum", status: "uploaded" }],
    takes: [{ id: "take-ana-1", job_id: "FF-020", shot: 1, take: 1, status: "uploaded", redo_reason: "" }]
  }, {
    id: "sess-demo-camila", creator_name: "Camila", shoot_date: "2026-10-18",
    expires_at: fixture.creators[1].expiresAt, revoked_at: null,
    jobs: [{ job_id: "FF-021", name: "Crema", status: "sent" }],
    takes: []
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
  if (u.origin === ORIGIN && u.pathname === "/grok-canvas/comando.html") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
  if (u.origin === ORIGIN && u.pathname === "/grok-canvas/scenes/cmdtest.json") return route.fulfill({ status: 200, contentType: "application/json", body: blob });
  if (u.hostname === "webhook.site") return route.fulfill({ status: 200, body: "{}" });
  if (u.origin === API) {
    if (r.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": ORIGIN, "access-control-allow-headers": "authorization,content-type" } });
    const auth = (r.headers()["authorization"] || "");
    if (!auth.includes("mgr-token")) return json(route, 401, { error: "no" });
    if (u.pathname === "/manager/sessions") return json(route, 200, { sessions: state.sessions });
    if (u.pathname === "/manager/takes/take-ana-1/url") return json(route, 200, { url: `${API}/manager/takes/take-ana-1/file?ticket=tix-1` });
    if (u.pathname === "/manager/takes/take-ana-1/file" && u.searchParams.get("ticket") === "tix-1") {
      return route.fulfill({ status: 200, contentType: "video/mp4", headers: { "access-control-allow-origin": ORIGIN }, body: Buffer.from("x") });
    }
    if (u.pathname === "/manager/takes/take-ana-1/approve" && r.method() === "POST") {
      state.sessions[0].takes[0].status = "approved";
      state.sessions[0].jobs[0].status = "approved";
      return json(route, 200, { status: "approved" });
    }
    if (u.pathname === "/manager/takes/take-ana-1/redo" && r.method() === "POST") {
      const body = JSON.parse(r.postData() || "{}");
      state.sessions[0].takes[0].status = "redo";
      state.sessions[0].takes[0].redo_reason = body.reason || "otra toma";
      return json(route, 200, { status: "redo" });
    }
    if (u.pathname.endsWith("/extend") && r.method() === "POST") return json(route, 200, { expires_at: new Date(Date.now() + 5 * 86400000).toISOString() });
    if (u.pathname.endsWith("/revoke") && r.method() === "POST") {
      state.sessions[0].revoked_at = new Date().toISOString();
      return json(route, 200, { revoked: true });
    }
    return json(route, 404, { error: "no" });
  }
  errors.push("unexpected " + u.origin + u.pathname);
  return route.abort();
});
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("pageerror " + e.message));
await page.goto(`${ORIGIN}/grok-canvas/comando.html#b=cmdtest&k=${keyText}&m=mgr-token`);
await page.waitForSelector("section");
assert.equal(await page.locator("h1").innerText(), "Comando");
assert.match(await page.locator("main").innerText(), /Mi grabación/);
assert.match(await page.locator("main").innerText(), /Toplux/);
assert.doesNotMatch(await page.locator("body").innerText(), /donor|ACCIÓN|framework/i);
await page.screenshot({ path: path.join(SHOTS, "command-center.png") });
if (MEDIA) { try { fs.copyFileSync(path.join(SHOTS, "command-center.png"), path.join(MEDIA, "command-center.png")); } catch (e) {} }

await page.locator('[data-view="creators"]').click();
await page.waitForSelector("[data-creator]");
assert.match(await page.locator("main").innerText(), /Ana/);
assert.match(await page.locator("main").innerText(), /Camila/);
assert.match(await page.locator("main").innerText(), /Aprobar/);
assert.match(await page.locator("main").innerText(), /Copiar link/);
await page.locator('[data-approve="take-ana-1"]').click();
await page.waitForFunction(() => document.body.innerText.includes("Aprobado"));
await page.screenshot({ path: path.join(SHOTS, "creators-section.png") });
if (MEDIA) { try { fs.copyFileSync(path.join(SHOTS, "creators-section.png"), path.join(MEDIA, "creators-section.png")); } catch (e) {} }

await ctx.close();
await browser.close();
assert.deepEqual(errors, []);
assert.ok(fs.existsSync(path.join(SHOTS, "command-center.png")));
assert.ok(fs.existsSync(path.join(SHOTS, "creators-section.png")));
console.log("comando viewer OK");
