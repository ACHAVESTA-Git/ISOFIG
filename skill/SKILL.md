---
name: isofig
description: Explain a technical idea as a small, crafted isometric machine whose working IS the concept (a rate limiter as a token dispenser, a cache as a pin-tumbler lock, a queue as a conveyor), written as a declarative isofig spec and rendered to light, animated SVG for Astro or Angular. Use it whenever someone wants an explanatory figure, an interactive diagram, an isometric illustration or a "how does X work" visual for docs, a course, a blog or a landing page, even if they never say "isometric" or "isofig".
license: MIT
compatibility: Node 22.18+. Astro 5+ or Angular 19+. Chrome or Chromium for the visual checks.
---

# isofig

You write a **spec** (data), not drawing code. The isofig core turns it into SVG at build time; a ~1.7 KB runtime
animates it. Answer and write the figure's texts in the user's language (give `{ es, en }` when the project is
bilingual).

## The one idea

**The object is the explanation.** Invent a real, well-made physical thing whose mechanism maps one-to-one onto
the concept, then build it from many small parts. Never boxes with arrows and labels.

| Concept | Object |
|---|---|
| Token bucket rate limiter | A coin tube refilled by a dispenser; each cart needs a coin to pass a gate |
| Cache hit / miss | A pin-tumbler lock: only a matching key turns the plug |
| Queue and consumers | A conveyor feeding several workstations |
| Load balancer | A sorting carousel dropping parcels into lanes |
| Circuit breaker | A breaker panel with a lever that trips and resets |
| Database index | A card catalogue drawer vs. searching a loose pile |

Two failures to avoid: **too abstract** (floating slabs, labelled boxes) and **too bare** (one slab with a few
lines). The fix is the same: a recognisable machine with purposeful detail.

## Workflow

1. **Truth first.** Collect the real numbers and behaviour (rates, capacities, thresholds). The readout and the
   motion must be true. Put the behaviour in a small pure model (`init`, `step`, `view`).
2. **Invent the object.** Say in one sentence what moves and what that motion means.
3. **Parts list before geometry.** 30–80 parts, grouped: base (plate, feet, screws, label plate, ruler strip),
   structure (posts, rails, frames, stops), mechanism (carriage, gate, springs), controls, and the subject. Each
   part rests on another part.
4. **Plan the world.** ~1 unit = 1 px of the real thing; `x`, `y` on the floor, `z` up; larger `x`/`y` is nearer
   the reader. Keep moving parts on paths that don't pass behind other parts (paint order is solved at rest).
5. **Write the spec** (`node_modules/isofig/docs/en/spec.md`). Use `repeat` for rows of identical parts and a pool of hidden parts
   (`hidden: true`, one group each) for things that come and go.
6. **Write the model** if anything happens over time; otherwise use `bind`.
7. **Check and look.** Run the commands below, read the PNGs, iterate.

## Starting from what the user already has

- **A sketch, a whiteboard photo or a screenshot of a diagram.** Read the image yourself. List the components,
  what flows between them and what decides the flow; ask one question only if the mechanism is ambiguous. Then
  go to step 2 of the workflow: invent the machine from that list. Never trace the picture: the boxes and arrows
  of the sketch are the *concept*, not the object.
- **A docker compose file.** Run `docker compose config --format json | npx isofig import compose - -o spec.json`
  for a first figure (one rack per service, replicas as units, published ports, volumes, networks). Use it as
  the starting parts list and enrich it: the machine still has to tell the story the user cares about.
- **A real system to explain (Kubernetes, a queue, an API).** Collect the true numbers first (replicas, limits,
  rates), then follow the workflow.

## Craft rules

- **Tones:** base and feet `lo`, structure `mid`, subject `hi`, and exactly one kind of accent `lit` (the thing to
  watch). Colour only through the theme variables.
- **Detail with a purpose:** bevels of 0.4–1.6, screws as `dots` at plate corners, ruler `ticks` every 4–5 units
  with a major every 5th, a label plate with three `line` rules, knobs on post tops, seams on tall boxes.
- **No words in the drawing.** Title, hint and readout live in the card corners; the explanation in `caption`.
  No arrows, balloons or leader lines.
- **Lines end on something:** a face edge, another line or a dot.
- **Volume:** real thickness, `shadow: true` under the base, parts standing on parts.
- **Composition:** the machine fills ~55–65 % of the card and still reads at 390 px wide.
- **Motion is calm:** let the runtime ease (`motion.tau` 0.12–0.3); use `snap: true` only where the model already
  moves continuously. Everything must make sense paused (reduced motion starts paused).
- **Budget:** a figure stays under 40 KB gzip. Prefer more small parts over many curved segments.

## Commands

```sh
npx isofig check figure.ts --lang es --strict          # weight + audit, fails on any warning
npx isofig build figure.ts --format page --model model.ts -o preview.html --theme light
npx isofig build figure.ts --format page --model model.ts -o preview-dark.html --theme dark
```

Open both previews in headless Chrome (Playwright), take screenshots at 820 px and 390 px wide, and **read every
PNG**. Ask: is it instantly a real object? Rich at 1× and still rewarding when zoomed? Does every line end on
something? Does the animation tell the story? Fix and repeat until yes.

The audit warns about parts that float, parts sunk into each other, ambiguous paint order and weight. Fix the
geometry; use `mount`/`float` only when the contact is intended.

## Delivering

- **Astro:** `<Figure spec={spec} lang="es" />` from `isofig/astro`, plus `register(name, model)` in a page
  script. Guide: `node_modules/isofig/docs/en/astro.md` (Spanish in `docs/es/`).
- **Angular 19+:** `npx isofig add angular src/app/isofig`, generate `--format module`, use
  `<isofig-figure [figure] [model]>`. Guide: `node_modules/isofig/docs/en/angular.md` (Spanish in `docs/es/`).

The complete reference figure ships in `node_modules/isofig/examples/token-bucket/` (spec + model): open it before you start. If isofig is not installed yet, run `npm i isofig` first.
