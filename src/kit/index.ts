import { expand } from "../core/items.ts";
import type { BoxPart, CylinderPart, GroupSpec, LinePart, Part, PrismPart, Text, Vec2, Vec3 } from "../core/spec.ts";

/**
 * Piezas comunes de las figuras: la base con patas, el zócalo, la placa de rótulo, la regla, los tornillos y los
 * depósitos de piezas ocultas. Son funciones puras que devuelven `Part[]`: lo que haría una figura a mano, sin
 * repetirlo en cada una. Cada una trae un `id` base para que dos usos en la misma figura no choquen.
 */

/** Altura de la tapa de toda base: la placa, la regla y las máquinas se apoyan en z = 11. */
export const BASE_TOP = 11;

const PLATE_THICKNESS = 1.2;
const LEG_HEIGHT = 3;

// Valores que vienen de JSON o de cuentas con decimales: se redondean para que dos usos den el mismo texto.
const r = (v: number) => Math.round(v * 1e4) / 1e4;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function fail(fn: string, name: string, want: string): never {
  throw new TypeError(`kit.${fn}: «${name}» debe ser ${want}`);
}

function pair(fn: string, name: string, v: unknown, want: string): Vec2 {
  if (!Array.isArray(v) || v.length !== 2 || !v.every(finite)) fail(fn, name, want);
  return v as Vec2;
}

function count(fn: string, name: string, v: unknown): number {
  if (!Number.isInteger(v) || (v as number) < 0) fail(fn, name, "un entero de 0 o más");
  return v as number;
}

// ─── Tornillos ───────────────────────────────────────────────────────────────

export interface ScrewsOptions {
  /** Id de la pieza sólida sobre la que van. */
  on: string;
  /** Esquina mínima de esa pieza: `[x, y]`. */
  at: Vec2;
  /** Planta de esa pieza: `[ancho, fondo]`. */
  size: Vec2;
  /** Altura de la tapa donde se clavan. */
  z: number;
  /** Distancia de cada tornillo a los bordes. Por defecto 3. */
  inset?: number;
  /** Por defecto `<on>-screws`. */
  id?: string;
}

/** Un tornillo en cada esquina de una tapa, en este orden: atrás-izquierda, atrás-derecha, adelante-izquierda, adelante-derecha. */
export function screws(options: ScrewsOptions): Part[] {
  const { on, z, inset = 3 } = options;
  if (typeof on !== "string" || !on) fail("screws", "on", "el id de la pieza");
  if (!finite(z)) fail("screws", "z", "un número");
  const [x, y] = pair("screws", "at", options.at, "[x, y] con dos números");
  const [w, d] = pair("screws", "size", options.size, "[ancho, fondo] con dos números");
  const { id = `${on}-screws` } = options;
  const near = (v: number, edge: number) => r(edge + v);
  return [
    {
      id,
      kind: "dots",
      on,
      points: [
        [near(x, inset), near(y, inset), z],
        [near(x + w, -inset), near(y, inset), z],
        [near(x, inset), near(y + d, -inset), z],
        [near(x + w, -inset), near(y + d, -inset), z],
      ],
    },
  ];
}

// ─── Base ────────────────────────────────────────────────────────────────────

export interface BenchOptions {
  /** Planta de la base: `[ancho (x), fondo (y)]`. */
  size: Vec2;
  /** Id de la base; las patas y los tornillos cuelgan de él. Por defecto `base`. */
  id?: string;
  /** Distancia del centro de cada pata a los bordes. Por defecto 12. */
  legInset?: number;
  /** Distancia de cada tornillo a los bordes. Por defecto 6. */
  screwInset?: number;
  /** Radio de las esquinas de la base. Por defecto 7. */
  radius?: number;
}

/**
 * La base con cuatro patas y un tornillo en cada esquina; su tapa queda en z = `BASE_TOP`.
 * Ids: `<id>`, `<id>-legs-far`, `<id>-legs-near` y `<id>-screws`.
 */
