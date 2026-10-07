Canvas de Grok Bot. Abre index.html?c=slug. Las escenas viven en scenes/.

## feed.html

Vista a pantalla completa, al estilo TikTok, para una escena cifrada `creator-feed`. Misma CSP que `index.html`. La llave va solo en el hash.

https://jorgedearmas.github.io/grok-canvas/feed.html#b=<blob>&k=<key>&f=<uuid>  (GitHub Pages only, never raw.githack)

`b` es el id de `scenes/<blob>.json` (`{"iv","ct"}`). `k` es la llave AES-GCM. `f` es opcional (UUID de webhook.site) y muestra «Nota para Grok».

## hub.html

"Tu día" view for an encrypted `hub` scene (`type: "hub"`). Responsive: one column on the phone, columns on desktop. Only works from `jorgedearmas.github.io` (same-origin `scenes/<blob>.json`, no githack fallback). Stricter CSP than index.html: no media hosts, `connect-src 'self' https://webhook.site`.

https://jorgedearmas.github.io/grok-canvas/hub.html#b=<blob>&k=<key>&f=<uuid>

Scene: `title`, `updatedAt`, `counters[] {label, value}`, `sections[] {id, title, lead?, empty?, limit?, items[]}`. Item fields: `id` (`[a-z0-9:_.-]`), `verb`, `title`, `sub?`, `tone?` (`bad|warn|good|info`), `href?` (https only), `hrefLabel?`, `done?` (true for a ✓ button, or a string used as the button label), `group?`, `quiet?`. `footer[]` holds plain text lines.

Tapping ✓ hides the item on that device (localStorage, 3 days) and POSTs `{kind:"approve", blockId:id, choice:"done"}` to the mailbox. Undo sends `choice:"undo"`. Everything is text-escaped.

### hub.html: chips and action buttons
Item `chip: {text, tone}` adds a small stage pill. Item `act: {id, label, doneLabel}` adds a button that **keeps the row**: it marks the button done locally and POSTs `{kind:"approve", blockId:act.id, choice:"done"}` (Undo sends `undo`). It's used for "Llegó" / "Pedí muestra" / "Lo tengo" on tracked products.

### feed.html: avatar toggle
When the scene has `avatars: [{id, label, count, empty}]`, the top bar shows a segmented toggle (one tab per avatar + «Todos», ≥ 44 px tap targets, count per tab). A card belongs to the tabs in `card.avatars` (missing → `default_avatar`, else the first avatar). The last tab is remembered in `localStorage` (`creatorFeed.avatar`). Window and creator chips count and filter inside the selected tab; creator chips only list creators of that tab (`creators[].avatars`). An empty tab shows `avatars[].empty` (honest reason, no padding). Scenes without `avatars` render exactly as before.

### feed.html: «Lo quiero»
When the link has a mailbox (`f`) and the card has a numeric `product.id`, each card shows «Lo quiero». Tapping it POSTs `{kind:"approve", blockId:"want:<product_id>", choice:"want"}` and remembers the tap locally (`feed-want:<id>`). The bot treats it as untrusted data and only adds that product to the creator's tracker. Nothing is sent or bought.

### hub.html v2 (2026-10-01): script sheet, «Lo próximo», tappable everything
- **Script sheet.** Scene `scripts: {"ff-007": {job, product, recommended, recommendedWhy, picked, pickedAt, changeable, thumb, pdp, options:[{letter, focus, framework, frameworkEs, donor:{handle,url}|null, transfer, fill, cast, place, seconds, hook, hookText, beats:[{t, vo, visual, text}], teleprompter, rules}]}}`. An item with `open: {scripts: "ff-007"}` opens a bottom sheet with tabs A/B/C (swipe syncs the tab), hook, VO second by second with ACCIÓN and on-screen text, donor transfer (`donor.url` must be `https://www.tiktok.com/@x/video/<id>`), recommended badge. The sheet opens on the picked or recommended letter.
- **Pick.** «Elegir este guion» POSTs `{kind:"pick", v:1, job:"ff-NNN", letter:"A|B|C", at}` (letter `""` = quitar elección), confirms at once («Elegiste B · preparando el pack», Deshacer), stores the tap per hub link (localStorage `hub-picks:<blob>`, 7 days) and resends unsent taps when the page opens again. He can change his mind until the scene says `changeable:false` (pack built). A processed pick comes back as `picked`/`pickedAt`.
- **Lo próximo.** The first open item of the lead section, big card with one primary button. Local ✓ and picks move it on.
- **Rows.** Every row is a button: script rows open the sheet; rows with `detail: [[label, value], …]` open a detail sheet with their buttons; link-only rows open the link. `thumb: "<key>"` shows `scene.thumbs[key]` (inline `data:image/jpeg;base64`, < 60 KB). `quietLink: true` keeps a product's link inside its detail sheet. Tap targets ≥ 44 px, dark mode via `prefers-color-scheme`.
- **Tiles.** `counters[] {label, value, jump}`: `jump` = section id or `hoy:<group>`; tapping scrolls there and flashes it. Counts of `hoy:` tiles are live (local ✓ and picks drop out).
- CSP change: `img-src 'self' data:` (inline thumbs only). Tests: `npm run test:hub` (mail buttons), `npm run test:hub-scripts` (sheet, tabs, swipe, pick/change/undo payloads, tiles, hostile data); `SCENE=<decrypted scene.json> npm run test:hub-scripts` for local QA on real data (never commit real scenes: the repo is public).

