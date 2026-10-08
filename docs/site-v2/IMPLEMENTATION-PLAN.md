# Site v2 — Implementation plan

For the implementing agent. Read in this order: [ARCHITECTURE.md](ARCHITECTURE.md) §1 (decisions), [PRD.md](PRD.md), [QA-PLAN.md](QA-PLAN.md), then this plan. When documents disagree, the precedence is **ARCHITECTURE decisions › PRD › QA-PLAN › this plan**; record the conflict in your PR and follow the higher document.

---

## 0. Ground rules

1. **Small PRs.** One PR per task group below (each line `Tn.x` is at most one PR; a phase is usually 2–5 PRs). Every PR contains its code, its tests (QA IDs listed per task), and synthetic screenshots attached as CI artifacts (never committed).
2. **No build step, no framework, no new runtime dependency** (D-13). Vanilla ES modules served as-is by GitHub Pages. Dev-only dependencies allowed: `@playwright/test`, `axe-core`, `ajv`, `lucide-static` (icon extraction only).
3. **Never commit** real creator names, session ids, keys, tokens, mailbox UUIDs, deal amounts, private screenshots or anything from `assets/private/`. Fixtures use the synthetic set in QA-PLAN §2.3. `scripts/check-secrets.sh` must pass on every commit.
4. **Never run `wrangler deploy`** or touch production secrets. Worker changes are delivered as a PR in the Worker repo; Jorge (or the box) deploys.
5. **Copy comes only from `lib/copy.js`.** Status labels, tones and icons come only from `lib/status.js`. Icons come only from `lib/icons.js`. A screen that hard-codes any of these fails review.
6. **Every interpolation goes through `html```** (`lib/html.js`). No `innerHTML` with string concatenation outside that file.
7. **Viewers ship before the data they read** (ARCHITECTURE §16). At any commit on `main`, every link Jorge or a creator holds must open something correct.
8. Definition of done per PR: CI green (`npm test` + `npx playwright test`, retries 0), the QA IDs listed for the task pass, screenshots attached, no new skips.

---

## 1. Phase overview

| Phase | Goal | User-visible effect | Entry gate | Exit gate | Rollback |
|---|---|---|---|---|---|
| **P0** | Housekeeping and test harness in CI | Bug fixes only | — | CI runs feed + WebKit; B-01, B-02, B-13, B-15 fixed; goldens captured | revert PR |
| **P1** | `lib/` foundation | none | P0 | unit + gallery tests green | revert PR |
| **P2** | `app/` shell, keyring, Bienvenida, Dashboard, outbox | new unannounced URL `app/` | P1 | DSH/ONB/OUT/NOTE/SCR/PRD/MAIL/MAR suites green | revert PR (nobody depends on `app/` yet) |
| **P3** | Grabar, Creadoras, Review | `app/` usable end-to-end for the three tabs | P2 | GRB/CRE/REV green; Grok privately sends Jorge his `app/#…` link for early use | revert PR |
| **P4** | Shared board, Board screen, Boards library, portal rebuilt | portal restyled (same link) | P3 | BRD/BRD-T/APR/POR/UPL/SEC-05…07 green; portal merged in a safe window (§6.7) | revert the portal PR (Pages ~1 min) |
| **P5** | Feed | Feed in the app | P4 | FED green | revert PR |
| **P6** | PWA | installable app | P5 | PWA/AJU/PERF green; M-01…M-08 on real devices | SW kill switch (§6.2) + revert |
| **P7** | Redirectors and `index.html` shim | old links land in v2 | P6 + parity (MIG-06) + Jorge used `app/` ≥ 3 days without blockers | LNK/IDX/PRV green on Pages; M-16 | revert redirector PR (old pages restored; their scenes are still published) |
| **P8a** | Generators: `comando` v4, boards v2, filming owner filter, feed label | cleaner data, «Creadoras» in generated texts | P7 live 24 h | GEN-01…06, 09, 10 green; app renders v4 on Pages | flip `HUB_SCENE_VERSION=3` / `BOARDS_SCENE_VERSION=1` |
| **P8b** | Board v2 + FF board migration | old FF boards open in the Board template | P8a | GEN-07, MIG-05 | republish the old canvas shape with the same blob + key |
| **P8c** | Worker v1.1 + owner session + puller | «Subir video» on Jorge's boards | P8b + Jorge approves J-2 | WRK-01…08 (Worker repo), GEN-08, UPL-08 on Pages | `wrangler rollback` by Jorge; drop `ownerToken` from the scene |
| **P9** | Cleanup and final QA | none | P8c (or P8b if J-2 is declined) + 14 days of v4 | DoD (QA-PLAN §17) on Pages; Jorge ticks M-14 | resume publishing legacy scenes (nothing is deleted) |

---

## 2. Phases and ordered tasks

Each task lists **files**, **what to do**, and **tests** (QA IDs). «New» = new file, «Chg» = changed, «Redir» = becomes a redirector.

### P0 — Housekeeping and harness

