import { html, raw } from "../html.js";
import { renderBoard, normalizeBoard } from "../board.js";
import { t } from "../copy.js";
import { ErrorState } from "../components.js";

export function render(store) {
  const board = store.board;
  if (!board) return ErrorState({ title: t("err.boardOpen.title"), action: t("common.retry"), act: "retry" });
  const n = normalizeBoard(board);
  const role = store.boardRole || "viewer";
  return renderBoard(n, { role, live: store.ownerLive || store.boardLive, uploads: store.uploads || {} });
}