export function bench(options: BenchOptions): Part[] {
  const [w, d] = pair("bench", "size", options.size, "[ancho, fondo] con dos números");
  const { id = "base", legInset = 12, screwInset = 6, radius = 7 } = options;
  const leg = (row: "far" | "near", y: number): CylinderPart => ({
    id: `${id}-legs-${row}`,
    kind: "cylinder",
    at: [legInset, r(y), 0],
    r: 5,
    h: LEG_HEIGHT,
    tone: "lo",
    bevel: 0.6,
    repeat: { count: 2, step: [r(w - 2 * legInset), 0, 0] },
  });
  return [
    leg("far", legInset),
    leg("near", d - legInset),
    {
      id,
      kind: "box",
      at: [0, 0, LEG_HEIGHT],
      size: [w, d, BASE_TOP - LEG_HEIGHT],
      radius,
      bevel: 1.4,
      tone: "lo",
      shadow: true,
      mount: [`${id}-legs-far-0`, `${id}-legs-far-1`, `${id}-legs-near-0`, `${id}-legs-near-1`],
    },
    ...screws({ on: id, at: [0, 0], size: [w, d], z: BASE_TOP, inset: screwInset }),
  ];
}

export interface PlinthOptions {
  /** Planta de la base: `[ancho (x), fondo (y)]`. */
  size: Vec2;
  /** Id de la base. Por defecto `base`. */
  id?: string;
  /** Distancia de cada tornillo a los bordes. Por defecto 6. */
  screwInset?: number;
  /** Radio de las esquinas de la base. Por defecto 7. */
  radius?: number;
  /**
   * Una peana baja bajo la base, más chica que ella. `true` la pone a 5 con esquinas de 6; con un objeto se ajusta
   * (`inset`: retranqueo respecto de la base, `radius`: esquinas).
   */
  step?: boolean | { inset?: number; radius?: number };
}

/**
 * Base sin patas, para piezas altas o largas a las que las patas confunden el orden de pintado. Maciza por defecto
 * (de z = 0 a `BASE_TOP`); con `step`, una peana baja y la base encima. Su tapa queda en z = `BASE_TOP`, igual que
 * la de `bench`. Ids: `<id>`, `<id>-step` y `<id>-screws`.
 */
export function plinth(options: PlinthOptions): Part[] {
  const [w, d] = pair("plinth", "size", options.size, "[ancho, fondo] con dos números");
  const { id = "base", screwInset = 6, radius = 7, step = false } = options;
  const tier = step === false ? undefined : { inset: 5, radius: 6, ...(step === true ? {} : step) };
  const foot: BoxPart[] = tier
    ? [
        {
          id: `${id}-step`,
          kind: "box",
          at: [tier.inset, tier.inset, 0],
          size: [r(w - 2 * tier.inset), r(d - 2 * tier.inset), LEG_HEIGHT],
          radius: tier.radius,
          bevel: 0.6,
          tone: "lo",
        },
      ]
    : [];
  const z = tier ? LEG_HEIGHT : 0;
  return [
    ...foot,
    {
      id,
      kind: "box",
      at: [0, 0, z],
      size: [w, d, BASE_TOP - z],
      radius,
      bevel: 1.4,
      tone: "lo",
      shadow: true,
      ...(tier ? { mount: [`${id}-step`] } : {}),
    },
    ...screws({ on: id, at: [0, 0], size: [w, d], z: BASE_TOP, inset: screwInset }),
  ];
}

// ─── Placa y regla ───────────────────────────────────────────────────────────

export interface LabelPlateOptions {
  /** Esquina mínima de la placa: `[x, y]`. */
  at: Vec2;
  /** Planta: `[ancho, fondo]`. Por defecto `[32, 40]`. */
  size?: Vec2;
  /** Por defecto `plate`; las líneas, los tornillos y el texto cuelgan de él. */
  id?: string;
  /** Altura de la superficie donde se apoya. Por defecto `BASE_TOP`. */
  z?: number;
  /** Nombre grabado en la placa, fijo o por idioma: `{ es: "Cola", en: "Queue" }`. Se lee a lo largo de y. */
  text?: Text;
  /** Tamaño del texto. Por defecto 5. */
  textSize?: number;
  /** Cuántas líneas de grabado a lo largo de y. Por defecto 3, o ninguna si hay `text`. */
  lines?: number;
  /** Dónde caen las líneas: `inset` y `pitch` en x, `margin` en y y `taper` lo que se acorta cada una. */
  rules?: { inset?: number; pitch?: number; margin?: number; taper?: number };
  /** Los cuatro tornillos de las esquinas. Por defecto sí. */
  screws?: boolean;
}

