import { fitCamera, project, screenBasis, type Camera, type CameraOptions } from "./camera.ts";
import { add, dot, type Vec3 } from "./math.ts";
import { buildItems, linesOf, meshOf, type Item } from "./items.ts";
import { paintOrder } from "./order.ts";
import { drawMesh, SHADES } from "./shade.ts";
import { dotsOf, escapeHtml as esc, pathOf } from "./serialize.ts";
import { textOf, type FigureSpec, type LabelPart } from "./spec.ts";

const TONES = ["lo", "mid", "hi", "lit"];

const PLANES = { xy: [[1, 0, 0], [0, 1, 0]], xz: [[1, 0, 0], [0, 0, 1]], yz: [[0, 1, 0], [0, 0, 1]] } as const;

const FACES: Record<NonNullable<LabelPart["face"]>, [Vec3, Vec3]> = {
  top: [[0, 1, 0], [1, 0, 0]],
  x: [[0, 1, 0], [0, 0, -1]],
  y: [[-1, 0, 0], [0, 0, -1]],
};

/** El texto se escribe en coordenadas de la cara: la matriz lleva su eje de lectura y su «abajo» a pantalla. */
function labelSvg(c: Camera, l: LabelPart, lang: string, cls = `class="tx"`): string {
  const [along, down] = FACES[l.face ?? "top"];
  const k = c.scale;
  const [e, f] = project(c, l.at);
  const m = [k * dot(c.right, along), k * dot(c.down, along), k * dot(c.right, down), k * dot(c.down, down), e, f];
  return `<text ${cls} font-size="${l.size ?? 6}"${l.align && l.align !== "start" ? ` text-anchor="${l.align}"` : ""} transform="matrix(${m.map((v) => Math.round(v * 1000) / 1000).join(" ")})">${esc(textOf(l.text, lang))}</text>`;
}

/** Dentro de <defs> los selectores no alcanzan las copias de un <use>: los trazos llevan su estilo en línea. */
const INLINE: Record<string, string> = {
  t: "fill:var(--ft);stroke:var(--ft);stroke-width:.35",
  b: "fill:var(--fb);stroke:var(--fb);stroke-width:.35",
  s0: "fill:var(--f0);stroke:var(--f0);stroke-width:.35",
  s1: "fill:var(--f1);stroke:var(--f1);stroke-width:.35",
  s2: "fill:var(--f2);stroke:var(--f2);stroke-width:.35",
  s3: "fill:var(--f3);stroke:var(--f3);stroke-width:.35",
  e: "fill:none;stroke:var(--fe);stroke-width:.7",
  l: "fill:none;stroke:var(--fe);stroke-width:.45;opacity:.7",
  lb: "fill:none;stroke:var(--fe);stroke-width:.6",
  d: "fill:none;stroke:var(--fe);stroke-width:1.3",
  tx: "fill:var(--fx);font-family:var(--isofig-mono);font-weight:600",
};

function itemBody(c: Camera, item: Item, lang: string, inline = false): string {
  const cls = (k: string) => (inline ? `style="${INLINE[k]}"` : `class="${k}"`);
  const drawn = drawMesh(c, meshOf(item.solid, c));
  const lines = linesOf(item.details);
  const proj = (pts: Vec3[]) => pts.map((p) => project(c, p));
  let body = "";
  for (const s of SHADES) {
    const polys = drawn.faces.get(s);
    if (polys) body += `<path ${cls(s)} d="${pathOf(polys, true)}"/>`;
  }
  if (drawn.edges.length) body += `<path ${cls("e")} d="${pathOf(drawn.edges, false)}"/>`;
  if (lines.fine.length) body += `<path ${cls("l")} d="${pathOf(lines.fine.map(proj), false)}"/>`;
  if (lines.bold.length) body += `<path ${cls("lb")} d="${pathOf(lines.bold.map(proj), false)}"/>`;
  if (lines.dots.length) body += `<path ${cls("d")} d="${dotsOf(proj(lines.dots))}"/>`;
  for (const d of item.details) if (d.kind === "label") body += labelSvg(c, d, lang, cls("tx"));
  return body;
}

const r2 = (v: number) => Math.round(v * 2) / 2;

/**
 * Las piezas idénticas (un depósito de fichas, una fila de carritos) se dibujan una vez en <defs> y se repiten con
 * <use>: cada una se calcula relativa a su propia esquina, así dos piezas iguales dan el mismo texto.
 */
