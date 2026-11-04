import { depthOf, project, type Camera } from "./camera.ts";
import { add, centerOf, dot, mul, sub, unit, type Box3, type Vec2, type Vec3 } from "./math.ts";

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const EPS = 1e-3;
/**
 * Entre sólidos orientados, hundirse menos que esto cuenta como contacto (lo mismo que tolera la auditoría): las
 * coordenadas van redondeadas y una pieza cilíndrica que cruza un plano inclinado siempre asoma un poco.
 */
const TOUCH = 0.8;

function corners(b: Box3): Vec3[] {
  const out: Vec3[] = [];
  for (const x of [b.min[0], b.max[0]])
    for (const y of [b.min[1], b.max[1]])
      for (const z of [b.min[2], b.max[2]]) out.push([x, y, z]);
  return out;
}

export function screenRect(c: Camera, b: Box3): Rect {
  const pts = corners(b).map((p) => project(c, p));
  return {
    x0: Math.min(...pts.map((p) => p[0])),
    y0: Math.min(...pts.map((p) => p[1])),
    x1: Math.max(...pts.map((p) => p[0])),
    y1: Math.max(...pts.map((p) => p[1])),
  };
}

const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;

/**
 * -1 si `a` va detrás de `b`, 1 si va delante, 0 si las cajas se cruzan y no hay eje que las separe.
 * Entre los ejes que separan, manda el que más pesa en la dirección de la vista.
 */
export function compare(c: Camera, a: Box3, b: Box3): number {
  let best = 0;
  let weight = 0;
  for (let i = 0; i < 3; i++) {
    const w = Math.abs(c.view[i]);
    if (a.max[i] <= b.min[i] + EPS && w > weight) {
      best = c.view[i] > 0 ? -1 : 1;
      weight = w;
    } else if (b.max[i] <= a.min[i] + EPS && w > weight) {
      best = c.view[i] > 0 ? 1 : -1;
      weight = w;
    }
  }
  return best;
}

/** Un sólido orientado (inclinado o extruido en x o y): sus vértices, las normales de sus caras planas y su silueta. */
export interface Shape {
  pts: Vec3[];
  axes: Vec3[];
  /** Envolvente convexa de la pieza en pantalla. */
  hull: Vec2[];
}

/** Envolvente convexa (cadena monótona), en sentido antihorario. */
export function hullOf(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Vec2[]) => {
    const out: Vec2[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/** Si dos siluetas convexas se pisan en pantalla (más que un roce). */
export function hullsOverlap(a: Vec2[], b: Vec2[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const n: Vec2 = [q[1] - p[1], p[0] - q[0]];
      const len = Math.hypot(n[0], n[1]);
      if (len < 1e-9) continue;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const v of a) {
        const d = (v[0] * n[0] + v[1] * n[1]) / len;
        a0 = Math.min(a0, d);
        a1 = Math.max(a1, d);
      }
      for (const v of b) {
        const d = (v[0] * n[0] + v[1] * n[1]) / len;
        b0 = Math.min(b0, d);
        b1 = Math.max(b1, d);
      }
      if (a1 <= b0 + TOUCH || b1 <= a0 + TOUCH) return false;
    }
  }
  return true;
}

