// Grabación viewer test: phone + desktop render, local ticks, batched text/plain sync (1 request), hostile data.
// SCENE_FILE=/path/scene.json uses a real (unencrypted, local-only) scene instead of the synthetic fixture.
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

const today = new Date(); const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const take = (j, n, r, label, extra = {}) => ({ id: `rec:${j}:s${String(n).padStart(2, "0")}:${r}`, label, file: `shot${String(n).padStart(2, "0")}${r === "m" ? "" : "_" + r.toUpperCase()}`, ...extra });
const fixture = {
  type: "filming", version: 1, title: "Grabación", updatedAt: new Date().toISOString(), today: iso(today),
  stages: ["Guion aprobado", "Pack listo", "Grabado", "Tomas en la Mac", "Editado", "Publicado"],
  icons: { Sala: "🛋️", Carro: "🚗" }, mailbox: "12345678-1234-1234-1234-123456789abc", ticks: {},
  products: { p1: { name: "Bálsamo Demo", thumb: "" }, p2: { name: "<img src=x id=pwn1>", thumb: "javascript:alert(1)" } },
  days: [{ id: iso(today), planTitle: "2 videos", plan: [{ when: "9:00", title: "Sala", body: "Trípode fijo" }] }],
  videos: [
    { id: "rec:t001", day: iso(today), place: "Sala", product: "p1", title: "Genérica vs Demo", hook: "¿Cuál le va mejor?", angle: "2 personajes", stage: 1, takeCount: 3,
      outfit: ["camiseta blanca", "camiseta negra"], props: ["Pote demo", "Trípode"], board: "https://jorgedearmas.github.io/grok-canvas/index.html#b=x&k=y",
      shots: [{ n: 1, do: "Los dos cerca del lente", takes: [take("t001", 1, "l", "Izquierda · blanca"), take("t001", 1, "r", "Derecha · negra")] },
              { n: 2, do: "Solo", takes: [take("t001", 2, "m", "Toma"), take("t001", 2, "ins", "Captura", { optional: true })] }] },
    { id: "rec:t002", day: iso(today), place: "Carro", product: "p2", title: "<b id=pwn2>x</b>", hook: "", stage: 1, takeCount: 1,
      outfit: [], props: [], board: "javascript:alert(1)", shots: [{ n: 1, do: "x", takes: [take("t002", 1, "m", "Toma")] }] },
    { id: "BAD ID", day: iso(today), place: "Sala", product: "p1", title: "nope", shots: [] }
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
  await page.waitForSelector(".vid, .empty");
  return { ctx, page };
}

{
  const { ctx, page } = await open("iphone", { ...devices["iPhone 13"] });
  await page.screenshot({ path: path.join(SHOTS, "grabacion_iphone.png"), fullPage: !!process.env.FULL });
  if (!process.env.SCENE_FILE) {
    assert.equal(await page.locator("#pwn1, #pwn2").count(), 0, "scene markup must not render");
    assert.equal(await page.locator('a[href^="javascript"]').count(), 0);
    assert.equal(await page.locator('[data-v="BAD ID"]').count(), 0);
    assert.equal(await page.locator('img[src^="javascript"]').count(), 0);
    assert.doesNotMatch(await page.locator("main").innerText(), /FF-\d{3}|\/workspace|webhook/);
    // tick one take -> instant local state, one batched text/plain POST
    await page.locator('[data-tick="rec:t001:s01:l"]').click();
    assert.equal(await page.locator('[data-tick="rec:t001:s01:l"]').getAttribute("aria-checked"), "true");
    await page.waitForTimeout(400);
    assert.equal(posts.length, 1, "first tick syncs once");
    assert.match(posts[0].ct, /^text\/plain/); assert.equal(posts[0].method, "POST");
    const body = JSON.parse(posts[0].body); assert.equal(body.kind, "ticks"); assert.deepEqual(Object.keys(body.set), ["rec:t001:s01:l"]);
    // second tick within 10 min: no new request, shows pending + «Enviar ahora»
    await page.locator('[data-tick="rec:t001:s01:r"]').click();
    await page.waitForTimeout(300);
    assert.equal(posts.length, 1, "throttled");
    assert.match(await page.locator("#sync").innerText(), /1 en el teléfono/);
    await page.locator("#sendNow").click(); await page.waitForTimeout(300);
    assert.equal(posts.length, 2); assert.deepEqual(Object.keys(JSON.parse(posts[1].body).set), ["rec:t001:s01:r"]);
    // persists across reload
    await page.reload(); await page.waitForSelector(".vid");
    assert.equal(await page.locator('[data-tick="rec:t001:s01:l"]').getAttribute("aria-checked"), "true");
    // «Marcar todo grabado» -> video leaves «Qué me falta hoy»; undo brings it back
    await page.locator('[data-all="rec:t001"]').click();
    assert.equal(await page.locator('[data-v="rec:t001"]').count(), 0);
    await page.locator("#undo").click();
    assert.equal(await page.locator('[data-v="rec:t001"]').count(), 1);
    // Semana + Hecho filter
    await page.locator('[data-all="rec:t001"]').click();
    await page.locator('.seg [data-view="semana"]').click(); await page.locator('#filters [data-f="done"]').click();
    assert.equal(await page.locator('[data-v="rec:t001"]').count(), 1);
    assert.equal(await page.locator('[data-v="rec:t002"]').count(), 0);
  }
  await ctx.close();
}
{
  const { ctx, page } = await open("desktop", { viewport: { width: 1280, height: 900 } });
  await page.locator('.seg [data-view="semana"]').click();
  await page.screenshot({ path: path.join(SHOTS, "grabacion_desktop.png"), fullPage: !!process.env.FULL });
  await ctx.close();
}
await browser.close();
assert.deepEqual(errors, []);
console.log("ok grabacion", posts.length, "posts");
