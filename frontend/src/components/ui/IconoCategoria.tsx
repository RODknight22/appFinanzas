import {
  Baby,
  Banknote,
  Briefcase,
  Car,
  Circle,
  Coffee,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  PawPrint,
  PiggyBank,
  Plane,
  Repeat,
  Shirt,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  Utensils,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Iconos disponibles para las categorías. El backend guarda el nombre en texto
 * (p. ej. "shopping-cart"); aquí lo traducimos al componente de Lucide.
 * Importamos solo estos iconos (no los ~1500 de Lucide) para no inflar la app.
 */
export const ICONOS: Record<string, LucideIcon> = {
  circle: Circle,
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  coffee: Coffee,
  house: House,
  zap: Zap,
  wifi: Wifi,
  smartphone: Smartphone,
  repeat: Repeat,
  laptop: Laptop,
  car: Car,
  plane: Plane,
  "heart-pulse": HeartPulse,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  shirt: Shirt,
  film: Film,
  "gamepad-2": Gamepad2,
  gift: Gift,
  "paw-print": PawPrint,
  baby: Baby,
  wrench: Wrench,
  briefcase: Briefcase,
  banknote: Banknote,
  "trending-up": TrendingUp,
  "piggy-bank": PiggyBank,
};

export const COLORES = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b",
];

interface IconoCategoriaProps {
  icono: string;
  color: string;
  tamano?: "sm" | "md";
}

/** Icono de la categoría dentro de un círculo con su color de fondo suave. */
export function IconoCategoria({ icono, color, tamano = "md" }: IconoCategoriaProps) {
  const Icono = ICONOS[icono] ?? Circle;
  const caja = tamano === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${caja}`}
      // "1f" al final del hex = ~12 % de opacidad para el fondo.
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <Icono size={tamano === "sm" ? 16 : 20} />
    </span>
  );
}