### hub.html quick links (2026-10-03)
Scene `quick: [{label, sub, href}]` (max 3) shows big buttons under the tiles, e.g. «Todos los boards · 12 boards». `href` must be https on the SAME origin as the hub (another page of this canvas site); anything else is dropped.

## boards.html

«Todos los boards»: every product board on this canvas site in one phone list (`type: "boards"`), newest first. Filters: avatar segment (Todos + the scene `avatars`, e.g. Miami X / Bella, with counts) and type chips (from `kinds`, e.g. Video IA / Grabación / Framework); the last filter is remembered in localStorage (`boards:av`, `boards:kind`). Per board: product photo, short name, one line of what it is, status chip, avatar, type, code + date, an optional note (`noteTone: "bad"` = red warning, e.g. a TikTok Shop violation) and «Abrir board», or the `missing` text when the key is gone. Read-only: no mailbox, CSP `img-src data:; connect-src 'self'`.

https://jorgedearmas.github.io/grok-canvas/boards.html#b=<blob>&k=<key>

Scene: `updatedAt`, `avatars[] {id, label}` (segment tabs after «Todos», max 4; from the creator profile `creator_feed.avatars`), `kinds[] {id, label}`, `boards[] {id, code, name, what, avatar (an avatars id, else «Otro»), kind (must be in kinds), status, tone: bad|good|info|teal|warn|purple|muted, date (ISO), thumb (data:image/jpeg;base64, < 60 KB), board (https, host jorgedearmas.github.io, path /grok-canvas/ only), missing, note, noteTone}`, `footer[]`. Built by hub-tu-dia `build_boards.py` on every hub refresh. Test: `SHOTS_DIR=/tmp/shots npm run test:boards` (`SCENE_FILE=<local scene.json>` for real data; never commit real scenes).

## grabacion.html

"Grabación" view for an encrypted `filming` scene (`type: "filming"`, v2 minimal since 2026-09-30): every filming board the creator has to film. Per day: «N videos listos para grabar · X de N grabados»; per video ONLY the product photo, product name + short video name, «Abrir board» and «Marcar grabado» (or «Board en camino» when the pack isn't ready). Small place label (SALA/CARRO…) only when a day has several places. Tabs: Pendientes / Grabados. Takes, outfit, props and the plan live on each board. Phone-first, works on desktop, light/dark. Same origin rules as hub.html (only `jorgedearmas.github.io`). CSP: `img-src data:` (inline product thumbs inside the encrypted scene) and `connect-src 'self' https://webhook.site`.

https://jorgedearmas.github.io/grok-canvas/grabacion.html#b=<blob>&k=<key>

Scene: `updatedAt`, `products{key: {name, thumb}}` (thumb must be `data:image/jpeg;base64,…`), `videos[] {id: rec:<job>, day: YYYY-MM-DD|sin-fecha, place, product, title, stage 0-5, ready, board (https, host jorgedearmas.github.io, path /grok-canvas/ only)}`, `ticks{rec:<job>: [0|1, ms]}`, `mailbox` (webhook.site UUID; preferred over `&f=` so the link survives mailbox rotation).

Marks are saved in localStorage instantly (`rec-ticks:<blob>`; newest timestamp wins against the scene's `ticks`), are undo-able, and are sent as ONE `text/plain` POST `{kind:"ticks", v:2, set:{"rec:<job>":[0|1, ms]}}` (no CORS preflight) at most every 5 minutes, or when the creator taps «Enviar» (a free webhook.site URL takes ~100 requests). The bot treats it as untrusted data: ids must match `^rec:[a-z0-9]{2,24}$` and the only effect is the filmed mark. Test: `SHOTS_DIR=/tmp/shots npm run test:grabacion` (`SCENE_FILE=<local scene.json>` renders real data locally; never commit real scenes).

## portal.html

Mobile-first portal for a hired creator (PLP + PDP). Encrypted scene `type: "portal"`. The session token lives only in the hash (`#b=<blob>&k=<key>&t=<token>`). State and resumable multipart uploads go to the Cloudflare Worker (`apiBase` in the scene, hostname `*.workers.dev` only). Never commit a full link with `#k=`.

PLP: «Hola, \<nombre\>» + product rows (thumb, truncated name, status, «Ver board»). PDP, in this order: reference video → scene board (ref frame | our frame + ACCIÓN ES) → guion with «Copiar guion» → take upload with resume (IndexedDB). Revoked/expired tokens show «Este enlace ya no está activo». Test: `npm run test:portal`.

## manager.html

Phone view for the manager. Encrypted scene `type: "manager"`. The manager token is only in the hash (`#b=<blob>&k=<key>&m=<token>`). Lists portals, «Copiar link» (clipboard), take preview, Aprobar / Re-grabar with a reason, Revocar / Extender. Test: `npm run test:manager`.

Secret scan: `npm run test:secrets` (also runs in CI). All viewer tests: `npm test`.
