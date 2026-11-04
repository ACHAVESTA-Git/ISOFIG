import type { Axis } from "./mesh.ts";
import type { Vec2, Vec3 } from "./math.ts";

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
  axis?: Axis;
  bevel?: number;
}

export interface PrismPart extends PartBase {
  kind: "prism";
  /** Planta convexa en sentido antihorario. */
  plan: Vec2[];
  z: number;
  h: number;
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

export type Part = BoxPart | CylinderPart | PrismPart | TicksPart | DotsPart | LinePart | LabelPart;

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
  parts: Part[];
  groups?: Record<string, GroupSpec>;
  params?: ParamSpec[];
  bind?: BindSpec[];
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
}

export function textOf(t: Text | undefined, lang: string): string {
  if (t === undefined) return "";
  if (typeof t === "string") return t;
  return t[lang] ?? t["en"] ?? t["es"] ?? Object.values(t)[0] ?? "";
}
