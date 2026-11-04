import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Solo sentencias import/export con `from` o un import dinámico: un `count("pool", "from", from)` no es un import.
const IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/gm;

/** Especificadores que importa un archivo y, siguiendo los relativos, todos los que lo componen. */
export function specifiers(entry: string, seen = new Set<string>()): string[] {
  if (seen.has(entry)) return [];
  seen.add(entry);
  const found: string[] = [];
  // Los comentarios pueden citar un import de ejemplo («import("isofig/zoom")») que no es una dependencia.
  const code = readFileSync(entry, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const m of code.matchAll(IMPORT)) {
    const from = m[1] ?? m[2] ?? m[3];
    if (from.startsWith(".")) found.push(...specifiers(resolve(dirname(entry), from), seen));
    else found.push(from);
  }
  return found;
}
