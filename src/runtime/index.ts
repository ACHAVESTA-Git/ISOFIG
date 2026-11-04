export type Params = Record<string, number>;

export interface Ctx {
  lang: string;
  /** Se actualiza si el lector cambia la preferencia del sistema con la figura montada. */
  reducedMotion: boolean;
  /**
   * Anuncia un evento a los lectores de pantalla («saltó el breaker») en el momento en que pasa. El runtime decide
   * cuándo hablar con las mismas reglas que `view.say`, así que el modelo no guarda lo que ya dijo.
   */
  say(text: string): void;
  /** Verdadero durante el paso siguiente a pulsar la acción `id` (su botón o un desvío con `press`). */
  pressed(id: string): boolean;
  /** Verdadero durante el paso siguiente a cambiar el parámetro `id` (un control, un desvío o una pulsación). */
  changed(id: string): boolean;
}

/** Lo que un grupo debe mostrar: desplazamiento en el mundo, giro en grados y opacidad. */
export interface GroupView {
  t?: [number, number, number];
  r?: number;
  o?: number;
  /** Estado que tiñe el grupo: `ok`, `warn` o `fail`; sin él, su tono normal. */
  s?: "ok" | "warn" | "fail";
  snap?: boolean;
}

export interface View {
  groups?: Record<string, GroupView>;
  readout?: string;
  /** Un evento para lectores de pantalla («saltó el breaker»); se anuncia una vez cuando cambia. */
  say?: string;
}

/** `P` nombra los parámetros de la spec, p. ej. `Model<State, { refill: number }>`. */
export interface Model<S = unknown, P extends object = Params> {
  init(params: P, ctx: Ctx): S;
  step?(state: S, dt: number, params: P, ctx: Ctx): S | void;
  view(state: S, params: P, ctx: Ctx): View;
}

export interface FigureData {
  id: string;
  model?: string;
  autoplay: boolean;
  tau: number;
  basis: number[];
  spins: Record<string, number[]>;
  params: { id: string; value: number; unit: string; spoken: string; options?: string[] }[];
  presets?: { values: Record<string, number>; note: string; reset?: boolean; press?: string[] }[];
  bind?: { group: string; param: string; move?: number[]; spin?: number; fade?: boolean }[];
  readout: string;
  lang: string;
  /** Con movimiento reducido, segundos que se simulan de golpe al montar y tras cada control o desvío. */
  settle?: number;
}

/** Lo que exporta isofig/zoom. */
export interface ZoomModule {
  openZoom(el: HTMLElement): void;
}

interface Group {
  els: SVGElement[];
  cur: number[];
  goal: number[];
  snap: boolean;
  shown: string;
  state?: string;
}

const registry = new Map<string, Model<any, any>>();
const waiting = new Map<string, HTMLElement[]>();
const live = new Map<HTMLElement, () => void>();
const cameras = new WeakMap<HTMLElement, (basis: number[], spins: Record<string, number[]>) => void>();
let zoomer: (() => Promise<ZoomModule>) | undefined;

/**
 * Activa el chip «Ampliar» de las figuras que se monten después: `zoomOnDemand(() => import("isofig/zoom"))`. El
 * módulo se descarga la primera vez que alguien lo pulsa.
 */
export function zoomOnDemand(load: () => Promise<ZoomModule>): void {
  zoomer = load;
}

/** Cambia la cámara de una figura montada (lo usa isofig/orbit tras redibujarla). */
export function retarget(el: HTMLElement, basis: number[], spins: Record<string, number[]>): void {
  cameras.get(el)?.(basis, spins);
}

export function register(name: string, model: Model<any, any>): void {
  registry.set(name, model);
  for (const el of waiting.get(name) ?? []) if (el.isConnected) live.set(el, mount(el, model));
  waiting.delete(name);
}

const bindModel = (d: FigureData): Model<null> => ({
  init: () => null,
  view(_, p) {
    const groups: Record<string, GroupView> = {};
    for (const b of d.bind ?? []) {
      const v = p[b.param] ?? 0;
      const g = (groups[b.group] ??= {});
      if (b.move) g.t = [b.move[0] * v, b.move[1] * v, b.move[2] * v];
      if (b.spin) g.r = b.spin * v;
      if (b.fade) g.o = Math.max(0, Math.min(1, v));
    }
    return { groups };
  },
});

