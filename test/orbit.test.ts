import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { build, clock, cleanUp, demoSpec, flush, motion, pointer, slide, win, type Built } from "./dom.ts";
import { drawScene } from "../src/core/scene.ts";
import { enableOrbit } from "../src/orbit/index.ts";
import { mount, orbitOnDemand, retarget, unmountAll, type OrbitHandle } from "../src/runtime/index.ts";

afterEach(() => {
  unmountAll();
  cleanUp();
});

const bar = (f: Built) => f.q('[data-g="bar"]');
const spec = demoSpec();
const scale = drawScene(spec, "en").cam.scale;
/** La base de proyección de la figura vista desde otro ángulo. */
const basisAt = (azimuth: number, elevation = 30) => drawScene(spec, "en", { azimuth, elevation, scale }).basis;

/** Una figura con giro, montada con movimiento reducido para que sus grupos lleguen al objetivo sin interpolar. */
function orbiting() {
  motion.reduced = true;
  const f = build(spec, { orbit: true });
  mount(f.el, slide);
  clock.frame();
  return f;
}

test("retarget cambia la cámara: las piezas del SVG redibujado se vuelven a encontrar y conservan su estado", () => {
  const f = orbiting();
  const old = bar(f);
  assert.equal(old.getAttribute("transform"), f.translate(10), "rate 2 → el grupo está en 10");

  const turned = drawScene(spec, "en", { azimuth: 70, elevation: 30, scale });
  f.q(".isofig-scene").outerHTML = `<g class="isofig-scene">${turned.markup}</g>`;
  retarget(f.el, turned.basis, turned.spins);
  clock.frame();
  const now = bar(f);
  assert.notEqual(now, old, "es un nodo nuevo");
  assert.equal(now.getAttribute("transform"), f.translate(10, turned.basis), "con la proyección nueva y el mismo desplazamiento");
  assert.notEqual(now.getAttribute("transform"), old.getAttribute("transform"));
  assert.equal(f.all('[data-g="bar"]').length, 1, "no queda el nodo viejo");
});

test("retarget sobre una figura que no está montada no hace nada", () => {
  const f = build(spec, { orbit: true });
  assert.doesNotThrow(() => retarget(f.el, basisAt(70), {}));
});

test("turn redibuja la escena desde otro ángulo y el runtime sigue animando las piezas nuevas", () => {
  const f = orbiting();
  const orbit = enableOrbit(f.el, spec, { lang: "en" });
  const old = bar(f);
  orbit.turn(20);
  assert.equal(bar(f), old, "se redibuja en el siguiente cuadro, no al instante");
  clock.frame();
  assert.notEqual(bar(f), old);
  clock.frame();
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(65)));

  orbit.turn(0, 15);
  clock.run(2);
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(65, 45)));
  orbit.stop();
});

test("el giro tiene tope a cada lado: el botón de ese lado se marca aria-disabled y reset vuelve a la vista inicial", () => {
  const f = orbiting();
  const orbit = enableOrbit(f.el, spec, { lang: "en" });
  const left = f.q('[data-orbit="-20"]');
  const right = f.q('[data-orbit="20"]');
  orbit.turn(100);
  clock.run(2);
  assert.equal(right.getAttribute("aria-disabled"), "true");
  assert.equal(left.getAttribute("aria-disabled"), "false");
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(85)), "45 + 40: no pasa del tope");
  orbit.turn(0, 100);
  clock.run(2);
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(85, 60)), "la elevación topa en 60");
  orbit.turn(-500, -500);
  clock.run(2);
  assert.equal(left.getAttribute("aria-disabled"), "true");
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(5, 12)));

  orbit.reset();
  clock.run(2);
  assert.equal(left.getAttribute("aria-disabled"), "false");
  assert.equal(right.getAttribute("aria-disabled"), "false");
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(45)));
  orbit.stop();
});

test("arrastrar el dibujo gira la figura; soltar, o soltar fuera de la ventana, termina el arrastre", () => {
  const f = orbiting();
  const orbit = enableOrbit(f.el, spec, { lang: "en" });
  pointer(f.svg, "pointerdown", { clientX: 100, clientY: 100 });
  assert.equal(f.svg.classList.contains("isofig-grabbing"), true);
  pointer(f.svg, "pointermove", { clientX: 40, clientY: 100 });
  clock.run(2);
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(45 + 60 * 0.35)), "60 px a la izquierda son 21 grados");
  pointer(f.svg, "pointerup");
  assert.equal(f.svg.classList.contains("isofig-grabbing"), false);
  pointer(f.svg, "pointermove", { clientX: 0, clientY: 100 });
  clock.run(2);
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(45 + 21)), "ya no sigue al puntero");

  pointer(f.svg, "pointerdown", { clientX: 0, clientY: 100 });
  pointer(f.svg, "pointermove", { clientX: 0, clientY: 100, buttons: 0 });
  assert.equal(f.svg.classList.contains("isofig-grabbing"), false, "un movimiento sin botón presionado suelta el arrastre");
  orbit.stop();
});

