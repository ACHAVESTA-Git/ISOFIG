import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { bundle } from "../src/cli/bundle.ts";
import { quietStripTypes } from "../src/cli/warnings.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliFile = join(root, "src/cli/index.ts");
const spec = join(root, "examples/token-bucket/spec.ts");
const model = join(root, "examples/token-bucket/model.ts");
const version: string = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const missing = join(tmpdir(), "isofig-no-existe", "spec.ts");

/** Corre la CLI. Por defecto sin advertencias de Node; `warnings: true` las deja pasar. */
function cli(args: string[], options: { warnings?: boolean } = {}) {
  const flags = options.warnings ? [] : ["--no-warnings"];
  return spawnSync(process.execPath, [...flags, cliFile, ...args], { encoding: "utf8" });
}

function scratch<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "isofig-cli-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("--version (y -v) imprime solo la versión del package.json", () => {
  for (const flag of ["--version", "-v"]) {
    const r = cli([flag]);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, `${version}\n`);
    assert.equal(r.stderr, "");
  }
});

test("sin comando o con --help, la ayuda sale por stdout con código 0, en el idioma de --lang", () => {
  for (const args of [[], ["--help"], ["build", "--help"]]) {
    const r = cli(args);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^isofig: isometric figures from a spec/);
    assert.match(r.stdout, /isofig --version/);
  }
  const es = cli(["--help", "--lang", "es"]);
  assert.match(es.stdout, /^isofig: figuras isométricas a partir de una spec/);
  assert.match(es.stdout, /valida la spec, audita el dibujo/);
  assert.doesNotMatch(es.stdout, /validates the spec/);
});

test("un comando desconocido sale con código 1 y la ayuda, sin leer la spec", () => {
  const r = cli(["frobnicate", missing]);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^error: Unknown command 'frobnicate'\. Commands: build, check, add, import, palette\./);
  assert.match(r.stderr, /isofig: isometric figures from a spec/);
  assert.doesNotMatch(r.stderr, /Cannot find|ENOENT|no-existe/, "no intentó leer la spec");
  const es = cli(["frobnicate", missing, "--lang", "es"]);
  assert.equal(es.status, 1);
  assert.match(es.stderr, /^error: Comando desconocido «frobnicate»\. Comandos: /);
  assert.match(es.stderr, /isofig: figuras isométricas/);
});

test("un --format desconocido sale con código 1 y la ayuda, sin leer la spec ni imprimir HTML", () => {
  const r = cli(["build", missing, "--format", "nada"]);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^error: Unknown --format 'nada' for build\. Formats: html, module, json, page\./);
  assert.match(r.stderr, /isofig build <spec>/);
  assert.doesNotMatch(r.stderr, /Cannot find|ENOENT|no-existe/);
  assert.match(cli(["build", missing, "--format", "nada", "--lang", "es"]).stderr, /^error: --format «nada» desconocido para build\. Formatos: html, module, json, page\./);
  const palette = cli(["palette", "--format", "nada"]);
  assert.equal(palette.status, 1);
  assert.equal(palette.stdout, "");
  assert.match(palette.stderr, /Unknown --format 'nada' for palette\. Formats: css, json\./);
});

test("los formatos válidos siguen funcionando, también con --format sin repetir el valor por defecto", () => {
  assert.match(cli(["build", spec]).stdout, /^<figure class="isofig"/);
  assert.match(cli(["build", spec, "--format", "html"]).stdout, /^<figure class="isofig"/);
  assert.deepEqual(Object.keys(JSON.parse(cli(["build", spec, "--format", "json"]).stdout)), ["html", "data"]);
  assert.match(cli(["build", spec, "--format", "module"]).stdout, /export const figure = /);
  assert.match(cli(["palette"]).stdout, /^\/\* isofig palette --base /);
  assert.ok(JSON.parse(cli(["palette", "--format", "json"]).stdout));
});

