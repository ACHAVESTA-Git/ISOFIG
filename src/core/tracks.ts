import type { TrackSpec } from "./spec.ts";

/** Un recorrido como lo lee el runtime: cada punto relativo al primero y con la fracción de arco que lleva andada. */
export interface TrackData {
  g: string;
  p: number[][];
  T: number;
  d?: number;
  /** `0`: lo recorre una vez y se queda al final. */
  l?: 0;
  /** Tramos del arco (fracciones) en que el grupo no se ve: pasa por dentro de un objeto. */
  h?: number[][];
}

export interface Tracks {
  data: TrackData[];
  /** Instante en que se congela el reloj con movimiento reducido: ya arrancó el último recorrido y va medio
   * periodo del más corto. */
  rest: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Prepara los recorridos para el runtime: el arco acumulado se calcula aquí, en build, para que el navegador solo
 * interpole. Un recorrido roto (sin largo, sin periodo) se descarta: `validateSpec` ya dijo por qué.
 */
export function trackData(tracks: TrackSpec[] = []): Tracks {
  const data: TrackData[] = [];
  for (const t of tracks) {
    const given = Array.isArray(t.path) ? t.path : [];
    // Un punto repetido no avanza: se quita para que ningún tramo mida cero.
    const path = given.filter((q, i) => i === 0 || Math.hypot(q[0] - given[i - 1][0], q[1] - given[i - 1][1], q[2] - given[i - 1][2]) > 1e-6);
    const lens = path.slice(1).map((q, i) => Math.hypot(q[0] - path[i][0], q[1] - path[i][1], q[2] - path[i][2]));
    const total = lens.reduce((a, b) => a + b, 0);
    if (path.length < 2 || !(total > 0) || !(t.period > 0) || !Number.isFinite(t.period)) continue;
    let walked = 0;
    const p = path.map((q, i) => {
      if (i) walked += lens[i - 1];
      return [r2(q[0] - path[0][0]), r2(q[1] - path[0][1]), r2(q[2] - path[0][2]), Math.round((walked / total) * 1e4) / 1e4];
    });
    const hide = (t.hide ?? []).filter((r) => Array.isArray(r) && r[0] < r[1]);
    data.push({
      g: t.group,
      p,
      T: t.period,
      ...(t.delay && t.delay > 0 ? { d: t.delay } : {}),
      ...(t.loop === false ? { l: 0 as const } : {}),
      ...(hide.length ? { h: hide } : {}),
    });
  }
  const rest = data.length ? Math.max(...data.map((t) => t.d ?? 0)) + 0.5 * Math.min(...data.map((t) => t.T)) : 0;
  return { data, rest: r2(rest) };
}
