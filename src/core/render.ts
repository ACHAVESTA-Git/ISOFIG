import { gzipSync } from "node:zlib";
import { audit } from "./audit.ts";
import { drawScene } from "./scene.ts";
import { escapeHtml as esc } from "./serialize.ts";
import { textOf, type FigureSpec } from "./spec.ts";

export interface RenderOptions {
  lang?: string;
  /** Número de figura que se muestra en la tarjeta («Fig. 3»). */
  n?: number | string;
  /** Añade los controles para girar la figura (el módulo isofig/orbit se carga al usarlos). */
  orbit?: boolean;
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

const LABELS: Record<string, Record<"play" | "pause" | "fig" | "presets" | "orbit" | "left" | "right" | "reset" | "drag", string>> = {
  es: {
    play: "Reproducir", pause: "Pausar", fig: "Fig.", presets: "Prueba a romperlo", orbit: "Girar la figura",
    left: "Girar a la izquierda", right: "Girar a la derecha", reset: "Vista inicial", drag: "arrastra para girar",
  },
  en: {
    play: "Play", pause: "Pause", fig: "Fig.", presets: "Try to break it", orbit: "Turn the figure",
    left: "Turn left", right: "Turn right", reset: "Initial view", drag: "drag to turn",
  },
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function renderFigure(spec: FigureSpec, options: RenderOptions = {}): Rendered {
  const lang = options.lang ?? "en";
  const labels = LABELS[lang] ?? LABELS["en"];
  const W = spec.width ?? 640;
  const H = spec.height ?? 400;
  const { markup, basis, spins, items, cycles, errors } = drawScene(spec, lang);

  const id = spec.id;
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) errors.push(`id «${id}»: usa letras, números y guiones`);
  const title = textOf(spec.title, lang);
  const caption = textOf(spec.caption, lang);
  const alt = textOf(spec.alt, lang);
  const desc = alt && alt !== caption ? `<desc id="${esc(id)}-d">${esc(alt)}</desc>` : "";
  const svg =
    `<svg class="isofig-art${options.orbit ? " isofig-orbitable" : ""}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${esc(id)}-t"${desc ? ` aria-describedby="${esc(id)}-d"` : ""}>` +
    `<title id="${esc(id)}-t">${esc(title)}</title>${desc}` +
    `<g class="isofig-scene">${markup}</g></svg>`;

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
  const data: RuntimeData = {
    id,
    model: spec.model,
    autoplay: spec.autoplay ?? Boolean(spec.model),
    tau: spec.motion?.tau ?? 0.18,
    basis,
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
  const orbit = options.orbit
    ? `<div class="isofig-orbit" role="group" aria-label="${labels.orbit}">` +
      `<button type="button" class="isofig-chip" data-orbit="-20" aria-label="${labels.left}">↺</button>` +
      `<button type="button" class="isofig-chip" data-orbit="20" aria-label="${labels.right}">↻</button>` +
      `<button type="button" class="isofig-chip" data-orbit="0">${labels.reset}</button></div>`
    : "";
  const hint = [textOf(spec.hint, lang), options.orbit ? labels.drag : ""].filter(Boolean).join(" · ");
  const n = options.n !== undefined ? `<span class="isofig-n">${labels.fig} ${esc(String(options.n))}</span>` : "";
  const html =
    `<figure class="isofig" data-isofig="${esc(id)}"><div class="isofig-card">` +
    `<div class="isofig-top">${n}<span class="isofig-title" aria-hidden="true">${esc(title)}</span></div>` +
    svg +
    `<div class="isofig-bottom"><span class="isofig-hint">${esc(hint)}</span>` +
    `<span class="isofig-readout">${esc(readout)}</span></div></div>` +
    (play || controls || presetChips || orbit ? `<div class="isofig-controls" hidden>${play}${controls}${orbit}${presetChips}</div>` : "") +
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
