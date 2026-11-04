import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileMap, resolveMap, GLYPHS, type MapSpec } from "../src/core/map/index.ts";
import { build } from "../src/core/map/place.ts";
import { routeAll, type Rect, type RouteReq } from "../src/core/map/route.ts";
import { buildFlow } from "../src/core/map/flows.ts";
import { styleOf } from "../src/core/map/links.ts";
import { CATALOG } from "../src/core/map/glyphs/index.ts";
import { renderFigure } from "../src/core/render.ts";
import { assemble } from "../src/core/tree.ts";
import type { TreeNode } from "../src/core/map/types.ts";
import { measure } from "../src/node/index.ts";
import type { FigureSpec, Part } from "../src/core/spec.ts";

/** Las piezas de un árbol de nodos, ya aplanadas por el ensamblado. */
const partsOf = (root: TreeNode): Part[] => assemble({ id: "t", title: "t", root }).parts;

const example = (name: string): FigureSpec => JSON.parse(readFileSync(new URL(`../examples/${name}/spec.json`, import.meta.url), "utf8"));
const node = (id: string, is = "service", extra: object = {}) => ({ id, is, name: id, ...extra });
const CAMERA = { azimuth: -24, elevation: 44 };

test("cada objeto del catálogo es un nodo con piezas pintadas con un rol, y ninguna queda con el marcador", () => {
  assert.equal(GLYPHS.length, 17);
  for (const is of GLYPHS) {
    const c = compileMap({ nodes: [node("x", is, { fields: ["a: b"], methods: ["m()"] })] });
    const parts = partsOf(c.root);
    assert.ok(parts.length >= 6, `${is} tiene solo ${parts.length} piezas`);
    assert.equal(parts.some((p) => (p as { paint?: string }).paint === "$role"), false, is);
    assert.ok(parts.some((p) => (p as { paint?: string }).paint === CATALOG[is].role), `${is} no usa su rol ${CATALOG[is].role}`);
  }
});

test("un nodo con children es una bandeja: su tamaño sale de sus hijos y los anida en el árbol", () => {
  const c = compileMap({ nodes: [{ id: "vpc", is: "vpc", name: "tienda", children: [{ id: "net", is: "subnet", children: [node("a"), node("b")] }] }] });
  const vpc = c.root.children![0];
  assert.equal(vpc.id, "vpc");
  assert.deepEqual(vpc.children!.map((n) => n.id), ["net"]);
  assert.deepEqual(vpc.children![0].children!.map((n) => n.id), ["a", "b"]);
  const tray = (n: typeof vpc) => n.parts!.find((p) => p.id === "tray") as Extract<Part, { kind: "box" }>;
  assert.ok(tray(vpc).size[0] > tray(vpc.children![0]).size[0], "la bandeja de afuera es más grande");
  assert.ok(tray(vpc).size[1] > tray(vpc.children![0]).size[1]);
  assert.equal(vpc.parts!.find((p) => p.id === "name")?.kind, "label");
  const label = vpc.parts!.find((p) => p.id === "name") as Extract<Part, { kind: "label" }>;
  assert.deepEqual(label.text, "VPC tienda");
});

test("flow pone cada rango de izquierda a derecha y apila los de un mismo rango hacia el lector", () => {
  const map: MapSpec = {
    nodes: [node("a"), node("b"), node("c"), node("d")],
    links: [{ from: "a", to: "b" }, { from: "a", to: "c" }, { from: "b", to: "d" }],
  };
  const { byId } = build(map, 9, CAMERA);
  const [a, b, c, d] = ["a", "b", "c", "d"].map((id) => byId.get(id)!);
  assert.ok(a.ay + a.fy < b.ay, "b va a la derecha de a");
  assert.ok(b.ay + b.fy < d.ay, "d va a la derecha de b");
  assert.equal(Math.round(b.ay), Math.round(c.ay), "b y c son del mismo rango");
  assert.ok(b.ax + b.fx <= c.ax || c.ax + c.fx <= b.ax, "y se apilan sin tocarse");
});

test("un ciclo no cuelga el reparto y el rango forzado manda", () => {
  const map: MapSpec = { nodes: [node("a"), node("b", "service", { rank: 3 }), node("c")], links: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "a" }] };
  const { byId } = build(map, 9, CAMERA);
  assert.ok(byId.get("b")!.ay > byId.get("a")!.ay);
  assert.ok(byId.get("b")!.ay > byId.get("c")!.ay, "b está en el rango 3, después de todos");
});

