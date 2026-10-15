import { depthOf, facesViewer, project, type Camera } from "./camera.ts";
import { dot, mul, add, unit, type Vec2, type Vec3 } from "./math.ts";
import type { Mesh } from "./mesh.ts";

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

  const owners = new Map<string, number[]>();
  mesh.faces.forEach((f, fi) => {
    f.idx.forEach((a, k) => {
      const b = f.idx[(k + 1) % f.idx.length];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (!owners.has(key)) owners.set(key, []);
      owners.get(key)!.push(fi);
    });
  });

  const segments: [number, number][] = [];
  for (const [key, fs] of owners) {
    const [a, b] = key.split(":").map(Number);
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
