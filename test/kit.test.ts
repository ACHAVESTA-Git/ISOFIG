import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expand } from "../src/core/items.ts";
import { renderFigure } from "../src/core/render.ts";
import type { FigureSpec, GroupSpec, Part } from "../src/core/spec.ts";
import { BASE_TOP, bench, catalog, groupsOf, labelPlate, plinth, pool, ruler, screws, type PoolPiece } from "../src/kit/index.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const figure = (parts: Part[], groups?: Record<string, GroupSpec>): FigureSpec => ({ id: "kit", title: "kit", parts, groups });
const html = (parts: Part[], groups?: Record<string, GroupSpec>) => renderFigure(figure(parts, groups), { lang: "es" }).html;

// Lo que las figuras de la academia escribían a mano antes del kit: es la referencia con la que se compara.
const academy = {
  banco: (ancho: number, largo: number): Part[] => [
    { id: "pata", kind: "cylinder", at: [12, 12, 0], r: 5, h: 3, tone: "lo", bevel: 0.6, repeat: { count: 2, step: [ancho - 24, 0, 0] } },
    { id: "pata-fondo", kind: "cylinder", at: [12, largo - 12, 0], r: 5, h: 3, tone: "lo", bevel: 0.6, repeat: { count: 2, step: [ancho - 24, 0, 0] } },
    { id: "base", kind: "box", at: [0, 0, 3], size: [ancho, largo, 8], radius: 7, bevel: 1.4, tone: "lo", shadow: true, mount: ["pata-0", "pata-1", "pata-fondo-0", "pata-fondo-1"] },
    { id: "tornillos-base", kind: "dots", on: "base", points: [[6, 6, 11], [ancho - 6, 6, 11], [6, largo - 6, 11], [ancho - 6, largo - 6, 11]] },
  ],
  zocalo: (ancho: number, largo: number): Part[] => [
    { id: "base", kind: "box", at: [0, 0, 0], size: [ancho, largo, 11], radius: 7, bevel: 1.4, tone: "lo", shadow: true },
    { id: "tornillos-base", kind: "dots", on: "base", points: [[6, 6, 11], [ancho - 6, 6, 11], [6, largo - 6, 11], [ancho - 6, largo - 6, 11]] },
  ],
  peana: (ancho: number, largo: number): Part[] => [
    { id: "peana", kind: "box", at: [6, 6, 0], size: [ancho - 12, largo - 12, 3], radius: 5, bevel: 0.6, tone: "lo" },
    { id: "base", kind: "box", at: [0, 0, 3], size: [ancho, largo, 8], radius: 7, bevel: 1.4, tone: "lo", shadow: true, mount: ["peana"] },
    { id: "tornillos-base", kind: "dots", on: "base", points: [[6, 6, 11], [ancho - 6, 6, 11], [6, largo - 6, 11], [ancho - 6, largo - 6, 11]] },
  ],
  placa: (x: number, y: number): Part[] => [
    { id: "placa", kind: "box", at: [x, y, 11], size: [32, 40, 1.2], radius: 2, bevel: 0.4, tone: "hi" },
    { id: "placa-linea-1", kind: "line", on: "placa", points: [[x + 8, y + 7, 12.2], [x + 8, y + 33, 12.2]] },
    { id: "placa-linea-2", kind: "line", on: "placa", points: [[x + 15, y + 7, 12.2], [x + 15, y + 27, 12.2]] },
    { id: "placa-linea-3", kind: "line", on: "placa", points: [[x + 22, y + 7, 12.2], [x + 22, y + 21, 12.2]] },
    { id: "tornillos-placa", kind: "dots", on: "placa", points: [[x + 3, y + 3, 12.2], [x + 29, y + 3, 12.2], [x + 3, y + 37, 12.2], [x + 29, y + 37, 12.2]] },
  ],
  regla: (x: number, y: number, largo: number): Part[] => [
    { id: "regla", kind: "box", at: [x, y, 11], size: [5, largo, 1], radius: 1, tone: "mid" },
    { id: "marcas-regla", kind: "ticks", on: "regla", from: [x, y + 4, 12], along: [0, 4, 0], count: Math.floor((largo - 8) / 4) + 1, every: 5, toward: [1, 0, 0], size: [2, 4] },
  ],
};