test("a un comando le falta su argumento: error con código 1 y la ayuda", () => {
  for (const [args, need] of [
    [["build"], /isofig build needs <spec>/],
    [["check"], /isofig check needs <spec>/],
    [["add", "angular"], /isofig add needs angular <dir>/],
    [["add", "vue", "x"], /isofig add needs angular <dir>/],
    [["import", "compose"], /isofig import needs compose <file\.json\|->/],
  ] as const) {
    const r = cli([...args]);
    assert.equal(r.status, 1, args.join(" "));
    assert.match(r.stderr, need);
    assert.match(r.stderr, /isofig: isometric figures/);
  }
  assert.match(cli(["build", "--lang", "es"]).stderr, /isofig build necesita <spec>/);
});

test("--set exige param=número: abc, vacío o sin «=» se rechazan antes de leer la spec", () => {
  for (const pair of ["rate=abc", "rate=", "rate", "=3", "rate=Infinity"]) {
    const r = cli(["build", missing, "--set", pair]);
    assert.equal(r.status, 1, pair);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, new RegExp(`^error: --set ${pair.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: expected <param>=<number>\\.`), pair);
    assert.doesNotMatch(r.stderr, /Cannot find|ENOENT|no-existe/, pair);
  }
  assert.match(cli(["build", missing, "--set", "rate=abc", "--lang", "es"]).stderr, /^error: --set rate=abc: se esperaba <param>=<número>\./);
});

test("--set con un número arranca el control ahí; con un parámetro que no existe avisa y sigue", () => {
  const data = JSON.parse(cli(["build", spec, "--format", "json", "--set", "rate=5.5", "--set", "refill=1"]).stdout).data;
  assert.equal(data.params.find((p: { id: string }) => p.id === "rate").value, 5.5);
  assert.equal(data.params.find((p: { id: string }) => p.id === "refill").value, 1);
  const r = cli(["build", spec, "--set", "nada=1"]);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /^warning: --set nada: the spec has no such parameter\. \[set-unknown-param\]/m);
  assert.match(cli(["build", spec, "--set", "nada=1", "--lang", "es"]).stderr, /^aviso: --set nada: la spec no tiene ese parámetro\./m);
});

test("--format page no deja pasar la ExperimentalWarning de stripTypeScriptTypes", () => {
  scratch((dir) => {
    const r = cli(["build", spec, "--format", "page", "--model", model, "-o", join(dir, "page.html")], { warnings: true });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /stripTypeScriptTypes/);
    assert.match(r.stderr, /token-bucket: .* KB gzip/, "lo demás sí se imprime");
  });
});

test("check --model carga también un modelo .ts que está dentro de node_modules", () => {
  scratch((dir) => {
    const example = join(dir, "node_modules", "isofig", "examples", "token-bucket");
    mkdirSync(example, { recursive: true });
    cpSync(join(root, "examples/token-bucket"), example, { recursive: true });
    const r = cli(["check", join(example, "spec.ts"), "--model", join(example, "model.ts"), "--presets", "--strict"]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /token-bucket: .* KB gzip/);
  });
});

test("quietStripTypes silencia solo esa advertencia; las demás pasan y se puede deshacer", () => {
  const seen: string[] = [];
  const proc = { emitWarning: ((w: string | Error) => void seen.push(typeof w === "string" ? w : w.message)) as typeof process.emitWarning };
  const original = proc.emitWarning;
  const restore = quietStripTypes(proc);
  proc.emitWarning("stripTypeScriptTypes is an experimental feature and might change at any time", "ExperimentalWarning");
  proc.emitWarning(new Error("stripTypeScriptTypes se usó"));
  proc.emitWarning("Otra característica experimental", "ExperimentalWarning");
  proc.emitWarning(new Error("algo se va a romper"));
  assert.deepEqual(seen, ["Otra característica experimental", "algo se va a romper"]);
  restore();
  assert.equal(proc.emitWarning, original);
});

test("los prefijos de palette siguen --lang: «warning» con en y «aviso» con es", () => {
  const pale = ["palette", "--base", "oklch(0.9 0.02 15)"];
  const en = cli(pale);
  assert.equal(en.status, 1);
  assert.match(en.stderr, /^warning \((light|dark)\): /m);
  assert.doesNotMatch(en.stderr, /^aviso/m);
  assert.match(cli([...pale, "--lang", "es"]).stderr, /^aviso \((light|dark)\): /m);
  assert.match(cli(["palette", "--base", "verde", "--lang", "es"]).stderr, /^error: color «verde»/);
});

