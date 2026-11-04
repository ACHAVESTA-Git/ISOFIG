import type { Camera } from "./camera.ts";
import { add, boxOf, mul, type Box3, type Vec2, type Vec3 } from "./math.ts";
import { areaOf, axisOf, circle, cornerSteps, frameOf, framePoint, prism, roundedRect, segmentsFor, type Mesh } from "./mesh.ts";
import type { Part, PrismPart, Tone } from "./spec.ts";

export type Solid = Extract<Part, { kind: "box" | "cylinder" | "cone" | "prism" | "sphere" | "capsule" }>;
/** Las piezas redondas, que se dibujan como círculo o «estadio» y no como malla. */
export type Round = Extract<Solid, { kind: "sphere" | "capsule" }>;
export type Detail = Extract<Part, { kind: "ticks" | "dots" | "line" | "label" }>;

/** Una pieza sólida con sus detalles: la unidad del orden de pintado. */
export interface Item {
  id: string;
  tone: Tone;
  group?: string;
  outer?: string;
  hidden?: boolean;
  float?: boolean;
  mount: string[];
  shadow?: boolean;
  solid: Solid;
  details: Detail[];
  /** Índice, en `spec.parts`, de la pieza de la que sale cada detalle (en el mismo orden que `details`). */
  detailSource: number[];
  /** Índice, en `spec.parts`, de la pieza de la que sale este sólido. */
  source: number;
  box: Box3;
}

const SOLIDS = ["box", "cylinder", "cone", "prism", "sphere", "capsule"];
export const isSolid = (p: Part): p is Solid => SOLIDS.includes(p.kind);
export const isRound = (p: Solid): p is Round => p.kind === "sphere" || p.kind === "capsule";
const DETAILS = new Set(["ticks", "dots", "line", "label"]);
const KNOWN = new Set([...SOLIDS, ...DETAILS]);

/** Qué coordenadas del mundo son la planta (dos) y cuál el eje de la extrusión, según `axis`. */
const PLAN_AXES = { z: [0, 1, 2], y: [0, 2, 1], x: [1, 2, 0] } as const;

/** Un punto de la planta de un prisma, a la altura `w` de su eje, en el mundo. */
function prismPoint(p: PrismPart, [a, b]: Vec2, w: number): Vec3 {
  const [i, j, k] = PLAN_AXES[p.axis ?? "z"];
  const out: Vec3 = [0, 0, 0];
  out[i] = a;
  out[j] = b;
  out[k] = w;
  return out;
}

export function shift(p: Part, d: Vec3): Part {
  switch (p.kind) {
    case "box":
    case "cylinder":
    case "cone":
    case "sphere":
    case "capsule":
      return { ...p, at: add(p.at, d) };
    case "prism": {
      const [i, j, k] = PLAN_AXES[p.axis ?? "z"];
      return { ...p, plan: p.plan.map(([x, y]): Vec2 => [x + d[i], y + d[j]]), z: p.z + d[k] };
    }
    case "ticks":
      return { ...p, from: add(p.from, d) };
    case "label":
      return { ...p, at: add(p.at, d) };
    case "dots":
    case "line":
      return { ...p, points: p.points.map((q) => add(q, d)) };
  }
}

/** Reemplaza `{i}` por el número de la copia. */
export const fillIndex = (s: string | undefined, i: number): string | undefined => (s === undefined ? s : s.replaceAll("{i}", String(i)));

/** Las copias de una pieza: la número `k` se desplaza `step × k` y su `{i}` vale `from + k` (`from` es 0 por defecto). */
export function copiesOf(p: { repeat?: { count: number; from?: number } }): { k: number; i: number }[] {
  const n = p.repeat?.count ?? 1;
  const from = p.repeat?.from ?? 0;
  const out: { k: number; i: number }[] = [];
  for (let k = 0; k < n; k++) out.push({ k, i: from + k });
  return out;
}

/** El id de la copia `i`: sin `{i}` en un `repeat`, se le añade `-i`. */
export const copyId = (p: { id: string; repeat?: unknown }, i: number): string =>
  p.repeat && !p.id.includes("{i}") ? `${p.id}-${i}` : fillIndex(p.id, i)!;

/** Las piezas ya repetidas, cada una con el índice de la pieza de la spec de la que sale (para decir dónde falla algo). */
export function expandIndexed(parts: Part[]): { part: Part; source: number }[] {
  const out: { part: Part; source: number }[] = [];
  parts.forEach((p, source) => {
    // Una pieza sin `kind` conocido no se dibuja (`validateSpec` dice cuál es): ni se repite, o un `repeat` disparatado la multiplicaría.
    if (!p || typeof p !== "object" || !KNOWN.has(p.kind)) return;
    for (const { k, i } of copiesOf(p)) {
      const sub = (s: string | undefined) => fillIndex(s, i);
      const moved = p.repeat ? shift(p, mul(p.repeat.step, k)) : p;
      const copy = { ...moved, id: copyId(p, i), repeat: undefined } as Part;
      if ("on" in copy) copy.on = sub(copy.on)!;
      if (copy.mount) copy.mount = copy.mount.map((m) => sub(m)!);
      if (isSolid(copy)) copy.group = sub(copy.group);
      out.push({ part: copy, source });
    }
  });
  return out;
}

export const expand = (parts: Part[]): Part[] => expandIndexed(parts).map((e) => e.part);

