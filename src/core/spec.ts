import type { Axis } from "./mesh.ts";
import type { Vec2, Vec3 } from "./math.ts";
import type { MapSpec } from "./map/types.ts";

export type { Vec2, Vec3, Axis };

/** Texto fijo o por idioma: `"Hola"` o `{ es: "Hola", en: "Hello" }`. */
export type Text = string | Record<string, string>;

/** `lo` base y patas, `mid` estructura, `hi` el sujeto, `lit` el único acento. */
export type Tone = "lo" | "mid" | "hi" | "lit";

export interface PartBase {
  id: string;
  tone?: Tone;
  group?: string;
  hidden?: boolean;
  /**
   * Copias desplazadas; `{i}` en `id` o `group` se reemplaza por el índice. `from` es el primer valor de `{i}` (0 por
   * defecto): la copia número k va a `step × k` y se llama `from + k`, así dos filas pueden repartirse los números de
   * un mismo grupo (`fila-0…13` y `fila-14…27`).
   */
  repeat?: { count: number; step: Vec3; from?: number };
  /** La pieza cuelga o flota a propósito: la auditoría no exige apoyo. */
  float?: boolean;
  /** Ids de piezas en las que esta va encajada a propósito (no cuenta como choque). */
  mount?: string[];
  /** Halo suave en el piso bajo la pieza. */
  shadow?: boolean;
  /**
   * Rol o material que la pinta (`"data"`, `"steel"`…): toma su color de `--isofig-paint-<nombre>` y su sombreado de
   * siempre. Un estado del modelo y el tono `lit` ganan sobre la pintura.
   */
  paint?: string;
  /** Grupo que la lleva además del suyo: lo pone el ensamblado cuando una pieza animada por un modelo se despieza. */
  outer?: string;
  /**
   * Una pieza del piso (una bandeja, una cinta pegada al suelo): se pinta antes que todo lo que se apoya o pasa sobre
   * ella, sin pelear el orden con las piezas que se alzan. Los mapas la usan para sus bandejas y sus rutas.
   */
  ground?: boolean;
}

export interface BoxPart extends PartBase {
  kind: "box";
  at: Vec3;
  size: Vec3;
  radius?: number;
  bevel?: number;
}

export interface CylinderPart extends PartBase {
  kind: "cylinder";
  /** Centro de la cara inicial. */
  at: Vec3;
  r: number;
  h: number;
  /** `x`, `y`, `z` o cualquier dirección (`[1, 0, 1]`): una biela inclinada. */
  axis?: Axis | Vec3;
  bevel?: number;
}

/** Tronco de cono: radio `r` en la cara inicial y `r2` en la otra. Toberas, embudos, conos de nariz. */
export interface ConePart extends PartBase {
  kind: "cone";
  /** Centro de la cara inicial. */
  at: Vec3;
  r: number;
  r2: number;
  h: number;
  axis?: Axis | Vec3;
}

export interface PrismPart extends PartBase {
  kind: "prism";
  /** Planta convexa. Con `axis` `z` (por defecto) son puntos [x, y]; con `y`, [x, z]; con `x`, [y, z]. */
  plan: Vec2[];
  /** Dónde empieza la extrusión a lo largo del eje (una z, o una y o una x con `axis`). */
  z: number;
  h: number;
  /** Eje de la extrusión: `y` o `x` para el perfil de un bloque en V o de una viga. */
  axis?: Axis;
  bevel?: number;
}

/** Detalles que se dibujan sobre otra pieza (`on`) y comparten su lugar en el orden de pintado. */
export interface TicksPart extends Omit<PartBase, "group"> {
  kind: "ticks";
  on: string;
  from: Vec3;
  along: Vec3;
  count: number;
  toward: Vec3;
  every?: number;
  size?: [number, number];
}

export interface DotsPart extends Omit<PartBase, "group"> {
  kind: "dots";
  on: string;
  points: Vec3[];
}

export interface LinePart extends Omit<PartBase, "group"> {
  kind: "line";
  on: string;
  points: Vec3[];
  bold?: boolean;
}

