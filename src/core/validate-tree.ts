import { copiesOf, copyId, isSolid } from "./items.ts";
import type { FigureSpec } from "./spec.ts";
import { assembleTree, type Catalog } from "./tree.ts";
import { catalog as kit } from "../kit/index.ts";
import { checkPart, checkRepeat } from "./validate-parts.ts";
import { NODE_KEYS, SOLIDS, TONES, checkKeys, checkVector, closest, hasText, isNum, isObj, show, type Reporter } from "./validate-shared.ts";

/** Los ids de cada copia de una lista (nodos o piezas), con el índice de la lista de donde sale. */
function copyIds(list: Record<string, unknown>[]): { id: string; k: number }[] {
  return list.flatMap((x, k) => {
    if (typeof x["id"] !== "string" || x["id"] === "") return [];
    const r = isObj(x["repeat"]) && isNum(x["repeat"]["count"]) ? (x["repeat"] as { count: number; from?: number }) : undefined;
    const spec = { id: x["id"], repeat: r ? { count: Math.min(r.count, 5000), from: isNum(r.from) ? r.from : undefined } : undefined };
    return copiesOf(spec).map(({ i }) => ({ id: copyId(spec, i), k }));
  });
}

/** ¿Hay algo que se desarme en este subárbol (o un `use` que podría traerlo)? */
function moves(node: Record<string, unknown>): boolean {
  if (node["explode"] !== undefined || node["use"] !== undefined) return true;
  return Array.isArray(node["children"]) && node["children"].some((c) => isObj(c) && moves(c));
}

function checkNode(rep: Reporter, node: unknown, path: string, def: boolean): void {
  if (!isObj(node)) return void rep.add("type-invalid", path, { field: path, expected: "object", got: show(node) });
  checkKeys(rep, node, NODE_KEYS, path);
  const id = node["id"];
  if (!def && (typeof id !== "string" || id === "")) rep.add("node-id-missing", `${path}.id`);
  else if (def && id !== undefined && typeof id !== "string") rep.add("type-invalid", `${path}.id`, { field: "id", expected: "text", got: show(id) });
  const name = typeof id === "string" ? id : path;
  for (const f of ["name", "note", "step"]) {
    if (node[f] !== undefined && !hasText(node[f])) rep.add("type-invalid", `${path}.${f}`, { field: f, expected: "text", got: show(node[f]) });
  }
  for (const f of ["at", "explode"]) if (node[f] !== undefined) checkVector(rep, node[f], `${path}.${f}`, f);
  const stage = node["stage"];
  if (stage !== undefined && !isNum(stage)) rep.add("stage-invalid", `${path}.stage`, { got: show(stage) });
  else if (stage !== undefined && !def && !moves(node)) rep.add("stage-without-explode", `${path}.stage`, { id: name });
  if (node["repeat"] !== undefined) checkRepeat(rep, node["repeat"], `${path}.repeat`, name);
  const use = node["use"];
  if (use !== undefined && (typeof use !== "string" || use === "")) rep.add("type-invalid", `${path}.use`, { field: "use", expected: "name", got: show(use) });
  if (node["with"] !== undefined && !isObj(node["with"])) rep.add("type-invalid", `${path}.with`, { field: "with", expected: "object", got: show(node["with"]) });
  const tone = node["tone"];
  if (tone !== undefined && !TONES.includes(tone as never)) rep.add("option-invalid", `${path}.tone`, { field: "tone", got: show(tone).replace(/^"|"$/g, ""), expected: TONES.join(", ") });
  if (node["paint"] !== undefined && typeof node["paint"] !== "string") rep.add("type-invalid", `${path}.paint`, { field: "paint", expected: "text", got: show(node["paint"]) });
  const mount = node["mount"];
  if (mount !== undefined && (!Array.isArray(mount) || mount.some((m) => typeof m !== "string"))) rep.add("type-invalid", `${path}.mount`, { field: "mount", expected: "list", got: show(mount) });

  const parts = node["parts"];
  if (parts !== undefined) {
    if (!Array.isArray(parts)) rep.add("type-invalid", `${path}.parts`, { field: "parts", expected: "list", got: show(parts) });
    else {
      const solids: Record<string, unknown>[] = [];
      parts.forEach((p, j) => {
        if (!isObj(p)) return void rep.add("type-invalid", `${path}.parts[${j}]`, { field: `parts[${j}]`, expected: "object", got: show(p) });
        const kind = checkPart(rep, p, `${path}.parts[${j}]`);
        solids.push(kind && SOLIDS.includes(kind) ? p : {});
      });
      const seen = new Map<string, number>();
      for (const { id: pid, k } of copyIds(solids)) {
        const first = seen.get(pid);
        if (first === undefined) seen.set(pid, k);
        else rep.add("id-duplicate", `${path}.parts[${k}].id`, { id: pid, first: `${path}.parts[${first}]`, more: 0 });
      }
    }
  }
  const children = node["children"];
  if (children === undefined) return;
  if (!Array.isArray(children)) return void rep.add("type-invalid", `${path}.children`, { field: "children", expected: "list", got: show(children) });
  children.forEach((c, k) => checkNode(rep, c, `${path}.children[${k}]`, false));
  // Dos hermanos con el mismo id (también entre copias de un `repeat`) darían a sus piezas los mismos ids.
  const seen = new Map<string, number>();
  for (const { id: cid, k } of copyIds(children.filter(isObj))) {
    const first = seen.get(cid);
    if (first === undefined) seen.set(cid, k);
    else rep.add("node-id-duplicate", `${path}.children[${k}].id`, { id: cid, first: `${path}.children[${first}]` });
  }
}