/** Placa de rótulo de 1,2 de grueso con sus líneas de grabado o su nombre, y tornillos en las esquinas. */
export function labelPlate(options: LabelPlateOptions): Part[] {
  const [x, y] = pair("labelPlate", "at", options.at, "[x, y] con dos números");
  const [w, d] = options.size === undefined ? [32, 40] : pair("labelPlate", "size", options.size, "[ancho, fondo] con dos números");
  const { id = "plate", z = BASE_TOP, text, textSize = 5, screws: withScrews = true } = options;
  const lines = options.lines ?? (text === undefined ? 3 : 0);
  count("labelPlate", "lines", lines);
  const { inset = 8, pitch = 7, margin = 7, taper = 6 } = options.rules ?? {};
  if (lines > 0 && (inset + (lines - 1) * pitch >= w || d - 2 * margin - (lines - 1) * taper <= 0)) {
    throw new RangeError(`kit.labelPlate: ${lines} líneas no caben en una placa de ${w} × ${d} con esas reglas`);
  }
  const top = r(z + PLATE_THICKNESS);
  const grooves = Array.from(
    { length: lines },
    (_, k): LinePart => ({
      id: `${id}-line-${k + 1}`,
      kind: "line",
      on: id,
      points: [
        [r(x + inset + k * pitch), r(y + margin), top],
        [r(x + inset + k * pitch), r(y + d - margin - k * taper), top],
      ],
    }),
  );
  return [
    { id, kind: "box", at: [x, y, z], size: [w, d, PLATE_THICKNESS], radius: 2, bevel: 0.4, tone: "hi" },
    ...grooves,
    ...(text === undefined
      ? []
      : [{ id: `${id}-text`, kind: "label", on: id, at: [r(x + w / 2 + textSize * 0.35), r(y + d / 2), top], text, size: textSize, face: "top", align: "middle" } satisfies Part]),
    ...(withScrews ? screws({ on: id, at: [x, y], size: [w, d], z: top }) : []),
  ];
}

export interface RulerOptions {
  /** Esquina mínima de la regla: `[x, y]`. La regla corre a lo largo de y. */
  at: Vec2;
  /** Largo, a lo largo de y. */
  length: number;
  /** Por defecto `ruler`; las marcas cuelgan de él. */
  id?: string;
  /** Altura de la superficie donde se apoya. Por defecto `BASE_TOP`. */
  z?: number;
  /** Ancho de la tira, en x. Por defecto 5. */
  width?: number;
  /** Distancia entre marcas. Por defecto 4. */
  pitch?: number;
  /** Cuánto se deja libre en cada punta antes de la primera marca. Por defecto 4. */
  margin?: number;
  /** Cuántas marcas; por defecto las que caben entre los márgenes. */
  count?: number;
  /** Cada cuántas marcas va una mayor. Por defecto 5. */
  every?: number;
  /** Largo de la marca menor y de la mayor. Por defecto `[2, 4]`. */
  size?: [number, number];
  /** Hacia dónde salen las marcas en x: 1 (por defecto) o -1, desde el borde opuesto. */
  toward?: 1 | -1;
}