function transformOf(d: FigureData, name: string, [x, y, z, r]: number[]): string {
  const b = d.basis;
  let e = b[0] * x + b[1] * y + b[2] * z;
  let f = b[3] * x + b[4] * y + b[5] * z;
  const s = d.spins[name];
  if (!s || !r) return e || f ? `translate(${e.toFixed(2)} ${f.toFixed(2)})` : "";
  const [a, bb, c, dd, cx, cy] = s;
  const det = a * dd - bb * c;
  const cos = Math.cos((r * Math.PI) / 180);
  const sin = Math.sin((r * Math.PI) / 180);
  const m00 = a * cos + c * sin, m01 = -a * sin + c * cos;
  const m10 = bb * cos + dd * sin, m11 = -bb * sin + dd * cos;
  const t00 = (m00 * dd - m01 * bb) / det, t01 = (-m00 * c + m01 * a) / det;
  const t10 = (m10 * dd - m11 * bb) / det, t11 = (-m10 * c + m11 * a) / det;
  e += cx - t00 * cx - t01 * cy;
  f += cy - t10 * cx - t11 * cy;
  return `matrix(${[t00, t10, t01, t11, e, f].map((v) => v.toFixed(3)).join(" ")})`;
}

/** Devuelve la función que la detiene. */
export function mount(el: HTMLElement, model?: Model<any, any>, data?: FigureData): () => void {
  const d: FigureData = data ?? JSON.parse(el.querySelector(".isofig-data")?.textContent ?? "{}");
  const m = model ?? (d.model ? registry.get(d.model) : bindModel(d));
  if (!m) {
    waiting.set(d.model!, [...(waiting.get(d.model!) ?? []), el]);
    return () => {};
  }
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motion.matches;
  // Lo que cambió (1) o se pulsó (2) desde el último paso del modelo.
  const marks = new Map<string, number>();
  // Un aviso de `ctx.say` se sigue ofreciendo 3 s hasta que se dice: si el eco de la lectura lo pisa, llega después.
  let offer = "";
  let offerUntil = 0;
  const ctx: Ctx = {
    lang: d.lang,
    reducedMotion: reduced,
    say(text) {
      offer = text;
      offerUntil = performance.now() + 3000;
    },
    pressed: (id) => marks.get(id) === 2,
    changed: (id) => marks.has(id),
  };
  const fmt = new Intl.NumberFormat(d.lang);
  el.querySelector(".isofig-controls")?.removeAttribute("hidden");
  const params: Params = Object.fromEntries(d.params.map((p) => [p.id, p.value]));
  // Si el runtime monta tarde (carga diferida), el lector pudo mover un control antes: manda lo que muestra la página.
  el.querySelectorAll<HTMLInputElement>("input[data-param]").forEach((input) => {
    const id = input.dataset["param"]!;
    if (input.type === "checkbox") params[id] = input.checked ? 1 : 0;
    else if (input.type === "radio") {
      if (input.checked) params[id] = Number(input.value);
    } else params[id] = Number(input.value);
  });
  const groups = new Map<string, Group>();
  // Al girar la figura (isofig/orbit) el SVG se redibuja: se vuelven a buscar las piezas y conservan su estado.
  const collect = () => {
    const before = new Map(groups);
    groups.clear();
    el.querySelectorAll<SVGElement>("[data-g]").forEach((node) => {
      const name = node.dataset["g"]!;
      const prev = before.get(name);
      const o = node.getAttribute("opacity") === "0" ? 0 : 1;
      const g =
        groups.get(name) ??
        (prev
          ? { ...prev, els: [], shown: "", state: undefined }
          : { els: [], cur: [0, 0, 0, 0, o], goal: [0, 0, 0, 0, o], snap: false, shown: "" });
      g.els.push(node);
      groups.set(name, g);
    });
  };
  collect();
  const readout = el.querySelector<HTMLElement>(".isofig-readout");
  const say = el.querySelector<HTMLElement>(".isofig-say");
  const note = el.querySelector<HTMLElement>(".isofig-note");
  // Los avisos esperan a que el lector toque la figura, hablan tras un silencio y nunca encima de una nota.
  let touched = false;
  // Cada interacción del lector habilita como mucho dos avisos del modelo; luego calla hasta que vuelva a tocar.
  let budget = 0;
  let pending = "";
  let lastSaid = "";
  let quietUntil = 0;
  let voice = 0;
  const flush = () => {
    voice = 0;
    const wait = quietUntil - performance.now();
    if (wait > 0) {
      voice = window.setTimeout(flush, wait);
      return;
    }
    if (say && pending && pending !== lastSaid) {
      say.textContent = lastSaid = pending;
      budget = Math.max(0, budget - 1);
      if (pending === offer) offer = "";
    }
    pending = "";
  };
  const speak = (text: string, delay = 1500) => {
    if (!touched || !text || text === pending || text === lastSaid) return;
    pending = text;
    clearTimeout(voice);
    voice = window.setTimeout(flush, delay);
  };
  const play = el.querySelector<HTMLButtonElement>(".isofig-play");
  let state = m.init(params, ctx);
  let jump = false;
  const step = (dt: number) => {
    state = m.step?.(state, dt, params, ctx) ?? state;
    marks.clear();
  };
  // Simula `s` segundos de golpe; el cuadro siguiente salta al resultado sin interpolar.
  const run = (s = 0) => {
    for (let i = 0; i < s * 60; i++) step(1 / 60);
    jump ||= s > 0;
  };
  // Solo para capturas: `data-isofig-advance="3"` arranca la figura 3 s ya simulados (un headless no corre rAF).
  run(Number(el.dataset["isofigAdvance"] ?? 0));
  if (reduced) run(d.settle);
  let playing = d.autoplay && !reduced;
  let visible = false;
  let frame = 0;
  let last = 0;

  const setPlaying = (on: boolean) => {
    playing = on;
    if (!play) return;
    play.textContent = (on ? play.dataset["pause"] : play.dataset["play"]) ?? "";
  };
  setPlaying(playing);

  const tick = (now: number) => {
    frame = 0;
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0;
    last = now;
    if (playing) step(dt);
    const view = m.view(state, params, ctx);
    const k = reduced || jump ? 1 : 1 - Math.exp(-dt / d.tau);
    jump = false;
    let moving = false;
    for (const [name, g] of groups) {
      const v = view.groups?.[name];
      if (v) {
        g.goal = [v.t?.[0] ?? 0, v.t?.[1] ?? 0, v.t?.[2] ?? 0, v.r ?? 0, v.o ?? g.goal[4]];
        g.snap = Boolean(v.snap);
        if (v.s !== g.state) {
          g.state = v.s;
          for (const node of g.els) {
            if (v.s) node.dataset["state"] = v.s;
            else delete node.dataset["state"];
          }
        }
      }
      for (let i = 0; i < 5; i++) {
        const gap = g.goal[i] - g.cur[i];
        g.cur[i] = g.snap || Math.abs(gap) < 1e-3 ? g.goal[i] : g.cur[i] + gap * k;
        if (g.cur[i] !== g.goal[i]) moving = true;
      }
      const tf = transformOf(d, name, g.cur);
      const op = g.cur[4] >= 0.999 ? "" : g.cur[4].toFixed(3);
      const key = tf + "|" + op;
      if (key === g.shown) continue;
      g.shown = key;
      for (const node of g.els) {
        if (tf) node.setAttribute("transform", tf);
        else node.removeAttribute("transform");
        node.setAttribute("opacity", op || "1");
        node.style.visibility = g.cur[4] < 0.01 ? "hidden" : "";
      }
    }
    const text = view.readout ?? d.params.reduce((s, p) => s.replaceAll(`{${p.id}}`, String(params[p.id])), d.readout);
    if (readout && readout.textContent !== text) readout.textContent = text;
    const news = view.say || (performance.now() < offerUntil && offer);
    if (news && budget > 0) speak(news);
    if (visible && (playing || moving)) wake();
    else last = 0;
  };
  const wake = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  const show = (id: string) => {
    const p = d.params.find((q) => q.id === id);
    if (!p) return;
    const value = fmt.format(params[id]);
    for (const input of el.querySelectorAll<HTMLInputElement>(`input[data-param="${id}"]`)) {
      if (input.type === "checkbox") input.checked = params[id] !== 0;
      else if (input.type === "radio") input.checked = Number(input.value) === params[id];
      else {
        input.value = String(params[id]);
        input.setAttribute("aria-valuetext", `${value} ${p.spoken}`.trim());
        const out = input.parentElement?.querySelector(".isofig-value");
        if (out) out.textContent = `${value} ${p.unit}`.trim();
      }
    }
  };
  const onInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const id = input.dataset["param"];
    if (!id) return;
    params[id] = input.type === "checkbox" ? (input.checked ? 1 : 0) : Number(input.value);
    marks.set(id, 1);
    show(id);
    touched = true;
    budget = 2;
    if (reduced) run(d.settle);
    wake();
    clearTimeout(echo);
    echo = window.setTimeout(() => speak(readout?.textContent ?? "", 0), 1200);
  };
  let echo = 0;
  const press = (id: string) => {
    params[id] = (params[id] ?? 0) + 1;
    marks.set(id, 2);
  };
  const onClick = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-zoom]")) return void zoomer?.().then((z) => z.openZoom(el));
    const id = target.closest<HTMLElement>("[data-action]")?.dataset["param"];
    const preset = id ? undefined : d.presets?.[Number(target.closest<HTMLElement>("[data-preset]")?.dataset["preset"])];
    if (!id && !preset) return;
    touched = true;
    budget = 2;
    if (preset) {
      for (const [k, v] of Object.entries(preset.values)) {
        if (params[k] !== v) marks.set(k, 1);
        params[k] = v;
        show(k);
      }
      if (preset.reset) state = m.init(params, ctx);
      preset.press?.forEach(press);
      quietUntil = performance.now() + 2500;
      if (note) note.textContent = preset.note;
    } else press(id!);
    // Sin animación, el desvío muestra directamente su efecto: unos segundos ya simulados.
    if (reduced) run(preset ? (d.settle ?? 8) : d.settle);
    else setPlaying(true);
    wake();
  };
  const onMotion = () => {
    ctx.reducedMotion = reduced = motion.matches;
    setPlaying(d.autoplay && !reduced);
    if (reduced) run(d.settle);
    wake();
  };
  motion.addEventListener("change", onMotion);
  const zoom = el.querySelector<HTMLElement>("[data-zoom]");
  if (zoom && zoomer) zoom.hidden = false;
  const onPlay = () => {
    touched = true;
    budget = 2;
    setPlaying(!playing);
    wake();
  };
  el.addEventListener("input", onInput);
  el.addEventListener("click", onClick);
  play?.addEventListener("click", onPlay);
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) wake();
    },
    { rootMargin: "120px" },
  );
  io.observe(el);
  cameras.set(el, (basis, spins) => {
    d.basis = basis;
    d.spins = spins;
    collect();
    wake();
  });
  // El primer cuadro se dibuja aunque el observador no haya avisado todavía (o nunca avise, como en un headless).
  wake();

  return () => {
    io.disconnect();
    motion.removeEventListener("change", onMotion);
    el.removeEventListener("input", onInput);
    el.removeEventListener("click", onClick);
    play?.removeEventListener("click", onPlay);
    cancelAnimationFrame(frame);
    clearTimeout(voice);
    clearTimeout(echo);
  };
}

