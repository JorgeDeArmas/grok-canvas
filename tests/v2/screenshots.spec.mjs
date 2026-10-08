import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { installSite, catalog, openApp } from "./helpers/site.mjs";
import { installWorkerMock, defaultLive } from "./helpers/worker-mock.mjs";

const DIR = "/cursor/stores/bc-0791c206-427a-5891-b089-3334282963d0/media";

async function shot(page, name) {
  fs.mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: path.join(DIR, name), fullPage: false });
}

async function bootTheme(page, colorScheme) {
  await page.emulateMedia({ colorScheme });
  const live = defaultLive();
  const ctx = await installSite(page, {
    scenes: {
      root: catalog("root-v4"),
      boards: catalog("boards-v2"),
      feed: catalog("creator-feed"),
      board: catalog("board-v2"),
    },
    worker: installWorkerMock(page, live).handle,
  });
  await page.clock.install({ time: new Date("2026-10-08T13:00:00.000Z") });
  await openApp(page, ctx.sealed.root);
  return ctx;
}

for (const theme of ["dark", "light"]) {
  test(`shots ${theme}`, async ({ page }) => {
    test.skip(test.info().project.name !== "phone-webkit-light" && test.info().project.name !== "phone-webkit-dark", "phone shots only");
    if (test.info().project.name === "phone-webkit-dark" && theme !== "dark") test.skip();
    if (test.info().project.name === "phone-webkit-light" && theme !== "light") test.skip();
    await bootTheme(page, theme);
    await page.waitForTimeout(600);
    await shot(page, `site-v2-dashboard-${theme}.png`);
    await page.locator('[data-tab="grabar"]').click();
    await page.waitForTimeout(300);
    await shot(page, `site-v2-grabar-${theme}.png`);
    await page.locator('[data-tab="creadoras"]').click();
    await page.waitForTimeout(300);
    await shot(page, `site-v2-creadoras-${theme}.png`);
    await page.locator('[data-tab="dashboard"]').click();
    await page.locator('[data-act="go-feed"]').click();
    await page.waitForTimeout(300);
    await shot(page, `site-v2-feed-${theme}.png`);
    await page.locator('[data-act="back"]').click();
    await page.locator('[data-act="go-boards"]').click();
    await page.waitForTimeout(300);
    await shot(page, `site-v2-boards-${theme}.png`);
    const row = page.locator(".list-row, [data-act^=open-lib-board]").first();
    if (await row.count()) await row.click();
    await page.waitForTimeout(400);
    await shot(page, `site-v2-board-${theme}.png`);
  });
}
