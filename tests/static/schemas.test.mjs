import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { CATALOG } from "../v2/helpers/fixtures.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function makeAjv(strict = true) {
  const Ajv2020 = (await import("ajv/dist/2020.js")).default;
  const addFormats = (await import("ajv-formats")).default;
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  for (const name of ["comando-v4", "boards-v2", "board-v2", "portal-v2"]) {
    const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/site-v2/schemas", name + ".schema.json"), "utf8"));
    if (!ajv.getSchema(schema.$id)) ajv.addSchema(schema);
  }
  return ajv;
}

test("SCH-01 schemas compile", async () => {
  const ajv = await makeAjv(true);
  for (const name of ["comando-v4", "boards-v2", "board-v2", "portal-v2"]) {
    const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/site-v2/schemas", name + ".schema.json"), "utf8"));
    assert.ok(ajv.getSchema(schema.$id) || ajv.compile(schema));
  }
});

test("SCH-02 valid fixtures", async () => {
  const ajv = await makeAjv(false);
  const comando = ajv.getSchema("https://jorgedearmas.github.io/grok-canvas/docs/site-v2/schemas/comando-v4.schema.json");
  const portal = ajv.getSchema("https://jorgedearmas.github.io/grok-canvas/docs/site-v2/schemas/portal-v2.schema.json");
  const board = ajv.getSchema("https://jorgedearmas.github.io/grok-canvas/docs/site-v2/schemas/board-v2.schema.json");
  if (comando) assert.equal(comando(CATALOG["root-v4"]()), true, JSON.stringify(comando.errors));
  if (portal) assert.equal(portal(CATALOG["portal-v2"]()), true, JSON.stringify(portal.errors));
  if (board) assert.equal(board(CATALOG["board-v2"]()), true, JSON.stringify(board.errors));
});

test("SCH-03 hostile / forbidden fail or are marked", () => {
  const forbidden = CATALOG["portal-v2-forbidden"]();
  assert.ok(forbidden.managerToken);
});

test("VOC-05 copy has no Bella", async () => {
  const { allCopyValues } = await import("../../lib/copy.js");
  for (const v of allCopyValues()) {
    assert.doesNotMatch(v, /\bBella\b/);
    assert.doesNotMatch(v, /enlace/i);
  }
});

test("ICO-01 icon names from PRD", async () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts/vendor-icons.mjs"), "utf8");
  assert.match(src, /clapperboard/);
  assert.match(src, /layout-dashboard/);
});

test("SEC-04 no innerHTML outside html.js", () => {
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".js")) {
        const s = fs.readFileSync(p, "utf8");
        if (p.endsWith("html.js")) continue;
        assert.doesNotMatch(s, /\.innerHTML\s*=/, p);
        assert.doesNotMatch(s, /insertAdjacentHTML|document\.write|new Function\(|\beval\(/, p);
      }
    }
  };
  walk(path.join(ROOT, "lib"));
  walk(path.join(ROOT, "app"));
});

test("SEC-07 portal import graph", () => {
  const js = fs.readFileSync(path.join(ROOT, "lib/portal.js"), "utf8");
  const imports = js.split("\n").filter((l) => l.startsWith("import "));
  const blob = imports.join("\n");
  assert.doesNotMatch(blob, /keyring|outbox|worker-api|screens\//);
  assert.doesNotMatch(blob, /model\.js/);
});

test("PWA-01 manifest fields", () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "app/manifest.webmanifest"), "utf8"));
  assert.equal(m.id, "/grok-canvas/app/");
  assert.equal(m.start_url, "./");
  assert.equal(m.scope, "./");
  assert.equal(m.display, "standalone");
  assert.equal(m.lang, "es-US");
});

test("PWA-02 no secrets in manifest", () => {
  const files = ["app/manifest.webmanifest", "app/index.html", "app/sw.js"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8"));
  for (const s of files) {
    assert.doesNotMatch(s, /[?&#]b=/);
    assert.doesNotMatch(s, /[?&#]k=/);
  }
});

test("IDX-03 index CSP", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.doesNotMatch(html, /githack|raw\.githubusercontent\.com/);
});

test("LNK redirectors identical", () => {
  const a = fs.readFileSync(path.join(ROOT, "comando.html"), "utf8");
  for (const f of ["hub.html", "grabacion.html", "boards.html", "feed.html", "manager.html", "board.html"]) {
    assert.equal(fs.readFileSync(path.join(ROOT, f), "utf8"), a);
  }
  assert.match(a, /lib\/redirect\.js/);
  assert.match(a, /data-to="app\/"/);
});
