import { txt, thumbSrc, parseBoardRef, boardUrl, placeholderTitle, ITEM_ID_RE, VIDEO_ID_RE, PID_RE, UUID_RE, TOKEN_RE, apiBaseOk } from "./core.js";
import { verbToKind, stage as stageOf, video as videoOf, videoFromLegacy } from "./status.js";
import { laneId, laneLabel, rewriteLaneWords, boardDisplayTitle } from "./lanes.js";
import { parseDay, spokenIso } from "./dates.js";

const DROP_TITLE = /^(producto|video|item)$/i;

function thumbKey(thumbs, key) {
  if (!key) return "";
  return thumbSrc(thumbs && thumbs[key]) || thumbSrc(key) || "";
}

function actionFromItem(it) {
  if (it.open && it.open.scripts) return { type: "scripts", label: "Elegir guion", scripts: it.open.scripts };
  if (it.mail) return { type: "mail", label: "Responder", mail: it.mail };
  if (it.act && it.act.id) return { type: "act", id: it.act.id, label: txt(it.act.label, 40), doneLabel: txt(it.act.doneLabel, 40) };
  if (it.href) return { type: "link", label: txt(it.hrefLabel || it.done || "Abrir", 40), href: it.href };
  if (it.done) return { type: "done", label: typeof it.done === "string" ? txt(it.done, 40) : "Hecho" };
  return { type: "done", label: "Hecho" };
}

function parseDue(group) {
  if (!group) return null;
  if (/fecha por definir|sin fecha/i.test(group)) return null;
  // "sábado 10 oct" style — leave ISO if already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(group)) return group;
  return null;
}

export function emptyModel() {
  return {
    type: "", version: 0, updatedAt: "", mailbox: "", portalApi: "", managerToken: "", ownerToken: "",
    keyring: {}, thumbs: {}, tasks: [], products: [], videos: [], ticks: {}, brands: { groups: [] },
    grok: [], creators: [], scripts: {}, alerts: [], raw: null,
  };
}

export function fromComandoV4(scene) {
  const m = emptyModel();
  m.type = "comando";
  m.version = 4;
  m.raw = scene;
  m.updatedAt = scene.updatedAt || "";
  m.mailbox = UUID_RE.test(scene.mailbox) ? scene.mailbox : "";
  m.portalApi = apiBaseOk(scene.portalApi);
  m.managerToken = TOKEN_RE.test(scene.managerToken || "") ? scene.managerToken : "";
  m.ownerToken = TOKEN_RE.test(scene.ownerToken || "") ? scene.ownerToken : "";
  m.keyring = scene.keyring || {};
  m.thumbs = scene.thumbs || {};
  m.ticks = scene.ticks || {};
  m.scripts = scene.scripts || {};
  const productStages = new Set();
  m.products = (scene.products || []).map((p) => {
    const st = stageOf(p.stage, p.stage).id;
    if (st === "researching" || st === "preparing") productStages.add(p.id);
    return {
      id: txt(p.id, 40), name: txt(p.name, 60), thumb: p.thumb, lane: laneId(p.lane),
      stage: st === "unknown" ? p.stage : st, due: p.due || null, now: txt(p.now, 80),
      sample: p.sample, pdp: p.pdp, videos: p.videos || [], detail: p.detail || [],
    };
  }).filter((p) => p.id && !DROP_TITLE.test(p.name));
  m.tasks = (scene.tasks || []).filter((t) => t && t.title && !DROP_TITLE.test(t.title)).map((t) => ({
    id: txt(t.id, 120), kind: t.kind || "other", title: txt(t.title, 60), meta: txt(t.meta, 80),
    thumb: t.thumb, product: t.product, open: t.open, action: t.action, mail: t.mail, done: t.done, detail: t.detail,
  }));
  m.videos = (scene.videos || []).filter((v) => v && v.title && !DROP_TITLE.test(v.title)).map((v) => ({
    id: v.id, job: v.job, product: v.product, title: txt(v.title, 80), owner: v.owner || "jorge",
    lane: laneId(v.lane), day: v.day || "sin-fecha", place: txt(v.place, 40),
    status: v.status, ready: !!v.ready, boardRef: v.boardRef, takes: v.takes, href: v.href,
  }));
  m.brands = scene.brands || { groups: [] };
  m.grok = (scene.grok || []).filter((g) => {
    const title = fold(g.title || "");
    if (/identificando|content gap|armando pack|preparando/.test(title) && productStages.size) {
      // drop if it duplicates a visible product stage
      if (/identificando|content gap/.test(title)) return ![...m.products].some((p) => p.stage === "researching");
      if (/armando|preparando/.test(title)) return ![...m.products].some((p) => p.stage === "preparing");
    }
    return true;
  }).map((g) => ({ id: g.id, title: txt(g.title, 80), meta: txt(g.meta, 80), icon: g.icon || "sparkles", detail: g.detail }));
  m.creators = (scene.creators || []).map(normCreator);
  m.alerts = (scene.alerts || []).map((a) => ({
    id: a.id, text: String(a.text || a).replace(/Bella/gi, "Creadoras"), tone: a.tone || "info",
  }));
  return m;
}

