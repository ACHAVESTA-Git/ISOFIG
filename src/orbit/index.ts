import { drawScene } from "../core/scene.ts";
import type { FigureSpec } from "../core/spec.ts";
import { retarget, type OrbitHandle } from "../runtime/index.ts";

export interface OrbitOptions {
  lang?: string;
  /** Cuántos grados puede girar a cada lado del azimut de la spec. */
  range?: number;
  minElevation?: number;
  maxElevation?: number;
  /** Nombre de la copia en el DOM (ver `RenderOptions.instance`); por defecto, el que ya tiene el SVG. */
  instance?: string;
}

export type Orbit = OrbitHandle;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Deja girar una figura ya montada: al arrastrar se redibuja la escena desde otra cámara (proyección, sombras y
 * orden de pintado nuevos) y el runtime sigue animando las piezas. Se carga solo cuando el lector toca la figura.
 */
export function enableOrbit(el: HTMLElement, spec: FigureSpec, options: OrbitOptions = {}): Orbit {
  const svg = el.querySelector<SVGSVGElement>(".isofig-art")!;
  const lang = options.lang ?? "en";
  // El SVG nombra su título `<instance>-t`: al redibujar, los ids de <defs> siguen siendo los de esta copia.
  const instance = options.instance ?? svg.getAttribute("aria-labelledby")?.replace(/-t$/, "") ?? spec.id;
  const base = { az: spec.camera?.azimuth ?? 45, el: spec.camera?.elevation ?? 30 };
  const range = options.range ?? 40;
  const minEl = options.minElevation ?? 12;
  const maxEl = options.maxElevation ?? 60;
  const scale = drawScene(spec, lang).cam.scale;
  let az = base.az;
  let elv = base.el;
  let frame = 0;
  let drag: { id: number; x: number; y: number; az: number; el: number; touch: boolean } | null = null;

  const paint = () => {
    frame = 0;
    const s = drawScene(spec, lang, { azimuth: az, elevation: elv, scale, instance });
    const scene = svg.querySelector(".isofig-scene");
    if (scene) scene.outerHTML = `<g class="isofig-scene">${s.markup}</g>`;
    retarget(el, s.basis, s.spins);
  };
  const set = (a: number, e: number) => {
    const na = clamp(a, base.az - range, base.az + range);
    const ne = clamp(e, minEl, maxEl);
    if (na === az && ne === elv) return;
    az = na;
    elv = ne;
    limits();
    if (!frame) frame = requestAnimationFrame(paint);
  };
  // En el tope, el botón de ese lado avisa que ya no gira más.
  const limits = () => {
    const left = el.querySelector('[data-orbit="-20"]');
    const right = el.querySelector('[data-orbit="20"]');
    left?.setAttribute("aria-disabled", String(az <= base.az - range));
    right?.setAttribute("aria-disabled", String(az >= base.az + range));
  };
  const grab = (e: PointerEvent) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, az, el: elv, touch: e.pointerType === "touch" };
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {}
    svg.classList.add("isofig-grabbing");
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    grab(e);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (e.pointerType === "mouse" && e.buttons === 0) {
      onUp(e);
      return;
    }
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    set(drag.az - dx * 0.35, drag.touch ? drag.el : drag.el + dy * 0.25);
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    svg.classList.remove("isofig-grabbing");
  };
  svg.addEventListener("pointerdown", onDown);
  svg.addEventListener("pointermove", onMove);
  svg.addEventListener("pointerup", onUp);
  svg.addEventListener("pointercancel", onUp);

  return {
    turn: (da, de = 0) => set(az + da, elv + de),
    reset: () => set(base.az, base.el),
    grab,
    stop: () => {
      cancelAnimationFrame(frame);
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);
    },
  };
}
