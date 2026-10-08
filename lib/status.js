import { t } from "./copy.js";
import { expiryLabel, daysUntil } from "./dates.js";

const VIDEO = {
  preparing: { label: "Preparando", tone: "neutral", icon: "hourglass" },
  to_film: { label: "Por grabar", tone: "accent", icon: "video", action: "Abrir board" },
  filmed: { label: "Grabado", tone: "teal", icon: "circle-check", action: "Abrir board" },
  editing: { label: "Editando", tone: "info", icon: "scissors", action: "Abrir board" },
  to_publish: { label: "Por publicar", tone: "warn", icon: "send", action: "Publicado" },
  published: { label: "Publicado", tone: "good", icon: "badge-check", action: "Abrir board" },
  to_approve: { label: "Por aprobar", tone: "warn", icon: "thumbs-up", action: "Revisar" },
  problem: { label: "Con problema", tone: "bad", icon: "triangle-alert", action: "Abrir board" },
  retired: { label: "Retirado", tone: "neutral", icon: "archive" },
};

const VIDEO_LEGACY = {
  "board en camino": "preparing",
  "armando pack": "preparing",
  "armando el board": "preparing",
  "grok arma el board": "preparing",
  "grok arma el pack": "preparing",
  "board listo": "to_film",
  grabado: "filmed",
  editando: "editing",
  aprobado: "editing",
  entregado: "to_publish",
  publicado: "published",
  violación: "problem",
  "sin link": "problem",
  retirado: "retired",
};

const STAGE = {
  chosen: { label: "Elegido", tone: "neutral", icon: "circle-plus" },
  sample_requested: { label: "Muestra pedida", tone: "warn", icon: "package" },
  sample_shipping: { label: "En camino", tone: "info", icon: "truck" },
  arrived: { label: "Llegó", tone: "teal", icon: "package-check" },
  researching: { label: "Investigando", tone: "neutral", icon: "search" },
  pick_script: { label: "Elige guion", tone: "accent", icon: "pen-line" },
  preparing: { label: "Preparando", tone: "neutral", icon: "hourglass" },
  to_film: { label: "Por grabar", tone: "accent", icon: "video" },
  filmed: { label: "Grabado", tone: "teal", icon: "circle-check" },
  editing: { label: "Editando", tone: "info", icon: "scissors" },
  to_publish: { label: "Por publicar", tone: "warn", icon: "send" },
  published: { label: "Publicado", tone: "good", icon: "badge-check" },
  brand_hold: { label: "Decidir oferta", tone: "warn", icon: "handshake" },
  dropped: { label: "Descartado", tone: "neutral", icon: "circle-x" },
};

const STAGE_LEGACY = {
  elegido: "chosen",
  "muestra por aprobar": "sample_requested",
  "muestra pedida": "sample_requested",
  "en camino": "sample_shipping",
  llegó: "arrived",
  "content gap listo": "researching",
  identificando: "researching",
  "content gap": "researching",
  "guiones por aprobar": "pick_script",
  "armando pack": "preparing",
  "pack listo": "to_film",
  grabado: "filmed",
  editando: "editing",
  "por publicar": "to_publish",
  publicado: "published",
  "decidir oferta": "brand_hold",
  dropped: "dropped",
};

const JOB = {
  sent: { label: "Enviado", creator: "Por grabar", tone: "neutral", icon: "send" },
  opened: { label: "Visto", creator: "Por grabar", tone: "info", icon: "eye" },
  uploading: { label: "Subiendo", creator: "Subiendo", tone: "accent", icon: "loader-circle" },
  uploaded: { label: "Subido", creator: "Subido", tone: "warn", icon: "circle-check" },
  approved: { label: "Aprobado", creator: "Aprobado", tone: "good", icon: "thumbs-up" },
  redo: { label: "Re-grabar", creator: "Re-grabar", tone: "bad", icon: "rotate-ccw" },
  pulled: { label: "En la Mac", creator: null, tone: "teal", icon: "hard-drive-upload" },
};

const TAKE = {
  missing: { label: "Falta", tone: "neutral", icon: "circle" },
  uploading: { label: "Subiendo", tone: "accent", icon: "loader-circle" },
  paused: { label: "En pausa", tone: "warn", icon: "circle-pause" },
  uploaded: { label: "Subido", tone: "accent", icon: "circle-check" },
  approved: { label: "Aprobado", tone: "good", icon: "circle-check" },
  redo: { label: "Re-grabar", tone: "bad", icon: "rotate-ccw" },
  pulled: { label: "En la Mac", tone: "teal", icon: "circle-check" },
};

