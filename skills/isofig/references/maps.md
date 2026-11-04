# Maps and tracks

A map explains **how things connect**: a network, an order travelling from the shop to the shipment, the classes of a
domain. It is one more format of the same spec, and its rule is the skill's rule: **every node is a small, recognisable
object** (a phone on its stand, a rack, a stack of disks, a conveyor belt with parcels), never a box with a name.
You write nested JSON; isofig lays it out, runs the ribbons across the floor, puts on the UML ends and makes the packets
travel. Full guide: `node_modules/isofig/docs/en/maps.md`; design record: `docs/adr/0003-mapas-con-objetos-reales.md`.
Complete examples: `examples/mapa-tienda/spec.json` (an online shop in a VPC with two flows), `examples/mapa-pedido/spec.json`
(an order with a rejected-payment branch) and `examples/mapa-uml/spec.json` (a shop's domain as classes).

## When a map, when something else

| The concept is | Use |
|---|---|
| A mechanism with a quantity that changes (a queue filling, a bucket emptying) | A machine with a model |
| What it is made of, to take apart | A nested assembly (`assemblies.md`) |
| Which pieces exist, how they connect, what travels between them, in what order | A **map** |
| Classes, interfaces and how they relate | A **map** (UML, `layout: "layers"`) |
| One thing circulating on a machine (a cart on a rail) | `tracks` on a machine |

An architecture diagram or a sketch of boxes and arrows is usually a map: its boxes are the concept, the map is the
object that carries them. Still pass the "when NOT" test in `SKILL.md`: a map that only lists components, with no link,
no flow and nothing to follow, is a table.

## The minimum

```json
{
  "id": "minimal-map",
  "title": { "es": "Un pedido", "en": "An order" },
  "map": {
    "nodes": [
      { "id": "web", "is": "browser", "name": "Shop" },
      { "id": "api", "is": "service", "name": "API" },
      { "id": "db", "is": "database", "name": "Postgres" }
    ],
    "links": [
      { "from": "web", "to": "api", "label": "order" },
      { "from": "api", "to": "db" }
    ],
    "flows": [{ "path": ["web", "api", "db"], "label": "one order" }]
  }
}
```

`isofig build map.json --format page` and `isofig check map.json` draw it as is, and so does Astro's `<Figure>`.

**The compiler is a separate module, `isofig/map`.** `renderFigure` does not carry it (it is about 20 KB gzip that
nobody should pay without a map). The CLI and `<Figure>` pass it for you; if you call `renderFigure(spec, { resolveMap })`
yourself, `import { resolveMap } from "isofig/map"`. Without it a `map` is the `map-compiler-missing` error. The same
goes for `assemble(spec, { resolveMap })`. For `<Figure orbit>` there is nothing to do: it gets the already assembled
spec (if you call `enableOrbit` yourself, pass it that, not the `map`).

## The shape of `map`

| Field | What for |
|---|---|
| `nodes` | The nodes: an object from the catalog, or a container with `children` (required) |
| `links` | The ribbons between nodes |
| `flows` | The packets that travel along those ribbons |
| `layout` | `flow` (default), `layers` or `grid` |
| `legend` | `false` removes the legend; by default it shows when there is more than one colour, a flow or a UML link |
| `labelSize` | Fixes the label size (world units) instead of letting it fit itself |

The rest (`id`, `title`, `hint`, `caption`, `alt`, `width`, `height`, `camera`) is as in any figure. A map sets for you
the size (1150 wide), the camera of its layout, a readout («14 objects · 21 links · 2 flows») and a description for
screen readers: what you write in the spec wins. Write the `caption`.

### Nodes

| Field | What for |
|---|---|
| `id` | Unique in the whole map, containers included |
| `is` | An object from the catalog; in a container, its tag (`region`, `vpc`, `subnet`, `cluster`, `package`…) |
| `name` | The engraved label (a `Text`); defaults to the `id` |
| `children` | Makes it a container |
| `paint` | A colour role instead of the object's own |
| `layout` | How a container lays out its children |
| `cell` | In `grid`: `[column, row]` |
| `rank` | In `flow` and `layers`: forces the column or level |
| `fields`, `methods`, `abstract`, `stereotype`, `explode` | UML classes and interfaces |

Node `id`s are free except `_links`, `_flows` and `_legend` (the compiler uses them).

### The 17 objects (`is`)

Pick by **what the thing is**, not by what it does. Each stands on a plinth with a neutral plate where its name is
engraved. The role is the colour the object brings (`color-and-text.md`).

| `is` | It is | Role |
|---|---|---|
| `user`, `phone`, `laptop`, `browser` | two chess people; a phone on its stand; an open laptop; a browser window | `client` |
| `cdn`, `balancer`, `gateway` | a globe on its foot; a sorting carousel; a gate with a barrier | `edge` |
| `service`, `server`, `function` | a box with a gear on top; a three-unit rack; a chip with a λ | `compute` |
| `database`, `cache` | a stack of disks; two memory modules in their socket | `data` |
| `queue` | a conveyor belt with parcels | `messaging` |
| `storage` | a bucket with files sticking out | `storage` |
| `external` | a cloud | `external` |
| `class`, `interface` | a filing cabinet with name, attribute and method drawers; the same with a plug on top | `compute`, `edge` |

An `is` that is not in the catalog is `map-glyph-unknown` (except in a container). To recolour one, give it a `paint`
(object storage as `data`, say) instead of changing the object.

### Containers

A node with `children` is a **low tray** with its plate (class in capitals plus the name: «VPC tienda-vpc»). Its size comes
from what it holds, and every nesting level raises one tone step, so you see what holds what. `package` adds the UML
folder tab. A container may use its own `layout`.

```json
{ "id": "vpc", "is": "vpc", "name": "shop-vpc", "children": [
  { "id": "apps", "is": "subnet", "name": "apps", "children": [
    { "id": "app-1", "is": "server", "name": "App 1" },
    { "id": "app-2", "is": "server", "name": "App 2" }
  ] }
] }
```

### Layouts

- **`flow`**: left to right by rank (the longest path along the links; a cycle is cut where it closes); the nodes of one
  rank stack toward the reader. For a request path, a pipeline, a network.
- **`layers`**: top to bottom. Inheritance puts the parent on top; composition and aggregation, the whole. The UML one.
- **`grid`**: explicit cells, `cell: [column, row]`; two nodes in one cell warn (`map-cell-collision`).

Tall objects hide what is behind them, so nodes are spaced as far apart as needed. The default camera looks from the
front and a little from the left; change it with `camera` as in any figure.

### Links

`{ "from": "a", "to": "b" }`; `from` and `to` take an id or a list (`"to": ["app-1", "app-2"]` makes two ribbons; the
label and multiplicities go on the first). Ribbons are orthogonal, run over the floor and go around nodes; those that
share an origin or target and are drawn the same merge into a trunk. If one finds no clear path it is drawn straight and
`map-route-blocked` says so.

| Field | What for |
|---|---|
| `label` | A standing sign over the ribbon |
| `kind` | `link` (default) or a UML kind, below |
| `arrow` | `end`, `start`, `both` or `none`; replaces the one from `kind` |
| `dashed` | A dashed ribbon (use it for the unhappy path) |
| `mult` | UML multiplicities, `["1", "*"]` |
| `paint` | Paints the ribbon with a role |

| `kind` | Drawn as | In `layers` |
|---|---|---|
| `link` | arrow toward `to` | `from` first |
| `inherits` | hollow triangle at `to` (the parent) | `to` on top |
| `implements` | the same, dashed ribbon | `to` on top |
| `composes` | filled diamond at `from` (the whole) | `from` on top |
| `aggregates` | hollow diamond at `from` | `from` on top |
| `depends` | arrow, dashed ribbon | `from` first |
| `associates` | plain ribbon (`arrow: "end"` adds a head) | `from` first |

### UML classes and `explode`

```json
{ "id": "Order", "is": "class", "explode": true,
  "fields": ["- date: Date", "- status: Status"],
  "methods": ["+ total(): Money", "+ confirm()"] }
```

`fields` and `methods` are engraved in the attribute and method drawers (no list, no drawer). `abstract: true` engraves
«abstract»; `is: "interface"` (or a `stereotype`) engraves «interface» and adds a plug. With `explode: true` the
**«Take apart»** control opens the drawers (attributes first, then methods) and the «Part» list picks «fields» or
«methods» across every class at once: use it when the members are what the reader must read, since at rest they are tiny.

### Flows

```json
{ "id": "purchase", "path": ["phone", "cdn", "lb", "app-1", "queue"], "label": "purchase", "every": 3, "paint": "messaging" }
```

A flow walks the nodes of `path` in order **along the ribbon of each hop** (if two consecutive nodes have no link, one is
created). Packets are evenly spaced about `every` seconds apart; `speed` is world units per second (80 by default),
`delay` the seconds the first one waits, `paint` its colour (the accent by default; a role already in the map is free).
A packet switches off while it goes through an object. **Give a map one or two flows that tell the story** (the happy
path and the interesting branch, like a rejected payment), not one per link. Flows are compiled to `tracks`.

## `tracks`: a group that travels, with no model

Use them directly on a machine when one thing circulates (a cart on a rail, parcels on a belt) and you do not want a model.

```json
{ "parts": [ …, { "id": "cart", "kind": "box", "at": [26, 14, 10], "size": [8, 14, 6], "tone": "lit", "group": "cart" } ],
  "tracks": [{ "group": "cart", "path": [[26, 14, 10], [26, 196, 10]], "period": 6, "delay": 1, "hide": [[0.45, 0.65]] }] }
```

| Field | Purpose |
|---|---|
| `group` | The `group` of the parts that travel; they are drawn where `path` starts |
| `path` | World points, at least two distinct ones |
| `period` | Seconds to walk the path end to end at constant speed (greater than 0) |
| `delay` | Seconds it waits before leaving the first time |
| `loop` | `false` walks it once and stays at the end; by default it starts over |
| `hide` | Stretches of the route, as fractions of the arc (`[0.45, 0.65]`), where the group is not shown: it goes through an object |

The group fades in and out at the ends; the pause button stops it; with reduced motion it rests halfway along and in
sight. A figure with tracks starts playing. **What travels is painted last, so it shows over what would hide it**: route it
where it does not pass behind tall parts, and use `hide` for the stretch inside an object (a tunnel, a machine). A group
no part has is `track-group-unknown`; a `period` that is not above 0, or a `path` with fewer than two distinct points, is
an error.

## Colour on a map

- **Roles only, never materials.** Every object brings its role; the legend names the ones that appear, the flows with
  their packet and, in UML, the ends. Colour is never alone: every object has its shape and its name on a neutral plate.
- **At most six colours** (greys count as one) and none confusable with colour blindness. A map that uses all seven
  roles warns: group roles with `paint` (object storage as `data`) or leave one grey.
- **Ribbons and heads are not painted** (neutral tones; only the filled diamond takes the accent). Do not paint a ribbon
  unless it carries a meaning the legend can name.
- A brand colour: `palette: { base: "#hex" }` derives the roles around it; `palette.use` sets the legend order.

## Import

```sh
docker compose config --format json | npx --no-install isofig import compose - -o stack.json
npx --no-install isofig import mermaid diagram.mmd -o map.json          # or "-" to read standard input
```

- **Mermaid**: a subset of `flowchart` / `graph` and `classDiagram`. The label decides the object (Postgres → database,
  Redis → cache, Kafka → queue, S3 → bucket); without a hint the shape does; otherwise `service`. `subgraph` becomes a
  container; `RL` and `BT` are drawn as `LR` and `TD`. Whatever it does not understand (styles, `click`, `classDef`,
  sequence diagrams) is listed under `skipped:`. From code, `fromMermaid(text)` and `fromMermaidDetailed(text)` from `isofig/map`.
- **compose**: each service becomes the object its image suggests, `depends_on` becomes ribbons, published ports come in
  from an «Internet» globe and each named volume is a bucket. Replicas go in the label («api ×3»).
- Both give a **plain spec to edit**: rename nodes, change an `is`, group services in a container, add the `flow` that
  tells the story, write the `caption`.

## Density: about 20 nodes, and 390 px

- **A map has more labels than a machine and the labels fit themselves**: the compiler looks for the smallest size that
  reads at about 10 px in the enlarged view. With more than about 20 nodes it cannot get there and warns
  (`map-label-small`): **split the map in two** (the request path in one, the data layer in the other) instead of shrinking.
- **At 390 px a map is not readable and does not try to be**: the labels measure about 3 px. It reads only through the
  «Enlarge» chip, so the enlarged capture is the one that decides. Say so in the `caption` or the hint if the page is
  mostly read on phones, and keep the readout meaningful on its own.
- **Weight.** A map weighs more than a machine because each object is 8–15 parts: the 14-object shop is about 31 KB gzip,
  so the 40 KB budget is close. A bigger map hits `weight-over-budget`: another reason to split.

## Writing a good map

1. List the **real components** and what crosses between them (from the user's sketch, compose file or architecture).
2. Pick each node's `is` by what it is. A queue is a `queue` even if it is called a topic; a Lambda is a `function`.
3. Group what lives together in containers (VPC, subnet, package); do not nest for decoration.
4. Add `links` with `label`s where the meaning is not obvious, `dashed` for the unhappy path, UML `kind`s in `layers`.
5. Add the **one or two flows** the reader should follow, with `label`s and different `paint` roles.
6. Write a `caption` that says what to look at; set `layout` to what the picture is (`flow` for a path, `layers` for UML).

## Verifying a map

Same flow as everything else (`verify.md`): `isofig check map.json --strict` with no warnings, then the six captures
(`capture.mjs`; a map has many parts, so it takes about a minute) and **look at them**. Besides the usual questions:

- In the enlarged shot, does every node name read? Does any label cover another object?
- Do the ribbons arrive by a visible side, without a long detour? (`map-route-blocked` when they cannot.)
- Does the legend list every colour in use, and do the roles stay apart in dark?
- Do the packets travel the ribbon of each hop and switch off inside objects?
- UML: do the ends read (hollow triangle at the parent, filled diamond at the whole), and do the multiplicities sit by the right end?

Codes: `map-node-id-duplicate`, `map-node-unknown` (a link or flow names a node that does not exist), `map-glyph-unknown`,
`map-flow-short` (a flow with fewer than two nodes), `map-cell-collision`, `map-cell-invalid`, `map-paint-unknown`,
`map-compiler-missing`, and from the compiler `map-label-small` and `map-route-blocked`. Everything else the audit says
talks about the tree the map compiles to: its paths point at `root.children[…]`.
