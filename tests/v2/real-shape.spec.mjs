import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { webcrypto } from "node:crypto";
import { installSite, catalog, openApp } from "./helpers/site.mjs";
import { TOKENS } from "./helpers/fixtures.mjs";

const crypto = webcrypto;
const DIR = process.env.SITE_V2_SHOT_DIR || path.resolve("test-results", "site-v2-shots");

function rawKey(keyText) {
  const s = String(keyText).replace(/-/g, "+").replace(/_/g, "/");
  const p = "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(Buffer.from(s + p, "base64"));
}

async function encryptMedia(bytes, keyText) {
  const key = await crypto.subtle.importKey("raw", rawKey(keyText), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return Buffer.from(out);
}

function crc32(buf) {
  if (typeof zlib.crc32 === "function") return zlib.crc32(buf) >>> 0;
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function solidPng(w, h, [r, g, b]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (w * 3 + 1);
    raw[o] = 0;
    for (let x = 0; x < w; x++) {
      raw[o + 1 + x * 3] = r;
      raw[o + 2 + x * 3] = g;
      raw[o + 3 + x * 3] = b;
    }
  }
  const chunk = (type, data) => {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function colorMp4() {
  const file = path.join("/tmp", "site-v2-fixture-color.mp4");
  try {
    execFileSync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "color=c=0x1a6bff:s=72x128:d=1",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", file,
    ], { stdio: "ignore" });
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

async function shot(page, name) {
  fs.mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: path.join(DIR, name), fullPage: false });
}

async function assertBoardPills(page) {
  await expect(page.locator("#app")).toContainText("Video de referencia · Creadoras");
  await expect(page.locator("#app")).not.toContainText("donor");
  await expect(page.locator("#app")).not.toContainText("Framework");
  const chips = page.locator(".board-row-meta .chip");
  await expect(chips.first()).toBeVisible();
  const rows = await chips.evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    const card = el.closest(".card");
    const c = card ? card.getBoundingClientRect() : r;
    return {
      text: (el.innerText || "").replace(/\s+/g, " ").trim(),
      inside: r.width > 8 && r.left >= c.left - 1 && r.right <= c.right + 1 && r.right <= window.innerWidth + 1 && r.left >= -1,
      overflow: el.scrollWidth > el.clientWidth + 1,
      nowrap: getComputedStyle(el).whiteSpace,
    };
  }));
  expect(rows.some((row) => row.text.includes("Por grabar"))).toBe(true);
  for (const row of rows) {
    expect(row.inside, JSON.stringify(row)).toBe(true);
    expect(row.overflow, JSON.stringify(row)).toBe(false);
    expect(row.nowrap).toBe("nowrap");
  }
}

async function assertMiamiOneLine(page) {
  const chip = page.locator(".feed-root .filter-chip", { hasText: "Miami X" });
  await expect(chip).toBeVisible();
  const info = await chip.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = el.getBoundingClientRect();
    const lane = el.parentElement.getBoundingClientRect();
    return {
      whiteSpace: getComputedStyle(el).whiteSpace,
      lines: range.getClientRects().length,
      height: r.height,
      inside: r.left >= lane.left - 1 && r.right <= lane.right + 1 && r.right <= window.innerWidth + 1,
      text: (el.textContent || "").replace(/\s+/g, " ").trim(),
    };
  });
  expect(info.text).toBe("Miami X");
  expect(info.whiteSpace).toBe("nowrap");
  expect(info.lines).toBe(1);
  expect(info.height).toBeLessThanOrEqual(48);
  expect(info.inside).toBe(true);
}

