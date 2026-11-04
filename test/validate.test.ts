import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { auditLabels } from "../src/core/audit.ts";
import { checkModel } from "../src/core/check.ts";
import { ISSUE_SEVERITIES, makeIssue, type IssueCode } from "../src/core/issues.ts";
import { buildItems, expand } from "../src/core/items.ts";
import { renderFigure } from "../src/core/render.ts";
import { drawScene } from "../src/core/scene.ts";
import type { FigureSpec, FlatSpec } from "../src/core/spec.ts";
import { budgetIssues, measure } from "../src/node/index.ts";
import { validateSpec } from "../src/core/validate.ts";
import tokenBucket from "../examples/token-bucket/spec.ts";
import tokenBucketModel from "../examples/token-bucket/model.ts";

const box = { id: "a", kind: "box", at: [0, 0, 0], size: [4, 4, 4] };
const base = { id: "f", title: "t", alt: "a" };
const codes = (spec: unknown, lang?: string) => validateSpec(spec, { lang }).map((i) => i.code);
const find = (spec: unknown, code: IssueCode) => validateSpec(spec, { lang: "en" }).find((i) => i.code === code);

// Los 14 casos del informe (la 0.8.3 dejaba pasar 13 sin una palabra y lanzaba un TypeError en la 14.ª), cada uno con
// el código, la gravedad y el path que se esperan. En 0.9 solo es error lo que rompe el dibujo.
const CASOS: [string, unknown, IssueCode, "error" | "warning", string][] = [
  ["parts vacío", { ...base, parts: [] }, "parts-empty", "warning", "parts"],
  ["box sin size", { ...base, parts: [{ id: "a", kind: "box", at: [0, 0, 0] }] }, "field-missing", "error", "parts[0].size"],
  ["kind desconocido", { ...base, parts: [{ id: "a", kind: "torus", at: [0, 0, 0] }] }, "kind-unknown", "error", "parts[0].kind"],
  ["at con NaN", { ...base, parts: [{ ...box, at: [0, NaN, 0] }] }, "number-invalid", "error", "parts[0].at[1]"],
  ["size negativo", { ...base, parts: [{ ...box, size: [4, -4, 4] }] }, "size-negative", "error", "parts[0].size[1]"],
  [
    "bind a grupo inexistente",
    { ...base, parts: [box], params: [{ id: "p", label: "p", min: 0, max: 1, value: 0 }], bind: [{ group: "nadie", param: "p", move: [1, 0, 0] }] },
    "bind-unknown-group", "warning", "bind[0].group",
  ],
  ["bind a param inexistente", { ...base, parts: [{ ...box, group: "g" }], bind: [{ group: "g", param: "nada", move: [1, 0, 0] }] }, "bind-unknown-param", "warning", "bind[0].param"],
  ["value fuera de rango", { ...base, parts: [box], params: [{ id: "p", label: "p", min: 0, max: 10, value: 99 }] }, "param-value-out-of-range", "warning", "params[0].value"],
  ["preset a param inexistente", { ...base, parts: [box], presets: [{ label: "x", values: { nada: 1 }, note: "n" }] }, "preset-unknown-param", "warning", "presets[0].values.nada"],
  ["choice sin options", { ...base, parts: [box], params: [{ id: "p", label: "p", kind: "choice", min: 0, max: 1, value: 0 }] }, "choice-options-missing", "warning", "params[0].options"],
  [
    "params con id repetido",
    { ...base, parts: [box], params: [{ id: "p", label: "p", min: 0, max: 1, value: 0 }, { id: "p", label: "q", min: 0, max: 1, value: 0 }] },
    "param-id-duplicate", "warning", "params[1].id",
  ],
  [
    "spin sin groups.spin",
    { ...base, parts: [{ ...box, group: "g" }], params: [{ id: "p", label: "p", min: 0, max: 1, value: 0 }], bind: [{ group: "g", param: "p", spin: 90 }] },
    "bind-spin-no-pivot", "warning", "bind[0].spin",
  ],
  ["prisma cóncavo", { ...base, parts: [{ id: "a", kind: "prism", plan: [[0, 0], [10, 0], [5, 2], [10, 10], [0, 10]], z: 0, h: 4 }] }, "prism-concave", "warning", "parts[0].plan"],
  ["prisma horario", { ...base, parts: [{ id: "a", kind: "prism", plan: [[0, 0], [0, 10], [10, 10], [10, 0]], z: 0, h: 4 }] }, "prism-clockwise", "warning", "parts[0].plan"],
  ["ids repetidos", { ...base, parts: [box, box] }, "id-duplicate", "error", "parts[1].id"],
  ["on a una pieza que no existe", { ...base, parts: [box, { id: "l", kind: "line", on: "zz", points: [[0, 0, 4], [1, 1, 4]] }] }, "on-unknown", "error", "parts[1].on"],
  ["mount a una pieza que no existe", { ...base, parts: [{ ...box, mount: ["nada"] }] }, "mount-unknown", "warning", "parts[0].mount[0]"],
  [
    "value fuera del paso",
    { ...base, parts: [box], params: [{ id: "p", label: "p", min: 50, max: 500, step: 50, value: 120 }] },
    "param-value-off-step", "warning", "params[0].value",
  ],
  ["lectura de más de 70 caracteres", { ...base, parts: [box], readout: "x".repeat(71) }, "readout-long", "warning", "readout"],
];

