import { audit, auditLabels } from "./audit.ts";
import { formatIssue, makeIssue, type Issue } from "./issues.ts";
import { paletteIssues, paletteStyle } from "./palette/figure.ts";
import { drawScene } from "./scene.ts";
import { escapeHtml as esc } from "./serialize.ts";
import { textOf, type FigureSpec, type FlatSpec } from "./spec.ts";
import { assembleTree, type AssembleOptions, type Catalog } from "./tree.ts";
import { catalog as kit } from "../kit/index.ts";
import { trackData, type TrackData } from "./tracks.ts";
import { validateSpec } from "./validate.ts";

export interface RenderOptions {
  lang?: string;
  /** Número de figura que se muestra en la tarjeta («Fig. 3»). */
  n?: number | string;
  /**
   * Compila el `map` de la spec (`resolveMap` de `isofig/map`). No va dentro de `renderFigure` para que el núcleo no
   * cargue el compilador (~21 KB gzip) cuando nadie dibuja un mapa; `isofig build`, `isofig check` y `<Figure>` lo ponen.
   */
  resolveMap?: AssembleOptions["resolveMap"];
  /** Añade los controles para girar la figura (el módulo isofig/orbit se carga al usarlos). */
  orbit?: boolean;
  /** `false` quita el chip «Ampliar» (el módulo isofig/zoom se carga al pulsarlo). */
  zoom?: boolean;
  /**
   * Nombre de esta copia de la figura para el DOM: sustituye a `spec.id` en los `id` (`-t`, `-d`, `-p0…`) y en el
   * `name` de los radios, de modo que la misma figura pueda aparecer varias veces en una página. No toca
   * `data-isofig` ni el JSON del runtime. Por defecto, `spec.id`: el marcado sale igual que sin esta opción.
   */
  instance?: string;
  /** Piezas para `use` que no están en `defs`; por defecto, las de `isofig/kit`. */
  catalog?: Catalog;
  /** Valor de arranque de los controles, por id (también los que añade el despiece): una vista previa de cada estado. */
  values?: Record<string, number>;
}

export interface RuntimeData {
  id: string;
  model?: string;
  autoplay: boolean;
  tau: number;
  basis: number[];
  spins: Record<string, number[]>;
  params: { id: string; value: number; unit: string; spoken: string; options?: string[]; texts?: string[] }[];
  presets?: { values: Record<string, number>; note: string; reset?: boolean; press?: string[] }[];
  bind: FigureSpec["bind"];
  /** Recorridos sin modelo (ver `tracks` en la spec) y el segundo en que se queda el reloj con movimiento reducido. */
  tracks?: TrackData[];
  rest?: number;
  readout: string;
  lang: string;
  settle?: number;
  /** Orden de pintado por pose: `[valor, mover, antes de, …]` sobre el orden en reposo (ver `FigureSpec.reorder`). */
  reorder?: { param: string; poses: number[][] };
}

export interface Rendered {
  html: string;
  svg: string;
  data: RuntimeData;
  /** Tamaño del HTML en bytes UTF-8. El gzip y el presupuesto de peso los mide `measure()` de `isofig/node`. */
  bytes: number;
  /** Los avisos y errores como texto (`parts[3].size: …`); `info` no entra. */
  warnings: string[];
  errors: string[];
  /** Todo lo que se encontró, con código estable, gravedad y `path` (incluye las notas `info`). */
  issues: Issue[];
}

type Label = "play" | "pause" | "fig" | "presets" | "orbit" | "left" | "right" | "reset" | "drag" | "zoom" | "close";

const LABELS: Record<string, Record<Label, string>> = {
  es: {
    play: "Reproducir", pause: "Pausar", fig: "Fig.", presets: "Prueba a romperlo", orbit: "Girar la figura",
    left: "Girar a la izquierda", right: "Girar a la derecha", reset: "Vista inicial", drag: "arrastra para girar",
    zoom: "Ampliar", close: "Cerrar",
  },
  en: {
    play: "Play", pause: "Pause", fig: "Fig.", presets: "Try to break it", orbit: "Turn the figure",
    left: "Turn left", right: "Turn right", reset: "Initial view", drag: "drag to turn",
    zoom: "Enlarge", close: "Close",
  },
};

