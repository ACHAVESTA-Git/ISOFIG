# The kit of common pieces

Almost every figure starts the same way: a base on feet with screws at the corners, a label plate, a ruler along the
edge, a pool of hidden pieces (coins, parcels, crates) and the `groups` entries that go with them. `isofig/kit` gives
each of those as a small pure function that returns `Part[]`, so you write the line instead of copying the block.

It ships with the package: `import { bench, labelPlate, pool } from "isofig/kit"`.

## In TypeScript

```ts
import { defineFigure } from "isofig";
import { bench, groupsOf, labelPlate, pool, ruler } from "isofig/kit";

export default defineFigure({
  id: "tray",
  title: { es: "Bandeja de pedidos", en: "Order tray" },
  width: 520,
  height: 360,
  groups: groupsOf("order", 5, { extent: [[0, 100, 0]] }),
  parts: [
    ...bench({ size: [120, 220] }),
    ...labelPlate({ at: [10, 8], text: { es: "PEDIDOS", en: "ORDERS" } }),
    ...ruler({ at: [104, 20], length: 180 }),
    { id: "belt", kind: "box", at: [44, 60, 11], size: [24, 140, 4], radius: 1.5, bevel: 0.6, tone: "mid" },
    ...pool({ id: "order", count: 5, piece: { kind: "box", at: [48, 64, 15], size: [16, 14, 8], radius: 1.6, bevel: 0.8, tone: "hi" } }),
  ],
});
```

`bench` is the base with four feet and four screws; `labelPlate` engraves the name in two languages; `ruler` adds the
strip with its ticks; `pool` creates the five hidden orders, each in its own group (`order-0` … `order-4`), and
`groupsOf` writes the matching `groups` entries so the camera fits every pose.

## In JSON

A JSON spec cannot call functions, so each node names a piece with `use` and passes its options in `with`. This needs
the nested spec (`root`, see [spec.md](spec.md)); the node resolves `use` against `catalog`.

```json
{
  "id": "tray",
  "title": { "es": "Bandeja de pedidos", "en": "Order tray" },
  "width": 520,
  "height": 360,
  "root": {
    "id": "tray",
    "children": [
      { "id": "frame", "use": "bench", "with": { "size": [120, 220] } },
      { "id": "plate", "use": "labelPlate", "with": { "at": [10, 8], "text": { "es": "PEDIDOS", "en": "ORDERS" } } },
      { "id": "scale", "use": "ruler", "with": { "at": [104, 20], "length": 180 } },
      {
        "id": "belt",
        "parts": [{ "id": "belt", "kind": "box", "at": [44, 60, 11], "size": [24, 140, 4], "radius": 1.5, "bevel": 0.6, "tone": "mid" }]
      },
      {
        "id": "orders",
        "use": "pool",
        "with": {
          "id": "order",
          "count": 5,
          "extent": [[0, 100, 0]],
          "piece": { "kind": "box", "at": [48, 64, 15], "size": [16, 14, 8], "radius": 1.6, "bevel": 0.8, "tone": "hi" }
        }
      }
    ]
  }
}
```

In JSON there is no `groupsOf`: give `pool` an `extent` and its result carries the `groups` entries too.

## The pieces

Every function takes one options object. Sizes are `[width (x), depth (y)]`; everything stands on the top of the base,
`z = BASE_TOP` (11).

