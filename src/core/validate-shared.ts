import { makeIssue, type Issue, type IssueCode, type Severity, type V as Vars } from "./issues.ts";

/** Quien recoge los problemas: pone el idioma, la gravedad por defecto del código y el `path`. */
export interface Reporter {
  lang: string;
  add(code: IssueCode, path: string, vars?: Vars, severity?: Severity): void;
}

export function reporter(lang: string): { rep: Reporter; issues: Issue[] } {
  const issues: Issue[] = [];
  return { issues, rep: { lang, add: (code, path, vars, severity) => void issues.push(makeIssue(lang, code, path, vars, severity)) } };
}

export const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** El valor tal como llegó, corto y sin depender del idioma. */
export function show(v: unknown): string {
  if (typeof v === "string") return JSON.stringify(v.length > 24 ? `${v.slice(0, 24)}…` : v);
  if (Array.isArray(v)) return `list(${v.length})`;
  if (isObj(v)) return "object";
  return String(v);
}

/** Una lista corta de nombres para un mensaje: los primeros ocho y cuántos faltan. */
export const listOf = (names: string[]): string => (names.length > 8 ? `${names.slice(0, 8).join(", ")}… (+${names.length - 8})` : names.join(", "));

/** Quita el ruido de coma flotante de un valor que se muestra (0.30000000000000004 → 0.3). */
export const tidy = (v: number): number => Number(v.toFixed(6));

/** La clave conocida más parecida (hasta 2 letras de diferencia; 1 en las cortas) para sugerir «¿errata de…?». */
export function closest(key: string, known: readonly string[]): string | undefined {
  const k = key.toLowerCase();
  let best: string | undefined;
  let bestD = key.length <= 4 ? 1 : 2;
  for (const name of known) {
    const d = distance(k, name.toLowerCase());
    if (d <= bestD) {
      best = name;
      bestD = d;
      if (d === 0) break;
    }
  }
  return best;
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/** Claves que no son de este objeto: aviso con la lista de las conocidas, no error (puede ser una errata o un campo de otra versión). */
export function checkKeys(rep: Reporter, obj: Record<string, unknown>, known: readonly string[], path: string): void {
  for (const key of Object.keys(obj)) {
    if (known.includes(key)) continue;
    rep.add("unknown-key", path ? `${path}.${key}` : key, { key, where: path || "spec", suggest: closest(key, known) ?? "", known: known.join(", ") });
  }
}

/** Un vector de `n` números finitos (coordenadas de la geometría: un NaN aquí llega al SVG). */
export function checkVector(rep: Reporter, v: unknown, path: string, field: string, n: 2 | 3 = 3): v is number[] {
  if (!Array.isArray(v)) {
    rep.add("type-invalid", path, { field, expected: "vector", got: show(v) });
    return false;
  }
  if (v.length !== n) {
    rep.add("vector-length-invalid", path, { field, expected: n, got: v.length });
    return false;
  }
  let ok = true;
  // Con `for` y no con `forEach`: un hueco del arreglo (`[, 1, 2]`) también es un valor que falta.
  for (let j = 0; j < v.length; j++) {
    if (!isNum(v[j])) {
      rep.add("number-invalid", `${path}[${j}]`, { field: `${field}[${j}]`, got: show(v[j]) });
      ok = false;
    }
  }
  return ok;
}

// Las claves que cada objeto de la spec acepta: si falta una, la spec sale con «clave desconocida». Los nombres van en
// `words(...)` y no como `"from", "x"`, que una búsqueda de imports por expresión regular confundiría con un `from`.
export const words = (list: string): string[] => list.split(" ");

const BASE = ["id", "kind", "tone", "group", "hidden", "repeat", "float", "mount", "shadow", "paint", "outer", "ground"];

export const FIGURE_KEYS = [
  "id", "title", "hint", "caption", "alt", "width", "height", "pad", "camera", "parts", "groups", "params", "bind",
  "readout", "presets", "model", "autoplay", "motion", "budget", "root", "defs", "palette", "tracks", "map", "reorder", "$schema",
] as const;

export const PART_KEYS = {
  box: [...BASE, "at", "size", "radius", "bevel"],
  cylinder: [...BASE, "at", "r", "h", "axis", "bevel"],
  cone: [...BASE, "at", "r", "r2", "h", "axis"],
  prism: [...BASE, "plan", "z", "h", "axis", "bevel"],
  sphere: [...BASE, "at", "r"],
  capsule: [...BASE, "at", "r", "h", "axis"],
  ticks: [...BASE, ...words("on from along count toward every size")],
  dots: [...BASE, "on", "points"],
  line: [...BASE, "on", "points", "bold"],
  label: [...BASE, "on", "at", "text", "size", "face", "align"],
} as const;

export const KINDS = Object.keys(PART_KEYS);
export const SOLIDS: readonly string[] = ["box", "cylinder", "cone", "prism", "sphere", "capsule"];

/** Lo que una pieza no puede dibujarse sin tener. */
export const REQUIRED: Record<string, readonly string[]> = {
  box: ["at", "size"],
  cylinder: ["at", "r", "h"],
  cone: ["at", "r", "r2", "h"],
  prism: ["plan", "z", "h"],
  sphere: ["at", "r"],
  capsule: ["at", "r", "h"],
  ticks: words("on from along count toward"),
  dots: ["on", "points"],
  line: ["on", "points"],
  label: ["on", "at"],
};

export const REPEAT_KEYS = words("from count step");
export const GROUP_KEYS = ["extent", "spin"] as const;
export const SPIN_KEYS = ["center", "plane"] as const;
export const CAMERA_KEYS = ["azimuth", "elevation"] as const;
export const MOTION_KEYS = ["tau", "settle"] as const;
export const PARAM_KEYS = ["id", "label", "min", "max", "value", "step", "unit", "spoken", "kind", "hidden", "options", "texts"] as const;
export const BIND_KEYS = ["group", "param", "move", "spin", "fade", "win", "keep"] as const;
export const NODE_KEYS = words("id name note step at rotate explode stage parts children repeat use with tone paint mount");
export const PRESET_KEYS = ["label", "values", "note", "reset", "press"] as const;
export const TONES = ["lo", "mid", "hi", "lit"] as const;
export const PLANES = ["xy", "xz", "yz"] as const;
export const PARAM_KINDS = ["range", "toggle", "choice", "action"] as const;

/** Más copias o marcas que esto en una pieza no son un dibujo: son un error de cuenta. */
export const MAX_COUNT = 5000;

/** Lo más que cabe una lectura en la tarjeta de un celular sin saltar de línea. */
export const READOUT_MAX = 70;

/** ¿Es un texto con contenido? Un `Text` es una cadena o un objeto por idioma. */
export function hasText(t: unknown): boolean {
  if (typeof t === "string") return t.trim() !== "";
  if (isObj(t)) return Object.values(t).some((x) => typeof x === "string" && x.trim() !== "");
  return false;
}

/** Cada variante de idioma de un `Text`, con el `path` de esa variante. */
export function variants(t: unknown, path: string): { text: string; path: string }[] {
  if (typeof t === "string") return [{ text: t, path }];
  if (isObj(t)) return Object.entries(t).filter(([, x]) => typeof x === "string").map(([lang, x]) => ({ text: x as string, path: `${path}.${lang}` }));
  return [];
}
