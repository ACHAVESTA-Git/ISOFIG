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

export function frameOf(o: Vec3, axis: Axis = "z"): Frame {
  if (axis === "x") return { o, u: [0, 1, 0], v: [0, 0, 1], w: [1, 0, 0] };
  if (axis === "y") return { o, u: [0, 0, 1], v: [1, 0, 0], w: [0, 1, 0] };
  return { o, u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1] };
}

const at = (f: Frame, s: number, t: number, h: number): Vec3 =>
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

/** Extruye un anillo CCW del plano (u, v) a lo largo de w, con bisel opcional en la tapa. */
export function prism(ring: Vec2[], frame: Frame, h: number, bevel = 0): Mesh {
  const n = ring.length;
  const b = Math.max(0, Math.min(bevel, h / 2));
  const v: Vec3[] = [];
  const faces: Face[] = [];
  const top = b > 0 ? inset(ring, b) : ring;
  for (const [s, t] of ring) v.push(at(frame, s, t, 0));
  for (const [s, t] of ring) v.push(at(frame, s, t, h - b));
  if (b > 0) for (const [s, t] of top) v.push(at(frame, s, t, h));
  const crown = b > 0 ? 2 * n : n;

  faces.push({ idx: [...Array(n).keys()].reverse(), n: mul(frame.w, -1), kind: "bottom" });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const tangent = unit(sub(v[j], v[i]));
    const side = unit(cross(tangent, frame.w));
    faces.push({ idx: [i, j, n + j, n + i], n: side, kind: "side" });
    if (b > 0) faces.push({ idx: [n + i, n + j, crown + j, crown + i], n: unit(add(side, frame.w)), kind: "bevel" });
  }
  faces.push({ idx: [...Array(n).keys()].map((i) => crown + i), n: frame.w, kind: "top" });
  return { v, faces };
}

export function segmentsFor(screenRadius: number): number {
  return Math.max(12, Math.min(48, 4 * Math.ceil(screenRadius / 2.5)));
}

export function cornerSteps(screenRadius: number): number {
  return Math.max(2, Math.min(8, Math.ceil(screenRadius / 2)));
}
