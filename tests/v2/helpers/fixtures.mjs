const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

const MAIL = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const API = "https://creator-portal-api.example.workers.dev";
const MGR = "mgrtokensynthetic01";
const OWN = "ownertokensynthetic1";
const CRE = "creatortokensynth01";
const FEED_B = "feedblob01xx";
const FEED_K = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const BRD_B = "boardsblob01";
const BRD_K = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const FIL_B = "filmingbl01x";
const FIL_K = "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

export function thumbs() {
  return { pa: JPEG, pb: JPEG };
}

export function rootV4(overrides = {}) {
  return {
    type: "comando",
    version: 4,
    updatedAt: "2026-10-08T13:00:00.000Z",
    mailbox: MAIL,
    portalApi: API,
    managerToken: MGR,
    ownerToken: OWN,
    keyring: {
      boards: { b: BRD_B, k: BRD_K },
      feed: { b: FEED_B, k: FEED_K, f: MAIL },
      filming: { b: FIL_B, k: FIL_K },
    },
    thumbs: thumbs(),
    tasks: [
      { id: "task:script:a", kind: "pick_script", title: "Producto A", meta: "Elige 1 de 3", product: "pa", action: { type: "scripts", label: "Elegir guion" }, open: { scripts: "ff-010" } },
      { id: "task:publish:b", kind: "publish", title: "Producto B", meta: "Listo para publicar", product: "pb", action: { type: "done", label: "Publicado" } },
      { id: "task:mail:x", kind: "brand_reply", title: "Marca X", meta: "Responde hoy", action: { type: "mail", label: "Responder" }, mail: { web: "https://mail.google.com/mail/u/0/#search/marca", search: "marca x" } },
      { id: "act:sample:c", kind: "sample", title: "Producto C", meta: "La muestra llegó", product: "pc", action: { type: "act", label: "La aprobaron", id: "act:sample:c" } },
      { id: "task:takes", kind: "move_takes", title: "Pasar tomas a la Mac", meta: "Cuando termines", action: { type: "done", label: "Hecho" } },
      { id: "task:choose", kind: "choose_products", title: "Elegir productos", meta: "Mira el feed", action: { type: "route", label: "Abrir feed", route: "feed" } },
    ],
    products: [
      { id: "pa", name: "Producto A", stage: "pick_script", lane: "miamix", due: "2026-10-08", now: "Elige guion", thumb: "pa" },
      { id: "pb", name: "Producto B", stage: "to_publish", lane: "miamix", due: "2026-10-10", now: "Edición lista" },
      { id: "pc", name: "Producto C", stage: "arrived", lane: "bella", due: "2026-10-03", now: "Llegó" },
      { id: "pd", name: "Producto D", stage: "to_film", lane: "miamix", due: "2026-10-09", now: "Board listo" },
      { id: "pe", name: "Producto E", stage: "filmed", lane: "bella", now: "Grabado" },
      { id: "pf", name: "Producto F", stage: "published", lane: "miamix", due: "2026-10-01", now: "En tienda" },
      { id: "pg", name: "Producto G", stage: "researching", lane: "miamix", now: "Investigando" },
      { id: "ph", name: "Producto H", stage: "preparing", lane: "bella", now: "Armando pack" },
      { id: "pj", name: "Producto J", stage: "dropped", lane: "miamix", now: "Descartado" },
    ],
    videos: [
      { id: "rec:010", job: "ff-010", product: "pa", title: "Hook cocina", owner: "jorge", lane: "miamix", day: "2026-10-08", place: "SALA", status: "to_film", ready: true, boardRef: { b: "boardblob01xx", k: "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD" } },
      { id: "rec:011", job: "ff-011", product: "pd", title: "Unbox mesa", owner: "jorge", lane: "miamix", day: "2026-10-03", place: "SALA", status: "to_film", ready: true },
      { id: "rec:012", job: "ff-012", product: "pb", title: "Review auto", owner: "jorge", lane: "miamix", day: "2026-10-10", place: "CARRO", status: "to_film", ready: true },
      { id: "rec:013", job: "ff-013", product: "pe", title: "UGC parque", owner: "jorge", lane: "bella", day: "2026-10-10", place: "PARQUE", status: "to_film", ready: false },
      { id: "rec:014", job: "ff-014", product: "pf", title: "Cut final", owner: "jorge", lane: "miamix", day: "sin-fecha", status: "filmed", ready: true },
      { id: "rec:099", job: "ff-099", product: "pc", title: "Video creadora", owner: "creadoras", lane: "bella", day: "2026-10-10", status: "to_film", ready: true },
    ],
    ticks: {},
    brands: {
      groups: [
        { id: "waiting", label: "Esperando respuesta", items: Array.from({ length: 7 }, (_, i) => ({ id: `brand:w${i}`, title: `Marca X${i || ""}`, meta: "desde 28 sep", since: "2026-09-28" })) },
        { id: "closed", label: "Cerrados", items: [{ id: "brand:c1", title: "Marca Y" }, { id: "brand:c2", title: "Marca Z" }] },
      ],
    },
    grok: [
      { id: "grok:edit", title: "Corte de Producto B", meta: "En timeline" },
      { id: "grok:pack", title: "Armando pack de Producto H", meta: "Duplicado" },
      { id: "grok:id", title: "Identificando Producto G", meta: "Duplicado" },
      { id: "grok:note", title: "Nota de marca", meta: "Sin prisa", detail: [["Qué", "Nada urgente"]] },
    ],
    creators: [
      {
        id: "sess-ana",
        creatorName: "Ana",
        shootDate: "2026-10-10",
        expiresAt: "2026-10-13T16:00:00.000Z",
        status: "active",
        link: "https://jorgedearmas.github.io/grok-canvas/portal.html#b=portalblob1&k=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        jobs: [{ job_id: "ff-020", name: "Producto C", status: "uploaded" }],
      },
    ],
    scripts: {
      "ff-010": {
        job: "ff-010", product: "Producto A", recommended: "B", picked: "", changeable: true, thumb: "pa",
        options: [
          { letter: "A", focus: "Precio", hook: "Mira el precio", beats: [{ t: "0:00", vo: "Hook A", visual: "Pack" }] },
          { letter: "B", focus: "Uso", hook: "Así lo uso", beats: [{ t: "0:00", vo: "Hook B", visual: "Manos" }] },
          { letter: "C", focus: "Proof", hook: "Lo comprobé", beats: [{ t: "0:00", vo: "Hook C", visual: "Resultado" }] },
        ],
      },
    },
    alerts: [{ id: "al:1", text: "Video de Creadoras listo", tone: "info" }],
    ...overrides,
  };
}

