import { html, raw } from "../html.js";
import { t } from "../copy.js";
import { icon } from "../icons.js";
import { AppBar, TabBar, HeroCard, ShortcutTile, StatusChip, Thumb, EmptyState, Skeleton, Banner } from "../components.js";
import { taskKind, stage as stageOf, session as sessionOf } from "../status.js";
import { jorgeVideos, loadDone } from "../model.js";
import { isOverdue, isToday, overdueLabel, dayLabel, relativePast, todayEt } from "../dates.js";
import { thumbSrc } from "../core.js";
import { laneLabel } from "../lanes.js";

function thumbOf(model, key) {
  if (!key) return "";
  return thumbSrc(model.thumbs?.[key]) || thumbSrc(key);
}

export function heroOf(store) {
  const m = store.model;
  const now = store.now || new Date();
  const vids = jorgeVideos(m).filter((v) => v.status === "to_film" && v.ready && (isToday(v.day, now) || isOverdue(v.day, now) || v.day === "sin-fecha" && isOverdue(v.day, now) || isOverdue(v.day, now) || isToday(v.day, now)));
  const filmNow = jorgeVideos(m).filter((v) => v.status === "to_film" && v.ready && (isToday(v.day, now) || isOverdue(v.day, now)));
  if (filmNow.length) {
    const overdue = filmNow.every((v) => isOverdue(v.day, now));
    const places = [...new Set(filmNow.map((v) => v.place).filter(Boolean))];
    const placeTxt = places.slice(0, 2).join(", ") + (places.length > 2 ? "…" : "");
    return {
      case: 1,
      title: overdue ? t("dash.hero.filmOverdue") : t("dash.hero.filmToday"),
      meta: t("dash.hero.filmMeta", { n: filmNow.length, places: placeTxt || "—" }),
      icon: "video", tone: overdue ? "bad" : "accent",
      action: t("dash.hero.goGrabar"), act: "go-grabar",
    };
  }
  const live = (store.live && store.live.sessions) || [];
  if (m.managerToken && live.length) {
    const pending = live.filter((s) => !s.revoked_at && (s.takes || []).some((t) => t.status === "uploaded"));
    const n = pending.reduce((a, s) => a + (s.takes || []).filter((t) => t.status === "uploaded").length, 0);
    if (n) {
      const names = [...new Set(pending.map((s) => s.creator_name).filter(Boolean))];
      return {
        case: 2, title: names.length === 1 ? t("dash.hero.reviewOne", { name: names[0] }) : t("dash.hero.reviewMany"),
        meta: t("dash.hero.reviewMeta", { n }), icon: "users", tone: "warn",
        action: t("dash.hero.reviewCta"), act: "go-review:" + pending[0].id,
        avatar: names[0],
      };
    }
    const exp = live.filter((s) => {
      const st = sessionOf(s, now);
      if (st.id !== "expiring" || !/vence hoy/i.test(st.label)) return false;
      const jobs = s.jobs || [];
      return jobs.some((j) => j.status !== "approved");
    });
    if (exp.length) {
      const s = exp[0];
      const left = (s.jobs || []).filter((j) => j.status !== "approved").length;
      return {
        case: 3, title: t("dash.hero.expiring", { name: s.creator_name }),
        meta: t("dash.hero.expiringMeta", { n: left }), icon: "hourglass", tone: "warn",
        action: t("dash.hero.extend"), act: "extend:" + s.id,
      };
    }
  }
  const done = loadDone(store.rootBlob);
  const tasks = (m.tasks || []).filter((x) => !done[x.id]);
  if (tasks[0]) {
    const tk = taskKind(tasks[0].kind);
    return {
      case: 4, task: tasks[0],
      title: tasks[0].title, meta: tasks[0].meta,
      thumb: thumbOf(m, tasks[0].thumb), icon: tk.icon, tone: tk.tone,
      action: (tasks[0].action && tasks[0].action.label) || t("act.done"),
      act: "task:" + tasks[0].id,
    };
  }
  return { case: 5, title: t("dash.hero.allGood"), meta: t("dash.hero.allGoodMeta"), icon: "circle-check", tone: "good", done: true };
}

export function todoTasks(store, hero) {
  const done = loadDone(store.rootBlob);
  return (store.model.tasks || []).filter((x) => {
    if (done[x.id]) return false;
    if (hero && hero.case === 4 && hero.task && hero.task.id === x.id) return false;
    return true;
  });
}

