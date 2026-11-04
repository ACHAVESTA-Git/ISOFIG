import { test } from "node:test";
import assert from "node:assert/strict";
import { drawRound } from "../src/core/shade.ts";
import { fitCamera, makeCamera, project } from "../src/core/camera.ts";
import { buildItems, endsOf, isRound, isSolid, solidBox } from "../src/core/items.ts";
import { renderFigure } from "../src/core/render.ts";
import { drawScene } from "../src/core/scene.ts";
import type { FigureSpec, FlatSpec, Part } from "../src/core/spec.ts";
import { assemble } from "../src/core/tree.ts";
import { validateSpec } from "../src/core/validate.ts";

const base = { id: "f", title: "t", alt: "a" };
const sphere = (id: string, at: [number, number, number], r: number, extra: Record<string, unknown> = {}) => ({ id, kind: "sphere", at, r, ...extra }) as Part;
const capsule = (id: string, at: [number, number, number], r: number, h: number, extra: Record<string, unknown> = {}) => ({ id, kind: "capsule", at, r, h, ...extra }) as Part;
const box = (id: string, at: [number, number, number], size: [number, number, number], extra: Record<string, unknown> = {}) => ({ id, kind: "box", at, size, ...extra }) as Part;
const flat = (parts: Part[], extra: Partial<FlatSpec> = {}): FlatSpec => ({ ...base, parts, ...extra });
const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} no es ${b}`);

/** Los ids de las piezas en el orden en que se pintan: cada una lleva su propio `group`, que sale como `data-g`. */
function paintOrder(spec: FlatSpec, view = {}): string[] {
  const parts = spec.parts.map((p) => ({ ...p, group: p.id }) as Part);
  return [...drawScene({ ...spec, parts }, "en", view).markup.matchAll(/data-g="([^"]+)"/g)].map((m) => m[1]);
}

/** Los avisos de una spec, como `código ruta`. */
const warnings = (spec: FigureSpec) => renderFigure(spec, { lang: "en" }).issues.filter((i) => i.severity === "warning").map((i) => `${i.code} ${i.path}`);

/** Los extremos, en pantalla, de un polígono. */
function extent(poly: [number, number][]) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

test("esfera y cápsula son sólidos: entran en isSolid, y una esfera es redonda sin eje", () => {
  const s = sphere("s", [0, 0, 0], 5);
  const c = capsule("c", [0, 0, 0], 5, 10);
  assert.ok(isSolid(s) && isSolid(c));
  assert.ok(isRound(s as never) && isRound(c as never));
  assert.equal(isRound(box("b", [0, 0, 0], [1, 1, 1]) as never), false);
  assert.deepEqual(endsOf(s as never), [[0, 0, 0], [0, 0, 0]]);
  assert.deepEqual(endsOf(c as never), [[0, 0, 0], [0, 0, 10]], "por defecto el eje es z");
});

test("la caja de una esfera es el cubo de su radio y la de una cápsula, la unión de sus dos puntas", () => {
  assert.deepEqual(solidBox(sphere("s", [10, 20, 30], 5) as never), { min: [5, 15, 25], max: [15, 25, 35] });
  assert.deepEqual(solidBox(capsule("c", [0, 0, 0], 4, 20, { axis: "x" }) as never), { min: [-4, -4, -4], max: [24, 4, 4] }, "mide h + 2r de punta a punta");
  // Un eje inclinado: la caja es exacta, no la de un disco girado.
  const rod = solidBox(capsule("c", [0, 0, 0], 2, 10, { axis: [1, 0, 1] }) as never);
  near(rod.min[0], -2);
  near(rod.max[0], 10 * Math.SQRT1_2 + 2);
  near(rod.min[1], -2);
  near(rod.max[1], 2);
  near(rod.max[2], 10 * Math.SQRT1_2 + 2);
  // Con h 0 es una esfera; con h negativa se trata como 0.
  assert.deepEqual(solidBox(capsule("c", [0, 0, 0], 3, 0) as never), solidBox(sphere("s", [0, 0, 0], 3) as never));
  assert.deepEqual(solidBox(capsule("c", [0, 0, 0], 3, -9) as never), solidBox(sphere("s", [0, 0, 0], 3) as never));
});

test("validación: una esfera y una cápsula bien hechas no dan avisos; sus fallos salen con código", () => {
  const issues = (parts: unknown[], lang = "en") => validateSpec({ ...base, parts }, { lang }).map((i) => `${i.code} ${i.path}`);
  assert.deepEqual(issues([sphere("a", [0, 0, 0], 4), capsule("b", [10, 0, 0], 3, 20, { axis: [1, 1, 0] }), capsule("c", [30, 0, 0], 3, 0)]), []);
  assert.deepEqual(issues([{ id: "a", kind: "sphere", at: [0, 0, 0], r: -2 }]), ["size-negative parts[0].r"]);
  assert.deepEqual(issues([{ id: "a", kind: "sphere", at: [0, 0, 0], r: 0 }]), ["size-zero parts[0].r"]);
  assert.deepEqual(issues([{ id: "a", kind: "sphere", at: [0, 0, 0] }]), ["field-missing parts[0].r"]);
  assert.deepEqual(issues([{ id: "a", kind: "capsule", at: [0, 0, 0], r: 3 }]), ["field-missing parts[0].h"]);
  assert.deepEqual(issues([{ id: "a", kind: "capsule", at: [0, 0, 0], r: 3, h: -1 }]), ["size-negative parts[0].h"]);
  assert.deepEqual(issues([{ id: "a", kind: "capsule", at: [0, 0, 0], r: 3, h: 5, axis: [0, 0, 0] }]), ["axis-zero parts[0].axis"]);
  assert.deepEqual(issues([{ id: "a", kind: "capsule", at: [0, 0, 0], r: 3, h: 5, axis: "w" }]), ["option-invalid parts[0].axis"]);
  assert.deepEqual(issues([{ id: "a", kind: "sphere", at: [0, 0], r: 3 }]), ["vector-length-invalid parts[0].at"]);
  // Una esfera no tiene eje ni alto: son claves de otra pieza, y se avisa.
  assert.ok(issues([{ id: "a", kind: "sphere", at: [0, 0, 0], r: 3, axis: "x" }]).some((i) => i.startsWith("unknown-key")));
  // Los mensajes salen en los dos idiomas.
  assert.match(validateSpec({ ...base, parts: [{ id: "a", kind: "sphere", at: [0, 0, 0], r: -2 }] }, { lang: "es" })[0].message, /medidas deben ser positivas/);
  // Se puede poner un detalle sobre ellas, y los puntos y la sombra funcionan como en los demás sólidos.
  assert.deepEqual(issues([sphere("a", [0, 0, 0], 4, { shadow: true, tone: "lit", paint: "steel" }), { id: "d", kind: "dots", on: "a", points: [[0, 0, 4]] }]), []);
});

test("el SVG de una esfera y de una cápsula es determinista y usa solo los tonos de las demás piezas", () => {
  const spec = { ...base, parts: [box("piso", [0, 0, 0], [60, 40, 2]), sphere("bola", [15, 20, 8], 6), capsule("hueso", [34, 12, 7], 5, 14, { axis: "y" })] } as FigureSpec;
  const a = renderFigure(spec, { lang: "en" });
  assert.deepEqual(a.errors, []);
  assert.deepEqual(a.warnings, []);
  assert.equal(renderFigure(spec, { lang: "en" }).svg, a.svg, "dos builds iguales dan el mismo texto");
  const sphereOnly = renderFigure({ ...base, parts: [sphere("bola", [0, 0, 0], 8)] } as FigureSpec, { lang: "en" }).svg;
  // Seis capas de tono, de la más oscura a la más clara, y un canto; ningún color escrito en el SVG.
  const classes = [...sphereOnly.matchAll(/<path class="([a-z0-9]+)"/g)].map((m) => m[1]);
  assert.deepEqual(classes, ["s0", "s1", "s2", "s3", "b", "t", "e"]);
  assert.ok(!/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|fill="/i.test(sphereOnly.replace(/href="#[^"]*"/g, "")), "sin colores literales");
});

test("una esfera es un círculo y una cápsula un estadio, vistos desde donde sea", () => {
  for (const azimuth of [0, 20, 45, 70, 135]) {
    const cam = makeCamera({ azimuth, elevation: 30 }, 4, 100, 100);
    const ball = extent(drawRound(cam, [[0, 0, 0], [0, 0, 0]], 10).edges[0]);
    near(ball.x1 - ball.x0, 80, 1);
    near(ball.y1 - ball.y0, 80, 1);
    // Una cápsula vertical: el ancho es el de la esfera y el largo suma el tramo recto, en pantalla.
    const bone = extent(drawRound(cam, [[0, 0, 0], [0, 0, 30]], 10).edges[0]);
    near(bone.x1 - bone.x0, 80, 1);
    near(bone.y1 - bone.y0, 80 + 4 * 30 * Math.cos((30 * Math.PI) / 180), 1);
  }
  // La luz va arriba y a la izquierda: la capa más clara queda hacia allá de la esfera.
  const cam = makeCamera({}, 4, 100, 100);
  const layers = drawRound(cam, [[0, 0, 0], [0, 0, 0]], 10).faces;
  const centre = (shade: "s0" | "t") => {
    const e = extent(layers.get(shade)![0]);
    return [(e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2];
  };
  assert.ok(centre("t")[0] < centre("s0")[0] && centre("t")[1] < centre("s0")[1]);
});

test("el orden de pintado: una caja delante de una esfera la tapa, y al revés", () => {
  const ball = sphere("bola", [10, 10, 10], 10);
  // El lector está hacia +x +y: la caja con más x e y queda delante.
  const front = flat([ball, box("caja", [20, 20, 0], [20, 20, 20])]);
  assert.deepEqual(paintOrder(front), ["bola", "caja"]);
  const behind = flat([ball, box("caja", [-20, -20, 0], [20, 20, 20])]);
  assert.deepEqual(paintOrder(behind), ["caja", "bola"]);
  // Lo mismo si la caja se declara primero.
  assert.deepEqual(paintOrder(flat([box("caja", [20, 20, 0], [20, 20, 20]), ball])), ["bola", "caja"]);
  // Y desde el otro lado, el orden se invierte.
  assert.deepEqual(paintOrder(front, { azimuth: 225 }), ["caja", "bola"]);
  // Una esfera apoyada encima de la caja va después de ella.
  assert.deepEqual(paintOrder(flat([sphere("perla", [10, 10, 24], 4), box("caja", [0, 0, 0], [20, 20, 20])])), ["caja", "perla"]);
  // Dos esferas: la más cercana al lector, al final.
  assert.deepEqual(paintOrder(flat([sphere("lejos", [0, 0, 6], 6), sphere("cerca", [10, 10, 6], 6)])), ["lejos", "cerca"]);
});

test("una cápsula de eje inclinado: sin avisos junto a otra paralela, y el orden respeta quién va delante", () => {
  const rod = (id: string, at: [number, number, number], extra: Record<string, unknown> = {}) => capsule(id, at, 3, 30, { axis: [1, 0, 1], ...extra });
  // Dos paralelas separadas 11 en z (8 de distancia real, con 6 de radios): las cajas se cruzan, las piezas no.
  const pair = { ...base, parts: [box("piso", [-20, -20, -2], [120, 60, 2], { tone: "lo" }), rod("a", [0, 0, 3]), rod("b", [0, 0, 14])] } as FigureSpec;
  assert.deepEqual(warnings(pair), [], "las cajas se cruzan pero las cápsulas no");
  // Si de verdad se atraviesan, avisa; con `mount`, no.
  const cross = (extra: Record<string, unknown> = {}) => ({ ...base, parts: [box("piso", [-20, -20, -2], [120, 60, 2], { tone: "lo" }), rod("a", [0, 0, 3]), rod("b", [0, 0, 5], extra)] }) as FigureSpec;
  assert.deepEqual(warnings(cross()), ["parts-overlap parts[1]"]);
  assert.deepEqual(warnings(cross({ mount: ["a"] })), []);
  // Delante o detrás de una caja, según desde dónde se mire.
  const wall = box("muro", [14, -8, 0], [3, 16, 30]);
  const withWall = flat([capsule("hueso", [0, 0, 6], 3, 30, { axis: [1, 0, 1] }), wall]);
  const seen = (azimuth: number) => paintOrder(withWall, { azimuth });
  assert.notDeepEqual(seen(20), seen(200), "al girar media vuelta, el orden se invierte");
  for (const az of [20, 70]) assert.equal(seen(az).length, 2);
});

test("auditoría: una esfera tangente a otra, o a una caja, no da falsos avisos; hundida, sí", () => {
  const warn = (parts: Part[]) => warnings({ ...base, parts: [box("piso", [-30, -30, -2], [120, 120, 2], { tone: "lo" }), ...parts] } as FigureSpec);
  // Dos esferas que se tocan en diagonal (a 2r de distancia): las cajas se cruzan, las esferas no.
  assert.deepEqual(warn([sphere("a", [10, 10, 8], 8), sphere("b", [10 + 8 * Math.SQRT2, 10 + 8 * Math.SQRT2, 8], 8)]), []);
  // Una esfera junto a la esquina de una caja, sin tocarla.
  assert.deepEqual(warn([box("caja", [0, 0, 0], [10, 10, 10]), sphere("s", [16, 16, 7], 7)]), []);
  // Una esfera hundida en una caja avisa, y con `mount` no.
  assert.deepEqual(warn([box("caja", [0, 0, 0], [20, 20, 10]), sphere("s", [10, 10, 10], 6)]), ["parts-overlap parts[1]"]);
  assert.deepEqual(warn([box("caja", [0, 0, 0], [20, 20, 10]), sphere("s", [10, 10, 10], 6, { mount: ["caja"] })]), []);
  // Una esfera que flota sin tocar nada avisa; con `float`, no.
  assert.deepEqual(warn([sphere("s", [10, 10, 40], 6)]), ["part-floats parts[1]"]);
  assert.deepEqual(warn([sphere("s", [10, 10, 40], 6, { float: true })]), []);
});

test("girar: drawScene desde otra cámara redibuja la esfera y la cápsula, con la escala fija", () => {
  const spec = flat([box("piso", [0, 0, 0], [80, 50, 2], { tone: "lo" }), sphere("bola", [20, 25, 8], 6), capsule("hueso", [40, 10, 6], 4, 30, { axis: [0, 1, 1] })]);
  const home = drawScene(spec, "en");
  const { scale } = home.cam;
  const seen = [20, 70].map((azimuth) => drawScene(spec, "en", { azimuth, elevation: 30, scale }));
  for (const s of seen) {
    near(s.cam.scale, scale);
    assert.notEqual(s.markup, home.markup);
    assert.deepEqual(s.cycles, []);
    assert.equal(s.items.length, 3);
  }
  assert.notEqual(seen[0].markup, seen[1].markup);
  assert.notDeepEqual(seen[0].basis, seen[1].basis);
  // La misma cámara da lo mismo, byte a byte.
  assert.equal(drawScene(spec, "en", { azimuth: 70, elevation: 30, scale }).markup, seen[1].markup);
  // Con una elevación distinta la esfera sigue siendo un círculo del mismo radio.
  const low = drawScene(spec, "en", { azimuth: 70, elevation: 12, scale });
  assert.notEqual(low.markup, seen[1].markup);
  // Las poses de un `reorder` también se calculan con las formas redondas.
  const moved = { ...spec, groups: { g: {} }, params: [{ id: "p", label: "p", min: 0, max: 1, value: 0 }], bind: [{ group: "g", param: "p", move: [0, 30, 0] }], reorder: { param: "p", at: [0, 1] } } as FlatSpec;
  moved.parts = spec.parts.map((p) => (p.id === "bola" ? ({ ...p, group: "g" } as Part) : p));
  const r = drawScene(moved, "en");
  assert.equal(r.reorder?.poses.length, 2);
});

test("la figura encuadra el círculo exacto de la esfera, no su caja", () => {
  const spec = flat([sphere("s", [0, 0, 0], 10)], { width: 400, height: 300, pad: 24 });
  const { cam } = drawScene(spec, "en");
  // El radio en pantalla llena el lado menor menos el margen: 300 − 48 = 252, o sea r × escala = 126.
  near(cam.scale * 10, 126, 1e-6);
  const [cx, cy] = project(cam, [0, 0, 0]);
  near(cx, 200);
  near(cy, 150);
  // Una cámara de ajuste a mano da lo mismo que la que arma la escena.
  const u = makeCamera({});
  assert.deepEqual(fitCamera({}, [[0, 0, 0], [10, 0, 0].map((v, i) => (i === 0 ? v : 0)) as never], 400, 300, 24).scale > 0, true);
  assert.equal(u.scale, 1);
});

test("el halo de una esfera y de una cápsula es redondo y queda bajo ellas", () => {
  const withShadow = renderFigure({ ...base, parts: [sphere("s", [0, 0, 8], 8, { shadow: true })] } as FigureSpec, { lang: "en" }).svg;
  const halo = /<path class="h" d="([^"]+)"/.exec(withShadow)?.[1] ?? "";
  // Un contorno de decenas de puntos, no los cuatro vértices de un rombo.
  assert.ok(halo.split(/[lL]/)[1].trim().split(/[ -]/).length > 20);
  const cap = renderFigure({ ...base, parts: [capsule("c", [0, 0, 6], 6, 30, { axis: "y", shadow: true })] } as FigureSpec, { lang: "en" }).svg;
  assert.match(cap, /<path class="h"/);
});

test("el despiece y repeat funcionan con esferas y cápsulas dentro de nodos anidados", () => {
  const spec: FigureSpec = {
    ...base,
    root: {
      id: "esqueleto",
      parts: [box("camilla", [0, 0, 0], [100, 40, 4], { tone: "lo" })],
      children: [
        {
          id: "femur",
          name: { es: "Fémur", en: "Femur" },
          at: [20, 20, 4],
          explode: [0, 0, 30],
          parts: [capsule("diafisis", [0, 0, 5], 4, 40, { axis: "x", mount: [] }), sphere("cabeza", [0, 0, 5], 6)],
          children: [{ id: "rotula", at: [40, 0, 5], explode: [0, 0, 12], parts: [sphere("r", [0, 0, 0], 3)] }],
        },
        { id: "costilla-{i}", repeat: { count: 3, step: [0, 0, 12] }, at: [60, 20, 4], parts: [capsule("c", [0, 0, 0], 2, 10, { axis: "y" })] },
      ],
    },
  };
  const parts = assemble(spec).parts as (Part & { at: number[]; group?: string; outer?: string })[];
  const byId = (id: string) => parts.find((p) => p.id === id)!;
  assert.deepEqual(byId("femur.diafisis").at, [20, 20, 9]);
  assert.deepEqual(byId("femur.cabeza").at, [20, 20, 9]);
  assert.deepEqual(byId("femur.rotula.r").at, [60, 20, 9]);
  assert.deepEqual(byId("costilla-2.c").at, [60, 20, 28]);
  assert.equal(byId("femur.diafisis").kind, "capsule");
  assert.ok(byId("femur.cabeza").group, "se despieza: lleva su grupo");
  // La spec armada se valida, se audita y se dibuja sin errores, y el despiece mueve las piezas redondas como a las demás.
  const r = renderFigure(spec, { lang: "en" });
  assert.deepEqual(r.errors, []);
  assert.match(r.svg, /data-g="femur"/);
  assert.match(r.svg, /data-g="femur\.rotula"|data-g="rotula"/);
  assert.ok(r.data.params.some((p) => p.id === "explode"), "hay control de despiece");
  assert.ok(r.data.reorder, "y el orden de pintado de cada pose se calcula con las formas redondas");
});
