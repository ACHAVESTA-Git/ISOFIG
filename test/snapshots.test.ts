import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fromCompose } from "../src/core/importers/compose.ts";
import { resolveMap } from "../src/core/map/index.ts";
import { renderFigure } from "../src/core/render.ts";
import type { FigureSpec } from "../src/core/spec.ts";
import { diffText, expectSnapshot, pretty, SNAPSHOTS } from "./snapshot.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examples = join(root, "examples");

/** Cada `examples/<nombre>/spec.ts|js|json` es un ejemplo con instantánea: basta añadir la carpeta. */
const found = readdirSync(examples, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => {
    const file = ["spec.ts", "spec.js", "spec.json"].map((f) => join(examples, d.name, f)).find(existsSync);
    return file ? [{ name: d.name, file }] : [];
  })
  .sort((a, b) => a.name.localeCompare(b.name));

async function load(file: string): Promise<FigureSpec> {
  if (file.endsWith(".json")) return JSON.parse(readFileSync(file, "utf8"));
  const mod = await import(pathToFileURL(file).href);
  return mod.default ?? mod.spec;
}

test("hay ejemplos con instantánea, y al menos token-bucket y compose", () => {
  const names = found.map((e) => e.name);
  for (const need of ["token-bucket", "compose"]) assert.ok(names.includes(need), `falta examples/${need}`);
});

for (const { name, file } of found) {
  test(`el SVG de examples/${name} no cambia (UPDATE_SNAPSHOTS=1 npm test lo actualiza)`, async () => {
    const spec = await load(file);
    const r = renderFigure(spec, { lang: "en", resolveMap });
    assert.deepEqual(r.errors, []);
    assert.equal(renderFigure(spec, { lang: "en", resolveMap }).svg, r.svg, "dos builds iguales dan el mismo texto");
    expectSnapshot(`${name}.svg`, pretty(r.svg));
  });
}

test("no quedan instantáneas de ejemplos que ya no existen", () => {
  const files = existsSync(SNAPSHOTS) ? readdirSync(SNAPSHOTS).filter((f) => f.endsWith(".svg")) : [];
  assert.deepEqual(files.filter((f) => !found.some((e) => `${e.name}.svg` === f)), []);
});

test("examples/compose/spec.json es lo que isofig import compose saca de compose.json", () => {
  const imported = JSON.stringify(fromCompose(JSON.parse(readFileSync(join(examples, "compose", "compose.json"), "utf8"))), null, 2) + "\n";
  assert.equal(readFileSync(join(examples, "compose", "spec.json"), "utf8"), imported);
});

test("el informe de diferencias dice qué línea cambió, con su contexto y su número", () => {
  const want = ["<svg>", '<g id="a">', '<rect x="1"/>', '<rect x="2"/>', "</g>", '<g id="b">', '<rect x="3"/>', "</g>", "</svg>"].join("\n");
  const got = ["<svg>", '<g id="a">', '<rect x="1"/>', '<rect x="22"/>', "</g>", '<g id="b">', '<rect x="3"/>', '<rect x="4"/>', "</g>", "</svg>"].join("\n");
  const report = diffText(want, got);
  assert.match(report, /^1 líneas distintas en lo esperado, 2 en lo obtenido:/);
  assert.match(report, /@@ esperado 2, obtenido 2 @@/);
  assert.match(report, /^- <rect x="2"\/>$/m);
  assert.match(report, /^\+ <rect x="22"\/>$/m);
  assert.match(report, /^\+ <rect x="4"\/>$/m);
  assert.match(report, /^ {2}<g id="a">$/m, "las líneas de contexto no llevan marca");
  assert.equal(diffText(want, want), "0 líneas distintas en lo esperado, 0 en lo obtenido:");
});
