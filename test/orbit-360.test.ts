import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build, clock, cleanUp, demoSpec, flush, key, motion, pointer, setControl, slide, type Built } from "./dom.ts";
import { makeCamera, project } from "../src/core/camera.ts";
import { buildItems } from "../src/core/items.ts";
import { renderFigure } from "../src/core/render.ts";
import { drawScene, poseOf } from "../src/core/scene.ts";
import type { FigureSpec, FlatSpec, Part } from "../src/core/spec.ts";
import { assemble, type Catalog } from "../src/core/tree.ts";
import { catalog as kit } from "../src/kit/index.ts";
import { enableOrbit } from "../src/orbit/index.ts";
import { mount, orbitOnDemand, unmountAll, type OrbitHandle } from "../src/runtime/index.ts";

afterEach(() => {
  unmountAll();
  cleanUp();
});

const motor = JSON.parse(readFileSync(new URL("../examples/motor-v8/spec.json", import.meta.url), "utf8")) as FigureSpec;
const flat = assemble(motor, { catalog: kit as Catalog });
/** La figura de demostración con cuatro fichas idénticas (que el dibujo completo comparte con <use> y el borrador no). */
const spec = demoSpec({
  parts: [
    { id: "base", kind: "box", at: [0, 0, 0], size: [120, 70, 6], tone: "lo" },
    { id: "bar", kind: "box", at: [10, 10, 6], size: [20, 20, 10], tone: "hi", group: "bar" },
    { id: "tag", kind: "label", on: "base", at: [10, 60, 6], text: "Demo", face: "top", size: 8 },
    ...[0, 1, 2, 3].map((i): Part => ({ id: `ficha-${i}`, kind: "cylinder", at: [50 + 16 * i, 30, 6], r: 6, h: 3, tone: "mid" })),
  ] as Part[],
});
const scale = drawScene(spec, "en").cam.scale;
const basisAt = (azimuth: number, elevation = 30) => drawScene(spec, "en", { azimuth, elevation, scale }).basis;
const bar = (f: Built) => f.q('[data-g="bar"]');

/** Una figura con giro, montada con movimiento reducido (o sin él, y sin animación propia) para ver el resultado cuadro a cuadro. */
function orbiting(options: Parameters<typeof enableOrbit>[2] = { lang: "en" }, reduced = true) {
  motion.reduced = reduced;
  const f = build(reduced ? spec : calm, { orbit: true });
  mount(f.el, slide);
  clock.run({ ms: 3000 });
  return { f, orbit: enableOrbit(f.el, spec, options) };
}
/** La misma figura sin reproducción automática: con movimiento, el reloj no la sigue moviendo por su cuenta. */
const calm = { ...spec, autoplay: false } as FlatSpec;
const turned = (f: Built) => f.q(".isofig-scene");

// Vuelta completa ---------------------------------------------------------------------------------------------------

test("sin `range` el azimut gira sin tope y da la vuelta entera; ningún botón se deshabilita", () => {
  const { f, orbit } = orbiting();
  let az = 45;
  for (const da of [200, 200, 200, -700]) {
    az += da;
    orbit.turn(da);
    clock.run(2);
    assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(az)), `a ${az}°`);
  }
  for (const b of f.all("[data-orbit]")) assert.equal(b.hasAttribute("aria-disabled"), false, "sin tope no hay botones deshabilitados");
  orbit.stop();
});

test("una vuelta de 360° deja la misma imagen, y `reset` toma el camino corto", () => {
  const { f, orbit } = orbiting();
  orbit.turn(360);
  clock.run(2);
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(45)), "360° después es la misma vista");
  orbit.turn(350);
  clock.run(2);
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(395)));
  // Con movimiento, `reset` desde 395° va a 405° (10° más) y no 350° hacia atrás.
  motion.reduced = false;
  orbit.reset();
  const x = (az: number) => Number(/translate\(([-\d.]+)/.exec(f.translate(10, basisAt(az)))![1]);
  const [lo, hi] = [Math.min(x(395), x(405)), Math.max(x(395), x(405))];
  for (let i = 0; i < 12; i++) {
    clock.frame(16);
    const now = Number(/translate\(([-\d.]+)/.exec(bar(f).getAttribute("transform")!)![1]);
    assert.ok(now >= lo - 0.01 && now <= hi + 0.01, `cuadro ${i}: ${now} fuera de ${lo}…${hi}`);
  }
  clock.run({ ms: 4000 });
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(45)));
  orbit.stop();
});

