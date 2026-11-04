import { GLYPHS, type LinkKind } from "./map/types.ts";
import { PAINT } from "./palette/sets.ts";
import { checkKeys, checkVector, isNum, isObj, show, words, type Reporter } from "./validate-shared.ts";

const TRACK_KEYS = ["group", "path", "period", "delay", "loop", "hide"] as const;

/** Los recorridos de `tracks`: qué grupo mueven, por dónde, cada cuánto. El grupo se comprueba al dibujar, con las piezas ya armadas. */
export function validateTracks(rep: Reporter, tracks: unknown, groups: Set<string> | undefined): void {
  if (tracks === undefined) return;
  if (!Array.isArray(tracks)) return void rep.add("type-invalid", "tracks", { field: "tracks", expected: "list", got: show(tracks) });
  tracks.forEach((t, i) => {
    const path = `tracks[${i}]`;
    if (!isObj(t)) return void rep.add("type-invalid", path, { field: path, expected: "object", got: show(t) });
    checkKeys(rep, t, TRACK_KEYS, path);
    const group = typeof t["group"] === "string" ? t["group"] : "";
    if (!group) rep.add("field-missing", `${path}.group`, { id: path, kind: "track", field: "group" });
    else if (groups && !groups.has(group)) rep.add("track-group-unknown", `${path}.group`, { group });
    const pts = t["path"];
    if (!Array.isArray(pts)) rep.add("track-path-short", `${path}.path`, { group, got: 0 });
    else {
      const ok = pts.map((p, j) => checkVector(rep, p, `${path}.path[${j}]`, `path[${j}]`));
      const good = pts.filter((_, j) => ok[j]) as number[][];
      const distinct = good.filter((p, j) => j === 0 || Math.hypot(p[0] - good[j - 1][0], p[1] - good[j - 1][1], p[2] - good[j - 1][2]) > 1e-6);
      if (distinct.length < 2 && ok.every(Boolean)) rep.add("track-path-short", `${path}.path`, { group, got: distinct.length });
    }
    if (!(isNum(t["period"]) && t["period"] > 0)) rep.add("track-period-invalid", `${path}.period`, { group, got: show(t["period"]) });
    if (t["delay"] !== undefined && !(isNum(t["delay"]) && t["delay"] >= 0)) rep.add("track-delay-invalid", `${path}.delay`, { group, got: show(t["delay"]) });
    if (t["loop"] !== undefined && typeof t["loop"] !== "boolean") rep.add("type-invalid", `${path}.loop`, { field: "loop", expected: "boolean", got: show(t["loop"]) });
  });
}

const MAP_KEYS = ["layout", "nodes", "links", "flows", "legend", "labelSize"] as const;
const NODE_KEYS = ["id", "is", "name", "paint", "children", "layout", "cell", "rank", "fields", "methods", "abstract", "stereotype", "explode"] as const;
const LINK_KEYS = words("from to label kind arrow dashed paint mult");
const FLOW_KEYS = ["id", "path", "label", "every", "speed", "delay", "paint"] as const;
const LAYOUTS = ["flow", "layers", "grid"];
const LINK_KINDS: LinkKind[] = ["link", "inherits", "implements", "composes", "aggregates", "depends", "associates"];
const ARROWS = ["end", "start", "both", "none"];
/** Los roles de color de un mapa y los materiales de la paleta: lo que puede pintar un nodo, una cinta o un paquete. */
const PAINTS = [...PAINT.keys()];

const option = (rep: Reporter, path: string, got: unknown, expected: readonly string[]) =>
  rep.add("option-invalid", path, { field: path.split(".").pop() ?? path, got: String(got), expected: expected.join(", ") });

function paintOf(rep: Reporter, v: unknown, path: string): void {
  if (v !== undefined && !(typeof v === "string" && PAINTS.includes(v))) rep.add("map-paint-unknown", path, { field: path, got: show(v).replace(/^"|"$/g, ""), known: PAINTS.join(", ") });
}

/** Los nodos de un nivel y, hacia adentro, los de sus hijos; devuelve los ids que ya se usaron. */
function nodesOf(rep: Reporter, list: unknown, path: string, seen: Map<string, string>, layout: string | undefined): void {
  if (!Array.isArray(list)) return void rep.add("type-invalid", path, { field: path, expected: "list", got: show(list) });
  const cells = new Map<string, string>();
  list.forEach((n, i) => {
    const here = `${path}[${i}]`;
    if (!isObj(n)) return void rep.add("type-invalid", here, { field: here, expected: "object", got: show(n) });
    checkKeys(rep, n, NODE_KEYS, here);
    const id = typeof n["id"] === "string" ? n["id"] : "";
    if (!id) rep.add("field-missing", `${here}.id`, { id: here, kind: "node", field: "id" });
    else if (seen.has(id)) rep.add("map-node-id-duplicate", `${here}.id`, { id, first: seen.get(id)! });
    else seen.set(id, here);
    const children = n["children"];
    const container = Array.isArray(children) && children.length > 0;
    if (!container && !(typeof n["is"] === "string" && (GLYPHS as readonly string[]).includes(n["is"]))) {
      rep.add("map-glyph-unknown", `${here}.is`, { id: id || here, got: show(n["is"]).replace(/^"|"$/g, ""), known: GLYPHS.join(", ") });
    }
    paintOf(rep, n["paint"], `${here}.paint`);
    const own = n["layout"] === undefined ? layout : String(n["layout"]);
    if (n["layout"] !== undefined && !LAYOUTS.includes(String(n["layout"]))) option(rep, `${here}.layout`, show(n["layout"]), LAYOUTS);
    const cell = n["cell"];
    if (cell !== undefined) {
      if (checkVector(rep, cell, `${here}.cell`, "cell", 2)) {
        const key = (cell as number[]).join(",");
        if (layout === "grid" && cells.has(key)) rep.add("map-cell-collision", `${here}.cell`, { id: id || here, first: cells.get(key)! });
        else cells.set(key, id || here);
      }
    }
    if (children !== undefined) nodesOf(rep, children, `${here}.children`, seen, own);
  });
}

