import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assemble, assembleTree, usesCatalog } from "../src/core/tree.ts";
import { renderFigure } from "../src/core/render.ts";
import { movesBetween } from "../src/core/scene.ts";
import { validateSpec } from "../src/core/validate.ts";
import { solidBox, meshOf } from "../src/core/items.ts";
import { makeCamera } from "../src/core/camera.ts";
import type { FigureSpec, Node, Part } from "../src/core/spec.ts";
import { catalog as kit } from "../src/kit/index.ts";

const box = (id: string, at: [number, number, number], size: [number, number, number] = [10, 10, 10], extra: Partial<Part> = {}): Part =>
  ({ id, kind: "box", at, size, ...extra }) as Part;

const spec = (root: Node, extra: Partial<FigureSpec> = {}): FigureSpec => ({ id: "t", title: { es: "Caja", en: "Box" }, root, ...extra });
const byId = (parts: Part[], id: string) => parts.find((p) => p.id === id) as Part & { at: number[]; group?: string; outer?: string; mount?: string[]; on?: string };

test("el árbol se aplana: coordenadas locales al at de cada nodo, ids con la ruta y herencia de tone y paint", () => {
  const flat = assemble(spec({
    id: "m",
    at: [100, 0, 0],
    paint: "steel",
    parts: [box("base", [0, 0, 0])],
    children: [{ id: "tapa", at: [0, 0, 10], tone: "hi", parts: [box("losa", [1, 2, 3], [4, 4, 4], { paint: "brass" })], children: [{ id: "perilla", at: [2, 2, 4], parts: [box("p", [0, 0, 0], [1, 1, 1])] }] }],
  }));
  assert.deepEqual(flat.parts.map((p) => p.id), ["base", "tapa.losa", "tapa.perilla.p"]);
  assert.deepEqual(byId(flat.parts, "tapa.losa").at, [101, 2, 13]);
  assert.deepEqual(byId(flat.parts, "tapa.perilla.p").at, [102, 2, 14]);
  assert.equal(byId(flat.parts, "tapa.perilla.p").tone, "hi");
  assert.equal(byId(flat.parts, "tapa.perilla.p").paint, "steel");
  assert.equal(byId(flat.parts, "tapa.losa").paint, "brass");
  // Sin explode no hay despiece: ni controles, ni grupos, ni enlaces.
  assert.equal(flat.params, undefined);
  assert.equal(flat.bind, undefined);
  assert.equal(byId(flat.parts, "base").group, undefined);
});

test("repeat copia el subárbol entero y {i} vale en ids y textos del nodo que se repite", () => {
  const flat = assemble(spec({
    id: "m",
    children: [{
      id: "cil-{i}",
      name: "Cilindro {i}",
      repeat: { count: 3, step: [20, 0, 0], from: 1 },
      parts: [box("piston", [0, 0, 0]), { id: "marca", kind: "dots", on: "piston", points: [[5, 5, 10]] } as Part],
      children: [{ id: "biela", parts: [box("cana", [0, 0, -10], [2, 2, 10], { mount: ["piston"] })] }],
    }],
  }));
  const ids = flat.parts.map((p) => p.id);
  assert.deepEqual(ids.filter((id) => id.endsWith(".piston")), ["cil-1.piston", "cil-2.piston", "cil-3.piston"]);
  assert.deepEqual(byId(flat.parts, "cil-3.piston").at, [40, 0, 0]);
  assert.deepEqual(byId(flat.parts, "cil-2.biela.cana").at, [20, 0, -10]);
  // Cada copia resuelve sus referencias en su propio subárbol.
  assert.equal(byId(flat.parts, "cil-2.marca").on, "cil-2.piston");
  assert.deepEqual(byId(flat.parts, "cil-2.biela.cana").mount, ["cil-2.piston"]);
});

test("las referencias se buscan en el propio nodo, luego hacia arriba; una ruta con puntos alcanza a otra rama", () => {
  const flat = assemble(spec({
    id: "m",
    parts: [box("base", [0, 0, 0])],
    children: [
      { id: "a", parts: [box("base", [0, 0, 10]), box("x", [0, 0, 20], [1, 1, 1], { mount: ["base"] })] },
      { id: "b", parts: [box("y", [0, 0, 30], [1, 1, 1], { mount: ["base", "a.x", "nada"] })] },
    ],
  }, { parts: [box("suelo", [0, 0, -1], [10, 10, 1])] }));
  assert.deepEqual(byId(flat.parts, "a.x").mount, ["a.base"]);
  assert.deepEqual(byId(flat.parts, "b.y").mount, ["base", "a.x", "nada"]);
});

