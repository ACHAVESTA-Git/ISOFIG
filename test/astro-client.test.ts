import { afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { build, clock, cleanUp, demoSpec, doc, flush, motion, observers, pointer, setVisible, slide, win, type Built } from "./dom.ts";
import { models, scan, start } from "../src/astro/client.ts";
import { unmountAll } from "../src/runtime/index.ts";

afterEach(() => {
  // Lo que Astro avisa antes de cambiar de página: la figura que no persiste se detiene.
  doc.dispatchEvent(new win.Event("astro:before-swap") as unknown as Event);
  unmountAll();
  cleanUp();
  mock.restoreAll();
});

/** La figura dentro del contenedor que `<Figure>` escribe: `data-isofig-load` y, con giro, la spec en línea. */
function host(load: "visible" | "idle" | "eager", options: { orbit?: boolean; model?: string; persist?: string } = {}): Built & { host: HTMLElement } {
  const spec = demoSpec({ model: options.model ?? "demo" });
  const f = build(spec, { orbit: options.orbit ?? false });
  const wrapper = f.host;
  wrapper.className = "isofig-host";
  wrapper.dataset["isofigLoad"] = load;
  if (options.persist) wrapper.dataset["astroTransitionPersist"] = options.persist;
  if (options.orbit) wrapper.insertAdjacentHTML("beforeend", `<script type="application/json" class="isofig-spec">${JSON.stringify(spec)}</script>`);
  return f;
}

const mounted = (f: Built) => !f.q(".isofig-controls").hasAttribute("hidden");

// Este va primero: `start()` registra una sola vez los oyentes de Astro y los demás los necesitan (afterEach avisa del cambio de página).
test("start espera a que corran los demás scripts de la página (models) y busca otra vez en cada astro:page-load", async () => {
  models({ "astro-start": async () => ({ default: slide }) });
  const first = host("eager", { model: "astro-start" });
  Object.defineProperty(doc, "readyState", { value: "loading", configurable: true });
  start();
  start();
  clock.advance(100);
  await flush();
  assert.equal(mounted(first), false, "mientras la página carga, no busca");
  doc.dispatchEvent(new win.Event("DOMContentLoaded") as unknown as Event);
  await flush();
  assert.equal(mounted(first), true);
  assert.equal(observers(), 1, "start solo registró los oyentes una vez");
  const second = host("eager", { model: "astro-start" });
  doc.dispatchEvent(new win.Event("astro:page-load") as unknown as Event);
  await flush();
  assert.equal(mounted(second), true);
  delete (doc as { readyState?: string }).readyState;
});

test("con eager, scan descarga el runtime y el modelo registrado con models() y monta la figura", async () => {
  models({ "astro-eager": async () => ({ default: slide }) });
  const f = host("eager", { model: "astro-eager" });
  motion.reduced = true;
  scan();
  assert.equal(mounted(f), false, "descargar es asíncrono");
  await flush();
  assert.equal(mounted(f), true);
  assert.equal(f.q("[data-zoom]").hidden, false, "el cargador de isofig/zoom se pone antes de montar");
  clock.frame();
  assert.equal(f.q('[data-g="bar"]').getAttribute("transform"), f.translate(10));
});

test("un modelo registrado como módulo suelto, sin default, también sirve; y scan es idempotente", async () => {
  models({ "astro-bare": async () => slide });
  const f = host("eager", { model: "astro-bare" });
  scan();
  scan();
  await flush();
  assert.equal(mounted(f), true);
  assert.equal(observers(), 1, "no se armó dos veces");
});

test("con visible, la figura espera a acercarse (o a que el lector la toque) antes de descargar nada", async () => {
  models({ "astro-visible": async () => ({ default: slide }), "astro-touch": async () => ({ default: slide }) });
  const far = host("visible", { model: "astro-visible" });
  setVisible(far.host, false);
  scan();
  await flush();
  assert.equal(mounted(far), false, "lejos, no se descarga");
  setVisible(far.host, true);
  await flush();
  assert.equal(mounted(far), true);

  const touched = host("visible", { model: "astro-touch" });
  setVisible(touched.host, false);
  scan();
  touched.host.dispatchEvent(new win.Event("pointerenter") as unknown as Event);
  await flush();
  assert.equal(mounted(touched), true, "pasar el puntero la adelanta");
});

test("con idle, espera a que el navegador esté libre", async () => {
  models({ "astro-idle": async () => ({ default: slide }) });
  const f = host("idle", { model: "astro-idle" });
  scan();
  await flush();
  assert.equal(mounted(f), false);
  clock.advance(2000);
  await flush();
  assert.equal(mounted(f), true);
});

test("si el modelo nunca se registró, la consola lo avisa a los 3 s en vez de dejar la figura quieta sin decir nada", async () => {
  const warn = mock.method(console, "warn", () => {});
  const f = host("eager", { model: "astro-sin-registrar" });
  scan();
  await flush();
  assert.equal(mounted(f), false);
  clock.advance(3100);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0]!.arguments[0]), /nadie registró el modelo «astro-sin-registrar»/);
});

test("al cambiar de página se detienen las figuras, salvo las que Astro conserva con transition:persist", async () => {
  models({ "astro-swap": async () => ({ default: slide }) });
  const keep = host("eager", { model: "astro-swap", persist: "fig-uno" });
  host("eager", { model: "astro-swap" });
  scan();
  await flush();
  assert.equal(observers(), 2);
  const next = doc.implementation.createHTMLDocument("siguiente");
  next.body.innerHTML = `<div data-astro-transition-persist="fig-uno"></div>`;
  const swap = new win.Event("astro:before-swap") as unknown as Event & { newDocument: Document };
  swap.newDocument = next;
  doc.dispatchEvent(swap);
  assert.equal(observers(), 1, "solo la que persiste sigue viva");
  assert.equal(mounted(keep), true);
});

test("una figura que sale de la página mientras se descarga no se monta", async () => {
  models({ "astro-gone": async () => ({ default: slide }) });
  const f = host("eager", { model: "astro-gone" });
  scan();
  doc.dispatchEvent(new win.Event("astro:before-swap") as unknown as Event);
  await flush();
  assert.equal(mounted(f), false);
  assert.equal(observers(), 0);
});

test("con giro, pasar el puntero descarga isofig/orbit y los botones redibujan la escena", async () => {
  models({ "astro-orbit": async () => ({ default: slide }) });
  motion.reduced = true;
  const f = host("eager", { model: "astro-orbit", orbit: true });
  scan();
  await flush();
  clock.frame();
  const before = f.q('[data-g="bar"]');
  f.el.dispatchEvent(new win.Event("pointerenter") as unknown as Event);
  await flush();
  f.q('[data-orbit="20"]').click();
  await flush();
  clock.run(3);
  assert.notEqual(f.q('[data-g="bar"]'), before, "la escena se redibujó con otro ángulo");
  pointer(f.svg, "pointerup");
});
