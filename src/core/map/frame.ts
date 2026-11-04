import type { Part, Text } from "../spec.ts";
import { CATALOG, PULL_OUT, type Cabinet, type Role } from "./glyphs/index.ts";
import { box, label, shiftPart, withRole } from "./parts.ts";
import { widthOf } from "./text.ts";
import type { MapNode, TreeNode } from "./types.ts";

/** Un objeto con su zócalo y su placa, listo para colocarse: su tamaño en el piso y las piezas en su propio marco. */
export interface Leaf {
  fx: number;
  fy: number;
  /** Alto total, para encuadrar la cámara. */
  h: number;
  role: Role | string;
  parts: Part[];
  /** Cajones que se abren con «Desarmar»; vacío si el objeto no tiene o no se desarma. */
  children: TreeNode[];
}

const SLAB = 3;
const PLATE_D = 8;
const GAP = 4;

/** Alto de la placa de un rótulo grabado con `s`: la letra más márgenes, redondeado hacia arriba. */
export const plateHeight = (s: number): number => Math.ceil(2.4 + s * 0.72 + 2.2);

/**
 * Arma un nodo hoja: el objeto del catálogo sobre su zócalo, con la placa al frente donde va grabado el nombre. Los
 * objetos que traen su propio rótulo (las clases y las interfaces) van sin zócalo ni placa.
 */
export function buildLeaf(node: MapNode, name: Text, s: number, az: number): Leaf {
  const def = CATALOG[node.is as keyof typeof CATALOG];
  const role = node.paint ?? def.role;
  const g = def.make({ node, s, az, name });
  const children: TreeNode[] = [];
  const cabinet = g as Cabinet;
  let parts = withRole(g.parts, role);
  let dx = 0;
  let dy = 0;
  let dz = 0;
  let fx = g.d;
  let fy = g.w;
  const out: Part[] = [];
  if (g.plate !== false) {
    fy = Math.max(g.w + 8, Math.ceil(widthOf(name, s) + 12));
    fx = g.d + GAP + PLATE_D;
    dy = (fy - g.w) / 2;
    dz = SLAB;
    const hp = plateHeight(s);
    out.push(
      box("pedestal", [0, 0, 0], [g.d + GAP, fy, SLAB], { tone: "mid", radius: 2.5, bevel: 0.7, ground: true }),
      box("nameplate", [g.d + GAP, 0, 0], [PLATE_D, fy, hp], { tone: "hi", radius: 1.4, bevel: 0.6 }),
      label("name", "nameplate", [fx, fy / 2, 2.4], name, s, { align: "middle" }),
    );
  }
  const place = (p: Part) => shiftPart(p, [dx, dy, dz]);
  out.push(...parts.map(place));
  if (node.explode && cabinet.drawers?.length) {
    for (const d of cabinet.drawers) {
      children.push({ id: d.id, name: d.name, note: d.note, stage: d.stage, explode: PULL_OUT, parts: withRole(d.parts, role).map(place) });
    }
  } else if (cabinet.drawers?.length) {
    for (const d of cabinet.drawers) out.push(...withRole(d.parts, role).map(place));
  }
  return { fx, fy, h: g.h + dz, role, parts: out, children };
}
