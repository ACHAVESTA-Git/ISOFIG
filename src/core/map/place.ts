import type { Part, Vec3 } from "../spec.ts";
import { buildLeaf, plateHeight } from "./frame.ts";
import { isGlyph } from "./glyphs/index.ts";
import { absolute, arrange, edgesOf, PAD, TRAY, walk, type Placed } from "./layout.ts";
import { box, label } from "./parts.ts";
import type { Rect } from "./route.ts";
import { mapText, widthOf } from "./text.ts";
import type { MapLayout, MapNode, MapSpec, TreeNode } from "./types.ts";

export interface Camera2 {
  azimuth: number;
  elevation: number;
}

/** Todos los nodos medidos y colocados con letra de tamaño `s`. */
export interface Built {
  top: Placed;
  all: Placed[];
  byId: Map<string, Placed>;
}

const containerKind = (n: MapNode): string => (n.is && n.is !== "package" ? n.is.toUpperCase() : "");
const TAB = 10;

/** Lo que va grabado en la placa de una bandeja: su clase en mayúsculas y su nombre. */
export function trayLabel(n: MapNode) {
  const kind = containerKind(n);
  return mapText([n.name], (get) => `${kind ? `${kind} ` : ""}${get(n.name ?? n.id) || n.id}`);
}

/** Lo ancho que tiene que ser una bandeja para que quepa su placa. */
const plateWidth = (n: MapNode, s: number): number => widthOf(trayLabel(n), s) + 12;

/** La huella de la placa de una bandeja (un estorbo para las cintas), en el mundo. */
export const plateRect = (p: Placed, s: number): Rect => ({ x0: p.ax + p.fx - 24, y0: p.ay + PAD.side, x1: p.ax + p.fx - 16, y1: p.ay + PAD.side + plateWidth(p.node, s) });

/** Qué tan alto queda el piso de un nodo: 1,6 por cada bandeja que lo contiene. */
export const floorOf = (p: Placed): number => p.level * TRAY;

/** Mide y reparte todos los nodos. De adentro hacia afuera: un contenedor mide lo que miden sus hijos, más su margen. */
export function build(map: MapSpec, s: number, camera: Camera2): Built {
  const shade = Math.cos((camera.azimuth * Math.PI) / 180) / Math.tan((camera.elevation * Math.PI) / 180);
  const byId = new Map<string, Placed>();
  const make = (node: MapNode, parent: Placed, level: number): Placed => {
    const p: Placed = { node, id: node.id, parent, kids: [], fx: 0, fy: 0, rx: 0, ry: 0, ax: 0, ay: 0, level };
    if (!byId.has(node.id)) byId.set(node.id, p);
    if (node.children?.length) p.kids = node.children.map((c) => make(c, p, level + 1));
    else {
      p.leaf = buildLeaf(isGlyph(node.is) ? node : { ...node, is: "service" }, node.name ?? node.id, s, camera.azimuth);
      p.fx = p.leaf.fx;
      p.fy = p.leaf.fy;
    }
    return p;
  };
  const top: Placed = { node: { id: "map" }, id: "map", kids: [], fx: 0, fy: 0, rx: 0, ry: 0, ax: 0, ay: 0, level: -1 };
  top.kids = map.nodes.map((n) => make(n, top, 0));
  const layoutOf = (p: Placed): MapLayout => p.node.layout ?? map.layout ?? "flow";
  const size = (p: Placed): void => {
    p.kids.forEach(size);
    if (!p.kids.length) return;
    const inner = arrange(p.kids, layoutOf(p), edgesOf(p, map.links ?? [], byId), shade);
    if (p === top) return void Object.assign(p, { fx: inner.fx, fy: inner.fy });
    const tab = p.node.is === "package" ? TAB : 0;
    for (const k of p.kids) {
      k.rx += PAD.back + tab;
      k.ry += PAD.side;
    }
    p.fx = inner.fx + PAD.back + tab + PAD.front;
    p.fy = Math.max(inner.fy + 2 * PAD.side, plateWidth(p.node, s) + 2 * PAD.side);
    const spare = p.fy - (inner.fy + 2 * PAD.side);
    if (spare > 0) for (const k of p.kids) k.ry += spare / 2;
  };
  size(top);
  absolute(top);
  const all: Placed[] = [];
  walk(top, (q) => q !== top && all.push(q));
  return { top, all, byId };
}

/** El nodo del árbol de un `Placed`: una bandeja con su placa y sus hijos, o un objeto con su zócalo. */
export function emit(p: Placed, s: number): TreeNode {
  const at: Vec3 = [p.rx, p.ry, p.parent && p.parent.level >= 0 ? TRAY : 0];
  if (p.leaf) return { id: p.id, at, parts: p.leaf.parts, ...(p.leaf.children.length ? { children: p.leaf.children } : {}) };
  const tab = p.node.is === "package" ? TAB : 0;
  const tone = (["lo", "mid", "hi"] as const)[Math.min(p.level, 2)];
  const w = plateWidth(p.node, s);
  const parts: Part[] = [
    box("tray", [tab, 0, 0], [p.fx - tab, p.fy, TRAY], { tone, radius: 9, bevel: 0.6, ground: true, ...(p.level === 0 ? { shadow: true } : {}) }),
    box("nameplate", [p.fx - 24, PAD.side, TRAY], [8, w, plateHeight(s)], { tone: "hi", radius: 1.4, bevel: 0.6 }),
    label("name", "nameplate", [p.fx - 16, PAD.side + w / 2, TRAY + 2.4], trayLabel(p.node), s, { align: "middle" }),
  ];
  if (tab) parts.push(box("tab", [0, 8, 0], [tab, 36, TRAY], { tone, radius: 4, bevel: 0.6, ground: true }));
  return { id: p.id, at, parts, children: p.kids.map((k) => emit(k, s)) };
}

/** Las esquinas de cada nodo, abajo y arriba, más lo que se sume: lo que la cámara tiene que encuadrar. */
export function pointsOf(b: Built, extra: Vec3[]): Vec3[] {
  const pts: Vec3[] = [...extra];
  for (const p of b.all) {
    const top = p.leaf ? floorOf(p) + p.leaf.h : floorOf(p) + TRAY + 12;
    for (const x of [p.ax, p.ax + p.fx]) for (const y of [p.ay, p.ay + p.fy]) pts.push([x, y, floorOf(p)], [x, y, top]);
  }
  return pts;
}
