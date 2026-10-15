import { gzipSync } from "node:zlib";
import { fitCamera, project, screenBasis, type Camera } from "./camera.ts";
import { add, dot, type Vec3 } from "./math.ts";
import { buildItems, linesOf, meshOf, type Item } from "./items.ts";
import { paintOrder } from "./order.ts";
import { audit } from "./audit.ts";
import { drawMesh, SHADES } from "./shade.ts";
import { dotsOf, escapeHtml as esc, pathOf } from "./serialize.ts";
import { textOf, type FigureSpec, type LabelPart } from "./spec.ts";

export interface RenderOptions {
  lang?: string;
  /** Número de figura que se muestra en la tarjeta («Fig. 3»). */
  n?: number | string;
}

export interface RuntimeData {
  id: string;
  model?: string;
  autoplay: boolean;
  tau: number;
  basis: number[];
  spins: Record<string, number[]>;
  params: { id: string; value: number; unit: string }[];
  bind: FigureSpec["bind"];
  readout: string;
  lang: string;
}

export interface Rendered {
  html: string;
  svg: string;
  data: RuntimeData;
  bytes: number;
  gzip: number;
  warnings: string[];
  errors: string[];
}

const LABELS: Record<string, { play: string; pause: string; fig: string }> = {
  es: { play: "Reproducir", pause: "Pausar", fig: "Fig." },
  en: { play: "Play", pause: "Pause", fig: "Fig." },
};

const PLANES = { xy: [[1, 0, 0], [0, 1, 0]], xz: [[1, 0, 0], [0, 0, 1]], yz: [[0, 1, 0], [0, 0, 1]] } as const;

const FACES: Record<NonNullable<LabelPart["face"]>, [Vec3, Vec3]> = {
  top: [[0, 1, 0], [1, 0, 0]],
  x: [[0, 1, 0], [0, 0, -1]],
  y: [[-1, 0, 0], [0, 0, -1]],
};

/** El texto se escribe en coordenadas de la cara: la matriz lleva su eje de lectura y su «abajo» a pantalla. */
function labelSvg(c: Camera, l: LabelPart, lang: string): string {
  const [along, down] = FACES[l.face ?? "top"];
  const k = c.scale;
  const [e, f] = project(c, l.at);
  const m = [k * dot(c.right, along), k * dot(c.down, along), k * dot(c.right, down), k * dot(c.down, down), e, f];
  return `<text class="tx" font-size="${l.size ?? 6}" transform="matrix(${m.map((v) => Math.round(v * 1000) / 1000).join(" ")})">${esc(textOf(l.text, lang))}</text>`;
}