function fold(s) { return String(s || "").toLowerCase(); }

function normCreator(c) {
  return {
    id: txt(c.id, 80),
    creatorName: txt(c.creatorName || c.creator_name || c.name, 40),
    shootDate: c.shootDate || c.shoot_date || "",
    expiresAt: c.expiresAt || c.expires_at || "",
    status: c.status || "active",
    revoked: !!(c.revoked || c.revoked_at),
    revoked_at: c.revoked_at || null,
    link: c.link || "",
    jobs: (c.jobs || []).map((j) => ({
      job_id: j.job_id || j.id, name: txt(j.name, 48), thumb: j.thumb,
      board: j.board, status: j.status,
    })),
    kind: c.kind || "creator",
  };
}

export function fromHubV3(scene) {
  const m = emptyModel();
  m.type = scene.type || "hub";
  m.version = 3;
  m.raw = scene;
  m.updatedAt = scene.updatedAt || "";
  m.mailbox = UUID_RE.test(scene.mailbox) ? scene.mailbox : "";
  m.portalApi = apiBaseOk(scene.portalApi || scene.apiBase);
  m.managerToken = TOKEN_RE.test(scene.managerToken || "") ? scene.managerToken : "";
  m.ownerToken = TOKEN_RE.test(scene.ownerToken || "") ? scene.ownerToken : "";
  m.thumbs = scene.thumbs || {};
  m.scripts = scene.scripts || {};
  m.creators = (scene.creators || scene.portals || []).map(normCreator);
  const sections = Object.fromEntries((scene.sections || []).map((s) => [s.id, s]));
  const hoy = sections.hoy?.items || [];
  const seenAct = new Set();
  const tasks = [];
  for (const it of hoy) {
    if (it.group === "Grabar") continue;
    if (!it.title || DROP_TITLE.test(it.title)) continue;
    const kind = verbToKind(it.verb);
    const action = actionFromItem(it);
    if (action.type === "act" && action.id) seenAct.add(action.id);
    tasks.push({
      id: it.id, kind, title: txt(it.title, 60), meta: txt(it.sub, 80),
      thumb: it.thumb, product: it.product, open: it.open, action, mail: it.mail, done: it.done, detail: it.detail,
    });
  }
  const products = [];
  for (const it of sections.productos?.items || []) {
    if (!it.title || DROP_TITLE.test(it.title)) continue;
    const st = stageOf(null, it.chip?.text);
    products.push({
      id: it.id, name: txt(it.title, 60), thumb: it.thumb, lane: laneId(it.avatar || it.lane),
      stage: st.id === "unknown" ? it.chip?.text : st.id, due: parseDue(it.group),
      now: "", detail: it.detail || [], pdp: it.href, videos: [],
    });
    if (it.act && it.act.id && !seenAct.has(it.act.id)) {
      seenAct.add(it.act.id);
      tasks.push({
        id: it.act.id, kind: "sample", title: txt(it.title, 60), meta: txt(it.sub, 80),
        thumb: it.thumb, product: it.id,
        action: { type: "act", id: it.act.id, label: txt(it.act.label, 40), doneLabel: txt(it.act.doneLabel, 40) },
      });
    }
  }
  const videos = [];
  const grabarItems = [...(sections.grabar?.items || []), ...hoy.filter((i) => i.group === "Grabar")];
  const seenV = new Set();
  for (const it of grabarItems) {
    if (it.id === "rec:open" || /rec:open/.test(it.id || "")) continue;
    if (seenV.has(it.id)) continue;
    seenV.add(it.id);
    const link = sceneRoleFromHref(it.href);
    const isPiece = link && (link.role === "canvas" || link.role === "board");
    const day = (/^\d{4}-\d{2}-\d{2}$/.test(it.day || "") ? it.day : "")
      || spokenIso(it.day)
      || spokenIso(it.group)
      || "sin-fecha";
    videos.push({
      id: it.id, job: String(it.id || "").replace(/^rec:/, ""), product: it.product,
      title: txt(it.title, 80), owner: "jorge", lane: "miamix",
      day, place: "", status: isPiece ? "to_film" : "preparing", ready: !!isPiece,
      href: isPiece ? it.href : "",
      boardRef: isPiece ? { b: link.b, k: link.k } : null,
    });
  }
  const groups = [];
  const byG = {};
  for (const it of sections.marcas?.items || []) {
    const g = it.group || "other";
    if (!byG[g]) {
      const id = /esperando/i.test(g) ? "waiting" : /cerrado/i.test(g) ? "closed" : /negoc/i.test(g) ? "negotiating" : "other";
      byG[g] = { id, label: txt(g, 60), items: [] };
      groups.push(byG[g]);
    }
    byG[g].items.push({ id: it.id, title: txt(it.title, 60), meta: txt(it.sub, 80), mail: it.mail });
    if ((it.done || it.mail) && !/esperando respuesta/i.test(g)) {
      const kind = verbToKind(it.verb);
      tasks.push({
        id: it.id, kind, title: txt(it.title, 60), meta: txt(it.sub, 80),
        action: actionFromItem(it), mail: it.mail, done: it.done, detail: it.detail,
      });
    }
  }
  m.tasks = tasks;
  m.products = products;
  m.videos = videos;
  m.brands = { groups };
  m.grok = (sections.marcha?.items || []).map((it) => ({
    id: it.id, title: txt(it.title, 80), meta: txt(it.sub, 80), icon: "sparkles", detail: it.detail,
  }));
  m.alerts = (scene.footer || []).map((line, i) => ({
    id: "f" + i, text: rewriteLaneWords(line), tone: "info",
  }));
  const hrefs = [];
  for (const q of scene.quick || []) if (q && q.href) hrefs.push(q.href);
  for (const sec of scene.sections || []) {
    for (const it of sec.items || []) if (it && it.href) hrefs.push(it.href);
  }
  for (const href of hrefs) {
    const c = sceneRoleFromHref(href);
    if (!c || (c.role !== "boards" && c.role !== "filming" && c.role !== "feed")) continue;
    if (!m.keyring[c.role]) m.keyring[c.role] = { b: c.b, k: c.k };
  }
  return m;
}