function range(pts: Vec3[], n: Vec3): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pts) {
    const v = dot(p, n);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

/**
 * Los ejes donde buscar un plano que separe dos sólidos: las normales de sus caras planas y la recta entre sus centros
 * (la que separa dos piezas redondas, como un tubo junto a una cámara).
 */
function candidates(a: Shape, b: Shape): Vec3[] {
  const mid = (s: Shape) => mul(s.pts.reduce((acc, p) => add(acc, p), [0, 0, 0] as Vec3), 1 / Math.max(1, s.pts.length));
  const between = unit(sub(mid(b), mid(a)));
  return between.some((v) => v !== 0) ? [...a.axes, ...b.axes, between] : [...a.axes, ...b.axes];
}

/**
 * Como `compare`, pero sobre los planos de las caras de dos sólidos orientados: un plano que los separa dice cuál
 * queda del lado del lector. Sirve cuando las cajas se cruzan aunque las piezas no (una culata en una bancada en V).
 */
export function compareShapes(c: Camera, a: Shape, b: Shape): number {
  let best = 0;
  let weight = 0;
  for (const n of candidates(a, b)) {
    const toward = dot(n, c.view);
    const w = Math.abs(toward);
    if (w <= weight) continue;
    const [a0, a1] = range(a.pts, n);
    const [b0, b1] = range(b.pts, n);
    if (a1 <= b0 + TOUCH) best = toward > 0 ? -1 : 1;
    else if (b1 <= a0 + TOUCH) best = toward > 0 ? 1 : -1;
    else continue;
    weight = w;
  }
  return best;
}

/** Si un plano de las caras separa dos sólidos orientados (con la misma tolerancia de contacto). */
export function shapesApart(a: Shape, b: Shape): boolean {
  for (const n of candidates(a, b)) {
    const [a0, a1] = range(a.pts, n);
    const [b0, b1] = range(b.pts, n);
    if (a1 <= b0 + TOUCH || b1 <= a0 + TOUCH) return true;
  }
  return false;
}

const inside = (a: Box3, b: Box3) => [0, 1, 2].every((i) => a.min[i] >= b.min[i] - EPS && a.max[i] <= b.max[i] + EPS);

export interface Ordered {
  order: number[];
  cycles: string[];
}

/**
 * Orden de pintado: topológico sobre los pares que se solapan en pantalla, con la profundidad como desempate. Si dos
 * cajas se cruzan, decide un plano de las caras de los sólidos orientados (`shapes`) y, si no lo hay, la pieza
 * metida dentro de la otra va antes: queda tapada, como un pistón en su cilindro.
 */
export function paintOrder(c: Camera, boxes: Box3[], names: string[], shapes?: (() => Shape | undefined)[]): Ordered {
  const n = boxes.length;
  const rects = boxes.map((b) => screenRect(c, b));
  const depth = boxes.map((b) => depthOf(c, centerOf(b)));
  const after: number[][] = boxes.map(() => []);
  const indeg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!overlaps(rects[i], rects[j])) continue;
      // Con sólidos a mano, las cajas en pantalla exageran: si las siluetas no se pisan, el orden da igual.
      const a = shapes?.[i]();
      const b = shapes?.[j]();
      if (a && b && !hullsOverlap(a.hull, b.hull)) continue;
      let r = compare(c, boxes[i], boxes[j]);
      if (r === 0 && a && b) r = compareShapes(c, a, b);
      if (r === 0 && inside(boxes[i], boxes[j])) r = -1;
      else if (r === 0 && inside(boxes[j], boxes[i])) r = 1;
      if (r === 0) r = depth[i] <= depth[j] ? -1 : 1;
      const [back, front] = r < 0 ? [i, j] : [j, i];
      after[back].push(front);
      indeg[front]++;
    }
  }
  const order: number[] = [];
  const cycles: string[] = [];
  const done = new Array(n).fill(false);
  const ready = () => [...Array(n).keys()].filter((k) => !done[k] && indeg[k] === 0);
  // Una pieza metida en la caja de otra (un pistón en su bancada) queda tapada: si hay un ciclo, sale primero y no avisa.
  let hidden: boolean[] | undefined;
  while (order.length < n) {
    let pool = ready();
    if (pool.length === 0) {
      hidden ??= boxes.map((b, i) => boxes.some((o, j) => j !== i && inside(b, o)));
      const left = [...Array(n).keys()].filter((k) => !done[k]);
      const inner = left.filter((k) => hidden![k]);
      const from = inner.length ? inner : left;
      const k = from.reduce((m, x) => (depth[x] < depth[m] ? x : m), from[0]);
      const peers = left.filter((j) => j !== k && after[j].includes(k)).map((j) => names[j]);
      if (!hidden[k]) cycles.push(peers.length ? `${names[k]} ↔ ${peers.slice(0, 3).join(", ")}` : names[k]);
      pool = [k];
    }
    const k = pool.reduce((m, x) => (depth[x] < depth[m] ? x : m), pool[0]);
    done[k] = true;
    order.push(k);
    for (const f of after[k]) indeg[f]--;
  }
  return { order, cycles };
}
