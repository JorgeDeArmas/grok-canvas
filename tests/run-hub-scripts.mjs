// Hub v2: script sheet (A/B/C tabs + swipe), «Elegir este guion» pick payload, change/undo, Lo próximo, stat-tile jumps,
// detail sheets, hostile scene data. The mailbox is intercepted (nothing leaves the test).
// SCENE=<path to a decrypted hub scene.json> runs the same tap-through on real data (local QA only, never commit real scenes).
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || "/tmp/hub-shots";
const ORIGIN = "https://jorgedearmas.github.io";
const hubHtml = fs.readFileSync(path.join(ROOT, "hub.html"), "utf8");
const scenePath = process.env.SCENE || path.join(ROOT, "tests/fixtures/hub-scripts.json");
const scene = JSON.parse(fs.readFileSync(scenePath, "utf8"));
const REAL = !!process.env.SCENE;
const PREFIX = process.env.SHOT_PREFIX || (REAL ? "hub-v2" : "hub-v2-fixture");

assert.match(hubHtml, /img-src 'self' data:; connect-src 'self' https:\/\/webhook.site;/, "CSP: only data: images added");
assert.doesNotMatch(hubHtml, /\beval\s*\(|new\s+Function|document\.write|insertAdjacentHTML/);

const keyBytes = webcrypto.getRandomValues(new Uint8Array(32));
const keyText = Buffer.from(keyBytes).toString("base64url");
const key = await webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(scene))));
const blob = JSON.stringify({ iv: Buffer.from(iv).toString("base64"), ct: Buffer.from(ct).toString("base64") });
const BOX = "12345678-1234-1234-1234-123456789abc";
const URL_ = `${ORIGIN}/grok-canvas/hub.html#b=hubv2test&k=${keyText}&f=${BOX}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  .catch(() => chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
fs.mkdirSync(SHOTS, { recursive: true });
const errors = [], posts = [];

async function open(name, opts) {
  const ctx = await browser.newContext({ locale: "es-ES", ...opts });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === ORIGIN && u.pathname === "/grok-canvas/hub.html") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: hubHtml });
    if (u.origin === ORIGIN && u.pathname === "/grok-canvas/scenes/hubv2test.json") return route.fulfill({ status: 200, contentType: "application/json", body: blob });
    if (u.hostname === "webhook.site") {
      if (route.request().method() === "POST") posts.push({ path: u.pathname, body: JSON.parse(route.request().postData() || "{}") });
      return route.fulfill({ status: 200, body: "ok", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    }
    if (u.protocol === "data:") return route.continue();
    errors.push(name + " unexpected request " + u.origin + u.pathname);
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(name + " pageerror " + e.message));
  await page.goto(URL_);
  await page.waitForSelector(".next");
  return { ctx, page };
}

const lead = scene.sections.find((s) => s.lead);
const pickRows = lead.items.filter((i) => i.open && /^ff-\d{3}$/.test(String(i.open.scripts || "")) && scene.scripts[i.open.scripts]);
assert.ok(pickRows.length >= 1, "scene has at least one script row");

for (const dark of [false, true]) {
  const tag = dark ? "-dark" : "";
  const { ctx, page } = await open("iphone" + tag, { ...devices["iPhone 12"], viewport: { width: 390, height: 844 }, colorScheme: dark ? "dark" : "light" });
  // Home: Lo próximo = first script row, big CTA; every row is tappable.
  assert.match(await page.locator(".next .h").innerText(), new RegExp(pickRows[0].title.replace(/[()]/g, ".")));
  for (const r of await page.locator(".it").all()) assert.equal(await r.getAttribute("role"), "button");
  const small = await page.$$eval("button, a.go, a.ghost", (els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim()));
  assert.deepEqual(small, [], "all visible tap targets ≥ 44px");
  await page.screenshot({ path: path.join(SHOTS, `${PREFIX}-home${tag}.png`) });
  if (!dark) await page.screenshot({ path: path.join(SHOTS, `${PREFIX}-home-full.png`), fullPage: true });
  if (dark) { await ctx.close(); continue; }

  // Stat tile jump → Aprobar group flashes
  await page.locator('.ctr[data-jump="hoy:Aprobar"]').click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator(".flash").count(), 1, "tile jump highlights");

  for (const [n, row] of pickRows.entries()) {
    const ref = row.open.scripts, sc = scene.scripts[ref];
    await page.evaluate(() => document.getElementById("toast").classList.remove("on"));
    await page.locator(`.it[data-id="${row.id}"]`).click();
    await page.waitForSelector(".sheet.on .pane");
    await page.waitForTimeout(350);
    const letters = sc.options.map((o) => o.letter);
    assert.deepEqual(await page.locator(".tab").evaluateAll((b) => b.map((x) => x.dataset.tab)), letters);
    if (sc.recommended) assert.equal(await page.locator('.tab[aria-selected="true"]').getAttribute("data-tab"), sc.recommended, "opens on the recommended");
    const firstPane = page.locator(`.pane[data-letter="${sc.recommended || letters[0]}"]`);
    const o0 = sc.options.find((o) => o.letter === (sc.recommended || letters[0]));
    assert.ok((await firstPane.locator(".hook p").innerText()).length > 3, "hook visible");
    assert.equal(await firstPane.locator(".beat").count(), o0.beats.length, "every beat rendered");
    await page.screenshot({ path: path.join(SHOTS, `${PREFIX}-sheet-${ref}-${sc.recommended || letters[0]}.png`) });
    for (const L of letters) {
      await page.locator(`.tab[data-tab="${L}"]`).click();
      await page.waitForTimeout(450);
      assert.equal(await page.locator('.tab[aria-selected="true"]').getAttribute("data-tab"), L);
      assert.match(await page.locator("#shFoot").innerText(), new RegExp(`\\(${L}\\)|guion ${L}`));
      if (n === 0 && L === "B") await page.screenshot({ path: path.join(SHOTS, `${PREFIX}-sheet-${ref}-B.png`) });
    }
    // swipe back to the first pane: tab follows the scroll
    await page.locator("#panes").evaluate((p) => p.scrollTo({ left: 0 }));
    await page.waitForTimeout(450);
    assert.equal(await page.locator('.tab[aria-selected="true"]').getAttribute("data-tab"), letters[0], "swipe syncs tabs");
    if (n === 0) {
      // Pick B → optimistic confirmation + payload
      await page.locator('.tab[data-tab="B"]').click(); await page.waitForTimeout(400);
      const before = posts.length;
      await page.locator("#shFoot [data-pick]").click();
      await page.waitForTimeout(300);
      assert.match(await page.locator("#toastMsg").innerText(), /Elegiste B · preparando el pack/);
      assert.equal(posts.length, before + 1);
      const p = posts.at(-1);
      assert.equal(p.path, "/" + BOX);
      assert.equal(p.body.kind, "pick"); assert.equal(p.body.v, 1); assert.equal(p.body.job, ref); assert.equal(p.body.letter, "B");
      assert.ok(!Number.isNaN(Date.parse(p.body.at)));
      assert.match(await page.locator("#shFoot").innerText(), /Elegiste B/);
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(SHOTS, `${PREFIX}-after-pick-sheet.png`) });
      // change mind → C
      await page.locator('.tab[data-tab="C"]').click(); await page.waitForTimeout(400);
      assert.match(await page.locator("#shFoot").innerText(), /Cambiar a guion C/);
      await page.locator("#shFoot [data-pick]").click(); await page.waitForTimeout(300);
      assert.equal(posts.at(-1).body.letter, "C");
      await page.locator("#shClose").first().click(); await page.waitForTimeout(400);
      const rowTxt = await page.locator(`.it[data-id="${row.id}"]`).innerText();
      assert.match(rowTxt, /Elegiste C/); assert.match(rowTxt, /Cambiar/);
      if (pickRows[1]) assert.match(await page.locator(".next .h").innerText(), new RegExp(pickRows[1].title.replace(/[()]/g, ".")), "Lo próximo moves on");
      assert.equal(await page.locator('.ctr[data-jump="hoy:Aprobar"] b').innerText(), String(lead.items.filter((i) => i.group === "Aprobar").length - 1), "tile counts the pick right away");
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOTS, `${PREFIX}-after-pick-home.png`) });
      // persists across reload
      await page.reload(); await page.waitForSelector(".next");
      assert.match(await page.locator(`.it[data-id="${row.id}"]`).innerText(), /Elegiste C/);
      // undo the test pick («Quitar elección») so nothing is left picked on this device
      await page.locator(`.it[data-id="${row.id}"]`).click(); await page.waitForSelector(".sheet.on .pane"); await page.waitForTimeout(350);
      await page.locator('#shFoot [data-pick=""]').click(); await page.waitForTimeout(300);
      assert.equal(posts.at(-1).body.letter, "");
      await page.locator("#shClose").first().click(); await page.waitForTimeout(400);
      assert.doesNotMatch(await page.locator(`.it[data-id="${row.id}"]`).innerText(), /Elegiste/);
    } else {
      await page.locator("#shClose").first().click(); await page.waitForTimeout(400);
    }
  }
  // Detail sheet for a non-script row (first row with detail)
  const det = scene.sections.flatMap((s) => s.items).find((i) => i.detail && !(i.open && i.open.scripts));
  if (det) {
    await page.locator(`.it[data-id="${det.id}"]`).first().click();
    await page.waitForSelector(".sheet.on .det");
    await page.waitForTimeout(300);
    assert.ok(await page.locator(".sheet .fact").count() >= 1);
    await page.screenshot({ path: path.join(SHOTS, `${PREFIX}-detail.png`) });
    await page.locator("#shClose").first().click(); await page.waitForTimeout(300);
  }
  if (!REAL) {
    assert.equal(await page.locator("#pwn3").count(), 0, "scene markup never renders");
    // hostile ref: row has no script button
    assert.equal(await page.locator('.it[data-id="ff:ff-999:pick"] [data-scripts]').count(), 0);
    await page.locator('.it[data-id="ff:ff-901:pick"]').click(); await page.waitForSelector(".sheet.on .pane"); await page.waitForTimeout(300);
    assert.equal(await page.locator('.pane[data-letter="B"] a').count(), 0, "javascript: donor dropped");
    assert.equal(await page.locator('.pane[data-letter="A"] a').getAttribute("href"), "https://www.tiktok.com/@donor.demo/video/1234567890");
  }
  await ctx.close();
}

// Desktop sanity
{
  const { ctx, page } = await open("desktop", { viewport: { width: 1280, height: 900 } });
  await page.screenshot({ path: path.join(SHOTS, `${PREFIX}-desktop.png`) });
  await ctx.close();
}
await browser.close();
assert.deepEqual(errors, []);
console.log(`ok hub v2 script sheet (${REAL ? "real scene" : "fixture"}); posts intercepted: ${posts.length}; shots in ${SHOTS}`);
