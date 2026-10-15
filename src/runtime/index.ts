export type Params = Record<string, number>;

export interface Ctx {
  lang: string;
  reducedMotion: boolean;
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
  presets?: { values: Record<string, number>; note: string; reset?: boolean }[];
  bind?: { group: string; param: string; move?: number[]; spin?: number; fade?: boolean }[];
  readout: string;
  lang: string;
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
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx: Ctx = { lang: d.lang, reducedMotion: reduced };
  const fmt = new Intl.NumberFormat(d.lang);
  el.querySelector(".isofig-controls")?.removeAttribute("hidden");
  const params: Params = Object.fromEntries(d.params.map((p) => [p.id, p.value]));
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
    if (say && pending && pending !== lastSaid) say.textContent = lastSaid = pending;
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
  // Solo para capturas: `data-isofig-advance="3"` arranca la figura 3 s ya simulados (un headless no corre rAF).
  const advance = Number(el.dataset["isofigAdvance"] ?? 0);
  for (let i = 0; i < advance * 60; i++) state = m.step?.(state, 1 / 60, params, ctx) ?? state;
  let jump = advance > 0;
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
    if (playing) state = m.step?.(state, dt, params, ctx) ?? state;
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
    if (view.say) speak(view.say);
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
    show(id);
    touched = true;
    wake();
    clearTimeout(echo);
    echo = window.setTimeout(() => speak(readout?.textContent ?? "", 0), 1200);
  };
  let echo = 0;
  const onPreset = (e: Event) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    const id = action?.dataset["param"];
    if (id) {
      touched = true;
      params[id] = (params[id] ?? 0) + 1;
      if (!reduced) setPlaying(true);
      wake();
      return;
    }
    const button = (e.target as HTMLElement).closest<HTMLElement>("[data-preset]");
    const preset = button ? d.presets?.[Number(button.dataset["preset"])] : undefined;
    if (!preset) return;
    for (const [id, v] of Object.entries(preset.values)) {
      params[id] = v;
      show(id);
    }
    if (preset.reset) state = m.init(params, ctx);
    touched = true;
    quietUntil = performance.now() + 2500;
    if (note) note.textContent = preset.note;
    if (reduced) {
      // Sin animación, el desvío muestra directamente su efecto: unos segundos ya simulados.
      for (let i = 0; i < 8 * 60; i++) state = m.step?.(state, 1 / 60, params, ctx) ?? state;
      jump = true;
    } else setPlaying(true);
    wake();
  };
  const onPlay = () => {
    touched = true;
    setPlaying(!playing);
    wake();
  };
  el.addEventListener("input", onInput);
  el.addEventListener("click", onPreset);
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
    el.removeEventListener("input", onInput);
    el.removeEventListener("click", onPreset);
    play?.removeEventListener("click", onPlay);
    cancelAnimationFrame(frame);
    clearTimeout(voice);
    clearTimeout(echo);
  };
}

/** Una figura con datos rotos no impide montar las demás. */
export function mountAll(root: ParentNode = document): void {
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
  for (const stop of live.values()) stop();
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
  const down = (e: PointerEvent) => {
    if (orbit || e.button !== 0) return;
    get().then((o) => o.grab(e));
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
  el.addEventListener("click", click);
  return () => {
    el.removeEventListener("pointerenter", warm);
    el.removeEventListener("focusin", warm);
    svg?.removeEventListener("pointerdown", down);
    el.removeEventListener("click", click);
    orbit?.stop();
  };
}