export function sceneRoleFromHref(raw) {
  const ref = parseBoardRef(raw);
  if (!ref || ref.blocked) return null;
  let path = "";
  try { path = new URL(String(raw)).pathname.toLowerCase(); } catch { return null; }
  let role = "";
  if (path.endsWith("/boards.html")) role = "boards";
  else if (path.endsWith("/grabacion.html")) role = "filming";
  else if (path.endsWith("/feed.html")) role = "feed";
  else if (path.endsWith("/board.html")) role = "board";
  else if (path.endsWith("/index.html")) role = "canvas";
  else return null;
  return { role, b: ref.b, k: ref.k };
}

export function fromFilming(scene) {
  const products = scene.products || {};
  const videos = (scene.videos || []).map((v) => ({
    id: v.id, job: String(v.id || "").replace(/^rec:/, ""), product: v.product,
    title: txt(v.title, 80), owner: v.owner || "jorge", lane: laneId(v.lane) || "miamix",
    day: v.day || "sin-fecha", place: txt(v.place, 40),
    status: v.ready ? "to_film" : "preparing", ready: !!v.ready,
    href: v.board, boardRef: parseBoardRef(v.board),
    thumb: products[v.product]?.thumb, productName: products[v.product]?.name,
  }));
  return {
    ...emptyModel(),
    type: "filming", version: 2, updatedAt: scene.updatedAt || "",
    mailbox: UUID_RE.test(scene.mailbox) ? scene.mailbox : "",
    videos, ticks: scene.ticks || {},
    products: Object.entries(products).map(([id, p]) => ({
      id, name: txt(p.name, 60), thumb: p.thumb,
    })),
    raw: scene,
  };
}

export function mergeFilming(model, filming) {
  if (!filming) return model;
  return { ...model, videos: filming.videos, ticks: { ...model.ticks, ...filming.ticks } };
}

