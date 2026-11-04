# Nested assemblies and teardown

Use this when the thing the reader should understand is **what it is made of**: an engine, a lock, a rack, a valve, and
also things outside software, a car or a human skeleton (see "Beyond software" below).
The structure is already a tree, so write it as one: nodes in plain JSON, no model, no functions. isofig flattens the
tree to draw it and gives you, for free, the "Take apart" control, the parts list and the readout.
Full reference: `node_modules/isofig/docs/en/nesting.md`. Complete examples: `examples/motor-v8/spec.json` (215 parts,
7 steps, 12 pickable parts, 16.6 KB gzip), `examples/motor-cohete/spec.json`, `examples/muscle-car/spec.json` (a
Camaro-style car, 13 pickable parts, 9 steps) and `examples/sistema-oseo/spec.json` (the human skeleton, 12 pickable
parts, 7 steps, an anatomical note on each). Open the one closest to your subject before writing.

## The tree

```json
{
  "id": "box",
  "title": { "es": "Caja con tapa", "en": "Lidded box" },
  "root": {
    "id": "box",
    "parts": [{ "id": "base", "kind": "box", "at": [0, 0, 0], "size": [60, 60, 20], "radius": 4, "shadow": true }],
    "children": [{
      "id": "lid", "name": { "es": "Tapa", "en": "Lid" }, "note": { "es": "cierra la caja", "en": "closes the box" },
      "at": [0, 0, 20], "explode": [0, 0, 30],
      "parts": [{ "id": "slab", "kind": "box", "at": [0, 0, 0], "size": [60, 60, 6], "radius": 4 }]
    }]
  }
}
```

| Node field | Purpose |
|---|---|
| `id` | Required and unique among siblings; it names the node's parts (`lid.slab`) and its group |
| `at` | The node's origin relative to its parent: the coordinates of its `parts` and children are **local** |
| `rotate` | `[x, y, z]` in **degrees**, around the node's own `at`: tilts or swings it with its parts and children (see "Tilting and hinging") |
| `parts`, `children` | Its own parts and its sub-assemblies |
| `name`, `note` | What it is and one line on what it does: they show in the parts list and the readout |
| `explode` | How far it moves when taken apart, **in its parent's space** like `at` (diagonals when they say something) |
| `stage`, `step` | The stage it leaves in, and that step's text |
| `repeat` | `{ count, step, from? }`: copies the whole subtree; `{i}` in texts and ids |
| `use`, `with` | Takes a subtree from `defs` (with `{key}` templates) or a piece from the kit |
| `tone`, `paint`, `mount` | Inherited by the parts and nodes inside that do not set their own |

The top-level `parts`, if present, are the fixed scenery in world coordinates (a bench, a stand). Reference by short id:
`on` and `mount` look in the node first and then upwards; to reach another branch write the path from a common ancestor
(`"bloque.bancada-izq.fundicion"`).

## Tilting and hinging with `rotate`

`"rotate": [0, 20, 0]` turns a node around its own `at`, like the Unity `Transform`: a tilted arm, a door ajar, a wheel
with camber, a rib, a rod at 30°. Rules that matter when you write one:

