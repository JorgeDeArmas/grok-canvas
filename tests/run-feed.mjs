import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, webkit } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_PATH = path.join(ROOT, "tests", "fixtures", "creator-feed.json");
const SHOTS = "/opt/cursor/artifacts/screenshots";
const UUID = "12345678-1234-1234-1234-123456789abc";
const MEDIA_BASE = "https://cdn.jsdelivr.net/gh/JorgeDeArmas/grok-canvas@0000000000000000000000000000000000000000/media/";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "feed-fixture-"));
const errors = [];
const requests = [];

function b64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function b64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function importKey(keyBytes) {
  return webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
}

async function encryptScene(obj, cryptoKey) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, plain));
  return { iv: b64(iv), ct: b64(ct) };
}

async function encryptMedia(bytes, cryptoKey) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, bytes));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return Buffer.from(out);
}

function jpeg(color, w, h) {
  const file = path.join(tmp, `j-${color.replace("#", "")}-${w}x${h}.jpg`);
  if (!fs.existsSync(file)) {
    const run = spawnSync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", `color=c=${color}:s=${w}x${h}`,
      "-frames:v", "1", file
    ], { encoding: "utf8" });
    if (run.status !== 0) throw new Error(run.stderr || "ffmpeg jpeg failed");
  }
  return fs.readFileSync(file);
}

function mp4(color) {
  const file = path.join(tmp, `v-${color.replace("#", "")}.mp4`);
  if (!fs.existsSync(file)) {
    const run = spawnSync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", `color=c=${color}:s=160x288:d=1`,
      "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.0", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart", "-an", file
    ], { encoding: "utf8" });
    if (run.status !== 0) throw new Error(run.stderr || "ffmpeg mp4 failed");
  }
  return fs.readFileSync(file);
}

function filenameOf(src) {
  return String(src).split("?")[0].split("/").pop();
}

function colorFor(name, kind) {
  const table = {
    mfixture0c: "0x102a43",
    mfixture0i: "0xe07a3d",
    mfixture1c: "0x3d0c2e",
    mfixture1i: "0xe9c46a",
    mfixture2c: "0x0b3d2e",
    mfixture2i: "0x2a9d8f",
    mfixture3c: "0x4a2c0a",
    "ok-cover": "0x1d3557",
    "ok-thumb": "0xe76f51"
  };
  for (const key of Object.keys(table)) {
    if (name.includes(key)) return table[key];
  }
  return kind === "video" ? "0xfe2c55" : "0x222222";
}

function prepareVisual(raw) {
  const scene = structuredClone(raw);
  for (const card of scene.cards || []) {
    if (card.product && card.product.image && card.product.image.src) {
      card.product.image.src = card.product.image.src.replace(/mfixture(\d)p/, "mfixture$1i");
      card.product.image.mime = "image/jpeg";
    }
  }
  return scene;
}

