import { contrast, deltaE, hexOf, inGamut, linearOf, labOfLch, parseColor, VISIONS, type Lch, type Linear, type Vision } from "./color.ts";
import { edgeOf, faceOf, INKS, MODES, THEME, type Mode, type ThemeColors } from "./theme.ts";

/**
 * Lo que un juego de pinturas promete, en cada tema:
 * - texto grabado sobre la tapa con contraste ≥ 4,5:1 (WCAG 1.4.3), con la tinta clara u oscura que mejor le va;
 * - canto ≥ 3:1 frente al papel y a la tarjeta (WCAG 1.4.11): es lo que dibuja la silueta;
 * - entre dos pinturas del juego, ΔE OKLab ×100 ≥ `normal` con visión típica y ≥ `cvd` con protanopía,
 *   deuteranopía y tritanopía simuladas (Machado 2009). Se mide sobre el color de la pieza (`--c`, la cara lateral
 *   sin sombra); la tapa, aclarada un 40 %, conserva cerca del 60 % de esa distancia.
 * Los roles, además, se separan igual del acento y de los colores de estado.
 */
export const LIMITS = { text: 4.5, edge: 3, normal: 10, cvd: 6 } as const;

export interface Swatch {
  name: string;
  color: Linear;
}

export interface Nearest {
  other: string;
  d: number;
}

export interface PaintMeasure {
  name: string;
  hex: string;
  ink: keyof typeof INKS;
  /** Contraste de la tinta sobre la tapa. */
  text: number;
  /** Contraste del canto con el fondo más parecido (papel o tarjeta). */
  edge: number;
  /** La pintura más cercana del juego, por cada visión. */
  nearest: Record<Vision, Nearest>;
  /** El color reservado (acento o estado) más cercano, por cada visión. */
  reserved?: Record<Vision, Nearest>;
}

export interface SetMeasure {
  mode: Mode;
  paints: PaintMeasure[];
  failures: string[];
}

export const lin = (lch: Lch): Linear => linearOf(labOfLch(lch));

/** La tinta que más contrasta sobre la tapa de esa pintura. */
export function inkFor(c: Linear, mode: Mode, theme?: ThemeColors): { ink: keyof typeof INKS; text: number } {
  const top = faceOf(c, "t", mode, theme);
  const inks = theme?.inks ?? INKS;
  const dark = contrast(parseColor(inks.dark), top);
  const light = contrast(parseColor(inks.light), top);
  return dark >= light ? { ink: "dark", text: dark } : { ink: "light", text: light };
}

function nearestOf(c: Linear, self: string, others: Swatch[]): Record<Vision, Nearest> {
  const out = {} as Record<Vision, Nearest>;
  for (const v of VISIONS) {
    let best: Nearest = { other: "", d: Infinity };
    for (const o of others) {
      if (o.name === self) continue;
      const d = deltaE(c, o.color, v);
      if (d < best.d) best = { other: o.name, d };
    }
    out[v] = best;
  }
  return out;
}

export const reservedOf = (mode: Mode, accent?: Linear, theme: ThemeColors = THEME[mode]): Swatch[] => [
  { name: "accent", color: accent ?? parseColor(theme.accent) },
  ...(["warn", "fail"] as const).map((s) => ({ name: s, color: parseColor(theme[s]) })),
];

/** Mide un juego en un tema (con `theme`, el de otro estilo). Con `reserved`, también lo separa del acento y de los estados. */
export function measureSet(set: Swatch[], mode: Mode, reserved?: Swatch[], theme: ThemeColors = THEME[mode]): SetMeasure {
  const failures: string[] = [];
  const t = theme;
  const paints = set.map((s): PaintMeasure => {
    if (!inGamut(s.color)) failures.push(`${s.name}: fuera de sRGB`);
    const { ink, text } = inkFor(s.color, mode, t);
    const e = edgeOf(s.color, mode, t);
    const edge = Math.min(contrast(e, parseColor(t.paper)), contrast(e, parseColor(t.card)));
    const nearest = nearestOf(s.color, s.name, set);
    const m: PaintMeasure = { name: s.name, hex: hexOf(s.color), ink, text, edge, nearest };
    if (reserved) m.reserved = nearestOf(s.color, s.name, reserved);
    if (text < LIMITS.text) failures.push(`${s.name}: texto ${text.toFixed(2)}:1 (mínimo ${LIMITS.text})`);
    if (edge < LIMITS.edge) failures.push(`${s.name}: canto ${edge.toFixed(2)}:1 (mínimo ${LIMITS.edge})`);
    for (const [kind, near] of [["juego", nearest], ["reservado", m.reserved]] as const) {
      if (!near) continue;
      for (const v of VISIONS) {
        const min = v === "normal" ? LIMITS.normal : LIMITS.cvd;
        if (near[v].d < min) failures.push(`${s.name} ~ ${near[v].other} (${kind}, ${v}): ΔE ${near[v].d.toFixed(1)} (mínimo ${min})`);
      }
    }
    return m;
  });
  return { mode, paints, failures: [...new Set(failures)] };
}

/** El peor valor de cada garantía en un juego medido. */
export function worstOf(m: SetMeasure) {
  const min = (f: (p: PaintMeasure) => number) => Math.min(...m.paints.map(f));
  const pick = (v: Vision) => min((p) => p.nearest[v].d);
  return {
    text: min((p) => p.text),
    edge: min((p) => p.edge),
    normal: pick("normal"),
    cvd: Math.min(pick("protan"), pick("deutan"), pick("tritan")),
    reserved: m.paints[0]?.reserved ? Math.min(...m.paints.flatMap((p) => VISIONS.map((v) => p.reserved![v].d))) : undefined,
  };
}

export { MODES };
