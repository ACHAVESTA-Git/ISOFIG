// Un navegador de mentira para probar el runtime, el zoom, el giro y el cargador de Astro: happy-dom para el DOM y,
// en lugar de sus temporizadores, un reloj que mueven las pruebas (setTimeout, requestAnimationFrame, performance.now,
// matchMedia y IntersectionObserver). Se instala al importar el módulo, así que va primero en cada archivo de prueba.
import { Window } from "happy-dom";
import assert from "node:assert/strict";
import { renderFigure, type RenderOptions } from "../src/core/render.ts";
import type { FigureSpec } from "../src/core/spec.ts";
import type { FigureData, Model } from "../src/runtime/index.ts";

export const win = new Window({ url: "http://localhost/", width: 1280, height: 800, settings: { disableJavaScriptEvaluation: true } });
export const doc = win.document as unknown as Document;
const g = globalThis as Record<string, unknown>;

// El reloj ------------------------------------------------------------------------------------------------------

interface Timer {
  at: number;
  fn: () => void;
}

class Clock {
  now = 1000;
  private timers = new Map<number, Timer>();
  private queue = new Map<number, FrameRequestCallback>();
  private next = 1;

  readonly setTimeout = (fn: () => void, ms = 0): number => {
    const id = this.next++;
    this.timers.set(id, { at: this.now + Math.max(0, ms), fn });
    return id;
  };
  readonly clearTimeout = (id?: number): void => void (id !== undefined && this.timers.delete(id));
  readonly requestAnimationFrame = (fn: FrameRequestCallback): number => {
    const id = this.next++;
    this.queue.set(id, fn);
    return id;
  };
  readonly cancelAnimationFrame = (id?: number): void => void (id !== undefined && this.queue.delete(id));

  /** Temporizadores y cuadros que esperan. */
  get pending(): { timers: number; frames: number } {
    return { timers: this.timers.size, frames: this.queue.size };
  }

  /** Deja pasar `ms` milisegundos y dispara, en orden, los temporizadores que vencen (también los que ellos programen). */
  advance(ms: number): void {
    const end = this.now + ms;
    for (;;) {
      let first: [number, Timer] | undefined;
      for (const entry of this.timers) if (entry[1].at <= end && (!first || entry[1].at < first[1].at)) first = entry;
      if (!first) break;
      this.timers.delete(first[0]);
      this.now = Math.max(this.now, first[1].at);
      first[1].fn();
    }
    this.now = end;
  }

  /** Un cuadro de animación: pasa `ms` y corre los callbacks de requestAnimationFrame que esperaban. */
  frame(ms = 16): void {
    this.advance(ms);
    const run = [...this.queue.values()];
    this.queue.clear();
    for (const fn of run) fn(this.now);
  }

  /** `n` cuadros seguidos, o los que quepan en `ms` milisegundos si se pasa `{ ms }`. */
  run(n: number | { ms: number }, step = 16): void {
    const count = typeof n === "number" ? n : Math.ceil(n.ms / step);
    for (let i = 0; i < count; i++) this.frame(step);
  }

  reset(): void {
    this.timers.clear();
    this.queue.clear();
    this.now = 1000;
  }
}

export const clock = new Clock();

/** `prefers-reduced-motion`, que la prueba cambia en vivo. */
export const motion = {
  reduced: false,
  listeners: new Set<() => void>(),
  set(value: boolean) {
    this.reduced = value;
    for (const fn of [...this.listeners]) fn();
  },
};

/** Los observadores de visibilidad: la figura está a la vista salvo que la prueba diga otra cosa. */
class FakeObserver {
  static all = new Set<FakeObserver>();
  static hidden = new WeakSet<object>();
  readonly targets = new Set<Element>();
  private cb: (entries: { isIntersecting: boolean; target: Element }[]) => void;
  constructor(cb: (entries: { isIntersecting: boolean; target: Element }[]) => void) {
    this.cb = cb;
    FakeObserver.all.add(this);
  }
  observe(el: Element) {
    this.targets.add(el);
    this.notify(el);
  }
  disconnect() {
    FakeObserver.all.delete(this);
    this.targets.clear();
  }
  notify(el: Element) {
    this.cb([{ isIntersecting: !FakeObserver.hidden.has(el), target: el }]);
  }
}

