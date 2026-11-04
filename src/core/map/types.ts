import type { Part, Text, TrackSpec, Vec3 } from "../spec.ts";

/** Los objetos del catálogo: cada nodo hoja de un mapa es uno de estos. */
export const GLYPHS = [
  "user", "phone", "laptop", "browser",
  "cdn", "balancer", "gateway",
  "service", "server", "function",
  "database", "cache", "queue", "storage",
  "external",
  "class", "interface",
] as const;
export type GlyphName = (typeof GLYPHS)[number];

/** Cómo se reparten los hijos de un contenedor (o del mapa entero). */
export type MapLayout = "flow" | "layers" | "grid";

export interface MapNode {
  id: string;
  /**
   * Un objeto del catálogo (`GLYPHS`). Un nodo con `children` es un contenedor y `is` es solo su etiqueta
   * («region», «vpc», «subnet»…); `package` le pone la pestaña de carpeta de UML.
   */
  is?: string;
  /** El rótulo grabado; por defecto, el `id`. */
  name?: Text;
  /** Un rol de color (`client`, `edge`, `compute`, `data`, `messaging`, `storage`, `external`) en vez del que trae el objeto. */
  paint?: string;
  children?: MapNode[];
  /** Cómo se reparten sus hijos; por defecto, el del mapa. */
  layout?: MapLayout;
  /** En `grid`: la celda `[columna, fila]`. */
  cell?: [number, number];
  /** En `flow` y `layers`: fuerza el rango (la columna o el nivel). */
  rank?: number;
  /** Clase o interfaz UML: lo que se graba en el cajón de atributos y en el de métodos. */
  fields?: Text[];
  methods?: Text[];
  /** Clase abstracta: lleva su estereotipo grabado. */
  abstract?: boolean;
  /** El estereotipo de una clase (`«interface»`…); por defecto, el de `abstract` o `interface`. */
  stereotype?: Text;
  /** Una clase con `explode` deja abrir sus cajones con el control «Desarmar». */
  explode?: boolean;
}

export type LinkKind = "link" | "inherits" | "implements" | "composes" | "aggregates" | "depends" | "associates";

export interface MapLink {
  from: string | string[];
  to: string | string[];
  label?: Text;
  /** `link` (por defecto: una flecha de `from` a `to`) o un enlace UML con sus extremos propios. */
  kind?: LinkKind;
  /** Cuál extremo lleva punta: `end` (el de `to`), `start` (el de `from`), los dos o ninguno; reemplaza al de `kind`. */
  arrow?: "end" | "start" | "both" | "none";
  dashed?: boolean;
  /** Rol de color de la cinta. */
  paint?: string;
  /** UML: multiplicidad junto a cada extremo, `["1", "*"]`. */
  mult?: [Text?, Text?];
}

export interface MapFlow {
  id?: string;
  /** Los nodos que recorre, en orden: el paquete sigue la cinta de cada tramo (se crea si no hay enlace). */
  path: string[];
  label: Text;
  /** Segundos entre un paquete y el siguiente; se ajusta para que queden parejos. */
  every?: number;
  /** Unidades del mundo por segundo; por defecto 80. */
  speed?: number;
  /** Segundos que espera antes de salir el primero. */
  delay?: number;
  /** Rol de color del paquete; sin él, el acento. */
  paint?: string;
}

export interface MapSpec {
  layout?: MapLayout;
  nodes: MapNode[];
  links?: MapLink[];
  flows?: MapFlow[];
  /** `false` quita la leyenda; por defecto va si hay más de un color o un flujo. */
  legend?: boolean;
  /** Ancho del `viewBox` para el que se miden los rótulos; por defecto, el de la figura. */
  labelSize?: number;
}

/** Lo que el compilador entrega como árbol: un `Node` de la especificación anidada. */
export interface TreeNode {
  id: string;
  name?: Text;
  note?: Text;
  step?: Text;
  at?: Vec3;
  explode?: Vec3;
  stage?: number;
  parts?: Part[];
  children?: TreeNode[];
}

export interface CompiledMap {
  root: TreeNode;
  tracks: TrackSpec[];
  width: number;
  height: number;
  camera: { azimuth: number; elevation: number };
  /** Tamaño de los rótulos que salió del ajuste, en unidades del mundo. */
  labelSize: number;
  /** Lo que el compilador avisa (un rótulo ilegible, una cinta sin camino libre); `renderFigure` lo vuelve `Issue`. */
  notes: { code: "map-label-small" | "map-route-blocked"; path: string; vars: Record<string, string | number> }[];
}
