---
name: isofig
description: Explain a technical idea as a small, crafted isometric figure whose working IS the concept (a rate limiter as a token dispenser, a cache as a pin-tumbler lock, a V8, a car or a skeleton as an assembly that comes apart, a request path as a map), written as a declarative isofig spec and rendered to light, animated SVG for Astro or Angular. Covers machines with a model, declarative machines (bind, tracks), nested assemblies with teardown and part zoom (engines, cars, anatomy), and maps (topology, flow, UML). Use it for an explanatory figure, interactive diagram, isometric illustration, exploded view, architecture or topology map, UML diagram, simulator or any "how does X work" visual (in Spanish, figura, despiece, vista explosionada, mapa de topología, «cómo funciona») for docs, courses, blogs and landing pages, or to turn a sketch, screenshot or compose file into a figure, even if nobody says "isometric" or "isofig". Decides first when NOT to draw (pure comparisons) and verifies with check plus screenshots.
license: MIT
compatibility: Node 22.18+. Astro 5+ or Angular 19+. Playwright or Chrome for the screenshots.
---

# isofig

You write a **spec** (data, JSON or TypeScript), never drawing code. The isofig core turns it into light SVG at build
time; a runtime of about 4.2 KB gzip animates it. Answer in the user's language and write the figure's texts in it
(`{ es, en }` when the project is bilingual). If `isofig` is not installed in the project, run `npm i isofig` first.
Its guides are in `node_modules/isofig/docs/en/` (Spanish in `docs/es/`); this skill's detail is in `references/`.

## The idea

**The object is the explanation.** Invent a real, well-made thing whose mechanism maps one-to-one onto the concept,
then build it from many small parts. Never boxes with arrows and labels.

| Concept | Object |
|---|---|
| Token bucket rate limiter | A coin tube refilled by a dispenser; each cart needs a coin to pass a gate |
| Cache hit / miss | A pin-tumbler lock: only a matching key turns the plug |
| Queue and consumers | A conveyor feeding several workstations |
| Load balancer | A sorting carousel dropping parcels into lanes |
| Circuit breaker | A breaker panel with a lever that trips and resets |
| Database index | A card catalogue drawer vs. searching a loose pile |
| A V8, a rocket engine | The engine itself, as a nested assembly that comes apart step by step |
| A car, a human skeleton, a molecule | The thing itself, as a nested assembly of named parts: the reader takes it apart and picks a part to zoom onto it |
| A request crossing services | A map: nodes with a role and a color, the links, the flow and a legend |

Two failures to avoid: **too abstract** (floating slabs, labelled boxes) and **too bare** (one slab with a few lines).
The fix is the same: a recognisable machine with purposeful detail. An assembly gets it from being the real structure;
a map, from its roles, its glyphs and its legend.

## When NOT to use isofig

A figure earns its place only if the reader can **move something and see it change** (time, quantity, capacity),
**take it apart** (structure) or **follow it** (topology, flow). If none is true, say so and propose the right format
instead of drawing a machine anyway:

- **It only compares or ranks options and nothing happens over time.** In the first large use (117 figures in a
  course) the 6 that only compared were static comparators dressed as machines: a table says it faster.
- **What matters is the shape of the data** (which field survives, what a payload looks like): a table, a trace or
  a code block.
- **A decision or a trade-off** (choose A or B): a decision table or a comparator.
- **A history graph (Git), a distribution or percentiles, HTML and CSS:** a chart, or the real thing running live.
- **A concept with no number, motion, capacity or structure:** a paragraph.

Smell test: a spec with no `params`, `bind`, `model`, `explode`, `tracks` or `map` is a still picture of boxes. Ask why
it is not an image or a table.

## Choose the format

Start with the simplest that tells the story: `bind` before a model, an assembly when the structure is the story.

| The user wants to show | Format | Spec fields | Read |
|---|---|---|---|
| A mechanism that evolves with numbers (a queue fills, a breaker trips) | **Machine with a model** | `parts`, `groups`, `params`, `model` (a file with `init`/`step`/`view`) | `references/machines.md`, `references/models.md` |
| A machine that only answers to its controls, or a loop that circulates | **Declarative machine** | `bind` (a parameter moves a group), `tracks` (a group travels a polyline in a loop, with `hide` for the stretch inside an object) | `references/models.md`, `references/maps.md` |
| What a thing is made of, or how it is built (an engine, a car, a skeleton) | **Nested assembly with teardown** | `root`, `defs`, `explode`, `stage`, `rotate` (plain JSON, no model) | `references/assemblies.md` |
| Who talks to whom, how a flow crosses a system, classes | **Map** | `map`: `nodes` (17 objects, containers), `links` (UML kinds), `flows`, `layout`; compiled to a `root` and `tracks` | `references/maps.md` |

The formats mix: an assembly can carry a model (a wheel the model spins) and a machine can sit on a `bind`. A figure
that needs no model is a plain JSON file; a model is the only part written in code.

## Workflow

1. **Truth first.** Collect the real numbers and behaviour (rates, capacities, thresholds, parts). The readout and
   the motion must be true. Run the "when NOT" test and pick the format.
