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
  params: { id: string; value: number; unit: string; spoken: string; options?: string[]; texts?: string[] }[];
  presets?: { values: Record<string, number>; note: string; reset?: boolean; press?: string[] }[];
  bind?: { group: string; param: string; move?: number[]; spin?: number; fade?: boolean; win?: number[]; keep?: number[] }[];
  /** Recorridos (con o sin modelo): ver `tracks` en la spec. */
  tracks?: { g: string; p: number[][]; T: number; d?: number; l?: 0; h?: number[][] }[];
  rest?: number;
  readout: string;
  lang: string;
  /** Con movimiento reducido, segundos que se simulan de golpe al montar y tras cada control o desvío. */
  settle?: number;
  /** Orden de pintado por pose: `[valor, mover, antes de, …]` sobre el orden en reposo. */
  reorder?: { param: string; poses: number[][] };
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
const cameras = new WeakMap<HTMLElement, (basis: number[], spins: Record<string, number[]>, reorder?: FigureData["reorder"]) => void>();
let zoomer: (() => Promise<ZoomModule>) | undefined;

/**
 * Activa el chip «Ampliar» de las figuras que se monten después: `zoomOnDemand(() => import("isofig/zoom"))`. El
 * módulo se descarga la primera vez que alguien lo pulsa.
 */
export function zoomOnDemand(load: () => Promise<ZoomModule>): void {
  zoomer = load;
}

/** Cambia la cámara de una figura montada (lo usa isofig/orbit tras redibujarla). */
export function retarget(el: HTMLElement, basis: number[], spins: Record<string, number[]>, reorder?: FigureData["reorder"]): void {
  cameras.get(el)?.(basis, spins, reorder);
}

export function register(name: string, model: Model<any, any>): void {
  registry.set(name, model);
  for (const el of waiting.get(name) ?? []) if (el.isConnected) live.set(el, mount(el, model));
  waiting.delete(name);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
/** Opacidad de lo que no es la pieza elegida: se aparta sin desaparecer, para no perder dónde va. */
const DIM = 0.35;
/** Unión de dos cajas `[x0, y0, x1, y1]`. */
const join = (a: number[] | undefined, c: number[]): number[] =>
  a ? [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[2]), Math.max(a[3], c[3])] : c;

/** `{id}` con el texto de su valor si lo hay, que a su vez puede nombrar otro parámetro (una pasada más). */
const fill = (d: FigureData, p: Params, text = d.readout): string =>
  text.replace(/\{([^}]+)\}/g, (m, id: string) => {
    const q = d.params.find((x) => x.id === id);
    return q ? (q.texts?.[p[id]] ?? String(p[id])) : m;
  });

/**
 * Los `bind` de la spec sobre el modelo (si lo hay): varios enlaces al mismo grupo se suman, cada uno con su ventana
 * del parámetro, y una elección atenúa los grupos que no son la pieza elegida. Así se desarma una figura sin modelo.
 * Lleva también el reloj de los `tracks`: los grupos que viajan por una polilínea, con o sin modelo.
 */