function securityScene() {
  const media = (name) => MEDIA_BASE + name;
  return {
    type: "creator-feed",
    version: 1,
    title: "Security",
    subtitle: "fixture",
    updated_label: "Actualizado: 25 sep 2026, 9:07 a. m. ET",
    windows: [3, 7],
    counts: {
      outliers_por_ventana: { "3": 1, "7": 2 },
      tarjetas_por_ventana: { "3": 1, "7": 2 },
      tarjetas: 3,
      outliers_unicos: 3
    },
    creators: [
      { handle: "malo", count: 2 },
      { handle: "bueno", count: 1 }
    ],
    labels: {
      all: "Todas",
      creators_all: "Todos",
      open_tiktok: "Abrir en TikTok",
      no_product: "Producto sin identificar",
      verify: "Verificar afiliación/stock en Shop",
      empty: "No hay videos en esta ventana hoy.",
      tap_play: "Toca para ver",
      ad: "Anuncio",
      saves_na: "—"
    },
    method: "Fixture de seguridad.",
    cards: [
      {
        id: "bad",
        creator: "malo",
        url: "javascript:alert(1)",
        caption: "caption no renderizado si hay hook",
        hook: "<img src=x onerror=alert(1)>",
        age_label: "hace 1 d",
        metrics: { views: 100, likes: 1, comments: 1, shares: 1, saves: null },
        score: { value: 12, label: "GMV Max", coverage: 1 },
        windows: [{ w: 3, multiple: 2 }],
        best: { w: 3, multiple: 2, label: "2x su promedio (3d)" },
        is_ad: false,
        cover: { enc: true, src: "https://evil.example.com/blocked.enc", mime: "image/jpeg" },
        preview: {
          enc: false,
          src: media("do-not-fetch-encfalse.enc"),
          mime: "video/mp4"
        },
        product: {
          title: "\"><script>alert(1)</script>",
          price: "$1",
          commission: null,
          href: "javascript:alert(1)",
          image: { enc: false, src: media("do-not-fetch-product.enc"), mime: "image/jpeg" },
          verify: "no"
        }
      },
      {
        id: "bad-links",
        creator: "malo",
        url: "http://www.tiktok.com/@malo/video/2",
        caption: "http y data no son enlaces",
        hook: null,
        age_label: "hace 2 d",
        metrics: { views: 10, likes: 1, comments: 0, shares: 0, saves: 0 },
        score: { value: 55, label: "GMV Max" },
        windows: [{ w: 7, multiple: 2 }],
        best: { w: 7, multiple: 2, label: "2x (7d)" },
        is_ad: null,
        cover: { enc: true, src: "https://cdn.jsdelivr.net:444/do-not-fetch-port.enc", mime: "image/jpeg" },
        preview: null,
        product: {
          title: "data url",
          price: "$2",
          commission: "5%",
          href: "data:text/html,hi",
          image: { enc: true, src: "http://cdn.jsdelivr.net/do-not-fetch-http.enc", mime: "image/jpeg" },
          verify: "x"
        }
      },
      {
        id: "good",
        creator: "bueno",
        url: "https://www.tiktok.com/@bueno/video/3",
        caption: "tarjeta sana",
        age_label: "hace 3 d",
        metrics: { views: 1000, likes: 10, comments: 1, shares: 1, saves: 1 },
        score: { value: 80, label: "GMV Max" },
        windows: [{ w: 7, multiple: 3 }],
        best: { w: 7, multiple: 3, label: "3x (7d)" },
        is_ad: false,
        cover: { enc: true, src: media("ok-cover.enc"), mime: "image/jpeg" },
        preview: { enc: true, src: media("ok-preview.enc"), mime: "video/mp4" },
        product: {
          title: "OK",
          price: "$9",
          commission: "10%",
          href: "https://shop.tiktok.com/us/pdp/1",
          image: { enc: true, src: media("ok-thumb.enc"), mime: "image/jpeg" },
          verify: "Verificar afiliación/stock en Shop"
        }
      }
    ]
  };
}

function refsOf(scene) {
  const refs = [];
  for (const card of scene.cards || []) {
    for (const ref of [card.cover, card.preview, card.product && card.product.image]) {
      if (ref && ref.enc === true && ref.src) refs.push(ref);
    }
  }
  return refs;
}

async function buildMedia(scene, cryptoKey) {
  const files = new Map();
  for (const ref of refsOf(scene)) {
    let host = "";
    try { host = new URL(ref.src).hostname; } catch (err) { host = ""; }
    if (host !== "cdn.jsdelivr.net") continue;
    if (new URL(ref.src).port) continue;
    if (!ref.src.startsWith("https://")) continue;
    const name = filenameOf(ref.src);
    if (files.has(name)) continue;
    const mime = String(ref.mime || "");
    const thumb = name.includes("thumb") || (name.includes("mfixture") && /i\d/.test(name));
    const plain = mime.startsWith("video/")
      ? mp4(colorFor(name, "video"))
      : jpeg(colorFor(name, "image"), thumb ? 96 : 390, thumb ? 96 : 844);
    files.set(name, await encryptMedia(plain, cryptoKey));
  }
  return files;
}