/** Regla a lo largo de y: una tira baja con una marca cada `pitch` y una mayor cada `every`. */
export function ruler(options: RulerOptions): Part[] {
  const [x, y] = pair("ruler", "at", options.at, "[x, y] con dos números");
  const { length } = options;
  if (!finite(length) || length <= 0) fail("ruler", "length", "un número mayor que 0");
  const { id = "ruler", z = BASE_TOP, width = 5, pitch = 4, margin = 4, every = 5, size = [2, 4], toward = 1 } = options;
  const marks = options.count ?? Math.max(0, Math.floor((length - 2 * margin) / pitch) + 1);
  count("ruler", "count", marks);
  return [
    { id, kind: "box", at: [x, y, z], size: [width, length, 1], radius: 1, tone: "mid" },
    ...(marks === 0
      ? []
      : [
          {
            id: `${id}-ticks`,
            kind: "ticks",
            on: id,
            from: [toward === 1 ? x : r(x + width), r(y + margin), z + 1],
            along: [0, pitch, 0],
            count: marks,
            every,
            toward: [toward, 0, 0],
            size,
          } satisfies Part,
        ]),
  ];
}

// ─── Depósitos y grupos ──────────────────────────────────────────────────────

type Solid = BoxPart | CylinderPart | PrismPart;
/** La pieza de un `pool`: una caja, un cilindro o un prisma, sin lo que pone el depósito (`id`, `group`, `hidden`, `repeat`). */
export type PoolPiece = Solid extends infer S ? (S extends Solid ? Omit<S, "id" | "group" | "hidden" | "repeat"> : never) : never;

export interface PoolOptions {
  /** Nombre de la familia: las piezas se llaman `<id>-0`, `<id>-1`… y cada una es su propio grupo. */
  id: string;
  /** Nombre de la familia de grupos si no es `id`: dos filas que se mueven juntas llevan el mismo (`<group>-0`…). */
  group?: string;
  /** Cuántas piezas. */
  count: number;
  /** La pieza que se repite (una caja, un cilindro o un prisma), sin `id`, `group`, `hidden` ni `repeat`. */
  piece: PoolPiece;
  /** Desplazamiento entre una y la siguiente. Por defecto `[0, 0, 0]`: todas en el mismo sitio y el modelo las mueve. */
  step?: Vec3;
  /** Primer número de los ids y de los grupos; las posiciones siguen contando desde 0. Sirve para una segunda fila. */
  from?: number;
  /** Las piezas empiezan ocultas. Por defecto sí; con `false`, una fila visible. */
  hidden?: boolean;
}

/**
 * N piezas iguales, cada una en su grupo, para un depósito de fichas o una fila: el modelo enciende y apaga las que
 * necesita. Es una sola pieza con `repeat`; con `from` distinto de 0 se expande para numerar desde ahí.
 */
export function pool(options: PoolOptions): Part[] {
  const { id, group = id, piece, step = [0, 0, 0], from = 0, hidden = true } = options;
  if (typeof id !== "string" || !id) fail("pool", "id", "un texto");
  const n = count("pool", "count", options.count);
  count("pool", "from", from);
  if (!piece || !["box", "cylinder", "prism"].includes(piece.kind)) fail("pool", "piece", "una caja, un cilindro o un prisma");
  if (["id", "group", "hidden", "repeat"].some((k) => k in piece)) fail("pool", "piece", "una pieza sin id, group, hidden ni repeat: los pone el depósito");
  if (n === 0) return [];
  const repeated = { ...piece, id: `${id}-{i}`, group: `${group}-{i}`, ...(hidden ? { hidden: true } : {}), repeat: { count: n, step } } as Part;
  if (from === 0) return [repeated];
  return expand([repeated]).map((p, k) => ({ ...p, id: `${id}-${from + k}`, group: `${group}-${from + k}` }) as Part);
}

export interface GroupsOptions {
  /** Desplazamientos extremos de cada grupo (ver `GroupSpec.extent`). */
  extent?: Vec3[];
  /** Giro de cada grupo dentro de un plano (ver `GroupSpec.spin`). */
  spin?: GroupSpec["spin"];
  /** Primer número cuando se dan un prefijo y una cantidad. Por defecto 0. */
  from?: number;
}

const groupOf = ({ extent, spin }: GroupsOptions): GroupSpec => ({
  ...(extent ? { extent: extent.map((v) => [...v] as Vec3) } : {}),
  ...(spin ? { spin: { ...spin, center: [...spin.center] as Vec3 } } : {}),
});