/**
 * Revisa `root` y `defs`: la forma de cada nodo y de sus piezas (con `path` como `root.children[2].parts[0]`), los `use`
 * que no existen o se llaman a sí mismos y, ya armado el árbol, las referencias `on` y `mount` que no se resuelven.
 * Devuelve los ids de los controles que añade el despiece, para que la lectura y los desvíos puedan nombrarlos.
 */
export function validateTree(rep: Reporter, spec: Record<string, unknown>, catalog?: Catalog): string[] {
  const root = spec["root"];
  const defs = spec["defs"];
  if (root === undefined && defs === undefined) return [];
  if (defs !== undefined) {
    if (!isObj(defs)) rep.add("type-invalid", "defs", { field: "defs", expected: "object", got: show(defs) });
    else for (const [name, d] of Object.entries(defs)) checkNode(rep, d, `defs.${name}`, true);
  }
  if (root === undefined) return [];
  if (!isObj(root)) {
    rep.add("type-invalid", "root", { field: "root", expected: "object", got: show(root) });
    return [];
  }
  checkNode(rep, root, "root", false);
  if (root["explode"] !== undefined) rep.add("explode-on-root", "root.explode");

  let tree: ReturnType<typeof assembleTree>;
  try {
    tree = assembleTree(spec as unknown as FigureSpec, { catalog: catalog ?? (kit as Catalog) });
  } catch {
    // Un árbol tan roto que no se arma ya tiene sus errores de forma arriba.
    return [];
  }
  const names = [...Object.keys(isObj(defs) ? defs : {}), ...Object.keys(catalog ?? kit)];
  for (const e of tree.errors) {
    rep.add(e.code, e.path, { ...e.vars, ...(e.code === "use-unknown" ? { suggest: closest(e.vars["use"] ?? "", names) ?? "" } : {}) });
  }

  // Las referencias, ya resueltas por ámbitos: una que no se encontró se quedó tal como la escribió el autor.
  const flat = tree.spec.parts;
  const solids = new Set(flat.filter(isSolid).map((p) => p.id));
  const details = new Set(flat.filter((p) => !isSolid(p)).map((p) => p.id));
  for (const p of flat) {
    const src = tree.sources.get(p);
    if (!src || src.startsWith("parts[")) continue;
    if ("on" in p && typeof p.on === "string" && !solids.has(p.on)) rep.add(details.has(p.on) ? "on-not-solid" : "on-unknown", `${src}.on`, { id: p.id, on: p.on });
    if (Array.isArray(p.mount)) {
      p.mount.forEach((m, j) => {
        if (typeof m === "string" && !solids.has(m)) rep.add("mount-unknown", `${src}.mount[${j}]`, { id: p.id, mount: m });
      });
    }
  }
  const own = new Set(Array.isArray(spec["params"]) ? spec["params"].filter(isObj).map((p) => p["id"]) : []);
  return (tree.spec.params ?? []).map((p) => p.id).filter((id) => !own.has(id));
}
