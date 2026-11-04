# Designing a machine

For figures built from `parts` (a machine with a model, or a declarative one). An assembly written as a tree follows the
same craft; read `assemblies.md` too.

## From idea to parts

1. **One sentence:** what moves and what that motion means. If you cannot say it, you do not have the object yet.
2. **The parts list, grouped:**
   - base: plate, feet, screws, label plate, ruler strip (all in the kit);
   - structure: posts, rails, frames, stops;
   - mechanism: carriage, gate, springs, levers;
   - controls: knobs, switches, lamps;
   - the subject: coins, parcels, crates, whatever the reader is learning about.
   Each part rests on another part or on the floor.
3. **The world.** About 1 unit = 1 px of the real thing. `x` and `y` on the floor, `z` up. With the default camera
   (azimuth 45°) `x` grows to the bottom left of the screen and `y` to the bottom right; whatever has a larger `x` or `y`
   is nearer the reader. `camera: { azimuth, elevation }`: 35–60° shows the long side; the default elevation is 30°.
4. **Paths.** The paint order is computed with the parts at rest. Keep every moving part on a path where it never
   passes behind another part; the rest position must be valid for the whole path, and what crosses over something
   goes higher than everything it crosses.

## Craft rules

- **Tones:** base and feet `lo`, structure `mid`, subject `hi`, and `lit` for the one accent. Materials and roles come
  through `paint` (`color-and-text.md`).
- **Detail with a purpose:** bevels of 0.4–1.6, screws as `dots` at plate corners, ruler `ticks` every 4–5 units with a
  major every 5th, a label plate with three `line` rules, knobs on post tops, seams on tall boxes. The kit gives you
  most of it.
- **Lines end on something:** a face edge, another line or a dot. A line that stops in the air looks like a mistake.
- **Volume:** real thickness, `shadow: true` under the base, parts standing on parts.
- **Composition:** the machine fills about 55–65 % of the card and still reads at 390 px wide.
- **Motion is calm:** let the runtime ease (`motion.tau` 0.12–0.3); use `snap: true` only where the model already
  moves continuously. Everything must make sense paused: reduced motion starts paused (see `models.md`, `settle`).
- **Budget:** under 40 KB gzip (`isofig check` measures it). Prefer more small parts over many curved segments.
- **Concave shapes** are not one part: a prism takes a convex plan, so build an L or a U from several.
- **Round parts and solids of revolution:** `cylinder` (also leaning, with a vector `axis`), `cone` (truncated, for a
  nozzle or a funnel), `prism` with `axis: "x" | "y"` for a profile extruded sideways.

## Things that come and go

A pool of hidden parts, one group each, which the model switches on and off: `hidden: true`, `group: "coin-{i}"` and a
`repeat`. The kit does it in a line: `pool({ id: "coin", count: 8, piece })` plus `groupsOf("coin", 8, { extent })`
so the camera fits every pose. `groups` also needs an `extent` for what travels far (a carriage) and a `spin` for flat
parts that rotate (needles, gates).

A model can tint a group with `s: "ok" | "warn" | "fail"` while it runs. That is the only color source besides `paint`.

## Controls

A parameter is a native control, so keyboard and screen readers work: a slider (`min`, `max`, `step`, `value`, `unit`,
`spoken`), a `toggle` (0 or 1), a `choice` (the index of an `options` entry) or an `action` (a button that adds 1).
Details and the rules for start values: `models.md`.

## Paint order: what goes wrong

`isofig check` warns "ambiguous paint order near A ↔ B". These shapes cause it, sometimes silently:

| Shape | Fix |
|---|---|
| Feet under the base | A `plinth` (the whole footprint) instead of `bench`; feet confuse the order on tall or long pieces |
| A long piece with other pieces on it and dividers between them | Split the long piece, one per cell |
| A piece glued to the face of a standing panel | Separate them with a piece that sticks out (a hook, a box) |
| Labels | `align: "middle"` centres the text on `at`; `face: "y"` reads worse with the default camera |
| A moving part that crosses another | Move it on a path that never passes behind, or raise it above everything it crosses |

Two more warnings to read carefully: `part-floats` (a part touches nothing: fix the geometry, and use `float` only for
what hangs or flies on purpose) and `parts-overlap` (two parts sink more than 0.8 units into each other: use `mount` only
when the fit is intended). The audit works on boxes, so it is fast and coarse: always look at the figure large.

## Previewing

```sh
npx isofig build figure.ts --format page --model model.ts --advance 4 -o preview.html   # opens 4 s into the simulation
npx isofig build figure.ts --format page --set rate=8 -o rate8.html                     # starts a control elsewhere
npx isofig build figure.ts --format page --orbit -o orbit.html                          # try the turn
```

A headless capture does not reliably run the animation, so `--advance` is how you see a figure in motion. `--set` starts any
control at another value, including the `explode` and `pick` that an assembly generates.
