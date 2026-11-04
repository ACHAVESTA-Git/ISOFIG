import { test } from "node:test";
import assert from "node:assert/strict";
import { mount, type FigureData } from "../src/runtime/index.ts";
import { renderFigure } from "../src/core/render.ts";
import { trackData } from "../src/core/tracks.ts";
import type { FigureSpec } from "../src/core/spec.ts";

// Un DOM mínimo con una pieza en el grupo «p»: lo justo para ver dónde la deja el runtime.
let reduced = false;
let frames: FrameRequestCallback[] = [];
const g = globalThis as Record<string, unknown>;
g["window"] = globalThis;
g["matchMedia"] = () => ({ get matches() { return reduced; }, addEventListener() {}, removeEventListener() {} });
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

/** Monta una figura con un recorrido, avanza `seconds` y devuelve cómo quedó la pieza. */
function run(spec: { tracks: NonNullable<FigureSpec["tracks"]> }, seconds: number, opts: { reduced?: boolean } = {}) {
  reduced = opts.reduced ?? false;
  const node = {
    dataset: { g: "p" } as Record<string, string>,
    attrs: {} as Record<string, string>,
    style: { visibility: "" },
    getAttribute(k: string) { return this.attrs[k] ?? null; },
    setAttribute(k: string, v: string) { this.attrs[k] = v; },
    removeAttribute(k: string) { delete this.attrs[k]; },
  };
  const t = trackData(spec.tracks);
  const d: FigureData = { id: "f", autoplay: true, tau: 0.18, basis: [1, 0, 0, 0, 1, 0], spins: {}, params: [], readout: "", lang: "es", tracks: t.data, rest: t.rest };
  const el = {
    dataset: { isofigAdvance: String(seconds) } as Record<string, string>,
    isConnected: true,
    querySelector: () => null,
    querySelectorAll: (s: string) => (s === "[data-g]" ? [node] : []),
    addEventListener() {},
    removeEventListener() {},
  };
  frames = [];
  const stop = mount(el as unknown as HTMLElement, undefined, d);
  for (const fn of frames.splice(0)) fn(0);
  stop();
  const tf = node.attrs["transform"] ?? "";
  const x = Number(/translate\(([-\d.]+)/.exec(tf)?.[1] ?? 0);
  return { x, opacity: Number(node.attrs["opacity"] ?? 1), hidden: node.style.visibility === "hidden" };
}

test("trackData guarda cada punto relativo al primero, con la fracción de arco acumulada", () => {
  const t = trackData([{ group: "p", path: [[10, 0, 0], [10, 30, 0], [10, 30, 10]], period: 4 }]);
  assert.deepEqual(t.data[0].p, [[0, 0, 0, 0], [0, 30, 0, 0.75], [0, 30, 10, 1]]);
  assert.equal(t.data[0].T, 4);
  assert.equal(t.data[0].d, undefined);
});

test("trackData descarta lo que no puede recorrerse y quita los puntos repetidos", () => {
  const t = trackData([
    { group: "a", path: [[0, 0, 0], [0, 0, 0]], period: 3 },
    { group: "b", path: [[0, 0, 0], [5, 0, 0]], period: 0 },
    { group: "c", path: [[0, 0, 0], [0, 0, 0], [5, 0, 0]], period: 2, delay: -1, loop: false },
  ]);
  assert.deepEqual(t.data.map((x) => x.g), ["c"]);
  assert.equal(t.data[0].p.length, 2);
  assert.equal(t.data[0].l, 0);
  assert.equal(t.data[0].d, undefined);
});

test("con movimiento reducido el reloj queda a mitad del recorrido más corto, pasada la espera mayor", () => {
  const t = trackData([
    { group: "a", path: [[0, 0, 0], [9, 0, 0]], period: 8 },
    { group: "b", path: [[0, 0, 0], [9, 0, 0]], period: 6, delay: 2 },
  ]);
  assert.equal(t.rest, 5);
});

test("el grupo avanza por el arco a velocidad constante y vuelve a empezar", () => {
  const spec = { tracks: [{ group: "p", path: [[0, 0, 0], [100, 0, 0]] as [number, number, number][], period: 10 }] };
  assert.equal(run(spec, 5).x, 50);
  assert.equal(run(spec, 12).x, 20);
  const bent = { tracks: [{ group: "p", path: [[0, 0, 0], [30, 0, 0], [30, 70, 0]] as [number, number, number][], period: 10 }] };
  // La esquina está a 3/10 del arco: a los 3 s ya dobló y a los 6 s va a mitad del segundo tramo.
  assert.equal(run(bent, 3).x, 30);
  assert.equal(run(bent, 6).x, 30);
});

test("espera su delay y, sin bucle, se queda al final", () => {
  const path = [[0, 0, 0], [100, 0, 0]] as [number, number, number][];
  assert.equal(run({ tracks: [{ group: "p", path, period: 10, delay: 4 }] }, 2).hidden, true);
  assert.equal(run({ tracks: [{ group: "p", path, period: 10, delay: 4 }] }, 9).x, 50);
  const once = run({ tracks: [{ group: "p", path, period: 10, loop: false }] }, 25);
  assert.equal(once.x, 100);
  assert.equal(once.hidden, false);
});

test("aparece y se apaga en los extremos y desaparece en los tramos que se esconden", () => {
  const path = [[0, 0, 0], [100, 0, 0]] as [number, number, number][];
  assert.equal(run({ tracks: [{ group: "p", path, period: 10 }] }, 0.05).opacity < 0.5, true);
  assert.equal(run({ tracks: [{ group: "p", path, period: 10 }] }, 5).opacity, 1);
  assert.equal(run({ tracks: [{ group: "p", path, period: 10, hide: [[0.4, 0.6]] }] }, 5).hidden, true);
  assert.equal(run({ tracks: [{ group: "p", path, period: 10, hide: [[0.4, 0.6]] }] }, 7).hidden, false);
});

test("con movimiento reducido se queda quieto a mitad de camino y a la vista", () => {
  const path = [[0, 0, 0], [100, 0, 0]] as [number, number, number][];
  const r = run({ tracks: [{ group: "p", path, period: 10 }] }, 0, { reduced: true });
  assert.equal(r.x, 50);
  assert.equal(r.opacity, 1);
});

test("renderFigure lleva los recorridos al runtime, arranca solo y avisa si el grupo no existe", () => {
  const spec: FigureSpec = {
    id: "mover",
    title: "t",
    parts: [{ id: "a", kind: "box", at: [0, 0, 0], size: [6, 6, 6], group: "paquete" }],
    tracks: [
      { group: "paquete", path: [[0, 0, 0], [0, 40, 0]], period: 5 },
      { group: "fantasma", path: [[0, 0, 0], [0, 40, 0]], period: 5 },
    ],
  };
  const r = renderFigure(spec, { lang: "es" });
  assert.equal(r.data.autoplay, true);
  assert.equal(r.data.tracks?.length, 2);
  assert.match(r.html, /isofig-play/);
  assert.ok(r.issues.some((i) => i.code === "track-group-unknown" && /fantasma/.test(i.message)));
  assert.ok(!r.issues.some((i) => i.code === "track-group-unknown" && /paquete/.test(i.message)));
});
