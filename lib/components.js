import { html, raw, attr, classMap } from "./html.js";
import { icon } from "./icons.js";
import { t } from "./copy.js";
import { thumbSrc } from "./core.js";

export function AppBar({ title, variant = "large", back, actions = [], status, collapsed }) {
  const v = collapsed ? "compact collapsed" : variant;
  return html`
    <header class="appbar ${v}" data-appbar>
      <div class="appbar-row">
        ${back ? html`<button type="button" class="icon-btn" data-act="back">${icon("chevron-left", { label: t("nav.back") })}</button>` : raw("")}
        <h1 class="appbar-title">${title}</h1>
        <div class="appbar-actions">
          ${actions.map((a) => a.iconOnly
            ? html`<button type="button" class="icon-btn" data-act="${a.act}" ${attr("aria-label", a.label)}>${icon(a.icon, { label: a.label })}</button>`
            : html`<button type="button" class="pill-btn" data-act="${a.act}">${icon(a.icon, { size: 18 })} ${a.label}</button>`)}
        </div>
      </div>
      ${status ? html`<div class="appbar-status ${status.warn ? "warn" : ""}" data-act="refresh">${raw(status.html || "")}</div>` : raw("")}
    </header>`;
}

export function TabBar({ items, current }) {
  return html`
    <nav class="tabbar" aria-label="${t("nav.sections")}">
      ${items.map((it) => html`
        <a href="#/${it.id}" class="tab" ${attr("aria-current", current === it.id ? "page" : false)}
           ${attr("aria-label", it.badge ? `${it.label}, ${it.badge} pendientes` : it.label)} data-tab="${it.id}">
          <span class="tab-ico">${icon(it.icon, { size: 24 })}</span>
          <span>${it.label}</span>
          ${it.badge ? html`<span class="badge">${it.badge}</span>` : raw("")}
        </a>`)}
    </nav>`;
}

export function StatusChip({ tone = "neutral", icon: ico, label }) {
  return html`<span class="chip ${tone}">${ico ? icon(ico, { size: 16 }) : raw("")} ${label}</span>`;
}

export function Thumb({ src, size = 48, alt = "" }) {
  const ok = thumbSrc(src) || (src && String(src).startsWith("blob:") ? src : "");
  const style = `width:${size}px;height:${size}px;border-radius:12px`;
  if (!ok) return html`<span class="thumb ph" style="${style}"></span>`;
  return html`<img class="thumb" alt="${alt}" src="${ok}" style="${style}" onerror="this.classList.add('ph');this.removeAttribute('src')">`;
}

export function Button({ kind = "primary", size = "md", icon: ico, label, full, act, busy, disabled }) {
  return html`<button type="button" class="btn ${kind} ${size} ${full ? "full" : ""}" data-act="${act || ""}"
    ${attr("aria-busy", busy ? "true" : false)} ${attr("disabled", !!disabled)}>
    ${busy ? icon("loader-circle", { size: 18 }) : (ico ? icon(ico, { size: 18 }) : raw(""))} ${label}
  </button>`;
}

export function FileButton({ label, act, accept = "video/*", key }) {
  return html`<label class="btn primary lg full filebtn">${icon("upload", { size: 18 })} ${label}
    <input type="file" accept="${accept}" data-file="${key || ""}" data-act="${act || "upload"}">
  </label>`;
}

export function Banner({ tone = "info", icon: ico, text, cta, ctaAct, dismissible }) {
  return html`<div class="banner ${tone}" role="status">
    ${icon(ico || "info", { size: 18 })} <span>${text}</span>
    ${cta ? html`<button type="button" class="banner-act" data-act="${ctaAct}">${cta}</button>` : raw("")}
    ${dismissible ? html`<button type="button" class="icon-btn" data-act="banner-dismiss" aria-label="${t("nav.close")}">${icon("x", { size: 18 })}</button>` : raw("")}
  </div>`;
}

export function EmptyState({ icon: ico, tone = "good", title, body, action, act }) {
  return html`<div class="empty">
    <div class="empty-ico" style="background:var(--tint-${tone});color:var(--${tone === "accent" ? "link" : tone})">${icon(ico, { size: 40 })}</div>
    <h2>${title}</h2>
    ${body ? html`<p>${body}</p>` : raw("")}
    ${action ? html`<div style="margin-top:12px">${Button({ kind: "secondary", label: action, act })}</div>` : raw("")}
  </div>`;
}

export function ErrorState({ icon: ico = "triangle-alert", title, body, action, act }) {
  return EmptyState({ icon: ico, tone: "bad", title, body, action, act: act || "retry" });
}

