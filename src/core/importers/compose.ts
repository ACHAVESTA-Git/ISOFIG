import type { FigureSpec, Text } from "../spec.ts";
import { inferGlyph } from "../map/infer.ts";
import type { MapLink, MapNode } from "../map/types.ts";

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

const keysOf = (v: Record<string, unknown> | string[] | undefined): string[] => (Array.isArray(v) ? v : Object.keys(v ?? {}));

/** Un puerto publicado como «8080→80». */
function portOf(p: NonNullable<ComposeService["ports"]>[number]): string | undefined {
  if (typeof p === "string") {
    const [host, target] = p.split(":").slice(-2);
    return target ? `${host}→${target.split("/")[0]}` : undefined;
  }
  return p.published !== undefined ? `${p.published}→${p.target ?? p.published}` : undefined;
}

/**
 * Un mapa a partir de un compose: cada servicio es el objeto que sugiere su imagen (Postgres, una base de datos; Redis,
 * un caché; nginx, un balanceador; lo demás, un servicio), una cinta va de cada servicio a lo que necesita
 * (`depends_on`), los puertos publicados entran desde un globo de Internet y cada volumen con nombre es un balde al
 * que apunta una cinta punteada. Las réplicas van en el rótulo («api ×3»). Es una spec normal: se edita a mano.
 */
export function fromCompose(compose: ComposeFile, id = "compose"): FigureSpec {
  const services = compose.services ?? {};
  const names = Object.keys(services);
  const nodes: MapNode[] = [];
  const links: MapLink[] = [];
  const volumes = new Map<string, string>();
  const published: [string, string][] = [];
  for (const name of names) {
    const s = services[name];
    const replicas = s.deploy?.replicas ?? 1;
    nodes.push({ id: name, is: inferGlyph(`${name} ${s.image ?? ""}`) ?? "service", name: replicas > 1 ? `${name} ×${replicas}` : name });
    for (const dep of keysOf(s.depends_on).filter((d) => d in services)) links.push({ from: name, to: dep });
    for (const p of (s.ports ?? []).map(portOf)) if (p) published.push([name, p]);
    for (const v of s.volumes ?? []) {
      const source = typeof v === "string" ? v.split(":")[0] : v.type === "volume" ? v.source : undefined;
      // Un bind mount (`./datos`, `/var/…`) no es un volumen con nombre.
      if (!source || /^[./~]/.test(source)) continue;
      if (!volumes.has(source)) volumes.set(source, `vol-${volumes.size}`);
      links.push({ from: name, to: volumes.get(source)!, dashed: true, arrow: "none" });
    }
  }
  if (published.length) {
    nodes.unshift({ id: "internet", is: "cdn", name: "Internet" });
    for (const [name, p] of published) links.push({ from: "internet", to: name, label: p });
  }
  for (const [source, vid] of volumes) nodes.push({ id: vid, is: "storage", name: source });
  const nets = [...new Set(names.flatMap((n) => keysOf(services[n].networks)))];
  const list = names.join(", ");
  const caption: Text = {
    es: `${list}. Cada cinta va de un servicio a lo que necesita; las punteadas, a sus volúmenes${nets.length ? `. Redes: ${nets.join(", ")}` : ""}.`,
    en: `${list}. Each ribbon goes from a service to what it needs; the dotted ones, to its volumes${nets.length ? `. Networks: ${nets.join(", ")}` : ""}.`,
  };
  return {
    id,
    title: compose.name ?? "docker compose",
    hint: { es: "De la entrada a lo que cada servicio necesita", en: "From the entrance to what each service needs" },
    caption,
    map: { layout: "flow", nodes, links },
  };
}

