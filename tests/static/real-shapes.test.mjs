import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  hubV3Live, boardsV1Live, creatorFeedLive, canvasFf, canvasCharts, filmingV2Live,
} from "../v2/helpers/fixtures.mjs";
import { fromHubV3, fromBoards, fromFilming, mergeFilming, adaptRoot } from "../../lib/model.js";
import { scoreText, render as renderFeed } from "../../lib/screens/feed.js";
import { render as renderGrabar } from "../../lib/screens/grabar.js";
import { render as renderCreadoras } from "../../lib/screens/creadoras.js";
import { render as renderBoards } from "../../lib/screens/boards.js";
import { adaptCanvasScene, boardViewerKind, normalizeBoard, renderBoard } from "../../lib/board.js";
import { job } from "../../lib/status.js";
import { shootDayLabel, spokenIso } from "../../lib/dates.js";
import { boardDisplayTitle } from "../../lib/lanes.js";

function markup(node) {
  return node && node.__html != null ? node.__html : String(node || "");
}

test("feed score object is not stringified", () => {
  assert.equal(scoreText({ value: 91, label: "Feed v3", coverage: 0.8 }), "Feed v3 91");
  assert.equal(scoreText({ value: 40, label: "GMV Max" }), "GMV Max 40");
  assert.equal(scoreText(88), "Score 88");
  assert.equal(scoreText({}), "");
  const html = markup(renderFeed({
    feed: creatorFeedLive(),
    feedLane: "all",
    feedFilter: {},
    feedBlob: "feedblob01xx",
    model: {},
  }));
  assert.doesNotMatch(html, /\[object Object\]/);
  assert.match(html, /Feed v3 91/);
  assert.match(html, /Waffle de cortina/);
  assert.match(html, /\$24\.00/);
  assert.match(html, /Comisión 12%/);
  assert.match(html, /Abrir en TikTok/);
  assert.match(html, /class="want"/);
  assert.match(html, /Lo quiero/);
  assert.doesNotMatch(html, /data-cover=/);
  assert.match(html, /data-enc="https:\/\/[^"]+\/media\/m0123456789abcdef\.enc"/);
  assert.match(html, /<video class="feed-preview"[^>]*data-enc="https:\/\/[^"]+\/media\/mabcdef0123456789\.enc"/);
  assert.match(html, /1\.2 M/);
  assert.match(html, /Producto sin identificar/);
  assert.match(html, />—</);
});

test("hub v3 keeps boards and filming refs in memory", () => {
  const m = fromHubV3(hubV3Live());
  assert.equal(m.version, 3);
  assert.equal(m.ownerToken ? "present" : "", "present");
  assert.equal(m.keyring.boards.b, "boardsblob01");
  assert.equal(m.keyring.filming.b, "filmingbl01x");
  assert.equal(m.keyring.feed.b, "feedblob01xx");
  assert.notEqual(m.keyring.boards.b, m.keyring.filming.b);
  const spoken = m.videos.find((v) => v.id === "rec:ff010");
  assert.equal(spoken.day, "2026-10-10");
  assert.equal(spoken.boardRef.b, "canvasblob01");
  const bare = m.videos.find((v) => v.id === "rec:cortina");
  assert.equal(bare.boardRef, null);
  const merged = mergeFilming(m, fromFilming(filmingV2Live()));
  const html = markup(renderGrabar({
    model: merged,
    route: { seg: "todo" },
    now: new Date("2026-10-08T13:00:00.000Z"),
    filmBlob: "filmingbl01x",
  }));
  assert.match(html, /sáb 10 oct/);
  assert.doesNotMatch(html, /Sin fecha/);
  assert.match(html, /Board en camino/);
  assert.match(html, /disabled/);
  assert.match(html, /Abrir board/);
  assert.equal(shootDayLabel("2026-10-10"), "sáb 10 oct");
  assert.equal(spokenIso("Sábado 10 oct", 2026), "2026-10-10");
  assert.equal(spokenIso("sáb 10 oct", 2026), "2026-10-10");
});

