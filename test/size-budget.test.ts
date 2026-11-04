import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { limits } = JSON.parse(readFileSync(join(root, "size-budget.json"), "utf8")) as { limits: Record<string, number> };

test("size-budget.json: topes enteros y positivos, y el runtime no pasa de los 4608 B que fija 0.10", () => {
  assert.deepEqual(Object.keys(limits).sort(), ["astro-client", "core", "kit", "map", "orbit", "runtime", "theme.css", "zoom"]);
  for (const [name, bytes] of Object.entries(limits)) assert.ok(Number.isInteger(bytes) && bytes > 0, `${name}: ${bytes}`);
  // 0.10 lo subió de 4096 a 4608 B por el acercamiento a la pieza elegida, que el usuario pidió como lo que distingue a isofig.
  assert.ok(limits["runtime"]! <= 4608, "el tope del runtime es 4608 B hasta nuevo aviso: subirlo es una decisión, no un ajuste");
});
