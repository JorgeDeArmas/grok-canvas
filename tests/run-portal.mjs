import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "portal.html"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "lib/portal.js"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(!html.includes("webhook.site"), "portal CSP must not include webhook.site");
assert(!html.includes("unsafe-inline") || html.includes("style-src 'self' 'unsafe-inline'"), "styles only");
assert(html.includes('src="lib/portal.js"'), "module portal");
assert(!html.includes("<script>") || html.includes('type="module"'), "no inline script");
const imports = js.split("\n").filter((l) => l.startsWith("import ")).join("\n");
assert(!/keyring|outbox|model\.js|worker-api|screens\//.test(imports), "SEC-07 import boundary");
assert(/from "\.\/(core|html|dates|copy|status|icons|components|board|upload)\.js"/.test(imports), "allowed imports");
console.log("portal smoke OK");
