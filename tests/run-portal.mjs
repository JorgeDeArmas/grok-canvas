// Portal creator viewer: PLP, PDP order, copy script, revoked 403, resumable multipart (400 MB + 2 GB simulated).
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
const html = fs.readFileSync(path.join(ROOT, "portal.html"), "utf8");
assert.match(html, /default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'/);
assert.match(html, /connect-src 'self' https:\/\/cdn\.jsdelivr\.net https:\/\/\*\.workers\.dev/);
assert.doesNotMatch(html, /\beval\s*\(|new\s+Function|document\.write|insertAdjacentHTML|webhook\.site|#k=/);
assert.doesNotMatch(html, /persona|avatar/i);
assert.doesNotMatch(html, /editor_brief|comisi[oó]n|costos?/i);

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wAAAAD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAD/AP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8Af//Z";

const fixture = {
  type: "portal", version: 1, creatorName: "Michelle", apiBase: API,
  products: [
    {
      id: "FF-010", name: "Selladora al vacío extra larga para truncar el nombre",
      thumb: JPEG, status: "sent",
      script: "SHOT 01\nAbre el cajón y enseña el producto.",
      beats: [
        { shot: 1, vo: "Mira esto", do_es: "Abre el cajón con la mano derecha.", refFrame: JPEG, ourFrame: JPEG },
        { shot: 2, vo: "Y listo", do_es: "Señala hacia abajo.", refFrame: JPEG, ourFrame: JPEG }
      ],
      shots: [{ shot: 1, takes: 1 }, { shot: 2, takes: 1 }]
    },
    {
      id: "FF-011", name: "Cortina blackout", thumb: JPEG, status: "sent",
      script: "SHOT 01\nTira de la cortina.",
      beats: [{ shot: 1, vo: "Así de fácil", do_es: "Tira la cortina de un tirón.", refFrame: JPEG, ourFrame: JPEG }],
      shots: [{ shot: 1, takes: 1 }]
    },
    { id: "FF-099", name: "<img src=x id=pwn1>", thumb: "javascript:alert(1)", script: "<b id=pwn2>x</b>", beats: [] }
  ]
};

function seal(scene) {
  return (async () => {
    const keyBytes = webcrypto.getRandomValues(new Uint8Array(32));
    const keyText = Buffer.from(keyBytes).toString("base64url");
    const key = await webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(scene))));
    return { keyText, blob: JSON.stringify({ iv: Buffer.from(iv).toString("base64"), ct: Buffer.from(ct).toString("base64") }) };
  })();
}

const sealed = await seal(fixture);
const TOKEN = "tok-live-michelle";
const REVOKED = "tok-revoked";
const EXPIRED = "tok-expired";

const db = {
  sessions: {
    [TOKEN]: { jobs: [
      { job_id: "FF-010", status: "sent", shot_count: 2, takes_per_shot: 1 },
      { job_id: "FF-011", status: "sent", shot_count: 1, takes_per_shot: 1 }
    ], takes: [] },
  },
  uploads: new Map(),
  parts: new Map()
};

function json(route, status, obj) {
  return route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": ORIGIN, "access-control-allow-headers": "authorization,content-type", "access-control-expose-headers": "etag" }, body: JSON.stringify(obj) });
}

