import { test, expect } from "@playwright/test";
import { installSite, catalog } from "./helpers/site.mjs";

test("LNK-01 comando redirector @LNK-01", async ({ page }) => {
  const ctx = await installSite(page, { scenes: { root: catalog("root-v4") } });
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/comando.html${ctx.sealed.root.hash}`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/app\//);
  expect(page.url()).toContain("b=");
});

test("LNK-02 hub redirector @LNK-02", async ({ page }) => {
  const ctx = await installSite(page, { scenes: { root: catalog("root-v4") } });
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/hub.html${ctx.sealed.root.hash}`);
  await expect(page).toHaveURL(/\/app\//);
});

test("LNK-03 grabacion redirector @LNK-03", async ({ page }) => {
  const ctx = await installSite(page, { scenes: { film: catalog("filming-v2") } });
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/grabacion.html${ctx.sealed.film.hash}`);
  await expect(page).toHaveURL(/\/app\//);
});

test("LNK-04 boards redirector @LNK-04", async ({ page }) => {
  const ctx = await installSite(page, { scenes: { boards: catalog("boards-v2") } });
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/boards.html${ctx.sealed.boards.hash}`);
  await expect(page).toHaveURL(/\/app\//);
});

test("LNK-05 feed redirector @LNK-05", async ({ page }) => {
  const ctx = await installSite(page, { scenes: { feed: catalog("creator-feed") } });
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/feed.html${ctx.sealed.feed.hash}`);
  await expect(page).toHaveURL(/\/app\//);
});

test("LNK-06 manager redirector @LNK-06", async ({ page }) => {
  const ctx = await installSite(page, { scenes: { root: catalog("root-v4") } });
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/manager.html${ctx.sealed.root.hash}&m=mgrtokensynthetic01`);
  await expect(page).toHaveURL(/\/app\//);
});

test("LNK-07 board redirector @LNK-07", async ({ page }) => {
  const ctx = await installSite(page, { scenes: { board: catalog("board-v2") } });
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/board.html${ctx.sealed.board.hash}`);
  await expect(page).toHaveURL(/\/app\//);
});

test("LNK-08 portal stays @LNK-08 @POR-01", async ({ page }) => {
  const ctx = await installSite(page, { scenes: { portal: catalog("portal-v2") } });
  await page.goto(`https://jorgedearmas.github.io/grok-canvas/portal.html${ctx.sealed.portal.hash}&t=creatortokensynth01`);
  await expect(page).toHaveURL(/portal\.html/);
  await expect(page.locator("body")).toContainText("Ana");
});

test("IDX-03 no githack in index CSP @IDX-03", async ({ page }) => {
  await installSite(page, { scenes: {} });
  await page.goto("https://jorgedearmas.github.io/grok-canvas/index.html");
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).not.toContain("githack");
  expect(csp).not.toContain("raw.githubusercontent.com");
});

test("PRV-01 preview demo @PRV-01", async ({ page }) => {
  const reqs = [];
  await installSite(page, { scenes: {} });
  page.on("request", (r) => reqs.push(r.url()));
  await page.goto("https://jorgedearmas.github.io/grok-canvas/preview.html");
  await expect(page.locator("body")).toContainText("Demo con datos de ejemplo.");
  await expect(page.locator("body")).toContainText("LO QUE DICES");
  await expect(page.locator("body")).toContainText("Qué haces");
  expect(page.url()).not.toMatch(/[?&#]b=/);
});
