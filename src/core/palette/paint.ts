import type { Item } from "../items.ts";
import type { FigureSpec } from "../spec.ts";
import { PAINT_NAMES, RESERVED } from "./names.ts";

/** Un nombre de pintura: también es un trozo de nombre de variable CSS. */
export const PAINT_NAME = /^[a-z][a-z0-9-]*$/;

export const isReserved = (name: string) => (RESERVED as readonly string[]).includes(name);

/** Las pinturas propias del proyecto: nombres de `palette.use` que no son de los juegos (su CSS las define). */
export function customPaints(spec: Pick<FigureSpec, "palette">): Set<string> {
  const use = Array.isArray(spec.palette?.use) ? spec.palette.use : [];
  return new Set(use.filter((n) => typeof n === "string" && PAINT_NAME.test(n) && !PAINT_NAMES.has(n) && !isReserved(n)));
}

/** La pintura que se dibuja: un nombre conocido (o propio) en una pieza que no es el acento (`lit` gana). */
export function paintOf(item: Pick<Item, "tone" | "solid">, custom?: Set<string>): string | undefined {
  const name = item.solid.paint;
  if (!name || item.tone === "lit") return undefined;
  return PAINT_NAMES.has(name) || custom?.has(name) ? name : undefined;
}

/**
 * El atributo corto del `<g>` o `<use>` de la pieza; vacío sin pintura, así el SVG de siempre no cambia. Una pintura
 * propia no tiene regla en `theme.css`: lleva sus dos variables en línea.
 */
export function paintAttr(item: Pick<Item, "tone" | "solid">, custom?: Set<string>): string {
  const name = paintOf(item, custom);
  if (!name) return "";
  if (PAINT_NAMES.has(name)) return ` data-paint="${name}"`;
  return ` data-paint="${name}" style="--pc:var(--isofig-paint-${name});--pi:var(--isofig-paint-${name}-ink,var(--isofig-ink))"`;
}