for (const [name, spec, code, severity, path] of CASOS) {
  test(`validateSpec: ${name} da ${code} (${severity}) en ${path}`, () => {
    for (const lang of ["en", "es"]) {
      const issue = validateSpec(spec, { lang }).find((i) => i.code === code);
      assert.ok(issue, `falta ${code} con lang ${lang}`);
      assert.equal(issue.severity, severity);
      assert.equal(issue.path, path);
      assert.ok(issue.message.length > 10);
    }
  });
}

test("los avisos no rompen: una spec buena no da nada y una con avisos no da errores", () => {
  assert.deepEqual(validateSpec(tokenBucket), []);
  for (const [name, spec, , severity] of CASOS) {
    const errors = validateSpec(spec).filter((i) => i.severity === "error").length;
    assert.equal(errors > 0, severity === "error", name);
  }
});

test("el mensaje cambia con lang y el código no; un idioma sin traducción cae al inglés", () => {
  const spec = { ...base, parts: [{ ...box, size: [4, -4, 4] }] };
  const [en] = validateSpec(spec, { lang: "en" });
  const [es] = validateSpec(spec, { lang: "es" });
  const [pt] = validateSpec(spec, { lang: "pt" });
  const [def] = validateSpec(spec);
  assert.equal(en.code, es.code);
  assert.match(en.message, /sizes must be positive/);
  assert.match(es.message, /las medidas deben ser positivas/);
  assert.equal(pt.message, en.message);
  assert.equal(def.message, en.message);
});

test("cada código tiene mensaje en inglés y en español, con su gravedad", () => {
  for (const code of Object.keys(ISSUE_SEVERITIES) as IssueCode[]) {
    const en = makeIssue("en", code, "x");
    const es = makeIssue("es", code, "x");
    assert.ok(en.message.length > 5, code);
    assert.ok(es.message.length > 5, code);
    assert.notEqual(en.message, es.message, code);
    assert.equal(en.severity, ISSUE_SEVERITIES[code]);
  }
});

test("un kind desconocido dice cuál es y cuáles hay", () => {
  const issue = find({ ...base, parts: [{ id: "aro", kind: "torus", at: [0, 0, 0] }] }, "kind-unknown");
  assert.match(issue!.message, /'aro' has an unknown kind 'torus'/);
  assert.match(issue!.message, /box, cylinder, cone, prism, sphere, capsule, ticks, dots, line, label/);
  assert.match(find({ ...base, parts: [{ id: "x", at: [0, 0, 0] }] }, "kind-missing")!.message, /no kind/);
});