/** Texto grabado en una cara: `top` (se lee a lo largo de y), `x` o `y` (caras que miran al lector, de pie). */
export interface LabelPart extends Omit<PartBase, "group"> {
  kind: "label";
  on: string;
  at: Vec3;
  text: Text;
  size?: number;
  face?: "top" | "x" | "y";
  /** Dónde cae `at` en el texto: al inicio (por defecto), al centro o al final. */
  align?: "start" | "middle" | "end";
}

export type Part = BoxPart | CylinderPart | ConePart | PrismPart | TicksPart | DotsPart | LinePart | LabelPart;

export interface GroupSpec {
  /** Desplazamientos extremos (mundo) para que la figura quepa en cualquier pose. */
  extent?: Vec3[];
  /** Giro dentro de un plano alrededor de `center`. */
  spin?: { center: Vec3; plane: "xy" | "xz" | "yz" };
}

export interface ParamSpec {
  id: string;
  label: Text;
  min: number;
  max: number;
  value: number;
  step?: number;
  unit?: Text;
  /** Unidad para lectores de pantalla («peticiones por segundo»); por defecto, `unit`. */
  spoken?: Text;
  /**
   * `range` (por defecto), `toggle` (0 o 1), `choice` (el valor es el índice en `options`) o `action`: un botón
   * que suma 1 cada vez que se pulsa; el modelo compara el contador para saber que pasó («borrar un pod»).
   */
  kind?: "range" | "toggle" | "choice" | "action";
  /** El modelo lo recibe con su valor, pero no se muestra el control. */
  hidden?: boolean;
  options?: Text[];
  /** Texto de cada valor entero (0, 1, 2…): la lectura lo muestra en `{id}` y el lector de pantalla lo anuncia. */
  texts?: Text[];
}

/** Un botón que fija varios parámetros de golpe: la forma de romper la figura a propósito. */
export interface PresetSpec {
  label: Text;
  values: Record<string, number>;
  /** Qué mirar después de pulsarlo; se anuncia a los lectores de pantalla. */
  note: Text;
  /** Vuelve a empezar el modelo con los valores nuevos. */
  reset?: boolean;
  /** Ids de parámetros `action` que el desvío pulsa después de fijar `values` (y de `reset`). */
  press?: string[];
}

/** Enlace declarativo parámetro → grupo, para figuras sin modelo propio. */
export interface BindSpec {
  group: string;
  param: string;
  move?: Vec3;
  spin?: number;
  fade?: boolean;
  /** Ventana del parámetro: el enlace usa (valor − a) / (b − a), recortado entre 0 y 1. */
  win?: [number, number];
  /** Con una elección distinta de 0 que no está en la lista, el grupo se atenúa. */
  keep?: number[];
}

/** Los roles que usa la figura y, opcional, el color de marca del que se derivan. */
export interface PaletteSpec {
  /** `#rrggbb` u `oklch(L C h)`: los roles se generan alrededor de este color, con las mismas garantías. */
  base?: string;
  /** Roles que la figura usa, en el orden de su leyenda. */
  use?: string[];
}

/**
 * Un nodo de la especificación anidada: un conjunto con sus piezas y sus subconjuntos. Las coordenadas de `parts` y
 * de los hijos son locales al `at` del nodo. Se aplana al compilar (ver `assemble`).
 */
