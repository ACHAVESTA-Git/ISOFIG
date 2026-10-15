#!/usr/bin/env node
import { copyFileSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { renderFigure } from "../core/render.ts";
import { fromCompose } from "../core/importers/compose.ts";
import type { FigureSpec } from "../core/spec.ts";

const HELP = `isofig: isometric figures from a spec

  isofig build <spec> [-o file] [--format html|module|json|page] [--lang en] [--n 1] [--model file]
  isofig check <spec> [--lang en] [--strict]
  isofig add angular <dir>    copy the standalone Angular component into your app
  isofig import compose <file.json|-> [-o spec.json]
                              a figure from \`docker compose config --format json\`

  html    the <figure> markup (default)
  module  a TS module exporting { id, html, data }, for Angular
  json    { html, data } as JSON
  page    a standalone preview page with theme and runtime inlined (use --model for a model file,
          --advance 3 to open it 3 s into the simulation, for headless screenshots)`;

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "..", "..");

async function loadSpec(file: string): Promise<FigureSpec> {
  const abs = resolve(file);
  if (extname(abs) === ".json") return JSON.parse(readFileSync(abs, "utf8"));
  const mod = await import(pathToFileURL(abs).href);
  const spec = mod.default ?? mod.spec;
  if (!spec) throw new Error(`${file} must export default (or export const spec) a FigureSpec`);
  return spec;
}

function sourceOf(file: string): string {
  const code = readFileSync(file, "utf8");
  return file.endsWith(".ts") ? stripTypeScriptTypes(code) : code;
}

const IMPORT = /^import\s+([\s\S]*?)\s+from\s+["']([^"']+)["'];?[ \t]*$/gm;

/**
 * Junta el modelo y los archivos locales que importa en un solo script, para la página suelta: un navegador no
 * puede importar `./medidas.ts` desde `file://`. Los imports de paquetes (solo tipos) desaparecen al quitar tipos.
 */
function bundle(entry: string): string {
  const names = new Map<string, string>();
  const out: string[] = [];
  const visit = (file: string): string => {
    const known = names.get(file);
    if (known) return known;
    const self = `__m${names.size}`;
    names.set(file, self);
    let code = sourceOf(file);
    code = code.replace(IMPORT, (_all, what: string, from: string) => {
      if (!from.startsWith(".")) return "";
      const target = visit(resolve(dirname(file), /\.[cm]?[jt]s$/.test(from) ? from : `${from}.ts`));
      const [def, named] = what.trim().startsWith("{") ? ["", what] : [what.split(",")[0].trim(), what.slice(what.indexOf("{"))];
      const lines = [];
      if (def) lines.push(`const ${def} = ${target}.default;`);
      if (named.includes("{")) lines.push(`const ${named.replace(/\s+as\s+/g, ": ")} = ${target};`);
      return lines.join("\n");
    });
    const exported: string[] = [];
    code = code
      .replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (_all, list: string) => {
        for (const s of list.split(",").map((x) => x.trim()).filter(Boolean)) {
          const [local, as] = s.split(/\s+as\s+/);
          exported.push(as ? `${as}: ${local}` : local);
        }
        return "";
      })
      .replace(/^export default /m, () => {
        exported.push("default: __default");
        return "const __default = ";
      })
      .replace(/^export\s+(const|let|var|function|class)\s+(\w+)/gm, (_all, kind: string, name: string) => {
        exported.push(name);
        return `${kind} ${name}`;
      });
    out.push(`const ${self} = (() => {\n${code}\nreturn { ${exported.join(", ")} };\n})();`);
    return self;
  };
  const root = visit(entry);
  return `${out.join("\n")}\nconst __model = ${root}.default;`;
}

function page(html: string, modelFile: string | undefined, name: string | undefined, theme: string): string {
  const fromSource = import.meta.url.endsWith(".ts");
  const runtimeFile = resolve(pkg, fromSource ? "src/runtime/index.ts" : "dist/runtime/index.js");
  const runtime = sourceOf(runtimeFile).replace(/^export /gm, "");
  const model = modelFile ? bundle(resolve(modelFile)) : "";
  const css = readFileSync(resolve(pkg, "src/theme/theme.css"), "utf8");
  const boot = modelFile && name ? `${model}\nregister(${JSON.stringify(name)}, __model);\n` : "";
  return `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>isofig preview</title>
<style>${css}
body{margin:0;padding:24px 16px;background:var(--isofig-paper,#f6f6f2)}main{max-width:760px;margin:auto}
:root[data-theme="dark"] body{background:#121312}</style></head>
<body><main>${html}</main><script type="module">${runtime}\n${boot}mountAll();</script></body></html>`;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", default: "html" },
      lang: { type: "string", default: "en" },
      n: { type: "string" },
      model: { type: "string" },
      theme: { type: "string", default: "light" },
      advance: { type: "string" },
      strict: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, file] = positionals;
  if (values.help || !command || !file) {
    console.log(HELP);
    return;
  }
  if (command === "import") {
    const source = positionals[2];
    if (file !== "compose" || !source) {
      console.log(HELP);
      process.exit(1);
    }
    const raw = source === "-" ? readFileSync(0, "utf8") : readFileSync(resolve(source), "utf8");
    const spec = fromCompose(JSON.parse(raw));
    const json = JSON.stringify(spec, null, 2) + "\n";
    if (values.out) writeFileSync(values.out, json);
    else process.stdout.write(json);
    return;
  }
  if (command === "add") {
    const dir = positionals[2];
    if (file !== "angular" || !dir) {
      console.log(HELP);
      process.exit(1);
    }
    mkdirSync(resolve(dir), { recursive: true });
    const target = resolve(dir, "isofig-figure.ts");
    copyFileSync(resolve(pkg, "src/angular/isofig-figure.ts"), target);
    console.log(`isofig: ${target}`);
    return;
  }
  const spec = await loadSpec(file);
  const r = renderFigure(spec, { lang: values.lang, n: values.n });
  for (const e of r.errors) console.error(`error: ${e}`);
  for (const w of r.warnings) console.warn(`aviso: ${w}`);
  console.error(`${spec.id}: ${(r.bytes / 1024).toFixed(1)} KB, ${(r.gzip / 1024).toFixed(1)} KB gzip`);

  if (command === "check") {
    if (r.errors.length || (values.strict && r.warnings.length)) process.exit(1);
    return;
  }
  if (command !== "build") {
    console.log(HELP);
    process.exit(1);
  }
  if (r.errors.length) process.exit(1);
  let out: string;
  switch (values.format) {
    case "module":
      out = `// Generado por isofig a partir de ${file}. No editar a mano.\nexport const figure = ${JSON.stringify({ id: spec.id, html: r.html, data: r.data })};\n`;
      break;
    case "json":
      out = JSON.stringify({ html: r.html, data: r.data });
      break;
    case "page":
      out = page(
        values.advance ? r.html.replace("<figure ", `<figure data-isofig-advance="${Number(values.advance)}" `) : r.html,
        values.model,
        spec.model,
        values.theme!,
      );
      break;
    default:
      out = r.html;
  }
  if (values.out) {
    mkdirSync(dirname(resolve(values.out)), { recursive: true });
    writeFileSync(values.out, out);
  } else process.stdout.write(out);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