export function HeroCard({ title, meta, thumb, icon: ico, tone = "accent", action, act, done }) {
  return html`<article class="hero ${done ? "done" : ""}">
    <div class="hero-k">${t("dash.hero.next")}</div>
    <div class="hero-row">
      ${thumb ? Thumb({ src: thumb, size: 60 }) : html`<div class="icon-tile" style="width:60px;height:60px;background:var(--tint-${tone});color:var(--${tone === "accent" ? "link" : tone})">${icon(ico || "circle-check", { size: 28 })}</div>`}
      <div>
        <h2 class="hero-title">${title}</h2>
        ${meta ? html`<p class="hero-meta">${meta}</p>` : raw("")}
      </div>
    </div>
    ${action ? Button({ kind: "primary", size: "lg", full: true, label: action, act }) : raw("")}
  </article>`;
}

export function ShortcutTile({ icon: ico, label, sub, tone, act, subBad }) {
  return html`<button type="button" class="tile" data-act="${act}">
    <div class="icon-tile sm" style="background:var(--tint-accent);color:var(--link)">${icon(ico, { size: 20 })}</div>
    <div><div class="tile-label">${label}</div><div class="tile-sub ${subBad ? "bad" : ""}">${sub}</div></div>
  </button>`;
}

export function SayBox({ text, compact }) {
  if (!text) return raw("");
  return html`<div class="say">
    ${compact ? raw("") : html`<div class="k">${icon("quote", { size: 16 })} ${t("board.say")}</div>`}
    <blockquote class="q" style="${compact ? "font-size:17px;line-height:22px" : ""}">${text}</blockquote>
  </div>`;
}

export function DoLine({ text }) {
  if (!text) return raw("");
  return html`<div class="do"><div class="k">${icon("hand", { size: 16 })} ${t("board.do")}</div><div class="d">${text}</div></div>`;
}

export function ProgressBar({ value }) {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  return html`<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v * 100)}"><i style="width:${Math.round(v * 100)}%"></i></div>`;
}

export function InitialAvatar({ name }) {
  const ch = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  return html`<div class="avatar">${ch}</div>`;
}

export function Segmented({ options, value, act = "seg" }) {
  return html`<div class="seg" role="tablist">
    ${options.map((o) => html`<button type="button" role="tab" ${attr("aria-selected", o.id === value)} data-act="${act}" data-id="${o.id}">
      ${o.label}${o.count != null ? html`<span class="cnt">${o.count}</span>` : raw("")}
    </button>`)}
  </div>`;
}

export function Section({ title, icon: ico, children }) {
  return html`<section class="section">
    ${title ? html`<h2 class="section-h">${ico ? icon(ico, { size: 16 }) : raw("")} ${title}</h2>` : raw("")}
    ${children}
  </section>`;
}

export function toastHtml(message, undo) {
  return html`<div class="toast" role="status" aria-live="polite">${message}
    ${undo ? html`<button type="button" data-act="undo">${t("common.undo")}</button>` : raw("")}
  </div>`;
}

export function Dialog({ title, body, confirmLabel, confirmKind = "destructive filled", cancelLabel, confirmAct = "confirm" }) {
  return html`
    <div class="scrim" data-act="cancel"></div>
    <div class="dialog" role="alertdialog" aria-modal="true">
      <h2>${title}</h2>
      ${body ? html`<p>${body}</p>` : raw("")}
      ${Button({ kind: confirmKind.includes("destructive") ? "destructive filled" : confirmKind, size: "lg", full: true, label: confirmLabel, act: confirmAct })}
      ${Button({ kind: "secondary", size: "lg", full: true, label: cancelLabel || t("common.cancel"), act: "cancel" })}
    </div>`;
}

export function sheetChrome({ title, subtitle, leading, footer, full, body }) {
  return html`
    <div class="scrim" data-act="sheet-close"></div>
    <div class="sheet ${full ? "full" : ""}" role="dialog" aria-modal="true">
      <div class="grabber"></div>
      <div class="sheet-h">
        ${leading || raw("")}
        <div style="flex:1;min-width:0">
          <h2>${title}</h2>
          ${subtitle ? html`<div class="list-meta">${subtitle}</div>` : raw("")}
        </div>
        <button type="button" class="icon-btn" data-act="sheet-close" aria-label="${t("nav.close")}">${icon("x")}</button>
      </div>
      <div class="sheet-body">${body}</div>
      ${footer ? html`<div class="sheet-foot">${footer}</div>` : raw("")}
    </div>`;
}

export function Skeleton({ hero, rows = 5 }) {
  return html`${hero ? html`<div class="skeleton sk-hero"></div>` : raw("")}
    ${Array.from({ length: rows }, () => html`<div class="skeleton sk-row"></div>`)}`;
}
