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
| `parts` | `Part[]` | The parts. |
| `groups` | `Record<string, GroupSpec>` | What moves and how far, so it fits in any pose. |
| `params` | `ParamSpec[]` | Sliders. |
| `bind` | `BindSpec[]` | Parameter → group links without writing a model. |
| `readout` | `Text` | Readout template, with `{param}`. The model can replace it. |
| `model` | `string` | Name under which the model is registered in the runtime. |
| `autoplay` | `boolean` | Defaults to `true` if there is a model. With reduced motion it always starts paused. |
| `motion.tau` | `number` | Time constant of the interpolation (s), 0.18 by default. |
| `budget` | `number` | KB gzip it must not exceed (40 by default). |

`Text` is `"text"` or `{ es: "…", en: "…" }`.

## Solid parts

All accept: `id`, `tone` (`lo` base, `mid` structure, `hi` subject, `lit` the single accent), `group`, `hidden`,
`repeat`, `float`, `mount` and `shadow`.

| `kind` | Fields | Notes |
|---|---|---|
| `box` | `at` (minimum corner), `size: [w, d, h]`, `radius`, `bevel` | Rounded rectangle in plan, extruded upward. |
| `cylinder` | `at` (center of the starting face), `r`, `h`, `axis` (`x`/`y`/`z`), `bevel` | Wheels, knobs, tokens, posts. |
| `prism` | `plan: [x, y][]` (convex, counterclockwise), `z`, `h`, `bevel` | Any convex plan. Concave ones are built from several parts. |

- `bevel` cuts the edge of the top: between 0.4 and 1.6 it looks like a manufactured part.
- `repeat: { count, step }` creates offset copies. `{i}` in `id` or `group` is replaced by the index; if `id`
  doesn't include it, `-i` is appended.
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
],
```

- `toggle` is 0 or 1; `choice` is the index of the chosen option; `action` is a button that adds 1 when pressed (the model compares the counter to know something happened, e.g. "delete a pod").
- `presets` are "Try to break it" buttons: they set params, show `note` and announce it to screen readers.
- A model can tint a group with `s: "ok" | "warn" | "fail"` and announce an event with `say`.

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
opacity.

## Audit

`renderFigure` and `isofig check` check:

- **Paint order:** pairs that overlap on screen without an axis separating them in the world.
- **Support:** every visible part touches another or the floor, except `float`.
- **Collisions:** two parts that sink more than 0.8 units into each other, except `mount`.
- **Weight:** gzip above `budget`.

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

Hovering or focusing the figure prefetches it; pressing the drawing or a button enables it. The module is ~6 KB
gzip plus the spec, downloaded only by readers who turn the figure.

## Import and preview

- `isofig import compose <file.json|->` builds a spec from `docker compose config --format json` (see
  [import.md](import.md)). It is a starting point: enrich it by hand.
- `isofig build <spec> --format page --model <model> --advance 3` writes a standalone page that bundles the model
  and the local files it imports, and opens 3 s into the simulation so headless Chrome can capture it.
- A warning such as "ambiguous paint order near A ↔ B, C" names the parts in the cycle: separate their boxes on
  some axis or split the long part.
