/**
 * Rutas ortogonales sobre el piso entre las huellas de los nodos. Se busca el camino más barato en una cuadrícula
 * dispersa (las líneas que pasan por los bordes y los centros de los nodos y por el medio de cada pasillo): cada giro
 * cuesta, ir por donde ya va otra cinta cuesta, cruzarla cuesta más, y las cintas que comparten origen o destino se
 * juntan en un tronco. Todo es determinista: mismas entradas, mismas rutas.
 */

/** Una huella en el piso: `x` crece hacia el lector; `y`, hacia la derecha. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Cuánto del piso detrás de él (hacia `-x`) tapa en la vista: el pasillo útil empieza donde deja de taparlo. */
  hide?: number;
}

export type Pt = [number, number];
export type Side = "B" | "F" | "L" | "R";

const NORMAL: Record<Side, Pt> = { B: [-1, 0], F: [1, 0], L: [0, -1], R: [0, 1] };
const SIDES: Side[] = ["B", "F", "L", "R"];

export interface RouteReq {
  /** Origen y destino: sus huellas. Las de los objetos estorban a las demás cintas; las de una bandeja, no. */
  from: Rect;
  to: Rect;
  fromBlocks: boolean;
  toBlocks: boolean;
  /** Quién es cada extremo: las cintas que comparten uno se juntan en un tronco. */
  src: string;
  dst: string;
  /** Lados por los que puede salir y entrar; sin ellos, cualquiera (la herencia entra siempre por el frente del padre). */
  fromSides?: Side[];
  toSides?: Side[];
}

export interface RouteOptions {
  /** Distancia de las cintas a los objetos. */
  margin?: number;
  /** Lados de un objeto que el lector ve: a esos conviene llegar para que la punta no quede escondida detrás. */
  visible: Side[];
  /** Estorbos fijos (placas de bandejas, leyenda). */
  blocks?: Rect[];
}

const BEND = 26;
const SHARE = 0.28;
const OVERLAP = 34;
const CROSS = 46;
const HIDDEN_ENTRY = 45;
const BACK_ENTRY = 80;
const AWAY_EXIT = 22;

const cx = (r: Rect) => (r.x0 + r.x1) / 2;
const cy = (r: Rect) => (r.y0 + r.y1) / 2;

/** El punto del borde de `r` por donde sale o entra una cinta en ese lado. */
export function portOf(r: Rect, side: Side): Pt {
  return side === "B" ? [r.x0, cy(r)] : side === "F" ? [r.x1, cy(r)] : side === "L" ? [cx(r), r.y0] : [cx(r), r.y1];
}

const grow = (r: Rect, m: number): Rect => ({ x0: r.x0 - m, y0: r.y0 - m, x1: r.x1 + m, y1: r.y1 + m, ...(r.hide ? { hide: r.hide } : {}) });
const same = (a: number, b: number) => Math.abs(a - b) < 0.06;

/** Un montículo binario mínimo: la cola del camino más barato. */
class Heap {
  private items: [number, number][] = [];
  push(cost: number, id: number): void {
    const a = this.items;
    a.push([cost, id]);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const [l, r] = [2 * i + 1, 2 * i + 2];
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.items.length;
  }
}

/** Valores únicos y ordenados, sin los que quedan a menos de `eps` de otro. */
function uniq(values: number[], eps = 0.05): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) if (!out.length || v - out[out.length - 1] > eps) out.push(v);
  return out;
}

/**
 * Las líneas de la cuadrícula en un eje: los bordes de los estorbos, los puertos y, entre cada par de estorbos que se
 * miran de frente, el medio del pasillo con unas líneas a cada lado para que dos cintas no se encimen.
 */