test("una clave desconocida es un aviso con la lista de las conocidas, no un error", () => {
  const issues = validateSpec({ ...base, readot: "x", parts: [{ ...box, colour: "red", tne: "hi" }] });
  const unknown = issues.filter((i) => i.code === "unknown-key");
  assert.deepEqual(unknown.map((i) => i.path).sort(), ["parts[0].colour", "parts[0].tne", "readot"]);
  assert.ok(unknown.every((i) => i.severity === "warning"));
  assert.match(unknown.find((i) => i.path === "readot")!.message, /Typo for 'readout'\?/);
  assert.match(unknown.find((i) => i.path === "parts[0].tne")!.message, /Typo for 'tone'\?/);
  assert.match(unknown.find((i) => i.path === "parts[0].colour")!.message, /Known keys: id, kind, tone/);
});

test("los campos nuevos de 0.9 no dan «clave desconocida» aunque su rama aún no esté fusionada", () => {
  const spec = {
    ...base,
    $schema: "https://example.com/schema.json",
    palette: { roles: ["steel"] },
    defs: { mast: { id: "mast" } },
    tracks: [{ group: "cart", path: [[0, 0, 0], [10, 0, 0]], period: 4, delay: 1, loop: false }],
    motion: { tau: 0.2, settle: 4 },
    params: [{ id: "go", label: "Go", kind: "action", min: 0, max: 9, value: 0 }],
    presets: [{ label: "Go", values: {}, note: "n", press: ["go"] }],
    parts: [{ ...box, paint: "steel", group: "cart", repeat: { count: 2, step: [0, 5, 0], from: 3 } }],
  };
  assert.deepEqual(validateSpec(spec), []);
  // Con un árbol anidado o un mapa las piezas se aplanan al compilar: no se exigen ni se miran aquí.
  assert.deepEqual(validateSpec({ ...base, root: { id: "r", children: [] }, map: { layout: "flow", nodes: [] } }), []);
  assert.deepEqual(codes({ ...base, root: { id: "r" }, groups: { x: {} }, params: [{ id: "p", label: "p", min: 0, max: 1, value: 0 }], bind: [{ group: "x", param: "p", fade: true }] }), []);
});

test("en una spec con un árbol, `parts` puede faltar; sin árbol ni mapa, falta es un error", () => {
  assert.equal(find({ ...base }, "parts-missing")?.severity, "error");
  assert.equal(find({ ...base, parts: "x" }, "type-invalid")?.severity, "error");
  assert.equal(codes(null)[0], "spec-not-object");
  assert.equal(codes([])[0], "spec-not-object");
});

test("on y mount se resuelven con las copias del repeat, y un detalle no puede ir sobre otro detalle", () => {
  const ok = { ...base, parts: [
    { id: "p-{i}", kind: "box", at: [0, 0, 0], size: [4, 4, 4], group: "g-{i}", repeat: { count: 3, step: [10, 0, 0] } },
    { id: "d-{i}", kind: "dots", on: "p-{i}", points: [[1, 1, 4]], repeat: { count: 3, step: [10, 0, 0] } },
    { id: "q", kind: "box", at: [0, 20, 0], size: [4, 4, 4], mount: ["p-2"] },
  ] };
  assert.deepEqual(validateSpec(ok), []);
  const bad = { ...base, parts: [...ok.parts, { id: "e", kind: "dots", on: "d-1", points: [[1, 1, 4]] }] };
  assert.equal(find(bad, "on-not-solid")?.severity, "error");
  const short = { ...base, parts: [{ ...ok.parts[0]!, repeat: { count: 2, step: [10, 0, 0] } }, ok.parts[1]!] };
  assert.equal(find(short, "on-unknown")!.path, "parts[1].on");
});

test("los números de la geometría: un NaN, un texto o un vector corto son errores con su path", () => {
  assert.equal(find({ ...base, parts: [{ ...box, at: [0, 0] }] }, "vector-length-invalid")!.path, "parts[0].at");
  assert.equal(find({ ...base, parts: [{ ...box, size: [4, "4", 4] }] }, "number-invalid")!.path, "parts[0].size[1]");
  assert.equal(find({ ...base, parts: [{ ...box, size: [4, 0, 4] }] }, "size-zero")!.severity, "warning");
  assert.equal(find({ ...base, groups: { g: { extent: [[0, Infinity, 0]] } }, parts: [{ ...box, group: "g" }] }, "number-invalid")!.path, "groups.g.extent[0][1]");
  assert.equal(find({ ...base, width: -5, parts: [box] }, "dimension-invalid")!.severity, "error");
  assert.equal(find({ ...base, camera: { azimuth: NaN }, parts: [box] }, "camera-invalid")!.path, "camera.azimuth");
});