/** Caja de un disco de radio `r` centrado en `c` y perpendicular a `w` (unitario). */
function discBox(c: Vec3, w: Vec3, r: number): Vec3[] {
  const e = w.map((x) => r * Math.sqrt(Math.max(0, 1 - x * x))) as Vec3;
  return [add(c, mul(e, -1)), add(c, e)];
}

/** Los centros de las dos medias esferas (el mismo en una esfera). */
export const endsOf = (p: Round): [Vec3, Vec3] => [p.at, p.kind === "capsule" ? add(p.at, mul(axisOf(p.axis), Math.max(0, p.h))) : p.at];

/** La planta de un prisma, antihoraria y en el orden (u, v) de su base (con `axis` y va como [z, x]). */
function prismRing(p: PrismPart): Vec2[] {
  const ring = p.axis === "y" ? p.plan.map(([x, z]): Vec2 => [z, x]) : p.plan;
  return areaOf(ring) < 0 ? [...ring].reverse() : ring;
}

/** Las esquinas, en el mundo, de una caja o un prisma con `frame` (los pone un nodo con `rotate`); sin él, nada. */
export function framedPoints(p: Solid): Vec3[] | undefined {
  if ((p.kind !== "box" && p.kind !== "prism") || !p.frame) return undefined;
  const [ring, h] = p.kind === "box" ? ([[[0, 0], [p.size[0], 0], [p.size[0], p.size[1]], [0, p.size[1]]], p.size[2]] as const) : ([prismRing(p), p.h] as const);
  return ring.flatMap(([s, t]) => [framePoint(p.frame!, s, t, 0), framePoint(p.frame!, s, t, h)]);
}

export function solidBox(p: Solid): Box3 {
  const corners = framedPoints(p);
  if (corners) return boxOf(corners);
  if (p.kind === "box") return { min: [...p.at], max: add(p.at, p.size) };
  if (isRound(p)) return boxOf(endsOf(p).flatMap((c) => [add(c, [-p.r, -p.r, -p.r]), add(c, [p.r, p.r, p.r])]));
  if (p.kind === "prism") return boxOf(p.plan.flatMap((q) => [prismPoint(p, q, p.z), prismPoint(p, q, p.z + p.h)]));
  const w = axisOf(p.axis);
  const end = add(p.at, mul(w, p.h));
  return boxOf([...discBox(p.at, w, p.r), ...discBox(end, w, p.kind === "cone" ? p.r2 : p.r)]);
}

/**
 * Arma las piezas. Es tolerante: lo que no tiene un `kind` conocido o un anfitrión se salta, y `validateSpec` es quien
 * dice por qué (así una spec rota da mensajes claros en vez de un fallo a medias).
 */
export function buildItems(parts: Part[]): { items: Item[] } {
  const all = expandIndexed(parts);
  const items: Item[] = [];
  const byId = new Map<string, Item>();
  for (const { part: p, source } of all) {
    if (!isSolid(p)) continue;
    const item: Item = {
      id: p.id,
      tone: p.tone ?? "mid",
      group: p.group,
      outer: p.outer,
      hidden: p.hidden,
      float: p.float,
      mount: p.mount ?? [],
      shadow: p.shadow,
      solid: p,
      details: [],
      detailSource: [],
      source,
      box: solidBox(p),
    };
    items.push(item);
    byId.set(p.id, item);
  }
  for (const { part: p, source } of all) {
    if (isSolid(p) || !DETAILS.has(p.kind)) continue;
    const host = byId.get(p.on);
    if (host) {
      host.details.push(p);
      host.detailSource.push(source);
    }
  }
  return { items };
}

export function meshOf(p: Exclude<Solid, Round>, c: Camera): Mesh {
  if (p.kind === "box") {
    const [w, d, h] = p.size;
    const r = p.radius ?? 0;
    return prism(roundedRect(w, d, r, cornerSteps(r * c.scale)), p.frame ?? frameOf(p.at), h, p.bevel ?? 0);
  }
  // El marco de y lleva la planta en otro orden: se lee en su base y se orienta sola (horaria o antihoraria).
  if (p.kind === "prism") return prism(prismRing(p), p.frame ?? frameOf(prismPoint(p, [0, 0], p.z), p.axis ?? "z"), p.h, p.bevel ?? 0);
  if (p.kind === "cone") {
    const n = segmentsFor(Math.max(p.r, p.r2) * c.scale);
    return prism(circle(p.r, n), frameOf(p.at, p.axis), p.h, 0, circle(p.r2, n));
  }
  return prism(circle(p.r, segmentsFor(p.r * c.scale)), frameOf(p.at, p.axis), p.h, p.bevel ?? 0);
}

export interface Lines {
  fine: Vec3[][];
  bold: Vec3[][];
  dots: Vec3[];
}

export function linesOf(details: Detail[]): Lines {
  const out: Lines = { fine: [], bold: [], dots: [] };
  for (const d of details) {
    if (d.kind === "dots") out.dots.push(...d.points);
    if (d.kind === "line") (d.bold ? out.bold : out.fine).push(d.points);
    if (d.kind === "ticks") {
      const [minor, major] = d.size ?? [2, 4];
      for (let i = 0; i < d.count; i++) {
        const p = add(d.from, mul(d.along, i));
        const big = d.every !== undefined && i % d.every === 0;
        (big ? out.bold : out.fine).push([p, add(p, mul(d.toward, big ? major : minor))]);
      }
    }
  }
  return out;
}
