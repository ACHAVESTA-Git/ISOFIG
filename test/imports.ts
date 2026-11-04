import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Solo sentencias import/export con `from` o un import dinámico: un `count("pool", "from", from)` no es un import.
const IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/gm;
// `import type { X } from` y `export type { X } from` se borran al compilar: no llevan código al navegador.
const TYPE_ONLY = /^\s*(?:import|export)\s+type\b[^;]*?from\s*["'][^"']+["'];?/gm;

/** El código sin comentarios (pueden citar un import de ejemplo, como `import("isofig/zoom")`). */
const codeOf = (file: string): string => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const importsOf = (code: string): string[] => [...code.matchAll(IMPORT)].map((m) => (m[1] ?? m[2] ?? m[3])!);

/** Especificadores que importa un archivo y, siguiendo los relativos, todos los que lo componen. */
export function specifiers(entry: string, seen = new Set<string>()): string[] {
  if (seen.has(entry)) return [];
  seen.add(entry);
  const found: string[] = [];
  for (const from of importsOf(codeOf(entry))) {
    if (from.startsWith(".")) found.push(...specifiers(resolve(dirname(entry), from), seen));
    else found.push(from);
  }
  return found;
}

/** Los archivos que entran en el bundle de `entry` siguiendo sus imports relativos (con código: sin los de tipos). */
export function reachable(entry: string, seen = new Set<string>()): string[] {
  if (seen.has(entry)) return [];
  seen.add(entry);
  for (const from of importsOf(codeOf(entry).replace(TYPE_ONLY, ""))) if (from.startsWith(".")) reachable(resolve(dirname(entry), from), seen);
  return [...seen];
}