- **`z` is vertical** (Unity's is `y`): `z` swings something on the floor, `y` and `x` tilt what stands up. Angles are
  **degrees**, positive counterclockwise seen from the tip of the axis (`z`: `x` toward `y`; `y`: up toward `+x`; `x`:
  up toward `−y`). `rotate-radians` warns on `[0, 1.5708, 0]`.
- **Order:** `x`, then `y`, then `z`, always around the parent's fixed axes (`R = Rz·Ry·Rx`). With two or more non-zero
  angles, prefer **one nested node per turn**: the child turns around its already-turned parent and reads "from what is
  there", so a shoulder at `[0, 35, 0]` with an elbow child at `[0, -70, 0]` leaves the forearm at −35°.
- **Put the `at` on the hinge** (door edge, shoulder, ankle) and write the parts from there, so the turn does not
  detach the piece. A node turns around its `at`, never around its center.
- Everything inside is **local to the turned node**: `parts`, children's `at` and `explode`, and the axes of
  `cylinder`, `cone`, `capsule` and `prism`. A child's `explode` is in the parent's turned space, so the forearm of a
  tilted arm leaves along the arm.
- Boxes and prisms are drawn truly turned; labels follow their face (check them in the capture: a label on a face turned
  away from the camera warns with `label-faces-away`). Mirrored tilts are different drawings, so they weigh a little more
  than copies of one shape. No `rotate` means a byte-identical figure.
- Example: `examples/sistema-oseo/spec.json` hangs each arm from its shoulder at 7° and toes the feet out 10° from the
  ankle. Not animated, and `groups.*.extent`, `spin.center` and `tracks.path` stay in world coordinates.

## Writing a good assembly

1. **Name the real sub-assemblies.** The teardown follows your tree: banks, heads, valves. If the tree has no meaning
   (one node per part), the parts list is noise.
2. **Give every node that comes off a `name` and a `note`.** The note says what it does, not what it looks like:
   "closes the cylinders, carries valves and cams".
3. **Choose directions that say something.** A V8's heads leave at 45°, along the line of their cylinders; a lid goes up.
   `explode` is relative to the parent (and to its turn, if it has a `rotate`), so a child travels with it.
4. **Let the stages be automatic first:** what is furthest out in its direction of travel leaves first, a child never
   after its parent. Set `stage` only when the story needs another order (then nodes sort by that number, equal numbers
   leave together), and `step` for the text of that step ("heads off").
5. **Fitted parts get `mount`** (the crankshaft in its block), so the audit does not call them a collision.
6. **Paint by material** (`paint: "aluminium"` on the node) and keep one `lit` accent for what the reader should find.
7. **Use `defs` and `repeat`** for what repeats (cylinders, legs); `use` a kit piece for the stand.
8. **Concave shapes are several parts**; a nozzle is several `cone`s. Tilted pieces: `cylinder` with a vector `axis`
   (a rod), `prism` with `axis: "x" | "y"` (a V-block profile). Round ones: `sphere` for a joint or a skull, `capsule`
   for a long bone or a rounded rod (give both `mount` where one is fitted in the other).

## What the figure gets

- **"Take apart"**: a stepped control from "Assembled" to "Step 7 of 7". Each node moves by the sum of its own `explode`
  and its ancestors', within its stage's window.
- **The parts list**: one button per name, in tree order; two nodes with the same name (both heads) are one entry.
  Picking a part zooms onto it, paints it in front and leaves the rest at 35 %; the readout shows its `name · note`.
  Assembled, the part shows inside the see-through rest (the pistons in their bank). Give every entry a part worth
  zooming into (next section).
- **The readout** ("Step 3 of 7: heads off"); screen readers hear the step.
- **Paint order per pose.** It is computed at rest and at the end of every stage, and the runtime reorders the DOM when
  it crosses a threshold, so a part is never painted over the one that hid it.

## Every entry of "Part" must be worth zooming into

Picking a part moves the camera to it (the part fills about two thirds of the card and the camera never goes closer
than 3×), paints it in front and leaves the rest at 35 %. So the parts list is a list of **destinations**:

- **8 to 14 entries**, each a real sub-assembly with its own look (a head, a differential, a pelvis), not a fastener.
  Fold nuts, bolts and small bits into the part they belong to: a part under about a fifth of the figure never fills
  the card, and the zoom lands on a smudge.
- **Give each entry something to see up close:** its own shape detail (`dots` for bolts or pores, `line` and `ticks`
  for fins or scales, a short `label`), and its own material (`paint`), so the close-up is not a grey slab.
- **Give each entry a `note` with a real, concrete fact** (numbers, what it connects to, why it is shaped so). The
  readout shows `name · note` the moment the camera arrives; "the part that holds the other part" is filler.
- **Write the names and notes in both languages** (`{ es, en }`): the list and the readout come from them.
- Mirrored or repeated nodes (left and right door, four wheels) that share a `name` are one entry: the camera frames
  them together.

## Beyond software: cars, anatomy, chemistry

isofig is not only for software. The same tree, `explode` and `note` explain a workshop assembly, a body or a molecule,
and a different audience (a client, a student) can then take it apart and zoom in.

- **A vehicle or a machine** (`examples/muscle-car/spec.json`): a schematic of your own, never a manufacturer's logo or
  trademarked badge; paint by material (`lacquer` for the body, `glass`, `rubber`, `steel`, `aluminium`, `carbon`).
  Tell the story outside-in: body panels and glass, the interior, then the drivetrain, then wheels and brakes,
  leaving the chassis. Nothing may clip through another part on the way out.
- **Anatomy** (`examples/sistema-oseo/spec.json`): `capsule` for long bones and ribs, `sphere` for joints and the
  skull, `glass` for the cartilage between them, a plinth under the feet to give it scale. Group by region (skull,
  rib cage, pelvis, thigh), name in the language of the textbook, and make each note a verifiable fact (counts, what
  articulates with what). Say it is a teaching schematic, not a medical atlas, and check every number against a
  reliable source before writing it.
- **Chemistry:** `sphere` for atoms and `capsule` (with `axis` as a vector) for bonds; a molecule as a tree
  (functional groups as nodes) comes apart by group. No molecule ships as a reference figure yet: apply the same rules
  and look at the captures with extra care.

## Combining with a model, and limits

- An inner part that a model already animates keeps its own `group` (a wheel the model spins) and the teardown carries
  it from outside. The teardown's binds add to what the model moves; if the model gives a readout, it is the model's.
- `overrides` (Astro) validate against the spec's own parameters: they cannot yet set the `explode` and `pick` that the
  teardown generates. Use `--set explode=N --set pick=N` in the preview.
- Each node leaves in a straight line (no curved teardown), and pieces that cross each other mid-motion are ordered right
  at each pose, not between poses.

## Checking it

```sh
npx isofig check engine.json --strict                      # tree shape, use, references, audit
npx isofig build engine.json --format page -o engine.html --set explode=0
npx isofig build engine.json --format page -o half.html   --set explode=4
npx isofig build engine.json --format page -o apart.html  --set explode=7   # the last step of this one
```

Capture assembled, halfway and taken apart, and a few picked parts (`--set pick=3`), in light and dark. Look for a part
drawn over the one that should hide it, a label cut by the frame, a step whose text does not match what moved, and a
figure that no longer fits the card when it is fully taken apart.
`validateSpec` reports tree errors with JSON paths: duplicate sibling ids, an unknown or cyclic `use`, an invalid
`explode` or `stage`, an unresolved `on` or `mount` (`root.children[2].parts[0].mount[0]`).