test("use toma de defs (con plantillas de with) y si no está, del catálogo (renderFigure y el CLI ponen el de isofig/kit)", () => {
  const tree = assembleTree(spec({
    id: "m",
    children: [
      { id: "pata-{i}", use: "pata", with: { alto: 6, tono: "lo" }, repeat: { count: 2, step: [40, 0, 0] } },
      { id: "banco", use: "bench", with: { size: [60, 40] } },
      { id: "propia", use: "chapa" },
    ],
  }, { defs: { pata: { name: "Pata", parts: [{ id: "c", kind: "cylinder", at: [0, 0, 0], r: 4, h: "{alto}" as unknown as number, tone: "{tono}" as never }] } } }), {
    catalog: kit,
  });
  const pata = byId(tree.spec.parts, "pata-1.c") as unknown as { h: number; tone: string; at: number[] };
  assert.equal(pata.h, 6);
  assert.equal(pata.tone, "lo");
  assert.deepEqual(pata.at, [40, 0, 0]);
  assert.ok(tree.spec.parts.some((p) => p.id.startsWith("banco.")), "el banco del kit se armó");
  assert.deepEqual(tree.errors.map((e) => [e.code, e.path]), [["use-unknown", "root.children[2].use"]]);
  assert.throws(() => assemble(spec({ id: "m", children: [{ id: "x", use: "nada" }] })), /use-unknown/);
  // Desde JSON, sin configurar nada: renderFigure arma el banco con el kit.
  const r = renderFigure(spec({ id: "m", children: [{ id: "banco", use: "bench", with: { size: [60, 40] } }] }));
  assert.deepEqual(r.errors, []);
  assert.match(r.svg, /<path/);

  const own = assembleTree(spec({ id: "m", children: [{ id: "x", use: "dado", with: { lado: 3 } }] }), {
    catalog: { dado: (o: { lado: number }) => ({ parts: [box("d", [0, 0, 0], [o.lado, o.lado, o.lado], { group: "dado" })], groups: { dado: { extent: [[0, 0, 9]] } } }) },
  });
  assert.equal(own.errors.length, 0);
  assert.deepEqual(own.spec.groups?.["dado"], { extent: [[0, 0, 9]] });
});

test("usesCatalog dice si el árbol necesita un catálogo para dibujarse fuera de Node", () => {
  assert.equal(usesCatalog(spec({ id: "m", children: [{ id: "a", use: "pata" }] }, { defs: { pata: { parts: [] } } })), false);
  assert.equal(usesCatalog(spec({ id: "m", children: [{ id: "a", children: [{ id: "b", use: "bench" }] }] })), true);
});

test("un use que se llama a sí mismo se detiene y lo dice", () => {
  const tree = assembleTree(spec({ id: "m", children: [{ id: "x", use: "a" }] }, { defs: { a: { use: "b" }, b: { use: "a" } } }));
  assert.equal(tree.errors[0].code, "use-cycle");
});

const lid = (): Node => ({
  id: "caja",
  parts: [box("base", [0, 0, 0], [60, 60, 20])],
  children: [{
    id: "tapa", name: { es: "Tapa", en: "Lid" }, note: { es: "cierra la caja", en: "closes the box" }, at: [0, 0, 20], explode: [0, 0, 30],
    parts: [box("losa", [0, 0, 0], [60, 60, 6])],
    children: [{ id: "perilla", name: { es: "Perilla", en: "Knob" }, at: [30, 30, 6], explode: [0, 0, 20], parts: [box("p", [-5, -5, 0], [10, 10, 8])] }],
  }],
});

