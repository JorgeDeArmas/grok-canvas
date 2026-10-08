# Site v2 — Product Requirements (PRD)

> Source of truth for **what the user sees and does**. Architecture, contracts and security: [ARCHITECTURE.md](ARCHITECTURE.md). Tests: [QA-PLAN.md](QA-PLAN.md). Build order: [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md).
>
> **Copy rule:** every user-visible string in this PRD is final Spanish copy, written between «» or in `code`. The implementation puts each string in `lib/copy.js` under the key shown in §7 and never invents new copy. If a string is missing, add it to §7 in the same PR.
>
> Public repo rule: examples use synthetic data only («Ana», «Producto A», «Marca X»).

---

## 0. Summary

### 0.1 What Jorge gets
- **One app on his phone, «Comando»**, installable from Safari or Chrome. It opens on **Dashboard**. Three tabs at the bottom: **Dashboard · Grabar · Creadoras**. Feed and Boards are one tap away.
- **Dashboard** answers «¿qué hago ahora?»: one big «Lo próximo» card, then one list «Por hacer» where every row has one button. Below it, quiet summaries of products, brands and what Grok is doing.
- **Grabar** is the only filming list: by day, «Abrir board» and «Grabado».
- **Creadoras** is the only place for creator links, the take review, and extending or revoking.
- **Boards** is reorganized by «what's happening» (Con problema, Por grabar, Editando, Publicados…). Each product appears once with its videos inside it. There are no codes and no filters by type.
- **One board for everyone:** reference video → scenes, each with a big **«Lo que dices»** box and a smaller «Qué haces» line → script → **«Subir video»**.
- **Feed** keeps everything (lanes, windows, creators, «Lo quiero», product, TikTok). The filters move into one sheet, and each card shows one product line.
- **«Creadoras»** replaces «Bella» everywhere.

### 0.2 What was removed and why

| Removed | Why | Replaced by |
|---|---|---|
| Counter tiles (por elegir / por publicar / por grabar / productos) | They triple-counted with the badges and section counts (R-16) | Tab badges for actionable things only |
| «Más» tab and its «Creadoras» section | Duplicated the Creadoras tab (R-01) | The Dashboard tab (default), with Creadoras only in its own tab |
| `hub.html` view (tiles, quick links) | A second viewer for the same data (R-11) | Dashboard |
| `grabacion.html`, the «Grabación · todos los boards por grabar» row, and the «Por grabar» section inside the hub | Three parallel filming lists (R-03) | The Grabar tab |
| Verb prefixes («Grabar ·») and identical subtitles on every row | No information value (R-06) | Product name plus what differs (day, place) |
| «Lo próximo» repeated as the first list row | Same item twice (R-04) | The hero item is removed from the list |
| Chip + subtitle + group all saying the same state | Repetition (R-05) | One chip + one action |
| The footer and «Nota para Grok» repeated on every tab | Repetition (R-07, R-19) | «Avisos» on Dashboard only; the note is one sheet reachable from every screen |
| Boards: per-card avatar chip, type chip, code, «qué es» line, type filter chips; system pages listed as boards | Noise and misclassification (R-08) | Status sections → product groups → video rows |
| `manager.html` | Duplicated Creadoras (R-12) | The Creadoras tab |
| The old 17-block board (`index.html`) for Jorge's boards | VO and action repeated 4× (R-09, R-10) | The single board template |
| Feed: three rows of filter chips over the video; sales repeated 3× | Clutter (R-14) | Lane switch plus one «Filtros» button, and one product line |
| Emoji and character icons (✍️ 🎬 ✓ ✕ ‹ ★) | Inconsistent (B-08, HR-07) | One Lucide SVG set |
| Raw ISO dates, past dates shown as upcoming | Confusing (R-15) | Relative dates and an explicit «Atrasado» |
| «Feed v3» score label | Internal jargon | «Score» |

---

## 1. Users and entry points

| User | Entry | What they can reach |
|---|---|---|
| Jorge (installed) | Home-screen icon «Comando» → `app/` (Dashboard) | Everything |
| Jorge (browser) | His Comando link (old `comando.html#…` or `hub.html#…` → redirects to `app/`), any old link (feed, grabación, boards, board, manager) → the matching screen | Everything once the root key is imported. Without it: only that one screen (single-scene mode). |
| Creator | `portal.html#b&k&t` from WhatsApp | Only her products and her boards with upload |
| Grok | Reads the mailbox; generates scenes | — |

---

## 2. Global UI

### 2.1 App frame (Jorge's app)

```
┌───────────────────────────────────────────┐  ← safe-area-inset-top
│ App bar                                    │
│  Dashboard                    [Nota] [⚙]   │  large title 28/34 bold; trailing actions
│  Actualizado hace 5 min · [2 por enviar]   │  status line 13/18 muted + pills
├───────────────────────────────────────────┤
│ (banners: update / offline / install)      │
│                                            │
│ Screen content (scrolls)                   │
│                                            │
├───────────────────────────────────────────┤
│ [▦ Dashboard] [🎥 Grabar 3] [👥 Creadoras 2]│  bottom tab bar 56 px + safe-area-inset-bottom
└───────────────────────────────────────────┘
```

(Icons drawn here as emoji only for the wireframe; the UI uses Lucide SVGs, §4.)

### 2.2 App bar (`AppBar`)
- **Large variant** (tabs): title 28/34 bold, left-aligned, 16 px side padding. Collapses to a compact 17/22 semibold centered title with a hairline border when scrolled > 40 px. Background: `--bg` at 88 % with a 16 px backdrop blur.
- **Compact variant** (push screens: Boards, Board, Ajustes): a leading back button `‹` (Lucide `chevron-left`, 44×44, `aria-label="Atrás"`) plus a centered title 17/22 semibold, one line with ellipsis.
- **Trailing actions** (max 2, each ≥ 44×44):
  - **Nota** pill: Lucide `message-square-text` 18 px + label «Nota». Opens the Note sheet (§8.13). Present on Dashboard, Grabar, Creadoras, Boards and Board (owner). In Feed it moves to the right rail.
  - **Ajustes** icon button: Lucide `settings`, `aria-label="Ajustes"`. Dashboard only.
  - **Boards** pill: Lucide `layout-grid` + «Boards». Grabar only (in place of Ajustes).
- **Status line** (tabs only, 13/18): «Actualizado hace 5 min» (relative, refreshed every 30 s). Tapping it refreshes the data (same as pull-to-refresh). Variants:
  - Refreshing: «Actualizando…» with a 12 px spinner (`loader-circle`, rotating; static under reduced motion).
  - Stale > 3 h: «Sin actualizar desde las 7:00» in the warn ink (the routine probably failed).
  - Offline: pill «Sin conexión» (`wifi-off`, neutral).
  - Outbox: pill «2 por enviar» (`inbox`, warn tint) → Outbox sheet (§8.14). Hidden when 0.
  - Error (last refresh failed but online): «No se pudo actualizar» + «Reintentar» text button.

### 2.3 Bottom tab bar (`TabBar`)
- `<nav aria-label="Secciones">`. Three equal items, each a ≥ 56 px tall link with a 24 px icon above a 11/13 semibold label. The selected item has `aria-current="page"`, accent color and the filled icon variant (Lucide stroke icons at a 2.25 stroke plus an accent tint pill behind the icon, 56×28, radius 14).
- Items, **in this order**: **Dashboard** (`layout-dashboard`), **Grabar** (`video`), **Creadoras** (`users`).
- **Badges** (P-6): a red count pill at the top-right of the icon (min 18×18, 11/13 bold, `--bad` background, white ink). They are announced as part of the label, e.g. `aria-label="Grabar, 3 por grabar"`.
  - Dashboard: number of «Por hacer» tasks + 1 if a hero exists that is not from the list (the hero kinds in §8.2.3). Hidden when Dashboard is selected.
  - Grabar: Jorge's videos with status `to_film` and `ready`, due today, overdue, or undated.
  - Creadoras: takes in state `uploaded` (awaiting review) across active sessions, + sessions expiring today with work pending. Without a manager token: no badge.
- Hidden on push screens (Feed, Boards, Board, Ajustes, Bienvenida) and in single-scene mode.
- With `TABS_WITH_FEED=true` (J-1): a 4th item **Feed** (`play`) with no badge.

### 2.4 Banners (`Banner`) — stacked under the app bar, max 2 visible
| Banner | When | Copy | Actions | Tone / icon |
|---|---|---|---|---|
| Update | A new SW is waiting | «Hay una versión nueva» | «Actualizar» (primary small) | info / `refresh-cw` |
| Offline | `navigator.onLine === false` and the data is from the cache | «Sin conexión · datos de hace {tiempo}» | — | neutral / `wifi-off` |
| Install (iOS Safari) | Not standalone, not dismissed in the last 14 days, root imported | «Instala Comando en tu iPhone» | «Ver cómo» (opens §8.16), ✕ | accent / `smartphone` |
| Install (Android/desktop Chromium) | `beforeinstallprompt` fired | «Instala Comando» | «Instalar», ✕ | accent / `smartphone` |
| Key changed | The stored root key fails | «Tu link cambió. Pega el link nuevo del Comando.» | «Pegar link» | warn / `link-2-off` |