export function fromBoards(scene) {
  const v2 = Number(scene.version) === 2;
  const products = scene.products || {};
  const lanes = v2
    ? (scene.lanes || []).map((l) => ({ id: laneId(l.id), label: laneLabel(l.id) || txt(l.label, 20) }))
    : (scene.avatars || []).filter((a) => a.id !== "all").map((a) => ({ id: laneId(a.id), label: laneLabel(a.id) || "Creadoras" }));
  const boards = [];
  for (const b of scene.boards || []) {
    const href = b.board || "";
    const parsed = href ? parseBoardRef(href) : (b.ref || null);
    if (parsed && parsed.blocked) continue;
    if (/portal\.html|manager\.html|comando\.html|hub\.html/.test(href)) continue;
    const kind = v2 ? b.kind : kindFromLabel(b.kind, scene.kinds);
    const status = v2 ? b.status : videoFromLegacy(b.status, kind).id;
    const productId = b.product || slug(b.name);
    if (!v2 && b.name) products[productId] = products[productId] || { name: rewriteLaneWords(b.name), thumb: b.thumb };
    boards.push({
      id: b.id, product: productId,
      title: txt(boardDisplayTitle(b.title || b.what || b.name, b.lane || b.avatar), 80),
      lane: laneId(b.lane || b.avatar), kind, status,
      date: b.date,
      viewer: listViewer(href, kind, v2, b.viewer),
      ref: parsed && !parsed.blocked ? { b: parsed.b || b.ref?.b, k: parsed.k || b.ref?.k } : b.ref,
      missing: !!b.missing,
      problem: txt(boardDisplayTitle(b.problem || (status === "problem" ? b.note : ""), b.lane || b.avatar), 120),
      thumb: b.thumb,
    });
  }
  return {
    type: "boards", version: v2 ? 2 : 1, updatedAt: scene.updatedAt || "",
    lanes, products, boards, thumbs: scene.thumbs || {}, raw: scene,
  };
}

function listViewer(href, kind, v2, explicit) {
  if (explicit === "board" || explicit === "portal" || explicit === "canvas") return explicit;
  let path = "";
  try { path = href ? new URL(href).pathname.toLowerCase() : ""; } catch { path = ""; }
  if (/\/(feed|boards)\.html$/.test(path)) return "board";
  if (path.endsWith("/index.html") || (kind === "ai" && !v2)) return "probe";
  return "board";
}

function kindFromLabel(id, kinds) {
  const k = (kinds || []).find((x) => x.id === id);
  const label = fold(k?.label || id);
  if (/ia|kling|ai/.test(label)) return "ai";
  if (/framework|gu[ií]a|guide/.test(label)) return "guide";
  return "film";
}

function slug(s) {
  return String(s || "p").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "p";
}

export function fromManager(scene) {
  return {
    ...emptyModel(),
    type: "manager",
    portalApi: apiBaseOk(scene.apiBase || scene.portalApi),
    creators: (scene.portals || scene.sessions || scene.creators || []).map(normCreator),
    raw: scene,
  };
}

export function adaptRoot(scene) {
  if (!scene) return emptyModel();
  if (scene.type === "comando" && Number(scene.version) === 4) return fromComandoV4(scene);
  if (scene.type === "hub" || scene.type === "comando") return fromHubV3(scene);
  if (scene.type === "filming") return fromFilming(scene);
  if (scene.type === "manager") return fromManager(scene);
  return emptyModel();
}

export function jorgeVideos(model) {
  return ((model && model.videos) || []).filter((v) => (v.owner || "jorge") === "jorge");
}

export function loadDone(blob) {
  try {
    const raw = JSON.parse(localStorage.getItem("hub-done:" + blob) || "{}");
    const now = Date.now();
    const keep = {};
    for (const [k, at] of Object.entries(raw)) if (now - at < 3 * 86400000) keep[k] = at;
    return keep;
  } catch { return {}; }
}

export function saveDone(blob, map) {
  localStorage.setItem("hub-done:" + blob, JSON.stringify(map));
}

export function loadPicks(blob) {
  try {
    const raw = JSON.parse(localStorage.getItem("hub-picks:" + blob) || "{}");
    const now = Date.now();
    const keep = {};
    for (const [k, v] of Object.entries(raw)) if (v && now - v.at < 7 * 86400000) keep[k] = v;
    return keep;
  } catch { return {}; }
}

export function savePicks(blob, map) {
  localStorage.setItem("hub-picks:" + blob, JSON.stringify(map));
}

export function loadTicks(blob) {
  try { return JSON.parse(localStorage.getItem("rec-ticks:" + blob) || "{}"); }
  catch { return {}; }
}

export function saveTicks(blob, map) {
  localStorage.setItem("rec-ticks:" + blob, JSON.stringify(map));
}

export function loadLane() {
  const n = localStorage.getItem("boards:lane");
  if (n) return n;
  const legacy = localStorage.getItem("boards:av");
  if (legacy) {
    localStorage.setItem("boards:lane", legacy);
    return legacy;
  }
  return "all";
}

export function saveLane(id) {
  localStorage.setItem("boards:lane", id);
}

export function loadWant(blob) {
  try { return JSON.parse(localStorage.getItem("feed-want:" + blob) || "{}"); }
  catch { return {}; }
}

export function saveWant(blob, map) {
  localStorage.setItem("feed-want:" + blob, JSON.stringify(map));
}

export function loadFeedAvatar() {
  return localStorage.getItem("creatorFeed.avatar") || "";
}

export function saveFeedAvatar(id) {
  localStorage.setItem("creatorFeed.avatar", id);
}