test("despiece automático: de fuera hacia dentro, un hijo antes que su padre y cada etapa en su ventana", () => {
  const flat = assemble(spec(lid()));
  const explode = flat.params!.find((p) => p.id === "explode")!;
  assert.equal(explode.max, 2);
  assert.deepEqual((explode.texts as Record<string, string>[]).map((t) => t["es"]), ["Armado", "Paso 1 de 2: perilla", "Paso 2 de 2: tapa"]);
  const knob = flat.bind!.filter((b) => b.group === "tapa.perilla" && b.param === "explode");
  // La perilla se mueve con la tapa (etapa 2) y por su cuenta (etapa 1): los enlaces se suman.
  assert.deepEqual(knob.map((b) => [b.move, b.win]), [[[0, 0, 30], [1, 2]], [[0, 0, 20], [0, 1]]]);
  assert.deepEqual(flat.groups?.["tapa.perilla"]?.extent, [[0, 0, 20], [0, 0, 50]]);
  assert.deepEqual(flat.reorder, { param: "explode", at: [1, 2] });
  // Elegir la tapa no enciende la perilla: sale aparte, así que es otra pieza.
  const keep = Object.fromEntries(flat.bind!.filter((b) => b.keep).map((b) => [b.group, b.keep]));
  assert.deepEqual(keep, { caja: [], tapa: [1], "tapa.perilla": [2] });
});

test("con stage, el orden es el del autor y los nodos sin stage heredan el de su ancestro", () => {
  const root = lid();
  root.children![0].stage = 1;
  root.children![0].children![0].stage = 2;
  const flat = assemble(spec(root));
  const texts = flat.params!.find((p) => p.id === "explode")!.texts as Record<string, string>[];
  assert.deepEqual(texts.map((t) => t["en"]), ["Assembled", "Step 1 of 2: lid", "Step 2 of 2: knob"]);
});

test("la lista de piezas: nombres repetidos son una sola entrada y cada grupo sabe con qué elección queda a la vista", () => {
  const flat = assemble(spec({
    id: "m",
    children: [
      { id: "izq", name: "Culata", explode: [-10, 0, 10], parts: [box("c", [-20, 0, 0])] },
      { id: "der", name: "Culata", explode: [10, 0, 10], parts: [box("c", [20, 0, 0])] },
      { id: "bloque", name: "Bloque", note: "lo fijo", parts: [box("b", [0, 0, 0])] },
    ],
  }));
  const pick = flat.params!.find((p) => p.id === "pick")!;
  assert.deepEqual(pick.options, [{ en: "All", es: "Todo" }, "Culata", "Bloque"]);
  assert.deepEqual(pick.texts, ["{explode}", { en: "Culata", es: "Culata" }, { en: "Bloque · lo fijo", es: "Bloque · lo fijo" }]);
  const keep = Object.fromEntries(flat.bind!.filter((b) => b.keep).map((b) => [b.group, b.keep]));
  assert.deepEqual(keep, { izq: [1], der: [1], bloque: [2] });
  // Las dos culatas salen a la vez: una sola etapa.
  assert.equal(flat.params!.find((p) => p.id === "explode")!.max, 1);
});

test("una pieza que ya anima un modelo conserva su grupo y el despiece la lleva desde fuera", () => {
  const flat = assemble(spec({ id: "m", children: [{ id: "eje", explode: [0, 0, 10], parts: [box("rueda", [0, 0, 0], [4, 4, 4], { group: "giro" })] }] }));
  const rueda = byId(flat.parts, "eje.rueda");
  assert.equal(rueda.group, "giro");
  assert.equal(rueda.outer, "eje");
  const r = renderFigure(flat);
  assert.match(r.svg, /<g data-g="eje"><g class="mid" data-g="giro">/);
});

test("movesBetween lleva el orden en reposo al de la pose moviendo solo lo necesario", () => {
  const from = [4, 0, 3, 1, 2];
  const to = [0, 1, 4, 2, 3];
  const moves = movesBetween(from, to);
  const dom = [...from];
  for (let i = 0; i < moves.length; i += 2) {
    const el = from[moves[i]];
    dom.splice(dom.indexOf(el), 1);
    const before = moves[i + 1] < 0 ? dom.length : dom.indexOf(from[moves[i + 1]]);
    dom.splice(before, 0, el);
  }
  assert.deepEqual(dom, to);
  assert.ok(moves.length / 2 <= 2, `movió ${moves.length / 2}`);
  assert.deepEqual(movesBetween(from, from), []);
});

