import { html, raw } from "../html.js";
import { t } from "../copy.js";
import { icon } from "../icons.js";
import { Segmented } from "../components.js";
import { VERSION } from "../../app/version.js";

export function render(store) {
  const s = store.settings || { theme: "auto" };
  const keys = store.keys || [];
  const has = (role) => keys.some((k) => k.role === role);
  const keyLine = [
    has("root") ? t("aju.ok") : "",
    has("feed") ? t("aju.feedOk") : t("aju.keys.feedMissing"),
    has("boards") ? t("aju.boardsOk") : "",
  ].filter(Boolean).join(" · ");
  const installed = store.standalone;
  return html`<div class="card">
    <div class="list-row">
      <div class="icon-tile" style="background:var(--tint-neutral)">${icon("sun-moon", { size: 22 })}</div>
      <div class="list-body"><div class="list-title">${t("aju.theme")}</div></div>
    </div>
    <div style="padding:0 16px 12px">${Segmented({
      options: [
        { id: "auto", label: t("aju.auto") },
        { id: "light", label: t("aju.light") },
        { id: "dark", label: t("aju.dark") },
      ], value: s.theme || "auto", act: "theme",
    })}</div>
    <button class="list-row" data-act="${installed ? "noop" : (store.canNativeInstall ? "install-native" : "install-how")}">
      <div class="icon-tile" style="background:var(--tint-accent);color:var(--link)">${icon("smartphone", { size: 22 })}</div>
      <div class="list-body"><div class="list-title">${store.isDesktop && !installed ? t("aju.install.desktop") : t("aju.install")}</div></div>
      <div class="list-trail">${installed ? t("aju.installed") : html`${t("aju.how")} ${icon("chevron-right")}`}</div>
    </button>
    <div class="list-row">
      <div class="icon-tile">${icon("key-round", { size: 22 })}</div>
      <div class="list-body"><div class="list-title">${t("aju.keys")}</div><div class="list-meta">${keyLine}${s.keyMode === "raw" ? " · " + t("aju.keys.simple") : ""}</div></div>
    </div>
    <button class="list-row" data-act="force-update">
      <div class="icon-tile">${icon("refresh-cw", { size: 22 })}</div>
      <div class="list-body"><div class="list-title">${t("aju.update")}</div></div>
      ${icon("chevron-right")}
    </button>
    <div class="list-row">
      <div class="list-body"><div class="list-title">${t("aju.version")}</div></div>
      <div class="list-trail" style="color:var(--muted)">${VERSION}</div>
    </div>
    <button class="list-row" data-act="forget" style="color:var(--bad)">
      <div class="icon-tile" style="background:var(--tint-bad);color:var(--bad)">${icon("log-out", { size: 22 })}</div>
      <div class="list-body"><div class="list-title">${t("aju.forget")}</div></div>
    </button>
  </div>`;
}
