import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assemble } from "../src/core/tree.ts";
import { renderFigure } from "../src/core/render.ts";
import { buildItems } from "../src/core/items.ts";
import { drawScene, poseOf } from "../src/core/scene.ts";
import { makeCamera, project } from "../src/core/camera.ts";
import type { FigureSpec, Text } from "../src/core/spec.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "examples/muscle-car/spec.json");
const raw = readFileSync(file, "utf8");
const load = (): FigureSpec => JSON.parse(raw);

const PIEZAS = [
  ["Carrocería", "Body"],
  ["Capó y maletera", "Hood and trunk"],
  ["Puertas", "Doors"],
  ["Vidrios", "Glass"],
  ["Asientos y tablero", "Seats and dashboard"],
  ["Motor V8", "V8 engine"],
  ["Caja de cambios", "Gearbox"],
  ["Eje cardán", "Driveshaft"],
  ["Diferencial", "Differential"],
  ["Escape", "Exhaust"],
  ["Ruedas", "Wheels"],
  ["Frenos", "Brakes"],
  ["Chasis y suspensión", "Chassis and suspension"],
];

const PASOS = [
  ["capó y maletera arriba", "hood and trunk lid up"],
  ["puertas fuera", "doors out"],
  ["vidrios fuera", "glass off"],
  ["carrocería arriba", "body up"],
  ["asientos y tablero arriba", "seats and dashboard up"],
  ["motor y radiador arriba", "engine and radiator up"],
  ["caja y cardán arriba", "gearbox and driveshaft up"],
  ["diferencial arriba y escape abajo", "differential up, exhaust down"],
  ["ruedas y frenos fuera", "wheels and brakes out"],
];

const textIn = (t: Text | undefined, lang: string): string => (typeof t === "string" ? t : ((t as Record<string, string> | undefined)?.[lang] ?? ""));

test("el muscle car se arma sin errores ni avisos, entra en el presupuesto y sale igual dos veces", () => {
  for (const lang of ["es", "en"]) {
    const a = renderFigure(load(), { lang });
    assert.deepEqual(a.errors, [], lang);
    assert.deepEqual(a.warnings, [], lang);
    assert.ok(a.bytes < 150 * 1024, `${a.bytes} bytes`);
    assert.equal(renderFigure(load(), { lang }).html, a.html, `${lang}: no es determinista`);
    assert.ok(a.data.reorder && a.data.reorder.poses.length === PASOS.length, "orden de pintado por pose");
    assert.match(a.html, /data-param="explode"/);
    assert.match(a.html, /name="[^"]+-pick"/);
  }
});