test("con `range` el azimut vuelve a tener tope y los botones lo avisan", () => {
  const { f, orbit } = orbiting({ lang: "en", range: 90 });
  orbit.turn(500);
  clock.run(2);
  assert.equal(f.q('[data-orbit="20"]').getAttribute("aria-disabled"), "true");
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(135)));
  orbit.stop();
});

// Teclado ---------------------------------------------------------------------------------------------------------

test("el dibujo con giro se enfoca y declara sus flechas; su pista dice cómo girarlo", () => {
  const f = build(spec, { orbit: true });
  assert.equal(f.svg.getAttribute("tabindex"), "0");
  assert.equal(f.svg.getAttribute("aria-keyshortcuts"), "ArrowLeft ArrowRight ArrowUp ArrowDown");
  const hint = f.q(".isofig-hint");
  assert.match(f.svg.getAttribute("aria-describedby")!, new RegExp(hint.id));
  assert.match(hint.textContent!, /drag or use the arrow keys to turn/);
  const plain = build(spec);
  assert.equal(plain.svg.hasAttribute("tabindex"), false, "sin giro, el dibujo no se enfoca");
  assert.match(renderFigure(spec, { lang: "es", orbit: true }).html, /arrastra o usa las flechas para girar/);
});

test("con el dibujo enfocado, ← → giran 15° y ↑ ↓ cambian la elevación; con Ctrl o Alt no, y un control conserva sus flechas", async () => {
  const f = build(spec, { orbit: true });
  const calls: string[] = [];
  const h: OrbitHandle = { turn: (a, e) => void calls.push(`${a},${e}`), reset: () => void calls.push("reset"), grab: () => {}, stop: () => {} };
  const stop = orbitOnDemand(f.el, async () => h);
  const press = (name: string, init = {}) => key(f.svg, name, init);
  const e = press("ArrowLeft");
  assert.equal(e.defaultPrevented, true, "no desplaza la página");
  press("ArrowRight");
  press("ArrowUp");
  press("ArrowDown");
  press("ArrowRight", { ctrlKey: true });
  press("ArrowRight", { altKey: true });
  press("a");
  const slider = f.control("rate");
  assert.equal(key(slider, "ArrowRight").defaultPrevented, false);
  await flush();
  assert.deepEqual(calls, ["-15,0", "15,0", "0,5", "0,-5"]);
  stop();
  key(f.svg, "ArrowLeft");
  await flush();
  assert.equal(calls.length, 4, "detenido, ya no gira");
});

test("las flechas giran de verdad: ← −15°, → +15°, ↑ y ↓ cambian la elevación y topan en 12° y 60°", async () => {
  motion.reduced = true;
  const f = build(spec, { orbit: true });
  mount(f.el, slide);
  const stop = orbitOnDemand(f.el, async () => enableOrbit(f.el, spec, { lang: "en" }));
  const after = async (name: string) => {
    key(f.svg, name);
    await flush();
    clock.run(2);
    return bar(f).getAttribute("transform");
  };
  assert.equal(await after("ArrowRight"), f.translate(10, basisAt(60)));
  assert.equal(await after("ArrowLeft"), f.translate(10, basisAt(45)));
  assert.equal(await after("ArrowLeft"), f.translate(10, basisAt(30)));
  assert.equal(await after("ArrowUp"), f.translate(10, basisAt(30, 35)));
  for (let i = 0; i < 12; i++) await after("ArrowUp");
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(30, 60)));
  stop();
});

// Que quepa en cada ángulo ------------------------------------------------------------------------------------------

