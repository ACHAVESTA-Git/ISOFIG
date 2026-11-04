import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contrast, deltaE, parseColor, VISIONS, type Linear } from "../src/core/palette/color.ts";
import { measureSet, reservedOf, worstOf } from "../src/core/palette/guarantees.ts";
import { MATERIALS, ROLES } from "../src/core/palette/sets.ts";
import { faceOf, MODES, type Mode, type ThemeColors } from "../src/core/palette/theme.ts";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const theme = read("../src/theme/theme.css");
const luxe = read("../src/theme/luxe.css");

type Tokens = Record<string, string>;

/** Las declaraciones `--isofig-*` del bloque que sigue a `marker` (la primera aparición, o todas con `all`). */
function tokensAfter(css: string, marker: string, all = false): Tokens {
  const out: Tokens = {};
  for (let from = css.indexOf(marker); from >= 0; from = all ? css.indexOf(marker, from + 1) : -1) {
    const open = css.indexOf("{", from);
    const body = css.slice(open + 1, css.indexOf("}", open));
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[name] = value.replace(/\s+/g, " ").trim();
  }
  return out;
}

const atelier = tokensAfter(luxe, ":where(.isofig-luxe .isofig, .isofig.isofig-luxe)");
const nocturneMedia = tokensAfter(luxe, ':root:not([data-theme="light"]) :is(.isofig-luxe .isofig');
const nocturneAttr = tokensAfter(luxe, ':root[data-theme="dark"] :is(.isofig-luxe .isofig');
const themeBase = tokensAfter(theme, ":where(.isofig) {", true);
const themeDark = tokensAfter(theme, ':where(:root[data-theme="dark"] .isofig)');

/** Los tokens que ve una figura: el tema, luego Atelier (que vale en los dos modos) y, en oscuro, Nocturne. */
const effective: Record<Mode, Tokens> = {
  light: { ...themeBase, ...atelier },
  dark: { ...themeBase, ...themeDark, ...atelier, ...nocturneAttr },
};