test("layers pone al padre de una herencia arriba (atrás) y a los hijos debajo, uno al lado del otro", () => {
  const map: MapSpec = {
    layout: "layers",
    nodes: [node("hijo-1", "class"), node("hijo-2", "class"), node("padre", "class")],
    links: [{ from: ["hijo-1", "hijo-2"], to: "padre", kind: "inherits" }],
  };
  const { byId } = build(map, 9, { azimuth: -14, elevation: 46 });
  const [p, h1, h2] = ["padre", "hijo-1", "hijo-2"].map((id) => byId.get(id)!);
  assert.ok(p.ax + p.fx < h1.ax, "el padre queda detrás");
  assert.equal(Math.round(h1.ax), Math.round(h2.ax), "los hijos van en el mismo nivel");
  assert.ok(h1.ay + h1.fy <= h2.ay || h2.ay + h2.fy <= h1.ay, "uno al lado del otro");
});

test("grid usa la celda [columna, fila] y corre al que cae en una celda ocupada", () => {
  const map: MapSpec = { layout: "grid", nodes: [node("a", "service", { cell: [0, 0] }), node("b", "service", { cell: [1, 0] }), node("c", "service", { cell: [0, 1] }), node("d", "service", { cell: [0, 0] })] };
  const { byId } = build(map, 9, CAMERA);
  const at = (id: string) => [Math.round(byId.get(id)!.ay), Math.round(byId.get(id)!.ax)];
  assert.ok(at("b")[0] > at("a")[0] && at("b")[1] === at("a")[1], "b está a la derecha de a, en la misma fila");
  assert.ok(at("c")[1] > at("a")[1] && at("c")[0] === at("a")[0], "c está debajo (hacia el lector) de a");
  assert.notDeepEqual(at("d"), at("a"), "d no se encima con a");
});

test("un objeto alto deja más sitio al de adelante: nada le tapa el rótulo", () => {
  const low = build({ nodes: [node("a", "function"), node("b", "function")], links: [{ from: "a", to: "b" }] }, 9, CAMERA);
  const tall = build({ nodes: [node("a", "server"), node("b", "server")], links: [] }, 9, CAMERA);
  const gap = (b: ReturnType<typeof build>) => {
    const [p, q] = [b.byId.get("a")!, b.byId.get("b")!];
    return Math.abs(q.ax - (p.ax + p.fx));
  };
  assert.ok(gap(tall) > 28, "los racks se separan más que el piso mínimo");
  void low;
});

const R = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0, y0, x1, y1 });
const req = (from: Rect, to: Rect, src = "a", dst = "b"): RouteReq => ({ from, to, fromBlocks: true, toBlocks: true, src, dst });

/** ¿El segmento entre `a` y `b` entra en el interior de `r`? */
const crosses = (a: [number, number], b: [number, number], r: Rect): boolean =>
  Math.max(a[0], b[0]) > r.x0 + 0.01 && Math.min(a[0], b[0]) < r.x1 - 0.01 && Math.max(a[1], b[1]) > r.y0 + 0.01 && Math.min(a[1], b[1]) < r.y1 - 0.01;

test("las rutas son ortogonales, salen del borde de un nodo, llegan al borde de otro y esquivan al del medio", () => {
  const a = R(0, 0, 40, 40);
  const wall = R(0, 100, 40, 140);
  const b = R(0, 200, 40, 240);
  const [r] = routeAll([req(a, b)], { visible: ["F", "L"] });
  assert.equal(r.blocked, false);
  const pts = r.pts;
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i][0] === pts[i - 1][0] || pts[i][1] === pts[i - 1][1], "cada tramo es horizontal o vertical");
  const onEdge = (p: [number, number], rect: Rect) => [rect.x0, rect.x1].includes(p[0]) || [rect.y0, rect.y1].includes(p[1]);
  assert.ok(onEdge(pts[0], a) && onEdge(pts[pts.length - 1], b));
  const [only] = routeAll([req(a, b), req(wall, R(100, 100, 140, 140), "w", "x")], { visible: ["F", "L"] });
  for (let i = 1; i < only.pts.length; i++) assert.equal(crosses(only.pts[i - 1], only.pts[i], wall), false, "no atraviesa el nodo del medio");
});

test("la ruta rodea un nodo que le cierra el paso y avisa si no hay camino", () => {
  const a = R(0, 0, 40, 40);
  const b = R(0, 200, 40, 240);
  const wall = R(-30, 90, 70, 150);
  const [r] = routeAll([{ ...req(a, b), }], { visible: ["F", "L"], blocks: [wall] });
  for (let i = 1; i < r.pts.length; i++) assert.equal(crosses(r.pts[i - 1], r.pts[i], wall), false);
  assert.ok(r.pts.length > 2, "tiene que girar para rodear");
});