test("boards v1 shows a plain reference title and keeps the canvas ref", () => {
  assert.equal(boardDisplayTitle("Framework (donor) para Bella", "bella"), "Video de referencia · Creadoras");
  assert.equal(boardDisplayTitle("Framework (donor)", ""), "Video de referencia");
  assert.equal(boardDisplayTitle("Pack de grabación", "miamix"), "Pack de grabación");
  const data = fromBoards(boardsV1Live());
  const fw = data.boards.find((b) => b.id === "fw1");
  assert.equal(fw.title, "Video de referencia · Creadoras");
  assert.doesNotMatch(fw.title, /donor/i);
  assert.doesNotMatch(fw.title, /\bBella\b/);
  const canvas = data.boards.find((b) => b.id === "cv1");
  assert.equal(canvas.viewer, "probe");
  assert.equal(canvas.title, "Pack de grabación");
  assert.equal(canvas.ref.b, "canvasblob01");
  assert.equal(data.boards.find((b) => b.id === "fd1").viewer, "probe");
  assert.equal(data.boards.find((b) => b.id === "bd1").viewer, "probe");
  assert.equal(data.boards.find((b) => b.id === "ch1").viewer, "probe");
  assert.equal(boardViewerKind(canvasFf()), "board");
  assert.equal(boardViewerKind(canvasCharts()), "canvas");
  assert.equal(boardViewerKind(creatorFeedLive()), "board");
  assert.equal(boardViewerKind(boardsV1Live()), "board");
  const explicit = fromBoards({
    type: "boards", version: 2,
    boards: [{ id: "old1", title: "Cifras", viewer: "canvas", kind: "film", status: "to_film" }],
  });
  assert.equal(explicit.boards[0].viewer, "canvas");
  const feedPage = fromBoards({
    type: "boards", version: 1,
    boards: [{ id: "f", name: "Feed", what: "Feed", board: "https://example.com/feed.html#b=feedblob01xx&k=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }],
  });
  assert.equal(feedPage.boards[0].viewer, "board");
  for (const b of data.boards) {
    if (b.viewer === "probe") b.viewer = b.id === "ch1" ? "canvas" : "board";
  }
  const html = markup(renderBoards({ boards: data, boardsLane: "all", model: {} }));
  const row = (id) => {
    const at = html.indexOf(`open-lib-board:${id}`);
    assert.ok(at >= 0, id);
    return html.slice(at, html.indexOf("</button>", at));
  };
  for (const id of ["fd1", "bd1", "cv1", "fw1"]) {
    assert.doesNotMatch(row(id), /Board antiguo/);
    assert.doesNotMatch(row(id), /board-old/);
  }
  assert.match(row("ch1"), /Board antiguo/);
  assert.match(row("ch1"), /board-old/);
  assert.match(html, /Video de referencia · Creadoras/);
  assert.match(html, /class="board-row-meta"/);
  assert.match(html, /board-row-meta[\s\S]*Por grabar/);
  assert.doesNotMatch(html, /donor/i);
  assert.doesNotMatch(html, /Framework/i);
  assert.doesNotMatch(html, /No hay boards/);
  assert.doesNotMatch(html, /\bBella\b/);
  const css = fs.readFileSync(new URL("../../lib/ui.css", import.meta.url), "utf8");
  assert.match(css, /\.feed-root \.filter-chip \{[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.chip \{[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.board-row \.list-title \{[^}]*-webkit-line-clamp:\s*2/s);
});

test("canvas blocks become the shared board template", () => {
  const adapted = adaptCanvasScene(canvasFf(), { job: "ff010", name: "Waffle de cortina" });
  assert.equal(adapted.kind, "board");
  assert.equal(adapted.board.job, "ff010");
  assert.ok(adapted.board.beats.length >= 2);
  assert.match(adapted.board.beats[0].vo, /Mira el waffle/);
  assert.match(adapted.board.beats[0].do_es, /Muestra el pack/);
  assert.equal(adapted.board.shots[0].takes, 2);
  const html = markup(renderBoard(normalizeBoard(adapted.board), { role: "owner" }));
  assert.match(html, /LO QUE DICES/);
  assert.match(html, /QUÉ HACES/);
  assert.match(html, /Zona segura 4:5/);
  assert.match(html, /Subir video/);
  const viewer = markup(renderBoard(normalizeBoard(adapted.board), { role: "viewer" }));
  assert.match(viewer, /LO QUE DICES/);
  assert.match(viewer, /Zona segura 4:5/);
  assert.doesNotMatch(viewer, /Subir video/);
  assert.equal(adaptCanvasScene(canvasCharts()).kind, "legacy");
});

test("creadoras uses the manager words and a product thumb", () => {
  assert.equal(job("sent", "approver").label, "Enviado");
  assert.equal(job("opened", "approver").label, "Abierto");
  assert.equal(job("Enviado", "approver").label, "Enviado");
  assert.equal(job("Visto", "approver").label, "Abierto");
  assert.notEqual(job("opened", "approver").label, "Visto");
  const model = adaptRoot(hubV3Live());
  const html = markup(renderCreadoras({
    model,
    live: { sessions: [] },
    now: new Date("2026-10-08T13:00:00.000Z"),
  }));
  assert.match(html, /Enviado/);
  assert.doesNotMatch(html, /Visto/);
  assert.match(html, /data:image\/jpeg/);
  assert.match(html, /Waffle de cortina/);
});

test("service worker precaches the screen modules", () => {
  const sw = fs.readFileSync(new URL("../../app/sw.js", import.meta.url), "utf8");
  assert.match(sw, /const VERSION = "2\.0\.1\+/);
  for (const file of [
    "dashboard.js", "grabar.js", "creadoras.js", "feed.js", "boards.js",
    "board-screen.js", "ajustes.js", "bienvenida.js", "note.js",
  ]) {
    assert.match(sw, new RegExp(`\\.\\./lib/screens/${file}`));
  }
});