// Cuatro esquinas que se abren: el chip se entiende aunque el texto quede corto.
const ZOOM_ICON =
  `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">` +
  `<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Lo que devuelve una figura que no se pudo dibujar: sus errores y nada más. */
function failed(lang: string, issues: Issue[]): Rendered {
  const data: RuntimeData = { id: "", autoplay: false, tau: 0.18, basis: [], spins: {}, params: [], bind: undefined, readout: "", lang };
  return { html: "", svg: "", data, bytes: 0, warnings: only(issues, "warning"), errors: only(issues, "error"), issues };
}

const only = (issues: Issue[], severity: Issue["severity"]) => issues.filter((i) => i.severity === severity).map(formatIssue);

/** La lectura con los valores: `{id}` toma el texto del valor si lo hay, que a su vez puede nombrar otro parámetro. */
export function fillReadout(template: string, params: { id: string; value: number; texts?: string[] }[]): string {
  const once = (text: string) =>
    text.replace(/\{([^}]+)\}/g, (m, id: string) => {
      const p = params.find((q) => q.id === id);
      return p ? (p.texts?.[p.value] ?? String(p.value)) : m;
    });
  return once(once(template));
}

export function renderFigure(spec: FigureSpec, options: RenderOptions = {}): Rendered {
  const lang = options.lang ?? "en";
  const catalog = options.catalog ?? (kit as Catalog);
  const issues = validateSpec(spec, { lang, catalog });
  if (options.instance !== undefined && !/^[a-z0-9][a-z0-9-]*$/i.test(options.instance)) issues.push(makeIssue(lang, "instance-invalid", "instance", { id: options.instance }));
  // Con la estructura rota, o con una cuenta que no termina, no hay nada que dibujar: solo los errores.
  if (issues.some((i) => i.code === "spec-not-object" || i.code === "type-invalid" || i.code === "count-too-large")) return failed(lang, issues);
  // Una spec rota no lanza: da sus errores. Si el dibujo falla por algo que la validación no explica, se dice aquí.
  try {
    // Una spec anidada se aplana aquí; los problemas del árbol ya los dijo la validación.
    const tree = assembleTree(spec, { catalog, resolveMap: options.resolveMap });
    if (spec.map && !options.resolveMap) issues.push(makeIssue(lang, "map-compiler-missing", "map"));
    const flat = tree.spec;
    for (const n of tree.notes) issues.push(makeIssue(lang, n.code, n.path, n.vars));
    const start = options.values ?? {};
    if (flat.params) flat.params = flat.params.map((p) => (p.id in start ? { ...p, value: start[p.id] } : p));
    const r = draw(flat, options, lang, issues);
    // La auditoría habla de la spec aplanada: sus `parts[k]` se traducen al lugar del árbol de donde sale cada pieza.
    if (spec.root || spec.map) {
      for (const i of r.issues) {
        const m = /^parts\[(\d+)\]/.exec(i.path);
        const src = m ? tree.sources.get(flat.parts[Number(m[1])]) : undefined;
        if (src) i.path = src + i.path.slice(m![0].length);
      }
      r.warnings = only(r.issues, "warning");
      r.errors = only(r.issues, "error");
    }
    return r;
  } catch (e) {
    if (!issues.some((i) => i.severity === "error")) issues.push(makeIssue(lang, "draw-failed", "", { reason: e instanceof Error ? e.message : String(e) }));
    return failed(lang, issues);
  }
}

function draw(spec: FlatSpec, options: RenderOptions, lang: string, issues: Issue[]): Rendered {
  const labels = LABELS[lang] ?? LABELS["en"];
  const W = spec.width ?? 640;
  const H = spec.height ?? 400;
  const { markup, basis, spins, items, cycles, cam, reorder, apart } = drawScene(spec, lang, { instance: options.instance });

  const id = spec.id;
  const dom = options.instance ?? id;
  const title = textOf(spec.title, lang);
  const caption = textOf(spec.caption, lang);
  const alt = textOf(spec.alt, lang);
  const desc = alt && alt !== caption ? `<desc id="${esc(dom)}-d">${esc(alt)}</desc>` : "";
  const svg =
    `<svg class="isofig-art${options.orbit ? " isofig-orbitable" : ""}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${esc(dom)}-t"${desc ? ` aria-describedby="${esc(dom)}-d"` : ""}>` +
    `<title id="${esc(dom)}-t">${esc(title)}</title>${desc}` +
    `<g class="isofig-scene">${markup}</g></svg>`;

  const fmt = new Intl.NumberFormat(lang);
  const params = (spec.params ?? []).map((p) => ({
    id: p.id,
    value: num(p.value),
    unit: textOf(p.unit, lang),
    spoken: textOf(p.spoken, lang) || textOf(p.unit, lang),
    ...(p.kind === "choice" ? { options: (p.options ?? []).map((o) => textOf(o, lang)) } : {}),
    ...(p.texts ? { texts: p.texts.map((t) => textOf(t, lang)) } : {}),
  }));
  const presets = (spec.presets ?? []).map((p) => ({
    values: p.values,
    note: textOf(p.note, lang),
    ...(p.reset ? { reset: true } : {}),
    ...(p.press?.length ? { press: p.press } : {}),
  }));
  const template = textOf(spec.readout, lang);
  const tracks = trackData(spec.tracks);
  for (const g of new Set(tracks.data.map((t) => t.g))) {
    if (!items.some((i) => i.group === g)) issues.push(makeIssue(lang, "track-group-unknown", "tracks", { group: g }));
  }
  const readout = fillReadout(template, params);
  const data: RuntimeData = {
    id,
    model: spec.model,
    autoplay: spec.autoplay ?? (Boolean(spec.model) || tracks.data.length > 0),
    tau: spec.motion?.tau ?? 0.18,
    basis,
    spins,
    params,
    bind: spec.bind,
    readout: template,
    lang,
    ...(presets.length ? { presets } : {}),
    ...(spec.motion?.settle ? { settle: num(spec.motion.settle) } : {}),
    ...(reorder ? { reorder } : {}),
    ...(tracks.data.length ? { tracks: tracks.data, rest: tracks.rest } : {}),
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
            .map((o, k) => `<label><input type="radio" name="${esc(dom)}-${esc(p.id)}" value="${k}" data-param="${esc(p.id)}"${k === num(p.value) ? " checked" : ""}><span>${esc(o)}</span></label>`)
            .join("") +
          `</fieldset>`
        );
      }
      const { unit, spoken, texts } = params[i];
      const value = fmt.format(num(p.value));
      return (
        `<label class="isofig-param"><span>${label}</span>` +
        `<input type="range" data-param="${esc(p.id)}" min="${num(p.min)}" max="${num(p.max)}" step="${num(p.step ?? 1)}" value="${num(p.value)}" aria-valuetext="${esc(texts?.[num(p.value)] ?? `${value} ${spoken}`.trim())}">` +
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
  // Oculto hasta que el runtime monta con un cargador de isofig/zoom: sin JavaScript no queda un chip muerto.
  const zoom = options.zoom === false
    ? ""
    : `<button type="button" class="isofig-chip isofig-zoom" data-zoom data-close="${labels.close}" hidden>${ZOOM_ICON}${labels.zoom}</button>`;
  const paletteVars = paletteStyle(spec);
  const html =
    `<figure class="isofig" data-isofig="${esc(id)}"${paletteVars ? ` style="${esc(paletteVars)}"` : ""}><div class="isofig-card">` +
    `<div class="isofig-top">${n}<span class="isofig-title" aria-hidden="true">${esc(title)}</span>${zoom}</div>` +
    svg +
    `<div class="isofig-bottom"><span class="isofig-hint">${esc(hint)}</span>` +
    `<span class="isofig-readout"${readout || spec.model ? " data-live" : ""}>${esc(readout)}</span></div></div>` +
    (play || controls || presetChips || orbit ? `<div class="isofig-controls" hidden>${play}${controls}${orbit}${presetChips}</div>` : "") +
    (presetChips ? `<p class="isofig-note" aria-live="polite"></p>` : "") +
    `<span class="isofig-say" aria-live="polite"></span>` +
    (caption ? `<figcaption>${esc(caption)}</figcaption>` : "") +
    `<script type="application/json" class="isofig-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script></figure>`;

  const bytes = new TextEncoder().encode(html).length;
  issues.push(
    ...[...new Set(cycles)].map((near) => makeIssue(lang, "paint-order-ambiguous", "", { near })),
    ...audit(items, lang, apart),
    ...auditLabels(items, cam, W, lang),
    ...paletteIssues(spec, items, cam, lang),
  );
  return { html, svg, data, bytes, warnings: only(issues, "warning"), errors: only(issues, "error"), issues };
}