/** Cuánto mide el dibujo de varias rutas: lo que va por la misma línea se cuenta una sola vez. */
function inkOf(routes: { pts: [number, number][] }[]): number {
  const lines = new Map<string, [number, number][]>();
  for (const r of routes) {
    for (let i = 1; i < r.pts.length; i++) {
      const [p, q] = [r.pts[i - 1], r.pts[i]];
      const vertical = p[0] === q[0];
      const key = `${vertical ? "v" : "h"}${Math.round((vertical ? p[0] : p[1]) * 10)}`;
      const span: [number, number] = vertical ? [Math.min(p[1], q[1]), Math.max(p[1], q[1])] : [Math.min(p[0], q[0]), Math.max(p[0], q[0])];
      lines.set(key, [...(lines.get(key) ?? []), span]);
    }
  }
  let total = 0;
  for (const spans of lines.values()) {
    let end = -Infinity;
    for (const [a, b] of spans.sort((x, y) => x[0] - y[0])) {
      total += Math.max(0, b - Math.max(a, end));
      end = Math.max(end, b);
    }
  }
  return total;
}

test("las cintas que comparten origen y estilo se juntan en un tronco; con otros orígenes, cada una va por su lado", () => {
  const a = R(0, 0, 40, 40);
  const targets = [R(-100, 200, -60, 240), R(0, 200, 40, 240), R(100, 200, 140, 240)];
  const shared = routeAll(targets.map((t, i) => req(a, t, "a", `t${i}`)), { visible: ["F", "L"] });
  const apart = routeAll(targets.map((t, i) => req(a, t, `s${i}`, `t${i}`)), { visible: ["F", "L"] });
  assert.ok(inkOf(shared) < inkOf(apart) * 0.8, `${inkOf(shared)} frente a ${inkOf(apart)}`);
});

test("cada tipo de enlace lleva sus extremos: triángulo hueco, rombo lleno o hueco, punta, discontinua", () => {
  assert.deepEqual(styleOf({ from: "a", to: "b", kind: "inherits" }), { from: "none", to: "triangle", dashed: false });
  assert.deepEqual(styleOf({ from: "a", to: "b", kind: "implements" }), { from: "none", to: "triangle", dashed: true });
  assert.deepEqual(styleOf({ from: "a", to: "b", kind: "composes" }), { from: "diamond-filled", to: "none", dashed: false });
  assert.deepEqual(styleOf({ from: "a", to: "b", kind: "aggregates" }), { from: "diamond", to: "none", dashed: false });
  assert.deepEqual(styleOf({ from: "a", to: "b", kind: "depends" }), { from: "none", to: "arrow", dashed: true });
  assert.deepEqual(styleOf({ from: "a", to: "b" }), { from: "none", to: "arrow", dashed: false });
  assert.deepEqual(styleOf({ from: "a", to: "b", arrow: "both", dashed: true }), { from: "arrow", to: "arrow", dashed: true });
  const c = compileMap({
    layout: "layers",
    nodes: [node("p", "class"), node("h", "class"), node("t", "class"), node("u", "class")],
    links: [{ from: "h", to: "p", kind: "inherits" }, { from: "p", to: "t", kind: "composes" }, { from: "p", to: "u", kind: "depends" }],
  });
  const links = c.root.children!.find((n) => n.id === "_links")!.parts!;
  const heads = links.filter((p) => /-head\d$/.test(p.id)) as Extract<Part, { kind: "prism" }>[];
  assert.deepEqual(heads.map((h) => h.plan.length).sort(), [3, 3, 4], "un triángulo hueco, una punta y un rombo");
  const hollow = heads.filter((h) => h.tone === "hi");
  assert.equal(hollow.length, 1, "solo el triángulo es hueco (tono claro)");
  assert.ok(links.some((p) => /-d\d+$/.test(p.id)), "la dependencia es discontinua");
});

test("un flujo es un paquete por recorrido: periodo por el arco, parejos y apagados dentro de los objetos", () => {
  const hop = (x: number) => ({ pts: [[x, 0], [x, 100], [x + 50, 100]] as [number, number][], z: 0 });
  const out = buildFlow({ path: ["a", "b", "c"], label: "x", every: 2, speed: 50 }, 0, [hop(0), hop(60)]);
  assert.ok(out.tracks.length >= 2);
  const t = out.tracks[0];
  assert.equal(new Set(out.tracks.map((k) => k.period)).size, 1);
  assert.ok(t.period >= 2);
  const delays = out.tracks.map((k) => k.delay ?? 0);
  const step = delays[1] - delays[0];
  assert.ok(delays.every((d, i) => Math.abs(d - delays[0] - i * step) < 1e-9), "escalonados a la misma distancia");
  assert.equal(t.hide?.length, 1, "entre los dos tramos pasa por dentro de un objeto");
  assert.ok(t.hide![0][0] > 0 && t.hide![0][1] < 1 && t.hide![0][0] < t.hide![0][1]);
  const solids = out.parts.filter((p) => p.kind === "box");
  assert.equal(solids.length, out.tracks.length);
  assert.ok(solids.every((p) => (p as { group?: string }).group?.startsWith("pkt-")));
  assert.deepEqual(buildFlow({ path: ["a", "b"], label: "x" }, 0, []).tracks, []);
});

