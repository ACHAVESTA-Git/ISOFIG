import { fitCamera } from "../camera.ts";
import { dot } from "../math.ts";
import type { Camera2 } from "./place.ts";
import { buildWorld } from "./world.ts";
import type { CompiledMap, MapLayout, MapSpec } from "./types.ts";

export { type Note } from "./world.ts";

export interface CompileOptions {
  /** Tamaño del `viewBox` de la figura (por defecto 1150 de ancho: lo que mide la vista ampliada). */
  width?: number;
  height?: number;
  pad?: number;
  camera?: { azimuth?: number; elevation?: number };
}

/** Cámaras que muestran mejor cada reparto: de frente y un poco de lado (se ve el frente y el costado izquierdo). */
const CAMERAS: Record<MapLayout, Camera2> = {
  flow: { azimuth: -24, elevation: 44 },
  layers: { azimuth: -14, elevation: 46 },
  grid: { azimuth: -24, elevation: 44 },
};

/** Se busca que la letra mida al menos esto en la vista ampliada (el validador exige 9). */
const MIN_PX = 9.8;
const START_SIZE = 9;
const MAX_SIZE = 26;

/**
 * Compila un mapa a un árbol de nodos (`root`), los recorridos de sus paquetes (`tracks`) y el tamaño y la cámara que
 * le sientan. Es una función pura y no usa Node: corre igual en el navegador. El tamaño de los rótulos sale de un
 * ajuste: se busca el menor con el que la letra mide ~10 px en la vista ampliada (a 1150 px de ancho).
 */
export function compileMap(map: MapSpec, o: CompileOptions = {}): CompiledMap {
  const layout = map.layout ?? "flow";
  const camera = { ...CAMERAS[layout], ...o.camera };
  const W = o.width ?? 1150;
  const pad = o.pad ?? 24;
  const cos = Math.cos((camera.elevation * Math.PI) / 180);
  /** Arma el mundo con letra `s` y mide cuánto se lee en la vista ampliada. */
  const attempt = (s: number) => {
    const world = buildWorld(map, s, camera);
    let cam = fitCamera(camera, world.points, W, o.height ?? 1e5, pad);
    let H = o.height ?? 0;
    if (!o.height) {
      // El alto sale del ancho: la figura llena el ancho y el alto se ajusta a su forma.
      const ys = world.points.map((p) => dot(p, cam.down));
      H = Math.ceil((Math.max(...ys) - Math.min(...ys)) * cam.scale + 2 * pad);
      cam = fitCamera(camera, world.points, W, H, pad);
    }
    return { world, H, s, px: (s * cam.scale * cos * 1150) / W };
  };
  let s = map.labelSize ?? START_SIZE;
  let cur = attempt(s);
  if (map.labelSize === undefined) {
    // La letra y el tamaño de la escena dependen uno del otro: se acerca de punto fijo en punto fijo y se queda con la
    // menor que aún se lee.
    let best = cur.px >= MIN_PX ? cur : undefined;
    for (let i = 0; i < 14 && !(cur.px >= MIN_PX && cur.px <= MIN_PX * 1.04) && s < MAX_SIZE; i++) {
      s = Math.min(MAX_SIZE, (s * MIN_PX * 1.015) / cur.px);
      cur = attempt(s);
      if (cur.px >= MIN_PX && (!best || cur.px < best.px)) best = cur;
    }
    if (best) cur = best;
  }
  const notes = cur.world.notes;
  if (cur.px < 9) notes.push({ code: "map-label-small", path: "map", vars: { zoomed: Math.round(cur.px * 10) / 10, min: 9 } });
  return { root: cur.world.root, tracks: cur.world.tracks, width: W, height: cur.H, camera, labelSize: cur.s, notes };
}
