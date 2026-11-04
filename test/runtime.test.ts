import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { mount, mountAll, unmountAll, zoomOnDemand, type FigureData, type Model } from "../src/runtime/index.ts";

// Un DOM mínimo: lo justo para que el runtime monte una figura sin piezas y se le puedan mandar eventos.
let reduced = false;
let onMotion: (() => void) | undefined;
let frames: FrameRequestCallback[] = [];
const g = globalThis as Record<string, unknown>;
g["window"] = globalThis;
g["matchMedia"] = () => ({
  get matches() {
    return reduced;
  },
  addEventListener: (_: string, fn: () => void) => (onMotion = fn),
  removeEventListener: () => (onMotion = undefined),
});
// La figura está siempre a la vista.
g["IntersectionObserver"] = class {
  cb: (entries: { isIntersecting: boolean }[]) => void;
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    this.cb = cb;
  }
  observe() {
    this.cb([{ isIntersecting: true }]);
  }
  disconnect() {}
};
g["requestAnimationFrame"] = (fn: FrameRequestCallback) => frames.push(fn);
g["cancelAnimationFrame"] = () => {};

const data = (extra: Partial<FigureData> = {}): FigureData => ({
  id: "f",
  model: "m",
  autoplay: true,
  tau: 0.18,
  basis: [1, 0, 0, 0, 1, 0],
  spins: {},
  params: [
    { id: "x", value: 1, unit: "", spoken: "" },
    { id: "go", value: 0, unit: "", spoken: "" },
  ],
  readout: "",
  lang: "es",
  ...extra,
});

function figure(d: FigureData, parts: Record<string, unknown> = {}) {
  const on: Record<string, (e: unknown) => void> = {};
  const chip = { hidden: true };
  const el = {
    dataset: {} as Record<string, string>,
    isConnected: true,
    querySelector: (s: string) => (s === "[data-zoom]" ? chip : s === ".isofig-data" ? { textContent: JSON.stringify(d) } : parts[s] ?? null),
    querySelectorAll: () => [],
    addEventListener: (type: string, fn: (e: unknown) => void) => (on[type] = fn),
    removeEventListener: () => {},
  };
  const target = (match: Record<string, unknown>) => ({ closest: (s: string) => match[s] ?? null });
  return {
    el: el as unknown as HTMLElement,
    chip,
    input: (id: string, value: number) => on["input"]!({ target: { dataset: { param: id }, type: "range", value: String(value) } }),
    press: (id: string) => on["click"]!({ target: target({ "[data-action]": { dataset: { param: id } } }) }),
    preset: (k: number) => on["click"]!({ target: target({ "[data-preset]": { dataset: { preset: String(k) } } }) }),
    zoom: () => on["click"]!({ target: target({ "[data-zoom]": chip }) }),
  };
}

/** Un modelo que anota qué vio en cada paso y cuánto tiempo simuló. */
function spy() {
  const seen: string[] = [];
  const model: Model<{ t: number }, { x: number; go: number }> = {
    init: () => ({ t: 0 }),
    step(s, dt, p, ctx) {
      if (ctx.pressed("go")) seen.push(`pressed go=${p.go}`);
      if (ctx.changed("x")) seen.push(`changed x=${p.x}`);
      s.t += dt;
    },
    view: (s) => ({ readout: s.t.toFixed(2) }),
  };
  return { seen, model };
}

const tick = (now: number) => {
  const run = frames;
  frames = [];
  for (const fn of run) fn(now);
};

test("pressed y changed valen solo en el paso siguiente a la pulsación o al cambio", () => {
  reduced = false;
  const { seen, model } = spy();
  const f = figure(data());
  const stop = mount(f.el, model, data());
  tick(0);
  f.press("go");
  f.input("x", 3);
  tick(16);
  tick(32);
  assert.deepEqual(seen, ["pressed go=1", "changed x=3"]);
  stop();
});

