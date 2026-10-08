#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHELL_FILES = [
  "app/index.html", "app/app.js", "app/manifest.webmanifest", "lib/ui.css",
  "lib/html.js", "lib/copy.js", "lib/core.js", "lib/dates.js", "lib/status.js",
  "lib/lanes.js", "lib/icons.js", "lib/components.js", "lib/keyring.js",
  "lib/outbox.js", "lib/model.js", "lib/worker-api.js", "lib/upload.js", "lib/board.js",
];

function hashShell() {
  const h = crypto.createHash("sha256");
  for (const f of SHELL_FILES) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) h.update(fs.readFileSync(p));
  }
  return h.digest("hex").slice(0, 7);
}

function writeVersion(ver) {
  const versionJs = `export const VERSION = ${JSON.stringify(ver)};\n`;
  fs.writeFileSync(path.join(ROOT, "app/version.js"), versionJs);
  const swPath = path.join(ROOT, "app/sw.js");
  let sw = fs.readFileSync(swPath, "utf8");
  sw = sw.replace(/const VERSION = "[^"]+";/, `const VERSION = "${ver}";`);
  fs.writeFileSync(swPath, sw);
}

const ver = `2.0.0+${hashShell()}`;
if (process.argv.includes("--check")) {
  const cur = fs.readFileSync(path.join(ROOT, "app/version.js"), "utf8");
  if (!cur.includes(hashShell())) {
    console.error("version stale; run node scripts/release.mjs");
    process.exit(1);
  }
  console.log("release ok", ver);
} else {
  writeVersion(ver);
  console.log("VERSION", ver);
}
