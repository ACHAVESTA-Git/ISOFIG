import type { Part, Text, Vec2 } from "../spec.ts";
import { plateHeight } from "./frame.ts";
import { box, cyl, label, prism } from "./parts.ts";
import type { Pt, Rect } from "./route.ts";
import { widthOf } from "./text.ts";
import type { LinkKind, MapLink } from "./types.ts";

export type End = "none" | "arrow" | "triangle" | "diamond" | "diamond-filled";

export interface LinkStyle {
  from: End;
  to: End;
  dashed: boolean;
}

/** Los extremos de cada tipo de enlace: la herencia lleva un triángulo hueco; la composición, un rombo lleno. */
const STYLES: Record<LinkKind, LinkStyle> = {
  link: { from: "none", to: "arrow", dashed: false },
  inherits: { from: "none", to: "triangle", dashed: false },
  implements: { from: "none", to: "triangle", dashed: true },
  composes: { from: "diamond-filled", to: "none", dashed: false },
  aggregates: { from: "diamond", to: "none", dashed: false },
  depends: { from: "none", to: "arrow", dashed: true },
  associates: { from: "none", to: "none", dashed: false },
};

/** Las puntas que deja cada valor de `arrow`: en el origen y en el destino. */
const ARROW_ENDS: Record<NonNullable<MapLink["arrow"]>, [End, End]> = {
  end: ["none", "arrow"],
  start: ["arrow", "none"],
  both: ["arrow", "arrow"],
  none: ["none", "none"],
};

export function styleOf(l: MapLink): LinkStyle {
  const base = STYLES[l.kind ?? "link"] ?? STYLES.link;
  const dashed = l.dashed ?? base.dashed;
  // `arrow` reemplaza a los dos extremos del tipo.
  if (l.arrow === undefined) return { from: base.from, to: base.to, dashed };
  const [from, to] = ARROW_ENDS[l.arrow] ?? [base.from, base.to];
  return { from, to, dashed };
}

/** Una cinta ya trazada: su camino, dónde se apoya y cómo se dibuja. */
export interface LinkDraw {
  index: number;
  style: LinkStyle;
  label?: Text;
  paint?: string;
  mult?: [Text?, Text?];
  pts: Pt[];
  z: number;
}

export const RW = 5.6;
export const RT = 2;
const DASH = 7;
const SKIP = 5;

export const HEAD: Record<Exclude<End, "none">, { len: number; half: number }> = {
  arrow: { len: 10, half: 5.4 },
  triangle: { len: 13, half: 7 },
  diamond: { len: 17, half: 5.6 },
  "diamond-filled": { len: 17, half: 5.6 },
};

export const dirOf = (a: Pt, b: Pt): Pt => {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
};

/** Recorta `by` unidades del extremo de una polilínea (sin pasarse del último tramo). */
function trim(pts: Pt[], by: number, atEnd: boolean): Pt[] {
  if (!by || pts.length < 2) return pts;
  const p = atEnd ? [...pts].reverse() : [...pts];
  const [a, b] = [p[0], p[1]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const cut = Math.min(by, Math.max(0, len - 1.5));
  const d = dirOf(a, b);
  p[0] = [a[0] + d[0] * cut, a[1] + d[1] * cut];
  return atEnd ? p.reverse() : p;
}

/** Planta antihoraria de la punta que termina en `tip` y mira a `dir`. */
export function headPlan(kind: Exclude<End, "none">, tip: Pt, dir: Pt): Vec2[] {
  const { len, half } = HEAD[kind];
  const n: Pt = [-dir[1], dir[0]];
  const at = (back: number, side: number): Vec2 => [tip[0] - dir[0] * back + n[0] * side, tip[1] - dir[1] * back + n[1] * side];
  // Un triángulo con la base a `len` de la punta, o un rombo con su ancho mayor a media distancia.
  const pts: Vec2[] = kind === "diamond" || kind === "diamond-filled" ? [at(0, 0), at(len / 2, half), at(len, 0), at(len / 2, -half)] : [at(0, 0), at(len, half), at(len, -half)];
  let area = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    area += p[0] * q[1] - q[0] * p[1];
  });
  return area < 0 ? [...pts].reverse() : pts;
}

const ribbonTone = { tone: "mid" as const };

interface Seg {
  axis: "x" | "y";
  /** Coordenada fija y rango recorrido. */
  c: number;
  a: number;
  b: number;
  z: number;
  paint?: string;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.2;

/** Une los tramos que se encuentran en la misma línea (el tronco compartido se dibuja una vez). */
function merge(segs: Seg[]): Seg[] {
  const out: Seg[] = [];
  const sorted = [...segs].sort((p, q) => p.axis.localeCompare(q.axis) || p.z - q.z || p.c - q.c || p.a - q.a);
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.axis === s.axis && near(last.c, s.c) && near(last.z, s.z) && s.a <= last.b + 0.2) last.b = Math.max(last.b, s.b);
    else out.push({ ...s });
  }
  return out;
}