| Task | Files | What | Tests |
|---|---|---|---|
| T0.1 | Chg `tests/run-feed.mjs`, `package.json` | Allow `creatorFeed.avatar` and `feed-want:` keys in the feed test's storage allowlist; add `test:feed` to `npm test` (B-01). | `npm test` |
| T0.2 | Chg `feed.html`, `index.html` | Remove `raw.githack.com` / `raw.githubusercontent.com` from the CSP **and** from the scene fetch fallback (B-02). | IDX-03, existing tests |
| T0.3 | Chg `comando.html` | Replace the literal `__CANVAS_HOST__` in the wrong-host error with the real host string (B-13). | existing comando test + new assertion |
| T0.4 | Chg `tests/run-*.mjs`, `tests/fixtures/*` | Replace any real-looking creator name with the synthetic set (Ana, Eva) (B-15). | `npm test` |
| T0.5 | Chg `README.md` | Document the current pages, the v2 docs folder, «Lo quiero» behavior (B-05 doc part), and the no-private-data rule. | — |
| T0.6 | New `playwright.config.mjs`, `tests/v2/helpers/*`, `tests/static/`, Chg `package.json`, `.github/workflows/test.yml` | Add devDependencies (`@playwright/test`, `axe-core`, `ajv`); projects per QA-PLAN §3.1; helpers `seal`, `site`, `net-guard`, `worker-mock`, `r2-mock`, `mailbox-mock`, `clock`, `a11y`, `fixtures`; CI installs Chromium + WebKit, runs `npx playwright test` and uploads the report. Start with one smoke spec that opens `comando.html` with a sealed fixture under the net guard. | smoke spec, SEC-04 guard |
| T0.7 | Chg `scripts/check-secrets.sh` | Allow `*.png` only under `app/icons/` and only if its SHA-256 is in `app/icons/ICONS.sha256` (D-21); optional `PRIVATE_NAME_DENYLIST` env check over tracked files (never commit the list). | SEC-09 |
| T0.8 | New `tests/fixtures/v2/golden/*.json` | Capture **golden payloads** (every mailbox POST of today's `comando.html`, `grabacion.html`, `feed.html`, `index.html` GO/changes) and **golden localStorage** (`hub-done`, `hub-picks`, `rec-ticks`, `rec-sync`, `creatorFeed.avatar`, `boards:av`) and a legacy `portal-uploads` IndexedDB record, by driving today's pages with synthetic fixtures. These goldens are the source of truth for OUT-08 and MIG-01…03 after the old pages are gone. | OUT-08, MIG-01…03, UPL-09 (later) |
| T0.9 | — (PR description) | J-3 check: list `JorgeDeArmas` repos with Pages enabled (`gh api` read-only); record the result in the PR. If any other Pages site exists, stop and flag it to Jorge (shared origin). | — |
| T0.10 | Agent-Skills repo: `grok-canvas/viewer/` | Replace the stale viewer copy with a README pointing to this repo (G-9, B-04). Separate PR in Agent-Skills. | — |

### P1 — `lib/` foundation (no user-visible change)

| Task | Files | What | Tests |
|---|---|---|---|
| T1.1 | New `lib/core.js` | Extract from today's viewers: host check (no placeholder), base64/base64url, AES-GCM scene and media decrypt, `fetchScene(b)` (`cache:"no-store"`), sanitizers (`txt`, `safeHttpsUrl(url, allowHosts)`, `safeMediaUrl`, `apiBaseOk`, `boardUrl`, `THUMB_RE`), `copyText` with the hidden-textarea fallback (B-18), `share({url})`. Pure functions, unit-tested in Node with `webcrypto`. | SEC-08 (units), CRE-04 (later) |
| T1.2 | New `lib/html.js` | `html` tagged template (escapes every `${}`), `raw()`, `classMap()`, `attr()`; the only place allowed to assign `innerHTML`. | SEC-04 static scan, SEC-08 |
| T1.3 | New `lib/dates.js` | ET business date, relative labels, overdue, expiry labels (PRD §7.6). Use `Intl.DateTimeFormat("es-US", {timeZone:"America/New_York"})`. | DAT-01, DAT-02 |
| T1.4 | New `lib/copy.js` | Every string from PRD §7 keyed exactly as listed, with `{placeholder}` interpolation `t(key, vars)`. | VOC-05 |
| T1.5 | New `lib/status.js` | PRD §6 tables: `video(id)`, `stage(id)`, `session(s, now)`, `job(id, role)`, `take(t, role)`, plus the legacy text → id maps. Returns `{label, tone, icon, action?}`. | VOC-01…04 |
| T1.6 | New `lib/lanes.js` | `LANES = {miamix:"Miami X", bella:"Creadoras", creadoras:"Creadoras"}` and `laneLabel(id)` that ignores scene labels. | VOC-05, BRD-02, FED-02 |
| T1.7 | New `scripts/vendor-icons.mjs`, `lib/icons.js` | Read the pinned `lucide-static` devDependency, extract the path data of exactly the icons in PRD §4.2, write `lib/icons.js` (`icon(name, {size=24, label})` → inline SVG, `aria-hidden` unless `label`). Header comment: Lucide ISC license notice. CI runs `vendor-icons.mjs --check`. | ICO-01 |
| T1.8 | New `lib/ui.css` | Tokens for light and dark (PRD §3), `[data-theme]` override, component classes (PRD §5), safe-area insets, reduced-motion rules. | THM-01, A11Y-02, A11Y-06 |
| T1.9 | New `lib/components.js` | AppBar, TabBar, Banner stack, Toast (+ Deshacer), Sheet (history entry, focus trap, swipe-down), Dialog/alertdialog, ActionSheet, Segmented (tablist + arrows), FilterChip, ListRow, StatusChip, Thumb (no broken-image glyph, B-10), Skeleton, EmptyState, ErrorState, PullToRefresh, FileButton, ProgressBar, Stepper, InitialAvatar, ShortcutTile, HeroCard, SayBox, DoLine, ConfirmDialog (PRD §5 C-01…C-40). | gallery tests below |
| T1.10 | New `tests/v2/pages/gallery.html`, `tests/v2/gallery.spec.mjs` | A test-only page (served by the route helper, not linked anywhere public) that renders every component in every variant and state; screenshot + axe + contrast + 44 px targets in light and dark. | A11Y-01…03, A11Y-07 on the gallery |
| T1.11 | New `tests/static/schemas.test.mjs`, `tests/fixtures/v2/*.json` | All fixtures from QA-PLAN §2.3; compile the four schemas with `ajv/dist/2020` strict; valid fixtures pass, ✗ fixtures fail with the expected keyword. | SCH-01…03 |

### P2 — `app/` shell, keyring, Bienvenida, Dashboard, outbox

| Task | Files | What | Tests |
|---|---|---|---|
| T2.1 | New `app/index.html`, `app/app.js`, `app/version.js` | Shell with the CSP of ARCHITECTURE §12.2 (no manifest link yet), `<main id="app">`, tab bar, router (route table §3.1, hash parsing §4.3, push screens, routed sheets, back rules), `store`, render/bind cycle, «don't re-render while typing», refresh loop (§5.3), theme from `meta.settings`. | NAV-01…04 (NAV-05 once Feed and Boards exist, P5), REF-01…03, ERR-01…05, THM-01 |
| T2.2 | New `lib/keyring.js`, `lib/screens/bienvenida.js` | IndexedDB `comando` v1 (`keys`, `outbox`, `meta`); `importFromHash` (§13.1) with non-extractable re-import and sub-key import from `keyring`; strip only when persisted (D-16); raw-key fallback; `decryptScene(role\|b)`; Bienvenida paste flow (§13.2) and its inline errors; key-changed state (§13.5); `pendingInstallLink` in memory only. | ONB-01…08, SEC-01…03 |
| T2.3 | New `lib/model.js` | `fromHubV3` (ARCHITECTURE §7.6 rules: verb → kind, product acts → tasks with dedupe by `act.id`, brands, grok, alerts, keyring from `quick`, ignore `creadoras`/`counters`/`rec:open`) and `fromComandoV4`; placeholder drop (R-20); grok de-dup against product stages. | SCH-04, DSH-13, DSH-14 |
| T2.4 | New `lib/outbox.js` | ARCHITECTURE §9: enqueue (optimistic), 4 s grace + undo-drop, coalescing keys, ticks 5-min batching + «Enviar ahora», backoff schedule, `failed` on 4xx (except 408/429), `keepalive` when hidden, per-channel mailbox resolution at send time (D-17), exact `fetch` options. | OUT-01…09 |
| T2.5 | New `lib/screens/dashboard.js` | App bar + status line, banners, HeroCard algorithm (cases 1–5; 2–3 skipped until P3 provides live sessions), Atajos (Feed/Boards subs from idle prefetch; each tile appears once its screen exists — see note), Por hacer (one action per row, row body → sheet), Productos, Marcas, Grok trabaja en, Avisos; Task detail, Mail and Marcas sheets. | DSH-01…14, MAIL-01…04, MAR-01…03 |
| T2.6 | New `lib/screens/product.js`, `lib/screens/scripts.js` | Product sheet (`#/producto/<pid>`) and Products sheet; Script sheet (segmented + snap panes, footer variants, picks via outbox). | PRD-01…06, SCR-01…08 |
| T2.7 | New `lib/screens/note.js`, `lib/screens/outbox-sheet.js` | Note sheet (context chip, prefill, draft in memory, discard confirm, no-mailbox banner) and Outbox sheet (human labels, Reintentar, Enviar ahora). | NOTE-01…05, OUT-07, TST-01 |
| T2.8 | New `lib/screens/ajustes.js` | Theme, keys list, «Actualizar ahora» (scene refresh only until P6), version, «Olvidar este teléfono» (§13.4). | AJU-01, AJU-03 |

Note for T2.5: until P4/P5 land, the Atajos tile for a missing screen is not rendered (no keyed links to legacy pages are built, so no key lands in browser history). `app/` is not announced to Jorge until P3 exits; during P3–P5 he keeps using the old pages for Feed and Boards.

### P3 — Grabar, Creadoras, Review

| Task | Files | What | Tests |
|---|---|---|---|
| T3.1 | Chg `lib/model.js`, New `lib/screens/grabar.js` | `fromFilming` and the merge with `keyring.filming` when the root is v3; `owner:"jorge"` filter (R-17); Grabar screen (segmented, day groups, overdue, places, VideoCard, toggle Grabado via outbox ticks, «Próxima grabación» status line, single-scene mode). | GRB-01…10, OUT-05, MIG-02 |
| T3.2 | New `lib/worker-api.js` | Manager calls (`sessions`, `extend`, `revoke`, `takes/:id/url`, `approve`, `redo`) and owner `GET /s/<ownerToken>`; strict response validation; Bearer only to `apiBaseOk` hosts. | WRK mock contract, SEC-01 |
| T3.3 | New `lib/screens/creadoras.js`, `lib/screens/review.js` | Session cards (merge scene + live, B-19 union, owner sessions hidden), order, Anteriores, Copiar (B-18 fallback) / Compartir (url only) / ⋯ ActionSheet with Extender, Revocar (alertdialog), Pedir link nuevo; read-only without manager token; offline behavior; Review sheet (`#/creadoras/<sid>/tomas`, ticket player, Aprobar, Re-grabar dialog, SayBox from the board beat). | CRE-01…10, REV-01…07 |
| T3.4 | Chg `lib/screens/dashboard.js`, `app/app.js` | Hero cases 2–3 with live data; tab badges (Grabar, Creadoras). | DSH-03, NAV-03 |

### P4 — Shared board, Board screen, Boards library, portal rebuild

| Task | Files | What | Tests |
|---|---|---|---|
| T4.1 | New `lib/upload.js` | Extract the resumable multipart client from today's `portal.html` **without changing** the Worker contract, the DB name (`portal-uploads` for the portal, `owner-uploads` for the app) or the record keys `${job}:${shot}:${take}`; add `name`/`lastModified` to new records; identity check with the size-only fallback for old records; retries ×4 (400/800/1600/3200 ms), concurrency 3, SHA-256 per part, wake lock, `beforeunload`. | UPL-03…07, UPL-09, UPL-10 |
| T4.2 | New `lib/board.js` | The shared renderer: sections (Referencia, Escenas, Guion, Subir video / Aprobar), jump chips, SceneCard with SayBox «LO QUE DICES» (22/29 bold) and DoLine «QUÉ HACES», lazy frames, FrameViewer, reference video on tap, Copiar guion, TakeRows with the PRD §6.5 states, roles `owner`/`approver`/`viewer`/`creator`, board v1 normalizer. | BRD-T-01…07, UPL-01, UPL-02, UPL-11, APR-01…04 |
| T4.3 | New `lib/screens/board-screen.js` | `#/board/<id>` and `#/board/v:<videoId>`: resolves the ref (boards scene, `videos[].boardRef`, learned `board:<b>`), role selection (owner with/without `ownerToken`, approver when `approvals[]`, viewer for creator products), Nota with context, leave-during-upload dialog. | BRD-T-06, UPL-08, NOTE-03 |
| T4.4 | Chg `lib/model.js`, New `lib/screens/boards.js` | `fromBoards` (v1 → v2 mapping, system-page filter B-07); library with lane Segmented (`boards:lane`, migrate `boards:av`), status sections, product groups, once-only rows, AI marker, Guías, «Board antiguo», «Sin link» + «Pedir a Grok». Render the Boards tile on Dashboard and the «Boards» action in Grabar. | BRD-01…10, SEC-10, MIG-03 |
| T4.5 | Chg `portal.html` | Rebuild on `lib/` (imports limited to the SEC-07 list), portal v1 + v2 normalizer, PLP with «Hola, {name}» and the shoot/expiry line, board role creator, `&p=` appended to the hash, inactive screen, CSP per ARCHITECTURE §12.2 (no `webhook.site`), «Falta» for empty takes (B-16). **Merge only in a safe window** (§6.7). | POR-01…05, UPL-*, SEC-05…07, LNK-08 |
| T4.6 | Chg `tests/run-portal.mjs`, `tests/run-board.mjs`, `tests/run-boards.mjs` | Keep them green against the rebuilt portal (assertions updated only where the PRD changes copy, e.g. «Falta»); they are deleted in P7 together with their pages (portal's stays until its v2 spec fully covers it, then deleted). | `npm test` |

### P5 — Feed

| Task | Files | What | Tests |
|---|---|---|---|
| T5.1 | New `lib/screens/feed.js` | Port today's feed behavior to the app: dark full-screen snap, encrypted covers and previews (±1 window, revoke blob URLs), lane Segmented via `LANES`, Filters sheet (window + creator + «Actualizado»), score badge, single product line (uses `product.line`, else the dedupe rule), rail metrics + Nota, «Lo quiero» via the outbox on the `feed` channel (D-17, B-14) persisted in `feed-want:<b>` (B-05), Abrir en TikTok and product pill with allowlists, honest empty states, errors, single-scene mode, reduced-motion (no autoplay). Render the Feed tile on Dashboard. | FED-01…18, OUT-06, MIG-03 |

### P6 — PWA

| Task | Files | What | Tests |
|---|---|---|---|
| T6.1 | New `app/icons/icon.svg`, `scripts/make-icons.mjs`, `app/icons/*.png`, `app/icons/ICONS.sha256` | Generate the icon set and 10 splash images deterministically with the pinned Playwright Chromium (ARCHITECTURE §12.3); `--check` mode for CI; update `check-secrets.sh` allowlist (T0.7). | PWA-12, SEC-09 |
| T6.2 | New `app/manifest.webmanifest`, Chg `app/index.html` | Manifest exactly as ARCHITECTURE §12.1; head tags of §12.2 (manifest link, apple meta, theme colors per scheme, splash links); CSP adds `worker-src 'self'; manifest-src 'self'`. | PWA-01, PWA-02, PWA-13 |
| T6.3 | New `app/sw.js`, `scripts/release.mjs` | Service worker per §12.4 (precache list with `?v=VERSION`, cache-first shell, network-first 4 s scenes storing only `{iv,ct}`, cache-first `.enc` media with caps and LRU, network-only API/R2/webhook, pass-through otherwise, old caches deleted on activate, `SKIP_WAITING` message). `release.mjs` computes VERSION (semver + shell content hash), writes it into `sw.js` and `app/version.js`, regenerates the precache list; `--check` in CI fails if anything is stale. | PWA-03, PWA-06…08, PERF-01 |
| T6.4 | Chg `app/app.js`, `lib/components.js` | SW registration (`updateViaCache:"none"`, update on boot and on visible, throttled 30 min), update banner and reload rules (never during upload / typing / sending), offline banner with data age, offline behavior per screen (§12.5). | PWA-04, PWA-05, PWA-09 |
| T6.5 | New `lib/screens/install.js`, Chg `lib/screens/dashboard.js`, `lib/screens/ajustes.js` | Install banners (iOS Safari, iOS other browsers, Android `beforeinstallprompt`, desktop Ajustes row only), 14-day dismissal, install sheet with «Copiar link para la app» only in the import session, «Instalada ✓», «Actualizar ahora» also calls `registration.update()`. | PWA-11, AJU-02, AJU-04 |
| T6.6 | Docs only (`docs/site-v2/IMPLEMENTATION-PLAN.md` §6.2 already has it) | Prepare the kill-switch `sw.js` as a ready-to-paste snippet in the runbook; test it in CI by serving it in place of `sw.js`. | PWA-10 |
| T6.7 | — | Real-device checks M-01…M-08 with the synthetic QA root link (QA-PLAN §12). | M-01…M-08 |

### P7 — Redirectors, `index.html` shim, preview

| Task | Files | What | Tests |
|---|---|---|---|
| T7.0 | New `tests/static/parity.test.mjs` | MIG-06 parity gate: every feature row in PRD §10 has a passing test ID in the latest Playwright JSON report. Must pass before T7.1 merges. | MIG-06 |
| T7.1 | New `lib/redirect.js`; Redir `comando.html`, `hub.html`, `grabacion.html`, `boards.html`, `feed.html`, `manager.html`, `board.html` | Replace each page with the identical redirector file of ARCHITECTURE §4.2 (`data-to="app/"`). The app's hash resolver (§4.3) picks the screen from the decrypted `type`. Delete the legacy `tests/run-{hub,comando,grabacion,boards,manager,board,hub-scripts}.mjs` in the same PR; their goldens live on in `tests/fixtures/v2/golden/`. | LNK-01…07, LNK-10, MIG-01…04 |
| T7.2 | Chg `index.html` | After decrypt, `type === "board"` → `location.replace("app/" + location.hash)`; unify note copy; githack already removed (T0.2). | LNK-09, IDX-01…03 |
| T7.3 | Chg `preview.html` | Synthetic static demo of the Dashboard + Board using `lib/` with inline fixture data, banner «Demo con datos de ejemplo.», CSP `connect-src 'none'`. | PRV-01 |
| T7.4 | — | M-16 on Pages with the synthetic QA links; Grok tells Jorge that his old links now open the new app. | M-16 |

### P8a — Generators (Agent-Skills repo)

Separate PRs in Agent-Skills; each behind its version switch, default = old.

| Task | Files (Agent-Skills) | What | Tests |
|---|---|---|---|
| T8a.1 | all builders, vendored `schemas/` | G-0: validate against the vendored schemas before sealing; publish nothing and alert on failure; a fixture per scene type. | GEN-01 |
| T8a.2 | `build_hub.py`, `hub_collect.py`, `hub_comando.py`, `picks.py`, `tracker.py` | G-1: emit `comando` v4 behind `HUB_SCENE_VERSION=4` (tasks with v3 ids, products with stage ids, videos with owner/status/boardRef, ticks, brand groups, grok without stage duplicates, creators with `jobs[].board`, alerts, keyring from `$CANVAS_INDEX`); remove verb prefixes and placeholders; «Bella» → «Creadoras» in every generated text. | GEN-02, GEN-03, GEN-05, GEN-09, GEN-10 |
| T8a.3 | `build_filming.py` | G-2: exclude creator-owned jobs; expose the per-video record for G-1. | GEN-04 |
| T8a.4 | `build_boards.py` | G-3: boards v2 behind `BOARDS_SCENE_VERSION=2`; exclude system pages; never emit `t=`/`m=`; keep the v1 `board` URL field during the transition. | GEN-06 |
| T8a.5 | `run_feed.py`, `creator_profile.json` | G-4: lane label «Creadoras»; emit `product.line`. | GEN-03 |
| T8a.6 | — | Flip the switches on the box after P7 has been live 24 h; verify the app on Pages with the QA root (synthetic) and ask Jorge for a quick look (Dashboard, Grabar, Boards). | M-14 (partial) |

### P8b — Board v2 and FF board migration

| Task | Files (Agent-Skills) | What | Tests |
|---|---|---|---|
| T8b.1 | `publish_board.py` | G-5: board v2 (`job`, `lane`, `status`, `approvals`) behind `BOARD_SCENE_VERSION=2`. | GEN-01 |
| T8b.2 | `publish_board.py` migrate subcommand | Republish every FF board currently rendered by `index.html` as `type:"board"` v2 **with the same blob + key** (dry-run first: list the boards and the planned changes in the PR; no keys in the PR). | GEN-07, MIG-05 |

### P8c — Worker v1.1, owner session, puller

| Task | Files | What | Tests |
|---|---|---|---|
| T8c.1 | Worker repo: `migrations/0005_session_kind.sql`, `src/*` | W-1a…W-1i exactly as ARCHITECTURE §11; vitest + miniflare tests. PR only; **Jorge deploys** (§6.5). | WRK-01…08 |
| T8c.2 | Agent-Skills `portal_build.py` | G-6: portal v2 fields; `owner ensure` subcommand run inside every hub build; `ownerToken` written into the hub build inputs; owner session never in `portals.json`/`creators[]`. | GEN-08 |
| T8c.3 | Agent-Skills `portal_pull.py` (Mac) | G-7: pull owner-session takes into `~/FilmFactory/jobs/<job>/03-takes/`. | puller unit test |
| T8c.4 | — | Verify on Pages: Jorge's board shows «Subir video»; a synthetic test job on the owner session uploads end-to-end (the box creates a throwaway job, then removes it). | UPL-08, M-09-style check by Jorge |

### P9 — Cleanup and final QA

| Task | Files | What | Tests |
|---|---|---|---|
| T9.1 | Agent-Skills `build_filming.py`, `portal_build.py` | Stop publishing the `filming` and `manager` scenes (blobs stay in git; old single-scene links show their last data). Only after Jorge has the app installed (M-14). | — |
| T9.2 | Chg `lib/model.js` | Remove `fromHubV3` only after 14 consecutive days of v4 publishes; keep `fromFilming`, `fromBoards` v1, board v1 and portal v1 normalizers (old links and creator sessions may still carry them). | SCH-04 updated |
| T9.3 | Chg `tests/run-portal.mjs` | Delete once `portal.spec` covers all its assertions. | — |
| T9.4 | — | Full DoD run (QA-PLAN §17) against Pages; all M checks; Jorge ticks M-14 and the HR list in the PR. | all |

---

## 3. Files to touch (summary)

| File | Phase | Kind |
|---|---|---|
| `package.json`, `package-lock.json`, `playwright.config.mjs`, `.github/workflows/test.yml` | P0 | Chg / New |
| `scripts/check-secrets.sh` | P0, P6 | Chg |
| `scripts/vendor-icons.mjs`, `scripts/make-icons.mjs`, `scripts/release.mjs` | P1, P6 | New |
| `tests/v2/**`, `tests/static/**`, `tests/fixtures/v2/**` | P0–P7 | New |
| `tests/run-*.mjs` | P0 (fix), P7/P9 (delete) | Chg / Del |
| `lib/core.js`, `html.js`, `dates.js`, `copy.js`, `status.js`, `lanes.js`, `icons.js`, `ui.css`, `components.js` | P1 | New |
| `lib/keyring.js`, `outbox.js`, `model.js`, `screens/{bienvenida,dashboard,product,scripts,note,outbox-sheet,ajustes}.js` | P2 | New |
| `lib/worker-api.js`, `screens/{grabar,creadoras,review}.js` | P3 | New |
| `lib/upload.js`, `board.js`, `screens/{board-screen,boards}.js` | P4 | New |
| `lib/screens/feed.js` | P5 | New |
| `lib/screens/install.js`, `app/sw.js`, `app/manifest.webmanifest`, `app/icons/*` | P6 | New |
| `app/index.html`, `app/app.js`, `app/version.js` | P2 (+P6) | New |
| `portal.html` | P4 | Chg (rebuild) |
| `comando.html`, `hub.html`, `grabacion.html`, `boards.html`, `feed.html`, `manager.html`, `board.html`; `lib/redirect.js` | P0 (fixes), P7 | Redir / New |
| `index.html` | P0, P7 | Chg |
| `preview.html` | P7 | Chg (synthetic demo) |
| `README.md` | P0, P9 | Chg |
| Agent-Skills: `build_hub.py`, `hub_collect.py`, `hub_comando.py`, `picks.py`, `tracker.py`, `build_filming.py`, `build_boards.py`, `run_feed.py`, `creator_profile.json`, `publish_board.py`, `publish_canvas.py`, `portal_build.py`, `portal_pull.py`, `grok-canvas/viewer/` | P0, P8a–c, P9 | Chg |
| Worker repo: `migrations/0005_session_kind.sql`, `src/*`, tests | P8c | New / Chg |

---

## 4. Risks and mitigations

| # | Risk | Likelihood / impact | Mitigation | Detection |
|---|---|---|---|---|
| K-1 | iOS paste onboarding confuses Jorge or the clipboard read fails | med / high | Textarea fallback with the hint; «Copiar link para la app» in the install sheet; Grok can resend the link; M-03 on a real iPhone before P7 | M-03, Jorge feedback |
| K-2 | Portal rebuild breaks a creator mid-session (link or resumable upload) | low / high | Same URL, hash, scene v1 and IndexedDB record keys; compat goldens (UPL-09, LNK-08); merge only in a safe window (§6.7); revert in ~1 min | POR/UPL suites, creator report |
| K-3 | A bad service worker pins a broken shell | low / high | `updateViaCache:"none"`, update check on every open, release `--check`, kill switch (§6.2), app works without SW | PWA-09/10, Ajustes version |
| K-4 | A generator v4 bug breaks the Dashboard | med / med | G-0 schema gate blocks publishing; the viewer reads v3 and v4; flip back the switch; last good scene stays in cache | GEN suite, app status line «No se pudo actualizar» |
| K-5 | Mailbox payload drift breaks ingest (taps lost silently) | low / high | Golden payload equality (OUT-08) captured from today's pages before they're replaced | OUT-08 |
| K-6 | Another Pages site on the same origin can use the keyring | low / high | J-3 check in P0; non-extractable keys; strict CSP | T0.9 |
| K-7 | WebKit-in-CI flakiness slows delivery | med / low | Shard specs, deterministic clock and fixtures, `retries: 0` with root-cause fixes, platform exclusions limited to QA-PLAN §3.2 | CI history |
| K-8 | Icon PNG rendering drifts between Chromium versions | med / low | Pin the Playwright version; regenerate icons in a dedicated PR when it changes | `make-icons --check` |
| K-9 | Shell exceeds the 120 KB budget | low / med | Lucide subset only; no libraries; PERF-01 in CI | PERF-01 |
| K-10 | v3 → v4 switchover re-shows done tasks or duplicates them | med / med | v4 task ids = v3 ids (GEN-02); local done memory keyed by id; MIG-04 | MIG-04 |
| K-11 | Owner token exposure | low / high | Sealed only in the root scene; never in portal scenes or links; SEC-06; revocable; the box recreates it | SEC-06, WRK-02 |
| K-12 | Worker v1.1 deploy delayed or declined (J-2) | med / low | Owner upload hidden without `ownerToken`; «Pasar tomas a la Mac» stays | UPL-08 |
| K-13 | Feed/boards idle prefetch costs data on cellular | low / low | Prefetch after first paint only; skip when `navigator.connection.saveData` is true; covers and previews are never prefetched | PERF-02 |
| K-14 | iOS evicts the installed app's storage (rare) | low / low | Bienvenida reappears; Jorge pastes the link again | Jorge report |
| K-15 | Private data leaks via screenshots or fixtures | low / high | Synthetic fixtures only; screenshots never committed; SEC-09 + denylist; reviewer checklist | SEC-09 |

---

## 5. Rollback per phase

| Phase | Rollback action | Data impact |
|---|---|---|
| P0–P3, P5 | Revert the PR. `app/` is a new URL nobody depends on before P7. | None |
| P4 (portal) | Revert the portal PR; Pages serves the old `portal.html` in ~1 min. Upload records are compatible both ways (same keys; the extra `name`/`lastModified` fields are ignored by the old portal). | None |
| P6 (PWA) | Deploy the kill switch (§6.2), then revert. Keys in IndexedDB are untouched, so the app keeps working online. | Caches cleared |
| P7 | Revert the redirector PR: the old viewers come back from git. Their scenes are still published (v3/v1 until P8a; filming and manager until P9). | None |
| P8a | On the box: `HUB_SCENE_VERSION=3`, `BOARDS_SCENE_VERSION=1`, re-run the hub build. The app reads both. | None |
| P8b | Republish the affected boards with `publish_canvas.py` (same blob + key) → `index.html` renders them again (the shim only redirects `type:"board"`). | None |
| P8c | Jorge runs `wrangler rollback`; the D1 column is additive and harmless; the box stops writing `ownerToken`, so the upload section disappears. | Owner takes already uploaded stay in R2 and are pulled |
| P9 | Resume publishing `filming`/`manager`; restore `fromHubV3` from git. Nothing is deleted in P9. | None |

---

## 6. Runbook

### 6.1 Releasing a viewer change
1. PR with code + tests; CI green (`npm test`, `npx playwright test`, `check-secrets.sh`, `release.mjs --check`, `vendor-icons.mjs --check`, `make-icons.mjs --check`).
2. If any shell file changed: `node scripts/release.mjs` (bumps VERSION in `sw.js` and `app/version.js`, regenerates the precache list) in the same PR.
3. Merge → Pages deploys in ~1 min.
4. Open the synthetic QA root link (`QA_DEMO_ROOT_LINK` secret) on Pages: Ajustes shows the new version after «Actualizar»; spot-check the changed screens in light and dark.
5. User-facing phases: run the M checks listed for the phase.

### 6.2 Service worker kill switch
Replace `app/sw.js` with the following, bump nothing else, merge:
```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const name of await caches.keys()) await caches.delete(name);
  await self.registration.unregister();
  for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
})()));
```
Effect: on the next open every client drops all caches, unregisters, and reloads from the network. IndexedDB (keys, outbox) is untouched. Restore the real `sw.js` in a follow-up PR once fixed.

### 6.3 Lost or stolen phone
1. Grok rotates the **root** key: new blob id + key for the root theme (the old ciphertext stays in git history, as today). Sub-scene keys may be rotated too if Jorge asks (they're reachable from the old root's keyring).
2. Rotate the manager token (`MANAGER_TOKEN_PREV` grace window) and revoke the owner session (`POST /admin/sessions/:id/revoke`); the box creates a new one on the next build.
3. Rotate the hub mailbox UUID (`scene.mailbox`).
4. Send Jorge the new Comando link through the usual private channel; on his new phone he opens it (Safari) or pastes it (installed app). The old phone's keyring now fails to decrypt and shows «Tu link cambió».

### 6.4 Jorge gets a new phone or reinstalls
Open the Comando link in Safari → Dashboard → install banner → «Ver cómo» → «Copiar link para la app» → add to home screen → open → «Pegar link». No rotation is needed.

### 6.5 Worker v1.1 deploy (Jorge or the box only)
1. Review the Worker PR (tests green: WRK-01…08).
2. `wrangler d1 migrations apply <db> --remote` (adds the `kind` column; existing rows default to `creator`).
3. `wrangler deploy`.
4. Smoke: today's portal link still loads (`GET /s/:token` 200); `GET /manager/sessions` lists the same sessions plus `kind`.
5. Run `portal_build.py owner ensure` once on the box; the next hub build seals `ownerToken`.
6. Rollback: `wrangler rollback`; the column can stay.

### 6.6 Flipping generator versions
On the box: set `HUB_SCENE_VERSION`, `BOARDS_SCENE_VERSION`, `BOARD_SCENE_VERSION` in the routine environment, run the build once by hand, confirm the schema gate passed and the commit landed, then open the app on Pages. To undo, set the old value and rebuild (§5).

### 6.7 Creator-safe deploy window (portal changes)
Merge portal changes only when no creator is expected to be uploading: Grok checks the active sessions on the box (shoot dates and recent `uploaded_at`) and confirms in the PR **without naming anyone** («ninguna sesión con subidas en las últimas 6 h ni grabación hoy»). If a creator reports a problem after a deploy: revert first, investigate after.

### 6.8 Hotfix
Small PR from `main`, same CI, release bump if the shell changed. Never disable a test to ship; if a test is wrong, fix the test in the same PR with a note.

---

## 7. Production-readiness checklist

- [ ] QA-PLAN §17 definition of done: all automated suites green with retries 0; only the allowed platform skips.
- [ ] M-01…M-16 ticked on Pages (M-14 by Jorge).
- [ ] Every HR in QA-PLAN §4 has passing tests.
- [ ] Every PRD §10 feature, §11 redundancy and §12 bug row has a passing test (MIG-06).
- [ ] axe: zero serious/critical; contrast and target samplers clean, in light and dark.
- [ ] No real names, session ids, keys, tokens, mailbox UUIDs, amounts or private screenshots in the repo or the PRs.
- [ ] `check-secrets.sh` passes; icons hash-listed.
- [ ] Old links (each legacy page, an old FF board, the active creator portal) verified on Pages.
- [ ] Runbook §6.2 kill switch tested in CI (PWA-10).
- [ ] Jorge has the app installed and has pasted his link.
- [ ] Decisions J-1…J-3 recorded in the final PR (answered or defaulted).

---

## 8. Open items for Jorge (from ARCHITECTURE §1.3)

| # | Question | Default if unanswered | Phase affected |
|---|---|---|---|
| J-1 | 4th tab «Feed»? (flag `tabsWithFeed`) | 3 tabs; Feed is 1 tap from the Dashboard | none (flag only) |
| J-2 | Approve deploying Worker v1.1 so he can upload from his own boards | No owner upload; «Pasar tomas a la Mac» stays | P8c |
| J-3 | Confirm there are no other GitHub Pages sites under `jorgedearmas.github.io` | Assume none; P0 checks and reports | P0 |
