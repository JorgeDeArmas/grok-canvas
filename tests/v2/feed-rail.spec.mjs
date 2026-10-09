import { test, expect } from "@playwright/test";
import { webcrypto } from "node:crypto";
import { installSite, catalog, openApp } from "./helpers/site.mjs";
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

test("feed rail stays inside 390x844 and creadoras thumbs load", async ({ page }) => {
  const jpeg = Buffer.from(String(TOKENS.JPEG).split(",")[1], "base64");
  const full = "Crema de manos sintetica para el set de prueba de laboratorio";
  const hub = catalog("hub-v3-live");
  hub.creators[0].jobs = [
    { job_id: "job-list", name: full, status: "opened" },
    { job_id: "job-board", name: "Pack de grabación", status: "opened" },
    {
      job_id: "job-enc", name: "Foto cifrada", status: "sent",
      thumb: { enc: true, src: "media/m0123456789abcdef.enc", mime: "image/jpeg" },
    },
    { job_id: "job-none", name: "Sin foto disponible", status: "sent" },
  ];
  hub.sections.find((s) => s.id === "productos").items = [
    { id: "cream", title: full, thumb: "pb", chip: { text: "Por grabar" } },
  ];
  const ctx = await installSite(page, {
    scenes: {
      root: hub,
      boards: catalog("boards-v1-live"),
      feed: catalog("creator-feed-live"),
    },
  });
  const cover = await encryptMedia(jpeg, ctx.sealed.root.keyText);
  await page.route(/\/media\/m[a-f0-9]{16}\.enc$/, (route) =>
    route.fulfill({ status: 200, body: cover, contentType: "application/octet-stream" }));
  await page.clock.install({ time: new Date("2026-10-08T13:00:00.000Z") });
  await openApp(page, ctx.sealed.root);

  await page.locator('[data-tab="creadoras"]').click();
  const row = (name) => page.locator(".list-row", { hasText: name });
  await expect(row("Sin foto disponible").locator("span.thumb.ph")).toHaveCount(1);
  await expect(row("Sin foto disponible").locator("img.thumb")).toHaveCount(0);
  for (const name of ["Crema de manos", "Pack de grabación", "Foto cifrada"]) {
    const img = row(name).locator("img.thumb");
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
  }

  await page.locator('[data-tab="dashboard"]').click();
  await page.locator('[data-act="go-feed"]').click();
  await expect(page.locator("#feed-snap .feed-card").first()).toBeVisible();
  await expect(page.locator("#app")).not.toContainText("Feed v3");
  await expect(page.locator(".feed-score")).toHaveCount(0);
  const rail = page.locator("#feed-snap .feed-rail").first();
  await expect(rail).toBeInViewport({ ratio: 1 });
  const vp = page.viewportSize();
  const box = await rail.boundingBox();
  expect(box).toBeTruthy();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5);
  const metrics = rail.locator(".metric");
  expect(await metrics.count()).toBeGreaterThan(0);
  for (let i = 0; i < await metrics.count(); i++) {
    await expect(metrics.nth(i)).toBeInViewport({ ratio: 1 });
  }
  const pill = page.locator(".feed-pill").first();
  const pillBox = await pill.boundingBox();
  expect(pillBox.x + pillBox.width).toBeLessThanOrEqual(box.x + 0.5);
  const clamp = await page.locator(".feed-pill-title").first().evaluate((el) => getComputedStyle(el).webkitLineClamp);
  expect(clamp).toBe("2");
  await expect(page.locator(".feed-pill-line").first()).toBeVisible();
});
