import { test, expect } from "@playwright/test";
import { webcrypto } from "node:crypto";
import { installSite, catalog } from "./helpers/site.mjs";
import { TOKENS } from "./helpers/fixtures.mjs";

const crypto = webcrypto;

test.use({ viewport: { width: 390, height: 844 } });

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

async function openSingleFeed(page) {
  const jpeg = Buffer.from(String(TOKENS.JPEG).split(",")[1], "base64");
  const cover = await encryptMedia(jpeg, TOKENS.FEED_K);
  await page.route(/\/media\/m[a-f0-9]{16}\.enc$/, (route) =>
    route.fulfill({ status: 200, body: cover, contentType: "application/octet-stream" }));
  const scene = catalog("creator-feed-live");
  for (const card of scene.cards || []) card.preview = null;
  const ctx = await installSite(page, { scenes: { feed: scene } });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`/feed.html${ctx.sealed.feed.hash}&f=${TOKENS.MAIL}`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/app\//);
  await expect(page.locator("#feed-snap .feed-card").first()).toBeVisible();
  return ctx;
}

async function expectFullyVisible(locator) {
  await expect(locator).toBeInViewport({ ratio: 1 });
  const box = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const snap = document.querySelector("#feed-snap").getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      width: r.width,
      height: r.height,
      vw: window.innerWidth,
      vh: window.innerHeight,
      snapTop: snap.top,
      snapBottom: snap.bottom,
      snapLeft: snap.left,
      snapRight: snap.right,
    };
  });
  expect(box.width).toBeGreaterThan(20);
  expect(box.height).toBeGreaterThan(20);
  expect(box.top).toBeGreaterThanOrEqual(-1);
  expect(box.left).toBeGreaterThanOrEqual(-1);
  expect(box.bottom).toBeLessThanOrEqual(box.vh + 1);
  expect(box.right).toBeLessThanOrEqual(box.vw + 1);
  expect(box.top).toBeGreaterThanOrEqual(box.snapTop - 1);
  expect(box.bottom).toBeLessThanOrEqual(box.snapBottom + 1);
  expect(box.left).toBeGreaterThanOrEqual(box.snapLeft - 1);
  expect(box.right).toBeLessThanOrEqual(box.snapRight + 1);
}

test("creator-feed link with empty storage hydrates covers @FED-LINK", async ({ page }) => {
  const ctx = await openSingleFeed(page);
  const covers = page.locator("#feed-snap .feed-card img.feed-cover");
  await expect(covers.first()).toHaveAttribute("src", /^blob:/);
  const srcs = await covers.evaluateAll((els) => els.map((el) => el.getAttribute("src") || ""));
  expect(srcs.length).toBeGreaterThan(0);
  expect(srcs.every((src) => src.startsWith("blob:"))).toBe(true);

  await expect(page.locator(".banner")).toHaveCount(0);
  const want = page.locator("#feed-snap .feed-card .want", { hasText: "Lo quiero" }).first();
  await expectFullyVisible(want);

  await page.evaluate(() => {
    const app = document.getElementById("app");
    const banner = document.createElement("div");
    banner.className = "banner info";
    banner.setAttribute("role", "status");
    banner.innerHTML = "<span>Hay una versión nueva</span><button type=\"button\" class=\"banner-act\">Actualizar</button>";
    app.prepend(banner);
  });
  await expectFullyVisible(want);

  await page.evaluate(() => {
    document.querySelector("#feed-snap .feed-card .want").click();
  });
  await expect(page.locator("#feed-snap .feed-card .want").first()).toHaveText("Anotado");
  const stored = await page.evaluate((blob) => localStorage.getItem("feed-want:" + blob), ctx.sealed.feed.blobId);
  expect(stored).toBeTruthy();
});

test("first service worker install does not show the update banner @PWA-FIRST", async ({ page }) => {
  await page.addInitScript(() => {
    window.__swRegisterCalls = 0;
    const reg = {
      waiting: { state: "installed", postMessage() {} },
      installing: null,
      active: null,
      scope: "./",
      update() { return Promise.resolve(); },
      addEventListener(type, fn) {
        if (type !== "updatefound") return;
        const worker = {
          state: "installing",
          addEventListener(ev, cb) {
            if (ev !== "statechange") return;
            this.state = "installed";
            reg.waiting = this;
            queueMicrotask(() => cb());
          },
        };
        reg.installing = worker;
        queueMicrotask(() => fn());
      },
    };
    const sw = navigator.serviceWorker;
    sw.register = () => {
      window.__swRegisterCalls += 1;
      return Promise.resolve(reg);
    };
  });
  await openSingleFeed(page);
  await page.waitForFunction(() => window.__swRegisterCalls > 0);
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  await expect(page.getByText("Hay una versión nueva")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Actualizar" })).toHaveCount(0);
});

test("an already-controlled update still shows the banner @PWA-UPDATE", async ({ page }) => {
  await page.addInitScript(() => {
    window.__swRegisterCalls = 0;
    const controller = { state: "activated", scriptURL: "./sw.js" };
    const sw = navigator.serviceWorker;
    try {
      Object.defineProperty(sw, "controller", { configurable: true, get: () => controller });
    } catch { /* native getter stays; the assertion below records it */ }
    const reg = {
      waiting: { state: "installed", postMessage() {} },
      installing: null,
      active: controller,
      scope: "./",
      update() { return Promise.resolve(); },
      addEventListener() {},
    };
    sw.register = () => {
      window.__swRegisterCalls += 1;
      window.__swController = !!navigator.serviceWorker.controller;
      return Promise.resolve(reg);
    };
  });
  await openSingleFeed(page);
  await page.waitForFunction(() => window.__swRegisterCalls > 0);
  const stubbed = await page.evaluate(() => window.__swController);
  expect(stubbed).toBe(true);
  await expect(page.getByText("Hay una versión nueva")).toBeVisible();
  await expect(page.getByRole("button", { name: "Actualizar" })).toBeVisible();
  await expectFullyVisible(page.locator("#feed-snap .feed-card .want", { hasText: "Lo quiero" }).first());
});