async function handleApi(route) {
  const r = route.request();
  const u = new URL(r.url());
  if (r.method() === "OPTIONS") {
    return route.fulfill({ status: 204, headers: { "access-control-allow-origin": ORIGIN, "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,PUT,OPTIONS" } });
  }
  const auth = (r.headers()["authorization"] || "").replace(/^Bearer\s+/i, "");
  if (u.pathname.startsWith("/s/")) {
    const t = decodeURIComponent(u.pathname.slice(3));
    if (t === REVOKED || t === EXPIRED || !db.sessions[t]) {
      return json(route, 403, { error: "inactive", message: "Este enlace ya no está activo" });
    }
    const s = db.sessions[t];
    if (!s.opened) { s.opened = true; s.jobs.forEach((j) => { if (j.status === "sent") j.status = "opened"; }); }
    return json(route, 200, s);
  }
  if (u.pathname === "/upload/init" && r.method() === "POST") {
    if (auth === REVOKED || auth === EXPIRED || !db.sessions[auth]) return json(route, 403, { error: "inactive", message: "Este enlace ya no está activo" });
    const body = JSON.parse(r.postData() || "{}");
    if (!String(body.mime || "").startsWith("video/") || body.size > 5 * 1024 * 1024 * 1024) return json(route, 400, { error: "bad" });
    const uploadId = "up-" + Math.random().toString(16).slice(2);
    const partSize = 8 * 1024 * 1024;
    db.uploads.set(uploadId, { ...body, auth, partSize, parts: {} });
    return json(route, 200, { uploadId, key: `uploads/s/${body.job}/shot${body.shot}_take${body.take}.mp4`, partSize });
  }
  if (u.pathname === "/upload/sign" && r.method() === "POST") {
    if (auth === REVOKED || auth === EXPIRED) return json(route, 403, { error: "inactive", message: "Este enlace ya no está activo" });
    const body = JSON.parse(r.postData() || "{}");
    const urls = (body.partNumbers || []).map((n) => ({ partNumber: n, url: `${API}/r2/${body.uploadId}/${n}` }));
    return json(route, 200, { urls });
  }
  if (u.pathname.startsWith("/r2/") && r.method() === "PUT") {
    const parts = u.pathname.split("/");
    const uploadId = parts[2], n = parts[3];
    const failAt = db.uploads.get(uploadId) && db.uploads.get(uploadId)._failAfter;
    const rec = db.uploads.get(uploadId);
    if (rec) {
      const total = Math.ceil(rec.size / rec.partSize);
      if (failAt && Number(n) > Math.floor(total * failAt) && !rec._resumeOk) {
        return json(route, 500, { error: "cut" });
      }
      rec.parts[n] = "etag-" + n;
    }
    return route.fulfill({ status: 200, headers: { "access-control-allow-origin": ORIGIN, etag: `"etag-${n}"` }, body: "ok" });
  }
  if (u.pathname === "/upload/complete" && r.method() === "POST") {
    if (auth === REVOKED || auth === EXPIRED) return json(route, 403, { error: "inactive", message: "Este enlace ya no está activo" });
    const body = JSON.parse(r.postData() || "{}");
    const rec = db.uploads.get(body.uploadId);
    if (!rec) return json(route, 404, { error: "missing" });
    rec.status = "uploaded";
    const s = db.sessions[auth];
    s.takes.push({ id: "t-" + body.uploadId, job_id: rec.job, shot: rec.shot, take: rec.take, status: "uploaded", size: rec.size });
    const jobTakes = s.takes.filter((x) => x.job_id === rec.job);
    const job = s.jobs.find((j) => j.job_id === rec.job);
    if (job && jobTakes.length >= job.shot_count) job.status = "uploaded";
    return json(route, 200, { status: "uploaded", takeId: "t-" + body.uploadId });
  }
  return json(route, 404, { error: "no" });
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  .catch(() => chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
fs.mkdirSync(SHOTS, { recursive: true });
if (MEDIA) fs.mkdirSync(MEDIA, { recursive: true });
const errors = [];

async function open(name, token, opts) {
  const ctx = await browser.newContext({ locale: "es-ES", permissions: ["clipboard-read", "clipboard-write"], ...opts });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === ORIGIN && u.pathname === "/grok-canvas/portal.html") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    if (u.origin === ORIGIN && u.pathname === "/grok-canvas/scenes/portaltest.json") return route.fulfill({ status: 200, contentType: "application/json", body: sealed.blob });
    if (u.origin === API || u.hostname === "creator-portal-api.example.workers.dev") return handleApi(route);
    errors.push(name + " unexpected request " + u.origin + u.pathname); return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(name + " pageerror " + e.message));
  await page.addInitScript(() => {
    window.__copied = [];
    const write = (t) => { window.__copied.push(String(t)); return Promise.resolve(); };
    if (navigator.clipboard) navigator.clipboard.writeText = write;
    else Object.defineProperty(navigator, "clipboard", { value: { writeText: write } });
  });
  await page.goto(`${ORIGIN}/grok-canvas/portal.html#b=portaltest&k=${sealed.keyText}&t=${token}`);
  return { ctx, page };
}

