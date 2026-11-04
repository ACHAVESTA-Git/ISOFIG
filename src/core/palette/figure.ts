import type { Camera } from "../camera.ts";
import { makeIssue, type Issue } from "../issues.ts";
import type { Item } from "../items.ts";
import { shadeOf } from "../shade.ts";
import type { FigureSpec, LabelPart } from "../spec.ts";
import { contrast, deltaE, parseColor, VISIONS, type Lch, type Linear } from "./color.ts";
import { derivePalette, type DerivedPalette } from "./derive.ts";
import { figureStyle } from "./format.ts";
import { LIMITS, inkFor, lin } from "./guarantees.ts";
import { customPaints, paintOf } from "./paint.ts";
import { PAINT, PAINTS, type PaintKind } from "./sets.ts";
import { faceOf, INKS, MODES, THEME, type Face, type Mode } from "./theme.ts";

/** Más colores que estos en una figura ya no se leen de un vistazo (los grises cuentan como uno). */
export const MAX_COLORS = 6;
/** Croma por debajo del cual una pintura se lee como gris. */
const GREY = 0.03;
const ACCENT = "lit";

export interface LegendEntry {
  name: string;
  /** `role` o `material`; una pintura propia del proyecto (de `palette.use`) cuenta como rol. */
  kind: PaintKind;
  /** El nombre en el idioma pedido. */
  label: string;
  /** El color, como variable CSS: sigue al tema y a `palette.base`. */
  color: string;
}

/** Las pinturas que nombra la spec, también dentro de un árbol (`root`, `defs`), en el orden en que aparecen. */
function paintsInSpec(spec: FigureSpec): string[] {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o["paint"] === "string" && o["tone"] !== "lit") out.push(o["paint"]);
    for (const k of ["parts", "children"]) if (k in o) visit(o[k]);
  };
  const tree = spec as { root?: unknown; defs?: Record<string, unknown> };
  visit([spec.parts, tree.root, Object.values(tree.defs ?? {})]);
  return out;
}

/** Las pinturas que usa la figura: primero las de `palette.use`, luego las demás en el orden de los juegos. */
export function paintsUsed(spec: FigureSpec): string[] {
  const custom = customPaints(spec);
  const valid = (n: string) => PAINT.has(n) || custom.has(n);
  const declared = (Array.isArray(spec.palette?.use) ? spec.palette.use : []).filter(valid);
  const named = new Set(paintsInSpec(spec).filter(valid));
  return [...new Set([...declared, ...PAINTS.map((p) => p.name).filter((n) => named.has(n)), ...named])];
}

/** Para dibujar la leyenda de un mapa: el color nunca es el único portador del significado. */
export function legendOf(spec: FigureSpec, lang: string): LegendEntry[] {
  return paintsUsed(spec).map((name) => {
    const p = PAINT.get(name);
    return { name, kind: p?.kind ?? "role", label: p ? (p.label[lang] ?? p.label["en"]) : name, color: `var(--isofig-paint-${name})` };
  });
}

function derivedOf(spec: FigureSpec): DerivedPalette | undefined {
  const base = spec.palette?.base;
  if (typeof base !== "string") return undefined;
  try {
    return derivePalette(base);
  } catch {
    return undefined;
  }
}

/** Las variables del `<figure>` cuando la figura trae su color base; vacío si no. */
export function paletteStyle(spec: FigureSpec): string {
  const d = derivedOf(spec);
  if (!d) return "";
  const roles = paintsUsed(spec).filter((n) => PAINT.get(n)?.kind === "role");
  return roles.length ? figureStyle(d, roles) : "";
}

function effectiveOf(spec: FigureSpec) {
  const d = derivedOf(spec);
  const lch = (name: string, mode: Mode): Lch => d?.roles[mode].find((r) => r.name === name)?.lch ?? PAINT.get(name)!.lch[mode];
  const accent = d?.accent ?? { light: parseColor(THEME.light.accent), dark: parseColor(THEME.dark.accent) };
  return { derived: d, lch, color: (name: string, mode: Mode): Linear => (name === ACCENT ? accent[mode] : lin(lch(name, mode))) };
}

