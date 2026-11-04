# Color and text

Full guides: `node_modules/isofig/docs/en/color.md`, `validate.md` (labels), `theme.md` (readout and tokens).

## Color

isofig is grey on purpose: grey is structure, and one accent marks the subject. A part can also carry a **paint**.

| Source | Where it comes from | Rule |
|---|---|---|
| Tone (`lo`, `mid`, `hi`) | The spec | The greys of structure |
| `lit` | The spec | The **only** strong accent: the subject. Wins over `paint` |
| `paint` | The spec | A material (machines) or a role (maps) |
| State `s` (`ok`, `warn`, `fail`) | The model, while it runs | Wins over the paint. Never paint with a state (`paint-is-state`) |

### Criteria

- **Paint parts, not the stage.** Base, rails and stands stay `lo`/`mid`: a large painted base glares in the dark theme
  and steals attention from the subject.
- **Machines get materials, maps get roles, never both.** `data` and `brass` are both golden in the dark theme
  (`paint-indistinct` tells you when two paints in use are hard to tell apart).
- **Six colors at most**, counting roles, colored materials and the accent; the greys (aluminium, steel, iron, carbon,
  rubber, external) count as one (`palette-too-many-colors`).
- **Color never carries meaning alone.** Label the parts; a map draws its own legend (`legend: false` removes it), and for a figure built by hand `legendOf(spec, lang)` lists the paints in use. With color
  blindness the green accent looks like a light grey: in a machine the subject also stands out because it moves. If
  the only difference between two parts is their color, add a shape, a label or a position.
- **A node's children inherit its `paint`** (in a `root` tree). A part with its own `paint` keeps it.
- **No literal colors in your CSS.** Use the theme's `--isofig-*` variables and the paints below.

### The sets

| Materials (machines) | Typical use |
|---|---|
| `aluminium`, `steel`, `iron` | Covers and casings, shafts and rails, frames and bases |
| `carbon`, `rubber` | Housings and dark parts, feet, seals, tires |
| `copper`, `brass` | Windings and pipes, fittings and nozzles |
| `glass` | Windows, tubes, anything you look through |
| `lacquer` | A painted red part: the one that warns |

| Roles (maps) | Objects that carry them (the map catalog) |
|---|---|
| `client` | `user`, `phone`, `laptop`, `browser` |
| `edge` | `cdn`, `balancer`, `gateway`, and UML `interface` |
| `compute` | `service`, `server`, `function`, and UML `class` |
| `data` | `database`, `cache` |
| `messaging` | `queue` |
| `storage` | `storage` (a bucket) |
| `external` | `external` (a cloud) |

All come in OKLCH with light and dark values. The guarantees are measured and tested in both themes: engraved text
against its face ≥ 4.5:1, edges ≥ 3:1, and any two paints of one set ΔE ≥ 10 apart (≥ 6 for color blindness). A
paint outside the sets is valid when it is in `palette.use` and your CSS defines `--isofig-paint-<name>`; isofig cannot
measure its guarantees (use `isofig palette --report`).

### A brand color

```ts
palette: { base: "#3b82f6", use: ["client", "compute", "data"] }
```

`base` derives the roles around that color (the base is taken as the accent); `use` lists the roles the figure needs,
also the legend's order. A pastel base (L ≥ 0.8) may fail to separate a role from the accent (`palette-roles-unmet`).
Materials do not change with the base.

```sh
npx isofig palette --base "#e4572e" --report   # the CSS block of the roles, and a table of the guarantees on stderr
```

### Color warnings

`paint-unknown` (did you mean…?), `paint-is-state`, `palette-base-invalid`, `palette-use-invalid`,
`palette-roles-unmet`, `palette-too-many-colors`, `paint-indistinct`, `paint-text-contrast` (a label on a painted face
under 4.5:1, usually on a side face: move the label to the top face).

## Text

The old rule "no words in the drawing" is replaced by measured rules.

### Labels in the drawing

- **Where:** a `label` is engraved on a face of a solid part (`face: "top" | "x" | "y"`, `align: "start" | "middle" |
  "end"`). Prefer a **plate**: `labelPlate({ text })` from the kit engraves a name on a plate with its screws. A plate
  holds about 12 characters at `textSize` 5 on a 40 deep plate (about `0.6 × textSize` units per character).
- **What:** names for parts the reader must tell apart (services, nodes, stages, workstations). A word or two. Never a
  sentence: explanations go in `caption` and in the page.
- **How small:** a label's size on screen is `size × camera scale × (screen width / viewBox width)`, times the
  foreshortening of its face (a label lying on the floor looks lower than one standing up). The audit measures it at two
  widths: a 390 px phone and the enlarged view (about 1150 px).
  - **Warning `label-unreadable`:** under **9 px even enlarged**. One per figure, with the smallest label and the `size`
    that would reach 9. Fix it by raising `size` to that, shortening the text, or moving the name to a plate.
  - **Note `label-small-mobile`:** under 9 px on a phone but readable enlarged. Expected: on a phone the drawing is
    about 326 px wide, so almost every label is tiny. The "Enlarge" chip is the answer; do not grow labels until they
    cover the machine.
  - To require 11 px in a new project, `auditLabels(…, { min: { zoomed: 11 } })` takes it.
- **No arrows, balloons or leader lines** on a machine. If you want to say where something is, build the object so that
  its position says it. (A map draws its links itself.)
- **Lines end on something** and labels sit on a face that is visible with the default camera (the top always is).

### The card's texts

| Field | Where | Rule |
|---|---|---|
| `title` | Card top | What it is: "Token bucket" |
| `hint` | Bottom left | What to try: "Drag the sliders: refill vs. traffic" |
| readout | Bottom right | **At most 70 characters**, true numbers from the model: `5/8 tokens · 12 passed · 3 rejected` |
| `caption` | Below the card | The explanation, in full sentences |
| `alt` | Screen readers | A description; by default the caption |
| `unit` / `spoken` | Next to the value | "req/s" for the eye, "requests per second" for screen readers |

The readout reserves `--isofig-readout-lines` lines (2 by default, 3 or 4 in a narrow card) so the card does not jump
while the figure runs. Past 70 characters `readout-long` warns; shorten it first. If you cannot, reserve more lines for that
figure: `[data-isofig="alarm-room"] { --isofig-readout-lines: 4; }`.

`isofig check --model` reports the model's longest readout as a note (`readout-longest`).

### Language

Write every text in the user's language; give `{ es, en }` when the project is bilingual (a missing translation falls
back to English). The CLI's `--lang en|es` also sets the language of the messages and their prefixes.
