import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, resolve } from "node:path";

export function sourceOf(file: string): string {
  const code = readFileSync(file, "utf8");
  return file.endsWith(".ts") ? stripTypeScriptTypes(code) : code;
}

const IMPORT = /^import\s+([\s\S]*?)\s+from\s+["']([^"']+)["'];?[ \t]*$/gm;
const EXPORT_STAR = /^export\s*\*\s*(?:as\s+(\w+)\s+)?from\s+["']([^"']+)["'];?[ \t]*$/gm;
const EXPORT_FROM = /^export\s*\{([^}]*)\}\s*from\s+["']([^"']+)["'];?[ \t]*$/gm;
const EXPORT_LIST = /^export\s*\{([^}]*)\};?[ \t]*$/gm;
// `export async function f`, `export function* g`, `export const x`…: se conserva todo salvo la palabra `export`.
const EXPORT_DECL = /^export\s+((?:async\s+)?function(?:\s*\*\s*|\s+)|const\s+|let\s+|var\s+|class\s+)(\w+)/gm;

/** `a as b` → `["a", "b"]`; sin `as`, el mismo nombre dos veces. */
const alias = (item: string): [string, string] => {
  const [local, as] = item.trim().split(/\s+as\s+/);
  return [local, as ?? local];
};
const names = (list: string): string[] => list.split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Junta el modelo y los archivos locales que importa en un solo script, para la página suelta: un navegador no
 * puede importar `./medidas.ts` desde `file://`. Los imports de paquetes (solo tipos) desaparecen al quitar tipos.
 * Reconoce `import x, { a as b }`, `import * as ns` y, al exportar, declaraciones (`export async function`),
 * listas, `export default`, `export * from`, `export * as ns from` y `export { a as b } from`.
 */
export function bundle(entry: string, root = "__model", given: Record<string, string> = {}): string {
  const known = new Map<string, string>(Object.entries(given));
  const out: string[] = [];
  const visit = (file: string): string => {
    const seen = known.get(file);
    if (seen) return seen;
    const self = `${root}_${known.size}`;
    known.set(file, self);
    const dep = (from: string) => visit(resolve(dirname(file), /\.[cm]?[jt]s$/.test(from) ? from : `${from}.ts`));
    let code = sourceOf(file);
    code = code.replace(IMPORT, (_all, what: string, from: string) => {
      if (!from.startsWith(".")) return "";
      const target = dep(from);
      const lines: string[] = [];
      const star = what.match(/\*\s+as\s+(\w+)/);
      const named = what.match(/\{([\s\S]*)\}/);
      const def = what.replace(/\{[\s\S]*\}|\*\s+as\s+\w+/g, "").replace(/,/g, "").trim();
      if (def) lines.push(`const ${def} = ${target}.default;`);
      if (star) lines.push(`const ${star[1]} = ${target};`);
      if (named) lines.push(`const { ${names(named[1]).map((n) => alias(n).join(": ")).join(", ")} } = ${target};`);
      return lines.join("\n");
    });
    const exported: string[] = [];
    // Lo que se reexporta entero queda debajo de lo propio: un nombre local gana, como en un módulo.
    const spread: string[] = [];
    code = code
      .replace(EXPORT_STAR, (_all, ns: string | undefined, from: string) => {
        if (!from.startsWith(".")) return "";
        const target = dep(from);
        if (ns) exported.push(`${ns}: ${target}`);
        else spread.push(`...${target}`);
        return "";
      })
      .replace(EXPORT_FROM, (_all, list: string, from: string) => {
        if (!from.startsWith(".")) return "";
        const target = dep(from);
        for (const item of names(list)) {
          const [local, as] = alias(item);
          exported.push(`${as}: ${target}.${local}`);
        }
        return "";
      })
      .replace(EXPORT_LIST, (_all, list: string) => {
        for (const item of names(list)) {
          const [local, as] = alias(item);
          exported.push(as === local ? local : `${as}: ${local}`);
        }
        return "";
      })
      .replace(/^export default /m, () => {
        exported.push("default: __default");
        return "const __default = ";
      })
      .replace(EXPORT_DECL, (_all, head: string, name: string) => {
        exported.push(name);
        return `${head}${name}`;
      });
    out.push(`const ${self} = (() => {\n${code}\nreturn { ${[...spread, ...exported].join(", ")} };\n})();`);
    return self;
  };
  const top = visit(entry);
  return `${out.join("\n")}\nconst ${root} = ${top};`;
}