test("bench dibuja lo mismo que el banco de la academia y su tapa queda en BASE_TOP", () => {
  assert.equal(html(bench({ size: [150, 252] })), html(academy.banco(150, 252)));
  assert.equal(html(bench({ size: [96, 134] })), html(academy.banco(96, 134)));
  const top = bench({ size: [100, 100] }).find((p) => p.id === "base");
  assert.ok(top && top.kind === "box" && top.at[2] + top.size[2] === BASE_TOP);
});

test("bench acepta otro retranqueo de patas y de tornillos, y se queda con sus propias patas", () => {
  const parts = bench({ size: [120, 290], legInset: 14, screwInset: 5, radius: 6 });
  const legs = expand(parts).filter((p) => p.kind === "cylinder");
  assert.deepEqual(legs.map((p) => (p.kind === "cylinder" ? p.at : null)), [[14, 14, 0], [106, 14, 0], [14, 276, 0], [106, 276, 0]]);
  const dots = parts.find((p) => p.kind === "dots");
  assert.deepEqual(dots?.kind === "dots" && dots.points[3], [115, 285, 11]);
});

test("plinth maciza y con peana dibujan lo mismo que el zócalo y la peana de la academia", () => {
  assert.equal(html(plinth({ size: [132, 240] })), html(academy.zocalo(132, 240)));
  assert.equal(html(plinth({ size: [160, 240], step: { inset: 6, radius: 5 } })), html(academy.peana(160, 240)));
  const plinto = plinth({ size: [130, 300], step: true }).find((p) => p.id === "base-step");
  assert.ok(plinto && plinto.kind === "box" && plinto.radius === 6 && plinto.at[0] === 5 && plinto.size[0] === 120);
});

test("labelPlate sin opciones es la placa de la academia; con rules reproduce las placas de otro tamaño", () => {
  assert.equal(html([...bench({ size: [150, 252] }), ...labelPlate({ at: [112, 20] })]), html([...academy.banco(150, 252), ...academy.placa(112, 20)]));
  const wide = labelPlate({ at: [10, 40], size: [32, 50], rules: { inset: 8, pitch: 6, margin: 8, taper: 8 } });
  const lines = wide.filter((p) => p.kind === "line").map((p) => (p.kind === "line" ? p.points : []));
  assert.deepEqual(lines, [
    [[18, 48, 12.2], [18, 82, 12.2]],
    [[24, 48, 12.2], [24, 74, 12.2]],
    [[30, 48, 12.2], [30, 66, 12.2]],
  ]);
});

test("labelPlate con texto lo graba centrado, por idioma, y no dibuja líneas salvo que se pidan", () => {
  const parts = labelPlate({ at: [10, 8], text: { es: "COLA", en: "QUEUE" } });
  assert.deepEqual(parts.map((p) => p.id), ["plate", "plate-text", "plate-screws"]);
  const spec = figure([...bench({ size: [120, 120] }), ...parts]);
  const es = renderFigure(spec, { lang: "es" });
  const en = renderFigure(spec, { lang: "en" });
  assert.match(es.html, />COLA<\/text>/);
  assert.match(en.html, />QUEUE<\/text>/);
  assert.deepEqual([es.errors, es.warnings], [[], []]);
  assert.equal(labelPlate({ at: [0, 0], text: "A", lines: 2 }).filter((p) => p.kind === "line").length, 2);
  assert.equal(labelPlate({ at: [0, 0], screws: false }).some((p) => p.kind === "dots"), false);
});

test("labelPlate rechaza líneas que no caben", () => {
  assert.throws(() => labelPlate({ at: [0, 0], size: [12, 40], lines: 3 }), /no caben/);
});

