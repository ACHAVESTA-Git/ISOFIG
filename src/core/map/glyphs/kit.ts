import type { Part, Text, Vec2 } from "../../spec.ts";
import type { MapNode } from "../types.ts";

/** Lo que cada objeto del catálogo recibe al armarse. */
export interface GlyphArgs {
  node: MapNode;
  /** Tamaño de los rótulos grabados, en unidades del mundo. */
  s: number;
  /** Azimut de la cámara: hacia dónde miran los costados de los cilindros. */
  az: number;
  /** El rótulo del nodo (los objetos que lo graban en su propio cuerpo, como una clase, lo usan). */
  name: Text;
}

/**
 * Un objeto armado en su propio marco: `x` crece hacia el lector (el frente), `y` hacia la derecha, `z` hacia arriba,
 * y su esquina atrás-izquierda-abajo es el origen. El cuerpo va pintado con `ROLE`.
 */
export interface Glyph {
  /** Fondo (x), ancho (y) y alto (z). */
  d: number;
  w: number;
  h: number;
  parts: Part[];
  /** `false`: el objeto trae su propio rótulo y no lleva zócalo ni placa. */
  plate?: boolean;
}

export type GlyphFn = (a: GlyphArgs) => Glyph;

/** Un rectángulo con las puntas redondeadas (una cinta o un rodillo visto de arriba): planta convexa antihoraria. */
export function stadium(cx: number, cy: number, len: number, wid: number, steps = 6): Vec2[] {
  const r = wid / 2;
  const half = len / 2 - r;
  const ring: Vec2[] = [];
  for (let k = 0; k <= steps; k++) {
    const a = (Math.PI * k) / steps;
    ring.push([cx + r * Math.cos(a), cy + half + r * Math.sin(a)]);
  }
  for (let k = 0; k <= steps; k++) {
    const a = Math.PI + (Math.PI * k) / steps;
    ring.push([cx + r * Math.cos(a), cy - half + r * Math.sin(a)]);
  }
  return ring;
}

/** Punto del costado de un cilindro que mira hacia la cámara (`az` en grados), `off` grados a un lado. */
export const facing = (cx: number, cy: number, r: number, az: number, off = 0): [number, number] => {
  const a = ((az + off) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
