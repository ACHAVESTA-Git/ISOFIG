import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build, clock, cleanUp, motion, setControl, win, type Built } from "./dom.ts";
import type { FigureSpec } from "../src/core/spec.ts";
import { assemble, type Catalog } from "../src/core/tree.ts";
import { catalog as kit } from "../src/kit/index.ts";
import { enableOrbit } from "../src/orbit/index.ts";
import { mount, unmountAll } from "../src/runtime/index.ts";

afterEach(() => {
  unmountAll();
  cleanUp();
  motion.reduced = false;
});

// happy-dom no mide SVG: cada pieza dice ocupar un cuadro de 40 × 30 en su sitio de reposo.
Object.defineProperty(win.SVGGraphicsElement.prototype, "getBBox", {
  configurable: true,
  value: () => ({ x: 300, y: 200, width: 40, height: 30 }),
});

const motor = JSON.parse(readFileSync(new URL("../examples/motor-v8/spec.json", import.meta.url), "utf8")) as FigureSpec;
const flat = assemble(motor, { catalog: kit as Catalog });

const box = (f: Built) => f.svg.getAttribute("viewBox")!.split(" ").map(Number);
const choose = (f: Built, n: number) => setControl(f.all<HTMLInputElement>('input[data-param="pick"]')[n]!, 1);
/** Los grupos que muestra la entrada `n` de «Pieza». */
const chosen = (f: Built, n: number) => new Set(f.data.bind!.filter((b) => b.keep?.includes(n)).map((b) => b.group));
const moved = (f: Built) => f.all("[data-g]").filter((n) => n.getAttribute("transform")).length;

test("elegir una pieza la pinta encima, aparta lo demás y acerca la cámara; «Todo» vuelve al encuadre completo", () => {
  motion.reduced = true;
  const f = build(motor);
  mount(f.el);
  clock.run(2);
  const full = box(f);

  choose(f, 2);
  clock.run(2);
  const near = box(f);
  assert.ok(near[2] < full[2] / 2, `se acerca: ${near.join(" ")} frente a ${full.join(" ")}`);
  assert.ok(Math.abs(near[2] / near[3] - full[2] / full[3]) < 1e-3, "con el formato de la figura");
  assert.ok(near[0] >= full[0] && near[0] + near[2] <= full[0] + full[2] + 1e-6, "sin salirse del marco");

  const picked = chosen(f, 2);
  const last = f.q(".isofig-scene").lastElementChild!;
  const g = last.getAttribute("data-g") ?? last.querySelector("[data-g]")?.getAttribute("data-g");
  assert.ok(picked.has(g!), `la última pieza pintada es de la elegida (${g})`);
  const other = f.all("[data-g]").find((n) => !picked.has(n.getAttribute("data-g")!))!;
  assert.equal(other.getAttribute("opacity"), "0.350");

  choose(f, 3);
  clock.run(2);
  assert.equal(f.all("[data-g]").find((n) => picked.has(n.getAttribute("data-g")!) && !chosen(f, 3).has(n.getAttribute("data-g")!))?.getAttribute("opacity"), "0.350", "al elegir otra, la anterior se aparta");
  choose(f, 0);
  clock.run(2);
  assert.deepEqual(box(f), full);
  assert.deepEqual([...new Set(f.all("[data-g]").map((n) => n.getAttribute("opacity")))], ["1"], "con «Todo», nada queda atenuado");
});

test("con movimiento, la cámara viaja hacia la pieza en varios cuadros", () => {
  const f = build(motor);
  mount(f.el);
  clock.run(2);
  const full = box(f);
  choose(f, 3);
  clock.run(2);
  const mid = box(f)[2];
  clock.run({ ms: 3000 });
  const end = box(f)[2];
  assert.ok(end < mid && mid < full[2], `${full[2]} → ${mid} → ${end}`);
});

test("girar la figura desarmada no la vuelve a armar, ni por un cuadro, y conserva el acercamiento", () => {
  motion.reduced = true;
  const f = build(motor, { orbit: true });
  mount(f.el);
  const orbit = enableOrbit(f.el, flat, { lang: "en" });
  clock.run(2);
  setControl(f.control("explode"), 7);
  choose(f, 2);
  clock.run(3);
  const apart = moved(f);
  const near = box(f);
  assert.ok(apart > 10, "el motor está desarmado");

  orbit.turn(20);
  clock.frame();
  assert.equal(moved(f), apart, "en el mismo cuadro en que el giro redibuja, las piezas siguen fuera de su sitio");
  assert.deepEqual(box(f), near, "y la cámara sigue sobre la pieza");
  const last = f.q(".isofig-scene").lastElementChild!;
  const g = last.getAttribute("data-g") ?? last.querySelector("[data-g]")?.getAttribute("data-g");
  assert.ok(chosen(f, 2).has(g!), "la pieza elegida sigue encima tras redibujar");
  orbit.stop();
});