2. **Invent the object.** One sentence: what moves (or comes apart, or flows) and what that means.
3. **Parts list before geometry.** 30–80 parts for a machine (an assembly may have many more: the V8 example has
   215 in 16.6 KB gzip, the skeleton about 490 in 34 KB): base, structure, mechanism, controls, subject. Each part
   rests on another. Take the common ones from the kit. For an assembly, also list the 8–14 named sub-assemblies the
   reader will zoom onto (`references/assemblies.md`).
4. **Plan the world.** ~1 unit = 1 px; `x`, `y` on the floor, `z` up; larger `x`/`y` is nearer the reader. Moving
   parts travel where they do not pass behind other parts.
5. **Write the spec.** Use `repeat` for rows and a pool of hidden parts for what comes and goes.
6. **Write the model** only if something happens over time.
7. **Verify** (mandatory, see below), read the screenshots, iterate.

Craft rules for machines (tones, detail, volume, composition, motion, paint-order lessons): `references/machines.md`.

## Beyond software

isofig explains anything made of parts that fit together, not only software: a workshop assembly, a car, a skeleton
or a joint, a molecule (`sphere` for atoms, `capsule` for bonds), a cell, a lock. If the user asks for one of these, use
a nested assembly. Picking a part in the list moves the camera to it, so write each name and note for that moment: 8–14
entries, each a sub-assembly worth a close-up and a note with a real fact, not a bolt. The rules for cars, anatomy and
chemistry (no brand logos, notes that can be verified, a teaching schematic and not an atlas) are in
`references/assemblies.md`; the two reference figures are `examples/muscle-car/` and `examples/sistema-oseo/`.

## Starting from what the user already has

- **A sketch, a whiteboard photo or a screenshot of a diagram.** Read the image yourself: list the components, what
  flows between them and what decides the flow; ask one question only if the mechanism is ambiguous. Then invent the
  object from that list. Never trace the picture: its boxes and arrows are the *concept*, not the object.
- **A docker compose file.** `docker compose config --format json | npx isofig import compose - -o spec.json` gives a
  first map (each service the object its image suggests, ribbons for `depends_on`, published ports entering from an
  Internet globe, volumes as buckets). Edit the JSON: change an object with `is`, group services in a container, add
  a `flow`.
- **A topology, an order flow or a UML diagram** (or a Mermaid `flowchart` / `classDiagram`). Write a `map` instead of
  parts: nodes with `is` (a real object from the catalog: `phone`, `server`, `database`, `queue`, `class`…),
  containers with `children`, `links`, and `flows` for the packets. `npx isofig import mermaid diagram.mmd -o map.json`
  gives a first one. Every node is still an object, never a labelled box; keep a map to about 6 colours and under 20
  nodes. Guide: `node_modules/isofig/docs/en/maps.md`.
- **A real system (Kubernetes, a queue, an API).** Collect the true numbers first, then follow the workflow.

## The kit

`isofig/kit` returns the `Part[]` that every figure repeats: `bench` (base on feet with screws), `plinth` (base
without feet, for tall or long pieces), `labelPlate`, `ruler`, `screws`, `pool` (N hidden pieces, one group each)
and `groupsOf` (the matching `groups`). Write the line instead of copying the block.

```ts
import { bench, labelPlate, pool, ruler } from "isofig/kit";
parts: [...bench({ size: [120, 220] }), ...labelPlate({ at: [10, 8], text: { es: "PEDIDOS", en: "ORDERS" } }), ...pool({ id: "order", count: 5, piece })]
```

From JSON there are no functions: a node names the piece, `{ "id": "frame", "use": "bench", "with": { "size": [120, 220] } }`
(needs `root`; a `pool` with `extent` also brings its `groups`). Two rows of one family: `pool({ group, from })`.
Options, ids and the catalog: `node_modules/isofig/docs/en/kit.md`.

## Color with criterion

- **Grey by default.** Tones: base and feet `lo`, structure `mid`, subject `hi`, and `lit` as the **only accent**
  (the thing to watch). `lit` wins over any `paint`.
- **`paint` names a material for machines** (`aluminium`, `steel`, `iron`, `copper`, `brass`, `rubber`, `carbon`,
  `glass`, `lacquer`) **or a role for maps** (`client`, `edge`, `compute`, `data`, `messaging`, `storage`,
  `external`). Never both sets in one figure. Children of a node inherit its `paint`.
- **Paint parts, not the stage:** base, rails and stands stay `lo`/`mid`.
- **Six colors at most**, counting the accent (the greys count as one): `palette-too-many-colors`.
- **States are not paint.** `s: "ok" | "warn" | "fail"` comes from the model and wins; never `paint` with them.
- **Color never carries meaning alone.** Name the parts, let a map draw its legend (`legendOf` for the rest), and remember that the
  green accent looks light grey under color blindness: in a machine the subject also stands out because it moves.
- **Only theme variables, no literal colors.** A brand color goes in `palette: { base, use }`; measure it with
  `npx isofig palette --base "#hex" --report`. Set tables and details: `references/color-and-text.md`.

## Text

