/**
 * Conversión de color sin dependencias: sRGB ↔ OKLab/OKLCH (Björn Ottosson), contraste WCAG 2 y simulación de
 * daltonismo de Machado, Oliveira y Fernandes (2009) con severidad 1. Corre en Node y en el navegador.
 */

/** sRGB lineal, cada canal en 0–1. */
export type Linear = [number, number, number];
export type Lab = [number, number, number];
/** `[L 0–1, C, h en grados]`. */
export type Lch = [number, number, number];
export type Vision = "normal" | "protan" | "deutan" | "tritan";
export const VISIONS: Vision[] = ["normal", "protan", "deutan", "tritan"];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function labOf([r, g, b]: Linear): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function linearOf([L, a, b]: Lab): Linear {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export const lchOfLab = ([L, a, b]: Lab): Lch => {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, Math.hypot(a, b), (h + 360) % 360];
};
export const labOfLch = ([L, C, h]: Lch): Lab => {
  const r = (h * Math.PI) / 180;
  return [L, C * Math.cos(r), C * Math.sin(r)];
};

/** Dentro de sRGB, con un margen para el redondeo. */
export const inGamut = (c: Linear, eps = 1e-4) => c.every((v) => v >= -eps && v <= 1 + eps);

/** Lee `#rgb`, `#rrggbb` u `oklch(L C h)` (L en % o 0–1) y devuelve sRGB lineal. */
export function parseColor(input: string): Linear {
  const s = input.trim().toLowerCase();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((i) => toLinear(parseInt(h.slice(i, i + 2), 16) / 255)) as Linear;
  }
  const lch = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/.exec(s);
  if (lch) {
    const L = Number(lch[1]) / (lch[2] ? 100 : 1);
    return linearOf(labOfLch([L, Number(lch[3]), Number(lch[4])]));
  }
  throw new Error(`color «${input}»: usa #rrggbb u oklch(L C h)`);
}

export const labOfColor = (input: string): Lab => labOf(parseColor(input));
export const lchOfColor = (input: string): Lch => lchOfLab(labOfColor(input));

export function hexOf(c: Linear): string {
  return "#" + c.map((v) => Math.round(clamp01(toGamma(clamp01(v))) * 255).toString(16).padStart(2, "0")).join("");
}

const round = (v: number, k: number) => Math.round(v * 10 ** k) / 10 ** k;

/** `oklch(78% .02 250)`: corto y estable, para CSS y para las pruebas. */
export function oklchText([L, C, h]: Lch): string {
  const n = (v: number) => String(v).replace(/^0\./, ".");
  return `oklch(${round(L * 100, 1)}% ${n(round(C, 3))} ${round(C < 1e-4 ? 0 : h, 1)})`;
}

/** Lo que hace `color-mix(in oklab, a, b p)`: `p` es la parte de `b`, de 0 a 1. */
export function mix(a: Linear, b: Linear, p: number): Linear {
  const A = labOf(a);
  const B = labOf(b);
  return linearOf([0, 1, 2].map((i) => A[i] * (1 - p) + B[i] * p) as Lab).map(clamp01) as Linear;
}

/** Luminancia relativa de WCAG 2. */
export const luminance = ([r, g, b]: Linear) => 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);

export function contrast(a: Linear, b: Linear): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const MACHADO: Record<Exclude<Vision, "normal">, number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/** Cómo lo ve una persona con protanopía, deuteranopía o tritanopía (sobre sRGB lineal). */
export function simulate(c: Linear, vision: Vision): Linear {
  if (vision === "normal") return c;
  const M = MACHADO[vision];
  return M.map((row) => clamp01(row[0] * c[0] + row[1] * c[1] + row[2] * c[2])) as Linear;
}

/** Distancia euclídea en OKLab ×100 (≈ 2 es apenas perceptible; ≥ 8 se distingue de un vistazo). */
export function deltaE(a: Linear, b: Linear, vision: Vision = "normal"): number {
  const A = labOf(simulate(a, vision));
  const B = labOf(simulate(b, vision));
  return 100 * Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}