function lines(blocks: Rect[], axis: "x" | "y", extra: number[], bounds: [number, number]): { at: number[]; pref: number[] } {
  const [lo, hi, olo, ohi] = axis === "x" ? (["x0", "x1", "y0", "y1"] as const) : (["y0", "y1", "x0", "x1"] as const);
  const marks: number[] = [...extra, bounds[0], bounds[1]];
  const mids: number[] = [];
  for (const b of blocks) marks.push(b[lo], b[hi]);
  for (const a of blocks) {
    for (const b of blocks) {
      const gap = b[lo] - a[hi];
      if (gap < 10 || gap > 170 || a[olo] >= b[ohi] || b[olo] >= a[ohi]) continue;
      // En `x` el de adelante tapa lo que tiene detrás: el pasillo útil es el tramo que queda a la vista.
      const seen = axis === "x" ? Math.min(gap - 12, b.hide ?? 0) : 0;
      const mid = (a[hi] + b[lo] - seen) / 2;
      mids.push(mid);
      marks.push(mid);
      for (const off of [6, 12, 18]) if ((gap - seen) / 2 - off > 3) marks.push(mid - off, mid + off);
    }
  }
  const at = uniq(marks);
  const midSet = uniq(mids);
  const pref = at.map((v) => {
    const d = Math.min(...midSet.map((m) => Math.abs(m - v)), Infinity);
    return d < 0.1 ? 0 : d < 19 ? Math.round(d / 6) : 3;
  });
  return { at, pref };
}

export interface Routed {
  /** Esquinas de la cinta, de la huella de origen a la de destino. */
  pts: Pt[];
  /** No se encontró un camino libre y se dibujó uno directo. */
  blocked: boolean;
}

/**
 * Traza todas las cintas, una tras otra (las más cortas primero), cada una teniendo en cuenta las ya trazadas.
 * Devuelve las rutas en el orden de `reqs`.
 */