test("con el dedo solo gira de lado: la elevación no cambia, y un clic derecho no agarra nada", () => {
  const f = orbiting();
  const orbit = enableOrbit(f.el, spec, { lang: "en" });
  pointer(f.svg, "pointerdown", { clientX: 100, clientY: 100, pointerType: "touch" });
  pointer(f.svg, "pointermove", { clientX: 100, clientY: 0, pointerType: "touch" });
  clock.run(2);
  assert.equal(bar(f).getAttribute("transform"), f.translate(10, basisAt(45)));
  pointer(f.svg, "pointerup", { pointerType: "touch" });
  pointer(f.svg, "pointerdown", { button: 2 });
  assert.equal(f.svg.classList.contains("isofig-grabbing"), false);
  orbit.stop();
});

test("stop suelta los oyentes y cancela el redibujado pendiente", () => {
  const f = orbiting();
  const orbit = enableOrbit(f.el, spec, { lang: "en" });
  orbit.turn(20);
  const pending = clock.pending.frames;
  orbit.stop();
  assert.equal(clock.pending.frames, pending - 1);
  const before = bar(f);
  pointer(f.svg, "pointerdown", { clientX: 100, clientY: 100 });
  assert.equal(f.svg.classList.contains("isofig-grabbing"), false);
  clock.run(3);
  assert.equal(bar(f), before, "no se redibujó");
});

// El cargador del giro ---------------------------------------------------------------------------------------------

function handle() {
  const calls: string[] = [];
  const h: OrbitHandle = {
    turn: (a) => void calls.push(`turn ${a}`),
    reset: () => void calls.push("reset"),
    grab: (e) => void calls.push(`grab ${e.pointerId}`),
    stop: () => void calls.push("stop"),
  };
  return { calls, h };
}

test("orbitOnDemand precarga el giro una sola vez al pasar o enfocar, y lo activa al presionar el dibujo o un botón", async () => {
  const f = build(spec, { orbit: true });
  const { calls, h } = handle();
  let loads = 0;
  const stop = orbitOnDemand(f.el, async () => (loads++, h));
  f.el.dispatchEvent(new win.Event("pointerenter") as unknown as Event);
  f.el.dispatchEvent(new win.Event("focusin") as unknown as Event);
  await flush();
  assert.equal(loads, 1);
  assert.deepEqual(calls, []);

  f.q('[data-orbit="20"]').click();
  f.q('[data-orbit="-20"]').click();
  f.q('[data-orbit="0"]').click();
  await flush();
  assert.deepEqual(calls, ["turn 20", "turn -20", "reset"]);

  pointer(f.svg, "pointerdown", { pointerId: 4 });
  await flush();
  assert.deepEqual(calls, ["turn 20", "turn -20", "reset"], "ya cargado, el arrastre lo recoge el propio giro");
  assert.equal(loads, 1);

  stop();
  assert.equal(calls.at(-1), "stop");
  f.q('[data-orbit="20"]').click();
  await flush();
  assert.equal(calls.filter((c) => c === "turn 20").length, 1, "tras detenerla, los botones ya no giran");
});

test("presionar el dibujo antes de que cargue el giro lo agarra, salvo que el puntero se suelte antes o el botón no sea el principal", async () => {
  const f = build(spec, { orbit: true });
  const { calls, h } = handle();
  let release!: () => void;
  const ready = new Promise<void>((r) => (release = r));
  let loads = 0;
  const stop = orbitOnDemand(f.el, async () => {
    loads++;
    await ready;
    return h;
  });
  pointer(f.svg, "pointerdown", { pointerId: 5, button: 2 });
  assert.equal(loads, 0, "un clic derecho no carga nada");

  pointer(f.svg, "pointerdown", { pointerId: 6 });
  pointer(win as unknown as Element, "pointerup", { pointerId: 6 });
  pointer(f.svg, "pointerdown", { pointerId: 7 });
  assert.equal(loads, 1);
  release();
  await flush();
  assert.deepEqual(calls, ["grab 7"], "el 6 se soltó antes de que cargara: no gira sin botón presionado");
  stop();
});