/** Cambia si el observador ve la figura y avisa a quien la mira. */
export function setVisible(el: Element, visible: boolean): void {
  if (visible) FakeObserver.hidden.delete(el);
  else FakeObserver.hidden.add(el);
  for (const o of FakeObserver.all) if (o.targets.has(el)) o.notify(el);
}

/** Cuántos observadores de visibilidad siguen activos (una figura detenida debe soltar el suyo). */
export const observers = (): number => FakeObserver.all.size;

function matchMedia(query: string) {
  const reduce = /prefers-reduced-motion\s*:\s*reduce/.test(query);
  return {
    media: query,
    get matches() {
      return reduce && motion.reduced;
    },
    addEventListener: (_type: string, fn: () => void) => void (reduce && motion.listeners.add(fn)),
    removeEventListener: (_type: string, fn: () => void) => void motion.listeners.delete(fn),
  };
}

Object.assign(g, {
  window: win,
  document: doc,
  setTimeout: clock.setTimeout,
  clearTimeout: clock.clearTimeout,
  requestAnimationFrame: clock.requestAnimationFrame,
  cancelAnimationFrame: clock.cancelAnimationFrame,
  requestIdleCallback: (fn: () => void, options?: { timeout?: number }) => clock.setTimeout(fn, options?.timeout ?? 50),
  cancelIdleCallback: clock.clearTimeout,
  matchMedia,
  IntersectionObserver: FakeObserver,
  CSS: win.CSS,
});
Object.assign(win, {
  setTimeout: clock.setTimeout,
  clearTimeout: clock.clearTimeout,
  requestAnimationFrame: clock.requestAnimationFrame,
  cancelAnimationFrame: clock.cancelAnimationFrame,
  matchMedia,
  IntersectionObserver: FakeObserver,
});
Object.defineProperty(globalThis.performance, "now", { value: () => clock.now, configurable: true });

// happy-dom no trae `transform.baseVal.consolidate()`, que el zoom usa para medir los rótulos: se lee del atributo.
Object.defineProperty(win.SVGGraphicsElement.prototype, "transform", {
  configurable: true,
  get(this: Element) {
    const m = /matrix\(([^)]*)\)/.exec(this.getAttribute("transform") ?? "");
    const [a, b, c, d, e, f] = m ? m[1]!.trim().split(/[\s,]+/).map(Number) : [1, 0, 0, 1, 0, 0];
    return { baseVal: { consolidate: () => ({ matrix: { a, b, c, d, e, f } }) } };
  },
});

/** Una espera de verdad (las promesas pendientes, como el `import()` del zoom), sin pasar por el reloj de mentira. */
export const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

// Eventos --------------------------------------------------------------------------------------------------------

/** Cambia un control como lo haría el lector y avisa con el evento `input`. */
export function setControl(input: HTMLInputElement, value: number): void {
  if (input.type === "checkbox" || input.type === "radio") input.checked = Boolean(value);
  else input.value = String(value);
  input.dispatchEvent(new win.Event("input", { bubbles: true }) as unknown as Event);
}

export function pointer(target: Element, type: string, init: Record<string, unknown> = {}): Event {
  const e = new win.PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: type === "pointermove" || type === "pointerdown" ? 1 : 0, ...init });
  target.dispatchEvent(e as unknown as Event);
  return e as unknown as Event;
}

export function key(target: Element, name: string, init: Record<string, unknown> = {}): Event {
  const e = new win.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e as unknown as Event);
  return e as unknown as Event;
}

/** Esc con un diálogo modal abierto: el navegador pide cerrarlo (`cancel`) y, si nadie lo impide, lo cierra. */
export function pressEscape(): void {
  const open = [...doc.querySelectorAll("dialog[open]")] as HTMLDialogElement[];
  const dialog = open[open.length - 1];
  const e = key(dialog ?? doc.body, "Escape");
  if (!dialog || e.defaultPrevented) return;
  const cancel = new win.Event("cancel", { cancelable: true });
  dialog.dispatchEvent(cancel as unknown as Event);
  if (!cancel.defaultPrevented) dialog.close();
}