test("un desvío fija valores, reinicia y luego pulsa: el modelo ve las dos cosas en su primer paso", () => {
  reduced = false;
  const { seen, model } = spy();
  const d = data({ presets: [{ values: { x: 5 }, note: "n", reset: true, press: ["go"] }, { values: { x: 1 }, note: "n" }] });
  const f = figure(d);
  const stop = mount(f.el, model, d);
  f.preset(0);
  f.preset(1);
  tick(0);
  f.preset(1);
  tick(16);
  // El segundo desvío vuelve a x = 1; el tercero no cambia nada y no marca nada.
  assert.deepEqual(seen, ["pressed go=1", "changed x=1"]);
  stop();
});

test("con movimiento reducido, settle simula de golpe al montar y tras cada control", () => {
  reduced = true;
  const { seen, model } = spy();
  let state = "";
  const d = data({ settle: 2 });
  const f = figure(d);
  const stop = mount(f.el, { ...model, view: (s, p, c) => ((state = s.t.toFixed(2)), model.view(s, p, c)) }, d);
  tick(0);
  assert.equal(state, "2.00");
  f.input("x", 4);
  f.press("go");
  tick(16);
  assert.equal(state, "6.00");
  assert.deepEqual(seen, ["changed x=4", "pressed go=1"]);
  stop();
});

test("al quitar el movimiento reducido en vivo, la figura vuelve a correr", () => {
  reduced = true;
  const { model } = spy();
  let state = 0;
  const f = figure(data());
  const stop = mount(f.el, { ...model, view: (s, p, c) => ((state = s.t), model.view(s, p, c)) }, data());
  tick(0);
  tick(16);
  assert.equal(state, 0);
  reduced = false;
  onMotion!();
  tick(32);
  tick(48);
  assert.ok(state > 0);
  stop();
  assert.equal(onMotion, undefined);
});

test("unmountAll borra la marca para que una figura persistente vuelva a montarse", () => {
  reduced = false;
  const f = figure(data({ model: undefined }));
  const root = { querySelectorAll: () => [f.el] } as unknown as ParentNode;
  mountAll(root);
  assert.equal(f.el.dataset["isofigLive"], "");
  unmountAll();
  assert.equal("isofigLive" in f.el.dataset, false);
});

test("el chip «Ampliar» aparece solo con un cargador y abre isofig/zoom sobre su figura", async () => {
  reduced = false;
  const sinCargador = figure(data());
  mount(sinCargador.el, spy().model, data())();
  assert.equal(sinCargador.chip.hidden, true);
  const opened: HTMLElement[] = [];
  zoomOnDemand(async () => ({ openZoom: (el) => void opened.push(el) }));
  const f = figure(data());
  const stop = mount(f.el, spy().model, data());
  assert.equal(f.chip.hidden, false);
  f.zoom();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(opened, [f.el]);
  stop();
});

test("ctx.say se anuncia una vez: si el eco de la lectura lo pisa, llega después y no se repite", () => {
  reduced = false;
  mock.timers.enable({ apis: ["setTimeout"] });
  const said: string[] = [];
  const f = figure(data(), {
    ".isofig-readout": { textContent: "" },
    ".isofig-say": { set textContent(v: string) { said.push(v); } },
  });
  const model: Model<{ t: number }, { x: number; go: number }> = {
    init: () => ({ t: 0 }),
    step(s, dt, _p, ctx) {
      if (ctx.pressed("go")) ctx.say("se cayó la base");
      s.t += dt;
    },
    view: () => ({ readout: "lectura" }),
  };
  const stop = mount(f.el, model, data());
  tick(0);
  f.input("x", 2);
  f.press("go");
  tick(16);
  mock.timers.tick(1200);
  for (let i = 1; i < 120; i++) tick(16 + i * 16);
  mock.timers.tick(1500);
  for (let i = 0; i < 120; i++) tick(2000 + i * 16);
  mock.timers.tick(5000);
  assert.deepEqual(said, ["lectura", "se cayó la base"]);
  stop();
  mock.timers.reset();
});
