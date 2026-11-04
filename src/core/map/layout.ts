import type { Leaf } from "./frame.ts";
import type { LinkKind, MapLayout, MapLink, MapNode } from "./types.ts";

/** Un nodo ya medido: su tamaño en el piso y, cuando se coloca, su lugar. `x` crece hacia el lector; `y`, hacia la derecha. */
export interface Placed {
  node: MapNode;
  id: string;
  parent?: Placed;
  kids: Placed[];
  /** Un contenedor (bandeja) o una hoja (un objeto del catálogo). */
  leaf?: Leaf;
  fx: number;
  fy: number;
  /** Esquina mínima respecto de su padre y, ya colocado, en el mundo. */
  rx: number;
  ry: number;
  ax: number;
  ay: number;
  /** Cuántas bandejas lo contienen: el piso donde se apoya sube 1,6 por cada una. */
  level: number;
}

/** Holguras del reparto: entre columnas, entre carriles, entre niveles, entre hermanos de un nivel. */
export const GAP = { rank: 48, lane: 28, layer: 70, sib: 62 };
/** Margen interior de una bandeja: atrás, a los lados y al frente (donde va su placa). */
export const PAD = { back: 8, side: 10, front: 38 };
export const TRAY = 1.6;

interface Edge {
  /** Va antes (a la izquierda, o arriba). */
  a: Placed;
  b: Placed;
}

/** Qué extremo de un enlace va primero en el reparto: la herencia pone al padre arriba; lo demás, al origen. */
const before = (kind: LinkKind | undefined, from: Placed, to: Placed): [Placed, Placed] =>
  kind === "inherits" || kind === "implements" ? [to, from] : [from, to];

/** El hijo de `container` que contiene a `p` (o es `p`); `undefined` si `p` no está dentro. */
function under(p: Placed | undefined, container: Placed): Placed | undefined {
  for (let q = p; q; q = q.parent) if (q.parent === container) return q;
  return undefined;
}

