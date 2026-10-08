#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "app", "icons");
const HASH = path.join(DIR, "ICONS.sha256");
const SVG = fs.readFileSync(path.join(DIR, "icon.svg"), "utf8");

const PNGS = [
  { name: "icon-192.png", w: 192, h: 192, glyph: 0.5 },
  { name: "icon-512.png", w: 512, h: 512, glyph: 0.5 },
  { name: "maskable-512.png", w: 512, h: 512, glyph: 0.4, full: true },
  { name: "apple-touch-icon-180.png", w: 180, h: 180, glyph: 0.5, opaque: true },
];
const SPLASH = [
  [1170, 2532], [1179, 2556], [1284, 2778], [1290, 2796], [1125, 2436],
];

function pageHtml(w, h, bg, glyphScale, full) {
  const g = Math.round(w * glyphScale);
  return `<!doctype html><html><body style="margin:0;background:${bg}">
    <div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;background:${full ? "linear-gradient(135deg,#0060DF,#5E5CE6)" : bg}">
      <div style="width:${g}px;height:${g}px">${full ? SVG.replace("<rect width=\"512\"", "<rect width=\"512\" opacity=\"0\"") : SVG}</div>
    </div></body></html>`;
}

async function renderAll() {
  const browser = await chromium.launch();
  const files = [];
  for (const p of PNGS) {
    const page = await browser.newPage({ viewport: { width: p.w, height: p.h } });
    await page.setContent(pageHtml(p.w, p.h, p.full ? "transparent" : "#0060DF", p.glyph, p.full));
    const buf = await page.screenshot({ type: "png", omitBackground: !p.opaque && !p.full });
    fs.writeFileSync(path.join(DIR, p.name), buf);
    files.push(p.name);
    await page.close();
  }
  for (const [w, h] of SPLASH) {
    for (const [theme, bg] of [["light", "#F2F2F7"], ["dark", "#000000"]]) {
      const name = `splash-${w}x${h}-${theme}.png`;
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const g = Math.round(w * 0.3);
      await page.setContent(`<!doctype html><html><body style="margin:0;background:${bg}">
        <div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;background:${bg}">
          <div style="width:${g}px;height:${g}px">${SVG}</div>
        </div></body></html>`);
      fs.writeFileSync(path.join(DIR, name), await page.screenshot({ type: "png" }));
      files.push(name);
      await page.close();
    }
  }
  await browser.close();
  const lines = files.sort().map((n) => {
    const sum = crypto.createHash("sha256").update(fs.readFileSync(path.join(DIR, n))).digest("hex");
    return `${sum}  ${n}`;
  });
  fs.writeFileSync(HASH, lines.join("\n") + "\n");
  return lines;
}

function check() {
  if (!fs.existsSync(HASH)) throw new Error("missing ICONS.sha256");
  const listed = fs.readFileSync(HASH, "utf8").trim().split("\n");
  for (const line of listed) {
    const [sum, name] = line.split(/\s+/);
    const buf = fs.readFileSync(path.join(DIR, name));
    const got = crypto.createHash("sha256").update(buf).digest("hex");
    if (got !== sum) throw new Error("hash mismatch " + name);
  }
}

if (process.argv.includes("--check")) {
  check();
  console.log("icons hash ok");
} else {
  const lines = await renderAll();
  console.log("wrote", lines.length, "pngs");
}
