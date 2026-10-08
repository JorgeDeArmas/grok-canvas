import { defineConfig, devices } from "@playwright/test";

const IPHONE = {
  ...devices["iPhone 14"],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: "es-US",
};

export default defineConfig({
  testDir: "tests/v2",
  retries: 0,
  fullyParallel: true,
  workers: process.env.CI ? 4 : 2,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "https://jorgedearmas.github.io/grok-canvas",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone-webkit-light", use: { ...IPHONE, browserName: "webkit", colorScheme: "light" } },
    { name: "phone-webkit-dark", use: { ...IPHONE, browserName: "webkit", colorScheme: "dark" } },
    {
      name: "phone-chromium-light",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        colorScheme: "light",
        locale: "es-US",
      },
    },
    {
      name: "pwa-chromium",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        colorScheme: "light",
        serviceWorkers: "allow",
      },
      testMatch: /pwa\.spec\.mjs/,
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, colorScheme: "light" },
    },
  ],
});
