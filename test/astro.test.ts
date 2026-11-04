import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { claimInstance, firstOnPage } from "../src/astro/page.ts";
import { specifiers } from "./imports.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

test("la primera copia conserva el id de la spec y las siguientes se numeran", () => {
  const page = {};
  assert.equal(claimInstance(page, "balde"), "balde");
  assert.equal(claimInstance(page, "balde"), "balde-2");
  assert.equal(claimInstance(page, "balde"), "balde-3");
  assert.equal(claimInstance(page, "otra"), "otra");
});

test("cada página (petición) lleva su propia cuenta", () => {
  assert.equal(claimInstance({}, "balde"), "balde");
  assert.equal(claimInstance({}, "balde"), "balde");
});

test("una instance explícita se respeta; repetida es un error; y las automáticas no la pisan", () => {
  const page = {};
  assert.equal(claimInstance(page, "balde", "balde-2"), "balde-2");
  assert.equal(claimInstance(page, "balde"), "balde");
  assert.equal(claimInstance(page, "balde"), "balde-3", "salta el nombre que ya tomó una instance explícita");
  assert.throws(() => claimInstance(page, "balde", "balde-2"), /la instancia «balde-2» ya está en esta página/);
});

test("firstOnPage es verdadero una sola vez por clave y por página, sin chocar con las instancias", () => {
  const page = {};
  assert.equal(firstOnPage(page, "theme"), true);
  assert.equal(firstOnPage(page, "theme"), false);
  assert.equal(firstOnPage(page, "otra"), true);
  assert.equal(firstOnPage({}, "theme"), true);
  assert.equal(claimInstance(page, "theme"), "theme");
});

test("todo lo que el componente de Astro importa de isofig está exportado por el paquete", () => {
  const exported = new Set(Object.keys(pkg.exports).map((k) => (k === "." ? "isofig" : `isofig/${k.slice(2)}`)));
  const seen = new Set<string>();
  for (const file of ["Figure.astro", "client.ts", "page.ts"]) {
    for (const from of specifiers(join(root, "src/astro", file))) {
      if (from.startsWith("isofig")) seen.add(from.split("?")[0]);
    }
  }
  assert.ok(seen.has("isofig") && seen.has("isofig/astro/client") && seen.has("isofig/theme.css"), [...seen].join(", "));
  for (const from of seen) assert.ok(exported.has(from), `${from} no está en exports`);
});

test("el cliente de Astro no importa nada de Node ni del paquete: entra en un bundle de navegador", () => {
  assert.deepEqual(specifiers(join(root, "src/astro/client.ts")), []);
});

test("el CSS del tema no se importa como efecto: solo se incrusta donde se dibuja una figura", () => {
  const source = readFileSync(join(root, "src/astro/Figure.astro"), "utf8");
  assert.doesNotMatch(source, /^\s*import\s+["']isofig\/theme\.css["']/m);
  assert.match(source, /isofig\/theme\.css\?inline/);
});

test("el cliente activa el chip «Ampliar» antes de montar, y <Figure> deja quitarlo con zoom={false}", () => {
  const client = readFileSync(join(root, "src/astro/client.ts"), "utf8");
  const zoom = client.indexOf('zoomOnDemand(() => import("../zoom/index.ts"))');
  assert.ok(zoom > 0, "falta zoomOnDemand");
  assert.ok(zoom < client.indexOf("rt.mount(el)"), "el runtime solo muestra el chip de las figuras que montan después de zoomOnDemand");
  const component = readFileSync(join(root, "src/astro/Figure.astro"), "utf8");
  assert.match(component, /zoom = true/);
  assert.match(component, /renderFigure\(spec, \{[^}]*\bzoom\b[^}]*\}\)/);
});
