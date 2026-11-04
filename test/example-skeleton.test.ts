import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assemble } from "../src/core/tree.ts";
import { drawScene, poseOf } from "../src/core/scene.ts";
import { project } from "../src/core/camera.ts";
import { renderFigure } from "../src/core/render.ts";
import { endsOf, isRound, isSolid } from "../src/core/items.ts";
import type { FigureSpec, Part } from "../src/core/spec.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = resolve(root, "examples/sistema-oseo/spec.json");
const spec: FigureSpec = JSON.parse(readFileSync(file, "utf8"));
const flat = assemble(spec);

const PIEZAS = ["Cráneo", "Columna vertebral", "Caja torácica", "Cintura escapular", "Brazo", "Antebrazo", "Mano", "Pelvis", "Muslo", "Rótula", "Pierna", "Pie"];
const PARTS = ["Skull", "Vertebral column", "Rib cage", "Shoulder girdle", "Upper arm", "Forearm", "Hand", "Pelvis", "Thigh", "Kneecap", "Lower leg", "Foot"];

const solids = flat.parts.filter(isSolid);
/** Los sólidos cuya ruta (id completo) cumple `re`. */
const idsOf = (re: RegExp) => solids.filter((p) => re.test(p.id));
const only = (id: string) => {
  const p = flat.parts.find((q) => q.id === id);
  assert.ok(p, `falta ${id}`);
  return p;
};

test("el sistema óseo se arma sin errores ni avisos, en los dos idiomas, y sale igual dos veces", () => {
  for (const lang of ["es", "en"]) {
    const a = renderFigure(spec, { lang });
    assert.deepEqual(a.errors, [], lang);
    assert.deepEqual(a.warnings, [], lang);
    assert.equal(renderFigure(spec, { lang }).html, a.html, `${lang}: no es determinista`);
    assert.match(a.html, /data-param="explode"/);
    assert.match(a.html, /name="[^"]+-pick"/);
  }
});