test("isofig check --strict lo deja limpio, con el peso incluido", () => {
  const r = spawnSync(process.execPath, ["--no-warnings", join(root, "src/cli/index.ts"), "check", file, "--strict", "--lang", "es"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /aviso|warning|error/i);
  assert.match(r.stderr, /muscle-car: [\d.]+ KB, [\d.]+ KB gzip/);
});

test("la lista «Pieza» tiene las trece entradas, en español y en inglés, cada una con su nota", () => {
  const flat = assemble(load());
  const pick = flat.params!.find((p) => p.id === "pick")!;
  const options = pick.options as Text[];
  assert.equal(options.length, PIEZAS.length + 1);
  assert.deepEqual(options.slice(1).map((o) => textIn(o, "es")), PIEZAS.map((p) => p[0]));
  assert.deepEqual(options.slice(1).map((o) => textIn(o, "en")), PIEZAS.map((p) => p[1]));
  assert.ok(PIEZAS.length >= 9 && PIEZAS.length <= 13);
  // La lectura al elegir una pieza trae su nombre y su nota («Nombre · nota»).
  const texts = pick.texts as Text[];
  for (const lang of ["es", "en"]) {
    texts.slice(1).forEach((t, k) => {
      const [name, note] = textIn(t, lang).split(" · ");
      assert.equal(name, PIEZAS[k][lang === "es" ? 0 : 1]);
      assert.ok(note && note.length > 20, `${name}: sin nota`);
    });
  }
});

test("lo que se repite comparte nombre: cuatro ruedas, cuatro frenos, los dos capós y los cuatro vidrios son una sola entrada", () => {
  const flat = assemble(load());
  const entry = (name: string) => PIEZAS.findIndex((p) => p[0] === name) + 1;
  const groupsOf = (name: string) => flat.bind!.filter((b) => b.param === "pick" && b.keep?.includes(entry(name))).map((b) => b.group);
  const named = (name: string, re: RegExp) => groupsOf(name).filter((g) => re.test(g));
  assert.equal(new Set(named("Ruedas", /^rueda-(izq|der)-[01]$/)).size, 4);
  assert.equal(new Set(named("Frenos", /^freno-(izq|der)-[01]$/)).size, 4);
  assert.deepEqual(named("Capó y maletera", /^carroceria\.(capo|maletera)$/).sort(), ["carroceria.capo", "carroceria.maletera"]);
  assert.equal(new Set(named("Vidrios", /vidrio$|parabrisas$|luneta$/)).size, 4);
  assert.equal(new Set(named("Puertas", /^carroceria\.puerta-(izq|der)$/)).size, 2);
});

test("el despiece son nueve pasos, de fuera hacia dentro, y cada uno se narra", () => {
  const flat = assemble(load());
  const explode = flat.params!.find((p) => p.id === "explode")!;
  assert.equal(explode.max, PASOS.length);
  const texts = explode.texts as Text[];
  for (const [k, lang] of [[0, "es"], [1, "en"]] as const) {
    assert.equal(textIn(texts[0], lang), lang === "es" ? "Armado" : "Assembled");
    PASOS.forEach((p, i) => assert.equal(textIn(texts[i + 1], lang), (lang === "es" ? `Paso ${i + 1} de ${PASOS.length}: ` : `Step ${i + 1} of ${PASOS.length}: `) + p[k]));
  }
  // Primero el capó, la maletera y las puertas; al final, las ruedas y los frenos; el chasis no se mueve.
  const stageOf = (group: string) => flat.bind!.filter((b) => b.group === group && b.param === "explode" && b.win).map((b) => b.win![1]).sort((a, b) => a - b);
  assert.deepEqual(stageOf("carroceria.capo"), [1, 4]);
  assert.deepEqual(stageOf("carroceria.puerta-izq"), [2, 4]);
  assert.deepEqual(stageOf("carroceria"), [4]);
  assert.deepEqual(stageOf("motor"), [6]);
  assert.deepEqual(stageOf("rueda-der-0"), [9]);
  assert.deepEqual(stageOf("freno-izq-1"), [9]);
  assert.deepEqual(stageOf("chasis"), []);
});

test("sale solo con box, cylinder, cone y prism, sin logos ni la marca en ninguna pieza, y con pocos colores", () => {
  assert.doesNotMatch(raw, /chevrolet/i);
  assert.doesNotMatch(raw, /logo|emblem|insignia/i);
  const flat = assemble(load());
  const kinds = new Set(flat.parts.map((p) => p.kind));
  for (const k of kinds) assert.ok(["box", "cylinder", "cone", "prism", "dots", "line", "ticks"].includes(k), `kind ${k}`);
  const paints = new Set(flat.parts.map((p) => (p as { paint?: string }).paint).filter(Boolean));
  const colored = [...paints].filter((p) => !["aluminium", "steel", "iron", "carbon", "rubber"].includes(p!));
  assert.deepEqual(colored.sort(), ["glass", "lacquer"]);
  assert.ok(!flat.parts.some((p) => (p as { tone?: string }).tone === "lit"), "el acento no se usa");
  const spec = load();
  assert.equal(textIn(spec.title, "es"), "Muscle car tipo Camaro");
  assert.equal(textIn(spec.title, "en"), "Camaro-style muscle car");
  assert.match(textIn(spec.caption, "es"), /esquema propio, inspirado en el Camaro de quinta y sexta generación/i);
  assert.match(textIn(spec.caption, "en"), /schematic of our own, inspired by the fifth- and sixth-generation Camaro/i);
});

test("el despiece cabe en el marco en cada pose y, con la escala fija del giro, en todo el giro horizontal", () => {
  const spec = load();
  const flat = assemble(spec);
  const { items } = buildItems(flat.parts);
  const W = spec.width!, H = spec.height!;
  const cam = drawScene(flat, "es").cam;
  const steps = (flat.params!.find((p) => p.id === "explode")!.max as number);
  const corners: [number, number, number][] = [];
  for (let v = 0; v <= steps; v++) {
    const pose = poseOf(flat, "explode", v);
    for (const it of items) {
      const d = [0, 1, 2].map((i) => (pose.get(it.group ?? "")?.[i] ?? 0) + (pose.get(it.outer ?? "")?.[i] ?? 0));
      for (const x of [it.box.min[0], it.box.max[0]]) for (const y of [it.box.min[1], it.box.max[1]]) for (const z of [it.box.min[2], it.box.max[2]]) {
        corners.push([x + d[0], y + d[1], z + d[2]]);
        const [sx, sy] = project(cam, [x + d[0], y + d[1], z + d[2]]);
        assert.ok(sx >= 0 && sx <= W && sy >= 0 && sy <= H, `${it.id} sale del marco en el paso ${v}: ${sx.toFixed(1)}, ${sy.toFixed(1)}`);
      }
    }
  }
  // El giro redibuja con la escala de la cámara de la spec y recentra: el ancho y el alto de todas las poses no pasan del marco.
  const base = flat.camera ?? {};
  for (const azimuth of [(base.azimuth ?? 45) - 40, (base.azimuth ?? 45) - 20, base.azimuth ?? 45, (base.azimuth ?? 45) + 20, (base.azimuth ?? 45) + 40]) {
    const c = makeCamera({ azimuth, elevation: base.elevation }, cam.scale);
    const xs = corners.map((p) => project(c, p)[0]);
    const ys = corners.map((p) => project(c, p)[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    assert.ok(w <= W && h <= H, `a ${azimuth}° la figura mide ${w.toFixed(0)} × ${h.toFixed(0)} y el marco ${W} × ${H}`);
  }
});

test("el orden de pintado no tiene ciclos ni armado ni desarmado, ni girando hasta los extremos del giro (±40°)", () => {
  const flat = assemble(load());
  const base = flat.camera?.azimuth ?? 45;
  for (const azimuth of [base - 40, base - 28, base - 14, base + 14, base + 28, base + 40]) {
    assert.deepEqual(drawScene(flat, "es", { azimuth }).cycles, [], `azimut ${azimuth}`);
  }
});
