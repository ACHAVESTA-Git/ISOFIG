import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { specifiers } from "./imports.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli/index.ts");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

test("exports solo publica rutas con salida estable; el componente de Angular se copia, no se importa", () => {
  assert.deepEqual(Object.keys(pkg.exports), [".", "./runtime", "./orbit", "./kit", "./map", "./node", "./zoom", "./astro", "./astro/client", "./theme.css", "./themes/luxe.css", "./package.json"]);
  assert.equal("./angular" in pkg.exports, false);
  for (const need of ["src/angular", "src/theme", "src/astro", "CHANGELOG.md"]) assert.ok(pkg.files.includes(need), `files no incluye ${need}`);
  for (const [name, target] of Object.entries<any>(pkg.exports)) {
    const file: string = typeof target === "string" ? target : target.default;
    if (!file.startsWith("./dist/")) assert.ok(existsSync(join(root, file)), `${name} apunta a ${file}, que no existe`);
  }
  assert.equal(pkg.sideEffects.includes("./src/theme/theme.css"), true);
  assert.equal(pkg.sideEffects.includes("./src/theme/luxe.css"), true);
  assert.match(pkg.scripts.prepack, /npm run build/);
  assert.match(pkg.scripts.prepublishOnly, /check/);
  assert.match(pkg.scripts.prepublishOnly, /npm test/);
});

test("los ejemplos que se publican solo importan por el nombre del paquete", () => {
  for (const file of pkg.files.filter((f: string) => f.startsWith("examples/"))) {
    for (const from of specifiers(join(root, file))) assert.match(from, /^isofig(\/|$)/, `${file} importa «${from}»`);
  }
});

test("isofig add angular copia el componente", () => {
  const dir = mkdtempSync(join(tmpdir(), "isofig-add-"));
  try {
    const r = spawnSync(process.execPath, ["--no-warnings", cli, "add", "angular", join(dir, "app", "isofig")], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(dir, "app", "isofig", "isofig-figure.ts"), "utf8"), readFileSync(join(root, "src/angular/isofig-figure.ts"), "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("la CLI carga una spec en TypeScript aunque esté dentro de node_modules", () => {
  const dir = mkdtempSync(join(tmpdir(), "isofig-nm-"));
  try {
    const example = join(dir, "node_modules", "isofig", "examples", "token-bucket");
    mkdirSync(example, { recursive: true });
    cpSync(join(root, "examples/token-bucket"), example, { recursive: true });
    const r = spawnSync(process.execPath, ["--no-warnings", cli, "check", join(example, "spec.ts"), "--strict"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /token-bucket: .* KB gzip/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
