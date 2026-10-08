import { test, expect } from "@playwright/test";
import { installSite, catalog, openApp } from "./helpers/site.mjs";
import { installWorkerMock, defaultLive } from "./helpers/worker-mock.mjs";
import { t } from "../../lib/copy.js";

async function boot(page, fixture = "root-v4", extras = {}) {
  const live = defaultLive();
  const worker = installWorkerMock(page, live);
  const ctx = await installSite(page, {
    scenes: { root: catalog(fixture), boards: catalog("boards-v2"), feed: catalog("creator-feed"), filming: catalog("filming-v2"), board: catalog("board-v2") },
    worker: worker.handle,
    ...extras,
  });
  await page.clock.install({ time: new Date("2026-10-08T13:00:00.000Z") });
  await openApp(page, ctx.sealed.root);
  await expect(page.locator("#app")).not.toHaveText(/Cargando/, { timeout: 15_000 });
  return ctx;
}

test("NAV-01 tabs Dashboard Grabar Creadoras @NAV-01", async ({ page }) => {
  await boot(page);
  const tabs = page.locator("nav.tabbar .tab");
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toContainText("Dashboard");
  await expect(tabs.nth(1)).toContainText("Grabar");
  await expect(tabs.nth(2)).toContainText("Creadoras");
  await expect(tabs.nth(0)).toHaveAttribute("aria-current", "page");
  await expect(page.locator("nav.tabbar")).not.toContainText("Más");
  await expect(page.locator("nav.tabbar")).not.toContainText("Bella");
});

test("NAV-03 no counter tiles @NAV-03", async ({ page }) => {
  await boot(page);
  await expect(page.locator(".kpi, .counter-tile")).toHaveCount(0);
});

test("DSH-01 dashboard default @DSH-01", async ({ page }) => {
  await boot(page);
  await expect(page.locator("h1.appbar-title")).toContainText("Dashboard");
});

test("DSH-02 status and actions @DSH-02", async ({ page }) => {
  await boot(page);
  await expect(page.locator(".appbar-status")).toBeVisible();
  await expect(page.locator('[data-act="note"]')).toBeVisible();
  await expect(page.locator('[data-act="ajustes"]')).toBeVisible();
});

