#!/usr/bin/env node
import { copyFileSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import type { Model } from "../runtime/index.ts";
import { checkModel } from "../core/check.ts";
import { fromCompose } from "../core/importers/compose.ts";
import { formatIssue, makeIssue, messageLang, PREFIXES, type Issue, type IssueCode, type V } from "../core/issues.ts";
import { renderFigure } from "../core/render.ts";
import { assembleTree, type Catalog } from "../core/tree.ts";
import { catalog } from "../kit/index.ts";
import { budgetIssues, measure } from "../node/index.ts";
import type { FigureSpec, FlatSpec } from "../core/spec.ts";
import { validateSpec } from "../core/validate.ts";
import { bundle, sourceOf } from "./bundle.ts";
import { helpOf } from "./help.ts";
import { runPalette } from "./palette.ts";
import { quietStripTypes } from "./warnings.ts";

quietStripTypes();

const COMMANDS = ["build", "check", "add", "import", "palette"];
const FORMATS = ["html", "module", "json", "page"];
const PALETTE_FORMATS = ["css", "json"];

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "..", "..");

/** Importa un archivo `.ts` o `.js`; sus exports `default`, `spec` y `model` son los que busca la CLI. */
async function importFile(abs: string): Promise<{ default?: unknown; spec?: unknown; model?: unknown }> {
  try {
    return await import(pathToFileURL(abs).href);
  } catch (e) {
    // Node no quita tipos bajo node_modules (el ejemplo que trae el paquete): se quitan aquí y se importa el resultado.
    if ((e as { code?: string }).code !== "ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING") throw e;
    const code = `${bundle(abs, "__file")}\nexport default __file.default;\nexport const spec = __file.spec;\nexport const model = __file.model;`;
    return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  }
}

async function loadSpec(file: string): Promise<FigureSpec> {
  const abs = resolve(file);
  if (extname(abs) === ".json") return JSON.parse(readFileSync(abs, "utf8"));
  const mod = await importFile(abs);
  const spec = (mod.default ?? mod.spec) as FigureSpec | undefined;
  if (!spec) throw new Error(`${file} must export default (or export const spec) a FigureSpec`);
  return spec;
}

async function loadModel(file: string): Promise<Model<any, any>> {
  const mod = await importFile(resolve(file));
  const model = (mod.default ?? mod.model) as Model<any, any> | undefined;
  if (!model) throw new Error(`${file} must export default (or export const model) a Model`);
  return model;
}

function page(html: string, modelFile: string | undefined, name: string | undefined, theme: string, orbitSpec?: FlatSpec, lang = "en"): string {
  const fromSource = import.meta.url.endsWith(".ts");
  const runtimeFile = resolve(pkg, fromSource ? "src/runtime/index.ts" : "dist/runtime/index.js");
  const runtime = sourceOf(runtimeFile).replace(/^export /gm, "");
  const model = modelFile ? `${bundle(resolve(modelFile), "__modelModule")}\nconst __model = __modelModule.default;` : "";
  const runtimeAlias = { [runtimeFile]: "__runtime" };
  const orbit = orbitSpec
    ? `const __runtime = { retarget, orbitOnDemand };\n` +
      bundle(resolve(pkg, fromSource ? "src/orbit/index.ts" : "dist/orbit/index.js"), "__orbit", runtimeAlias) +
      // La spec viaja ya aplanada, como con <Figure orbit>: el giro no sabe armar un árbol.
      `\nconst __orbitSpec = ${JSON.stringify(orbitSpec).replace(/</g, "\\u003c")};\n` +
      `document.querySelectorAll("[data-isofig]").forEach((el) => orbitOnDemand(el, async () => __orbit.enableOrbit(el, __orbitSpec, { lang: ${JSON.stringify(lang)} })));\n`
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

/** Idioma de los mensajes y de sus prefijos; se fija al leer `--lang` y lo usa también el último `catch`. */
let lang: "en" | "es" = "en";

/** Un uso incorrecto: el mensaje con su prefijo y la ayuda, por stderr y con código 1. */
function usage(code: IssueCode, vars: V): void {
  console.error(`${PREFIXES[lang].error}: ${makeIssue(lang, code, "", vars).message}\n\n${helpOf(lang)}`);
  process.exitCode = 1;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string" },
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
      version: { type: "boolean", short: "v" },
    },
  });
  lang = messageLang(values.lang);
  const [command, file] = positionals;
  if (values.version) {
    console.log(JSON.parse(readFileSync(resolve(pkg, "package.json"), "utf8")).version);
    return;
  }
  if (values.help || !command) {
    console.log(helpOf(lang));
    return;
  }
  // El comando y el formato se validan antes de leer nada: una errata no debe costar renderizar la spec.
  if (!COMMANDS.includes(command)) return usage("cli-unknown-command", { id: command, list: COMMANDS.join(", ") });
  const formats = command === "palette" ? PALETTE_FORMATS : FORMATS;
  const format = values.format ?? formats[0];
  if ((command === "build" || command === "palette") && !formats.includes(format)) {
    return usage("cli-unknown-format", { id: format, kind: command, list: formats.join(", ") });
  }
  if (command === "palette") {
    process.exitCode = runPalette({ base: values.base, format, report: values.report, out: values.out, lang });
    return;
  }
  if (command === "import") {
    const source = positionals[2];
    if (file !== "compose" || !source) return usage("cli-missing-argument", { id: "import", expected: "compose <file.json|->" });
    const raw = source === "-" ? readFileSync(0, "utf8") : readFileSync(resolve(source), "utf8");
    const spec = fromCompose(JSON.parse(raw));
    const json = JSON.stringify(spec, null, 2) + "\n";
    if (values.out) writeFileSync(values.out, json);
    else process.stdout.write(json);
    return;
  }
  if (command === "add") {
    const dir = positionals[2];
    if (file !== "angular" || !dir) return usage("cli-missing-argument", { id: "add", expected: "angular <dir>" });
    mkdirSync(resolve(dir), { recursive: true });
    const target = resolve(dir, "isofig-figure.ts");
    copyFileSync(resolve(pkg, "src/angular/isofig-figure.ts"), target);
    console.log(`isofig: ${target}`);
    return;
  }
  if (!file) return usage("cli-missing-argument", { id: command, expected: "<spec>" });
  // --set param=número fija el arranque de un control, para previsualizar cada estado sin tocar la spec.
  const sets = (values.set ?? []).map((pair) => {
    const at = pair.indexOf("=");
    const value = at < 0 ? "" : pair.slice(at + 1).trim();
    return { pair, id: pair.slice(0, Math.max(at, 0)), value: Number(value), valid: at > 0 && value !== "" && Number.isFinite(Number(value)) };
  });
  const bad = sets.find((s) => !s.valid);
  if (bad) return usage("set-value-invalid", { id: bad.pair });
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
  // --set llega también a los controles que añade el despiece de una spec anidada («explode», «pick»).
  const flat = assembleTree(spec, { catalog: catalog as Catalog }).spec;
  const notes: Issue[] = [];
  const start: Record<string, number> = {};
  for (const { id, value } of sets) {
    if (flat.params?.some((q) => q.id === id)) start[id] = value;
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
  if (r.errors.length) process.exit(1);
  let out: string;
  switch (format) {
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
        values.orbit ? flat : undefined,
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
  console.error(`${PREFIXES[lang].error}: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