const LABEL_FACE: Record<NonNullable<LabelPart["face"]>, [number, number, number] | undefined> = { top: undefined, x: [1, 0, 0], y: [0, 1, 0] };
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Los avisos de color de una figura dibujada: roles derivados de `palette.base` que no cumplen, demasiados colores,
 * dos colores que no se distinguen (con visión típica o con daltonismo, en claro o en oscuro) y texto grabado sin
 * contraste. Las pinturas desconocidas o de estado las avisa `validateSpec`.
 */
export function paletteIssues(spec: FigureSpec, items: Item[], cam: Camera, lang: string): Issue[] {
  const out: Issue[] = [];
  const eff = effectiveOf(spec);
  if (eff.derived && !eff.derived.ok) {
    const failures = MODES.flatMap((m) => eff.derived!.measures[m].failures.map((f) => `${m}: ${f}`));
    out.push(makeIssue(lang, "palette-roles-unmet", "palette.base", { base: eff.derived.base, count: failures.length, list: failures.slice(0, 3).join("; ") }));
  }

  const custom = customPaints(spec);
  const used = [...new Set(items.map((i) => paintOf(i, custom)).filter((n): n is string => Boolean(n)))];
  const lit = items.some((i) => i.tone === "lit");
  const colors = [...used, ...(lit ? [ACCENT] : [])];
  // Los grises (aluminio, acero, hierro, carbono, goma, externo) son una sola familia: no hacen arcoíris.
  const greys = colors.filter((n) => PAINT.has(n) && MODES.every((m) => eff.lch(n, m)[1] < GREY));
  const count = colors.length - greys.length + (greys.length ? 1 : 0);
  if (count > MAX_COLORS) {
    const list = [...colors.filter((n) => !greys.includes(n)), ...(greys.length ? [`${greys.join("/")}`] : [])].join(", ");
    out.push(makeIssue(lang, "palette-too-many-colors", "", { count, list, max: MAX_COLORS }));
  }

  // Solo se comparan colores conocidos. El acento, solo con roles: con daltonismo un acento verde se parece a un gris
  // claro, y los metales son grises; en una máquina el sujeto se distingue también por moverse y por su rótulo.
  const known = colors.filter((n) => n === ACCENT || PAINT.has(n));
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      const [a, b] = [known[i], known[j]];
      if (b === ACCENT && PAINT.get(a)!.kind !== "role") continue;
      const w = worstPair(eff.color(a, "light"), eff.color(b, "light"), eff.color(a, "dark"), eff.color(b, "dark"));
      if (w) out.push(makeIssue(lang, "paint-indistinct", "", { a, b, vision: w.v, theme: w.mode, value: round1(w.d), min: w.min }));
    }
  }

  const index = new Map((spec.parts ?? []).map((p, k) => [p.id, k]));
  for (const it of items) {
    const name = paintOf(it, custom);
    if (!name || !PAINT.has(name)) continue;
    for (const d of it.details) {
      if (d.kind !== "label") continue;
      const n = LABEL_FACE[d.face ?? "top"];
      const face: Face = n ? shadeOf(cam, n) : "t";
      for (const mode of MODES) {
        const c = eff.color(name, mode);
        const k = contrast(parseColor(INKS[inkFor(c, mode).ink]), faceOf(c, face, mode));
        if (k >= LIMITS.text) continue;
        const at = index.get(d.id);
        out.push(makeIssue(lang, "paint-text-contrast", at === undefined ? "" : `parts[${at}]`, { id: d.id, on: it.id, paint: name, value: round1(k), theme: mode, min: LIMITS.text }));
        break;
      }
    }
  }
  return out;
}

function worstPair(la: Linear, lb: Linear, da: Linear, db: Linear) {
  let worst: { v: string; mode: Mode; d: number; min: number; gap: number } | undefined;
  for (const [mode, a, b] of [["light", la, lb], ["dark", da, db]] as const) {
    for (const v of VISIONS) {
      const min = v === "normal" ? LIMITS.normal : LIMITS.cvd;
      const d = deltaE(a, b, v);
      if (d < min && (!worst || d / min < worst.gap)) worst = { v, mode, d, min, gap: d / min };
    }
  }
  return worst;
}
