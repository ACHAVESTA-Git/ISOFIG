import { GLYPHS, type GlyphName } from "../types.ts";
import type { GlyphFn } from "./kit.ts";
import { balancer, cdn, gateway } from "./network.ts";
import { fn, server, service } from "./compute.ts";
import { cache, database, external, queue, storage } from "./data.ts";
import { browser, laptop, phone, user } from "./devices.ts";
import { classCabinet, interfaceCabinet } from "./uml.ts";

export type { Glyph, GlyphArgs, GlyphFn } from "./kit.ts";
export { PULL_OUT, type Cabinet, type Drawer } from "./uml.ts";

/** Los roles de color posibles: lo que significa cada color en un mapa; la leyenda los muestra. */
export const ROLES = ["client", "edge", "compute", "data", "messaging", "storage", "external"] as const;
export type Role = (typeof ROLES)[number];

interface Entry {
  role: Role;
  make: GlyphFn;
}

export const CATALOG: Record<GlyphName, Entry> = {
  user: { role: "client", make: user },
  phone: { role: "client", make: phone },
  laptop: { role: "client", make: laptop },
  browser: { role: "client", make: browser },
  cdn: { role: "edge", make: cdn },
  balancer: { role: "edge", make: balancer },
  gateway: { role: "edge", make: gateway },
  service: { role: "compute", make: service },
  server: { role: "compute", make: server },
  function: { role: "compute", make: fn },
  database: { role: "data", make: database },
  cache: { role: "data", make: cache },
  queue: { role: "messaging", make: queue },
  storage: { role: "storage", make: storage },
  external: { role: "external", make: external },
  class: { role: "compute", make: classCabinet },
  interface: { role: "edge", make: interfaceCabinet },
};

export const isGlyph = (name: string | undefined): name is GlyphName => name !== undefined && (GLYPHS as readonly string[]).includes(name);
