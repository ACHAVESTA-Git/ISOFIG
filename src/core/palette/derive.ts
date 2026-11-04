import { contrast, inGamut, labOf, lchOfColor, linearOf, labOfLch, parseColor, simulate, VISIONS, type Lab, type Lch, type Linear } from "./color.ts";
import { LIMITS, inkFor, measureSet, type SetMeasure } from "./guarantees.ts";
import { ROLES } from "./sets.ts";
import { edgeOf, MODES, THEME, type Mode } from "./theme.ts";

export interface RoleColor {
  name: string;
  lch: Lch;
}

export interface DerivedPalette {
  base: string;
  roles: Record<Mode, RoleColor[]>;
  /** El acento contra el que se midieron los roles: la base en claro y su versión para fondo oscuro. */
  accent: Record<Mode, Linear>;
  measures: Record<Mode, SetMeasure>;
  ok: boolean;
}

const ANCHOR = lchOfColor(THEME.light.accent);
const DARK_ANCHOR = lchOfColor(THEME.dark.accent);
const round = (v: number, k: number) => Math.round(v * 10 ** k) / 10 ** k;

/** Baja el croma hasta que el color quepa en sRGB: la misma L y el mismo tono. */
export function fit([L, C, h]: Lch): Lch {
  const ok = (c: number) => inGamut(linearOf(labOfLch([L, c, h])));
  if (ok(C)) return [L, C, h];
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return [L, Math.floor(lo * 1000) / 1000, h];
}

const tidy = ([L, C, h]: Lch): Lch => fit([round(L, 3), round(C, 3), round(((h % 360) + 360) % 360, 1)]);
const toLin = (lch: Lch) => linearOf(labOfLch(lch));

function accentsFor(base: string): Record<Mode, Linear> {
  if (base.toLowerCase() === THEME.light.accent) return { light: parseColor(THEME.light.accent), dark: parseColor(THEME.dark.accent) };
  const [L, C, h] = lchOfColor(base);
  const dark = fit([Math.max(L, DARK_ANCHOR[0]), C * (DARK_ANCHOR[1] / ANCHOR[1]), h]);
  return { light: parseColor(base), dark: toLin(dark) };
}

/**
 * Un arreglo de los roles: corrimiento de tono, de qué rol toma tono y croma, de qué rol toma L en cada tema y un
 * retoque pequeño de esa L.
 */
interface Candidate {
  shift: number[];
  hue: number[];
  L: Record<Mode, number[]>;
  dL: Record<Mode, number[]>;
}

const identity = () => ROLES.map((_, i) => i);

/** Un rol colocado, con la parte de su croma que sobrevive al ajustarlo a sRGB. */
interface Placed extends RoleColor {
  kept: number;
}

function rolesOf(rotation: number, c: Candidate): Record<Mode, Placed[]> {
  const out = {} as Record<Mode, Placed[]>;
  for (const mode of MODES) {
    out[mode] = ROLES.map((r, i) => {
      const [, C, h] = ROLES[c.hue[i]].lch[mode];
      const L = ROLES[c.L[mode][i]].lch[mode][0] + c.dL[mode][i];
      const lch = tidy([L, C, h + rotation + c.shift[i]]);
      return { name: r.name, lch, kept: lch[1] / C };
    });
  }
  return out;
}

interface Probe {
  labs: Lab[];
  /** Cociente frente al mínimo de texto y de canto, o -1 fuera de sRGB. */
  own: number[];
}

const probes = new Map<string, Probe>();

function probeOf(lch: Lch, mode: Mode): Probe {
  const key = `${mode}${lch.join()}`;
  const hit = probes.get(key);
  if (hit) return hit;
  const c = toLin(lch);
  const e = edgeOf(c, mode);
  const t = THEME[mode];
  const own = inGamut(c)
    ? [inkFor(c, mode).text / LIMITS.text, Math.min(contrast(e, parseColor(t.paper)), contrast(e, parseColor(t.card))) / LIMITS.edge]
    : [-1];
  const p = { labs: VISIONS.map((v) => labOf(simulate(c, v))), own };
  probes.set(key, p);
  return p;
}

/**
 * Cuánto falta para cumplir todo (la suma de lo que le falta a cada garantía) y el margen de la peor: la búsqueda
 * baja lo primero y, a igual falta, sube lo segundo.
 */
function score(roles: Record<Mode, Placed[]>, accent: Record<Mode, Linear>): [number, number] {
  let lack = 0;
  let worst = Infinity;
  const take = (r: number) => {
    if (r < 1) lack += 1 - r;
    if (r < worst) worst = r;
  };
  for (const mode of MODES) {
    const ps = roles[mode].map((r) => probeOf(r.lch, mode));
    const acc = VISIONS.map((v) => labOf(simulate(accent[mode], v)));
    ps.forEach((p, i) => {
      p.own.forEach(take);
      // Un rol de color que pierde croma al caber en sRGB se vuelve gris: la L alta va a tonos que la sostienen.
      if (!NEUTRAL[i]) take(roles[mode][i].kept / KEEP);
      VISIONS.forEach((v, k) => {
        const lim = v === "normal" ? LIMITS.normal : LIMITS.cvd;
        take(dist(p.labs[k], acc[k]) / lim);
        for (let j = i + 1; j < ps.length; j++) take(dist(p.labs[k], ps[j].labs[k]) / lim);
      });
    });
  }
  return [lack, worst];
}