test("check --strict sale limpio y la figura entra en su presupuesto de peso", () => {
  const r = spawnSync(process.execPath, ["--no-warnings", resolve(root, "src/cli/index.ts"), "check", file, "--strict", "--lang", "es"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout + r.stderr, /aviso|error|warning/i);
  const kb = /(\d+(?:\.\d+)?) KB gzip/.exec(r.stdout + r.stderr);
  assert.ok(kb, "el check informa el peso");
  assert.ok(Number(kb[1]) <= (spec.budget ?? 40), `${kb[1]} KB gzip`);
});

test("la lista «Pieza» trae las doce entradas, en el orden del cuerpo, con nombre y nota en los dos idiomas", () => {
  const pick = flat.params!.find((p) => p.id === "pick")!;
  const names = (lang: string) => (pick.options as (string | Record<string, string>)[]).slice(1).map((o) => (typeof o === "string" ? o : o[lang]));
  assert.deepEqual(names("es"), PIEZAS);
  assert.deepEqual(names("en"), PARTS);
  assert.equal(pick.max, PIEZAS.length);
  // Cada texto de la lectura trae el nombre y una nota con un dato (no solo el nombre).
  const texts = pick.texts as Record<string, string>[];
  for (let k = 1; k < texts.length; k++) {
    for (const lang of ["es", "en"]) {
      const [name, note] = texts[k]![lang]!.split(" · ");
      assert.ok(note && note.length > 25, `${name} (${lang}): falta la nota`);
    }
  }
});

test("el despiece cuenta la historia en siete pasos, con su texto en los dos idiomas", () => {
  const explode = flat.params!.find((p) => p.id === "explode")!;
  assert.equal(explode.max, 7);
  const texts = explode.texts as Record<string, string>[];
  assert.deepEqual(texts.map((t) => t["es"]), [
    "Armado",
    "Paso 1 de 7: el cráneo y la mandíbula suben",
    "Paso 2 de 7: las cinturas escapulares se abren a los lados",
    "Paso 3 de 7: los brazos se sueltan: húmero, antebrazo y mano",
    "Paso 4 de 7: la caja torácica avanza",
    "Paso 5 de 7: la pelvis avanza con el sacro y el cóccix",
    "Paso 6 de 7: los fémures y las rótulas salen a los lados",
    "Paso 7 de 7: las tibias y los peronés se elevan y se abren",
  ]);
  assert.match(texts[1]!["en"]!, /^Step 1 of 7: the skull and the jaw rise$/);
  assert.equal(flat.reorder!.at.length, 7, "el orden de pintado se recalcula en cada paso");
});

test("el despiece cabe en el marco en cada pose, con el margen que pide la figura", () => {
  const scene = drawScene(flat, "es");
  const W = flat.width ?? 640;
  const H = flat.height ?? 400;
  const pad = flat.pad ?? 24;
  const reach = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  // El círculo de una pieza redonda cabe exacto (lo mismo que mide la cámara): sus extremos, no las esquinas de su caja.
  const outline = (item: (typeof scene.items)[number]): [number, number, number][] => {
    const s = item.solid;
    if (isRound(s)) return endsOf(s).flatMap((p) => [scene.cam.right, scene.cam.down].flatMap((v) => [1, -1].map((k): [number, number, number] => [p[0] + k * s.r * v[0], p[1] + k * s.r * v[1], p[2] + k * s.r * v[2]])));
    const { min, max } = item.box;
    return [min[0], max[0]].flatMap((x) => [min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z): [number, number, number] => [x, y, z])));
  };
  for (let value = 0; value <= 7; value++) {
    const pose = poseOf(flat, "explode", value);
    for (const item of scene.items) {
      const d = [0, 1, 2].map((i) => (pose.get(item.group ?? "")?.[i] ?? 0) + (pose.get(item.outer ?? "")?.[i] ?? 0));
      for (const [x, y, z] of outline(item)) {
        const [px, py] = project(scene.cam, [x + d[0]!, y + d[1]!, z + d[2]!]);
        assert.ok(px >= pad - 1 && px <= W - pad + 1 && py >= pad - 1 && py <= H - pad + 1, `${item.id} sale del marco en el paso ${value}: ${px.toFixed(1)}, ${py.toFixed(1)}`);
        reach.x0 = Math.min(reach.x0, px);
        reach.x1 = Math.max(reach.x1, px);
        reach.y0 = Math.min(reach.y0, py);
        reach.y1 = Math.max(reach.y1, py);
      }
    }
  }
  // Y el marco se aprovecha: el despiece llega a los bordes de su margen por arriba y por abajo.
  assert.ok(reach.y1 - reach.y0 > (H - 2 * pad) * 0.97, "el marco queda grande para la figura");
  assert.deepEqual(scene.cycles, []);
});