function artOf(id: string, c: Camera, items: Item[], order: number[], lang: string): { defs: string; art: string } {
  const placed = order.map((k) => {
    const item = items[k];
    const [ax, ay] = project(c, item.box.min);
    const tone = TONES.includes(item.tone) ? item.tone : "mid";
    const local = { ...c, ox: c.ox - ax, oy: c.oy - ay };
    return { item, ax: r2(ax), ay: r2(ay), tone, key: itemBody(local, item, lang, true), local };
  });
  const count = new Map<string, number>();
  for (const p of placed) count.set(p.key, (count.get(p.key) ?? 0) + 1);
  const ids = new Map<string, string>();
  let defs = "";
  let art = "";
  for (const p of placed) {
    const g = p.item.group ? ` data-g="${esc(p.item.group)}"` : "";
    const hidden = p.item.hidden ? ` opacity="0"` : "";
    if ((count.get(p.key) ?? 0) < 2 || p.key.length < 200) {
      art += `<g class="${p.tone}"${g}${hidden}>${itemBody(c, p.item, lang)}</g>`;
      continue;
    }
    let ref = ids.get(p.key);
    if (!ref) {
      ref = `${esc(id)}-p${ids.size}`;
      ids.set(p.key, ref);
      defs += `<g id="${ref}">${p.key}</g>`;
    }
    art += `<use href="#${ref}" x="${p.ax}" y="${p.ay}" class="${p.tone}"${g}${hidden}/>`;
  }
  return { defs: defs ? `<defs>${defs}</defs>` : "", art };
}

function shadowSvg(c: Camera, items: Item[]): string {
  const polys = items
    .filter((i) => i.shadow)
    .map(({ box: { min, max } }) => {
      const pad = 3;
      const z = min[2];
      const ring: Vec3[] = [
        [min[0] - pad, min[1] - pad, z],
        [max[0] + pad, min[1] - pad, z],
        [max[0] + pad, max[1] + pad, z],
        [min[0] - pad, max[1] + pad, z],
      ];
      return ring.map((p) => project(c, p));
    });
  return polys.length ? `<path class="h" d="${pathOf(polys, true)}"/>` : "";
}

function fitPoints(spec: FigureSpec, items: Item[]): Vec3[] {
  const pts: Vec3[] = [];
  for (const it of items) {
    const { min, max } = it.box;
    const corners: Vec3[] = [min, max, [min[0], max[1], min[2]], [max[0], min[1], max[2]], [min[0], min[1], max[2]], [max[0], max[1], min[2]]];
    pts.push(...corners);
    const extent = it.group ? spec.groups?.[it.group]?.extent : undefined;
    for (const d of extent ?? []) pts.push(...corners.map((p) => add(p, d)));
  }
  return pts;
}


export interface View extends CameraOptions {
  /** Escala fija: al girar, la figura no cambia de tamaño. */
  scale?: number;
}

export interface Scene {
  cam: Camera;
  /** defs, halo y piezas, ya en orden de pintado: el contenido de `<g class="isofig-scene">`. */
  markup: string;
  basis: number[];
  spins: Record<string, number[]>;
  items: Item[];
  cycles: string[];
  errors: string[];
}

/** Dibuja la escena de una spec desde una cámara. No depende de Node: el modo órbita la llama en el navegador. */
export function drawScene(spec: FigureSpec, lang: string, view: View = {}): Scene {
  const W = spec.width ?? 640;
  const H = spec.height ?? 400;
  const { items, errors } = buildItems(spec.parts);
  const options = { ...spec.camera, ...(view.azimuth !== undefined ? { azimuth: view.azimuth } : {}), ...(view.elevation !== undefined ? { elevation: view.elevation } : {}) };
  const cam = fitCamera(options, fitPoints(spec, items), W, H, spec.pad ?? 24, view.scale);
  const { order, cycles } = paintOrder(cam, items.map((i) => i.box), items.map((i) => i.id));
  const { defs, art } = artOf(spec.id, cam, items, order, lang);
  const spins: Record<string, number[]> = {};
  for (const [g, def] of Object.entries(spec.groups ?? {})) {
    if (!def.spin) continue;
    const [u, v] = PLANES[def.spin.plane] as unknown as [Vec3, Vec3];
    const k = cam.scale;
    const [cx, cy] = project(cam, def.spin.center);
    spins[g] = [k * dot(cam.right, u), k * dot(cam.down, u), k * dot(cam.right, v), k * dot(cam.down, v), cx, cy];
  }
  return {
    cam,
    markup: defs + shadowSvg(cam, items) + art,
    basis: screenBasis(cam).map((v) => Math.round(v * 1e4) / 1e4),
    spins,
    items,
    cycles,
    errors,
  };
}
