import type { ColorAcento, Moneda, PaginaInicio } from "./types";

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

/** Colores de acento. `muestra` es el tono 500 para pintar el selector. */
export const ACENTOS: Record<ColorAcento, { nombre: string; muestra: string }> = {
  esmeralda: { nombre: "Esmeralda", muestra: "#10b981" },
  azul: { nombre: "Azul", muestra: "#3b82f6" },
  indigo: { nombre: "Índigo", muestra: "#6366f1" },
  violeta: { nombre: "Violeta", muestra: "#8b5cf6" },
  rosa: { nombre: "Rosa", muestra: "#ec4899" },
  naranja: { nombre: "Naranja", muestra: "#f97316" },
};

export const PAGINAS_INICIO: Record<PaginaInicio, { nombre: string; ruta: string }> = {
  dashboard: { nombre: "Dashboard", ruta: "/dashboard" },
  transacciones: { nombre: "Transacciones", ruta: "/transacciones" },
  presupuestos: { nombre: "Presupuestos", ruta: "/presupuestos" },
  suscripciones: { nombre: "Suscripciones", ruta: "/suscripciones" },
  cuentas: { nombre: "Cuentas", ruta: "/cuentas" },
  metas: { nombre: "Metas", ruta: "/metas" },
};

export const AVATARES = ["🦊", "🐼", "🐯", "🦁", "🐨", "🐸", "🐙", "🦉", "🌵", "🌻", "🚀", "⚡", "💰", "💎", "🎯", "☕"];