const example = (name: string): FigureSpec => JSON.parse(readFileSync(new URL(`../examples/${name}/spec.json`, import.meta.url), "utf8"));

test("los dos motores se arman sin errores ni avisos, entran en el presupuesto y salen iguales dos veces", () => {
  for (const name of ["motor-v8", "motor-cohete"]) {
    const a = renderFigure(example(name), { lang: "es" });
    assert.deepEqual(a.errors, [], name);
    assert.deepEqual(a.warnings, [], name);
    assert.ok(a.bytes < 140 * 1024, `${name}: ${a.bytes} bytes`);
    assert.equal(renderFigure(example(name), { lang: "es" }).html, a.html, `${name} no es determinista`);
    assert.ok(a.data.reorder && a.data.reorder.poses.length === 7, `${name}: orden por pose`);
    assert.match(a.html, /data-param="explode"/);
    assert.match(a.html, /name="[^"]+-pick"/);
  }
});

test("el V8 tiene ocho pistones hechos con repeat y su despiece enseña el montaje por pasos", () => {
  const flat = assemble(example("motor-v8"));
  const crowns = flat.parts.filter((p) => p.id.endsWith(".corona"));
  assert.equal(crowns.length, 8);
  const texts = flat.params!.find((p) => p.id === "explode")!.texts as Record<string, string>[];
  assert.equal(texts[5]["es"], "Paso 5 de 7: culatas fuera");
});

test("el validador revisa el árbol con rutas del JSON", () => {
  const issues = validateSpec(spec({
    id: "m",
    children: [
      { id: "a", stage: "x" as never, explode: [0, 0] as never, parts: [box("p", [0, 0, 0]), { id: "d", kind: "dots", on: "nada", points: [[0, 0, 0]] } as Part] },
      { id: "a", parts: [box("q", [0, 0, 0], [1, 1, 1], { mount: ["fantasma"] })] },
      { id: "b", use: "benh" },
    ],
  }), { lang: "es" });
  const found = issues.map((i) => `${i.code} ${i.path}`);
  assert.ok(found.includes("stage-invalid root.children[0].stage"), found.join("\n"));
  assert.ok(found.includes("vector-length-invalid root.children[0].explode"), found.join("\n"));
  assert.ok(found.includes("node-id-duplicate root.children[1].id"), found.join("\n"));
  assert.ok(found.includes("use-unknown root.children[2].use"), found.join("\n"));
  assert.ok(found.includes("on-unknown root.children[0].parts[1].on"), found.join("\n"));
  assert.ok(found.includes("mount-unknown root.children[1].parts[0].mount[0]"), found.join("\n"));
  assert.match(issues.find((i) => i.code === "use-unknown")!.message, /bench/);
});

test("cono, prisma de lado y cilindro inclinado: cajas y mallas", () => {
  const c = makeCamera({}, 4);
  const cone = { id: "k", kind: "cone", at: [0, 0, 0], r: 10, r2: 0, h: 20 } as const;
  assert.deepEqual(solidBox(cone as never), { min: [-10, -10, 0], max: [10, 10, 20] });
  const mesh = meshOf(cone as never, c);
  assert.ok(!mesh.faces.some((f) => f.kind === "top"), "un cono con punta no tiene tapa");
  const side = { id: "v", kind: "prism", axis: "y", plan: [[0, 0], [10, 0], [5, 8]], z: 2, h: 30 } as const;
  assert.deepEqual(solidBox(side as never), { min: [0, 2, 0], max: [10, 32, 8] });
  // Horaria o antihoraria, las caras miran hacia fuera.
  const flipped = meshOf({ ...side, plan: [[5, 8], [10, 0], [0, 0]] } as never, c);
  assert.deepEqual(flipped.faces.map((f) => f.n.map((v) => Math.round(v * 100) / 100)), meshOf(side as never, c).faces.map((f) => f.n.map((v) => Math.round(v * 100) / 100)));
  const rod = { id: "r", kind: "cylinder", at: [0, 0, 0], r: 2, h: 10, axis: [1, 0, 1] } as const;
  const b = solidBox(rod as never);
  assert.ok(Math.abs(b.max[0] - (10 * Math.SQRT1_2 + 2 * Math.SQRT1_2)) < 1e-9);
  assert.ok(Math.abs(b.max[1] - 2) < 1e-9);
});
