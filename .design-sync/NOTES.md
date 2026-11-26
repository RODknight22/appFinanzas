# Notas de /design-sync (ORVYN UI)

- Origen: `frontend/src/components/ui/` (forma "package", sin Storybook ni dist de librería).
  Entrada: `--entry frontend/src/components/ui/index.ts`; `--node-modules frontend/node_modules`.
  La lista de componentes sale de `componentSrcMap` (no hay .d.ts publicados).
- `SeccionConPestanas` queda fuera a propósito: importa `paginas.ts` y arrastraría toda la app.
- CSS: Tailwind ya compilado por Vite (`buildCmd`): se copia `dist/assets/index-*.css` a
  `dist/assets/orvyn-ui.css` **sin @font-face** (las de Vite usan `/assets/...`, rutas absolutas
  que un artifact no tiene). Las fuentes salen de `extraFonts` (@fontsource Inter y Manrope).
- Solo existen las clases de Tailwind que ya usa la app: las vistas previas maquetan con estilos
  en línea y variables CSS.
- Los colores dependen de `.dark`, `data-estilo` y `data-acento` en `<html>`: `cfg.provider` es
  `TemaOrvyn`, que los pone, pinta el fondo del `<body>` y da `ConfiguracionFija` (sin backend).
- Instalar en el host con `npm ci` (no `npm install`: el npm 11 del host reescribe el lockfile y
  quita binarios de lightningcss que Docker necesita).
- Playwright 1.64.1 en `.ds-sync/` (casa con el Chromium 1248 en caché de este equipo).
- Vistas previas propias: Avatar, Boton, Campo, Consejo, EncabezadoPagina, LogoOrvyn, Modal
  (`cardMode: single`), SelectorFecha, SimboloOrvyn, Tarjeta. El resto, tarjeta básica.

## Avisos conocidos
- `[THEME_SKIPPED]` en los bloques `:root[data-estilo=…]`, `[data-acento=…]` y personalizado: la
  página de colores no lee esos selectores; en vistas previas y diseños sí se aplican (TemaOrvyn).
- `[RENDER_THIN]` en SimboloOrvyn (es solo un SVG, sin texto) y en tarjetas básicas sin datos
  (AccionesFila, IconoCategoria, MensajeError, Vacio).

## Riesgos al re-sincronizar
- Si cambia el nombre del CSS de Vite o su formato de @font-face, revisar `buildCmd`.
- Si un componente nuevo usa `useConfiguracion`, necesita `TemaOrvyn` (ya es el provider).
- La página de colores muestra la paleta base, no la de ORVYN (ver THEME_SKIPPED).
- Clases de Tailwind nuevas en componentes solo llegan si la app las compila (`buildCmd`).
