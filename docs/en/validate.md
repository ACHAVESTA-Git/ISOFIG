# Validate the spec, check the figure

A spec is data, and data written by hand (or by an agent) is wrong in ways the types cannot see: a `bind` to a
parameter that does not exist, a slider that starts at a value it cannot show, a label too small to read. isofig
checks it at three levels:

| Level | What runs | Where |
|---|---|---|
| `validateSpec(spec)` | The spec as data: fields, numbers, references between parts, controls, presets | Node and browser, no dependencies |
| `renderFigure(spec)` | `validateSpec` + the audit of the drawing (support, collisions, paint order, weight, labels) | build time |
| `isofig check <spec> --model <model> --presets` | All of the above, and it **runs the figure**: the model for a few simulated seconds, then every preset | Node |

## `validateSpec`

```ts
import { validateSpec } from "isofig";

const issues = validateSpec(spec, { lang: "en" }); // or "es"
// [{ code: "bind-unknown-param", severity: "warning", path: "bind[0].param",
//    message: "bind uses the parameter 'nada', which does not exist." }]
```

- `code` is stable: filter and compare on it. `path` points at the field (`parts[3].size`, `params[0].value`,
  `presets[1].values.rate`); it is empty when the whole figure is concerned. `message` is in English by default and in
  Spanish with `lang: "es"`; any other language falls back to English.
- It accepts `unknown`, so it can read a JSON file straight away, and it never throws.
- A spec with a nested `root` tree or a `map` is accepted without its parts being checked here: they are flattened at
  build time.

### Severity in 0.9

Only what already breaks the drawing is an `error`: a `NaN` in a coordinate, a negative size, an unknown `kind`, a
missing field, repeated part ids, a detail on a part that does not exist, a wrongly typed container. Everything else is
a `warning`. **1.0 will tighten this**: the warnings that leave a control or a figure broken (below) will become errors.

`renderFigure` calls `validateSpec`: errors go to `errors`, warnings to `warnings` (both as `path: message` text), and
`issues` has everything with its code, `path` and severity, including the `info` notes. A broken spec does not throw; it
returns its errors.

### Codes

**Errors**

| Code | What |
|---|---|
| `spec-not-object`, `type-invalid` | The spec, or a field that must be a list or an object, is not |
| `id-invalid` | The figure `id` is not letters, numbers and hyphens |
| `parts-missing` | No `parts`, no `root`, no `map` |
| `part-id-missing`, `kind-missing`, `kind-unknown` | A part without id or kind, or with a kind that does not exist (the message lists the kinds) |
| `field-missing` | A part lacks a field it cannot be drawn without (`size` of a box, `on` of a detail…) |
| `number-invalid`, `vector-length-invalid` | A coordinate or measure that is not a finite number (`NaN`, `"4"`, `Infinity`), or a vector of the wrong length |
| `size-negative` | A negative `size`, `r` or `h` |
| `prism-plan-short` | A prism plan with fewer than 3 points |
| `id-duplicate` | Two solid parts with the same id after `repeat` |
| `on-unknown`, `on-not-solid` | A detail on a part that does not exist, or that is itself a detail |
| `dimension-invalid`, `camera-invalid`, `spin-plane-invalid` | `width`, `height`, `pad`, the camera angles or a spin plane that cannot be used |
| `draw-failed`, `model-invalid`, `model-throws`, `presets-need-model` | The drawing or the model failed; `--presets` without `--model` |

**Warnings** (the ones marked ↑ become errors in 1.0)

| Area | Codes |
|---|---|
| Spec | `unknown-key` (with the known keys and a «typo for…?» hint), `parts-empty`, `title-missing`, `model-name-invalid`, `autoplay-without-model`, `motion-invalid`, `budget-invalid`, `option-invalid` |
| Parts | `mount-unknown` ↑, `size-zero`, `number-negative`, `count-invalid` ↑, `repeat-from-invalid` ↑, `prism-clockwise` ↑, `prism-concave` ↑, `prism-degenerate`, `group-ignored`, `label-text-missing`, `label-size-invalid`, `group-unused` ↑ |
| Controls | `param-id-missing` ↑, `param-id-duplicate` ↑, `param-number-invalid` ↑, `param-range-invalid` ↑, `param-step-invalid`, `param-value-out-of-range` ↑, `param-value-off-step` ↑, `param-label-missing`, `choice-options-missing` ↑, `choice-value-invalid` ↑, `toggle-value-invalid` |
| `bind` | `bind-unknown-param` ↑, `bind-unknown-group` ↑, `bind-spin-no-pivot` ↑, `bind-no-effect`, `bind-with-model` |
| Presets and readout | `preset-unknown-param` ↑, `preset-value-invalid` ↑, `preset-value-out-of-range` ↑, `preset-value-off-step` ↑, `preset-press-invalid` ↑, `preset-no-effect`, `preset-label-missing`, `preset-note-missing`, `readout-unknown-param`, `readout-long` |
| Audit | `part-floats`, `parts-overlap`, `paint-order-ambiguous`, `label-unreadable`, and `weight-over-budget`, which needs Node: `isofig check` and `budgetIssues(spec, measure(html), lang)` from `isofig/node` give it |
| Color ([color.md](color.md)) | `paint-unknown` ↑, `paint-is-state`, `palette-base-invalid`, `palette-use-invalid`, and on the drawing `palette-roles-unmet`, `palette-too-many-colors`, `paint-indistinct`, `paint-text-contrast` |
| `check` | `model-group-unknown` ↑, `group-never-driven`, `model-param-unknown` ↑, `preset-same-view`, `set-unknown-param` |