const TASK_KIND = {
  pick_script: { icon: "pen-line", tone: "accent" },
  publish: { icon: "send", tone: "warn" },
  sample: { icon: "package", tone: "warn" },
  brand_reply: { icon: "mail", tone: "info" },
  brand_decide: { icon: "handshake", tone: "info" },
  brand_bounce: { icon: "triangle-alert", tone: "bad" },
  deliver: { icon: "package-check", tone: "teal" },
  move_takes: { icon: "hard-drive-upload", tone: "teal" },
  choose_products: { icon: "shopping-bag", tone: "accent" },
  approve_media: { icon: "thumbs-up", tone: "warn" },
  other: { icon: "circle-dot", tone: "neutral" },
};

const VERB_KIND = [
  [/elegir guion/i, "pick_script"],
  [/publicar/i, "publish"],
  [/\bllegó\b|\bmuestras\b|pedí muestra|la aprobaron|lo tengo/i, "sample"],
  [/enviar respuesta|responder/i, "brand_reply"],
  [/decidir oferta/i, "brand_decide"],
  [/email rebotó|rebotó/i, "brand_bounce"],
  [/entregar/i, "deliver"],
  [/pasar tomas/i, "move_takes"],
  [/elegir productos/i, "choose_products"],
  [/dar go|aprobar/i, "approve_media"],
];

function fold(s) {
  return String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function unknown(text) {
  const label = String(text || "").trim() || "—";
  return { id: "unknown", label, tone: "neutral", icon: "circle-dot" };
}

export function video(id, fallbackText) {
  if (VIDEO[id]) return { id, ...VIDEO[id] };
  const mapped = VIDEO_LEGACY[fold(id)] || VIDEO_LEGACY[fold(fallbackText)];
  if (mapped && VIDEO[mapped]) return { id: mapped, ...VIDEO[mapped] };
  return unknown(fallbackText || id);
}

export function stage(id, fallbackText) {
  if (STAGE[id]) return { id, ...STAGE[id] };
  const mapped = STAGE_LEGACY[fold(id)] || STAGE_LEGACY[fold(fallbackText)];
  if (mapped && STAGE[mapped]) return { id: mapped, ...STAGE[mapped] };
  return unknown(fallbackText || id);
}

export function session(s, now = new Date()) {
  if (!s) return unknown("");
  if (s.revoked || s.revoked_at) return { id: "revoked", label: "Revocada", tone: "neutral", icon: "ban" };
  const exp = s.expiresAt || s.expires_at;
  if (exp && new Date(exp) <= now) return { id: "expired", label: "Vencida", tone: "neutral", icon: "circle-x" };
  if (exp && daysUntil(exp, now) <= 2) {
    return { id: "expiring", label: expiryLabel(exp, now), tone: "warn", icon: "hourglass" };
  }
  return { id: "active", label: "Activa", tone: "good", icon: "circle-check" };
}

export function job(id, role = "approver") {
  const row = JOB[id];
  if (!row) return unknown(id);
  if (id === "pulled" && role === "creator") {
    return { id: "uploaded", ...JOB.uploaded, label: JOB.uploaded.creator };
  }
  const label = role === "creator" ? (row.creator || row.label) : row.label;
  const tone = id === "uploaded" && role === "creator" ? "accent" : row.tone;
  return { id, label, tone, icon: row.icon };
}

export function take(state, role = "creator") {
  const id = state && state.id ? state.id : state;
  const row = TAKE[id];
  if (!row) return unknown(id);
  if (id === "pulled" && role === "creator") {
    const under = (state && state.review) || "uploaded";
    return take(under, "creator");
  }
  let label = row.label;
  let tone = row.tone;
  if (id === "uploading" && state && state.pct != null) {
    label = `Subiendo ${Math.round(Number(state.pct) * 100)} %`;
  }
  if (id === "uploaded" && role === "approver") tone = "warn";
  if (id === "uploaded" && role === "creator") tone = "accent";
  return { id, label, tone, icon: row.icon };
}

export function taskKind(kind) {
  return TASK_KIND[kind] || TASK_KIND.other;
}

export function verbToKind(verb) {
  const s = String(verb || "");
  for (const [re, kind] of VERB_KIND) if (re.test(s)) return kind;
  return "other";
}

export function videoFromLegacy(text, kind) {
  const folded = fold(text);
  if (folded === "board listo" && kind === "ai") return video("to_approve");
  if (folded === "aprobado" && kind === "ai") return video("editing");
  return video(null, text);
}

export const STAGE_ORDER = Object.keys(STAGE);
export const VIDEO_SECTION_ORDER = [
  "problem", "to_film", "preparing", "filmed", "editing", "to_approve", "to_publish", "published", "retired",
];

export { VIDEO, STAGE, JOB, TAKE, TASK_KIND };
