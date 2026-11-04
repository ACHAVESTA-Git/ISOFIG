#!/usr/bin/env node
import { copyFileSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import type { Model } from "../runtime/index.ts";
import { checkModel } from "../core/check.ts";
import { fromCompose } from "../core/importers/compose.ts";
import { formatIssue, makeIssue, messageLang, PREFIXES, type Issue } from "../core/issues.ts";
import { renderFigure } from "../core/render.ts";
import { assembleTree, type Catalog } from "../core/tree.ts";
import { catalog } from "../kit/index.ts";
import { budgetIssues, measure } from "../node/index.ts";
import type { FigureSpec } from "../core/spec.ts";
import { validateSpec } from "../core/validate.ts";
import { runPalette } from "./palette.ts";

const HELP = `isofig: isometric figures from a spec

  isofig build <spec> [-o file] [--format html|module|json|page] [--lang en] [--n 1] [--model file]
  isofig check <spec> [--lang en|es] [--strict] [--model file [--presets] [--seconds 12]]
  isofig add angular <dir>    copy the standalone Angular component into your app
  isofig import compose <file.json|-> [-o spec.json]
                              a figure from \`docker compose config --format json\`
  isofig palette [--base "#2fb58b"] [--format css|json] [--report] [-o file]
                              map roles derived from a brand color, with a contrast,
                              ΔE and color-blindness table on stderr (--report)

  check   validates the spec, audits the drawing and, with --model, runs the model for --seconds simulated
          seconds (and every preset with --presets) to find groups, controls and presets that do nothing.
          --lang en|es sets the language of the messages and of their prefixes; --strict also fails on warnings

  html    the <figure> markup (default)
  module  a TS module exporting { id, html, data }, for Angular
  json    { html, data } as JSON
  page    a standalone preview page with theme and runtime inlined (use --model for a model file,
          --advance 3 to open it 3 s into the simulation, --set id=value to start a control
          at another value, --orbit to try turning it)`;

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "..", "..");

async function importModule(abs: string): Promise<{ default?: FigureSpec; spec?: FigureSpec }> {
  try {
    return await import(pathToFileURL(abs).href);
  } catch (e) {
    // Node no quita tipos bajo node_modules (el ejemplo que trae el paquete): se quitan aquí y se importa el resultado.
    if ((e as { code?: string }).code !== "ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING") throw e;
    const code = `${bundle(abs, "__spec")}\nexport default __spec.default;\nexport const spec = __spec.spec;`;
    return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  }
}

async function loadSpec(file: string): Promise<FigureSpec> {
  const abs = resolve(file);
  if (extname(abs) === ".json") return JSON.parse(readFileSync(abs, "utf8"));
  const mod = await importModule(abs);
  const spec = mod.default ?? mod.spec;
  if (!spec) throw new Error(`${file} must export default (or export const spec) a FigureSpec`);
  return spec;
}

