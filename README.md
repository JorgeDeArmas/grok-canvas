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
