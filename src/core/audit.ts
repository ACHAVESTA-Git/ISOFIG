import type { Item } from "./items.ts";

const TOUCH = 0.6;
const SUNK = 0.8;

const gap = (a: Item, b: Item, i: number) => Math.max(a.box.min[i] - b.box.max[i], b.box.min[i] - a.box.max[i]);
const depthInside = (a: Item, b: Item, i: number) =>
  Math.min(a.box.max[i], b.box.max[i]) - Math.max(a.box.min[i], b.box.min[i]);

/**
 * Revisión barata sobre cajas: piezas que flotan sin tocar nada y piezas hundidas unas en otras.
 * Los grupos ocultos al inicio (piezas de un depósito, por ejemplo) no cuentan.
 */
export function audit(items: Item[]): string[] {
  const live = items.filter((i) => !i.hidden);
  const out: string[] = [];
  for (const a of live) {
    if (a.float || a.box.min[2] <= 0.01) continue;
    const touches = live.some((b) => b !== a && [0, 1, 2].every((i) => gap(a, b, i) <= TOUCH));
    if (!touches) out.push(`«${a.id}» flota: no toca ninguna pieza (márcala con float si es a propósito)`);
  }
  for (let x = 0; x < live.length; x++) {
    for (let y = x + 1; y < live.length; y++) {
      const a = live[x];
      const b = live[y];
      if (a.mount.includes(b.id) || b.mount.includes(a.id)) continue;
      if ([0, 1, 2].every((i) => depthInside(a, b, i) > SUNK)) {
        out.push(`«${a.id}» y «${b.id}» se atraviesan (usa mount si una va encajada en la otra)`);
      }
    }
  }
  return out.slice(0, 40);
}
