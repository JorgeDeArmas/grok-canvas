Canvas de Grok Bot. Abre index.html?c=slug. Las escenas viven en scenes/.

## feed.html

Vista a pantalla completa, al estilo TikTok, para una escena cifrada `creator-feed`. Misma CSP que `index.html`. La llave va solo en el hash.

https://raw.githack.com/JorgeDeArmas/grok-canvas/main/feed.html#b=<blob>&k=<key>&f=<uuid>

`b` es el id de `scenes/<blob>.json` (`{"iv","ct"}`). `k` es la llave AES-GCM. `f` es opcional (UUID de webhook.site) y muestra «Nota para Grok».

## hub.html

"Tu día" view for an encrypted `hub` scene (`type: "hub"`). Responsive: one column on the phone, columns on desktop. Only works from `jorgedearmas.github.io` (same-origin `scenes/<blob>.json`, no githack fallback). Stricter CSP than index.html: no media hosts, `connect-src 'self' https://webhook.site`.

https://jorgedearmas.github.io/grok-canvas/hub.html#b=<blob>&k=<key>&f=<uuid>

Scene: `title`, `updatedAt`, `counters[] {label, value}`, `sections[] {id, title, lead?, empty?, limit?, items[]}`. Item fields: `id` (`[a-z0-9:_.-]`), `verb`, `title`, `sub?`, `tone?` (`bad|warn|good|info`), `href?` (https only), `hrefLabel?`, `done?` (true for a ✓ button, or a string used as the button label), `group?`, `quiet?`. `footer[]` holds plain text lines.

Tapping ✓ hides the item on that device (localStorage, 3 days) and POSTs `{kind:"approve", blockId:id, choice:"done"}` to the mailbox. Undo sends `choice:"undo"`. Everything is text-escaped.

### hub.html: chips and action buttons
Item `chip: {text, tone}` adds a small stage pill. Item `act: {id, label, doneLabel}` adds a button that **keeps the row**: it marks the button done locally and POSTs `{kind:"approve", blockId:act.id, choice:"done"}` (Undo sends `undo`). It's used for "Llegó" / "Pedí muestra" / "Lo tengo" on tracked products.

### feed.html: «Lo quiero»
When the link has a mailbox (`f`) and the card has a numeric `product.id`, each card shows «Lo quiero». Tapping it POSTs `{kind:"approve", blockId:"want:<product_id>", choice:"want"}` and remembers the tap locally (`feed-want:<id>`). The bot treats it as untrusted data and only adds that product to Jorge's tracker. Nothing is sent or bought.

## grabacion.html

"Grabación" view for an encrypted `filming` scene (`type: "filming"`, v2 minimal since 2026-09-30): every filming board Jorge has to film. Per day: «N videos listos para grabar · X de N grabados»; per video ONLY the product photo, product name + short video name, «Abrir board» and «Marcar grabado» (or «Board en camino» when the pack isn't ready). Small place label (SALA/CARRO…) only when a day has several places. Tabs: Pendientes / Grabados. Takes, outfit, props and the plan live on each board. Phone-first, works on desktop, light/dark. Same origin rules as hub.html (only `jorgedearmas.github.io`). CSP: `img-src data:` (inline product thumbs inside the encrypted scene) and `connect-src 'self' https://webhook.site`.

https://jorgedearmas.github.io/grok-canvas/grabacion.html#b=<blob>&k=<key>

Scene: `updatedAt`, `products{key: {name, thumb}}` (thumb must be `data:image/jpeg;base64,…`), `videos[] {id: rec:<job>, day: YYYY-MM-DD|sin-fecha, place, product, title, stage 0-5, ready, board (https, host jorgedearmas.github.io, path /grok-canvas/ only)}`, `ticks{rec:<job>: [0|1, ms]}`, `mailbox` (webhook.site UUID; preferred over `&f=` so the link survives mailbox rotation).

Marks are saved in localStorage instantly (`rec-ticks:<blob>`; newest timestamp wins against the scene's `ticks`), are undo-able, and are sent as ONE `text/plain` POST `{kind:"ticks", v:2, set:{"rec:<job>":[0|1, ms]}}` (no CORS preflight) at most every 5 minutes, or when Jorge taps «Enviar» (a free webhook.site URL takes ~100 requests). The bot treats it as untrusted data: ids must match `^rec:[a-z0-9]{2,24}$` and the only effect is the filmed mark. Test: `SHOTS_DIR=/tmp/shots npm run test:grabacion` (`SCENE_FILE=<local scene.json>` renders real data locally; never commit real scenes).
