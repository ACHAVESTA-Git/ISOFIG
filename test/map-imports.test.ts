import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fromCompose } from "../src/core/importers/compose.ts";
import { fromMermaid, fromMermaidDetailed } from "../src/core/importers/mermaid.ts";
import { inferGlyph } from "../src/core/map/infer.ts";
import { renderFigure } from "../src/core/render.ts";
import type { MapNode, MapSpec } from "../src/core/map/types.ts";
import { flatMap } from "./flatten-map.ts";

const mapOf = (spec: { map?: MapSpec }): MapSpec => spec.map!;
const find = (nodes: MapNode[], id: string): MapNode | undefined => nodes.flatMap((n) => [n, ...(n.children ?? [])]).find((n) => n.id === id);

test("el rótulo sugiere el objeto: Postgres es una base de datos, Redis un caché, y sin pista nada", () => {
  const cases: [string, string | undefined][] = [
    ["Postgres 17", "database"], ["redis", "cache"], ["Kafka", "queue"], ["S3 bucket", "storage"], ["API Gateway", "gateway"],
    ["Balanceador", "balancer"], ["CDN", "cdn"], ["Usuario", "user"], ["App móvil", "phone"], ["Servicio de pagos", undefined],
  ];
  for (const [text, glyph] of cases) assert.equal(inferGlyph(text), glyph, text);
});

const FLOW = `%% un ejemplo
flowchart LR
  U((Usuario)) --> CDN[CDN]
  CDN -->|HTTP| LB{Balanceador}
  subgraph VPC [Mi VPC]
    LB --> A1[App 1] & A2[App 2]
    A1 --> DB[(Postgres)]
    A2 -.-> R[Redis cache]
    A2 -- escribe --> Q>Cola]
  end
  Q ==> W[Worker]
  A1 --- W
  classDef x fill:#fff
`;

test("un flowchart de Mermaid pasa a un mapa: formas, flechas con texto, & y subgrafos", () => {
  const r = fromMermaidDetailed(FLOW);
  assert.deepEqual(r.skipped, []);
  const m = mapOf(r.spec);
  assert.equal(m.layout, "flow");
  assert.equal(find(m.nodes, "U")?.is, "user");
  assert.equal(find(m.nodes, "DB")?.is, "database");
  assert.equal(find(m.nodes, "R")?.is, "cache");
  assert.equal(find(m.nodes, "Q")?.is, "queue");
  assert.equal(find(m.nodes, "LB")?.is, "balancer", "el rótulo gana sobre la forma de rombo");
  const vpc = find(m.nodes, "VPC")!;
  assert.deepEqual(vpc.children!.map((n) => n.id).sort(), ["A1", "A2", "DB", "Q", "R"]);
  assert.equal(vpc.name, "Mi VPC");
  const link = (a: string, b: string) => m.links!.find((l) => l.from === a && l.to === b);
  assert.equal(link("CDN", "LB")?.label, "HTTP");
  assert.equal(link("LB", "A1") && link("LB", "A2") ? true : false, true, "A & B se abre en dos enlaces");
  assert.equal(link("A2", "R")?.dashed, true);
  assert.equal(link("A2", "Q")?.label, "escribe");
  assert.equal(link("A1", "W")?.arrow, "none");
  assert.equal(m.links!.length, 9);
});

test("flowchart TD reparte en niveles y se dibuja", () => {
  const spec = fromMermaid("graph TD\n  A[Inicio] --> B{¿Listo?}\n  B -->|sí| C[Fin]\n  B -->|no| A\n");
  assert.equal(mapOf(spec).layout, "layers");
  const r = renderFigure(flatMap(spec), { lang: "es" });
  assert.deepEqual(r.errors, []);
});

const CLASSES = `classDiagram
  class Pago {
    <<abstract>>
    #monto: Dinero
    +cobrar()
  }
  class Notificador {
    <<interface>>
    +avisar(p: Pedido)
  }
  Pedido : -fecha: Fecha
  Pedido : +total() Dinero
  Cliente "1" --> "*" Pedido : hace
  Pedido *-- LineaDePedido
  Pedido o-- Etiqueta
  Pago <|-- PagoConTarjeta
  PagoContraEntrega --|> Pago
  Pedido ..> Notificador
  PagoConTarjeta ..|> Notificador
`;