test("live scene shapes: feed, boards, grabar board @LIVE", async ({ page }) => {
  const cover = await encryptMedia(solidPng(72, 128, [26, 107, 255]), TOKENS.FEED_K);
  const mp4 = colorMp4();
  const preview = mp4 ? await encryptMedia(mp4, TOKENS.FEED_K) : null;
  await page.route(/\/media\/m[a-f0-9]{16}\.enc$/, async (route) => {
    const url = route.request().url();
    const body = preview && url.includes("mabcdef0123456789") ? preview : cover;
    await route.fulfill({ status: 200, body, contentType: "application/octet-stream" });
  });
  const ctx = await installSite(page, {
    scenes: {
      root: catalog("hub-v3-live"),
      boards: catalog("boards-v1-live"),
      feed: catalog("creator-feed-live"),
      filming: catalog("filming-v2-live"),
      canvas: catalog("canvas-ff"),
    },
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.clock.install({ time: new Date("2026-10-08T13:00:00.000Z") });
  await openApp(page, ctx.sealed.root);

  await page.locator('[data-tab="creadoras"]').click();
  await expect(page.locator("#app")).toContainText("Enviado");
  await expect(page.locator("#app")).not.toContainText("Visto");
  await expect(page.locator("#app img.thumb").first()).toHaveAttribute("src", /^data:image\/jpeg/);

  await page.locator('[data-tab="grabar"]').click();
  await expect(page.locator("#app")).toContainText("sáb 10 oct");
  await expect(page.locator("#app")).not.toContainText("Sin fecha");
  const coming = page.locator("button[disabled]", { hasText: "Board en camino" });
  await expect(coming).toBeVisible();
  await coming.click({ force: true });
  await expect(page).toHaveURL(/#\/grabar/);

  await page.getByRole("button", { name: "Abrir board" }).click();
  await expect(page.locator("#app")).toContainText("LO QUE DICES");
  await expect(page.locator("#app")).toContainText("QUÉ HACES");
  await expect(page.locator("#app")).toContainText("Zona segura 4:5");
  await expect(page.locator("label.filebtn").first()).toContainText("Subir video");
  await expect(page.locator("#app")).toContainText("Escenas");
  await expect(page.locator(".say").first()).toContainText("Mira el waffle");

  await page.evaluate(() => {
    const btn = document.querySelector("label.filebtn");
    if (!btn) return;
    const y = btn.getBoundingClientRect().top + window.scrollY - (window.innerHeight - btn.offsetHeight - 72);
    window.scrollTo(0, Math.max(0, y));
  });
  const darkPhone = test.info().project.name === "phone-webkit-dark";
  if (darkPhone) await shot(page, "fix-board-from-grabar-dark.png");

  await page.locator('[data-act="back"]').click();
  await page.locator('[data-act="go-boards"]').click();
  await expect(page.locator("h1")).toContainText("Boards");
  await expect(page.locator("#app")).not.toContainText("No hay boards");
  await expect(page.locator("#app")).not.toContainText("Bella");
  const dismiss = page.locator('[data-act="banner-dismiss"]');
  if (await dismiss.count()) await dismiss.first().click();
  const saved = page.viewportSize();
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: width === 360 ? 800 : 844 });
    await assertBoardPills(page);
    if (darkPhone) await shot(page, `fix-boards-${width}.png`);
  }
  if (saved) await page.setViewportSize(saved);
  if (darkPhone) await shot(page, "fix-boards-dark.png");

  await page.locator('[data-act="back"]').click();
  await page.locator('[data-tab="dashboard"]').click();
  await page.locator('[data-act="go-feed"]').click();
  await expect(page.locator("#app")).toContainText("Feed v3 91");
  await expect(page.locator("#app")).not.toContainText("[object Object]");
  await expect(page.locator("#app")).toContainText("Waffle de cortina");
  await expect(page.locator("#app")).toContainText("Lo quiero");
  await expect(page.locator("a.feed-tt").first()).toHaveAttribute("href", /tiktok\.com/);
  await expect(page.locator(".want")).toHaveText("Lo quiero");
  if (saved) await page.setViewportSize({ width: 360, height: 800 });
  await assertMiamiOneLine(page);
  if (saved) await page.setViewportSize({ width: 390, height: 844 });
  await assertMiamiOneLine(page);
  if (darkPhone) await shot(page, "fix-feed-pill-390.png");
  if (saved) await page.setViewportSize(saved);
  await page.waitForFunction(() => {
    const img = document.querySelector("img.feed-cover");
    return !!(img && !img.hidden && img.src.startsWith("blob:") && img.naturalWidth > 0);
  });
  await expect(page.locator("img.feed-cover").first()).toBeVisible();
  if (preview) {
    await page.waitForFunction(() => {
      const v = document.querySelector("video.feed-preview");
      return !!(v && v.src.startsWith("blob:"));
    });
  }
  if (darkPhone) await shot(page, "fix-feed-dark.png");
});
