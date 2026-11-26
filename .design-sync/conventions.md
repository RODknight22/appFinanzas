## Conventions for building with ORVYN UI

ORVYN is a personal-finance app for people whose money lives in more than one currency. Its UI is
in **Spanish** (informal "tú"); amounts always carry their currency, and the main figure often shows
its equivalent in the other currency ("≈ 49.351,20 MXN").

### 1. Always wrap in `<TemaOrvyn>`
Every colour comes from CSS variables that depend on attributes of `<html>` (`.dark`,
`data-estilo`, `data-acento`). `TemaOrvyn` sets them and provides the app configuration that
`SelectMoneda` and `Consejo` read. Without it the palette falls back to an old lilac-grey theme and
those two components throw.

```tsx
const { TemaOrvyn, EncabezadoPagina, Tarjeta, Boton } = window.OrvynUI;

<TemaOrvyn>{/* modo="claro" | "oscuro" (default: follows the page theme, else dark) */}
  <div style={{ padding: 32, display: "grid", gap: 24 }}>
    <EncabezadoPagina titulo="Cuentas" descripcion="Tus cuentas en cada moneda"
      acciones={<Boton>Añadir cuenta</Boton>} />
    <Tarjeta titulo="Balance global">
      <p style={{ margin: 0, fontSize: 30, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>2.418,60 €</p>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--tenue)" }}>≈ 49.351,20 MXN</p>
    </Tarjeta>
  </div>
</TemaOrvyn>
```

Dark mode is the primary look: pure black background, cards in `--superficie`, Saffron orange
accent. `estilo` and `acento` exist for user customisation; keep the defaults (`"orvyn"`,
`"saffron"`) unless asked.

### 2. Styling idiom: CSS variables, not new utility classes
The components are styled with Tailwind v4 utilities that were **compiled ahead of time**: only the
classes already present in `components/bundle.css` exist. Do not invent Tailwind classes for your
own layout; they will not render. Lay out with inline styles (flex/grid, gap, padding) and take
every colour and font from these variables:

| Use | Variable |
| --- | --- |
| Page background / cards / inputs / hover | `--fondo` · `--superficie` · `--superficie-2` · `--realce` |
| Borders: subtle / controls | `--linea` · `--linea-fuerte` |
| Text: primary / secondary / hints | `--texto` · `--suave` · `--tenue` |
| Accent fill / text on it | `--color-acento-600` · `--color-sobre-acento` |
| Accent for icons, lines, highlights | `--color-acento-500` |
| Money in / out (always with + / − sign) | `--color-ingreso` · `--color-gasto` |
| Logo orange (fixed, never follows the accent) | `--color-marca` |
| Fonts: UI and numbers / titles | `--font-sans` (Inter) · `--font-display` (Manrope) |

Use `fontVariantNumeric: "tabular-nums"` for amounts. Cards separate with borders, not shadows;
only floating things (menus, modals) get a shadow. One accent-filled action per view.

### 3. Where the truth lives
Read `components/index.d.ts` for every prop and `components/<Name>/README.md` for usage before
composing. Colours and fonts: `tokens.css`, `tokens.json` and `components/bundle.css`.
`LogoOrvyn` / `SimboloOrvyn` are the brand mark: never redraw it. Prefer `Boton`, `Campo` with
`CLASE_ENTRADA` on native `<input>`/`<select>`, `Tarjeta`, `Modal`, `SelectorFecha` and
`EncabezadoPagina` over hand-made equivalents.