test("el valor de un control se compara con lo que el navegador mostraría", () => {
  const p = (extra: object) => ({ ...base, parts: [box], params: [{ id: "p", label: "p", min: 0, max: 10, value: 3, ...extra }] });
  assert.match(find(p({ value: 3.5 }), "param-value-off-step")!.message, /step is 1 when omitted/);
  assert.deepEqual(codes(p({ value: 3 })), []);
  assert.deepEqual(codes(p({ step: 0.5, value: 3.5 })), []);
  assert.deepEqual(codes(p({ step: 0.1, value: 0.3 })), []);
  assert.match(find(p({ step: 50, min: 50, max: 500, value: 120 }), "param-value-off-step")!.message, /would show 100/);
  assert.equal(find(p({ min: 5, max: 5 }), "param-range-invalid")?.severity, "warning");
  assert.equal(find(p({ kind: "toggle", value: 2 }), "toggle-value-invalid")?.severity, "warning");
  assert.equal(find(p({ kind: "choice", options: ["a", "b"], value: 2 }), "choice-value-invalid")?.severity, "warning");
  assert.equal(find({ ...base, parts: [box], params: [{ id: "p", label: "p", min: 0, max: 10, step: 2, value: 4 }], presets: [{ label: "x", values: { p: 5 }, note: "n" }] }, "preset-value-off-step")!.path, "presets[0].values.p");
  assert.equal(find({ ...base, parts: [box], params: [{ id: "p", label: "p", min: 0, max: 10, value: 4 }], presets: [{ label: "x", values: { p: 50 }, note: "n" }] }, "preset-value-out-of-range")!.path, "presets[0].values.p");
});

test("un desvío que no cambia nada, ni pulsa ni reinicia, es un aviso; con press o reset, no", () => {
  const spec = (preset: object) => ({ ...base, parts: [box], params: [{ id: "go", label: "go", kind: "action", min: 0, max: 9, value: 0 }], presets: [{ label: "x", note: "n", ...preset }] });
  assert.ok(codes(spec({ values: {} })).includes("preset-no-effect"));
  assert.ok(!codes(spec({ values: {}, reset: true })).includes("preset-no-effect"));
  assert.ok(!codes(spec({ values: {}, press: ["go"] })).includes("preset-no-effect"));
  assert.ok(codes(spec({ values: {}, press: ["nada"] })).includes("preset-press-invalid"));
});

test("la lectura nombra parámetros que existen y cabe en 70 caracteres con los valores puestos", () => {
  const spec = (readout: unknown) => ({ ...base, parts: [box], params: [{ id: "n", label: "n", min: 0, max: 99, value: 5 }], readout });
  assert.deepEqual(codes(spec("{n} peticiones")), []);
  assert.ok(codes(spec("{m} peticiones")).includes("readout-unknown-param"));
  assert.equal(find(spec({ en: "x".repeat(40), es: `{n}${"y".repeat(70)}` }), "readout-long")!.path, "readout.es");
});

test("renderFigure usa el validador: los errores van a errors, los avisos a warnings y nada lanza", () => {
  const r = renderFigure({ ...base, parts: [{ id: "a", kind: "box", at: [0, 0, 0] }] } as unknown as FigureSpec, { lang: "es" });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0]!, /^parts\[0\]\.size: «a» \(box\) necesita «size»/);
  const w = renderFigure({ ...base, parts: [{ ...box, mount: ["nada"] }] } as unknown as FigureSpec);
  assert.deepEqual(w.errors, []);
  assert.equal(w.warnings.length, 1);
  assert.equal(w.issues[0]!.code, "mount-unknown");
  const broken = renderFigure({ ...base, parts: box } as unknown as FigureSpec);
  assert.equal(broken.html, "");
  assert.equal(broken.errors.length, 1);
  assert.deepEqual(renderFigure(null as unknown as FigureSpec).issues.map((i) => i.code), ["spec-not-object"]);
});

