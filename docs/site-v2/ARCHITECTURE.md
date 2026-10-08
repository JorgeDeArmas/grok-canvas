# Site v2 — Architecture

> Companion docs: [PRD.md](PRD.md) (every screen, component, copy string), [QA-PLAN.md](QA-PLAN.md) (acceptance + test matrix), [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) (phased tasks), [schemas/](schemas/) (JSON Schemas of the v2 scene contracts), [REQUIREMENTS.md](REQUIREMENTS.md) (input).
>
> Public repo rule: this document contains **no** keys, tokens, blob ids, mailbox ids, session ids, creator names, brand names or deal amounts. Examples use synthetic values (`<blob>`, `<key>`, "Ana", "Producto A").

| Field | Value |
|---|---|
| Version | 2.0-arch · 8 Oct 2026 |
| Inputs | `REQUIREMENTS.md` v1.0, `grok-canvas` @ `961263e`, current fixture and real screenshots (real ones reviewed but not committed) |
| Audience | Implementing agent (Grok 4.7), Jorge (decisions), whoever owns the generators (Agent-Skills) and the Worker |

---

## 0. Executive summary

v2 turns ten separate viewers into **one installable app for Jorge** (`/grok-canvas/app/`, PWA name «Comando») plus **one creator portal** (`/grok-canvas/portal.html`, same URL as today). Both use **one shared board template** and one design system.

- **Three tabs, in this order: Dashboard · Grabar · Creadoras.** Dashboard (the old «Más») is where the app always opens.
- **Feed** and **Boards** are full screens one tap away from Dashboard (and Boards is also one tap from Grabar). Everything is at most two taps from anywhere.
- Old pages become **hash-preserving redirectors** into the app. `portal.html` stays where it is so the active creator session keeps working.
- **Key bootstrap for the PWA:** you open your existing Comando link (or paste it once in the installed app). The keys are imported as **non-extractable WebCrypto keys into IndexedDB**, then removed from the address bar. The root scene carries a **keyring** with the feed and boards keys, so one link unlocks everything, and no existing key is rotated.
- **Static hosting, no build step.** Shared ES modules live in `/grok-canvas/lib/`. The app's CSP drops `'unsafe-inline'` for scripts.
- **Generator changes:** the Dashboard scene becomes `comando` v4. Boards and board scenes become v2. «Bella» becomes «Creadoras» as a label; the technical id stays `bella`. The viewer still accepts every v1 and v3 scene during the transition.
- **Worker change:** one additive, backward-compatible change, v1.1 «owner session», so Jorge can upload takes from his own board just like the creators do. It needs a deploy by Jorge or the box, never by an agent.

### Design principles (they drive every decision below)

| # | Principle | Consequence |
|---|---|---|
| P-1 | **One home per feature.** Each feature has one screen. Other screens may *link* to it but never re-render it. | Creadoras only in its tab; the filming list only in Grabar; take review only in Creadoras; notes in one sheet. |
| P-2 | **One entity, one card.** A product has one sheet. A video appears exactly once per list. | Product sheet; the Boards library groups by product and lists each video once. |
| P-3 | **Actions in one list, status elsewhere.** On the Dashboard only «Por hacer» (and «Lo próximo») carry action buttons. Overview sections (Productos, Marcas, Grok) show status chips only. | Fixes R-02, R-05 and R-18. |
| P-4 | **One state = one word = one chip = one icon = one color.** | Unified vocabulary (PRD §6). |
| P-5 | **Show only what differentiates.** No repeated verbs, no internal codes, no repeated subtitles, no absolute ISO dates. | Fixes R-06, R-15 and HR-03. |
| P-6 | **Badges only for things that need Jorge.** | Fixes R-16. |
| P-7 | **The link is the secret; the device may hold it only as non-extractable keys.** Nothing secret goes in URLs we generate, in caches as plaintext, in logs or in git. | Q-01, §13. |
| P-8 | **Never break a live link.** Old URLs redirect with their hash; old scene versions still render. | §4, §7.6. |

---

## 1. DECISIONS (open questions answered)

Each decision is final for the implementing agent. Items that truly need Jorge are listed in §1.3.

### 1.1 The ten open questions from REQUIREMENTS §10