export function rootV4Owner() {
  return rootV4({ ownerToken: OWN });
}
export function rootV4Nomgr() {
  const s = rootV4();
  delete s.managerToken;
  return s;
}
export function rootV4Empty() {
  return rootV4({ tasks: [], products: [], videos: [], creators: [], brands: { groups: [] }, grok: [], alerts: [] });
}
export function rootV4Bella() {
  return rootV4({ alerts: [{ id: "al:1", text: "video de Bella listo", tone: "info" }] });
}
export function rootV4Placeholder() {
  return rootV4({
    tasks: [{ id: "bad", kind: "other", title: "Producto", action: { type: "done", label: "Hecho" } }],
    videos: [{ id: "rec:bad", title: "Video", owner: "jorge", status: "to_film", day: "sin-fecha" }],
  });
}
export function rootV4Hostile() {
  const s = rootV4();
  s.tasks = [{ id: "x", kind: "other", title: "<img onerror=alert(1)>", meta: "javascript:alert(1)", action: { type: "done", label: "Hecho" } }];
  s.alerts = [{ id: "h", text: "A".repeat(200) + "\u202e", tone: "bad" }];
  return s;
}

export function filmingV2() {
  return {
    type: "filming", version: 2, updatedAt: "2026-10-08T13:00:00.000Z", mailbox: MAIL,
    products: { pa: { name: "Producto A", thumb: JPEG } },
    videos: [{ id: "rec:010", day: "2026-10-08", place: "SALA", product: "pa", title: "Hook cocina", stage: 2, ready: true }],
    ticks: {},
  };
}

