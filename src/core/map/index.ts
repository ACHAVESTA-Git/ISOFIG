import type { FigureSpec } from "../spec.ts";
import { compileMap, type Note } from "./compile.ts";
import { altOf, readoutOf } from "./describe.ts";

export { compileMap, type CompileOptions, type Note } from "./compile.ts";
export { GLYPHS, type CompiledMap, type GlyphName, type LinkKind, type MapFlow, type MapLayout, type MapLink, type MapNode, type MapSpec, type TreeNode } from "./types.ts";

/** Una spec que aún puede traer su `map` en vez de `parts`. */
export type MapFigure = Omit<FigureSpec, "parts"> & { parts?: FigureSpec["parts"] };

export interface ResolvedMap {
  spec: FigureSpec;
  notes: Note[];
}

/**
 * Convierte el `map` de una spec en lo que el resto del núcleo entiende: el árbol `root` de nodos anidados y los
 * `tracks` de los paquetes. Pone también el tamaño y la cámara que salen del ajuste de los rótulos, una lectura y una
 * descripción para lectores de pantalla, salvo que la spec ya traiga las suyas. Una spec sin `map` vuelve igual.
 */
export function resolveMap(spec: MapFigure): ResolvedMap {
  const map = spec.map;
  if (!map || typeof map !== "object") return { spec: spec as FigureSpec, notes: [] };
  const c = compileMap(map, { width: spec.width, height: spec.height, pad: spec.pad, camera: spec.camera });
  const { map: _map, ...rest } = spec;
  const out = {
    ...rest,
    root: c.root,
    tracks: [...(spec.tracks ?? []), ...c.tracks],
    width: spec.width ?? c.width,
    height: spec.height ?? c.height,
    camera: { ...c.camera, ...spec.camera },
    readout: spec.readout ?? readoutOf(map),
    alt: spec.alt ?? altOf(map),
  } as unknown as FigureSpec;
  return { spec: out, notes: c.notes };
}