test("un error al leer la spec lleva el prefijo «error:»", () => {
  const r = cli(["check", missing]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^error: Cannot find module/);
});

// El mini-bundler de la página suelta ---------------------------------------------------------------------------

/** Escribe unos archivos, junta el primero y devuelve lo que exporta (el script se ejecuta en un contexto aparte). */
function bundled(files: Record<string, string>): Record<string, any> {
  return scratch((dir) => {
    for (const [name, code] of Object.entries(files)) writeFileSync(join(dir, name), code);
    return runInNewContext(`${bundle(join(dir, "a.ts"))}\n__model`);
  });
}

test("el mini-bundler reconoce export async function, function*, const, class y default", async () => {
  const m = bundled({
    "a.ts": [
      "export async function load(n: number): Promise<number> { return n + 1; }",
      "export function* gen() { yield 1; yield 2; }",
      "export const A: number = 1;",
      "export class Box { v = 3; }",
      "export default { name: 'modelo' };",
    ].join("\n"),
  });
  assert.equal(await m["load"](1), 2);
  assert.deepEqual([...m["gen"]()], [1, 2]);
  assert.equal(m["A"], 1);
  assert.equal(new m["Box"]().v, 3);
  assert.equal(m["default"].name, "modelo");
});

test("el mini-bundler reconoce export *, export * as y export { } from, y lo propio gana a lo reexportado", () => {
  const m = bundled({
    "a.ts": [
      'import { B } from "./b.ts";',
      'export * from "./b.ts";',
      'export * as c from "./c.ts";',
      'export { z as renamed, y } from "./c.ts";',
      'export * from "lodash";',
      "export const A = 1;",
      "export const useB = () => B + 1;",
    ].join("\n"),
    "b.ts": "export const B = 10;\nexport const A = 99;",
    "c.ts": "export const z = 'zeta';\nexport const y = 'ye';",
  });
  assert.equal(m["B"], 10);
  assert.equal(m["A"], 1, "la A local gana a la A de b.ts");
  assert.equal(m["c"].z, "zeta");
  assert.equal(m["renamed"], "zeta");
  assert.equal(m["y"], "ye");
  assert.equal(m["useB"](), 11);
});

test("el mini-bundler resuelve imports por defecto, con alias y de espacio de nombres, y las listas export { a as b }", () => {
  const m = bundled({
    "a.ts": [
      'import def, { f as g } from "./b.ts";',
      'import * as ns from "./b.ts";',
      "const local = 5;",
      "export { local as five, g };",
      "export const both = () => [def, ns.f(), ns.default];",
    ].join("\n"),
    "b.ts": "export default 'por-defecto';\nexport const f = () => 'efe';",
  });
  assert.equal(m["five"], 5);
  assert.equal(m["g"](), "efe");
  assert.deepEqual([...m["both"]()], ["por-defecto", "efe", "por-defecto"]);
});

test("--format page con un modelo que usa export async function y export * da un script válido", () => {
  scratch((dir) => {
    writeFileSync(join(dir, "extra.ts"), "export const LIMIT = 4;\nexport async function warm() { return LIMIT; }\n");
    writeFileSync(
      join(dir, "model.ts"),
      [
        'import type { Model } from "isofig/runtime";',
        'export * from "./extra.ts";',
        "export async function later() { return 1; }",
        "const model: Model<{ t: number }> = { init: () => ({ t: 0 }), step(s, dt) { s.t += dt; }, view: (s) => ({ readout: String(s.t) }) };",
        "export default model;",
      ].join("\n"),
    );
    const out = join(dir, "page.html");
    const r = cli(["build", spec, "--format", "page", "--model", join(dir, "model.ts"), "-o", out]);
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(out, "utf8");
    const script = /<script type="module">([\s\S]*)<\/script>/.exec(html)![1]!;
    assert.match(script, /\.\.\.__modelModule_1/, "reexporta lo de extra.ts");
    assert.match(script, /register\("token-bucket", __model\)/);
    const file = join(dir, "page.mjs");
    writeFileSync(file, script);
    const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(check.status, 0, check.stderr);
  });
});