export function boardsV2() {
  const statuses = ["problem", "to_film", "to_approve", "filmed", "editing", "to_publish", "published", "preparing", "retired"];
  const boards = [];
  statuses.forEach((status, i) => {
    boards.push({
      id: `b${i}`, product: "pa", lane: i % 4 === 0 ? "bella" : "miamix", status,
      title: `Video ${i + 1}`, date: "2026-10-0" + ((i % 8) + 1), kind: status === "to_approve" ? "ai" : "film",
      viewer: "board",
      ref: { b: "boardblob01xx", k: "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD" },
    });
  });
  boards.push({ id: "guide1", product: "pa", lane: "miamix", status: "published", title: "Guía de luz", kind: "guide", viewer: "board" });
  boards.push({ id: "miss1", product: "pj", lane: "miamix", status: "problem", title: "Producto J", problem: "missing", viewer: "board" });
  boards.push({ id: "old1", product: "pb", lane: "miamix", status: "to_film", title: "Board antiguo", viewer: "canvas" });
  boards.push({ id: "sys1", product: "pa", lane: "miamix", status: "published", title: "Portal", viewer: "portal" });
  return {
    type: "boards", version: 2, updatedAt: "2026-10-08T13:00:00.000Z",
    lanes: [{ id: "miamix", label: "Bella" }, { id: "bella", label: "Bella" }],
    products: { pa: { name: "Producto A" }, pb: { name: "Producto B" }, pj: { name: "Producto J" } },
    boards,
  };
}

export function boardsV1() {
  return {
    type: "boards", version: 1, updatedAt: "2026-10-08T13:00:00.000Z",
    avatars: [{ id: "miamix", label: "Miami X" }, { id: "bella", label: "Bella" }],
    kinds: [{ id: "film", label: "Grabación" }],
    boards: [
      { id: "b1", name: "Producto A", avatar: "bella", kind: "film", status: "Board listo", tone: "info", date: "2026-10-08", board: "https://jorgedearmas.github.io/grok-canvas/board.html#b=x&k=y" },
      { id: "portal", name: "Portal Ana", avatar: "bella", kind: "film", status: "Enviado", board: "https://jorgedearmas.github.io/grok-canvas/portal.html#b=x&k=y&t=zzzzzzzzzzzzzzzz" },
      { id: "mgr", name: "Manager", avatar: "miamix", kind: "film", status: "Visto", board: "https://jorgedearmas.github.io/grok-canvas/manager.html#b=x&k=y&m=zzzzzzzzzzzzzzzz" },
    ],
  };
}

export function boardV2() {
  return {
    type: "board", version: 2, id: "boardblob01xx", name: "Producto A", job: "ff-010", lane: "miamix", status: "to_film",
    beats: [
      { shot: 1, vo: "Mira esto, lo uso todos los días.", do_es: "Muestra el pack." },
      { shot: 2, vo: "Sin texto: solo acción", do_es: "Solo acción." },
      { shot: 3, vo: "Lo abres y listo.", do_es: "Cierra el pack." },
      { shot: 4, vo: "Prueba el click.", do_es: "Presiona el botón." },
      { shot: 5, vo: "Mira el resultado.", do_es: "Acerca el detalle." },
      { shot: 6, vo: "Pídelo hoy.", do_es: "Señala el carrito." },
    ],
    script: "Mira esto, lo uso todos los días.\nLo abres y listo.\nPrueba el click.\nMira el resultado.\nPídelo hoy.",
    shots: [{ shot: 1, takes: 2 }, { shot: 2, takes: 1 }],
    mailbox: MAIL,
  };
}

export function boardV2Ai() {
  return { ...boardV2(), approvals: [{ id: "job21:video", label: "Video IA" }] };
}

export function portalV2() {
  return {
    type: "portal", version: 2, creatorName: "Ana",
    shootDate: "2026-10-10", expiresAt: "2026-10-13T16:00:00.000Z",
    apiBase: API,
    products: [{
      id: "ff-020", name: "Producto C", status: "sent",
      beats: [{ shot: 1, vo: "Hola, esto es lo que digo.", do_es: "Muestra el pack." }],
      script: "Hola, esto es lo que digo.",
      shots: [{ shot: 1, takes: 1 }],
    }],
  };
}

export function portalV1() {
  const s = portalV2();
  delete s.shootDate;
  delete s.expiresAt;
  s.version = 1;
  return s;
}

export function portalForbidden() {
  return { ...portalV2(), managerToken: MGR, ownerToken: OWN, keyring: { feed: { b: "x", k: "y" } }, editor_brief: "secret" };
}

