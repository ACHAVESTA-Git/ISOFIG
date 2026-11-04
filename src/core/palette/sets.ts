import type { Lch } from "./color.ts";
import type { Mode } from "./theme.ts";

export type PaintKind = "material" | "role";

export interface PaintDef {
  name: string;
  kind: PaintKind;
  label: Record<string, string>;
  /** OKLCH por tema: `[L 0–1, C, h]`. */
  lch: Record<Mode, Lch>;
}

const def = (kind: PaintKind, name: string, es: string, en: string, light: Lch, dark: Lch): PaintDef => ({
  name,
  kind,
  label: { es, en },
  lch: { light, dark },
});

/**
 * Materiales: se reconocen por tono y luminosidad, como en un taller. Los grises (aluminio, acero, hierro,
 * carbono, goma) se separan por L; el cobre, el latón y la laca, por tono.
 */
export const MATERIALS: PaintDef[] = [
  def("material", "aluminium", "aluminio", "aluminium", [0.91, 0.006, 250], [0.82, 0.006, 246]),
  def("material", "steel", "acero", "steel", [0.71, 0.02, 245], [0.58, 0.024, 239]),
  def("material", "iron", "hierro", "iron", [0.5, 0.012, 240], [0.45, 0.01, 246]),
  def("material", "copper", "cobre", "copper", [0.6, 0.11, 50], [0.56, 0.097, 45]),
  def("material", "brass", "latón", "brass", [0.8, 0.1, 88], [0.77, 0.085, 90]),
  def("material", "rubber", "goma", "rubber", [0.23, 0.006, 60], [0.22, 0.005, 66]),
  def("material", "carbon", "carbono", "carbon", [0.37, 0.018, 260], [0.33, 0.026, 255]),
  def("material", "glass", "vidrio", "glass", [0.81, 0.05, 200], [0.73, 0.065, 195]),
  def("material", "lacquer", "laca", "lacquer", [0.52, 0.16, 27], [0.42, 0.128, 29]),
];

/**
 * Roles de un mapa: categorías que deben distinguirse entre sí, también con daltonismo. Más sobrios que el acento
 * (C ≤ 0,09 frente a 0,13) y escalonados en L, porque con una sola L siete tonos se confunden en deuteranopía. En
 * oscuro los cálidos cambian de sitio: un amarillo oscuro se vuelve oliva, así que «data» sube a oro con tinta oscura.
 */
export const ROLES: PaintDef[] = [
  def("role", "client", "cliente", "client", [0.8, 0.075, 250], [0.43, 0.085, 248]),
  def("role", "edge", "borde", "edge", [0.69, 0.075, 286], [0.32, 0.09, 284]),
  def("role", "compute", "cómputo", "compute", [0.89, 0.055, 208], [0.53, 0.085, 200]),
  def("role", "data", "datos", "data", [0.93, 0.075, 92], [0.79, 0.09, 90]),
  def("role", "messaging", "mensajería", "messaging", [0.77, 0.075, 348], [0.4, 0.09, 354]),
  def("role", "storage", "almacenamiento", "storage", [0.84, 0.075, 56], [0.52, 0.09, 40]),
  def("role", "external", "externo", "external", [0.63, 0.012, 85], [0.26, 0.012, 85]),
];

export const PAINTS: PaintDef[] = [...ROLES, ...MATERIALS];
export const PAINT = new Map(PAINTS.map((p) => [p.name, p]));

/** Los colores de estado los pone el modelo en tiempo de ejecución: nunca son una pintura. */
export const RESERVED = ["ok", "warn", "fail"] as const;
