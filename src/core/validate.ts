import type { Issue } from "./issues.ts";
import { validatePalette } from "./palette/validate.ts";
import { validateBind, validateParams, validatePresets, validateReadout } from "./validate-controls.ts";
import { validateMap, validateTracks } from "./validate-map.ts";
import { validateParts } from "./validate-parts.ts";
import { validateTree } from "./validate-tree.ts";
import type { Catalog } from "./tree.ts";
import {
  CAMERA_KEYS, FIGURE_KEYS, GROUP_KEYS, MOTION_KEYS, PLANES, SPIN_KEYS,
  checkKeys, checkVector, hasText, isNum, isObj, listOf, reporter, show, type Reporter,
} from "./validate-shared.ts";

export interface ValidateOptions {
  /** Idioma de los mensajes: `en` (por defecto) o `es`. El `code` no cambia con él. */
  lang?: string;
  /** El catálogo para `use` (por defecto, el de `isofig/kit`). */
  catalog?: Catalog;
}

function checkFigure(rep: Reporter, spec: Record<string, unknown>): void {
  checkKeys(rep, spec, FIGURE_KEYS, "");
  const id = spec["id"];
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(id)) rep.add("id-invalid", "id", { id: show(id).replace(/^"|"$/g, "") });
  if (!hasText(spec["title"])) rep.add("title-missing", "title");
  if (!hasText(spec["alt"]) && !hasText(spec["caption"])) rep.add("alt-missing", "alt");

  for (const f of ["width", "height"]) {
    const v = spec[f];
    if (v !== undefined && !(isNum(v) && v > 0)) rep.add("dimension-invalid", f, { field: f, expected: "positive", got: show(v) });
  }
  const { width, height, pad } = spec;
  if (pad !== undefined) {
    const side = Math.min(isNum(width) ? width : 640, isNum(height) ? height : 400);
    if (!isNum(pad) || pad < 0) rep.add("dimension-invalid", "pad", { field: "pad", expected: "non-negative", got: show(pad) });
    else if (pad * 2 >= side) rep.add("dimension-invalid", "pad", { field: "pad", expected: "below-half", got: pad });
  }

  const camera = spec["camera"];
  if (camera !== undefined) {
    if (!isObj(camera)) rep.add("type-invalid", "camera", { field: "camera", expected: "object", got: show(camera) });
    else {
      checkKeys(rep, camera, CAMERA_KEYS, "camera");
      for (const f of CAMERA_KEYS) if (camera[f] !== undefined && !isNum(camera[f])) rep.add("camera-invalid", `camera.${f}`, { field: f, got: show(camera[f]) });
    }
  }

  const motion = spec["motion"];
  if (motion !== undefined) {
    if (!isObj(motion)) rep.add("type-invalid", "motion", { field: "motion", expected: "object", got: show(motion) });
    else {
      checkKeys(rep, motion, MOTION_KEYS, "motion");
      const { tau, settle } = motion;
      if (tau !== undefined && !(isNum(tau) && tau > 0)) rep.add("motion-invalid", "motion.tau", { field: "motion.tau", expected: "seconds", got: show(tau) });
      if (settle !== undefined && !(isNum(settle) && settle >= 0)) rep.add("motion-invalid", "motion.settle", { field: "motion.settle", expected: "non-negative", got: show(settle) });
    }
  }
  const budget = spec["budget"];
  if (budget !== undefined && !(isNum(budget) && budget > 0)) rep.add("budget-invalid", "budget", { got: show(budget) });
  const model = spec["model"];
  if (model !== undefined && (typeof model !== "string" || model === "")) rep.add("model-name-invalid", "model", { got: show(model) });
  if (spec["autoplay"] === true && !model && !spec["tracks"] && !spec["map"]) rep.add("autoplay-without-model", "autoplay");
}

