import { test, expect } from "@playwright/test";
import { installSite, catalog, openApp } from "./helpers/site.mjs";

test.use({ viewport: { width: 390, height: 844 } });

async function visibleVideo(page) {
  return page.evaluate(() => {
    const snap = document.getElementById("feed-snap");
    if (!snap) return null;
    const box = snap.getBoundingClientRect();
    let best = null;
    let ratio = 0;
    for (const card of snap.querySelectorAll(".feed-card")) {
      const r = card.getBoundingClientRect();
      const vis = Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top);
      const frac = r.height ? vis / r.height : 0;
      if (frac > ratio) { ratio = frac; best = card; }
    }
    const video = best && best.querySelector("video.feed-preview");
    return {
      index: best ? Number(best.getAttribute("data-i")) : -1,
      muted: video ? video.muted : null,
    };
  });
}

test("feed pill opens the PDP and sound stays on across scroll", async ({ page }) => {
  const feed = catalog("creator-feed-live");
  feed.cards[1] = { ...feed.cards[1], preview: feed.cards[0].preview };
  const ctx = await installSite(page, {
    scenes: {
      root: catalog("hub-v3-live"),
      boards: catalog("boards-v1-live"),
      feed,
    },
  });
  await page.addInitScript(() => localStorage.removeItem("feed:sound"));
  await page.clock.install({ time: new Date("2026-10-08T13:00:00.000Z") });
  await openApp(page, ctx.sealed.root);
  await page.locator('[data-act="go-feed"]').click();
  const pill = page.locator("a.feed-pill").first();
  await expect(pill).toHaveAttribute("href", "https://shop.tiktok.com/view/product/1");
  await expect(pill).toHaveAttribute("target", "_blank");
  await expect(page.locator("[data-act^='product-pill']")).toHaveCount(0);

  const video = page.locator("video.feed-preview").first();
  await expect.poll(() => video.evaluate((el) => el.muted)).toBe(true);
  await page.locator("button.feed-sound").first().click();
  await expect.poll(() => video.evaluate((el) => el.muted)).toBe(false);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("feed:sound"))).toBe("1");
  await expect(page.locator("button.feed-sound").first()).toHaveAttribute("aria-pressed", "true");

  await page.locator("#feed-snap").evaluate((el) => el.scrollTo(0, el.clientHeight));
  await expect.poll(() => visibleVideo(page)).toEqual({ index: 1, muted: false });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("feed:sound"))).toBe("1");
});

test("feed note and creadoras board buttons open their targets", async ({ page }) => {
  const hub = catalog("hub-v3-live");
  hub.creators[0].jobs[0].board = "https://jorgedearmas.github.io/grok-canvas/board.html#b=boardblob01xx&k=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";
  const ctx = await installSite(page, {
    scenes: {
      root: hub,
      boards: catalog("boards-v1-live"),
      feed: catalog("creator-feed-live"),
      board: catalog("board-v2"),
    },
  });
  await page.clock.install({ time: new Date("2026-10-08T13:00:00.000Z") });
  await openApp(page, ctx.sealed.root);
  await page.locator('[data-act="go-feed"]').click();
  await page.locator('[data-act="note-feed:c-live-1"]').click();
  await expect(page.getByRole("dialog")).toContainText("Sobre: @demo.shop");

  await page.locator('[data-act="sheet-close"]').first().click();
  await page.locator('[data-act="back"]').click();
  await page.locator('[data-act="back"]').click();
  await page.locator('[data-tab="creadoras"]').click();
  await page.locator('[data-act="creator-board:sess-demo:ff-030"]').click();
  await expect(page.locator("#screen")).toContainText("Mira esto, lo uso todos los días.");
  await expect(page.locator("input[type=file]")).toHaveCount(0);
});
