import { add, boxOf, centerOf, dot, length, mul, unit, type Vec3 } from "./math.ts";
import { expandIndexed, isSolid, shift, solidBox } from "./items.ts";
import { resolveMap, type Note } from "./map/index.ts";
import type { BindSpec, FigureSpec, FlatSpec, GroupSpec, Node, NodeDef, ParamSpec, Part, Text, Tone } from "./spec.ts";

/** Lo que devuelve una entrada del catálogo: un subárbol y, si hace falta, sus grupos (un depósito con `extent`). */
export type CatalogResult = NodeDef & { groups?: Record<string, GroupSpec> };

/** Piezas por nombre: `use: "nombre"` llama a la función con `with` (el de `isofig/kit` es `catalog`). */
export type Catalog = Readonly<Record<string, (options: any) => CatalogResult>>;

export interface AssembleOptions {
  /**
   * Las piezas de `use` que no están en `defs`. `renderFigure`, `validateSpec` y el CLI ponen por defecto el de
   * `isofig/kit`; aquí no se importa, para que el giro (que dibuja en el navegador) no cargue el kit si no lo usa.
   */
  catalog?: Catalog;
}

/** Un problema del árbol que impide armarlo tal cual; `validateSpec` lo convierte en un `Issue`. */
export interface TreeProblem {
  code: "use-unknown" | "use-cycle" | "use-failed" | "root-repeat";
  /** Dónde: `root.children[2].use`, `defs.piston.children[0].use`. */
  path: string;
  vars: Record<string, string>;
}

/** Un nodo ya colocado en el mundo. */
interface Placed {
  node: Node;
  path: string;
  parent?: Placed;
  /** Grupo propio: lo tiene si se desarma o si se puede elegir. */
  group?: string;
  stage: number;
  parts: { part: Part; src: string; scopes: string[] }[];
}

export interface Assembled {
  spec: FlatSpec;
  errors: TreeProblem[];
  /** Cuántas etapas tiene el despiece (0 si nada se desarma). */
  stages: number;
  /** De qué lugar de la spec sale cada pieza aplanada (`root.children[1].parts[3]`): para decir dónde falla algo. */
  sources: Map<Part, string>;
  /** Lo que avisó el compilador de un `map` (un rótulo que no se lee, una cinta sin camino); vacío si no hay mapa. */
  notes: Note[];
}

const WORDS: Record<string, { apart: string; pick: string; all: string; whole: string; of: string; step: string }> = {
  es: { apart: "Desarmar", pick: "Pieza", all: "Todo", whole: "Armado", of: "de", step: "Paso {n} de {m}: {t}" },
  en: { apart: "Take apart", pick: "Part", all: "All", whole: "Assembled", of: "of", step: "Step {n} of {m}: {t}" },
};

const DIM = 1e-9;
const isZero = (v?: Vec3) => !Array.isArray(v) || length(v) < DIM;

/** Reemplaza `{clave}` en cada texto del subárbol; un texto que es solo `{clave}` toma el valor tal cual (un número). */
function substitute<T>(value: T, vars: Record<string, unknown>): T {
  if (typeof value === "string") {
    const whole = /^\{([^}]+)\}$/.exec(value);
    if (whole && Object.hasOwn(vars, whole[1])) return vars[whole[1]] as T;
    return value.replace(/\{([^}]+)\}/g, (m, k: string) => (Object.hasOwn(vars, k) ? String(vars[k]) : m)) as T;
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, vars)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, vars)])) as T;
  }
  return value;
}

function langsOf(spec: FigureSpec): string[] {
  const found = new Set<string>();
  const visit = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(visit);
    for (const [k, x] of Object.entries(v)) {
      if ((k === "title" || k === "name" || k === "note" || k === "step") && x && typeof x === "object" && !Array.isArray(x)) {
        for (const l of Object.keys(x)) found.add(l);
      } else visit(x);
    }
  };
  visit({ title: spec.title, root: spec.root, defs: spec.defs });
  return [...found].sort();
}

/** Un texto por idioma, armado con `make(lang)`; sin idiomas en la spec, en inglés y como texto plano. */
function textFor(langs: string[], make: (lang: string) => string): Text {
  if (!langs.length) return make("en");
  return Object.fromEntries(langs.map((l) => [l, make(l)]));
}

