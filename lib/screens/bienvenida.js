import { html, raw } from "../html.js";
import { t } from "../copy.js";
import { icon } from "../icons.js";
import { Button } from "../components.js";

export function render(store) {
  const err = store.onbError;
  const typed = store.onbText || "";
  return html`<div class="screen" style="display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:48px">
    <div class="icon-tile" style="width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,#0060DF,#5E5CE6);color:#fff;margin-bottom:16px">
      ${icon("clapperboard", { size: 36 })}
    </div>
    <h1 style="font-size:28px;line-height:34px;font-weight:700;margin:0 0 8px">${t("onb.title")}</h1>
    <p style="font-size:16px;line-height:22px;color:var(--text-2);max-width:320px;margin:0 0 24px">${t("onb.lead")}</p>
    ${Button({ kind: "primary", size: "lg", full: true, icon: "copy", label: store.onbBusy ? t("onb.opening") : t("onb.paste"), act: "paste", busy: store.onbBusy })}
    <div style="margin:16px 0;color:var(--muted);font-size:13px">${t("onb.or")}</div>
    <textarea id="onb-text" data-field="onb" rows="3" placeholder="${t("onb.placeholder")}"
      style="width:100%;max-width:400px;border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:12px;font-size:16px">${typed}</textarea>
    ${store.onbHold ? html`<p class="list-meta" style="margin-top:8px">${t("onb.hold")}</p>` : raw("")}
    ${err ? html`<p role="alert" style="color:var(--bad);font-size:14px;margin-top:8px">${t("onb.err." + err)}</p>` : raw("")}
    ${typed.trim() ? html`<div style="width:100%;max-width:400px;margin-top:12px">${Button({ kind: "secondary", size: "lg", full: true, label: t("onb.open"), act: "open-typed" })}</div>` : raw("")}
    <p style="font-size:13px;color:var(--muted);margin-top:20px">${t("onb.hint")}</p>
  </div>`;
}