function staticChecks() {
  const feedHtml = fs.readFileSync(path.join(ROOT, "feed.html"), "utf8");
  const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const csp = (html) => {
    const match = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/);
    assert.ok(match, "missing CSP");
    return match[1];
  };
  assert.equal(csp(feedHtml), csp(indexHtml));
  assert.match(feedHtml, /name="referrer" content="no-referrer"/);
  assert.match(feedHtml, /function esc\(/);
  assert.match(feedHtml, /visibilitychange/);
  assert.match(feedHtml, /10 \* 60 \* 1000/);
  assert.match(feedHtml, /referrerPolicy:\s*"no-referrer"/);
  assert.doesNotMatch(feedHtml, /\beval\s*\(/);
  assert.doesNotMatch(feedHtml, /new\s+Function/);
  assert.doesNotMatch(feedHtml, /localStorage/);
  assert.doesNotMatch(feedHtml, /sessionStorage/);
  assert.doesNotMatch(feedHtml, /document\.cookie/);
  assert.doesNotMatch(feedHtml, /innerHTML/);
  assert.doesNotMatch(feedHtml, /insertAdjacentHTML/);
  assert.doesNotMatch(feedHtml, /document\.write/);
  assert.doesNotMatch(feedHtml, /setInterval/);
  assert.doesNotMatch(feedHtml, /\bon\w+\s*=/);
  const hosts = [...feedHtml.matchAll(/https:\/\/([a-z0-9.-]+)/gi)].map((match) => match[1]);
  const allowed = new Set([
    "cdn.jsdelivr.net",
    "raw.githubusercontent.com",
    "raw.githack.com",
    "rawcdn.githack.com",
    "webhook.site"
  ]);
  hosts.forEach((host) => assert.ok(allowed.has(host), host));
  assert.equal(fs.existsSync(path.join(ROOT, "scenes", "fixturefeed.json")), false);
}

function corsHeaders(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    ...extra
  };
}

function containsKey(value, key) {
  return String(value || "").includes(key);
}

async function launchBrowser() {
  // Playwright WebKit crashes on this mp4, and the bundled headless shell has no
  // H.264. Default to system Chrome with the iPhone viewport (FEED_ENGINE=webkit to override).
  const forced = process.env.FEED_ENGINE || "chromium";
  const attempts = [];
  if (forced === "webkit") {
    try {
      return { browser: await webkit.launch(), engine: "webkit" };
    } catch (err) {
      attempts.push("webkit: " + err.message.split("\n")[0]);
    }
  }
  try {
    return {
      browser: await chromium.launch({
        executablePath: "/usr/bin/google-chrome",
        args: ["--no-sandbox", "--disable-dev-shm-usage"]
      }),
      engine: "chrome"
    };
  } catch (err) {
    attempts.push("chrome: " + err.message.split("\n")[0]);
  }
  try {
    return {
      browser: await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }),
      engine: "chromium"
    };
  } catch (err) {
    attempts.push("chromium: " + err.message.split("\n")[0]);
    throw new Error(attempts.join(" | "));
  }
}

function pageUrl(id, key, { feedback = true } = {}) {
  const params = feedback
    ? new URLSearchParams({ b: id, k: key, f: UUID })
    : new URLSearchParams({ b: id, k: key });
  return `https://raw.githack.com/JorgeDeArmas/grok-canvas/main/feed.html#${params.toString()}`;
}