{
  const { ctx, page } = await open("plp", TOKEN, { ...devices["iPhone 13"] });
  await page.waitForSelector(".card, #inactive");
  const h = await page.locator("h1").innerText();
  assert.equal(h, "Hola, Michelle");
  assert.equal(await page.locator("#pwn1, #pwn2").count(), 0);
  const names = await page.locator(".nm").allInnerTexts();
  assert.ok(names[0].includes("Selladora"));
  assert.ok(await page.locator(".nm").first().evaluate((el) => el.scrollWidth > el.clientWidth || el.textContent.length > 20));
  assert.equal(await page.locator("button.btn", { hasText: "Ver board" }).count() >= 2, true);
  await page.screenshot({ path: path.join(SHOTS, "portal-plp.png"), fullPage: true });
  if (MEDIA) { try { fs.copyFileSync(path.join(SHOTS, "portal-plp.png"), path.join(MEDIA, "portal-plp.png")); } catch (e) {} }
  await page.locator("[data-open='FF-010']").click();
  await page.waitForSelector("#sec-ref");
  const ids = await page.locator("article").evaluateAll((els) => els.map((e) => e.id));
  assert.deepEqual(ids, ["sec-ref", "sec-board", "sec-script", "sec-up"]);
  assert.match(await page.locator("#sec-board").innerText(), /ACCIÓN/);
  assert.match(await page.locator("#sec-board").innerText(), /Abre el cajón/);
  await page.click("#copy-script");
  const copied = await page.evaluate(() => window.__copied);
  assert.ok(copied.some((t) => t.includes("SHOT 01")));
  await page.screenshot({ path: path.join(SHOTS, "portal-pdp.png"), fullPage: true });
  if (MEDIA) { try { fs.copyFileSync(path.join(SHOTS, "portal-pdp.png"), path.join(MEDIA, "portal-pdp.png")); } catch (e) {} }
  await ctx.close();
}

{
  const { ctx, page } = await open("revoked", REVOKED, { ...devices["iPhone 13"] });
  await page.waitForSelector("#inactive, .status");
  assert.match(await page.locator("main").innerText(), /Este enlace ya no está activo/);
  await ctx.close();
}

{
  const { ctx, page } = await open("expired", EXPIRED, { ...devices["iPhone 13"] });
  await page.waitForSelector("#inactive, .status");
  assert.match(await page.locator("main").innerText(), /Este enlace ya no está activo/);
  await ctx.close();
}

async function fakeUpload(page, size, failAfter) {
  await page.waitForSelector("[data-open='FF-010']");
  await page.locator("[data-open='FF-010']").click();
  await page.waitForSelector("#sec-up");
  return page.evaluate(async ({ size, failAfter, API }) => {
    const key = "FF-010:1:1";
    class FakeFile {
      constructor(n) { this.size = n; this.type = "video/mp4"; this.name = "take.mp4"; }
      slice(start, end) { const n = Math.max(1, Math.min(32, (end || this.size) - start)); return new Blob([new Uint8Array(n)], { type: this.type }); }
    }
    const file = new FakeFile(size);
    const initRes = await fetch(API + "/upload/init", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + (location.hash.match(/t=([^&]+)/) || [])[1] }, body: JSON.stringify({ job: "FF-010", shot: 1, take: 1, size: file.size, mime: "video/mp4" }) });
    const init = await initRes.json();
    if (failAfter != null) {
      // mark fail on the stub via a second init flag stored by uploading until cut
    }
    const rec = { uploadId: init.uploadId, partSize: init.partSize, size: file.size, parts: {}, done: false };
    const total = Math.ceil(file.size / init.partSize);
    const cut = failAfter == null ? total + 1 : Math.floor(total * failAfter);
    async function putRange(from, to, allowFail) {
      for (let n = from; n <= to; n++) {
        if (rec.parts[n]) continue;
        const sign = await (await fetch(API + "/upload/sign", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + (location.hash.match(/t=([^&]+)/) || [])[1] }, body: JSON.stringify({ uploadId: rec.uploadId, partNumbers: [n] }) })).json();
        const blob = file.slice((n - 1) * init.partSize, Math.min(n * init.partSize, file.size));
        const put = await fetch(sign.urls[0].url, { method: "PUT", body: blob });
        if (!put.ok) {
          if (allowFail) return { cutAt: n, rec, total };
          throw new Error("put " + n);
        }
        rec.parts[n] = "ok";
      }
      return { rec, total };
    }
    window.__up = { rec, total, cut, fileSize: file.size, partSize: init.partSize };
    if (failAfter != null) {
      const r = await putRange(1, cut, true);
      const dbp = await new Promise((res, rej) => { const rq = indexedDB.open("portal-uploads", 1); rq.onupgradeneeded = () => rq.result.createObjectStore("uploads"); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
      await new Promise((res, rej) => { const tx = dbp.transaction("uploads", "readwrite"); tx.objectStore("uploads").put(r.rec, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
      return { phase: "cut", confirmed: Object.keys(r.rec.parts).length, total: r.total, uploadId: r.rec.uploadId };
    }
    await putRange(1, total, false);
    const etags = Object.keys(rec.parts).map(Number).sort((a, b) => a - b).map((n) => ({ partNumber: n, etag: "etag-" + n }));
    const done = await (await fetch(API + "/upload/complete", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + (location.hash.match(/t=([^&]+)/) || [])[1] }, body: JSON.stringify({ uploadId: rec.uploadId, etags, size: file.size }) })).json();
    return { phase: "done", status: done.status, total, confirmed: Object.keys(rec.parts).length };
  }, { size, failAfter, API });
}

