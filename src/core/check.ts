import { makeIssue, type Issue } from "./issues.ts";
import { expand } from "./items.ts";
import type { Ctx, Model, Params, View } from "../runtime/index.ts";
import type { FigureSpec, PresetSpec } from "./spec.ts";
import { listOf, READOUT_MAX } from "./validate-shared.ts";

export interface CheckModelOptions {
  /** Idioma de los mensajes (y de la figura que ve el modelo): `en` por defecto. */
  lang?: string;
  /** Segundos simulados tras cada pulsación y de la ejecución base: 12 por defecto. */
  seconds?: number;
  /** También ejecuta cada desvío (`presets`) de la spec. */
  presets?: boolean;
}

const FPS = 60;
/** Cada cuántos cuadros se mira la vista para saber qué grupos escribe el modelo, y cada cuántos se compara. */
const LOOK = 6;
const COMPARE = 30;

/** Una vista como texto, con los números a dos decimales (lo que no se ve no cuenta como diferencia). */
const keyOf = (v: View): string => JSON.stringify([v.groups ?? {}, v.readout ?? ""], (_k, x) => (typeof x === "number" ? Math.round(x * 100) / 100 : x));

/**
 * Ejecuta el modelo en Node, sin navegador, como lo haría el runtime: `seconds` simulados con los valores iniciales y,
 * con `presets`, cada desvío pulsado a mitad de una ejecución (con sus valores, `press` y `reset`). Avisa de los grupos
 * que el modelo escribe y ninguna pieza tiene, de los que la spec no mueve nunca, de los desvíos que dejan la misma vista
 * que no pulsarlos, de los parámetros que lee sin declarar y de la lectura más larga.
 */
