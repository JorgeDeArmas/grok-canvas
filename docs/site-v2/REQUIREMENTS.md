# REQUIREMENTS — Sitio v2 de Jorge (Comando + Boards + Creadoras + Feed) como PWA

> **Documento de requisitos para el agente de arquitectura (Claude Opus 5.5).**
> Tu trabajo: leer esto + el código del repo `grok-canvas`, diseñar la **arquitectura completa del sitio** y escribir un **PRD detallado** (UI, componentes, interacciones, estados, datos, PWA, QA, migración, fases) que luego seguirá el agente de implementación.
> **No implementes nada en este paso.** No toques páginas live, llaves, sesiones ni el Worker.

| Campo | Valor |
|---|---|
| Versión | 1.0 · 8 oct 2026 |
| Dueño | Jorge De Armas (dueño del negocio, usa el teléfono, español cubano) |
| Fuente del inventario | `grok-canvas` @ `bc59be9` (main, PR #16), `Agent-Skills` @ `ecf27d2` (skills grok-canvas, hub-tu-dia, creator-feed, tiktok-shop-creator-portal, tiktok-shop-film-board, tiktok-shop-organic-film-factory), datos de hub del box (solo estructura) y capturas |
| Idioma | Español. Términos técnicos en inglés cuando son más claros (PWA, service worker, token, scene…) |
| Repo público | Este documento vive en un repo **PÚBLICO**. No contiene llaves, tokens, blobs, IDs de sesión, buzones, montos de tratos ni nombres de marcas en negociación. Mantenlo así en el PRD. |

---

## 0. Cómo leer este documento

1. §1–2: objetivo, usuarios y vocabulario (incluye **Creadoras reemplaza a Bella**).
2. §3: arquitectura actual (hosting, cifrado, buzón, Worker).
3. §4: **inventario exhaustivo** de funcionalidades por página (lo que hay que conservar).
4. §5: estados del pipeline y vocabulario de estados.
5. §6: **auditoría de redundancias** (lo que hay que eliminar o fusionar), con evidencia.
6. §7: bugs y deuda técnica detectados.
7. §8: **requisitos duros de Jorge** (no negociables).
8. §9: restricciones (privacidad, links existentes, Worker, generadores, rutinas, a11y…).
9. §10: preguntas abiertas que tú decides (con recomendación).
10. §11: **entregables que esperamos de ti** (estructura del PRD).
11. §12: QA y criterios de aceptación mínimos.
12. Anexos: contratos de datos actuales, payloads de buzón, endpoints del Worker, storage local, CSP, tests, capturas.

Pedido original de Jorge (resumen fiel): *«La página de todos los boards está muy confusa, organízala; tiene demasiada información que creo que es redundante. En la página del Comando la pestaña por defecto debe ser la que dice "Más" y hay que cambiarle el nombre por algo como **Dashboard**; **Grabar** sería la segunda pestaña y **Creadoras** la otra. Basado en todas las funcionalidades que tenemos, planea la arquitectura completa del sitio, crea una excelente experiencia de usuario quitando toda la información redundante, piensa bien dónde poner cada feature y el mejor componente para cada tipo de funcionalidad. Entrega un PRD bien detallado con toda la UI y todas las interacciones; después el agente que implementa sigue la especificación y pasa un QA probando toda la experiencia; la meta es que todo funcione al 100%. Considera iconografía y todo. Que sea una **PWA** que pueda instalar en el teléfono con acceso a **todas** las funcionalidades (feed y todo). Recuerda que ahora en vez de Bella es **Creadoras**.»*

> Nota de interpretación: la pestaña actual se llama literalmente **«Más»**; Jorge pide que «la que dice Más» sea la pestaña por defecto y se renombre **Dashboard**. Además es la que más información tiene. Ambas lecturas coinciden: **Dashboard (ex-Más) = pestaña por defecto**.

---

## 1. Objetivo y usuarios

### 1.1 Objetivo
Un solo sitio privado, **phone-first**, instalable como **PWA**, que reúna todo lo que hoy está repartido en 10 páginas: qué hacer hoy, qué grabar, qué productos entran, qué hacen las creadoras contratadas, todos los boards, el Creator Feed, y las aprobaciones. Con **mínimo texto**, español simple que entienda cualquiera, UI moderna, **sin información repetida**, y con **una sola plantilla de board** compartida entre Jorge y las creadoras.

### 1.2 Usuarios y lo que ve cada uno

| Usuario | Cómo entra | Qué ve | Qué NO debe ver nunca |
|---|---|---|---|
| **Jorge** (dueño) | Su link privado del Comando (y hoy, links separados de Feed, Grabación, Boards, Manager y cada board). En v2: **la PWA instalada** | Todo: Dashboard, Grabar, Creadoras, Feed, Boards, guiones, marcas, tracker de productos, acciones de manager (extender/revocar sesiones, aprobar/re-grabar tomas) | — |
| **Creadora contratada** (hoy hay una activa; filma para la cuenta que antes se llamaba «Bella») | Un link de portal por día de grabación (`portal.html#b&k&t`), enviado por WhatsApp. Expira al final del día de grabación + 3 días (America/New_York) | **Solo** sus productos asignados: lista de productos → board (video de referencia, escenas, guion, subida de tomas) y el estado de cada toma | El Comando, otros productos, comisiones/costos, `editor_brief`, el manager token, otras creadoras, el feed, las marcas |
| **Manager** (hoy = Jorge) | Acciones dentro del Comando (pestaña Creadoras) o `manager.html#b&k&m` | Sesiones, tomas, aprobar/re-grabar, extender/revocar | — |
| **Grok (el bot)** | No usa la UI; **lee el buzón** (webhook.site) y **genera las escenas** cifradas | Payloads de toques (schema-limited) | — |

### 1.3 Plantilla única de board
Un solo board mínimo para Jorge y para las creadoras: **video de referencia → escenas (referencia | la nuestra, con «Lo que dices» y «Qué haces») → guion → subir video**. Hoy ya existe (`board.html` ≈ `portal.html` PDP) pero los boards de Jorge siguen en la plantilla vieja (`index.html`, ~17 bloques). Ver §4.8–4.9 y §6 R-09/R-10.

### 1.4 Lanes / cuentas (naming)
- **Miami X** = la cuenta propia de Jorge (él sale en cámara). Se mantiene.
- **Creadoras** = el segundo carril. Antes era **«Bella»** (persona/cuenta con avatar IA). Ahora el carril lo graban **creadoras humanas** contratadas. **«Bella» desaparece de toda la UI** y se reemplaza por **«Creadoras»** (filtros del feed, filtros de boards, textos del hub como «video de Bella listo», footers, detalles, etc.). Los IDs internos (`bella` en `creator_profile.json → creator_feed.avatars`, `products.json lane`, `boards.avatar`, cuenta `bella` del Worker, ítems `bella:<pid>:post`) pueden mantenerse como claves técnicas con label «Creadoras», o migrarse — **tú decides y documentas el mapeo** (§10).

---

## 2. Glosario

| Término | Significado |
|---|---|
| **Scene** | JSON con los datos de una página, cifrado AES-GCM (`{"iv","ct"}`) en `scenes/<blob>.json` del repo público |
| **Theme** | Una página privada publicada: blob + key + buzón opcional + viewer. Índice local secreto `$CANVAS_INDEX` (nunca en git) |
| **Link** | `https://jorgedearmas.github.io/grok-canvas/<viewer>.html#b=<blob>&k=<key>[&f=<buzón>][&t=<token creadora>][&m=<manager token>]`. **El link completo es el secreto**; el `#` nunca llega al servidor |
| **Media `.enc`** | Imagen/video cifrado (12 bytes IV + AES-GCM) con la misma key del theme, nombre opaco `m<16hex>.enc`, servido por jsDelivr o same-origin |
| **Buzón (mailbox)** | URL de webhook.site donde el teléfono hace POST de toques (✓, picks, «Lo quiero», marcas de grabado, notas). Datos **no confiables**; Grok solo aplica efectos con schema estricto |
| **Worker** | Cloudflare Worker `creator-portal-api` (D1 + R2): sesiones de creadoras, subidas multipart reanudables, acciones de manager |
| **FF-00N** | Job de Film Factory (video orgánico en cámara). **Nunca se muestra a Jorge ni a creadoras** (solo nombres de producto) |
| **JOB-NN** | Job de video IA (Kling). Igual: no mostrar códigos |
| **Pack** | Board + `action.md` + `editor_brief` listos para grabar (`pack_ready`) |
| **Donor / referencia** | Video de TikTok que se copia 1:1 en estructura |
| **Lo próximo** | Tarjeta con la acción más importante (hub v2) |

---

## 3. Arquitectura actual

### 3.1 Hosting y seguridad
- **GitHub Pages** desde `main` / root del repo `jorgedearmas/grok-canvas`. **El repo DEBE seguir PÚBLICO** (en el plan gratis, privado = Pages apagado = todos los links rotos; pasó el 1 oct y se revirtió).
- Viewers = HTML estáticos con JS/CSS inline, **sin datos**. Cada viewer valida host (`*.github.io` o localhost), descifra la scene con la key del hash y renderiza todo con escape de texto.
- CSP por `<meta>` (no hay headers en Pages): `default-src 'none'`, `script-src 'unsafe-inline'`, `img/media/connect` con allowlist por página (ver Anexo E). `referrer no-referrer`, `base-uri/form-action/object-src 'none'`.
- **Nunca** abrir viewers por raw.githack/rawcdn.githack (sus anuncios recibieron una `#k=`; hubo rotación).
- Media siempre cifrada desde el primer commit (git y jsDelivr no olvidan).
- CI (`.github/workflows/test.yml`): `npm ci`, Playwright Chromium, `npm test`, `scripts/check-secrets.sh`.

### 3.2 Flujo de datos
```
Generadores en el box (Python) ──seal AES-GCM──► scenes/<blob>.json + media/*.enc (git push → Pages ~1 min)
      ▲                                                     │
      │ ingesta schema-limited (cada build)                 ▼
webhook.site (buzón) ◄──POST toques── Viewer en el teléfono (key en #hash)
                                                           │
                                     Cloudflare Worker (D1+R2) ◄── portal: subidas / Comando: acciones manager
                                                           │
                                     Mac Mini (launchd puller cada 5 min) ──► ~/FilmFactory/jobs/<job>/03-takes/
```

### 3.3 Generadores y rutinas (producen los datos)
| Generador | Produce | Cuándo |
|---|---|---|
| `hub-tu-dia/scripts/build_hub.py` (+ `hub_collect.py`, `hub_comando.enrich`, `picks.py`, `tracker.py`) | Scene `hub` v3 (Comando) | Rutina Hub **7:00 / 10:00 / 15:00 / 20:00 ET** + cada cambio de pipeline |
| `build_filming.py` | Scene `filming` (Grabación) | Dentro de cada `build_hub.py` |
| `build_boards.py` | Scene `boards` (Todos los boards) | Dentro de cada `build_hub.py` |
| `creator-feed/scripts/run_feed.py` | Scene `creator-feed` + media cifrada | Rutina diaria **7:34 ET** |
| `tiktok-shop-film-board/scripts/publish_canvas.py` | Board viejo (`index.html`, bloques) | Al llegar a `pack_ready` |
| `tiktok-shop-film-board/scripts/publish_board.py` | Board unificado (`board.html`, type `board`) | Jobs nuevos / `--theme` explícito |
| `tiktok-shop-creator-portal/scripts/portal_build.py` | Scene `portal` por sesión + scene `manager` + sesión en Worker | `session new / revoke / extend` |
| `portal_pull.py` (Mac, launchd) | Baja tomas de R2 a `03-takes/` | Cada 5 min |

---

## 4. Inventario exhaustivo por página actual

Formato por feature: **qué hace · fuente de datos · acciones · estados · quién lo ve**. «J» = Jorge, «C» = creadora.

### 4.1 `comando.html` — Comando (viewer live del hub; scene `type: hub|comando`, v3)
Link: `comando.html#b&k` (buzón dentro de la scene, `scene.mailbox`, rota sin cambiar el link). Lo ve: **J**.
Header: título «Comando», «act. h:mm» (de `updatedAt`), barra de tabs segmentada.

**Tabs actuales (orden real del código):** `Grabar` (badge = filas a grabar) · `Creadoras` (badge = sesiones activas no revocadas) · `Más` (badge = suma de ítems visibles de todas las otras secciones).
**Tab por defecto actual:** `Grabar` si hay filas; si no, `Creadoras` si hay sesiones; si no, `Grabar`. **Nunca `Más`.** (README dice «Mi grabación + Creadoras»: desactualizado.)

| # | Feature | Qué hace | Datos | Acciones | Estados |
|---|---|---|---|---|---|
| 1 | Tab Grabar → sección «Mi grabación» | Filas de videos que Jorge tiene que grabar (sección `grabar` + ítems de `hoy` con `group: "Grabar"`), sin los jobs asignados a creadoras, sin la fila `rec:open` | `scene.sections[id=grabar|hoy]` | Tocar fila → abre detalle (sheet) o el board; botón «Ver board» (o `hrefLabel`) | vacío «Nada que grabar.» |
| 2 | Fila genérica (`itemHtml`) | Thumb 128 px (inline JPEG), verbo en negrita + título + chip de etapa + sub; botones; chevron si abre sheet | `item {id, verb, title, sub, tone, href, hrefLabel, done, group, quiet, chip, act, detail, thumb, open, mail}` | Tap/Enter/Espacio = `rowTap` | tonos bad/warn/good/info |
| 3 | Sheet de detalle | Bottom sheet con thumb, título, sub, pares `detail [[label,value]]` y los mismos botones | `item.detail` | Cerrar (✕, Escape, scrim) | — |
| 4 | Sheet de guiones A/B/C | Tabs A/B/C (★ recomendado, ✓ elegido), swipe sincroniza tab; por guion: hook, VO segundo a segundo con ACCIÓN y texto en pantalla, Formato, Cómo (transfiere donor o «Estructura propia»), Quién sale, Dónde, Duración, teleprompter, reglas, donor link | `scene.scripts["ff-NNN"]`, `item.open.scripts` | «Elegir este guion (X)» / «Cambiar a guion X» / «Quitar elección» / «Listo»; toast con Deshacer | sin elegir · elegido local (enviando/preparando) · procesado (`picked`) · bloqueado (`changeable:false`) · offline («se envía al volver a abrir») |
| 5 | Pick de guion | POST `{kind:"pick", v:1, job, letter, at}`; guarda en `localStorage hub-picks:<blob>` 7 días; reenvía no enviados al abrir | buzón | Deshacer | ver #4 |
| 6 | ✓ Hecho | Oculta el ítem en ese teléfono 3 días (`hub-done:<blob>`) y POST `{kind:"approve", blockId, choice:"done"}`; Deshacer = `undo` | buzón | ✓ redondo o botón con label (`done` string, p. ej. «Publicado») | — |
| 7 | Botón de acción que conserva la fila (`act`) | «La aprobaron» / «Pedí muestra» / «Llegó» / «Lo tengo» → POST approve done con `act.id`; muestra `doneLabel` («Aprobada ✓») | `item.act` | Deshacer | — |
| 8 | Botones de correo (marcas) | iPhone/iPad: «Abrir Gmail» (`googlegmail://` constante) + «Copiar búsqueda»; Android: «Abrir Gmail» (web) + copiar; desktop: «Abrir correo» (`mail.google.com/?authuser=`) | `item.mail {web, search, subject}` | Copiar → toast «Copiado. Ahora abre Gmail, toca Buscar y pega.» | link inválido → sin botón |
| 9 | Chips de etapa | Pill pequeño (p. ej. «Pack listo», tono good) | `item.chip {text, tone}` | — | — |
| 10 | Iconos por verbo | Emoji según verbo cuando no hay thumb (✍️ Elegir guion, 📲 Publicar, 🎬 Grabar, 🎒 Preparar grabación, 🛍️ Elegir productos, 🤝 Decidir oferta, ✉️ Enviar respuesta, 📦 Entregar/¿Llegó?, ✅ Cerrado, 💬 Negociando, ⚠️ Email rebotó, 🎥 Completar tomas, 💻 Pasar tomas a la Mac, 🧩 Armando pack, ✂️ Editando, 📝 Escribiendo guiones, 🖼️ Dar GO a las fotos, 🔎 Content gap/Identificando, 🎞️ Haciendo video) | `ICONS` en el viewer | — | — |
| 11 | Tab Creadoras → tarjeta por sesión | Nombre, fecha de grabación (ISO crudo), «Vence en N días / mañana / hoy / Venció» (rojo si hoy/mañana/venció), «· revocado», chips por producto «<Producto> · <estado>» (p. ej. «Wonderskin 1440 Longwear · Abierto»), badge de tomas pendientes de revisar | `scene.creators[]` (de `portals.json`) + **live** `GET /manager/sessions` (Worker) | «Copiar link» (siempre; copia el link del portal con `t=`), «Extender» (+3 días, `POST /manager/sessions/:id/extend {days:3}`), «Revocar» (`POST /manager/sessions/:id/revoke`) — estos dos **solo si hay manager token** (`scene.managerToken` sellado o `#m=`) | sin sesiones «Ninguna sesión.»; toast por tarjeta «Copiado / Extendido / Revocado / No se pudo» |
| 12 | Revisión de tomas (dentro de Creadoras) | Por toma: «Escena 0N · estado», motivo de re-grabar, `<video>` con preview por ticket de 1 h (`GET /manager/takes/:id/url` → `/file?ticket=`) | Worker | «Aprobar» (`POST /manager/takes/:id/approve`), «Re-grabar» + textarea «Motivo» (`/redo {reason}`) | estados: Enviado, Abierto, Subiendo, Subido, Aprobado, Re-grabar, Listo (pulled) |
| 13 | Tab Más → «Boards» (quick links) | Botones grandes a otras páginas del sitio (same-origin), p. ej. «Todos los boards» | `scene.quick[] {label, sub, href}` (máx 3) | Abrir (nueva pestaña) | href no same-origin → se descarta |
| 14 | Tab Más → «Hoy te toca» | Lista priorizada (Grabar > Aprobar/Elegir > Muestras > Pendiente > Publicar > Elegir productos), agrupada por `group` | `sections[id=hoy]` (`lead:true`) | ✓, abrir, sheet | `empty` / `doneEmpty` |
| 15 | Tab Más → «Productos de la semana» (tracker) | Un producto por fila agrupado por sábado objetivo o «Fecha por definir»; chip de etapa; sub con nº de videos listos + estado de muestra; detalle con Etapa / Ahora / Muestra / Grabación; link PDP dentro del detalle (`quietLink`) | `sections[id=productos]` (de `products.json` + jobs) | «La aprobaron» / «Llegó» / «Lo tengo» (`act`); abrir PDP; abrir guiones si aplica | vacío «Ningún producto elegido. En el Creator Feed toca «Lo quiero» o mándale el link a Grok.» |
| 16 | Tab Más → «Marcas» | Tratos con marcas por grupo: Esperando respuesta / Cerrado · esperando contrato y pago / En negociación / Otros | `sections[id=marcas]` (de retainer inbox `state.json`) | Botones de correo (#8), ✓ en manuales | vacío «Sin tratos abiertos.» |
| 17 | Tab Más → «Grok está en esto» | Lo que el bot está haciendo (identificar producto, content gap, guiones, armando pack…) | `sections[id=marcha]` | Abrir/detalle | «Nada en proceso.» |
| 18 | Tab Más → sección «Creadoras» | Fila «Portal · <nombre> · fecha · estado · N productos» (sin token) | `sections[id=creadoras]` | — | «Ningún portal activo.» |
| 19 | Footer | Líneas de texto (`scene.footer`, p. ej. videos viejos sin cerrar, «Mac Mini revisada…») + «Nota para Grok» (`<details>` + textarea + Enviar → `{kind:"note", text}`) | `scene.footer`, buzón | Enviar | «Enviada.» / «No se pudo enviar.» |
| 20 | Toast con Deshacer | Confirmaciones («Listo ✓», «Anotado ✓», «Elección quitada»…) con botón Deshacer; sube arriba cuando hay sheet abierto | — | Deshacer | — |
| 21 | Auto-refresh | Recarga la scene cada 60 s y al volver a la app (visibilitychange); refresca sesiones del Worker; no re-renderiza si el usuario está escribiendo la nota | — | — | error de carga con scene previa → se queda con la previa |
| 22 | Errores de link | «Este enlace está incompleto. Pídele a Grok el enlace completo.» · «Abre este enlace desde <host>.» · «No se pudo abrir. La llave no coincide o todavía se está publicando.» | — | — | — |
| 23 | Dark/light | `prefers-color-scheme`, tokens CSS estilo iOS (ver Anexo F) | — | — | — |

**Total Comando: 23 features.**

### 4.2 `hub.html` — «Tu día» (viewer legacy de la MISMA scene hub)
Lo ve: **J** (links viejos). Ignora campos v3 (`creators`, `portalApi`).
| # | Feature | Detalle |
|---|---|---|
| 1 | Título = fecha («Jueves 8 oct») + «act. h:mm» | `scene.title`, `updatedAt` |
| 2 | **Tiles contadores** (4): por elegir · por publicar · por grabar · productos; tocar = salta a la sección y la resalta; los `hoy:` cuentan en vivo | `counters[] {label, value, jump}` |
| 3 | **Quick links** («Todos los boards · 16 boards») | `quick[]` |
| 4 | **Lo próximo**: primer ítem abierto de la sección lead, tarjeta grande con un botón primario; «Todo hecho por hoy ✓» si no hay | derivado |
| 5–12 | Igual que Comando #2–#10, #14–#19: filas, sheets de detalle y guiones, picks, ✓, `act`, correo, chips, secciones Hoy/Productos/Por grabar (incluye fila «Grabación · todos los boards por grabar» → `grabacion.html`)/Marcas/Grok está en esto/Creadoras, footer + Nota para Grok | |
| 13 | Layout responsive: 1 columna en teléfono, columnas en desktop | |
**Total: ~13 features (casi todas duplicadas con Comando).**

### 4.3 `grabacion.html` — «Grabación» (scene `filming` v2)
Link `grabacion.html#b&k` (buzón en scene). Lo ve: **J**.
| # | Feature | Detalle |
|---|---|---|
| 1 | Tabs **Pendientes / Grabados** | |
| 2 | Agrupado por día (`Sábado 3 oct`, `Sábado 10 oct`, `Sin fecha`) con resumen «N videos listos para grabar · X de N grabados · K en camino» | `videos[].day` |
| 3 | Etiqueta de lugar (SALA/CARRO/COCINA/BAÑO) solo si el día tiene varios lugares | `videos[].place` |
| 4 | Fila por video: foto del producto, nombre + nombre corto del video (hook) | `products{key:{name,thumb}}`, `videos[].title` |
| 5 | «Abrir board» (o «Board en camino» si no está listo) | `videos[].board`, `ready` |
| 6 | «Marcar grabado» / «Desmarcar» con toast Deshacer; guardado instantáneo `localStorage rec-ticks:<blob>`; el más nuevo gana contra `scene.ticks` | |
| 7 | Envío por lotes: un POST `text/plain` `{kind:"ticks", v:2, set:{"rec:<job>":[0|1, ms]}}` máx cada 5 min o al tocar «Enviar» | buzón |
| 8 | Estado arriba: «Al día ✓» / pendientes de enviar | |
| 9 | Vacíos: «¡Todo grabado! 🎉», «Nada grabado todavía», «Cuando marques un video, sale aquí.», tip «Pasa las tomas a la Mac con los nombres de cada board.» | |
| 10 | Errores de link (iguales a Comando) | |
**Total: 10 features.**

### 4.4 `boards.html` — «Todos los boards» (scene `boards`, read-only)
Link `boards.html#b&k`, sin buzón. Lo ve: **J**. Abierto desde quick link del hub.
| # | Feature | Detalle |
|---|---|---|
| 1 | Segmento de avatar: Todos · Miami X · **Bella** (con conteos) — **debe pasar a «Creadoras»** | `avatars[]` (del perfil `creator_feed.avatars`) |
| 2 | Chips de tipo: Todos los tipos · Video IA · Grabación · Framework | `kinds[]` |
| 3 | Filtro recordado (`localStorage boards:av`, `boards:kind`) | |
| 4 | Tarjeta por board, más nuevo primero: foto, nombre corto, «qué es» (1 línea), chip de estado, chip de avatar, chip de tipo, código (FF-00N/JOB-NN) + fecha, nota opcional (roja si `noteTone:"bad"`, p. ej. «TikTok Shop lo marcó: contenido engañoso…»), «Abrir board» | `boards[]` |
| 5 | Board sin llave → texto «Sin link: la llave de este board se perdió (Grok puede volver a publicarlo).» | `missing` |
| 6 | Estados: Board listo, Aprobado, Entregado, Grabado, Editando, Publicado, **Violación**, Retirado, Sin link | `status`, `tone` |
| 7 | Footer (boards antiguos sin link, notas) | `footer[]` |
| 8 | Vacío con filtro: «No hay boards con este filtro.» | |
**Total: 8 features.** Datos reales hoy: **16 boards** (incluye 2 páginas de sistema mal listadas, §6 R-08).

### 4.5 `feed.html` — Creator Feed (scene `creator-feed` v3.1)
Link `feed.html#b&k&f`. Lo ve: **J**. Pantalla completa estilo TikTok, tema oscuro fijo.
| # | Feature | Detalle |
|---|---|---|
| 1 | Feed vertical full-screen con snap; portada cifrada; preview de video (top-10, 10 s, 540p) que se reproduce al estar visible; «Toca para ver» | `cards[].cover`, `preview` (enc) |
| 2 | Segmento de lane: **Miami X · Bella · Todos** (conteo por tab; recordado en `localStorage creatorFeed.avatar`) — **Bella → «Creadoras»** | `avatars[]`, `default_avatar` |
| 3 | Chips de ventana: Todas · 3d · 7d · 15d · 30d (con conteos dentro del lane) | `windows`, `cards[].windows` |
| 4 | Chips de creador: Todos · @handle (conteo; solo creadores del lane) | `creators[]` |
| 5 | Botón «Nota» → sheet «Nota para Grok» (textarea, «Enviar a Grok», «Cerrar», línea de método) | buzón `{kind:"note"}` |
| 6 | «Actualizado: 8 oct 2026, 7:43 a. m. ET» | `updated_label` |
| 7 | Overlay: @creador, edad («hace 2 d»), badge «Anuncio», hook entre comillas (o caption) | |
| 8 | **Score** badge (número + label «Feed v3»/«GMV Max»), color por banda; chip «mejor múltiplo» («139.9x su promedio (3d)»); chips de ventanas | `score`, `best`, `windows` |
| 9 | Línea de velocidad («+145.983 vistas/día») y línea de ventas del video/producto | `velocity.label`, `video_sales.label` |
| 10 | Rail derecho: vistas, likes, comentarios, compartidos, guardados (iconos SVG) | `metrics` |
| 11 | «Abrir en TikTok» | `url` (solo `www.tiktok.com`/`shop.tiktok.com`) |
| 12 | **«Lo quiero»** → POST `{kind:"approve", blockId:"want:<product_id>", choice:"want"}` → Grok agrega el producto al tracker («Productos de la semana») en el próximo refresh | estados: Lo quiero → Enviando… → Anotado ✓ / «No se pudo · reintenta». Solo en memoria (se olvida al recargar) |
| 13 | **Pill de producto (PDP)**: carrito, imagen cifrada, título, precio · «Comisión ✓/X%»/«Comisión: verificar», línea verify (ventas ↑, nº creadores, rating) → abre PDP de TikTok Shop | `product` |
| 14 | Producto sin identificar: pill «Producto sin identificar» | `product_missing_label` |
| 15 | Vacíos honestos por lane («Hoy no hay videos para X: …62 creadores seguidos… No se rellena con videos flojos.») y por ventana | `avatars[].empty`, `labels.empty` |
| 16 | Errores: «Enlace incompleto», «No se pudo abrir · La llave no abre esta escena o el archivo aún no está publicado.» | |
| 17 | Gestión de memoria de media (descifra on-demand, libera blobs fuera de pantalla) | |
**Total: 17 features.** Datos hoy: 31 tarjetas (30 Miami X, 1 Bella), ventanas 3/7/15/30.

### 4.6 `portal.html` — Portal de la creadora (scene `portal`)
Link `portal.html#b&k&t` (t = token de sesión de la creadora). Lo ve: **C**.
| # | Feature | Detalle |
|---|---|---|
| 1 | PLP: «Hola, <nombre>» + filas de producto (thumb cifrado, nombre truncado, estado, «Ver board») | `products[]` |
| 2 | PDP = board (orden): **Video de referencia** (`00-ref/ref.mp4` cifrado, 540p) → **Escenas** (por beat: «Referencia» | «La nuestra», recuadro azul **«Lo que dices»** (VO) + **«Qué haces»** (acción, secundario)) → **Guion** (textarea readonly + «Copiar guion») → **Subida** («Graba en 1080p») | `beats[] {shot, vo, do_es, refFrame, ourFrame}`, `script`, `refSrc`, `shots[] {shot, takes}` |
| 3 | Fila por toma: «Escena 0N · take M», círculo de estado (✓ / ! / vacío), estado («Enviado», «Subiendo x%», «Subido ✓», «Rehacer»), motivo de rehacer en banner, barra de progreso | Worker `GET /s/:token` |
| 4 | **«Subir video»** = botón primario azul ancho completo con icono (input file `accept="video/*"`) | |
| 5 | Subida multipart reanudable: `/upload/init` → `/upload/sign` → PUT partes (8 MB, 3 en paralelo, SHA-256 por parte) → `/upload/complete`; estado en **IndexedDB**; Wake Lock; banner «No cierres Safari mientras sube. Si se corta, vuelve a abrir este link y toca Reanudar.» | Worker + R2 |
| 6 | **«Reanudar»** (solo si hay subida a medias) → «Reanudando…» / «Vuelve a elegir el video para reanudar» / «Nada que reanudar» | IndexedDB |
| 7 | Errores de subida: «Solo video», «Este enlace ya no está activo» (403), «Este take ya está cerrado» (409), «No se pudo empezar» | |
| 8 | Sesión revocada/expirada → «Este enlace ya no está activo» | Worker |
| 9 | Botón atrás (‹) PDP → PLP; refresca estado al volver a la app | |
| 10 | Productos con blob propio (carga perezosa por producto) | `products[].blob` |
**Total: 10 features.**

### 4.7 `manager.html` — Manager (scene `manager`)
Link `manager.html#b&k&m` (m = manager token en el hash). Lo ve: **J**.
| # | Feature | Detalle |
|---|---|---|
| 1 | Lista «Portales» (creadora, fecha, estado de sesión) | scene + Worker |
| 2 | «Copiar link» (WhatsApp) → «Link copiado» | |
| 3 | Preview de toma por ticket corto (Safari Range 1080p) | `/manager/takes/:id/url` |
| 4 | «Aprobar» / «Re-grabar» + «Motivo de re-grabar» | `/manager/takes/:id/approve|redo` |
| 5 | «Revocar» / «Extender» («Extendido 3 días», «Revocado») | `/manager/sessions/:id/*` |
| 6 | Estados: Enviado, Abierto, Subiendo, Subido, Aprobado, Re-grabar, **En Mac** | |
**Total: 6 features (100 % duplicadas con Comando › Creadoras).**

### 4.8 `board.html` — Board unificado (scene `board`)
Link `board.html#b&k`. Lo ve: **J**. Es **el mismo código que `portal.html`** (1 línea distinta) y abre directo la PDP de un producto. Sin `t=` → **no hay sección de subida** para Jorge.
**Total: 4 features (ref video, escenas con Lo que dices/Qué haces, guion + Copiar, estado).**

### 4.9 `index.html` — Canvas genérico / boards viejos (scene default, bloques)
Link `index.html#b&k&f`. Lo ve: **J**. Hoy lo usan **los boards de Jorge (FF-00N)**, los boards de video IA (JOB-NN), frameworks y piezas ad hoc.
| # | Feature | Detalle |
|---|---|---|
| 1 | Bloques: `pipeline`, `image` (+GO/Pedir cambios + Descargar), `video` (+GO/Pedir cambios), `audio`, `script` (editable, «Copiar», «Enviar corrección a Grok» → `{kind:"script"}`), `cards`, `kpi`, `line`, `bar`, `donut`, `table`, `timeline`, `checklist`, `compare`, `steps`, `callout`, `faq`, `places`, `gallery`, `prose` | `scene.blocks[]` |
| 2 | Aprobaciones GO / Pedir cambios → `{kind:"approve", blockId, choice:"go|changes"}` con toasts («GO enviado a Grok.», «Cambios pedidos…») | buzón |
| 3 | Media cifrada con «Descifrando…» y «Descargar» | |
| 4 | «Nota para Grok» al final de cada página | buzón |
| 5 | Board FF típico (de `publish_canvas.py`), **~17 bloques**: Estado (pipeline) · Producto · El hueco que vamos a llenar · Formato que copiamos 1:1 · Board image (donor izq vs tú der) · Beat por beat (tabla) · Variante con pareja · Lo único que cambia · Guion VO · Acción por shot (checklist) · Props y set · Video referencia · Donor y referencias · Ojo al grabar · Sábado (timeline) · Cómo se edita (tabla) · Reglas para shots de 2 tomas | |
**Total: ~5 features base + 20 tipos de bloque.**

### 4.10 `preview.html` — Vista previa pública (sin key)
Demo estática del Comando + portal con datos de ejemplo («Demo. El hub en vivo no cambia.»). Útil como referencia visual, no es una página de producción. **1 feature.**

### 4.11 Backend: Worker `creator-portal-api` (contrato a respetar)
- Público: `GET /health`, `OPTIONS` (CORS solo `ALLOWED_ORIGIN`).
- Creadora (bearer `t`): `GET /s/:token` (sesión: creator_name, shoot_date, expires_at, jobs, takes), `POST /upload/init {job, shot, take, size, mime}`, `POST /upload/sign {uploadId, partNumbers}`, `PUT /upload/part/...`, `POST /upload/complete {uploadId, etags, size}`, `POST /upload/abort`. Máx 5 takes por shot, tamaño declarado obligatorio (máx 5 GB por defecto), partes de 8 MB, throttling por IP en tokens fallidos.
- Manager (bearer manager token; `MANAGER_TOKEN_PREV` para rotación): `GET /manager/sessions`, `GET /manager/takes/:id/url` (ticket HMAC 1 h), `GET|HEAD /manager/takes/:id/file?ticket=`, `POST /manager/takes/:id/approve`, `POST /manager/takes/:id/redo {reason}`, `POST /manager/sessions/:id/revoke`, `POST /manager/sessions/:id/extend {days 1–14, default 3}`.
- Admin (solo box/Mac, `PORTAL_ADMIN_TOKEN`): accounts, creators, sessions (create/revoke/extend), `pending-pull`, `takes/:id/pulled|preview|object`, `events?since=` (incluye `link_expiring`).
- D1: `accounts`, `creators`, `sessions` (token_hash SHA-256, expires_at, revoked_at, sent_at, first_opened_at), `session_jobs` (status), `takes` (status, redo_reason, pulled_at…), `uploads`, `events`.
- Estado de job derivado: `redo` si alguna toma redo; `approved`/`pulled` si todas; `uploading`; `uploaded`; `sent`; `opened`.

### 4.12 Funciones «fuera de pantalla» que la UI dispara (no romper)
- Tracker: «Lo quiero» (feed) → entrada en `products.json`; «Pedí muestra» → `pending_approval`; «La aprobaron» → ETA + sábado; «Llegó»/«Lo tengo» → llegada.
- Pick de guion → `script_letter` en el job → paso `pack` en `prep_queue.json` → film-board → `pack_ready`.
- Marca de grabado → `pack_ready ↔ filming` + `filmed_at` → hub «Pasar tomas a la Mac».
- «Publicado» → ítem `bella:<pid>:post` hecho → board «Publicado».
- Rotación de buzón (< 12 h o ≥ 60 requests) sin cambiar links (la scene lleva el id).

### 4.13 Resumen del inventario
| Página | Features | Usuario |
|---|---|---|
| comando.html | 23 | J |
| hub.html (legacy) | ~13 (casi todas duplicadas) | J |
| grabacion.html | 10 | J |
| boards.html | 8 | J |
| feed.html | 17 | J |
| portal.html | 10 | C |
| manager.html | 6 (duplicadas) | J |
| board.html | 4 (= portal PDP) | J |
| index.html | 5 + 20 tipos de bloque | J |
| preview.html | 1 (demo) | público |
| Worker API | 6 públicos/creadora + 7 manager + 10 admin endpoints | — |
| **Total** | **≈ 97 features de UI en 10 viewers** | |

---

## 5. Estados del pipeline y vocabulario

### 5.1 Etapas del producto (tracker, derivadas, nunca tipeadas)
Elegido → **Muestra por aprobar** → Muestra pedida → En camino → Llegó → Content gap listo → Guiones por aprobar → **Armando pack** → Pack listo → Grabado → Editando → Por publicar → Publicado. Además: **Fecha por definir** (muestra sin aprobar: sin ETA ni sábado), regla del jueves 8 PM (no llegó → pasa al sábado siguiente, se avisa 3 días), `dropped`, **brand hold** («Decidir oferta»).

### 5.2 Estados de job Film Factory
`queued` → `scripts_ready` → `pack_ready` → `filming` → `takes_ready` → `editing` → `done` (`blocked`).

### 5.3 Estados del portal (Worker)
Job/sesión: `sent` (Enviado) · `opened` (Abierto) · `uploading` (Subiendo) · `uploaded` (Subido) · `approved` (Aprobado) · `redo` (Re-grabar) · `pulled` (en la Mac). Toma (vista creadora): **Enviado · Subiendo x% · Subido ✓ · Rehacer** (+ «Reanudar» si quedó a medias).

### 5.4 Estados de board (boards.html)
Board listo · Aprobado · Entregado · Grabado · Editando · Publicado · **Violación** · Retirado · Sin link.

### 5.5 Vocabulario inconsistente (a unificar en el PRD)
| Concepto | Hoy se dice | Dónde |
|---|---|---|
| Toma bajada a la Mac (`pulled`) | «Listo» / «En Mac» / «Subido ✓» | comando / manager / portal |
| Re-grabar (`redo`) | «Re-grabar» / «Rehacer» | comando+manager / portal |
| El bot arma el board | «Grok arma el board» / «Grok arma el pack» / «Armando pack» / «Armando el board» | comando / hub / tracker / ICONS |
| Abrir board | «Ver board» / «Abrir board» / «Abrir» / «Ver guiones» | comando / grabación+boards / filas / hub |
| Confirmación | «Hecho ✓» / «Listo ✓» / «Anotado ✓» / «Enviada.» / «Enviado.» | varios |
| Score del feed | «Feed v3» / «Score Feed v3» / «GMV Max» | card / labels / default |
| Lane 2 | «Bella» | feed, boards, hub (textos, detalles, footer) → **«Creadoras»** |

El PRD debe definir **un diccionario único de copy** (es-US/Cuba, simple) y una **máquina de estados única** por entidad (producto, video/job, sesión, toma, board) con su label, color, icono y acción primaria.

---

## 6. Auditoría de redundancias (resolver todas)

Evidencia: capturas de fixtures sintéticas (reproducibles con `SHOTS_DIR=<dir> npm test` y `npm run test:feed` en este repo; ver Anexo G) y, solo en el box de Grok (privadas, no en git), capturas con datos reales: `/workspace/prd/creator-portal/comando/01-comando-top.png`, `02-comando-creadoras.png`, `03-comando-mas.png`, `05-hub-old-link.png`, `/workspace/prd/site-v2/assets/private/boards-phone.png`, `grabacion_iphone.png`.

| ID | Redundancia | Evidencia | Dirección sugerida (tú decides) |
|---|---|---|---|
| **R-01** | **Creadoras aparece 2 veces** en el Comando: como tab y como sección «Creadoras» dentro de Más | scene `sections[id=creadoras]` + tab; `03-comando-mas.png` | Una sola casa: tab Creadoras |
| **R-02** | **Un mismo producto aparece hasta en 5 lugares**: Más › Productos de la semana, Grabar › Mi grabación, página Grabación, Todos los boards, Hoy/Lo próximo. Ej.: Forge Skin = 1 fila en Productos («2 videos listos para grabar») + 2 filas en Mi grabación + 2 en Grabación + 3 tarjetas en Boards | scenes hub/filming/boards | Entidad «Producto» con una ficha única; las listas solo referencian |
| **R-03** | **Tres listas paralelas de «qué grabar»**: tab Grabar (sección `grabar` + `hoy/Grabar`), `grabacion.html`, y la fila «Grabación · todos los boards por grabar» (`rec:open`) dentro de la propia sección; el tile «por grabar» dice 9 cuando hay 8 (cuenta `rec:open`) | scene hub (`rec:open`), `01-comando-top.png`, `grabacion_iphone.png` | Una sola vista Grabar con Pendientes/Grabados y marcar grabado |
| **R-04** | **«Lo próximo» repite el primer ítem de «Hoy te toca»** (mismo ítem dos veces seguidas) | `05-hub-old-link.png` («Publicar · Producto» x2) | Lo próximo saca el ítem de la lista o la lista empieza en el 2º |
| **R-05** | **Filas de producto dicen lo mismo 2–3 veces**: chip «Pack listo» + sub «1 video listo para grabar»; grupo «Fecha por definir» + sub «muestra gratis pedida, falta que la aprueben» + botón «La aprobaron» | `03-comando-mas.png` | Un estado = un chip + una acción |
| **R-06** | **Verbo repetido sin valor**: «Grabar ·» en cada fila dentro de la tab Grabar y la sección «Mi grabación»; sub «N tomas · guion y acciones listos» idéntico en todas las filas | `01-comando-top.png` | Quitar verbo; mostrar solo lo que diferencia (lugar, día) |
| **R-07** | **Footer y Nota para Grok repetidos en cada tab** («2 videos viejos de Bella…», «Mac Mini revisada…») | `02-comando-creadoras.png` | Avisos de sistema en un solo lugar (Dashboard) o en un «estado del sistema» |
| **R-08** | **Todos los boards: ruido por tarjeta y datos mal clasificados**. Cada tarjeta lleva estado + avatar + tipo + código + fecha + «qué es» + nota; filtros avatar × tipo; **«Portal <creadora>» y «Portal manager» aparecen como boards** («Board listo», tipo «Video IA», avatar «Otro»); el mismo producto 2–3 veces sin agrupar (Forge Skin x3, Magnesio Toplux x2); «Board listo» en ~10 de 16 = no informa; footer repite | `boards-phone.png` (privada), scene boards | Agrupar por producto y por estado accionable (Por grabar / En edición / Publicado / Con problema); sacar páginas de sistema; un solo filtro (lane) |
| **R-09** | **Board viejo de Jorge (~17 bloques) repite VO y acción 4 veces**: imagen del board (VO+ACCIÓN quemados), tabla «Beat por beat», «Guion VO», checklist «Acción por shot»; además «Estado» (pipeline) repite la etapa del tracker, «Producto» repite la ficha, «Sábado» repite Grabación | `publish_canvas.py` bloques | Migrar todo a la plantilla única (§8 HR-05) |
| **R-10** | **Dos plantillas de board y código duplicado**: `index.html` (boards FF/IA viejos) vs `board.html`/`portal.html`; `board.html` y `portal.html` son idénticos salvo 1 línea; filas de Mi grabación enlazan a boards `index.html` aunque `hub_comando` prefiere `board.html` | diff, scene hub | Un solo módulo de board con capacidades por rol |
| **R-11** | **Dos viewers para la misma scene hub**: `hub.html` (tiles, Lo próximo, quick links) y `comando.html` (tabs); links viejos siguen abriendo `hub.html` | `05-hub-old-link.png` | Uno solo; el viejo redirige preservando el hash |
| **R-12** | **`manager.html` duplica la tab Creadoras** (copiar link, extender, revocar, aprobar/re-grabar, preview) y además está listado en Todos los boards | código | Fusionar en Creadoras; manager.html → redirect |
| **R-13** | **Vocabulario de estados distinto** para lo mismo (ver §5.5) | código | Diccionario único |
| **R-14** | **Feed: la misma cifra de ventas hasta 3 veces por tarjeta** («Ventas ↑ +1.883/día (antes +525)» en `video_sales.label`, `product.verify` y `product.sales`), y **3 filas de controles** encima del video (lane + ventanas + creadores) + «Nota» + «Actualizado…» | scene feed, `feed_card_producto.png` | Una línea de producto; filtros en un sheet |
| **R-15** | **Fechas confusas/viejas**: ISO crudo «2026-10-08» en Creadoras; grupos «Sábado 3 oct» (ya pasó; hoy es 8 oct) mostrados como si fueran próximos en Productos y Grabación, sin marca de atrasado; título del hub = fecha + «act. 7:22» | `02-comando-creadoras.png`, `grabacion_iphone.png` | Fechas relativas («hoy», «sáb»), atrasado explícito |
| **R-16** | **Triple conteo**: badge de tab + número de sección + tiles; badge «Más 19» suma cosas sin relación | `01/03-comando-*.png` | Badges solo para lo accionable |
| **R-17** | **Job asignado a creadora aparece en la Grabación de Jorge** (Wonderskin en `grabacion.html`) aunque se quita de Mi grabación | `grabacion_iphone.png`, scene filming | Una regla de pertenencia (dueño = Jorge o creadora) aplicada en todas las vistas |
| **R-18** | **Marcas: 7 filas «Esperando respuesta» casi idénticas** con botón de correo y «tarifa enviada 28 sep»; una misma marca aparece en 2 filas (negociación + manual) | `03-comando-mas.png` | Colapsar «esperando» en un resumen; mostrar solo lo que pide acción |
| **R-19** | **«Nota para Grok» con 4 formas distintas** (details en footer, sheet del feed, artículo en index, chip «Nota») | código | Un solo componente global |
| **R-20** | **Nombres placeholder**: «Publicar · Producto» (sin nombre real) | `05-hub-old-link.png` | Contrato: nombre obligatorio o fallback mejor |

---

## 7. Bugs y deuda técnica detectados (incluir en el plan)

| ID | Hallazgo | Detalle |
|---|---|---|
| B-01 | `npm run test:feed` **falla** y **no está en `npm test` ni en CI** | Asserta que `feed.html` no use `localStorage`, pero el feed ya guarda `creatorFeed.avatar`. Con esa línea quitada pasa (Chrome). |
| B-02 | CSP de `index.html` y `feed.html` todavía permite `raw.githack.com`, `rawcdn.githack.com`, `raw.githubusercontent.com` | La skill prohíbe githack (fuga de `#k=` previa). |
| B-03 | **No hay PWA** | Sin manifest (`manifest.webmanifest` → 404), sin service worker, sin iconos/apple-touch-icon/splash. |
| B-04 | Copia del viewer en Agent-Skills (`grok-canvas/viewer/`) desincronizada | Falta `comando.html`; 6 viewers y varios tests difieren del repo live. |
| B-05 | README desactualizado | Dice tabs «Mi grabación y Creadoras»; código: Grabar / Creadoras / Más. README dice que «Lo quiero» se recuerda en `localStorage feed-want:<id>`; el código lo guarda solo en memoria (se pierde al recargar). |
| B-06 | Lógica de tab por defecto nunca elige «Más» | Ver §4.1. |
| B-07 | `build_boards.py` lista páginas de sistema (portal de creadora y manager) | Contradice la regla «system pages are never listed». Además expone el link del manager dentro de otra página. |
| B-08 | Iconografía mezclada | Emojis (mapa `ICONS`) + SVG inline (feed, botón subir) + caracteres (✓ ✕ ‹ ★). |
| B-09 | Board de Jorge sin subida | `board.html` sin `t=` oculta la sección Subida → contradice «una sola plantilla con Subir video». |
| B-10 | Thumbs rotos en fixtures del Comando | `command-center.png` (fixture) muestra imágenes rotas. |
| B-11 | Un board publicado perdió su llave («Sin link») | Debe republicarse; el PRD debe definir el estado y la acción. |
| B-12 | Fechas en el pasado sin estado «atrasado» | §6 R-15. |

---

## 8. Requisitos duros de Jorge (no negociables)

| ID | Requisito |
|---|---|
| **HR-01** | **Comando: la pestaña por defecto es «Dashboard»** (la actual «Más», la más informativa), renombrada «Dashboard». Al abrir el sitio/PWA siempre cae en Dashboard. |
| **HR-02** | **Orden de pestañas: Dashboard · Grabar · Creadoras.** Esas tres son las pestañas principales. Feed, Boards y el resto se ubican donde tú propongas (≤ 2 toques desde cualquier lugar); si propones una 4.ª pestaña (p. ej. Feed) márcalo como decisión para que Jorge la apruebe. |
| **HR-03** | **Mínimo texto, español simple** que entienda cualquiera, UI moderna. Nada de códigos internos (FF-00N, JOB-NN, IDs, rutas) en pantalla. |
| **HR-04** | **En cada board, la frase que se dice es lo más visible**: recuadro con etiqueta **«Lo que dices»**; la acción va secundaria con etiqueta **«Qué haces»**. |
| **HR-05** | **Una sola plantilla de board** para Jorge y para las creadoras: video de referencia → escenas → guion → subir video. Los boards de Jorge (hoy en `index.html`) migran a esta plantilla. |
| **HR-06** | **Subir = botón primario relleno «Subir video»** (con icono). Nunca texto plano ni pill gris que parezca deshabilitado. «Reanudar» solo aparece si una subida se cortó. |
| **HR-07** | **Sistema de iconografía completo y consistente** (un set SVG, mismo trazo/tamaño, para cada verbo, estado, lane, acción y tipo de contenido), con labels; sin mezclar emojis. |
| **HR-08** | **PWA instalable en iPhone y Android**: manifest, iconos (incl. maskable y apple-touch-icon), splash, service worker, offline shell, `display: standalone`, guía para «Agregar a pantalla de inicio» (iOS Safari no tiene prompt automático). **Con acceso a TODAS las funciones** (feed incluido). |
| **HR-09** | **Todo por link publicado.** Jorge no puede abrir archivos HTML en el teléfono: nada de descargas `.html`; QA, previews y entregas siempre como URL de GitHub Pages. |
| **HR-10** | **«Creadoras» reemplaza a «Bella»** en toda la UI y en los textos que generan los scripts. Miami X se queda. |
| **HR-11** | **Quitar toda la información redundante** (§6) y decidir conscientemente dónde vive cada feature y qué componente usa. |
| **HR-12** | **Todo funciona al 100 %**: QA completo de toda la experiencia antes de decir «listo para producción». |
| **HR-13** | **«Todos los boards» reorganizado** y fácil de entender (hoy «muy confuso»). |

---

## 9. Restricciones

### 9.1 Privacidad (preservar el modelo)
- Scenes y media **cifradas** en el repo público; la **key solo en el `#hash`** (o, si lo propones para la PWA, en almacenamiento del dispositivo — ver §10 Q-01; nunca en query string, nombre de archivo, manifest, `start_url`, logs, analytics ni commits).
- Las creadoras **solo** ven su sesión (scene filtrada por `portal_build.py`, sin `editor_brief`, comisiones, costos ni otros jobs).
- **El manager token nunca llega a una creadora** (ni en su scene, ni en su link, ni en una página que ella pueda abrir). Hoy vive sellado en la scene del hub (`managerToken`) o en `#m=`. Referirse a él solo por nombre (`PORTAL_MANAGER_TOKEN`).
- **El link del Comando no se comparte** (contiene la key del dashboard, links de portales con `t=` y potencialmente el manager token).
- Service worker: puede cachear **solo** el shell público y blobs **cifrados**; nunca contenido descifrado ni keys. Las keys no viajan en requests (el hash no se envía) — mantener esa propiedad.
- Buzón = datos no confiables. No ampliar los efectos posibles sin documentar el schema y la validación en el generador.
- Nada de terceros: sin CDNs de fuentes/iconos/analytics. Hosts permitidos: `*.github.io` (same-origin), `cdn.jsdelivr.net` (media cifrada), `webhook.site` (buzón), `*.workers.dev` y `*.r2.cloudflarestorage.com` (portal). Quitar githack.
- `scripts/check-secrets.sh` y el secret scan de CI deben seguir pasando; ningún link con `#k=`/`t=`/`m=` en git.

### 9.2 Links existentes y migración
- Deben **seguir funcionando** (o redirigir preservando el hash) todos los links que Jorge tiene guardados: `comando.html`, `hub.html`, `grabacion.html`, `boards.html`, `feed.html`, `manager.html`, cada `index.html` / `board.html` de board, y **la sesión activa de la creadora en `portal.html`** (no se le puede romper el link a mitad de su sesión).
- Si cambian rutas, los HTML viejos se convierten en redirectores que hacen `location.replace(nueva + location.hash)` (el hash nunca sale del cliente).
- Mismo blob + misma key por theme (los generadores son idempotentes). Si la arquitectura nueva necesita un «keyring» (p. ej. la scene del Dashboard llevando las keys de feed/grabación/boards), definir cómo se genera sin rotar keys existentes.

### 9.3 Worker (Cloudflare)
- Contrato de §4.11 se respeta. **Ningún `wrangler deploy` desde un agente**; si el PRD necesita cambios en el Worker (p. ej. una sesión «owner» para que Jorge suba sus propias tomas, o listar sesiones con más campos), especificarlos como cambio aparte, versionado y compatible hacia atrás, con migración D1 y tests (vitest + miniflare).
- CORS: `ALLOWED_ORIGIN` = el origen de Pages. Si cambian rutas, sigue siendo el mismo origen.

### 9.4 Hosting
- Estático en GitHub Pages, repo público, sin build server obligatorio. Si propones un build step (bundler, TS), el resultado compilado se commitea y CI verifica que esté al día. Cambios de viewer siempre por PR revisado.

### 9.5 Generadores y rutinas
- El PRD debe especificar **cambios de contrato de datos** en: `build_hub.py`/`hub_collect.py`/`hub_comando.py` (scene Dashboard), `build_filming.py`, `build_boards.py`, `run_feed.py`, `publish_board.py`/`publish_canvas.py`, `portal_build.py` (scenes portal/manager), y el perfil `creator_profile.json` (`creator_feed.avatars` labels → «Creadoras»).
- Rutinas existentes que deben seguir funcionando: **Hub 7/10/15/20 ET**, **Creator Feed 7:34 ET**, puller de la Mac cada 5 min, ingestas schema-limited en cada build.
- Versionar scenes (`version`) y que el viewer nuevo acepte la versión anterior durante la transición (o el generador publique ambas).

### 9.6 Diseño y accesibilidad
- **Dark y light** (`prefers-color-scheme`), tokens de diseño compartidos por todas las vistas (el feed puede seguir siendo oscuro inmersivo).
- Viewport primario **390×844** (iPhone 12–16); funcionar bien desde 360 px hasta desktop.
- Targets táctiles **≥ 44 px**, contraste WCAG AA (4.5:1 texto, 3:1 UI), safe areas (`env(safe-area-inset-*)`), `prefers-reduced-motion`, foco visible, roles ARIA (tabs, dialog, status), textos de botones claros.
- Rendimiento: primera pintura útil < 2 s en 4G; media pesada (ref 540p, previews) solo bajo demanda; descifrado sin bloquear el hilo principal cuando sea grande.

---

## 10. Preguntas abiertas (decide y justifica en el PRD)

| ID | Pregunta | Recomendación inicial |
|---|---|---|
| **Q-01** | **Bootstrap de keys en la PWA instalada.** El `start_url` del manifest es público y no puede llevar la key; en iOS la app instalada tiene **almacenamiento separado** de Safari. ¿Cómo abre la PWA el Dashboard sin el link? | Onboarding «Pega tu link» / abrir el link una vez dentro de la PWA; guardar el keyring en IndexedDB del dispositivo; opción de envolverlo con passkey/WebAuthn (PRF) o PIN si es viable; botón «Olvidar este teléfono». Documentar el cambio de modelo de amenazas. |
| Q-02 | ¿Una PWA para Jorge y el portal de creadoras como página aparte (otro scope/manifest) o nada instalable para creadoras? | PWA = app de Jorge. Portal = link simple (opcionalmente instalable con su propio manifest/scope), sin acceso a nada más. |
| Q-03 | ¿Dónde viven Feed y Boards? | Feed accesible desde Dashboard (tarjeta «Productos nuevos del feed») y como pantalla full-screen; Boards como biblioteca accesible desde Grabar y Dashboard. |
| Q-04 | ¿Qué pasa con `hub.html`, `manager.html`, `board.html` vs `portal.html`, `index.html`? | Unificar; los viejos redirigen con el hash. `index.html` queda para piezas ad hoc no-board (charts, aprobaciones de stills IA). |
| Q-05 | Boards de video IA (Kling) con GO/Pedir cambios: ¿misma plantilla? | Misma plantilla con secciones condicionales (aprobaciones en lugar de subida). |
| Q-06 | ¿Jorge sube sus tomas desde su board? | Requiere sesión «owner» en el Worker (cambio aparte) o mantener el flujo Mac; decidir y, si se agrega, especificar. |
| Q-07 | IDs `bella` → ¿migrar a `creadoras`? | Mantener IDs técnicos con alias de label en v2; migrar después si no rompe nada. |
| Q-08 | ¿Una scene «Dashboard» que agregue todo o varias scenes cargadas en paralelo? | Scene raíz liviana con resúmenes + keys de sub-scenes; sub-scenes cargadas bajo demanda y cacheadas cifradas. |
| Q-09 | Notificaciones push | Fuera de alcance v2 (requiere servidor de push); dejar diseñado el punto de extensión. |
| Q-10 | Outbox offline unificado para toques (✓, picks, Lo quiero, grabado, notas) | Sí: una cola única con reintentos y estado visible. |

---

## 11. Entregables que esperamos del agente Opus (estructura del PRD)

1. **Resumen ejecutivo** y principios de diseño (qué se quitó y por qué).
2. **Arquitectura de información / sitemap** completo (pantallas, sheets, rutas, deep links).
3. **Modelo de navegación** (tabs Dashboard · Grabar · Creadoras, back, sheets, deep links desde links viejos, estado de la PWA instalada vs navegador).
4. **Mapa feature → pantalla → componente** para **cada** feature de §4 (nada se pierde; si algo se elimina, justificar). Tabla de trazabilidad R-01…R-20 → cómo se resuelve.
5. **Especificación por pantalla**: layout a 390×844, jerarquía, componentes, copy exacto en español, iconos, estados **loading / empty / error / expired / offline / revoked / sin permiso (sin manager token) / parcialmente cargado**, y comportamiento en dark/light y desktop.
6. **Catálogo de componentes** (tabs, lista/fila, tarjeta de producto, chip de estado, botón primario/secundario/destructivo, bottom sheet, toast con deshacer, segmented control, filtro, tarjeta de feed, reproductor de referencia, escena «Lo que dices/Qué haces», fila de toma con progreso, banner, empty state, skeleton) con props y variantes.
7. **Todas las interacciones** (tap, long-press si aplica, swipe, pull-to-refresh, deshacer, confirmaciones destructivas como Revocar, copiar al portapapeles, compartir link a WhatsApp, subida/reanudar, picks, marcar grabado, Lo quiero, aprobar/re-grabar con motivo, extender/revocar).
8. **Sistema de iconografía**: set elegido (licencia permisiva, inline SVG, sin CDN), tabla icono ↔ significado para cada verbo/estado/lane/acción, tamaños, trazo, color por estado, iconos de app (PWA) y splash.
9. **Design tokens**: color (light/dark, estados), tipografía (sistema), espaciado, radios, sombras, motion, z-index; contraste verificado.
10. **Diccionario de copy y máquina de estados** única por entidad (producto, video/job, sesión, toma, board, tarea), con label/color/icono/acción.
11. **Especificación PWA**: manifest (name «Comando», short_name, icons 192/512/maskable, theme/background color, display standalone, scope, start_url sin secretos), apple-touch-icon y splash iOS, service worker (estrategias por recurso, versionado, actualización «Hay una versión nueva»), offline shell, comportamiento offline por pantalla, guía A2HS iOS/Android, bootstrap de keys (Q-01), CSP actualizado (`manifest-src`, `worker-src`).
12. **Contratos de datos** v2 para cada scene (JSON Schema), cambios en cada generador (§9.5), compatibilidad con la versión anterior, y cambios (si los hay) al Worker.
13. **Plan de migración**: links viejos → nuevos (redirectores con hash), sesión activa de la creadora intacta, orden de despliegue (generadores ↔ viewers), rollback.
14. **Plan de QA** con criterios de aceptación por feature (§12).
15. **Plan de implementación por fases** para el agente implementador (PRs pequeños, cada uno con tests y capturas), y checklist de «listo para producción».

---

## 12. QA y criterios de aceptación (mínimos)

- **Playwright** en 390×844 (iPhone UA) **dark y light** + un viewport desktop; WebKit además de Chromium cuando sea posible (Safari es el navegador de Jorge).
- Fixtures sintéticas en el repo (nunca scenes reales: repo público). Para QA con datos reales: variable de entorno local que apunte a una scene descifrada fuera del repo (patrón actual `SCENE_FILE`/`SCENE`).
- Interceptar buzón y Worker en tests (sin POSTs reales); bloquear todo host fuera de la allowlist.
- Por feature: render, cada estado (loading/empty/error/expired/offline/revoked), cada acción y su payload exacto, deshacer, persistencia local, accesibilidad (axe sin violaciones serias, targets ≥ 44 px, foco), y captura.
- Específicos obligatorios:
  - Abre en **Dashboard** por defecto; orden de tabs Dashboard · Grabar · Creadoras.
  - Ninguna pantalla muestra «Bella» ni códigos FF-/JOB-.
  - En el board, «Lo que dices» es el texto más grande/visible de cada escena; «Subir video» es botón primario relleno; «Reanudar» solo con subida a medias; subida reanudable sobrevive a recargar.
  - Creadora: con su link solo ve sus productos; sin manager token ni datos de Jorge en su DOM/red; link revocado/expirado → mensaje claro.
  - Manager: Extender/Revocar/Aprobar/Re-grabar envían el request correcto; sin manager token esos botones no existen.
  - Feed: lane Miami X / Creadoras / Todos, filtros, Lo quiero, PDP, Abrir en TikTok, vacío honesto.
  - PWA: manifest válido, SW registrado, instalable (Lighthouse PWA checks), offline shell abre y muestra la última data cifrada cacheada, actualización del SW.
  - Links viejos (cada viewer actual) redirigen y conservan el hash.
  - `npm test` incluye **todos** los tests (incl. feed) y corre en CI; secret scan pasa.
- «Listo para producción» = todos los tests verdes en CI + QA en el link publicado de Pages (no archivos locales) + capturas phone dark/light de cada pantalla.

---

## Anexo A — Contratos de datos actuales (resumen)

**Scene `hub` v3 (Comando)** — claves: `type`, `version`, `title`, `updatedAt`, `counters[] {label, value, jump}`, `quick[] {label, sub, href}`, `scripts{ "ff-NNN": {job, product, recommended, recommendedWhy, picked, pickedAt, changeable, thumb, pdp, options[] {letter, focus, framework, frameworkEs, donor{handle,url}|null, transfer, fill, cast, place, seconds, hook, hookText, beats[] {t, vo, visual, text}, teleprompter, rules}} }`, `thumbs{key: data:image/jpeg;base64}`, `sections[] {id, title, lead?, empty?, doneEmpty?, limit?, items[]}`, `footer[]`, `portalApi`, `creators[] {id, creatorName, shootDate, status, jobs[] {job_id, name}, link}`, `mailbox`, opcional `managerToken` (sellado; nunca en claro).
Secciones hoy: `hoy` (Hoy te toca), `productos` (Productos de la semana), `grabar` (Por grabar · sáb), `marcas`, `marcha` (Grok está en esto), `creadoras`.
Ítem: `id` (`[a-z0-9:_.-]`), `verb`, `title`, `sub?`, `tone?`, `href?`, `hrefLabel?`, `done?`, `group?`, `quiet?`, `quietLink?`, `chip? {text, tone}`, `act? {id, label, doneLabel}`, `detail? [[label, value]]`, `thumb?`, `open? {scripts}`, `mail? {web, search, subject}`.
IDs de ítem: `ff:<job>:film`, `prod:<product_id>`, `bella:<pid>:post|go`, `feed:<date>`, `brand:<thread>:wait|closed|neg`, `m:<hash>`, `portal:<session>`, `rec:open`.

**Scene `filming` v2** — `updatedAt`, `products{key:{name, thumb}}`, `videos[] {id: rec:<job>, day: YYYY-MM-DD|sin-fecha, place, product, title, stage 0–5, ready, board}`, `ticks{rec:<job>: [0|1, ms]}`, `mailbox`.

**Scene `boards` v1** — `updatedAt`, `avatars[] {id, label}`, `kinds[] {id, label}`, `boards[] {id, code, name, what, avatar, kind, status, tone, date, thumb, board|missing, note, noteTone}`, `footer[]`.

**Scene `creator-feed` v3.1** — `title`, `subtitle`, `updated_at`, `updated_label`, `windows`, `counts`, `avatars[] {id, label, count, empty}`, `default_avatar`, `creators[] {handle, avatars, count}`, `labels{}`, `method`, `cards[] {id, video_id, creator, avatars, url, caption, hook, posted_at, age_label, metrics{views, likes, comments, shares, saves}, velocity{per_day, label}, score{value, label, coverage}, windows[] {w, multiple}, best{w, multiple, label}, is_ad, cover(enc), preview(enc|null), product{id, title, price, commission, sales, sold_total, velocity_per_day, growth{trend, label, ratio, prior_per_day, creators_following}, rating, reviews, href, image(enc), verify}, video_sales{units, gmv, source, label}, product_status, product_missing_label}`.

**Scene `portal` / `board`** — `type`, `creatorName`, `apiBase` (`*.workers.dev`), `products[] {id, name, thumb(enc), blob?, status, script, beats[] {shot, vo, do_es, refFrame(enc), ourFrame(enc)}, shots[] {shot, takes}, refSrc(enc video)}`. `board` = un solo producto en la raíz.

**Scene `manager`** — portales + links de creadora; el manager token va en `#m=`.

## Anexo B — Payloads del buzón (webhook.site, no confiables)
| kind | Payload | Origen | Efecto único permitido |
|---|---|---|---|
| `approve` | `{blockId, choice:"done"|"undo"}` | ✓ / Deshacer (hub/comando), `act` | ocultar/mostrar ítem; campos de muestra del tracker |
| `approve` | `{blockId:"want:<pid>", choice:"want"}` | Feed «Lo quiero» | crear entrada en tracker |
| `approve` | `{blockId, choice:"go"|"changes"}` | index.html | GO de ese bloque según la skill del job |
| `pick` | `{v:1, job:"ff-NNN", letter:"A|B|C|""", at}` | Sheet de guiones | `script_letter` en job `scripts_ready` sin pack |
| `ticks` | `{v:2, set:{"rec:<job>":[0|1, ms]}}` (text/plain) | Grabación | marca de grabado |
| `script` | `{blockId, text}` | index.html | reemplazar texto del bloque |
| `note` | `{text}` | Nota para Grok | se resume en chat; nunca se ejecuta |

## Anexo C — Storage local actual
`localStorage`: `hub-done:<blob>` (3 días), `hub-picks:<blob>` (7 días), `rec-ticks:<blob>`, `boards:av`, `boards:kind`, `creatorFeed.avatar`. `IndexedDB`: estado de subidas reanudables del portal. Feed «Lo quiero»: solo memoria.

## Anexo D — Tests actuales (`npm test`)
`test:hub`, `test:grabacion`, `test:hub-scripts`, `test:boards`, `test:portal`, `test:manager`, `test:comando`, `test:board`, `test:secrets`. **Fuera de `npm test`: `test:feed`** (y hoy falla, B-01). Patrón: Playwright Chromium, fixtures cifradas en memoria, rutas interceptadas, `SHOTS_DIR` para capturas, `SCENE_FILE`/`SCENE` para datos reales locales.

## Anexo E — CSP actual por viewer
| Viewer | img-src | media-src | connect-src |
|---|---|---|---|
| comando | self data: blob: jsdelivr | self blob: jsdelivr workers.dev | self webhook.site jsdelivr workers.dev r2 |
| hub | self data: | — | self webhook.site |
| grabacion | data: | — | self webhook.site |
| boards | data: | — | self |
| feed | self blob: jsdelivr **raw.githubusercontent githack rawcdn.githack** | igual | igual + webhook.site |
| index | igual que feed | igual | igual |
| portal / board | self data: blob: jsdelivr | self blob: jsdelivr | self jsdelivr workers.dev r2 |
| manager | self data: blob: jsdelivr | + workers.dev | self jsdelivr workers.dev r2 |
| preview | data: | — | — |
Todas: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none'`. (`frame-ancestors` en `<meta>` no tiene efecto.) PWA necesitará `manifest-src 'self'` y `worker-src 'self'`.

## Anexo F — Tokens visuales actuales (comando.html, estilo iOS)
Light: bg `#f2f2f7`, card `#fff`, text `#1c1c1e`, muted `#6e6e73`, accent `#007aff`, good `#248a3d`, bad `#d70015`, warn `#c93400`, info `#5e5ce6`. Dark: bg `#000`, card `#1c1c1e`, text `#f5f5f7`, accent `#0a84ff`, good `#30d158`, bad `#ff453a`, warn `#ff9f0a`, info `#7d7aff`. Fuente del sistema (SF Pro / Roboto), 16 px base, header sticky con blur, safe areas.

## Anexo G — Capturas (no se commitean: el repo prohíbe media en claro)
`scripts/check-secrets.sh` falla con cualquier `.png/.jpg/.mp4` sin cifrar en git, así que las capturas **no** van en este branch. Regenéralas con datos sintéticos en tu entorno: `npm ci && npx playwright install chromium && SHOTS_DIR=/tmp/shots npm test` (+ `npm run test:feed`, que hoy necesita quitar la aserción de `localStorage`, B-01). Salen:
`command-center.png`, `creators-section.png` (Comando) · `unified-board.png`, `board-scene-{light,dark}.png`, `board-upload-{light,dark}.png` (board con Lo que dices / Subir video) · `portal-plp.png`, `portal-pdp.png` · `manager.png` · `boards-phone{,-dark}.png` · `grabacion_iphone{,_dark}.png`, `grabacion_desktop.png` · `hub-v2-fixture-*.png`, `hub_mail_*.png` (hub.html) · `feed_card_producto.png`, `feed_sin_producto.png`, `feed_filtro_creador.png`.
Copias ya generadas (sintéticas) y capturas con datos reales (privadas) están en el box de Grok (`/workspace/prd/site-v2/assets/`); pídeselas a Grok si hacen falta.