// Figuras -------------------------------------------------------------------------------------------------------

/** Una figura con un control de cada clase, dos desvíos, un grupo que se mueve y un rótulo. */
export function demoSpec(extra: Partial<FigureSpec> = {}): FigureSpec {
  return {
    id: "demo",
    title: "Demo",
    alt: "A demo machine",
    model: "demo",
    autoplay: true,
    readout: "rate {rate}",
    parts: [
      { id: "base", kind: "box", at: [0, 0, 0], size: [120, 70, 6], tone: "lo" },
      { id: "bar", kind: "box", at: [10, 10, 6], size: [20, 20, 10], tone: "hi", group: "bar" },
      { id: "tag", kind: "label", on: "base", at: [10, 60, 6], text: "Demo", face: "top", size: 8 },
    ],
    groups: { bar: { extent: [[0, 0, 0], [60, 0, 0]] } },
    params: [
      { id: "rate", label: "Rate", min: 0, max: 10, value: 2, unit: "req/s", spoken: "requests per second" },
      { id: "on", label: "Enabled", kind: "toggle", min: 0, max: 1, value: 0 },
      { id: "mode", label: "Mode", kind: "choice", min: 0, max: 2, value: 0, options: ["A", "B", "C"] },
      { id: "kick", label: "Kick", kind: "action", min: 0, max: 100, value: 0 },
    ],
    presets: [
      { label: "Overload", values: { rate: 8 }, note: "Look at the bar", press: ["kick"] },
      { label: "Calm", values: { rate: 1 }, note: "Calm again", reset: true },
    ],
    ...extra,
  };
}

/** Un modelo mínimo: el grupo `bar` de `demoSpec` va a `rate × 5`. */
export const slide: Model<null, any> = { init: () => null, view: (_s, p) => ({ groups: { bar: { t: [p["rate"] * 5, 0, 0] } } }) };

export interface Built {
  el: HTMLElement;
  host: HTMLElement;
  spec: FigureSpec;
  data: FigureData;
  svg: SVGSVGElement;
  q<T extends Element = HTMLElement>(selector: string): T;
  all<T extends Element = HTMLElement>(selector: string): T[];
  /** El control `data-param` de ese id (el primero, si es un grupo de radios). */
  control(id: string): HTMLInputElement;
  /** El botón que fija el desvío `k`. */
  preset(k: number): HTMLElement;
  /** La transformación esperada de un grupo desplazado `x` en el eje x del mundo, con la cámara de `basis`. */
  translate(x: number, basis?: number[]): string;
}

/** Dibuja la spec con `renderFigure` y la pone en la página (todavía sin montar). */
export function build(spec: FigureSpec, options: RenderOptions = {}): Built {
  const r = renderFigure(spec, { lang: "en", ...options });
  assert.deepEqual(r.errors, [], "la figura de prueba no se dibuja sin errores");
  const host = doc.createElement("div");
  host.innerHTML = r.html;
  doc.body.append(host);
  const el = host.querySelector<HTMLElement>("[data-isofig]")!;
  const q = <T extends Element = HTMLElement>(selector: string) => {
    const found = el.querySelector<T>(selector);
    assert.ok(found, `no hay ${selector} en la figura`);
    return found;
  };
  return {
    el,
    host,
    spec,
    data: r.data as FigureData,
    svg: q<SVGSVGElement>(".isofig-art"),
    q,
    all: <T extends Element = HTMLElement>(selector: string) => [...el.querySelectorAll<T>(selector)],
    control: (id) => q<HTMLInputElement>(`input[data-param="${id}"], button[data-param="${id}"]`),
    preset: (k) => q(`[data-preset="${k}"]`),
    translate(x, b = (r.data as FigureData).basis) {
      return `translate(${(b[0]! * x).toFixed(2)} ${(b[3]! * x).toFixed(2)})`;
    },
  };
}

/** Deja la página y el reloj como estaban, para la prueba siguiente del mismo archivo. */
export function cleanUp(): void {
  doc.body.innerHTML = "";
  clock.reset();
  motion.reduced = false;
  motion.listeners.clear();
}
