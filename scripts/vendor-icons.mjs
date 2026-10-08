#!/usr/bin/env node
/**
 * Extract the Lucide subset listed in PRD §4.2 into lib/icons.js.
 * Usage: node scripts/vendor-icons.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "lib", "icons.js");
const require = createRequire(import.meta.url);

const NAMES = [
  "layout-dashboard", "video", "users", "play", "layout-grid", "message-square-text",
  "settings", "chevron-left", "chevron-right", "chevron-down", "x", "check", "circle",
  "loader-circle", "circle-check", "circle-pause", "upload", "refresh-cw", "rotate-ccw",
  "thumbs-up", "copy", "share", "square-plus", "calendar-plus", "ban", "ellipsis",
  "link-2-off", "wifi-off", "inbox", "send", "badge-check", "hourglass", "scissors",
  "triangle-alert", "archive", "pen-line", "package", "truck", "package-check", "search",
  "sparkles", "handshake", "mail", "briefcase", "shopping-bag", "shopping-cart",
  "external-link", "circle-plus", "bell", "map-pin", "calendar", "star", "quote", "hand",
  "film", "list-ordered", "file-text", "hard-drive-upload", "eye", "heart", "message-circle",
  "repeat-2", "bookmark", "sliders-horizontal", "smartphone", "sun-moon", "log-out",
  "key-round", "info", "circle-dot", "circle-x", "clapperboard",
];

const ALIASES = {
  "loader-2": "loader-circle",
  "check-circle-2": "circle-check",
  "plus-square": "square-plus",
  "more-horizontal": "ellipsis",
  "alert-triangle": "triangle-alert",
  "share-2": "repeat-2",
};

function loadLucide() {
  const pkg = path.dirname(require.resolve("lucide-static/package.json"));
  const iconDir = path.join(pkg, "icons");
  const map = {};
  for (const name of [...NAMES, ...Object.keys(ALIASES)]) {
    const file = path.join(iconDir, `${name}.svg`);
    if (!fs.existsSync(file)) continue;
    const svg = fs.readFileSync(file, "utf8");
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "").trim();
    map[name] = inner;
  }
  for (const [alias, canon] of Object.entries(ALIASES)) {
    if (!map[canon] && map[alias]) map[canon] = map[alias];
  }
  return { map, version: JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8")).version };
}

function render(map, version) {
  const missing = NAMES.filter((n) => !map[n]);
  if (missing.length) throw new Error("missing lucide icons: " + missing.join(", "));
  const json = JSON.stringify(map, null, 2);
  return `/**
 * Lucide icons (ISC License) — https://lucide.dev
 * Copyright (c) Lucide Contributors
 * Vendored subset from lucide-static@${version}. Do not edit by hand; run scripts/vendor-icons.mjs.
 */
import { raw } from "./html.js";

export const LUCIDE_VERSION = ${JSON.stringify(version)};

const PATHS = ${json};

export const ICON_NAMES = Object.keys(PATHS);

export function icon(name, { size = 24, label } = {}) {
  const inner = PATHS[name];
  if (!inner) return raw("");
  const aria = label
    ? \`aria-label="\${String(label).replace(/"/g, "&quot;")}" role="img"\`
    : 'aria-hidden="true"';
  return raw(\`<svg viewBox="0 0 24 24" width="\${size}" height="\${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" \${aria}>\${inner}</svg>\`);
}
`;
}

const { map, version } = loadLucide();
const next = render(map, version);
if (process.argv.includes("--check")) {
  if (!fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== next) {
    console.error("lib/icons.js is stale; run node scripts/vendor-icons.mjs");
    process.exit(1);
  }
  console.log("icons ok", version);
} else {
  fs.writeFileSync(OUT, next);
  console.log("wrote lib/icons.js", version, Object.keys(map).length);
}