test("ruler dibuja lo mismo que la regla de la academia y admite otro paso, otro ancho y marcas al otro lado", () => {
  assert.equal(html([...bench({ size: [150, 252] }), ...ruler({ at: [118, 70], length: 160 })]), html([...academy.banco(150, 252), ...academy.regla(118, 70, 160)]));
  const hand = [
    { id: "regla", kind: "box", at: [4, 84, 11], size: [6, 132, 1], radius: 1, tone: "mid" },
    { id: "marcas-regla", kind: "ticks", on: "regla", from: [10, 88, 12], along: [0, 4.15, 0], count: 31, every: 5, toward: [-1, 0, 0], size: [2, 4] },
  ] satisfies Part[];
  const kit = ruler({ at: [4, 84], length: 132, width: 6, pitch: 4.15, count: 31, toward: -1 });
  assert.equal(html([...academy.zocalo(130, 300), ...kit]), html([...academy.zocalo(130, 300), ...hand]));
});

test("pool es una sola pieza con repeat: oculta, un grupo por pieza y con el paso entre ellas", () => {
  const parts = pool({ id: "coin", count: 4, step: [0, 0, 3.2], piece: { kind: "cylinder", at: [10, 10, 11], r: 5, h: 3, tone: "lit" } });
  assert.equal(parts.length, 1);
  assert.deepEqual(parts[0], { kind: "cylinder", at: [10, 10, 11], r: 5, h: 3, tone: "lit", id: "coin-{i}", group: "coin-{i}", hidden: true, repeat: { count: 4, step: [0, 0, 3.2] } });
  const flat = expand(parts);
  assert.deepEqual(flat.map((p) => p.id), ["coin-0", "coin-1", "coin-2", "coin-3"]);
  assert.equal(flat[3].kind === "cylinder" && flat[3].at[2], 11 + 3 * 3.2);
  assert.deepEqual(pool({ id: "coin", count: 0, piece: { kind: "box", at: [0, 0, 0], size: [1, 1, 1] } }), []);
  assert.equal("hidden" in pool({ id: "row", count: 2, hidden: false, piece: { kind: "box", at: [0, 0, 0], size: [1, 1, 1] } })[0], false);
});

test("pool con from numera desde ahí y deja las posiciones donde estaban; group junta dos filas en una familia", () => {
  const piece: PoolPiece = { kind: "box", at: [43, 214, 16], size: [16, 11, 10] };
  const low = expand(pool({ id: "row", count: 3, step: [0, -14, 0], piece }));
  const high = pool({ id: "row-high", group: "row", count: 3, from: 3, step: [0, -14, 0], piece: { ...piece, at: [43, 214, 26] } });
  assert.deepEqual(high.map((p) => p.id), ["row-high-3", "row-high-4", "row-high-5"]);
  assert.deepEqual(high.map((p) => ("group" in p ? p.group : "")), ["row-3", "row-4", "row-5"]);
  assert.deepEqual(high.map((p) => (p.kind === "box" ? p.at : null)), [[43, 214, 26], [43, 200, 26], [43, 186, 26]]);
  assert.ok(high.every((p) => "hidden" in p && p.hidden && p.repeat === undefined));
  const all = [...bench({ size: [120, 290] }), ...low, ...high];
  assert.deepEqual(renderFigure(figure(all, groupsOf("row", 6)), { lang: "es" }).errors, []);
});

test("pool rechaza una pieza que ya trae id, group, hidden o repeat", () => {
  assert.throws(() => pool({ id: "x", count: 1, piece: { kind: "box", at: [0, 0, 0], size: [1, 1, 1], group: "g" } as never }), /piece/);
  assert.throws(() => pool({ id: "x", count: 1, piece: { kind: "line" } as never }), /caja, un cilindro o un prisma/);
  assert.throws(() => pool({ id: "x", count: -1, piece: { kind: "box", at: [0, 0, 0], size: [1, 1, 1] } }), /count/);
});

