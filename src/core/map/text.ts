import { textOf, type Text } from "../spec.ts";

/** Ancho de un carácter de la letra monoespaciada del tema, en em (con el espaciado que le pone el tema). */
export const CHAR_EM = 0.62;

/** Los idiomas que aparecen en un texto; los textos planos no aportan ninguno. */
export const langsOf = (t: Text | undefined): string[] => (t !== undefined && typeof t === "object" ? Object.keys(t) : []);

/** El texto más largo entre todos sus idiomas: el rótulo tiene que caber en cualquiera. */
export function longest(t: Text | undefined): string {
  if (t === undefined) return "";
  if (typeof t === "string") return t;
  return Object.values(t).reduce((a, b) => (b.length > a.length ? b : a), "");
}

/** Cuánto mide, en unidades del mundo, un texto grabado con `size`. */
export const widthOf = (t: Text | undefined, size: number): number => longest(t).length * CHAR_EM * size;

/** Un `Text` por idioma, armado con `make(lang)`; sin idiomas en `from`, texto plano. */
export function mapText(from: (Text | undefined)[], make: (get: (t: Text | undefined) => string, lang: string) => string): Text {
  const langs = [...new Set(from.flatMap(langsOf))].sort();
  if (!langs.length) return make((t) => textOf(t, "en"), "en");
  return Object.fromEntries(langs.map((l) => [l, make((t) => textOf(t, l), l)]));
}

/** Rodea cada idioma de un texto con `open` y `close`: el estereotipo `«interface»`. */
export const surround = (t: Text, open: string, close: string): Text =>
  typeof t === "string" ? open + t + close : Object.fromEntries(Object.entries(t).map(([l, v]) => [l, open + v + close]));
