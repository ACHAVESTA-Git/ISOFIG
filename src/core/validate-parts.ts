import { copiesOf, copyId, fillIndex } from "./items.ts";
import {
  KINDS, MAX_COUNT, PART_KEYS, REPEAT_KEYS, REQUIRED, SOLIDS, TONES,
  checkKeys, checkVector, hasText, isNum, isObj, show, words, type Reporter,
} from "./validate-shared.ts";

export interface PartsInfo {
  /** Los grupos que tienen las piezas sólidas, ya repetidas. */
  groups: Set<string>;
}

const AXES = ["x", "y", "z"];
const FACES = ["top", "x", "y"];
const ALIGNS = ["start", "middle", "end"];

/** Un número positivo de medida (`size`, `r`, `h`): negativo es error, cero es aviso. */
function checkSize(rep: Reporter, v: unknown, path: string, field: string, id: string): void {
  if (!isNum(v)) return void rep.add("number-invalid", path, { field, got: show(v) });
  if (v < 0) rep.add("size-negative", path, { id, field, got: v });
  else if (v === 0) rep.add("size-zero", path, { id, field });
}

function checkOptional(rep: Reporter, v: unknown, path: string, field: string, id: string): void {
  if (v === undefined) return;
  if (!isNum(v)) return void rep.add("number-invalid", path, { field, got: show(v) });
  if (v < 0) rep.add("number-negative", path, { id, field, got: v });
}

/** `x`, `y` o `z`; un cilindro o un cono admiten además una dirección cualquiera (`[1, 0, 1]`), que no sea cero. */
function checkAxis(rep: Reporter, axis: unknown, path: string, vector: boolean): void {
  if (vector && Array.isArray(axis)) {
    if (checkVector(rep, axis, path, "axis") && axis.every((v) => v === 0)) rep.add("axis-zero", path);
    return;
  }
  if (!AXES.includes(axis as string)) {
    rep.add("option-invalid", path, { field: "axis", got: show(axis).replace(/^"|"$/g, ""), expected: vector ? `${AXES.join(", ")}, [x, y, z]` : AXES.join(", ") });
  }
}