function feedSub(store) {
  if (!store.hasFeedKey && !store.feed) return t("dash.feed.needKey");
  if (store.feedLoading) return t("dash.feed.loading");
  if (store.feedError) return t("dash.tile.open");
  const cards = store.feed?.cards || store.feed?.items || [];
  const today = todayEt(store.now);
  const n = cards.filter((c) => (c.updatedAt || c.day || "").startsWith(today)).length;
  if (n) return t("dash.feed.today", { n });
  if (store.feed?.updatedAt) return t("dash.feed.updated", { when: relativePast(store.feed.updatedAt, store.now) });
  return t("dash.tile.open");
}

function boardsSub(store) {
  if (store.boardsLoading) return t("dash.feed.loading");
  const list = store.boards?.boards || [];
  const prob = list.filter((b) => b.status === "problem").length;
  if (prob) return { text: t("dash.boards.problem", { n: prob }), bad: true };
  if (list.length) return { text: t("dash.boards.count", { n: list.length }) };
  return { text: t("dash.tile.open") };
}

export function render(store) {
  const m = store.model;
  if (!m && store.loading) {
    return html`${shell(store, Skeleton({ hero: true, rows: 5 }))}`;
  }
  const hero = heroOf(store);
  const todos = todoTasks(store, hero);
  const showTodos = todos.slice(0, store.todoOpen ? 99 : 12);
  const products = (m.products || []).filter((p) => p.stage !== "dropped");
  const bsub = boardsSub(store);
  return html`${shell(store, html`
    ${HeroCard({ ...hero, act: hero.act })}
    <div class="tiles">
      ${ShortcutTile({ icon: "play", label: t("dash.feed"), sub: feedSub(store), act: "go-feed" })}
      ${ShortcutTile({ icon: "layout-grid", label: t("dash.boards"), sub: bsub.text, subBad: bsub.bad, act: "go-boards" })}
    </div>
    ${todos.length || hero.case === 5 ? html`<section class="section">
      ${hero.case !== 5 || todos.length ? html`<h2 class="section-h">${t("dash.todo")}</h2>` : raw("")}
      ${!todos.length && hero.case === 5 ? EmptyState({ icon: "circle-check", title: t("empty.todo.title"), body: t("empty.todo.body") }) : html`<div class="card">
        ${showTodos.map((task) => taskRow(m, task))}
        ${todos.length > 12 && !store.todoOpen ? html`<button class="see-more" data-act="todo-more">${t("common.seeMore", { n: todos.length - 12 })}</button>` : raw("")}
      </div>`}
    </section>` : raw("")}
    <section class="section">
      <h2 class="section-h">${t("dash.products")}</h2>
      ${!products.length ? EmptyState({ icon: "shopping-bag", tone: "accent", title: t("empty.products.title"), body: t("empty.products.body"), action: t("dash.openFeed"), act: "go-feed" })
        : html`<div class="card">${productGroups(m, products, store)}</div>`}
    </section>
    ${brandSection(m)}
    ${grokSection(m, store)}
    ${alertSection(m)}
  `)}`;
}

function taskRow(m, task) {
  const tk = taskKind(task.kind);
  const th = thumbOf(m, task.thumb);
  const action = task.action || { type: "done", label: t("act.done") };
  const btnKind = action.type === "scripts" ? "primary" : action.type === "done" ? "success" : "secondary";
  return html`<div class="list-row" data-task="${task.id}">
    ${th ? Thumb({ src: th }) : html`<div class="icon-tile" style="background:var(--tint-${tk.tone});color:var(--${tk.tone === "accent" ? "link" : tk.tone})">${icon(tk.icon, { size: 22 })}</div>`}
    <button type="button" class="list-body" data-act="task-body:${task.id}" style="text-align:left;background:none">
      <div class="list-title">${task.title}</div>
      <div class="list-meta">${task.meta || ""}</div>
    </button>
    <div class="list-trail">
      <button type="button" class="btn ${btnKind} md" data-act="task:${task.id}">${action.label}</button>
    </div>
  </div>`;
}

