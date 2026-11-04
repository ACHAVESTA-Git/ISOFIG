import type { Part, Text, Vec3 } from "../../spec.ts";
import { box, label, ROLE } from "../parts.ts";
import { surround, widthOf } from "../text.ts";
import type { MapNode } from "../types.ts";
import type { Glyph, GlyphArgs, GlyphFn } from "./kit.ts";

/** Un cajón del archivador que se abre con «Desarmar»: su propio nodo, con su nombre y su nota. */
export interface Drawer {
  id: string;
  name: Text;
  note: Text;
  parts: Part[];
  stage: number;
}

export interface Cabinet extends Glyph {
  drawers: Drawer[];
}

const DEPTH = 26;
const PULL = 15;

interface Line {
  text: Text;
  size: number;
}

/** Los cajones de una clase o interfaz: el del nombre (con su estereotipo) y, si traen algo, el de atributos y el de métodos. */
function cabinet(a: GlyphArgs, o: { stereotype?: Text; members: boolean; fields: boolean; plug: boolean }): Cabinet {
  const { node, s } = a;
  const sm = s * 0.92;
  const lp = (size: number) => size * 1.32;
  const titles: Line[] = [...(o.stereotype !== undefined ? [{ text: o.stereotype, size: sm }] : []), { text: a.name, size: s }];
  const fields: Line[] = o.fields ? (node.fields ?? []).map((t) => ({ text: t, size: sm })) : [];
  const methods: Line[] = o.members ? (node.methods ?? []).map((t) => ({ text: t, size: sm })) : [];
  const groups: { id: string; lines: Line[] }[] = [{ id: "name", lines: titles }];
  if (fields.length) groups.push({ id: "fields", lines: fields });
  if (methods.length) groups.push({ id: "methods", lines: methods });

  const textW = Math.max(...groups.flatMap((g) => g.lines.map((l) => widthOf(l.text, l.size))));
  const W = Math.max(70, Math.ceil(textW + 12 + PULL));
  const base = 2.5;
  const heights = groups.map((g) => 3 + g.lines.reduce((sum, l) => sum + lp(l.size), 0));
  const inner = heights.reduce((x, y) => x + y, 0);
  const top = base + inner;
  const parts: Part[] = [
    box("plinth", [0, 0, 0], [DEPTH, W, base], { tone: "lo", radius: 2, bevel: 0.6 }),
    box("back", [0, 0, base], [2, W, inner], { paint: ROLE, bevel: 0.5 }),
    box("side-l", [2, 0, base], [DEPTH - 2, 2, inner], { paint: ROLE, bevel: 0.5 }),
    box("side-r", [2, W - 2, base], [DEPTH - 2, 2, inner], { paint: ROLE, bevel: 0.5 }),
    box("lid", [0, 0, top], [DEPTH, W, 2.5], { paint: ROLE, radius: 1.2, bevel: 0.8 }),
  ];
  const drawers: Drawer[] = [];
  const front = DEPTH + 0.8;
  let z = top;
  groups.forEach((g, i) => {
    const h = heights[i];
    z -= h;
    const out: Part[] = [];
    out.push(box(`${g.id}-front`, [2, 2, z + 0.25], [front - 2, W - 4, h - 0.5], { tone: "hi", radius: 0.8, bevel: 0.3 }));
    let cursor = z + h - 1.5;
    g.lines.forEach((l, k) => {
      const cell = lp(l.size);
      const cap = l.size * 0.72;
      out.push(label(`${g.id}-t${k}`, `${g.id}-front`, [front, 5, cursor - (cell - cap) / 2 - cap], l.text, l.size));
      cursor -= cell;
    });
    out.push(box(`${g.id}-pull`, [front, W - PULL + 2, z + h / 2 - 1.1], [1.3, PULL - 8, 2.2], { tone: "mid", radius: 0.8 }));
    if (g.id === "name") parts.push(...out);
    else drawers.push({
      id: g.id,
      stage: g.id === "fields" ? 1 : 2,
      name: g.id === "fields" ? { es: "atributos", en: "fields" } : { es: "métodos", en: "methods" },
      note: g.id === "fields" ? { es: "Lo que guarda cada objeto de la clase.", en: "What each object of the class keeps." } : { es: "Lo que sabe hacer.", en: "What it can do." },
      parts: out,
    });
  });
  if (o.plug) {
    parts.push(
      box("plug", [DEPTH / 2 - 4, W / 2 - 6, top + 2.5], [8, 12, 4], { tone: "hi", radius: 1, bevel: 0.4 }),
      box("prong-0", [DEPTH / 2 - 1, W / 2 - 3.6, top + 6.5], [2, 2, 5], { tone: "mid" }),
      box("prong-1", [DEPTH / 2 - 1, W / 2 + 1.6, top + 6.5], [2, 2, 5], { tone: "mid" }),
    );
  }
  return { d: DEPTH + 1, w: W, h: top + 2.5 + (o.plug ? 11.5 : 0), parts, drawers, plate: false };
}

const abstractTag = (n: MapNode): Text | undefined => (n.stereotype !== undefined ? surround(n.stereotype, "«", "»") : n.abstract ? "«abstract»" : undefined);

/** Una clase: un archivador con cajón de nombre, de atributos y de métodos. */
export const classCabinet: GlyphFn = (a) => cabinet(a, { stereotype: abstractTag(a.node), members: true, fields: true, plug: false });

/** Una interfaz: el archivador sin atributos, con el enchufe encima que dice «aquí se conecta algo». */
export const interfaceCabinet: GlyphFn = (a) => cabinet(a, { stereotype: a.node.stereotype !== undefined ? surround(a.node.stereotype, "«", "»") : "«interface»", members: true, fields: false, plug: true });

/** Cuánto sale cada cajón al desarmar, hacia el lector. */
export const PULL_OUT: Vec3 = [14, 0, 0];
