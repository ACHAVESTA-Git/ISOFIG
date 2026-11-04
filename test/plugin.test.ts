import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (ruta: string) => readFileSync(join(root, ruta), "utf8");
const pkg = JSON.parse(leer("package.json"));
const manifiesto = JSON.parse(leer(".claude-plugin/plugin.json"));

test("la versión de plugin.json es la de package.json", () => {
  assert.equal(manifiesto.version, pkg.version);
});

test("skills/isofig/SKILL.md tiene frontmatter con name y description", () => {
  const frontmatter = leer("skills/isofig/SKILL.md").match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatter, "SKILL.md no empieza con frontmatter");
  assert.match(frontmatter[1], /^name:\s*\S/m);
  assert.match(frontmatter[1], /^description:\s*\S/m);
});
