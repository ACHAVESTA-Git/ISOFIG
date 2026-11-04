import { depthOf, facesViewer, fitCamera, makeCamera, project, screenBasis, type Camera, type CameraOptions } from "./camera.ts";
import { add, centerOf, cross, dot, mul, sub, type Box3, type Vec3 } from "./math.ts";
import { buildItems, endsOf, isRound, linesOf, meshOf, type Detail, type Item } from "./items.ts";
import { axisOf, type Mesh } from "./mesh.ts";
import { hullOf, paintOrder, shapesApart, type Ordered, type Prior, type Shape } from "./order.ts";
import { drawMesh, drawRound, SHADES, stadium } from "./shade.ts";
import { customPaints, paintAttr } from "./palette/paint.ts";
import { dotsOf, escapeHtml as esc, pathOf } from "./serialize.ts";
import { textOf, type FigureSpec, type FlatSpec, type LabelPart } from "./spec.ts";

const TONES = ["lo", "mid", "hi", "lit"];

const PLANES = { xy: [[1, 0, 0], [0, 1, 0]], xz: [[1, 0, 0], [0, 0, 1]], yz: [[0, 1, 0], [0, 0, 1]] } as const;

export const FACES: Record<NonNullable<LabelPart["face"]>, [Vec3, Vec3]> = {
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

/**
 * Lo grabado en una cara que ya no mira al lector no se ve a través de la pieza ni sale en espejo. Un punto está en la
 * cara de la malla que lo contiene (a menos de medio punto de su plano); si no cae en ninguna, o la pieza es redonda, se dibuja.
 */
function engraved(c: Camera, mesh: Mesh | undefined, details: Detail[]): Detail[] {
  const front = (p: Vec3): boolean => {
    let back = false;
    for (const f of mesh?.faces ?? []) {
      if (Math.abs(dot(f.n, sub(p, mesh!.v[f.idx[0]]))) >= 0.5) continue;
      if (facesViewer(c, f.n)) return true;
      back = true;
    }
    return !back;
  };
  return details.flatMap((d): Detail[] => {
    if (d.kind === "label") {
      const [along, down] = FACES[d.face ?? "top"];
      return facesViewer(c, cross(down, along)) ? [d] : [];
    }
    if (d.kind === "dots") {
      const points = d.points.filter(front);
      return points.length ? [{ ...d, points }] : [];
    }
    return (d.kind === "ticks" ? front(d.from) : d.points.some(front)) ? [d] : [];
  });
}

function itemBody(c: Camera, item: Item, lang: string, inline = false, draft?: boolean): string {
  const cls = (k: string) => (inline ? `style="${INLINE[k]}"` : `class="${k}"`);
  const solid = item.solid;
  const mesh = isRound(solid) ? undefined : meshOf(solid, c);
  const drawn = isRound(solid) ? drawRound(c, endsOf(solid), solid.r, draft) : drawMesh(c, mesh!);
  const shown = item.details.length ? engraved(c, mesh, item.details) : item.details;
  const lines = linesOf(shown);
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
  for (const d of shown) if (d.kind === "label") body += labelSvg(c, d, lang, cls("tx"));
  return body;
}

const r2 = (v: number) => Math.round(v * 2) / 2;

/**
 * Las piezas idénticas (un depósito de fichas, una fila de carritos) se dibujan una vez en <defs> y se repiten con
 * <use>: cada una se calcula relativa a su propia esquina, así dos piezas iguales dan el mismo texto.
 */
function artOf(id: string, c: Camera, items: Item[], order: number[], lang: string, custom: Set<string>, draft?: boolean): { defs: string; art: string } {
  const placed = order.map((k) => {
    const item = items[k];
    const [ax, ay] = project(c, item.box.min);
    const tone = TONES.includes(item.tone) ? item.tone : "mid";
    const local = { ...c, ox: c.ox - ax, oy: c.oy - ay };
    return { item, ax: r2(ax), ay: r2(ay), tone, key: draft ? "" : itemBody(local, item, lang, true), local };
  });
  const count = new Map<string, number>();
  for (const p of placed) count.set(p.key, (count.get(p.key) ?? 0) + 1);
  const ids = new Map<string, string>();
  let defs = "";
  let art = "";
  for (const p of placed) {
    const g = p.item.group ? ` data-g="${esc(p.item.group)}"` : "";
    const hidden = p.item.hidden ? ` opacity="0"` : "";
    const paint = paintAttr(p.item, custom);
    // Una pieza que anima un modelo y además se despieza va dentro de un <g> con el grupo del despiece.
    const [open, close] = p.item.outer ? [`<g data-g="${esc(p.item.outer)}">`, "</g>"] : ["", ""];
    if ((count.get(p.key) ?? 0) < 2 || p.key.length < 200) {
      art += `${open}<g class="${p.tone}"${paint}${g}${hidden}>${itemBody(c, p.item, lang, false, draft)}</g>${close}`;
      continue;
    }
    let ref = ids.get(p.key);
    if (!ref) {
      ref = `${esc(id)}-p${ids.size}`;
      ids.set(p.key, ref);
      defs += `<g id="${ref}">${p.key}</g>`;
    }
    art += `${open}<use href="#${ref}" x="${p.ax}" y="${p.ay}" class="${p.tone}"${paint}${g}${hidden}/>${close}`;
  }
  return { defs: defs ? `<defs>${defs}</defs>` : "", art };
}

function shadowSvg(c: Camera, items: Item[]): string {
  const polys = items
    .filter((i) => i.shadow)
    .map(({ box: { min, max }, solid }) => {
      const pad = 3;
      const z = min[2];
      // Una pieza redonda lleva un halo redondo: el contorno de su huella (un círculo o un estadio) en el piso.
      const ring: Vec3[] = isRound(solid)
        ? stadium(...endsOf(solid), solid.r + pad).map(([x, y]): Vec3 => [x, y, z])
        : [
            [min[0] - pad, min[1] - pad, z],
            [max[0] + pad, min[1] - pad, z],
            [max[0] + pad, max[1] + pad, z],
            [min[0] - pad, max[1] + pad, z],
          ];
      return ring.map((p) => project(c, p));
    });
  return polys.length ? `<path class="h" d="${pathOf(polys, true)}"/>` : "";
}

function fitPoints(spec: FigureSpec, items: Item[], view: Camera): Vec3[] {
  const pts: Vec3[] = [];
  const extentOf = (g?: string): Vec3[] => (g ? (spec.groups?.[g]?.extent ?? []) : []);
  for (const it of items) {
    const { min, max } = it.box;
    // El círculo de una pieza redonda cabe exacto: su caja, vista de lado, sería hasta un 57 % más grande.
    const s = it.solid;
    const corners: Vec3[] = isRound(s)
      ? endsOf(s).flatMap((p) => [view.right, view.down].flatMap((v) => [add(p, mul(v, s.r)), add(p, mul(v, -s.r))]))
      : [min, max, [min[0], max[1], min[2]], [max[0], min[1], max[2]], [min[0], min[1], max[2]], [max[0], max[1], min[2]]];
    const own = extentOf(it.group);
    const outer = extentOf(it.outer);
    const moves = [[0, 0, 0] as Vec3, ...own, ...outer, ...own.flatMap((a) => outer.map((b) => add(a, b)))];
    for (const d of moves) pts.push(...corners.map((p) => add(p, d)));
  }
  return pts;
}

const isWorldAxis = (n: Vec3) => n.some((v) => Math.abs(v) > 1 - 1e-9);

/** Lo que el orden de pintado necesita de una pieza inclinada, redonda o extruida de lado: vértices y normales de sus caras. */
function shapeOf(c: Camera, item: Item): Omit<Shape, "hull"> {
  const s = item.solid;
  const axes: Vec3[] = [];
  let pts: Vec3[];
  let normals: Vec3[];
  if (isRound(s)) {
    // Los centros de sus puntas (y el radio, aparte): solo el eje de una cápsula, si es oblicuo, separa a otras piezas.
    [pts, normals] = [endsOf(s), s.kind === "capsule" ? [axisOf(s.axis)] : []];
  } else {
    const mesh = meshOf(s, c);
    [pts, normals] = [mesh.v, s.kind === "prism" ? mesh.faces.map((f) => f.n) : s.kind === "box" ? [] : [axisOf(s.axis)]];
  }
  for (const n of normals) {
    if (isWorldAxis(n) || axes.some((m) => Math.abs(dot(m, n)) > 1 - 1e-9)) continue;
    axes.push(n);
  }
  return isRound(s) ? { pts, axes, r: s.r } : { pts, axes };
}

/** Desplazamiento de cada grupo con el parámetro `param` en `value`, según los `bind` con `move`. */
export function poseOf(spec: FigureSpec, param: string, value: number): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  for (const b of spec.bind ?? []) {
    if (b.param !== param || !b.move) continue;
    const x = b.win ? Math.max(0, Math.min(1, (value - b.win[0]) / (b.win[1] - b.win[0]))) : value;
    out.set(b.group, add(out.get(b.group) ?? [0, 0, 0], mul(b.move, x)));
  }
  return out;
}

