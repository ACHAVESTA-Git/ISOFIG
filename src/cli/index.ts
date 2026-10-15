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
  page    a standalone preview page with theme and runtime inlined (use --model for a model file)`;

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

function page(html: string, modelFile: string | undefined, name: string | undefined, theme: string): string {
  const runtimeFile = [resolve(pkg, "dist/runtime/index.js"), resolve(pkg, "src/runtime/index.ts")].find((f) => {
    try {
      readFileSync(f);
      return true;
    } catch {
      return false;
    }
  })!;
  const runtime = sourceOf(runtimeFile).replace(/^export /gm, "");
  const model = modelFile
    ? sourceOf(resolve(modelFile))
        .replace(/^import[^;]*;$/gm, "")
        .replace(/^export default /m, "const __model = ")
        .replace(/^export /gm, "")
    : "";
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
      out = page(r.html, values.model, spec.model, values.theme!);
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