function checkPlan(rep: Reporter, plan: unknown, path: string, id: string, oriented = true): void {
  if (!Array.isArray(plan)) return void rep.add("type-invalid", path, { field: "plan", expected: "list", got: show(plan) });
  if (plan.length < 3) rep.add("prism-plan-short", path, { id, got: plan.length });
  let ok = plan.length >= 3;
  for (let j = 0; j < plan.length; j++) if (!checkVector(rep, plan[j], `${path}[${j}]`, `plan[${j}]`, 2)) ok = false;
  if (!ok) return;
  const pts = plan as [number, number][];
  let area2 = 0;
  for (let j = 0; j < pts.length; j++) {
    const [x0, y0] = pts[j];
    const [x1, y1] = pts[(j + 1) % pts.length];
    area2 += x0 * y1 - x1 * y0;
  }
  if (Math.abs(area2) < 1e-9) return void rep.add("prism-degenerate", path, { id });
  if (area2 < 0 && oriented) rep.add("prism-clockwise", path, { id });
  // Convexa: todos los giros van hacia el mismo lado que el área (se toleran los tramos rectos).
  const sign = Math.sign(area2);
  const concave = pts.some((a, j) => {
    const b = pts[(j + 1) % pts.length];
    const c = pts[(j + 2) % pts.length];
    return Math.sign((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) === -sign;
  });
  if (concave) rep.add("prism-concave", path, { id });
}

/** Cuántas copias o marcas: un entero positivo; si pasa de `MAX_COUNT`, el dibujo no termina. */
function checkCount(rep: Reporter, count: unknown, path: string, field: string, id: string): void {
  if (typeof count === "number" && count > MAX_COUNT) rep.add("count-too-large", path, { id, field, got: count, max: MAX_COUNT });
  else if (!isNum(count) || !Number.isInteger(count) || count < 1) rep.add("count-invalid", path, { id, field, got: show(count) });
}

export function checkRepeat(rep: Reporter, r: unknown, path: string, id: string): void {
  if (!isObj(r)) return void rep.add("type-invalid", path, { field: "repeat", expected: "object", got: show(r) });
  checkKeys(rep, r, REPEAT_KEYS, path);
  const { count, step, from } = r;
  checkCount(rep, count, `${path}.count`, "repeat.count", id);
  if (step === undefined) rep.add("field-missing", `${path}.step`, { id, kind: "repeat", field: "step" });
  else checkVector(rep, step, `${path}.step`, "repeat.step");
  if (from !== undefined && !(isNum(from) && Number.isInteger(from))) rep.add("repeat-from-invalid", `${path}.from`, { id, got: show(from) });
}

/** Valida una pieza suelta. Devuelve su `kind` si es uno conocido (las demás comprobaciones solo corren con esas). */
export function checkPart(rep: Reporter, p: Record<string, unknown>, path: string): string | undefined {
  const id = typeof p["id"] === "string" && p["id"] !== "" ? p["id"] : path;
  if (typeof p["id"] !== "string" || p["id"] === "") rep.add("part-id-missing", `${path}.id`);
  const kind = p["kind"];
  if (kind === undefined || typeof kind !== "string" || !KINDS.includes(kind)) {
    if (kind === undefined) rep.add("kind-missing", `${path}.kind`, { id, kinds: KINDS.join(", ") });
    else rep.add("kind-unknown", `${path}.kind`, { id, kind: show(kind).replace(/^"|"$/g, ""), kinds: KINDS.join(", ") });
    // Aunque la pieza no se dibuje, un `repeat` disparatado se dice (no hay otro modo de saber que está mal).
    if (p["repeat"] !== undefined) checkRepeat(rep, p["repeat"], `${path}.repeat`, id);
    return;
  }
  checkKeys(rep, p, PART_KEYS[kind as keyof typeof PART_KEYS], path);
  for (const field of REQUIRED[kind]) if (p[field] === undefined) rep.add("field-missing", `${path}.${field}`, { id, kind, field });
  const has = (f: string) => p[f] !== undefined;

  if (kind === "box") {
    if (has("at")) checkVector(rep, p["at"], `${path}.at`, "at");
    if (has("size") && checkVector(rep, p["size"], `${path}.size`, "size")) {
      for (let j = 0; j < 3; j++) checkSize(rep, (p["size"] as number[])[j], `${path}.size[${j}]`, `size[${j}]`, id);
    }
    checkOptional(rep, p["radius"], `${path}.radius`, "radius", id);
    checkOptional(rep, p["bevel"], `${path}.bevel`, "bevel", id);
  } else if (kind === "cylinder" || kind === "cone") {
    if (has("at")) checkVector(rep, p["at"], `${path}.at`, "at");
    for (const f of ["r", "h"]) if (has(f)) checkSize(rep, p[f], `${path}.${f}`, f, id);
    // El otro extremo de un cono puede ser una punta (0).
    if (kind === "cone") checkOptional(rep, p["r2"], `${path}.r2`, "r2", id);
    if (has("axis")) checkAxis(rep, p["axis"], `${path}.axis`, true);
    checkOptional(rep, p["bevel"], `${path}.bevel`, "bevel", id);
  } else if (kind === "prism") {
    if (has("axis")) checkAxis(rep, p["axis"], `${path}.axis`, false);
    // Con `axis` en x o y la planta se orienta sola: el sentido no importa.
    if (has("plan")) checkPlan(rep, p["plan"], `${path}.plan`, id, !has("axis") || p["axis"] === "z");
    if (has("z") && !isNum(p["z"])) rep.add("number-invalid", `${path}.z`, { field: "z", got: show(p["z"]) });
    if (has("h")) checkSize(rep, p["h"], `${path}.h`, "h", id);
    checkOptional(rep, p["bevel"], `${path}.bevel`, "bevel", id);
  } else {
    if (has("on") && (typeof p["on"] !== "string" || p["on"] === "")) rep.add("type-invalid", `${path}.on`, { field: "on", expected: "name", got: show(p["on"]) });
    if (kind === "ticks") {
      for (const f of words("from along toward")) if (has(f)) checkVector(rep, p[f], `${path}.${f}`, f);
      if (has("count")) checkCount(rep, p["count"], `${path}.count`, "count", id);
      if (p["every"] !== undefined && !(isNum(p["every"]) && p["every"] > 0)) rep.add("number-invalid", `${path}.every`, { field: "every", got: show(p["every"]) });
      const size = p["size"];
      if (size !== undefined) checkVector(rep, size, `${path}.size`, "size", 2);
    } else if (kind === "dots" || kind === "line") {
      const pts = p["points"];
      if (has("points")) {
        if (!Array.isArray(pts)) rep.add("type-invalid", `${path}.points`, { field: "points", expected: "list", got: show(pts) });
        else for (let j = 0; j < pts.length; j++) checkVector(rep, pts[j], `${path}.points[${j}]`, `points[${j}]`);
      }
    } else {
      if (has("at")) checkVector(rep, p["at"], `${path}.at`, "at");
      if (!hasText(p["text"])) rep.add("label-text-missing", `${path}.text`, { id });
      const size = p["size"];
      if (size !== undefined) {
        if (!isNum(size)) rep.add("number-invalid", `${path}.size`, { field: "size", got: show(size) });
        else if (size <= 0) rep.add("label-size-invalid", `${path}.size`, { id, got: size });
      }
      if (has("face") && !FACES.includes(p["face"] as string)) rep.add("option-invalid", `${path}.face`, { field: "face", got: show(p["face"]).replace(/^"|"$/g, ""), expected: FACES.join(", ") });
      if (has("align") && !ALIGNS.includes(p["align"] as string)) rep.add("option-invalid", `${path}.align`, { field: "align", got: show(p["align"]).replace(/^"|"$/g, ""), expected: ALIGNS.join(", ") });
    }
  }

  if (has("tone") && !TONES.includes(p["tone"] as never)) rep.add("option-invalid", `${path}.tone`, { field: "tone", got: show(p["tone"]).replace(/^"|"$/g, ""), expected: TONES.join(", ") });
  if (has("repeat")) checkRepeat(rep, p["repeat"], `${path}.repeat`, id);
  if (has("group") && typeof p["group"] !== "string") rep.add("type-invalid", `${path}.group`, { field: "group", expected: "text", got: show(p["group"]) });
  if (has("mount")) {
    const m = p["mount"];
    if (!Array.isArray(m) || m.some((x) => typeof x !== "string")) rep.add("type-invalid", `${path}.mount`, { field: "mount", expected: "list", got: show(m) });
  }
  return kind;
}

/**
 * Valida las piezas y comprueba, ya repetidas, que los ids no choquen y que `on` y `mount` apunten a piezas que
 * existen. Las copias de un `repeat` se resuelven con las mismas funciones que usa el dibujo (`copiesOf`, `copyId`).
 */
export function validateParts(rep: Reporter, parts: unknown[]): PartsInfo {
  const valid: { p: Record<string, unknown>; idx: number; kind: string }[] = [];
  parts.forEach((raw, idx) => {
    const path = `parts[${idx}]`;
    if (!isObj(raw)) return void rep.add("type-invalid", path, { field: path, expected: "object", got: show(raw) });
    const kind = checkPart(rep, raw, path);
    if (kind && typeof raw["id"] === "string" && raw["id"] !== "") valid.push({ p: raw, idx, kind });
  });

  // Los ids de cada copia. Si el `repeat` está mal formado (ya se avisó), la pieza cuenta como una sola copia.
  const copies = valid.map(({ p, idx, kind }) => {
    const repeat = isObj(p["repeat"]) && isNum(p["repeat"]["count"]) ? (p["repeat"] as { count: number; from?: number }) : undefined;
    const from = repeat && isNum(repeat.from) ? repeat.from : undefined;
    const spec = { id: p["id"] as string, repeat: repeat ? { count: Math.min(repeat.count, MAX_COUNT), from } : undefined };
    return { p, idx, kind, ids: copiesOf(spec).map(({ i }) => ({ i, id: copyId(spec, i) })) };
  });

  // Los ids de las piezas sólidas son los que `on` y `mount` buscan: repetidos, una pieza tapa a la otra. Los de los
  // detalles solo sirven para nombrarlos y pueden repetirse.
  const solids = new Map<string, number>();
  const groups = new Set<string>();
  for (const { p, idx, kind, ids } of copies) {
    if (!SOLIDS.includes(kind)) continue;
    let dup: { id: string; first: number } | undefined;
    let more = 0;
    for (const { i, id } of ids) {
      const before = solids.get(id);
      if (before === undefined) solids.set(id, idx);
      else if (dup) more++;
      else dup = { id, first: before };
      if (typeof p["group"] === "string") groups.add(fillIndex(p["group"], i)!);
    }
    if (dup) rep.add("id-duplicate", `parts[${idx}].id`, { id: dup.id, first: `parts[${dup.first}]`, more });
  }
  const detailIds = new Set(copies.filter((c) => !SOLIDS.includes(c.kind)).flatMap((c) => c.ids.map((x) => x.id)));

  for (const { p, idx, kind, ids } of copies) {
    const path = `parts[${idx}]`;
    if (!SOLIDS.includes(kind) && typeof p["on"] === "string") {
      for (const { i, id } of ids) {
        const on = fillIndex(p["on"], i)!;
        if (solids.has(on)) continue;
        rep.add(detailIds.has(on) ? "on-not-solid" : "on-unknown", `${path}.on`, { id, on });
        break;
      }
      if (typeof p["group"] === "string") rep.add("group-ignored", `${path}.group`, { id: p["id"] as string, on: p["on"] });
    }
    if (Array.isArray(p["mount"])) {
      (p["mount"] as unknown[]).forEach((m, j) => {
        if (typeof m !== "string") return;
        for (const { i, id } of ids) {
          if (solids.has(fillIndex(m, i)!)) continue;
          rep.add("mount-unknown", `${path}.mount[${j}]`, { id, mount: fillIndex(m, i)! });
          break;
        }
      });
    }
  }
  return { groups };
}