| Function | What it draws | Options (defaults) |
|---|---|---|
| `bench` | The base on four feet, with a screw in each corner | `size`, `id` (`base`), `legInset` (12), `screwInset` (6), `radius` (7) |
| `plinth` | A base without feet: solid, or on a low step. Use it for tall or long pieces, where feet confuse the paint order | `size`, `id` (`base`), `step` (`false`; `true` or `{ inset: 5, radius: 6 }`), `screwInset`, `radius` |
| `labelPlate` | A 1.2 thick plate with engraved lines or a name, and four screws | `at`, `size` (`[32, 40]`), `id` (`plate`), `z`, `text`, `textSize` (5), `lines` (3, or 0 with `text`), `rules`, `screws` (`true`) |
| `ruler` | A strip along y with a tick every `pitch` and a longer one every `every` | `at`, `length`, `id` (`ruler`), `z`, `width` (5), `pitch` (4), `margin` (4), `count`, `every` (5), `size` (`[2, 4]`), `toward` (1 or -1) |
| `screws` | A screw in each corner of a lid, for any box of yours | `on`, `at`, `size`, `z`, `inset` (3), `id` |
| `pool` | N identical pieces, hidden, each in its own group: a deposit or a row for the model to switch on and off | `id`, `count`, `piece`, `step` (`[0, 0, 0]`), `group`, `from` (0), `hidden` (`true`) |
| `groupsOf` | The `groups` entries of a family, instead of `Object.fromEntries(range(n).map(…))` | `groupsOf("order", 5, { extent })` or `groupsOf(["a", "b"], { extent })` |

- **`labelPlate` text** is engraved along y and centred. It takes about `0.6 × textSize` units per character, so a
  40 deep plate holds roughly twelve characters at size 5. The rules are `inset` and `pitch` along x, `margin` along
  y and `taper`, how much shorter each line is than the previous one; the defaults draw the plate most figures use.
- **`pool`** is one part with `repeat`, so a hundred pieces cost one line of spec. `piece` is a box, cylinder or prism
  without `id`, `group`, `hidden` or `repeat`. For a visible stack (`hidden: false`) use `step` to space them.
- **`ruler` ticks** start at `margin` from the end; `count` replaces the number that fits, and `toward: -1` puts the
  ticks on the other edge.

## Ids

Each function takes a base `id` so two uses in the same figure never collide, and derives the rest from it:

| Call | Ids |
|---|---|
| `bench({ id })` | `<id>`, `<id>-legs-far-0/1`, `<id>-legs-near-0/1`, `<id>-screws` |
| `plinth({ id })` | `<id>`, `<id>-step` (with `step`), `<id>-screws` |
| `labelPlate({ id })` | `<id>`, `<id>-line-1…`, `<id>-text`, `<id>-screws` |
| `ruler({ id })` | `<id>`, `<id>-ticks` |
| `pool({ id })` | `<id>-0`, `<id>-1`… (also the group names) |

If your own parts refer to one of them (`on: "plate"`, `mount: ["base"]`), keep the name with `id`.

## Two rows that share groups

A second row of the same family needs its own part ids but the same group family, and often numbers that continue
the first row. `group` names the family and `from` the first number; positions still count from 0:

```ts
import { groupsOf, pool, type PoolPiece } from "isofig/kit";

const piece: PoolPiece = { kind: "box", at: [43, 214, 16], size: [16, 11, 10], tone: "hi" };

const parts = [
  ...pool({ id: "row", count: 14, step: [0, -14, 0], piece }),
  ...pool({ id: "row-high", group: "row", count: 14, from: 14, step: [0, -14, 0], piece: { ...piece, at: [43, 214, 26] } }),
];
const groups = groupsOf("row", 28); // row-0 … row-27
```

## The catalog

`catalog` maps each name to a function `(options) => { parts }`, which is what `use` and `with` call. `pool` adds
`groups` when it gets `extent` (or `spin`). Unknown options are rejected by name (`«legInsett»`), so a typo in JSON
is not silently ignored, and `catalog` has no prototype: `catalog["constructor"]` is `undefined`.

```ts
import { catalog } from "isofig/kit";

const { parts } = catalog.bench({ size: [150, 250] });
```

## What stays in the figure

The kit holds what every figure repeats. The machine itself (a hopper, a gantry, a gate) is different each time and
stays in your spec.

## Moving an existing figure

Replace one block at a time; the SVG does not change. The tests draw the pieces Software Academy wrote by hand
(`banco`, `zocalo`, `placa`, `regla`, the stepped base) and the kit's, and compare the markup character by
character.