/** Las esquinas de todas las piezas en todas las poses del despiece: lo que tiene que caber en el marco. */
function corners(s: FlatSpec, steps: number): [number, number, number][] {
  const { items } = buildItems(s.parts);
  const out: [number, number, number][] = [];
  for (let v = 0; v <= steps; v++) {
    const pose = poseOf(s, "explode", v);
    for (const it of items) {
      const d = [0, 1, 2].map((i) => (pose.get(it.group ?? "")?.[i] ?? 0) + (pose.get(it.outer ?? "")?.[i] ?? 0));
      for (const x of [it.box.min[0], it.box.max[0]]) for (const y of [it.box.min[1], it.box.max[1]]) for (const z of [it.box.min[2], it.box.max[2]]) out.push([x + d[0]!, y + d[1]!, z + d[2]!]);
    }
  }
  return out;
}

test("la escala encaja el despiece completo en 0°, 90°, 180° y 270°, sin pasar de la escala de la vista inicial", () => {
  const W = flat.width ?? 640, H = flat.height ?? 400;
  const home = drawScene(flat, "es").cam.scale;
  const steps = flat.params!.find((p) => p.id === "explode")!.max as number;
  const points = corners(flat, steps);
  for (const azimuth of [0, 90, 180, 270]) {
    const { cam } = drawScene(flat, "es", { azimuth, scale: home });
    assert.ok(cam.scale <= home + 1e-9, `a ${azimuth}° no crece (${cam.scale.toFixed(3)} frente a ${home.toFixed(3)})`);
    const xs = points.map((p) => project(cam, p)[0]);
    const ys = points.map((p) => project(cam, p)[1]);
    assert.ok(Math.min(...xs) >= -1e-6 && Math.max(...xs) <= W + 1e-6, `a ${azimuth}° cabe a lo ancho: ${Math.min(...xs).toFixed(1)}…${Math.max(...xs).toFixed(1)} de ${W}`);
    assert.ok(Math.min(...ys) >= -1e-6 && Math.max(...ys) <= H + 1e-6, `a ${azimuth}° cabe a lo alto: ${Math.min(...ys).toFixed(1)}…${Math.max(...ys).toFixed(1)} de ${H}`);
  }
});

test("la escala cambia de forma continua al girar (sin saltos) y no pasa de la inicial", () => {
  const wide = demoSpec({
    parts: [
      { id: "base", kind: "box", at: [0, 0, 0], size: [400, 30, 6], tone: "lo" },
      { id: "bar", kind: "box", at: [10, 10, 6], size: [20, 20, 10], tone: "hi", group: "bar" },
    ],
    groups: { bar: { extent: [[0, 0, 0], [0, 0, 20]] } },
  });
  const home = drawScene(wide, "en").cam.scale;
  let prev = home;
  let min = home;
  for (let az = 45; az <= 45 + 360; az += 1) {
    const s = drawScene(wide, "en", { azimuth: az, scale: home }).cam.scale;
    assert.ok(s <= home + 1e-9);
    assert.ok(Math.abs(s - prev) / home < 0.03, `salto de escala entre ${az - 1}° y ${az}°: ${prev.toFixed(3)} → ${s.toFixed(3)}`);
    prev = s;
    min = Math.min(min, s);
  }
  assert.ok(min < home * 0.8, "una figura larga se achica bastante al verse de lado");
  assert.ok(Math.abs(prev - home) < 1e-9, "tras la vuelta completa, vuelve a la escala inicial");
});

// Borrador y poses parciales --------------------------------------------------------------------------------------

test("`pose` calcula solo el orden de pintado de la pose que se ve; las demás quedan sin movidas", () => {
  const all = drawScene(flat, "en", { azimuth: 200 }).reorder!;
  assert.ok(all.poses.length >= 5);
  const part = drawScene(flat, "en", { azimuth: 200, pose: 3 }).reorder!;
  assert.equal(part.poses.length, all.poses.length);
  all.poses.forEach((q, i) => {
    if (q[0] === 3) assert.deepEqual(part.poses[i], q, "la pose que se ve es igual a la completa");
    else assert.deepEqual(part.poses[i], [q[0]], `la pose ${i + 1} no se calculó`);
  });
  const rest = drawScene(flat, "en", { azimuth: 200, pose: 0 }).reorder!;
  assert.ok(rest.poses.every((q) => q.length === 1), "armado, no hace falta ninguna pose");
  assert.equal(drawScene(flat, "en", { azimuth: 200, pose: 3 }).markup, drawScene(flat, "en", { azimuth: 200 }).markup, "el dibujo en sí no cambia");
});