test("DSH-04 atajos Feed Boards @DSH-04 @NAV-05", async ({ page }) => {
  await boot(page);
  await expect(page.locator('[data-act="go-feed"]')).toContainText("Feed");
  await expect(page.locator('[data-act="go-boards"]')).toContainText("Boards");
  await page.locator('[data-act="go-feed"]').click();
  await expect(page).toHaveURL(/#\/feed/);
  await page.locator('[data-act="back"]').click();
  await page.locator('[data-act="go-boards"]').click();
  await expect(page).toHaveURL(/#\/boards/);
});

test("DSH-12 avisos only on dashboard @DSH-12", async ({ page }) => {
  await boot(page);
  await expect(page.locator("body")).toContainText("Video de Creadoras");
  await page.locator('[data-tab="grabar"]').click();
  await expect(page.locator("body")).not.toContainText("Video de Creadoras");
});

test("DSH-13 no creator list on dashboard @DSH-13", async ({ page }) => {
  await boot(page);
  await expect(page.locator("nav.tabbar")).toBeVisible();
  await expect(page.locator('[data-act="copy-link"]')).toHaveCount(0);
});

test("DSH-14 placeholders dropped @DSH-14", async ({ page }) => {
  await boot(page, "root-v4-placeholder");
  const titles = await page.locator(".list-title").allTextContents();
  expect(titles.every((x) => !/^(Producto|Video|item)$/i.test(x.trim()))).toBeTruthy();
});

test("VOC-05 no Bella on dashboard @VOC-05 @HR-10", async ({ page }) => {
  await boot(page, "root-v4-bella");
  await expect(page.locator("body")).not.toContainText("Bella");
  await expect(page.locator("body")).toContainText("Creadoras");
});

test("GRB-01 only jorge videos @GRB-01 @GRB-10", async ({ page }) => {
  await boot(page);
  await page.locator('[data-tab="grabar"]').click();
  await expect(page.locator("h1.appbar-title")).toContainText("Grabar");
  await expect(page.locator("body")).not.toContainText("Video creadora");
  await expect(page.locator("body")).toContainText("Hook cocina");
});

test("GRB-02 segmented @GRB-02", async ({ page }) => {
  await boot(page);
  await page.locator('[data-tab="grabar"]').click();
  await expect(page.locator(".seg")).toBeVisible();
});

test("CRE-01 session card @CRE-01 @CRE-03", async ({ page }) => {
  await boot(page);
  await page.locator('[data-tab="creadoras"]').click();
  await expect(page.locator("body")).toContainText("Ana");
  await expect(page.locator('[data-act^="copy-link"]')).toBeVisible();
});

test("CRE-08 read-only without manager @CRE-08", async ({ page }) => {
  await boot(page, "root-v4-nomgr");
  await page.locator('[data-tab="creadoras"]').click();
  await expect(page.locator("body")).toContainText("Solo lectura");
});

test("ONB-01 bienvenida @ONB-01", async ({ page }) => {
  await installSite(page, { scenes: {} });
  await page.goto("https://jorgedearmas.github.io/grok-canvas/app/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toContainText("Comando");
  await expect(page.locator('[data-act="paste"]')).toContainText(t("onb.paste"));
  await expect(page.locator("body")).toContainText(t("onb.hint"));
  await expect(page.locator("nav.tabbar")).toHaveCount(0);
});

test("ONB-04 inline errors @ONB-04", async ({ page }) => {
  await installSite(page, { scenes: {} });
  await page.goto("https://jorgedearmas.github.io/grok-canvas/app/", { waitUntil: "domcontentloaded" });
  await page.locator("textarea").fill("hola");
  await page.locator('[data-act="open-typed"]').click();
  await expect(page.locator("[role=alert]")).toBeVisible();
});

test("AJU-01 settings rows @AJU-01", async ({ page }) => {
  await boot(page);
  await page.locator('[data-act="ajustes"]').click();
  await expect(page.locator("h1")).toContainText("Ajustes");
  await expect(page.locator("body")).toContainText("Tema");
  await expect(page.locator("body")).toContainText("Olvidar este teléfono");
});

test("THM-01 theme tokens @THM-01", async ({ page }) => {
  await boot(page);
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
  expect(bg === "#F2F2F7" || bg === "#000000" || bg === "#000").toBeTruthy();
});

test("BRD-02 lane labels Creadoras @BRD-02", async ({ page }) => {
  await boot(page);
  await page.locator('[data-act="go-boards"]').click();
  await expect(page.locator("body")).toContainText("Creadoras");
  await expect(page.locator("body")).not.toContainText("Bella");
});

test("FED-02 feed lanes @FED-02", async ({ page }) => {
  await boot(page);
  await page.locator('[data-act="go-feed"]').click();
  await expect(page.locator("body")).toContainText("Creadoras");
});

test("DAT-04 no ISO dates visible @DAT-04", async ({ page }) => {
  await boot(page);
  const text = await page.locator("#app").innerText();
  expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
});

test("ICO-01 inline svg icons @ICO-01", async ({ page }) => {
  await boot(page);
  await expect(page.locator("nav.tabbar svg")).toHaveCount(3);
});

test("ERR-01 host copy @ERR-01 @B-13", async ({ page }) => {
  await page.route("**/*", (route) => route.continue());
  await page.addInitScript(() => {
    Object.defineProperty(location, "hostname", { get: () => "example.com" });
  });
  // Host check uses location.hostname at render; served locally via github.io route.
  const ctx = await installSite(page, { scenes: { root: catalog("root-v4") } });
  await openApp(page, ctx.sealed.root);
  await expect(page.locator("body")).not.toContainText("__CANVAS_HOST__");
});

test("empty dashboard @DSH-10", async ({ page }) => {
  await boot(page, "root-v4-empty");
  await expect(page.locator("body")).toContainText("Ningún producto");
});
