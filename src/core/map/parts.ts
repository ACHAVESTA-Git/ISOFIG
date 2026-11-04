import { isSolid, solidBox } from "../items.ts";
import type { BoxPart, CylinderPart, DotsPart, LabelPart, LinePart, Part, PrismPart, Text, TicksPart, Vec2, Vec3 } from "../spec.ts";

/** En un objeto del catálogo, el cuerpo se pinta con el rol que le toque: este marcador se cambia al compilar. */
export const ROLE = "$role";

type Opts<T> = Partial<Omit<T, "id" | "kind">>;

export const box = (id: string, at: Vec3, size: Vec3, o: Opts<BoxPart> = {}): Part => ({ id, kind: "box", at, size, ...o }) as Part;
export const cyl = (id: string, at: Vec3, r: number, h: number, o: Opts<CylinderPart> = {}): Part => ({ id, kind: "cylinder", at, r, h, ...o }) as Part;
export const prism = (id: string, plan: Vec2[], z: number, h: number, o: Opts<PrismPart> = {}): Part => ({ id, kind: "prism", plan, z, h, ...o }) as Part;
export const dots = (id: string, on: string, points: Vec3[]): Part => ({ id, kind: "dots", on, points }) as DotsPart;
export const line = (id: string, on: string, points: Vec3[], bold = false): Part => ({ id, kind: "line", on, points, ...(bold ? { bold } : {}) }) as LinePart;
export const ticks = (id: string, on: string, o: Omit<TicksPart, "id" | "kind" | "on">): Part => ({ id, kind: "ticks", on, ...o }) as TicksPart;
export const label = (id: string, on: string, at: Vec3, text: Text, size: number, o: Partial<Pick<LabelPart, "face" | "align">> = {}): Part =>
  ({ id, kind: "label", on, at, text, size, face: "x", ...o }) as LabelPart;

/** Rectángulo de `len` × `wid` centrado en `[cx, cy]` y girado `deg` grados: una planta antihoraria para un prisma. */
export function rectPlan(cx: number, cy: number, len: number, wid: number, deg: number): Vec2[] {
  const a = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as Vec2[]).map(([u, v]): Vec2 => [cx + (u * len * c - v * wid * s) / 2, cy + (u * len * s + v * wid * c) / 2]);
}

const moveVec = (v: Vec3, d: Vec3): Vec3 => [v[0] + d[0], v[1] + d[1], v[2] + d[2]];

/** Mueve una pieza `d` en el mundo (las coordenadas de un nodo son locales a su `at`; esto arma el nodo ya colocado). */
export function shiftPart(p: Part, d: Vec3): Part {
  switch (p.kind) {
    case "box":
    case "cylinder":
    case "cone":
    case "sphere":
    case "capsule":
    case "label":
      return { ...p, at: moveVec(p.at, d) } as Part;
    case "prism":
      return { ...p, plan: p.plan.map(([x, y]): Vec2 => [x + d[0], y + d[1]]), z: p.z + d[2] };
    case "ticks":
      return { ...p, from: moveVec(p.from, d) };
    case "dots":
    case "line":
      return { ...p, points: p.points.map((q) => moveVec(q, d)) };
  }
}

export function withRole(parts: Part[], role: string): Part[] {
  return parts.map((p) => (p.paint === ROLE ? { ...p, paint: role } : p));
}

/**
 * Las piezas que se cruzan por naturaleza (dos cintas que se cruzan, una punta sobre su cinta, dos paquetes que parten
 * del mismo punto) se declaran encajadas entre sí, para que la auditoría no las cuente como choque.
 */
export function mountOverlaps(parts: Part[]): Part[] {
  const solids = parts.filter(isSolid).map((p) => ({ p, box: solidBox(p) }));
  const mounts = new Map<string, string[]>();
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const [a, b] = [solids[i], solids[j]];
      if ([0, 1, 2].every((k) => Math.min(a.box.max[k], b.box.max[k]) - Math.max(a.box.min[k], b.box.min[k]) > 0.7)) {
        mounts.set(a.p.id, [...(mounts.get(a.p.id) ?? []), b.p.id]);
      }
    }
  }
  return parts.map((p) => (mounts.has(p.id) ? ({ ...p, mount: [...(p.mount ?? []), ...mounts.get(p.id)!] } as Part) : p));
}