/** Una figura con datos rotos no impide montar las demás. */
export function mountAll(root: ParentNode = document): void {
  // Las figuras que ya salieron de la página sin `unmountAll` se detienen y se sueltan.
  for (const [el, stop] of live) if (!el.isConnected) live.delete(el), stop();
  root.querySelectorAll<HTMLElement>("[data-isofig]:not([data-isofig-live])").forEach((el) => {
    el.dataset["isofigLive"] = "";
    try {
      live.set(el, mount(el));
    } catch (e) {
      console.error(`isofig «${el.dataset["isofig"]}»:`, e);
    }
  });
}

/** Para llamar antes de que un router reemplace la página. */
export function unmountAll(): void {
  // Sin la marca, una figura con `transition:persist` vuelve a montarse en la página siguiente.
  for (const [el, stop] of live) stop(), delete el.dataset["isofigLive"];
  live.clear();
  waiting.clear();
}

export interface OrbitHandle {
  turn(azimuth: number, elevation?: number): void;
  reset(): void;
  grab(e: PointerEvent): void;
  stop(): void;
}

/**
 * Carga el giro solo cuando hace falta, como `@defer (prefetch on hover; on interaction)`: al pasar el puntero o
 * enfocar la figura se precarga; al presionar el dibujo o un botón de giro se activa.
 */
