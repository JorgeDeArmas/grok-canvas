import { test, expect } from "@playwright/test";
import { installSite, catalog, openApp } from "./helpers/site.mjs";
import { installWorkerMock, defaultLive } from "./helpers/worker-mock.mjs";

test.use({ bypassCSP: true });

test("A11Y-01 axe dashboard @A11Y-01", async ({ page }) => {
  const live = defaultLive();
  const ctx = await installSite(page, {
    scenes: { root: catalog("root-v4") },
    worker: installWorkerMock(page, live).handle,
  });
  await openApp(page, ctx.sealed.root);
  const { axeSource } = await import("./helpers/a11y.mjs");
  await page.evaluate(axeSource());
  const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a"] })).violations);
  expect(v.filter((x) => x.impact === "critical")).toEqual([]);
});

test("A11Y-03 44px targets @A11Y-03", async ({ page }) => {
  const ctx = await installSite(page, { scenes: { root: catalog("root-v4") } });
  await openApp(page, ctx.sealed.root);
  const small = await page.evaluate(() => {
    const els = [...document.querySelectorAll("button, a.tab, .tab")];
    return els.filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 40).map((e) => e.className);
  });
  expect(small.length).toBeLessThan(8);
});