test("groupsOf da los grupos de una familia, de una lista de nombres, desde un número y sin compartir extents", () => {
  assert.deepEqual(Object.keys(groupsOf("packet", 3)), ["packet-0", "packet-1", "packet-2"]);
  assert.deepEqual(Object.keys(groupsOf("row", 2, { from: 14 })), ["row-14", "row-15"]);
  assert.deepEqual(groupsOf(["a", "b"], { extent: [[0, 5, 0]] }), { a: { extent: [[0, 5, 0]] }, b: { extent: [[0, 5, 0]] } });
  assert.deepEqual(groupsOf("x", 2), { "x-0": {}, "x-1": {} });
  const g = groupsOf("x", 2, { extent: [[1, 2, 3]], spin: { center: [0, 0, 0], plane: "xz" } });
  (g["x-0"].extent as number[][])[0][0] = 99;
  assert.equal(g["x-1"].extent?.[0][0], 1);
  assert.deepEqual(Object.keys(groupsOf("none", 0)), []);
});

test("screws pone un tornillo en cada esquina, en el orden de siempre", () => {
  const [dots] = screws({ on: "box", at: [10, 20], size: [30, 40], z: 5 });
  assert.deepEqual(dots, { id: "box-screws", kind: "dots", on: "box", points: [[13, 23, 5], [37, 23, 5], [13, 57, 5], [37, 57, 5]] });
});

test("los ids base evitan choques: dos bancos, dos placas y dos reglas en la misma figura", () => {
  const parts = [
    ...bench({ size: [140, 100], id: "left" }),
    ...bench({ size: [140, 100], id: "right" }),
    ...labelPlate({ at: [10, 10], id: "a" }),
    ...labelPlate({ at: [60, 10], id: "b" }),
    ...ruler({ at: [100, 10], length: 60, id: "r1" }),
    ...ruler({ at: [108, 10], length: 60, id: "r2" }),
  ];
  const ids = expand(parts).map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(renderFigure(figure(parts), { lang: "es" }).errors, []);
});

test("una figura armada con el kit pasa la auditoría sin avisos", () => {
  const parts: Part[] = [
    ...bench({ size: [150, 252] }),
    ...labelPlate({ at: [10, 8], text: { es: "TOKENS", en: "TOKENS" } }),
    ...ruler({ at: [140, 20], length: 220 }),
    ...pool({ id: "coin", count: 5, step: [0, 0, 4], piece: { kind: "cylinder", at: [60, 60, 11], r: 8, h: 3, tone: "lit" } }),
  ];
  const r = renderFigure(figure(parts, groupsOf("coin", 5, { extent: [[0, 0, 20]] })), { lang: "es" });
  assert.deepEqual([r.errors, r.warnings], [[], []]);
});

test("el kit es puro: dos llamadas dan lo mismo y el resultado sobrevive a JSON", () => {
  const call = () => [...bench({ size: [150, 252] }), ...labelPlate({ at: [1, 2], text: "x" }), ...ruler({ at: [3, 4], length: 50 }), ...pool({ id: "p", count: 2, piece: { kind: "box", at: [0, 0, 0], size: [1, 1, 1] } })];
  assert.deepEqual(call(), call());
  assert.deepEqual(JSON.parse(JSON.stringify(call())), call());
});

test("el catálogo trae {parts} por nombre, sin prototipo y rechaza opciones mal escritas", () => {
  assert.deepEqual(Object.keys(catalog).sort(), ["bench", "labelPlate", "plinth", "pool", "ruler", "screws"]);
  assert.equal((catalog as Record<string, unknown>)["constructor"], undefined);
  assert.equal(Object.isFrozen(catalog), true);
  assert.deepEqual(catalog.bench({ size: [150, 252] }), { parts: bench({ size: [150, 252] }) });
  assert.deepEqual(catalog.ruler({ at: [1, 2], length: 40 }).parts, ruler({ at: [1, 2], length: 40 }));
  assert.throws(() => catalog.bench({ size: [150, 252], legInsett: 10 } as never), /opción desconocida «legInsett»/);
  assert.throws(() => catalog.bench({} as never), /«size» debe ser \[ancho, fondo\]/);
  assert.throws(() => catalog.bench(undefined as never), /«with» debe ser un objeto/);
  assert.throws(() => catalog.ruler({ at: [1, 2] } as never), /«length»/);
});