/**
 * Las cintas de los enlaces sólidos: tramos que no se encimen. Los que van a lo largo de `y` se alargan media cinta en
 * las esquinas y los que van a lo largo de `x` ceden ese pedazo, así cada esquina es de una sola pieza.
 */
function ribbons(segs: Seg[]): Part[] {
  const merged = merge(segs);
  const ys = merged.filter((s) => s.axis === "y");
  const xs = merged.filter((s) => s.axis === "x");
  const out: Part[] = [];
  const h = RW / 2;
  const boxes: { y: Seg; a: number; b: number }[] = ys.map((s) => {
    const meets = (end: number) => xs.some((t) => near(t.z, s.z) && near(t.c, end) && (near(t.a, s.c) || near(t.b, s.c)));
    return { y: s, a: s.a - (meets(s.a) ? h : 0), b: s.b + (meets(s.b) ? h : 0) };
  });
  boxes.forEach(({ y, a, b }, i) => {
    out.push(box(`rail-y${i}`, [y.c - h, a, y.z], [RW, b - a, RT], { ...ribbonTone, ...(y.paint ? { paint: y.paint } : {}), radius: 1, bevel: 0.3, float: y.z > 0, ground: true }));
  });
  let k = 0;
  for (const s of xs) {
    // Lo que cubren los tramos de y que cruzan esta línea de x: ahí la cinta ya está.
    const cuts = boxes
      .filter(({ y, a, b }) => near(y.z, s.z) && y.c >= s.a - h - 0.2 && y.c <= s.b + h + 0.2 && s.c >= a - 0.2 && s.c <= b + 0.2)
      .map(({ y }) => [y.c - h, y.c + h] as [number, number])
      .sort((p, q) => p[0] - q[0]);
    let from = s.a;
    const pieces: [number, number][] = [];
    for (const [c0, c1] of cuts) {
      if (c0 > from) pieces.push([from, c0]);
      from = Math.max(from, c1);
    }
    if (from < s.b) pieces.push([from, s.b]);
    for (const [p, q] of pieces) {
      if (q - p < 0.8) continue;
      out.push(box(`rail-x${k++}`, [p, s.c - h, s.z], [q - p, RW, RT], { ...ribbonTone, ...(s.paint ? { paint: s.paint } : {}), radius: 1, bevel: 0.3, float: s.z > 0, ground: true }));
    }
  }
  return out;
}

/** Una cinta discontinua: rayitas a lo largo de cada tramo, que empiezan después de la esquina. */
function dashes(pts: Pt[], z: number, paint: string | undefined, id: string): Part[] {
  const out: Part[] = [];
  const h = RW / 2;
  let n = 0;
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d = dirOf(a, b);
    const alongY = Math.abs(d[1]) > 0.5;
    for (let t = i === 1 ? 0 : h + 1; t + 2 < len - (i === pts.length - 1 ? 0 : h + 1); t += DASH + SKIP) {
      const end = Math.min(t + DASH, len - (i === pts.length - 1 ? 0 : h + 1));
      const [p0, p1] = [t, end].map((u) => [a[0] + d[0] * u, a[1] + d[1] * u] as Pt);
      const [x0, x1, y0, y1] = [Math.min(p0[0], p1[0]), Math.max(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[1], p1[1])];
      out.push(box(`${id}-d${n++}`, alongY ? [p0[0] - h, y0, z] : [x0, p0[1] - h, z], alongY ? [RW, y1 - y0, RT] : [x1 - x0, RW, RT], { ...ribbonTone, ...(paint ? { paint } : {}), radius: 0.8, bevel: 0.25, float: z > 0, ground: true }));
    }
  }
  return out;
}

/** Un cartel de pie: dos patas y una placa que mira al lector, con el texto grabado. Sirve de rótulo de un enlace. */
export function tag(id: string, text: Text, s: number, at: Pt, z: number): Part[] {
  const w = Math.max(8, Math.ceil(widthOf(text, s) + 7));
  const hp = plateHeight(s);
  const legs = 5.5;
  const zp = z + legs;
  const out: Part[] = [];
  for (const k of [0, 1]) out.push(cyl(`${id}-post${k}`, [at[0], at[1] + (k ? 1 : -1) * (w / 2 - 2.2), z], 0.9, legs + 0.2, { tone: "lo", float: true }));
  out.push(
    box(`${id}-plate`, [at[0] - 0.8, at[1] - w / 2, zp], [1.6, w, hp], { tone: "hi", radius: 1, bevel: 0.4, float: true }),
    label(`${id}-text`, `${id}-plate`, [at[0] + 0.8, at[1], zp + 2.4], text, s, { align: "middle" }),
  );
  return out;
}

const hit = (a: Rect, b: Rect): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Dónde poner el cartel de una cinta: en el tramo más largo que lo aguante (mejor si va a lo largo de `y`), en el lugar
 * más cercano al medio que no pise un objeto ni otro cartel. La placa tapa lo que queda detrás de ella, así que el
 * hueco que se le pide se extiende hacia atrás.
 */
