// Hub viewer mail-button test: phone (iPhone/Android) vs desktop, clipboard copy, and hostile scene data.
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SHOTS_DIR || "/opt/cursor/artifacts/screenshots";
const ORIGIN = "https://jorgedearmas.github.io";
const WEB = "https://mail.google.com/mail/?authuser=miamix.collabs%40gmail.com#all/19f7066e840f50e7";
const hubHtml = fs.readFileSync(path.join(ROOT, "hub.html"), "utf8");

// Static: the app scheme is one constant, and CSP is unchanged.
assert.equal(hubHtml.split("googlegmail://").length - 1, 1, "googlegmail:// must appear exactly once (constant)");
assert.match(hubHtml, /default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:\/\/webhook.site;/);
assert.doesNotMatch(hubHtml, /\beval\s*\(|new\s+Function|document\.write|insertAdjacentHTML/);

const scene = {
  type: "hub", title: "Tu día", updatedAt: new Date().toISOString(), counters: [],
  sections: [{ id: "marcas", title: "Marcas", items: [
    { id: "brand:good:neg", verb: "Negociando", title: "Neumina", sub: "magnesio", tone: "info",
      mail: { web: WEB, search: "from:neuminanutrition.com", subject: "Paid Collab Opportunity｜Neumina Triple Magnesium" } },
    { id: "brand:evil1:neg", verb: "", title: "EvilHost", quiet: true,
      mail: { web: "https://evil.example/mail/#all/1", search: "\"><img src=x id=pwn1>", subject: "<img src=x id=pwn2>" } },
    { id: "brand:evil2:neg", verb: "", title: "EvilScheme",
      mail: { web: "javascript:alert(1)", search: "from:x.com" } },
    { id: "brand:evil3:neg", verb: "", title: "EvilHttp",
      mail: { web: "http://mail.google.com/mail/#all/1", search: "" } },
    { id: "plain:link", verb: "Ver", title: "Feed", href: "https://jorgedearmas.github.io/grok-canvas/feed.html", hrefLabel: "Abrir" }
  ] }]
};

const keyBytes = webcrypto.getRandomValues(new Uint8Array(32));
const keyText = Buffer.from(keyBytes).toString("base64url");
const key = await webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(scene))));
const blob = JSON.stringify({ iv: Buffer.from(iv).toString("base64"), ct: Buffer.from(ct).toString("base64") });
const URL_ = `${ORIGIN}/grok-canvas/hub.html#b=hubmailtest&k=${keyText}&f=12345678-1234-1234-1234-123456789abc`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  .catch(() => chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }));
fs.mkdirSync(SHOTS, { recursive: true });
const errors = [];

async function open(name, opts) {
  const ctx = await browser.newContext({ locale: "es-ES", ...opts });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === ORIGIN && u.pathname === "/grok-canvas/hub.html") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: hubHtml });
    if (u.origin === ORIGIN && u.pathname === "/grok-canvas/scenes/hubmailtest.json") return route.fulfill({ status: 200, contentType: "application/json", body: blob });
    if (u.hostname === "webhook.site") return route.fulfill({ status: 200, body: "{}" });
    errors.push(name + " unexpected request " + u.origin + u.pathname);
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(name + " pageerror " + e.message));
  await page.goto(URL_);
  await page.waitForSelector('[data-id="brand:good:neg"]');
  return { ctx, page };
}
const row = (page, id) => page.locator(`[data-id="${id}"]`);

// iPhone: app button with the constant scheme, copy button, subject shown, no raw search visible.
{
  const { ctx, page } = await open("iphone", { ...devices["iPhone 12"], viewport: { width: 390, height: 844 } });
  const good = row(page, "brand:good:neg");
  const a = good.locator("a.go");
  assert.equal(await a.innerText(), "Abrir Gmail");
  assert.equal(await a.getAttribute("href"), "googlegmail://");
  assert.equal(await a.getAttribute("target"), null);
  assert.match(await good.innerText(), /Neumina Triple Magnesium/);
  await good.locator("button.copy").click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "from:neuminanutrition.com");
  assert.match(await page.locator("#toastMsg").innerText(), /Copiado/);
  const body = await page.locator("main").innerText();
  assert.doesNotMatch(body, /from:|mail\.google|authuser|googlegmail/, "no codes or paths visible");
  assert.equal(await page.locator("#pwn1, #pwn2").count(), 0, "scene markup must not render");
  await row(page, "brand:evil1:neg").locator("button.copy").click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "\"><img src=x id=pwn1>");
  assert.equal(await row(page, "brand:evil3:neg").locator("button.copy").count(), 0, "empty search -> no copy button");
  assert.equal(await row(page, "plain:link").locator("a.go").getAttribute("href"), "https://jorgedearmas.github.io/grok-canvas/feed.html");
  await page.screenshot({ path: path.join(SHOTS, "hub_mail_iphone.png"), fullPage: true });
  await ctx.close();
}

// Android: https web link (validated) + copy button; hostile web links dropped.
{
  const { ctx, page } = await open("android", { ...devices["Pixel 5"] });
  const a = row(page, "brand:good:neg").locator("a.go");
  assert.equal(await a.innerText(), "Abrir Gmail");
  assert.equal(await a.getAttribute("href"), WEB);
  assert.equal(await row(page, "brand:good:neg").locator("button.copy").count(), 1);
  for (const id of ["brand:evil1:neg", "brand:evil2:neg", "brand:evil3:neg"]) assert.equal(await row(page, id).locator("a").count(), 0, id);
  await ctx.close();
}

// Desktop: direct authuser link, no app scheme, no copy button; hostile links dropped.
{
  const { ctx, page } = await open("desktop", { viewport: { width: 1280, height: 900 } });
  const a = row(page, "brand:good:neg").locator("a.go");
  assert.equal(await a.innerText(), "Abrir correo");
  assert.equal(await a.getAttribute("href"), WEB);
  assert.equal(await a.getAttribute("target"), "_blank");
  assert.equal(await page.locator("button.copy").count(), 0);
  assert.equal(await page.locator('a[href^="googlegmail"]').count(), 0);
  for (const id of ["brand:evil1:neg", "brand:evil2:neg", "brand:evil3:neg"]) assert.equal(await row(page, id).locator("a").count(), 0, id);
  await page.screenshot({ path: path.join(SHOTS, "hub_mail_desktop.png") });
  await ctx.close();
}

await browser.close();
assert.deepEqual(errors, []);
console.log("ok hub mail buttons");