const dist = (a: Lab, b: Lab) => 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const better = (a: [number, number], b: [number, number]) => a[0] < b[0] - 1e-9 || (Math.abs(a[0] - b[0]) <= 1e-9 && a[1] > b[1] + 1e-9);

const SHIFTS = [-20, -10, -5, -2, 2, 5, 10, 20];
const MAX_SHIFT = 45;
const NUDGES = [-0.02, -0.01, 0.01, 0.02];
/** El rol gris («external») no cambia de tono con otro: un rol de color no debe quedar gris, ni al revés. */
const NEUTRAL = ROLES.map((r) => MODES.every((m) => r.lch[m][1] < 0.03));
const KEEP = 0.8;
const MAX_NUDGE = 0.06;
/** Giros extra del juego entero si el giro exacto no llega: primero los más cercanos. */
const STARTS = [0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90, 180];

function* movesOf(c: Candidate): Generator<Candidate> {
  const n = c.shift.length;
  for (let i = 0; i < n; i++) {
    for (const d of SHIFTS) {
      const s = c.shift[i] + d;
      if (Math.abs(s) > MAX_SHIFT) continue;
      const shift = [...c.shift];
      shift[i] = s;
      yield { ...c, shift };
    }
  }
  for (const mode of MODES) {
    for (let i = 0; i < n; i++) {
      for (const d of NUDGES) {
        const v = Math.round((c.dL[mode][i] + d) * 100) / 100;
        if (Math.abs(v) > MAX_NUDGE) continue;
        const dL = { ...c.dL, [mode]: c.dL[mode].map((x, k) => (k === i ? v : x)) };
        yield { ...c, dL };
      }
    }
  }
  const swap = (a: number[], i: number, j: number) => {
    const b = [...a];
    [b[i], b[j]] = [b[j], b[i]];
    return b;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!NEUTRAL[i] && !NEUTRAL[j]) yield { ...c, hue: swap(c.hue, i, j) };
      yield { ...c, L: { light: swap(c.L.light, i, j), dark: c.L.dark } };
      yield { ...c, L: { light: c.L.light, dark: swap(c.L.dark, i, j) } };
      yield { ...c, L: { light: swap(c.L.light, i, j), dark: swap(c.L.dark, i, j) } };
    }
  }
}

function descend(rotation: number, accent: Record<Mode, Linear>): { cand: Candidate; s: [number, number] } {
  const zero = () => ROLES.map(() => 0);
  let cand: Candidate = { shift: zero(), hue: identity(), L: { light: identity(), dark: identity() }, dL: { light: zero(), dark: zero() } };
  let s = score(rolesOf(rotation, cand), accent);
  for (let step = 0; step < 60 && s[0] > 0; step++) {
    let next: Candidate | undefined;
    for (const move of movesOf(cand)) {
      const m = score(rolesOf(rotation, move), accent);
      if (better(m, s)) {
        s = m;
        next = move;
      }
    }
    if (!next) break;
    cand = next;
  }
  return { cand, s };
}

const cache = new Map<string, DerivedPalette>();

/**
 * Los roles de una base: los del tema girados en tono (la misma L y la misma C de cada rol; la base cae en el hueco
 * del acento) y, si alguna garantía falla con ese giro, corrimientos de tono e intercambios de L o de tono entre
 * roles hasta cumplir. Determinista: misma base, mismos roles.
 */
export function derivePalette(base: string): DerivedPalette {
  const key = base.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const [, C, h] = lchOfColor(key);
  // Una base casi gris no tiene tono propio: los roles parten de los del tema.
  const rotation = C < 0.03 ? 0 : h - ANCHOR[2];
  const accent = accentsFor(key);
  let best: { cand: Candidate; s: [number, number]; rot: number } | undefined;
  for (const extra of STARTS) {
    const r = descend(rotation + extra, accent);
    if (!best || better(r.s, best.s)) best = { ...r, rot: rotation + extra };
    if (best.s[0] === 0) break;
  }
  probes.clear();
  const placed = rolesOf(best!.rot, best!.cand);
  const roles = Object.fromEntries(MODES.map((m) => [m, placed[m].map(({ name, lch }) => ({ name, lch }))])) as Record<Mode, RoleColor[]>;
  const measures = {} as Record<Mode, SetMeasure>;
  for (const mode of MODES) {
    const set = roles[mode].map((r) => ({ name: r.name, color: toLin(r.lch) }));
    measures[mode] = measureSet(set, mode, [{ name: "accent", color: accent[mode] }]);
  }
  const out: DerivedPalette = { base: key, roles, accent, measures, ok: MODES.every((m) => !measures[m].failures.length) };
  cache.set(key, out);
  return out;
}
