import type { Part, TrackSpec, Vec3 } from "../spec.ts";
import type { V } from "../issues.ts";
import { buildFlow, type Hop } from "./flows.ts";
import { ROLES } from "./glyphs/index.ts";
import { TRAY, type Placed } from "./layout.ts";
import { drawLinks, styleOf, type LinkDraw } from "./links.ts";
import { buildLegend } from "./legend.ts";
import { mountOverlaps } from "./parts.ts";
import { build, emit, plateRect, pointsOf, type Camera2 } from "./place.ts";
import { routeAll, type Pt, type Rect, type RouteReq } from "./route.ts";
import type { MapLink, MapSpec, TreeNode } from "./types.ts";

/** Lo que el compilador avisa y el validador no puede saber sin armar el mapa. */
export interface Note {
  code: "map-label-small" | "map-route-blocked";
  path: string;
  vars: V;
}

/** Lados donde se pegan las puntas UML: la herencia entra por el frente del padre y el rombo sale por el frente del todo, que es donde se ven. */
const sidesOf = (l: MapLink): Pick<RouteReq, "fromSides" | "toSides"> => {
  if (l.kind === "inherits" || l.kind === "implements") return { fromSides: ["B", "L", "R"], toSides: ["F"] };
  if (l.kind === "composes" || l.kind === "aggregates") return { fromSides: ["F"] };
  return {};
};

/** Dos enlaces comparten tronco solo si se dibujan igual: una composición no se mezcla con una asociación. */
const styleKey = (l: MapLink): string => {
  const st = styleOf(l);
  return `${st.from}.${st.to}.${st.dashed}.${l.paint ?? ""}`;
};

const rectOf = (p: Placed, hide = 0): Rect => ({ x0: p.ax, y0: p.ay, x1: p.ax + p.fx, y1: p.ay + p.fy, ...(hide ? { hide } : {}) });
const listOf = (v: string | string[]): string[] => (Array.isArray(v) ? v : [v]);
const inside = (a: Placed, b: Placed): boolean => {
  for (let p: Placed | undefined = a; p; p = p.parent) if (p === b) return true;
  return false;
};

interface Pair {
  link: MapLink;
  a: Placed;
  b: Placed;
  /** Solo el primer par de un enlace con varios extremos lleva el rótulo y la multiplicidad. */
  first: boolean;
}

/** Los pares de nodos que une cada enlace, más los que un flujo necesita y ningún enlace trae. */
function pairsOf(map: MapSpec, byId: Map<string, Placed>): Pair[] {
  const out: Pair[] = [];
  for (const l of map.links ?? []) {
    let first = true;
    for (const f of listOf(l.from)) {
      for (const t of listOf(l.to)) {
        const [a, b] = [byId.get(f), byId.get(t)];
        if (!a || !b || inside(a, b) || inside(b, a)) continue;
        out.push({ link: l, a, b, first });
        first = false;
      }
    }
  }
  for (const flow of map.flows ?? []) {
    for (let i = 1; i < flow.path.length; i++) {
      const [a, b] = [byId.get(flow.path[i - 1]), byId.get(flow.path[i])];
      if (!a || !b || a === b || inside(a, b) || inside(b, a)) continue;
      if (!out.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))) out.push({ link: { from: a.id, to: b.id }, a, b, first: false });
    }
  }
  return out;
}

export interface World {
  root: TreeNode;
  tracks: TrackSpec[];
  /** Lo que la cámara tiene que encuadrar. */
  points: Vec3[];
  notes: Note[];
}