export function edgesOf(container: Placed, links: MapLink[], byId: Map<string, Placed>): Edge[] {
  const seen = new Set<string>();
  const out: Edge[] = [];
  const list = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
  for (const l of links) {
    for (const f of list(l.from)) {
      for (const t of list(l.to)) {
        const u = under(byId.get(f), container);
        const v = under(byId.get(t), container);
        if (!u || !v || u === v) continue;
        const [a, b] = before(l.kind, u, v);
        const key = `${a.id}>${b.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ a, b });
      }
    }
  }
  return out;
}

/** Rango de cada hijo: el camino más largo desde los que no dependen de nadie; un ciclo se corta donde se cierra. */
export function ranksOf(kids: Placed[], edges: Edge[]): Map<Placed, number> {
  const next = new Map<Placed, Placed[]>(kids.map((k) => [k, []]));
  for (const e of edges) next.get(e.a)!.push(e.b);
  const state = new Map<Placed, 0 | 1 | 2>();
  const dag: Edge[] = [];
  const visit = (u: Placed) => {
    state.set(u, 1);
    for (const v of next.get(u)!) {
      if (state.get(v) === 1) continue;
      dag.push({ a: u, b: v });
      if (!state.get(v)) visit(v);
    }
    state.set(u, 2);
  };
  for (const k of kids) if (!state.get(k)) visit(k);
  const rank = new Map<Placed, number>(kids.map((k) => [k, 0]));
  for (let i = 0; i < kids.length; i++) {
    let changed = false;
    for (const e of dag) {
      const r = rank.get(e.a)! + 1;
      if (r > rank.get(e.b)!) {
        rank.set(e.b, r);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const k of kids) if (k.node.rank !== undefined) rank.set(k, Math.max(0, Math.round(k.node.rank)));
  return rank;
}

/** Ordena cada columna por el promedio de la posición de sus vecinos, para que las cintas se crucen lo menos posible. */
function orderRanks(columns: Placed[][], edges: Edge[]): void {
  const where = new Map<Placed, [number, number]>();
  const reindex = () => columns.forEach((col, r) => col.forEach((k, i) => where.set(k, [r, col.length > 1 ? i / (col.length - 1) : 0.5])));
  reindex();
  const neighbours = new Map<Placed, Placed[]>();
  for (const e of edges) {
    neighbours.set(e.a, [...(neighbours.get(e.a) ?? []), e.b]);
    neighbours.set(e.b, [...(neighbours.get(e.b) ?? []), e.a]);
  }
  const sweep = (r: number, toward: -1 | 1) => {
    const col = columns[r];
    const score = new Map<Placed, number>();
    col.forEach((k, i) => {
      const near = (neighbours.get(k) ?? []).filter((n) => Math.sign(where.get(n)![0] - r) === toward);
      score.set(k, near.length ? near.reduce((s, n) => s + where.get(n)![1], 0) / near.length : (col.length > 1 ? i / (col.length - 1) : 0.5));
    });
    columns[r] = [...col].sort((a, b) => score.get(a)! - score.get(b)! || col.indexOf(a) - col.indexOf(b));
    reindex();
  };
  for (let pass = 0; pass < 4; pass++) {
    for (let r = 1; r < columns.length; r++) sweep(r, -1);
    for (let r = columns.length - 2; r >= 0; r--) sweep(r, 1);
  }
}

/** Reparte una fila de `sizes` a lo largo de un eje; `gap(i)` es la holgura entre el elemento `i` y el siguiente. */
const stack = (sizes: number[], gap: number | ((i: number) => number)): { at: number[]; total: number } => {
  const at: number[] = [];
  let cursor = 0;
  sizes.forEach((s, i) => {
    at.push(cursor);
    cursor += s + (i < sizes.length - 1 ? (typeof gap === "number" ? gap : gap(i)) : 0);
  });
  return { at, total: cursor };
};

/** Qué tanto sube un nodo: lo que tapa a lo que queda detrás de él en la vista. */
export const tallOf = (p: Placed): number => (p.leaf ? p.leaf.h : TRAY + Math.max(0, ...p.kids.map(tallOf)));

/**
 * Lo que hay que dejar entre un nodo y el que tiene detrás para que el de adelante no le tape el rótulo: la distancia
 * a la que un rayo hacia el lector sube hasta la altura del de adelante. `k` es cos(azimut) / tan(elevación).
 */
const shadow = (front: number, k: number, extra = 0): number => Math.round(front * k * 1.1 + extra);

/**
 * Coloca los hijos de un contenedor según su `layout` y devuelve el tamaño del contenido. `flow` pone los rangos de
 * izquierda a derecha (a lo largo de `y`) con los de un mismo rango apilados hacia el lector; `layers` los pone de
 * arriba abajo (a lo largo de `x`) con los hermanos uno al lado del otro; `grid` los pone en su celda.
 */
export function arrange(kids: Placed[], layout: MapLayout, edges: Edge[], k: number): { fx: number; fy: number } {
  if (!kids.length) return { fx: 0, fy: 0 };
  if (layout === "grid") return arrangeGrid(kids, k);
  const along = layout === "flow" ? "fy" : "fx";
  const across = layout === "flow" ? "fx" : "fy";
  const gapAlong = layout === "flow" ? GAP.rank : GAP.layer;
  const gapAcross = layout === "flow" ? GAP.lane : GAP.sib;

  const rank = ranksOf(kids, edges);
  const used = [...new Set(rank.values())].sort((a, b) => a - b);
  const columns = used.map((r) => kids.filter((k) => rank.get(k) === r));
  orderRanks(columns, edges);

  const thickness = columns.map((col) => Math.max(...col.map((k) => k[along])));
  // En `layers` el nivel de adelante tapa al de atrás: la holgura entre niveles crece con lo alto que es.
  const heads = stack(thickness, layout === "layers" ? (i) => Math.max(gapAlong, shadow(Math.max(...columns[i + 1].map(tallOf)), k, 30)) : gapAlong);
  // En `flow` los de un mismo rango se apilan hacia el lector: cada uno tapa al de atrás.
  const rows = columns.map((col) => stack(col.map((k) => k[across]), layout === "flow" ? (i) => Math.max(gapAcross, shadow(tallOf(col[i + 1]), k, 12)) : gapAcross));
  const wide = Math.max(...rows.map((r) => r.total));
  columns.forEach((col, c) =>
    col.forEach((k, i) => {
      const a = heads.at[c] + (thickness[c] - k[along]) / 2;
      const b = (wide - rows[c].total) / 2 + rows[c].at[i];
      if (layout === "flow") [k.ry, k.rx] = [a, b];
      else [k.rx, k.ry] = [a, b];
    }),
  );
  return layout === "flow" ? { fx: wide, fy: heads.total } : { fx: heads.total, fy: wide };
}

function arrangeGrid(kids: Placed[], k: number): { fx: number; fy: number } {
  const declared = kids.filter((k) => k.node.cell);
  const cols = declared.length ? Math.max(...declared.map((k) => k.node.cell![0])) + 1 : Math.ceil(Math.sqrt(kids.length));
  const taken = new Map<string, Placed>();
  const cells = new Map<Placed, [number, number]>();
  const claim = (k: Placed, c: number, r: number) => {
    // Dos nodos en la misma celda (el validador lo avisa) se corren a la siguiente libre de su fila.
    while (taken.has(`${c},${r}`)) c++;
    taken.set(`${c},${r}`, k);
    cells.set(k, [c, r]);
  };
  for (const k of declared) claim(k, k.node.cell![0], k.node.cell![1]);
  let c = 0;
  let r = 0;
  for (const k of kids.filter((q) => !q.node.cell)) {
    while (taken.has(`${c},${r}`)) {
      c++;
      if (c >= cols) [c, r] = [0, r + 1];
    }
    claim(k, c, r);
  }
  const nc = Math.max(...[...cells.values()].map(([a]) => a)) + 1;
  const nr = Math.max(...[...cells.values()].map(([, b]) => b)) + 1;
  const width = Array.from({ length: nc }, (_, i) => Math.max(0, ...[...cells].filter(([, [a]]) => a === i).map(([k]) => k.fy)));
  const depth = Array.from({ length: nr }, (_, i) => Math.max(0, ...[...cells].filter(([, [, b]]) => b === i).map(([k]) => k.fx)));
  const ys = stack(width, GAP.rank);
  // La fila de adelante tapa a la de atrás: entre filas, lo que haga falta según lo alto que sea la de adelante.
  const rowTall = Array.from({ length: nr }, (_, i) => Math.max(0, ...[...cells].filter(([, [, b]]) => b === i).map(([n]) => tallOf(n))));
  const xs = stack(depth, (i) => Math.max(GAP.lane, shadow(rowTall[i + 1], k, 12)));
  for (const [k, [a, b]] of cells) {
    k.ry = ys.at[a] + (width[a] - k.fy) / 2;
    k.rx = xs.at[b] + (depth[b] - k.fx) / 2;
  }
  return { fx: xs.total, fy: ys.total };
}

/** Pasa las posiciones relativas a absolutas, de arriba abajo. */
export function absolute(p: Placed, ox = 0, oy = 0): void {
  p.ax = ox + p.rx;
  p.ay = oy + p.ry;
  for (const k of p.kids) absolute(k, p.ax, p.ay);
}

export const walk = (p: Placed, visit: (q: Placed) => void): void => {
  visit(p);
  p.kids.forEach((k) => walk(k, visit));
};