async function loadModel(file: string): Promise<Model<any, any>> {
  const mod = await import(pathToFileURL(resolve(file)).href);
  const model = mod.default ?? mod.model;
  if (!model) throw new Error(`${file} must export default (or export const model) a Model`);
  return model;
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
function bundle(entry: string, root = "__model", given: Record<string, string> = {}): string {
  const names = new Map<string, string>(Object.entries(given));
  const out: string[] = [];
  const visit = (file: string): string => {
    const known = names.get(file);
    if (known) return known;
    const self = `${root}_${names.size}`;
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
  const top = visit(entry);
  return `${out.join("\n")}\nconst ${root} = ${top};`;
}

function page(html: string, modelFile: string | undefined, name: string | undefined, theme: string, orbitSpec?: string, lang = "en"): string {
  const fromSource = import.meta.url.endsWith(".ts");
  const runtimeFile = resolve(pkg, fromSource ? "src/runtime/index.ts" : "dist/runtime/index.js");
  const runtime = sourceOf(runtimeFile).replace(/^export /gm, "");
  const model = modelFile ? `${bundle(resolve(modelFile), "__modelModule")}\nconst __model = __modelModule.default;` : "";
  const runtimeAlias = { [runtimeFile]: "__runtime" };
  const orbit = orbitSpec
    ? `const __runtime = { retarget, orbitOnDemand };\n` +
      bundle(resolve(pkg, fromSource ? "src/orbit/index.ts" : "dist/orbit/index.js"), "__orbit", runtimeAlias) +
      `\n${bundle(resolve(orbitSpec), "__specModule")}\n` +
      `document.querySelectorAll("[data-isofig]").forEach((el) => orbitOnDemand(el, async () => __orbit.enableOrbit(el, __specModule.default, { lang: ${JSON.stringify(lang)} })));\n`
    : "";
  const zoom = `${bundle(resolve(pkg, fromSource ? "src/zoom/index.ts" : "dist/zoom/index.js"), "__zoom")}\nzoomOnDemand(async () => __zoom);\n`;
  const css = readFileSync(resolve(pkg, "src/theme/theme.css"), "utf8");
  const boot = zoom + (modelFile && name ? `${model}\nregister(${JSON.stringify(name)}, __model);\n` : "") + orbit;
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
      orbit: { type: "boolean", default: false },
      set: { type: "string", multiple: true },
      strict: { type: "boolean", default: false },
      presets: { type: "boolean", default: false },
      seconds: { type: "string" },
      base: { type: "string" },
      report: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, file] = positionals;
  if (command === "palette" && !values.help) {
    process.exitCode = runPalette({ base: values.base, format: values.format, report: values.report, out: values.out });
    return;
  }
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
  const lang = messageLang(values.lang);
  const spec = await loadSpec(file);
  // Lo que se imprime: «error:», «warning:» y «info:» (con --lang es, «aviso:» y «nota:»), con el código al final.
  const print = (issues: Issue[]) => {
    for (const i of issues) console.error(`${PREFIXES[lang][i.severity]}: ${formatIssue(i)} [${i.code}]`);
  };
  const invalid = validateSpec(spec, { lang }).filter((i) => i.code === "spec-not-object");
  if (invalid.length) {
    print(invalid);
    process.exit(1);
  }
  // --set param=valor fija el arranque de un control, para previsualizar cada estado sin tocar la spec. Alcanza también
  // los controles que añade el despiece de una spec anidada («explode», «pick»).
  const flat = assembleTree(spec, { catalog: catalog as Catalog }).spec;
  const notes: Issue[] = [];
  const start: Record<string, number> = {};
  for (const pair of values.set ?? []) {
    const [id, v] = pair.split("=");
    if (flat.params?.some((q) => q.id === id)) start[id] = Number(v);
    else notes.push(makeIssue(lang, "set-unknown-param", "", { id }));
  }
  const r = renderFigure(spec, { lang: values.lang, n: values.n, orbit: values.orbit, values: start });
  const size = measure(r.html);
  const issues = [...notes, ...r.issues, ...budgetIssues(spec, size, lang)];

  if (command === "check") {
    if (values.presets && !values.model) {
      issues.push(makeIssue(lang, "presets-need-model", ""));
    } else if (values.model && !r.errors.length) {
      const seconds = Number(values.seconds);
      issues.push(...checkModel(flat, await loadModel(values.model), { lang, presets: values.presets, ...(seconds > 0 ? { seconds } : {}) }));
    }
    print(issues);
    console.error(`${spec.id}: ${(size.bytes / 1024).toFixed(1)} KB, ${(size.gzip / 1024).toFixed(1)} KB gzip`);
    const errors = issues.some((i) => i.severity === "error");
    const warnings = issues.some((i) => i.severity === "warning");
    if (errors || (values.strict && warnings)) process.exit(1);
    return;
  }
  print(issues.filter((i) => i.severity !== "info"));
  console.error(`${spec.id}: ${(size.bytes / 1024).toFixed(1)} KB, ${(size.gzip / 1024).toFixed(1)} KB gzip`);
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
        values.orbit ? file : undefined,
        values.lang,
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
