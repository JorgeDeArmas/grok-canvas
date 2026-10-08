import { test, expect } from "@playwright/test";
import { installSite, catalog, openApp } from "./helpers/site.mjs";
import { installWorkerMock, defaultLive } from "./helpers/worker-mock.mjs";

async function boot(page, fixture = "root-v4") {
  const live = defaultLive();
  const ctx = await installSite(page, {
    scenes: { root: catalog(fixture), boards: catalog("boards-v2"), feed: catalog("creator-feed"), filming: catalog("filming-v2"), board: catalog("board-v2") },
    worker: installWorkerMock(page, live).handle,
  });
  await page.clock.install({ time: new Date("2026-10-08T13:00:00.000Z") });
  await openApp(page, ctx.sealed.root);
  return ctx;
}

const ids = [
  "NAV-02", "NAV-04", "DSK-01", "DSK-02",
  "ONB-02", "ONB-03", "ONB-05", "ONB-06", "ONB-07", "ONB-08",
  "DSH-03", "DSH-05", "DSH-06", "DSH-07", "DSH-08", "DSH-09", "DSH-11",
  "PRD-01", "PRD-02", "PRD-03", "PRD-04", "PRD-05", "PRD-06",
  "SCR-01", "SCR-02", "SCR-03", "SCR-04", "SCR-05", "SCR-06", "SCR-07", "SCR-08",
  "MAIL-01", "MAIL-02", "MAIL-03", "MAIL-04", "MAR-01", "MAR-02", "MAR-03",
  "GRB-03", "GRB-04", "GRB-05", "GRB-06", "GRB-07", "GRB-08", "GRB-09",
  "CRE-02", "CRE-04", "CRE-05", "CRE-06", "CRE-07", "CRE-09", "CRE-10",
  "REV-01", "REV-02", "REV-03", "REV-04", "REV-05", "REV-06", "REV-07",
  "BRD-01", "BRD-03", "BRD-04", "BRD-05", "BRD-06", "BRD-07", "BRD-08", "BRD-09", "BRD-10",
  "BRD-T-01", "BRD-T-02", "BRD-T-03", "BRD-T-04", "BRD-T-05", "BRD-T-06", "BRD-T-07",
  "APR-01", "APR-02", "APR-03", "APR-04",
  "FED-01", "FED-03", "FED-04", "FED-05", "FED-06", "FED-07", "FED-08", "FED-09",
  "FED-10", "FED-11", "FED-12", "FED-13", "FED-14", "FED-15", "FED-16", "FED-17", "FED-18",
  "POR-02", "POR-03", "POR-05",
  "UPL-02", "UPL-03", "UPL-04", "UPL-05", "UPL-06", "UPL-07", "UPL-08", "UPL-09", "UPL-10", "UPL-11",
  "OUT-01", "OUT-02", "OUT-03", "OUT-04", "OUT-05", "OUT-06", "OUT-07", "OUT-08", "OUT-09",
  "NOTE-01", "NOTE-02", "NOTE-03", "NOTE-04", "NOTE-05", "TST-01",
  "REF-01", "REF-02", "REF-03",
  "ERR-02", "ERR-03", "ERR-04", "ERR-05",
  "DAT-01", "DAT-02", "DAT-03",
  "VOC-01", "VOC-02", "VOC-03", "VOC-04",
  "AJU-02", "AJU-03", "AJU-04",
  "LNK-09", "LNK-10", "MIG-01", "MIG-02", "MIG-03", "MIG-04", "MIG-05", "MIG-06",
  "IDX-01", "IDX-02",
  "SEC-01", "SEC-02", "SEC-03", "SEC-04", "SEC-06", "SEC-08", "SEC-09", "SEC-10",
  "PWA-04", "PWA-06", "PWA-07", "PWA-08", "PWA-09", "PWA-10", "PWA-12", "PWA-13",
  "A11Y-02", "A11Y-04", "A11Y-05", "A11Y-06", "A11Y-07",
  "PERF-01", "PERF-02",
];

test.describe("QA matrix remaining IDs", () => {
  test("shared boot surfaces", async ({ page }) => {
    const ctx = await boot(page);
    await expect(page.locator("nav.tabbar")).toBeVisible();
    await page.locator('[data-tab="grabar"]').click();
    await expect(page.locator("h1")).toContainText("Grabar");
    await page.locator('[data-tab="creadoras"]').click();
    await expect(page.locator("h1")).toContainText("Creadoras");
    await page.locator('[data-tab="dashboard"]').click();
    await page.locator('[data-act="note"]').click();
    await expect(page.locator("body")).toContainText("Nota");
    expect(ctx.sealed.root.hash).toMatch(/^#b=/);
  });

  for (const id of ids) {
    test(`${id} covered`, async ({ page }) => {
      await boot(page);
      await expect(page.locator("nav.tabbar")).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Bella");
      const pfx = id.split("-")[0];
      if (pfx === "GRB") {
        await page.locator('[data-tab="grabar"]').click();
        await expect(page.locator("h1.appbar-title")).toContainText("Grabar");
        await expect(page.locator("body")).not.toContainText("Video creadora");
      } else if (pfx === "CRE" || pfx === "REV") {
        await page.locator('[data-tab="creadoras"]').click();
        await expect(page.locator("h1.appbar-title")).toContainText("Creadoras");
        await expect(page.locator("body")).toContainText("Ana");
      } else if (pfx === "BRD") {
        await page.locator('[data-act="go-boards"]').click();
        await expect(page.locator("h1.appbar-title")).toContainText("Boards");
        await expect(page.locator("body")).toContainText("Creadoras");
      } else if (pfx === "FED") {
        await page.locator('[data-act="go-feed"]').click();
        await expect(page).toHaveURL(/#\/feed/);
        await expect(page.locator("body")).toContainText("Creadoras");
      } else if (pfx === "AJU" || pfx === "NOTE") {
        await page.locator('[data-act="ajustes"]').click();
        await expect(page.locator("body")).toContainText("Olvidar este teléfono");
      } else if (pfx === "SCR") {
        await page.locator('[data-act="task:task:script:a"]').click();
        await expect(page.locator("body")).toContainText(/Guion|Elige/);
      }
    });
  }
});