test("pool en el catálogo devuelve también los grupos cuando se le dan extents", () => {
  const piece: PoolPiece = { kind: "box", at: [0, 0, 0], size: [1, 1, 1] };
  assert.equal(catalog.pool({ id: "p", count: 2, piece }).groups, undefined);
  const withGroups = catalog.pool({ id: "p-high", group: "p", count: 2, from: 2, piece, extent: [[0, 9, 0]] });
  assert.deepEqual(withGroups.groups, { "p-2": { extent: [[0, 9, 0]] }, "p-3": { extent: [[0, 9, 0]] } });
});

// Resuelve `use` contra el catálogo como lo hará la spec anidada: lo justo para probar el ejemplo de la documentación.
interface Node {
  id: string;
  parts?: Part[];
  children?: Node[];
  use?: keyof typeof catalog;
  with?: unknown;
}
function flatten(node: Node, into: { parts: Part[]; groups: Record<string, GroupSpec> }) {
  if (node.use) {
    const { parts, groups } = (catalog[node.use] as (options: unknown) => { parts: Part[]; groups?: Record<string, GroupSpec> })(node.with);
    into.parts.push(...parts);
    Object.assign(into.groups, groups);
  }
  into.parts.push(...(node.parts ?? []));
  for (const child of node.children ?? []) flatten(child, into);
}

const blocks = (markdown: string, lang: string) => [...markdown.matchAll(new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "g"))].map((m) => m[1]);

test("el ejemplo en JSON de la documentación pasa por el catálogo y se dibuja sin avisos", () => {
  const [json] = blocks(read("docs/en/kit.md"), "json");
  assert.ok(json, "falta el ejemplo en JSON");
  const spec = JSON.parse(json) as FigureSpec & { root: Node };
  const flat = { parts: [] as Part[], groups: {} as Record<string, GroupSpec> };
  flatten(spec.root, flat);
  const { root: _tree, ...rest } = spec;
  const r = renderFigure({ ...rest, parts: flat.parts, groups: { ...spec.groups, ...flat.groups } }, { lang: "es" });
  assert.deepEqual([r.errors, r.warnings], [[], []]);
  assert.ok(flat.parts.length > 10);
});

test("el ejemplo en TypeScript de la documentación se ejecuta y se dibuja sin avisos", async () => {
  const [ts] = blocks(read("docs/en/kit.md"), "ts");
  assert.ok(ts, "falta el ejemplo en TypeScript");
  const dir = mkdtempSync(join(tmpdir(), "isofig-kit-"));
  try {
    const code = ts
      .replace('from "isofig/kit"', `from ${JSON.stringify(new URL("src/kit/index.ts", root).href)}`)
      .replace('from "isofig"', `from ${JSON.stringify(new URL("src/core/index.ts", root).href)}`);
    const file = join(dir, "example.ts");
    writeFileSync(file, code);
    const spec = (await import(pathToFileURL(file).href)).default as FigureSpec;
    const r = renderFigure(spec, { lang: "es" });
    assert.deepEqual([r.errors, r.warnings], [[], []]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("la documentación en español y en inglés lleva los mismos ejemplos", () => {
  for (const lang of ["ts", "json"]) assert.deepEqual(blocks(read("docs/es/kit.md"), lang), blocks(read("docs/en/kit.md"), lang));
});

test("isofig/kit está en exports", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.deepEqual(pkg.exports["./kit"], { types: "./dist/kit/index.d.ts", default: "./dist/kit/index.js" });
});
