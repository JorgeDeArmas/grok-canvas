# Site v2 — QA plan

Companion to [ARCHITECTURE.md](ARCHITECTURE.md) and [PRD.md](PRD.md). Every test ID referenced in those documents is defined here. **Definition of done = 100 % of the automated suite passes on every listed project, every manual check in §12 is ticked, and no test is skipped except the platform exclusions listed in §3.2.**

Conventions:
- «Given/When/Then» is compressed into one line per criterion: *state → action → expected*.
- Copy in «» must match `lib/copy.js` exactly (tests import the dictionary, they don't duplicate strings).
- **P** = projects the test runs on (§3.1): `W` = phone WebKit light + dark, `C` = phone Chromium light, `D` = desktop Chromium, `PWA` = the Chromium PWA project, `S` = static (Node only, no browser), `M` = manual on a real device.
- Fixed clock: **Thursday 8 Oct 2026, 9:00 a. m. America/New_York** (`page.clock.install`), unless a test says otherwise.

---

## 1. Scope

| In scope | Out of scope (tested elsewhere or not shipped) |
|---|---|
| `app/` (Dashboard, Grabar, Creadoras, Review, Boards, Board, Feed, Ajustes, Bienvenida, sheets, outbox, PWA) | Push notifications (Q-09, not shipped) |
| `portal.html` (creator) on shared `lib/` | Face ID lock (§13.6 extension) |
| Redirectors (`comando`, `hub`, `grabacion`, `boards`, `feed`, `manager`, `board`), `index.html` shim, `preview.html` | Visual redesign of `index.html` canvas blocks |
| Data contracts (JSON Schemas) and viewer adapters (hub v3, filming v2, boards v1, board v1, portal v1, manager v1) | Real Worker deploy (Jorge or the box runs it; §10 lists the Worker repo tests) |
| Worker API usage (mocked, contract-exact) | Mailbox ingest internals (payloads are byte-identical, §6.8) |
| Generator outputs (tested in Agent-Skills, §11) | |

---

## 2. Test infrastructure

### 2.1 Tooling
- **`@playwright/test`** (devDependency, D-22) with `playwright.config.mjs` defining the projects in §3.1. `retries: 0` in CI: a flaky test is a failing test. `fullyParallel: true`, `workers: 4`.
- **`axe-core`** (devDependency). Injected with `page.evaluate(axeSource)` in a context created with `bypassCSP: true` **only for the a11y suite**, so the production CSP stays untouched elsewhere.
- **Node test runner** (`node --test`) for static suites (`S`): schema validation (`ajv` 2020 as a devDependency), import-graph checks, manifest checks, copy scans, secret scan.
- Browsers in CI: `npx playwright install chromium webkit --with-deps`.
- The existing `tests/run-*.mjs` keep running until the page they cover becomes a redirector (Phase 7). They are then deleted in the same commit that adds the redirector, and their assertions are covered by the v2 specs listed in §5 (the traceability table in PRD §10 maps each one).

### 2.2 Files
```
playwright.config.mjs
tests/
  v2/
    helpers/
      seal.mjs          AES-GCM seal of a fixture with a random 32-byte key → { blob, keyText, hashLink() }
      site.mjs          context.route("https://jorgedearmas.github.io/grok-canvas/**") → files from the repo;
                        sealed fixtures served at /scenes/<blob>.json and /media/<id>.enc
      net-guard.mjs     aborts and FAILS the test on any request to a host outside the allowlist (SEC-04);
                        records every request (URL, headers, body) for SEC-01
      worker-mock.mjs   stateful in-memory creator-portal-api v1.1 (sessions, jobs, takes, uploads, owner kind)
      r2-mock.mjs       presigned PUT endpoint: returns ETag, can fail/abort part N on demand
      mailbox-mock.mjs  webhook.site/<uuid> recorder: returns 200, or 500/429/offline on demand
      clock.mjs         fixed ET clock + helpers (advance 60 s, 5 min, 4 s grace)
      a11y.mjs          axe run + contrast sampler + 44 px target sampler
      fixtures.mjs      builders for every fixture in §2.3 (synthetic data only)
    *.spec.mjs          one spec per area (§5)
  static/
    *.test.mjs          S-suites
  fixtures/v2/*.json    unsealed synthetic fixtures (committed; no keys, no real names)
```

### 2.3 Fixture catalogue (synthetic only)
All names are invented: creators **Ana** and **Eva**, handles `@demo.creator` and `@otra.cuenta`, products «Producto A»…«Producto J», brands «Marca X», «Marca Y». Thumbs are a valid 1×1 JPEG data URL. No amounts other than obviously fake prices («$35.00»). Fixtures are validated against the schemas before every run (a fixture that violates its schema fails the suite, except the deliberately invalid ones marked ✗).

| ID | Type / version | Purpose |
|---|---|---|
| `root-v3` | `hub` v3 (today's shape: `sections`, `quick`, `counters`, `footer`, a `creadoras` section, `rec:open`) | adapter tests and migration (§7) |
| `root-v4` | `comando` v4 | Full: 6 tasks of every kind, 9 products (one overdue, one undated, one dropped), 5 videos for Jorge (one overdue day, two places on one day, one not ready), 1 creator-owned video, brand groups (7 waiting, 2 closed), 4 grok items (one duplicates a product stage ✗ in the generator, the viewer must drop it), 1 alert, `keyring` (boards, feed + `f`, filming), `managerToken`, no `ownerToken` |
| `root-v4-owner` | `root-v4` + `ownerToken` | owner upload |
| `root-v4-nomgr` | `root-v4` without `managerToken` | read-only Creadoras |
| `root-v4-empty` | no tasks, products, videos, creators, brands, grok, alerts | empty states |
| `root-v4-bella` | `root-v4` where scene labels and texts say «Bella» (lane labels, task meta «video de Bella listo») | HR-10 viewer override |
| `root-v4-placeholder` ✗ | tasks/videos titled «Producto», «Video», «» | R-20 drop |
| `root-v4-hostile` ✗ | `<img onerror>`, `javascript:` and `data:text/html` URLs, off-allowlist hosts in every URL field, 10 000-char strings, RTL override chars | SEC-08 |
| `filming-v2` | today's filming scene | single-scene Grabar, legacy link |
| `boards-v1` | today's boards scene (avatar, kind labels, 9 status texts, a portal and a manager entry ✗) | adapter + B-07 |
| `boards-v2` | 16 boards: every status, an AI board, a `guide`, a `missing` one, a `canvas` viewer one | Boards library |
| `board-v1` | today's board scene | compat |
| `board-v2` | 6 beats (one without `vo`, one without `do_es`), `refSrc`, `shots` with 1–2 takes, `job` | Board template |
| `board-v2-ai` | `approvals[]` (one image, one video) | «Aprobar» |
| `portal-v1` | today's portal scene for «Ana» (2 products, per-product blobs) | active session compat |
| `portal-v2` | v1 + `shootDate`, `expiresAt` | PLP meta line |
| `portal-v2-forbidden` ✗ | v2 + `managerToken`, `ownerToken`, `keyring`, `editor_brief`, another creator's product | SEC-05/06 (viewer must ignore) |
| `manager-v1` | today's manager scene | `manager.html#…&m=…` redirect |
| `creator-feed` | today's `tests/fixtures/creator-feed.json` (synthetic) with both lanes, an empty lane reason, an unidentified product, a video with repeated sales numbers | Feed |
| `canvas-blocks` | a generic `index.html` scene (blocks, GO/changes) | IDX |

**Optional local QA with real data** (never in CI, never committed): as today, `SCENE_FILE=/path/outside/repo/scene.json npx playwright test --grep @real` seals a decrypted scene from outside the repo at test time and runs the render-only specs tagged `@real`. Screenshots from these runs go to a local folder outside the repo and are never attached to a PR.

Media fixtures: a 2-second synthetic MP4 (generated at test time with `ffmpeg` if available, else a checked-in 30 KB synthetic clip encrypted at test time) and synthetic JPEG frames, sealed with the scene key. **Nothing from `assets/private/` is ever used.**

### 2.4 Worker mock behavior (contract-exact, ARCHITECTURE §11)
- `GET /s/:token` → the session for that token (creator or owner), 403 when revoked/expired.
- `POST /upload/init|sign|complete|abort` with the exact request and response shapes of v1; Bearer token required; parts default 8 MiB (tests override `partSize` to 1 MiB via the init response to keep files small).
- `GET /manager/sessions` → excludes `kind:"owner"` unless `?include=owner`; `POST /manager/sessions/:id/extend|revoke`, `GET /manager/takes/:id/url` (returns `https://creator-portal-api.example.workers.dev/manager/takes/<id>/file?ticket=…`), `POST /manager/takes/:id/approve|redo`.
- Failure switches per endpoint: `403`, `404`, `409`, `500`, network abort, delay.
- It records every request so tests can assert headers (Bearer only to `*.workers.dev`), bodies and order.

### 2.5 Determinism
- Fixed clock (above); `Math.random` is not stubbed (keys are random, tests never compare ciphertext).
- Animations: tests run with `reducedMotion: "reduce"` except the motion tests (A11Y-06 runs both).
- Screenshots for review go to `$SHOTS_DIR` (default `/opt/cursor/artifacts/screenshots`), **never into the repo**.

---

## 3. Test matrix

### 3.1 Projects

| Project | Engine | Viewport | DPR | Color scheme | UA / flags | Runs |
|---|---|---|---|---|---|---|
| `phone-webkit-light` | WebKit | 390×844 | 3 | light | iPhone iOS 17 Safari UA, `isMobile`, `hasTouch` | all functional specs, a11y, visual states |
| `phone-webkit-dark` | WebKit | 390×844 | 3 | dark | same | all functional specs, a11y, visual states |
| `phone-chromium-light` | Chromium | 390×844 | 3 | light | Android Chrome UA (Pixel 7), `isMobile`, `hasTouch` | all functional specs (catches engine differences), install prompt |
| `pwa-chromium` | Chromium | 390×844 | 3 | light | `serviceWorkers: "allow"`, Android UA | PWA suite (§8) only |
| `desktop-chromium` | Chromium | 1280×800 | 1 | light, plus a dark pass of DSK-01 | desktop UA | desktop sanity (DSK-01, NAV-05, keyboard A11Y-04) |

DSK-02 runs inside `phone-chromium-light` with a per-test viewport override of 360×740.
| `static` | Node | — | — | — | — | S-suites |

### 3.2 Platform exclusions (the only allowed skips)

| Test | Excluded on | Why | Covered by |
|---|---|---|---|
| PWA-03…10 | WebKit projects | Playwright WebKit does not run service workers reliably | `pwa-chromium` + manual M-01…M-08 on an iPhone |
| PWA-11 (`beforeinstallprompt`) | WebKit | the event doesn't exist on iOS | iOS banner variant tested on WebKit |
| UPL-07 wake lock assertion | WebKit | `navigator.wakeLock` not exposed in Playwright WebKit | stubbed `navigator.wakeLock` on Chromium; M-10 |
| ONB-02 real clipboard read | all | headless clipboard permissions differ | `navigator.clipboard.readText` stubbed; M-03 |

### 3.3 Suites × projects

| Spec | W light | W dark | C | PWA | D | S |
|---|---|---|---|---|---|---|
| `nav.spec` (NAV, DSK, THM) | ✓ | ✓ | ✓ | | ✓ | |
| `onboarding.spec` (ONB) | ✓ | ✓ | ✓ | | | |
| `dashboard.spec` (DSH, PRD, SCR, MAIL, MAR) | ✓ | ✓ | ✓ | | | |
| `grabar.spec` (GRB) | ✓ | ✓ | ✓ | | | |
| `creadoras.spec` (CRE, REV) | ✓ | ✓ | ✓ | | | |
| `boards.spec` (BRD) | ✓ | ✓ | ✓ | | | |
| `board.spec` (BRD-T, APR, UPL owner) | ✓ | ✓ | ✓ | | | |
| `portal.spec` (POR, UPL creator) | ✓ | ✓ | ✓ | | | |
| `feed.spec` (FED) | ✓ | ✓ | ✓ | | | |
| `outbox.spec` (OUT, NOTE, TST) | ✓ | | ✓ | | | |
| `global.spec` (REF, ERR, DAT, VOC, ICO, AJU) | ✓ | ✓ | ✓ | | | |
| `links.spec` (LNK, MIG, IDX, PRV) | ✓ | | ✓ | | | |
| `security.spec` (SEC-01…04, 06, 08, 10) | ✓ | | ✓ | | | |
| `pwa.spec` (PWA) | | | | ✓ | | |
| `a11y.spec` (A11Y) | ✓ | ✓ | | | ✓ (A11Y-04) | |
| `perf.spec` (PERF) | | | ✓ | ✓ | | |
| `static/*.test` (SCH, SEC-05/07/09, PWA-01/02/12, VOC-05, ICO-01 scan) | | | | | | ✓ |

---

## 4. Hard-requirement coverage (REQUIREMENTS HR-01…HR-13)

| HR | Requirement (short) | Tests that prove it |
|---|---|---|
| HR-01 | Dashboard is the default tab | DSH-01, NAV-01, LNK-01 |
| HR-02 | Tab order Dashboard · Grabar · Creadoras | NAV-01 |
| HR-03 | Boards page organized, no redundant info | BRD-05…08, BRD-10 |
| HR-04 | «Lo que dices» is the most visible element; «Qué haces» secondary | BRD-T-02, REV-05 |
| HR-05 | One shared board template | BRD-T-07, SEC-07 |
| HR-06 | «Subir video» is a filled primary button | UPL-01 |
| HR-07 | Modern UI, consistent icons, no emoji | ICO-01, THM-01, A11Y-02 |
| HR-08 | Phone-first 390×844 | every W/C project, DSK-02 (360 px), A11Y-03, A11Y-05 |
| HR-09 | Spanish, plain, minimal text | VOC-05, DAT-04 |
| HR-10 | «Bella» → «Creadoras» everywhere | VOC-05, BRD-02, FED-02, GEN-03 |
| HR-11 | Installable PWA with all features (Feed included) | PWA-01…13, NAV-05, M-01…M-08 |
| HR-12 | Privacy model preserved | SEC-01…10, PWA-02, PWA-07, PWA-08 |
| HR-13 | Existing links and the active creator session keep working | LNK-01…10, MIG-01…06, POR-*, UPL-09 |

---

## 5. Acceptance criteria per feature

### 5.1 Navigation, theme, desktop (NAV, THM, DSK)

| ID | Criterion | P |
|---|---|---|
| NAV-01 | Root key imported → app shows a bottom `<nav>` with exactly 3 items, in order «Dashboard» (`layout-dashboard`), «Grabar» (`video`), «Creadoras» (`users`); «Dashboard» has `aria-current="page"`. With `tabsWithFeed=true` in `meta.settings` a 4th «Feed» item appears last (flag test). No item is labeled «Más» or «Bella». | W C D |
| NAV-02 | Scroll Dashboard 600 px → switch to Grabar → back to Dashboard → scroll position restored. Tap the selected tab → scrolls to top. Tab switch completes in < 100 ms (no network request). | W C |
| NAV-03 | No counter tiles anywhere. Tab badges: Grabar shows the count of `to_film` videos for today + overdue; Creadoras shows the count of `uploaded` takes; badge hidden at 0; the badge number is part of the tab's accessible name («Grabar, 3 pendientes»). | W C |
| NAV-04 | No section header on Dashboard, Grabar, Creadoras or Boards contains a count, except the Segmented controls and the group rows in Marcas (DOM scan of `h2/h3` text for digits). | W |
| NAV-05 | From each tab, the test reaches Feed, Boards, a Board and Ajustes in ≤ 2 taps (ARCHITECTURE §3.2 rule 7). Push screens hide the tab bar; «‹» returns to the previous route; with no in-app history «‹» goes to the documented back target. Android back (history back) closes an open sheet before leaving the screen. | W C D |
| THM-01 | Light and dark projects: `:root` tokens resolve to PRD §3.1 values (sample `--bg`, `--surface`, `--text`, `--accent`). Ajustes › Tema «Oscuro» on a light system → dark tokens, persisted across reload; «Automático» follows `prefers-color-scheme` live. Feed background is dark in both themes. `theme-color` meta matches the theme. | W C |
| DSK-01 | At 1280×800 (light and dark): content is a single centered column of max-width 600 px, no horizontal scroll, the tab bar is centered under the column, sheets are centered dialogs ≤ 600 px, Feed cards are centered 9:16 with letterboxing. | D |
| DSK-02 | At 360×740 (smallest supported phone): every screen in §14 has no horizontal scroll, no overlapping controls, and the two Atajos tiles and the VideoCard buttons still fit side by side (or wrap without clipping). | C |

### 5.2 Onboarding and keyring (ONB)

| ID | Criterion | P |
|---|---|---|
| ONB-01 | Empty keyring, open `app/` → `#/bienvenida` with title «Comando», button «Pegar link», textarea, hint «El link se guarda solo en este teléfono.» No tab bar. | W C |
| ONB-02 | Stub `clipboard.readText` → a root link with surrounding WhatsApp text → tap «Pegar link» → button busy «Abriendo…» → Dashboard. `keys` store holds `root`, `boards`, `feed` (with `f`) and `filming` as `CryptoKey` objects with `extractable === false`. | W C |
| ONB-03 | Clipboard rejected → textarea focused + hint «Mantén presionado aquí y toca Pegar.» Typing a link → «Abrir» appears → import works. | W C |
| ONB-04 | Inline errors (role `alert`) with exact copy for: text without URL, a boards link, a portal link (and any link with `t=`), a wrong key (decrypt fails), offline. | W C |
| ONB-05 | After any successful import (paste or opening a root link), `location.hash` contains no `b=`, `k=`, `f=`, `m=`, `t=` (`history.replaceState`), and reloading lands on the same route without the key. | W C |
| ONB-06 | Pasting the same link twice → no duplicate keys, lands on Dashboard. Pasting a **new** root link (rotation) → root replaced, sub-keys rebuilt from the new keyring, old sub-roles that aren't in it are deleted. | W C |
| ONB-07 | IndexedDB `put` of a `CryptoKey` throws (stubbed) → raw base64url stored, `keyMode:"raw"`, Ajustes shows «modo simple». | C |
| ONB-08 | Stored root key no longer decrypts the root blob (blob re-sealed with another key) → «Tu link cambió» banner + «Pegar link»; stale cached content stays visible read-only (action buttons hidden). 404 on the root blob → same state. | W C |

### 5.3 Dashboard (DSH), products (PRD), scripts (SCR), mail (MAIL), brands (MAR)

| ID | Criterion | P |
|---|---|---|
| DSH-01 | Cold start (`app/` with an empty hash or a tab route, keyring present) → `#/dashboard` selected, in both browser and standalone (`display-mode: standalone` emulated). A deep link `#/board/<id>` or `#/grabar` opens that route instead. | W C |
| DSH-02 | App bar: large title «Dashboard» + status line «Actualizado hace 5 min» (from `updatedAt`, relative, updates every minute). No date-in-title, no «act.». Tapping the status line refreshes («Actualizando…»). Actions «Nota» and Ajustes are present with accessible names. | W C |
| DSH-03 | Hero chooses by the PRD §8.2.3 algorithm. One fixture per case 1–5 (today's/overdue filming; uploaded takes; session expiring today; `tasks[0]`; nothing). Case 4: `tasks[0]` is **not** rendered in «Por hacer». Marking the hero task done → the next task becomes the hero with a crossfade; no task is ever shown twice. Hero case 3 «Extender 3 días» posts `extend {days:3}` and shows `toast.extended` with the new date. | W C |
| DSH-04 | Atajos: two tiles «Feed» and «Boards» with subs per PRD §8.2.4 («{n} videos hoy», «{n} con problema» in bad ink, else «{n} boards»; «Cargando…» while prefetching; «Toca para abrir» after a failed prefetch, tap retries). Feed key missing → sub «Ábrelo una vez desde su link» and a toast on tap. Taps open `#/feed` and `#/boards`. | W C |
| DSH-05 | «Por hacer» lists `tasks` minus the hero, minus locally done, in scene order, with no group headers, max 12 + «Ver {n} más» inline. Each row has exactly **one** trailing control (count the buttons per row = 1). Leading = thumb or kind icon tile in the kind tone. No «Grabar ·» or filming tasks appear (they live in Grabar). | W C |
| DSH-06 | Tap «Publicado» on a `done` task → row removal animation → toast «Listo» + «Deshacer» → after 4 s the mailbox receives exactly `{kind:"approve", blockId:<task.id>, choice:"done", at}`; `hub-done:<b>` holds the id. «Deshacer» within 4 s → row back, **zero** requests. «Deshacer» after the send → a second request `choice:"undo"`. Reload within 3 days → the task stays hidden even if the scene still has it. | W C |
| DSH-07 | Tap an `act` («La aprobaron») → the task row disappears, the product row in «Productos» **keeps** its chip; the payload uses `blockId = act.id`. The same act exists only once (the v3 fixture with the act on the product item and on a task → one row). | W C |
| DSH-08 | For every product row, the meta text is not equal to (and does not contain) its chip label; for every task row, the meta doesn't repeat the action label (DOM comparison over all rows, R-05). | W |
| DSH-09 | Tapping a task row body (not the button) opens the Task detail sheet when the task has `detail`, `mail` or `product`: header, facts (max 8), primary action + secondary «done» stacked, «Ver producto» when linked. Otherwise the row body performs the action. | W C |
| DSH-10 | «Productos»: excludes `dropped`; groups «ATRASADO» (bad), «ESTA SEMANA»/date headers, «SIN FECHA» in that order; max 6 rows then «Ver todos ({n})». Empty → EmptyState «Ningún producto elegido» + «Abrir feed». | W C |
| DSH-11 | «Grok trabaja en»: max 3 rows + «Ver {n} más»; the grok item that duplicates a product stage is not shown; hidden when empty; rows without `detail` are not focusable. | W |
| DSH-12 | «Avisos» renders `alerts` only on Dashboard (absent from Grabar, Creadoras, Boards, Board, Feed). | W |
| DSH-13 | `root-v3` with a `creadoras` section → Dashboard shows no creator list; creator data appears only in the Creadoras tab. | W C |
| DSH-14 | `root-v4-placeholder`: tasks/videos titled «Producto», «Video», «item» or empty are not rendered anywhere (Dashboard, Grabar, product sheet). | W |
| PRD-01 | Tap a product row → Product sheet, URL `#/producto/<pid>`; back closes it and restores the Dashboard scroll. Opening `#/producto/<pid>` directly (deep link) shows the sheet over Dashboard. Unknown pid → Dashboard + no error. | W C |
| PRD-02 | Header: thumb, name, StatusChip(stage) + lane chip (labels from `LANES`: «Miami X» / «Creadoras»), then «Ahora: {now}». | W C |
| PRD-03 | When the product has an open task, the sheet shows that action as primary lg; tapping it behaves exactly like the task row (same payload) and removes the task from «Por hacer». No other action buttons. | W C |
| PRD-04 | Stepper: steps Muestra · Guion · Board · Grabar · Editar · Publicar; the current step matches the stage mapping (PRD §8.4.1) for each of the 14 stages (parameterized). | W |
| PRD-05 | R-02: across the whole Dashboard a product appears at most once in «Productos» and at most once in «Por hacer»; it never appears in Grabar if creator-owned. Videos list in the sheet links to `#/board/v:<videoId>`; creator-owned videos show «Creadoras» and open read-only. | W C |
| PRD-06 | «Ver todos» → Products sheet with Segmented «Activos / Publicados / Descartados» (counts correct); tapping a row stacks the Product sheet; back closes only the top sheet. `dropped` shows «Descartado» and no action. «Ver en TikTok Shop» only when `pdp` passes the allowlist. | W C |
| SCR-01 | Tap «Elegir guion» → full-height Script sheet opened on the picked letter, else the recommended (★), else A. Header shows the thumb, name and «Elige 1 de 3 guiones». | W C |
| SCR-02 | Tapping a segment scrolls to that pane; a horizontal swipe changes the selected segment (snap). Reduced motion → instant scroll. | W C |
| SCR-03 | Each pane shows: badges (★ Recomendado · why / ✓ Elegido), title, GANCHO box, facts card, per-beat timing + compact SayBox + «QUÉ HACES» line, collapsibles «Todo el texto» and «Reglas de este guion». | W |
| SCR-04 | «Elegir este guion (B)» → `hub-picks:<b>` saved (7 d) → toast «Elegiste B · Grok prepara el board» + Deshacer → after 4 s payload `{kind:"pick", v:1, job:"ff-010", letter:"B", at}`. Undo inside the grace → nothing sent; after → re-sends the previous letter (or `""`). | W C |
| SCR-05 | Footer variants: not picked / picked other («Cambiar a guion B») / picked this («Quitar elección» → `letter:""`, «Listo» closes) / locked (`changeable:false`, no buttons) / sending («enviando…» while queued). | W C |
| SCR-06 | Offline pick → toast `toast.picked`, the outbox pill shows «1 por enviar», going online sends it. | C |
| SCR-07 | An invalid donor URL → «Estructura propia» and no link; a valid one → «Ver video de referencia» opens a new tab (`noopener`). | W |
| SCR-08 | A scripts entry with 5 options → only A, B, C are shown. | W |
| MAIL-01 | `brand_reply` task «Responder» → Mail sheet. iOS UA: «Abrir Gmail» has `href="googlegmail://"`. Android UA: it uses `mail.web` with `target=_blank`. Desktop: label «Abrir correo». | W C D |
| MAIL-02 | «Copiar búsqueda» (phones only, when `search`) → clipboard holds the search → toast «Búsqueda copiada · abre Gmail, toca Buscar y pega». | W C |
| MAIL-03 | «Ya respondí» → same done flow as DSH-06 (toast + Deshacer + payload). | W C |
| MAIL-04 | `mail.web` off-allowlist → no web button (iOS keeps the constant app link); no `search` → no copy button. | W C |
| MAR-01 | «Marcas» shows one row per non-empty group with icon, label and count (7 waiting items → one row «Esperando respuesta 7»); waiting items are **not** tasks. | W C |
| MAR-02 | Tap a group → Marcas sheet with Segmented groups («Esperando (7)»…) opened on the tapped group; rows show brand, meta + «desde 28 sep»; rows with `mail` open the Mail sheet. | W C |
| MAR-03 | No groups with items → the section is hidden on Dashboard; the sheet's empty state reads «Sin tratos abiertos». | W |

### 5.4 Grabar (GRB)

| ID | Criterion | P |
|---|---|---|
| GRB-01 | Grabar lists only `videos` with `owner:"jorge"` and status in {preparing, to_film, filmed}; each video appears once; the creator-owned video is absent. There's no other filming list in the app (Dashboard has no filming rows). | W C |
| GRB-02 | Segmented «Por grabar {n} / Grabados {n}» with correct counts; route `#/grabar/grabados` selects the second segment and survives reload. | W C |
| GRB-03 | Day groups order: «Hoy», overdue days, future days ascending, «Sin fecha». DayHeader progress «{filmed} de {ready}» in «Por grabar» only. | W C |
| GRB-04 | An overdue day header reads «Atrasado · sáb 3 oct» in `--bad`; app-bar status line reads «Próxima grabación: {date}». | W C |
| GRB-05 | Place sub-header shown only for days with ≥ 2 distinct places. | W |
| GRB-06 | Ready video → «Abrir board» (primary) opens `#/board/v:<videoId>`; legacy v3 `href` to `board.html#…` opens in-app; not ready → chip «Preparando», no buttons; ready with missing board key → «Preparando» + «Grok vuelve a publicar el board». | W C |
| GRB-07 | Toggle «Grabado» → card leaves the list → toast «Marcado como grabado» + Deshacer → `rec-ticks:<b>` updated; «Deshacer» restores with a newer timestamp. In «Grabados», «Desmarcar» moves it back. Local tick newest-wins against `scene.ticks`. | W C |
| GRB-08 | No title starts with a verb («Grabar ·»); the video title line is shown only when it differs from the product name; the takes line «Tomas 2/6 subidas» appears only with an owner session. | W |
| GRB-09 | Empty «Por grabar» → «¡Todo grabado!» with the owner-upload body variant on/off; empty «Grabados» → «Nada grabado todavía». | W C |
| GRB-10 | R-17: a fixture where the generator mistakenly includes a creator job without `owner:"jorge"` → not shown (viewer filter). Single-scene `filming-v2` (no root): same screen, compact app bar «Grabar», no tab bar, no takes line. | W C |

### 5.5 Creadoras (CRE) and Review (REV)

| ID | Criterion | P |
|---|---|---|
| CRE-01 | Cards from `creators` merged with `GET /manager/sessions` by id (live status wins); owner sessions never appear; each card: InitialAvatar, name, expiry chip, «Graba sáb 10 oct», product rows with job StatusChips (Jorge labels), «Copiar link», «Compartir», «⋯». | W C |
| CRE-02 | Order: sessions with uploaded takes → expiring → active by shoot date. Expired/revoked under «Anteriores (n)» collapsed; an expired session with pending uploaded takes stays in the main list with «Vencida». | W C |
| CRE-03 | «Revisar {n} tomas» appears only with `n > 0` and a manager token; tap → `#/creadoras/<sid>/tomas`. | W C |
| CRE-04 | «Copiar link» → clipboard holds the exact `link` → toast «Link copiado». With `navigator.clipboard` undefined → fallback copy works (B-18). Copy failure → «No se pudo copiar». | W C |
| CRE-05 | «Compartir» calls `navigator.share({url})` with **only** `url` (no title/text). Without Web Share → behaves as «Copiar link». | W C |
| CRE-06 | «⋯» → «Extender 3 días» → `POST …/extend {days:3}` → toast «Extendido 3 días · vence {date from response}» → sessions refresh. 403/404/500 → «No se pudo. Prueba otra vez.» | W C |
| CRE-07 | «⋯» → «Revocar link» → alertdialog «¿Revocar el link de Ana?» → «Revocar» posts revoke → toast «Link revocado» → the card moves to «Anteriores». «Cancelar» sends nothing. | W C |
| CRE-08 | `root-v4-nomgr`: banner «Solo lectura en este teléfono.»; no «Revisar»; ActionSheet only «Pedir link nuevo a Grok»; Copy/Share still work. | W C |
| CRE-09 | Offline: cached cards visible; «Revisar», «Extender», «Revocar» stay visible and show «Necesitas conexión» on tap; nothing is queued; banner «Sin conexión: no se pueden revisar tomas». Worker 500 → banner «No se pudo actualizar las tomas.» + «Reintentar». | W C |
| CRE-10 | A live session missing from the scene → shown with the live name, no «Copiar link», meta «Link en camino» (B-19). Empty → «Ninguna creadora activa» + «Escribir a Grok» (Note sheet prefilled). Single-scene `manager-v1` + `m` → same cards; `m` never written to storage. | W C |
| REV-01 | Review sheet header «Tomas de Ana» + «3 por revisar», Segmented «Por revisar / Todas». Deep link `#/creadoras/<sid>/tomas` opens it; back closes to Creadoras. | W C |
| REV-02 | The ticket is fetched only when the take is within one viewport; the URL must match `*.workers.dev/manager/takes/<id>/file?ticket=` or the player shows «No se pudo cargar el video» + «Reintentar»; `preload="none"`, `controls`, no autoplay with sound. | W C |
| REV-03 | «Aprobar» → `POST /manager/takes/:id/approve` → toast «Toma aprobada» → the card leaves «Por revisar» → sessions refresh. Last one → «Nada por revisar» + «Listo». | W C |
| REV-04 | «Re-grabar» → dialog with 5 FilterChips + textarea (counter at 160+, max 200); «Pedir re-grabar» disabled until a chip or text; reason = `chips.join(". ") + ". " + text`, trimmed to 200 → `POST …/redo {reason}` → toast «Pediste re-grabar». | W C |
| REV-05 | When the take's board beat exists, a compact SayBox «LO QUE DICES» with that shot's `vo` is shown under the player. | W |
| REV-06 | 403 on any manager call → banner «El permiso de manager cambió. Pídele a Grok el link nuevo.»; 409 on approve → silent refresh. | W C |
| REV-07 | Offline → Aprobar/Re-grabar toast «Necesitas conexión», nothing queued. | W C |

### 5.6 Boards library (BRD)

| ID | Criterion | P |
|---|---|---|
| BRD-01 | Opened from the Dashboard tile and from Grabar's app-bar «Boards»; compact app bar «‹ Boards» + «Nota»; no tab bar. Boards key missing → ErrorState «Falta la llave de Boards». | W C |
| BRD-02 | Segmented «Todos 16 / Miami X 12 / Creadoras 4» (counts correct); `boards-v1` with avatar label «Bella» still renders «Creadoras». | W C |
| BRD-03 | No type chips/filter; AI boards show `sparkles` + «IA» on the row; `guide` boards appear only under «Guías». | W C |
| BRD-04 | The chosen lane persists in `boards:lane`; a legacy `boards:av` value is read once and migrated. | W C |
| BRD-05 | Sections appear in order «Con problema», «Por grabar», «Por aprobar», «Grabados», «Editando», «Por publicar», «Publicados» (collapsed), «Guías» (collapsed), «Retirados» (collapsed); empty sections hidden. `boards-v1` statuses map per PRD §6.1. | W C |
| BRD-06 | Each board id appears exactly once in the DOM; inside a section, boards are grouped under one ProductGroupCard per product, groups ordered by newest board date, rows by date desc. | W C |
| BRD-07 | Rows: title (fallback «Video {n}»), relative date, chevron; status not repeated per row except «Preparando» in meta; the lane chip only in «Todos». | W |
| BRD-08 | No FF-/JOB- codes, no «qué es» line, no footer, no header count anywhere in the library (DOM regex scan). | W |
| BRD-09 | `missing` board → «Sin link» + «Pedir a Grok» → Note sheet prefilled «Vuelve a publicar el board de Producto J.»; `viewer:"canvas"` → «Board antiguo» + `external-link`, opens `../index.html#…` in a new tab; `viewer:"board"` → `#/board/<id>`. | W C |
| BRD-10 | Empty scene → «No hay boards»; empty lane → «No hay boards de Creadoras». Offline → cached; single-scene `boards-v1` link → no back button, works. | W C |

### 5.7 Board template (BRD-T), AI approvals (APR)

| ID | Criterion | P |
|---|---|---|
| BRD-T-01 | Section order top → bottom: «Video de referencia», «Escenas», «Guion», «Subir video» (or «Aprobar»). Sticky jump chips «Referencia · Escenas 6 · Guion · Subir»; tapping scrolls; the active chip follows the scroll. | W C |
| BRD-T-02 | **HR-04:** in every SceneCard the SayBox has a visible label «LO QUE DICES», its text has the largest computed `font-size` of all text in the card **and** is larger than the app-bar title, and its contrast ratio ≥ 7:1 in both themes; «QUÉ HACES» text is 15 px in `--text-2`. A beat without `vo` shows «Sin texto: solo acción» (muted); without `do_es` the DoLine is absent. Every `vo` appears exactly once on the page (R-09). | W |
| BRD-T-03 | Frames «Referencia» / «La nuestra» are decrypted lazily (no media request for frames > 1.5 viewports away at load); tap → FrameViewer with horizontal swipe and close. | W C |
| BRD-T-04 | Reference video: no media request until tap; tap → decrypt + play with `controls`. Board without `refSrc` → «Este board no tiene video de referencia.» | W C |
| BRD-T-05 | Guion: 6 lines + «Ver todo»; «Copiar guion» → clipboard holds the full script → «Guion copiado». | W C |
| BRD-T-06 | States: skeleton while loading; `err.boardOpen` + «Reintentar» on decrypt failure; unknown id → `err.boardOpen` + «Volver»; offline with cache → renders. `board-v1` renders identically (minus status chip). | W C |
| BRD-T-07 | The same `lib/board.js` renders the app board (roles owner/approver/viewer) and the portal board (role creator): for the same beats, the SceneCard DOM structure (tag/class tree) is identical across roles; only the bottom section and the Nota action differ. Role `viewer` (creator product from Creadoras) shows the read-only «Tomas» summary with take chips and no upload buttons. | W C |
| APR-01 | `board-v2-ai` → «Aprobar» section instead of «Subir video»; one card per approval with media decrypted lazily, «Dar GO» (primary) and «Pedir cambios» (secondary). | W C |
| APR-02 | «Dar GO» → toast «GO enviado» + Deshacer → after 4 s `{kind:"approve", blockId:"job21:video", choice:"go", at}`; undo inside the grace → nothing sent; after the send the toast is replaced by «Ya se envió». | W C |
| APR-03 | «Pedir cambios» → sheet with textarea → «Enviar» → `approve changes` + (if text) a `note` with prefix «Cambios en Producto H: ». Toast «Cambios pedidos». | W C |
| APR-04 | After a local GO/changes, the card shows the chip «GO enviado»/«Cambios pedidos» instead of the buttons, persisted across reload until the next build. | W C |

### 5.8 Feed (FED)

| ID | Criterion | P |
|---|---|---|
| FED-01 | `#/feed` full screen, dark in both themes, vertical scroll-snap, one card per 100dvh; covers are decrypted from `.enc`; the preview autoplays muted when ≥ 60 % visible; tap toggles play/pause. Reduced motion → no autoplay. | W C |
| FED-02 | Lane switch «Miami X / Creadoras / Todos» (labels via `LANES`, even when the scene says «Bella»). | W C |
| FED-03 | Lane counts correct; default = `default_avatar`, else Miami X; the choice persists in `creatorFeed.avatar`; a lane change resets the creator filter and keeps the window. | W C |
| FED-04 | Filters sheet (button `aria-label="Filtros"`, accent dot when not default): «Ventana» chips with counts within the lane; changes apply live; «Ver {n} videos» closes; «Limpiar» resets. No window chips remain under the score. | W C |
| FED-05 | «Creador» radio rows list only the lane's creators with counts; selecting filters the cards. | W C |
| FED-06 | «Actualizado 8 oct, 7:43 a. m.» appears in the Filters sheet footer and nowhere on the cards. | W |
| FED-07 | Bottom overlay: `@handle · hace 2 d · [Anuncio]` (chip only for ads), hook max 2 lines (tap expands). | W C |
| FED-08 | Score badge: number + «Score» (or «GMV Max»), band color per existing bands; best-multiple chip with `best.label`. | W |
| FED-09 | Exactly one sales/velocity line per card; no number appears twice in the overlay (digit comparison on the fixture with repeated sales). Uses `product.line` when present. | W C |
| FED-10 | Right rail shows views, likes, comments, shares, saves formatted `es-US` («24,3 mil») + «Nota». | W |
| FED-11 | «Abrir en TikTok» opens `card.url` in a new tab only for `www.tiktok.com`/`shop.tiktok.com`; otherwise hidden. | W C |
| FED-12 | Rail «Nota» → Note sheet with context «Sobre: @demo.creator». | W C |
| FED-13 | «Lo quiero» (numeric `product.id` + a feed mailbox) → button «Anotado» → toast «Anotado · sale en Productos en el próximo refresh» + Deshacer → after 4 s `{kind:"approve", blockId:"want:<pid>", choice:"want", at}` sent to the **feed channel mailbox** (keyring `f`); persisted in `feed-want:<b>` for 7 days (reload keeps «Anotado»). No mailbox → button hidden. Scene mailbox rotated (new `f` in the keyring) → the request goes to the new UUID (B-14). | W C |
| FED-14 | Product pill: thumb, title 1 line, «$35.00 – 105.00 · Comisión 15%»; opens `product.href` (TikTok Shop allowlist) in a new tab. | W C |
| FED-15 | No product → neutral pill «Producto sin identificar», not focusable. | W |
| FED-16 | Empty lane → the scene's honest `avatars[].empty` text; empty filter → «No hay videos con este filtro» / «Toca Filtros para cambiarlo.» | W C |
| FED-17 | Broken feed key → `err.decrypt` in dark style; incomplete link → `err.incomplete`. Back «‹» → previous route or Dashboard; single-scene mode hides back. | W C |
| FED-18 | Scrolling 10 cards keeps at most 3 decrypted blob URLs alive (± 1 window); off-window blob URLs are revoked (`URL.revokeObjectURL` spy). | C |

### 5.9 Creator portal (POR) and uploads (UPL)

| ID | Criterion | P |
|---|---|---|
| POR-01 | `portal.html#b=…&k=…&t=…` with `portal-v2` → «Hola, Ana», meta «Graba sáb 10 oct · vence lun 13»; with `portal-v1` → «{n} productos». Rows: thumb, name (2 lines max), StatusChip (creator projection), «Abrir board». | W C |
| POR-02 | The portal shows no Nota, no tab bar, no install banner, no app-bar actions, nothing about other creators, commissions, Jorge's tasks or the feed. No request to `webhook.site` or to `/manager/*` is ever made. | W C |
| POR-03 | «Abrir board» → board (role creator) with in-page «‹»; the hash becomes `…&p=<productId>` keeping `b`, `k`, `t`; reload reopens the same product; «‹» returns to the list. | W C |
| POR-04 | `/s/:t` → 403 → full-screen «Este link ya no está activo» / «Pídele uno nuevo a Jorge.» A 403 during upload → inline «Este link ya no está activo.» then the full screen on the next refresh. | W C |
| POR-05 | Per-product blobs are fetched only when a product is opened (lazy). Live state refreshes on `visibilitychange` and every 60 s while visible. | W C |
| UPL-01 | **HR-06:** in `missing` and `redo` states the control is a `<button>` (FileButton wrapping a hidden `input[type=file][accept="video/*"]`) labeled «Subir video», with the `upload` icon, filled `--accent` background, white text (contrast ≥ 4.5:1), full width, height ≥ 52 px. Same in the app (owner) and the portal (creator). | W C |
| UPL-02 | Take states render label + icon per PRD §6.5: «Falta» (never «Enviado» for an empty take, B-16), «Subiendo 42 %» + progressbar, «En pausa» + «Reanudar», «Subido», «Aprobado», «Re-grabar» + banner «Re-grabar: {motivo}», «En la Mac» (owner/viewer only; the creator sees «Subido»/«Aprobado»). | W C |
| UPL-03 | Happy path with a 3.2 MiB synthetic video and `partSize` 1 MiB: `init {job, shot, take, size, mime}` → `sign` → 4 `PUT`s (max 3 concurrent) with per-part SHA-256 → `complete {uploadId, etags:[{partNumber, etag, sha256}], size}` → IndexedDB record deleted → toast «Video subido» → state «Subido». Bearer token is sent only to `*.workers.dev`; presigned PUTs carry no `Authorization`. | W C |
| UPL-04 | Part 2 fails twice then succeeds → retried with backoff (400, 800 ms); upload completes. Part 2 fails 5 times → state «En pausa» + «Se cortó la subida. Toca Reanudar.» | C |
| UPL-05 | Interrupt after 2 parts → reload → the row shows «En pausa» + «Reanudar» → «Reanudar» opens the picker with «Elige el mismo video para seguir.» → the same file (size, name, lastModified) → only the missing parts are uploaded → complete. | W C |
| UPL-06 | Errors: a non-video file → «Solo se pueden subir videos.»; init 403 → «Este link ya no está activo.»; 409 → «Esta toma ya está cerrada.»; init network error → «No se pudo empezar. Revisa la conexión y prueba otra vez.»; offline at tap → «Necesitas conexión para subir.» All `role="alert"`. | W C |
| UPL-07 | During an upload: the stay banner is visible (app copy vs portal copy), the wake lock is requested and released at the end; in-app back → dialog «La subida sigue solo si te quedas aquí.» [Quedarme] [Salir]; «Salir» leaves the upload paused and resumable; `beforeunload` sets `returnValue`; the update banner's «Actualizar» shows «Termina la subida antes de actualizar.» | C (wake lock stubbed), W |
| UPL-08 | Owner: `root-v4-owner` + `board-v2` with `job` → «Subir video» uses `ownerToken` against the same endpoints; Grabar shows «Tomas 2/6 subidas». Without `ownerToken` the section is **absent** (no disabled control). | W C |
| UPL-09 | Compat: an IndexedDB `portal-uploads` record written in today's shape (no `name`/`lastModified`) → «Reanudar» works with the size check only. | W C |
| UPL-10 | Resume with a different file → «Ese no es el mismo video.» + «Empezar de nuevo» → `POST /upload/abort` → fresh init → completes. `paused` + «Subir video» → confirm «¿Empezar de nuevo? Se pierde lo que ya subió.» | W C |
| UPL-11 | Uploads closed in `uploaded`, `approved`, `pulled` (no control rendered); reopened in `redo`. | W C |

### 5.10 Outbox (OUT), Note (NOTE), Toast (TST)

| ID | Criterion | P |
|---|---|---|
| OUT-01 | Every mailbox tap writes to IndexedDB `comando/outbox` before any network request; the UI updates immediately (optimistic) even with the mailbox mock offline. | W C |
| OUT-02 | Grace: undo within 4 s removes both entries and sends **zero** requests (done, act, pick, want, go). | W C |
| OUT-03 | Coalescing: three picks on the same job within the grace → one request with the last letter; done → undo → done on the same id → one `done`; two «Lo quiero» on the same product → one; notes never coalesce. | W C |
| OUT-04 | Backoff: mailbox 500 → retried at ~5 s, 15 s, 60 s (clock advanced); 400 → `failed`, shown in the sheet with «Reintentar» → back to `queued` → sent. 408/429 are retried, not failed. | C |
| OUT-05 | Ticks: 3 marks within 5 min → **one** `text/plain` POST `{kind:"ticks", v:2, set:{…3 ids…}, at}` at the 5-min mark; «Enviar ahora» in the sheet sends immediately; newest timestamp per id wins. | W C |
| OUT-06 | Mailbox per channel at send time (D-17): `hub` → root `mailbox`; `feed` → keyring `f`; `board:<id>` → board `mailbox` → fallback root. No mailbox → entry stays queued, sheet says «Sin buzón. Pídele a Grok el link nuevo.» | W C |
| OUT-07 | App-bar pill «N por enviar» (warn) appears when N > 0 and the oldest entry is > 10 s old; tap → Outbox sheet with human labels per kind (PRD §8.14, no raw ids), «Enviar ahora» (hidden offline, replaced by «Se envía al volver la conexión.»), «Enviados hoy» collapsed. | W C |
| OUT-08 | **Payload equality (S-7):** for each source in ARCHITECTURE §9.2, the request body is byte-identical to the v1 viewer's payload for the same tap (golden JSON files generated from today's pages before Phase 7), including `fetch` options `redirect:"error"`, `referrerPolicy:"no-referrer"`, `credentials:"omit"`. | C |
| OUT-09 | Hidden page with a queue → send with `keepalive:true`; returning online (`online` event) flushes the queue. | C |
| NOTE-01 | The Note sheet is the only note UI: reachable from the app bar of Dashboard, Grabar, Creadoras, Boards, Board and the Feed rail; no other note component exists (DOM scan for legacy note markup). | W C |
| NOTE-02 | Textarea autofocus, 16 px, max 5000, hint «Grok la lee cuando le escribas. No ejecuta nada.»; «Enviar» disabled when empty. | W C |
| NOTE-03 | With context chip «Sobre: Producto A» → payload text `«Producto A»: <text>`; removing the chip → no prefix. Prefilled variants (Pedir link nuevo, Escribir a Grok, Pedir a Grok) contain the exact PRD copy. | W C |
| NOTE-04 | Send online → «Nota enviada»; offline → «Nota guardada · se envía al volver la conexión» and the pill shows it. | W C |
| NOTE-05 | Closing with text → «¿Descartar la nota?» [Seguir escribiendo] [Descartar]; the draft survives close/reopen while the app is open; no mailbox → banner «Sin buzón…» and no «Enviar». | W C |
| TST-01 | One toast at a time (a new one replaces the old); toasts with Deshacer stay 5 s, others 3 s; `role="status"`; the Deshacer button is ≥ 44 px tall; tapping Deshacer performs the documented undo per kind. | W C |

### 5.11 Global: refresh, errors, dates, vocabulary, icons, Ajustes (REF, ERR, DAT, VOC, ICO, AJU)

| ID | Criterion | P |
|---|---|---|
| REF-01 | Root scene re-fetched every 60 s while visible (clock advance), on `visibilitychange` → visible and on the status-line tap; failures keep the last good model and set the status line to «No se pudo actualizar» / «Sin conexión». | W C |
| REF-02 | Pull to refresh (touch drag ≥ 64 px from the top) on the three tabs and Boards → spinner → «Actualizado hace un momento». Works in emulated standalone. | W C |
| REF-03 | A refresh that arrives while a textarea is focused does not re-render (typed text and caret intact); it applies on blur. Worker sessions refresh every 60 s on Creadoras, 5 min elsewhere. | W C |
| ERR-01 | Opening `app/` on a host other than `jorgedearmas.github.io` → «Abre este link desde jorgedearmas.github.io» (never a literal placeholder such as `__CANVAS_HOST__`, B-13). | W |
| ERR-02 | Missing `k` or malformed `b` → «Link incompleto» / «Pídele a Grok el link completo.» | W C |
| ERR-03 | Wrong key → «No se pudo abrir» / «Si el link es nuevo, espera un minuto.» + «Reintentar» (re-fetches). | W C |
| ERR-04 | First open offline → «Sin conexión» / «Conéctate para abrir por primera vez.» | W C |
| ERR-05 | Any uncaught render error in a screen → «Algo falló» + «Reintentar» for that screen only; the tab bar stays usable. | W C |
| DAT-01 | `dates.js` unit table: today/tomorrow/yesterday, within 6 days («sáb»), same year («sáb 10 oct»), other year, «Sin fecha», relative past («hace 5 min», «hace 2 h», «ayer 8:15 p. m.»), expiry («Vence hoy/mañana/en 2 días», «Vencida»). | S W |
| DAT-02 | ET boundary: at 11:30 p. m. ET (= 03:30 UTC next day) «hoy» is still the ET date; a device in `Europe/Madrid` timezone shows the same labels. | W |
| DAT-03 | Overdue: `due`/`day` before today ET and stage before `filmed` → «Atrasado · sáb 3 oct» in `--bad` (Dashboard meta, Productos group, Grabar header). | W C |
| DAT-04 | No ISO date/time string (`\d{4}-\d{2}-\d{2}`) appears in any visible text on any screen (DOM text scan per screen). | W |
| VOC-01 | Product stage chips: each of the 14 ids renders its PRD §6.2 label/tone/icon; v3 chip texts map per the legacy column (parameterized). Unknown → neutral chip with sanitized text. | W |
| VOC-02 | Video status: 9 ids + boards v1 status texts → PRD §6.1 labels. | W |
| VOC-03 | Session (Activa / Vence… / Vencida / Revocada) and job states (Enviado, Visto, Subiendo, Subido, Aprobado, Re-grabar, En la Mac) render per PRD §6.3–6.4; creator projection in the portal shows only Por grabar/Subiendo/Subido/Aprobado/Re-grabar. | W |
| VOC-04 | Take states per PRD §6.5 in Board, Review and portal. | W |
| VOC-05 | Forbidden-words scan over the rendered DOM of every screen (both fixture families, including `root-v4-bella` and `boards-v1`) and over `lib/copy.js`: «Bella», «Rehacer», «enlace», «Más» (as a tab), «Shot», « take », «Listo» as a take/job status, «FF-», «JOB-», emoji code points (`\p{Extended_Pictographic}`), «donor». | S W |
| ICO-01 | Every icon in the DOM is an inline `<svg>` produced by `icons.js` with `aria-hidden="true"`; every icon-only button has an `aria-label`; the icon names used are all in PRD §4.2 (static scan of `icon("…")` calls); no `<img>` icon and no emoji. | S W |
| AJU-01 | Ajustes rows: Tema (Segmented), Instalar («Instalada ✓» in standalone, else «Ver cómo ›»), Llaves («Comando ✓ · Feed ✓ · Boards ✓», «Feed: falta (ábrelo una vez desde su link)» when missing), Actualizar ahora, Versión «2.0.0 (abc1234)», Olvidar este teléfono. | W C |
| AJU-02 | «Actualizar ahora» re-fetches scenes and calls `registration.update()`. | C PWA |
| AJU-03 | «Olvidar este teléfono» → dialog (with «Hay 2 toques sin enviar. Se pierden.» when the outbox has 2 entries and «Hay una subida a medias.» when an upload record exists) → «Olvidar» deletes IndexedDB `comando` and `owner-uploads`, Cache Storage `scenes-v1` and `media-v1`, the localStorage keys in ARCHITECTURE §8, keeps `shell-*`, → `#/bienvenida`. | W C PWA |
| AJU-04 | Install sheet (iOS UA, not standalone): 3 steps with icons `share`, `square-plus`, `clapperboard`; «Copiar link para la app» only in the session where the root link was imported (absent after reload) and copies the full root link. | W |

### 5.12 Links and migration (LNK, MIG, IDX, PRV)

| ID | Criterion | P |
|---|---|---|
| LNK-01 | `comando.html#b=<root>&k=<key>` → `app/` with the same hash → import → strip → `#/dashboard`. The redirector page makes no request other than the navigation; it has no inline script. | W C |
| LNK-02 | `hub.html#…` (v3 root) → same as LNK-01. | W C |
| LNK-03 | `grabacion.html#…` (filming key): with a root keyring → learned as `filming`, lands on `#/grabar` in full-app mode; without → single-scene Grabar with the key kept in the hash (reload works, D-16). | W C |
| LNK-04 | `boards.html#…` → `#/boards` (learned or single-scene as above). | W C |
| LNK-05 | `feed.html#b&k&f` → `#/feed`; `f` used as the feed channel mailbox; learned when a root exists. | W C |
| LNK-06 | `manager.html#b&k&m` → `#/creadoras`; manager actions work with `m`; `m` never appears in IndexedDB, localStorage, Cache Storage or the URL after load. | W C |
| LNK-07 | `board.html#…` → `#/board/<b>` (stored under `board:<b>` when a root exists). | W C |
| LNK-08 | **Active creator session:** `portal.html#b&k&t` with `portal-v1` (today's scene) and an in-progress `portal-uploads` record → PLP, board and «Reanudar» work without any change to the link (POR-01, UPL-09). | W C |
| LNK-09 | `index.html#…` with a canvas scene renders as today; with a `type:"board"` scene → `location.replace("app/" + hash)` → Board. No request to `raw.githack.com` or `raw.githubusercontent.com` is ever made (B-02). | W C |
| LNK-10 | Root link with a portal scene key opened in `app/` → redirected to `portal.html` with the same hash; a canvas scene → `index.html`. Unknown route → Dashboard (or Bienvenida without root). | W C |
| MIG-01 | `hub-done:<b>` written by today's `comando.html` (golden localStorage fixture) → the same tasks stay hidden in v2 (ids unchanged). | W C |
| MIG-02 | `hub-picks:<b>` → the Script sheet shows the picked letter; `rec-ticks:<b>` / `rec-sync:<b>` → Grabar shows the same filmed state. | W C |
| MIG-03 | `creatorFeed.avatar` keeps the lane; `boards:av` migrates to `boards:lane`. | W C |
| MIG-04 | Switchover v3 → v4 on the same root blob (the generator flips): tasks don't reappear or duplicate (same ids), done memory still applies, picks persist. | W C |
| MIG-05 | Existing FF boards republished as `board` v2 with the **same blob + key** (G-5): the old `index.html#…` link redirects via the shim and renders the Board template. | W C |
| MIG-06 | Parity gate before Phase 7: every row of PRD §10 has a passing test ID (a static check parses PRD §10 tables and the Playwright JSON report; any traced ID without a passing test fails). | S |
| IDX-01 | `index.html` canvas blocks (all 20 types in `canvas-blocks`) render; GO/changes payloads unchanged. | W |
| IDX-02 | `index.html` note copy uses the unified note strings. | W |
| IDX-03 | `index.html` CSP no longer lists githack hosts. | S |
| PRV-01 | `preview.html` renders the synthetic Dashboard + Board demo with the banner «Demo con datos de ejemplo.», contains no `#b=`/`&k=` link, makes no network request (`connect-src 'none'`), and shows «Lo que dices», «Qué haces», «Subir video». | W S |

---

## 6. Security checks (SEC)

| ID | Criterion | P |
|---|---|---|
| SEC-01 | Across the full suite, the net guard records every request; **no** request URL, header or body contains any fixture key text, the root/sub-scene keys, a manager/owner token (except as `Authorization: Bearer` to `*.workers.dev` for its own calls), or a creator `t` outside the portal's own calls. Fails on first violation. | W C |
| SEC-02 | After import, `location.href`, `document.referrer` of navigations, `history` entries reachable via back, and the manifest contain no key material (`b=`, `k=`, `f=`, `m=`, `t=`). All pages have `<meta name="referrer" content="no-referrer">`. | W C |
| SEC-03 | IndexedDB, localStorage and Cache Storage are dumped at the end of each spec: no plaintext scene text (search for fixture product names), no raw key text (except `keyMode:"raw"` in ONB-07 and the D-16 hash), Cache Storage scenes are `{iv, ct}` only. | W C PWA |
| SEC-04 | CSP meta of `app/index.html`, `portal.html`, redirectors, `index.html` and `preview.html` equals the strings in ARCHITECTURE §12.2 / §4.2 (static); at runtime any request to a host outside the allowlist fails the test; no inline `<script>` in `app/` or `portal.html`; no `eval`, `new Function`, `document.write`, `insertAdjacentHTML`, or `innerHTML =` outside `lib/html.js` (static scan). | S W |
| SEC-05 | `portal-v2-forbidden`: the portal renders none of the forbidden fields (DOM + memory: `window` has no global holding them); the schema `portal-v2.schema.json` rejects the fixture. | S W |
| SEC-06 | Portal: no request carries the manager or owner token; no `m=` in any portal link inside `root-v4.creators[].link` (fixture builder asserts it); the portal never requests `/manager/*`. | W |
| SEC-07 | Static import graph: `portal.html` reaches only `lib/core.js, html.js, dates.js, copy.js, status.js, icons.js, components.js, board.js, upload.js, lanes.js` and `ui.css`; never `keyring.js`, `outbox.js`, `model.js`, `worker-api.js`, `screens/*`. | S |
| SEC-08 | `root-v4-hostile` on every screen: no script executes (a `window.__pwned` canary stays undefined), no `javascript:`/`data:` href is rendered, off-allowlist URLs render as plain text or are dropped, long strings are clamped without breaking layout (no horizontal scroll), RTL overrides are stripped. | W C |
| SEC-09 | `scripts/check-secrets.sh` passes; PNGs allowed only under `app/icons/` with a hash listed in `ICONS.sha256` (a test adds an unlisted PNG in a temp worktree and expects failure); no fixture contains a name from the private denylist (CI reads `PRIVATE_NAME_DENYLIST` from a repository secret when present; the list itself is never committed). | S |
| SEC-10 | Boards: entries pointing to `portal.html`, `manager.html`, `comando.html`, `hub.html` or with `t=`/`m=` in their URL are never rendered (`boards-v1` fixture includes both). | W C |

---

## 7. Data-contract checks (SCH, static)

| ID | Criterion |
|---|---|
| SCH-01 | The four schemas compile under JSON Schema 2020-12 (`ajv/dist/2020`) with `strict: true`. |
| SCH-02 | Every valid fixture in §2.3 validates against its schema; every ✗ fixture fails with the expected keyword (`pattern`, `not`, `additionalProperties`…). |
| SCH-03 | Schemas reject: «Bella» in user-visible text fields, placeholder titles, ISO dates in `meta`, FF-/JOB- codes in titles, `rec:open`, `counters`, `sections`, `managerToken`/`ownerToken`/`keyring` in portal v2. |
| SCH-04 | The adapters' output (view model) for `root-v3` and `root-v4` with the same underlying data is deep-equal for tasks, products, videos, brands and grok (ids and order). |

---

## 8. PWA checks (PWA)

Runs in `pwa-chromium` against the repo served through `context.route` (Chromium routes service-worker requests through `context.route`). If that ever stops holding, the fallback is a local HTTPS static server with `--host-resolver-rules="MAP jorgedearmas.github.io 127.0.0.1:8443"` and `ignoreHTTPSErrors`.

| ID | Criterion | P |
|---|---|---|
| PWA-01 | `app/manifest.webmanifest` parses; fields equal ARCHITECTURE §12.1 (`id`, `start_url "./"`, `scope "./"`, `display "standalone"`, `lang "es-US"`, colors); every icon file exists with its declared size (PNG header check); a `maskable` 512 icon exists; shortcuts point to `./#/grabar`, `./#/creadoras`, `./#/feed`. | S |
| PWA-02 | The manifest, `app/index.html` and `sw.js` contain no `b=`, `k=`, `t=`, `m=`, `f=` or UUID-shaped strings. | S |
| PWA-03 | SW registers with scope `/grok-canvas/app/`; `portal.html`, `index.html` and the redirectors are **not** controlled (`navigator.serviceWorker.controller === null` there). | PWA |
| PWA-04 | After the first load, go offline (`context.setOffline(true)`) and reload `app/` → shell from cache, keys from IndexedDB, cached root scene renders the Dashboard with the banner «Sin conexión · datos de hace …». Grabar, Creadoras, Feed (cached scene + covers), Boards and a previously opened Board render offline. | PWA |
| PWA-05 | Fresh profile offline → «Sin conexión» / «Conéctate para abrir por primera vez.» | PWA |
| PWA-06 | Scenes are network-first: a newer scene online replaces the cached one; with the network delayed > 4 s the cached scene is served; the cache key ignores the query; a non-`{iv,ct}` 200 response is not cached. | PWA |
| PWA-07 | Cache Storage contains only `shell-<VERSION>`, `scenes-v1`, `media-v1`; scene entries are `{iv, ct}`; media entries are `.enc`; entries > 60 MB aren't cached; the LRU caps (80 scenes, 200 MB media) evict oldest (simulated with small caps via a test build flag). | PWA |
| PWA-08 | Requests to `*.workers.dev`, `*.r2.cloudflarestorage.com` and `webhook.site` never hit Cache Storage (network-only); the SW never reads bodies or `Authorization` (static scan of `sw.js` for `request.body`, `.text()`, `.json()` on requests, `headers.get("authorization")`). | S PWA |
| PWA-09 | Deploy a new `sw.js` VERSION (test serves a modified file) → banner «Hay una versión nueva» + «Actualizar» → tap → `SKIP_WAITING` → reload on the same route; old `shell-*` caches deleted. During an upload or with a focused note textarea, no auto-reload happens and «Actualizar» shows «Termina la subida antes de actualizar.» | PWA |
| PWA-10 | Kill switch: serving the documented unregister `sw.js` → after one load the SW is gone, caches are cleared, the app still works online. | PWA |
| PWA-11 | Install UX: Android UA + `beforeinstallprompt` (dispatched) → banner «Instala Comando» + «Instalar» → `prompt()` called; hidden after `appinstalled`. iOS Safari UA not standalone → banner «Instala Comando en tu iPhone» + «Ver cómo» → install sheet; dismiss → hidden for 14 days (clock). Standalone → no banner, Ajustes «Instalada ✓». Desktop → no banner, Ajustes row only. | PWA W |
| PWA-12 | `app/index.html` has the apple meta tags, `apple-touch-icon` 180, 10 `apple-touch-startup-image` links whose media queries and files match ARCHITECTURE §12.2; `make-icons.mjs --check` reproduces `ICONS.sha256`. | S |
| PWA-13 | Installability: the CDP call `Page.getInstallabilityErrors` returns an empty list for `app/` (this replaces the Lighthouse PWA category, which Lighthouse 12 removed). | PWA |

---

## 9. Upload flow test details

The UPL rows in §5.9 run against `worker-mock` + `r2-mock`. Additional rules:
- Files are synthetic `Uint8Array`s with a `video/mp4` MIME, set through `setInputFiles({name, mimeType, buffer})`; the identity checks use `name` + `lastModified` (Playwright sets `lastModified` to the set time; the test pins it with a `File` built in the page when needed).
- Interruption is simulated by `route.abort("connectionreset")` on the N-th part PUT, then `page.reload()`.
- SHA-256 per part is verified by `r2-mock` (it recomputes the hash of the received bytes and compares it with the `complete` payload).
- Concurrency is verified by counting in-flight PUTs (max 3).
- Both DBs are tested: `owner-uploads` (app) and `portal-uploads` (portal), with the legacy record shape for the latter (UPL-09).

---

## 10. Worker v1.1 tests (Worker repo, vitest + miniflare) — WRK

Run in `creator-portal-api` before Jorge deploys (Phase 8c). The viewer-side mock (§2.4) must match these behaviors.

| ID | Criterion |
|---|---|
| WRK-01 | Migration `0005_session_kind.sql` applies on a copy of the production schema; existing rows get `kind='creator'`. |
| WRK-02 | `POST /admin/sessions {kind:"owner"}` creates an owner session for Jorge's account; a second non-revoked one → 409; `kind:"owner"` with another account → 400. |
| WRK-03 | `POST /admin/sessions/:id/jobs {add, remove}` upserts/deletes; removing a job with unpulled takes → 409; non-admin bearer → 401. |
| WRK-04 | Extend: owner 1–30 days OK, 31 → 400; creator stays 1–14. |
| WRK-05 | `GET /manager/sessions` excludes owner sessions by default; `?include=owner` includes them; every take has `id, job_id, shot, take, status, redo_reason, uploaded_at, pulled_at, size`. |
| WRK-06 | An owner token works on `GET /s/:token` and the four `/upload/*` endpoints with the same limits and SHA-256 checks as a creator token. |
| WRK-07 | `link_expiring` is never emitted for owner sessions; `owner_upload_completed` is emitted on complete. |
| WRK-08 | Backward compatibility: today's `portal.html`, `comando.html`, `manager.html` request sequences (recorded fixtures) get byte-identical responses except the added `kind` field; CORS headers unchanged. |

---

## 11. Generator tests (Agent-Skills) — GEN

Run in Agent-Skills CI before each Phase 8 switch is flipped.

| ID | Criterion |
|---|---|
| GEN-01 | `build_hub.py` with `HUB_SCENE_VERSION=4` emits JSON that validates against `comando-v4.schema.json` (vendored copy); on failure nothing is sealed or pushed. Same for boards v2, board v2, portal v2. |
| GEN-02 | Task ids equal the v3 item ids for the same inputs (golden comparison of a v3 and a v4 build from one snapshot). |
| GEN-03 | No generated string contains «Bella» (case-insensitive), FF-/JOB- codes in titles, ISO dates in `meta`, or placeholder titles. |
| GEN-04 | `videos[]` owner filter: creator jobs have `owner:"creadoras"`; `build_filming.py` excludes them (R-17). |
| GEN-05 | No duplication: a product's sample action appears only as a task; `grok[]` excludes `researching`/`preparing` products; the hero rules don't need generator support. |
| GEN-06 | `build_boards.py` excludes system pages and never emits URLs with `t=`/`m=`. |
| GEN-07 | `publish_board.py` republish keeps blob id and key for every migrated FF board (compare `$CANVAS_INDEX` before/after). |
| GEN-08 | `portal_build.py` strips forbidden fields; `owner ensure` is idempotent (two runs → one owner session, same token) and never lists the owner session in `portals.json`/`creators[]`. |
| GEN-09 | The keyring in the root scene equals the current boards/feed/filming theme refs (no rotation). |
| GEN-10 | Builds are idempotent: two runs on the same inputs produce identical plaintext (excluding `updatedAt`). |

---

## 12. Manual checks on real devices (M)

Done on GitHub Pages after each user-facing phase, with a **synthetic QA root scene** published by the box (theme `qa-demo`, synthetic data only). Its link is stored only as the Cursor secret `QA_DEMO_ROOT_LINK` and in the box; it is never committed or pasted into the PR. Jorge does M-14 with his real link.

| ID | Device | Check |
|---|---|---|
| M-01 | iPhone, Safari | Open the QA root link → Dashboard; URL no longer shows the key; install banner appears. |
| M-02 | iPhone | «Ver cómo» → Agregar a inicio → icon and name «Comando» on the home screen; splash matches the theme. |
| M-03 | iPhone, standalone | First open → Bienvenida → «Copiar link para la app» (done in Safari before) → «Pegar link» → iOS «Pegar» callout → Dashboard. |
| M-04 | iPhone, standalone | Kill the app, reopen → Dashboard without pasting (keys persisted); reopen after 8 days → still works (installed apps are exempt from the 7-day cap). |
| M-05 | iPhone, standalone | Airplane mode → reopen → cached Dashboard + offline banner; mark a task done → pill «1 por enviar»; back online → sent. |
| M-06 | iPhone, standalone | Feed opens from Atajos, swipes vertically, previews play, «Lo quiero» works; external links open the in-app Safari sheet and returning keeps the app state. |
| M-07 | iPhone, standalone | Own pull-to-refresh works; status bar and safe areas (notch, home indicator) don't overlap the app bar or tab bar, in light and dark. |
| M-08 | Android, Chrome | «Instalar» prompt → installed app opens on Dashboard without pasting (shared storage); shortcuts (long-press icon) open Grabar/Creadoras/Feed. |
| M-09 | iPhone, Safari (creator) | QA portal link → PLP → board → record a 30 s video → «Subir video» → «Subido». |
| M-10 | iPhone, Safari (creator) | Start a large upload, lock the phone → reopen the link → «Reanudar» → same video → completes. The screen stayed awake while in the foreground. |
| M-11 | Android, Chrome (creator) | Same as M-09. |
| M-12 | iPhone | VoiceOver pass on Dashboard, Board and the upload row: every control has a Spanish name; order follows the layout. |
| M-13 | iPhone | Text size set to the largest accessibility size → no clipped buttons, rows wrap. |
| M-14 | Jorge's iPhone | Jorge opens his real Comando link, installs, pastes, and confirms that Dashboard, Grabar, Creadoras, Feed and Boards show his data. Ticks the HR list in the PR. |
| M-15 | iPhone | Ajustes › «Olvidar este teléfono» → Bienvenida; opening the app again asks for the link. |
| M-16 | Any | An old WhatsApp link to `comando.html`, `grabacion.html`, `boards.html`, `feed.html`, `manager.html`, `board.html` and an old FF board on `index.html` each open the right v2 screen. |

---

## 13. Accessibility checks (A11Y)

| ID | Criterion | P |
|---|---|---|
| A11Y-01 | axe-core (WCAG 2.2 A/AA rules) on every screen and state listed in §14, in light and dark: zero `serious` or `critical` violations. | W |
| A11Y-02 | Contrast sampler: for every visible text node, the computed contrast against its effective background ≥ 4.5:1 (≥ 3:1 for ≥ 24 px or ≥ 18.66 px bold); non-text UI (chip borders, focus ring, icons in buttons, progress bars) ≥ 3:1. Includes tinted StatusChips of every tone and the Feed overlays over the darkest and lightest synthetic cover. | W |
| A11Y-03 | Every element matching `button, a[href], input, textarea, select, [role=button], [role=tab], [role=radio], summary` that is visible has a bounding box ≥ 44×44 CSS px (padding counts), including «Ver todo», chips, the toast «Deshacer» and the sheet ✕. | W |
| A11Y-04 | Keyboard: Tab order follows the visual order on each screen; Enter/Space activate; Escape closes sheets and dialogs; focus is trapped inside open sheets/dialogs and returned to the opener on close; arrow keys move within Segmented; the focus ring is visible (≥ 2 px, ≥ 3:1). | D W |
| A11Y-05 | Text zoom 200 % (root font-size ×2 via `document.documentElement.style.fontSize`, plus WebKit `-webkit-text-size-adjust`) at 390 px: no horizontal scroll on any screen; titles wrap to 2 lines; no text clipped by fixed heights. | W |
| A11Y-06 | `prefers-reduced-motion: reduce` → transitions are opacity-only ≤ 120 ms, smooth scroll becomes instant, Feed doesn't autoplay. Without it, the PRD §9 durations apply (± 20 ms). | W |
| A11Y-07 | Semantics: tab bar `<nav>` + `aria-current`; Segmented `tablist/tab` with `aria-selected`; sheets `role="dialog" aria-modal="true" aria-labelledby`; confirms `alertdialog`; toasts `status`; inline errors `alert`; uploads `progressbar` with `aria-valuenow`; SayBox `<blockquote>` with a visible label; badges included in accessible names. | W |
| A11Y-08 | `<html lang="es">` on every page; numbers and dates formatted `es-US`; form fields have labels; textareas are 16 px. | S W |

---

## 14. Visual state inventory (screenshots for review)

Captured on `phone-webkit-light` and `phone-webkit-dark` into `$SHOTS_DIR/v2/<project>/<state>.png` (**not committed**), and attached to the implementing PR as artifacts. The a11y suite runs axe on the same states.

| Screen | States |
|---|---|
| Bienvenida | default, clipboard-denied hint, each inline error |
| Dashboard | loading skeleton, full (hero case 4), hero cases 1/2/3/5, offline banner, key-changed, update banner, install banner, empty |
| Sheets | Script (not picked / picked / locked), Product, Products (3 segments), Task detail, Mail, Marcas, Note (with context, no mailbox), Outbox (queued, failed, offline), ActionSheet, Revoke dialog, Redo dialog, Forget dialog |
| Grabar | Por grabar (overdue + places), Grabados, empty both, single-scene |
| Creadoras | full, no manager, Worker error banner, offline, Anteriores expanded, empty |
| Review | Por revisar, Todas, player error, empty |
| Boards | Todos, Creadoras lane, with problem rows, collapsed/expanded sections, empty lane, missing key error |
| Board | owner (with and without owner token), approver (AI), viewer, creator; each take state; upload in progress with banner; leave dialog |
| Portal | PLP v1, PLP v2, board, inactive |
| Feed | card playing, Filters sheet, empty lane, empty filter, error, unidentified product |
| Ajustes | browser, standalone, raw key mode, install sheet |
| Desktop | Dashboard, Board, Feed at 1280×800 |

---

## 15. Performance checks (PERF)

| ID | Criterion | P |
|---|---|---|
| PERF-01 | Shell transfer ≤ 120 KB gzipped (all `app/*.js`, `lib/*.js`, `ui.css`), measured from the precache list. | S |
| PERF-02 | Warm start (SW + cached scene) → Dashboard content visible < 1.0 s; cold start < 2.0 s with Chromium network throttling «Fast 4G» and 4× CPU slowdown. | PWA C |
| PERF-03 | Board open (cached) → first SceneCard visible < 500 ms; no frame decrypt before it's within 1.5 viewports. | C |
| PERF-04 | No more than 3 concurrent media decrypts; all blob URLs created by a screen are revoked when leaving it (spy). | C |

---

## 16. CI changes

`.github/workflows/test.yml` (Phase 0/1):
```yaml
- run: npm ci
- run: npx playwright install chromium webkit --with-deps
- run: npm test                 # static + legacy run-*.mjs (until Phase 7) + test:feed (B-01)
- run: npx playwright test      # all projects in playwright.config.mjs
- run: bash scripts/check-secrets.sh
- uses: actions/upload-artifact@v4   # playwright-report/ and SHOTS_DIR (synthetic only), on failure and on main
```
`npm test` gains `test:feed` (B-01) and `test:static` (`node --test tests/static`). The Playwright HTML report is uploaded as a CI artifact, never committed.

---

## 17. Definition of done

A phase (and finally the whole project) is done only when **all** of these hold:

1. `npx playwright test` passes on every project in §3.1 with `retries: 0`; the only skips are the platform exclusions in §3.2 (the config asserts the skip list; an unexpected skip fails the run).
2. `npm test` (static suites, legacy suites still alive, secret scan) passes.
3. Every test ID referenced in ARCHITECTURE.md and PRD.md exists in the suite and passes (MIG-06 parity check generalized to all docs).
4. Every row of PRD §10 (feature traceability), §11 (R-01…R-20) and §12 (B-01…B-19) is covered by a passing test or, for generator/Worker items, by GEN-/WRK- tests passing in their repos.
5. axe: zero serious/critical (A11Y-01); contrast and target sampler: zero failures (A11Y-02/03).
6. Manual checks M-01…M-16 ticked in the PR description (M-14 by Jorge), with synthetic screenshots or recordings attached as artifacts only.
7. No real creator names, session ids, keys, tokens, deal amounts or private screenshots in the repo or PR (SEC-09 + reviewer check).
8. Phase-specific gates from IMPLEMENTATION-PLAN.md (e.g. redirectors only after parity, generator switches only after the reading viewer is live on Pages for 24 h) are satisfied.
