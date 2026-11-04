import { add, cross, mul, sub, unit, type Vec2, type Vec3 } from "./math.ts";

export type FaceKind = "top" | "bevel" | "side" | "bottom";

export interface Face {
  idx: number[];
  n: Vec3;
  kind: FaceKind;
}

export interface Mesh {
  v: Vec3[];
  faces: Face[];
}

export interface Frame {
  o: Vec3;
  u: Vec3;
  v: Vec3;
  w: Vec3;
}

export type Axis = "x" | "y" | "z";

export function frameOf(o: Vec3, axis: Axis | Vec3 = "z"): Frame {
  if (axis === "x") return { o, u: [0, 1, 0], v: [0, 0, 1], w: [1, 0, 0] };
  if (axis === "y") return { o, u: [0, 0, 1], v: [1, 0, 0], w: [0, 1, 0] };
  if (axis === "z") return { o, u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1] };
  // Un eje cualquiera: u queda horizontal (o sobre x si el eje es casi vertical) y la base sigue siendo directa.
  const w = unit(axis);
  const u = unit(Math.abs(w[2]) > 0.99 ? cross([0, 1, 0], w) : cross([0, 0, 1], w));
  return { o, u, v: cross(w, u), w };
}

/** Dirección unitaria de un eje con nombre o vector. */
export const axisOf = (axis: Axis | Vec3 = "z"): Vec3 => frameOf([0, 0, 0], axis).w;

/** El punto (s, t, h) de la base `frame`: `s` sobre u, `t` sobre v y `h` sobre w. */
export const framePoint = (f: Frame, s: number, t: number, h: number): Vec3 =>
  add(add(add(f.o, mul(f.u, s)), mul(f.v, t)), mul(f.w, h));

export function roundedRect(w: number, d: number, r: number, steps: number): Vec2[] {
  const rr = Math.max(0, Math.min(r, w / 2, d / 2));
  if (rr === 0) return [[0, 0], [w, 0], [w, d], [0, d]];
  const corners: [number, number, number][] = [
    [w - rr, rr, -90],
    [w - rr, d - rr, 0],
    [rr, d - rr, 90],
    [rr, rr, 180],
  ];
  const ring: Vec2[] = [];
  for (const [cx, cy, start] of corners) {
    for (let k = 0; k <= steps; k++) {
      const a = ((start + (90 * k) / steps) * Math.PI) / 180;
      ring.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
  }
  return ring;
}

export function circle(r: number, n: number): Vec2[] {
  const ring: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    ring.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return ring;
}

function edgeNormal(a: Vec2, b: Vec2): Vec2 {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  return [dy / l, -dx / l];
}

export function inset(ring: Vec2[], b: number): Vec2[] {
  const n = ring.length;
  return ring.map((p, i) => {
    const n0 = edgeNormal(ring[(i - 1 + n) % n], p);
    const n1 = edgeNormal(p, ring[(i + 1) % n]);
    const k = b / (1 + n0[0] * n1[0] + n0[1] * n1[1] || 1);
    return [p[0] - (n0[0] + n1[0]) * k, p[1] - (n0[1] + n1[1]) * k];
  });
}

/** Área con signo de un anillo: positiva si va en sentido antihorario. */
export function areaOf(ring: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

/**
 * Extruye un anillo CCW del plano (u, v) a lo largo de w, con bisel opcional en la tapa. Con `top`, la tapa es ese
 * otro anillo (mismo número de puntos): un tronco de cono.
 */
export function prism(ring: Vec2[], frame: Frame, h: number, bevel = 0, top?: Vec2[]): Mesh {
  const n = ring.length;
  const b = top ? 0 : Math.max(0, Math.min(bevel, h / 2));
  const v: Vec3[] = [];
  const faces: Face[] = [];
  const crownRing = top ?? (b > 0 ? inset(ring, b) : ring);
  for (const [s, t] of ring) v.push(framePoint(frame, s, t, 0));
  for (const [s, t] of top ?? ring) v.push(framePoint(frame, s, t, h - b));
  if (b > 0) for (const [s, t] of crownRing) v.push(framePoint(frame, s, t, h));
  const crown = b > 0 ? 2 * n : n;

  if (areaOf(ring) > 1e-9) faces.push({ idx: [...Array(n).keys()].reverse(), n: mul(frame.w, -1), kind: "bottom" });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const tangent = unit(sub(v[j], v[i]));
    // En un tronco, la normal sale de las diagonales: no se anula si un extremo es una punta.
    const side = top ? unit(cross(sub(v[n + j], v[i]), sub(v[n + i], v[j]))) : unit(cross(tangent, frame.w));
    faces.push({ idx: [i, j, n + j, n + i], n: side, kind: "side" });
    if (b > 0) faces.push({ idx: [n + i, n + j, crown + j, crown + i], n: unit(add(side, frame.w)), kind: "bevel" });
  }
  if (!top || areaOf(top) > 1e-9) faces.push({ idx: [...Array(n).keys()].map((i) => crown + i), n: frame.w, kind: "top" });
  return { v, faces };
}

/** Cuántos lados lleva un círculo de ese radio en pantalla; en borrador, no más de 16. */
export function segmentsFor(screenRadius: number, draft?: boolean): number {
  return Math.max(12, Math.min(draft ? 16 : 48, 4 * Math.ceil(screenRadius / 2.5)));
}

export function cornerSteps(screenRadius: number): number {
  return Math.max(2, Math.min(8, Math.ceil(screenRadius / 2)));
}