export interface Node {
  id: string;
  name?: Text;
  /** Qué hace la pieza, en una línea: la lectura lo muestra al elegirla. */
  note?: Text;
  /** Texto del paso en que sale al desarmar («culatas fuera»); por defecto, su nombre. */
  step?: Text;
  at?: Vec3;
  /** Desplazamiento al desarmar, relativo a su padre. */
  explode?: Vec3;
  /** Orden del despiece: los nodos con el mismo número salen juntos. Por defecto, de fuera hacia dentro. */
  stage?: number;
  parts?: Part[];
  children?: Node[];
  /** Copias del subárbol entero; `{i}` en los textos del nodo se reemplaza por el índice. */
  repeat?: { count: number; step: Vec3; from?: number };
  /** Toma el subárbol de `defs` o, si no está, del catálogo que se le pase a `assemble`. */
  use?: string;
  /** Opciones para `use`: en `defs`, reemplazan `{clave}` en los textos y valores del subárbol. */
  with?: Record<string, unknown>;
  tone?: Tone;
  /** Lo heredan las piezas y los nodos de dentro que no traen uno propio. */
  paint?: string;
  /** Piezas en las que va encajado todo el nodo (un pistón en su bancada): se suma al `mount` de cada pieza. */
  mount?: string[];
}

/** Un subárbol reutilizable de `defs`: el `id` lo pone quien lo usa. */
export type NodeDef = Omit<Node, "id"> & { id?: string };

/**
 * Un recorrido declarativo, con o sin modelo: el grupo viaja por la polilínea `path` a velocidad constante (según la
 * longitud del arco) y vuelve a empezar. Respeta el botón de pausa; con movimiento reducido se queda quieto en una pose
 * fija.
 */
export interface TrackSpec {
  /** Grupo (el `group` de sus piezas) que viaja. Sus piezas se dibujan donde empieza `path`. */
  group: string;
  /** Puntos del recorrido en el mundo; el primero es donde están dibujadas las piezas. */
  path: Vec3[];
  /** Segundos que tarda en recorrer `path` entera. */
  period: number;
  /** Segundos que espera antes de salir la primera vez. */
  delay?: number;
  /** `false`: lo recorre una vez y se queda al final. Por defecto vuelve a empezar. */
  loop?: boolean;
  /** Tramos del recorrido, como fracciones del arco (`[0.4, 0.5]`), en que el grupo no se ve: pasa por dentro de un objeto. */
  hide?: [number, number][];
}

export interface FigureSpec {
  id: string;
  title: Text;
  hint?: Text;
  caption?: Text;
  /** Descripción para lectores de pantalla; por defecto, el pie. */
  alt?: Text;
  width?: number;
  height?: number;
  pad?: number;
  camera?: { azimuth?: number; elevation?: number };
  /** Las piezas sueltas (un escenario fijo si además hay `root`). */
  parts?: Part[];
  /** Árbol de nodos anidados: se aplana a `parts` al compilar y, si algún nodo trae `explode`, se puede desarmar. */
  root?: Node;
  defs?: Record<string, NodeDef>;
  /** Recalcula el orden de pintado con los grupos movidos por `bind` en cada valor `at` del parámetro. */
  reorder?: { param: string; at: number[] };
  groups?: Record<string, GroupSpec>;
  params?: ParamSpec[];
  bind?: BindSpec[];
  /** Grupos que recorren una polilínea, con o sin modelo (los paquetes de un mapa). */
  tracks?: TrackSpec[];
  /** Una topología, un mapa de flujo o un diagrama UML: se compila a un árbol `root` y a `tracks` (ver `docs/es/mapas.md`). */
  map?: MapSpec;
  readout?: Text;
  presets?: PresetSpec[];
  /** Nombre con el que la página registra el modelo en el runtime. */
  model?: string;
  autoplay?: boolean;
  /**
   * `tau`: constante de la interpolación (s). `settle`: con movimiento reducido, segundos que se simulan de golpe al
   * montar y tras cada control o desvío, para mostrar el estado ya asentado sin animarlo.
   */
  motion?: { tau?: number; settle?: number };
  /** Presupuesto en KB gzip para `isofig check`. */
  budget?: number;
  palette?: PaletteSpec;
}

/** Una spec ya aplanada: siempre trae sus piezas. */
export type FlatSpec = FigureSpec & { parts: Part[] };

export function textOf(t: Text | undefined, lang: string): string {
  if (t === undefined) return "";
  if (typeof t === "string") return t;
  return t[lang] ?? t["en"] ?? t["es"] ?? Object.values(t)[0] ?? "";
}
