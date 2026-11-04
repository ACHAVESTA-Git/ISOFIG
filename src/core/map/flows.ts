import type { Part, TrackSpec, Vec3 } from "../spec.ts";
import { RT } from "./links.ts";
import { box, line } from "./parts.ts";
import type { Pt } from "./route.ts";
import type { MapFlow } from "./types.ts";

/** Un tramo de un flujo: la cinta en el sentido del viaje y a qué altura se apoya. */
export interface Hop {
  pts: Pt[];
  z: number;
}

export interface FlowOut {
  parts: Part[];
  tracks: TrackSpec[];
}

const SPEED = 80;
/** Distancia que el paquete se queda antes de cada objeto: ahí se apaga o reaparece, para no atravesar el zócalo. */
const STAND_OFF = 8;
const PACKET = [7, 7, 6] as const;
const MAX_PACKETS = 8;

/** Recorta `by` unidades de cada extremo de una polilínea. */
function shorten(pts: Pt[], by: number): Pt[] {
  const cut = (p: Pt[]): Pt[] => {
    const [a, b] = [p[0], p[1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len <= by + 1) return p.length > 2 ? p.slice(1) : p;
    const t = by / len;
    return [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ...p.slice(1)];
  };
  return cut(cut(pts).reverse()).reverse();
}

/**
 * Los paquetes de un flujo: el recorrido de cada tramo (con el paquete apagado mientras pasa por dentro de un objeto) y
 * tantos paquetes como quepan a la distancia de `every` segundos, parejos. Cada uno es un grupo con su propio recorrido.
 */
export function buildFlow(flow: MapFlow, index: number, hops: Hop[]): FlowOut {
  const id = flow.id ?? `flow${index}`;
  const path: Vec3[] = [];
  const hideFrom: number[] = [];
  const hideTo: number[] = [];
  let walked = 0;
  hops.forEach((h, i) => {
    const pts = shorten(h.pts, STAND_OFF);
    const world = pts.map((p): Vec3 => [p[0], p[1], h.z + RT]);
    if (i > 0 && path.length) {
      // Del último punto del tramo anterior al primero de este: pasa por dentro del objeto.
      const last = path[path.length - 1];
      hideFrom.push(walked);
      walked += Math.hypot(world[0][0] - last[0], world[0][1] - last[1], world[0][2] - last[2]);
      hideTo.push(walked);
    }
    for (const p of world) {
      if (path.length) walked += Math.hypot(p[0] - path[path.length - 1][0], p[1] - path[path.length - 1][1], p[2] - path[path.length - 1][2]);
      path.push(p);
    }
  });
  const total = walked;
  if (path.length < 2 || !(total > 0)) return { parts: [], tracks: [] };
  const hide = hideFrom.map((a, i): [number, number] => [Math.round((a / total) * 1e4) / 1e4, Math.round((hideTo[i] / total) * 1e4) / 1e4]);
  const period = Math.max(2, total / (flow.speed ?? SPEED));
  const n = Math.max(1, Math.min(MAX_PACKETS, Math.round(period / (flow.every ?? period / 3))));
  const parts: Part[] = [];
  const tracks: TrackSpec[] = [];
  const [x, y, z] = path[0];
  const boxes = Array.from({ length: n }, (_, k) => `${id}-${k}`);
  for (let k = 0; k < n; k++) {
    const group = `pkt-${id}-${k}`;
    parts.push(
      box(boxes[k], [x - PACKET[0] / 2, y - PACKET[1] / 2, z], [...PACKET], {
        group,
        float: true,
        mount: boxes.filter((b) => b !== boxes[k]),
        radius: 1.2,
        bevel: 0.5,
        ...(flow.paint ? { paint: flow.paint, tone: "hi" } : { tone: "lit" }),
      }),
      line(`${id}-${k}-tape`, boxes[k], [[x - PACKET[0] / 2, y, z + PACKET[2]], [x + PACKET[0] / 2, y, z + PACKET[2]]], true),
    );
    tracks.push({ group, path, period, delay: (flow.delay ?? 0) + (k * period) / n, ...(hide.length ? { hide } : {}) });
  }
  return { parts, tracks };
}
