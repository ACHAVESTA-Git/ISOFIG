# Spec reference

A `FigureSpec` is a plain object: it can be written in TypeScript (with autocompletion) or in JSON.

## World and camera

- World units: roughly 1 px of the real object. `x` and `y` on the floor, `z` up.
- With the default azimuth (45°), `x` grows toward the bottom left of the screen and `y` toward the bottom
  right. Whatever has a larger `x` or `y` is closer to the reader.
- `camera: { azimuth, elevation }`: 35–60° shows the long side; the default elevation is 30°.
- The figure fits itself to the `viewBox` (`width` × `height`, 640 × 400 by default) with a `pad` margin.

## Figure fields

| Field | Type | Purpose |
|---|---|---|
| `id` | `string` | Unique on the page. |
| `title`, `hint`, `caption`, `alt` | `Text` | Title (top right), hint (bottom left), caption below the card, description for screen readers (the caption by default). |
| `parts` | `Part[]` | The parts (with `root`, the fixed scenery). |
| `root`, `defs` | `Node`, `Record<string, Node>` | A tree of nested nodes, flattened at build time; if any node has `explode`, it can be taken apart. See [nesting.md](nesting.md). |
| `reorder` | `{ param, at }` | Recomputes the paint order with the groups moved by `bind` at each value `at` of the parameter (the teardown sets it for you). |
| `groups` | `Record<string, GroupSpec>` | What moves and how far, so it fits in any pose. |
| `params` | `ParamSpec[]` | Sliders. |
| `bind` | `BindSpec[]` | Parameter → group links without writing a model. |
| `tracks` | `TrackSpec[]` | Groups that travel along a polyline without a model (a map's packets). See [Tracks](#tracks). |
| `map` | `MapSpec` | A topology, a flow map or a UML diagram, compiled to a `root` tree and to `tracks`. See [maps.md](maps.md). |
| `readout` | `Text` | Readout template, with `{param}`. The model can replace it. |
| `model` | `string` | Name under which the model is registered in the runtime. |
| `autoplay` | `boolean` | Defaults to `true` if there is a model or there are tracks. With reduced motion it always starts paused. |
| `motion.tau` | `number` | Time constant of the interpolation (s), 0.18 by default. |
| `motion.settle` | `number` | With reduced motion, seconds simulated at once on mount and after every control or preset (presets simulate 8 if unset). |
| `budget` | `number` | KB gzip it must not exceed (40 by default). |
| `palette` | `{ base?, use? }` | The figure's roles (`use`, in legend order) and, optionally, the brand color they derive from (`base`). See [color.md](color.md). |

`Text` is `"text"` or `{ es: "…", en: "…" }`.

## Solid parts

All accept: `id`, `tone` (`lo` base, `mid` structure, `hi` subject, `lit` the single accent), `group`, `hidden`,
`repeat`, `float`, `mount`, `shadow`, `paint` (a role or a material: `"data"`, `"steel"`…; see [color.md](color.md)) and
`ground` (a floor piece, such as a tray or a ribbon laid on the ground: it is painted before everything that stands or
passes over it, and never takes part in paint-order doubts; maps use it).

| `kind` | Fields | Notes |
|---|---|---|
| `box` | `at` (minimum corner), `size: [w, d, h]`, `radius`, `bevel` | Rounded rectangle in plan, extruded upward. |
| `cylinder` | `at` (center of the starting face), `r`, `h`, `axis` (`x`/`y`/`z` or a vector such as `[1, 0, 1]`), `bevel` | Wheels, knobs, tokens, posts; with a vector, a leaning rod or piston. |
| `cone` | `at`, `r` (starting face), `r2` (the other one; 0 is a point), `h`, `axis` | A truncated cone: nozzles, funnels, trumpets. The first solid of revolution. |
| `prism` | `plan` (convex), `z`, `h`, `axis` (`z` by default; `y` or `x`), `bevel` | Any convex plan. With `axis: "y"` the plan is `[x, z]` and is extruded along y from `z`: the profile of a V block or a beam. Concave ones are built from several parts. |

- `bevel` cuts the edge of the top: between 0.4 and 1.6 it looks like a manufactured part.
- `repeat: { count, step, from }` creates offset copies. `{i}` in `id` or `group` is replaced by the index; if `id`
  doesn't include it, `-i` is appended. `from` is the first value of `{i}` (0 by default): copy number k moves
  `step × k` and is named `from + k`, so two rows can share out the numbers of one group (`row-0…13` and
  `row-14…27`).
- `hidden: true` starts invisible (for a stock of parts the model reveals).
- `mount: ["other"]` says the part is deliberately fitted into another, and the audit doesn't count it as a collision.
- `float: true` says the part hangs or flies on purpose.

## Details

They are drawn on a solid part (`on`) and share its place in the paint order. They must go on a visible face
(the top is always visible).

| `kind` | Fields |
|---|---|
| `ticks` | `from`, `along` (step between marks), `count`, `toward` (direction of the mark), `every` (how often a major one appears), `size: [minor, major]` |
| `dots` | `points` — screws, rivets, lights |
| `line` | `points`, `bold` — seams, slots, lines on a plate |
| `label` | `at`, `text`, `size`, `align` (`start`, `middle`, `end`), `face` (`top`, `x` or `y`) — a name engraved on a face, to tell identical parts apart (services, nodes) |

## Groups

```ts
groups: {
  carriage: { extent: [[0, 120, 0]] },
  needle: { spin: { center: [40, 40, 20], plane: "xz" } },
}
```

- `extent`: extreme offsets in the world. The camera fit takes them into account.
- `spin`: the group rotates within a plane (`xy`, `xz`, `yz`) around `center`. Useful for flat parts:
  needles, discs seen head-on, gates.

## Parameters

```ts
params: [{ id: "rate", label: { es: "Tráfico", en: "Traffic" }, min: 0.5, max: 8, step: 0.5, value: 3, unit: "req/s" }]
```

Each parameter is a native `input[type=range]`: keyboard, screen reader and `aria-valuetext` with the unit.

## Discrete controls and presets

```ts
params: [
  { id: "breaker", label: "Breaker", kind: "toggle", min: 0, max: 1, value: 1 },
  { id: "algo", label: "Algorithm", kind: "choice", options: ["round robin", "least connections"], min: 0, max: 1, value: 0 },
],
presets: [
  { label: "Slow dependency", values: { latency: 3000 }, note: "Watch only its compartment fill up.", reset: true },
  { label: "Delete a pod", values: { replicas: 3 }, press: ["delete"], note: "The Deployment replaces it within seconds." },
],
```

- `toggle` is 0 or 1; `choice` is the index of the chosen option; `action` is a button that adds 1 when pressed.
- `presets` are "Try to break it" buttons: they set params, show `note` and announce it to screen readers. `press` presses actions after setting the values (and after `reset`), so the preset doesn't have to ask "now press…".
- A model can tint a group with `s: "ok" | "warn" | "fail"`.

## What the model gets in `ctx`

```ts
step(s, dt, p, ctx) {
  if (ctx.changed("replicas")) s.wanted = p.replicas;      // the control changed
  if (ctx.pressed("delete")) {                              // the action was pressed (button or preset with press)
    s.pods.pop();
    ctx.say("A pod was deleted: the Deployment creates another"); // an event, once
  }
}
```

- `ctx.pressed(id)` and `ctx.changed(id)` are true during the step after the press or the change: the model doesn't need to keep a copy of the parameter to compare.
- `ctx.say(text)` announces an event when it happens. The runtime decides when to speak: it stays quiet until the reader touches the figure, waits for 1.5 s of silence, never talks over a preset note, speaks at most twice per interaction and never repeats the last thing it said. If the readout echo talks over it, it is said afterwards. `view.say` keeps working as before.
- `ctx.reducedMotion` updates live if the reader changes the system setting. With `motion.settle`, the runtime already shows the settled state: the model doesn't have to compute it by hand. The simulation continues from the current state; a preset with `reset` always gives the same result.

## bind

For figures that only respond to the controls:

```ts
bind: [
  { group: "carriage", param: "load", move: [0, 1.2, 0] },
  { group: "needle", param: "load", spin: 3 },
  { group: "lamp", param: "on", fade: true },
]
```

`move` is multiplied by the parameter's value; `spin` gives degrees per unit; `fade` uses the value (0–1) as
opacity. Several binds on the same group add up (and, if the figure has a model, they add to what the model sets).

- `win: [a, b]` uses `(value − a) / (b − a)`, clamped to 0…1: the group only moves while the parameter crosses that
  window (that is how each stage of a teardown comes off).
- `keep: [1, 3]` with a choice: when it is anything other than 0 and not in the list, the group fades back.

A parameter with `texts` (one text per integer value) shows them in the readout (`{id}`) and announces them to screen
readers; a text can in turn name another parameter (`"{explode}"`).

## Audit

`renderFigure` and `isofig check` check (weight only in `isofig check` and `isofig/node`):

- **Paint order:** pairs that overlap on screen without an axis separating them in the world.
- **Support:** every visible part touches another or the floor, except `float`.
- **Collisions:** two parts that sink more than 0.8 units into each other, except `mount`.
- **Weight:** gzip above `budget`. `renderFigure` does not measure it (gzip needs Node): `isofig check` and `checkBudget(spec, measure(html))` from `isofig/node` do.
- **Labels:** the ones that cannot be read even in the enlarged view (see [validate.md](validate.md#legible-labels)).

The spec itself is validated before drawing: [validate.md](validate.md).

The audit works on boxes: it is fast and coarse. Always review the figure at 4× in both themes.

## Turning the figure (orbit)

`renderFigure(spec, { orbit: true })` adds turn buttons and the "drag to turn" hint. In the page, the orbit loads
only when needed:

```ts
import { orbitOnDemand } from "isofig/runtime";

orbitOnDemand(el, async () => {
  const { enableOrbit } = await import("isofig/orbit");
  return enableOrbit(el, spec, { lang: "en", range: 40 });
});
```

Hovering or focusing the figure prefetches it; pressing the drawing or a button enables it. The module is ~8.5 KB
gzip plus the spec, downloaded only by readers who turn the figure.

The orbit draws the **assembled** spec. A nested spec (`root`, see [nesting.md](nesting.md)) is flattened at build time
with `assemble(spec)` from `isofig`, and the flat one is what travels to the page (`<Figure orbit>` and
`isofig build --format page --orbit` do it for you). That way the browser does not download the tree flattener, the kit
catalog or the validator, and the turn keeps reordering the pieces by pose. Given a tree, `enableOrbit` says so.

## Enlarging the figure

On a phone the drawing is about 326 px wide and its labels 2 to 5 px tall. The card has an "Enlarge" chip that opens
a dialog with the same SVG 1150 px wide (or wider, until the median label reaches 11 px), with scrolling and pinch.
The figure keeps animating and turning inside; Esc or "Close" closes it and focus returns to the chip. The chip is
hidden and shows up on mount if the page gave a loader:

```ts
import { zoomOnDemand, mountAll } from "isofig/runtime";

zoomOnDemand(() => import("isofig/zoom")); // before mounting; the module (~1 KB gzip) downloads on press
mountAll();
```

`renderFigure(spec, { zoom: false })` removes the chip. `--isofig-zoom-width` changes the dialog's minimum width.

## Tracks

`tracks` moves a group along a polyline with no model: the packets of a map, a cart on a rail.

```json
"tracks": [
  { "group": "packet", "path": [[0, 0, 0], [0, 120, 0], [60, 120, 0]], "period": 6, "delay": 1, "hide": [[0.4, 0.5]] }
]
```

| Field | Purpose |
|---|---|
| `group` | The group (the `group` of its parts) that travels. Its parts are drawn where `path` starts. |
| `path` | World points of the route; at least two distinct ones. |
| `period` | Seconds to walk `path` end to end, at constant speed along the arc. Greater than 0. |
| `delay` | Seconds it waits before leaving the first time. |
| `loop` | `false`: walks it once and stays at the end. By default it starts over. |
| `hide` | Stretches of the route, as fractions of the arc (`[0.4, 0.5]`), where the group is not shown: it goes through an object. |

The group fades in and out at the ends of the route. The build computes the arc once; the runtime only interpolates,
and it does so with or without a model of your own (a model's groups and the tracks are drawn together). The pause
button stops them (a figure with tracks starts playing: `autoplay` defaults to `true`), and with reduced motion each
group rests halfway along and in sight. A group that no part has is a warning (`track-group-unknown`); a `period` that
is not greater than 0, or a `path` with fewer than two distinct points, is an error. Whatever travels is painted last,
so it is always seen. Cost in the runtime: 207 B gzip.

## Import and preview

- `isofig import compose <file.json|->` builds a map from `docker compose config --format json`, and `isofig import
  mermaid <file.mmd|->` one from a Mermaid flowchart or class diagram (see [import.md](import.md) and
  [maps.md](maps.md)). They are a starting point: edit them by hand.
- `isofig build <spec> --format page --model <model> --advance 3` writes a standalone page that bundles the model
  and the local files it imports, and opens 3 s into the simulation so headless Chrome can capture it.
- A warning such as "ambiguous paint order near A ↔ B, C" names the parts in the cycle: separate their boxes on
  some axis or split the long part.
