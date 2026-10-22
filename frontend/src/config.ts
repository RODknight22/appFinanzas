import type { ColorAcento, EstiloVisual, Moneda, PaginaInicio, Periodicidad } from "./types";

/**
 * Monedas disponibles. El `locale` decide el formato de cada una
 * (símbolo, separador de miles y decimales): p. ej. es-GT → "Q1,234.50".
 */
export const MONEDAS: Record<Moneda, { nombre: string; locale: string }> = {
  MXN: { nombre: "Peso", locale: "es-MX" },
  USD: { nombre: "Dólar", locale: "es-US" },
  EUR: { nombre: "Euro", locale: "es-ES" },
  GTQ: { nombre: "Quetzal", locale: "es-GT" },
  HNL: { nombre: "Lempira", locale: "es-HN" },
};

export const MONEDA_POR_DEFECTO: Moneda = "MXN";

/** Colores de acento, en orden de arcoíris. `muestra` es el tono 500 para pintar el selector. */
export const ACENTOS: Record<ColorAcento, { nombre: string; muestra: string }> = {
  esmeralda: { nombre: "Esmeralda", muestra: "#10b981" },
  turquesa: { nombre: "Turquesa", muestra: "#14b8a6" },
  cian: { nombre: "Cian", muestra: "#06b6d4" },
  cielo: { nombre: "Cielo", muestra: "#0ea5e9" },
  azul: { nombre: "Azul", muestra: "#3b82f6" },
  indigo: { nombre: "Índigo", muestra: "#6366f1" },
  violeta: { nombre: "Violeta", muestra: "#8b5cf6" },
  fucsia: { nombre: "Fucsia", muestra: "#d946ef" },
  rosa: { nombre: "Rosa", muestra: "#ec4899" },
  naranja: { nombre: "Naranja", muestra: "#f97316" },
  ambar: { nombre: "Ámbar", muestra: "#f59e0b" },
  lima: { nombre: "Lima", muestra: "#84cc16" },
};

/**
 * Estilos visuales (los colores de verdad están en index.css). `claro` y `oscuro`
 * son el fondo de cada modo, para la muestra del selector.
 */
export const ESTILOS: Record<EstiloVisual, { nombre: string; descripcion: string; claro: string; oscuro: string }> = {
  fintech: { nombre: "Fintech", descripcion: "El de siempre", claro: "oklch(97.2% 0.004 275)", oscuro: "oklch(19.5% 0.01 275)" },
  medianoche: { nombre: "Medianoche", descripcion: "Azul marino", claro: "oklch(97.2% 0.013 262)", oscuro: "oklch(19.5% 0.032 262)" },
  grafito: { nombre: "Grafito", descripcion: "Neutro, negro puro", claro: "oklch(97.2% 0 0)", oscuro: "oklch(9% 0 0)" },
  bosque: { nombre: "Bosque", descripcion: "Verde discreto", claro: "oklch(97.2% 0.008 165)", oscuro: "oklch(19.5% 0.02 165)" },
  arena: { nombre: "Arena", descripcion: "Cálido, como papel", claro: "oklch(97.2% 0.01 75)", oscuro: "oklch(19.5% 0.024 75)" },
};

export const PAGINAS_INICIO: Record<PaginaInicio, { nombre: string; ruta: string }> = {
  dashboard: { nombre: "Dashboard", ruta: "/dashboard" },
  transacciones: { nombre: "Transacciones", ruta: "/transacciones" },
  presupuestos: { nombre: "Presupuestos", ruta: "/presupuestos" },
  suscripciones: { nombre: "Suscripciones", ruta: "/pagos-fijos" },
  ingresos: { nombre: "Ingresos fijos", ruta: "/pagos-fijos/ingresos" },
  efectivo: { nombre: "Efectivo", ruta: "/cuentas/efectivo" },
  cuentas: { nombre: "Cuentas", ruta: "/cuentas" },
  metas: { nombre: "Metas", ruta: "/metas" },
};

export const PERIODICIDADES: Record<Periodicidad, string> = {
  diaria: "Diaria",
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  anual: "Anual",
};

/** Cuántas veces se cobra al mes, en promedio, cada periodicidad. */
export const COBROS_POR_MES: Record<Periodicidad, number> = {
  diaria: 365 / 12,
  semanal: 52 / 12,
  quincenal: 2,
  mensual: 1,
  anual: 1 / 12,
};

export const AVATARES = ["🦊", "🐼", "🐯", "🦁", "🐨", "🐸", "🐙", "🦉", "🌵", "🌻", "🚀", "⚡", "💰", "💎", "🎯", "☕"];
