import { test } from "node:test";
import assert from "node:assert/strict";
import { makeCamera, project, depthOf } from "../src/core/camera.ts";
import { pathOf, dotsOf } from "../src/core/serialize.ts";
import { prism, roundedRect, frameOf } from "../src/core/mesh.ts";
import { drawMesh } from "../src/core/shade.ts";
import { compare } from "../src/core/order.ts";
import { expand } from "../src/core/items.ts";
import { renderFigure } from "../src/core/render.ts";
import tokenBucket from "../examples/token-bucket/spec.ts";

test("la cámara pone más cerca lo que está hacia el lector y arriba lo que sube", () => {
  const c = makeCamera();
  assert.ok(depthOf(c, [10, 10, 0]) > depthOf(c, [0, 0, 0]));
  assert.ok(project(c, [0, 0, 10])[1] < project(c, [0, 0, 0])[1]);
});

test("pathOf escribe relativo, en décimas y sin espacios de sobra", () => {
  assert.equal(pathOf([[[10, 20], [12.5, 20], [12.5, 18]]], true), "M10 20l2.5 0 0-2z");
  assert.equal(pathOf([[[0, 0], [0.5, 0.5]]], false), "M0 0l.5.5");
  assert.equal(dotsOf([[1, 2], [3.25, 4]]), "M1 2h0M3.3 4h0");
});

test("una caja muestra tapa y dos lados, con bordes de silueta y de pliegue", () => {
  const c = makeCamera({}, 4);
  const drawn = drawMesh(c, prism(roundedRect(10, 10, 0, 2), frameOf([0, 0, 0]), 10));
  const faces = [...drawn.faces.values()].flat();
  assert.equal(faces.length, 3);
  assert.ok(drawn.faces.has("t"));
  assert.ok(drawn.edges.length >= 1);
});

test("compare ordena por el eje que separa las cajas", () => {
  const c = makeCamera();
  const back = { min: [0, 0, 0], max: [10, 10, 10] } as const;
  const front = { min: [20, 0, 0], max: [30, 10, 10] } as const;
  assert.equal(compare(c, structuredClone(back) as any, structuredClone(front) as any), -1);
  assert.equal(compare(c, structuredClone(front) as any, structuredClone(back) as any), 1);
});

test("repeat crea copias con su índice en id y grupo", () => {
  const parts = expand([{ id: "coin-{i}", kind: "box", at: [0, 0, 0], size: [1, 1, 1], group: "g-{i}", repeat: { count: 3, step: [0, 0, 2] } }]);
  assert.deepEqual(parts.map((p) => p.id), ["coin-0", "coin-1", "coin-2"]);
  assert.deepEqual(parts.map((p) => ("group" in p ? p.group : "")), ["g-0", "g-1", "g-2"]);
  assert.deepEqual((parts[2] as any).at, [0, 0, 4]);
});

test("la figura de ejemplo entra en el presupuesto y pasa la auditoría", () => {
  const r = renderFigure(tokenBucket, { lang: "es", n: 1 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.ok(r.gzip < 40 * 1024, `pesa ${r.gzip} bytes gzip`);
  assert.match(r.html, /data-isofig="token-bucket"/);
  assert.match(r.html, /Balde de fichas/);
  assert.match(r.html, /<title id="token-bucket-t">/);
});

test("los textos caen al inglés si falta el idioma", () => {
  const r = renderFigure(tokenBucket, { lang: "pt" });
  assert.match(r.html, /Token bucket/);
});

test("el importador de compose arma un rack por servicio, en filas según dependencias", async () => {
  const { fromCompose } = await import("../src/core/importers/compose.ts");
  const spec = fromCompose({
    services: {
      web: { ports: [{ published: "80", target: 80 }], depends_on: { api: {} }, networks: { frente: null } },
      api: { depends_on: ["db"], networks: ["frente"], deploy: { replicas: 2 } },
      db: { volumes: [{ type: "volume", source: "datos" }] },
    },
  });
  const ids = spec.parts.map((p) => p.id);
  assert.ok(ids.includes("svc-0-0-u0"), "db en la fila del fondo");
  assert.ok(ids.includes("svc-1-0-u1"), "api con dos réplicas");
  assert.ok(ids.includes("svc-2-0-port-0"), "web con su puerto");
  assert.ok(ids.includes("vol-0"));
  const r = renderFigure(spec, { lang: "es" });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("la tarjeta no anuncia la lectura ni duplica el pie", () => {
  const r = renderFigure(tokenBucket, { lang: "es" });
  assert.doesNotMatch(r.html, /<output/);
  assert.doesNotMatch(r.html, /aria-pressed/);
  assert.doesNotMatch(r.html, /<desc/);
  assert.match(r.html, /aria-labelledby="token-bucket-t"/);
  assert.match(r.html, /class="isofig-controls" hidden/);
  assert.match(r.html, /aria-valuetext="2 fichas por segundo"/);
});

test("un id con caracteres raros es un error, y los tonos desconocidos caen a mid", () => {
  const r = renderFigure({ id: 'x" onload="y', title: "t", parts: [{ id: "a", kind: "box", at: [0, 0, 0], size: [4, 4, 4], tone: "zz" as never }] });
  assert.equal(r.errors.length, 1);
  assert.match(r.html, /<g class="mid">/);
  assert.doesNotMatch(r.html, /onload="y/);
});

test("los desvíos, interruptores y selectores salen como controles nativos", () => {
  const r = renderFigure({
    id: "panel",
    title: "t",
    params: [
      { id: "on", label: "Encendido", kind: "toggle", min: 0, max: 1, value: 1 },
      { id: "modo", label: "Modo", kind: "choice", options: ["uno", "dos"], min: 0, max: 1, value: 1 },
    ],
    presets: [{ label: "Corta", values: { on: 0 }, note: "Se apaga todo." }],
    parts: [{ id: "a", kind: "box", at: [0, 0, 0], size: [4, 4, 4] }],
  }, { lang: "es" });
  assert.match(r.html, /type="checkbox" role="switch" data-param="on" checked/);
  assert.match(r.html, /type="radio" name="panel-modo" value="1" data-param="modo" checked/);
  assert.match(r.html, /data-preset="0">Corta</);
  assert.match(r.html, /class="isofig-note" aria-live="polite"/);
  assert.deepEqual(r.data.presets, [{ values: { on: 0 }, note: "Se apaga todo." }]);
});

test("una acción es un botón que el modelo cuenta", () => {
  const r = renderFigure({
    id: "acc",
    title: "t",
    params: [{ id: "borrar", label: "Borrar un pod", kind: "action", min: 0, max: 99, value: 0 }],
    parts: [{ id: "a", kind: "box", at: [0, 0, 0], size: [4, 4, 4] }],
  });
  assert.match(r.html, /<button type="button" class="isofig-chip isofig-action" data-param="borrar" data-action>Borrar un pod<\/button>/);
});
