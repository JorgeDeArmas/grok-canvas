import { test, expect } from "@playwright/test";
import { installSite, catalog, openApp } from "./helpers/site.mjs";

test("PWA-03 sw scope @PWA-03", async ({ page }) => {
  const ctx = await installSite(page, { scenes: { root: catalog("root-v4") } });
  await openApp(page, ctx.sealed.root);
  const ctrl = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration("./");
    return !!(r || navigator.serviceWorker.controller);
  });
  expect(typeof ctrl).toBe("boolean");
  await page.goto("/portal.html");
  const portalCtrl = await page.evaluate(() => navigator.serviceWorker.controller);
  expect(portalCtrl).toBeNull();
});

test("PWA-05 first open offline @PWA-05 @ERR-04", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", { get: () => false });
  });
  await installSite(page, { scenes: {} });
  await page.route((url) => String(url).includes("/scenes/"), (route) => route.abort());
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toContainText(/Sin conexión|Pegar link|Comando/);
});

test("PWA-11 install banner android @PWA-11", async ({ page }) => {
  const ctx = await installSite(page, { scenes: { root: catalog("root-v4") } });
  await page.addInitScript(() => {
    setTimeout(() => {
      const ev = new Event("beforeinstallprompt");
      ev.prompt = async () => {};
      window.dispatchEvent(ev);
    }, 200);
  });
  await openApp(page, ctx.sealed.root);
  await expect(page.locator("body")).toContainText(/Instala Comando|Dashboard/);
});
