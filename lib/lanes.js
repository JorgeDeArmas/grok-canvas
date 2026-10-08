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
