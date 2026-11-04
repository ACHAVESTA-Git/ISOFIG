import type { FlatSpec, Part } from "../spec.ts";

/** Lo que importa de `docker compose config --format json`. */
interface ComposeService {
  image?: string;
  ports?: ({ published?: string | number; target?: number } | string)[];
  depends_on?: Record<string, unknown> | string[];
  networks?: Record<string, unknown> | string[];
  volumes?: ({ type?: string; source?: string } | string)[];
  deploy?: { replicas?: number };
}

export interface ComposeFile {
  name?: string;
  services: Record<string, ComposeService>;
}

const ROW = 92;
const COL = 80;
const UNIT = 13;
const W = 46;
const D = 56;

const keysOf = (v: Record<string, unknown> | string[] | undefined): string[] =>
  Array.isArray(v) ? v : Object.keys(v ?? {});

function levels(services: Record<string, ComposeService>): Map<string, number> {
  const memo = new Map<string, number>();
  const visit = (name: string, seen: Set<string>): number => {
    if (memo.has(name)) return memo.get(name)!;
    if (seen.has(name)) return 0;
    seen.add(name);
    const deps = keysOf(services[name]?.depends_on).filter((d) => d in services);
    const level = deps.length ? 1 + Math.max(...deps.map((d) => visit(d, seen))) : 0;
    memo.set(name, level);
    return level;
  };
  for (const name of Object.keys(services)) visit(name, new Set());
  return memo;
}

const fit = (text: string, width: number, max: number) => Math.min(max, width / (Math.max(text.length, 1) * 0.62));

/**
 * Un rack por servicio (una unidad por réplica), sus puertos publicados como conectores, los volúmenes como
 * tambores al lado y cada red como un riel al fondo con el cable de cada servicio que la usa. Lo que depende de
 * otros queda más cerca del lector.
 */