export function creatorFeed() {
  return {
    type: "creator-feed", version: 1, updatedAt: "2026-10-08T11:43:00.000Z",
    default_avatar: "miamix",
    avatars: [
      { id: "miamix", label: "Bella", count: 2, empty: "" },
      { id: "bella", label: "Bella", count: 1, empty: "No hay videos de Creadoras hoy." },
    ],
    cards: [
      {
        id: "c1", avatars: ["miamix"], handle: "@demo.creator", url: "https://www.tiktok.com/@demo.creator/video/1",
        hook: "Hook de Producto A", score: 88, best: { label: "GMV Max" },
        product: { id: 101, name: "Producto A", line: "$35.00 · Comisión 15%", href: "https://www.tiktok.com/shop" },
        metrics: { views: 24300, likes: 1200, comments: 40, shares: 12, saves: 80 },
      },
      {
        id: "c2", avatars: ["bella"], handle: "@otra.cuenta", hook: "Hook B",
        product: { id: 102, name: "Producto B" },
      },
    ],
  };
}

const CANVAS_B = "canvasblob01";
const CANVAS_K = "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE";

function canvasUrl() {
  return `https://jorgedearmas.github.io/grok-canvas/index.html#b=${CANVAS_B}&k=${CANVAS_K}`;
}

/** Hub v3 as published today: no keyring, sub-scenes only in quick/item hrefs. */
export function hubV3Live() {
  const boardsHref = `https://jorgedearmas.github.io/grok-canvas/boards.html#b=${BRD_B}&k=${BRD_K}`;
  const filmHref = `https://jorgedearmas.github.io/grok-canvas/grabacion.html#b=${FIL_B}&k=${FIL_K}`;
  const feedHref = `https://jorgedearmas.github.io/grok-canvas/feed.html#b=${FEED_B}&k=${FEED_K}`;
  return {
    type: "hub",
    version: 3,
    updatedAt: "2026-10-08T13:00:00.000Z",
    mailbox: MAIL,
    portalApi: API,
    managerToken: MGR,
    ownerToken: OWN,
    thumbs: thumbs(),
    quick: [
      { label: "Todos los boards", sub: "14 boards", href: boardsHref },
      { label: "Creator feed", sub: "", href: feedHref },
    ],
    sections: [
      { id: "hoy", title: "Hoy", items: [] },
      {
        id: "grabar",
        title: "Por grabar",
        items: [
          { id: "rec:open", title: "Grabación", href: filmHref, group: "Sábado 10 oct" },
          { id: "rec:ff010", title: "Hook del pack", product: "waffle", href: canvasUrl(), group: "Sábado 10 oct" },
          { id: "rec:cortina", title: "Sin board", product: "waffle", group: "Sábado 10 oct" },
        ],
      },
      {
        id: "productos",
        title: "Productos",
        items: [
          { id: "waffle", title: "Waffle de cortina", thumb: "pa", chip: { text: "Por grabar" }, avatar: "bella" },
        ],
      },
    ],
    creators: [{
      id: "sess-demo",
      creatorName: "Nia",
      shootDate: "2026-10-10",
      expiresAt: "2026-10-13T16:00:00.000Z",
      status: "active",
      jobs: [{ job_id: "ff-030", name: "Waffle de cortina", status: "sent" }],
      link: "https://jorgedearmas.github.io/grok-canvas/portal.html#b=portalblob1&k=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD&t=creatortokensynth01",
    }],
    footer: [],
  };
}

export function filmingV2Live() {
  return {
    type: "filming",
    version: 2,
    updatedAt: "2026-10-08T13:00:00.000Z",
    mailbox: MAIL,
    products: { waffle: { name: "Waffle de cortina", thumb: JPEG } },
    videos: [
      { id: "rec:ff010", day: "2026-10-10", place: "SALA", product: "waffle", title: "Hook del pack", ready: true, owner: "jorge", board: canvasUrl() },
      { id: "rec:cortina", day: "2026-10-10", place: "SALA", product: "waffle", title: "Sin board", ready: true, owner: "jorge", board: "" },
    ],
    ticks: {},
  };
}

export function boardsV1Live() {
  return {
    type: "boards",
    version: 1,
    updatedAt: "2026-10-08T13:00:00.000Z",
    avatars: [{ id: "miamix", label: "Miami X" }, { id: "bella", label: "Bella" }],
    kinds: [{ id: "film", label: "Grabación" }, { id: "fw", label: "Framework" }],
    boards: [
      {
        id: "fw1", name: "Waffle de cortina", what: "Framework (donor) para Bella",
        avatar: "bella", kind: "film", status: "Board listo", date: "2026-10-01", thumb: JPEG,
        board: "https://jorgedearmas.github.io/grok-canvas/board.html#b=boardblob01xx&k=DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
      },
      {
        id: "cv1", name: "Waffle de cortina", what: "Pack de grabación",
        avatar: "miamix", kind: "film", status: "Board listo", date: "2026-10-10", thumb: JPEG,
        board: canvasUrl(),
      },
    ],
  };
}

