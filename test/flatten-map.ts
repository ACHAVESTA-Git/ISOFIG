import { resolveMap, type MapFigure } from "../src/core/map/index.ts";
import { shiftPart } from "../src/core/map/parts.ts";
import type { TreeNode } from "../src/core/map/types.ts";
import type { FigureSpec, Part } from "../src/core/spec.ts";

/**
 * Aplana un árbol de nodos a piezas con ids de camino (`vpc.apps.app-1.rack`) y coordenadas del mundo: lo mismo que
 * hará `assemble` del árbol anidado, sin despiece. Lo usan las pruebas para dibujar un mapa antes de conectar ese módulo.
 */
export function flatten(root: TreeNode): Part[] {
  const all: { part: Part; scopes: string[] }[] = [];
  const walk = (n: TreeNode, origin: [number, number, number], path: string, scopes: string[]) => {
    const here: [number, number, number] = [origin[0] + (n.at?.[0] ?? 0), origin[1] + (n.at?.[1] ?? 0), origin[2] + (n.at?.[2] ?? 0)];
    const p = path ? `${path}.${n.id}` : n.id;
    const own = [p, ...scopes];
    for (const part of n.parts ?? []) all.push({ part: { ...shiftPart(part, here), id: `${p}.${part.id}` } as Part, scopes: own });
    for (const c of n.children ?? []) walk(c, here, p, own);
  };
  walk(root, [0, 0, 0], "", [""]);
  const ids = new Set(all.map((a) => a.part.id));
  const ref = (scopes: string[], id: string) => scopes.map((s) => (s ? `${s}.${id}` : id)).find((full) => ids.has(full)) ?? id;
  return all.map(({ part, scopes }) => {
    const q = { ...part } as Part & { on?: string; mount?: string[] };
    if ("on" in q && q.on) q.on = ref(scopes, q.on);
    if (q.mount) q.mount = q.mount.map((m) => ref(scopes, m));
    return q;
  });
}

/** Una spec con `map` lista para `renderFigure`: el mapa compilado y aplanado a piezas. */
export function flatMap(spec: MapFigure): FigureSpec {
  const { spec: out } = resolveMap(spec);
  const { root, ...rest } = out as FigureSpec & { root: TreeNode };
  return { ...rest, parts: flatten(root) };
}