export function fromCompose(compose: ComposeFile, id = "compose"): FlatSpec {
  const services = compose.services ?? {};
  const level = levels(services);
  const depth = Math.max(0, ...level.values());
  const networks = [...new Set(Object.values(services).flatMap((s) => keysOf(s.networks)))];
  const rails = Math.max(networks.length, 1);
  const back = 8 + rails * 8;
  const rows = new Map<number, string[]>();
  for (const name of Object.keys(services)) {
    const l = level.get(name) ?? 0;
    rows.set(l, [...(rows.get(l) ?? []), name]);
  }
  const widest = Math.max(...[...rows.values()].map((r) => r.length));
  const sizeX = back + (depth + 1) * ROW + 8;
  const sizeY = 24 + widest * COL;

  const parts: Part[] = [
    { id: "foot", kind: "cylinder", at: [10, 10, 0], r: 4.5, h: 3, tone: "lo", bevel: 0.5, repeat: { count: 2, step: [sizeX - 20, 0, 0] } },
    { id: "foot-far", kind: "cylinder", at: [10, sizeY - 10, 0], r: 4.5, h: 3, tone: "lo", bevel: 0.5, repeat: { count: 2, step: [sizeX - 20, 0, 0] } },
    { id: "base", kind: "box", at: [0, 0, 3], size: [sizeX, sizeY, 8], radius: 6, bevel: 1.2, tone: "lo", shadow: true, mount: ["foot-0", "foot-1", "foot-far-0", "foot-far-1"] },
    { id: "base-screws", kind: "dots", on: "base", points: [[5, 5, 11], [sizeX - 5, 5, 11], [5, sizeY - 5, 11], [sizeX - 5, sizeY - 5, 11]] },
  ];
  networks.forEach((net, j) => {
    parts.push({ id: `net-${j}`, kind: "box", at: [6 + j * 8, 10, 11], size: [4, sizeY - 20, 2], radius: 1, bevel: 0.4, tone: "mid" });
    parts.push({ id: `net-${j}-name`, kind: "label", on: `net-${j}`, at: [9.6 + j * 8, 14, 13.05], text: net, size: 3, face: "top" });
  });

  const volumeAt = new Map<string, string>();
  for (const [l, names] of rows) {
    names.forEach((name, k) => {
      const s = services[name];
      const x = back + l * ROW;
      const y = 16 + k * COL;
      const units = Math.max(1, Math.min(4, s.deploy?.replicas ?? 1));
      const sid = `svc-${l}-${k}`;
      for (let u = 0; u < units; u++) {
        const uid = `${sid}-u${u}`;
        const z = 11 + u * UNIT;
        parts.push({ id: uid, kind: "box", at: [x, y, z], size: [W, D, UNIT - 0.4], radius: 1.5, bevel: 0.7, tone: "hi", mount: u ? [`${sid}-u${u - 1}`] : [] });
        parts.push({ id: `${uid}-led`, kind: "dots", on: uid, points: [[x + W, y + 6, z + 6]] });
        parts.push({ id: `${uid}-vent-a`, kind: "line", on: uid, points: [[x + W, y + 14, z + 4], [x + W, y + 40, z + 4]] });
        parts.push({ id: `${uid}-vent-b`, kind: "line", on: uid, points: [[x + W, y + 14, z + 8], [x + W, y + 40, z + 8]] });
      }
      const top = 11 + units * UNIT - 0.4;
      const top0 = `${sid}-u${units - 1}`;
      parts.push({ id: `${sid}-name`, kind: "label", on: top0, at: [x + W - 12, y + 5, top + 0.05], text: name, size: fit(name, D - 10, 7), face: "top" });
      const published = (s.ports ?? []).filter((p) => typeof p === "string" || p.published !== undefined).slice(0, 3);
      published.forEach((_, i) => {
        parts.push({ id: `${sid}-port-${i}`, kind: "cylinder", at: [x + W, y + 46 - i * 7, 11 + 6], r: 2.4, h: 2, axis: "x", bevel: 0.4, tone: "lit", mount: [`${sid}-u0`] });
      });
      networks.forEach((net, j) => {
        if (!keysOf(s.networks).includes(net)) return;
        const cy = y + 10 + j * 6;
        parts.push({ id: `${sid}-cable-${j}`, kind: "line", on: `net-${j}`, points: [[8 + j * 8, cy, 13], [x, cy, 11.05]], bold: true });
      });
      for (const v of s.volumes ?? []) {
        const source = typeof v === "string" ? v.split(":")[0] : v.type === "volume" ? v.source : undefined;
        if (!source || volumeAt.has(source)) continue;
        const vid = `vol-${volumeAt.size}`;
        volumeAt.set(source, vid);
        parts.push({ id: vid, kind: "cylinder", at: [x + W / 2, y + D + 12, 11], r: 8, h: 16, bevel: 0.8, tone: "mid" });
        parts.push({ id: `${vid}-name`, kind: "label", on: vid, at: [x + W / 2 + 2.5, y + D + 6, 27.05], text: source, size: fit(source, 12, 3.6), face: "top" });
      }
    });
  }

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const order = [...level.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n);
  return {
    id,
    title: compose.name ?? "docker compose",
    hint: { en: "Back to front: what each service depends on", es: "De atrás hacia adelante: de qué depende cada servicio" },
    caption: {
      en: `${order.join(" ← ")}. Each unit is a replica; green jacks are published ports; drums are named volumes; rails at the back are networks.`,
      es: `${order.join(" ← ")}. Cada unidad es una réplica; los conectores verdes, puertos publicados; los tambores, volúmenes con nombre; los rieles del fondo, redes.`,
    },
    readout: {
      en: `${count(order.length, "service", "services")} · ${count(networks.length, "network", "networks")} · ${count(volumeAt.size, "volume", "volumes")}`,
      es: `${count(order.length, "servicio", "servicios")} · ${count(networks.length, "red", "redes")} · ${count(volumeAt.size, "volumen", "volúmenes")}`,
    },
    width: 680,
    height: 440,
    camera: { azimuth: 40, elevation: 32 },
    parts,
  };
}
