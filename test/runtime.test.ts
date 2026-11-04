import { afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { build, clock, cleanUp, demoSpec, doc, motion, observers, setControl, setVisible, type Built } from "./dom.ts";
import { mount, mountAll, register, unmountAll, type Model, type Params } from "../src/runtime/index.ts";

afterEach(() => {
  unmountAll();
  cleanUp();
  mock.restoreAll();
});

interface Log {
  inits: number;
  initParams: Params[];
  steps: number;
  last: Params;
  /** Qué parámetros vio el modelo pulsados o cambiados, en cada paso en que alguno lo estaba. */
  pressed: string[];
  changed: string[];
  reduced: boolean;
}

/**
 * Un modelo que anota qué vio y mueve el grupo `bar` a `rate × 5`. Con `say`, dice lo que esa función devuelva en
 * cada vista.
 */
function spy(options: { say?: () => string } = {}) {
  const log: Log = { inits: 0, initParams: [], steps: 0, last: {}, pressed: [], changed: [], reduced: false };
  const model: Model<{ t: number }, any> = {
    init(p) {
      log.inits++;
      log.initParams.push({ ...p });
      return { t: 0 };
    },
    step(s, dt, p, ctx) {
      log.steps++;
      log.last = { ...p };
      log.reduced = ctx.reducedMotion;
      for (const id of Object.keys(p)) {
        if (ctx.pressed(id)) log.pressed.push(id);
        if (ctx.changed(id)) log.changed.push(id);
      }
      s.t += dt;
    },
    view: (_s, p) => ({
      groups: { bar: { t: [p["rate"] * 5, 0, 0] } },
      ...(options.say ? { say: options.say() } : {}),
    }),
  };
  return { model, log };
}

/** Lo que se anuncia a los lectores de pantalla: cada texto que el runtime escribe en `.isofig-say`. */
function voice(f: Built) {
  const el = f.q(".isofig-say");
  const said: string[] = [];
  let text = "";
  Object.defineProperty(el, "textContent", {
    configurable: true,
    get: () => text,
    set(v: string) {
      said.push((text = v));
    },
  });
  return said;
}

const bar = (f: Built) => f.q('[data-g="bar"]');
/** El desplazamiento horizontal de una transformación `translate(x y)`. */
const shift = (transform: string | null) => Number(/translate\(([-\d.]+)/.exec(transform ?? "")?.[1]);

// Montar y desmontar --------------------------------------------------------------------------------------------

test("mountAll monta cada figura una vez y le pone data-isofig-live; unmountAll la detiene del todo y borra la marca", () => {
  const { model, log } = spy();
  register("t-mountall", model);
  const f = build(demoSpec({ model: "t-mountall" }));
  assert.equal(f.q(".isofig-controls").hasAttribute("hidden"), true, "sin runtime, los controles siguen ocultos");
  mountAll(doc);
  assert.equal(f.el.dataset["isofigLive"], "");
  assert.equal(f.q(".isofig-controls").hasAttribute("hidden"), false);
  mountAll(doc);
  assert.equal(log.inits, 1, "la segunda pasada no la monta otra vez");
  clock.run(3);
  assert.equal(log.steps, 3);

  unmountAll();
  assert.equal("isofigLive" in f.el.dataset, false);
  assert.deepEqual(clock.pending, { timers: 0, frames: 0 });
  assert.equal(observers(), 0);
  assert.equal(motion.listeners.size, 0);
  setControl(f.control("rate"), 9);
  clock.run(3);
  assert.equal(log.steps, 3, "detenida, ya no avanza");
  assert.equal(log.last["rate"], 2, "ni oye al lector");
  f.preset(0).click();
  assert.equal(f.q(".isofig-note").textContent, "", "ni sus clics");
  const play = f.q(".isofig-play");
  play.click();
  assert.equal(play.textContent, "Pause", "ni su botón de pausa");
});

test("una figura con transition:persist vuelve a montarse tras unmountAll, con un solo juego de oyentes", () => {
  const { model, log } = spy();
  register("t-persist", model);
  const f = build(demoSpec({ model: "t-persist" }));
  mountAll(doc);
  unmountAll();
  mountAll(doc);
  assert.equal(log.inits, 2);
  assert.equal(f.el.dataset["isofigLive"], "");
  f.control("kick").click();
  clock.frame();
  assert.equal(log.last["kick"], 1, "un clic suma una vez: no quedaron los oyentes de la primera vez");
  assert.equal(observers(), 1);
});

test("mountAll suelta las figuras que salieron de la página sin unmountAll", () => {
  const { model } = spy();
  register("t-gone", model);
  const f = build(demoSpec({ model: "t-gone" }));
  mountAll(doc);
  assert.equal(observers(), 1);
  f.host.remove();
  mountAll(doc);
  assert.equal(observers(), 0);
  assert.equal(motion.listeners.size, 0);
  assert.deepEqual(clock.pending, { timers: 0, frames: 0 });
});

test("una figura con datos rotos se avisa en la consola y no impide montar las demás", () => {
  const errors = mock.method(console, "error", () => {});
  doc.body.insertAdjacentHTML("afterbegin", `<figure data-isofig="roto"><script type="application/json" class="isofig-data">{no es json</script></figure>`);
  const { model, log } = spy();
  register("t-after-broken", model);
  build(demoSpec({ model: "t-after-broken" }));
  mountAll(doc);
  assert.equal(errors.mock.callCount(), 1);
  assert.match(String(errors.mock.calls[0]!.arguments[0]), /isofig «roto»/);
  assert.equal(log.inits, 1);
});

test("una figura cuyo modelo aún no se registró espera, se monta al registrarlo y unmountAll la olvida", () => {
  const f = build(demoSpec({ model: "t-late" }));
  build(demoSpec({ model: "t-late" }));
  mountAll(doc);
  assert.equal(f.q(".isofig-controls").hasAttribute("hidden"), true);
  assert.equal(observers(), 0, "sin modelo no hay figura montada");
  const late = spy();
  register("t-late", late.model);
  assert.equal(late.log.inits, 2, "se montaron las dos que esperaban");
  assert.equal(f.q(".isofig-controls").hasAttribute("hidden"), false);
  unmountAll();

  const h = build(demoSpec({ model: "t-forgotten" }));
  mountAll(doc);
  unmountAll();
  const forgotten = spy();
  register("t-forgotten", forgotten.model);
  assert.equal(forgotten.log.inits, 0, "tras unmountAll ya no espera");
  assert.equal(h.q(".isofig-controls").hasAttribute("hidden"), true);
});

test("sin modelo, bind mueve el grupo con el parámetro; y data-isofig-advance adelanta la simulación", () => {
  motion.reduced = true;
  const f = build(demoSpec({ model: undefined, autoplay: false, bind: [{ group: "bar", param: "rate", move: [5, 0, 0] }] }));
  mountAll(doc);
  clock.frame();
  assert.equal(bar(f).getAttribute("transform"), f.translate(10));
  setControl(f.control("rate"), 6);
  clock.frame();
  assert.equal(bar(f).getAttribute("transform"), f.translate(30));

  motion.reduced = false;
  const g = build(demoSpec());
  g.el.dataset["isofigAdvance"] = "3";
  const { model, log } = spy();
  mount(g.el, model);
  assert.equal(log.steps, 180, "tres segundos ya simulados al arrancar");
});

test("una figura fuera de pantalla dibuja el primer cuadro y no sigue animando hasta que se ve", () => {
  const { model, log } = spy();
  const f = build(demoSpec());
  setVisible(f.el, false);
  mount(f.el, model);
  clock.run(5);
  assert.equal(log.steps, 1);
  assert.deepEqual(clock.pending, { timers: 0, frames: 0 });
  setVisible(f.el, true);
  clock.run(4);
  assert.equal(log.steps, 5);
});

// Controles ------------------------------------------------------------------------------------------------------

test("un deslizador cambia el parámetro, su valor visible, aria-valuetext y la lectura", () => {
  const { model, log } = spy();
  const f = build(demoSpec());
  mount(f.el, model);
  const rate = f.control("rate");
  setControl(rate, 7);
  clock.frame();
  assert.equal(log.last["rate"], 7);
  assert.deepEqual(log.changed, ["rate"]);
  assert.equal(rate.getAttribute("aria-valuetext"), "7 requests per second");
  assert.equal(f.q(".isofig-value").textContent, "7 req/s");
  assert.equal(f.q(".isofig-readout").textContent, "rate 7");
  clock.frame();
  assert.deepEqual(log.changed, ["rate"], "el cambio se ve en un solo paso");
});

test("un interruptor vale 1 o 0, y un grupo de opciones, el índice de la elegida", () => {
  const { model, log } = spy();
  const f = build(demoSpec());
  mount(f.el, model);
  const on = f.control("on");
  setControl(on, 1);
  clock.frame();
  assert.equal(log.last["on"], 1);
  setControl(on, 0);
  clock.frame();
  assert.equal(log.last["on"], 0);

  const radios = f.all<HTMLInputElement>('input[type="radio"][data-param="mode"]');
  assert.equal(radios.length, 3);
  setControl(radios[2]!, 1);
  clock.frame();
  assert.equal(log.last["mode"], 2);
  assert.deepEqual(radios.map((r) => r.checked), [false, false, true]);
  assert.deepEqual(log.changed, ["on", "on", "mode"]);
});

test("una acción suma 1 por clic y el modelo la ve pulsada solo en el paso siguiente", () => {
  const { model, log } = spy();
  const f = build(demoSpec());
  mount(f.el, model);
  const kick = f.control("kick");
  kick.click();
  kick.click();
  clock.frame();
  assert.equal(log.last["kick"], 2);
  assert.deepEqual(log.pressed, ["kick"]);
  clock.run(3);
  assert.deepEqual(log.pressed, ["kick"], "no queda pulsada");
});

test("si el runtime monta tarde, manda lo que el lector ya movió en la página", () => {
  const { model, log } = spy();
  const f = build(demoSpec());
  f.control("rate").value = "9";
  f.control("on").checked = true;
  f.all<HTMLInputElement>('input[type="radio"]')[1]!.checked = true;
  mount(f.el, model);
  assert.equal(log.initParams[0]!["rate"], 9);
  assert.equal(log.initParams[0]!["on"], 1);
  assert.equal(log.initParams[0]!["mode"], 1);
  assert.equal(log.initParams[0]!["kick"], 0);
});

test("un parámetro oculto llega al modelo con su valor y no tiene control", () => {
  const { model, log } = spy();
  const spec = demoSpec();
  spec.params!.push({ id: "secret", label: "Secret", min: 0, max: 9, value: 4, hidden: true });
  const f = build(spec);
  mount(f.el, model);
  assert.equal(f.all('[data-param="secret"]').length, 0);
  assert.equal(log.initParams[0]!["secret"], 4);
});

// Desvíos --------------------------------------------------------------------------------------------------------

test("un desvío fija sus valores, muestra su nota y pulsa sus acciones; los controles lo reflejan", () => {
  const { model, log } = spy();
  const f = build(demoSpec());
  mount(f.el, model);
  f.preset(0).click();
  assert.equal(f.q(".isofig-note").textContent, "Look at the bar");
  assert.equal(f.control("rate").value, "8");
  assert.equal(f.q(".isofig-value").textContent, "8 req/s");
  clock.frame();
  assert.equal(log.last["rate"], 8);
  assert.equal(log.last["kick"], 1);
  assert.deepEqual(log.pressed, ["kick"]);
  assert.deepEqual(log.changed, ["rate", "kick"], "pulsar una acción también cuenta como cambiarla");
  f.preset(0).click();
  clock.frame();
  assert.equal(log.last["kick"], 2, "pulsarlo otra vez vuelve a pulsar la acción");
  assert.deepEqual(log.changed, ["rate", "kick", "kick"], "pero rate ya valía 8: no cuenta como cambio");
});

test("un desvío con reset reinicia el modelo con los valores nuevos y solo después pulsa", () => {
  const { model, log } = spy();
  const f = build(demoSpec({ presets: [{ label: "Both", values: { rate: 5 }, note: "n", reset: true, press: ["kick"] }] }));
  mount(f.el, model);
  assert.equal(log.inits, 1);
  f.preset(0).click();
  assert.equal(log.inits, 2);
  assert.equal(log.initParams[1]!["rate"], 5);
  assert.equal(log.initParams[1]!["kick"], 0, "init corre antes de que el desvío pulse");
  clock.frame();
  assert.deepEqual(log.pressed, ["kick"]);
  assert.equal(log.last["kick"], 1);
});

test("pulsar un desvío con la figura en pausa la pone a correr", () => {
  const { model, log } = spy();
  const f = build(demoSpec({ autoplay: false }));
  mount(f.el, model);
  clock.run(3);
  assert.equal(f.q(".isofig-play").textContent, "Play");
  const before = log.steps;
  f.preset(1).click();
  assert.equal(f.q(".isofig-play").textContent, "Pause");
  clock.run(3);
  assert.equal(log.steps, before + 3);
});

// Avisos con ctx.say y view.say ----------------------------------------------------------------------------------

test("view.say calla hasta que el lector toca la figura", () => {
  const { model } = spy({ say: () => "evento" });
  const f = build(demoSpec());
  mount(f.el, model);
  const said = voice(f);
  clock.run({ ms: 4000 });
  assert.deepEqual(said, []);
  f.control("kick").click();
  clock.run({ ms: 1400 });
  assert.deepEqual(said, [], "habla tras un silencio de 1,5 s");
  clock.run({ ms: 300 });
  assert.deepEqual(said, ["evento"]);
});

test("cada interacción habilita como mucho dos avisos; el tercero espera a que el lector vuelva a tocar", () => {
  let current = "";
  const { model } = spy({ say: () => current });
  const f = build(demoSpec());
  mount(f.el, model);
  const said = voice(f);
  f.control("kick").click();
  current = "uno";
  clock.run({ ms: 1700 });
  current = "dos";
  clock.run({ ms: 1700 });
  assert.deepEqual(said, ["uno", "dos"]);
  current = "tres";
  clock.run({ ms: 5000 });
  assert.deepEqual(said, ["uno", "dos"], "sin tocar de nuevo, calla");
  f.control("kick").click();
  clock.run({ ms: 1700 });
  assert.deepEqual(said, ["uno", "dos", "tres"]);
  f.control("kick").click();
  clock.run({ ms: 3000 });
  assert.deepEqual(said, ["uno", "dos", "tres"], "el mismo texto no se repite");
});

test("un aviso no pisa la nota de un desvío: espera a que pase su silencio de 2,5 s", () => {
  const { model } = spy({ say: () => "algo pasó" });
  const f = build(demoSpec());
  mount(f.el, model);
  const said = voice(f);
  f.preset(0).click();
  assert.equal(f.q(".isofig-note").textContent, "Look at the bar");
  clock.run({ ms: 2400 });
  assert.deepEqual(said, [], "pasó 1,5 s, pero la nota aún se está leyendo");
  clock.run({ ms: 300 });
  assert.deepEqual(said, ["algo pasó"]);
  assert.equal(f.q(".isofig-note").textContent, "Look at the bar");
});

test("ctx.say se anuncia una vez: si el eco de la lectura lo pisa, llega después y no se repite", () => {
  const f = build(demoSpec());
  const model: Model<{ t: number }, any> = {
    init: () => ({ t: 0 }),
    step(s, dt, _p, ctx) {
      if (ctx.pressed("kick")) ctx.say("se cayó la base");
      s.t += dt;
    },
    view: () => ({ readout: "lectura" }),
  };
  mount(f.el, model);
  const said = voice(f);
  clock.frame();
  setControl(f.control("rate"), 2);
  f.control("kick").click();
  clock.run({ ms: 6000 });
  assert.deepEqual(said, ["lectura", "se cayó la base"]);
});

// settle y movimiento reducido ---------------------------------------------------------------------------------

test("con movimiento reducido, settle simula de golpe al montar y tras cada control o desvío, y no corre solo", () => {
  motion.reduced = true;
  const { model, log } = spy();
  const f = build(demoSpec({ motion: { settle: 2 } }));
  mount(f.el, model);
  assert.equal(log.steps, 120);
  assert.equal(f.q(".isofig-play").textContent, "Play", "con movimiento reducido no arranca sola");
  setControl(f.control("rate"), 4);
  assert.equal(log.steps, 240);
  f.control("kick").click();
  assert.equal(log.steps, 360);
  f.preset(0).click();
  assert.equal(log.steps, 480);
  clock.run(5);
  assert.equal(log.steps, 480, "los cuadros no simulan nada más");
  assert.equal(bar(f).getAttribute("transform"), f.translate(40), "y el dibujo salta al estado asentado, sin interpolar");
});

test("sin settle, un desvío simula 8 s con movimiento reducido y un control, nada", () => {
  motion.reduced = true;
  const { model, log } = spy();
  const f = build(demoSpec());
  mount(f.el, model);
  setControl(f.control("rate"), 4);
  f.control("kick").click();
  assert.equal(log.steps, 0);
  f.preset(1).click();
  assert.equal(log.steps, 480);
});

test("el cambio en vivo de prefers-reduced-motion detiene o reanuda la animación y llega a ctx.reducedMotion", () => {
  const { model, log } = spy();
  const f = build(demoSpec({ motion: { settle: 1 } }));
  mount(f.el, model);
  clock.run(5);
  assert.equal(log.steps, 5);
  assert.equal(log.reduced, false);
  assert.equal(f.q(".isofig-play").textContent, "Pause");
  setControl(f.control("rate"), 10);
  clock.run(3);
  const mid = Math.abs(shift(bar(f).getAttribute("transform")));
  assert.ok(mid > 0 && mid < Math.abs(shift(f.translate(50))), "a medio camino del objetivo");

  motion.set(true);
  assert.equal(f.q(".isofig-play").textContent, "Play");
  assert.equal(log.steps, 5 + 3 + 60, "settle de 1 s de golpe");
  assert.equal(log.reduced, true);
  clock.frame();
  assert.equal(bar(f).getAttribute("transform"), f.translate(50), "salta al objetivo");
  clock.run(4);
  assert.equal(log.steps, 68, "ya no corre sola");

  motion.set(false);
  assert.equal(f.q(".isofig-play").textContent, "Pause");
  clock.run(3);
  assert.equal(log.steps, 71);
  assert.equal(log.reduced, false);
});

test("al detenerla, la figura deja de oír los cambios de movimiento reducido", () => {
  const { model, log } = spy();
  const f = build(demoSpec({ motion: { settle: 1 } }));
  const stop = mount(f.el, model);
  assert.equal(motion.listeners.size, 1);
  stop();
  assert.equal(motion.listeners.size, 0);
  motion.set(true);
  assert.equal(log.steps, 0);
});

// Pausa ----------------------------------------------------------------------------------------------------------

test("el botón de pausa detiene y reanuda la simulación y cambia su texto, pero la vista sigue respondiendo", () => {
  const { model, log } = spy();
  const f = build(demoSpec());
  mount(f.el, model);
  const play = f.q(".isofig-play");
  assert.equal(play.textContent, "Pause");
  clock.run(3);
  assert.equal(log.steps, 3);

  play.click();
  assert.equal(play.textContent, "Play");
  clock.run(5);
  assert.equal(log.steps, 3);
  setControl(f.control("rate"), 6);
  clock.run({ ms: 3000 });
  assert.equal(log.steps, 3, "en pausa, mover un control no hace correr el modelo");
  assert.equal(f.q(".isofig-readout").textContent, "rate 6");
  assert.equal(bar(f).getAttribute("transform"), f.translate(30), "pero el dibujo sí va a su nuevo objetivo");

  play.click();
  assert.equal(play.textContent, "Pause");
  clock.run(4);
  assert.equal(log.steps, 7);
});

test("pausar cuenta como tocar la figura: desde entonces los avisos del modelo se oyen", () => {
  const { model } = spy({ say: () => "aviso" });
  const f = build(demoSpec());
  mount(f.el, model);
  const said = voice(f);
  clock.run({ ms: 2000 });
  assert.deepEqual(said, []);
  f.q(".isofig-play").click();
  clock.run({ ms: 2000 });
  assert.deepEqual(said, ["aviso"]);
});

test("una figura sin autoplay arranca en pausa y su botón dice «Play»", () => {
  const { model, log } = spy();
  const f = build(demoSpec({ autoplay: false }));
  mount(f.el, model);
  clock.run(4);
  assert.equal(f.q(".isofig-play").textContent, "Play");
  assert.equal(log.steps, 0);
  f.q(".isofig-play").click();
  assert.equal(f.q(".isofig-play").textContent, "Pause");
  clock.run(2);
  assert.equal(log.steps, 2);
});

// Estado del grupo -----------------------------------------------------------------------------------------------

test("el estado del grupo (ok, warn, fail) tiñe sus piezas y se quita cuando el modelo deja de pedirlo", () => {
  let state: "ok" | "warn" | "fail" | undefined = "warn";
  const model: Model<null, any> = { init: () => null, view: () => ({ groups: { bar: { ...(state ? { s: state } : {}) } } }) };
  const f = build(demoSpec());
  mount(f.el, model);
  clock.frame();
  assert.equal(bar(f).dataset["state"], "warn");
  state = "fail";
  clock.frame();
  assert.equal(bar(f).dataset["state"], "fail");
  state = undefined;
  clock.frame();
  assert.equal("state" in bar(f).dataset, false);
});

test("un grupo con spin gira dentro de su plano alrededor de su centro: 180° es un reflejo respecto del centro proyectado", () => {
  motion.reduced = true;
  const spec = demoSpec();
  spec.parts!.push({ id: "wheel", kind: "cylinder", at: [90, 35, 6], r: 12, h: 4, axis: "z", group: "wheel", tone: "hi" });
  spec.groups!["wheel"] = { spin: { center: [90, 35, 6], plane: "xy" } };
  const f = build(spec);
  let angle = 0;
  const model: Model<null, any> = { init: () => null, view: () => ({ groups: { wheel: { r: angle } } }) };
  mount(f.el, model);
  clock.frame();
  const wheel = () => f.q('[data-g="wheel"]');
  assert.equal(wheel().getAttribute("transform"), null, "sin giro, sin transformación");

  angle = 180;
  setControl(f.control("rate"), 2);
  clock.frame();
  const [a, b, c, d, e, g] = /matrix\(([^)]*)\)/.exec(wheel().getAttribute("transform")!)![1]!.split(" ").map(Number) as [number, number, number, number, number, number];
  const [cx, cy] = f.data.spins["wheel"]!.slice(4) as [number, number];
  for (const [got, want] of [[a, -1], [b, 0], [c, 0], [d, -1], [e, 2 * cx], [g, 2 * cy]] as const) assert.ok(Math.abs(got - want) < 0.01, `${got} ≠ ${want}`);

  angle = 0;
  setControl(f.control("rate"), 2);
  clock.frame();
  assert.equal(wheel().getAttribute("transform"), null, "volver a 0 quita la transformación");
});
