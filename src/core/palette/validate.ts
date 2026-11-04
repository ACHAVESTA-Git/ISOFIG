import { closest, isObj, show, type Reporter } from "../validate-shared.ts";
import { parseColor } from "./color.ts";
import { customPaints, isReserved, PAINT_NAME } from "./paint.ts";
import { PAINT } from "./sets.ts";

const NAMES = [...PAINT.keys()];

/**
 * `paint` y `palette` en `validateSpec`: una pintura que no está en ningún juego ni en `palette.use`, un color de
 * estado usado como pintura, una `palette.base` que no es un color y nombres inválidos en `palette.use`.
 */
export function validatePalette(rep: Reporter, spec: Record<string, unknown>): void {
  const palette = spec["palette"];
  if (palette !== undefined && !isObj(palette)) {
    rep.add("type-invalid", "palette", { field: "palette", expected: "object", got: show(palette) });
  } else if (palette) {
    const base = palette["base"];
    if (base !== undefined && !isColor(base)) rep.add("palette-base-invalid", "palette.base", { got: show(base) });
    const use = palette["use"];
    if (use !== undefined && !Array.isArray(use)) rep.add("type-invalid", "palette.use", { field: "palette.use", expected: "list", got: show(use) });
    else if (Array.isArray(use)) {
      use.forEach((n, i) => {
        if (typeof n !== "string" || !PAINT_NAME.test(n)) rep.add("palette-use-invalid", `palette.use[${i}]`, { got: show(n) });
        else if (isReserved(n)) rep.add("paint-is-state", `palette.use[${i}]`, { id: "palette.use", paint: n });
      });
    }
  }
  const custom = customPaints(spec as { palette?: { use?: string[] } });
  const visit = (v: unknown, path: string): void => {
    if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${path}[${i}]`));
    if (!isObj(v)) return;
    if ("paint" in v) checkPaint(rep, v["paint"], `${path}.paint`, typeof v["id"] === "string" ? v["id"] : path, custom);
    for (const k of ["parts", "children"]) if (k in v) visit(v[k], `${path}.${k}`);
  };
  visit(spec["parts"], "parts");
  visit(spec["root"], "root");
  const defs = spec["defs"];
  if (isObj(defs)) for (const [k, node] of Object.entries(defs)) visit(node, `defs.${k}`);
}

function checkPaint(rep: Reporter, paint: unknown, path: string, id: string, custom: Set<string>): void {
  if (typeof paint !== "string") return void rep.add("type-invalid", path, { field: "paint", expected: "text", got: show(paint) });
  if (PAINT.has(paint) || custom.has(paint)) return;
  if (isReserved(paint)) return void rep.add("paint-is-state", path, { id, paint });
  rep.add("paint-unknown", path, { id, paint, suggest: closest(paint, NAMES) ?? "" });
}

function isColor(v: unknown): boolean {
  if (typeof v !== "string") return false;
  try {
    parseColor(v);
    return true;
  } catch {
    return false;
  }
}