/**
 * Las entradas de `groups` de una familia, en lugar de `Object.fromEntries(range(n).map(…))`:
 * `groupsOf("packet", 6)` da `packet-0` … `packet-5`; `groupsOf(["a", "b"])` da exactamente esos nombres.
 */
export function groupsOf(prefix: string, count: number, options?: GroupsOptions): Record<string, GroupSpec>;
export function groupsOf(names: readonly string[], options?: Omit<GroupsOptions, "from">): Record<string, GroupSpec>;
export function groupsOf(first: string | readonly string[], second?: number | GroupsOptions, third?: GroupsOptions): Record<string, GroupSpec> {
  const named = (names: readonly string[], options: GroupsOptions) => Object.fromEntries(names.map((name) => [name, groupOf(options)]));
  if (typeof first !== "string") return named(first, (second as GroupsOptions | undefined) ?? {});
  const n = count("groupsOf", "count", second);
  const from = count("groupsOf", "from", third?.from ?? 0);
  return named(Array.from({ length: n }, (_, k) => `${first}-${from + k}`), third ?? {});
}

// ─── Catálogo para especificaciones en JSON ──────────────────────────────────

/** Lo que devuelve cada entrada del catálogo: las piezas, y los grupos si las opciones los piden. */
export interface KitResult {
  parts: Part[];
  groups?: Record<string, GroupSpec>;
}

/** `pool` en el catálogo acepta además `extent` (y `spin`): crea también las entradas de `groups`. */
export type CatalogPoolOptions = PoolOptions & Pick<GroupsOptions, "extent" | "spin">;

const entries = {
  bench: (options: BenchOptions): KitResult => ({ parts: bench(options) }),
  plinth: (options: PlinthOptions): KitResult => ({ parts: plinth(options) }),
  labelPlate: (options: LabelPlateOptions): KitResult => ({ parts: labelPlate(options) }),
  ruler: (options: RulerOptions): KitResult => ({ parts: ruler(options) }),
  screws: (options: ScrewsOptions): KitResult => ({ parts: screws(options) }),
  pool: ({ extent, spin, ...options }: CatalogPoolOptions): KitResult => ({
    parts: pool(options),
    ...(extent || spin ? { groups: groupsOf(options.group ?? options.id, options.count, { extent, spin, from: options.from }) } : {}),
  }),
};

export type KitName = keyof typeof entries;

const KEYS: Record<KitName, readonly string[]> = {
  bench: ["size", "id", "legInset", "screwInset", "radius"],
  plinth: ["size", "id", "screwInset", "radius", "step"],
  labelPlate: ["at", "size", "id", "z", "text", "textSize", "lines", "rules", "screws"],
  ruler: ["at", "length", "id", "z", "width", "pitch", "margin", "count", "every", "size", "toward"],
  screws: ["on", "at", "size", "z", "inset", "id"],
  pool: ["id", "group", "count", "piece", "step", "from", "hidden", "extent", "spin"],
};

/** Una opción mal escrita en JSON (`"legInsett"`) no se ignora en silencio: se rechaza con su nombre. */
function strict<K extends KitName>(name: K): (typeof entries)[K] {
  const run = entries[name] as (options: unknown) => KitResult;
  return ((options: unknown) => {
    if (options === null || typeof options !== "object" || Array.isArray(options)) fail(name, "with", "un objeto de opciones");
    const unknown = Object.keys(options).filter((k) => !KEYS[name].includes(k));
    if (unknown.length) throw new TypeError(`kit.${name}: opción desconocida «${unknown[0]}» (las válidas: ${KEYS[name].join(", ")})`);
    return run(options);
  }) as (typeof entries)[K];
}

/**
 * Las piezas por nombre, para que una spec en JSON diga `"use": "bench", "with": { "size": [150, 250] }`.
 * Cada entrada recibe las opciones tal cual y devuelve `{ parts }`; rechaza opciones desconocidas.
 * No tiene prototipo: `catalog["constructor"]` es `undefined`.
 */
export const catalog: Readonly<typeof entries> = Object.freeze(
  Object.assign(Object.create(null), Object.fromEntries((Object.keys(entries) as KitName[]).map((k) => [k, strict(k)]))),
);
