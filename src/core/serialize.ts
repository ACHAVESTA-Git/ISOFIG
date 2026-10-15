import type { Vec2 } from "./math.ts";

/** Medio píxel del viewBox: a 1× no se nota y ahorra ~40 % del SVG frente a décimas. */
const halves = (n: number): number => Math.round(Math.round(n * 2e6) / 1e6);

function num(t: number): string {
  const sign = t < 0 ? "-" : "";
  const a = Math.abs(t);
  const i = Math.floor(a / 2);
  if (a % 2 === 0) return sign + String(i);
  return sign + (i === 0 ? "" : String(i)) + ".5";
}

function join(tokens: string[]): string {
  let out = "";
  let prev = "";
  for (const tk of tokens) {
    const glue = out === "" || /[a-zA-Z]$/.test(out) || tk.startsWith("-") || (tk.startsWith(".") && prev.includes("."));
    out += (glue ? "" : " ") + tk;
    prev = tk;
  }
  return out;
}

/**
 * Polígonos o polilíneas en un solo atributo `d`: el primer punto absoluto, todo lo demás relativo y en
 * medios píxeles. Las diferencias se toman entre valores ya redondeados, así no se acumula error.
 */
export function pathOf(polys: Vec2[][], closed: boolean): string {
  let out = "";
  let cx = 0;
  let cy = 0;
  let first = true;
  for (const poly of polys) {
    if (poly.length === 0) continue;
    const pts = poly.map(([x, y]) => [halves(x), halves(y)]);
    const [sx, sy] = pts[0];
    out += first ? "M" + join([num(sx), num(sy)]) : "m" + join([num(sx - cx), num(sy - cy)]);
    first = false;
    const rel: string[] = [];
    let px = sx;
    let py = sy;
    for (let k = 1; k < pts.length; k++) {
      const [x, y] = pts[k];
      if (x === px && y === py) continue;
      rel.push(num(x - px), num(y - py));
      px = x;
      py = y;
    }
    if (rel.length) out += "l" + join(rel);
    if (closed) {
      out += "z";
      cx = sx;
      cy = sy;
    } else {
      cx = px;
      cy = py;
    }
  }
  return out;
}

/** Puntos como segmentos de largo cero; el trazo redondeado los vuelve círculos. */
export function dotsOf(points: Vec2[]): string {
  return points.map(([x, y]) => "M" + join([num(halves(x)), num(halves(y))]) + "h0").join("");
}

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
