import type { Part, Text } from "../spec.ts";
import { PAINT } from "../palette/sets.ts";
import { plateHeight } from "./frame.ts";
import { HEAD, RT, RW, headPlan, styleOf } from "./links.ts";
import { box, label, prism } from "./parts.ts";
import { widthOf } from "./text.ts";
import type { LinkKind, TreeNode } from "./types.ts";

/** En un diagrama de clases los colores son otra cosa: clase e interfaz. */
const UML_LABELS: Record<string, Text> = { compute: { es: "clase", en: "class" }, edge: { es: "interfaz", en: "interface" } };

const LINK_LABELS: Record<Exclude<LinkKind, "link">, Text> = {
  inherits: { es: "herencia", en: "inheritance" },
  implements: { es: "realización", en: "implements" },
  composes: { es: "composición", en: "composition" },
  aggregates: { es: "agregación", en: "aggregation" },
  depends: { es: "dependencia", en: "dependency" },
  associates: { es: "asociación", en: "association" },
};

export interface LegendInput {
  roles: string[];
  uml: boolean;
  flows: { label: Text; paint?: string }[];
  kinds: LinkKind[];
  /** Esquina donde empieza la leyenda y ancho que puede ocupar. */
  at: [number, number];
  width: number;
  s: number;
}

interface Entry {
  mark: "swatch" | "packet" | "link";
  paint?: string;
  kind?: LinkKind;
  text: Text;
}

const SWATCH = 9;

/** Una leyenda de pie al frente del mapa: cada color con su nombre y cada tipo de enlace con su punta de muestra. */
export function buildLegend(input: LegendInput): { node: TreeNode; fx: number; fy: number } | undefined {
  const { s } = input;
  const entries: Entry[] = [
    ...input.roles.map((r): Entry => ({ mark: "swatch", paint: r, text: (input.uml ? UML_LABELS[r] : undefined) ?? PAINT.get(r)?.label ?? r })),
    ...input.flows.map((f): Entry => ({ mark: "packet", paint: f.paint, text: f.label })),
    ...input.kinds.filter((k): k is Exclude<LinkKind, "link"> => k !== "link").map((k): Entry => ({ mark: "link", kind: k, text: LINK_LABELS[k] })),
  ];
  if (!entries.length) return undefined;
  const hp = plateHeight(s);
  const markW = 22;
  const width = (e: Entry) => (e.mark === "link" ? markW : SWATCH) + 4 + Math.ceil(widthOf(e.text, s)) + 10;
  const rows: Entry[][] = [[]];
  let used = 0;
  for (const e of entries) {
    const w = width(e) + 8;
    if (used + w > input.width && rows[rows.length - 1].length) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push(e);
    used += w;
  }
  const pitch = hp + 13;
  const fx = rows.length * pitch;
  const fy = Math.max(...rows.map((r) => r.reduce((a, e) => a + width(e) + 6, 0)));
  const parts: Part[] = [];
  rows.forEach((row, r) => {
    let y = 0;
    const x = r * pitch;
    row.forEach((e, k) => {
      const id = `e${r}-${k}`;
      // Cada entrada es una losa pequeña con su muestra y su placa; juntas forman la tira de la leyenda.
      parts.push(box(`${id}-base`, [x, y, 0], [pitch - 4, width(e) + 6, 2.5], { tone: "mid", radius: 3, bevel: 0.5, ground: true }));
      const ox = x + 3;
      let oy = y + 4;
      let after = SWATCH;
      if (e.mark === "link") {
        const style = styleOf({ from: "a", to: "b", kind: e.kind });
        const head = style.to !== "none" ? style.to : style.from === "none" ? undefined : style.from;
        const len = HEAD[head ?? "arrow"].len;
        const toEnd = style.to !== "none";
        const tip: [number, number] = toEnd ? [ox + 3.5, oy + markW] : [ox + 3.5, oy];
        const dir: [number, number] = toEnd ? [0, 1] : [0, -1];
        const [a, b] = toEnd ? [oy, oy + markW - len] : [oy + len, oy + markW];
        const ribbon = { tone: "mid" as const, radius: 0.8, bevel: 0.25 };
        if (style.dashed) {
          for (const [p, q] of [[a, a + 4], [a + 7, Math.min(b, a + 11)]]) if (q > p) parts.push(box(`${id}-d${p}`, [ox + 3.5 - RW / 2, p, 2.5], [RW, q - p, RT], ribbon));
        } else parts.push(box(`${id}-r`, [ox + 3.5 - RW / 2, a, 2.5], [RW, b - a, RT], ribbon));
        if (head) parts.push(prism(`${id}-h`, headPlan(head, tip, dir), 2.5, RT + 0.6, head === "diamond-filled" ? { tone: "lit", bevel: 0.3 } : head === "arrow" ? { tone: "lo", bevel: 0.3 } : { tone: "hi", bevel: 0.3 }));
        after = markW;
      } else {
        const paint = e.mark === "packet" ? (e.paint ? { tone: "hi", paint: e.paint } : { tone: "lit" }) : { tone: "hi", paint: e.paint };
        parts.push(box(`${id}-s`, [ox, oy, 2.5], [7, SWATCH, 7], { radius: 1.4, bevel: 0.5, ...paint } as never));
      }
      const w = Math.ceil(widthOf(e.text, s)) + 10;
      oy += after + 4;
      parts.push(
        box(`${id}-p`, [ox, oy, 2.5], [7, w, hp], { tone: "hi", radius: 1, bevel: 0.4 }),
        label(`${id}-t`, `${id}-p`, [ox + 7, oy + w / 2, 2.5 + 2.4], e.text, s, { align: "middle" }),
      );
      y += width(e) + 6;
    });
  });
  return { node: { id: "_legend", at: [input.at[0], input.at[1], 0], parts }, fx, fy };
}