function productGroups(m, products, store) {
  const now = store.now || new Date();
  const groups = [];
  const put = (key, label, bad, p) => {
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, label, bad, items: [] }; groups.push(g); }
    g.items.push(p);
  };
  const sorted = [...products].sort((a, b) => String(a.due || "9999").localeCompare(String(b.due || "9999")));
  for (const p of sorted) {
    if (p.due && isOverdue(p.due, now)) put("overdue", t("dash.group.overdue"), true, p);
    else if (!p.due) put("none", t("dash.group.undated"), false, p);
    else put(p.due, dayLabel(p.due, { now, header: true }).toUpperCase(), false, p);
  }
  const flat = groups.flatMap((g) => g.items);
  const vis = store.productsOpen ? flat : flat.slice(0, 6);
  let shown = 0;
  return html`${groups.map((g) => {
    const items = g.items.filter(() => true).filter((p) => {
      if (shown >= vis.length && !store.productsOpen) return false;
      const ok = vis.includes(p);
      if (ok) shown += 1;
      return ok;
    });
    if (!items.length) return raw("");
    return html`<div class="group-h ${g.bad ? "bad" : ""}">${g.label}</div>
      ${items.map((p) => {
        const st = stageOf(p.stage, p.stage);
        return html`<button type="button" class="list-row" data-act="product:${p.id}">
          ${Thumb({ src: thumbOf(m, p.thumb) })}
          <div class="list-body"><div class="list-title">${p.name}</div><div class="list-meta">${p.now || ""}</div></div>
          <div class="list-trail">${StatusChip({ tone: st.tone, icon: st.icon, label: st.label })} ${icon("chevron-right", { size: 18 })}</div>
        </button>`;
      })}`;
  })}${flat.length > 6 && !store.productsOpen ? html`<button class="see-more" data-act="products-all">${t("dash.seeAllN", { n: flat.length })}</button>` : raw("")}`;
}

function brandSection(m) {
  const groups = (m.brands?.groups || []).filter((g) => (g.items || []).length);
  if (!groups.length) return raw("");
  const ico = { waiting: "hourglass", closed: "circle-check", negotiating: "message-circle" };
  return html`<section class="section">
    <h2 class="section-h">${icon("briefcase", { size: 16 })} ${t("dash.brands")}</h2>
    <div class="card">${groups.map((g) => html`<button type="button" class="list-row" data-act="brands:${g.id}">
      <div class="icon-tile" style="background:var(--tint-neutral);color:var(--neutral)">${icon(ico[g.id] || "circle-dot", { size: 22 })}</div>
      <div class="list-body"><div class="list-title">${g.label}</div></div>
      <div class="list-trail" style="font-size:17px;font-weight:600;color:var(--text-2)">${g.items.length} ${icon("chevron-right", { size: 18 })}</div>
    </button>`)}</div>
  </section>`;
}

function grokSection(m, store) {
  const items = m.grok || [];
  if (!items.length) return raw("");
  const vis = store.grokOpen ? items : items.slice(0, 3);
  return html`<section class="section">
    <h2 class="section-h">${icon("sparkles", { size: 16 })} ${t("dash.grok")}</h2>
    <div class="card">${vis.map((g) => html`<div class="list-row" ${g.detail ? raw(`data-act="grok:${g.id}"`) : raw("")}>
      <div class="icon-tile" style="background:var(--tint-neutral);color:var(--neutral)">${icon(g.icon || "sparkles", { size: 22 })}</div>
      <div class="list-body"><div class="list-title">${g.title}</div><div class="list-meta">${g.meta || ""}</div></div>
    </div>`)}
    ${items.length > 3 && !store.grokOpen ? html`<button class="see-more" data-act="grok-more">${t("common.seeMore", { n: items.length - 3 })}</button>` : raw("")}
    </div>
  </section>`;
}

function alertSection(m) {
  const items = m.alerts || [];
  if (!items.length) return raw("");
  return html`<section class="section">
    <h2 class="section-h">${icon("bell", { size: 16 })} ${t("dash.alerts")}</h2>
    <div class="card">${items.map((a) => html`<div class="list-row">
      <div class="icon-tile" style="background:var(--tint-${a.tone || "info"});color:var(--${a.tone || "info"})">${icon(a.tone === "info" ? "info" : "triangle-alert", { size: 22 })}</div>
      <div class="list-body"><div class="list-title" style="white-space:normal;font-weight:400;font-size:15px">${a.text}</div></div>
    </div>`)}</div>
  </section>`;
}

function shell(store, body) {
  return html`${body}`;
}

export { thumbOf };