function endsOf(rep: Reporter, v: unknown, path: string, ids: Set<string>): void {
  const list = typeof v === "string" ? [v] : Array.isArray(v) ? v : undefined;
  if (!list || !list.length) return void rep.add("type-invalid", path, { field: path.split(".").pop() ?? path, expected: "name", got: show(v) });
  list.forEach((id, k) => {
    if (typeof id !== "string" || !ids.has(id)) rep.add("map-node-unknown", Array.isArray(v) ? `${path}[${k}]` : path, { field: path.replace(/^map\./, ""), id: typeof id === "string" ? id : show(id) });
  });
}

/** El mapa de la spec: nodos con su catálogo, enlaces y flujos que nombran nodos que existen. */
export function validateMap(rep: Reporter, map: unknown): void {
  if (!isObj(map)) return void rep.add("type-invalid", "map", { field: "map", expected: "object", got: show(map) });
  checkKeys(rep, map, MAP_KEYS, "map");
  const layout = map["layout"] === undefined ? "flow" : String(map["layout"]);
  if (!LAYOUTS.includes(layout)) option(rep, "map.layout", show(map["layout"]), LAYOUTS);
  if (map["legend"] !== undefined && typeof map["legend"] !== "boolean") rep.add("type-invalid", "map.legend", { field: "legend", expected: "boolean", got: show(map["legend"]) });
  if (map["labelSize"] !== undefined && !(isNum(map["labelSize"]) && map["labelSize"] > 0)) rep.add("number-invalid", "map.labelSize", { field: "labelSize", got: show(map["labelSize"]) });
  const seen = new Map<string, string>();
  nodesOf(rep, map["nodes"] ?? [], "map.nodes", seen, layout);
  const ids = new Set(seen.keys());

  const links = map["links"];
  if (links !== undefined && !Array.isArray(links)) rep.add("type-invalid", "map.links", { field: "links", expected: "list", got: show(links) });
  else {
    (links ?? []).forEach((l: unknown, i: number) => {
      const path = `map.links[${i}]`;
      if (!isObj(l)) return void rep.add("type-invalid", path, { field: path, expected: "object", got: show(l) });
      checkKeys(rep, l, LINK_KEYS, path);
      const { from, to } = l;
      endsOf(rep, from, `${path}.from`, ids);
      endsOf(rep, to, `${path}.to`, ids);
      if (l["kind"] !== undefined && !LINK_KINDS.includes(l["kind"] as LinkKind)) option(rep, `${path}.kind`, show(l["kind"]), LINK_KINDS);
      if (l["arrow"] !== undefined && !ARROWS.includes(String(l["arrow"]))) option(rep, `${path}.arrow`, show(l["arrow"]), ARROWS);
      paintOf(rep, l["paint"], `${path}.paint`);
      if (l["mult"] !== undefined && !(Array.isArray(l["mult"]) && l["mult"].length <= 2)) rep.add("type-invalid", `${path}.mult`, { field: "mult", expected: "list", got: show(l["mult"]) });
    });
  }

  const flows = map["flows"];
  if (flows !== undefined && !Array.isArray(flows)) rep.add("type-invalid", "map.flows", { field: "flows", expected: "list", got: show(flows) });
  else {
    (flows ?? []).forEach((f: unknown, i: number) => {
      const path = `map.flows[${i}]`;
      if (!isObj(f)) return void rep.add("type-invalid", path, { field: path, expected: "object", got: show(f) });
      checkKeys(rep, f, FLOW_KEYS, path);
      const p = f["path"];
      if (!Array.isArray(p)) return void rep.add("type-invalid", `${path}.path`, { field: "path", expected: "list", got: show(p) });
      if (p.length < 2) rep.add("map-flow-short", `${path}.path`);
      p.forEach((id, k) => {
        if (typeof id !== "string" || !ids.has(id)) rep.add("map-node-unknown", `${path}.path[${k}]`, { field: `flows[${i}].path`, id: typeof id === "string" ? id : show(id) });
      });
      for (const key of ["every", "speed"]) if (f[key] !== undefined && !(isNum(f[key]) && (f[key] as number) > 0)) rep.add("number-invalid", `${path}.${key}`, { field: key, got: show(f[key]) });
      if (f["delay"] !== undefined && !(isNum(f["delay"]) && (f["delay"] as number) >= 0)) rep.add("number-invalid", `${path}.delay`, { field: "delay", got: show(f["delay"]) });
      paintOf(rep, f["paint"], `${path}.paint`);
    });
  }
}
