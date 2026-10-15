import { depthOf, project, type Camera } from "./camera.ts";
import { centerOf, type Box3, type Vec3 } from "./math.ts";

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const EPS = 1e-3;

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

export interface Ordered {
  order: number[];
  cycles: string[];
}

/** Orden de pintado: topológico sobre los pares que se solapan en pantalla, con la profundidad como desempate. */
export function paintOrder(c: Camera, boxes: Box3[], names: string[]): Ordered {
  const n = boxes.length;
  const rects = boxes.map((b) => screenRect(c, b));
  const depth = boxes.map((b) => depthOf(c, centerOf(b)));
  const after: number[][] = boxes.map(() => []);
  const indeg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!overlaps(rects[i], rects[j])) continue;
      let r = compare(c, boxes[i], boxes[j]);
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
  while (order.length < n) {
    let pool = ready();
    if (pool.length === 0) {
      const left = [...Array(n).keys()].filter((k) => !done[k]);
      const k = left.reduce((m, x) => (depth[x] < depth[m] ? x : m), left[0]);
      cycles.push(names[k]);
      pool = [k];
    }
    const k = pool.reduce((m, x) => (depth[x] < depth[m] ? x : m), pool[0]);
    done[k] = true;
    order.push(k);
    for (const f of after[k]) indeg[f]--;
  }
  return { order, cycles };
}
