import type { Camera } from "./camera.ts";
import { add, boxOf, mul, type Box3, type Vec2, type Vec3 } from "./math.ts";
import { circle, cornerSteps, frameOf, prism, roundedRect, segmentsFor, type Mesh } from "./mesh.ts";
import type { Part, Tone } from "./spec.ts";

export type Solid = Extract<Part, { kind: "box" | "cylinder" | "prism" }>;
export type Detail = Extract<Part, { kind: "ticks" | "dots" | "line" | "label" }>;

/** Una pieza sólida con sus detalles: la unidad del orden de pintado. */
export interface Item {
  id: string;
  tone: Tone;
  group?: string;
  hidden?: boolean;
  float?: boolean;
  mount: string[];
  shadow?: boolean;
  solid: Solid;
  details: Detail[];
  box: Box3;
}

const isSolid = (p: Part): p is Solid => p.kind === "box" || p.kind === "cylinder" || p.kind === "prism";

function shift(p: Part, d: Vec3): Part {
  switch (p.kind) {
    case "box":
    case "cylinder":
      return { ...p, at: add(p.at, d) };
    case "prism":
      return { ...p, plan: p.plan.map(([x, y]): Vec2 => [x + d[0], y + d[1]]), z: p.z + d[2] };
    case "ticks":
      return { ...p, from: add(p.from, d) };
    case "label":
      return { ...p, at: add(p.at, d) };
    case "dots":
    case "line":
      return { ...p, points: p.points.map((q) => add(q, d)) };
  }
}

export function expand(parts: Part[]): Part[] {
  const out: Part[] = [];
  for (const p of parts) {
    const n = p.repeat?.count ?? 1;
    for (let i = 0; i < n; i++) {
      const sub = (s: string | undefined) => (s === undefined ? s : s.replaceAll("{i}", String(i)));
      const moved = p.repeat ? shift(p, mul(p.repeat.step, i)) : p;
      const id = p.repeat && !p.id.includes("{i}") ? `${p.id}-${i}` : sub(p.id)!;
      const copy = { ...moved, id, repeat: undefined } as Part;
      if ("on" in copy) copy.on = sub(copy.on)!;
      if (copy.mount) copy.mount = copy.mount.map((m) => sub(m)!);
      if (isSolid(copy)) copy.group = sub(copy.group);
      out.push(copy);
    }
  }
  return out;
}

export function solidBox(p: Solid): Box3 {
  if (p.kind === "box") return { min: [...p.at], max: add(p.at, p.size) };
  if (p.kind === "prism") {
    return boxOf(p.plan.flatMap(([x, y]): Vec3[] => [[x, y, p.z], [x, y, p.z + p.h]]));
  }
  const { r, h, at } = p;
  const axis = p.axis ?? "z";
  const hi: Vec3 = axis === "x" ? [h, r, r] : axis === "y" ? [r, h, r] : [r, r, h];
  const lo: Vec3 = axis === "x" ? [0, -r, -r] : axis === "y" ? [-r, 0, -r] : [-r, -r, 0];
  return { min: add(at, lo), max: add(at, hi) };
}

export function buildItems(parts: Part[]): { items: Item[]; errors: string[] } {
  const errors: string[] = [];
  const all = expand(parts);
  const items: Item[] = [];
  const byId = new Map<string, Item>();
  for (const p of all) {
    if (!isSolid(p)) continue;
    if (byId.has(p.id)) errors.push(`id repetido: ${p.id}`);
    const item: Item = {
      id: p.id,
      tone: p.tone ?? "mid",
      group: p.group,
      hidden: p.hidden,
      float: p.float,
      mount: p.mount ?? [],
      shadow: p.shadow,
      solid: p,
      details: [],
      box: solidBox(p),
    };
    items.push(item);
    byId.set(p.id, item);
  }
  for (const p of all) {
    if (isSolid(p)) continue;
    const host = byId.get(p.on);
    if (!host) errors.push(`«${p.id}» va sobre «${p.on}», que no existe`);
    else host.details.push(p);
  }
  return { items, errors };
}

export function meshOf(p: Solid, c: Camera): Mesh {
  if (p.kind === "box") {
    const [w, d, h] = p.size;
    const r = p.radius ?? 0;
    return prism(roundedRect(w, d, r, cornerSteps(r * c.scale)), frameOf(p.at), h, p.bevel ?? 0);
  }
  if (p.kind === "prism") {
    return prism(p.plan, frameOf([0, 0, p.z]), p.h, p.bevel ?? 0);
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
