import { add, dot, type Vec3 } from "./math.ts";
import { axisOf, frameOf, type Frame } from "./mesh.ts";
import { FACES } from "./scene.ts";
import type { Part } from "./spec.ts";

/** Una rotación en filas: `apply(m, v)` es `m · v`. */
export type Mat3 = [Vec3, Vec3, Vec3];

/** Seno y coseno de un ángulo en grados, a 12 decimales: 90° da un 0 exacto y no un 6e-17. */
const trig = (deg: number) => [Math.sin, Math.cos].map((f) => Math.round(f((deg * Math.PI) / 180) * 1e12) / 1e12);

/** El giro de un nodo, `rotate: [x, y, z]` en grados: primero x, luego y y al final z, sobre los ejes fijos del padre (Rz·Ry·Rx). */
export function rotation(angles: unknown): Mat3 | undefined {
  const [x, y, z] = Array.isArray(angles) ? [0, 1, 2].map((i) => (Number.isFinite(angles[i]) ? Number(angles[i]) : 0)) : [0, 0, 0];
  if (x % 360 === 0 && y % 360 === 0 && z % 360 === 0) return undefined;
  const [sa, ca] = trig(x);
  const [sb, cb] = trig(y);
  const [sg, cg] = trig(z);
  return [
    [cg * cb, cg * sb * sa - sg * ca, cg * sb * ca + sg * sa],
    [sg * cb, sg * sb * sa + cg * ca, sg * sb * ca - cg * sa],
    [-sb, cb * sa, cb * ca],
  ];
}

export const apply = (m: Mat3, v: Vec3): Vec3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

/** `a · b`: primero se aplica `b` y luego `a`. */
export const compose = (a: Mat3 | undefined, b: Mat3 | undefined): Mat3 | undefined =>
  a && b ? (a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j])) as Mat3) : (a ?? b);

/**
 * Una pieza de un nodo girado, en el mundo: su origen `o` más `m · punto`. Las cajas y los prismas llevan además su base
 * (`frame`); los cilindros, los conos y las cápsulas, su eje girado; los rótulos, hacia dónde se leen.
 */
export function place(p: Part, o: Vec3, m: Mat3): Part {
  const at = (q: Vec3) => add(o, apply(m, q));
  const turn = (f: Frame): Frame => ({ o: f.o, u: apply(m, f.u), v: apply(m, f.v), w: apply(m, f.w) });
  switch (p.kind) {
    case "box":
      return { ...p, at: at(p.at), frame: turn(frameOf(at(p.at))) };
    case "prism":
      return { ...p, frame: turn(frameOf(at(p.axis === "y" ? [0, p.z, 0] : p.axis === "x" ? [p.z, 0, 0] : [0, 0, p.z]), p.axis ?? "z")) };
    case "cylinder":
    case "cone":
    case "capsule":
      return { ...p, at: at(p.at), axis: apply(m, axisOf(p.axis)) };
    case "sphere":
      return { ...p, at: at(p.at) };
    case "ticks":
      return { ...p, from: at(p.from), along: apply(m, p.along), toward: apply(m, p.toward) };
    case "label":
      return { ...p, at: at(p.at), axes: FACES[p.face ?? "top"].map((v) => apply(m, v)) as [Vec3, Vec3] };
    case "dots":
    case "line":
      return { ...p, points: p.points.map(at) };
  }
}
