import {
  BIND_KEYS, PARAM_KEYS, PARAM_KINDS, PRESET_KEYS, READOUT_MAX,
  checkKeys, checkVector, closest, hasText, isNum, isObj, show, tidy, variants, type Reporter,
} from "./validate-shared.ts";

/** Lo que un control deja elegir: su rango, su paso y desde dónde cuenta el paso (el navegador ajusta a esto). */
export interface Travel {
  min: number;
  max: number;
  step: number;
  implicit: boolean;
}

interface Control {
  id: string;
  kind: string;
  travel?: Travel;
  /** Último valor posible de una elección. */
  last?: number;
}

const kindOf = (p: Record<string, unknown>): string => (typeof p["kind"] === "string" ? p["kind"] : "range");

/** El valor que el navegador pondría en el deslizante: dentro del rango y en el paso más cercano. */
function shown(t: Travel, v: number): number {
  const snapped = t.min + Math.round((v - t.min) / t.step) * t.step;
  return tidy(Math.min(t.max, Math.max(t.min, snapped)));
}

const offStep = (t: Travel, v: number): boolean => {
  const n = (v - t.min) / t.step;
  return Math.abs(n - Math.round(n)) > 1e-6 * Math.max(1, Math.abs(n));
};

function checkParam(rep: Reporter, p: Record<string, unknown>, path: string): Control | undefined {
  checkKeys(rep, p, PARAM_KEYS, path);
  const id = typeof p["id"] === "string" && p["id"] !== "" ? p["id"] : undefined;
  if (!id) rep.add("param-id-missing", `${path}.id`);
  const name = id ?? path;
  const kind = kindOf(p);
  if (p["kind"] !== undefined && !PARAM_KINDS.includes(kind as never)) {
    rep.add("option-invalid", `${path}.kind`, { field: "kind", got: kind, expected: PARAM_KINDS.join(", ") });
  }
  if (!p["hidden"] && !hasText(p["label"])) rep.add("param-label-missing", `${path}.label`, { id: name });
  const control: Control | undefined = id ? { id, kind } : undefined;

  const num = (field: string, required: boolean): number | undefined => {
    const v = p[field];
    if (v === undefined && !required) return undefined;
    if (isNum(v)) return v;
    rep.add("param-number-invalid", `${path}.${field}`, { id: name, field, got: show(v) });
    return undefined;
  };

  if (kind === "toggle") {
    const value = num("value", false);
    if (value !== undefined && value !== 0 && value !== 1) rep.add("toggle-value-invalid", `${path}.value`, { id: name, value });
    return control && { ...control, travel: { min: 0, max: 1, step: 1, implicit: false } };
  }
  if (kind === "choice") {
    const options = p["options"];
    if (options !== undefined && !Array.isArray(options)) rep.add("type-invalid", `${path}.options`, { field: "options", expected: "list", got: show(options) });
    const n = Array.isArray(options) ? options.length : 0;
    if (n === 0) rep.add("choice-options-missing", `${path}.options`, { id: name });
    const value = num("value", false);
    if (n > 0 && value !== undefined && !(Number.isInteger(value) && value >= 0 && value < n)) {
      rep.add("choice-value-invalid", `${path}.value`, { id: name, value, last: n - 1 });
    }
    return control && { ...control, last: n - 1, travel: { min: 0, max: Math.max(0, n - 1), step: 1, implicit: false } };
  }
  if (kind === "action") {
    num("value", false);
    return control;
  }

  const min = num("min", true);
  const max = num("max", true);
  const value = num("value", true);
  const stepRaw = p["step"];
  let step = 1;
  if (stepRaw !== undefined) {
    if (isNum(stepRaw) && stepRaw > 0) step = stepRaw;
    else rep.add("param-step-invalid", `${path}.step`, { id: name, got: show(stepRaw) });
  }
  if (min === undefined || max === undefined) return control;
  if (min >= max) rep.add("param-range-invalid", `${path}.max`, { id: name, min, max });
  const travel: Travel = { min, max, step, implicit: stepRaw === undefined };
  if (value !== undefined && min < max) {
    if (value < min || value > max) {
      rep.add("param-value-out-of-range", `${path}.value`, { id: name, value, min, max, shown: shown(travel, value) });
    } else if (offStep(travel, value)) {
      rep.add("param-value-off-step", `${path}.value`, { id: name, value, min, step, shown: shown(travel, value), implicit: travel.implicit ? 1 : 0 });
    }
  }
  return control && { ...control, travel };
}

/** Los `params`: devuelve los que se pueden alcanzar por id (para `bind`, los desvíos y la lectura). */
export function validateParams(rep: Reporter, params: unknown): Map<string, Control> {
  const byId = new Map<string, Control>();
  if (params === undefined) return byId;
  if (!Array.isArray(params)) {
    rep.add("type-invalid", "params", { field: "params", expected: "list", got: show(params) });
    return byId;
  }
  const first = new Map<string, number>();
  params.forEach((raw, i) => {
    const path = `params[${i}]`;
    if (!isObj(raw)) return void rep.add("type-invalid", path, { field: path, expected: "object", got: show(raw) });
    const c = checkParam(rep, raw, path);
    if (!c) return;
    if (first.has(c.id)) rep.add("param-id-duplicate", `${path}.id`, { id: c.id, first: `params[${first.get(c.id)}]` });
    else {
      first.set(c.id, i);
      byId.set(c.id, c);
    }
  });
  return byId;
}