/** Subsecuencia creciente más larga: las posiciones que no hace falta mover. */
function longestRun(seq: number[]): Set<number> {
  const tails: number[] = [];
  const prev = new Array<number>(seq.length).fill(-1);
  for (let i = 0; i < seq.length; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (seq[tails[mid]] < seq[i]) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const keep = new Set<number>();
  for (let k = tails.length ? tails[tails.length - 1] : -1; k >= 0; k = prev[k]) keep.add(k);
  return keep;
}

/**
 * Las movidas que llevan el DOM del orden `from` al orden `to`, en posiciones de `from`: pares «mueve este antes de
 * aquel» (−1: al final). Solo se mueven las piezas fuera de la subsecuencia más larga que ya está en orden.
 */
export function movesBetween(from: number[], to: number[]): number[] {
  const pos = new Map(from.map((k, i) => [k, i]));
  const seq = to.map((k) => pos.get(k)!);
  const keep = longestRun(seq);
  const out: number[] = [];
  for (let t = to.length - 1; t >= 0; t--) if (!keep.has(t)) out.push(seq[t], t + 1 < to.length ? seq[t + 1] : -1);
  return out;
}


export interface View extends CameraOptions {
  /** Escala máxima: al girar, la figura no crece más que en la vista inicial, pero se achica lo justo para caber. */
  scale?: number;
  /** Valor del parámetro de `reorder`: solo se calcula el orden de pintado de la pose que se ve (las demás salen sin movidas). */
  pose?: number;
  /** Dibujo de borrador para el arrastre: sin piezas idénticas compartidas y con menos capas en las piezas redondas. */
  draft?: boolean;
  /** Prefijo de los ids de `<defs>`; por defecto, el id de la spec (ver `RenderOptions.instance`). */
  instance?: string;
}

export interface Scene {
  cam: Camera;
  /** defs, halo y piezas, ya en orden de pintado: el contenido de `<g class="isofig-scene">`. */
  markup: string;
  basis: number[];
  spins: Record<string, number[]>;
  items: Item[];
  cycles: string[];
  /** Orden de pintado en cada pose de `spec.reorder`: `[valor, mover, antes de, …]` sobre el orden en reposo. */
  reorder?: { param: string; poses: number[][] };
  /** Si dos piezas orientadas están separadas por un plano de sus caras aunque sus cajas se crucen (para la auditoría). */
  apart: (a: Item, b: Item) => boolean;
}

/**
 * Dibuja la escena de una spec ya armada (`assemble`, o `renderFigure`, que la arma antes) desde una cámara. No depende
 * de Node ni de `tree.ts`: el modo órbita la llama en el navegador y no necesita saber aplanar un árbol.
 */
export function drawScene(spec: FlatSpec, lang: string, view: View = {}): Scene {
  const W = spec.width ?? 640;
  const H = spec.height ?? 400;
  const { items } = buildItems(spec.parts);
  const options = { ...spec.camera, ...(view.azimuth !== undefined ? { azimuth: view.azimuth } : {}), ...(view.elevation !== undefined ? { elevation: view.elevation } : {}) };
  const cam = fitCamera(options, fitPoints(spec, items, makeCamera(options)), W, H, spec.pad ?? 24, view.scale);
  const names = items.map((i) => i.id);
  const oriented = items.some((i) => isRound(i.solid) || i.solid.kind === "prism" || ((i.solid.kind === "cylinder" || i.solid.kind === "cone") && !isWorldAxis(axisOf(i.solid.axis))));
  // La forma de cada pieza se calcula una vez; en cada pose solo se traslada (y su silueta, en pantalla).
  const base: (Shape | undefined)[] = [];
  const shapeAt = (k: number): Shape => {
    if (!base[k]) {
      const s = shapeOf(cam, items[k]);
      const p = s.pts.map((q) => project(cam, q));
      base[k] = { ...s, hull: s.r === undefined ? hullOf(p) : stadium(p[0], p[1], s.r * cam.scale) };
    }
    return base[k];
  };
  const shapesAt = (moves: Vec3[]) => {
    if (!oriented) return undefined;
    const cache: (Shape | undefined)[] = [];
    return items.map((_, k) => () => {
      const d = moves[k];
      if (!d[0] && !d[1] && !d[2]) return shapeAt(k);
      if (!cache[k]) {
        const s = shapeAt(k);
        const [dx, dy] = [cam.scale * dot(d, cam.right), cam.scale * dot(d, cam.down)];
        cache[k] = { ...s, pts: s.pts.map((p) => add(p, d)), hull: s.hull.map(([x, y]): [number, number] => [x + dx, y + dy]) };
      }
      return cache[k];
    });
  };
  // Lo que viaja por un recorrido cruza otras piezas y tiene que verse siempre: queda fuera del orden y se pinta al final.
  // Las piezas del piso (`ground`: bandejas, cintas) van al principio, de abajo hacia arriba y de lejos a cerca: no se
  // alzan sobre nada, y así no entran en las dudas del orden.
  const travels = new Set((spec.tracks ?? []).map((t) => t.group));
  const idx = items.map((_, k) => k);
  const flies = idx.filter((k) => travels.has(items[k].group ?? ""));
  const floor = idx.filter((k) => !flies.includes(k) && items[k].solid.ground);
  const standing = idx.filter((k) => !flies.includes(k) && !items[k].solid.ground);
  // `prior`: los pares de la pose en reposo, que una pose reutiliza para las piezas que se movieron juntas.
  const ranked = (boxes: Box3[], shapes?: (() => Shape | undefined)[], prior?: Prior): Ordered => {
    const sub = paintOrder(cam, standing.map((k) => boxes[k]), standing.map((k) => names[k]), shapes && standing.map((k) => shapes[k]), prior);
    const depth = (k: number) => depthOf(cam, centerOf(boxes[k]));
    const low = [...floor].sort((a, b) => boxes[a].min[2] - boxes[b].min[2] || depth(a) - depth(b) || a - b);
    return { order: [...low, ...sub.order.map((i) => standing[i]), ...flies], cycles: sub.cycles, pairs: sub.pairs };
  };
  const rest = items.map((): Vec3 => [0, 0, 0]);
  const atRest = shapesAt(rest);
  const { order, cycles, pairs } = ranked(items.map((i) => i.box), atRest);
  const index = new Map(items.map((it, k) => [it, k]));
  const apart = (a: Item, b: Item) => {
    const sa = atRest?.[index.get(a)!]();
    const sb = atRest?.[index.get(b)!]();
    return Boolean(sa && sb && shapesApart(sa, sb));
  };
  let reorder: Scene["reorder"];
  if (spec.reorder) {
    const { param, at } = spec.reorder;
    // Misma regla que el runtime: la última pose cuyo valor ya se alcanzó.
    const shown = at.reduce((k, v, i) => (view.pose! >= v - 0.05 ? i : k), -1);
    const poses = at.map((value, i) => {
      if (view.pose !== undefined && i !== shown) return [value];
      const pose = poseOf(spec, param, value);
      const moves = items.map((it) => add(pose.get(it.group ?? "") ?? [0, 0, 0], pose.get(it.outer ?? "") ?? [0, 0, 0]));
      const boxes = items.map((it, k): Box3 => ({ min: add(it.box.min, moves[k]), max: add(it.box.max, moves[k]) }));
      const key = standing.map((k) => moves[k].join());
      const moved = ranked(boxes, shapesAt(moves), { pairs, same: (i, j) => key[i] === key[j] });
      cycles.push(...moved.cycles.map((c) => `${c} (${param} = ${value})`));
      return [value, ...movesBetween(order, moved.order)];
    });
    reorder = { param, poses };
  }
  const { defs, art } = artOf(view.instance ?? spec.id, cam, items, order, lang, customPaints(spec), view.draft);
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
    ...(reorder ? { reorder } : {}),
    apart,
  };
}
