import { depthOf, facesViewer, project, type Camera } from "./camera.ts";
import { dot, mul, add, unit, type Vec2, type Vec3 } from "./math.ts";
import { circle, segmentsFor, type Mesh } from "./mesh.ts";
import { hullOf } from "./order.ts";

export type Shade = "t" | "b" | "s0" | "s1" | "s2" | "s3";
export const SHADES: Shade[] = ["s0", "s1", "s2", "s3", "b", "t"];

export interface Drawn {
  faces: Map<Shade, Vec2[][]>;
  edges: Vec2[][];
}

const CREASE = 0.5;

export function shadeOf(c: Camera, n: Vec3): Shade {
  if (n[2] > 0.9) return "t";
  if (n[2] > 0.3) return "b";
  const plan = unit([c.view[0], c.view[1], 0]);
  const light = unit(add(mul(c.right, -1), mul(plan, 0.25)));
  const nh = unit([n[0], n[1], 0]);
  const k = Math.floor((0.5 + 0.5 * dot(nh, light)) * 4);
  return `s${Math.max(0, Math.min(3, k))}` as Shade;
}

export function drawMesh(c: Camera, mesh: Mesh): Drawn {
  const screen = mesh.v.map((p) => project(c, p));
  const visible = mesh.faces.map((f) => facesViewer(c, f.n));
  const order = mesh.faces
    .map((f, i) => ({ f, i, d: depthOf(c, centroid(mesh.v, f.idx)) }))
    .filter(({ i }) => visible[i])
    .sort((a, b) => Math.round((a.d - b.d) * 1e6) || a.i - b.i);

  const faces = new Map<Shade, Vec2[][]>();
  for (const { f } of order) {
    const s = shadeOf(c, f.n);
    if (!faces.has(s)) faces.set(s, []);
    faces.get(s)!.push(f.idx.map((k) => screen[k]));
  }

  // Cada arista, con el par de vértices como un solo número, y las caras que la comparten.
  const n = mesh.v.length;
  const owners = new Map<number, number[]>();
  mesh.faces.forEach((f, fi) => {
    f.idx.forEach((a, k) => {
      const b = f.idx[(k + 1) % f.idx.length];
      const key = a < b ? a * n + b : b * n + a;
      if (!owners.has(key)) owners.set(key, []);
      owners.get(key)!.push(fi);
    });
  });

  const segments: [number, number][] = [];
  for (const [key, fs] of owners) {
    const [a, b] = [Math.floor(key / n), key % n];
    const [f0, f1] = fs;
    if (f1 === undefined) {
      if (visible[f0]) segments.push([a, b]);
      continue;
    }
    if (!visible[f0] && !visible[f1]) continue;
    const silhouette = visible[f0] !== visible[f1];
    const A = mesh.faces[f0];
    const B = mesh.faces[f1];
    const crease = A.kind !== B.kind || dot(A.n, B.n) < CREASE;
    if (silhouette || crease) segments.push([a, b]);
  }
  return { faces, edges: chain(segments).map((run) => run.map((k) => screen[k])) };
}

/** La envolvente de dos círculos de radio `rho`, uno en cada centro (solo cuentan x e y): la silueta de una cápsula. */
export function stadium(a: readonly number[], b: readonly number[], rho: number, draft?: boolean): Vec2[] {
  const ring = circle(rho, segmentsFor(rho, draft));
  return hullOf([a, b].flatMap(([x, y]) => ring.map(([u, v]): Vec2 => [x + u, y + v])));
}

/** Hacia dónde cae la luz en pantalla (arriba y a la izquierda, como en las caras de una caja). */
const LIGHT: Vec2 = [-0.6, -0.8];
/** Tono, radio y desplazamiento hacia la luz de cada capa, en fracciones del radio: la sombra queda en el borde opuesto. */
const LAYERS: [Shade, number, number][] = [["s0", 1, 0], ["s1", 0.9, 0.1], ["s2", 0.76, 0.24], ["s3", 0.58, 0.4], ["b", 0.38, 0.54], ["t", 0.18, 0.62]];

/**
 * Una esfera o una cápsula, de radio `r` y con los centros `ends`. En proyección ortográfica una esfera es un círculo y una
 * cápsula un estadio: lo que las hace volumen son las capas de tono, cada una más chica y más cerca de la luz que la anterior.
 */
export function drawRound(c: Camera, ends: [Vec3, Vec3], r: number): Drawn {
  const [a, b] = ends.map((p) => project(c, p));
  const rho = r * c.scale;
  const faces = new Map<Shade, Vec2[][]>();
  // En borrador, solo las capas del borde, la media sombra y la base.
  for (const [shade, k, s] of c.draft ? [LAYERS[0], LAYERS[2], LAYERS[4]] : LAYERS) {
    const m = (p: Vec2): Vec2 => [p[0] + rho * s * LIGHT[0], p[1] + rho * s * LIGHT[1]];
    faces.set(shade, [stadium(m(a), m(b), rho * k, c.draft)]);
  }
  const rim = faces.get("s0")![0];
  return { faces, edges: [[...rim, ...rim.slice(0, 1)]] };
}

function centroid(v: Vec3[], idx: number[]): Vec3 {
  let p: Vec3 = [0, 0, 0];
  for (const k of idx) p = add(p, v[k]);
  return mul(p, 1 / idx.length);
}

/** Une segmentos que comparten vértice en polilíneas, para escribir menos «M». */
export function chain(segments: [number, number][]): number[][] {
  const adj = new Map<number, number[]>();
  const used = new Set<number>();
  segments.forEach(([a, b], i) => {
    for (const k of [a, b]) {
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k)!.push(i);
    }
  });
  const runs: number[][] = [];
  const extend = (run: number[]) => {
    for (;;) {
      const tail = run[run.length - 1];
      const next = adj.get(tail)!.find((i) => !used.has(i));
      if (next === undefined) return;
      used.add(next);
      const [a, b] = segments[next];
      run.push(a === tail ? b : a);
    }
  };
  segments.forEach(([a, b], i) => {
    if (used.has(i)) return;
    used.add(i);
    const run = [a, b];
    extend(run);
    run.reverse();
    extend(run);
    runs.push(run);
  });
  return runs;
}
