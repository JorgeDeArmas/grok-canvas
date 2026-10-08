import { t } from "./copy.js";

/** Display labels override any scene label so «Bella» never renders. */
export const LANES = {
  miamix: "Miami X",
  bella: "Creadoras",
  creadoras: "Creadoras",
};

export function laneLabel(id) {
  const key = String(id || "").trim().toLowerCase();
  return LANES[key] || "";
}

export function laneId(raw) {
  const key = String(raw || "").trim().toLowerCase();
  if (key === "creadoras" || key === "bella") return "bella";
  if (key === "miamix") return "miamix";
  return key;
}

/** Scene prose still says the old lane name. Lane ids are unchanged. */
export function rewriteLaneWords(s) {
  return String(s ?? "").replace(/\bBella\b/g, "Creadoras");
}

const DONOR_FRAME = /framework\s*\(\s*donor\s*\)/i;

/**
 * Sealed boards still store the old donor title. Rewrite it when showing
 * the list so a republish is not required.
 */
export function boardDisplayTitle(title, lane) {
  const raw = rewriteLaneWords(title);
  if (!DONOR_FRAME.test(raw)) return raw;
  const label = laneLabel(lane);
  const base = t("board.ref");
  return label ? `${base} · ${label}` : base;
}
