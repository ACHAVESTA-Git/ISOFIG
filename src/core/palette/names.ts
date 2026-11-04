/**
 * Los nombres de las pinturas, aparte de sus colores (`sets.ts`). `drawScene` solo necesita saber si un nombre existe
 * para pintar `data-paint`; los colores, las etiquetas y la derivación son cosas de la CLI y del build. Así el giro
 * (`isofig/orbit`), que redibuja la escena en el navegador, no arrastra las tablas de colores.
 */
export const ROLE_NAMES = ["client", "edge", "compute", "data", "messaging", "storage", "external"] as const;
export const MATERIAL_NAMES = ["aluminium", "steel", "iron", "copper", "brass", "rubber", "carbon", "glass", "lacquer"] as const;
export type PaintName = (typeof ROLE_NAMES)[number] | (typeof MATERIAL_NAMES)[number];

/** Los nombres de pintura conocidos. `sets.ts` define cada uno y una prueba comprueba que no falte ninguno. */
export const PAINT_NAMES: ReadonlySet<string> = new Set<string>([...ROLE_NAMES, ...MATERIAL_NAMES]);

/** Colores de estado (`ok`, `warn`, `fail`): los fija el tema, no la spec, y nunca son una pintura. */
export const RESERVED = ["ok", "warn", "fail"] as const;
