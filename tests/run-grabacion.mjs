// Grabación viewer test (v2, minimal): phone + desktop + dark render, per-video marks saved locally,
// batched text/plain sync (1 request), undo, tabs, hostile data.
// SCENE_FILE=/path/scene.json renders a real (local-only) scene instead of the synthetic fixture.
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || "/opt/cursor/artifacts/screenshots";
const ORIGIN = "https://jorgedearmas.github.io";
const html = fs.readFileSync(path.join(ROOT, "grabacion.html"), "utf8");
assert.match(html, /default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self' https:\/\/webhook.site;/);
assert.doesNotMatch(html, /\beval\s*\(|new\s+Function|document\.write|insertAdjacentHTML/);

const fixture = {
  type: "filming", version: 2, title: "Grabación", updatedAt: new Date().toISOString(),
  mailbox: "12345678-1234-1234-1234-123456789abc", ticks: {},
  products: { p1: { name: "Bálsamo Demo", thumb: "" }, p2: { name: "<img src=x id=pwn1>", thumb: "javascript:alert(1)" }, p3: { name: "Tabla Demo", thumb: "" } },
  videos: [
    { id: "rec:t001", day: "2026-10-03", place: "Sala", product: "p1", title: "Genérica vs Demo", stage: 1, ready: true, board: "https://jorgedearmas.github.io/grok-canvas/index.html#b=x&k=y" },
    { id: "rec:t002", day: "2026-10-03", place: "Carro", product: "p2", title: "<b id=pwn2>x</b>", stage: 1, ready: true, board: "javascript:alert(1)" },
    { id: "rec:t003", day: "2026-10-03", place: "Carro", product: "p3", title: "Regalo", stage: 0, ready: false, board: "" },
    { id: "BAD ID", day: "2026-10-03", place: "Sala", product: "p1", title: "nope", ready: true }
  ]
};
const scene = process.env.SCENE_FILE ? JSON.parse(fs.readFileSync(process.env.SCENE_FILE, "utf8")) : fixture;
const keyBytes = webcrypto.getRandomValues(new Uint8Array(32));
const keyText = Buffer.from(keyBytes).toString("base64url");
const key = await webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(scene))));
const blob = JSON.stringify({ iv: Buffer.from(iv).toString("base64"), ct: Buffer.from(ct).toString("base64") });
const URL_ = `${ORIGIN}/grok-canvas/grabacion.html#b=rectest&k=${keyText}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  .catch(() => chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
fs.mkdirSync(SHOTS, { recursive: true });
const errors = [], posts = [];
async function open(name, opts) {
  const ctx = await browser.newContext({ locale: "es-ES", ...opts });
  await ctx.route("**/*", (route) => {
    const r = route.request(); const u = new URL(r.url());
    if (u.origin === ORIGIN && u.pathname === "/grok-canvas/grabacion.html") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    if (u.origin === ORIGIN && u.pathname === "/grok-canvas/scenes/rectest.json") return route.fulfill({ status: 200, contentType: "application/json", body: blob });
    if (u.hostname === "webhook.site") { posts.push({ name, method: r.method(), ct: r.headers()["content-type"], body: r.postData() }); return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: "ok" }); }
    errors.push(name + " unexpected request " + u.origin + u.pathname); return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(name + " pageerror " + e.message));
  await page.goto(URL_);
  await page.waitForSelector(".card, .empty");
  return { ctx, page };
}
const card = (page, id) => page.locator(`[data-v="${id}"]`);

{
  const { ctx, page } = await open("iphone", { ...devices["iPhone 13"] });
  await page.screenshot({ path: path.join(SHOTS, "grabacion_iphone.png"), fullPage: true });
  const main = await page.locator("main").innerText();
  assert.doesNotMatch(main, /tomas|shot\d|Props|Ropa|Plan del día|FF-\d{3}|\/workspace|webhook/i, "no noise, no codes");
  assert.equal(await page.locator(".pbar, .steps, details, [data-tick], [data-mode]").count(), 0, "no take checklist / steps / toggles");
  if (!process.env.SCENE_FILE) {
    assert.match(main, /Sábado 3 oct/); assert.match(main, /1 video listo para grabar · 0 de 1 grabado · 2 en camino/);
    assert.equal(await page.locator("#pwn1, #pwn2").count(), 0, "scene markup must not render");
    assert.equal(await page.locator('a[href^="javascript"], img[src^="javascript"]').count(), 0);
    assert.equal(await card(page, "BAD ID").count(), 0);
    assert.equal(await card(page, "rec:t002").locator("a.btn").count(), 0, "hostile board link -> no button");
    assert.match(await card(page, "rec:t003").innerText(), /Board en camino/);
    assert.equal(await card(page, "rec:t003").locator("button").count(), 0);
    assert.equal(await card(page, "rec:t001").locator("a.btn").getAttribute("href"), "https://jorgedearmas.github.io/grok-canvas/index.html#b=x&k=y");
    // mark -> moves to «Grabados», one text/plain POST
    await card(page, "rec:t001").locator("[data-mark]").click();
    assert.equal(await card(page, "rec:t001").count(), 0);
    await page.waitForTimeout(400);
    assert.equal(posts.length, 1); assert.match(posts[0].ct, /^text\/plain/);
    assert.deepEqual(Object.keys(JSON.parse(posts[0].body).set), ["rec:t001"]);
    // undo brings it back (second change is throttled -> «Enviar»)
    await page.locator("#undo").click();
    assert.equal(await card(page, "rec:t001").count(), 1);
    await page.waitForTimeout(300); assert.equal(posts.length, 1, "throttled");
    assert.match(await page.locator("#sync").innerText(), /1 sin enviar/);
    await page.locator("#sendNow").click(); await page.waitForTimeout(300);
    assert.equal(posts.length, 2); assert.equal(JSON.parse(posts[1].body).set["rec:t001"][0], 0);
    // mark again, reload: persisted, visible under «Grabados»
    await card(page, "rec:t001").locator("[data-mark]").click();
    await page.reload(); await page.waitForSelector(".card");
    assert.equal(await card(page, "rec:t001").count(), 0);
    await page.locator('.seg [data-view="done"]').click();
    assert.equal(await card(page, "rec:t001").count(), 1);
    assert.match(await page.locator("main").innerText(), /1 grabado/);
  }
  await ctx.close();
}
{
  const { ctx, page } = await open("iphone-dark", { ...devices["iPhone 13"], colorScheme: "dark" });
  await page.screenshot({ path: path.join(SHOTS, "grabacion_iphone_dark.png") });
  await ctx.close();
}
{
  const { ctx, page } = await open("desktop", { viewport: { width: 1280, height: 800 } });
  await page.screenshot({ path: path.join(SHOTS, "grabacion_desktop.png") });
  await ctx.close();
}
await browser.close();
assert.deepEqual(errors, []);
console.log("ok grabacion v2", posts.length, "posts");
