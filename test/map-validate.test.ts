import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSpec } from "../src/core/validate.ts";

const base = { id: "m", title: "t", caption: "c" };
const node = (id: string, is = "service", extra: object = {}) => ({ id, is, ...extra });
const issues = (map: unknown, extra: object = {}) => validateSpec({ ...base, map, ...extra });
const codes = (map: unknown, extra: object = {}) => issues(map, extra).map((i) => `${i.code}@${i.path}`);

test("un mapa bien hecho no da avisos, y no se le piden piezas", () => {
  const map = {
    layout: "flow",
    nodes: [node("a"), { id: "c", is: "vpc", children: [node("b", "database")] }],
    links: [{ from: "a", to: ["b"], label: "x", kind: "depends" }],
    flows: [{ path: ["a", "b"], label: "f", paint: "steel" }],
  };
  assert.deepEqual(issues(map), []);
});

test("un id de nodo repetido es un error, también dentro de un contenedor", () => {
  const found = issues({ nodes: [node("a"), { id: "c", children: [node("a")] }] }).find((i) => i.code === "map-node-id-duplicate")!;
  assert.equal(found.severity, "error");
  assert.equal(found.path, "map.nodes[1].children[0].id");
  assert.match(found.message, /Duplicate node id 'a'/);
  assert.match(validateSpec({ ...base, map: { nodes: [node("a"), node("a")] } }, { lang: "es" }).find((i) => i.code === "map-node-id-duplicate")!.message, /id de nodo repetido/);
});

test("un `is` fuera del catálogo es un error, salvo en un contenedor, donde es solo su etiqueta", () => {
  assert.deepEqual(codes({ nodes: [node("a", "mainframe")] }), ["map-glyph-unknown@map.nodes[0].is"]);
  assert.deepEqual(codes({ nodes: [{ id: "a" }] }), ["map-glyph-unknown@map.nodes[0].is"]);
  assert.deepEqual(codes({ nodes: [{ id: "a", is: "region", children: [node("b")] }] }), []);
});

test("los enlaces y los flujos que nombran un nodo que no existe son un error con su camino", () => {
  const map = {
    nodes: [node("a"), node("b")],
    links: [{ from: "a", to: "zeta" }, { from: ["a", "nada"], to: "b" }],
    flows: [{ path: ["a", "ghost"], label: "f" }, { path: ["a"], label: "g" }],
  };
  assert.deepEqual(codes(map), [
    "map-node-unknown@map.links[0].to",
    "map-node-unknown@map.links[1].from[1]",
    "map-node-unknown@map.flows[0].path[1]",
    "map-flow-short@map.flows[1].path",
  ]);
  assert.equal(issues(map).find((i) => i.code === "map-node-unknown")!.severity, "error");
  assert.equal(issues(map).find((i) => i.code === "map-flow-short")!.severity, "warning");
});

test("el reparto, el tipo de enlace, la flecha y la pintura se comprueban contra lo que existe", () => {
  const map = {
    layout: "radial",
    nodes: [node("a", "service", { paint: "naranja", layout: "tabla", cell: [0] }), node("b")],
    links: [{ from: "a", to: "b", kind: "amigo", arrow: "fuera", paint: "rojo" }],
    flows: [{ path: ["a", "b"], label: "f", every: 0, speed: -1, delay: -2, paint: "fail" }],
    legend: "si",
    extra: 1,
  };
  const got = codes(map);
  for (const expected of [
    "option-invalid@map.layout", "option-invalid@map.nodes[0].layout", "vector-length-invalid@map.nodes[0].cell", "map-paint-unknown@map.nodes[0].paint",
    "option-invalid@map.links[0].kind", "option-invalid@map.links[0].arrow", "map-paint-unknown@map.links[0].paint", "map-paint-unknown@map.flows[0].paint",
    "number-invalid@map.flows[0].every", "number-invalid@map.flows[0].speed", "number-invalid@map.flows[0].delay", "type-invalid@map.legend", "unknown-key@map.extra",
  ]) assert.ok(got.includes(expected), `falta ${expected}\n${got.join("\n")}`);
});

test("dos nodos en la misma celda de una cuadrícula avisan", () => {
  const found = issues({ layout: "grid", nodes: [node("a", "service", { cell: [1, 0] }), node("b", "service", { cell: [1, 0] })] }).find((i) => i.code === "map-cell-collision")!;
  assert.equal(found.path, "map.nodes[1].cell");
  assert.equal(found.severity, "warning");
});

test("un mapa que no es un objeto, o sin lista de nodos, no rompe el validador", () => {
  assert.equal(codes("hola")[0], "type-invalid@map");
  assert.deepEqual(codes({ nodes: "x" }), ["type-invalid@map.nodes"]);
  assert.deepEqual(codes({ nodes: [3, null] }), ["type-invalid@map.nodes[0]", "type-invalid@map.nodes[1]"]);
});

test("un recorrido sin dos puntos, con un periodo que no es mayor que 0 o hacia un grupo que no existe, se avisa", () => {
  const part = { id: "p", kind: "box", at: [0, 0, 0], size: [1, 1, 1], group: "paquete" };
  const run = (tracks: unknown[]) => validateSpec({ ...base, parts: [part], tracks }).map((i) => `${i.code}@${i.path}:${i.severity}`);
  assert.deepEqual(run([{ group: "paquete", path: [[0, 0, 0], [1, 0, 0]], period: 3 }]), []);
  assert.deepEqual(run([{ group: "paquete", path: [[0, 0, 0], [0, 0, 0]], period: 3 }]), ["track-path-short@tracks[0].path:error"]);
  assert.deepEqual(run([{ group: "paquete", path: [[0, 0, 0], [1, 0, 0]], period: 0 }]), ["track-period-invalid@tracks[0].period:error"]);
  assert.deepEqual(run([{ group: "paquete", path: [[0, 0, 0], [1, 0, 0]], period: "x" }]), ["track-period-invalid@tracks[0].period:error"]);
  assert.deepEqual(run([{ group: "otro", path: [[0, 0, 0], [1, 0, 0]], period: 2 }]), ["track-group-unknown@tracks[0].group:warning"]);
  assert.deepEqual(run([{ group: "paquete", path: [[0, 0, 0], [1, 0, 0]], period: 2, delay: -1 }]), ["track-delay-invalid@tracks[0].delay:warning"]);
  assert.deepEqual(run([{ group: "paquete", path: [[0, 0, 0], [1, 0]], period: 2 }]), ["vector-length-invalid@tracks[0].path[1]:error"]);
  assert.deepEqual(run(["x"]), ["type-invalid@tracks[0]:error"]);
});
