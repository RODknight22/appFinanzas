# Frontend (`frontend/src/`)

React 18 + Vite + TypeScript, Tailwind v4 (tokens), Recharts, Lucide, @dnd-kit, fuente Manrope.
Capas: pages → components → api/. En desarrollo Vite (:5173) reenvía `/api` al backend (:8000).

## Convenciones
- `api/cliente.ts` es el único que usa `fetch` (JSON o un `Blob` como cuerpo binario).
- `types/` refleja backend/app/schemas.py; los importes son `string` (Decimal sin perder precisión).
- Páginas: `useDatos` + `<Contenido>`; formularios: `useEnvio` + `PieFormulario`.
- Modales: estado único (`null | "nueva" | entidad`), `key` para reiniciar, portal a `<body>`;
  `ancho="amplio"` para listas o tablas.
- `useConfiguracion()` da config, tasas y `convertir`; `formatearDinero(valor, moneda)`.
- Colores: nunca grises fijos (slate/white) sino tokens de index.css (`bg-superficie`,
  `text-tenue`, `border-linea`…) que define cada estilo (oscuro primero). Acento: `*-acento-*`.
- Widgets en components/dashboard/registroWidgets.tsx (`DatosPanel`; S/M/L/XL = 1-4 columnas).
- Fechas con `SelectorFecha`; consejos con `<Consejo>` o `consejo` de `EncabezadoPagina`.
- Pensar en móvil: sin scroll horizontal a 390 px (`flex-wrap`, `basis-*`, `truncate`).

## Comprobar
- `scripts/verificar.sh` (eslint + tipos) o `scripts/verificar.sh --e2e` (además recorre la
  app con Playwright y una BD temporal; capturas en e2e/capturas/, que no se suben).
- eslint (eslint.config.js) falla también con avisos; si una regla no aplica, desactivarla en
  esa línea con un comentario que diga por qué.
- Una página nueva entra sola en la prueba de humo (lee las rutas de App.tsx).
- Si cambia package.json: `docker compose up -d --build -V frontend` (-V renueva node_modules).