| ID | Decision | Why |
|---|---|---|
| **Q-01** Key bootstrap in the installed PWA | **«Abre o pega tu link» onboarding + device keyring.** (1) Opening any root link (`comando.html#b&k`, `hub.html#b&k`, or `app/#b&k`) imports the root key. (2) The installed app, when it has no keys, shows a screen «Pega el link del Comando» with a **Pegar link** button (`navigator.clipboard.readText()` on tap) and a text field fallback. (3) Keys are imported with `crypto.subtle.importKey(..., extractable=false, ["decrypt"])` and stored as `CryptoKey` objects in IndexedDB `comando/keys`. The root scene's `keyring` supplies the sub-scene keys (feed, boards, filming), which are also imported non-extractable. (4) After a successful import, `history.replaceState` removes `b/k/f/m` from the URL, so iOS «Agregar a inicio» and any screenshot or bookmark never contain the key. (5) **Ajustes › Olvidar este teléfono** wipes keys, outbox, cached scenes and media, and local state. (6) No PIN: a short PIN wrapping an AES key is brute-forceable offline, so it adds friction without security. An optional **Face ID lock (WebAuthn PRF)** is designed as an extension (§13.6) and is not part of v2. Fallback: if a browser cannot store a `CryptoKey` in IndexedDB, the raw base64url key text is stored and Ajustes shows «Llave guardada (modo simple)». | Works on iOS, where standalone storage is separate from Safari: the clipboard is shared, so a paste is the only reliable bridge. On Android the installed app shares storage with Chrome, so no paste is needed. Non-extractable keys stop script exfiltration of raw key bytes. Removing the key from the URL closes the «start_url / home-screen bookmark holds the key» hole. Threat-model change documented in §14.3. |
| **Q-02** Is the creator portal installable? | **No.** The PWA is Jorge's app only (`/grok-canvas/app/`, its own scope, manifest and service worker). `portal.html` stays a plain link-only page with no manifest and no service worker, but it shares the design tokens and the board and upload components. | Creator sessions last a shoot day plus 3 days. Installing on iOS would split storage and break the resumable-upload state in IndexedDB between Safari and the home-screen app. It also keeps every creator device outside Jorge's service-worker scope. |
| **Q-03** Where do Feed and Boards live? | **Feed** is a full-screen route `#/feed`, opened from the Dashboard «Atajos» tile (1 tap). The bottom bar is hidden in Feed, and «‹» goes back. **Boards** is a library route `#/boards`, opened from the Dashboard «Atajos» tile and from the «Boards» button in the Grabar app bar (1 tap each). A 4th «Feed» tab is **prepared behind a flag** (`TABS_WITH_FEED=false`) pending Jorge's OK (§1.3). | Honors HR-01/HR-02 (exactly three tabs) while keeping both screens at ≤ 2 taps from anywhere. |
| **Q-04** `hub.html`, `manager.html`, `board.html` vs `portal.html`, `index.html` | `comando.html`, `hub.html`, `grabacion.html`, `boards.html`, `feed.html`, `manager.html` and `board.html` become **redirectors** to `app/` (hash preserved). `portal.html` stays (creator portal, rebuilt on shared modules). `index.html` stays as the generic canvas for ad hoc pieces (charts, still approvals that haven't migrated). It gains a shim: a decrypted scene of `type:"board"` redirects to `app/`. `preview.html` becomes a synthetic static demo of v2. | One viewer per job. No link breaks. |
| **Q-05** AI (Kling) boards with GO / Pedir cambios | **Same board template.** The bottom section is **«Aprobar»** (GO / Pedir cambios cards) instead of «Subir video» when the board scene has `approvals[]`. Payloads are unchanged: `{kind:"approve", blockId, choice:"go"|"changes"}`. AI boards that haven't been republished as `board` v2 keep opening in `index.html` (labeled «Board antiguo» in the library). | One template (HR-05). No new mailbox effects. |
| **Q-06** Does Jorge upload his takes from his board? | **Yes, via Worker v1.1 «owner session»** (§11). The box keeps one rolling owner session for Jorge's own jobs. Its token is sealed in the root scene as `ownerToken`, exactly like `managerToken`, and it uses the **existing** creator upload endpoints unchanged. Until v1.1 is deployed and `ownerToken` is present, Jorge's board hides the upload section and shows nothing disabled. The «Pasar tomas a la Mac» task keeps coming from the generator. | Fulfills HR-05 and HR-06 and fixes B-09 with minimal Worker surface: one D1 column, one admin endpoint, one response field. |
| **Q-07** Migrate `bella` ids to `creadoras`? | **No id migration in v2.** Lane ids stay `miamix` and `bella` (profile, products.json, Worker account, item ids `bella:<pid>:post`). Display labels come from a single viewer map `LANES = {miamix:"Miami X", bella:"Creadoras", creadoras:"Creadoras"}` that overrides scene labels, so the viewer **cannot** render «Bella» even with an old scene. Generators change the human-readable texts they emit (§10). The alias `creadoras` is accepted now, so a future id migration needs no viewer change. | Zero risk to the Worker, the tracker and the live session. HR-10 holds on screen. |
| **Q-08** One aggregate Dashboard scene or many? | **Root scene `comando` v4 (light, everything Dashboard, Grabar and Creadoras need) + `keyring` for heavy sub-scenes (feed, boards) loaded on demand and prefetched on idle.** Filming data moves **into** the root scene (`videos[]`), so the three tabs need one fetch. The legacy `filming` scene keeps being published until Phase 9, for old links opened on devices without the keyring. | One fetch for the first useful paint. The heavy feed stays separate. No key rotation: the keyring holds the existing keys. |
| **Q-09** Push notifications | **Out of scope for v2.** Extension point documented in §12.9 (iOS 16.4+ Web Push for installed apps; VAPID keys on the Worker; triggers from Worker `events` such as `link_expiring` and new uploads). No stub code ships. | Needs a push server plus key management; not required for «todo funciona al 100 %». |
| **Q-10** Unified offline outbox | **Yes.** One IndexedDB queue (`comando/outbox`) for every mailbox tap: ✓ done/undo, `act`, picks, «Lo quiero», ticks, GO/changes, notes. It coalesces, retries with backoff, and has visible state (an app-bar pill «N por enviar» and the Outbox sheet). **Payload shapes are byte-for-byte the same as today**, so generator ingest needs no change. | Reliability on bad signal, with no ingest risk. |

### 1.2 Additional architecture decisions

| ID | Decision |
|---|---|
| D-11 | **Bottom tab bar** (icon + label, 3 items) replaces the top segmented control. Reasons: thumb reach at 390×844, the iOS standalone convention, and it frees the header for title, status and actions. |
| D-12 | The app lives in **`/grok-canvas/app/`** (`app/index.html`). The service-worker scope `/grok-canvas/app/` cannot control `portal.html`, legacy viewers or `index.html`. Shared code lives in **`/grok-canvas/lib/`**, imported by the app and the portal. |
| D-13 | **No build step, no framework, no new runtime dependencies.** Vanilla ES modules, an `html` tagged template that escapes every interpolation, event delegation. This matches today's code and keeps Pages static (REQUIREMENTS §9.4). |
| D-14 | **Icons: Lucide** (ISC license), a pinned subset vendored as path data in `lib/icons.js` (inline SVG, 24-px grid, 2-px stroke, `currentColor`). No CDN, no emoji anywhere in the UI. |
| D-15 | **Routing in the hash** (`#/dashboard`, `#/grabar`, …). Key params (`#b=…&k=…`) are distinguished because they don't start with `/`. They are consumed and replaced by a route once persisted. |
| D-16 | **"Strip only when persisted."** If keys are saved to the keyring, they are removed from the URL. In single-scene mode (a legacy sub-scene link on a device without a root keyring) the key stays in the hash so reload keeps working, which is today's behavior. |
| D-17 | **Mailbox per channel.** Outbox entries carry `channel` (`hub`, `feed`, `board:<id>`), resolved to a mailbox **at send time** from the freshest decrypted scene. This survives mailbox rotation and fixes the feed reading `#f=` only. |
| D-18 | **Dates are relative and in America/New_York** («hoy», «mañana», «sáb 10 oct», «Atrasado · sáb 3 oct»). Never raw ISO. |
| D-19 | **Copy uses «link», never «enlace».** Jorge and the creators say «link». |
| D-20 | **The Feed stays dark** in both themes (immersive video). Every other surface follows `prefers-color-scheme`, with a manual override in Ajustes (Automático / Claro / Oscuro). |
| D-21 | **PWA icons and splash PNGs are committed** under `app/icons/`. `scripts/check-secrets.sh` allows PNGs **only** in that folder and **only** if their SHA-256 is listed in `app/icons/ICONS.sha256`. They are generated deterministically from an SVG by `scripts/make-icons.mjs` (Playwright). |
| D-22 | **`@playwright/test` + `axe-core` added as devDependencies** (test-only), WebKit added to CI. |

### 1.3 What truly needs Jorge

| # | Question | Default if he doesn't answer |
|---|---|---|
| J-1 | A 4th tab «Feed» (Dashboard · Grabar · Creadoras · Feed)? It's built behind `TABS_WITH_FEED`. | **3 tabs**, as he asked. Feed is 1 tap from Dashboard. |
| J-2 | Approve deploying Worker v1.1 (owner session) so he can tap «Subir video» on his own boards. It is a `wrangler deploy` that only he or the box can run. | Jorge's boards ship without the upload section; «Pasar tomas a la Mac» stays. |
| J-3 | Confirm he has **no other GitHub Pages sites** under `jorgedearmas.github.io/*` (they would share the same browser origin and could read the device keyring). | We assume none exist. Phase 0 checks with `gh repo list` and the result goes in the PR. |

---

## 2. Information architecture (sitemap)

```
Comando (PWA, /grok-canvas/app/)                          Creator portal (/grok-canvas/portal.html)
│                                                          │
├── [Tab 1] Dashboard  #/dashboard   ← default, always      ├── Mis productos (PLP)
│   ├── Lo próximo (hero)                                   └── Board (shared template, role=creator)
│   ├── Atajos: Feed ▸ #/feed · Boards ▸ #/boards               ├── Video de referencia
│   ├── Por hacer (all actions)                                 ├── Escenas (Lo que dices / Qué haces)
│   │     ├─ sheet: Guiones A/B/C                               ├── Guion
│   │     ├─ sheet: Detalle de tarea / Correo                   └── Subir video (+ Reanudar)
│   ├── Productos (status overview, max 6)
│   │     ├─ sheet: Producto  (#/producto/<pid>)
│   │     └─ sheet: Todos los productos
│   ├── Marcas (group rows) ─ sheet: Marcas
│   ├── Grok trabaja en (max 3) ─ sheet: Detalle
│   └── Avisos
│
├── [Tab 2] Grabar  #/grabar  (#/grabar/grabados)
│   ├── Por grabar | Grabados (segmented)
│   ├── Day groups → video cards → Board ▸ #/board/<id>
│   └── App bar: Boards ▸ #/boards
│
├── [Tab 3] Creadoras  #/creadoras
│   ├── Session cards (link, share, extend, revoke)
│   │     ├─ sheet: Revisar tomas (#/creadoras/<sid>/tomas)
│   │     │     └─ dialog: Re-grabar (motivo)
│   │     └─ creator product ▸ Board (role=viewer)
│   └── Anteriores (expired / revoked, collapsed)
│
├── Feed  #/feed   (full-screen, dark, no tab bar)
│   └── sheet: Filtros (ventana, creador)
├── Boards  #/boards  (library, grouped by status → product)
│   └── Board ▸ #/board/<id>
├── Board  #/board/<id>  (shared template, role=owner)
├── Ajustes  #/ajustes  (from Dashboard app bar)
│   └── sheet: Instalar en tu teléfono
├── Bienvenida  #/bienvenida  (paste link; only when no keyring)
│
└── Global overlays: Nota para Grok (sheet) · Por enviar (outbox sheet) · Toast con Deshacer
                     · Banner (offline / update / install) · Confirm dialog
```

Screens the app can open **without** a root keyring (single-scene mode, D-16): Grabar (filming v2), Boards (boards v1/v2), Feed (creator-feed), Board (board v1/v2), Creadoras (manager v1 + `#m=`). In this mode there is no tab bar and no Dashboard. The app bar shows the screen title only.

---

## 3. Navigation model

### 3.1 Routes

| Route | Screen | Bottom bar | Back target | Notes |
|---|---|---|---|---|
| `#/dashboard` | Dashboard | yes (selected) | — | Cold start always lands here (HR-01), unless a deep link was opened. |
| `#/grabar` · `#/grabar/grabados` | Grabar (segment) | yes | — | |
| `#/creadoras` | Creadoras | yes | — | |
| `#/creadoras/<sid>/tomas` | Revisar tomas sheet over Creadoras | yes (under scrim) | closes sheet | `sid` = session id (opaque, from the scene). |
| `#/producto/<pid>` | Product sheet over Dashboard | yes | closes sheet | |
| `#/feed` | Feed | **no** | previous route, else `#/dashboard` | |
| `#/boards` | Boards library | **no** | previous route, else `#/dashboard` | |
| `#/board/<id>` | Board | **no** | previous route, else `#/boards` | `id` = boards-scene id or `v:<videoId>` when opened from Grabar via `boardRef`. |
| `#/ajustes` | Ajustes | **no** | `#/dashboard` | |
| `#/bienvenida` | Onboarding | **no** | — | Only reachable when the keyring has no root. |
| `#b=…&k=…[&f=…][&m=…][&t=…]` | Key import (transient) | — | — | Consumed by the router (§13.2) and replaced by a route. |

Unknown route → `#/dashboard` (or `#/bienvenida` if there is no root).

### 3.2 Rules

1. **Tabs** switch instantly (no slide). Each tab keeps its own scroll position in memory. Tapping the selected tab scrolls to the top.
2. **Push screens** (Feed, Boards, Board, Ajustes) slide in from the right and hide the bottom bar. «‹» calls `history.back()` when the previous entry is in-app, else replaces with the documented back target.
3. **Sheets** push a history entry (`history.pushState({sheet: "<name>"}, "", location.href)`, same URL) so Android back and the browser back button close the sheet first. Routed sheets (`#/producto/<pid>`, `#/creadoras/<sid>/tomas`) push their own route instead. Closing a sheet any other way (✕, scrim, Escape, swipe down) calls `history.back()` if the sheet pushed the entry.
4. **Deep links from old pages** land on their screen (e.g. `grabacion.html#…` → `#/grabar`), never on Dashboard.
5. **Resume from background** (`visibilitychange` → visible) keeps the current route and refreshes the data. **Cold start** (a new page load whose hash is empty or is a plain tab route, i.e. not a key import or a deep link like `#/board/…`) goes to `#/dashboard`, in both standalone and browser modes.
6. External links (TikTok, TikTok Shop, Gmail, legacy `index.html` boards) open with `target="_blank" rel="noopener noreferrer"`. In iOS standalone they open in the in-app Safari sheet, which is expected.
7. **≤ 2 taps rule** (QA NAV-05): from any tab, Feed = Dashboard › Feed, Boards = Dashboard › Boards or Grabar › Boards, a Board = Grabar › card, Ajustes = Dashboard › ⚙.

### 3.3 Installed app vs browser tab

| Aspect | Browser tab (Safari/Chrome) | Installed (standalone) |
|---|---|---|
| First open | The link holds the key → import → strip | Empty keyring → Bienvenida (paste). Android: shares Chrome storage, usually already imported. |
| Install banner | iOS Safari: «Instala Comando» banner on Dashboard (dismissible, comes back after 14 days). Android: `beforeinstallprompt` → «Instalar». | Hidden. |
| Pull to refresh | Native in the browser plus our own (identical behavior) | Our own pull-to-refresh (iOS standalone has none) |
| External links | New tab | In-app Safari / Custom Tab |

---

## 4. Page consolidation and redirects

### 4.1 Fate of every current page

| Current page | v2 fate | New home | Redirect / compat |
|---|---|---|---|
| `comando.html` | **Redirector** | `app/` | `location.replace("app/" + location.hash)` |
| `hub.html` | **Redirector** (legacy viewer retired) | `app/` | same |
| `grabacion.html` | **Redirector** | `app/#/grabar` | same; the app detects `type:"filming"` |
| `boards.html` | **Redirector** | `app/#/boards` | same; detects `type:"boards"` |
| `feed.html` | **Redirector** | `app/#/feed` | same; detects `type:"creator-feed"`; `f` is kept as the feed channel mailbox |
| `manager.html` | **Redirector** | `app/#/creadoras` | same; detects `type:"manager"`; `m` is held **in memory only** for the session (never persisted, since the root scene already seals `managerToken`) |
| `board.html` | **Redirector** | `app/#/board/…` | same; detects `type:"board"` |
| `portal.html` | **Stays** (rebuilt on `lib/`) | itself | Accepts portal v1 and v2 scenes, same `#b&k&t`, same IndexedDB upload records |
| `index.html` | **Stays** (generic canvas) | itself | Shim: if the decrypted scene has `type:"board"` → `location.replace("app/" + location.hash)`. githack removed from the CSP and fetch (B-02). |
| `preview.html` | **Replaced** by a synthetic v2 demo (no scene, no key) | itself | — |

### 4.2 Redirector file (identical for all seven)

```html
<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'">
<title>Comando</title>
<script src="lib/redirect.js" data-to="app/"></script>
</head><body><noscript>Activa JavaScript para abrir este link.</noscript></body></html>
```

`lib/redirect.js` (the only logic): `const to = document.currentScript.dataset.to; location.replace(new URL(to, location.href).pathname + location.hash);`. It makes no network request other than the navigation, and the hash never leaves the client. It is the same file for every redirector (tested in QA LNK-*).

### 4.3 How the app resolves an incoming hash

```
hash has b & k?
 ├─ no  → route (#/...) or default
 └─ yes → fetch ../scenes/<b>.json → decrypt with k → read type
          ├─ hub | comando        → ROOT: import root (replace any previous root), persist, strip → #/dashboard (or keep the route if the hash also had r=)
          ├─ filming | boards | creator-feed | board | manager
          │     ├─ keyring has root?   → learn: persist as role (feed/boards/filming) if it's not already
          │     │                         there; board → persist under board:<b>; manager → m stays in memory;
          │     │                         strip → route to that screen in full-app mode
          │     └─ no root            → single-scene mode, keep the hash (D-16)
          ├─ portal                → location.replace("../portal.html" + hash)   (a creator link opened by mistake)
          └─ anything else (canvas blocks) → location.replace("../index.html" + hash)
decrypt fails → if the stored root key failed too: «Tu link cambió» state; else the «No se pudo abrir» error (PRD §8.18)
```

---

## 5. Runtime architecture

### 5.1 Files

```
/grok-canvas/
├── app/
│   ├── index.html              PWA shell: CSP, manifest link, apple meta, <main id="app">, imports app.js
│   ├── app.js                  boot, router, screen registry, refresh loop, SW registration
│   ├── sw.js                   service worker (scope /grok-canvas/app/)
│   ├── manifest.webmanifest
│   └── icons/                  icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon-180.png,
│                               splash-*.png (10), icon.svg, ICONS.sha256
├── lib/
│   ├── core.js                 host check, b64, AES-GCM scene/media decrypt, fetchScene, sanitizers (txt, safeHttpsUrl,
│   │                           safeMediaUrl, apiBaseOk, boardUrl, THUMB_RE…), copyText, share
│   ├── html.js                 html`` tagged template (auto-escape), raw(), classMap()
│   ├── dates.js                ET "today", relative labels, overdue
│   ├── copy.js                 Spanish string dictionary (every UI string in PRD §7)
│   ├── status.js               state machines: label/tone/icon/primary action per entity
│   ├── lanes.js                LANES map (bella → Creadoras)
│   ├── icons.js                Lucide subset → icon(name, {size, label})
│   ├── ui.css                  design tokens (light/dark) + component classes
│   ├── components.js           sheet, dialog, toast(+undo), banner, segmented, tabbar, appbar, skeleton, pull-to-refresh
│   ├── board.js                shared board renderer (role: owner | creator | viewer)
│   ├── upload.js               resumable multipart (Worker contract), IndexedDB records, wake lock
│   ├── keyring.js              IndexedDB comando/keys; import/forget; non-extractable keys
│   ├── outbox.js               IndexedDB comando/outbox; coalescing; send loop
│   ├── model.js                scene adapters → view model (hub v3/v4, filming v2, boards v1/v2, board v1/v2, manager v1)
│   ├── worker-api.js           manager + owner calls to creator-portal-api
│   ├── redirect.js             redirector logic (§4.2)
│   └── screens/
│       ├── dashboard.js  grabar.js  creadoras.js  review.js  boards.js  board-screen.js
│       ├── feed.js  product.js  scripts.js  note.js  outbox-sheet.js  ajustes.js  bienvenida.js  install.js
├── portal.html                 creator portal (imports lib/core, html, dates, copy, status, icons, ui.css, components, board, upload)
├── index.html                  generic canvas (+ type:board shim; githack removed)
├── comando.html hub.html grabacion.html boards.html feed.html manager.html board.html   → redirectors
├── preview.html                synthetic v2 demo
├── scenes/  media/             unchanged (encrypted)
├── scripts/check-secrets.sh    + icon allowlist (D-21)  · scripts/make-icons.mjs
└── tests/                      see QA-PLAN
```

**Portal import boundary (privacy):** `portal.html` must never import `keyring.js`, `outbox.js`, `model.js`, `worker-api.js` or `screens/*`. A static test parses its import graph (QA SEC-07).

### 5.2 Rendering and state

- `app.js` holds a single `store`: `{ route, model, feed, boards, boardsById, live: {sessions, owner}, outbox, online, sw }`. Screens are pure functions `render(store) → html` plus an `bind(root, store)` that attaches delegated handlers. Re-render happens on store change, preserving scroll and focus (key-based patch of list containers is enough; no virtual DOM).
- **Never re-render while the user is typing** (any focused `textarea`/`input` inside the screen or a sheet). The new model is applied on blur.
- `html` tagged template: every `${}` is escaped unless wrapped in `raw()` (used only for `icon()` output and other `html` results). Code review rule: **no `innerHTML` with string concatenation outside `html.js`.**

### 5.3 Refresh loop

| Data | Trigger | Interval | Failure behavior |
|---|---|---|---|
| Root scene | boot, visible, pull-to-refresh, tap on «Actualizado…» | 60 s while visible | Keep the last good model. App-bar status turns «Sin conexión» (offline) or «No se pudo actualizar» (error). |
| Worker sessions (`GET /manager/sessions`) | Creadoras visible, after every manager action, boot (for badges) | 60 s while Creadoras is visible; 5 min otherwise | Banner on Creadoras «No se pudo actualizar las tomas · Reintentar» |
| Owner session (`GET /s/<ownerToken>`) | Board (owner) visible, after an upload | 60 s while visible | Inline on the board |
| Boards scene | Boards visible, idle prefetch after boot | on visible | Error state + Reintentar |
| Feed scene | Feed visible, idle prefetch after boot | 10 min | Keep the last good one |
| Board scene | open board | on visible | Keep the last good one |

Idle prefetch uses `requestIdleCallback` (with a fallback `setTimeout(1500)`) and fetches the boards and feed scenes so their counts show on the Atajos tiles and they work offline.

---

## 6. Data flow

```
                          ┌──────────── Agent-Skills (box) ────────────┐
 hub routine 7/10/15/20 ET│ build_hub.py ──► comando v4 (root) ─────────┼──┐
 + every pipeline change  │   ├─ build_filming.py ► filming v2 (legacy) ┼──┤
                          │   └─ build_boards.py ► boards v2 ──────────┼──┤   seal AES-GCM
 feed routine 7:34 ET     │ run_feed.py ► creator-feed + media/*.enc ───┼──┤   git push main
 pack_ready               │ publish_board.py ► board v2 (+ FF migration)┼──┤   (Pages ~1 min)
 session new/extend/revoke│ portal_build.py ► portal v2 per session ────┼──┤
                          │   └─ owner session ensure (W-1) ─► ownerToken sealed in comando v4
                          └─────────────────────────────────────────────┘  ▼
                                                                  /grok-canvas/scenes/*.json (ciphertext)
 ┌────────────── Jorge's phone (app/) ─────────────────┐                   │
 │ keyring (IDB, non-extractable) ─► decrypt ◄─────────┼── SW cache (ciphertext only) ◄──┘
 │ view model ─► Dashboard / Grabar / Creadoras / Feed / Boards / Board
 │ outbox (IDB) ──POST (same payloads)──► webhook.site ──► ingest on next build (schema-limited)
 │ worker-api ──manager token──► creator-portal-api (/manager/*)
 │ upload.js ──owner token──► creator-portal-api (/upload/*) ──► R2 ──► Mac puller ──► 03-takes/
 └─────────────────────────────────────────────────────┘
 ┌──── Creator's phone (portal.html) ────┐
 │ #b&k&t → decrypt portal scene         │
 │ upload.js ──creator token──► /upload/* ; GET /s/:token
 └───────────────────────────────────────┘
```

Off-screen effects that must keep working (REQUIREMENTS §4.12) are unchanged because ids and payloads are unchanged: tracker acts (`act.id`), pick → `script_letter`, ticks → filmed mark, «Publicado» → `bella:<pid>:post` done, mailbox rotation via `scene.mailbox`.

---

## 7. Data contracts

JSON Schemas (draft 2020-12): [`schemas/comando-v4.schema.json`](schemas/comando-v4.schema.json), [`schemas/boards-v2.schema.json`](schemas/boards-v2.schema.json), [`schemas/board-v2.schema.json`](schemas/board-v2.schema.json), [`schemas/portal-v2.schema.json`](schemas/portal-v2.schema.json). Generators validate against them before sealing (G-0). Viewers **still sanitize every field** (they never trust a scene, even a valid one).

### 7.1 Shared primitives

| Name | Rule |
|---|---|
| `Ref` | `{ b: /^[A-Za-z0-9_-]{8,64}$/, k: base64url of 32 bytes (43 chars) }`, plus an optional `f` (mailbox UUID) on feed. |
| `ItemId` | `/^[a-z0-9:_.-]{1,120}$/i` (unchanged; ids are what the mailbox ingest expects) |
| `Pid` | product id string `/^[A-Za-z0-9_-]{1,40}$/` |
| `VideoId` | `/^rec:[a-z0-9]{2,24}$/` (unchanged from filming v2) |
| `Day` | `YYYY-MM-DD` (America/New_York business date) or `"sin-fecha"` |
| `Thumb` | key into `thumbs` → `data:image/jpeg;base64,…` (< 60 000 chars) |
| `EncMedia` | `{ enc: true, src: "media/m<16hex>.enc" or https://cdn.jsdelivr.net/…/media/m<16hex>.enc, mime }` |
| `Lane` | `"miamix" | "bella" | "creadoras"` (display through `LANES`) |
| `Tone` | `"neutral" | "accent" | "good" | "warn" | "bad" | "info" | "teal"` |
| `VideoStatus` | `preparing | to_film | filmed | editing | to_publish | published | to_approve | problem | retired` (PRD §6.1) |
| `Stage` | `chosen | sample_requested | sample_shipping | arrived | researching | pick_script | preparing | to_film | filmed | editing | to_publish | published | brand_hold | dropped` (PRD §6.2) |

### 7.2 Root scene `comando` v4 (replaces hub v3)

```jsonc
{
  "type": "comando", "version": 4,
  "updatedAt": "2026-10-08T11:00:00Z",
  "mailbox": "<uuid>",
  "portalApi": "https://<name>.workers.dev",
  "managerToken": "<sealed, optional>",          // unchanged semantics
  "ownerToken": "<sealed, optional>",            // NEW (Q-06); only when Worker v1.1 is live
  "keyring": {                                   // NEW (Q-08); existing keys, never rotated for this
    "boards":  { "b": "<blob>", "k": "<key>" },
    "feed":    { "b": "<blob>", "k": "<key>", "f": "<uuid>" },
    "filming": { "b": "<blob>", "k": "<key>" }   // legacy, until Phase 9
  },
  "thumbs": { "p123": "data:image/jpeg;base64,…" },

  "tasks": [                                     // Dashboard «Por hacer», priority order; [0] may become «Lo próximo»
    { "id": "ff:ff010:pick", "kind": "pick_script", "title": "Producto A", "meta": "3 guiones · recomendado B",
      "thumb": "p123", "product": "123", "open": { "scripts": "ff-010" },
      "action": { "type": "scripts", "label": "Elegir guion" } },
    { "id": "bella:123:post", "kind": "publish", "title": "Producto B", "meta": "Video listo", "product": "124",
      "action": { "type": "done", "label": "Publicado" } },
    { "id": "prod:125", "kind": "sample", "title": "Producto C", "meta": "Pedida el 2 oct", "product": "125",
      "action": { "type": "act", "id": "prod:125:approved", "label": "La aprobaron", "doneLabel": "Aprobada" } },
    { "id": "brand:<thread>:wait", "kind": "brand_reply", "title": "Marca X", "meta": "Te escribió ayer",
      "mail": { "web": "https://mail.google.com/…", "search": "from:…", "subject": "…" },
      "action": { "type": "mail", "label": "Responder" }, "done": { "label": "Ya respondí" } },
    { "id": "feed:2026-10-08", "kind": "choose_products", "title": "Elegir productos del feed",
      "action": { "type": "route", "route": "feed", "label": "Abrir feed" }, "done": {} }
  ],
  "products": [
    { "id": "123", "name": "Producto A", "thumb": "p123", "lane": "miamix", "stage": "pick_script",
      "due": "2026-10-10", "now": "Te toca elegir el guion",
      "sample": { "state": "arrived" }, "pdp": "https://shop.tiktok.com/…", "videos": ["rec:ff010"],
      "detail": [["Muestra", "Llegó el 6 oct"]] }
  ],
  "videos": [                                    // NEW (from build_filming): every video, any owner
    { "id": "rec:ff010", "job": "ff-010", "product": "123", "title": "Gancho corto del video",
      "owner": "jorge", "lane": "miamix", "day": "2026-10-10", "place": "Sala",
      "status": "to_film", "ready": true, "boardRef": { "b": "<blob>", "k": "<key>" },
      "takes": { "total": 6, "uploaded": 0 } }
  ],
  "ticks": { "rec:ff010": [0, 1728380000000] },  // from filming (processed marks)
  "brands": { "groups": [
    { "id": "waiting", "label": "Esperando respuesta", "items": [ { "id": "brand:<t>:wait", "title": "Marca Y", "meta": "Tarifa enviada", "since": "2026-09-28", "mail": { } } ] },
    { "id": "closed",  "label": "Cerrado · falta contrato o pago", "items": [ ] },
    { "id": "negotiating", "label": "Negociando", "items": [ ] }
  ] },
  "grok": [ { "id": "m:abc", "title": "Identificando producto de un link", "meta": "Desde hoy 9:10", "icon": "search" } ],
  "creators": [                                  // v3 fields + jobs[].board + kind
    { "id": "<sid>", "creatorName": "Ana", "shootDate": "2026-10-10", "expiresAt": "2026-10-13T23:59:59-04:00",
      "status": "active", "revoked": false, "link": "https://…/portal.html#b=…&k=…&t=…",
      "jobs": [ { "job_id": "FF-012", "name": "Producto D", "thumb": "p126", "board": { "b": "<blob>", "k": "<key>" } } ] }
  ],
  "scripts": { "ff-010": { /* unchanged from v3 */ } },
  "alerts": [ { "id": "old-videos", "text": "2 videos viejos de Creadoras sin cerrar", "tone": "warn" } ]
}
```

**Removed vs v3:** `counters` (R-16), `quick` (replaced by `keyring.boards`), `footer` (→ `alerts`), `sections[]` (→ `tasks`/`products`/`brands`/`grok`), section `creadoras` (R-01), item `rec:open` (R-03), section `grabar` (→ `videos`), and every verb-prefixed title (R-06).

**Task `kind` → icon and default action** (the viewer uses its own map; the scene can't inject icons):

| kind | Icon (Lucide) | Typical action |
|---|---|---|
| `pick_script` | `pen-line` | scripts → «Elegir guion» |
| `publish` | `send` | done → «Publicado» |
| `sample` | `package` | act → «Pedí muestra» / «La aprobaron» / «Llegó» / «Lo tengo» |
| `brand_reply` | `mail` | mail → «Responder» (+ done «Ya respondí») |
| `brand_decide` | `handshake` | done/detail → «Decidir» |
| `brand_bounce` | `triangle-alert` | detail → «Ver» |
| `deliver` | `package-check` | done → «Entregado» |
| `move_takes` | `hard-drive-upload` | done → «Hecho» |
| `choose_products` | `shopping-bag` | route feed → «Abrir feed» |
| `approve_media` | `thumbs-up` | board → «Revisar» |
| `other` | `circle-dot` | done / link |

**Rules the generator must enforce (and the viewer re-checks):**
- `title` is the real product or brand name. **No placeholders** («Producto», «Video»). If the name is unknown, the generator omits the task and logs it (R-20). The viewer drops tasks whose title is empty or exactly matches `/^(producto|video|item)$/i`.
- A task's id equals the v3 item id for the same thing (same `blockId` in payloads).
- **Ownership (R-17):** `videos[].owner` is `"jorge"` or `"creadoras"`. Grabar shows only `owner:"jorge"`. Creator-owned videos appear only in Creadoras (via `creators[].jobs`) and in the product sheet.
- **No duplication across lists:** a product's sample action appears as **one** task (not also as `act` on the product). `grok[]` excludes anything already visible as a product stage (`researching`/`preparing`).
- Texts never contain «Bella», FF-/JOB- codes, ISO dates or paths.

### 7.3 Boards v2

```jsonc
{ "type": "boards", "version": 2, "updatedAt": "…",
  "lanes": [ { "id": "miamix", "label": "Miami X" }, { "id": "bella", "label": "Creadoras" } ],
  "products": { "123": { "name": "Producto A", "thumb": "data:image/jpeg;base64,…" } },
  "boards": [
    { "id": "ff010", "product": "123", "title": "Gancho corto del video", "lane": "miamix", "kind": "film",
      "status": "to_film", "date": "2026-10-10", "viewer": "board", "ref": { "b": "<blob>", "k": "<key>" } },
    { "id": "job21", "product": "127", "title": "Video IA", "lane": "bella", "kind": "ai",
      "status": "problem", "problem": "TikTok lo marcó: contenido engañoso", "date": "2026-09-20",
      "viewer": "canvas", "ref": { "b": "<blob>", "k": "<key>" } },
    { "id": "ff004", "product": "128", "title": "…", "lane": "miamix", "kind": "film", "status": "problem",
      "problem": "Sin link", "missing": true }
  ] }
```
- `kind`: `film` (recorded), `ai` (Kling), `guide` (framework / text guide). The viewer shows kind only as a small icon for `ai` (`sparkles`); `guide` goes to the «Guías» section.
- `viewer: "board"` opens in-app `#/board/<id>`. `viewer: "canvas"` opens `../index.html#b=…&k=…` in a new tab, labeled «Board antiguo».
- **Never listed:** system pages (portal, manager, hub, filming, feed). The viewer also drops any entry whose legacy `board` URL has `t=` or `m=` or a path of `portal.html`, `manager.html`, `comando.html` or `hub.html` (B-07).
- v1 compatibility: the adapter maps `avatar → lane`, `status` text → `VideoStatus` (PRD §6.1 table), `board` URL → `ref` (parsed from its hash), `kind` ids by label (Video IA → `ai`, Grabación → `film`, Framework → `guide`). It groups by `name` when `product` is missing.

### 7.4 Board v2 (shared template; Jorge's boards, AI boards)

```jsonc
{ "type": "board", "version": 2, "id": "ff010", "job": "FF-010", "name": "Producto A",
  "thumb": { "enc": true, "src": "media/m…enc", "mime": "image/jpeg" },
  "lane": "miamix", "status": "to_film",
  "refSrc": { "enc": true, "src": "media/m…enc", "mime": "video/mp4" },
  "beats": [ { "shot": 1, "vo": "Mira esto", "do_es": "Abre el cajón con la mano derecha.",
               "refFrame": { "enc": true, "src": "…", "mime": "image/jpeg" }, "ourFrame": { "…": "…" } } ],
  "script": "…", "shots": [ { "shot": 1, "takes": 1 } ],
  "approvals": [ { "id": "job21:video", "label": "Video final", "kind": "video", "media": { "enc": true, "…": "…" } } ],
  "mailbox": "<uuid, optional>" }
```
- v1 (`type:"board"` without `version`) renders unchanged (it already has this shape minus `job`, `lane`, `status`, `approvals`).
- `job` is needed **only** to map owner uploads to Worker jobs; it is never displayed.
- `approvals[]` present → «Aprobar» section instead of «Subir video» (Q-05).

### 7.5 Portal v2 (creator)

v1 plus optional `shootDate`, `expiresAt`, `version: 2`. Everything else is unchanged (`creatorName`, `apiBase`, `products[] {id, name, thumb, blob?, status, script, beats, shots, refSrc}`). **Forbidden fields** (the generator strips them, the viewer ignores them, QA asserts their absence): `editor_brief`, commissions, costs, `managerToken`, `ownerToken`, `keyring`, other creators' data.

### 7.6 Version compatibility matrix (viewer side)

| Scene | Versions accepted by the v2 viewer | Adapter |
|---|---|---|
| `hub` / `comando` | v3 (`type` `hub`/`comando`, `version` 3 or missing) and v4 | `model.fromHubV3`, `model.fromComandoV4` |
| `filming` | v2 | `model.fromFilming` (single-scene Grabar; or merged when the root is v3 and `keyring.filming` was learned) |
| `boards` | v1, v2 | `model.fromBoards` |
| `board` | v1, v2 | `board.js` normalizer |
| `portal` | v1, v2 | `portal.html` normalizer |
| `manager` | v1 | `model.fromManager` (single-scene Creadoras) |
| `creator-feed` | as published today (`version` missing or 1) | `feed.js` normalizer |

**hub v3 → view model** (the important adapter, because v3 stays live until G-1 ships):
- `tasks` = items of `sections[id=hoy]` **minus** `group:"Grabar"`, mapped: `verb` → `kind` (Elegir guion → pick_script, Publicar → publish, «¿Llegó?»/Muestras → sample, Enviar respuesta → brand_reply, Decidir oferta → brand_decide, Email rebotó → brand_bounce, Entregar → deliver, Pasar tomas a la Mac → move_takes, Elegir productos → choose_products, Dar GO a las fotos → approve_media, else other). `title` = item `title` (the verb is dropped). `meta` = `sub`. The action is derived from `open.scripts` → scripts, `mail` → mail, `act` → act, `href` → link, `done` → done.
- `products` = `sections[id=productos]` items: `chip.text` → `stage` via the label table (PRD §6.2; unknown → `neutral` with the chip text). `group` → `due` (parsed Saturday) or null («Fecha por definir»). **`act` buttons on product items become tasks** (deduped by `act.id` against tasks already present).
- `videos` = `sections[id=grabar]` items (minus `rec:open`) + `hoy` items with `group:"Grabar"` → `owner:"jorge"`, `status:"to_film"`, `title` from `title`, `href` → legacy board URL. If `keyring.filming` was learned, the filming scene replaces this list (it has day, place, ticks).
- `brands.groups` = `sections[id=marcas]` grouped by `group`. Items with `done` or `mail` that are **not** «Esperando respuesta» become tasks too.
- `grok` = `sections[id=marcha]`. `alerts` = `footer` strings (tone `info`). `keyring.boards` = parsed from `quick[].href` (same-origin `boards.html#b&k`).
- `sections[id=creadoras]`, `counters` and `rec:open` are ignored.

### 7.7 Data per screen

| Screen | Scene fields read | Live APIs | Local state | Outbox kinds |
|---|---|---|---|---|
| Dashboard | `tasks, products, brands, grok, alerts, scripts, thumbs, updatedAt, videos (hero), creators (hero)`; feed/boards scene counts | `GET /manager/sessions` (hero: takes to review) | `hub-done:<b>`, `hub-picks:<b>` | `approve` done/undo, `approve` act, `pick`, `note` |
| Product sheet | `products[i], videos, tasks (its action), thumbs` | — | `hub-done` | as Dashboard |
| Grabar | `videos (owner jorge), ticks, products, thumbs` | owner `GET /s/<ownerToken>` (takes count) | `rec-ticks:<b>`, `rec-sync:<b>` | `ticks` v2 |
| Creadoras | `creators, portalApi, managerToken, thumbs` | `GET /manager/sessions`, `POST /manager/sessions/:id/extend|revoke`, `GET /manager/takes/:id/url`, `POST /manager/takes/:id/approve|redo` | — | `note` (Pedir link nuevo) |
| Revisar tomas | session takes (live), `creators[].jobs[].board` → board beats (for «Lo que dices») | ticket URL + file | — | — |
| Boards | boards v2 scene | — | `boards:lane` | `note` (Pedir a Grok) |
| Board (owner) | board v2 scene | owner session `/s`, `/upload/*` | IndexedDB `owner-uploads` | `approve` go/changes (AI) |
| Board (viewer, creator's product) | board scene from `creators[].jobs[].board` | — | — | — |
| Feed | creator-feed scene | — | `creatorFeed.avatar`, `feed-want:<b>` | `approve` want, `note` |
| Portal | portal scene + per-product blobs | `GET /s/:t`, `/upload/*` | IndexedDB `portal-uploads` | none |
| Ajustes | keyring roles, SW version | — | theme, install dismissal | — |

---

## 8. Local storage

| Store | Key / name | Content | Lifetime | Notes |
|---|---|---|---|---|
| IndexedDB `comando` v1 · `keys` | role (`root`, `feed`, `boards`, `filming`, `board:<b>`) | `{ role, b, key: CryptoKey (non-extractable) \| string (fallback), f?, type, addedAt, lastOkAt }` | until «Olvidar este teléfono» or replaced | root replace → sub-keys rebuilt from the new root keyring |
| IndexedDB `comando` v1 · `outbox` | auto id | `{ id, channel, kind, payload, coalesceKey, createdAt, notBefore, attempts, state: queued\|sending\|failed, lastError }` | until sent (+ 24 h history of sent items for the sheet) | §9 |
| IndexedDB `comando` v1 · `meta` | `settings`, `lastOk:<role>` | `{ theme, installDismissedAt, tabsWithFeed }`, `{ updatedAt, at }` | persistent | |
| IndexedDB `owner-uploads` v1 · `uploads` | `${job}:${shot}:${take}` | the same record shape as the portal: `{ uploadId, key, partSize, size, mime, parts:{n:{etag,sha}}, done, name, lastModified }` | until complete | `name`/`lastModified` added for same-file checks |
| IndexedDB `portal-uploads` v1 · `uploads` | `${job}:${shot}:${take}` | **unchanged** (it must read records written by today's portal) | until complete | compat test UPL-09 |
| localStorage | `hub-done:<b>` (3 d), `hub-picks:<b>` (7 d), `rec-ticks:<b>`, `rec-sync:<b>`, `creatorFeed.avatar` | **unchanged keys and shapes** so taps survive the migration | as today | `<b>` = root blob (hub) / filming blob |
| localStorage | `boards:lane` (reads legacy `boards:av` once), `feed-want:<b>` (7 d, fixes B-05) | new | | |
| Cache Storage (SW) | `shell-<ver>`, `scenes-v1`, `media-v1` | shell files; **ciphertext only** | §12.4 | |

**Never stored:** decrypted scenes (in memory only), decrypted media (blob URLs in memory only, revoked on screen leave), raw keys (except the D-16 hash, and the documented fallback), manager/owner tokens (they live only inside the decrypted root scene in memory, or the `#m=` value in memory for the session).

---

## 9. Outbox (Q-10)

### 9.1 Behavior
1. `outbox.enqueue({channel, kind, payload, coalesceKey})` writes to IndexedDB, updates the UI immediately (optimistic), and schedules a send.
2. **Grace delay:** taps that have a «Deshacer» toast (`approve` done/act/want, `pick`) get `notBefore = now + 4 s`. If Deshacer happens before sending, **both entries are dropped** and nothing is sent. This saves mailbox requests.
3. **Coalescing** (same `coalesceKey`, still queued): `approve:<blockId>` keeps the last; `pick:<job>` keeps the last; `want:<pid>` dedupes; `ticks` merges every mark into **one** `{kind:"ticks", v:2, set:{…}}` (newest timestamp per id wins); `note` never coalesces.
4. **Ticks rate limit** is unchanged: at most one ticks POST every 5 min, unless the user taps «Enviar ahora».
5. **Send loop** runs on enqueue, `online`, `visibilitychange` (visible and hidden, with `keepalive:true` when hidden), boot, and every 30 s while there is a queue. Backoff per entry: 5 s, 15 s, 60 s, 5 min, then every 15 min. 4xx other than 408/429 → `failed` (shown in the sheet with «Reintentar»).
6. **Requests:** exactly today's `fetch` options: `POST https://webhook.site/<uuid>`, JSON (`text/plain` for ticks), `redirect:"error"`, `referrerPolicy:"no-referrer"`, `credentials:"omit"`. `at` is added at **enqueue** time (the time of the tap), as today.
7. **Mailbox resolution at send time (D-17):** `hub` → `model.mailbox` (fallback: none). `feed` → `keyring.feed.f` → feed `#f` learned → `model.mailbox`. `board:<id>` → the board scene's `mailbox` → `model.mailbox`. If there is no mailbox → the entry stays `queued` with `lastError:"sin-buzon"`, and the sheet says «Sin buzón. Pídele a Grok el link nuevo.»
8. **Visible state:** app-bar pill «N por enviar» (warn tone) when N > 0 and the oldest is > 10 s old. Tap → Outbox sheet (PRD §8.14).

### 9.2 Payloads (unchanged; Anexo B)

| Source | Payload |
|---|---|
| ✓ / Deshacer | `{kind:"approve", blockId:<task.id>, choice:"done"|"undo", at}` |
| act («La aprobaron», «Llegó»…) | `{kind:"approve", blockId:<act.id>, choice:"done"|"undo", at}` |
| «Lo quiero» | `{kind:"approve", blockId:"want:<pid>", choice:"want", at}` |
| GO / Pedir cambios | `{kind:"approve", blockId, choice:"go"|"changes", at}` |
| Pick | `{kind:"pick", v:1, job:"ff-NNN", letter:"A"|"B"|"C"|"", at}` |
| Grabado | `{kind:"ticks", v:2, set:{"rec:<job>":[0|1, ms]}, at}` (`text/plain`) |
| Nota | `{kind:"note", text, at}`. When sent with a context, the text is prefixed `«<Producto>»: `. There's no new field. |

---

## 10. Generator and routine changes (Agent-Skills)

All changes are **additive behind a version switch** (`HUB_SCENE_VERSION`, `BOARDS_SCENE_VERSION`, `BOARD_SCENE_VERSION`, default = old until the viewer phase that reads them is live on Pages). Blob ids and keys of every existing theme are reused (the generators are idempotent). **No key rotation.**

| ID | File(s) | Change | Phase / gate |
|---|---|---|---|
| G-0 | all builders | Validate the emitted JSON against `docs/site-v2/schemas/*.json` (vendored copy) before sealing; on failure, publish nothing and alert. Add a test fixture per scene type. | with each Gx |
| G-1 | `hub-tu-dia/scripts/build_hub.py`, `hub_collect.py`, `hub_comando.py`, `picks.py`, `tracker.py` | Emit `comando` v4 (§7.2): `tasks` (dedupe rules, no verb prefixes, no placeholders, stable ids = v3 ids), `products` with `stage` ids + `due` + `now`, `videos` (from build_filming, with `owner`, `status`, `boardRef`), `ticks`, `brands.groups`, `grok` (without product-stage duplicates), `creators[].jobs[].board`, `alerts` (from footer), `keyring` read from `$CANVAS_INDEX` (themes `boards`, `feed` + its mailbox, `filming`). Drop `counters`, `quick`, `footer`, `sections`, `rec:open`. Replace «Bella» in every generated string with «Creadoras» (e.g. «video de Bella listo» → «Video de Creadoras listo»). | Phase 8a, after app Phase 3 is on Pages |
| G-2 | `build_filming.py` | Keep filming v2 for legacy links, but **exclude creator-owned jobs** (R-17). Expose the per-video record used by G-1 (`owner`, `status`, `boardRef`). Stop publishing in Phase 9. | 8a |
| G-3 | `build_boards.py` | Emit boards v2 (§7.3): `product`, `lane`, `status` id, `problem`, `kind`, `viewer`, `ref`. **Exclude system pages** (portal, manager) and never emit URLs containing `t=`/`m=` (B-07). Keep the v1 `board` URL field during the transition. | 8a |
| G-4 | `creator-feed/scripts/run_feed.py`, `creator_profile.json` | `creator_feed.avatars[bella].label = "Creadoras"`. Emit `product.line` (one deduped sales/verify line, R-14) in addition to the current fields. No other change. | 8a (can ship any time) |
| G-5 | `tiktok-shop-film-board/scripts/publish_board.py` (+ `publish_canvas.py`) | Board v2 (§7.4) with `job`, `lane`, `status`, `approvals` for AI boards. **Republish every existing FF board that lives in `index.html`** as `type:"board"` v2 **with the same blob + key** (the `index.html` shim redirects old links). `publish_canvas.py` is no longer used for FF boards (kept for ad hoc canvases). | 8b |
| G-6 | `tiktok-shop-creator-portal/scripts/portal_build.py` | Portal v2 (+ `shootDate`, `expiresAt`). Keep generating the `manager` scene during the transition (manager.html redirect → single mode) and stop in Phase 9. **New subcommand `owner ensure`** (after W-1): ensure one owner session exists (`kind:"owner"`), sync its jobs to Jorge's `pack_ready`/`filming` jobs via `POST /admin/sessions/:id/jobs`, roll its expiry to now + 14 days, and write `ownerToken` into the hub build inputs (it gets sealed into `comando` v4). Owner sessions are never listed in `portals.json`/`creators[]`. | 8c (needs W-1 deployed) |
| G-7 | `portal_pull.py` (Mac) | Also pull takes from the owner session (same job → `~/FilmFactory/jobs/<job>/03-takes/` mapping). Mark them pulled as today. | 8c |
| G-8 | mailbox ingest | **No schema change.** Confirm that `note` text with a `«…»: ` prefix is summarized like any note. | — |
| G-9 | Agent-Skills `grok-canvas/viewer/` copy (B-04) | Replace the stale copy with a README pointing to this repo (single source of truth) **or** a sync script + CI diff check. Decision: **README pointer** (no duplicated viewers). | Phase 0 |

**Routines keep their schedule:** Hub 7:00 / 10:00 / 15:00 / 20:00 ET (+ on pipeline change), Creator Feed 7:34 ET, Mac puller every 5 min, schema-limited ingest every build. G-6 `owner ensure` runs inside every hub build (cheap and idempotent).

---

## 11. Worker API changes (creator-portal-api v1.1)

Backward compatible. Existing clients (today's `portal.html`, `comando.html`, `manager.html`, the box, the Mac puller) keep working unchanged. **Deployed only by Jorge or the box** (`wrangler deploy` is never run by an agent). Tests: vitest + miniflare in the Worker repo.

| ID | Change | Detail |
|---|---|---|
| W-1a | D1 migration `0005_session_kind.sql` | `ALTER TABLE sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'creator' CHECK (kind IN ('creator','owner'));` |
| W-1b | Admin create accepts `kind` | `POST /admin/sessions {…, kind?: "creator"|"owner"}`. `owner` requires `account` = Jorge's own account and allows `expires_at` up to now + 30 days. At most **one** non-revoked owner session per account (409 otherwise). |
| W-1c | New admin endpoint | `POST /admin/sessions/:id/jobs {add?: string[], remove?: string[]}` → upserts/deletes `session_jobs` rows (`remove` is refused with 409 if the job has takes not yet pulled). Returns the session. Admin bearer only. |
| W-1d | Admin extend for owner | `POST /admin/sessions/:id/extend {days}` allows 1–30 when `kind='owner'` (stays 1–14 for creators). |
| W-1e | `GET /manager/sessions` | Adds a `kind` field per session. **Owner sessions are excluded by default**; `?include=owner` returns them. Every take object includes (adding any that are missing) `id, job_id, shot, take, status, redo_reason, uploaded_at, pulled_at, size`. |
| W-1f | Creator endpoints | **No change.** An owner token works on `GET /s/:token` and `/upload/*` exactly like a creator token (same per-shot limits, same 8 MB parts, same SHA-256 checks). |
| W-1g | Events | `events` gets `owner_upload_completed` (for future push, Q-09). `link_expiring` is never emitted for owner sessions. |
| W-1h | Security | Owner token = a random 256-bit value hashed with SHA-256 in D1 (like creator tokens). It appears only in the sealed root scene. Revocation: `POST /admin/sessions/:id/revoke`, and the box creates a new one on the next build. The manager token stays as is (`MANAGER_TOKEN_PREV` rotation). |
| W-1i | CORS | Unchanged: `ALLOWED_ORIGIN = https://jorgedearmas.github.io` (the same origin for `/grok-canvas/app/`). |

---

## 12. PWA architecture

### 12.1 Manifest — `app/manifest.webmanifest`

```json
{
  "id": "/grok-canvas/app/",
  "name": "Comando",
  "short_name": "Comando",
  "description": "Tu día, grabación, creadoras, feed y boards.",
  "lang": "es-US",
  "dir": "ltr",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F2F2F7",
  "theme_color": "#F2F2F7",
  "categories": ["productivity", "business"],
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }
  ],
  "shortcuts": [
    { "name": "Grabar", "url": "./#/grabar", "icons": [{ "src": "icons/icon-192.png", "sizes": "192x192" }] },
    { "name": "Creadoras", "url": "./#/creadoras", "icons": [{ "src": "icons/icon-192.png", "sizes": "192x192" }] },
    { "name": "Feed", "url": "./#/feed", "icons": [{ "src": "icons/icon-192.png", "sizes": "192x192" }] }
  ]
}
```
`start_url`, `scope`, `id` and `shortcuts` contain **no secrets** (QA PWA-02 asserts there is no `b=`, `k=`, `t=`, `m=` or `f=` anywhere in the manifest).

### 12.2 `app/index.html` head (PWA-relevant part)

```html
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/apple-touch-icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Comando">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#F2F2F7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<!-- iOS splash: 5 portrait sizes × light/dark (10 links), e.g. -->
<link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)" href="icons/splash-1170x2532-light.png">
```
Splash sizes (portrait, @3x unless noted): 1170×2532 (390×844), 1179×2556 (393×852), 1284×2778 (428×926), 1290×2796 (430×932), 1125×2436 (375×812). Light background `#F2F2F7`, dark `#000000`, with the app glyph centered at 30 % of the width. There is no text on the splash.

**CSP of `app/index.html`:**
`default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://cdn.jsdelivr.net; media-src 'self' blob: https://cdn.jsdelivr.net https://*.workers.dev; connect-src 'self' https://webhook.site https://cdn.jsdelivr.net https://*.workers.dev https://*.r2.cloudflarestorage.com; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'` + `<meta name="referrer" content="no-referrer">`. (`style-src 'unsafe-inline'` remains only for `style=""` attributes such as progress widths; no inline `<script>`.)

**CSP of `portal.html`:** the same without `webhook.site`, `worker-src` or `manifest-src`.

### 12.3 Icons

- **App glyph:** Lucide `clapperboard`, white, stroke 2, centered at 50 % of the canvas, on a rounded-square background with a linear gradient `#0060DF → #5E5CE6` (135°). Maskable variant: glyph at 40 % (inside the 80 % safe zone), full-bleed gradient.
- Files: `icon.svg` (source), `icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon-180.png` (no transparency, iOS adds its own mask), and 10 splash PNGs.
- Generated by `scripts/make-icons.mjs` (Playwright renders the SVG and writes the PNGs). `app/icons/ICONS.sha256` lists every PNG. `check-secrets.sh` allows `app/icons/*.png` **only** when the hash matches (D-21). CI re-runs `make-icons.mjs --check` to verify the hashes (deterministic rendering in a pinned Chromium; if the rendering drifts, regenerate in a PR).

### 12.4 Service worker — `app/sw.js`

Registered by `app.js`: `navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" })`. `registration.update()` runs on every boot and on every `visibilitychange` → visible (throttled to once per 30 min).

| Request | Match | Strategy | Cache | Limits |
|---|---|---|---|---|
| App navigation | `mode === "navigate"` within `/grok-canvas/app/` | **Cache-first** `app/index.html` (ignore search and hash); network update in the background is handled by the SW update flow, not per request | `shell-<VERSION>` | — |
| Shell assets | `app/*.js`, `app/manifest.webmanifest`, `app/icons/*`, `lib/**/*.js`, `lib/ui.css` | **Precache** at install (list embedded in `sw.js` with `?v=<VERSION>`); cache-first | `shell-<VERSION>` | old shell caches deleted on `activate` |
| Scenes | same-origin `/grok-canvas/scenes/<id>.json` (any query) | **Network-first, 4 s timeout → cache**; the cache key strips the query; only `200` responses whose JSON has exactly `iv` and `ct` string keys are stored | `scenes-v1` | max 80 entries, LRU |
| Encrypted media | same-origin `/grok-canvas/media/m<16hex>.enc` or `https://cdn.jsdelivr.net/**/media/m<16hex>.enc` | **Cache-first** (names are content-addressed and immutable) | `media-v1` | max 200 MB (estimated from `content-length`), LRU; entries > 60 MB are not cached (very large reference videos) |
| Worker API, R2, webhook.site, take preview URLs | `*.workers.dev`, `*.r2.cloudflarestorage.com`, `webhook.site` | **Network-only** — never cached, never logged | — | — |
| Anything else | — | pass-through | — | — |

Invariants (QA PWA-07/08): the SW never reads, stores or logs request bodies or `Authorization` headers. It never caches decrypted content (it can't, because decryption happens in the page). Cached scene responses contain only `{iv, ct}`. The SW never sees a URL fragment (fragments are not sent in requests).

### 12.5 Offline shell and offline behavior per screen

| Screen | Offline behavior |
|---|---|
| Boot | Shell from cache. Keys from IndexedDB. Root scene from cache → render + banner «Sin conexión · datos de hace 2 h». No cached scene → «Sin conexión. Conéctate para abrir por primera vez.» |
| Dashboard / Grabar | Fully usable. Taps go to the outbox (pill «N por enviar»). |
| Creadoras | Cached scene data (names, dates, products, «Copiar link»). Worker-backed actions (Extender, Revocar, Aprobar, Re-grabar, previews) are **not queued**. Their buttons stay visible but show the toast «Necesitas conexión» on tap, and the banner says «Sin conexión: no se pueden revisar tomas». |
| Feed | Cached scene + cached covers. Previews that aren't cached show the cover with «Sin conexión». «Lo quiero» is queued. |
| Boards / Board | Cached scenes and frames work. The reference video plays if cached. Upload: «Subir video» shows «Necesitas conexión para subir». An interrupted upload resumes later with «Reanudar». |
| Portal (creator) | Not a PWA; no offline shell (browser behavior). |

### 12.6 Update flow

1. A new `sw.js` (with a new `VERSION`) installs and precaches, then waits.
2. The app gets `registration.waiting` (or `updatefound` → `installed`) and shows a **banner** at the top: «Hay una versión nueva» [**Actualizar**].
3. Tap → `postMessage({type:"SKIP_WAITING"})` → `controllerchange` → `location.reload()` (route preserved; keys are not in the URL).
4. **Never auto-reload** while an upload is in progress, a sheet with a text input is open, or the outbox is sending. The banner waits.
5. **Kill switch** (in the runbook): replace `sw.js` with a version that calls `self.registration.unregister()` and deletes all caches on `activate`, then reloads clients. It's documented in IMPLEMENTATION-PLAN §6.
6. `VERSION` = semver + short git sha, and Ajustes shows «Versión 2.0.0 (abc1234)».

### 12.7 Install guidance

| Platform | Detection | UI |
|---|---|---|
| iOS Safari (not standalone) | `/iPhone|iPad/` (+ iPadOS desktop UA with touch), `navigator.standalone === false` | A Dashboard banner «Instala Comando en tu iPhone» [Ver cómo] [✕] → install sheet with 3 illustrated steps (PRD §8.16). After install: «Abre Comando desde tu pantalla de inicio y pega tu link.» plus a **Copiar link para la app** button, available only in the same session where the key was just imported (the raw link is held in memory, never stored). |
| iOS other browsers (Chrome/Edge on iOS 16.4+) | iOS + not Safari | The same sheet, with the share icon location adjusted («Toca ⋯ o Compartir»). |
| Android Chrome/Edge | `beforeinstallprompt` | Banner «Instala Comando» [Instalar] → `prompt()`. Hidden after `appinstalled`. |
| Desktop | `beforeinstallprompt` | Ajustes › «Instalar en esta computadora» only (no banner). |
| Already installed | `matchMedia("(display-mode: standalone)")` or `navigator.standalone` | No banner. Ajustes shows «Instalada ✓». |

### 12.8 iOS-specific constraints the implementation must respect

- Standalone storage (IndexedDB, localStorage, Cache Storage) is **separate** from Safari, hence the paste onboarding.
- Installed web apps are **exempt from the 7-day script-writable storage cap**. Safari tabs are not, which is fine because the old links still carry the key.
- There is no `beforeinstallprompt` and no native pull-to-refresh in standalone, so we provide our own.
- Screen Wake Lock: feature-detect `navigator.wakeLock` (Safari 16.4+). Uploads still require the app to stay in the foreground; the banner says so.
- `navigator.clipboard.readText()` must be called inside the tap handler. iOS shows its «Pegar» callout, which is expected.

### 12.9 Push (future, Q-09)

Not shipped. Design: Worker v1.2 adds `POST /manager/push/subscribe` (VAPID public key in the root scene), and a cron reads `events` (`link_expiring`, `owner_upload_completed`, takes uploaded) and sends Web Push to the installed app (iOS 16.4+ standalone only). The SW would add `push`/`notificationclick` handlers that open `#/creadoras` or `#/dashboard`. Notification payloads must not contain names or product titles (they're visible on the lock screen); use generic copy («Hay tomas nuevas para revisar»).

---

## 13. Key bootstrap and storage (detail of Q-01)

### 13.1 Import algorithm (`keyring.importFromHash`)
1. Parse the hash: `b` must match `^[A-Za-z0-9_-]{8,64}$`, and `k` must decode from base64url to 32 bytes; `f` must be a UUID, and `m`, `t` must be opaque `^[A-Za-z0-9_-]{16,256}$`. Anything else → «link incompleto».
2. Fetch `../scenes/<b>.json` (`cache:"no-store"`), and decrypt with `importKey(raw, extractable=true)` used **only for this one-shot decrypt**. Read `type`.
3. If the type is root (`hub`/`comando`): re-import the key as **non-extractable**, `put` `{role:"root", b, key}`, then for every `keyring` entry import non-extractable and `put` (`feed` also stores `f`). Delete old sub-roles that aren't in the new keyring.
4. Sub-scene types follow §4.3.
5. On success: `history.replaceState(null, "", location.pathname + "#/<route>")`. Zero the local string variables that held `k` (best effort) except `pendingInstallLink`, held in memory only for the iOS install sheet in this session.
6. If `indexedDB.put` of a `CryptoKey` throws (old engine) → store the base64url string and set `meta.settings.keyMode = "raw"`.

### 13.2 Paste onboarding (`#/bienvenida`)
- Accepted input: a full URL on `https://jorgedearmas.github.io/grok-canvas/` whose path is one of `comando.html`, `hub.html`, `app/`, `app/index.html`, with a hash holding `b` and `k`. Surrounding text (as in a WhatsApp message) is tolerated: the input is scanned with a URL regex and the first match on that host is used.
- Non-root links pasted (feed, boards, board, grabación) → «Ese link es de una sola página. Pega el link del Comando.» (Opening them from WhatsApp still works through the redirectors.)
- Creator links (`portal.html`, or `t=` present) → «Ese es un link de creadora. Pega el link del Comando.»

### 13.3 Using keys
- `keyring.decryptScene(role | b)` → loads the `CryptoKey` and decrypts. Media decryption uses the **key of the scene that referenced the media** (as today: the same key as its theme).
- Creator portal links in `creators[].link` and legacy board URLs are **data**: they're displayed or copied only on explicit tap, never logged and never cached in plaintext.

### 13.4 Forget this phone
Confirm dialog → delete the IndexedDB `comando` and `owner-uploads` databases (it warns first if an upload is in progress or the outbox isn't empty: «Hay 2 toques sin enviar. Si olvidas el teléfono se pierden.»), delete Cache Storage `scenes-v1` and `media-v1`, remove the localStorage keys listed in §8, and go to `#/bienvenida`. The shell cache is kept.

### 13.5 Root key changed (rotation)
If the stored root key fails to decrypt the current root blob, or the blob is gone (404), show the «Tu link cambió» state: «Pega el link nuevo del Comando.» [Pegar link]. Old cached data stays visible underneath, read-only, until a new link is imported.

### 13.6 Extension: Face ID lock (not in v2)
WebAuthn passkey with the PRF extension (Safari 18+, Chrome 116+): derive a wrapping key from PRF output → AES-KW-wrap the stored keys → unwrap on app open after Face ID. It would ship as an opt-in in Ajustes, with fallback to «pega tu link». It's documented so the keyring format reserves `{wrapped: true, alg: "AES-KW", credId}` fields.

---

## 14. Security model

### 14.1 Assets
Scene keys (root, feed, boards, filming, board), creator session tokens (`t`, inside portal links in the root scene), the manager token, the owner token, mailbox UUIDs, plaintext business data (products, brands, creators, deals), and creator-uploaded takes.

### 14.2 Invariants (each has a QA test)

| # | Invariant | Enforced by | QA |
|---|---|---|---|
| S-1 | Keys never go in a request (URL, header, body), the manifest, `start_url`, a log, git, or Cache Storage | hash-only transport; strip after import; SW network-only for the API; no analytics | SEC-01, SEC-02, PWA-02, PWA-08 |
| S-2 | Scenes and media in git and in caches are ciphertext | generators seal; SW stores only `{iv,ct}` and `.enc` | SEC-03, PWA-07 |
| S-3 | The creator sees only her session | portal scene filtered by `portal_build.py`; portal imports no app modules; the Worker scopes by token | SEC-05, SEC-06, SEC-07, POR-* |
| S-4 | The manager and owner tokens never reach a creator | they're sealed only in the root scene (Jorge's key); the portal scene schema forbids them; portal links never contain `m=` | SEC-06 |
| S-5 | Only allowlisted hosts | CSP per page; tests abort any other host | SEC-04 |
| S-6 | Every scene string is escaped; URLs validated per field | `html.js`, `core.js` validators (https only; host allowlists per field: TikTok `www.tiktok.com`/`shop.tiktok.com`, Gmail `mail.google.com`, boards same-origin `/grok-canvas/`, API `*.workers.dev`, media `media/m<16hex>.enc`) | SEC-08 hostile fixture |
| S-7 | Mailbox data is untrusted; the viewer adds no new effects | payloads unchanged (§9.2) | OUT-* payload equality |
| S-8 | No secrets in the repo | `check-secrets.sh` (+ icon allowlist); no real names in fixtures | SEC-09 |

### 14.3 Threat-model change introduced by the keyring

| Threat | Before (link only) | After (keyring) | Mitigation |
|---|---|---|---|
| Someone with the **unlocked phone** opens the app | They could open the link from WhatsApp, Notes or history | They can open the app | Same exposure. The device passcode/Face ID is the boundary. «Olvidar este teléfono» exists. Face ID lock is a designed extension (§13.6). |
| **Lost phone** | The link is in WhatsApp and history | Plus the keys in IndexedDB | Runbook (IMPLEMENTATION-PLAN §6.3): Grok rotates the root key (new blob + key; the old ciphertext stays in git history, as today), rotates the manager token (`MANAGER_TOKEN_PREV`), revokes the owner session, and rotates the mailbox. Jorge pastes the new link. |
| **Same-origin script** (another Pages site under `jorgedearmas.github.io`, or XSS) | It could read localStorage taps; could read `location.hash` only on our pages | It could *use* the stored `CryptoKey`s to decrypt (but not export them) | J-3 (no other Pages sites). XSS: `script-src 'self'` without `'unsafe-inline'` in the app, `html.js` escaping, hostile-data tests. Non-extractable keys stop offline exfiltration. |
| **Key in browser history / screenshots / home-screen bookmark** | Always present after opening a link | Removed by `replaceState` after import | Strip after persist (D-16). |
| **Malicious SW / stale SW** | n/a | A broken SW could pin a bad shell | `updateViaCache:"none"`, an update check on every open, the kill switch (§12.6). |
| **Service-worker scope reaching creators** | n/a | none | SW scope `/grok-canvas/app/` only; creators never load `app/`. |

### 14.4 What did not change
GitHub Pages public repo; AES-GCM sealing; the key only in the `#hash` for every shared link; the creator token only in her link; the manager token sealed in the root scene; untrusted mailbox data; no third parties (githack removed everywhere).

---

## 15. Performance budgets

| Metric | Budget (390×844, Fast 4G, mid iPhone) | How |
|---|---|---|
| First useful paint (Dashboard with data), warm (SW + cache) | < 1.0 s | cached shell + cached scene decrypt, render, then network refresh |
| First useful paint, cold (first visit) | < 2.0 s | shell ≤ 120 KB gzipped total JS+CSS; root scene ≤ 600 KB ciphertext (thumbs ≤ 60 KB each, ≤ 30 thumbs) |
| Tab switch | < 100 ms | in-memory model |
| Board open (cached) | < 500 ms to scenes visible; frames load lazily via IntersectionObserver | |
| Media | reference video and previews only on tap/visible; at most 3 concurrent media decrypts; blob URLs revoked on screen leave (feed keeps a ±1 window, as today) | |
| Main thread | decrypt with `crypto.subtle` (async); scenes > 1 MB parsed after first paint | |

---

## 16. Rollout order and compatibility

```
Phase 0  housekeeping (tests in CI incl. feed + WebKit, githack removal, fixture names, README)    viewers only
Phase 1  lib/ foundation + test harness                                                            no user-visible change
Phase 2  app/ shell + keyring + Dashboard (reads hub v3 AND v4)                                    new URL, old pages untouched
Phase 3  Grabar + Creadoras + review                                                               ─┐ Jorge can already use app/
Phase 4  shared board.js + Board screen + Boards library + portal.html rebuilt (v1-compatible)     ─┤ portal deploy outside a shoot window
Phase 5  Feed screen                                                                               ─┤
Phase 6  PWA (manifest, icons, SW, offline, update, install, Ajustes)                              ─┘
Phase 7  redirectors (old pages → app/) + index.html board shim                                    old links now land in v2
Phase 8a generators: comando v4, boards v2, filming owner filter, feed label                       app already reads v4
Phase 8b generators: board v2 + FF board migration (same blob+key)                                 shim already live
Phase 8c Worker v1.1 (Jorge deploys) + owner ensure + puller                                       app already supports ownerToken
Phase 9  cleanup: stop filming/manager scenes, delete v3 adapter only after 14 days of v4, final QA on Pages
```

**Invariant across all phases:** at any commit on `main`, every link Jorge or a creator holds opens something correct. Viewers ship **before** the scene versions they read. Redirectors ship only after the target screen is at parity (the QA parity checklist).
