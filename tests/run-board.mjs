// Unified board: reference, scenes, script copy, optional upload. Plain Spanish.
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
const html = fs.readFileSync(path.join(ROOT, "board.html"), "utf8");
assert.match(html, /default-src 'none'; script-src 'unsafe-inline'/);
assert.match(html, /Graba en 1080p/);
assert.doesNotMatch(html, /\beval\s*\(|new\s+Function|document\.write|insertAdjacentHTML|#k=/);
assert.doesNotMatch(html, /ACCIÓN:|como el donor|Sin beats/);

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wAAAAD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAD/AP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8Af//Z";
const JPEG_BYTES = Uint8Array.from(Buffer.from(JPEG.split(",")[1], "base64"));
const IMG_ENC = "media/m0123456789abcdef.enc";
const VID_ENC = "media/mfedcba9876543210.enc";
const ENC_IMG = { enc: true, src: IMG_ENC, mime: "image/jpeg" };
const ENC_VID = { enc: true, src: VID_ENC, mime: "video/mp4" };

const keyBytes = webcrypto.getRandomValues(new Uint8Array(32));
const keyText = Buffer.from(keyBytes).toString("base64url");
const aesKey = await webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
async function sealMedia(raw) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, raw));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0); out.set(ct, 12);
  return out;
}
const sealedImg = await sealMedia(JPEG_BYTES);
const sealedVid = await sealMedia(JPEG_BYTES);

const fixture = {
  type: "board", id: "FF-003", name: "Toplux magnesio",
  script: "SHOT 01\nAbre el pomo y enseña la etiqueta.",
  beats: [
    { shot: 1, vo: "Mira esto", do_es: "Abre el pomo con la mano derecha.", refFrame: ENC_IMG, ourFrame: ENC_IMG }
  ],
  shots: [{ shot: 1, takes: 1 }],
  refSrc: ENC_VID
};
const sceneIv = webcrypto.getRandomValues(new Uint8Array(12));
const sceneCt = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv: sceneIv }, aesKey, new TextEncoder().encode(JSON.stringify(fixture))));
const sealed = JSON.stringify({ iv: Buffer.from(sceneIv).toString("base64"), ct: Buffer.from(sceneCt).toString("base64") });

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  .catch(() => chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
fs.mkdirSync(SHOTS, { recursive: true });
if (MEDIA) fs.mkdirSync(MEDIA, { recursive: true });
const errors = [];
const ctx = await browser.newContext({ locale: "es-ES", permissions: ["clipboard-read", "clipboard-write"], ...devices["iPhone 13"] });
await ctx.route("**/*", (route) => {
  const u = new URL(route.request().url());
  if (u.origin === ORIGIN && u.pathname === "/grok-canvas/board.html") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
  if (u.origin === ORIGIN && u.pathname === "/grok-canvas/scenes/boardtest.json") return route.fulfill({ status: 200, contentType: "application/json", body: sealed });
  if (u.origin === ORIGIN && u.pathname === "/grok-canvas/" + IMG_ENC) {
    return route.fulfill({ status: 200, contentType: "application/octet-stream", body: Buffer.from(sealedImg) });
  }
  if (u.origin === ORIGIN && u.pathname === "/grok-canvas/" + VID_ENC) {
    return route.fulfill({ status: 200, contentType: "application/octet-stream", body: Buffer.from(sealedVid) });
  }
  errors.push("unexpected " + u.origin + u.pathname);
  return route.abort();
});
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("pageerror " + e.message));
await page.addInitScript(() => {
  window.__copied = [];
  const write = (t) => { window.__copied.push(String(t)); return Promise.resolve(); };
  if (navigator.clipboard) navigator.clipboard.writeText = write;
  else Object.defineProperty(navigator, "clipboard", { value: { writeText: write } });
});
await page.goto(`${ORIGIN}/grok-canvas/board.html#b=boardtest&k=${keyText}`);
await page.waitForSelector("#sec-ref");
const ids = await page.locator("article").evaluateAll((els) => els.filter((e) => !e.hidden).map((e) => e.id));
assert.deepEqual(ids, ["sec-ref", "sec-board", "sec-script"]);
const boardTxt = await page.locator("#sec-board").innerText();
assert.doesNotMatch(boardTxt, /ACCIÓN|donor|\bVO\b|\bpack\b|\bbeats?\b/i);
assert.match(boardTxt, /Referencia/);
assert.match(boardTxt, /La nuestra/);
assert.match(boardTxt, /Abre el pomo/);
assert.match(boardTxt, /Mira esto/);
await page.click("#copy-script");
const copied = await page.evaluate(() => window.__copied);
assert.ok(copied.some((t) => t.includes("SHOT 01")));
await page.waitForFunction(() => {
  const v = document.querySelector("#sec-ref video");
  const imgs = [...document.querySelectorAll("#sec-board img")];
  return v && (v.src || "").startsWith("blob:") && imgs.length >= 2;
});
await page.screenshot({ path: path.join(SHOTS, "unified-board.png") });
if (MEDIA) { try { fs.copyFileSync(path.join(SHOTS, "unified-board.png"), path.join(MEDIA, "unified-board.png")); } catch (e) {} }
await ctx.close();
await browser.close();
assert.deepEqual(errors, []);
assert.ok(fs.existsSync(path.join(SHOTS, "unified-board.png")));
console.log("unified board OK");
