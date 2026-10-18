import type { Moneda } from "./types";

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
