import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function axeSource() {
  return fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
}

export async function runAxe(page) {
  await page.addInitScript(() => {});
  await page.evaluate(axeSource());
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  });
}