function checkGroups(rep: Reporter, groups: unknown, used: Set<string> | undefined): Set<string> {
  const spins = new Set<string>();
  if (groups === undefined) return spins;
  if (!isObj(groups)) {
    rep.add("type-invalid", "groups", { field: "groups", expected: "object", got: show(groups) });
    return spins;
  }
  const unused: string[] = [];
  for (const [name, def] of Object.entries(groups)) {
    const path = `groups.${name}`;
    if (!isObj(def)) {
      rep.add("type-invalid", path, { field: path, expected: "object", got: show(def) });
      continue;
    }
    checkKeys(rep, def, GROUP_KEYS, path);
    if (used && !used.has(name)) unused.push(name);
    const extent = def["extent"];
    if (extent !== undefined) {
      if (!Array.isArray(extent)) rep.add("type-invalid", `${path}.extent`, { field: "extent", expected: "list", got: show(extent) });
      else for (let j = 0; j < extent.length; j++) checkVector(rep, extent[j], `${path}.extent[${j}]`, `extent[${j}]`);
    }
    const spin = def["spin"];
    if (spin === undefined) continue;
    if (!isObj(spin)) {
      rep.add("type-invalid", `${path}.spin`, { field: "spin", expected: "object", got: show(spin) });
      continue;
    }
    checkKeys(rep, spin, SPIN_KEYS, `${path}.spin`);
    if (spin["center"] === undefined) rep.add("field-missing", `${path}.spin.center`, { id: name, kind: "spin", field: "center" });
    else checkVector(rep, spin["center"], `${path}.spin.center`, "center");
    if (!PLANES.includes(spin["plane"] as never)) rep.add("spin-plane-invalid", `${path}.spin.plane`, { group: name, got: show(spin["plane"]).replace(/^"|"$/g, ""), expected: PLANES.join(", ") });
    else spins.add(name);
  }
  if (unused.length) rep.add("group-unused", "groups", { count: unused.length, list: listOf(unused) });
  return spins;
}

/**
 * Revisa una spec sin dibujarla y devuelve lo que está mal, con un `code` estable y el `path` del campo
 * (`parts[3].size`). No usa dependencias y corre en el navegador.
 *
 * Solo son `error` los casos que rompen el dibujo (un `NaN` en una coordenada, una medida negativa, un `kind`
 * desconocido, ids repetidos, una pieza sin un campo obligatorio); todo lo demás es `warning`.
 */
export function validateSpec(spec: unknown, options: ValidateOptions = {}): Issue[] {
  const { rep, issues } = reporter(options.lang ?? "en");
  if (!isObj(spec)) {
    rep.add("spec-not-object", "");
    return issues;
  }
  checkFigure(rep, spec);

  // Con un árbol anidado o un mapa, las piezas salen de ahí y se aplanan al compilar: no se miran aquí.
  const generated = spec["root"] !== undefined || spec["map"] !== undefined;
  const parts = spec["parts"];
  let groups: Set<string> | undefined;
  if (parts === undefined) {
    if (!generated) rep.add("parts-missing", "parts");
  } else if (!Array.isArray(parts)) rep.add("type-invalid", "parts", { field: "parts", expected: "list", got: show(parts) });
  else {
    if (!parts.length && !generated) rep.add("parts-empty", "parts");
    groups = validateParts(rep, parts).groups;
  }
  const spins = checkGroups(rep, spec["groups"], generated ? undefined : groups);
  // El árbol: su forma, sus `use` y sus referencias. Los controles que añade el despiece también se pueden nombrar.
  const added = validateTree(rep, spec, options.catalog);
  const byId = validateParams(rep, spec["params"]);
  for (const id of added) if (!byId.has(id)) byId.set(id, { id, kind: id === "pick" ? "choice" : "range" });
  validateBind(rep, spec["bind"], byId, generated ? undefined : groups, spins, Boolean(spec["model"]));
  validatePresets(rep, spec["presets"], byId);
  validateTracks(rep, spec["tracks"], generated ? undefined : groups);
  if (spec["map"] !== undefined) validateMap(rep, spec["map"]);
  validateReadout(rep, spec["readout"], spec["params"], byId);
  validatePalette(rep, spec);
  return issues;
}
