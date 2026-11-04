import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { build, clock, cleanUp, demoSpec, doc, flush, key, pressEscape, setControl, slide, type Built } from "./dom.ts";
import { mount, unmountAll, zoomOnDemand, type ZoomModule } from "../src/runtime/index.ts";

afterEach(() => {
  unmountAll();
  cleanUp();
});

const bar = (f: Built) => f.q('[data-g="bar"]');
const dialogs = (f: Built) => f.all<HTMLDialogElement>("dialog");

let loads = 0;
const loader = async (): Promise<ZoomModule> => {
  loads++;
  return import("../src/zoom/index.ts");
};

/** Monta una figura con el cargador de isofig/zoom puesto y la deja con el diálogo abierto. */
async function opened(): Promise<Built> {
  zoomOnDemand(loader);
  const f = build(demoSpec());
  mount(f.el, slide);
  f.q("[data-zoom]").click();
  await flush();
  return f;
}

// Este va primero: `zoomOnDemand` es global y no se puede quitar, y aquí aún no hay cargador.
test("el chip «Ampliar» está oculto si nadie dijo de dónde cargar isofig/zoom", () => {
  const f = build(demoSpec());
  const stop = mount(f.el, slide);
  assert.equal(f.q("[data-zoom]").hidden, true);
  stop();
});

test("con un cargador el chip aparece, y renderFigure({ zoom: false }) no lo dibuja", () => {
  zoomOnDemand(loader);
  const f = build(demoSpec());
  mount(f.el, slide);
  assert.equal(f.q("[data-zoom]").hidden, false);
  const sin = build(demoSpec(), { zoom: false });
  mount(sin.el, slide);
  assert.equal(sin.all("[data-zoom]").length, 0);
});

test("pulsar el chip descarga isofig/zoom y abre un diálogo modal con el mismo SVG de la figura", async () => {
  loads = 0;
  zoomOnDemand(loader);
  const f = build(demoSpec());
  mount(f.el, slide);
  const svg = f.svg;
  const card = svg.parentElement!;
  assert.equal(loads, 0, "no se descarga hasta que alguien lo pulsa");
  f.q("[data-zoom]").click();
  assert.equal(dialogs(f).length, 0, "el import() es asíncrono");
  await flush();
  assert.equal(loads, 1);
  const [box] = dialogs(f);
  assert.ok(box!.open);
  assert.equal(box!.getAttribute("aria-label"), "Demo");
  assert.equal(box!.parentElement, f.el, "dentro de la figura: hereda el tema y el runtime la sigue encontrando");
  assert.equal(svg.closest("dialog"), box, "es el mismo nodo, no una copia");
  assert.equal(svg.parentElement!.className, "isofig-zoompane");
  assert.equal(svg.parentElement!.tabIndex, 0, "el panel se desplaza con las flechas");
  assert.ok(card.querySelector(".isofig-zoomhold"), "un hueco guarda el sitio del dibujo");
  assert.equal(card.contains(svg), false);
  assert.match(box!.style.getPropertyValue("--isofig-zoom-need"), /^\d+px$/, "el ancho sale de la mediana de los rótulos");
  const bar2 = box!.querySelector(".isofig-zoombar")!;
  assert.equal(bar2.querySelector(".isofig-zoomclose")!.textContent, "Close");
  assert.ok(bar2.querySelector(".isofig-readout"), "la lectura sube a la barra del diálogo");
});

test("Esc cierra el diálogo: el SVG vuelve a su sitio, el foco vuelve al chip y la animación sigue", async () => {
  const f = await opened();
  const svg = f.svg;
  setControl(f.control("rate"), 10);
  clock.run(3);
  const during = bar(f).getAttribute("transform");
  clock.run(3);
  assert.notEqual(bar(f).getAttribute("transform"), during, "ampliada, la figura sigue animándose");
  assert.equal(svg.closest("dialog") !== null, true);

  pressEscape();
  await flush();
  assert.equal(dialogs(f).length, 0);
  assert.equal(svg.parentElement!.className, "isofig-card");
  assert.equal(f.all(".isofig-zoomhold").length, 0);
  assert.equal(f.q(".isofig-readout").parentElement!.className, "isofig-bottom", "la lectura vuelve a su sitio");
  assert.equal(doc.activeElement, f.q("[data-zoom]"), "el foco vuelve al chip que abrió el diálogo");
  const closed = bar(f).getAttribute("transform");
  clock.run({ ms: 3000 });
  assert.notEqual(bar(f).getAttribute("transform"), closed, "cerrada, sigue animándose");
  assert.equal(bar(f).getAttribute("transform"), f.translate(50));
});

test("el botón «Cerrar» cierra igual, y se puede volver a abrir", async () => {
  const f = await opened();
  f.q(".isofig-zoomclose").click();
  await flush();
  assert.equal(dialogs(f).length, 0);
  assert.equal(doc.activeElement, f.q("[data-zoom]"));
  f.q("[data-zoom]").click();
  await flush();
  assert.equal(dialogs(f).length, 1);
  assert.equal(f.svg.closest("dialog"), dialogs(f)[0]);
});

test("pulsar el chip con el diálogo ya abierto no abre otro", async () => {
  const f = await opened();
  f.q("[data-zoom]").click();
  await flush();
  assert.equal(dialogs(f).length, 1);
});

test("Tab da la vuelta entre «Cerrar» y el dibujo, y no deja salir el foco del diálogo", async () => {
  const f = await opened();
  const box = dialogs(f)[0]!;
  const close = f.q(".isofig-zoomclose");
  const pane = f.q(".isofig-zoompane");
  pane.focus();
  assert.equal(doc.activeElement, pane);
  assert.equal(key(box, "Tab").defaultPrevented, true, "Tab desde el último elemento, el dibujo, no sale del diálogo");
  assert.equal(doc.activeElement, close, "vuelve a «Cerrar»");
  assert.equal(key(box, "Tab").defaultPrevented, false, "desde «Cerrar», Tab va al dibujo por su cuenta");
  assert.equal(key(box, "Tab", { shiftKey: true }).defaultPrevented, true, "Shift+Tab desde el primero tampoco sale");
  assert.equal(doc.activeElement, pane, "da la vuelta al dibujo");
  assert.equal(key(box, "Tab", { shiftKey: true }).defaultPrevented, false, "desde el dibujo, Shift+Tab va a «Cerrar» por su cuenta");
  assert.equal(key(box, "Enter").defaultPrevented, false, "otras teclas no se tocan");
});
