import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

function addAct(names, raw) {
  const name = String(raw || "").split(":")[0].trim();
  if (/^[a-z][a-z0-9-]*$/.test(name)) names.add(name);
}

function renderedActs(src) {
  const names = new Set();
  const token = 'data-act="';
  let i = 0;
  while ((i = src.indexOf(token, i)) !== -1) {
    let j = i + token.length;
    let depth = 0;
    let buf = "";
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "{") depth++;
      else if (c === "}") depth = Math.max(0, depth - 1);
      else if (c === '"' && depth === 0) break;
      buf += c;
    }
    addAct(names, buf);
    for (const q of buf.matchAll(/["']([a-z][a-z0-9-]*)["']/g)) addAct(names, q[1]);
    i = j + 1;
  }
  for (const m of src.matchAll(/\b(?:act|ctaAct|confirmAct)\s*[:=]\s*["'`]([a-z][a-z0-9-]*)/g)) addAct(names, m[1]);
  return names;
}

function handledActs(src) {
  const start = src.indexOf("async function handleAct");
  const end = src.indexOf("\nfunction productListSheet");
  const body = src.slice(start, end);
  const names = new Set();
  for (const m of body.matchAll(/name === "([a-z][a-z0-9-]*)"/g)) names.add(m[1]);
  return names;
}

test("every rendered data-act has a handler", () => {
  const rendered = new Set();
  for (const file of [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "lib"))]) {
    for (const name of renderedActs(fs.readFileSync(file, "utf8"))) rendered.add(name);
  }
  const handled = handledActs(fs.readFileSync(path.join(ROOT, "app", "app.js"), "utf8"));
  const missing = [...rendered].filter((name) => !handled.has(name)).sort();
  assert.deepEqual(missing, []);
  assert.ok(handled.has("note-feed"));
  assert.ok(handled.has("creator-board"));
  assert.ok(handled.has("feed-sound"));
  assert.ok(!rendered.has("product-pill"));
});
