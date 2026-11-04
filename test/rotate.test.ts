import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeCamera, project } from "../src/core/camera.ts";
import { buildItems, endsOf, framedPoints, meshOf, solidBox, type Solid } from "../src/core/items.ts";
import { axisOf } from "../src/core/mesh.ts";
import { renderFigure } from "../src/core/render.ts";
import { apply, compose, rotation } from "../src/core/rotate.ts";
import { drawScene } from "../src/core/scene.ts";
import type { FigureSpec, FlatSpec, Node, Part, Vec3 } from "../src/core/spec.ts";
import { assemble, assembleTree } from "../src/core/tree.ts";
import { validateSpec } from "../src/core/validate.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const box = (id: string, at: Vec3, size: Vec3, extra: Record<string, unknown> = {}) => ({ id, kind: "box", at, size, ...extra }) as Part;
const spec = (node: Node, extra: Partial<FigureSpec> = {}): FigureSpec => ({ id: "r", title: "t", alt: "a", root: node, ...extra });
const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} no es ${b}`);
const nearVec = (a: readonly number[], b: readonly number[], tol = 1e-9) => b.forEach((x, i) => near(a[i], x, tol));
const part = (flat: FlatSpec, id: string) => flat.parts.find((p) => p.id === id) as Part & Record<string, any>;
const solid = (flat: FlatSpec, id: string) => part(flat, id) as unknown as Solid;

test("el orden de los giros es x, luego y y al final z sobre los ejes del padre: R = Rz·Ry·Rx", () => {
  // x lleva z hacia -y; después z lleva -y hacia +x. Al revés (z primero) saldría -y.
  nearVec(apply(rotation([90, 0, 90])!, [0, 0, 1]), [1, 0, 0]);
  // Cada eje solo: z gira x hacia y, y gira z hacia x, x gira y hacia z.
  nearVec(apply(rotation([0, 0, 90])!, [1, 0, 0]), [0, 1, 0]);
  nearVec(apply(rotation([0, 90, 0])!, [0, 0, 1]), [1, 0, 0]);
  nearVec(apply(rotation([90, 0, 0])!, [0, 1, 0]), [0, 0, 1]);
  // Una rotación de 90° deja ceros exactos, no 6e-17.
  assert.equal(JSON.stringify(rotation([0, 0, 90])), "[[0,-1,0],[1,0,0],[0,0,1]]");
  assert.equal(JSON.stringify(rotation([90, 0, 0])), "[[1,0,0],[0,0,-1],[0,1,0]]");
  // Sin giro (o con vueltas enteras) no hay matriz: el camino de siempre, byte a byte.
  assert.equal(rotation(undefined), undefined);
  assert.equal(rotation([0, 0, 0]), undefined);
  assert.equal(rotation([360, -720, 0]), undefined);
  assert.equal(rotation("x"), undefined);
  // Un valor que no es número se toma como 0 (la validación lo dice; el ensamblado no lanza).
  assert.deepEqual(rotation([0, null, 90]), rotation([0, 0, 90]));
});

test("una caja girada 45° en z, vista desde arriba, es un rombo (un cuadrado de punta)", () => {
  const flat = assemble(spec({ id: "m", children: [{ id: "g", rotate: [0, 0, 45], parts: [box("c", [0, 0, 0], [20, 20, 4])] }] }));
  const c = solid(flat, "g.c");
  const cam = makeCamera({ azimuth: 0, elevation: 90 }, 1);
  const mesh = meshOf(c as never, cam);
  const top = mesh.faces.find((f) => f.kind === "top")!;
  const pts = top.idx.map((k) => project(cam, mesh.v[k]));
  assert.equal(pts.length, 4);
  const side = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  near(side, 20, 1e-9);
  // Una diagonal horizontal y la otra vertical, de 20·√2: un cuadrado apoyado en una punta.
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  near(Math.max(...xs) - Math.min(...xs), 20 * Math.SQRT2);
  near(Math.max(...ys) - Math.min(...ys), 20 * Math.SQRT2);
  assert.ok(pts.some((p) => Math.abs(p[0] - (Math.max(...xs) + Math.min(...xs)) / 2) < 1e-9 && Math.abs(p[1] - Math.min(...ys)) < 1e-9), "una punta arriba");
  // Su caja envolvente es la de las 8 esquinas giradas, no la de la caja sin girar.
  const b = solidBox(c);
  nearVec(b.min, [-10 * Math.SQRT2, 0, 0]);
  nearVec(b.max, [10 * Math.SQRT2, 20 * Math.SQRT2, 4]);
  assert.equal(framedPoints(c)!.length, 8);
});

test("un nodo girado arrastra a sus hijos: su at, sus piezas y sus ejes", () => {
  const flat = assemble(spec({
    id: "m",
    children: [{
      id: "brazo", at: [100, 0, 50], rotate: [0, 0, 90],
      parts: [{ id: "eje", kind: "cylinder", at: [10, 0, 0], r: 2, h: 20, axis: "x" } as Part],
      children: [{ id: "mano", at: [30, 0, 0], parts: [{ id: "bola", kind: "sphere", at: [5, 0, 0], r: 3 } as Part] }],
    }],
  }));
  // x local es y del mundo: el at del hijo (30, 0, 0) cae en (0, 30, 0) más el origen del brazo.
  nearVec(part(flat, "brazo.eje").at, [100, 10, 50]);
  nearVec(part(flat, "brazo.eje").axis, [0, 1, 0]);
  nearVec(part(flat, "brazo.mano.bola").at, [100, 35, 50]);
  // El nodo gira alrededor de su propio at, que no se mueve.
  const pivot = assemble(spec({ id: "m", children: [{ id: "p", at: [40, 40, 0], rotate: [0, 0, 77], parts: [{ id: "s", kind: "sphere", at: [0, 0, 0], r: 1 } as Part] }] }));
  nearVec(part(pivot, "p.s").at, [40, 40, 0]);
});

test("dos rotaciones anidadas componen como un solo nodo con los ejes en el orden Rz·Ry·Rx", () => {
  const nested = assemble(spec({
    id: "m",
    children: [{ id: "a", rotate: [0, 0, 90], children: [{ id: "b", rotate: [90, 0, 0], parts: [{ id: "c", kind: "cylinder", at: [0, 0, 0], r: 1, h: 10 } as Part] }] }],
  }));
  const single = assemble(spec({ id: "m", children: [{ id: "a", rotate: [90, 0, 90], parts: [{ id: "c", kind: "cylinder", at: [0, 0, 0], r: 1, h: 10 } as Part] }] }));
  nearVec(part(nested, "a.b.c").axis, [1, 0, 0]);
  nearVec(part(nested, "a.b.c").axis, part(single, "a.c").axis);
  // El nodo de dentro gira primero: con 30° y 20° distintos en cada nivel el resultado es compose(padre, hijo).
  const m = compose(rotation([0, 0, 30]), rotation([20, 0, 0]))!;
  const tilted = assemble(spec({ id: "m", children: [{ id: "a", rotate: [0, 0, 30], children: [{ id: "b", at: [10, 0, 0], rotate: [20, 0, 0], parts: [{ id: "s", kind: "sphere", at: [0, 5, 0], r: 1 } as Part] }] }] }));
  nearVec(part(tilted, "a.b.s").at, apply(rotation([0, 0, 30])!, [10, 0, 0]).map((v, i) => v + apply(m, [0, 5, 0])[i]));
});

test("el explode de un nodo es un desplazamiento en el espacio de su padre: en el mundo gira con él", () => {
  const tree = assembleTree(spec({
    id: "m",
    children: [{
      id: "bloque", rotate: [0, 0, 90], explode: [0, 0, 10], name: "Bloque",
      parts: [box("c", [0, 0, 0], [10, 10, 10])],
      children: [
        { id: "tapa", explode: [30, 0, 0], name: "Tapa", parts: [box("t", [0, 0, 10], [10, 10, 2])] },
        { id: "perilla", at: [2, 2, 12], rotate: [0, 90, 0], explode: [0, 0, 5], name: "Perilla", parts: [box("p", [0, 0, 0], [2, 2, 2])] },
      ],
    }],
  }));
  const moves = new Map(tree.spec.bind!.filter((b) => b.move).map((b) => [`${b.group}`, b.move!]));
  // El bloque está girado 90° pero su explode cuelga de la raíz sin girar: sube en z.
  nearVec(moves.get("bloque")!, [0, 0, 10]);
  // La tapa sale +x de su padre (el bloque girado): en el mundo, +y.
  nearVec(moves.get("bloque.tapa")!, [0, 30, 0]);
  // La perilla sale +z del bloque (que es +z del mundo: gira alrededor de z, no la cambia).
  nearVec(moves.get("bloque.perilla")!, [0, 0, 5]);
  // El encuadre de cada pose usa los desplazamientos del mundo.
  const ext = tree.spec.groups!["bloque.tapa"].extent!;
  assert.ok(ext.some((e) => Math.abs(e[1] - 30) < 1e-9 && Math.abs(e[0]) < 1e-9));
  // La tapa lleva además el de su padre: sube 10 y sale 30 hacia +y.
  assert.ok(ext.some((e) => Math.abs(e[1] - 30) < 1e-9 && Math.abs(e[2] - 10) < 1e-9));
  assert.equal(tree.errors.length, 0);
});

test("el orden automático del despiece mide la salida en el mundo", () => {
  // Dos nodos que salen +x de su padre: uno girado 90° sale hacia +y, el otro hacia +x. Se ordenan por lo lejos que están.
  const tree = assembleTree(spec({
    id: "m",
    children: [
      { id: "g", rotate: [0, 0, 90], children: [{ id: "a", at: [20, 0, 0], explode: [10, 0, 0], parts: [box("p", [0, 0, 0], [4, 4, 4])] }] },
      { id: "b", at: [0, 0, 0], explode: [0, 0, 10], parts: [box("q", [0, 0, 0], [4, 4, 4])] },
    ],
  }));
  assert.equal(tree.stages, 2);
  assert.equal(tree.errors.length, 0);
});

test("un cilindro y un cono dentro de un nodo girado giran su eje; una vector que ya traían se compone", () => {
  const flat = assemble(spec({
    id: "m",
    children: [{
      id: "n", at: [0, 0, 0], rotate: [0, 90, 0],
      parts: [
        { id: "z", kind: "cylinder", at: [0, 0, 0], r: 2, h: 10 } as Part,
        { id: "x", kind: "cylinder", at: [0, 0, 0], r: 2, h: 10, axis: "x" } as Part,
        { id: "v", kind: "cone", at: [0, 0, 0], r: 2, r2: 1, h: 10, axis: [1, 0, 1] } as Part,
      ],
    }],
  }));
  nearVec(part(flat, "n.z").axis, [1, 0, 0]);
  nearVec(part(flat, "n.x").axis, [0, 0, -1]);
  nearVec(part(flat, "n.v").axis, [Math.SQRT1_2, 0, -Math.SQRT1_2]);
  // La caja envolvente del cilindro sale de su eje girado.
  const b = solidBox(solid(flat, "n.z"));
  nearVec(b.min, [0, -2, -2]);
  nearVec(b.max, [10, 2, 2]);
});

test("una cápsula y una esfera en un nodo girado: sus puntas viajan con el giro", () => {
  const flat = assemble(spec({
    id: "m",
    children: [{
      id: "hueso", at: [0, 0, 20], rotate: [0, 90, 0],
      parts: [{ id: "c", kind: "capsule", at: [0, 0, 0], r: 3, h: 40 } as Part, { id: "e", kind: "sphere", at: [0, 0, 40], r: 5 } as Part],
    }],
  }));
  const c = solid(flat, "hueso.c") as Extract<Solid, { kind: "capsule" }>;
  const [a, b] = endsOf(c);
  nearVec(a, [0, 0, 20]);
  nearVec(b, [40, 0, 20]);
  nearVec(axisOf(c.axis), [1, 0, 0]);
  nearVec(part(flat, "hueso.e").at, [40, 0, 20]);
  const bb = solidBox(c);
  nearVec(bb.min, [-3, -3, 17]);
  nearVec(bb.max, [43, 3, 23]);
  // Y se dibuja: el SVG no trae NaN y es el de una cápsula inclinada.
  const svg = renderFigure(spec({ id: "m", children: [{ id: "hueso", at: [0, 0, 20], rotate: [0, 30, 0], parts: [{ id: "c", kind: "capsule", at: [0, 0, 0], r: 3, h: 40 } as Part] }] })).svg;
  assert.ok(svg.includes("<path") && !/NaN|undefined/.test(svg));
});

test("las cajas y los prismas giran con su base: los vértices son los del nodo, girados y movidos", () => {
  const angles: Vec3 = [20, -35, 50];
  const parts: Part[] = [
    box("b", [3, 4, 5], [10, 6, 8], { radius: 2, bevel: 1 }),
    { id: "pz", kind: "prism", plan: [[0, 0], [10, 0], [0, 8]], z: 2, h: 5 } as Part,
    { id: "py", kind: "prism", plan: [[0, 0], [10, 0], [0, 8]], z: 2, h: 5, axis: "y" } as Part,
    { id: "px", kind: "prism", plan: [[0, 0], [10, 0], [0, 8]], z: 2, h: 5, axis: "x" } as Part,
  ];
  const cam = makeCamera();
  const at: Vec3 = [30, -20, 7];
  const m = rotation(angles)!;
  const flat = assemble(spec({ id: "m", children: [{ id: "n", at, rotate: angles, parts }] }));
  const local = assemble(spec({ id: "m", children: [{ id: "n", parts }] }));
  for (const [id, key] of [["b", "n.b"], ["pz", "n.pz"], ["py", "n.py"], ["px", "n.px"]]) {
    const want = meshOf(solid(local, key) as never, cam).v.map((v) => apply(m, v).map((x, i) => x + at[i]));
    const got = meshOf(solid(flat, key) as never, cam).v;
    assert.equal(got.length, want.length, id);
    got.forEach((v, i) => nearVec(v, want[i], 1e-9));
  }
  // Las normales de las caras también giran, y los ocho vértices son su caja envolvente.
  const rotated = solid(flat, "n.b");
  const bb = solidBox(rotated);
  const pts = framedPoints(rotated)!;
  for (let i = 0; i < 3; i++) {
    near(bb.min[i], Math.min(...pts.map((p) => p[i])));
    near(bb.max[i], Math.max(...pts.map((p) => p[i])));
  }
});

test("los detalles de una pieza girada giran con ella: puntos, líneas y marcas", () => {
  const flat = assemble(spec({
    id: "m",
    children: [{
      id: "n", at: [10, 0, 0], rotate: [0, 0, 90],
      parts: [
        box("b", [0, 0, 0], [10, 4, 4]),
        { id: "d", kind: "dots", on: "b", points: [[2, 0, 4], [8, 0, 4]] } as Part,
        { id: "l", kind: "line", on: "b", points: [[0, 0, 4], [10, 0, 4]], bold: true } as Part,
        { id: "t", kind: "ticks", on: "b", from: [0, 0, 4], along: [2, 0, 0], count: 3, toward: [0, 0, 2] } as Part,
      ],
    }],
  }));
  assert.deepEqual((part(flat, "n.d").points as number[][]).map((p) => p.map((v) => Math.round(v * 1e6) / 1e6 + 0)), [[10, 2, 4], [10, 8, 4]]);
  nearVec(part(flat, "n.l").points[1], [10, 10, 4]);
  nearVec(part(flat, "n.t").from, [10, 0, 4]);
  nearVec(part(flat, "n.t").along, [0, 2, 0]);
  nearVec(part(flat, "n.t").toward, [0, 0, 2]);
});

test("un rótulo en una cara girada sigue pegado a ella; en una cara de espaldas a la cámara, avisa", () => {
  const label = (face: "top" | "x" | "y") => ({ id: "r", kind: "label", on: "b", at: [5, 5, 4], face, text: "HOLA", size: 5 }) as Part;
  const make = (rotate: Vec3, face: "top" | "x" | "y" = "top") =>
    spec({ id: "m", children: [{ id: "n", rotate, parts: [box("b", [0, 0, 0], [10, 10, 4]), label(face)] }] });
  // En la tapa girada 90° en z, el texto se lee a lo largo de -x (era +y) y su «abajo» es +y (era +x).
  const flat = assemble(make([0, 0, 90]));
  assert.deepEqual(part(flat, "n.r").axes.map((v: number[]) => v.map((x) => x + 0)), [[-1, 0, 0], [0, 1, 0]]);
  // La matriz del texto lleva esos mismos vectores a la pantalla.
  const cam = drawScene(flat, "en").cam;
  const text = /<text[^>]*transform="matrix\(([^)]+)\)"/.exec(drawScene(flat, "en").markup)![1].split(" ").map(Number);
  near(text[0], cam.scale * -cam.right[0], 1e-3);
  near(text[1], cam.scale * -cam.down[0], 1e-3);
  near(text[2], cam.scale * cam.right[1], 1e-3);
  near(text[3], cam.scale * cam.down[1], 1e-3);
  // Un rótulo sobre la cara x de un nodo girado 20° se mide con su cara: se lee de lado, no como en el piso.
  const side = renderFigure(make([0, 0, 20], "x"), { lang: "en" });
  assert.deepEqual(side.issues.filter((i) => i.code === "label-faces-away"), []);
  // Sin girar (o girado a una cara que mira al lector) no hay aviso; en la cara de abajo, sí, y con el camino del JSON.
  assert.deepEqual(renderFigure(make([0, 0, 0]), { lang: "en" }).issues.filter((i) => i.code === "label-faces-away"), []);
  assert.deepEqual(renderFigure(make([0, 0, 90]), { lang: "en" }).issues.filter((i) => i.code === "label-faces-away"), []);
  const away = renderFigure(make([180, 0, 0]), { lang: "es" }).issues.filter((i) => i.code === "label-faces-away");
  assert.equal(away.length, 1);
  assert.equal(away[0].severity, "warning");
  assert.equal(away[0].path, "root.children[0].parts[1]");
  assert.match(away[0].message, /da la espalda a la cámara/);
  // Una cara que mira al lector pero se gira hacia el otro lado se mide con la matriz girada, sin dividir por cero.
  assert.ok(renderFigure(make([0, 0, 180], "y"), { lang: "en" }).errors.length === 0);
});

test("validación: rotate es un vector de tres números finitos y la clave se acepta", () => {
  const issues = (rotate: unknown, lang = "en") => validateSpec(spec({ id: "m", children: [{ id: "n", rotate, parts: [box("b", [0, 0, 0], [4, 4, 4])] } as never] }), { lang }).map((i) => `${i.code} ${i.path}`);
  assert.deepEqual(issues([0, 90, 0]), []);
  assert.deepEqual(issues([0, 0, 0]), []);
  assert.deepEqual(issues([0, 2.5, 0]), [], "una inclinación de grados con decimales no es un aviso");
  assert.deepEqual(issues([10, -35, 720]), []);
  assert.deepEqual(issues([0, 90]), ["vector-length-invalid root.children[0].rotate"]);
  assert.deepEqual(issues("90"), ["type-invalid root.children[0].rotate"]);
  assert.deepEqual(issues([0, "a", 0]), ["number-invalid root.children[0].rotate[1]"]);
  assert.deepEqual(issues([0, null, 0]), ["number-invalid root.children[0].rotate[1]"]);
  assert.deepEqual(issues([0, Infinity, 0]), ["number-invalid root.children[0].rotate[1]"]);
  // Los radianes se reconocen por sus decimales: pocos números pequeños y largos.
  assert.deepEqual(issues([0, 1.5708, 0]), ["rotate-radians root.children[0].rotate"]);
  assert.deepEqual(issues([0.7854, 0, 3.14159]), ["rotate-radians root.children[0].rotate"]);
  assert.match(validateSpec(spec({ id: "m", children: [{ id: "n", rotate: [0, 1.5708, 0], parts: [] }] }), { lang: "es" })[0].message, /rotate va en grados/);
  // La raíz se puede girar entera; con explode sigue sin tener de qué separarse.
  const rootIssues = (node: Node) => validateSpec(spec(node), { lang: "en" }).map((i) => `${i.code} ${i.path}`);
  assert.deepEqual(rootIssues({ id: "m", rotate: [0, 0, 45], parts: [box("b", [0, 0, 0], [4, 4, 4])] }), []);
  assert.deepEqual(rootIssues({ id: "m", rotate: [0, 0, 45], explode: [0, 0, 5], parts: [box("b", [0, 0, 0], [4, 4, 4])] }), ["explode-on-root root.explode"]);
  // Dentro de defs también se valida, y un use lo trae al árbol.
  const def = validateSpec(spec({ id: "m", children: [{ id: "p", use: "pata" }] }, { defs: { pata: { rotate: [0, 90] as never, parts: [box("b", [0, 0, 0], [4, 4, 4])] } } }), { lang: "en" });
  assert.deepEqual(def.map((i) => `${i.code} ${i.path}`), ["vector-length-invalid defs.pata.rotate"]);
  // El ensamblado no lanza con un rotate roto: lo toma como 0.
  assert.doesNotThrow(() => assemble(spec({ id: "m", children: [{ id: "n", rotate: [0, "x", 0] as never, parts: [box("b", [0, 0, 0], [4, 4, 4])] }] })));
});

test("el auditor no avisa de choques ni de piezas flotando en una mesa girada con patas, ni en una caja girada contra otra", () => {
  const table = spec({
    id: "m",
    parts: [box("piso", [0, 0, -2], [200, 200, 2], { ground: true })],
    children: [
      {
        id: "mesa", at: [100, 100, 0], rotate: [0, 0, 30],
        parts: [
          box("tapa", [0, 0, 40], [80, 50, 4], { mount: ["pata-1", "pata-2", "pata-3", "pata-4"] }),
          box("pata-1", [2, 2, 0], [6, 6, 40]), box("pata-2", [72, 2, 0], [6, 6, 40]),
          box("pata-3", [2, 42, 0], [6, 6, 40]), box("pata-4", [72, 42, 0], [6, 6, 40]),
          box("taza", [20, 20, 44], [10, 10, 12]),
        ],
      },
      { id: "caja", at: [20, 20, 0], rotate: [0, 0, 45], parts: [box("a", [0, 0, 0], [20, 20, 10]), box("b", [20, 0, 0], [20, 20, 10])] },
    ],
  });
  const r = renderFigure(table, { lang: "en" });
  assert.deepEqual(r.issues.filter((i) => i.severity !== "info").map((i) => `${i.code} ${i.path}`), []);
  // Y un choque de verdad entre dos piezas giradas sí se dice.
  const hit = renderFigure(spec({ id: "m", children: [{ id: "n", rotate: [0, 0, 45], parts: [box("a", [0, 0, 0], [20, 20, 10]), box("b", [10, 10, 0], [20, 20, 10])] }] }), { lang: "en" });
  assert.deepEqual(hit.issues.filter((i) => i.code === "parts-overlap").length, 1);
});

test("el SVG con rotate es determinista", () => {
  const s = spec({
    id: "m",
    children: [{ id: "n", at: [10, 5, 0], rotate: [10, 20, 30], parts: [box("b", [0, 0, 0], [20, 10, 6], { radius: 2, shadow: true }), { id: "c", kind: "capsule", at: [0, 0, 6], r: 2, h: 10 } as Part] }],
  });
  const a = renderFigure(s, { lang: "es" });
  assert.equal(renderFigure(s, { lang: "es" }).html, a.html);
  assert.equal(renderFigure(JSON.parse(JSON.stringify(s)), { lang: "es" }).html, a.html);
});

test("drawScene dibuja lo girado desde cualquier cámara, incluso con la spec ya aplanada y pasada por JSON", () => {
  const door = spec({
    id: "m",
    parts: [box("piso", [0, 0, 0], [120, 120, 2], { ground: true }), box("jamba", [10, 10, 2], [6, 8, 70])],
    children: [
      { id: "puerta", at: [16, 12, 2], rotate: [0, 0, 35], mount: ["jamba"], parts: [box("hoja", [0, 0, 0], [60, 4, 66]), { id: "n", kind: "label", on: "hoja", at: [50, 4, 50], face: "y", text: "P", size: 6 } as Part] },
      { id: "mesa", at: [70, 70, 2], rotate: [0, 0, 30], parts: [box("tapa", [0, 0, 20], [30, 20, 3]), box("pata", [2, 2, 0], [4, 4, 20]), box("pata2", [24, 14, 0], [4, 4, 20])] },
    ],
  });
  const flat = assemble(door);
  const wire = JSON.parse(JSON.stringify(flat)) as FlatSpec;
  for (const azimuth of [20, 200]) {
    const scene = drawScene(flat, "en", { azimuth });
    assert.ok(!/NaN|undefined/.test(scene.markup), `az ${azimuth}`);
    assert.equal(drawScene(wire, "en", { azimuth }).markup, scene.markup, "la spec que viaja como JSON dibuja lo mismo");
    // La cámara no cambia la pieza: sus esquinas giradas son las mismas, y la proyección sigue a la cámara.
    const items = buildItems(flat.parts).items;
    const hoja = items.find((i) => i.id === "puerta.hoja")!;
    nearVec(hoja.box.min, solidBox(solid(flat, "puerta.hoja")).min);
    const cam = scene.cam;
    const [p0, p1] = [project(cam, [0, 0, 0]), project(cam, [1, 0, 0])];
    assert.ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0);
  }
  assert.notEqual(drawScene(flat, "en", { azimuth: 20 }).markup, drawScene(flat, "en", { azimuth: 200 }).markup);
});

test("el orden de pintado sigue a la cámara con piezas giradas: delante tapa, detrás queda tapado, desde 20° y desde 200°", () => {
  // Dos bloques en fila a lo largo del x del nodo, que está girado 30° en z: el de x más alto está más cerca desde +x.
  const s = spec({
    id: "m",
    children: [{ id: "n", rotate: [0, 0, 30], parts: [box("lejos", [0, 0, 0], [10, 10, 10], { group: "lejos" }), box("cerca", [30, 0, 0], [10, 10, 10], { group: "cerca" })] }],
  });
  const order = (azimuth: number) => [...drawScene(assemble(s), "en", { azimuth }).markup.matchAll(/data-g="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order(20), ["lejos", "cerca"]);
  assert.deepEqual(order(200), ["cerca", "lejos"]);
  // Con la mesa: la tapa se pinta después de las patas desde cualquier lado (se ve desde arriba).
  const mesa = spec({
    id: "m",
    children: [{ id: "n", at: [50, 50, 0], rotate: [0, 0, 30], parts: [box("tapa", [0, 0, 20], [40, 30, 3], { group: "tapa" }), box("p1", [2, 2, 0], [4, 4, 20], { group: "p1" }), box("p2", [34, 24, 0], [4, 4, 20], { group: "p2" })] }],
  });
  for (const az of [20, 45, 135, 200, 225]) {
    const o = [...drawScene(assemble(mesa), "en", { azimuth: az }).markup.matchAll(/data-g="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(o[o.length - 1], "tapa", `az ${az}: ${o.join()}`);
  }
});

test("el despiece mueve los nodos girados hacia donde dice el mundo, en cada pose", () => {
  const s = spec({
    id: "m",
    children: [{
      id: "tren", at: [20, 20, 0], rotate: [0, 0, 90],
      parts: [box("bloque", [0, 0, 0], [30, 10, 10])],
      children: [{ id: "tapa", name: "Tapa", at: [0, 0, 10], explode: [30, 0, 0], parts: [box("losa", [0, 0, 0], [30, 10, 3])] }],
    }],
  });
  const flat = assemble(s);
  const tapa = flat.bind!.find((b) => b.group === "tren.tapa" && b.param === "explode")!;
  nearVec(tapa.move!, [0, 30, 0]);
  // En la última pose, la pieza cae desplazada en el mundo: la caja del orden de pintado va con ella.
  const render = renderFigure(s, { lang: "en", values: { explode: 1 } });
  assert.deepEqual(render.errors, []);
  assert.ok(render.data.reorder, "hay orden por pose");
  const scene = drawScene(flat, "en", { azimuth: 200 });
  assert.ok(scene.reorder && !/NaN/.test(scene.markup));
  // `extent` lleva el desplazamiento del mundo y la figura entera cabe en el marco al desarmar.
  nearVec(flat.groups!["tren.tapa"].extent![0], [0, 30, 0]);
});

test("el SVG es idéntico, byte a byte, con rotate: [0, 0, 0] o con vueltas enteras en cada nodo de los ejemplos", () => {
  const addRotate = (node: any, turn: number[]): void => {
    if (!node || typeof node !== "object") return;
    node.rotate = turn;
    for (const c of node.children ?? []) addRotate(c, turn);
  };
  let checked = 0;
  for (const name of ["motor-v8", "motor-cohete", "sistema-oseo", "muscle-car"]) {
    const file = join(root, "examples", name, "spec.json");
    if (!existsSync(file)) continue;
    const base = JSON.parse(readFileSync(file, "utf8")) as FigureSpec;
    // Un ejemplo que ya gira nodos a propósito (el esqueleto) no se puede comparar con «todo en cero».
    if (JSON.stringify(base).includes('"rotate"')) continue;
    const want = renderFigure(base, { lang: "en" }).svg;
    for (const turn of [[0, 0, 0], [360, 0, -360]]) {
      const copy = structuredClone(base) as any;
      addRotate(copy.root, turn);
      for (const d of Object.values(copy.defs ?? {})) addRotate(d, turn);
      assert.equal(renderFigure(copy, { lang: "en" }).svg, want, `${name} con rotate ${turn}`);
    }
    checked++;
  }
  assert.ok(checked >= 2, "se probaron los ejemplos del despiece");
});

test("la sombra y el encuadre usan la huella de una caja girada, no su caja envolvente", () => {
  const s = (rotate: Vec3) => spec({ id: "m", children: [{ id: "n", at: [0, 0, 0], rotate, parts: [box("c", [0, 0, 0], [60, 10, 10], { shadow: true })] }] });
  const turned = drawScene(assemble(s([0, 0, 30])), "en");
  const flatShadow = /<path class="h" d="([^"]+)"/.exec(turned.markup)![1];
  // Un contorno de varias esquinas redondeadas (la envolvente de círculos), no un rectángulo de cuatro.
  const numbers = (d: string) => d.match(/-?\d+\.?\d*/g)!.length;
  assert.ok(numbers(flatShadow) > 20, flatShadow);
  const straight = /<path class="h" d="([^"]+)"/.exec(drawScene(assemble(s([0, 0, 0])), "en").markup)![1];
  assert.equal(numbers(straight), 8, "un rectángulo: un punto y tres tramos");
  // La cámara cierra sobre las esquinas reales: más escala que con la caja envolvente de la misma pieza.
  const wide = assemble(s([0, 0, 30]));
  const aabb = { ...wide, parts: wide.parts.map((p) => ({ ...p, frame: undefined, at: [0, 0, 0], size: [solidBox(p as never).max[0] - solidBox(p as never).min[0], solidBox(p as never).max[1] - solidBox(p as never).min[1], 10] })) } as FlatSpec;
  assert.ok(drawScene(wide, "en").cam.scale >= drawScene(aabb, "en").cam.scale - 1e-9);
});