async function main() {
  staticChecks();
  const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
  const visual = prepareVisual(raw);
  const visualRefresh = structuredClone(visual);
  const refreshed = visualRefresh.cards.find((card) => card.id === "v1000000000000000002");
  refreshed.caption = "CAPTION_REFRESH_OK";
  const secure = securityScene();

  const keyBytes = webcrypto.getRandomValues(new Uint8Array(32));
  const keyText = b64url(keyBytes);
  const cryptoKey = await importKey(keyBytes);
  const scenes = new Map([
    ["fixturefeed", await encryptScene(visual, cryptoKey)],
    ["fixturerefresh", await encryptScene(visualRefresh, cryptoKey)],
    ["securityfeed", await encryptScene(secure, cryptoKey)]
  ]);
  const media = new Map([
    ...(await buildMedia(visual, cryptoKey)),
    ...(await buildMedia(secure, cryptoKey))
  ]);
  let fixtureHits = 0;

  fs.mkdirSync(SHOTS, { recursive: true });
  const { browser, engine } = await launchBrowser();
  console.log("engine", engine);
  const iphone = devices["iPhone 12"];
  const context = await browser.newContext({
    ...iphone,
    viewport: { width: 390, height: 844 },
    locale: "es-ES",
    hasTouch: true,
    isMobile: true
  });
  context.on("request", (req) => {
    const url = req.url();
    const post = req.postData() || "";
    const headers = JSON.stringify(req.headers());
    requests.push({ url, method: req.method(), post, headers });
    if (containsKey(url.split("#")[0], keyText) || containsKey(post, keyText) || containsKey(headers, keyText)) {
      errors.push("key leaked on " + req.method() + " " + url.split("#")[0].slice(0, 80));
    }
  });

  const allow = (route) => {
    const req = route.request();
    const rawUrl = req.url();
    if (!rawUrl.startsWith("https:")) return route.continue();
    const url = new URL(rawUrl);
    if (req.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: corsHeaders() });
    }
    if (url.hostname === "raw.githack.com") {
      if (url.pathname.endsWith("/feed.html")) {
        return route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: fs.readFileSync(path.join(ROOT, "feed.html"))
        });
      }
      if (url.pathname.endsWith("/favicon.ico")) {
        return route.fulfill({ status: 204, body: "" });
      }
      const scene = url.pathname.match(/\/scenes\/([A-Za-z0-9_-]+)\.json$/);
      if (scene && scenes.has(scene[1])) {
        if (scene[1] === "fixturefeed") fixtureHits += 1;
        const body = scene[1] === "fixturefeed" && fixtureHits >= 2
          ? scenes.get("fixturerefresh")
          : scenes.get(scene[1]);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: corsHeaders(),
          body: JSON.stringify(body)
        });
      }
      return route.fulfill({ status: 404, body: "missing scene" });
    }
    if (url.hostname === "cdn.jsdelivr.net") {
      const name = filenameOf(url.pathname);
      if (media.has(name)) {
        return route.fulfill({
          status: 200,
          contentType: "application/octet-stream",
          headers: corsHeaders(),
          body: media.get(name)
        });
      }
      return route.fulfill({ status: 404, contentType: "text/plain", body: "missing media " + name });
    }
    if (url.hostname === "webhook.site") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders(),
        body: "{}"
      });
    }
    return route.abort();
  };

  await context.route("https://**/*", allow);

  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (/frame-ancestors/i.test(msg.text())) return;
    errors.push("console: " + msg.text());
  });

  const openHash = pageUrl("fixturefeed", keyText);
  await page.goto(openHash, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".card[data-card-id='v1000000000000000000']");
  await page.waitForFunction(() => {
    const img = document.querySelector(".card img.cover");
    return img && img.src.startsWith("blob:") && img.complete && img.naturalWidth > 0;
  });
  await page.waitForFunction(() => {
    const img = document.querySelector(".card img.thumb");
    return img && img.src.startsWith("blob:") && img.complete && img.naturalWidth > 0;
  });

  const snap = await page.$eval("#feed", (el) => getComputedStyle(el).scrollSnapType);
  assert.match(snap, /y/);
  assert.match(snap, /mandatory/);
  const align = await page.$eval(".card", (el) => getComputedStyle(el).scrollSnapAlign);
  assert.equal(align, "start");
  const box = await page.locator(".card").first().boundingBox();
  assert.ok(Math.abs(box.height - 844) < 3, "card height " + box.height);
  assert.ok(Math.abs(box.width - 390) < 3, "card width " + box.width);
  const pagesHigh = await page.evaluate(() => {
    const node = document.querySelector("#feed");
    return node.scrollHeight / node.clientHeight;
  });
  assert.ok(pagesHigh > 3.8 && pagesHigh < 4.25, "scroll pages " + pagesHigh);
  const noX = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  assert.equal(noX, true);

  const card0 = page.locator(".card[data-card-id='v1000000000000000000']");
  await assertText(card0.locator(".who"), /@demo\.creator/);
  await assertText(card0.locator(".age"), /hace 6 d/);
  await assertText(card0.locator(".hook"), /Hook de ejemplo/);
  await assertText(card0.locator(".score"), /78,3/);
  await assertText(card0.locator(".score"), /GMV Max/);
  assert.equal(await card0.locator(".score").evaluate((el) => el.classList.contains("good")), true);
  await assertText(card0.locator(".chip.best"), /4\.1x su promedio \(3d\)/);
  const wins = await card0.locator(".chip.win").allTextContents();
  assert.deepEqual(wins, ["3d", "7d"]);
  await assertText(card0.locator(".velocity"), /\+2\.560 vistas\/día/);
  await assertText(card0.locator(".sales"), /87 vendidos/);
  await assertText(card0.locator(".ad"), /Anuncio/);
  assert.equal(await card0.locator("[data-metric=views] span").innerText(), "24,3 mil");
  assert.equal(await card0.locator("[data-metric=likes] span").innerText(), "67");
  assert.equal(await card0.locator("[data-metric=comments] span").innerText(), "8");
  assert.equal(await card0.locator("[data-metric=shares] span").innerText(), "8");
  assert.equal(await card0.locator("[data-metric=saves] span").innerText(), "1,5 mil");
  await assertText(card0.locator(".pill-title"), /Producto de ejemplo/);
  await assertText(card0.locator(".price"), /\$35\.00/);
  await assertText(card0.locator(".commission"), /Comisión 15%/);
  await assertText(card0.locator(".verify"), /Verificar afiliación\/stock en Shop/);
  assert.equal(await card0.locator("a.open").getAttribute("href"), "https://www.tiktok.com/@demo.creator/video/1000000000000000000");
  assert.equal(await card0.locator("a.open").getAttribute("target"), "_blank");
  assert.match(await card0.locator("a.open").getAttribute("rel"), /noopener/);
  assert.match(await card0.locator("a.open").getAttribute("rel"), /noreferrer/);
  assert.equal(await card0.locator("a.pill").getAttribute("href"), "https://shop.tiktok.com/us/pdp/1700000000000000000");
  assert.equal(await page.locator(".updated").innerText(), "Actualizado: 25 sep 2026, 9:07 a. m. ET");
  assert.match(await page.locator("[data-window='3']").innerText(), /3d/);
  assert.match(await page.locator("[data-window='3']").innerText(), /1/);
  assert.match(await page.locator("[data-window='all']").innerText(), /Todas/);

  await page.screenshot({ path: path.join(SHOTS, "feed_card_producto.png") });

  await page.evaluate(() => {
    document.querySelector("[data-card-id='v1000000000000000003']").scrollIntoView({ block: "start" });
  });
  await page.waitForFunction(() => {
    const img = document.querySelector("[data-card-id='v1000000000000000003'] img.cover");
    return img && img.src.startsWith("blob:") && img.naturalWidth > 0;
  });
  const card3 = page.locator(".card[data-card-id='v1000000000000000003']");
  await assertText(card3.locator(".pill.missing"), /Producto sin identificar/);
  assert.equal(await card3.locator("a.pill").count(), 0);
  assert.equal(await card3.locator("video").count(), 0);
  await assertText(card3.locator(".hook"), /Hook de ejemplo/);
  assert.equal(await card3.locator("a.open").getAttribute("href"), "https://www.tiktok.com/@tercera/video/1000000000000000003");
  await page.screenshot({ path: path.join(SHOTS, "feed_sin_producto.png") });

  await page.locator("[data-creator='otra.cuenta']").click();
  await page.waitForFunction(() => document.querySelectorAll(".card[data-card-id]").length === 1);
  const card1 = page.locator(".card[data-card-id='v1000000000000000001']");
  await assertText(card1.locator(".who"), /@otra\.cuenta/);
  assert.equal(await card1.locator("[data-metric=saves] span").innerText(), "—");
  await assertText(card1.locator(".commission"), /Comisión: verificar/);
  await page.screenshot({ path: path.join(SHOTS, "feed_filtro_creador.png") });

  const hashBefore = await page.evaluate(() => location.hash);
  await page.locator("[data-creator='*']").click();
  await page.locator("[data-window='3']").click();
  await page.waitForFunction(() => document.querySelectorAll(".card[data-card-id]").length === 1);
  assert.deepEqual(await ids(page), ["v1000000000000000000"]);
  assert.equal(await page.evaluate(() => location.hash), hashBefore);
  await page.locator("[data-window='15']").click();
  await page.waitForFunction(() => document.querySelector("[data-card-id='v1000000000000000001']"));
  assert.deepEqual(await ids(page), ["v1000000000000000001"]);
  await page.locator("[data-window='30']").click();
  await page.waitForFunction(() => document.querySelectorAll(".card[data-card-id]").length === 3);
  assert.deepEqual(await ids(page), [
    "v1000000000000000001",
    "v1000000000000000002",
    "v1000000000000000003"
  ]);
  await page.locator("[data-window='all']").click();
  await page.locator("[data-creator='demo.creator']").click();
  await page.waitForFunction(() => document.querySelectorAll(".card[data-card-id]").length === 2);
  assert.deepEqual(await ids(page), ["v1000000000000000000", "v1000000000000000002"]);
  await page.locator("[data-creator='sin.videos']").click();
  await page.waitForSelector(".empty-msg");
  await assertText(page.locator(".empty-msg"), /No hay videos en esta ventana hoy\./);
  assert.equal(await page.locator(".card[data-card-id]").count(), 0);
  await page.locator("[data-creator='*']").click();
  await page.locator("[data-window='3']").click();
  await page.locator("[data-creator='tercera']").click();
  await page.waitForSelector(".empty-msg");
  await page.locator("[data-window='all']").click();
  await page.locator("[data-creator='*']").click();
  await page.waitForFunction(() => document.querySelectorAll(".card[data-card-id]").length === 4);

  await page.evaluate(() => { document.querySelector("#feed").scrollTop = 0; });
  await page.waitForFunction(() => {
    const video = document.querySelector(".card[data-card-id='v1000000000000000000'] video");
    return video && video.dataset.armed === "1";
  });
  const playable = page.locator(".card[data-card-id='v1000000000000000000']");
  await playable.click({ position: { x: 120, y: 400 } });
  await page.waitForFunction(() => {
    const video = document.querySelector(".card[data-card-id='v1000000000000000000'] video");
    return video && video.paused === false && video.currentTime > 0 && video.muted === false;
  });
  await playable.click({ position: { x: 120, y: 400 } });
  await page.waitForFunction(() => {
    const video = document.querySelector(".card[data-card-id='v1000000000000000000'] video");
    return video && video.paused === true;
  });
  await page.evaluate(() => {
    const node = document.querySelector("#feed");
    node.scrollTo(0, node.clientHeight);
  });
  await page.waitForFunction(() => {
    const video = document.querySelector(".card[data-card-id='v1000000000000000000'] video");
    return !video || video.paused === true;
  });

  assert.equal(await page.locator("[aria-label='Nota para Grok']").count(), 1);
  await page.locator("[aria-label='Nota para Grok']").click();
  await page.locator("#note-text").fill("hola fixture");
  await page.locator("#note-send").click();
  await page.waitForFunction(() => document.querySelector("#note-toast").textContent.includes("Nota enviada"));
  const notes = requests.filter((req) => req.method === "POST" && req.url.startsWith("https://webhook.site/"));
  assert.equal(notes.length, 1);
  assert.equal(notes[0].url, "https://webhook.site/" + UUID);
  const payload = JSON.parse(notes[0].post);
  assert.equal(payload.kind, "note");
  assert.equal(payload.text, "hola fixture");
  assert.equal(Object.hasOwn(payload, "blockId"), false);
  assert.match(payload.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(notes[0].post.includes(keyText), false);
  await page.locator("#note-close").click();

  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    cookie: document.cookie
  }));
  assert.deepEqual(storage, { local: 0, session: 0, cookie: "" });
  const dom = await page.content();
  assert.equal(dom.includes(keyText), false);

  const hitsBefore = fixtureHits;
  await page.evaluate(() => {
    document.querySelector("[data-card-id='v1000000000000000002']").scrollIntoView({ block: "start" });
  });
  await page.waitForFunction(() => {
    const node = document.querySelector("#feed");
    const card = document.querySelector("[data-card-id='v1000000000000000002']");
    return card && Math.abs(card.offsetTop - node.scrollTop) < 4;
  });
  await page.evaluate(() => {
    const real = Date.now.bind(Date);
    let extra = 0;
    Date.now = () => real() + extra;
    window.__advance = (ms) => { extra += ms; };
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(400);
  assert.equal(fixtureHits, hitsBefore);
  await page.evaluate(() => {
    window.__advance(11 * 60 * 1000);
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => {
    const card = document.querySelector("[data-card-id='v1000000000000000002']");
    return card && card.innerText.includes("CAPTION_REFRESH_OK");
  });
  assert.ok(fixtureHits >= hitsBefore + 1);
  const stillThere = await page.evaluate(() => {
    const node = document.querySelector("#feed");
    const card = document.querySelector("[data-card-id='v1000000000000000002']");
    return Math.abs(card.offsetTop - node.scrollTop) < 4;
  });
  assert.equal(stillThere, true);

  const securePage = await context.newPage();
  securePage.on("pageerror", (err) => errors.push("secure pageerror: " + err.message));
  securePage.on("console", (msg) => {
    if (msg.type() === "error" && !/frame-ancestors/i.test(msg.text())) errors.push("secure console: " + msg.text());
  });
  const beforeSecure = requests.length;
  await securePage.goto(pageUrl("securityfeed", keyText, { feedback: false }), { waitUntil: "domcontentloaded" });
  await securePage.waitForSelector("[data-card-id='good']");
  await securePage.waitForFunction(() => {
    const img = document.querySelector("[data-card-id='good'] img.cover");
    return img && img.src.startsWith("blob:") && img.naturalWidth > 0;
  });
  const secureReqs = requests.slice(beforeSecure).map((req) => req.url);
  assert.equal(secureReqs.some((url) => url.includes("do-not-fetch")), false);
  assert.equal(secureReqs.some((url) => url.includes("evil.example.com")), false);
  assert.equal(secureReqs.some((url) => url.includes("ok-cover")), true);
  assert.equal(secureReqs.some((url) => url.includes("ok-preview")), false);
  assert.equal(await securePage.locator("[data-card-id='bad'] video").count(), 0);
  assert.equal(await securePage.locator("[data-card-id='bad'] a").count(), 0);
  assert.equal(await securePage.locator("[data-card-id='bad-links'] a").count(), 0);
  await securePage.getByText("<img src=x onerror=alert(1)>", { exact: false }).waitFor();
  await securePage.getByText("<script>alert(1)</script>", { exact: false }).waitFor();
  assert.equal(await securePage.locator("[data-card-id='bad'] img[src='x']").count(), 0);
  assert.equal(await securePage.locator("[data-card-id='bad'] script").count(), 0);
  assert.equal(await securePage.locator("script").count(), 1);
  const unsafe = await securePage.evaluate(() => {
    const found = [];
    document.querySelectorAll("*").forEach((el) => {
      for (const attr of el.attributes) {
        if (/^on/i.test(attr.name) && attr.name !== "content") found.push(attr.name);
        if (/javascript:|data:text/i.test(attr.value)) found.push(attr.name + "=" + attr.value.slice(0, 24));
      }
    });
    return found;
  });
  assert.deepEqual(unsafe, []);
  const hrefs = await securePage.$$eval("a[href]", (els) => els.map((el) => el.getAttribute("href")));
  assert.ok(hrefs.length >= 1);
  hrefs.forEach((href) => {
    assert.match(href, /^https:\/\/(www\.tiktok\.com|shop\.tiktok\.com)\//);
  });
  assert.equal(await securePage.locator("[data-card-id='bad'] .score").evaluate((el) => el.className.includes("grey")), true);
  assert.equal(await securePage.locator("[data-card-id='bad-links'] .score").evaluate((el) => el.className.includes("amber")), true);
  assert.equal(await securePage.locator("[data-card-id='good'] .score").evaluate((el) => el.className.includes("good")), true);
  assert.equal(await securePage.locator("[aria-label='Nota para Grok']").count(), 0);
  await securePage.evaluate(() => {
    document.querySelector("[data-card-id='good']").scrollIntoView({ block: "start" });
  });
  await securePage.waitForFunction(() => {
    const video = document.querySelector("[data-card-id='good'] video");
    return video && video.dataset.armed === "1";
  });
  const afterScroll = requests.slice(beforeSecure).map((req) => req.url);
  assert.equal(afterScroll.some((url) => url.includes("ok-preview")), true);
  assert.equal(afterScroll.some((url) => url.includes("do-not-fetch")), false);

  const broken = await context.newPage();
  broken.on("pageerror", (err) => errors.push("broken pageerror: " + err.message));
  broken.on("console", (msg) => {
    if (msg.type() === "error" && !/frame-ancestors/i.test(msg.text())) errors.push("broken console: " + msg.text());
  });
  await broken.goto("https://raw.githack.com/JorgeDeArmas/grok-canvas/main/feed.html", { waitUntil: "domcontentloaded" });
  await broken.waitForSelector("h1");
  assert.match(await broken.locator("h1").innerText(), /Enlace incompleto/);
  assert.match(await broken.locator(".status p").innerText(), /#b=/);

  const wrongKey = "wrong-key-not-used-anywhere";
  const bad = await context.newPage();
  bad.on("pageerror", (err) => errors.push("badkey pageerror: " + err.message));
  bad.on("console", (msg) => {
    if (msg.type() === "error" && !/frame-ancestors/i.test(msg.text())) errors.push("badkey console: " + msg.text());
  });
  await bad.goto(pageUrl("fixturefeed", wrongKey), { waitUntil: "domcontentloaded" });
  await bad.waitForSelector(".status");
  const badText = await bad.locator(".status").innerText();
  assert.match(badText, /La llave no abre esta escena/);
  assert.equal(badText.includes(wrongKey), false);
  assert.equal(badText.includes(keyText), false);
  assert.equal((await bad.content()).includes(keyText), false);

  assert.deepEqual(errors, []);
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("ok", engine, "requests", requests.length);
}

async function ids(page) {
  return page.$$eval(".card[data-card-id]", (els) => els.map((el) => el.dataset.cardId));
}

async function assertText(locator, pattern) {
  const text = await locator.innerText();
  assert.match(text, pattern, text);
}

main().catch((err) => {
  console.error(err);
  if (errors.length) console.error("ERRORS", errors);
  const urls = [...new Set(requests.map((req) => req.method + " " + req.url.split("#")[0]))];
  console.error("REQUESTS\n" + urls.join("\n"));
  process.exit(1);
});
