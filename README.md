# grok-canvas

Sitio de Jorge en GitHub Pages: `https://jorgedearmas.github.io/grok-canvas/`.

## App v2 (Comando)

PWA en [`app/`](app/). Tres pestañas: **Dashboard · Grabar · Creadoras**. Feed y Boards se abren desde Dashboard. El link del Comando (`comando.html#b&k` o `app/#b&k`) guarda las llaves en este teléfono (IndexedDB, no extraíbles). **Pegar link** en Bienvenida. **Olvidar este teléfono** en Ajustes.

Viejos viewers (`comando.html`, `hub.html`, `grabacion.html`, `boards.html`, `feed.html`, `manager.html`, `board.html`) redirigen a `app/` conservando el hash. `portal.html` sigue siendo el portal de la creadora (mismo link). `index.html` queda para canvases sueltos; un scene `type:"board"` salta a `app/`.

Docs de arquitectura: [`docs/site-v2/`](docs/site-v2/).

## Portal

`portal.html#b&k&t` — sesión de creadora. Misma subida resumible (`portal-uploads`). No es instalable.

## «Lo quiero»

En el Feed, con mailbox, anota un producto. El bot solo lo agrega al tracker. Nada se compra.

## Privacidad

Repo público. Nunca commitear nombres reales, session ids, keys, tokens, montos ni fotos. `npm run test:secrets`. PNG solo en `app/icons/` con hash en `ICONS.sha256`.

## Tests

```
npm test                 # unit + portal smoke + secrets
npx playwright test      # QA-PLAN
```

Fixtures sintéticos: Ana, Eva, Producto A–J. No hay datos reales.