export function orbitOnDemand(el: HTMLElement, load: () => Promise<OrbitHandle>): () => void {
  let pending: Promise<OrbitHandle> | null = null;
  let orbit: OrbitHandle | null = null;
  const get = () =>
    (pending ??= load().then((o) => {
      orbit = o;
      return o;
    }));
  const svg = el.querySelector<SVGElement>(".isofig-orbitable");
  const warm = () => void get();
  // Si el puntero se suelta antes de que cargue el giro, no se agarra nada (si no, gira sin botón presionado).
  const released = new Set<number>();
  const up = (e: PointerEvent) => released.add(e.pointerId);
  const down = (e: PointerEvent) => {
    if (orbit || e.button !== 0) return;
    released.delete(e.pointerId);
    get().then((o) => {
      if (!released.has(e.pointerId)) o.grab(e);
    });
  };
  const click = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-orbit]");
    if (!b) return;
    const v = Number(b.dataset["orbit"]);
    get().then((o) => (v ? o.turn(v) : o.reset()));
  };
  el.addEventListener("pointerenter", warm, { once: true });
  el.addEventListener("focusin", warm, { once: true });
  svg?.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up);
  el.addEventListener("click", click);
  return () => {
    el.removeEventListener("pointerenter", warm);
    el.removeEventListener("focusin", warm);
    svg?.removeEventListener("pointerdown", down);
    window.removeEventListener("pointerup", up);
    el.removeEventListener("click", click);
    orbit?.stop();
  };
}