export function canvasFf() {
  return {
    title: "Waffle de cortina",
    summary: "2 tomas",
    blocks: [
      { type: "script", id: "vo", title: "Guion VO", data: { text: "Mira el waffle, lo uso todos los días.\nLo abres y listo." } },
      { type: "checklist", id: "act", title: "Acción por shot", data: { items: [{ label: "Muestra el pack" }, { label: "Abre el cierre" }] } },
      {
        type: "table", id: "beats", title: "Beat por beat",
        data: {
          columns: ["Shot", "VO", "Acción"],
          rows: [
            ["1", "Mira el waffle, lo uso todos los días.", "Muestra el pack"],
            ["2", "Lo abres y listo.", "Abre el cierre"],
          ],
        },
      },
      { type: "video", id: "ref", title: "Referencia", data: { enc: true, src: "media/m0123456789abcdef.enc", mime: "video/mp4" } },
    ],
  };
}

export function canvasCharts() {
  return {
    title: "Solo cifras",
    blocks: [{ type: "kpi", title: "KPIs", data: { items: [{ label: "Vistas", value: 10 }] } }],
  };
}

/** creator-feed v3.1 field names, not the flattened Ana card. */
export function creatorFeedLive() {
  return {
    type: "creator-feed",
    updatedAt: "2026-10-08T11:43:00.000Z",
    default_avatar: "miamix",
    avatars: [
      { id: "miamix", label: "Miami X", count: 2 },
      { id: "bella", label: "Bella", count: 0, empty: "Hoy no hay videos." },
    ],
    cards: [
      {
        id: "c-live-1",
        creator: "@demo.shop",
        avatars: ["miamix"],
        url: "https://www.tiktok.com/@demo.shop/video/100",
        hook: "Hook del waffle",
        metrics: { views: 1200000, likes: 54000, comments: 320, shares: 90, saves: 400 },
        score: { value: 91, label: "Feed v3", coverage: 0.8 },
        best: { label: "12x su promedio (3d)" },
        cover: { enc: true, src: "media/m0123456789abcdef.enc", mime: "image/png" },
        preview: { enc: true, src: "media/mabcdef0123456789.enc", mime: "video/mp4" },
        product: {
          id: "p-waffle",
          title: "Waffle de cortina",
          price: "$24.00",
          commission: "Comisión 12%",
          href: "https://shop.tiktok.com/view/product/1",
          image: { enc: true, src: "media/m0123456789abcdef.enc", mime: "image/png" },
          verify: "ventas al alza",
        },
      },
      {
        id: "c-live-2",
        creator: "@demo.shop",
        avatars: ["miamix"],
        url: "https://www.tiktok.com/@demo.shop/video/200",
        hook: "Sin producto",
        metrics: { views: null, likes: null, comments: null, shares: null, saves: null },
        score: { value: 40, label: "GMV Max", coverage: 1 },
        cover: { enc: true, src: "media/m0123456789abcdef.enc", mime: "image/png" },
        preview: null,
        product_missing_label: "Producto sin identificar",
      },
    ],
  };
}

export const CATALOG = {
  "root-v4": rootV4,
  "root-v4-owner": rootV4Owner,
  "root-v4-nomgr": rootV4Nomgr,
  "root-v4-empty": rootV4Empty,
  "root-v4-bella": rootV4Bella,
  "root-v4-placeholder": rootV4Placeholder,
  "root-v4-hostile": rootV4Hostile,
  "filming-v2": filmingV2,
  "boards-v2": boardsV2,
  "boards-v1": boardsV1,
  "board-v2": boardV2,
  "board-v2-ai": boardV2Ai,
  "portal-v2": portalV2,
  "portal-v1": portalV1,
  "portal-v2-forbidden": portalForbidden,
  "creator-feed": creatorFeed,
  "hub-v3-live": hubV3Live,
  "filming-v2-live": filmingV2Live,
  "boards-v1-live": boardsV1Live,
  "canvas-ff": canvasFf,
  "canvas-charts": canvasCharts,
  "creator-feed-live": creatorFeedLive,
};

export const TOKENS = { MAIL, API, MGR, OWN, CRE, FEED_B, FEED_K, BRD_B, BRD_K, FIL_B, FIL_K, JPEG, CANVAS_B, CANVAS_K };
