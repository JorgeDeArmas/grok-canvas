import { mailboxUrl, postMailbox, UUID_RE } from "./core.js";
import { openDb, req, store } from "./keyring.js";

const BACKOFF = [5000, 15000, 60000, 5 * 60000, 15 * 60000];
let loopTimer = 0;
let sending = false;
let listeners = new Set();
let lastTicksAt = 0;

export function onOutbox(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) try { fn(); } catch { /* ignore */ }
}

async function allEntries() {
  const db = await openDb();
  return req(db.transaction("outbox").objectStore("outbox").getAll());
}

async function putEntry(row) {
  const db = await openDb();
  const id = await req(db.transaction("outbox", "readwrite").objectStore("outbox").put(row));
  if (row.id == null) row.id = id;
  return row;
}

async function delEntry(id) {
  const db = await openDb();
  await req(db.transaction("outbox", "readwrite").objectStore("outbox").delete(id));
}

export async function listOutbox() {
  const rows = await allEntries();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function pendingCount() {
  const rows = await listOutbox();
  return rows.filter((r) => r.state === "queued" || r.state === "sending" || r.state === "failed").length;
}

export async function oldestPendingAge(now = Date.now()) {
  const rows = (await listOutbox()).filter((r) => r.state !== "sent");
  if (!rows.length) return 0;
  return now - Math.min(...rows.map((r) => r.createdAt));
}

function coalesceKeyOf(item) {
  if (item.coalesceKey) return item.coalesceKey;
  const p = item.payload || {};
  if (item.kind === "approve" && p.choice === "want") return `want:${p.blockId}`;
  if (item.kind === "approve") return `approve:${p.blockId}`;
  if (item.kind === "pick") return `pick:${p.job}`;
  if (item.kind === "ticks") return "ticks";
  return "";
}

export async function enqueue({ channel, kind, payload, coalesceKey, grace = false }) {
  const now = Date.now();
  const item = {
    channel, kind, payload: { ...payload, at: payload.at || now },
    coalesceKey: coalesceKey || "",
    createdAt: now,
    notBefore: grace ? now + 4000 : now,
    attempts: 0,
    state: "queued",
    lastError: "",
  };
  item.coalesceKey = coalesceKeyOf(item);
  const rows = await listOutbox();
  if (item.coalesceKey) {
    const prev = rows.filter((r) => r.coalesceKey === item.coalesceKey && r.state === "queued");
    if (item.kind === "ticks") {
      const merged = { ...(prev[0]?.payload?.set || {}), ...(payload.set || {}) };
      if (prev[0]) {
        prev[0].payload = { kind: "ticks", v: 2, set: merged, at: now };
        prev[0].notBefore = Math.max(prev[0].notBefore, item.notBefore);
        await putEntry(prev[0]);
        schedule();
        emit();
        return prev[0];
      }
      item.payload = { kind: "ticks", v: 2, set: merged, at: now };
    } else {
      for (const p of prev) await delEntry(p.id);
    }
  }
  const saved = await putEntry(item);
  schedule();
  emit();
  return saved;
}

export async function undo(coalesceKey) {
  const rows = await listOutbox();
  for (const r of rows) {
    if (r.coalesceKey === coalesceKey && r.state === "queued") await delEntry(r.id);
  }
  emit();
}

export async function retry(id) {
  const rows = await listOutbox();
  const r = rows.find((x) => x.id === id);
  if (!r) return;
  r.state = "queued";
  r.notBefore = Date.now();
  r.lastError = "";
  await putEntry(r);
  schedule();
  emit();
}

export function resolveMailbox(channel, ctx) {
  if (channel === "hub") return ctx.model?.mailbox || "";
  if (channel === "feed") return ctx.feedF || ctx.model?.mailbox || "";
  if (String(channel).startsWith("board:")) return ctx.boardMailbox || ctx.model?.mailbox || "";
  return ctx.model?.mailbox || "";
}

export async function flush({ ctx, forceTicks = false, keepalive = false } = {}) {
  if (sending) return;
  sending = true;
  try {
    const rows = await listOutbox();
    const now = Date.now();
    for (const r of rows) {
      if (r.state === "sent") {
        if (now - (r.sentAt || r.createdAt) > 24 * 3600 * 1000) await delEntry(r.id);
        continue;
      }
      if (r.state === "failed") continue;
      if (r.notBefore > now) continue;
      if (r.kind === "ticks" && !forceTicks && now - lastTicksAt < 5 * 60 * 1000 && r.attempts === 0) continue;
      const uuid = resolveMailbox(r.channel, ctx || {});
      if (!UUID_RE.test(uuid)) {
        r.lastError = "sin-buzon";
        await putEntry(r);
        continue;
      }
      r.state = "sending";
      await putEntry(r);
      emit();
      try {
        const res = await postMailbox(uuid, r.payload, { plain: r.kind === "ticks", keepalive });
        if (res.ok) {
          r.state = "sent";
          r.sentAt = Date.now();
          if (r.kind === "ticks") lastTicksAt = Date.now();
          await putEntry(r);
        } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          r.state = "failed";
          r.lastError = String(res.status);
          await putEntry(r);
        } else {
          r.state = "queued";
          r.attempts += 1;
          r.notBefore = Date.now() + (BACKOFF[Math.min(r.attempts - 1, BACKOFF.length - 1)]);
          r.lastError = String(res.status);
          await putEntry(r);
        }
      } catch (e) {
        r.state = "queued";
        r.attempts += 1;
        r.notBefore = Date.now() + (BACKOFF[Math.min(r.attempts - 1, BACKOFF.length - 1)]);
        r.lastError = "net";
        await putEntry(r);
      }
      emit();
    }
  } finally {
    sending = false;
  }
}

export function schedule() {
  clearTimeout(loopTimer);
  loopTimer = setTimeout(() => flush({ keepalive: document.hidden }), 50);
}

export function startLoop(getCtx) {
  const run = (opts) => flush({ ctx: getCtx(), ...opts });
  addEventListener("online", () => run());
  document.addEventListener("visibilitychange", () => run({ keepalive: document.hidden }));
  setInterval(() => run(), 30000);
  run();
}

export async function sendNow(getCtx) {
  lastTicksAt = 0;
  const rows = await listOutbox();
  for (const r of rows) {
    if (r.state === "queued") { r.notBefore = 0; await putEntry(r); }
  }
  await flush({ ctx: getCtx(), forceTicks: true });
}

export function humanLabel(row, titles = {}) {
  const p = row.payload || {};
  const title = titles[p.blockId] || titles[p.job] || p.title || "";
  if (row.kind === "pick") return `Elegiste ${p.letter || "—"} · ${title}`.trim();
  if (row.kind === "ticks") {
    const n = Object.keys(p.set || {}).length;
    return `${n} videos marcados como grabados`;
  }
  if (row.kind === "approve" && p.choice === "want") return `Lo quiero · ${title}`.replace(/ · $/, "");
  if (row.kind === "approve" && p.choice === "go") return `GO · ${p.blockId || title}`;
  if (row.kind === "approve" && p.choice === "changes") return `Cambios · ${p.blockId || title}`;
  if (row.kind === "note") {
    const snip = String(p.text || "").slice(0, 30);
    return `Nota · «${snip}${String(p.text || "").length > 30 ? "…" : ""}»`;
  }
  return `${p.choice || row.kind} · ${title}`.replace(/ · $/, "");
}
