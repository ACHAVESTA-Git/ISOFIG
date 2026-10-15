import type { Vec2 } from "./math.ts";

const tenths = (n: number): number => Math.round(n * 10);

function num(t: number): string {
  const sign = t < 0 ? "-" : "";
  const a = Math.abs(t);
  const i = Math.floor(a / 10);
  const d = a % 10;
  if (d === 0) return sign + String(i);
  return sign + (i === 0 ? "" : String(i)) + "." + d;
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
 * décimas. Las diferencias se toman entre valores ya redondeados, así no se acumula error.
 */
export function pathOf(polys: Vec2[][], closed: boolean): string {
  let out = "";
  let cx = 0;
  let cy = 0;
  let first = true;
  for (const poly of polys) {
    if (poly.length === 0) continue;
    const pts = poly.map(([x, y]) => [tenths(x), tenths(y)]);
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
  return points.map(([x, y]) => "M" + join([num(tenths(x)), num(tenths(y))]) + "h0").join("");
}

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
