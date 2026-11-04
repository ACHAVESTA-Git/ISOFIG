import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reachable, specifiers } from "./imports.ts";
import { renderFigure } from "../src/core/render.ts";
import { checkBudget, measure } from "../src/node/index.ts";
import tokenBucket from "../examples/token-bucket/spec.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("el núcleo, el runtime y la órbita no importan nada de Node ni de paquetes (entran en un bundle de navegador)", () => {
  for (const entry of ["src/core/index.ts", "src/runtime/index.ts", "src/orbit/index.ts"]) {
    assert.deepEqual(specifiers(join(root, entry)), [], `${entry} importa algo que no es suyo`);
  }
});

test("el giro redibuja en el navegador con los nombres de las pinturas, sin las tablas de colores ni la validación", () => {
  const files = reachable(join(root, "src/orbit/index.ts")).map((f) => f.slice(root.length + 1));
  const palette = files.filter((f) => f.startsWith("src/core/palette/")).sort();
  assert.deepEqual(palette, ["src/core/palette/names.ts", "src/core/palette/paint.ts"]);
  for (const heavy of ["issues.ts", "validate.ts", "audit.ts", "render.ts", "check.ts"]) {
    assert.equal(files.some((f) => f.endsWith(`/${heavy}`)), false, `el giro arrastra ${heavy}`);
  }
});

test("measure da bytes y gzip, y renderFigure cuenta los mismos bytes sin Node", () => {
  const r = renderFigure(tokenBucket, { lang: "es" });
  const m = measure(r.html);
  assert.equal(m.bytes, r.bytes);
  assert.ok(m.gzip > 0 && m.gzip < m.bytes);
  assert.equal(measure("áé").bytes, 4);
  assert.equal("gzip" in r, false);
});

test("checkBudget avisa solo si el gzip pasa el presupuesto, en el idioma pedido", () => {
  const m = { bytes: 90 * 1024, gzip: 41 * 1024 };
  assert.deepEqual(checkBudget({}, { bytes: 10, gzip: 40 * 1024 }), []);
  assert.deepEqual(checkBudget({ budget: 50 }, m), []);
  assert.deepEqual(checkBudget({}, m), ["weighs 41.0 KB gzip, over the budget of 40 KB"]);
  assert.deepEqual(checkBudget({ budget: 30 }, m, "es"), ["pesa 41.0 KB gzip, más que el presupuesto de 30 KB"]);
});