export function checkModel(spec: FigureSpec, model: Model<any, any>, options: CheckModelOptions = {}): Issue[] {
  const lang = options.lang ?? "en";
  const seconds = options.seconds ?? 12;
  const warm = seconds / 2;
  if (!model || typeof model.init !== "function" || typeof model.view !== "function") return [makeIssue(lang, "model-invalid", "model")];

  const specParams = Array.isArray(spec.params) ? spec.params : [];
  const initial: Params = Object.fromEntries(specParams.map((p) => [p.id, Number.isFinite(Number(p.value)) ? Number(p.value) : 0]));
  const declared = new Set(Object.keys(initial));
  const written = new Set<string>();
  const reads = new Set<string>();
  const unknownReads = new Set<string>();
  let longest = "";
  const issues: Issue[] = [];
  let failed = false;

  /** Una ejecución: el modelo con sus parámetros (un Proxy que anota lo que lee) y su cronómetro. */
  const session = () => {
    const target: Params = { ...initial };
    const params = new Proxy(target, {
      get(t, key, receiver) {
        if (typeof key === "string" && !(key in Object.prototype)) {
          reads.add(key);
          if (!(key in t)) unknownReads.add(key);
        }
        return Reflect.get(t, key, receiver);
      },
    });
    // Lo que cambió (1) o se pulsó (2) desde el último paso, como lo lleva el runtime: `ctx.pressed(id)` y `ctx.changed(id)`
    // valen durante el paso siguiente a un desvío, y cuentan como una lectura del parámetro.
    const marks = new Map<string, number>();
    const ctx: Ctx = {
      lang,
      reducedMotion: false,
      say: () => {},
      pressed: (id) => (reads.add(id), marks.get(id) === 2),
      changed: (id) => (reads.add(id), marks.has(id)),
    };
    const samples: string[] = [];
    let frame = 0;
    let state: unknown;
    const guard = (when: string, fn: () => void): boolean => {
      if (failed) return false;
      try {
        fn();
        return true;
      } catch (e) {
        failed = true;
        issues.push(makeIssue(lang, "model-throws", "model", { reason: e instanceof Error ? `${e.name}: ${e.message}` : String(e), when }));
        return false;
      }
    };
    const look = () => {
      const v = model.view(state, params, ctx) ?? {};
      for (const g of Object.keys(v.groups ?? {})) written.add(g);
      if (typeof v.readout === "string" && v.readout.length > longest.length) longest = v.readout;
      if (frame % COMPARE === 0) samples.push(keyOf(v));
    };
    const start = () => guard("init", () => {
      state = model.init(params, ctx);
      look();
    });
    const advance = (until: number) => {
      const end = Math.round(until * FPS);
      while (frame < end && !failed) {
        if (!guard(`${(frame / FPS).toFixed(1)} s`, () => {
          state = model.step?.(state, 1 / FPS, params, ctx) ?? state;
          marks.clear();
          frame++;
          if (frame % LOOK === 0) look();
        })) return;
      }
    };
    /** Lo que hace el runtime al pulsar un desvío, en su orden: fija valores, vuelve a empezar si pide `reset` y pulsa las acciones. */
    const press = (p: PresetSpec) =>
      guard("preset", () => {
        for (const [id, v] of Object.entries(p.values ?? {})) {
          if (target[id] !== v) marks.set(id, 1);
          target[id] = v;
        }
        if (p.reset) state = model.init(params, ctx);
        for (const id of p.press ?? []) {
          target[id] = (target[id] ?? 0) + 1;
          marks.set(id, 2);
        }
      });
    return { samples, start, advance, press, now: () => frame };
  };

  const base = session();
  if (base.start()) base.advance(warm + seconds);

  const presets = options.presets && Array.isArray(spec.presets) ? spec.presets : [];
  presets.forEach((preset, k) => {
    if (failed) return;
    const s = session();
    if (!s.start()) return;
    s.advance(warm);
    const from = s.samples.length;
    if (!s.press(preset)) return;
    s.advance(warm + seconds);
    const mine = s.samples.slice(from);
    const theirs = base.samples.slice(from, from + mine.length);
    if (mine.length && mine.length === theirs.length && mine.every((x, i) => x === theirs[i])) {
      issues.push(makeIssue(lang, "preset-same-view", `presets[${k}]`, { at: warm, seconds }));
    }
  });
  if (failed) return issues;

  // Los grupos de las piezas, ya repetidas: lo que el modelo escribe contra lo que la spec tiene.
  let inParts: Map<string, boolean> | undefined;
  try {
    inParts = new Map();
    for (const p of expand(Array.isArray(spec.parts) ? spec.parts : [])) {
      if (!("group" in p) || !p.group) continue;
      inParts.set(p.group, (inParts.get(p.group) ?? true) && Boolean(p.hidden));
    }
  } catch {
    inParts = undefined;
  }
  const runs = 1 + presets.length;
  if (inParts) {
    const ghosts = [...written].filter((g) => !inParts.has(g));
    if (ghosts.length) issues.push(makeIssue(lang, "model-group-unknown", "model.groups", { count: ghosts.length, list: listOf(ghosts) }));
    const idle = [...inParts].filter(([g]) => !written.has(g));
    // Un grupo con piezas ocultas, o con un `extent`/`spin` declarado, se espera que se mueva: sin eso, es probable un error.
    const expected = idle.filter(([g, hidden]) => hidden || spec.groups?.[g]?.extent || spec.groups?.[g]?.spin).map(([g]) => g);
    const still = idle.map(([g]) => g).filter((g) => !expected.includes(g));
    if (expected.length) {
      const hidden = expected.some((g) => inParts.get(g));
      issues.push(makeIssue(lang, "group-never-driven", "model.groups", { count: expected.length, list: listOf(expected), runs, hidden: hidden ? 1 : 0 }));
    }
    if (still.length) issues.push(makeIssue(lang, "group-static", "model.groups", { count: still.length, list: listOf(still) }));
  }
  for (const key of unknownReads) if (!declared.has(key)) issues.push(makeIssue(lang, "model-param-unknown", `model.params.${key}`, { param: key }));
  for (const id of declared) if (!reads.has(id)) issues.push(makeIssue(lang, "param-never-read", `params.${id}`, { param: id }));
  if (longest) {
    issues.push(makeIssue(lang, "readout-longest", "model.readout", { length: longest.length, text: longest }));
    if (longest.length > READOUT_MAX) issues.push(makeIssue(lang, "readout-long", "model.readout", { length: longest.length, max: READOUT_MAX }));
  }
  return issues;
}
