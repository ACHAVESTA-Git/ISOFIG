import { mix, parseColor, type Linear } from "./color.ts";

export type Mode = "light" | "dark";
export const MODES: Mode[] = ["light", "dark"];

/** Los colores de `theme.css` que intervienen en una cara pintada. Una prueba comprueba que no se desfasen. */
export type ThemeColors = Record<"paper" | "card" | "edge" | "light" | "shade" | "accent" | "ok" | "warn" | "fail", string> & {
  /** Las dos tintas del texto grabado, si el tema no usa las de siempre. */
  inks?: { dark: string; light: string };
};

export const THEME: Record<Mode, ThemeColors> = {
  light: {
    paper: "#f6f6f2",
    card: "#fbfbf8",
    edge: "#2a2b28",
    light: "#ffffff",
    shade: "#9a9a90",
    accent: "#2fb58b",
    ok: "#2fb58b",
    warn: "#d9a23a",
    fail: "#d4583f",
  },
  dark: {
    paper: "#121312",
    card: "#171816",
    edge: "#c9ccc3",
    light: "#50534c",
    shade: "#000000",
    accent: "#5fd6ae",
    ok: "#5fd6ae",
    warn: "#e8b85a",
    fail: "#f07a5f",
  },
};

/** Las dos tintas del texto grabado sobre una pintura: la misma pareja en los dos temas. */
export const INKS = { dark: "#1d1e1c", light: "#f4f4ef" } as const;

/** Cuánto se mezcla cada cara con la luz o la sombra del tema (igual que `--ft`, `--fb`, `--f2`…). */
const LIGHTEN = { t: 0.4, b: 0.2 } as const;
const DARKEN = { s3: 0, s2: 0.12, s1: 0.24, s0: 0.36 } as const;
/** El canto de una pieza pintada: su color mezclado con el trazo del tema. */
export const EDGE_MIX = 0.5;

export type Face = keyof typeof LIGHTEN | keyof typeof DARKEN;

/** Mezcla `c` con la luz o la sombra según la cara. El tema `t` es opcional: sin él, usa el estándar del modo; con uno propio (el de lujo, por ejemplo), usa sus colores. */
export function faceOf(c: Linear, face: Face, mode: Mode, t: ThemeColors = THEME[mode]): Linear {
  if (face === "t" || face === "b") return mix(c, parseColor(t.light), LIGHTEN[face]);
  return mix(c, parseColor(t.shade), DARKEN[face]);
}

export const edgeOf = (c: Linear, mode: Mode, t: ThemeColors = THEME[mode]): Linear => mix(c, parseColor(t.edge), EDGE_MIX);
