# Delivering a figure

Guides with every detail: `node_modules/isofig/docs/en/astro.md`, `angular.md`, `theme.md` (Spanish in `docs/es/`).
The core draws the figure at build time: the page receives its HTML already drawn, and the runtime, the model, the
orbit and the enlarge dialog download later, when the reader gets close or uses them.

## Astro (5 or later)

```astro
---
// src/components/Bucket.astro: one figure = one component
import Figure from "isofig/astro";
import bucket from "../figures/bucket";
---

<Figure spec={bucket} lang="en" n={1} {...Astro.props} />

<script>
  import { models } from "isofig/astro/client";
  models({ bucket: () => import("../figures/bucket.model.ts") });
</script>
```

- **The model is registered in a `<script>`, not a prop.** Astro cannot serialize a function, and an `import()` passed as
  a prop ends up in the server bundle. The name in `models()` is `spec.model`. `register(name, model)` from
  `isofig/runtime` still works if you prefer to load the model up front. If nobody registers it, the figure stays still
  and the console warns after 3 s.
- **A figure with no model** (`bind`, `tracks`, an assembly, a map) needs no `<script>` at all.
- **The "Enlarge" chip is on by default** (`zoom={false}` removes it). It opens the same live SVG about 1150 px wide.

| Prop | Purpose |
|---|---|
| `spec`, `lang`, `n`, `class` | The `FigureSpec`; the language of the texts; the number in "Fig. n"; a class for the container |
| `load` | `"visible"` (default: within 600 px of the screen or on hover/focus/touch), `"idle"` (figures visible when the page opens), `"eager"` |
| `orbit` | Adds the turn buttons and the drag (the spec travels in the page, about 1.6 KB gzip per figure) |
| `instance` | The copy's name in the DOM. Generated for you: the first copy keeps the spec id, the rest become `id-2`, `id-3` |
| `overrides` | `{ values, presets, hide, title, caption }`: other initial values, other presets (they **replace** the spec's), hidden controls or texts, without touching the shared spec |
| `zoom`, `theme` | `false` removes the chip; `false` if your site already loads `isofig/theme.css` |

`overrides` are validated like the spec (same codes, same messages): a value off its step, a preset without a `note` or one
that presses a non-action fails the build. `transition:persist` works (give both pages the same name) and `<ClientRouter />`
needs no extra code.

Weight to expect: about 2 KB of bootstrap with the page, then the runtime (about 4.2 KB) and the model on demand, the
orbit (several KB) only when someone turns the figure, and about 0.8 KB for the enlarge dialog when the chip is
pressed.

## Angular (19 or later)

```sh
npm i isofig
npx isofig add angular src/app/isofig        # copies the component into your project: the only way to install it
npx isofig build figures/bucket.ts --format module --lang en -o src/app/figures/bucket.figure.ts
```

Add `"isofig/theme.css"` to `styles` in `angular.json`, then:

```ts
@Component({ selector: "app-limits", imports: [IsofigFigure], template: `<isofig-figure [figure]="figure" [model]="model" />` })
export class Limits { protected readonly figure = figure; protected readonly model = bucket; }
```

Type the model's parameters (`Model<State, { refill: number }>`) so strict mode does not complain. The component marks
the HTML as trusted: never pass it HTML that comes from a user or an API. Regenerate the module in a `prebuild` script.

## Theme

One file, `isofig/theme.css`, and everything you change is an `--isofig-*` variable. Every token sits in `:where()`, so a
single-class rule of yours always wins, loaded before or after:

```css
.isofig {
  --isofig-card: var(--surface);
  --isofig-ink: var(--ink);
  --isofig-accent: var(--accent);
  --isofig-on-accent: var(--accent-contrast); /* the ink engraved on the accent: change it together with the accent */
}
```

- A value like that holds in light and dark. For one per theme, use `light-dark()`.
- Dark turns on with `prefers-color-scheme: dark` or `data-theme="dark"` on `<html>`; `data-theme="light"` forces light.
- **Never override `--fx`** (or `--ft`, `.isofig-art .lit`…): they are internal and change between versions. Use
  `--isofig-on-accent` (ink on `lit`), `--isofig-ink-on-color` (ink on a state) or a paint's `-ink` variable.
- The card is a container: below 40 rem the readout moves above the hint, and the readout reserves
  `--isofig-readout-lines` lines so the height does not jump. Put the figure in a container with a width.
- **Luxury look (optional):** `import "isofig/themes/luxe.css"` **after** `isofig/theme.css` and add the class
  `isofig-luxe` to the figure or any ancestor (`<body class="isofig-luxe">` for the whole page). Light is «Atelier», dark is
  «Nocturne»; it is only CSS (about 1.7 KB gzip), follows the theme, and without the class nothing changes. If it loads
  first it does not apply. Guide: `docs/en/luxe.md`.

## Before publishing

Run `check` and the screenshots (`verify.md`). To measure the weight from your own build code:
`import { measure, checkBudget } from "isofig/node"` (the only entry that needs Node; `isofig` and `isofig/runtime` also
run in the browser).

| Symptom | Cause |
|---|---|
| The figure does not move | `models()`'s name differs from `spec.model`, or reduced motion is on (it starts paused: add `motion.settle`) |
| Two copies share controls or ids | `renderFigure` called by hand with the same spec: pass an `instance` to each |
| The theme CSS reaches pages without figures | `isofig/theme.css` imported in a layout, or `theme={false}` |
| A part is drawn over one that should hide it | The order is computed at rest: change the path, or split the part (`machines.md`) |
| The figure has no colors (Angular) | `isofig/theme.css` is missing from `angular.json` |