export function routeAll(reqs: RouteReq[], o: RouteOptions): Routed[] {
  const margin = o.margin ?? 7;
  const solid: Rect[] = [];
  for (const r of reqs) {
    if (r.fromBlocks) solid.push(r.from);
    if (r.toBlocks) solid.push(r.to);
  }
  const uniqueSolid = solid.filter((r, i) => solid.findIndex((q) => q.x0 === r.x0 && q.y0 === r.y0 && q.x1 === r.x1 && q.y1 === r.y1) === i);
  const obstacles = [...uniqueSolid, ...(o.blocks ?? [])].map((r) => grow(r, margin));
  const ends = reqs.flatMap((r) => [r.from, r.to]);
  const all = [...obstacles, ...ends];
  const minX = Math.min(...all.map((r) => r.x0)) - 18;
  const maxX = Math.max(...all.map((r) => r.x1)) + 18;
  const minY = Math.min(...all.map((r) => r.y0)) - 18;
  const maxY = Math.max(...all.map((r) => r.y1)) + 18;
  const ports: Pt[] = reqs.flatMap((r) =>
    ([[r.from, r.fromBlocks], [r.to, r.toBlocks]] as [Rect, boolean][]).flatMap(([rect, blocks]) =>
      SIDES.map((s) => {
        const p = portOf(rect, s);
        const n = NORMAL[s];
        const m = blocks ? margin : 0;
        return [p[0] + n[0] * m, p[1] + n[1] * m] as Pt;
      }),
    ),
  );
  const gx = lines(obstacles, "x", [...ports.map((p) => p[0]), ...ends.flatMap((r) => [r.x0, r.x1])], [minX, maxX]);
  const gy = lines(obstacles, "y", [...ports.map((p) => p[1]), ...ends.flatMap((r) => [r.y0, r.y1])], [minY, maxY]);
  const nx = gx.at.length;
  const ny = gy.at.length;
  const vid = (i: number, j: number) => i * ny + j;

  const blockedV = new Uint8Array(nx * ny);
  const E = 0.01;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const [x, y] = [gx.at[i], gy.at[j]];
      if (obstacles.some((b) => x > b.x0 + E && x < b.x1 - E && y > b.y0 + E && y < b.y1 - E)) blockedV[vid(i, j)] = 1;
    }
  }
  /** ¿Cruza el tramo entre dos vértices vecinos el interior de algún estorbo? */
  const edgeFree = (i0: number, j0: number, i1: number, j1: number): boolean => {
    const [xa, xb] = [Math.min(gx.at[i0], gx.at[i1]), Math.max(gx.at[i0], gx.at[i1])];
    const [ya, yb] = [Math.min(gy.at[j0], gy.at[j1]), Math.max(gy.at[j0], gy.at[j1])];
    return !obstacles.some((b) => xb > b.x0 + E && xa < b.x1 - E && yb > b.y0 + E && ya < b.y1 - E);
  };

  const nearest = (at: number[], v: number) => {
    const k = at.findIndex((a) => Math.abs(a - v) < 0.06);
    return k;
  };
  const indexX = (v: number) => nearest(gx.at, v);
  const indexY = (v: number) => nearest(gy.at, v);

  // Quién usa cada tramo y cada vértice, para juntar troncos y evitar encimarse.
  const edgeUse = new Map<string, Set<number>>();
  const vertH = new Map<number, Set<number>>();
  const vertV = new Map<number, Set<number>>();
  const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

  const order = reqs.map((_, i) => i).sort((a, b) => {
    const d = (r: RouteReq) => Math.abs(cx(r.from) - cx(r.to)) + Math.abs(cy(r.from) - cy(r.to));
    return d(reqs[a]) - d(reqs[b]) || a - b;
  });
  const out: Routed[] = reqs.map(() => ({ pts: [], blocked: true }));

  for (const ri of order) {
    const r = reqs[ri];
    const startSides = (r.fromSides ?? SIDES).map((side) => {
      const e = portOf(r.from, side);
      const n = NORMAL[side];
      const m = r.fromBlocks ? margin : 0;
      const v: Pt = [e[0] + n[0] * m, e[1] + n[1] * m];
      const toward = (cx(r.to) - cx(r.from)) * n[0] + (cy(r.to) - cy(r.from)) * n[1];
      return { side, edge: e, v, cost: (toward > 0 ? 0 : AWAY_EXIT) + (side === "B" ? 10 : 0) };
    });
    const goalSides = (r.toSides ?? SIDES).map((side) => {
      const e = portOf(r.to, side);
      const n = NORMAL[side];
      const m = r.toBlocks ? margin : 0;
      const v: Pt = [e[0] + n[0] * m, e[1] + n[1] * m];
      const cost = side === "B" ? BACK_ENTRY : o.visible.includes(side) ? 0 : HIDDEN_ENTRY;
      return { side, edge: e, v, cost };
    });
    // Estado: vértice × rumbo con el que se llegó (0 +x, 1 −x, 2 +y, 3 −y).
    const heading: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const dist = new Float64Array(nx * ny * 4).fill(Infinity);
    const prev = new Int32Array(nx * ny * 4).fill(-1);
    const heap = new Heap();
    const dirOf = (n: Pt) => heading.findIndex((h) => h[0] === n[0] && h[1] === n[1]);
    for (const s of startSides) {
      const i = indexX(s.v[0]);
      const j = indexY(s.v[1]);
      if (i < 0 || j < 0) continue;
      const st = vid(i, j) * 4 + dirOf(NORMAL[s.side]);
      if (s.cost < dist[st]) {
        dist[st] = s.cost;
        heap.push(s.cost, st);
      }
    }
    const goalAt = new Map<number, { cost: number; dir: number; side: Side }[]>();
    for (const g of goalSides) {
      const i = indexX(g.v[0]);
      const j = indexY(g.v[1]);
      if (i < 0 || j < 0) continue;
      const list = goalAt.get(vid(i, j)) ?? [];
      list.push({ cost: g.cost, dir: dirOf([-NORMAL[g.side][0], -NORMAL[g.side][1]] as Pt), side: g.side });
      goalAt.set(vid(i, j), list);
    }
    let best = Infinity;
    let bestState = -1;
    let bestSide: Side = "F";
    while (heap.size) {
      const [d, st] = heap.pop()!;
      if (d > dist[st] || d >= best) continue;
      const dir = st % 4;
      const v = (st - dir) / 4;
      const [i, j] = [Math.floor(v / ny), v % ny];
      for (const g of goalAt.get(v) ?? []) {
        const total = d + g.cost + (g.dir === dir ? 0 : BEND);
        if (total < best) {
          best = total;
          bestState = st;
          bestSide = g.side;
        }
      }
      for (let nd = 0; nd < 4; nd++) {
        if (nd === (dir ^ 1)) continue;
        const [ni, nj] = nd < 2 ? [i + (nd === 0 ? 1 : -1), j] : [i, j + (nd === 2 ? 1 : -1)];
        if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
        const nv = vid(ni, nj);
        if (blockedV[nv] || !edgeFree(i, j, ni, nj)) continue;
        const len = Math.abs(gx.at[ni] - gx.at[i]) + Math.abs(gy.at[nj] - gy.at[j]);
        const key = edgeKey(v, nv);
        const users = edgeUse.get(key);
        let step = len + (nd < 2 ? gx.pref[ni] : gy.pref[nj]) * len * 0.02;
        if (users?.size) {
          const mine = [...users].some((u) => reqs[u].src === r.src || reqs[u].dst === r.dst);
          step = mine ? step * SHARE : step + len * 1.2 + OVERLAP;
        }
        const cross = nd < 2 ? vertV.get(nv) : vertH.get(nv);
        if (cross && [...cross].some((u) => reqs[u].src !== r.src && reqs[u].dst !== r.dst)) step += CROSS;
        const cost = d + step + (nd === dir ? 0 : BEND);
        const ns = nv * 4 + nd;
        if (cost < dist[ns]) {
          dist[ns] = cost;
          prev[ns] = st;
          heap.push(cost, ns);
        }
      }
    }
    if (bestState < 0) {
      const a = portOf(r.from, "F");
      const b = portOf(r.to, "B");
      out[ri] = { pts: simplify([a, [b[0], a[1]], b]), blocked: true };
      continue;
    }
    const states: number[] = [];
    for (let s = bestState; s >= 0; s = prev[s]) states.push(s);
    states.reverse();
    const verts: Pt[] = states.map((s) => {
      const v = (s - (s % 4)) / 4;
      return [gx.at[Math.floor(v / ny)], gy.at[v % ny]];
    });
    const startSide = startSides.find((s) => same(s.v[0], verts[0][0]) && same(s.v[1], verts[0][1]) && dirOf(NORMAL[s.side]) === states[0] % 4) ?? startSides[1];
    const goal = goalSides.find((g) => g.side === bestSide)!;
    const pts = simplify([startSide.edge, ...verts, goal.edge]);
    out[ri] = { pts, blocked: false };
    for (let k = 1; k < states.length; k++) {
      const [a, b] = [(states[k - 1] - (states[k - 1] % 4)) / 4, (states[k] - (states[k] % 4)) / 4];
      const key = edgeKey(a, b);
      (edgeUse.get(key) ?? edgeUse.set(key, new Set()).get(key)!).add(ri);
      const horizontal = states[k] % 4 < 2;
      for (const vv of [a, b]) {
        const map = horizontal ? vertH : vertV;
        (map.get(vv) ?? map.set(vv, new Set()).get(vv)!).add(ri);
      }
    }
  }
  return out;
}

/** Quita los puntos repetidos y los que quedan en medio de un tramo recto. */
export function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    if (out.length && same(out[out.length - 1][0], p[0]) && same(out[out.length - 1][1], p[1])) continue;
    out.push(p);
  }
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true;
    const [a, b] = [out[i - 1], out[i + 1]];
    return !((same(a[0], p[0]) && same(p[0], b[0])) || (same(a[1], p[1]) && same(p[1], b[1])));
  });
}