test("lo que la lámina nombra está dibujado: 24 vértebras, 23 discos, 12 pares de costillas, 27 huesos por mano y 26 por pie", () => {
  // Columna: atlas + C2 a C7, 12 torácicas y 5 lumbares (el sacro y el cóccix van con la pelvis).
  assert.equal(idsOf(/^columna\.cervical\.(atlas|cuerpo-\d+)$/).length, 7);
  assert.equal(idsOf(/^columna\.toracica-(alta|baja)\.cuerpo-\d+$/).length, 12);
  assert.equal(idsOf(/^columna\.lumbar\.cuerpo-\d+$/).length, 5);
  assert.equal(idsOf(/^columna\..*\.disco-\d+$/).length, 23);
  assert.ok(only("pelvis.sacro") && only("pelvis.coxis"));
  // Caja torácica: las costillas 1 a 12 de los dos lados; 7 verdaderas con su cartílago al esternón, 3 falsas, 2 flotantes.
  const ribs = new Set(idsOf(/^costillas\.costilla-\d+[di]-0$/).map((p) => p.id.replace(/^costillas\.costilla-|-0$/g, "")));
  assert.equal(ribs.size, 24);
  for (let n = 1; n <= 12; n++) assert.ok(ribs.has(`${n}d`) && ribs.has(`${n}i`), `costilla ${n}`);
  const cartilage = (re: RegExp) => idsOf(re).length;
  assert.equal(cartilage(/^costillas\.cartilago-[1-7][di]$/), 14);
  assert.equal(cartilage(/^costillas\.cartilago-(8|9|10)[di]$/), 6);
  assert.equal(cartilage(/^costillas\.cartilago-(11|12)[di]$/), 0, "las flotantes no tienen cartílago");
  assert.ok(only("costillas.esternon.manubrio") && only("costillas.esternon.xifoides"));
  assert.equal(idsOf(/^costillas\.esternon\.cuerpo-\d+$/).length, 4);
  // Manos y pies, con todos sus huesos.
  for (const side of ["d", "i"]) {
    assert.equal(idsOf(new RegExp(`\\.mano-${side}\\.`)).length, 27, `mano ${side}`);
    assert.equal(idsOf(new RegExp(`^pie-${side}\\.`)).length, 26, `pie ${side}`);
  }
  // Las notas dicen lo mismo que el dibujo.
  const note = (name: string, lang = "es") => {
    const pick = flat.params!.find((p) => p.id === "pick")!;
    const t = (pick.texts as (string | Record<string, string>)[]).find((x) => typeof x === "object" && x[lang]!.startsWith(`${name} · `)) as Record<string, string>;
    return t[lang]!;
  };
  assert.match(note("Mano"), /27 huesos/);
  assert.match(note("Pie"), /26 huesos/);
  assert.match(note("Columna vertebral"), /7 cervicales, 12 torácicas y 5 lumbares.*23 discos/);
  assert.match(note("Caja torácica"), /12 pares.*7 verdaderas, 3 falsas y 2 flotantes/);
  assert.match(String(spec.caption && (spec.caption as Record<string, string>)["es"]), /206 huesos.*106/);
});

test("la figura mide cerca de 180 en z y los huesos largos guardan su orden: fémur, tibia, húmero, cúbito, radio", () => {
  // La raíz se apoya sobre una peana de 6: la altura del esqueleto es lo que sobra por encima de ella.
  const top = Math.max(...scene().items.filter((i) => !i.id.startsWith("peana")).map((i) => i.box.max[2])) - 6;
  assert.ok(top > 172 && top < 184, `alto ${top}`);
  // Cada hueso, de punta a punta en z (las cajas de las piezas redondas son exactas).
  const reachZ = (re: RegExp) => {
    const own = scene().items.filter((i) => re.test(i.id));
    assert.ok(own.length > 1, String(re));
    return Math.max(...own.map((i) => i.box.max[2])) - Math.min(...own.map((i) => i.box.min[2]));
  };
  const femur = reachZ(/^muslo-d\.(cabeza|cuello|trocanter-mayor|diafisis|condilo-lat|condilo-med)-d$/);
  const tibia = reachZ(/^pierna-d\.(meseta|diafisis|distal|maleolo-medial)-d$/);
  const humero = reachZ(/^hombro-d\.brazo-d\.(cabeza|diafisis|condilos)-d$/);
  const cubito = reachZ(/^hombro-d\.brazo-d\.antebrazo-d\.(cubito|olecranon|cubito-cabeza)-d$/);
  const radio = reachZ(/^hombro-d\.brazo-d\.antebrazo-d\.radio-.*-d$/);
  assert.ok(femur > tibia && tibia > humero && humero > cubito && cubito > radio, `${femur} ${tibia} ${humero} ${cubito} ${radio}`);
  assert.ok(femur / top > 0.24 && femur / top < 0.28, `el fémur mide ${(femur / top).toFixed(3)} de la estatura: «cerca de un cuarto»`);
  // La izquierda es el espejo de la derecha.
  for (const [r, l] of [["muslo-d.diafisis-d", "muslo-i.diafisis-i"], ["hombro-d.brazo-d.diafisis-d", "hombro-i.brazo-i.diafisis-i"]] as const) {
    const a = only(r) as Extract<Part, { kind: "capsule" }>;
    const b = only(l) as Extract<Part, { kind: "capsule" }>;
    assert.equal(a.h, b.h);
    assert.equal(a.at[0], -b.at[0]);
    assert.equal(a.at[2], b.at[2]);
  }
});

let cached: ReturnType<typeof drawScene> | undefined;
function scene() {
  return (cached ??= drawScene(flat, "es"));
}
