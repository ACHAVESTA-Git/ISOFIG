import { drawScene } from "../core/scene.ts";
import type { FlatSpec } from "../core/spec.ts";
import { retarget, type OrbitHandle } from "../runtime/index.ts";

export interface OrbitOptions {
  lang?: string;
  /** Cuántos grados puede girar a cada lado del azimut de la spec; sin él, da la vuelta entera sin tope. */
  range?: number;
  minElevation?: number;
  maxElevation?: number;
  /** Nombre de la copia en el DOM (ver `RenderOptions.instance`); por defecto, el que ya tiene el SVG. */
  instance?: string;
}

export type Orbit = OrbitHandle;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Segundos que tarda la cámara en recorrer el 63 % de lo que le falta: el freno de la inercia y de las flechas. */
const TAU = 0.18;

/**
 * Deja girar una figura ya montada: al arrastrar se redibuja la escena desde otra cámara (proyección, sombras y
 * orden de pintado nuevos) y el runtime sigue animando las piezas. Se carga solo cuando el lector toca la figura.
 * Mientras la cámara se mueve, la escena se dibuja en borrador (piezas sin compartir, menos capas en las redondas y solo el
 * orden de pintado de la pose que se ve); al detenerse se dibuja completa. Al soltar, el giro sigue con inercia y frena;
 * con `prefers-reduced-motion` salta directo, sin inercia.
 * Recibe la spec ya armada: una anidada (`root`) se aplana al compilar con `assemble(spec)` de `isofig`, para que el
 * navegador no descargue el aplanador, el catálogo ni el validador; `<Figure orbit>` y la CLI lo hacen solos.
 */
export function enableOrbit(el: HTMLElement, spec: FlatSpec, options: OrbitOptions = {}): Orbit {
  if (spec.root) throw new Error(`isofig «${spec.id}»: el giro dibuja la spec ya armada; pásale assemble(spec) de «isofig».`);
  const svg = el.querySelector<SVGSVGElement>(".isofig-art")!;
  const lang = options.lang ?? "en";
  // El SVG nombra su título `<instance>-t`: al redibujar, los ids de <defs> siguen siendo los de esta copia.
  const instance = options.instance ?? svg.getAttribute("aria-labelledby")?.replace(/-t$/, "") ?? spec.id;
  const base = { az: spec.camera?.azimuth ?? 45, el: spec.camera?.elevation ?? 30 };
  const range = options.range ?? Infinity;
  const minEl = options.minElevation ?? 12;
  const maxEl = options.maxElevation ?? 60;
  // La escala de la vista inicial es el tope: desde otro ángulo la figura se achica lo justo para caber.
  const scale = drawScene(spec, lang, { draft: true, pose: 0 }).cam.scale;
  const param = spec.reorder?.param;
  // Lo que se ve (az, elv), a dónde va (ga, ge) y hasta cuándo el lector acaba de mover un control (poses completas).
  let az = base.az;
  let elv = base.el;
  let ga = az;
  let ge = elv;
  let frame = 0;
  let last = 0;
  let calm = 0;
  let rough = false;
  let drag: { id: number; x: number; y: number; a: number; e: number; touch: boolean; p: number; v: number; t: number } | null = null;
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Con qué valor dejó el lector el parámetro del despiece: de él sale la única pose que hace falta pintar. */
  const posed = () => {
    const input = param && performance.now() > calm ? el.querySelector<HTMLInputElement>(`input[data-param="${param}"]:is([type=range],:checked)`) : null;
    return input && Number.isFinite(+input.value) ? +input.value : undefined;
  };
  const paint = (draft: boolean) => {
    const s = drawScene(spec, lang, { azimuth: az, elevation: elv, scale, instance, ...(draft ? { draft, pose: posed() } : {}) });
    const scene = svg.querySelector(".isofig-scene");
    if (scene) scene.outerHTML = `<g class="isofig-scene">${s.markup}</g>`;
    retarget(el, s.basis, s.spins, s.reorder);
  };
  const tick = () => {
    frame = 0;
    const now = performance.now();
    const dt = Math.max(Math.min((now - last) / 1000, 0.1), 1e-3);
    last = now;
    if (drag) {
      drag.v = drag.v * 0.5 + ((az - drag.p) / dt) * 0.5;
      drag.p = az;
    } else {
      const k = 1 - Math.exp(-dt / TAU);
      az += (ga - az) * k;
      elv += (ge - elv) * k;
      if (Math.abs(ga - az) + Math.abs(ge - elv) < 0.2) [az, elv] = [ga, ge];
    }
    paint((rough = Boolean(drag) || az !== ga || elv !== ge));
    if (rough && !drag) frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };
  const go = (a: number, e: number, jump?: boolean) => {
    const na = clamp(a, base.az - range, base.az + range);
    const ne = clamp(e, minEl, maxEl);
    if (na === ga && ne === ge) return;
    ga = na;
    ge = ne;
    if (jump || still()) [az, elv] = [ga, ge];
    limits();
    wake();
  };
  // Con un tope (`range`), el botón de ese lado avisa que ya no gira más.
  const limits = () => {
    if (range === Infinity) return;
    el.querySelector('[data-orbit="-20"]')?.setAttribute("aria-disabled", String(ga <= base.az - range));
    el.querySelector('[data-orbit="20"]')?.setAttribute("aria-disabled", String(ga >= base.az + range));
  };
  const grab = (e: PointerEvent) => {
    [ga, ge] = [az, elv];
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, a: az, e: elv, touch: e.pointerType === "touch", p: az, v: 0, t: 0 };
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
    drag.t = performance.now();
    go(drag.a - (e.clientX - drag.x) * 0.35, drag.touch ? drag.e : drag.e + (e.clientY - drag.y) * 0.25, true);
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    // Si el puntero llevaba un rato quieto no hay lanzamiento; si no, el giro sigue con la velocidad que traía y frena.
    const fling = !still() && performance.now() - drag.t < 90 ? clamp(drag.v, -720, 720) * TAU : 0;
    drag = null;
    svg.classList.remove("isofig-grabbing");
    go(az + fling, elv);
    if (rough) wake();
  };
  // Un control movido: mientras el runtime anima el despiece pasa por poses que el borrador no calculó.
  const settle = () => (calm = performance.now() + 1200);
  svg.addEventListener("pointerdown", onDown);
  svg.addEventListener("pointermove", onMove);
  svg.addEventListener("pointerup", onUp);
  svg.addEventListener("pointercancel", onUp);
  el.addEventListener("input", settle);

  return {
    turn: (da, de = 0) => go(ga + da, ge + de),
    reset: () => go(base.az + 360 * Math.round((ga - base.az) / 360), base.el),
    grab,
    stop: () => {
      cancelAnimationFrame(frame);
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);
      el.removeEventListener("input", settle);
    },
  };
}
