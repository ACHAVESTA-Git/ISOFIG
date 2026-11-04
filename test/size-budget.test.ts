import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { limits } = JSON.parse(readFileSync(join(root, "size-budget.json"), "utf8")) as { limits: Record<string, number> };

test("size-budget.json: topes enteros y positivos, y el runtime no pasa de los 4096 B que fija 0.9", () => {
  assert.deepEqual(Object.keys(limits).sort(), ["astro-client", "core", "kit", "map", "orbit", "runtime", "theme.css", "zoom"]);
  for (const [name, bytes] of Object.entries(limits)) assert.ok(Number.isInteger(bytes) && bytes > 0, `${name}: ${bytes}`);
  assert.ok(limits["runtime"]! <= 4096, "el tope del runtime es 4096 B hasta nuevo aviso: subirlo es una decisión, no un ajuste");
});