test("una spec disparatada no lanza ni se cuelga: cuentas sin fin, huecos en los arreglos, textos que no lo son", () => {
  const ticks = { id: "t", kind: "ticks", on: "a", from: [0, 0, 4], along: [1, 0, 0], count: Infinity, toward: [0, 1, 0] };
  const bomb = renderFigure({ ...base, parts: [box, ticks] } as unknown as FigureSpec);
  assert.equal(bomb.html, "");
  assert.equal(bomb.issues.find((i) => i.code === "count-too-large")?.severity, "error");
  // Sin kind no se dibuja, pero su repeat disparatado se dice y no se multiplica.
  const nokind = renderFigure({ ...base, parts: [box, { id: "x", at: [0, 0, 0], repeat: { count: 1e9, step: [1, 0, 0] } }] } as unknown as FigureSpec);
  assert.deepEqual(nokind.issues.map((i) => i.code).sort(), ["count-too-large", "kind-missing"]);
  // Un hueco en un arreglo es un valor que falta.
  const hole = [0, , 0] as unknown as number[];
  assert.equal(find({ ...base, parts: [{ ...box, at: hole }] }, "number-invalid")!.path, "parts[0].at[1]");
  const plan = [[0, 0], [10, 0], , [0, 10]] as unknown;
  assert.ok(codes({ ...base, parts: [{ id: "p", kind: "prism", plan, z: 0, h: 4 }] }).includes("type-invalid"));
  // Un título que no es texto: el dibujo falla y el error lo dice, sin lanzar.
  const title = renderFigure({ ...base, title: null, parts: [box] } as unknown as FigureSpec);
  assert.deepEqual(title.issues.filter((i) => i.severity === "error").map((i) => i.code), ["draw-failed"]);
});

test("la auditoría y el peso salen con código y en el idioma pedido", () => {
  const spec = { ...base, budget: 0.01, parts: [box, { id: "b", kind: "box", at: [30, 0, 20], size: [4, 4, 4] }] } as FigureSpec;
  const es = renderFigure(spec, { lang: "es" });
  const en = renderFigure(spec, { lang: "en" });
  assert.deepEqual(es.issues.map((i) => i.code), ["part-floats"]);
  assert.match(es.warnings.join("|"), /parts\[1\]: «b» flota/);
  assert.match(en.warnings.join("|"), /parts\[1\]: 'b' floats/);
  // El peso no lo mide renderFigure (el gzip necesita Node): lo da isofig/node, con el mismo código y el mismo idioma.
  const [weight] = budgetIssues(spec, measure(en.html), "es");
  assert.equal(weight!.code, "weight-over-budget");
  assert.equal(weight!.path, "budget");
  assert.match(weight!.message, /^pesa \d+\.\d KB gzip, más que el presupuesto de 0.01 KB$/);
  assert.deepEqual(budgetIssues({ budget: 100 }, measure(en.html)), []);
});

test("repeat.from: la copia k se desplaza step×k y se llama from+k", () => {
  const parts = expand([
    { id: "fila-{i}", kind: "box", at: [0, 0, 0], size: [1, 1, 1], group: "fila-{i}", repeat: { count: 2, step: [0, 5, 0] } },
    { id: "alta-{i}", kind: "box", at: [0, 0, 8], size: [1, 1, 1], group: "fila-{i}", repeat: { count: 2, step: [0, 5, 0], from: 2 } },
    { id: "sin-marcador", kind: "box", at: [0, 0, 0], size: [1, 1, 1], repeat: { count: 2, step: [1, 0, 0], from: 7 } },
  ]);
  assert.deepEqual(parts.map((p) => p.id), ["fila-0", "fila-1", "alta-2", "alta-3", "sin-marcador-7", "sin-marcador-8"]);
  assert.deepEqual(parts.map((p) => ("group" in p ? p.group : "")), ["fila-0", "fila-1", "fila-2", "fila-3", undefined, undefined]);
  assert.deepEqual((parts[3] as { at: number[] }).at, [0, 5, 8]);
  const spec = { ...base, groups: { "fila-2": {}, "fila-3": {} }, parts: [
    { id: "base", kind: "box", at: [0, 0, 0], size: [20, 20, 2] },
    { id: "alta-{i}", kind: "box", at: [0, 0, 2], size: [1, 1, 1], group: "fila-{i}", repeat: { count: 2, step: [0, 5, 0], from: 2 } },
  ] };
  assert.deepEqual(validateSpec(spec), []);
  assert.equal(find({ ...spec, parts: [{ ...(spec.parts[1] as object), repeat: { count: 2, step: [0, 5, 0], from: 1.5 } }] }, "repeat-from-invalid")!.severity, "warning");
});

