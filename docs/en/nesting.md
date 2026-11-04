# Nested spec and teardown

A machine already has a structure: the engine has banks, the banks have cylinder heads, the heads have valves. If the
spec says so, as a tree of nodes in JSON, isofig flattens it to draw it and also knows how to **take it apart piece by
piece**, with no model and no functions: the "Take apart" control, the parts list and the readout come for free.

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
      "parts": [{ "id": "slab", "kind": "box", "at": [0, 0, 0], "size": [60, 60, 6], "radius": 4 }],
      "children": [{
        "id": "knob", "name": { "es": "Perilla", "en": "Knob" }, "at": [30, 30, 6], "explode": [0, 0, 20],
        "parts": [{ "id": "k", "kind": "cylinder", "at": [0, 0, 0], "r": 6, "h": 8, "mount": ["slab"] }]
      }]
    }]
  }
}
```

`isofig build box.json` works as is: `renderFigure`, `validateSpec` and the CLI accept `root` (`drawScene` and the orbit take it already flattened with `assemble`). Complete
examples: [`examples/motor-v8/spec.json`](../../examples/motor-v8/spec.json) and
[`examples/motor-cohete/spec.json`](../../examples/motor-cohete/spec.json).

## The shape of the tree

`root` is a `Node`; `defs` holds reusable subtrees; `parts`, if present, is the fixed scenery (a bench, a stand) in
world coordinates.

| Node field | Purpose |
|---|---|
| `id` | Required. It names its parts and its group: the part `slab` of the node `lid` is called `lid.slab`. Two siblings cannot share it. |
| `at` | The node's origin, relative to its parent. The coordinates of `parts` and children are **local** to it. |
| `parts`, `children` | Its parts (the usual ones) and its sub-assemblies. |
| `name`, `note` | The part's name and one line on what it does: they show in the parts list and in the readout when picked. |
| `explode` | How far it moves away when taken apart, **relative to its parent**. Use diagonals when they say something (a V8's heads leave at 45°). |
| `stage`, `step` | Which stage it leaves in, and that step's text ("heads off"). |
| `repeat` | `{ count, step, from? }`: copies the whole subtree. |
| `use`, `with` | Takes the subtree from `defs` or from the catalog. |
| `tone`, `paint` | Inherited by the parts and inner nodes that don't set their own. |
| `mount` | Parts the whole node is fitted into (the rotating assembly inside the block): added to each part's `mount`. |

### References: the node itself first, then upwards

`on` and `mount` use the short id. They are looked up first among the node's own parts, then its parent's, its
grandparent's… up to the root and the figure's loose parts. To reach another branch, write the path from a common
ancestor: from the V8 intake, `"bloque.bancada-izq.fundicion"`. A reference that is not found stays as written and the
validation reports it with the JSON path (`root.children[2].parts[0].mount[0]`).

### `repeat` of a subtree

```json
{ "id": "cylinder-{i}", "repeat": { "count": 4, "step": [0, 36, 0] }, "children": [ … ] }
```

Each copy is the whole subtree, shifted by `step × k`. `{i}` (worth `from + k`) is replaced in the texts of the
repeated node and its inside, except inside a node or part that repeats on its own: `{i}` belongs to the nearest
`repeat`. Without `{i}` in the id, `-i` is appended. Each copy resolves its references within itself.

### `use`, `defs` and the catalog

```json
"children": [{ "id": "leg-{i}", "use": "leg", "with": { "tall": 6 }, "repeat": { "count": 4, "step": [40, 0, 0] } }],
"defs": { "leg": { "parts": [{ "id": "c", "kind": "cylinder", "at": [0, 0, 0], "r": 4, "h": "{tall}" }] } }
```

`use` looks in `defs` first and then in the catalog. In `defs`, `with` replaces `{key}` in the subtree's texts; a text
that is only `"{tall}"` takes the value as is (a number). What the node itself sets (`id`, `at`, `explode`, `name`…)
wins over the subtree, and its `parts` and `children` are added to the subtree's.

The default catalog of `renderFigure`, `validateSpec` and the CLI is [`isofig/kit`](kit.md)'s: `"use": "bench",
"with": { "size": [150, 250] }` works from JSON with no setup. A `pool` with `extent` also brings its `groups`, which
are added to the figure's. Pass another catalog as `renderFigure(spec, { catalog })` or `assemble(spec, { catalog })`. The orbit
(`enableOrbit`) takes the spec already assembled with `assemble(spec, { catalog })`: it never needs the catalog.

## The teardown

If any node has `explode`, the figure gets, on its own:

- **"Take apart"**: a stepped slider, from "Assembled" to "Step 7 of 7". Each node moves by the sum of its own
  `explode` and its ancestors', each within its stage's window: moving to step 3 moves what belongs to stage 3, and
  whatever is inside it travels along.
- **The parts list** ("Part"): one button per name, in tree order; two nodes with the same name (both heads) are a
  single entry. Picking one zooms the camera onto it with an animation, brings it to the front (it paints over
  everything) and leaves the rest at 35 %, see-through but visible; the readout shows its `name` and `note`, and "All"
  returns to the full frame. Picking a node shows its parts and the inner ones that don't come off on their own: what
  leaves separately is another part. With the figure assembled the part shows inside (the pistons in their bank), and
  the zoom follows the part when you move "Take apart" or turn the figure.
- **The readout**: "Step 3 of 7: heads off", or "Cylinder head · closes the cylinders…" with a part picked. Screen
  readers hear the step when it moves (`aria-valuetext`), and the list is a radio group with its legend.

### Stages

- **Automatic** (no node sets `stage`): what is furthest out in its direction of travel leaves first, and a child never
  after its parent (the cover before the head). Nodes at the same distance (both heads) leave together.
- **The author's**: with `stage` on any node, they are sorted by that number; nodes without it inherit their nearest
  ancestor's or go in the first stage. Equal numbers leave together.
- A step's text is the `step` of the first node in the stage that has one; otherwise their names as a list ("knob and
  lid").

### What it generates

The runtime knows nothing about trees: `assemble(spec)` returns the usual flat `FigureSpec`, with

- one group per node that comes apart or has a name (its path: `bloque.bancada-izq.culata`);
- the parameters `explode` (stepped range, with one text per step in `texts`) and `pick` (choice); if the spec already
  has one with that id, its own is used;
- one `bind` per group and stage (`move` with `win`) and one per group for the pick (`keep`);
- `groups[g].extent` with the displacement at the end of each stage, so the camera frames the figure taken apart;
- `readout: "{pick}"` (unless the spec has its own) and `reorder`, the paint order of each pose.

### A part a model already animates

If an inner part has its own `group` (a wheel the model spins), it keeps it and the teardown carries it from outside:
it is drawn inside a `<g data-g="node-group">`. Both transforms compose. It costs about 30 bytes per such part. The
teardown's binds add to what the model moves; the readout, if the model gives one, is the model's.

## Paint order while taking apart

The order is computed at rest and also at each pose (the end of each stage). The figure stores only the differences:
per pose, pairs "move this part before that one" over the rest order (the ones outside the longest run already in
order). The runtime reorders the DOM when it crosses the threshold: on the way out, once the part has arrived; on the
way back, as soon as it starts. So a part is never painted over the one that hid it.

With leaning or round parts, the order also uses the planes of their faces (and the line between the centres of two
round parts). A part inside another part's box (a piston in its bank) goes first: it stays hidden.

## Primitives for real machines

- `prism` with `axis: "y"` or `"x"`: the plan is `[x, z]` (or `[y, z]`) and is extruded along that axis from `z`. For
  the profile of a V block, a leaning cylinder head or a beam. Clockwise or counterclockwise, either works.
- `cylinder` with a vector axis (`"axis": [-0.71, 0, 0.71]`): a leaning rod or piston.
- `cone`: a truncated cone, `r` at the starting face and `r2` at the other (0 is a point). A nozzle is built from several.
- `sphere` (`at` is the center) and `capsule` (a cylinder with a half sphere at each end; `at`, `r`, `h` and `axis` as in
  `cylinder`): joints, long bones, rounded rods. They explode, repeat and turn like any other part.

## Checking it

```sh
npx isofig check engine.json --lang en                     # tree shape, use, references, audit
npx isofig build engine.json --format page -o engine.html --set explode=4 --set pick=3
```

`--set` also reaches `explode` and `pick`: use it to capture each step and each picked part. Look at the captures
assembled, halfway and taken apart: a green check does not fix what the eye does not believe.