**Info** (never fail `--strict`): `alt-missing`, `label-small-mobile`, `group-static`, `param-never-read`, `readout-longest`.

Two details worth knowing:

- **Value and step.** The browser snaps a slider to its step counted from `min`, and clamps it to the range. A starting
  value that does not fall there makes the slider show one number while the model uses another
  (`param-value-off-step`, `param-value-out-of-range`). Without `step` it is 1: a `0.5`–`6` slider with no `step`
  cannot land on `2.5`. The same goes for the values of a preset.
- **Unknown keys** are warnings, not errors: they may be a typo or a field from a newer version. The list of known keys
  includes the 0.9 fields (`paint`, `palette`, `root`, `defs`, `tracks`, `map`, `repeat.from`, `presets[].press`,
  `motion.settle`).

### `repeat.from`

`repeat: { count, step, from }`: `from` is the first value of `{i}` (0 by default). Copy number `k` moves `step × k` and
is named `from + k`. It is what lets two rows share out the numbers of one group: a second row of 14 with `from: 14`
answers to `row-14…27` while sitting right above the first. Before, both rows answered to `row-0…13` and the model could
not reach the rest.

## Legible labels

A label's size on screen is `size × camera scale × (width on screen / viewBox width)`, times the foreshortening of its
face (a label lying on the floor looks lower than one standing up; about 0.79 and 0.87 with the default camera). It
matches what a browser measures: over the 114 academy figures with labels it differs by 0.005 px.

The audit measures at two widths: a phone of 390 px (the figure is then 326 px wide) and the enlarged view that the
«Enlarge» chip opens (about 1150 px).

- **Warning** (`label-unreadable`): a label under **9 px even enlarged**. One warning per figure, with the smallest label
  and the `size` that would reach 9 px.
- **Info** (`label-small-mobile`): a label under 9 px on a phone but readable enlarged. One summary per figure.

Why 9 and not 11. Measured on the 114 figures of the academy with labels (807 labels), at 390 px the median is 3.3 px and
**all 114 figures** have some label under 9 px: that can only be a note. Enlarged, the median becomes 11.7 px and the
smallest 10 % stays under 8.2 px. With a threshold of 9 px, 34 figures warn (149 labels); with 11 px, 65 would (341
labels), too many for a warning to stop a branch that already has them. The constants are `LABEL_MIN_PX` and
`LABEL_WIDTHS` (exported); `auditLabels(items, cam, width, lang, { min, widths })` takes other values. To require 11 px
in a new project, pass `{ min: { zoomed: 11 } }`.

## `isofig check`

```sh
isofig check figure.ts --lang es --strict
isofig check figure.ts --model model.ts --presets [--seconds 12]
```

- Without `--model`: `validateSpec` and the audit, plus weight. `--strict` also fails on warnings (never on `info`).
- `--lang en|es` sets the language of the messages **and of their prefixes**: `error:` / `warning:` / `info:` in
  English, `error:` / `aviso:` / `nota:` in Spanish. Each line ends with its `[code]`.
- With `--model`, it runs the model in Node, like the runtime would, for `--seconds` simulated seconds (12 by default)
  with the initial values. With `--presets` it also runs every preset: the model runs half of `--seconds` first, the
  preset is pressed as the runtime does (its `values`, then `reset` if it asks, then its `press` once each) and the figure
  runs `--seconds` more. The model gets a full `ctx`: `ctx.pressed(id)` and `ctx.changed(id)` are true during the step
  after the preset (and count as reads of that parameter), and `ctx.say` is accepted and ignored.

What it reports with `--model`:

| Code | When |
|---|---|
| `model-group-unknown` | The model writes groups that no part has (nothing would move) |
| `group-never-driven` | A group with hidden parts, or with an `extent` or `spin`, that the model never writes: the part would stay still or invisible |
| `group-static` | (info) Any other group the model never writes |
| `preset-same-view` | After pressing the preset the view equals the view of not pressing it for the next `--seconds`. It can be on purpose when the preset restores the starting state, but it is worth a look |
| `model-param-unknown` | The model reads a parameter that the spec does not declare |
| `param-never-read` | (info) A control the model never reads |
| `readout-longest` / `readout-long` | The longest readout of the model; a warning past 70 characters (the card fits about that many on a phone) |
| `model-throws` | `init`, `step` or `view` threw |

Values of presets out of range or off their step are reported by `validateSpec`, which `check` always runs.

The same check is available from code: `checkModel(spec, model, { lang, seconds, presets })` returns `Issue[]`.

## Changes for 1.0

- Warnings marked ↑ become errors.
