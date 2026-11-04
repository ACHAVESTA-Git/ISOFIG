import { test } from "node:test";
import assert from "node:assert/strict";
import { renderFigure } from "../src/core/render.ts";
import { drawScene } from "../src/core/scene.ts";
import type { FigureSpec } from "../src/core/spec.ts";

// Una figura con todo lo que lleva id o name: título y descripción, piezas repetidas (<defs>) y radios.
const spec: FigureSpec = {
  id: "panel",
  title: "Panel",
  caption: "El pie.",
  alt: "Una descripción distinta del pie.",
  params: [
    { id: "modo", label: "Modo", kind: "choice", options: ["uno", "dos"], min: 0, max: 1, value: 0 },
    { id: "nivel", label: "Nivel", min: 0, max: 9, value: 3 },
  ],
  palette: { use: ["steel"] },
  parts: [
    { id: "base", kind: "box", at: [0, 0, 0], size: [60, 200, 4], tone: "lo", paint: "steel" },
    { id: "caja-{i}", kind: "box", at: [20, 10, 4], size: [20, 20, 14], radius: 3, bevel: 1, tone: "hi", group: "caja-{i}", repeat: { count: 4, step: [0, 45, 0] } },
  ],
};

const all = (html: string, attr: string) => [...html.matchAll(new RegExp(`\\s${attr}="([^"]*)"`, "g"))].map((m) => m[1]);

test("sin instance el marcado es el de siempre, y con instance igual al id también", () => {
  const plain = renderFigure(spec, { lang: "es", n: 1, orbit: true });
  assert.equal(renderFigure(spec, { lang: "es", n: 1, orbit: true, instance: "panel" }).html, plain.html);
  assert.ok(all(plain.html, "id").includes("panel-t"));
  assert.ok(all(plain.html, "id").includes("panel-d"));
  assert.ok(all(plain.html, "id").includes("panel-p0"));
  assert.ok(all(plain.html, "name").includes("panel-modo"));
});

test("dos renders con distinta instance no comparten ningún id ni name", () => {
  const a = renderFigure(spec, { instance: "panel-a" });
  const b = renderFigure(spec, { instance: "panel-b" });
  assert.deepEqual(a.errors, []);
  const ids = [all(a.html, "id"), all(b.html, "id")];
  const names = [all(a.html, "name"), all(b.html, "name")];
  // La prueba no vale si el marcado no trae nada que comparar.
  assert.ok(ids[0].length >= 3 && names[0].length >= 2, `ids: ${ids[0]}; names: ${names[0]}`);
  assert.deepEqual(ids[0].filter((id) => ids[1].includes(id)), []);
  assert.deepEqual(names[0].filter((name) => names[1].includes(name)), []);
  // Cada referencia apunta a un id de su propia copia.
  for (const [html, own] of [[a.html, ids[0]], [b.html, ids[1]]] as const) {
    for (const ref of [...all(html, "aria-labelledby"), ...all(html, "aria-describedby")]) assert.ok(own.includes(ref), ref);
    for (const href of all(html, "href")) assert.ok(own.includes(href.slice(1)), href);
  }
});

test("instance solo cambia ids y names: la identidad de la figura y el JSON del runtime siguen siendo los de la spec", () => {
  const a = renderFigure(spec, { instance: "panel-2" });
  assert.match(a.html, /data-isofig="panel"/);
  assert.equal(a.data.id, "panel");
  const strip = (html: string) => html.replaceAll("panel-2", "panel");
  assert.equal(strip(a.html), renderFigure(spec).html);
});

test("una instance con caracteres raros es un error y no se cuela en el marcado", () => {
  const r = renderFigure(spec, { instance: 'x" onload="y' });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /instance/);
  assert.doesNotMatch(r.html, /onload="y/);
  assert.equal(renderFigure(spec, { instance: "" }).errors.length, 1);
});

test("el giro redibuja con los ids de su instancia (drawScene)", () => {
  const own = drawScene(spec, "en", { azimuth: 50, instance: "panel-3" }).markup;
  assert.match(own, /<g id="panel-3-p0">/);
  assert.doesNotMatch(own, /id="panel-p0"/);
  assert.match(drawScene(spec, "en", { azimuth: 50 }).markup, /<g id="panel-p0">/);
});
