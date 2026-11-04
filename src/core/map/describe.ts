import { textOf, type Text } from "../spec.ts";
import type { LinkKind, MapNode, MapSpec } from "./types.ts";

const VERB: Record<LinkKind, Record<"es" | "en", string>> = {
  link: { es: "→", en: "→" },
  inherits: { es: "hereda de", en: "extends" },
  implements: { es: "implementa", en: "implements" },
  composes: { es: "se compone de", en: "is made of" },
  aggregates: { es: "agrupa", en: "groups" },
  depends: { es: "depende de", en: "depends on" },
  associates: { es: "se asocia con", en: "is associated with" },
};

const leaves = (nodes: MapNode[]): MapNode[] => nodes.flatMap((n) => (n.children?.length ? leaves(n.children) : [n]));
const all = (nodes: MapNode[]): MapNode[] => nodes.flatMap((n) => [n, ...all(n.children ?? [])]);

/** Cuántos objetos y enlaces tiene el mapa, para la lectura de la tarjeta. */
export function readoutOf(map: MapSpec): Text {
  const n = leaves(map.nodes).length;
  const l = (map.links ?? []).reduce((s, k) => s + (Array.isArray(k.from) ? k.from.length : 1) * (Array.isArray(k.to) ? k.to.length : 1), 0);
  const f = map.flows?.length ?? 0;
  return {
    es: `${n} ${n === 1 ? "objeto" : "objetos"} · ${l} ${l === 1 ? "enlace" : "enlaces"}${f ? ` · ${f} ${f === 1 ? "flujo" : "flujos"}` : ""}`,
    en: `${n} ${n === 1 ? "object" : "objects"} · ${l} ${l === 1 ? "link" : "links"}${f ? ` · ${f} ${f === 1 ? "flow" : "flows"}` : ""}`,
  };
}

/** La descripción para lectores de pantalla: qué objetos hay y qué se enlaza con qué, ya que el dibujo no se puede leer de otra forma. */
export function altOf(map: MapSpec): Text {
  const byId = new Map(all(map.nodes).map((n) => [n.id, n]));
  const say = (lang: "es" | "en") => {
    const name = (id: string) => textOf(byId.get(id)?.name, lang) || id;
    const groups = (v: string | string[]) => (Array.isArray(v) ? v : [v]).map(name).join(", ");
    const nodes = leaves(map.nodes).map((n) => name(n.id)).join(", ");
    const links = (map.links ?? []).slice(0, 30).map((l) => `${groups(l.from)} ${VERB[l.kind ?? "link"][lang]} ${groups(l.to)}${l.label !== undefined ? ` (${textOf(l.label, lang)})` : ""}`);
    const flows = (map.flows ?? []).map((f) => `${lang === "es" ? "Flujo" : "Flow"} «${textOf(f.label, lang)}»: ${f.path.map(name).join(" → ")}`);
    const head = lang === "es" ? "Mapa" : "Map";
    const lk = lang === "es" ? "Enlaces" : "Links";
    return [`${head}: ${nodes}.`, links.length ? `${lk}: ${links.join("; ")}.` : "", ...flows.map((f) => `${f}.`)].filter(Boolean).join(" ");
  };
  return { es: say("es"), en: say("en") };
}
