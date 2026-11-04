import { test } from "node:test";
import assert from "node:assert/strict";
import { mount, type FigureData, type Model } from "../src/runtime/index.ts";

// Un DOM mínimo con grupos y una escena cuyos hijos se pueden reordenar; con movimiento reducido, cada cuadro llega.
let frames: FrameRequestCallback[] = [];
const g = globalThis as Record<string, unknown>;
g["window"] = globalThis;
g["matchMedia"] = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
g["IntersectionObserver"] = class {
  cb: (e: { isIntersecting: boolean }[]) => void;
  constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
    this.cb = cb;
  }
  observe() {
    this.cb([{ isIntersecting: true }]);
  }
  disconnect() {}
};
g["requestAnimationFrame"] = (fn: FrameRequestCallback) => frames.push(fn);
g["cancelAnimationFrame"] = () => {};

function piece(name: string) {
  const attrs: Record<string, string> = {};
  return {
    name,
    dataset: { g: name } as Record<string, string>,
    style: {} as Record<string, string>,
    attrs,
    getAttribute: (k: string) => attrs[k] ?? null,
    setAttribute: (k: string, v: string) => void (attrs[k] = v),
    removeAttribute: (k: string) => void delete attrs[k],
  };
}

function figure(d: FigureData, names: string[]) {
  const pieces = names.map(piece);
  const kids = [...pieces];
  const scene = {
    kids,
    querySelectorAll: () => [...pieces],
    append(n: (typeof pieces)[number]) {
      kids.splice(kids.indexOf(n), 1);
      kids.push(n);
    },
    insertBefore(n: (typeof pieces)[number], ref: (typeof pieces)[number] | null) {
      kids.splice(kids.indexOf(n), 1);
      kids.splice(ref ? kids.indexOf(ref) : kids.length, 0, n);
    },
  };
  const readout = { textContent: "" };
  const on: Record<string, (e: unknown) => void> = {};
  const el = {
    dataset: {} as Record<string, string>,
    isConnected: true,
    querySelector: (s: string) => (s === ".isofig-scene" ? scene : s === ".isofig-readout" ? readout : null),
    querySelectorAll: (s: string) => (s === "[data-g]" ? pieces : []),
    addEventListener: (type: string, fn: (e: unknown) => void) => (on[type] = fn),
    removeEventListener: () => {},
  };
  return {
    el: el as unknown as HTMLElement,
    scene,
    readout,
    get: (n: string) => pieces.find((p) => p.name === n)!,
    input: (id: string, value: number, type = "range") => on["input"]!({ target: { dataset: { param: id }, type, value: String(value), checked: true } }),
  };
}

const tick = () => {
  const now = frames;
  frames = [];
  for (const f of now) f(performance.now());
};

const data = (extra: Partial<FigureData>): FigureData => ({
  id: "f",
  autoplay: false,
  tau: 0.18,
  basis: [1, 0, 0, 0, 1, 0],
  spins: {},
  params: [],
  readout: "",
  lang: "es",
  ...extra,
});

test("varios bind al mismo grupo se suman, cada uno en su ventana, y la elección atenúa lo que no es la pieza", () => {
  const d = data({
    params: [
      { id: "explode", value: 0, unit: "", spoken: "", texts: ["Armado", "Paso 1 de 2: perilla", "Paso 2 de 2: tapa"] },
      { id: "pick", value: 0, unit: "", spoken: "", texts: ["{explode}", "Tapa · cierra la caja"] },
    ],
    bind: [
      { group: "tapa", param: "explode", move: [0, 0, 30], win: [1, 2] },
      { group: "perilla", param: "explode", move: [0, 0, 30], win: [1, 2] },
      { group: "perilla", param: "explode", move: [0, 0, 20], win: [0, 1] },
      { group: "tapa", param: "pick", keep: [1] },
      { group: "perilla", param: "pick", keep: [1] },
      { group: "base", param: "pick", keep: [] },
    ],
    readout: "{pick}",
  });
  const f = figure(d, ["base", "tapa", "perilla"]);
  mount(f.el, undefined, d);
  tick();
  assert.equal(f.readout.textContent, "Armado");
  f.input("explode", 1);
  tick();
  assert.equal(f.readout.textContent, "Paso 1 de 2: perilla");
  f.input("explode", 1.5);
  tick();
  f.input("pick", 1, "radio");
  tick();
  assert.equal(f.readout.textContent, "Tapa · cierra la caja");
  assert.equal(f.get("base").attrs["opacity"], "0.200");
  assert.equal(f.get("tapa").attrs["opacity"], "1");
});

test("los movimientos de dos ventanas se suman en el grupo", () => {
  const d = data({
    basis: [1, 0, 0, 0, 1, 0],
    params: [{ id: "explode", value: 0, unit: "", spoken: "" }],
    bind: [
      { group: "perilla", param: "explode", move: [30, 0, 0], win: [1, 2] },
      { group: "perilla", param: "explode", move: [20, 0, 0], win: [0, 1] },
    ],
    readout: "",
  });
  const f = figure(d, ["perilla"]);
  mount(f.el, undefined, d);
  tick();
  f.input("explode", 0.5);
  tick();
  assert.equal(f.get("perilla").attrs["transform"], "translate(10.00 0.00)");
  f.input("explode", 1.5);
  tick();
  assert.equal(f.get("perilla").attrs["transform"], "translate(35.00 0.00)");
});

test("el modelo sigue moviendo su grupo y los bind se le suman", () => {
  const d = data({
    model: "m",
    params: [{ id: "explode", value: 1, unit: "", spoken: "" }],
    bind: [{ group: "rueda", param: "explode", move: [5, 0, 0] }],
    readout: "",
  });
  const model: Model<null> = { init: () => null, view: () => ({ groups: { rueda: { t: [0, 7, 0] } }, readout: "del modelo" }) };
  const f = figure(d, ["rueda"]);
  mount(f.el, model, d);
  tick();
  assert.equal(f.get("rueda").attrs["transform"], "translate(5.00 7.00)");
  assert.equal(f.readout.textContent, "del modelo");
});

test("al cruzar el umbral de una pose, el runtime reordena las piezas; al volver, recupera el orden en reposo", () => {
  const d = data({
    params: [{ id: "explode", value: 0, unit: "", spoken: "" }],
    // En la pose 1, la pieza 0 pasa al final y la 2 antes que la 1.
    reorder: { param: "explode", poses: [[1, 0, -1, 2, 1]] },
    readout: "",
  });
  const f = figure(d, ["a", "b", "c"]);
  mount(f.el, undefined, d);
  tick();
  assert.deepEqual(f.scene.kids.map((k) => k.name), ["a", "b", "c"]);
  f.input("explode", 1);
  tick();
  assert.deepEqual(f.scene.kids.map((k) => k.name), ["c", "b", "a"]);
  f.input("explode", 0);
  tick();
  assert.deepEqual(f.scene.kids.map((k) => k.name), ["a", "b", "c"]);
});