function textIn(t: Text | undefined, lang: string): string {
  if (t === undefined) return "";
  if (typeof t === "string") return t;
  return t[lang] ?? t["en"] ?? t["es"] ?? Object.values(t)[0] ?? "";
}

/** «Culata» → «culata» dentro de una frase; las siglas («ECU») se quedan como están. */
const lower = (s: string, lang: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s[0].toLocaleLowerCase(lang) + s.slice(1) : s);

/**
 * Aplana una spec anidada (`root`, `defs`, `use`) a la `FigureSpec` de siempre: piezas en coordenadas de mundo, un
 * grupo por nodo que se desarma o se puede elegir, y, si algún nodo trae `explode`, el control «Desarmar», la lista de
 * piezas, los enlaces de cada etapa, el encuadre de cada pose y las poses en las que recalcular el orden de pintado.
 * Es pura, no lanza con una spec rota (lo dice en `errors`) y corre en el navegador.
 */
export function assembleTree(input: FigureSpec, options: AssembleOptions = {}): Assembled {
  // Un `map` se compila primero a su árbol `root` y a sus recorridos; el resto es igual que para una spec anidada.
  const { spec, notes } = resolveMap(input);
  return { ...assembleResolved(spec, options), notes };
}

function assembleResolved(spec: FigureSpec, options: AssembleOptions): Omit<Assembled, "notes"> {
  const errors: TreeProblem[] = [];
  const sources = new Map<Part, string>();
  const scenery = Array.isArray(spec.parts) ? spec.parts : [];
  const root = spec.root;
  if (!root || typeof root !== "object") return { spec: { ...spec, parts: scenery }, errors, stages: 0, sources };
  const catalog: Catalog = options.catalog ?? {};
  const extraGroups: Record<string, GroupSpec> = {};

  // De dónde sale cada pieza y cada hijo crudo, para que los mensajes apunten al JSON que escribió el autor.
  const origin = new WeakMap<object, string>();
  const mark = <T,>(list: T[] | undefined, base: string): T[] => {
    const out = Array.isArray(list) ? list : [];
    out.forEach((x, k) => {
      if (x && typeof x === "object" && !origin.has(x)) origin.set(x, `${base}[${k}]`);
    });
    return out;
  };

  const resolve = (node: Node, src: string, trail: string[] = []): Node => {
    mark(node.parts, `${src}.parts`);
    mark(node.children, `${src}.children`);
    if (!node.use) return node;
    const name = node.use;
    if (trail.includes(name)) {
      errors.push({ code: "use-cycle", path: `${src}.use`, vars: { id: String(node.id), use: [...trail, name].join(" → ") } });
      return { ...node, use: undefined };
    }
    let def: CatalogResult | undefined;
    let base = `defs.${name}`;
    if (spec.defs && Object.hasOwn(spec.defs, name)) def = substitute(structuredClone(spec.defs[name]), node.with ?? {});
    else if (Object.hasOwn(catalog, name)) {
      base = `${src}.use`;
      try {
        def = catalog[name](node.with ?? {});
      } catch (e) {
        errors.push({ code: "use-failed", path: `${src}.with`, vars: { id: String(node.id), use: name, reason: e instanceof Error ? e.message : String(e) } });
        return { ...node, use: undefined };
      }
      if (def?.groups) Object.assign(extraGroups, def.groups);
    }
    if (!def) {
      errors.push({ code: "use-unknown", path: `${src}.use`, vars: { id: String(node.id), use: name } });
      return { ...node, use: undefined };
    }
    const { use: _u, with: _w, ...own } = node;
    const { groups: _g, ...tree } = def;
    const merged: Node = {
      ...tree,
      ...own,
      parts: [...mark(tree.parts, `${base}.parts`), ...(own.parts ?? [])],
      children: [...mark(tree.children, `${base}.children`), ...(own.children ?? [])],
      use: tree.use,
      with: tree.with,
    };
    return resolve(merged, base, [...trail, name]);
  };

  /** `{i}` pertenece al `repeat` más cercano: no se toca dentro de un nodo o una pieza que se repite por su cuenta. */
  const withIndex = <T,>(value: T, i: number): T => {
    if (typeof value === "string") return value.replaceAll("{i}", String(i)) as T;
    if (Array.isArray(value)) return value.map((v) => withIndex(v, i)) as T;
    if (!value || typeof value !== "object" || ("repeat" in value && value.repeat)) return value;
    const copy = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withIndex(v, i)])) as T & object;
    const from = origin.get(value);
    if (from) origin.set(copy, from);
    return copy;
  };

  const copies = (node: Node): Node[] => {
    const r = node.repeat;
    if (!r) return [node];
    const out: Node[] = [];
    const count = Math.max(0, Math.min(Math.floor(Number(r.count) || 0), 5000));
    for (let k = 0; k < count; k++) {
      const i = (r.from ?? 0) + k;
      const { repeat: _r, ...rest } = node;
      const copy = withIndex(rest as Node, i);
      copy.id = String(node.id).includes("{i}") ? copy.id : `${node.id}-${i}`;
      copy.at = add(node.at ?? [0, 0, 0], mul(r.step, k));
      out.push(copy);
    }
    return out;
  };

  const placed: Placed[] = [];
  const walk = (raw: Node, src: string, parent: Placed | undefined, at: Vec3, tone: Tone | undefined, paint: string | undefined, mount: string[]) => {
    const node = resolve(raw, src);
    const here = add(at, node.at ?? [0, 0, 0]);
    const path = parent ? (parent.path ? `${parent.path}.${node.id}` : node.id) : "";
    const t = node.tone ?? tone;
    const pa = node.paint ?? paint;
    // El `mount` de un nodo vale para todas sus piezas: un tren alternativo entero va encajado en el bloque.
    const mo = Array.isArray(node.mount) ? [...mount, ...node.mount] : mount;
    const scopes: string[] = [path];
    for (let p: Placed | undefined = parent; p; p = p.parent) scopes.push(p.path);
    const self: Placed = { node, path, parent, stage: 0, parts: [] };
    const own = Array.isArray(node.parts) ? node.parts : [];
    for (const { part, source } of expandIndexed(own)) {
      const moved = shift(part, here);
      const out = { ...moved, id: path ? `${path}.${part.id}` : part.id } as Part;
      if (isSolid(out) && out.tone === undefined && t) out.tone = t;
      if (out.paint === undefined && pa) out.paint = pa;
      if (isSolid(out) && mo.length) out.mount = [...(out.mount ?? []), ...mo];
      self.parts.push({ part: out, src: origin.get(own[source]) ?? `${src}.parts[${source}]`, scopes });
    }
    placed.push(self);
    (Array.isArray(node.children) ? node.children : []).forEach((child, k) => {
      if (!child || typeof child !== "object") return;
      const from = origin.get(child) ?? `${src}.children[${k}]`;
      for (const c of copies(resolve(child, from))) walk(c, from, self, here, t, pa, mo);
    });
  };
  if (root.repeat) errors.push({ code: "root-repeat", path: "root.repeat", vars: { id: String(root.id) } });
  walk({ ...root, repeat: undefined }, "root", undefined, [0, 0, 0], undefined, undefined, []);

  const ids = new Set<string>([...scenery.map((p) => p.id), ...placed.flatMap((n) => n.parts.map((p) => p.part.id))]);
  // Una referencia se busca primero en el propio nodo y luego hacia arriba, hasta las piezas sueltas de la figura.
  const ref = (scopes: string[], id: string) => {
    for (const s of scopes) {
      const full = s ? `${s}.${id}` : id;
      if (ids.has(full)) return full;
    }
    return id;
  };
  for (const n of placed) {
    for (const { part: p, scopes } of n.parts) {
      if ("on" in p && typeof p.on === "string") p.on = ref(scopes, p.on);
      if (Array.isArray(p.mount)) p.mount = p.mount.map((m) => ref(scopes, m));
    }
  }

  // Etapas: explícitas si algún nodo trae `stage`; si no, sale primero lo que está más afuera en su dirección de salida.
  const moving = placed.filter((n) => n.parent && !isZero(n.node.explode));
  const explicit = placed.some((n) => typeof n.node.stage === "number");
  const subtree = (n: Placed) => placed.filter((m) => m === n || m.path.startsWith(n.path ? `${n.path}.` : ""));
  const centerOfNodes = (ns: Placed[]) => {
    const boxes = ns.flatMap((m) => m.parts.map((p) => p.part).filter(isSolid).map(solidBox));
    return boxes.length ? centerOf(boxOf(boxes.flatMap((b) => [b.min, b.max]))) : ([0, 0, 0] as Vec3);
  };
  const keys = new Map<Placed, number>();
  if (explicit) {
    const first = Math.min(...placed.filter((n) => typeof n.node.stage === "number").map((n) => n.node.stage!));
    for (const n of moving) {
      let s: number | undefined;
      for (let p: Placed | undefined = n; p && s === undefined; p = p.parent) s = typeof p.node.stage === "number" ? p.node.stage : undefined;
      keys.set(n, -(s ?? first));
    }
  } else {
    const middle = centerOfNodes(placed);
    for (const n of moving) {
      const out = dot(add(centerOfNodes(subtree(n)), mul(middle, -1)), unit(n.node.explode!));
      keys.set(n, Math.round(out * 2) / 2);
    }
    // Lo que va montado encima sale antes que su base: un hijo nunca después de su padre (la tapa antes que la culata).
    for (const n of moving) {
      let floor = -Infinity;
      for (let p = n.parent; p; p = p.parent) if (keys.has(p)) floor = Math.max(floor, keys.get(p)!);
      if (keys.get(n)! <= floor) keys.set(n, floor + 0.5);
    }
  }
  const order = [...new Set(keys.values())].sort((a, b) => b - a);
  for (const n of moving) n.stage = order.indexOf(keys.get(n)!) + 1;
  const stages = order.length;

  const groups: Record<string, GroupSpec> = { ...extraGroups, ...spec.groups };
  const flat: FlatSpec = { ...spec, parts: [...scenery], groups, root: undefined, defs: undefined };
  scenery.forEach((p, k) => sources.set(p, `parts[${k}]`));
  if (!stages) {
    for (const n of placed) {
      for (const { part, src } of n.parts) {
        flat.parts.push(part);
        sources.set(part, src);
      }
    }
    return { spec: flat, errors, stages: 0, sources };
  }

  // Grupos: cada nodo que se desarma o tiene nombre; lo demás va con su ancestro o, para poder atenuarlo, con la raíz.
  const rootGroup = String(root.id);
  for (const n of placed) if (n.parent && (!isZero(n.node.explode) || n.node.name !== undefined)) n.group = n.path;
  const groupOf = (n: Placed): string => {
    for (let p: Placed | undefined = n; p; p = p.parent) if (p.group) return p.group;
    return rootGroup;
  };
  // Una pieza que ya anima un modelo (`group`) conserva su grupo y el despiece la lleva desde fuera (`outer`).
  const wrap = (p: Part, g: string, src: string): Part => {
    const out = !isSolid(p) ? p : p.group ? { ...p, outer: g } : { ...p, group: g };
    sources.set(out, src);
    return out;
  };
  flat.parts = [
    ...scenery.map((p, k) => wrap(p, rootGroup, `parts[${k}]`)),
    ...placed.flatMap((n) => n.parts.map(({ part, src }) => wrap(part, groupOf(n), src))),
  ];

  const langs = langsOf(spec);
  const words = (l: string) => WORDS[l] ?? WORDS["en"];

  // La lista de piezas: un nombre repetido (las dos culatas) es una sola entrada que elige a todas.
  const entries: { name: Text; note?: Text; nodes: Placed[] }[] = [];
  for (const n of placed) {
    if (n.node.name === undefined || !n.parent) continue;
    const key = JSON.stringify(n.node.name);
    const hit = entries.find((e) => JSON.stringify(e.name) === key);
    if (hit) hit.nodes.push(n);
    else entries.push({ name: n.node.name, note: n.node.note, nodes: [n] });
  }

  const owners = new Map<string, Placed>([[rootGroup, placed[0]]]);
  for (const n of placed) if (n.group) owners.set(n.group, n);
  // Elegir un nodo muestra sus piezas y las de dentro que no se desarman por su cuenta: lo que sale aparte es otra pieza.
  const shows = (n: Placed | undefined, m: Placed) => {
    for (let p = n; p; p = p.parent) {
      if (p === m) return true;
      if (p.stage) return false;
    }
    return false;
  };
  const groupNames = [...new Set(flat.parts.flatMap((p) => (isSolid(p) ? [p.outer ?? p.group!] : [])))];
  const bind: BindSpec[] = [];
  for (const g of groupNames) {
    const owner = owners.get(g);
    const chain: Placed[] = [];
    for (let p = owner; p; p = p.parent) if (p.stage) chain.unshift(p);
    // Cada nodo se desplaza por la suma de su `explode` y los de sus ancestros, cada uno en la ventana de su etapa.
    for (const a of chain) bind.push({ group: g, param: "explode", move: a.node.explode, win: [a.stage - 1, a.stage] });
    // Desplazamiento al final de cada etapa: la cámara encuadra la figura en todas las poses.
    const extent: Vec3[] = [];
    for (let s = 1; s <= stages; s++) {
      const d = chain.filter((a) => a.stage <= s).reduce((acc, a) => add(acc, a.node.explode!), [0, 0, 0] as Vec3);
      if (!isZero(d) && !extent.some((e) => length(add(e, mul(d, -1))) < DIM)) extent.push(d);
    }
    if (extent.length) groups[g] = { ...groups[g], extent: [...(groups[g]?.extent ?? []), ...extent] };
    if (entries.length) {
      const keep: number[] = [];
      entries.forEach((e, k) => {
        if (e.nodes.some((m) => shows(owner, m))) keep.push(k + 1);
      });
      bind.push({ group: g, param: "pick", keep });
    }
  }

  const stepText = (s: number, l: string) => {
    const nodes = moving.filter((n) => n.stage === s);
    const given = nodes.find((n) => n.node.step !== undefined);
    if (given) return textIn(given.node.step, l);
    const names = [...new Set(nodes.map((n) => textIn(n.node.name, l) || n.node.id))];
    return new Intl.ListFormat(l, { type: "conjunction" }).format(names.map((x) => lower(x, l)));
  };
  // Si la spec ya trae un control con el mismo id, se usa el suyo.
  const has = (id: string) => (spec.params ?? []).some((p) => p.id === id);
  const params: ParamSpec[] = [...(spec.params ?? [])];
  if (!has("explode")) {
    params.push({
      id: "explode",
      label: textFor(langs, (l) => words(l).apart),
      min: 0,
      max: stages,
      step: 1,
      value: 0,
      unit: textFor(langs, (l) => `${words(l).of} ${stages}`),
      texts: [
        textFor(langs, (l) => words(l).whole),
        ...Array.from({ length: stages }, (_, k) =>
          textFor(langs, (l) => words(l).step.replace("{n}", String(k + 1)).replace("{m}", String(stages)).replace("{t}", stepText(k + 1, l))),
        ),
      ],
    });
  }
  if (entries.length && !has("pick")) {
    params.push({
      id: "pick",
      label: textFor(langs, (l) => words(l).pick),
      kind: "choice",
      min: 0,
      max: entries.length,
      value: 0,
      options: [textFor(langs, (l) => words(l).all), ...entries.map((e) => e.name)],
      // Sin pieza elegida, la lectura cae en el paso del despiece.
      texts: ["{explode}", ...entries.map((e) => textFor(langs, (l) => [textIn(e.name, l), textIn(e.note, l)].filter(Boolean).join(" · ")))],
    });
  }
  return {
    spec: {
      ...flat,
      params,
      bind: [...(spec.bind ?? []), ...bind],
      readout: spec.readout ?? (entries.length ? "{pick}" : "{explode}"),
      reorder: spec.reorder ?? { param: "explode", at: Array.from({ length: stages }, (_, k) => k + 1) },
    },
    errors,
    stages,
    sources,
  };
}

/** Si el árbol toma piezas de un catálogo (un `use` que no está en `defs`): quien lo dibuje necesitará ese catálogo. */
export function usesCatalog(spec: FigureSpec): boolean {
  const defs = spec.defs ?? {};
  const visit = (n: unknown): boolean => {
    if (!n || typeof n !== "object") return false;
    const node = n as NodeDef;
    if (typeof node.use === "string" && !Object.hasOwn(defs, node.use)) return true;
    return Array.isArray(node.children) && node.children.some(visit);
  };
  return visit(spec.root) || Object.values(defs).some(visit);
}

/** Como `assembleTree`, pero devuelve solo la spec y lanza si el árbol no se puede armar (un `use` que no existe). */
export function assemble(spec: FigureSpec, options: AssembleOptions = {}): FlatSpec {
  const { spec: flat, errors } = assembleTree(spec, options);
  if (errors.length) throw new Error(`isofig «${spec.id}»: ${errors.map((e) => `${e.path}: ${e.code}`).join("; ")}`);
  return flat;
}