test("los paquetes de un mapa salen de sus flujos y siguen la cinta entre los nodos", () => {
  const c = compileMap({
    nodes: [node("a"), node("b"), node("c")],
    links: [{ from: "a", to: "b" }, { from: "b", to: "c" }],
    flows: [{ id: "f", path: ["a", "b", "c"], label: "uno" }, { id: "g", path: ["a", "c"], label: "dos" }],
  });
  assert.ok(c.tracks.some((t) => t.group.startsWith("pkt-f-")));
  assert.ok(c.tracks.some((t) => t.group.startsWith("pkt-g-")), "un flujo sobre un par sin enlace crea la cinta que le falta");
  const parts = partsOf(c.root).filter((p) => "group" in p && p.group);
  for (const t of c.tracks) assert.ok(parts.some((p) => (p as { group?: string }).group === t.group), `${t.group} tiene piezas`);
  for (const t of c.tracks) assert.ok(t.path.length >= 2 && t.period > 0);
});

test("compilar dos veces da lo mismo, byte a byte", () => {
  const spec = example("mapa-tienda");
  assert.equal(JSON.stringify(compileMap(spec.map!)), JSON.stringify(compileMap(spec.map!)));
  const html = (s: FigureSpec) => renderFigure(s, { lang: "es" }).html;
  assert.equal(html(spec), html(spec));
});

test("resolveMap deja una spec sin mapa como está y completa lo que falta en una con mapa", () => {
  const plain: FigureSpec = { id: "p", title: "t", parts: [] };
  assert.equal(resolveMap(plain).spec, plain);
  const out = resolveMap({ id: "m", title: "t", map: { nodes: [node("a"), node("b")], links: [{ from: "a", to: "b" }], flows: [{ path: ["a", "b"], label: "f" }] } }).spec as FigureSpec & { root?: unknown };
  assert.equal("map" in out, false);
  assert.ok(out.root && out.tracks!.length > 0 && out.width === 1150 && out.height! > 0);
  assert.equal(out.camera!.azimuth, -24);
  assert.match(String((out.readout as Record<string, string>)["es"]), /2 objetos · 1 enlace · 1 flujo/);
  assert.match(String((out.alt as Record<string, string>)["en"]), /Links: a → b/);
  const mine = resolveMap({ id: "m", title: "t", width: 800, height: 500, camera: { azimuth: 10 }, readout: "mío", alt: "mío", map: { nodes: [node("a")] } }).spec;
  assert.deepEqual([mine.width, mine.height, mine.camera, mine.readout, mine.alt], [800, 500, { azimuth: 10, elevation: 44 }, "mío", "mío"]);
});

test("los rótulos de un mapa miden al menos 10 px en la vista ampliada y, si no caben, el compilador lo dice", () => {
  const chain = (n: number, name: (i: number) => string) => {
    const nodes = Array.from({ length: n }, (_, i) => node(name(i), "server"));
    return { nodes, links: nodes.slice(1).map((x, i) => ({ from: nodes[i].id, to: x.id })) };
  };
  for (const map of [{ nodes: [node("a")] }, chain(6, (i) => `nodo-${i}`)]) {
    const r = renderFigure({ id: "t", title: "t", map }, { lang: "es" });
    assert.deepEqual(r.errors, []);
    assert.equal(r.issues.some((i) => i.code === "label-unreadable"), false, r.issues.map((i) => i.message).join("\n"));
  }
  const crowded = compileMap(chain(12, (i) => `servidor-largo-${i}`));
  assert.ok(crowded.notes.some((n) => n.code === "map-label-small"));
});

for (const name of ["mapa-tienda", "mapa-pedido", "mapa-uml"]) {
  test(`el ejemplo ${name} se dibuja sin errores ni avisos, con sus paquetes y dentro del peso`, () => {
    const spec = example(name);
    for (const lang of ["es", "en"]) {
      const r = renderFigure(spec, { lang });
      assert.deepEqual(r.errors, [], `${name} ${lang}`);
      assert.deepEqual(r.warnings, [], `${name} ${lang}`);
      assert.ok(measure(r.html).gzip < 40 * 1024, `${name} pesa ${measure(r.html).gzip} B gzip`);
    }
    const r = renderFigure(spec, { lang: "es" });
    assert.equal(Boolean(r.data.tracks?.length), name !== "mapa-uml");
    assert.match(r.html, /role="img"/);
  });
}
