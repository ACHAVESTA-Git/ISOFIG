import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

/** Especificadores que importa un archivo y, siguiendo los relativos, todos los que lo componen. */
export function specifiers(entry: string, seen = new Set<string>()): string[] {
  if (seen.has(entry)) return [];
  seen.add(entry);
  const found: string[] = [];
  for (const [, from] of readFileSync(entry, "utf8").matchAll(IMPORT)) {
    if (from.startsWith(".")) found.push(...specifiers(resolve(dirname(entry), from), seen));
    else found.push(from);
  }
  return found;
}
