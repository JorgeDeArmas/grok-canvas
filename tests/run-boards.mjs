// «Todos los boards» viewer test: phone + dark render, newest first, avatar + type filters (remembered),
// violation note, «sin link» rows, hostile data (bad links, html, thumbs) and no network besides the scene.
// SCENE_FILE=/path/boards_scene.json renders a real (local-only) scene instead of the synthetic fixture.
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || "/opt/cursor/artifacts/screenshots";
const ORIGIN = "https://jorgedearmas.github.io";
const html = fs.readFileSync(path.join(ROOT, "boards.html"), "utf8");
assert.match(html, /default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self';/);
assert.doesNotMatch(html, /\beval\s*\(|new\s+Function|document\.write|insertAdjacentHTML|webhook\.site/);
const B = (k) => `https://jorgedearmas.github.io/grok-canvas/index.html#b=${k}&k=key${k}`;
const fixture = {
  type: "boards", version: 1, updatedAt: new Date().toISOString(),
  kinds: [{ id: "ai", label: "Video IA" }, { id: "film", label: "Board de grabación" }],
  boards: [
    { id: "a1", code: "JOB-40", name: "Magnesio Demo", avatar: "miamix", kind: "ai", status: "Violación", tone: "bad", date: "2026-10-03T15:38", board: B("a1"), note: "TikTok Shop lo marcó como contenido engañoso.", noteTone: "bad" },
    { id: "a2", code: "JOB-38", name: "Spray Demo", avatar: "bella", kind: "ai", status: "Entregado", tone: "info", date: "2026-10-03T07:43", board: B("a2") },
    { id: "f1", code: "FF-007", name: "Selladora Demo", avatar: "miamix", kind: "film", status: "Board listo", tone: "warn", date: "2026-10-02T07:23", board: B("f1") },
    { id: "f2", code: "FF-006", name: "Cortina Demo", avatar: "miamix", kind: "film", status: "Board listo", tone: "warn", date: "2026-10-02T07:20", board: "", missing: "Sin link: la llave se perdió." },
    { id: "x1", code: "JOB-99", name: "<img src=x id=pwn1>", avatar: "bella", kind: "ai", status: "<b id=pwn2>x</b>", tone: "evil", date: "2026-09-01", board: "javascript:alert(1)", thumb: "javascript:alert(1)" },
    { id: "x2", code: "JOB-98", name: "Otro host", avatar: "bella", kind: "ai", status: "Board listo", tone: "warn", date: "2026-09-02", board: "https://evil.example/grok-canvas/index.html#k=1" },
    { id: "x3", name: "Tipo raro", avatar: "bella", kind: "zzz", status: "x", date: "2026-09-03", board: B("x3") }
  ],
  footer: ["1 board sin link."]
};
const scene = process.env.SCENE_FILE ? JSON.parse(fs.readFileSync(process.env.SCENE_FILE, "utf8")) : fixture;
const keyBytes = webcrypto.getRandomValues(new Uint8Array(32));
const keyText = Buffer.from(keyBytes).toString("base64url");
const key = await webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(scene))));
const blob = JSON.stringify({ iv: Buffer.from(iv).toString("base64"), ct: Buffer.from(ct).toString("base64") });
const URL_ = `${ORIGIN}/grok-canvas/boards.html#b=bdtest&k=${keyText}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  .catch(() => chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
fs.mkdirSync(SHOTS, { recursive: true });
const errors = [];
async function open(name, opts) {
  const ctx = await browser.newContext({ locale: "es-ES", ...opts });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === ORIGIN && u.pathname === "/grok-canvas/boards.html") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    if (u.origin === ORIGIN && u.pathname === "/grok-canvas/scenes/bdtest.json") return route.fulfill({ status: 200, contentType: "application/json", body: blob });
    errors.push(name + " unexpected request " + u.origin + u.pathname); return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(name + " pageerror " + e.message));
  await page.goto(URL_);
  await page.waitForSelector(".card, .empty");
  return { ctx, page };
}
{
  const { ctx, page } = await open("iphone", { ...devices["iPhone 13"] });
  await page.screenshot({ path: path.join(SHOTS, "boards-phone.png"), fullPage: true });
  if (!process.env.SCENE_FILE) {
    const ids = await page.locator(".card").evaluateAll((els) => els.map((e) => e.dataset.b));
    assert.deepEqual(ids, ["a1", "a2", "f1", "f2", "x2", "x1"], "newest first, unknown kind dropped");
    assert.equal(await page.locator("#pwn1, #pwn2").count(), 0, "no html injection");
    assert.equal(await page.locator('[data-b="x1"] a.btn, [data-b="x2"] a.btn, [data-b="f2"] a.btn').count(), 0, "bad/missing links get no button");
    assert.match(await page.locator('[data-b="f2"]').innerText(), /llave se perdió/);
    assert.match(await page.locator('[data-b="a1"] .note').innerText(), /engañoso/);
    assert.equal(await page.locator('[data-b="a1"] a.btn').getAttribute("href"), B("a1"));
    await page.click('[data-av="bella"]');
    assert.deepEqual(await page.locator(".card").evaluateAll((els) => els.map((e) => e.dataset.b)), ["a2", "x2", "x1"]);
    await page.click('[data-av="miamix"]'); await page.click('[data-kind="film"]');
    assert.deepEqual(await page.locator(".card").evaluateAll((els) => els.map((e) => e.dataset.b)), ["f1", "f2"]);
    await page.reload(); await page.waitForSelector(".card");
    assert.equal(await page.locator('[data-kind="film"]').getAttribute("aria-pressed"), "true", "filter remembered");
    const tap = await page.locator('[data-av="bella"]').boundingBox();
    assert.ok(tap.height >= 36, "segment tap target");
    const btn = await page.locator("a.btn").first().boundingBox();
    assert.ok(btn.height >= 44, "Abrir board ≥ 44 px");
  }
  await ctx.close();
}
{
  const { ctx, page } = await open("dark", { ...devices["iPhone 13"], colorScheme: "dark" });
  await page.screenshot({ path: path.join(SHOTS, "boards-phone-dark.png"), fullPage: true });
  await ctx.close();
}
await browser.close();
assert.deepEqual(errors, []);
console.log("boards viewer OK");