function itemSvg(c: Camera, item: Item, lang: string): string {
  const drawn = drawMesh(c, meshOf(item.solid, c));
  const lines = linesOf(item.details);
  const proj = (pts: Vec3[]) => pts.map((p) => project(c, p));
  let body = "";
  for (const s of SHADES) {
    const polys = drawn.faces.get(s);
    if (polys) body += `<path class="${s}" d="${pathOf(polys, true)}"/>`;
  }
  if (drawn.edges.length) body += `<path class="e" d="${pathOf(drawn.edges, false)}"/>`;
  if (lines.fine.length) body += `<path class="l" d="${pathOf(lines.fine.map(proj), false)}"/>`;
  if (lines.bold.length) body += `<path class="lb" d="${pathOf(lines.bold.map(proj), false)}"/>`;
  if (lines.dots.length) body += `<path class="d" d="${dotsOf(proj(lines.dots))}"/>`;
  for (const d of item.details) if (d.kind === "label") body += labelSvg(c, d, lang);
  const g = item.group ? ` data-g="${esc(item.group)}"` : "";
  const hidden = item.hidden ? ` opacity="0"` : "";
  return `<g class="${item.tone}"${g}${hidden}>${body}</g>`;
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

export function renderFigure(spec: FigureSpec, options: RenderOptions = {}): Rendered {
  const lang = options.lang ?? "en";
  const labels = LABELS[lang] ?? LABELS["en"];
  const W = spec.width ?? 640;
  const H = spec.height ?? 400;
  const { items, errors } = buildItems(spec.parts);
  const cam = fitCamera(spec.camera ?? {}, fitPoints(spec, items), W, H, spec.pad ?? 24);
  const { order, cycles } = paintOrder(cam, items.map((i) => i.box), items.map((i) => i.id));
  const art = order.map((k) => itemSvg(cam, items[k], lang)).join("");

  const id = spec.id;
  const title = textOf(spec.title, lang);
  const caption = textOf(spec.caption, lang);
  const alt = textOf(spec.alt, lang) || caption;
  const svg =
    `<svg class="isofig-art" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d">` +
    `<title id="${id}-t">${esc(title)}</title><desc id="${id}-d">${esc(alt)}</desc>` +
    shadowSvg(cam, items) + art + `</svg>`;

  const params = (spec.params ?? []).map((p) => ({ id: p.id, value: p.value, unit: textOf(p.unit, lang) }));
  const template = textOf(spec.readout, lang);
  const readout = params.reduce((s, p) => s.replaceAll(`{${p.id}}`, String(p.value)), template);
  const spins: Record<string, number[]> = {};
  for (const [g, def] of Object.entries(spec.groups ?? {})) {
    if (!def.spin) continue;
    const [u, v] = PLANES[def.spin.plane] as unknown as [Vec3, Vec3];
    const k = cam.scale;
    const [cx, cy] = project(cam, def.spin.center);
    spins[g] = [k * dot(cam.right, u), k * dot(cam.down, u), k * dot(cam.right, v), k * dot(cam.down, v), cx, cy];
  }
  const data: RuntimeData = {
    id,
    model: spec.model,
    autoplay: spec.autoplay ?? Boolean(spec.model),
    tau: spec.motion?.tau ?? 0.18,
    basis: screenBasis(cam).map((v) => Math.round(v * 1e4) / 1e4),
    spins,
    params,
    bind: spec.bind,
    readout: template,
    lang,
  };

  const play = data.autoplay || spec.model
    ? `<button type="button" class="isofig-chip isofig-play" aria-pressed="true" data-play="${labels.play}" data-pause="${labels.pause}">${labels.pause}</button>`
    : "";
  const controls = (spec.params ?? [])
    .map((p) => {
      const unit = textOf(p.unit, lang);
      const shown = `${p.value}${unit ? " " + unit : ""}`;
      return (
        `<label class="isofig-param"><span>${esc(textOf(p.label, lang))}</span>` +
        `<input type="range" data-param="${esc(p.id)}" min="${p.min}" max="${p.max}" step="${p.step ?? 1}" value="${p.value}" aria-valuetext="${esc(shown)}">` +
        `<output>${esc(shown)}</output></label>`
      );
    })
    .join("");
  const n = options.n !== undefined ? `<span class="isofig-n">${labels.fig} ${esc(String(options.n))}</span>` : "";
  const html =
    `<figure class="isofig" data-isofig="${esc(id)}"><div class="isofig-card">` +
    `<div class="isofig-top">${n}<span class="isofig-title">${esc(title)}</span></div>` +
    svg +
    `<div class="isofig-bottom"><span class="isofig-hint">${esc(textOf(spec.hint, lang))}</span>` +
    `<output class="isofig-readout">${esc(readout)}</output></div></div>` +
    (play || controls ? `<div class="isofig-controls">${play}${controls}</div>` : "") +
    (caption ? `<figcaption>${esc(caption)}</figcaption>` : "") +
    `<script type="application/json" class="isofig-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script></figure>`;

  const bytes = Buffer.byteLength(html);
  const gzip = gzipSync(html, { level: 9 }).length;
  const warnings = [
    ...cycles.map((name) => `orden de pintado ambiguo cerca de «${name}»`),
    ...audit(items),
  ];
  const budget = (spec.budget ?? 40) * 1024;
  if (gzip > budget) warnings.push(`pesa ${(gzip / 1024).toFixed(1)} KB gzip, más que el presupuesto de ${spec.budget ?? 40} KB`);
  return { html, svg, data, bytes, gzip, warnings, errors };
}
