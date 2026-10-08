/**
 * html tagged template — the only place allowed to assign innerHTML.
 * Every ${} interpolation is escaped unless wrapped in raw().
 */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
}

export function raw(value) {
  return { __html: String(value ?? "") };
}

export function attr(name, value) {
  if (value == null || value === false) return raw("");
  if (value === true) return raw(` ${escapeHtml(name)}`);
  return raw(` ${escapeHtml(name)}="${escapeHtml(value)}"`);
}

export function classMap(map) {
  const parts = [];
  for (const [k, on] of Object.entries(map || {})) if (on) parts.push(k);
  return parts.join(" ");
}

function interpolate(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(interpolate).join("");
  if (typeof value === "object" && value.__html != null) return String(value.__html);
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += interpolate(values[i]) + strings[i + 1];
  return raw(out);
}

html.raw = raw;

export function setHtml(el, content) {
  const htmlStr = content && typeof content === "object" && content.__html != null
    ? String(content.__html)
    : escapeHtml(content);
  el.innerHTML = htmlStr;
  return el;
}