function resolve(tokens: Tokens, name: string): string {
  const value = tokens[name];
  assert.ok(value, `falta ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  return ref ? resolve(tokens, ref[1]) : value;
}

/** `light-dark(a, b)` → el valor del modo; cualquier otro valor se devuelve tal cual. */
function pick(value: string, mode: Mode): string {
  const m = /^light-dark\((.*)\)$/.exec(value);
  if (!m) return value;
  let depth = 0;
  for (let i = 0; i < m[1].length; i++) {
    const c = m[1][i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) return (mode === "light" ? m[1].slice(0, i) : m[1].slice(i + 1)).trim();
  }
  throw new Error(`light-dark() sin coma: ${value}`);
}

const color = (mode: Mode, name: string): Linear => parseColor(pick(resolve(effective[mode], name), mode));
const themeOf = (mode: Mode): ThemeColors => ({
  paper: pick(resolve(effective[mode], "--isofig-paper"), mode),
  card: pick(resolve(effective[mode], "--isofig-card"), mode),
  edge: pick(resolve(effective[mode], "--isofig-edge"), mode),
  light: pick(resolve(effective[mode], "--isofig-light"), mode),
  shade: pick(resolve(effective[mode], "--isofig-shade"), mode),
  accent: pick(resolve(effective[mode], "--isofig-accent"), mode),
  ok: pick(resolve(effective[mode], "--isofig-ok"), mode),
  warn: pick(resolve(effective[mode], "--isofig-warn"), mode),
  fail: pick(resolve(effective[mode], "--isofig-fail"), mode),
  // Las dos tintas del texto grabado: espresso (la misma del acento) y marfil (la de la goma).
  inks: { dark: pick(resolve(effective[mode], "--isofig-on-accent"), mode), light: pick(resolve(effective[mode], "--isofig-paint-rubber-ink"), mode) },
});

const paintSet = (names: string[], mode: Mode) => names.map((name) => ({ name, color: color(mode, `--isofig-paint-${name}`) }));
const ROLE_NAMES = ROLES.map((p) => p.name);
const MATERIAL_NAMES = MATERIALS.map((p) => p.name);

test("Atelier y Nocturne definen los mismos tokens, y las dos reglas de Nocturne son idénticas", () => {
  assert.deepEqual(nocturneMedia, nocturneAttr, "prefers-color-scheme y data-theme=dark deben pintar igual");
  for (const name of Object.keys(nocturneAttr)) {
    if (name.startsWith("--isofig-paint-")) continue;
    assert.ok(name in atelier, `${name} está en Nocturne pero no en Atelier`);
  }
  // Lo que Atelier fija y Nocturne no repite es a propósito: tinta sobre color, radio, serif y el foco (que sigue al acento).
  const shared = Object.keys(atelier).filter((n) => !(n in nocturneAttr) && !n.startsWith("--isofig-paint-"));
  assert.deepEqual(shared.sort(), ["--isofig-focus", "--isofig-ink-on-color", "--isofig-luxe-serif", "--isofig-on-accent", "--isofig-radius"]);
});

test("luxe.css no carga nada de fuera y todas sus reglas valen lo mismo que las de theme.css o menos", () => {
  assert.doesNotMatch(luxe, /@import|@font-face|url\(|https?:/);
  const selectors = [...luxe.matchAll(/(?:^|[}{;])\s*([^{}@;]+)\{/g)].map((m) => m[1].trim());
  assert.ok(selectors.length > 10);
  for (const selector of selectors) {
    const parts = selector.split(/,\s*(?=:where\()/);
    for (const part of parts) assert.ok(part.startsWith(":where("), `«${part}» no empieza por :where(`);
  }
});

test("el estilo de lujo conserva las garantías de la paleta: texto, canto y ΔE entre pinturas, también con daltonismo", () => {
  for (const mode of MODES) {
    const t = themeOf(mode);
    const reserved = reservedOf(mode, undefined, t).slice(0, 1);
    const materials = measureSet(paintSet(MATERIAL_NAMES, mode), mode, reserved, t);
    assert.deepEqual(materials.failures, [], `materiales en ${mode}`);
    const roles = measureSet(paintSet(ROLE_NAMES, mode), mode, reserved, t);
    assert.deepEqual(roles.failures, [], `roles en ${mode}`);
    for (const m of [materials, roles]) {
      const worst = worstOf(m);
      assert.ok(worst.text >= 4.5 && worst.edge >= 3 && worst.normal >= 10 && worst.cvd >= 6, JSON.stringify(worst));
    }
  }
});

test("la tinta de cada pintura (la declarada, no la mejor posible) se lee sobre su tapa en los dos modos", () => {
  for (const mode of MODES) {
    const t = themeOf(mode);
    for (const name of [...MATERIAL_NAMES, ...ROLE_NAMES]) {
      const top = faceOf(color(mode, `--isofig-paint-${name}`), "t", mode, t);
      const ink = color(mode, `--isofig-paint-${name}-ink`);
      assert.ok(contrast(ink, top) >= 4.5, `${name} en ${mode}: ${contrast(ink, top).toFixed(2)}:1`);
    }
  }
});

test("el acento y los estados: la tinta se lee sobre su tapa y el acento no se confunde con un estado", () => {
  for (const mode of MODES) {
    const t = themeOf(mode);
    const accentTop = faceOf(parseColor(t.accent), "t", mode, t);
    assert.ok(contrast(color(mode, "--isofig-on-accent"), accentTop) >= 4.5, `acento en ${mode}`);
    // La misma tinta sobre el acento liso: es la etiqueta del selector marcado.
    assert.ok(contrast(color(mode, "--isofig-on-accent"), parseColor(t.accent)) >= 4.5, `selector marcado en ${mode}`);
    for (const state of ["ok", "warn", "fail"] as const) {
      const c = parseColor(t[state]);
      const k = contrast(color(mode, "--isofig-ink-on-color"), faceOf(c, "t", mode, t));
      assert.ok(k >= 4.5, `${state} en ${mode}: ${k.toFixed(2)}:1`);
      for (const v of VISIONS) {
        const d = deltaE(parseColor(t.accent), c, v);
        assert.ok(d >= (v === "normal" ? 10 : 6), `acento ~ ${state} (${v}, ${mode}): ΔE ${d.toFixed(1)}`);
      }
    }
  }
});

test("el texto de la tarjeta y de los controles contrasta, y el foco y el pulgar se ven frente a la tarjeta", () => {
  for (const mode of MODES) {
    const c = (name: string) => color(mode, name);
    for (const bg of ["--isofig-card", "--isofig-paper", "--isofig-chip"]) {
      assert.ok(contrast(c("--isofig-ink"), c(bg)) >= 7, `tinta sobre ${bg} en ${mode}`);
      assert.ok(contrast(c("--isofig-ink-soft"), c(bg)) >= 4.5, `tinta suave sobre ${bg} en ${mode}`);
    }
    // WCAG 1.4.11: el aro de foco (el acento) y el canto de las piezas, contra lo que tienen detrás.
    for (const bg of ["--isofig-card", "--isofig-paper"]) {
      assert.ok(contrast(c("--isofig-focus"), c(bg)) >= 3, `foco sobre ${bg} en ${mode}: ${contrast(c("--isofig-focus"), c(bg)).toFixed(2)}`);
      assert.ok(contrast(c("--isofig-edge"), c(bg)) >= 3, `canto sobre ${bg} en ${mode}`);
    }
    for (const tone of ["--isofig-lo", "--isofig-mid", "--isofig-hi"]) {
      assert.ok(contrast(c("--isofig-edge"), c(tone)) >= 3, `canto sobre ${tone} en ${mode}`);
    }
  }
});

test("Atelier es claro y Nocturne oscuro, y cada uno trae su propio acento", () => {
  const luminance = (c: Linear) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  assert.ok(luminance(color("light", "--isofig-card")) > 0.8);
  assert.ok(luminance(color("dark", "--isofig-card")) < 0.02);
  assert.notEqual(atelier["--isofig-accent"], nocturneAttr["--isofig-accent"]);
  // El acento de lujo no es el verde del tema estándar.
  assert.notEqual(effective.light["--isofig-accent"], themeBase["--isofig-accent"]);
});