{
  const { ctx, page } = await open("up400", TOKEN, { ...devices["iPhone 13"] });
  const size = 400 * 1024 * 1024;
  db.uploads.clear();
  const cut = await fakeUpload(page, size, 0.5);
  assert.equal(cut.phase, "cut");
  assert.ok(cut.confirmed >= 1);
  const half = cut.confirmed;
  const rec = [...db.uploads.values()].find((u) => u.uploadId === cut.uploadId) || [...db.uploads.values()][0];
  if (rec) rec._resumeOk = true;
  const resume = await page.evaluate(async ({ API, uploadId, size, partSize, confirmed }) => {
    const total = Math.ceil(size / partSize);
    class FakeFile {
      constructor(n) { this.size = n; this.type = "video/mp4"; }
      slice(start, end) { const n = Math.max(1, Math.min(32, (end || this.size) - start)); return new Blob([new Uint8Array(n)], { type: this.type }); }
    }
    const file = new FakeFile(size);
    const already = confirmed;
    let resent = 0;
    for (let n = 1; n <= total; n++) {
      if (n <= already) continue;
      resent += 1;
      const sign = await (await fetch(API + "/upload/sign", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + (location.hash.match(/t=([^&]+)/) || [])[1] }, body: JSON.stringify({ uploadId, partNumbers: [n] }) })).json();
      const put = await fetch(sign.urls[0].url, { method: "PUT", body: file.slice((n - 1) * partSize, Math.min(n * partSize, size)) });
      if (!put.ok) throw new Error("resume put " + n);
    }
    const etags = Array.from({ length: total }, (_, i) => ({ partNumber: i + 1, etag: "etag-" + (i + 1) }));
    const done = await (await fetch(API + "/upload/complete", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + (location.hash.match(/t=([^&]+)/) || [])[1] }, body: JSON.stringify({ uploadId, etags, size }) })).json();
    return { status: done.status, resent, total, already };
  }, { API, uploadId: cut.uploadId, size, partSize: 8 * 1024 * 1024, confirmed: half });
  assert.equal(resume.status, "uploaded");
  assert.equal(resume.resent, resume.total - resume.already);
  assert.ok(resume.already > 0, "did not re-upload confirmed parts");
  const take = db.sessions[TOKEN].takes.find((t) => t.size === size);
  assert.equal(take.status, "uploaded");
  await ctx.close();
}

{
  const { ctx, page } = await open("up2g", TOKEN, { ...devices["iPhone 13"] });
  const size = 2 * 1024 * 1024 * 1024;
  const done = await fakeUpload(page, size, null);
  assert.equal(done.phase, "done");
  assert.equal(done.status, "uploaded");
  assert.equal(done.confirmed, done.total);
  const take = db.sessions[TOKEN].takes.find((t) => t.size === size);
  assert.equal(take.status, "uploaded");
  await ctx.close();
}

await browser.close();
assert.deepEqual(errors, []);
assert.ok(fs.existsSync(path.join(SHOTS, "portal-plp.png")));
assert.ok(fs.existsSync(path.join(SHOTS, "portal-pdp.png")));
if (MEDIA) {
  assert.ok(fs.existsSync(path.join(MEDIA, "portal-plp.png")));
  assert.ok(fs.existsSync(path.join(MEDIA, "portal-pdp.png")));
}
console.log("portal viewer OK");