const small = (size: number, face?: "x" | "y"): FlatSpec => ({
  ...base,
  width: 680,
  height: 430,
  parts: [{ id: "b", kind: "box", at: [0, 0, 0], size: [250, 250, 6] }, { id: "t", kind: "label", on: "b", at: [10, 10, 6], text: "puerto", size, ...(face ? { face } : {}) }],
});

test("rótulos: avisa si no se leen ni ampliados, resume si solo falla en el celular, y se calla si se leen", () => {
  const tiny = renderFigure(small(1), { lang: "en" });
  const unreadable = tiny.issues.filter((i) => i.code === "label-unreadable");
  assert.equal(unreadable.length, 1);
  assert.equal(unreadable[0]!.severity, "warning");
  assert.equal(unreadable[0]!.path, "parts[1].size");
  assert.match(unreadable[0]!.message, /Raise its size to \d/);
  assert.ok(!tiny.issues.some((i) => i.code === "label-small-mobile"));

  const medium = renderFigure(small(5), { lang: "en" });
  assert.deepEqual(medium.warnings, []);
  const info = medium.issues.find((i) => i.code === "label-small-mobile");
  assert.equal(info?.severity, "info");

  assert.deepEqual(renderFigure(small(14), { lang: "en" }).issues, []);
});

test("rótulos: el tamaño en pantalla incluye el acortamiento de la cara y los anchos se pueden cambiar", () => {
  const spec = small(4);
  const { items, cam } = drawScene(spec, "en");
  const flat = auditLabels(items, cam, 680, "en", { widths: { zoomed: 1150 }, min: { zoomed: 100, phone: 0 } })[0]!;
  const side = drawScene(small(4, "x"), "en");
  const upright = auditLabels(side.items, side.cam, 680, "en", { min: { zoomed: 100, phone: 0 } })[0]!;
  const px = (m: string) => Number(/measures ([\d.]+) px there/.exec(m)![1]);
  // Una cara de pie (x) se ve más alta que una tumbada en el piso (top): .87 contra .79 con la cámara por defecto.
  assert.ok(px(upright.message) > px(flat.message));
  const wide = auditLabels(items, cam, 680, "en", { widths: { zoomed: 2300 }, min: { zoomed: 100, phone: 0 } })[0]!;
  assert.ok(Math.abs(px(wide.message) / px(flat.message) - 2) < 0.1);
  assert.deepEqual(auditLabels(buildItems([box as never]).items, cam, 680), []);
});

// Un modelo mínimo: una caja que sube con `speed`, un grupo que el modelo escribe y no existe, y uno oculto que nunca enciende.
const modelSpec = (extra: Partial<FigureSpec> = {}): FigureSpec => ({
  ...base,
  model: "m",
  params: [
    { id: "speed", label: "Speed", min: 0, max: 10, value: 5 },
    { id: "mode", label: "Mode", kind: "toggle", min: 0, max: 1, value: 0 },
    { id: "idle", label: "Idle", min: 0, max: 1, value: 0 },
    { id: "go", label: "Go", kind: "action", min: 0, max: 99, value: 0 },
  ],
  groups: { lift: { extent: [[0, 0, 30]] }, spare: {} },
  parts: [
    { id: "base", kind: "box", at: [0, 0, 0], size: [20, 20, 2] },
    { id: "lift", kind: "box", at: [4, 4, 2], size: [4, 4, 4], group: "lift" },
    { id: "spare", kind: "box", at: [12, 4, 2], size: [4, 4, 4], group: "spare", hidden: true },
    { id: "still", kind: "box", at: [12, 12, 2], size: [4, 4, 4], group: "still" },
  ],
  ...extra,
});
type St = { t: number; pressed: number };
const lift = {
  init: () => ({ t: 0, pressed: 0 }) as St,
  step(s: St, dt: number, p: Record<string, number>) {
    s.t += dt * (p["speed"] ?? 0);
    s.pressed = p["go"] ?? 0;
  },
  view: (s: St, p: Record<string, number>) => ({
    groups: { lift: { t: [0, 0, Math.sin(s.t) * 10 + (p["mode"] ?? 0) * 5 + s.pressed * 3] as [number, number, number] }, ghost: { t: [0, 0, 1] as [number, number, number] } },
    readout: `speed ${p["speed"]} ${p["other"]}`,
  }),
};