const bindModel = (d: FigureData, m?: Model<any, any>): Model<{ s: unknown; t: number }> => ({
  init: (p, c) => ({ s: m?.init(p, c), t: c.reducedMotion ? (d.rest ?? 0) : 0 }),
  step: (o, dt, p, c) => ((o.s = m?.step?.(o.s, dt, p, c) ?? o.s), (o.t += dt), o),
  view(o, p, c) {
    const v: View = m ? m.view(o.s, p, c) : {};
    const groups: Record<string, GroupView> = { ...v.groups };
    for (const b of d.bind ?? []) {
      let x = p[b.param] ?? 0;
      const g = (groups[b.group] = { ...groups[b.group] });
      if (b.keep) {
        // Siempre con valor: sin él, el grupo se quedaría atenuado al elegir otra pieza o volver a «Todo».
        g.o = (g.o ?? 1) * (x && !b.keep.includes(x) ? DIM : 1);
        continue;
      }
      if (b.win) x = clamp01((x - b.win[0]) / (b.win[1] - b.win[0]));
      if (b.move) g.t = b.move.map((v, i) => (g.t?.[i] ?? 0) + v * x) as GroupView["t"];
      if (b.spin) g.r = (g.r ?? 0) + b.spin * x;
      if (b.fade) g.o = (g.o ?? 1) * clamp01(x);
    }
    // Un recorrido: el grupo avanza por su polilínea según el arco; aparece y se apaga en los extremos.
    for (const k of d.tracks ?? []) {
      const u = (o.t - (k.d ?? 0)) / k.T;
      const f = k.l === 0 ? Math.min(u, 1) : u - Math.floor(u);
      let i = 1;
      while (i < k.p.length - 1 && k.p[i][3] < f) i++;
      const a = k.p[i - 1];
      const b = k.p[i];
      const w = (f - a[3]) / (b[3] - a[3]);
      groups[k.g] = { t: [0, 1, 2].map((j) => a[j] + (b[j] - a[j]) * w) as GroupView["t"], o: u < 0 || k.h?.some(([x, y]) => f > x && f < y) ? 0 : Math.min(1, f * 12, k.l === 0 ? 1 : (1 - f) * 12), snap: true };
    }
    return { ...v, groups, readout: v.readout ?? fill(d, p, fill(d, p)) };
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
  const own = model ?? (d.model ? registry.get(d.model) : undefined);
  if (d.model && !own) {
    waiting.set(d.model, [...(waiting.get(d.model) ?? []), el]);
    return () => {};
  }
  const m = bindModel(d, own);
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
  // Piezas en su orden de pintado en reposo, la pose que muestra el DOM y el parámetro que la elige, ya suavizado.
  let scene: Element | null;
  let base: Element[] = [];
  let pose = 0;
  let eased = 0;
  // La pieza elegida que el DOM ya pinta encima y el encuadre que se muestra: elegir una pieza acerca la cámara.
  let front = 0;
  const svg = el.querySelector<SVGSVGElement>(".isofig-art");
  const full = (svg?.getAttribute("viewBox") ?? "").split(" ").map(Number);
  let vb = full;
  const pick = d.bind?.find((b) => b.keep)?.param;
  // Caja de cada grupo sin su desplazamiento: `getBBox` no cuenta el `transform` del propio nodo.
  let boxes = new Map<string, number[]>();
  // Al girar la figura (isofig/orbit) el SVG se redibuja: se vuelven a buscar las piezas y conservan su estado.
  const collect = () => {
    scene = el.querySelector(".isofig-scene");
    base = [...(scene?.querySelectorAll(":scope>:is(g,use)") ?? [])];
    pose = front = 0;
    boxes = new Map();
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
    }
    const moving = draw(k);
    const text = view.readout ?? "";
    if (readout && readout.textContent !== text) readout.textContent = text;
    const news = view.say || (performance.now() < offerUntil && offer);
    if (news && budget > 0) speak(news);
    if (visible && (playing || moving)) wake();
    else last = 0;
  };
  /** Encuadre de la pieza elegida en su pose de destino, o el completo con «Todo». */
  const aim = (f: number): number[] => {
    const b = d.basis;
    let u: number[] | undefined;
    for (const bd of d.bind ?? []) {
      const g = groups.get(bd.group);
      if (!f || !g || !bd.keep?.includes(f)) continue;
      if (!boxes.has(bd.group))
        for (const n of g.els)
          try {
            const r = (n as SVGGraphicsElement).getBBox();
            if (r.width || r.height) boxes.set(bd.group, join(boxes.get(bd.group), [r.x, r.y, r.x + r.width, r.y + r.height]));
          } catch {}
      const box = boxes.get(bd.group);
      const [x, y, z] = g.goal;
      const e = b[0] * x + b[1] * y + b[2] * z;
      const h = b[3] * x + b[4] * y + b[5] * z;
      if (box) u = join(u, [box[0] + e, box[1] + h, box[2] + e, box[3] + h]);
    }
    if (!u) return full;
    const [x0, y0, x1, y1] = u;
    const [fx, fy, fw, fh] = full;
    // La pieza ocupa unos dos tercios del cuadro, con el formato de la figura y sin acercarse más de 3×.
    const w = clamp(Math.max(x1 - x0, ((y1 - y0) * fw) / fh) * 1.5, fw / 3, fw);
    const h = (w * fh) / fw;
    return [clamp((x0 + x1 - w) / 2, fx, fx + fw - w), clamp((y0 + y1 - h) / 2, fy, fy + fh - h), w, h];
  };
  // Escribe en el SVG el estado de cada grupo, el orden de pintado y el encuadre, `k` más cerca de su meta.
  const draw = (k: number): boolean => {
    let moving = false;
    for (const [name, g] of groups) {
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
    const r = d.reorder;
    let next = 0;
    if (r) {
      const goal = params[r.param] ?? 0;
      eased = Math.abs(goal - eased) < 1e-3 ? goal : eased + (goal - eased) * k;
      if (eased !== goal) moving = true;
      // Al salir, la pieza cambia de orden cuando ya llegó; al volver, en cuanto arranca: así nunca se pinta encima.
      r.poses.forEach((q, i) => {
        if (eased >= q[0] - 0.05) next = i + 1;
      });
    }
    const f = pick ? params[pick] : 0;
    if (scene && (next !== pose || f !== front)) {
      pose = next;
      front = f;
      for (const n of base) scene.append(n);
      const q = r?.poses[pose - 1] ?? [];
      for (let i = 1; i < q.length; i += 2) scene.insertBefore(base[q[i]], base[q[i + 1]] ?? null);
      // La pieza elegida se pinta encima de todo: aunque esté dentro del bloque, se ve entera entre las atenuadas.
      if (f) {
        const top = new Set<Element | null>();
        for (const b of d.bind!) if (b.keep?.includes(f)) for (const n of groups.get(b.group)?.els ?? []) top.add(n.closest(".isofig-scene>*"));
        for (const n of [...scene.children]) if (top.has(n)) scene.append(n);
      }
    }
    if (svg && pick) {
      const goal = aim(f);
      vb = vb.map((v, i) => {
        if (Math.abs(goal[i] - v) < 0.05) return goal[i];
        moving = true;
        return v + (goal[i] - v) * k;
      });
      const box = vb.map((v) => +v.toFixed(2)).join(" ");
      if (svg.getAttribute("viewBox") !== box) svg.setAttribute("viewBox", box);
    }
    return moving;
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
        input.setAttribute("aria-valuetext", p.texts?.[params[id]] ?? `${value} ${p.spoken}`.trim());
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
  cameras.set(el, (basis, spins, reorder) => {
    d.basis = basis;
    d.spins = spins;
    d.reorder = reorder;
    collect();
    // En el mismo cuadro del giro: si espera al siguiente, mientras se arrastra se ve la pose en reposo.
    draw(0);
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