### 2.5 Toast (`Toast`)
Bottom-center, 16 px above the tab bar (or above the safe area when there's no tab bar). When a sheet is open it moves to the top (below the safe area). Max width 480. Dark surface in both themes (`--toast-bg`), white text 15/20. An optional action button «Deshacer» (accent-light ink, 44 px). Auto-hides after 5 s (6 s with Deshacer). `role="status"`, `aria-live="polite"`. A new toast replaces the current one, and the replaced Deshacer is considered declined.

### 2.6 Theme
`prefers-color-scheme` by default. Ajustes › Tema: «Automático» / «Claro» / «Oscuro» (stored in `meta.settings.theme`, applied as `data-theme` on `<html>`). The Feed is always dark. `meta[name=theme-color]` is updated to `--bg` of the active theme.

### 2.7 Pull to refresh (`PullToRefresh`)
On Dashboard, Grabar, Creadoras and Boards: pulling down at `scrollTop === 0` shows a 32 px spinner that follows the finger. Release past 64 px → refresh (same as the status-line tap). Release earlier → cancel. Haptic-free. Under reduced motion: no elastic movement, the spinner just appears. Disabled while a sheet is open.

### 2.8 Desktop (≥ 900 px)
Content in a centered column, max-width 720 px. The tab bar becomes a floating bar centered at the bottom (max-width 480). Sheets become centered dialogs (max-width 640, radius 20). The Feed card is centered at 9:16, max-height 100 dvh, on a black background. Every interaction is the same; hover states are added (§3.8).

---

## 3. Design tokens

Defined once in `lib/ui.css` as CSS custom properties on `:root` (light) and `:root[data-theme=dark]` / `@media (prefers-color-scheme: dark)` (dark). **Contrast values are computed with WCAG 2.x relative luminance;** QA verifies them with axe (A11Y-02).

### 3.1 Color

| Token | Light | Dark | Use | Contrast (text tokens vs `--surface`) |
|---|---|---|---|---|
| `--bg` | `#F2F2F7` | `#000000` | page background | — |
| `--surface` | `#FFFFFF` | `#1C1C1E` | cards, sheets, rows | — |
| `--surface-2` | `#F7F7FA` | `#2C2C2E` | nested blocks, inputs | — |
| `--surface-pressed` | `#E9E9EE` | `#3A3A3C` | pressed rows, secondary buttons | — |
| `--line` | `rgba(60,60,67,.16)` | `rgba(255,255,255,.14)` | hairlines | — |
| `--text` | `#1C1C1E` | `#F5F5F7` | primary text | 16.7:1 / 16.0:1 |
| `--text-2` | `#5E5E63` | `#AEAEB2` | secondary text | 6.3:1 / 7.2:1 |
| `--muted` | `#6E6E73` | `#A1A1A6` | meta, captions (≥ 13 px) | 5.1:1 / 6.6:1 |
| `--primary` | `#0060DF` | `#0060DF` | filled primary buttons, selected tab | white ink 5.6:1; vs bg ≥ 3:1 (UI) |
| `--primary-ink` | `#FFFFFF` | `#FFFFFF` | text on primary | — |
| `--link` | `#0060DF` | `#4DA3FF` | text links, accent text, «LO QUE DICES» label | 5.6:1 / 6.5:1 |
| `--say-bg` | `#EAF3FF` | `#10273F` | «Lo que dices» box | — |
| `--say-line` | `#8EC0FF` | `#2F6FB8` | its 1.5 px border | — |
| `--good` | `#1E7B34` | `#30D158` | success ink | 5.3:1 / 8.4:1 |
| `--warn` | `#A84300` | `#FF9F0A` | warning ink | 6.0:1 / 8.0:1 |
| `--bad` | `#D70015` | `#FF453A` | error / destructive ink, badge background | 5.4:1 / 5.0:1 |
| `--info` | `#5E5CE6` | `#8E8CFF` | info ink («Editando») | 5.4:1 / 5.9:1 |
| `--teal` | `#00777F` | `#40C8E0` | «Grabado», «Llegó» | 5.3:1 / 9.0:1 |
| `--neutral` | `#5E5E63` | `#AEAEB2` | neutral chip ink | 6.3:1 / 7.2:1 |
| `--tint-{tone}` | `color-mix(in srgb, var(--{tone}) 13%, var(--surface))` | `color-mix(in srgb, var(--{tone}) 22%, var(--surface))` | chip/tile backgrounds | chip ink on tint ≥ 4.5:1 (QA-checked) |
| `--toast-bg` | `#2C2C2E` | `#3A3A3C` | toast | white 13:1 / 11:1 |
| `--scrim` | `rgba(0,0,0,.40)` | `rgba(0,0,0,.60)` | behind sheets | — |
| `--focus` | `#0060DF` | `#4DA3FF` | focus ring | ≥ 3:1 vs adjacent |
| Feed only | bg `#000`, text `#FFF`, muted `rgba(255,255,255,.72)`, chip `rgba(255,255,255,.16)` | same | | white on scrimmed video ≥ 4.5:1 thanks to the gradient scrim |

Tones used by chips and icons: `neutral, accent (=--link), good, warn, bad, info, teal`.

### 3.2 Typography
System stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Numbers in counts and progress use `font-variant-numeric: tabular-nums`. Sizes are in px at the default text size; the root scales with the browser text-size setting (`html { font-size: 100% }`, and every token is in `rem`).

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `--t-display` | 28 / 34 | 700, −0.02em | large app-bar title |
| `--t-say` | 22 / 29 | 700, −0.01em | **«Lo que dices» text** (the largest text on a board) |
| `--t-title` | 20 / 26 | 700 | hero title, sheet title |
| `--t-headline` | 17 / 22 | 600 | section titles, compact app-bar title, row title in cards |
| `--t-body` | 16 / 22 | 400 | body, row titles in lists (600) |
| `--t-callout` | 15 / 20 | 400 / 600 | buttons, «Qué haces» text |
| `--t-sub` | 14 / 19 | 400 | row meta |
| `--t-foot` | 13 / 18 | 400 | status line, captions |
| `--t-label` | 12 / 16 | 700, uppercase, +0.06em | box labels («LO QUE DICES», «QUÉ HACES»), group headers |
| `--t-tab` | 11 / 13 | 600 | tab labels, rail metric labels |

### 3.3 Spacing (4-pt grid)
`--s-1: 4px · --s-2: 8px · --s-3: 12px · --s-4: 16px · --s-5: 20px · --s-6: 24px · --s-8: 32px · --s-10: 40px`. Page side padding 16. Card inner padding 16 (12 for rows). Gap between sections 24. Row vertical padding 12.

### 3.4 Radius
`--r-sm: 8px` (small thumbs, inputs) · `--r-md: 12px` (buttons, thumbs 48+) · `--r-lg: 16px` (cards, «Lo que dices») · `--r-xl: 20px` (sheets, hero) · `--r-pill: 999px` (chips, pills, badges).

### 3.5 Elevation
| Token | Light | Dark |
|---|---|---|
| `--e-0` | none | none |
| `--e-1` (cards) | `0 1px 2px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.05)` | none (use `--surface` against `--bg`) |
| `--e-2` (sheets, tab bar) | `0 -2px 24px rgba(0,0,0,.10)` | `0 0 0 1px var(--line)` |
| `--e-3` (toast, dialogs) | `0 8px 28px rgba(0,0,0,.28)` | `0 8px 28px rgba(0,0,0,.6)` |

### 3.6 Motion
| Token | Value | Use |
|---|---|---|
| `--m-fast` | 120 ms | press feedback, chip toggle |
| `--m-base` | 200 ms | fades, toast, row removal |
| `--m-sheet` | 280 ms | sheets, push screens |
| `--ease` | `cubic-bezier(.2,.8,.2,1)` | everything |

`@media (prefers-reduced-motion: reduce)`: no transforms or slides; fades of at most 120 ms; spinners become static icons with «Cargando…».

### 3.7 Z-index
`app bar 10 · tab bar 10 · banner 11 · scrim 40 · sheet 50 · dialog 55 · toast 60 · update banner (when a sheet is open) 61`.

### 3.8 Interaction states
- Pressed: background `--surface-pressed` for rows and secondary buttons; `filter: brightness(.92)` for primary; `transform: scale(.98)` (skipped under reduced motion).
- Focus visible: a 3 px `--focus` outline with a 2 px offset on every interactive element (`:focus-visible`).
- Hover (desktop only, `@media (hover:hover)`): the row background is `--surface-2`.
- There's no disabled-looking primary button anywhere. When an action isn't possible, the button is **not rendered** and a reason is shown instead (HR-06).

---

## 4. Iconography

### 4.1 Set and rules
- **Lucide** (ISC license), pinned version (the implementation records the exact version in `lib/icons.js`'s header, together with the license text). Only the icons below are vendored, as path data. Rendered inline: `<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`.
- Sizes: 16 (inside chips), 18 (inside buttons), 20 (row leading icons in tiles), 24 (tab bar, app bar, rail), 28 (empty states use 40 inside a 72 px tinted circle).
- Color = `currentColor`. A status icon takes its tone ink, and an icon inside a button takes the button ink.
- **Icons are never alone without a text label**, except: back `‹` (`aria-label="Atrás"`), close ✕ (`aria-label="Cerrar"`), Ajustes ⚙ (`aria-label="Ajustes"`), the feed rail metrics (the number is the label), and the take-row status circle (paired with a status word).
- If a name differs in the pinned Lucide version, use the documented alias (in parentheses) and keep the meaning.

### 4.2 Icon table

| Icon (Lucide name) | Meaning | Where |
|---|---|---|
| `layout-dashboard` | Dashboard | tab bar |
| `video` | Grabar / «Por grabar» | tab bar, status `to_film`, hero «Grabar hoy» |
| `users` | Creadoras | tab bar, Creadoras empty state |
| `play` | Feed | Atajos tile, optional 4th tab, reference player play button |
| `layout-grid` | Boards | Atajos tile, Grabar app-bar pill, Boards empty state |
| `message-square-text` | Nota para Grok | app bar «Nota», feed rail, Note sheet header |
| `settings` | Ajustes | Dashboard app bar |
| `chevron-left` | Atrás | compact app bar, feed top bar |
| `chevron-right` | Opens detail | trailing in overview rows |
| `chevron-down` | Expand / collapse | collapsed sections («Ver 6 más») |
| `x` | Cerrar | sheets, banners |
| `check` | Hecho (inside the ✓ round button) | task rows with done |
| `circle` | Toma: falta | take row status circle |
| `loader-circle` (alias `loader-2`) | Cargando / subiendo | spinners, take uploading |
| `circle-check` (alias `check-circle-2`) | Grabado / Subido / Aprobado / Listo | status `filmed`, take uploaded/approved, success toasts (none in toasts; text only) |
| `circle-pause` | En pausa (upload cut) | take row paused |
| `upload` | **Subir video** | primary upload button |
| `refresh-cw` | Reanudar · Actualizar | resume button, update banner |
| `rotate-ccw` | Re-grabar | redo button, status `redo` |
| `thumbs-up` | Aprobar / Dar GO / «Por aprobar» | approve buttons, status `to_approve`, task `approve_media` |
| `copy` | Copiar | «Copiar link», «Copiar guion», «Copiar búsqueda» |
| `share` | Compartir (iOS-style share) | «Compartir» link, install guide step 1 |
| `square-plus` (alias `plus-square`) | Agregar a inicio | install guide step 2 |
| `calendar-plus` | Extender | Extender 3 días |
| `ban` | Revocar | Revocar link |
| `ellipsis` (alias `more-horizontal`) | Más acciones | session card overflow |
| `link-2-off` | Sin link / link cambió | board problem «Sin link», key-changed banner |
| `wifi-off` | Sin conexión | offline pill and banner |
| `inbox` | Por enviar (outbox) | outbox pill and sheet |
| `send` | Publicar / «Por publicar» | task `publish`, status `to_publish`, «Enviar» in Note sheet |
| `badge-check` | Publicado | status `published` |
| `hourglass` | Preparando | status `preparing` (board en camino) |
| `scissors` | Editando | status `editing` |
| `triangle-alert` (alias `alert-triangle`) | Con problema / atrasado / error | status `problem`, error states, task `brand_bounce` |
| `archive` | Retirado | status `retired`, collapsed «Retirados» |
| `pen-line` | Elegir guion | task `pick_script`, stage `pick_script` |
| `package` | Muestra | task `sample`, stage `sample_requested` |
| `truck` | En camino | stage `sample_shipping` |
| `package-check` | Llegó / Entregar | stage `arrived`, task `deliver` |
| `search` | Investigando | stage `researching`, grok rows |
| `sparkles` | Grok / IA | «Grok trabaja en» header, AI board marker |
| `handshake` | Decidir oferta | task `brand_decide`, stage `brand_hold` |
| `mail` | Correo / Responder | task `brand_reply`, «Abrir Gmail» |
| `briefcase` | Marcas | Marcas section header |
| `shopping-bag` | Elegir productos | task `choose_products` |
| `shopping-cart` | Producto de TikTok Shop | feed product pill, product sheet «Ver en TikTok Shop» |
| `external-link` | Abre fuera | «Abrir en TikTok», «Board antiguo» rows |
| `circle-plus` | Lo quiero | feed «Lo quiero» |
| `bell` | Avisos | Avisos section header |
| `map-pin` | Lugar | place sub-header in Grabar |
| `calendar` | Fecha | day headers (decorative, 16 px) |
| `star` | Recomendado | script tab badge, «Recomendado» badge |
| `quote` | Lo que dices | «LO QUE DICES» label (16 px) |
| `hand` | Qué haces | «QUÉ HACES» label (16 px) |
| `film` | Video de referencia | board section header |
| `list-ordered` | Escenas | board section header |
| `file-text` | Guion | board section header |
| `hard-drive-upload` | Pasar tomas a la Mac | task `move_takes` |
| `eye` · `heart` · `message-circle` · `repeat-2` (alias for shares; use `share-2` if absent) · `bookmark` | Vistas · likes · comentarios · compartidos · guardados | feed rail |
| `sliders-horizontal` | Filtros | feed top bar |
| `smartphone` | Instalar | install banner, Ajustes |
| `sun-moon` | Tema | Ajustes |
| `log-out` | Olvidar este teléfono | Ajustes |
| `key-round` | Llaves guardadas | Ajustes |
| `info` | Información | info banners (read-only Creadoras) |
| `circle-dot` | Otra tarea | task `other` |
| `circle-x` | Descartado | stage `dropped` |
| `clapperboard` | App glyph | PWA icon, splash, Bienvenida |

### 4.3 Lane marks
Lanes have **no icon**. They show as a text chip only where the lane isn't already implied: «Miami X» / «Creadoras» (neutral chip, 12/16 semibold). Shown in: Boards (the «Todos» view only), the product sheet, the Feed lane switch.

---

## 5. Component library (`lib/components.js` + `lib/ui.css`)

Each component lists its props, variants, anatomy and states. Every interactive element has a hit area ≥ 44×44 (padding counts).

| # | Component | Props | Variants / anatomy | States / behavior |
|---|---|---|---|---|
| C-01 | `AppBar` | `title, variant: large|compact, back?, actions[], status?` | §2.2 | collapse on scroll |
| C-02 | `TabBar` | `items[{id,label,icon,badge}], current` | §2.3 | badge hidden at 0 |
| C-03 | `Section` | `title, icon?, count?, collapsible?, collapsedLabel?` | Title 17/22 semibold + optional 16 px icon in muted. **No count in the header** unless collapsed («Ver 6 más»). Content on a `--surface` card, radius 16, `--e-1`. | collapsed / expanded (chevron rotates) |
| C-04 | `ListRow` | `leading: thumb|icon|none, title, meta?, trailing: button|chip|chevron|toggle|none, tone?, onTap` | min-height 64; leading 48×48 radius 12 (icon tile: 48×48 `--tint-{tone}` with a 22 px icon in its ink); title 16/22 600, one line with ellipsis; meta 14/19 `--text-2`, max 2 lines; a hairline between rows (inset 76 px) | pressed; removal animation (fade + 24 px slide right, 200 ms); `role="button"` + `tabindex=0` when the whole row is tappable and has no trailing button; when it has a trailing button the row itself isn't a button (avoids nested buttons) and the title becomes the tap target for detail |
| C-05 | `Thumb` | `src (data: or decrypted blob:), size, alt=""` | object-fit cover, `--surface-pressed` placeholder | loading: shimmer placeholder; error or invalid src: the same plain placeholder, never a broken-image glyph (fixes B-10) |
| C-06 | `StatusChip` | `status (entity+id) | {text,tone}` | pill 24 px tall, padding 0 10, 16 px icon + 12/16 600 label; background `--tint-{tone}`, ink `--{tone}` | static |
| C-07 | `Badge` | `count` | §2.3 | — |
| C-08 | `Button` | `kind: primary|secondary|tertiary|destructive|success, size: md|lg, icon?, label, full?` | **primary**: `--primary` fill, white ink, 600; **secondary**: `--surface-pressed` fill, `--text` ink; **tertiary**: transparent, `--link` ink; **destructive**: transparent with a 1.5 px `--bad` border and `--bad` ink (filled `--bad` with white ink only inside the confirm dialog); **success** (the post-action state, e.g. «Anotado»): `--tint-good` fill, `--good` ink, `circle-check` icon. md = 44 tall, radius 12, 15/20; lg = 52 tall, radius 14, 17/22, full width | pressed; busy (spinner replaces the icon, label stays, `aria-busy=true`) |
| C-09 | `FileButton` («Subir video») | `accept="video/*", label, onFile` | A **primary lg full-width** button with the `upload` icon; it wraps a visually hidden `<input type=file>` covering the button (iOS needs a real input tap) | busy while preparing; hidden when the take is closed |
| C-10 | `RoundCheck` (✓) | `label (aria), onTap` | 44×44 circle, 1.5 px `--line` border, `check` 20 px in `--good` | → row removal |
| C-11 | `Segmented` | `options[{id,label,count?}], value` | a `--surface-pressed` track, radius 12, 3 px padding; segments ≥ 44 tall, 15/20 600; the selected one is `--surface` with `--e-1`; counts in 13/18 `--muted` after the label | `role="tablist"` / `role="tab"` + `aria-selected`; arrow keys move between segments |
| C-12 | `FilterChip` | `label, count?, selected` | pill 36 visual (44 hit), selected = `--text` fill with `--surface` ink | toggles |
| C-13 | `Sheet` | `title, subtitle?, leading?, size: auto|full, footer?` | from the bottom, radius 20 top, grabber 36×5, header (title 17/22 600 + ✕), scrollable body, sticky footer; max-height `100dvh − 24px − safe-top` | open/close 280 ms; swipe down on the header or grabber > 80 px closes; Escape closes; the scrim tap closes (except when a text input has content: then it asks «¿Descartar la nota?» [Seguir escribiendo] [Descartar]); focus trapped; focus returns to the opener; pushes a history entry |
| C-14 | `Dialog` (confirm) | `title, body?, confirmLabel, confirmKind, cancelLabel` | centered card, max-width 320, two buttons stacked (confirm on top, full width) | `role="alertdialog"`; Escape = cancel |
| C-15 | `ActionSheet` | `actions[{label, icon, kind}]` | a bottom sheet listing 52 px rows + «Cancelar» | — |
| C-16 | `Toast` | `message, undo?` | §2.5 | — |
| C-17 | `Banner` | `tone, icon, text, actions[], dismissible` | full width, radius 12, `--tint-{tone}`, 14/19 | — |
| C-18 | `EmptyState` | `icon, title, body?, action?` | a 72 px tinted circle with a 40 px icon, title 17/22 600, body 15/20 `--text-2` (max 2 lines), optional secondary button | — |
| C-19 | `Skeleton` | `lines | rows: n` | `--surface-pressed` blocks with a shimmer (static under reduced motion) | shown for ≤ 10 s, then an error state |
| C-20 | `ProgressBar` | `value 0–1` | 6 px tall, radius 3, `--surface-pressed` track, `--primary` fill | `role="progressbar"` with `aria-valuenow` |
| C-21 | `SayBox` («Lo que dices») | `text` | `--say-bg`, 1.5 px `--say-line` border, radius 16, padding 16; label row: `quote` 16 px + «LO QUE DICES» (`--t-label`, `--link`); text `--t-say` `--text` inside `<blockquote>` | — |
| C-22 | `DoLine` («Qué haces») | `text` | no box; label row: `hand` 16 px + «QUÉ HACES» (`--t-label`, `--muted`); text 15/20 `--text-2` | — |
| C-23 | `SceneCard` | `index, total, refFrame, ourFrame, vo, do` | header «Escena {n} de {total}» (13/18 `--muted`); two 9:16 frames side by side (gap 8, radius 12), captions «Referencia» / «La nuestra» (13/18 `--muted`) under each; then SayBox; then DoLine | frames tap → FrameViewer |
| C-24 | `FrameViewer` | `frames[], start` | a full-screen black overlay, image contain, swipe left/right between «Referencia» and «La nuestra» of the same scene, ✕ top-right, caption bottom | Escape closes |
| C-25 | `RefPlayer` | `src (EncMedia)` | a 9:16 box (max-height 70vh), `--surface-pressed`, centered 64 px circular play button with the `play` icon and the label «Toca para ver» under it | tap → «Cargando video…» spinner → decrypt → `<video controls playsinline autoplay>`; error «No se pudo cargar el video. Reintentar» |
| C-26 | `ScriptBlock` | `text` | `--surface-2` box, 15/22, preserves line breaks, collapsed to 6 lines with a fade + «Ver todo» (tertiary); «Copiar guion» secondary button with the `copy` icon | expanded / collapsed |
| C-27 | `TakeRow` | `shot, take, state, progress?, reason?, canUpload, canResume` | leading 28 px status circle (`circle` / `loader-circle` / `circle-pause` / `circle-check` / `rotate-ccw`); title «Escena {nn} · Toma {t}» 16/22 600; status word 14/19 in its tone; redo reason banner (warn); ProgressBar while uploading; FileButton; «Reanudar» secondary lg full width | §8.10.5 |
| C-28 | `SessionCard` | `session, live, canManage` | §8.7 | — |
| C-29 | `VideoCard` | `video, product, filmed` | §8.6 | — |
| C-30 | `ProductGroupCard` | `product, boards[]` | §8.9 | — |
| C-31 | `FeedCard` | `card` | §8.12 | — |
| C-32 | `ProductPill` | `product` | §8.12 | — |
| C-33 | `MetricRail` | `metrics` | §8.12 | — |
| C-34 | `HeroCard` («Lo próximo») | `kind, title, meta, thumb|icon, action` | `--surface`, radius 20, a 2 px `--primary` border (`--good` when all done), padding 16; label «LO PRÓXIMO» (`--t-label`, `--link`); a 60 px thumb/icon tile + title 20/26 700 + meta 15/20; a primary lg full-width button | done variant |
| C-35 | `ShortcutTile` | `icon, label, sub, tone?, onTap` | half width, 72 tall, `--surface`, radius 16, a 36 px icon tile + label 16/22 600 + sub 13/18 `--text-2` | — |
| C-36 | `NoteSheet` | `context?` | §8.13 | — |
| C-37 | `OutboxPill` / `OutboxSheet` | — | §2.2, §8.14 | — |
| C-38 | `DayHeader` | `day, progress?` | `calendar` 16 px + label 15/20 700 («Hoy», «Sáb 10 oct», «Atrasado · sáb 3 oct» in `--bad`), right-aligned progress 13/18 `--muted` («2 de 5») | — |
| C-39 | `InitialAvatar` | `name` | 40 px circle, `--tint-info`, initial letter 17 600 `--info` | — |
| C-40 | `Stepper` (product timeline) | `steps[{label, state: done|current|todo}]` | vertical, 20 px nodes (`circle-check` done in `--good`, a filled `--primary` dot for current, `circle` for todo), labels 15/20 | — |

---

## 6. Status vocabulary and state machines (one word per state)

Implemented in `lib/status.js`. **Screens never hard-code a status label, tone or icon;** they call `status.video(id)`, `status.stage(id)`, etc. Unknown ids render as a neutral chip with the scene's text (sanitized), never as raw ids.

### 6.1 Video (filming job / board) — `VideoStatus`

| id | Label | Tone | Icon | Primary action (Jorge) | Legacy mapping (boards v1 status text · FF job state) |
|---|---|---|---|---|---|
| `preparing` | Preparando | neutral | `hourglass` | — (no button; the card says «Preparando») | «Board en camino», «Armando pack», «Armando el board», «Grok arma el board/pack» · `queued`, `scripts_ready` (picked) |
| `to_film` | Por grabar | accent | `video` | «Abrir board» | «Board listo» (kind film) · `pack_ready` |
| `filmed` | Grabado | teal | `circle-check` | «Abrir board» | «Grabado» · `filming` + `filmed_at`, `takes_ready` |
| `editing` | Editando | info | `scissors` | «Abrir board» | «Editando», «Aprobado» (kind ai) · `editing` |
| `to_publish` | Por publicar | warn | `send` | «Publicado» (done) in Por hacer | «Entregado» · `done` before posting |
| `published` | Publicado | good | `badge-check` | «Abrir board» | «Publicado» |
| `to_approve` | Por aprobar | warn | `thumbs-up` | «Revisar» | «Board listo» (kind ai) |
| `problem` | Con problema | bad | `triangle-alert` | «Abrir board» or «Pedir a Grok» | «Violación», «Sin link» (+ `problem` text: «TikTok lo marcó: …», «Sin link») · `blocked` |
| `retired` | Retirado | neutral | `archive` | — | «Retirado» |

### 6.2 Product (tracker) — `Stage`

| id | Label | Tone | Icon | Task that may exist in «Por hacer» | Legacy chip text |
|---|---|---|---|---|---|
| `chosen` | Elegido | neutral | `circle-plus` | `sample` «Pedí muestra» | «Elegido» |
| `sample_requested` | Muestra pedida | warn | `package` | `sample` «La aprobaron» | «Muestra por aprobar», «Muestra pedida» (**merged**: one state) |
| `sample_shipping` | En camino | info | `truck` | `sample` «Llegó» | «En camino» |
| `arrived` | Llegó | teal | `package-check` | — | «Llegó» |
| `researching` | Investigando | neutral | `search` | — | «Content gap listo», «Identificando», «Content gap» |
| `pick_script` | Elige guion | accent | `pen-line` | `pick_script` «Elegir guion» | «Guiones por aprobar» |
| `preparing` | Preparando | neutral | `hourglass` | — | «Armando pack» |
| `to_film` | Por grabar | accent | `video` | — (it's in Grabar) | «Pack listo» |
| `filmed` | Grabado | teal | `circle-check` | `move_takes` «Hecho» (if takes aren't uploaded) | «Grabado» |
| `editing` | Editando | info | `scissors` | — | «Editando» |
| `to_publish` | Por publicar | warn | `send` | `publish` «Publicado» | «Por publicar» |
| `published` | Publicado | good | `badge-check` | — | «Publicado» |
| `brand_hold` | Decidir oferta | warn | `handshake` | `brand_decide` «Decidir» | «Decidir oferta» |
| `dropped` | Descartado | neutral | `circle-x` | — | `dropped` (hidden from Productos; visible only in «Todos los productos» › Descartados) |

**Date modifiers (not separate states):** `due` < today (ET) and stage before `filmed` → the meta text shows «Atrasado · sáb 3 oct» in `--bad` (B-12). `due` null → the group «Sin fecha». The Thursday 8 PM rule (no arrival → next Saturday) is computed by the generator; the viewer only displays `due`.

### 6.3 Creator session

| id (derived) | Label | Tone | Icon | Rule |
|---|---|---|---|---|
| `active` | Activa | good | `circle-check` | not revoked, `expiresAt` > now + 48 h |
| `expiring` | «Vence hoy» / «Vence mañana» / «Vence en 2 días» | warn | `hourglass` | not revoked, `expiresAt` ≤ now + 48 h |
| `expired` | Vencida | neutral | `circle-x` | `expiresAt` ≤ now |
| `revoked` | Revocada | neutral | `ban` | `revoked_at` set |

### 6.4 Creator job (product inside a session) — Worker `session_jobs.status`

| id | Label (Jorge) | Creator projection | Tone | Icon |
|---|---|---|---|---|
| `sent` | Enviado | Por grabar | neutral | `send` |
| `opened` | Visto | Por grabar | info | `eye` |
| `uploading` | Subiendo | Subiendo | accent | `loader-circle` |
| `uploaded` | Subido | Subido | warn (for Jorge: needs review) / accent (creator) | `circle-check` |
| `approved` | Aprobado | Aprobado | good | `thumbs-up` |
| `redo` | Re-grabar | Re-grabar | bad | `rotate-ccw` |
| `pulled` | En la Mac | (shows the underlying `approved` or `uploaded`) | teal | `hard-drive-upload` |

**Projection** means the creator sees fewer distinctions (she doesn't need «Visto» or «En la Mac»). It never shows a different word for the same state. «Rehacer» and «Listo» (for pulled) are removed everywhere (R-13).

### 6.5 Take (one shot × take)

| id | Label | Tone | Circle icon | Who |
|---|---|---|---|---|
| `missing` | Falta | neutral | `circle` | both (replaces the misleading «Enviado» on empty takes) |
| `uploading` | Subiendo {n} % | accent | `loader-circle` | both |
| `paused` | En pausa | warn | `circle-pause` | both («Reanudar» visible) |
| `uploaded` | Subido | accent (creator) / warn «por revisar» meaning for Jorge in Creadoras | `circle-check` | both |
| `approved` | Aprobado | good | `circle-check` | both |
| `redo` | Re-grabar | bad | `rotate-ccw` | both (+ the reason) |
| `pulled` | En la Mac | teal | `circle-check` | Jorge only (the creator sees `uploaded`/`approved`) |

Take state machine: `missing → uploading → (paused ⇄ uploading) → uploaded → approved | redo`; `redo → uploading → uploaded …`; `uploaded|approved → pulled` (a flag that doesn't change the review state). Upload is allowed in `missing`, `paused` (via Reanudar or a new file) and `redo`. It's closed in `uploaded` (until a review asks for a redo), `approved` and `pulled`.

### 6.6 Task (Dashboard «Por hacer»)
`open → done (local, then outbox) → (undo) open`. After the next scene build, the generator either removes the task (processed) or keeps it (not processed, so the local «done» memory keeps it hidden for 3 days, as today).

### 6.7 Outbox entry
`queued → sending → sent` (removed after 24 h) · `sending → queued` (retry with backoff) · `sending → failed` (4xx) → «Reintentar» → `queued`.

---

## 7. Copy dictionary (`lib/copy.js`)

Tone: Cuban/US Spanish, «tú», plain words, sentence case, no exclamation marks except «¡Todo grabado!». Use «link» (never «enlace»), «video» (no accent, as Jorge writes it), «board», «feed», «score», «Dashboard». Numbers: `Intl.NumberFormat("es-US")` («24,3 mil», «1.883»). Times: `h:mm a. m.`. Dates: §7.6.

### 7.1 Navigation and global
| Key | Copy |
|---|---|
| `tab.dashboard` | Dashboard |
| `tab.grabar` | Grabar |
| `tab.creadoras` | Creadoras |
| `tab.feed` | Feed |
| `nav.back` | Atrás (aria) |
| `nav.close` | Cerrar (aria) |
| `nav.settings` | Ajustes |
| `nav.note` | Nota |
| `nav.boards` | Boards |
| `status.updated` | Actualizado {hace 5 min} |
| `status.updating` | Actualizando… |
| `status.stale` | Sin actualizar desde las {7:00} |
| `status.failed` | No se pudo actualizar |
| `status.retry` | Reintentar |
| `status.offline` | Sin conexión |
| `status.outbox` | {n} por enviar |
| `banner.update` | Hay una versión nueva |
| `banner.update.cta` | Actualizar |
| `banner.offline` | Sin conexión · datos de {hace 2 h} |
| `banner.install.ios` | Instala Comando en tu iPhone |
| `banner.install.cta.ios` | Ver cómo |
| `banner.install.other` | Instala Comando |
| `banner.install.cta` | Instalar |
| `banner.keychanged` | Tu link cambió. Pega el link nuevo del Comando. |
| `banner.keychanged.cta` | Pegar link |
| `common.loading` | Cargando… |
| `common.retry` | Reintentar |
| `common.cancel` | Cancelar |
| `common.done` | Listo |
| `common.undo` | Deshacer |
| `common.seeAll` | Ver todo |
| `common.seeMore` | Ver {n} más |
| `common.seeLess` | Ver menos |
| `common.needOnline` | Necesitas conexión |

### 7.2 Toasts (one wording per outcome)
| Key | Copy | Undo? |
|---|---|---|
| `toast.done` | Listo | yes |
| `toast.picked` | Elegiste {B} · Grok prepara el board | yes |
| `toast.pickCleared` | Elección quitada | yes |
| `toast.filmed` | Marcado como grabado | yes |
| `toast.unfilmed` | Desmarcado | yes |
| `toast.want` | Anotado · sale en Productos en el próximo refresh | yes |
| `toast.noteSent` | Nota enviada | no |
| `toast.noteQueued` | Nota guardada · se envía al volver la conexión | no |
| `toast.copied.link` | Link copiado | no |
| `toast.copied.script` | Guion copiado | no |
| `toast.copied.search` | Búsqueda copiada · abre Gmail, toca Buscar y pega | no |
| `toast.copyFailed` | No se pudo copiar | no |
| `toast.extended` | Extendido 3 días · vence {lun 13 oct} | no |
| `toast.revoked` | Link revocado | no |
| `toast.approved` | Toma aprobada | no |
| `toast.redo` | Pediste re-grabar | no |
| `toast.go` | GO enviado | yes |
| `toast.changes` | Cambios pedidos | yes |
| `toast.actionFailed` | No se pudo. Prueba otra vez. | no |
| `toast.needOnline` | Necesitas conexión | no |
| `toast.uploadDone` | Video subido | no |

### 7.3 Link and app errors (full-screen `ErrorState`)
| Key | Title | Body | Action |
|---|---|---|---|
| `err.incomplete` | Link incompleto | Pídele a Grok el link completo. | — |
| `err.host` | Abre este link desde jorgedearmas.github.io | — | — |
| `err.decrypt` | No se pudo abrir | Si el link es nuevo, espera un minuto. | Reintentar |
| `err.offlineFirst` | Sin conexión | Conéctate para abrir por primera vez. | Reintentar |
| `err.keyChanged` | Tu link cambió | Pega el link nuevo del Comando. | Pegar link |
| `err.portalInactive` (creator) | Este link ya no está activo | Pídele uno nuevo a Jorge. | — |
| `err.boardOpen` | No se pudo abrir el board | — | Reintentar |
| `err.generic` | Algo falló | — | Reintentar |

### 7.4 Upload
| Key | Copy |
|---|---|
| `up.section` | Subir video |
| `up.hint` | Graba en 1080p, vertical |
| `up.button` | Subir video |
| `up.resume` | Reanudar |
| `up.take` | Escena {01} · Toma {1} |
| `up.stay` | No cierres la app mientras sube. Si se corta, vuelve y toca Reanudar. |
| `up.stay.portal` | No cierres Safari mientras sube. Si se corta, vuelve a abrir este link y toca Reanudar. |
| `up.onlyVideo` | Solo se pueden subir videos. |
| `up.inactive` | Este link ya no está activo. |
| `up.closed` | Esta toma ya está cerrada. |
| `up.startFailed` | No se pudo empezar. Revisa la conexión y prueba otra vez. |
| `up.cut` | Se cortó la subida. Toca Reanudar. |
| `up.pickSame` | Elige el mismo video para seguir. |
| `up.notSame` | Ese no es el mismo video. |
| `up.restart` | Empezar de nuevo |
| `up.resuming` | Reanudando… |
| `up.needOnline` | Necesitas conexión para subir. |
| `up.redoBanner` | Re-grabar: {motivo} |

### 7.5 Empty states
| Key | Title | Body |
|---|---|---|
| `empty.todo` | Nada por hacer | Grok sigue trabajando. |
| `empty.products` | Ningún producto elegido | En el Feed toca «Lo quiero» o mándale el link a Grok. |
| `empty.brands` | Sin tratos abiertos | — |
| `empty.grok` | — (section hidden) | — |
| `empty.grabar.todo` | ¡Todo grabado! | {Sube las tomas desde cada board. | Pasa las tomas a la Mac.} |
| `empty.grabar.done` | Nada grabado todavía | Cuando marques un video, sale aquí. |
| `empty.creadoras` | Ninguna creadora activa | Pídele a Grok un link para una creadora. |
| `empty.review` | Nada por revisar | — |
| `empty.boards` | No hay boards | — |
| `empty.boards.lane` | No hay boards de {Creadoras} | — |
| `empty.feed.lane` | {scene avatars[].empty} | — |
| `empty.feed.filter` | No hay videos con este filtro | Toca Filtros para cambiarlo. |
| `empty.portal` | Nada que grabar | — |

### 7.6 Dates (`lib/dates.js`, business dates in America/New_York)
| Case | Copy |
|---|---|
| today | hoy / Hoy (headers) |
| tomorrow | mañana / Mañana |
| yesterday | ayer |
| within the next 6 days | `sáb` / header «Sábado» |
| other, same year | `sáb 10 oct` / header «Sáb 10 oct» |
| other year | `sáb 10 oct 2027` |
| overdue (due < today) | «Atrasado · sáb 3 oct» |
| undated | «Sin fecha» |
| relative past time | «hace 5 min», «hace 2 h», «ayer 8:15 p. m.» |
| expiry | «Vence hoy», «Vence mañana», «Vence en 2 días», «Vencida» |

---

## 8. Screens

Each screen spec: **Purpose · Layout (top → bottom) · Components and copy · States · Interactions · Transitions · Edge cases.** All layouts are specified at **390×844**.

### 8.1 Bienvenida (paste link) — `#/bienvenida`

**Purpose:** first open of the installed app (or after «Olvidar este teléfono») with no root key.

**Layout**
```
            [app glyph 72 px, radius 18]
                 Comando                        28/34 bold
   Pega el link del Comando que te mandó Grok.  16/22 --text-2, centered, max 2 lines

   [ ⧉  Pegar link ]                            primary lg, full width
   ─────────── o ───────────
   [ Pega aquí el link…                    ]    textarea 1–3 rows, 16 px (no iOS zoom)
   [ Abrir ]                                    secondary lg, full width (shown when the field has text)

   ⓘ El link se guarda solo en este teléfono.   13/18 muted, centered
```

**Interactions**
- «Pegar link» → `navigator.clipboard.readText()` inside the tap. iOS shows its «Pegar» callout, and the user taps it. The result is validated (ARCHITECTURE §13.2) → import → `#/dashboard`. While working: the button is busy «Abriendo…».
- Clipboard denied or empty → focus the textarea and show the inline hint «Mantén presionado aquí y toca Pegar.»
- «Abrir» → validate the textarea → import.
- A pasted URL with surrounding text is accepted.

**States and errors (inline, under the field, `--bad`, `role="alert"`)**
| Case | Copy |
|---|---|
| no URL found | «Eso no parece un link. Pega el link completo del Comando.» |
| non-root page link | «Ese link es de una sola página. Pega el link del Comando.» |
| creator link | «Ese es un link de creadora. Pega el link del Comando.» |
| decrypt fails | «La llave no abre el Comando. Pídele el link a Grok de nuevo.» |
| offline | «Sin conexión. Conéctate para abrir por primera vez.» |

**Edge cases:** the same link pasted twice → a no-op import, then go to the Dashboard. The «Copiar link para la app» flow from the install sheet → the clipboard holds the root link and the paste works directly.

### 8.2 Dashboard — `#/dashboard` (default tab)

**Purpose:** «¿Qué hago ahora y cómo va todo?» It holds the old «Más» content, reorganized under P-1…P-6.

**Layout**
```
App bar (large): Dashboard                         [Nota] [⚙]
                 Actualizado hace 5 min · [2 por enviar]
Banners (update / offline / install / key changed)
┌ LO PRÓXIMO ────────────────────────────────────┐
│ [thumb]  Producto A                             │
│          3 guiones · recomendado B              │
│ [        Elegir guion         ]  primary lg     │
└─────────────────────────────────────────────────┘
[ ▶ Feed            ] [ ▦ Boards           ]       ShortcutTiles
[   31 videos hoy   ] [   2 con problema   ]
Por hacer
  [✎] Producto B · 3 guiones listos      [Elegir guion]
  [➤] Producto C · Video listo           [Publicado]
  [📦] Producto D · Pedida el 2 oct       [La aprobaron]
  [✉] Marca X · Te escribió ayer          [Responder]
  [🛍] Elegir productos del feed           [Abrir feed]
Productos
  SÁB 10 OCT
  [img] Producto A          (Elige guion) ›
  [img] Producto E          (Por grabar)  ›
  SIN FECHA
  [img] Producto D          (Muestra pedida) ›
  Ver todos (9)
Marcas
  [⧗] Esperando respuesta                7 ›
  [✓] Cerrado · falta contrato o pago    2 ›
Grok trabaja en
  [✦] Identificando producto de un link · desde 9:10
Avisos
  [!] 2 videos viejos de Creadoras sin cerrar
Tab bar
```

#### 8.2.1 App bar
Large title «Dashboard». Actions: «Nota» (§8.13), Ajustes (`#/ajustes`). Status line per §2.2.

#### 8.2.2 Banners
Per §2.4, in priority order: key changed > update > offline > install.

#### 8.2.3 «Lo próximo» (HeroCard)
Exactly **one** card, chosen by this algorithm (first match wins):

| # | Condition | Icon / thumb | Title | Meta | Button → |
|---|---|---|---|---|---|
| 1 | Jorge has `to_film` + `ready` videos with day = today **or overdue** | `video` tile, accent | «Grabar hoy» (overdue: «Grabación atrasada») | «{n} videos · {Sala, Cocina}» (distinct places, max 2 + «…») | «Ir a Grabar» → `#/grabar` |
| 2 | Takes with state `uploaded` (manager token present) | the creator's `InitialAvatar` | «Revisar tomas de {Ana}» (2+ creators: «Revisar tomas») | «{n} tomas nuevas» | «Revisar» → the review sheet of the first session with pending takes |
| 3 | A session `expiring` today with jobs not all `approved` (manager token present) | `hourglass` tile, warn | «El link de {Ana} vence hoy» | «{n} productos sin terminar» | «Extender 3 días» (POST extend; toast `toast.extended`) |
| 4 | `tasks[0]` exists | the task's thumb or kind icon | the task title | the task meta | the task action label → the same as the row action (§8.2.5) |
| 5 | Nothing | `circle-check` tile, good | «Todo al día» | «Grok sigue trabajando.» | no button (variant done, green border) |

Rule R-04: when case 4 is used, `tasks[0]` is **not** rendered in «Por hacer». The hero updates instantly after local taps (done/pick/act) and the next task moves up with a 200 ms crossfade.

#### 8.2.4 Atajos (ShortcutTiles, two side by side)
| Tile | Icon | Label | Sub (first match) | Tap |
|---|---|---|---|---|
| Feed | `play` (accent tile) | «Feed» | «{n} videos hoy» (cards in the default lane updated today) · «Actualizado {7:43 a. m.}» · while loading «Cargando…» · no key «Ábrelo una vez desde su link» | `#/feed` (no key: the tile shows that sub and tapping it opens a toast «Abre el link del feed una vez para agregarlo») |
| Boards | `layout-grid` (accent tile) | «Boards» | «{n} con problema» (bad ink) if any · else «{n} boards» · loading «Cargando…» | `#/boards` |

The counts come from the idle-prefetched feed and boards scenes (ARCHITECTURE §5.3). If a prefetch fails, the sub is «Toca para abrir» and tapping it retries.

#### 8.2.5 «Por hacer» (Section, the only action list)
- Source: `model.tasks` minus the hero task, minus locally done (`hub-done`), minus locally picked scripts (picked tasks reappear as «Elegiste B» only in the product sheet). No grouping headers. Max 12 visible + «Ver {n} más» (expands inline).
- **Row (ListRow):** leading = product thumb (if `thumb`), else a kind icon tile in the task tone (default tone by kind: `pick_script` accent, `publish` warn, `sample` warn, `brand_*` info, `brand_bounce` bad, `move_takes` teal, `choose_products` accent, `approve_media` warn, `other` neutral). Title = `title`. Meta = `meta` (an overdue `due` prepends «Atrasado · » in `--bad`). Trailing = **one** action:

| Action type | Trailing control | Tap behavior |
|---|---|---|
| `scripts` | primary md «Elegir guion» | opens the Script sheet (§8.3) |
| `done` | success-outline md with the action label (e.g. «Publicado») or a `RoundCheck` when the label is «Hecho» | marks done: row removal animation → toast «Listo» + Deshacer → outbox `approve done` (4 s grace) |
| `act` | secondary md with `label` («La aprobaron», «Llegó», «Pedí muestra», «Lo tengo») | removes the row (P-3: the product row keeps its chip) → toast «Listo» + Deshacer → outbox `approve done` with `act.id`. The product chip updates on the next build. |
| `mail` | secondary md «Responder» | opens the Mail sheet (§8.5.2) |
| `link` | secondary md with the label + `external-link` 16 | opens in a new tab |
| `route` | secondary md with the label | in-app navigation (`#/feed` etc.) |
| `board` | secondary md «Revisar» | `#/board/<id>` |

  If the task also has `done` (e.g. a mail task with «Ya respondí»), that second control appears **inside its sheet**, not in the row (one action per row).
- **Tapping the row body** (not the button) opens the Task detail sheet (§8.5.1) when the task has `detail`, `mail` or `product`. Otherwise it performs the action.
- **Empty:** EmptyState `circle-check` «Nada por hacer» / «Grok sigue trabajando.» (it only appears when the hero is case 5; otherwise the section is hidden to avoid saying «nothing» twice).

#### 8.2.6 «Productos» (Section, status only)
- Source: `model.products` minus `dropped`, sorted by due (overdue first, then ascending, «Sin fecha» last), and inside a group by stage order (§6.2 order).
- Group headers (`--t-label`): «ATRASADO» (bad), «ESTA SEMANA» (due within 7 days, e.g. «SÁB 10 OCT»), «SÁB 17 OCT», «SIN FECHA».
- Row: thumb 48 · title = name · meta = `now` (if present, else empty; **never** a restatement of the chip) · trailing = StatusChip(stage) + chevron.
- Max 6 visible, then «Ver todos ({n})» opens the Products sheet (§8.4.2).
- Tap → Product sheet (§8.4.1), route `#/producto/<pid>`.
- Empty: EmptyState `shopping-bag` «Ningún producto elegido» / «En el Feed toca «Lo quiero» o mándale el link a Grok.» + secondary «Abrir feed».

#### 8.2.7 «Marcas» (Section, status only; icon `briefcase`)
- One row per `brands.groups[]` that has items: leading icon tile (`hourglass` waiting / `circle-check` closed / `message-circle` negotiating / `circle-dot` other) · title = group label · trailing = the count (17/22 600 `--text-2`) + chevron. Tap → Marcas sheet filtered to that group (§8.5.3).
- Brand items that need action are tasks in «Por hacer», not here (R-18).
- Hidden when there are no groups with items. (`empty.brands` is used only inside the Marcas sheet.)

#### 8.2.8 «Grok trabaja en» (Section; icon `sparkles`)
- Rows from `model.grok` (max 3, then «Ver {n} más» inline). Leading = icon tile (`search`/`pen-line`/`hourglass`/`clapperboard`/`scissors`/`sparkles`, neutral). Title + meta. No trailing button; tap → Task detail sheet if `detail` exists (otherwise the row isn't interactive: `role` none).
- Hidden when empty (no «Nada en proceso» noise).

#### 8.2.9 «Avisos» (Section; icon `bell`)
- Rows from `model.alerts`: leading icon by tone (`info` / `triangle-alert` warn / `triangle-alert` bad), text 15/20. Not interactive. Hidden when empty. **Only on Dashboard** (R-07).

#### 8.2.10 States
| State | Rendering |
|---|---|
| Loading (no cache) | app bar + Skeleton: hero block (120 px) + 2 tiles + 5 rows |
| Loaded from cache, refreshing | full content + «Actualizando…» |
| Offline with cache | full content + offline banner; taps queue |
| Error, no cache | ErrorState `err.decrypt` or `err.offlineFirst` |
| Key changed | key-changed banner + stale content read-only (action buttons hidden) |
| Partial (feed/boards prefetch failed) | tile subs «Toca para abrir» |
| Worker unreachable | hero cases 2–3 are skipped (no error on Dashboard; Creadoras shows its banner) |

#### 8.2.11 Interactions summary
Pull to refresh; status-line tap to refresh; hero button; tile taps; row button; row body → sheet; «Ver más» expanders; Nota; Ajustes. **No long-press and no swipe actions** (discoverability and accidental-tap risk).

#### 8.2.12 Edge cases
- A task without a usable action (e.g. an invalid link) → rendered as a non-interactive row with its meta; logged in dev.
- Placeholder titles («Producto») → the task is dropped (R-20).
- Very long names → one line with ellipsis in rows; 2 lines in the hero.
- The same `act.id` arriving as a task and as a v3 product `act` → one task only (adapter dedupe).
- A local «done» on a task that the next build still contains → stays hidden for 3 days (as today).

### 8.3 Script sheet (Guiones A/B/C) — full-height Sheet

**Purpose:** compare up to 3 scripts and pick one (unchanged behavior, restyled).

**Layout**
```
Header: [thumb 44] Producto A                         [✕]
        Elige 1 de 3 guiones | Elegiste B · Grok prepara el board
        [  A  ][ B ★ ][  C  ]          Segmented (★ = recommended, ✓ = picked)
Body (horizontal snap panes, one per letter):
  [★ Recomendado · {why}] [✓ Elegido]                  badges
  Guion B · {focus}                                    20/26 700
  ┌ GANCHO ──────────────────────────┐
  │ {hook} 18/24 600                 │  + on-screen text chip {hookText}
  └──────────────────────────────────┘
  Facts card: Formato · Cómo (Como en el video de referencia · @handle · «Ver video de referencia» ↗ | Estructura propia) · Quién sale · Dónde · Duración (~45 s)
  SEGUNDO A SEGUNDO
  per beat: 0:03–0:06 (13/18 --link tabular) ; VO in a compact SayBox (17/22 600, no label) ; «QUÉ HACES» DoLine ; on-screen text chip
  ▸ Todo el texto   (collapsible)
  ▸ Reglas de este guion (collapsible)
Footer (sticky):
  not picked:   [ Elegir este guion (B) ]                 primary lg
  picked other: «Ahora tienes el A. Puedes cambiar hasta que Grok arme el board.»  [ Cambiar a guion B ]
  picked this:  «Elegiste B · Grok prepara el board» (good)  [Quitar elección] [Listo]
  locked:       «El board ya está listo con el guion B.» (good)  (no buttons)
  sending:      «Elegiste B · enviando…»  (when the outbox hasn't sent yet)
```

**Interactions:** Segmented tap → scroll to that pane (smooth; instant under reduced motion). A horizontal swipe syncs the segment. «Elegir» → local pick saved (`hub-picks:<b>`, 7 days) → outbox `pick` (4 s grace) → toast `toast.picked` + Deshacer (undo re-sends the previous letter or `""`). «Quitar elección» → `letter:""`. «Listo» closes. Opens on the picked letter, else the recommended one, else A.

**Edge cases:** `changeable:false` → locked footer. An invalid donor URL → «Estructura propia». More than 3 options → only A, B and C. An offline pick → toast `toast.picked` then the outbox pill shows it pending.

### 8.4 Products

#### 8.4.1 Product sheet — `#/producto/<pid>` (auto-height Sheet, max full)
**Purpose:** the single card for a product (R-02).
```
Header: [thumb 64] Producto A                       [✕]
        (Elige guion)  · Miami X                     StatusChip + lane chip
Ahora: Te toca elegir el guion                       15/20 (from `now`)
[ Elegir guion ]                                     primary lg — the product's open task action, if any
Progreso (Stepper)
  ✓ Muestra        Llegó el 6 oct
  ● Guion          Elige uno
  ○ Board
  ○ Grabar         sáb 10 oct
  ○ Editar
  ○ Publicar
Videos
  [▶] Gancho corto del video    (Por grabar) ›       → #/board/v:<videoId>
Detalles (facts from `detail`)
[ 🛒 Ver en TikTok Shop ↗ ]                          secondary lg (if pdp)
```
- Stepper mapping: Muestra (chosen…arrived), Guion (pick_script), Board (preparing), Grabar (to_film/filmed), Editar (editing), Publicar (to_publish/published). The current step is the product's stage; the step's right text comes from sample.eta / due / blank.
- The action button performs the same as the task (and marks that task done in the list).
- Creator-owned videos are listed with the lane chip «Creadoras» and open as read-only boards.
- Empty videos → the section is hidden.
- `dropped` → the header chip «Descartado», no action.

#### 8.4.2 Products sheet («Todos los productos»)
Full-height sheet. Segmented: «Activos ({n})» | «Publicados ({n})» | «Descartados ({n})». The same rows as §8.2.6 with the same group headers. Tap → Product sheet (stacked: the products sheet stays underneath; back closes the top one).

### 8.5 Task detail, Mail, Marcas sheets

#### 8.5.1 Task detail sheet (auto height)
Header: leading thumb/icon + title + meta + ✕. Body: StatusChip if product-linked; facts card (`detail` pairs, max 8, label 14 `--muted` 96 px column + value 15/20); then the actions stacked full width: the primary action (lg) then the secondary `done` (secondary lg) if present. If the task has `product`: a tertiary «Ver producto» → Product sheet.

#### 8.5.2 Mail sheet (auto height) — for `brand_reply` / `brand_decide` / `brand_bounce`
```
[✉] Marca X                                  [✕]
    ✉ {subject}                               13/18 muted, 1 line
Facts (detail)
[ Abrir Gmail ]           primary lg — iOS: href="googlegmail://" (constant); Android: mail.web (target _blank); desktop label «Abrir correo»
[ ⧉ Copiar búsqueda ]     secondary lg — phones only, when `search` → toast `toast.copied.search`
[ Ya respondí ]           secondary lg — when `done` present → marks done (toast Listo + Deshacer)
```
An invalid `mail.web` → no web button (iOS still gets the constant app link). No `search` → no copy button.

#### 8.5.3 Marcas sheet (full height)
Segmented with the groups that have items («Esperando ({7})» | «Cerrados ({2})» | «Negociando ({1})»), opened on the tapped group. Rows: leading `mail` icon tile (info) · title = brand · meta = `meta` + «desde {28 sep}» · trailing chevron → Mail sheet (when `mail`), else not interactive. Empty: `empty.brands`.

### 8.6 Grabar — `#/grabar` (tab 2)

**Purpose:** the **only** list of what Jorge films (R-03, R-17).

**Layout**
```
App bar (large): Grabar                              [Nota] [▦ Boards]
                 Próxima grabación: sáb 10 oct · [2 por enviar]
[ Por grabar 8 | Grabados 3 ]                        Segmented
📅 Atrasado · sáb 3 oct                     1 de 3   DayHeader (bad)
  📍 SALA                                            place sub-header (only if the day has 2+ places)
  ┌─────────────────────────────────────────┐
  │ [img 56] Producto A                       │ 16/22 600
  │          Gancho corto del video           │ 14/19 --text-2, 1 line
  │          Tomas 2/6 subidas                │ 13/18 --muted (only with owner uploads)
  │ [   Abrir board   ] [ ○ Grabado ]         │ primary md (flex 1) + secondary toggle md
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐
  │ [img] Producto F          (Preparando)    │ no buttons
  └─────────────────────────────────────────┘
📅 Sáb 10 oct                               0 de 4
  …
📅 Sin fecha
```
- **Status-line override:** «Próxima grabación: {date}» (the next day with `to_film` videos) instead of «Actualizado…». The «Actualizado» info stays available in Ajustes and on pull to refresh («Actualizado hace 1 min» flashes for 2 s).
- **Data:** `model.videos` where `owner == "jorge"` (R-17) and status ∈ {`preparing`, `to_film`, `filmed`}. «Por grabar» = not filmed (local tick newest-wins vs `scene.ticks`, else status `to_film`/`preparing`). «Grabados» = filmed.
- **Day groups:** today first («Hoy»), then overdue days (each «Atrasado · sáb 3 oct», bad), then future days ascending, then «Sin fecha». DayHeader progress = «{filmed} de {ready}» for that day (the «Por grabar» tab only).
- **VideoCard:** thumb 56 (product) · product name · video title (only if different from the name) · takes line (owner uploads only) · buttons:
  - `ready` and the board available: «Abrir board» (primary, opens `#/board/v:<videoId>` using `boardRef`; legacy v3 `href` → in-app if the URL is `board.html`/`index.html` with keys → `#/board/…` via a learned ref, else a new tab) + the **toggle** «Grabado» (secondary with a `circle` icon; in the Grabados tab it's «Desmarcar» secondary with `rotate-ccw`).
  - not ready: StatusChip «Preparando», no buttons.
- **Mark filmed:** the card fades out of the list (200 ms) → toast `toast.filmed` + Deshacer → local `rec-ticks:<b>` → outbox `ticks` (batched, ≤ 1 POST / 5 min, or «Enviar ahora» in the Outbox sheet). Undo restores the previous value with a new timestamp.
- **Empty:** «Por grabar»: EmptyState `circle-check` «¡Todo grabado!» + body (owner uploads on: «Sube las tomas desde cada board.» · off: «Pasa las tomas a la Mac.»). «Grabados»: `video` «Nada grabado todavía» / «Cuando marques un video, sale aquí.»
- **Single-scene mode** (a filming v2 link without the root): the same screen with a compact app bar «Grabar», no tab bar, no Nota (mailbox only if the scene has one), and no takes line.
- **States:** loading skeleton (3 cards) · offline (works; ticks queue) · error (ErrorState).
- **Edge cases:** a place label is shown only when the day has 2+ distinct places. Videos with an unknown product → title «Video» is **not** allowed; they're dropped (R-20). A video whose board key is missing → «Preparando» chip + meta «Grok vuelve a publicar el board».

### 8.7 Creadoras — `#/creadoras` (tab 3)

**Purpose:** the **only** place for creator sessions, links, review and manager actions (R-01, R-12).

**Layout**
```
App bar (large): Creadoras                             [Nota]
                 Actualizado hace 1 min
(no manager token)  ⓘ Solo lectura en este teléfono.             Banner info
(Worker failing)    ⚠ No se pudo actualizar las tomas. [Reintentar] Banner warn
┌───────────────────────────────────────────────┐
│ (A) Ana                        (Vence en 2 días)│ InitialAvatar + 17/22 600 + StatusChip(session)
│     Graba sáb 10 oct                           │ 14/19 --text-2
│ [ ✓  Revisar 3 tomas                       ]   │ primary lg full width — only if uploaded takes
│ ─────────────────────────────────────────────  │
│ [img 40] Producto D          (Subido)       ›  │ product rows, StatusChip(job, Jorge labels)
│ [img 40] Producto G          (Visto)        ›  │
│ ─────────────────────────────────────────────  │
│ [⧉ Copiar link] [↑ Compartir] [ ⋯ ]            │ secondary md ×2 + icon button (more)
└───────────────────────────────────────────────┘
▸ Anteriores (2)                                   collapsed: expired/revoked sessions
```
- **Sessions:** `model.creators` merged with live `GET /manager/sessions` by `id` (live status wins; scene name and thumb kept; live sessions not in the scene are shown with the name from live and no «Copiar link», plus the meta «Link en camino»). Owner sessions (`kind:"owner"`) are never shown.
- **Order:** sessions with takes to review first, then expiring, then active by shoot date ascending. Expired/revoked go under «Anteriores» (collapsed, `chevron-down`, «Ver {n}»).
- **Card elements**
  - Expiry chip (§6.3). Meta «Graba {hoy | sáb 10 oct}» or «Grabó {sáb 3 oct}» if past.
  - «Revisar {n} tomas» (primary lg, `circle-check` icon) only when `n > 0` uploaded takes and a manager token is present → the Review sheet (§8.8), route `#/creadoras/<sid>/tomas`.
  - Product rows: thumb · name · StatusChip(job) · chevron → the creator's board read-only (`role=viewer`, board from `jobs[].board`; if absent the row isn't interactive).
  - «Copiar link» (secondary, `copy`) → copies `link` → toast `toast.copied.link`. Copy fallback via a hidden textarea + `execCommand` (B-18).
  - «Compartir» (secondary, `share`) → `navigator.share({ url: link })` (no title or text containing names). Not available → it acts as Copiar.
  - «⋯» (44×44, `ellipsis`, `aria-label="Más acciones"`) → ActionSheet:
    - «Extender 3 días» (`calendar-plus`) → `POST /manager/sessions/:id/extend {days:3}` → toast `toast.extended` (the new date from the response, else computed) → refresh.
    - «Revocar link» (`ban`, destructive ink) → Dialog «¿Revocar el link de {Ana}?» / «Ya no podrá abrirlo ni subir videos.» [Revocar] (destructive filled) [Cancelar] → `POST /manager/sessions/:id/revoke` → toast `toast.revoked` → the card moves to «Anteriores».
    - «Pedir link nuevo a Grok» (`message-square-text`) → Note sheet prefilled «Necesito un link nuevo para {Ana}.»
    - «Cancelar».
  - **Without a manager token:** no «Revisar», and the ActionSheet holds only «Pedir link nuevo a Grok». Copy and Compartir stay (the link is in the scene).
- **Empty:** EmptyState `users` «Ninguna creadora activa» / «Pídele a Grok un link para una creadora.» + secondary «Escribir a Grok» (Note sheet prefilled «Necesito un link para una creadora nueva.»).
- **Offline:** cached cards. «Revisar», «Extender» and «Revocar» show toast `toast.needOnline` and stay visible (not disabled-looking). Banner «Sin conexión: no se pueden revisar tomas».
- **Single-scene mode** (a manager v1 link with `#m`): the same cards from the manager scene; the token is held in memory only.
- **Edge cases:** an expired but unrevoked session with pending uploaded takes → it stays in the main list (review still possible) with the chip «Vencida». Extend fails (403/404/5xx) → toast `toast.actionFailed`. Revoke offline → toast `toast.needOnline` (never queued).

### 8.8 Review sheet («Revisar tomas») — full height, `#/creadoras/<sid>/tomas`

```
Header: (A) Tomas de Ana                               [✕]
        3 por revisar
[ Por revisar 3 | Todas 8 ]                            Segmented
Producto D · Escena 01 · Toma 1            (Subido)    16/22 600 + StatusChip(take)
┌──────────────────────────────┐
│        9:16 video player      │  max-height 56vh; preload="none"; ticket fetched when within 1 viewport
└──────────────────────────────┘
┌ LO QUE DICES ─────────────────┐  compact SayBox (17/22) from the board beat with the same shot, if available
│ Mira esto                      │
└────────────────────────────────┘
[ 👍 Aprobar ]  [ ↺ Re-grabar ]                         primary md (flex 1) + secondary md (flex 1)
(redo state) ⚠ Re-grabar: Se ve oscuro                  warn banner instead of the buttons
```
- **Data:** live takes of this session; «Por revisar» = `uploaded`; «Todas» = all takes ordered by product, shot and take.
- **Player:** on approach, `GET /manager/takes/:id/url` → validate the ticket URL (`*.workers.dev`, `/manager/takes/<id>/file`, `ticket=`) → `video.src`. Loading: spinner + «Cargando video…». Error: «No se pudo cargar el video» + «Reintentar». Tickets last 1 h; re-fetch on error.
- **Aprobar** → `POST /manager/takes/:id/approve` → toast `toast.approved` → the card leaves «Por revisar» (200 ms) → refresh sessions. When none are left: EmptyState `circle-check` «Nada por revisar» + «Listo» closes.
- **Re-grabar** → the Redo dialog (a sheet over the sheet):
  ```
  ¿Qué hay que cambiar?
  [Se ve oscuro] [No se oye bien] [Muy rápido] [Falta el producto] [Se cortó]   FilterChips (multi-select)
  [ Otro motivo…                         ]      textarea (16 px), max 200 chars with a counter at 160+
  [ Pedir re-grabar ]   primary lg (enabled when ≥1 chip or text)
  [ Cancelar ]          tertiary
  ```
  → `POST /manager/takes/:id/redo {reason}` where `reason = chips.join(". ") + (text ? ". " + text : "")`, trimmed to 200 → toast `toast.redo`. The creator sees the reason in her board.
- **Edge cases:** 403 (manager token rotated) → banner «El permiso de manager cambió. Pídele a Grok el link nuevo.» A take approved meanwhile (409) → refresh silently. Offline → buttons toast `toast.needOnline`.

### 8.9 Boards library — `#/boards`

**Purpose:** a clear map of every board (HR-13, R-08).

**Layout**
```
App bar (compact): ‹  Boards                                   [Nota]
[ Todos 16 | Miami X 12 | Creadoras 4 ]                     Segmented (remembered: boards:lane)
⚠ Con problema                                               Section (bad header icon)
  ┌───────────────────────────────────────────┐
  │ [img 48] Producto H              Creadoras  │  ProductGroupCard header (lane chip only in «Todos»)
  │   Video IA ✦  ·  sáb 20 sep              ›  │  video row: title (or «Video 1») + ✦ for AI + date
  │   TikTok lo marcó: contenido engañoso       │  problem text 14/19 --bad
  │   Producto J · Sin link      [Pedir a Grok] │  missing: secondary md button
  └───────────────────────────────────────────┘
Por grabar
  [img] Producto A
     Gancho corto del video · sáb 10 oct     ›
     Otro gancho · sáb 10 oct                ›
Por aprobar · Editando · Por publicar
▸ Publicados (6)                            collapsed
▸ Guías (2)                                 collapsed
▸ Retirados (1)                             collapsed
```
- **Sections in this order** (hidden when empty): «Con problema» (`problem`), «Por grabar» (`to_film` + `preparing`, where preparing rows show «Preparando» in their meta), «Por aprobar» (`to_approve`), «Grabados» (`filmed`), «Editando» (`editing`), «Por publicar» (`to_publish`), «Publicados» (collapsed), «Guías» (kind `guide`, any status, collapsed), «Retirados» (collapsed).
- **Inside each section:** product groups ordered by the newest board date; inside a group, videos ordered by date descending. **Each board appears exactly once in the library.**
- **Video row:** title = the board `title` (fallback «Video {n}» by date order within the product) · the AI marker `sparkles` 16 + «IA» (only kind `ai`) · relative date · chevron. Tap:
  - `viewer:"board"` → `#/board/<id>` (in-app).
  - `viewer:"canvas"` → opens `../index.html#b=…&k=…` in a new tab. The row meta adds «Board antiguo» with `external-link` 16.
  - `missing` → no navigation. It shows the secondary md «Pedir a Grok» → Note sheet prefilled «Vuelve a publicar el board de {Producto J}.»
- **No** codes, kind chips, «qué es» line, footer or type filter. The lane chip appears only in «Todos». The status isn't repeated per row (the section *is* the status), except «Preparando» in meta.
- **Header count:** none (the segmented counts are enough).
- **Empty:** `empty.boards` / `empty.boards.lane`.
- **States:** loading skeleton · error (boards key missing: ErrorState «Falta la llave de Boards» / «Abre el link de Boards una vez para agregarlo.») · offline (cached).
- **Single-scene mode:** the same screen, compact app bar without back.

### 8.10 Board (shared template) — `#/board/<id>` and the portal product view

**Purpose:** everything needed to film one video, the same for Jorge and the creators (HR-04, HR-05, HR-06).

**Roles**
| Role | Who | Upload / Aprobar section | Nota | Status chip |
|---|---|---|---|---|
| `owner` | Jorge on his board (`board` v2 with `job` and `ownerToken` present) | «Subir video» (owner session) | yes | video status |
| `owner` without `ownerToken` | Jorge before Worker v1.1 | **hidden** (no disabled UI) | yes | video status |
| `approver` | Jorge on an AI board (`approvals[]`) | «Aprobar» | yes | video status |
| `viewer` | Jorge viewing a creator's product | hidden; instead a read-only «Tomas» summary from live sessions (state chips per take, no buttons; «Revisar» link → Review sheet) | yes | job status |
| `creator` | Creator in the portal | «Subir video» (creator token) | **no** | creator projection |

**Layout**
```
App bar (compact, sticky): ‹  Producto A                    (Por grabar)  [Nota]
Jump chips (sticky under the app bar, horizontal scroll): [Referencia] [Escenas 6] [Guion] [Subir]
Banner while uploading: «No cierres la app mientras sube. Si se corta, vuelve y toca Reanudar.»
Section «Video de referencia» (icon film)
   RefPlayer 9:16 · «Toca para ver»
Section «Escenas» (icon list-ordered)
   SceneCard ×N:
     Escena 1 de 6
     [ Referencia ][ La nuestra ]        two 9:16 frames
     ┌ ❝ LO QUE DICES ─────────────────┐
     │ Mira esto                        │   22/29 bold — the largest text on the page
     └──────────────────────────────────┘
     ✋ QUÉ HACES
     Abre el cajón con la mano derecha.   15/20 --text-2
Section «Guion» (icon file-text)
   ScriptBlock (6 lines + «Ver todo») + [⧉ Copiar guion]
Section «Subir video» (icon upload)        — or «Aprobar» for AI boards
   Graba en 1080p, vertical
   TakeRow ×(shots × takes)
```
- **HR-04 rule (tested):** in each SceneCard, the SayBox text has the largest computed font size and highest contrast of any text in the card, and it is larger than the app-bar title. «Qué haces» is smaller (15 px) and in `--text-2`.
- If a beat has no `vo`: the SayBox shows «Sin texto: solo acción» in 15/20 `--muted` (the box is kept for rhythm). If it has no `do_es`: the DoLine is hidden.
- **Jump chips:** tap → smooth scroll to the section (instant under reduced motion). The active chip follows the scroll position (IntersectionObserver).
- **Frames:** lazy-decrypted when within 1.5 viewports. Tap → FrameViewer.
- **Reference video:** decrypted only on tap (it saves data). If absent: the section shows «Este board no tiene video de referencia.» (13/18 muted) instead of a player.
- **Copiar guion** → toast `toast.copied.script`.
- **Nota** (Jorge roles) → Note sheet with the context chip «Sobre: {Producto A}».

#### 8.10.5 «Subir video» section (owner and creator)
- Header «Subir video» + hint «Graba en 1080p, vertical».
- One TakeRow per `shots[] × takes` (default 1 take per shot when `shots` is missing: from beats).
- TakeRow behavior by take state (§6.5):

| State | Circle | Status text | Controls |
|---|---|---|---|
| `missing` | `circle` | «Falta» | **FileButton «Subir video»** (primary lg full) |
| `uploading` | `loader-circle` (spins) | «Subiendo {42} %» | ProgressBar; no buttons; the sticky stay banner is visible; wake lock on |
| `paused` (an IndexedDB record exists, not done) | `circle-pause` | «En pausa» | «Reanudar» (secondary lg, `refresh-cw`) **and** FileButton «Subir video» (if the user prefers to restart; it confirms «¿Empezar de nuevo? Se pierde lo que ya subió.») |
| `uploaded` | `circle-check` (accent) | «Subido» | none |
| `approved` | `circle-check` (good) | «Aprobado» | none |
| `redo` | `rotate-ccw` (bad) | «Re-grabar» | redo banner «Re-grabar: {motivo}» + FileButton «Subir video» |
| `pulled` (owner/viewer only) | `circle-check` (teal) | «En la Mac» | none |

- **Upload flow** (`lib/upload.js`, the Worker contract is unchanged): pick a file → validate `type` starts with `video/` (else inline `up.onlyVideo`) → `POST /upload/init {job, shot, take, size, mime}` → IndexedDB record `{uploadId, key, partSize, size, mime, name, lastModified, parts:{}}` → for each pending part: `POST /upload/sign {uploadId, partNumbers:[n]}` → `PUT` the part (Bearer token only to `*.workers.dev`; R2 presigned URLs without auth), retry ×4 with backoff (400, 800, 1600, 3200 ms), SHA-256 per part → store the etag → progress → after all parts, `POST /upload/complete {uploadId, etags:[{partNumber, etag, sha256}], size}` → delete the record → toast `toast.uploadDone` → refresh the session state. Concurrency 3. Part size from `init` (8 MB default).
- **Resume:** «Reanudar» → if the same page session still holds the `File`, continue. Otherwise open the file picker («Elige el mismo video para seguir.» inline) → verify `size`, `name` and `lastModified` against the record; mismatch → inline «Ese no es el mismo video.» + «Empezar de nuevo» (tertiary) → abort (`POST /upload/abort`) + a fresh init.
- **Errors (inline under the row, `role="alert"`):** 403 → `up.inactive` (the portal also replaces the screen with `err.portalInactive` on the next refresh); 409 → `up.closed`; network on init → `up.startFailed`; a network failure mid-upload after retries → state `paused` + `up.cut`; offline at tap → `up.needOnline`.
- **Wake lock:** requested on start, released on finish or error. Re-acquired on `visibilitychange` → visible if still uploading.
- **Leaving during an upload:** the in-app back or a route change shows Dialog «La subida sigue solo si te quedas aquí.» [Quedarme] [Salir] (Salir → the upload is paused and resumable). The browser `beforeunload` sets `returnValue` while uploading.
- **Portal compatibility:** the portal uses DB `portal-uploads` with the same record keys; old records (without `name`/`lastModified`) skip the identity check and fall back to the size check only.

#### 8.10.6 «Aprobar» section (AI boards, Q-05)
Per `approvals[]` item: a card with the label (16/22 600), media (image contain / 9:16 video, decrypted lazily), and buttons [👍 Dar GO] (primary md) [Pedir cambios] (secondary md).
- Dar GO → outbox `{kind:"approve", blockId:id, choice:"go"}` → toast `toast.go` + Deshacer (undo = an outbox drop if it's still in the grace window; after sending, undo sends nothing and the toast is replaced by «Ya se envió» for 3 s).
- Pedir cambios → a sheet «¿Qué quieres cambiar?» with a textarea + [Enviar] → outbox `approve changes`, plus, if text was written, a `note` with the prefix «Cambios en {Producto}: ». Toast `toast.changes`.
- After a local GO/changes the card shows the success-state chip «GO enviado» / «Cambios pedidos» in place of the buttons, until the next build.

#### 8.10.7 States
Loading (skeleton: player block + 2 scene cards) · error `err.boardOpen` · offline (cached; upload shows `up.needOnline` on tap) · board not found in the boards scene → `err.boardOpen` + «Volver».

### 8.11 Creator portal — `portal.html`

**Purpose:** a creator sees only her products and films and uploads them. **URL, hash and scene v1 are unchanged** (the active session keeps working).

#### 8.11.1 Mis productos (PLP)
```
App bar (large): Hola, Ana
                 Graba sáb 10 oct · vence lun 13           (from shootDate/expiresAt when present; else «{n} productos»)
┌──────────────────────────────────────────┐
│ [img 64] Producto D                        │ 16/22 600, max 2 lines
│          (Por grabar)                      │ StatusChip(job, creator projection)
│          [      Abrir board      ]         │ primary md full width of the text column
└──────────────────────────────────────────┘
```
- Tap the row or «Abrir board» → the board (role `creator`), with an in-page back «‹» (no app routes; it uses `history.pushState` with `#…&p=<productId>` **appended after** the existing params so the hash keeps `b`, `k`, `t` and a reload reopens the same product).
- Empty: `empty.portal`.
- Inactive (403 from `/s/:t`) → full-screen `err.portalInactive`.
- There's no Nota, no app bar actions, no install banner, no tab bar, and nothing about other creators, Jorge, commissions or the feed.
- The theme follows the system (light/dark).

#### 8.11.2 Board (role creator)
§8.10 with role `creator`: the status chip uses the creator projection, the stay banner uses `up.stay.portal`, and there's no Nota. Refreshes live state on `visibilitychange` and every 60 s while visible.

### 8.12 Feed — `#/feed`

**Purpose:** discover products from top creators and mark «Lo quiero» (it keeps all 17 features, R-14).

**Layout** (always dark, full screen, vertical snap)
```
Top overlay (safe-area-top + 8):
 [‹]  [ Miami X 30 | Creadoras 1 | Todos 31 ]  [⚙︎ filtros •]       back 44 · Segmented (translucent) · filter button with an active dot
Card (100dvh):
  cover / preview video (object-fit cover); centered «Toca para ver» play (64 px) until playing
  Right rail (bottom 180 px from the bottom, right 8):
     👁 24,3 mil   ♥ 67   💬 8   ↻ 8   🔖 1,5 mil   ✎ Nota       icon 28 + 11/13 label
  Bottom overlay (gradient scrim):
     @demo.creator · hace 2 d · [Anuncio]                         15/20 600 + 13/18 + chip
     “Hook de ejemplo: esto es lo que nadie te dice…”            15/20 italic, max 2 lines (tap expands)
     [78,3 Score] [139,9x su promedio (3 d)]                       score badge 44 tall + best-multiple chip
     +2.560 vistas/día · 87 vendidos con este video                13/18 muted, ONE line (ellipsis)
     [ ⊕ Lo quiero ]  [ ↗ Abrir en TikTok ]                       primary md + secondary md (translucent)
  Product pill (bottom, full width − 24, radius 16, orange):
     [🛒] [img 48] Producto de ejemplo con título…                 15/20 600, 1 line
                  $35.00 – 105.00 · Comisión 15%                   13/18
     (no product) «Producto sin identificar»                       neutral pill, not tappable
```
- **Lane switch:** «Miami X» · «Creadoras» · «Todos» (labels through `LANES`; the order is always the same). Counts per lane. Remembered in `creatorFeed.avatar`. Default = the scene `default_avatar`, else Miami X. A lane change resets the creator filter and keeps the window.
- **Filters sheet** (button `sliders-horizontal`, `aria-label="Filtros"`, plus an accent dot when any filter ≠ default):
  ```
  Filtros                                               [✕]
  Ventana
   [Todas 31] [3 días 1] [7 días 2] [15 días 3] [30 días 4]     FilterChips (counts within the lane)
  Creador
   (•) Todos                       31
   ( ) @demo.creator                2                            radio rows 52 px (creators of the lane only)
   ( ) @otra.cuenta                 1
  Actualizado 8 oct, 7:43 a. m.                                  13/18 muted
  [Limpiar]  [Ver 31 videos]                                     tertiary + primary lg
  ```
  Changes apply live behind the sheet. «Ver {n} videos» closes it. «Limpiar» resets the window and creator.
- **Score badge:** the number (22/26 700) + label «Score» (or «GMV Max» when the scene label is GMV Max), with the background color by band (existing bands). The best-multiple chip shows `best.label`. Window chips («3d», «7d»…) under the score are **removed** (the filter sheet covers windows).
- **Single product line (R-14):** `product.line` (G-4) if present. Otherwise the viewer builds one line: `velocity.label` + « · » + `video_sales.label`, and drops `product.verify`/`product.sales` when they repeat a number already shown (compares the digits).
- **«Lo quiero»** (only with a numeric `product.id` and a feed mailbox): tap → the button becomes success «Anotado» (`circle-check`) → toast `toast.want` + Deshacer → outbox `approve want` (4 s grace; undo inside the grace window drops it; after sending, undo is not offered). Persisted in `feed-want:<b>` for 7 days (fixes B-05). Without a mailbox: the button is hidden.
- **«Abrir en TikTok»** → `card.url` (only `www.tiktok.com`/`shop.tiktok.com`), new tab.
- **Product pill** → `product.href` (TikTok Shop allowlist), new tab.
- **Nota** (rail) → Note sheet with context «Sobre: @{creador}».
- **Video:** the preview autoplays muted when ≥ 60 % visible (as today). A tap toggles play/pause. Media are decrypted on demand, with a ±1 card window kept and the rest released (feature 17).
- **Back «‹»** → the previous route or `#/dashboard`.
- **Empty lane:** a centered EmptyState (white on black) with `avatars[].empty` (an honest reason). Empty filter: `empty.feed.filter`.
- **Errors:** `err.incomplete` / `err.decrypt` (dark styling).
- **Single-scene mode:** the same, with the back button hidden.

### 8.13 Note sheet («Nota para Grok») — the only note component (R-19)

```
Nota para Grok                                     [✕]
[Sobre: Producto A ✕]                              context chip (optional, removable)
[ Un cambio, una duda…                       ]     textarea 16 px, min 4 rows, autofocus, max 5000
Grok la lee cuando le escribas. No ejecuta nada.   13/18 muted
[ ➤ Enviar ]                                        primary lg (enabled when the text isn't empty)
```
- Send → outbox `note` with `text = (context ? "«" + context + "»: " : "") + text` → close → toast `toast.noteSent` (or `toast.noteQueued` offline).
- Entry points: app-bar «Nota» (Dashboard, Grabar, Creadoras, Boards, Board) and the Feed rail. Prefilled variants: «Pedir link nuevo a Grok», «Escribir a Grok», «Pedir a Grok» (missing board), «Pedir cambios» text.
- Closing with text → confirm «¿Descartar la nota?» [Seguir escribiendo] [Descartar].
- A draft is kept in memory while the app is open (reopening restores it).
- No mailbox → the sheet shows the banner «Sin buzón. Pídele a Grok el link nuevo.» and the button «Enviar» is hidden.

### 8.14 Outbox sheet («Por enviar»)
```
Por enviar                                          [✕]
3 toques esperando conexión | Enviando…            13/18
[✓] Publicado · Producto C            hace 2 min   ⟳
[✎] Elegiste B · Producto A           hace 5 min
[🎥] 2 videos marcados como grabados   hace 8 min   (ticks batch)
[⚠] Nota · «Necesito un link…»        Falló · [Reintentar]
[ Enviar ahora ]                                   primary lg; offline: hidden and replaced by «Se envía al volver la conexión.»
Enviados hoy (collapsed): …
```
Human labels per kind (never raw ids): done → the action label + title; act → the act label + title; pick → «Elegiste {X} · {producto}»; ticks → «{n} videos marcados como grabados»; want → «Lo quiero · {producto}»; go/changes → «GO · {label}» / «Cambios · {label}»; note → «Nota · «{first 30 chars}…»».

### 8.15 Ajustes — `#/ajustes`
```
App bar (compact): ‹  Ajustes
Tema                    [ Automático | Claro | Oscuro ]          Segmented
Instalar en el teléfono  Instalada ✓ | Ver cómo ›                 row (smartphone)
Llaves en este teléfono  Comando ✓ · Feed ✓ · Boards ✓            row (key-round), info only; «modo simple» note if keyMode=raw
Actualizar ahora                                     ›           row (refresh-cw): forces a scene refresh + SW update check
Versión                  2.0.0 (abc1234)                         row, not interactive
Olvidar este teléfono                                            destructive row (log-out, --bad)
```
- «Olvidar este teléfono» → Dialog «¿Olvidar este teléfono?» / «Se borran las llaves y los datos guardados. Para volver a entrar, pega el link del Comando.» (+ «Hay {n} toques sin enviar. Se pierden.» when the outbox isn't empty; + «Hay una subida a medias.» when applicable) [Olvidar] (destructive filled) [Cancelar] → ARCHITECTURE §13.4 → `#/bienvenida`.
- Feed key missing → «Feed: falta (ábrelo una vez desde su link)».

### 8.16 Install guide sheet («Instalar en tu iPhone»)
```
Instala Comando                                     [✕]
1  [share]       Toca Compartir                   (iOS Safari: the bottom bar; iPad/other: the top)
2  [square-plus] Toca «Agregar a inicio»
3  [clapperboard] Abre Comando desde tu pantalla y pega tu link
[ ⧉ Copiar link para la app ]   primary lg — only in the session where the root link was just imported
«Tu link no sale de este teléfono.»                13/18 muted
```
- «Copiar link para la app» copies the full root link (held in memory, never stored) → toast `toast.copied.link`.
- On Android/desktop this sheet is replaced by the native prompt (the «Instalar» button).

### 8.17 Update prompt
The update banner (§2.4). Tap «Actualizar» → if an upload is in progress: Dialog «Termina la subida antes de actualizar.» [Entendido]; else skip-waiting + reload (the route is preserved).

### 8.18 Error and single-scene screens
- **ErrorState (full screen):** a centered 72 px circle with `triangle-alert` (or `wifi-off` / `link-2-off`), title 20/26 700, body 15/20, a primary action if there is one (§7.3). In the dark Feed it uses dark styling.
- **Single-scene mode:** the compact app bar shows the screen title («Grabar», «Boards», «Feed», the product name for a Board, «Creadoras»), with no back (no history) and no tab bar. Nothing hints at other screens (no root key).

### 8.19 `index.html` (generic canvas, kept)
- Kept for ad hoc pieces and «Board antiguo» AI boards. Changes: githack hosts removed from the CSP and the fetch fallback (B-02). If the decrypted scene `type === "board"` → `location.replace("app/" + location.hash)`. «Nota para Grok» copy is unified (`note.*`). No other redesign in v2 (out of scope; content-only pages).

### 8.20 `preview.html`
A static synthetic demo of the v2 Dashboard + Board (inline fixture data, no scene, no key). Banner «Demo con datos de ejemplo.» Used for design review on Pages. CSP `connect-src 'none'`.

---

## 9. Interaction catalog (global)

| Interaction | Where | Behavior | Feedback | Undo |
|---|---|---|---|---|
| Tap tab | tab bar | switch the tab; a second tap scrolls to the top | selected style | — |
| Pull to refresh | tabs, Boards | refresh data | spinner → «Actualizado hace un momento» | — |
| Tap status line | tabs | refresh | «Actualizando…» | — |
| Mark done (✓ / labeled) | Por hacer, sheets | local hide 3 d + outbox | row removal, toast «Listo» | yes (4 s grace drops both; later sends `undo`) |
| Act button | Por hacer, product sheet | local + outbox (`act.id`) | row removal, toast «Listo» | yes |
| Pick script | Script sheet | local 7 d + outbox | footer message, toast | yes |
| Mark filmed / unmark | Grabar | local tick + batched outbox | card moves, toast | yes |
| Lo quiero | Feed | local 7 d + outbox | button → «Anotado», toast | yes (within grace) |
| GO / Pedir cambios | Board (AI) | outbox | card chip, toast | yes (within grace) |
| Send note | Note sheet | outbox | toast | — |
| Copy link / script / search | Creadoras, Board, Mail | clipboard (with fallback) | toast | — |
| Share link | Creadoras | Web Share → fallback copy | system sheet / toast | — |
| Extend 3 días | Creadoras ⋯, hero | Worker POST | toast with the new date | — (no API) |
| Revoke | Creadoras ⋯ | **confirm dialog** → Worker POST | toast, card → Anteriores | — |
| Approve take | Review | Worker POST | toast, card removal | — |
| Re-grabar | Review → dialog | Worker POST {reason} | toast | — |
| Upload / Resume | Board | Worker multipart | progress, states | abort via «Empezar de nuevo» |
| Swipe between scripts | Script sheet | horizontal snap | segment sync | — |
| Swipe feed | Feed | vertical snap | autoplay visible | — |
| Swipe frames | FrameViewer | horizontal | caption | — |
| Swipe down sheet | all sheets | close | — | — |
| Long-press | **none** | — | — | — |
| Keyboard | everywhere | Tab order follows visual order; Enter/Space activate; Escape closes sheets/dialogs; arrow keys in Segmented | focus ring | — |

**Transitions:** tab switch = instant (content crossfade 120 ms); push screens = slide from the right 280 ms (back = reverse); sheets = slide up 280 ms + scrim fade 200 ms; dialogs = fade + scale .96→1 200 ms; toast = slide up 200 ms; row removal = fade + 24 px right 200 ms, then the list collapses 200 ms; hero change = crossfade 200 ms. Reduced motion → opacity only, ≤ 120 ms.

---

## 10. Feature traceability (every current feature → v2)

Legend: **Kept** (same behavior, maybe restyled) · **Moved** · **Merged** · **Removed** (with reason). Test IDs refer to [QA-PLAN.md](QA-PLAN.md).

### 10.1 comando.html (23)
| # | Feature | v2 home | Component | Status | Test |
|---|---|---|---|---|---|
| 1 | Tab Grabar «Mi grabación» | Grabar tab | VideoCard | Merged with grabacion.html | GRB-01 |
| 2 | Generic row | Por hacer / overview rows | ListRow | Kept (one action per row) | DSH-05 |
| 3 | Detail sheet | Task detail sheet | Sheet | Kept | DSH-09 |
| 4 | Script sheet A/B/C | Script sheet | Sheet + Segmented | Kept | SCR-01…08 |
| 5 | Pick payload + local memory + resend | Outbox | outbox.js | Kept (resend → outbox) | SCR-04, OUT-03 |
| 6 | ✓ Hecho | Por hacer | RoundCheck / Button | Kept | DSH-06 |
| 7 | Act button keeps the row | Por hacer (task) | Button | Moved: an act is a task; the product row shows only status (P-3) | DSH-07 |
| 8 | Mail buttons | Mail sheet | Button | Kept (moved into a sheet) | MAIL-01…04 |
| 9 | Stage chips | StatusChip | StatusChip | Kept (unified vocabulary) | VOC-01 |
| 10 | Emoji icons per verb | Lucide icons per task kind | icons.js | Replaced (HR-07) | ICO-01 |
| 11 | Creadoras session card | Creadoras tab | SessionCard | Kept + Share + ⋯ | CRE-01…10 |
| 12 | Take review | Review sheet | Review | Kept (moved into a sheet; reason chips) | REV-01…07 |
| 13 | «Boards» quick links | Atajos tile «Boards» | ShortcutTile | Merged | DSH-04 |
| 14 | Hoy te toca | Por hacer | Section | Kept (minus filming, minus hero item) | DSH-05 |
| 15 | Productos de la semana | Productos + Product sheet | Section, Sheet | Kept (status only) | PRD-01…06 |
| 16 | Marcas | Marcas section + sheets | Section, Sheet | Kept (waiting collapsed) | MAR-01…03 |
| 17 | Grok está en esto | Grok trabaja en | Section | Kept (product-stage duplicates removed) | DSH-11 |
| 18 | Section «Creadoras» in Más | — | — | **Removed** (R-01: Creadoras tab) | DSH-13 |
| 19 | Footer + Nota para Grok | Avisos (Dashboard) + Note sheet | Section, NoteSheet | Merged | DSH-12, NOTE-01…05 |
| 20 | Toast with Deshacer | Toast | Toast | Kept | TST-01 |
| 21 | Auto-refresh 60 s + on resume | Refresh loop | app.js | Kept (+ pull to refresh) | REF-01…03 |
| 22 | Link errors | ErrorState | ErrorState | Kept (copy unified, host placeholder bug fixed) | ERR-01…05 |
| 23 | Dark/light | Tokens | ui.css | Kept (+ manual override) | THM-01 |

### 10.2 hub.html (~13)
| # | Feature | v2 home | Status | Test |
|---|---|---|---|---|
| 1 | Title = date + «act.» | App-bar status line «Actualizado hace…» | Replaced (R-15) | DSH-02 |
| 2 | Counter tiles | — | **Removed** (R-16); tab badges | NAV-03 |
| 3 | Quick links | Atajos | Merged | DSH-04 |
| 4 | Lo próximo | HeroCard | Kept (no duplicate, R-04) | DSH-03 |
| 5–12 | Rows, sheets, picks, ✓, act, mail, chips, sections, footer, note | as in 10.1 | Merged | as 10.1 |
| 13 | Responsive columns on desktop | Single centered column | Simplified | DSK-01 |

### 10.3 grabacion.html (10)
| # | Feature | v2 home | Status | Test |
|---|---|---|---|---|
| 1 | Pendientes / Grabados tabs | Segmented «Por grabar / Grabados» | Kept (renamed) | GRB-02 |
| 2 | Grouped by day + summary | DayHeader + progress | Kept (relative dates, overdue) | GRB-03, GRB-04 |
| 3 | Place label when several | place sub-header | Kept | GRB-05 |
| 4 | Row: photo, product + video name | VideoCard | Kept | GRB-01 |
| 5 | Abrir board / Board en camino | «Abrir board» / chip «Preparando» | Kept | GRB-06 |
| 6 | Marcar grabado / Desmarcar + Deshacer + local | toggle «Grabado» / «Desmarcar» | Kept | GRB-07 |
| 7 | Batched ticks POST (5 min, Enviar) | Outbox (ticks coalescing, «Enviar ahora») | Kept | OUT-05 |
| 8 | «Al día ✓» / pending | Outbox pill | Merged | OUT-07 |
| 9 | Empty states + Mac tip | EmptyState | Kept | GRB-09 |
| 10 | Link errors | ErrorState | Kept | ERR-* |

### 10.4 boards.html (8)
| # | Feature | v2 home | Status | Test |
|---|---|---|---|---|
| 1 | Avatar segment (Bella) | Lane Segmented (Creadoras) | Kept (renamed) | BRD-02 |
| 2 | Type chips | AI marker on rows + «Guías» section | **Removed as a filter** (R-08) | BRD-03 |
| 3 | Remembered filter | `boards:lane` | Kept | BRD-04 |
| 4 | Card with status/avatar/type/code/date/what/note | Status sections → ProductGroupCard → video rows (title, date, problem text) | Redesigned (R-08) | BRD-05…08 |
| 5 | Missing key text | «Sin link» row + «Pedir a Grok» | Kept (actionable, B-11) | BRD-09 |
| 6 | 9 status labels | VideoStatus (§6.1) | Unified | VOC-02 |
| 7 | Footer | Avisos (Dashboard) if still relevant | Merged | — |
| 8 | Empty with filter | EmptyState | Kept | BRD-10 |

### 10.5 feed.html (17)
| # | Feature | v2 home | Status | Test |
|---|---|---|---|---|
| 1 | Vertical full-screen snap, encrypted cover, preview autoplay | Feed | Kept | FED-01 |
| 2 | Lane segment (Bella) | Lane Segmented «Creadoras» | Kept (renamed) | FED-02 |
| 3 | Window chips | Filters sheet «Ventana» | Moved (R-14) | FED-04 |
| 4 | Creator chips | Filters sheet «Creador» | Moved | FED-05 |
| 5 | «Nota» button + sheet | Rail «Nota» → Note sheet | Merged (R-19) | FED-12 |
| 6 | «Actualizado…» | Filters sheet footer | Moved | FED-06 |
| 7 | Overlay @creator, age, Anuncio, hook | Bottom overlay | Kept | FED-07 |
| 8 | Score badge + best multiple + window chips | Score + best chip | Kept (window chips removed; label «Score») | FED-08 |
| 9 | Velocity + sales lines | One line | Merged (R-14) | FED-09 |
| 10 | Right rail metrics | MetricRail | Kept | FED-10 |
| 11 | Abrir en TikTok | Button | Kept | FED-11 |
| 12 | Lo quiero | Button + outbox + persisted | Kept (+ persistence, B-05) | FED-13 |
| 13 | Product pill | ProductPill | Kept | FED-14 |
| 14 | Unidentified product | Neutral pill | Kept | FED-15 |
| 15 | Honest empty per lane / window | EmptyState | Kept | FED-16 |
| 16 | Errors | ErrorState (dark) | Kept | FED-17 |
| 17 | Media memory management | ±1 window | Kept | FED-18 |

### 10.6 portal.html (10)
| # | Feature | v2 home | Status | Test |
|---|---|---|---|---|
| 1 | PLP «Hola, nombre» + rows | Portal PLP | Kept (+ shoot/expiry line) | POR-01 |
| 2 | PDP order: ref → scenes (Lo que dices / Qué haces) → script → upload | Board (shared) | Kept (single template) | BRD-T-01…06 |
| 3 | Take row + states | TakeRow | Kept (states renamed: Falta/Subido/Re-grabar) | UPL-02 |
| 4 | «Subir video» primary | FileButton | Kept | UPL-01 |
| 5 | Resumable multipart, IndexedDB, wake lock, stay banner | upload.js | Kept (+ same-file check) | UPL-03…08 |
| 6 | Reanudar only if interrupted | TakeRow paused | Kept | UPL-05 |
| 7 | Upload errors | inline errors | Kept | UPL-06 |
| 8 | Revoked/expired | `err.portalInactive` | Kept | POR-04 |
| 9 | Back PDP → PLP, refresh on resume | in-page back + `&p=` | Kept (+ survives reload) | POR-03 |
| 10 | Per-product blobs (lazy) | board loader | Kept | POR-05 |

### 10.7 manager.html (6) → Creadoras
| # | Feature | v2 | Test |
|---|---|---|---|
| 1 | Portals list | SessionCard list | CRE-01 |
| 2 | Copiar link | «Copiar link» (+ Compartir) | CRE-04 |
| 3 | Take preview by ticket | Review player | REV-02 |
| 4 | Aprobar / Re-grabar + motivo | Review | REV-03, REV-04 |
| 5 | Revocar / Extender | ⋯ ActionSheet (+ confirm) | CRE-06, CRE-07 |
| 6 | Statuses incl. «En Mac» | «En la Mac» (§6.4) | VOC-03 |

### 10.8 board.html (4) → Board screen (ref video, scenes, script + copy, status): Kept, + «Subir video» for owner (Q-06). Tests BRD-T-*.

### 10.9 index.html (5 + 20 block types)
| Feature | v2 | Test |
|---|---|---|
| Blocks, GO/changes, encrypted media, note | Kept in `index.html` for ad hoc canvases. Jorge's FF boards migrate to the Board template (G-5). AI boards → Board «Aprobar» once republished. | IDX-01…03 |
| ~17-block FF board | **Removed** for FF (R-09); replaced by the Board template | BRD-T-* |

### 10.10 preview.html (1) → a synthetic v2 demo. Test PRV-01.

### 10.11 Worker-backed features → see ARCHITECTURE §11. Tests WRK-* (mocked).

---

## 11. Redundancy resolution (R-01 … R-20)

| ID | Redundancy | Decision | Where it's verified |
|---|---|---|---|
| R-01 | Creadoras twice in Comando | Only the Creadoras tab; the `creadoras` section is ignored by the v3 adapter and dropped in v4 | DSH-13 |
| R-02 | One product in up to 5 places | One Product sheet. Dashboard: one Productos row (status) + at most one task (action). Grabar: its videos (Jorge's only). Boards: each video once. Hero excluded from the list. | PRD-05, BRD-06 |
| R-03 | Three parallel filming lists + the tile counting `rec:open` | One Grabar tab; `rec:open` dropped; no tiles | GRB-01, NAV-03 |
| R-04 | Lo próximo duplicates the first Hoy item | The hero item is removed from Por hacer | DSH-03 |
| R-05 | Chip + sub + group + button say the same thing | One chip (overview) or one action (Por hacer); meta only adds new info (`now`, dates) | DSH-08, PRD-03 |
| R-06 | Repeated verb «Grabar ·» and identical subs | Verbs removed from titles; subs only when they differ (video title vs product, place, takes) | GRB-08 |
| R-07 | Footer and note on every tab | Avisos on Dashboard only; Note = one sheet from the app bar | DSH-12, NOTE-01 |
| R-08 | Boards noise and misclassification | Status sections → product groups → video rows; one lane filter; system pages excluded (generator + viewer); no codes/kind chips/footer | BRD-03…08, SEC-10 |
| R-09 | The old board repeats VO/action 4× | The Board template: VO once (SayBox), action once (DoLine); FF boards republished (G-5) | BRD-T-02 |
| R-10 | Two board templates, duplicated code | `lib/board.js` used by the app (owner/approver/viewer) and the portal (creator); `board.html` → redirector | BRD-T-07, SEC-07 |
| R-11 | Two viewers for the hub scene | `hub.html` and `comando.html` → redirectors to `app/` | LNK-01, LNK-02 |
| R-12 | manager.html duplicates Creadoras | Redirector; single-scene Creadoras | LNK-06 |
| R-13 | Status vocabulary drift | `lib/status.js`, one label per state; creator projection only collapses states | VOC-01…05 |
| R-14 | Feed repeats sales 3×; 3 rows of controls | One product line; lane switch + Filters sheet; «Actualizado» in the sheet | FED-04, FED-09 |
| R-15 | Raw ISO, past dates as upcoming | `lib/dates.js` relative + «Atrasado» | DAT-01…04 |
| R-16 | Triple counting | Tiles removed; section headers have no counts; badges only for actionable items | NAV-03, NAV-04 |
| R-17 | Creator job in Jorge's filming | `owner` filter (generator + viewer) | GRB-10 |
| R-18 | 7 near-identical «Esperando respuesta» rows | One group row with a count → Marcas sheet; only actionable brand items are tasks | MAR-01 |
| R-19 | Four note components | NoteSheet only | NOTE-01…05 |
| R-20 | Placeholder names | Schema forbids them; the viewer drops placeholder tasks/videos | DSH-14 |

---

## 12. Bugs and tech debt (B-01 … B-12 + found during this review)

| ID | Resolution | Phase |
|---|---|---|
| B-01 | Fix the feed test (allow `creatorFeed.avatar` and `feed-want:`), add it to `npm test` and CI | 0 |
| B-02 | Remove githack/raw.githubusercontent from the CSP **and from the fetch fallback** in `feed.html` and `index.html` (both still fetch scenes from `raw.githack.com` when not on Pages) | 0 |
| B-03 | PWA (ARCHITECTURE §12) | 6 |
| B-04 | Agent-Skills viewer copy → README pointer (G-9) | 0 |
| B-05 | README updated; «Lo quiero» persisted (`feed-want:<b>`) | 0 / 5 |
| B-06 | Dashboard default (HR-01) | 2 |
| B-07 | Generator excludes system pages; viewer filter | 4 / 8a |
| B-08 | Lucide everywhere | 1–5 |
| B-09 | Owner upload (Q-06) | 4 / 8c |
| B-10 | Thumb placeholder, no broken-image glyph; fixtures use valid images | 1 |
| B-11 | «Sin link» actionable («Pedir a Grok»); G-5 republish | 4 / 8b |
| B-12 | Overdue state | 2–3 |
| B-13 (new) | `comando.html` shows the literal `__CANVAS_HOST__` in the wrong-host error | 0 (and moot after Phase 7) |
| B-14 (new) | The feed reads the mailbox only from `#f`; rotation breaks «Lo quiero»/notes → channel mailbox resolution (D-17) | 5 |
| B-15 (new) | Test fixtures use a real-looking creator name → synthetic «Ana» | 0 |
| B-16 (new) | The portal labels a not-yet-uploaded take «Enviado» → «Falta» | 4 |
| B-17 (new) | `manager.html` shows English «Shot 01 take 1» → moot (redirector) | 7 |
| B-18 (new) | Comando «Copiar link» has no clipboard fallback → `core.copyText` everywhere | 3 |
| B-19 (new) | Creadoras ignores live sessions missing from the scene → union with «Link en camino» | 3 |

---

## 13. Accessibility spec

- **Targets ≥ 44×44** for every interactive element (QA A11Y-03 measures the bounding boxes, including inline «Ver todo» links, which get padding).
- **Contrast:** text ≥ 4.5:1, large text and UI ≥ 3:1, in both themes and on tinted chips (A11Y-02).
- **Semantics:** `<nav>` for the tab bar with `aria-current`; Segmented = `tablist`/`tab`; sheets = `role="dialog" aria-modal="true" aria-labelledby`; confirm = `alertdialog`; toasts = `status` (polite); inline errors = `alert`; progress = `progressbar`; SayBox = `<blockquote>` with a visible label; icons `aria-hidden`; icon-only buttons have `aria-label`; badges are included in the accessible names.
- **Focus:** visible ring; trapped in sheets/dialogs; returned to the opener; skip none (no skip link needed: there's a single main region).
- **Motion:** `prefers-reduced-motion` honored (§3.6). Autoplay in the Feed respects reduced motion (no autoplay; tap to play).
- **Text size:** layout tolerates 200 % text zoom without horizontal scroll (A11Y-05); rows wrap titles to 2 lines at large sizes.
- **Language:** `<html lang="es">`; numbers and dates formatted for `es-US`.
- **Video:** take previews have `controls`; the reference video has `controls`; no audio autoplay.
- **Forms:** textareas have visible labels or `aria-label`; 16 px font (no iOS zoom).
- **axe:** zero `serious`/`critical` violations on every screen state in both themes (A11Y-01).