test("check del modelo: grupos que el modelo escribe sin pieza, grupos que nunca mueve y parámetros que lee de más", () => {
  const issues = checkModel(modelSpec(), lift as never, { lang: "en" });
  const by = (code: string) => issues.filter((i) => i.code === code);
  assert.match(by("model-group-unknown")[0]!.message, /ghost/);
  assert.equal(by("group-never-driven")[0]!.severity, "warning");
  assert.match(by("group-never-driven")[0]!.message, /spare/);
  assert.match(by("group-never-driven")[0]!.message, /Hidden parts would stay invisible/);
  assert.match(by("group-static")[0]!.message, /still/);
  assert.equal(by("model-param-unknown")[0]!.path, "model.params.other");
  assert.deepEqual(by("param-never-read").map((i) => i.path), ["params.idle"]);
  assert.match(by("readout-longest")[0]!.message, /speed 5 undefined/);
});

test("check del modelo: un desvío que deja la misma vista es un aviso; press, reset y valores distintos cuentan", () => {
  const presets = [
    { label: "Same", values: { speed: 5 }, note: "n" },
    { label: "Faster", values: { speed: 9 }, note: "n" },
    { label: "Mode", values: { mode: 1 }, note: "n" },
    { label: "Press", values: {}, note: "n", press: ["go"] },
    { label: "Reset", values: {}, note: "n", reset: true },
    { label: "Nothing", values: {}, note: "n" },
  ] as FigureSpec["presets"];
  const issues = checkModel(modelSpec({ presets }), lift as never, { lang: "en", presets: true });
  const same = issues.filter((i) => i.code === "preset-same-view").map((i) => i.path);
  assert.deepEqual(same, ["presets[0]", "presets[5]"]);
  // Sin `presets: true` solo corre la ejecución base.
  assert.equal(checkModel(modelSpec({ presets }), lift as never).some((i) => i.code === "preset-same-view"), false);
});

test("check del modelo: ctx.pressed y ctx.changed valen en el paso que sigue a un desvío, y cuentan como lecturas", () => {
  type C = { n: number; moved: number };
  const clicker = {
    init: () => ({ n: 0, moved: 0 }) as C,
    step(s: C, _dt: number, _p: unknown, ctx: { pressed(id: string): boolean; changed(id: string): boolean }) {
      if (ctx.pressed("go")) s.n++;
      if (ctx.changed("speed")) s.moved++;
    },
    view: (s: C, _p: unknown, ctx: { say(t: string): void }) => (ctx.say("hola"), { groups: { lift: { t: [0, 0, s.n * 5 + s.moved] as [number, number, number] } } }),
  };
  const spec = modelSpec({
    presets: [
      { label: "Press", values: {}, note: "n", press: ["go"] },
      { label: "Move", values: { speed: 9 }, note: "n" },
      { label: "Same", values: { speed: 5 }, note: "n" },
    ] as FigureSpec["presets"],
  });
  const issues = checkModel(spec, clicker as never, { lang: "en", presets: true });
  assert.deepEqual(issues.filter((i) => i.code === "preset-same-view").map((i) => i.path), ["presets[2]"]);
  assert.deepEqual(issues.filter((i) => i.code === "param-never-read").map((i) => i.path), ["params.mode", "params.idle"]);
  assert.equal(issues.some((i) => i.code === "model-throws"), false);
});