export function validateBind(
  rep: Reporter,
  bind: unknown,
  byId: Map<string, Control>,
  groups: Set<string> | undefined,
  spins: Set<string>,
  hasModel: boolean,
): void {
  if (bind === undefined) return;
  if (!Array.isArray(bind)) return void rep.add("type-invalid", "bind", { field: "bind", expected: "list", got: show(bind) });
  if (hasModel && bind.length) rep.add("bind-with-model", "bind");
  bind.forEach((raw, i) => {
    const path = `bind[${i}]`;
    if (!isObj(raw)) return void rep.add("type-invalid", path, { field: path, expected: "object", got: show(raw) });
    checkKeys(rep, raw, BIND_KEYS, path);
    const { group, param, move, spin, fade } = raw;
    if (typeof param !== "string" || !byId.has(param)) {
      rep.add("bind-unknown-param", `${path}.param`, { param: show(param).replace(/^"|"$/g, ""), suggest: typeof param === "string" ? closest(param, [...byId.keys()]) ?? "" : "" });
    }
    if (groups && (typeof group !== "string" || !groups.has(group))) {
      rep.add("bind-unknown-group", `${path}.group`, { group: show(group).replace(/^"|"$/g, ""), suggest: typeof group === "string" ? closest(group, [...groups]) ?? "" : "" });
    }
    if (move !== undefined) checkVector(rep, move, `${path}.move`, "move");
    if (spin && typeof group === "string" && !spins.has(group)) rep.add("bind-spin-no-pivot", `${path}.spin`, { group });
    if (!move && !spin && !fade) rep.add("bind-no-effect", path, { group: typeof group === "string" ? group : show(group) });
  });
}

export function validatePresets(rep: Reporter, presets: unknown, byId: Map<string, Control>): void {
  if (presets === undefined) return;
  if (!Array.isArray(presets)) return void rep.add("type-invalid", "presets", { field: "presets", expected: "list", got: show(presets) });
  presets.forEach((raw, i) => {
    const path = `presets[${i}]`;
    if (!isObj(raw)) return void rep.add("type-invalid", path, { field: path, expected: "object", got: show(raw) });
    checkKeys(rep, raw, PRESET_KEYS, path);
    if (!hasText(raw["label"])) rep.add("preset-label-missing", `${path}.label`);
    if (!hasText(raw["note"])) rep.add("preset-note-missing", `${path}.note`);
    const values = raw["values"];
    if (values !== undefined && !isObj(values)) rep.add("type-invalid", `${path}.values`, { field: "values", expected: "object", got: show(values) });
    const entries = isObj(values) ? Object.entries(values) : [];
    for (const [param, v] of entries) {
      const at = `${path}.values.${param}`;
      const c = byId.get(param);
      if (!c) {
        rep.add("preset-unknown-param", at, { param, suggest: closest(param, [...byId.keys()]) ?? "" });
        continue;
      }
      if (!isNum(v)) {
        rep.add("preset-value-invalid", at, { param, got: show(v) });
        continue;
      }
      const t = c.travel;
      if (!t) continue;
      if (v < t.min || v > t.max) rep.add("preset-value-out-of-range", at, { param, value: v, min: t.min, max: t.max, shown: shown(t, v) });
      else if (offStep(t, v)) rep.add("preset-value-off-step", at, { param, value: v, min: t.min, step: t.step, shown: shown(t, v) });
    }
    const press = raw["press"];
    if (press !== undefined && !Array.isArray(press)) rep.add("type-invalid", `${path}.press`, { field: "press", expected: "list", got: show(press) });
    const pressed = Array.isArray(press) ? press : [];
    pressed.forEach((id, j) => {
      if (typeof id !== "string" || byId.get(id)?.kind !== "action") rep.add("preset-press-invalid", `${path}.press[${j}]`, { param: show(id).replace(/^"|"$/g, "") });
    });
    if (!entries.length && !pressed.length && !raw["reset"]) rep.add("preset-no-effect", path);
  });
}

/** La lectura: `{param}` debe nombrar un parámetro y, con los valores iniciales puestos, debe caber en la tarjeta. */
export function validateReadout(rep: Reporter, readout: unknown, params: unknown, byId: Map<string, Control>): void {
  const initial = new Map<string, string>();
  if (Array.isArray(params)) for (const p of params) if (isObj(p) && typeof p["id"] === "string") initial.set(p["id"], String(p["value"] ?? 0));
  for (const { text, path } of variants(readout, "readout")) {
    for (const m of text.matchAll(/\{([^{}]+)\}/g)) {
      if (!byId.has(m[1])) rep.add("readout-unknown-param", path, { param: m[1] });
    }
    const filled = [...initial].reduce((s, [id, v]) => s.replaceAll(`{${id}}`, v), text);
    if (filled.length > READOUT_MAX) rep.add("readout-long", path, { length: filled.length, max: READOUT_MAX });
  }
}