/** El mapa armado con letra de tamaño `s`: los nodos, las cintas con sus puntas y rótulos, los paquetes y la leyenda. */
export function buildWorld(map: MapSpec, s: number, camera: Camera2): World {
  const az = camera.azimuth;
  const built = build(map, s, camera);
  const { top, all, byId } = built;
  const notes: Note[] = [];
  const pairs = pairsOf(map, byId);
  const trays = all.filter((p) => !p.leaf);
  const plates = trays.map((p) => plateRect(p, s));
  const reach0 = Math.cos((az * Math.PI) / 180) / Math.tan((camera.elevation * Math.PI) / 180);
  const hideOf = (p: Placed) => (p.leaf ? p.leaf.h * reach0 : 0);
  const reqs: RouteReq[] = pairs.map((p) => ({ from: rectOf(p.a, hideOf(p.a)), to: rectOf(p.b, hideOf(p.b)), fromBlocks: Boolean(p.a.leaf), toBlocks: Boolean(p.b.leaf), src: `${p.a.id}|${styleKey(p.link)}`, dst: `${p.b.id}|${styleKey(p.link)}`, ...sidesOf(p.link) }));
  const routes = routeAll(reqs, { visible: az <= 0 ? ["F", "L"] : ["F", "R"], blocks: plates });
  /** A qué altura corre una cinta: sobre la bandeja más alta que cruza. */
  const zOf = (pts: Pt[]): number => {
    let z = 0;
    for (let i = 0; i < pts.length; i++) {
      const [a, b] = [pts[Math.max(0, i - 1)], pts[i]];
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
      for (let k = 0; k <= steps; k++) {
        const x = a[0] + ((b[0] - a[0]) * k) / steps;
        const y = a[1] + ((b[1] - a[1]) * k) / steps;
        for (const t of trays) if (x >= t.ax - 0.01 && x <= t.ax + t.fx + 0.01 && y >= t.ay - 0.01 && y <= t.ay + t.fy + 0.01) z = Math.max(z, (t.level + 1) * TRAY);
      }
    }
    return z;
  };
  const draws: LinkDraw[] = pairs.map((p, i) => {
    const pts = routes[i].pts;
    if (routes[i].blocked) notes.push({ code: "map-route-blocked", path: `map.links`, vars: { a: p.a.id, b: p.b.id } });
    return {
      index: i,
      style: styleOf(p.link),
      label: p.first ? p.link.label : undefined,
      paint: p.link.paint,
      mult: p.first ? p.link.mult : undefined,
      pts,
      z: zOf(pts),
    };
  });
  const reach = 1 / Math.tan((camera.elevation * Math.PI) / 180);
  const side = Math.sin((-az * Math.PI) / 180);
  const along = Math.cos((az * Math.PI) / 180);
  // Lo que un objeto alto tapa detrás de él: el rótulo de un enlace no debe caer ahí.
  const shadowOf = (p: Placed): Rect => {
    const l = p.leaf!.h * reach;
    return { x0: p.ax - 5 - l * along, x1: p.ax + p.fx + 5, y0: p.ay - 5 + Math.min(0, l * side), y1: p.ay + p.fy + 5 + Math.max(0, l * side) };
  };
  const leafRects = all.filter((p) => p.leaf).map((p): Rect => ({ x0: p.ax - 3, y0: p.ay - 3, x1: p.ax + p.fx + 3, y1: p.ay + p.fy + 3 }));
  const parts = mountOverlaps(drawLinks(draws, s, [...leafRects, ...plates.map((r): Rect => ({ x0: r.x0 - 12, x1: r.x1 + 3, y0: r.y0 - 3, y1: r.y1 + 3 }))], all.filter((p) => p.leaf).map(shadowOf)));
  const flowParts: Part[] = [];
  const tracks: TrackSpec[] = [];
  (map.flows ?? []).forEach((flow, fi) => {
    const hops: Hop[] = [];
    for (let i = 1; i < flow.path.length; i++) {
      const [a, b] = [byId.get(flow.path[i - 1]), byId.get(flow.path[i])];
      const k = pairs.findIndex((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
      if (!a || !b || k < 0) continue;
      hops.push({ pts: pairs[k].a === a ? routes[k].pts : [...routes[k].pts].reverse(), z: draws[k].z });
    }
    const out = buildFlow(flow, fi, hops);
    flowParts.push(...out.parts);
    tracks.push(...out.tracks);
  });
  const leaves = all.filter((p) => p.leaf);
  const used = new Set(leaves.map((p) => String(p.leaf!.role)));
  const kinds = [...new Set((map.links ?? []).map((l) => l.kind ?? "link"))];
  const flows = (map.flows ?? []).map((f) => ({ label: f.label, paint: f.paint }));
  const showLegend = map.legend !== false && (used.size > 1 || flows.length > 0 || kinds.some((k) => k !== "link"));
  const minY = Math.min(...top.kids.map((p) => p.ay));
  const maxY = Math.max(...top.kids.map((p) => p.ay + p.fy));
  const maxX = Math.max(...top.kids.map((p) => p.ax + p.fx));
  const legend = showLegend
    ? buildLegend({
        roles: ROLES.filter((r) => used.has(r)),
        uml: leaves.some((p) => p.node.is === "class" || p.node.is === "interface"),
        flows,
        kinds,
        at: [maxX + 26, minY],
        width: Math.min(Math.max(160, maxY - minY), 360),
        s,
      })
    : undefined;
  const root: TreeNode = {
    id: "map",
    children: [
      ...top.kids.map((p) => emit(p, s)),
      ...(parts.length ? [{ id: "_links", parts }] : []),
      ...(flowParts.length ? [{ id: "_flows", parts: mountOverlaps(flowParts) }] : []),
      ...(legend ? [legend.node] : []),
    ],
  };
  const extra: Vec3[] = routes.flatMap((r, i) => r.pts.map((p): Vec3 => [p[0], p[1], draws[i].z + 18]));
  if (legend) {
    for (const x of [maxX + 26, maxX + 26 + legend.fx]) for (const y of [minY, minY + legend.fy]) for (const z of [0, 16]) extra.push([x, y, z]);
  }
  return { root, tracks, points: pointsOf(built, extra), notes };
}

