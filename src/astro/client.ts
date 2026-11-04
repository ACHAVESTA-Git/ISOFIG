import type { Model } from "../runtime/index.ts";

/** Lo que devuelve una importación dinámica del archivo del modelo (con `export default`) o el modelo mismo. */
export type ModelModule = Model<any, any> | { default: Model<any, any> };
export type ModelLoader = () => Promise<ModelModule>;
export type LoadMode = "visible" | "idle" | "eager";

const loaders = new Map<string, ModelLoader>();

/**
 * Dice cómo se descarga el modelo de cada figura, por el nombre de `spec.model`. Va en un `<script>` de la página o
 * del componente que usa `<Figure>`: allí Astro resuelve la importación dinámica y la parte en su propio archivo,
 * que el navegador pide solo cuando la figura se acerca.
 */
export function models(table: Record<string, ModelLoader>): void {
  for (const [name, load] of Object.entries(table)) loaders.set(name, load);
}

/** Cada figura armada (montada o a la espera), con la función que la desarma. */
const armed = new Map<HTMLElement, () => void>();
let started = false;

/** ¿Sobrevive la figura a la navegación? Solo si Astro la conserva (`transition:persist`). */
function persists(host: HTMLElement, next: Document | undefined): boolean {
  const key = host.closest("[data-astro-transition-persist]")?.getAttribute("data-astro-transition-persist");
  return Boolean(key && next?.querySelector(`[data-astro-transition-persist="${CSS.escape(key)}"]`));
}

/** Llama a `go` una sola vez cuando el lector se acerca (a `margin` px) o toca el elemento. Devuelve la cancelación. */
function whenNear(host: HTMLElement, go: () => void, margin = 600): () => void {
  const events = ["pointerenter", "focusin", "pointerdown"];
  const stop = () => {
    io?.disconnect();
    for (const e of events) host.removeEventListener(e, fire);
  };
  const fire = () => {
    stop();
    go();
  };
  const io = typeof IntersectionObserver === "function" ? new IntersectionObserver((list) => list.some((e) => e.isIntersecting) && fire(), { rootMargin: `${margin}px` }) : null;
  for (const e of events) host.addEventListener(e, fire, { passive: true });
  if (io) io.observe(host);
  else fire();
  return stop;
}

function whenIdle(go: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(go, { timeout: 2000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(go, 200);
  return () => clearTimeout(id);
}

const unwrap = (m: ModelModule): Model<any, any> => ("default" in m ? m.default : m);

/** Descarga el runtime y el modelo (si lo hay) y monta la figura; el giro se pide aparte, con `orbitOnDemand`. */
async function mountFigure(host: HTMLElement, alive: () => boolean, keep: (stop: () => void) => void): Promise<void> {
  const el = host.querySelector<HTMLElement>("[data-isofig]");
  if (!el) return;
  const data = JSON.parse(el.querySelector(".isofig-data")?.textContent ?? "{}") as { id?: string; model?: string; lang?: string };
  const load = data.model ? loaders.get(data.model) : undefined;
  const [rt, found] = await Promise.all([import("../runtime/index.ts"), load?.()]);
  // La navegación pudo quitar la figura mientras se descargaba: sin dueño que la detenga, no se monta.
  if (!alive() || !host.isConnected) return;
  if (data.model && found) rt.register(data.model, unwrap(found));
  // Antes de montar: el runtime muestra el chip «Ampliar» solo si ya sabe de dónde cargar isofig/zoom.
  rt.zoomOnDemand(() => import("../zoom/index.ts"));
  keep(rt.mount(el));
  // Sin cargador ni `register()`, el runtime espera al modelo y la figura se queda quieta: se avisa en la consola.
  if (data.model && !load) {
    const name = data.model;
    setTimeout(() => {
      if (alive() && el.querySelector(".isofig-controls")?.hasAttribute("hidden")) {
        console.warn(`isofig «${data.id}»: nadie registró el modelo «${name}». Regístralo con models() de isofig/astro/client en un <script> de la página.`);
      }
    }, 3000);
  }

  const raw = host.querySelector(".isofig-spec")?.textContent;
  if (!raw) return;
  const spec = JSON.parse(raw);
  keep(
    rt.orbitOnDemand(el, async () => {
      const { enableOrbit } = await import("../orbit/index.ts");
      const orbit = enableOrbit(el, spec, { lang: data.lang });
      if (!alive() || !host.isConnected) orbit.stop();
      return orbit;
    }),
  );
}

function arm(host: HTMLElement): () => void {
  const mode = (host.dataset["isofigLoad"] as LoadMode | undefined) ?? "visible";
  const stops: (() => void)[] = [];
  let live = true;
  const go = () => {
    mountFigure(host, () => live, (stop) => stops.push(stop)).catch((e) => {
      console.error(`isofig «${host.querySelector<HTMLElement>("[data-isofig]")?.dataset["isofig"]}»:`, e);
    });
  };
  if (mode === "eager") go();
  else stops.push(mode === "idle" ? whenIdle(go) : whenNear(host, go));
  return () => {
    live = false;
    for (const stop of stops.splice(0)) stop();
  };
}

/** Busca las figuras nuevas de la página y las deja a la espera. Es idempotente. */
export function scan(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-isofig-load]").forEach((host) => {
    if (!armed.has(host)) armed.set(host, arm(host));
  });
}

/** Detiene las figuras que Astro está a punto de quitar; las que conserva con `transition:persist` siguen vivas. */
function release(e: Event): void {
  const next = (e as Event & { newDocument?: Document }).newDocument;
  for (const [host, stop] of armed) {
    if (persists(host, next)) continue;
    stop();
    armed.delete(host);
  }
}

/**
 * Lo llama `<Figure>` desde su script. Busca las figuras cuando ya corrieron los demás `<script>` de la página (los
 * que registran modelos con `models()`), y con `<ClientRouter />` otra vez en cada `astro:page-load`.
 */
export function start(): void {
  if (started) return;
  started = true;
  if (document.readyState === "complete") setTimeout(() => scan());
  else document.addEventListener("DOMContentLoaded", () => scan(), { once: true });
  document.addEventListener("astro:page-load", () => scan());
  document.addEventListener("astro:before-swap", release);
}