test("un desvío con press nombra parámetros action que existen", () => {
  const spec = (press: unknown) => ({ ...base, parts: [box], params: [{ id: "go", label: "go", kind: "action", min: 0, max: 9, value: 0 }, { id: "r", label: "r", min: 0, max: 9, value: 0 }], presets: [{ label: "x", values: {}, note: "n", press }] });
  assert.deepEqual(codes(spec(["go"])), []);
  const bad = validateSpec(spec(["r", "nada"]));
  assert.deepEqual(bad.map((i) => [i.code, i.path]), [["preset-press-invalid", "presets[0].press[0]"], ["preset-press-invalid", "presets[0].press[1]"]]);
  assert.equal(find(spec("go"), "type-invalid")!.path, "presets[0].press");
});

test("check del modelo: un modelo que lanza o que no es un modelo da un error, no una excepción", () => {
  const boom = { init: () => 0, step() { throw new Error("se cayó"); }, view: () => ({}) };
  const [thrown] = checkModel(modelSpec(), boom as never, { lang: "es" });
  assert.equal(thrown!.code, "model-throws");
  assert.match(thrown!.message, /Error: se cayó/);
  assert.equal(checkModel(modelSpec(), {} as never)[0]!.code, "model-invalid");
});

test("check del modelo: la figura de ejemplo, con sus desvíos, no da avisos", () => {
  const issues = checkModel(tokenBucket, tokenBucketModel as never, { presets: true });
  assert.deepEqual(issues.filter((i) => i.severity !== "info"), []);
});

test("el CLI: --lang cambia el idioma y el prefijo, --strict falla con avisos, check --model --presets corre el modelo", () => {
  const dir = mkdtempSync(join(tmpdir(), "isofig-"));
  const file = join(dir, "spec.json");
  writeFileSync(file, JSON.stringify({ ...base, parts: [{ ...box, mount: ["nada"] }] }));
  const cli = (...args: string[]) => spawnSync(process.execPath, ["--no-warnings", resolve("src/cli/index.ts"), ...args], { encoding: "utf8" });
  const es = cli("check", file, "--lang", "es");
  assert.equal(es.status, 0);
  assert.match(es.stderr, /^aviso: parts\[0\]\.mount\[0\]: .* \[mount-unknown\]/m);
  const en = cli("check", file);
  assert.match(en.stderr, /^warning: parts\[0\]\.mount\[0\]: .* \[mount-unknown\]/m);
  assert.equal(cli("check", file, "--strict").status, 1);
  const bad = join(dir, "bad.json");
  writeFileSync(bad, JSON.stringify({ ...base, parts: [{ ...box, size: [4, -4, 4] }] }));
  const err = cli("check", bad, "--lang", "es");
  assert.equal(err.status, 1);
  assert.match(err.stderr, /^error: parts\[0\]\.size\[1\]: .* \[size-negative\]/m);

  const model = resolve("examples/token-bucket/model.ts");
  const spec = resolve("examples/token-bucket/spec.ts");
  const ok = cli("check", spec, "--model", model, "--presets", "--seconds", "4", "--lang", "es");
  assert.equal(ok.status, 0);
  assert.match(ok.stderr, /^nota: model\.readout: La lectura más larga/m);
  assert.equal(cli("check", spec, "--presets").status, 1);
});

test("en defs, un número puede ser «{clave}» como enseña la guía; un with que lo llena con texto se avisa en la plantilla", () => {
  const spec = (alto: unknown) =>
    ({
      id: "mesa",
      title: "Mesa",
      alt: "Una mesa",
      defs: { pata: { parts: [{ id: "c", kind: "cylinder", at: [0, 0, 0], r: 4, h: "{alto}" }] } },
      root: { id: "mesa", parts: [{ id: "tablero", kind: "box", at: [0, 0, 30], size: [60, 40, 4] }], children: [{ id: "p1", use: "pata", with: { alto: alto }, at: [4, 4, 0] }] },
    }) as unknown as FigureSpec;
  const errors = (s: FigureSpec) => validateSpec(s).filter((i) => i.severity === "error").map((i) => `${i.code} ${i.path}`);
  assert.deepEqual(errors(spec(30)), []);
  assert.deepEqual(errors(spec("treinta")), ["number-invalid defs.pata.parts[0].h"]);
});
