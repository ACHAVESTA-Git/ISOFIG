import type { FigureSpec, Text } from "../spec.ts";
import { inferGlyph } from "../map/infer.ts";
import type { GlyphName, LinkKind, MapLayout, MapLink, MapNode } from "../map/types.ts";

const ID = "[A-Za-z0-9_\\u00C0-\\u024F-]+";

/** Las formas de un nodo de `flowchart`, de la más específica a la más general: abre, cierra y qué objeto sugiere. */
const SHAPES: [string, string, GlyphName | undefined][] = [
  ["[(", ")]", "database"],
  ["((", "))", "user"],
  ["([", "])", undefined],
  ["[[", "]]", undefined],
  ["{{", "}}", undefined],
  ["[/", "/]", undefined],
  ["[\\", "\\]", undefined],
  [">", "]", "queue"],
  ["{", "}", "gateway"],
  ["[", "]", undefined],
  ["(", ")", undefined],
];

const clean = (s: string): string =>
  s
    .replace(/^"(.*)"$/s, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

interface Ref {
  id: string;
  label?: string;
  glyph?: GlyphName;
}

/** Un nodo suelto: `A`, `A[Texto]`, `A((Texto))`… */
function parseNode(src: string): Ref | undefined {
  const t = src.trim();
  const m = new RegExp(`^(${ID})\\s*(.*)$`, "s").exec(t);
  if (!m) return undefined;
  const rest = m[2].replace(/:::[A-Za-z0-9_-]+$/, "").trim();
  if (!rest) return { id: m[1] };
  for (const [open, close, glyph] of SHAPES) {
    if (rest.startsWith(open) && rest.endsWith(close) && rest.length >= open.length + close.length) {
      return { id: m[1], label: clean(rest.slice(open.length, rest.length - close.length)), glyph };
    }
  }
  // Algo que no es una forma conocida detrás del id: no es un nodo.
  return undefined;
}

const ARROWS: { re: RegExp; dashed: boolean; arrow: "to" | "none" | "both" }[] = [
  { re: /^<-+>/, dashed: false, arrow: "both" },
  { re: /^<-\.+->/, dashed: true, arrow: "both" },
  { re: /^-\.+->/, dashed: true, arrow: "to" },
  { re: /^-\.+-(?!>)/, dashed: true, arrow: "none" },
  { re: /^=+>/, dashed: false, arrow: "to" },
  { re: /^={3,}/, dashed: false, arrow: "none" },
  { re: /^-{2,}[>ox]/, dashed: false, arrow: "to" },
  { re: /^-{3,}/, dashed: false, arrow: "none" },
];

/** Divide una línea de flowchart en nodos y flechas, en orden: `A --> B -.->|texto| C`. */
function tokens(line: string): { nodes: string[][]; links: { dashed: boolean; arrow: "to" | "none" | "both"; label?: string }[] } {
  const nodes: string[][] = [[]];
  const links: { dashed: boolean; arrow: "to" | "none" | "both"; label?: string }[] = [];
  let buf = "";
  let i = 0;
  const flush = () => {
    const parts = buf.split("&").map((p) => p.trim()).filter(Boolean);
    nodes[nodes.length - 1].push(...parts);
    buf = "";
  };
  let depth = 0;
  while (i < line.length) {
    const c = line[i];
    if ("[({".includes(c)) depth++;
    if ("])}".includes(c)) depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const rest = line.slice(i);
      // `A -- texto --> B` y `A == texto ==> B`: el texto va entre dos mitades de la flecha.
      const spoken = /^(--|==|-\.)\s+([^-=>|][^>|]*?)\s+(-->|==>|\.->|---|===|\.-)/.exec(rest);
      const hit = spoken ? undefined : ARROWS.find((a) => a.re.test(rest));
      if (spoken) {
        flush();
        const solid = spoken[3];
        links.push({ dashed: spoken[1] === "-.", arrow: solid.endsWith(">") ? "to" : "none", label: clean(spoken[2]) });
        nodes.push([]);
        i += spoken[0].length;
        continue;
      }
      if (hit) {
        flush();
        const m = hit.re.exec(rest)!;
        i += m[0].length;
        const label = /^\|([^|]*)\|/.exec(line.slice(i));
        if (label) i += label[0].length;
        links.push({ dashed: hit.dashed, arrow: hit.arrow, label: label ? clean(label[1]) : undefined });
        nodes.push([]);
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return { nodes, links };
}

/** El texto de Mermaid es de un solo idioma: queda tal cual. */
const same = (s: string): Text => s;

/** El objeto de un nodo: lo que dice su rótulo («Postgres», «Redis») gana sobre lo que sugiere su forma. */
function nodeOf(r: Ref): MapNode {
  const label = r.label ?? r.id;
  return { id: r.id, is: inferGlyph(label) ?? r.glyph ?? "service", name: label };
}

export interface MermaidResult {
  spec: FigureSpec;
  /** Lo que no se pudo leer (líneas que no son parte del subconjunto), para que quien importa lo sepa. */
  skipped: string[];
}

function flowchart(lines: string[], id: string): MermaidResult {
  const head = /^(?:flowchart|graph)\s*([A-Za-z]{0,2})/i.exec(lines[0])!;
  const dir = (head[1] || "TD").toUpperCase();
  const layout: MapLayout = dir === "LR" || dir === "RL" ? "flow" : "layers";
  const nodes = new Map<string, Ref>();
  const order: string[] = [];
  const parentOf = new Map<string, string>();
  const groups: { id: string; title?: string; parent?: string; kids: string[] }[] = [];
  const stack: number[] = [];
  const links: MapLink[] = [];
  const skipped: string[] = [];
  const remember = (r: Ref): void => {
    const known = nodes.get(r.id);
    if (!known) {
      nodes.set(r.id, r);
      order.push(r.id);
      if (stack.length) {
        const g = groups[stack[stack.length - 1]];
        g.kids.push(r.id);
        parentOf.set(r.id, g.id);
      }
    } else {
      if (r.label !== undefined) known.label = r.label;
      if (r.glyph !== undefined) known.glyph = r.glyph;
    }
  };
  for (const raw of lines.slice(1)) {
    const line = raw.replace(/%%.*$/, "").trim();
    if (!line) continue;
    if (/^(classDef|class|style|linkStyle|click|direction|accTitle|accDescr)\b/.test(line)) continue;
    const sub = new RegExp(`^subgraph\\s+(${ID})?\\s*(?:\\[(.*)\\])?\\s*$`).exec(line);
    if (/^subgraph\b/.test(line)) {
      const title = sub?.[2] !== undefined ? clean(sub[2]) : sub?.[1] ? sub[1] : clean(line.replace(/^subgraph\s*/, ""));
      const gid = sub?.[1] ?? `grupo-${groups.length + 1}`;
      groups.push({ id: gid, title, parent: stack.length ? groups[stack[stack.length - 1]].id : undefined, kids: [] });
      if (stack.length) groups[stack[stack.length - 1]].kids.push(gid);
      stack.push(groups.length - 1);
      continue;
    }
    if (line === "end") {
      stack.pop();
      continue;
    }
    const { nodes: cols, links: arrows } = tokens(line);
    const refs = cols.map((col) => col.map(parseNode));
    if (refs.some((c) => c.some((r) => !r)) || !refs.every((c) => c.length)) {
      skipped.push(line);
      continue;
    }
    for (const c of refs) for (const r of c) remember(r!);
    arrows.forEach((a, k) => {
      for (const f of refs[k]) {
        for (const t of refs[k + 1]) {
          links.push({
            from: f!.id,
            to: t!.id,
            ...(a.label ? { label: same(a.label) } : {}),
            ...(a.arrow === "none" ? { arrow: "none" as const } : a.arrow === "both" ? { arrow: "both" as const } : {}),
            ...(a.dashed ? { dashed: true } : {}),
          });
        }
      }
    });
  }
  const build = (nid: string): MapNode => {
    const g = groups.find((x) => x.id === nid);
    if (g) return { id: g.id, ...(g.title ? { name: same(g.title) } : {}), children: g.kids.map(build) };
    return nodeOf(nodes.get(nid)!);
  };
  const top = [...order.filter((n) => !parentOf.has(n)), ...groups.filter((g) => !g.parent).map((g) => g.id)];
  const ordered = [...new Set([...order, ...groups.map((g) => g.id)])].filter((n) => top.includes(n));
  const spec: FigureSpec = {
    id,
    title: "Mermaid",
    map: { layout, nodes: ordered.map(build), links },
  } as FigureSpec;
  return { spec, skipped };
}

const REL: { re: RegExp; make: (a: string, b: string) => { from: string; to: string; kind: LinkKind; dashed?: boolean; flip?: boolean; arrow?: "end" } }[] = [
  { re: /^<\|--$/, make: (a, b) => ({ from: b, to: a, kind: "inherits", flip: true }) },
  { re: /^--\|>$/, make: (a, b) => ({ from: a, to: b, kind: "inherits" }) },
  { re: /^<\|\.\.$/, make: (a, b) => ({ from: b, to: a, kind: "implements", flip: true }) },
  { re: /^\.\.\|>$/, make: (a, b) => ({ from: a, to: b, kind: "implements" }) },
  { re: /^\*--$/, make: (a, b) => ({ from: a, to: b, kind: "composes" }) },
  { re: /^--\*$/, make: (a, b) => ({ from: b, to: a, kind: "composes", flip: true }) },
  { re: /^o--$/, make: (a, b) => ({ from: a, to: b, kind: "aggregates" }) },
  { re: /^--o$/, make: (a, b) => ({ from: b, to: a, kind: "aggregates", flip: true }) },
  { re: /^-->$/, make: (a, b) => ({ from: a, to: b, kind: "associates", arrow: "end" }) },
  { re: /^<--$/, make: (a, b) => ({ from: b, to: a, kind: "associates", arrow: "end", flip: true }) },
  { re: /^\.\.>$/, make: (a, b) => ({ from: a, to: b, kind: "depends" }) },
  { re: /^<\.\.$/, make: (a, b) => ({ from: b, to: a, kind: "depends", flip: true }) },
  { re: /^--$/, make: (a, b) => ({ from: a, to: b, kind: "associates" }) },
  { re: /^\.\.$/, make: (a, b) => ({ from: a, to: b, kind: "associates", dashed: true }) },
];

function classDiagram(lines: string[], id: string): MermaidResult {
  const classes = new Map<string, MapNode>();
  const links: MapLink[] = [];
  const skipped: string[] = [];
  const get = (name: string): MapNode => {
    const key = name.replace(/<.*>$/, "").replace(/~.*~$/, "");
    let n = classes.get(key);
    if (!n) {
      n = { id: key, is: "class", name: same(key) };
      classes.set(key, n);
    }
    return n;
  };
  const stereotype = (n: MapNode, s: string): void => {
    const t = s.toLowerCase();
    if (t === "interface") n.is = "interface";
    else if (t === "abstract") n.abstract = true;
    else n.stereotype = same(s);
  };
  const member = (n: MapNode, line: string): void => {
    const text = line.trim();
    if (!text) return;
    const st = /^<<(.+)>>$/.exec(text);
    if (st) return stereotype(n, st[1]);
    const clean = same(text.replace(/[$*]$/, ""));
    if (text.includes("(")) (n.methods ??= []).push(clean);
    else (n.fields ??= []).push(clean);
  };
  let open: MapNode | undefined;
  for (const raw of lines.slice(1)) {
    const line = raw.replace(/%%.*$/, "").trim();
    if (!line) continue;
    if (open) {
      if (line === "}") open = undefined;
      else member(open, line);
      continue;
    }
    if (/^(direction|note|namespace|classDef|style|click|accTitle|accDescr)\b/.test(line)) continue;
    const decl = new RegExp(`^class\\s+(${ID}(?:~[^~]*~)?)\\s*(?:\\[.*\\])?\\s*(\\{)?\\s*$`).exec(line);
    if (decl) {
      const n = get(decl[1]);
      if (decl[2]) open = n;
      continue;
    }
    const inline = /^<<(.+)>>\s+(\S+)$/.exec(line);
    if (inline) {
      stereotype(get(inline[2]), inline[1]);
      continue;
    }
    const colon = new RegExp(`^(${ID})\\s*:\\s*(.+)$`).exec(line);
    const rel = new RegExp(`^(${ID})\\s*(?:"([^"]*)")?\\s*(<\\|--|--\\|>|<\\|\\.\\.|\\.\\.\\|>|\\*--|--\\*|o--|--o|-->|<--|\\.\\.>|<\\.\\.|--|\\.\\.)\\s*(?:"([^"]*)")?\\s*(${ID})\\s*(?::\\s*(.+))?$`).exec(line);
    if (rel) {
      const [, a, ma, op, mb, b, label] = rel;
      const r = REL.find((x) => x.re.test(op))!.make(get(a).id, get(b).id);
      const [from, to] = [r.from, r.to];
      // Las multiplicidades se escribieron junto a `a` y a `b`: si el enlace se dio vuelta, se dan vuelta con él.
      const m: [Text?, Text?] = r.flip ? [mb ? same(mb) : undefined, ma ? same(ma) : undefined] : [ma ? same(ma) : undefined, mb ? same(mb) : undefined];
      links.push({
        from,
        to,
        kind: r.kind,
        ...(r.arrow ? { arrow: r.arrow } : {}),
        ...(r.dashed ? { dashed: true } : {}),
        ...(m[0] || m[1] ? { mult: m } : {}),
        ...(label ? { label: same(clean(label)) } : {}),
      });
      continue;
    }
    if (colon) {
      member(get(colon[1]), colon[2]);
      continue;
    }
    skipped.push(line);
  }
  const spec: FigureSpec = { id, title: "Mermaid", map: { layout: "layers", nodes: [...classes.values()], links } } as FigureSpec;
  return { spec, skipped };
}

/**
 * Un subconjunto de Mermaid hecho mapa: `flowchart`/`graph` (LR → `flow`, TD → `layers`; nodos con sus formas,
 * flechas con texto, `&`, subgrafos) y `classDiagram` (clases con sus atributos y métodos, estereotipos, herencia,
 * composición, agregación, dependencia y multiplicidades). Lo demás se salta y se devuelve en `skipped`.
 */
export function fromMermaidDetailed(source: string, id = "mermaid"): MermaidResult {
  const body = source.replace(/^---\n[\s\S]*?\n---\n/, "");
  const title = /^---\n[\s\S]*?\btitle:\s*(.+)\n[\s\S]*?---/.exec(source)?.[1];
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("%%"));
  const first = lines[0] ?? "";
  let out: MermaidResult;
  if (/^(flowchart|graph)\b/i.test(first)) out = flowchart(lines, id);
  else if (/^classDiagram\b/i.test(first)) out = classDiagram(lines, id);
  else throw new Error("mermaid: solo se entienden «flowchart»/«graph» y «classDiagram»");
  if (title) out.spec.title = same(clean(title));
  return out;
}

export const fromMermaid = (source: string, id = "mermaid"): FigureSpec => fromMermaidDetailed(source, id).spec;