test("un classDiagram pasa a clases con sus cajones, estereotipos y enlaces UML", () => {
  const r = fromMermaidDetailed(CLASSES);
  assert.deepEqual(r.skipped, []);
  const m = mapOf(r.spec);
  assert.equal(m.layout, "layers");
  assert.equal(find(m.nodes, "Pago")?.abstract, true);
  assert.equal(find(m.nodes, "Notificador")?.is, "interface");
  assert.deepEqual(find(m.nodes, "Pago")?.fields, ["#monto: Dinero"]);
  assert.deepEqual(find(m.nodes, "Pago")?.methods, ["+cobrar()"]);
  assert.deepEqual(find(m.nodes, "Pedido")?.fields, ["-fecha: Fecha"]);
  assert.deepEqual(find(m.nodes, "Pedido")?.methods, ["+total() Dinero"]);
  const link = (a: string, b: string) => m.links!.find((l) => l.from === a && l.to === b);
  assert.equal(link("PagoConTarjeta", "Pago")?.kind, "inherits", "A <|-- B: B hereda de A");
  assert.equal(link("PagoContraEntrega", "Pago")?.kind, "inherits");
  assert.equal(link("Pedido", "LineaDePedido")?.kind, "composes");
  assert.equal(link("Pedido", "Etiqueta")?.kind, "aggregates");
  assert.equal(link("Pedido", "Notificador")?.kind, "depends");
  assert.equal(link("PagoConTarjeta", "Notificador")?.kind, "implements");
  const has = link("Cliente", "Pedido")!;
  assert.deepEqual([has.kind, has.arrow, has.mult, has.label], ["associates", "end", ["1", "*"], "hace"]);
  const r2 = renderFigure(flatMap(r.spec), { lang: "es" });
  assert.deepEqual(r2.errors, []);
});

test("las multiplicidades se dan vuelta con el enlace y lo que no es Mermaid del subconjunto se avisa", () => {
  const m = mapOf(fromMermaid(`classDiagram\n  A "1" <|-- "*" B\n  A <-- C\n`));
  const inh = m.links!.find((l) => l.kind === "inherits")!;
  assert.deepEqual([inh.from, inh.to, inh.mult], ["B", "A", ["*", "1"]]);
  assert.equal(m.links!.find((l) => l.from === "C" && l.to === "A")?.kind, "associates", "A <-- C: la flecha apunta a A");
  const r = fromMermaidDetailed("flowchart LR\n  A --> B\n  esto no es mermaid ((\n");
  assert.equal(r.skipped.length, 1);
  assert.throws(() => fromMermaid("sequenceDiagram\n  A->>B: hola"), /flowchart/);
  assert.equal(fromMermaid("---\ntitle: Mi mapa\n---\nflowchart LR\n  A-->B").title, "Mi mapa");
});

test("un compose pasa a un mapa: objeto por imagen, cintas por depends_on, puertos desde Internet y volúmenes punteados", () => {
  const compose = JSON.parse(readFileSync(new URL("../examples/compose/compose.json", import.meta.url), "utf8"));
  const spec = fromCompose(compose);
  const m = mapOf(spec);
  assert.deepEqual(["web", "api", "worker", "db", "cache"].map((id) => find(m.nodes, id)?.is), ["balancer", "service", "function", "database", "cache"]);
  assert.equal(find(m.nodes, "api")?.name, "api ×3");
  assert.equal(find(m.nodes, "internet")?.is, "cdn");
  assert.ok(m.links!.some((l) => l.from === "web" && l.to === "api"));
  assert.ok(m.links!.some((l) => l.from === "internet" && l.to === "web" && l.label === "8080→80"));
  const volume = m.links!.find((l) => l.to === "vol-0")!;
  assert.deepEqual([volume.from, volume.dashed, volume.arrow], ["db", true, "none"]);
  assert.equal(find(m.nodes, "vol-0")?.name, "pgdata");
  const r = renderFigure(flatMap(spec), { lang: "es" });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(JSON.parse(readFileSync(new URL("../examples/compose/spec.json", import.meta.url), "utf8")), JSON.parse(JSON.stringify(spec)), "el ejemplo publicado es lo que importa la CLI");
});

test("un compose sin puertos ni volúmenes no inventa Internet ni baldes; un bind mount no es un volumen", () => {
  const m = mapOf(fromCompose({ services: { app: { volumes: ["./src:/app", { type: "bind", source: "/x" }] }, db: { image: "mysql" } } }));
  assert.deepEqual(m.nodes.map((n) => n.id), ["app", "db"]);
  assert.deepEqual(m.links, []);
});

test("isofig import mermaid escribe el mapa en JSON, y compose sigue funcionando", () => {
  const cli = fileURLToPath(new URL("../src/cli/index.ts", import.meta.url));
  const run = (args: string[], input: string) => spawnSync(process.execPath, ["--no-warnings", cli, ...args], { input, encoding: "utf8" });
  const a = run(["import", "mermaid", "-"], "flowchart LR\n  A[Usuario] --> B[(Postgres)]\n");
  assert.equal(a.status, 0, a.stderr);
  const spec = JSON.parse(a.stdout);
  assert.equal(spec.map.nodes[1].is, "database");
  const c = run(["import", "compose", "-"], JSON.stringify({ services: { db: { image: "postgres" } } }));
  assert.equal(c.status, 0, c.stderr);
  assert.equal(JSON.parse(c.stdout).map.nodes[0].is, "database");
  assert.equal(run(["import", "otro", "-"], "").status, 1);
});