test("el borrador no comparte piezas ni pinta todas las capas de las redondas, y el dibujo completo sí", () => {
  const round = demoSpec({
    parts: [
      { id: "base", kind: "box", at: [0, 0, 0], size: [120, 70, 6], tone: "lo" },
      { id: "bola", kind: "sphere", at: [60, 20, 14], r: 8, tone: "lit" },
      ...[0, 1, 2, 3].map((i): Part => ({ id: `ficha-${i}`, kind: "cylinder", at: [10 + 20 * i, 50, 6], r: 6, h: 3, tone: "hi" })),
    ],
  });
  const full = drawScene(round, "en", { azimuth: 60 }).markup;
  const draft = drawScene(round, "en", { azimuth: 60, draft: true }).markup;
  assert.match(full, /<use /, "las fichas idénticas se comparten");
  assert.doesNotMatch(draft, /<use |<defs>/);
  const layers = (m: string) => (/<g class="lit"[^>]*>(.*?)<\/g>/.exec(m)![1]!.match(/<path class="s\d"/g) ?? []).length;
  assert.equal(layers(full), 4);
  assert.ok(layers(draft) < 4, "menos capas en la esfera");
  assert.equal(drawScene(round, "en", { azimuth: 60 }).markup, full, "el borrador no deja huella en el dibujo completo");
});

test("arrastrar dibuja en borrador y con la pose que se ve; al soltar se dibuja completo, igual que desde ese ángulo", () => {
  motion.reduced = true;
  const f = build(motor, { orbit: true });
  mount(f.el);
  const orbit = enableOrbit(f.el, flat, { lang: "en" });
  const uses = () => f.all(".isofig-scene use").length;
  const pieces = () => [...f.q(".isofig-scene").children].filter((c) => c.tagName.toLowerCase() !== "defs");
  const order = () => pieces().map((c) => c.getAttribute("data-g") ?? "");
  clock.run(2);
  setControl(f.control("explode"), 3);
  clock.run(3);
  clock.advance(1500);
  const total = pieces().length;
  assert.ok(uses() > 0, "el dibujo de partida comparte piezas");

  pointer(f.svg, "pointerdown", { clientX: 100, clientY: 100 });
  pointer(f.svg, "pointermove", { clientX: 40, clientY: 100 });
  clock.frame();
  assert.equal(uses(), 0, "mientras se arrastra, borrador");
  assert.equal(pieces().length, total, "con todas las piezas");
  const dragging = order();
  pointer(f.svg, "pointerup");
  clock.run(3);
  assert.ok(uses() > 0, "al soltar, completo");
  assert.deepEqual(order(), dragging, "con el despiece en el mismo orden de pintado: la pose parcial era la buena");

  const az = (motor.camera?.azimuth ?? 45) + 60 * 0.35;
  const twin = build(motor, { orbit: true });
  mount(twin.el);
  const other = enableOrbit(twin.el, flat, { lang: "en" });
  clock.run(2);
  setControl(twin.control("explode"), 3);
  clock.run(3);
  other.turn(60 * 0.35);
  clock.run(3);
  assert.equal(f.q(".isofig-scene").innerHTML, twin.q(".isofig-scene").innerHTML, `soltar a ${az}° da lo mismo que un giro directo a ese ángulo`);
  orbit.stop();
  other.stop();
});

// Inercia ---------------------------------------------------------------------------------------------------------------

/** Arrastra en cuatro cuadros, 20 px por cuadro, y suelta tras `wait` ms. */
function fling(f: Built, wait = 0) {
  pointer(f.svg, "pointerdown", { clientX: 200, clientY: 100 });
  for (let i = 1; i <= 4; i++) {
    pointer(f.svg, "pointermove", { clientX: 200 - i * 20, clientY: 100 });
    clock.frame(16);
  }
  clock.advance(wait);
  pointer(f.svg, "pointerup");
}
const shot = (f: Built) => bar(f).getAttribute("transform");