export function tagSpot(pts: Pt[], width: number, hard: Rect[], soft: Rect[]): Pt {
  const segs = pts.slice(1).map((b, i) => {
    const a = pts[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const alongY = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]);
    return { a, b, len, score: (alongY ? 1.35 : 1) * len + (alongY ? (len >= width + 16 ? 1000 : 0) : len >= 18 ? 1000 : 0) };
  });
  segs.sort((p, q) => q.score - p.score);
  const w = Math.max(8, Math.ceil(width + 7));
  const footprint = (p: Pt): Rect => ({ x0: p[0] - 15, x1: p[0] + 4, y0: p[1] - w / 2 - 2, y1: p[1] + w / 2 + 2 });
  // Primero un lugar que no pise ni objetos ni lo que tapan; si no hay, uno que al menos no pise un objeto.
  for (const avoid of [[...hard, ...soft], hard]) {
    for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88]) {
      for (const s of segs) {
        const p: Pt = [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
        if (!avoid.some((r) => hit(r, footprint(p)))) return p;
      }
    }
  }
  const s = segs[0];
  return s ? [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2] : pts[0];
}

/** Las piezas de todas las cintas: tramos, puntas y rótulos. */
export function drawLinks(draws: LinkDraw[], s: number, nodes: Rect[], shadows: Rect[]): Part[] {
  const taken: Rect[] = [];
  const solid: Seg[] = [];
  const parts: Part[] = [];
  const drawn = new Set<string>();
  const painted = (p?: string) => (p ? { paint: p } : {});
  for (const d of draws) {
    const heads: { kind: Exclude<End, "none">; tip: Pt; dir: Pt }[] = [];
    let pts = d.pts;
    if (d.style.to !== "none") heads.push({ kind: d.style.to, tip: pts[pts.length - 1], dir: dirOf(pts[pts.length - 2], pts[pts.length - 1]) });
    if (d.style.from !== "none") heads.push({ kind: d.style.from, tip: pts[0], dir: dirOf(pts[1], pts[0]) });
    pts = trim(pts, d.style.from === "none" ? 0 : HEAD[d.style.from].len, false);
    pts = trim(pts, d.style.to === "none" ? 0 : HEAD[d.style.to].len, true);
    if (d.style.dashed) parts.push(...dashes(pts, d.z, d.paint, `l${d.index}`));
    else {
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [pts[i - 1], pts[i]];
        if (Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0])) solid.push({ axis: "y", c: a[0], a: Math.min(a[1], b[1]), b: Math.max(a[1], b[1]), z: d.z, paint: d.paint });
        else solid.push({ axis: "x", c: a[1], a: Math.min(a[0], b[0]), b: Math.max(a[0], b[0]), z: d.z, paint: d.paint });
      }
    }
    heads.forEach((h, k) => {
      // Dos cintas que llegan al mismo puerto por el mismo lado comparten la punta.
      const key = `${h.kind}|${h.tip[0].toFixed(1)}|${h.tip[1].toFixed(1)}|${h.dir[0].toFixed(2)}|${h.dir[1].toFixed(2)}`;
      if (drawn.has(key)) return;
      drawn.add(key);
      const filled = h.kind === "arrow" || h.kind === "diamond-filled";
      parts.push(prism(`l${d.index}-head${k}`, headPlan(h.kind, h.tip, h.dir), d.z, RT + 0.6, filled ? { tone: h.kind === "diamond-filled" ? "lit" : "lo", ...painted(d.paint), bevel: 0.3, float: d.z > 0, ground: true } : { tone: "hi", bevel: 0.3, float: d.z > 0, ground: true }));
    });
    if (d.label !== undefined) {
      const w = widthOf(d.label, s);
      const at = tagSpot(d.pts, w, [...nodes, ...taken], shadows);
      taken.push({ x0: at[0] - 15, x1: at[0] + 4, y0: at[1] - w / 2 - 6, y1: at[1] + w / 2 + 6 });
      parts.push(...tag(`l${d.index}-label`, d.label, s, at, d.z + RT));
    }
    // Multiplicidad: un cartelito junto a cada extremo, a un lado de la cinta.
    d.mult?.forEach((m, k) => {
      if (m === undefined) return;
      const end = k === 0 ? d.pts[0] : d.pts[d.pts.length - 1];
      const next = k === 0 ? d.pts[1] : d.pts[d.pts.length - 2];
      const dir = dirOf(end, next);
      const at: Pt = [end[0] + dir[0] * 17 + (Math.abs(dir[0]) > 0.5 ? 0 : 9), end[1] + dir[1] * 17 + (Math.abs(dir[0]) > 0.5 ? 9 : 0)];
      parts.push(...tag(`l${d.index}-m${k}`, m, s, at, d.z + RT));
    });
  }
  return [...ribbons(solid), ...parts];
}

