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
  params: { id: string; value: number; unit: string; spoken: string; options?: string[] }[];
  presets?: { values: Record<string, number>; note: string; reset?: boolean }[];
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

const LABELS: Record<string, { play: string; pause: string; fig: string; presets: string }> = {
  es: { play: "Reproducir", pause: "Pausar", fig: "Fig.", presets: "Prueba a romperlo" },
  en: { play: "Play", pause: "Pause", fig: "Fig.", presets: "Try to break it" },
};

const TONES = ["lo", "mid", "hi", "lit"];

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

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
  return `<text ${cls} font-size="${l.size ?? 6}" transform="matrix(${m.map((v) => Math.round(v * 1000) / 1000).join(" ")})">${esc(textOf(l.text, lang))}</text>`;
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

export function renderFigure(spec: FigureSpec, options: RenderOptions = {}): Rendered {
  const lang = options.lang ?? "en";
  const labels = LABELS[lang] ?? LABELS["en"];
  const W = spec.width ?? 640;
  const H = spec.height ?? 400;
  const { items, errors } = buildItems(spec.parts);
  const cam = fitCamera(spec.camera ?? {}, fitPoints(spec, items), W, H, spec.pad ?? 24);
  const { order, cycles } = paintOrder(cam, items.map((i) => i.box), items.map((i) => i.id));
  const { defs, art } = artOf(spec.id, cam, items, order, lang);

  const id = spec.id;
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) errors.push(`id «${id}»: usa letras, números y guiones`);
  const title = textOf(spec.title, lang);
  const caption = textOf(spec.caption, lang);
  const alt = textOf(spec.alt, lang);
  const desc = alt && alt !== caption ? `<desc id="${esc(id)}-d">${esc(alt)}</desc>` : "";
  const svg =
    `<svg class="isofig-art" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${esc(id)}-t"${desc ? ` aria-describedby="${esc(id)}-d"` : ""}>` +
    `<title id="${esc(id)}-t">${esc(title)}</title>${desc}` +
    defs + shadowSvg(cam, items) + art + `</svg>`;

  const fmt = new Intl.NumberFormat(lang);
  const params = (spec.params ?? []).map((p) => ({
    id: p.id,
    value: num(p.value),
    unit: textOf(p.unit, lang),
    spoken: textOf(p.spoken, lang) || textOf(p.unit, lang),
    ...(p.kind === "choice" ? { options: (p.options ?? []).map((o) => textOf(o, lang)) } : {}),
  }));
  const presets = (spec.presets ?? []).map((p) => ({ values: p.values, note: textOf(p.note, lang), ...(p.reset ? { reset: true } : {}) }));
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
    ...(presets.length ? { presets } : {}),
  };

  const play = data.autoplay || spec.model
    ? `<button type="button" class="isofig-chip isofig-play" data-play="${labels.play}" data-pause="${labels.pause}">${data.autoplay ? labels.pause : labels.play}</button>`
    : "";
  const controls = (spec.params ?? [])
    .map((p, i) => {
      if (p.hidden) return "";
      const label = esc(textOf(p.label, lang));
      if (p.kind === "toggle") {
        return (
          `<label class="isofig-param isofig-toggle"><input type="checkbox" role="switch" data-param="${esc(p.id)}"${num(p.value) ? " checked" : ""}>` +
          `<span>${label}</span></label>`
        );
      }
      if (p.kind === "action") {
        return `<button type="button" class="isofig-chip isofig-action" data-param="${esc(p.id)}" data-action>${label}</button>`;
      }
      if (p.kind === "choice") {
        const opts = params[i].options ?? [];
        return (
          `<fieldset class="isofig-param isofig-choice"><legend>${label}</legend>` +
          opts
            .map((o, k) => `<label><input type="radio" name="${esc(id)}-${esc(p.id)}" value="${k}" data-param="${esc(p.id)}"${k === num(p.value) ? " checked" : ""}><span>${esc(o)}</span></label>`)
            .join("") +
          `</fieldset>`
        );
      }
      const { unit, spoken } = params[i];
      const value = fmt.format(num(p.value));
      return (
        `<label class="isofig-param"><span>${label}</span>` +
        `<input type="range" data-param="${esc(p.id)}" min="${num(p.min)}" max="${num(p.max)}" step="${num(p.step ?? 1)}" value="${num(p.value)}" aria-valuetext="${esc(`${value} ${spoken}`.trim())}">` +
        `<span class="isofig-value" aria-hidden="true">${esc(`${value} ${unit}`.trim())}</span></label>`
      );
    })
    .join("");
  const presetChips = presets.length
    ? `<div class="isofig-presets" role="group" aria-label="${labels.presets}"><span aria-hidden="true">${labels.presets}:</span>` +
      (spec.presets ?? []).map((p, k) => `<button type="button" class="isofig-chip isofig-preset" data-preset="${k}">${esc(textOf(p.label, lang))}</button>`).join("") +
      `</div>`
    : "";
  const n = options.n !== undefined ? `<span class="isofig-n">${labels.fig} ${esc(String(options.n))}</span>` : "";
  const html =
    `<figure class="isofig" data-isofig="${esc(id)}"><div class="isofig-card">` +
    `<div class="isofig-top">${n}<span class="isofig-title">${esc(title)}</span></div>` +
    svg +
    `<div class="isofig-bottom"><span class="isofig-hint">${esc(textOf(spec.hint, lang))}</span>` +
    `<span class="isofig-readout">${esc(readout)}</span></div></div>` +
    (play || controls || presetChips ? `<div class="isofig-controls" hidden>${play}${controls}${presetChips}</div>` : "") +
    (presetChips ? `<p class="isofig-note" aria-live="polite"></p>` : "") +
    `<span class="isofig-say" aria-live="polite"></span>` +
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
