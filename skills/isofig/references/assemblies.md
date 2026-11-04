# Nested assemblies and teardown

Use this when the thing the reader should understand is **what it is made of**: an engine, a lock, a rack, a valve.
The structure is already a tree, so write it as one: nodes in plain JSON, no model, no functions. isofig flattens the
tree to draw it and gives you, for free, the "Take apart" control, the parts list and the readout.
Full reference: `node_modules/isofig/docs/en/nesting.md`. Complete examples: `examples/motor-v8/spec.json` (215 parts,
7 steps, 12 pickable parts, 16.6 KB gzip) and `examples/motor-cohete/spec.json`.

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
| `parts`, `children` | Its own parts and its sub-assemblies |
| `name`, `note` | What it is and one line on what it does: they show in the parts list and the readout |
| `explode` | How far it moves when taken apart, **relative to its parent** (diagonals when they say something) |
| `stage`, `step` | The stage it leaves in, and that step's text |
| `repeat` | `{ count, step, from? }`: copies the whole subtree; `{i}` in texts and ids |
| `use`, `with` | Takes a subtree from `defs` (with `{key}` templates) or a piece from the kit |
| `tone`, `paint`, `mount` | Inherited by the parts and nodes inside that do not set their own |

The top-level `parts`, if present, are the fixed scenery in world coordinates (a bench, a stand). Reference by short id:
`on` and `mount` look in the node first and then upwards; to reach another branch write the path from a common ancestor
(`"bloque.bancada-izq.fundicion"`).

## Writing a good assembly

1. **Name the real sub-assemblies.** The teardown follows your tree: banks, heads, valves. If the tree has no meaning
   (one node per part), the parts list is noise.
2. **Give every node that comes off a `name` and a `note`.** The note says what it does, not what it looks like:
   "closes the cylinders, carries valves and cams".
3. **Choose directions that say something.** A V8's heads leave at 45°, along the line of their cylinders; a lid goes up.
   `explode` is relative to the parent, so a child travels with it.
4. **Let the stages be automatic first:** what is furthest out in its direction of travel leaves first, a child never
   after its parent. Set `stage` only when the story needs another order (then nodes sort by that number, equal numbers
   leave together), and `step` for the text of that step ("heads off").
5. **Fitted parts get `mount`** (the crankshaft in its block), so the audit does not call them a collision.
6. **Paint by material** (`paint: "aluminium"` on the node) and keep one `lit` accent for what the reader should find.
7. **Use `defs` and `repeat`** for what repeats (cylinders, legs); `use` a kit piece for the stand.
8. **Concave shapes are several parts**; a nozzle is several `cone`s. Tilted pieces: `cylinder` with a vector `axis`
   (a rod), `prism` with `axis: "x" | "y"` (a V-block profile).

## What the figure gets

- **"Take apart"**: a stepped control from "Assembled" to "Step 7 of 7". Each node moves by the sum of its own `explode`
  and its ancestors', within its stage's window.
- **The parts list**: one button per name, in tree order; two nodes with the same name (both heads) are one entry.
  Picking a part zooms onto it, paints it in front and leaves the rest at 35 %; the readout shows its `name · note`.
  Assembled, the part shows inside the see-through rest (the pistons in their bank). Give every entry a part worth
  zooming into: a name for a tiny bolt makes a close-up of nothing.
- **The readout** ("Step 3 of 7: heads off"); screen readers hear the step.
- **Paint order per pose.** It is computed at rest and at the end of every stage, and the runtime reorders the DOM when
  it crosses a threshold, so a part is never painted over the one that hid it.

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