test("al soltar, el giro sigue con inercia, frena con suavidad y se detiene del todo", () => {
  const { f, orbit } = orbiting({ lang: "en" }, false);
  fling(f);
  const trail: string[] = [];
  const hold = shot(f);
  for (let i = 0; i < 140; i++) {
    clock.frame(16);
    trail.push(shot(f)!);
  }
  assert.notEqual(trail[0], hold, "sigue girando tras soltar");
  assert.notEqual(trail[10], trail[0]);
  const moves = trail.map((t, i) => (i ? Math.abs(Number(/translate\(([-\d.]+)/.exec(t)![1]) - Number(/translate\(([-\d.]+)/.exec(trail[i - 1]!)![1])) : 0));
  const early = moves.slice(1, 12).reduce((a, b) => a + b, 0);
  const late = moves.slice(60, 71).reduce((a, b) => a + b, 0);
  assert.ok(late < early / 3, `frena: ${early.toFixed(2)} al inicio y ${late.toFixed(2)} después`);
  assert.equal(clock.pending.frames, 0, "al detenerse no deja cuadros pendientes");
  assert.equal(f.all(".isofig-scene use").length > 0, true, "y termina con el dibujo completo");
  const end = shot(f);
  clock.run(10);
  assert.equal(shot(f), end);
  orbit.stop();
});

test("un arrastre que se detuvo antes de soltar no lanza el giro; con movimiento reducido tampoco hay inercia", () => {
  const a = orbiting({ lang: "en" }, false);
  fling(a.f, 300);
  clock.run(6);
  const parked = shot(a.f);
  clock.run(20);
  assert.equal(shot(a.f), parked, "el puntero estuvo quieto antes de soltar");
  a.orbit.stop();
  cleanUp();
  unmountAll();

  const b = orbiting({ lang: "en" }, true);
  fling(b.f);
  clock.run(3);
  const rest = shot(b.f);
  clock.run(30);
  assert.equal(shot(b.f), rest, "sin inercia");
  assert.equal(clock.pending.frames, 0);
  b.orbit.stop();
});

test("agarrar la figura mientras desliza la detiene en el acto", () => {
  const { f, orbit } = orbiting({ lang: "en" }, false);
  fling(f);
  clock.run(5);
  pointer(f.svg, "pointerdown", { clientX: 100, clientY: 100 });
  const held = shot(f);
  clock.run(30);
  assert.equal(shot(f), held, "se quedó quieta bajo el puntero");
  pointer(f.svg, "pointerup");
  orbit.stop();
});

// Nada en espejo desde atrás ---------------------------------------------------------------------------------------

const labeled: FlatSpec = {
  id: "grabado",
  title: "Grabado",
  readout: "",
  parts: [
    { id: "plato", kind: "box", at: [0, 0, 0], size: [80, 50, 10], tone: "mid" },
    { id: "tapa", kind: "label", on: "plato", at: [6, 10, 10], text: "TAPA", face: "top", size: 8 },
    { id: "frente", kind: "label", on: "plato", at: [80, 6, 6], text: "FRENTE", face: "x", size: 5 },
    { id: "lado", kind: "label", on: "plato", at: [6, 50, 6], text: "LADO", face: "y", size: 5 },
    { id: "girado", kind: "label", on: "plato", at: [40, 30, 10], text: "GIRADO", axes: [[-0.5, 0.866, 0], [0.866, 0.5, 0]], size: 5, align: "middle" },
    { id: "puntos-x", kind: "dots", on: "plato", points: [[80, 20, 5], [80, 30, 5]] },
    { id: "puntos-arriba", kind: "dots", on: "plato", points: [[20, 40, 10], [30, 40, 10]] },
    { id: "linea-x", kind: "line", on: "plato", points: [[80, 10, 2], [80, 40, 2]] },
  ] as Part[],
} as FlatSpec;

const texts = (markup: string) => [...markup.matchAll(/<text [^>]*?(?:text-anchor="(\w+)")? transform="matrix\(([^)]*)\)">([^<]*)<\/text>/g)].map((m) => ({ anchor: m[1] ?? "start", m: m[2]!.split(" ").map(Number), text: m[3]! }));

test("un rótulo de una cara que mira al lector se lee al derecho; el de una cara que no lo mira no se dibuja", () => {
  const seen = (azimuth: number) => texts(drawScene(labeled, "en", { azimuth, elevation: 30 }).markup);
  for (let azimuth = 0; azimuth < 360; azimuth += 5) {
    const cam = makeCamera({ azimuth, elevation: 30 });
    for (const t of seen(azimuth)) {
      const [a, b, c, d] = t.m as [number, number, number, number];
      assert.ok(a * d - b * c > 0, `«${t.text}» sale en espejo a ${azimuth}°`);
      assert.ok(d >= -1e-6, `«${t.text}» sale de cabeza a ${azimuth}°`);
    }
    const names = seen(azimuth).map((t) => t.text);
    assert.equal(names.includes("FRENTE"), cam.view[0] > 1e-6, `FRENTE (cara +x) a ${azimuth}°`);
    assert.equal(names.includes("LADO"), cam.view[1] > 1e-6, `LADO (cara +y) a ${azimuth}°`);
    assert.ok(names.includes("TAPA") && names.includes("GIRADO"), "las tapas se ven desde cualquier lado, giradas para leerse");
  }
  const front = texts(drawScene(labeled, "en", { azimuth: 45 }).markup).find((t) => t.text === "TAPA")!;
  const back = texts(drawScene(labeled, "en", { azimuth: 225 }).markup).find((t) => t.text === "TAPA")!;
  assert.equal(front.anchor, "start");
  assert.equal(back.anchor, "end", "visto desde el otro lado, el texto gira media vuelta sobre su ancla");
});

test("lo grabado en una cara que ya no mira al lector (puntos, líneas) no se ve a través de la pieza", () => {
  const count = (azimuth: number) => {
    const m = drawScene(labeled, "en", { azimuth, elevation: 30 }).markup;
    return { dots: (m.match(/h0/g) ?? []).length, fine: (m.match(/class="l"/g) ?? []).length };
  };
  assert.deepEqual(count(45), { dots: 4, fine: 1 }, "de frente: los puntos de la tapa y de la cara +x, y la línea de la cara +x");
  assert.deepEqual(count(225), { dots: 2, fine: 0 }, "desde atrás quedan los puntos de la tapa; la cara +x ya no mira al lector");
});

test("la luz y las sombras se leen en toda la vuelta: cada cara visible lleva un tono y el halo no desaparece", () => {
  const lit = demoSpec({ parts: [{ id: "base", kind: "box", at: [0, 0, 0], size: [120, 70, 6], tone: "lo", shadow: true }, { id: "bar", kind: "box", at: [10, 10, 6], size: [20, 20, 10], tone: "hi", group: "bar" }] });
  for (let azimuth = 0; azimuth < 360; azimuth += 30) {
    const m = drawScene(lit, "en", { azimuth, elevation: 30 }).markup;
    assert.match(m, /<path class="h"/, `el halo del piso se ve a ${azimuth}°`);
    const tones = new Set((m.match(/<path class="(s\d|t|b)"/g) ?? []).map((s) => s.slice(13)));
    assert.ok(tones.size >= 2 && [...tones].some((t) => t.startsWith("t")), `a ${azimuth}° se leen la tapa y al menos una cara de lado (${[...tones].join(",")})`);
  }
});

test("el esqueleto y el V8 se dibujan desde cualquier ángulo sin ciclos en el orden de pintado ni piezas perdidas", () => {
  const items = buildItems(flat.parts).items.length;
  for (const azimuth of [0, 90, 180, 270]) {
    const s = drawScene(flat, "en", { azimuth });
    assert.equal(s.items.length, items);
    assert.deepEqual(s.cycles, [], `ciclos a ${azimuth}°`);
  }
});

