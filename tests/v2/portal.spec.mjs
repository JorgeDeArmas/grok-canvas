import { test, expect } from "@playwright/test";
import { installSite, catalog } from "./helpers/site.mjs";
import { installWorkerMock, defaultLive } from "./helpers/worker-mock.mjs";

test("POR-01 hello and board button @POR-01", async ({ page }) => {
  const live = defaultLive();
  const ctx = await installSite(page, {
    scenes: { portal: catalog("portal-v2") },
    worker: installWorkerMock(page, live).handle,
  });
  await page.clock.install({ time: new Date("2026-10-08T13:00:00.000Z") });
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/portal.html${ctx.sealed.portal.hash}&t=creatortokensynth01`);
  await expect(page.locator("body")).toContainText("Hola, Ana");
  await expect(page.locator("body")).toContainText("Abrir board");
  await expect(page.locator("nav.tabbar")).toHaveCount(0);
});

test("POR-04 inactive @POR-04", async ({ page }) => {
  const ctx = await installSite(page, {
    scenes: { portal: catalog("portal-v2") },
    worker: async (route) => route.fulfill({ status: 403, body: "{\"error\":\"inactive\"}" }),
  });
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/portal.html${ctx.sealed.portal.hash}&t=creatortokensynth01`);
  await expect(page.locator("body")).toContainText("ya no está activo");
});

test("SEC-05 forbidden fields ignored @SEC-05", async ({ page }) => {
  const ctx = await installSite(page, { scenes: { portal: catalog("portal-v2-forbidden") } });
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/portal.html${ctx.sealed.portal.hash}&t=creatortokensynth01`);
  const html = await page.content();
  expect(html).not.toContain("mgrtokensynthetic01");
  expect(html).not.toContain("ownertokensynthetic1");
  expect(html).not.toContain("editor_brief");
});

test("UPL-01 upload button @UPL-01", async ({ page }) => {
  const live = defaultLive();
  const ctx = await installSite(page, {
    scenes: { portal: catalog("portal-v2") },
    worker: installWorkerMock(page, live).handle,
  });
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/portal.html${ctx.sealed.portal.hash}&t=creatortokensynth01`);
  await page.getByText("Abrir board").first().click();
  await expect(page.locator("label.filebtn, [data-act=upload]")).toContainText("Subir video");
});
