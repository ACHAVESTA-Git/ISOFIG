import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

/** Especificadores que importa un archivo y, siguiendo los relativos, todos los que lo componen. */
export function specifiers(entry: string, seen = new Set<string>()): string[] {
  if (seen.has(entry)) return [];
  seen.add(entry);
  const found: string[] = [];
  // Los comentarios pueden citar un import de ejemplo («import("isofig/zoom")») que no es una dependencia.
  const code = readFileSync(entry, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const [, from] of code.matchAll(IMPORT)) {
    if (from.startsWith(".")) found.push(...specifiers(resolve(dirname(entry), from), seen));
    else found.push(from);
  }
  return found;
}