Words in the drawing are allowed **with rules**, and the rules are measured:

- **Legible:** every label must read at **9 px or more in the enlarged view** (`label-unreadable` warns and gives the
  `size` that would reach 9). On a phone everything is small (`label-small-mobile` is only a note): that is what the
  "Enlarge" chip is for.
- **Plates before loose text:** name a part on a `labelPlate` (kit) or engrave a short `label` on a face; a word or
  two, never a sentence. Names are for parts the reader must tell apart (services, nodes, stages).
- **No arrows, balloons or leader lines** on a machine: the object shows the flow. (A map draws its own links.)
- **A map reads only through "Enlarge"**: at 390 px its labels are about 3 px. More than about 20 nodes: split it
  (`map-label-small`).
- **Title, hint and readout live in the card corners; the explanation in `caption`.** The **readout is at most 70
  characters** and carries the model's true numbers: `5/8 tokens · 12 passed · 3 rejected` (`readout-long`).
- `unit` short for the eye ("req/s"), `spoken` long for screen readers; `alt` when the caption is not a description.

## Models

Details and a full example: `references/models.md`.

- **`ctx.say(text)`** announces an event once; never keep a "last said" in the state to deduplicate by hand.
- **`ctx.pressed(id)` / `ctx.changed(id)`** are true during the next step; never copy a parameter to detect a change.
- **`motion.settle: N`**: with reduced motion the runtime simulates N seconds at once, on mount and after every
  control; never compute the final state by hand. Everything must still make sense paused.
- **Presets** ("Try to break it"): `values`, `note`, `reset`, and `press: [action ids]` for presets that press a
  button. A preset **must change what the reader sees** (`preset-same-view`); its note says what to watch, never
  "now press X".
- **`repeat.from`** (or `pool({ group, from })`) lets two rows share one group family: `row-0…13` and `row-14…27`.
- A slider's start value sits on its `step` and inside its range.

## Verify (mandatory)

A figure is not done until both pass.

1. `npx isofig check <spec> --model <model> --presets --strict` ends with **no warnings** (notes are fine). Every
   warning marked ↑ in `docs/en/validate.md` becomes an error in 1.0: treat all as errors. With no model, drop
   `--model` and `--presets` (`--presets` needs a model).
2. Screenshots at **390 and 1280 px, light and dark, and with the "Enlarge" chip open**, and then **look at every
   one**:

```sh
npx isofig build figure.ts --format page --model model.ts --advance 4 -o preview.html
node ${CLAUDE_SKILL_DIR}/scripts/capture.mjs preview.html --out shots   # needs Playwright in the project
```

Ask of each PNG: is it instantly a real object? Still rich at 1280 and still reading at 390? Does every line end on
something? Is every label legible in the enlarged shot? Does dark look right? Does the readout fit its lines? Does
each preset show its change (`--set id=value`)? For an assembly: assembled, halfway and taken apart
(`--set explode=N --set pick=N`). For a map: the enlarged shot decides (390 px is unreadable by design), and the six
captures take about a minute. A green check does not fix what the eye does not believe. Findings, fixes and the
capture details: `references/verify.md`.

## Delivering

- **Astro:** `<Figure spec={spec} lang="en" />` from `isofig/astro`; register the model in a `<script>` of the same
  component with `models({ name: () => import("./name.model.ts") })` from `isofig/astro/client`.
- **Angular 19+:** `npx isofig add angular src/app/isofig`, generate with `--format module`, use
  `<isofig-figure [figure] [model]>`.
- **Maps:** the compiler is its own module, `isofig/map`. The CLI and `<Figure>` add it themselves; if you call
  `renderFigure(spec, { resolveMap })` or `assemble(spec, { resolveMap })` by hand, import `resolveMap` from `isofig/map`
  (without it, `map-compiler-missing`).
- **Theme:** override `--isofig-*` variables with one `.isofig { … }` rule. Optional luxury look: add
  `isofig/themes/luxe.css` after the theme and the class `isofig-luxe`.

Props, loading, `overrides`, several copies of a figure, view transitions: `references/delivery.md`.

## References

| File | Read it when |
|---|---|
| `references/machines.md` | Designing a machine: parts, world, detail, paint order |
| `references/models.md` | Writing a model, presets, `bind`, controls |
| `references/assemblies.md` | The figure has an inner structure or must come apart |
| `references/maps.md` | The figure is a topology, a flow or UML, or something circulates (`tracks`) |
| `references/color-and-text.md` | Choosing paints, labels and readouts |
| `references/verify.md` | Reading `check` output and the screenshots |
| `references/delivery.md` | Astro, Angular, theme, overrides |

Reference figures in the package: `examples/token-bucket/` (machine and model), `examples/motor-v8/spec.json` and
`examples/motor-cohete/spec.json` (assemblies), `examples/muscle-car/spec.json` and `examples/sistema-oseo/spec.json`
(assemblies outside software: a car, with materials, and the human skeleton, with `sphere`, `capsule` and an anatomical
note per part), `examples/mapa-tienda/`, `mapa-pedido/` and `mapa-uml/` (maps). Open one before you start.
