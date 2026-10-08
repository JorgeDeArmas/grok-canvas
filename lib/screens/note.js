import { html, raw } from "../html.js";
import { t } from "../copy.js";
import { sheetChrome, Banner, Button } from "../components.js";

export function render(store) {
  const ctx = store.noteContext;
  const text = store.noteText || "";
  return sheetChrome({
    title: t("note.title"),
    body: html`
      ${ctx ? html`<button class="filter-chip" data-act="note-clear-ctx">${t("note.about", { ctx })} ✕</button>` : raw("")}
      <textarea data-field="note" rows="4" maxlength="5000" placeholder="${t("note.placeholder")}"
        style="width:100%;margin-top:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);padding:12px;font-size:16px">${text}</textarea>
      <p class="list-meta" style="margin-top:8px">${t("note.hint")}</p>
      ${!store.model?.mailbox && !store.feedF ? Banner({ tone: "warn", icon: "inbox", text: t("banner.nomailbox") }) : raw("")}
    `,
    footer: store.model?.mailbox || store.feedF
      ? Button({ kind: "primary", size: "lg", full: true, icon: "send", label: t("note.send"), act: "note-send", disabled: !text.trim() })
      : raw(""),
  });
}
