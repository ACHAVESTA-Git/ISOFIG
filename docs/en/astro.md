# isofig with Astro

The `Figure` component generates the SVG at build time. The page receives the figure's HTML, the theme CSS (once,
inline) and a ~2 KB gzip bootstrap. The runtime (~3 KB gzip), the model, the orbit and the enlarge dialog download
later, when the reader gets close to the figure or uses it, and the runtime only works while the figure is on screen.

## 1. Install

```sh
npm i isofig
```

Requires Node 22.18 or later (to load specs written in TypeScript) and Astro 5 or later.

## 2. Write the spec

A spec is an object with parts, groups that move and parameters. Keep it next to your components, for example
in `src/figures/bucket.ts`:

```ts
import type { FigureSpec } from "isofig";

const spec: FigureSpec = {
  id: "bucket",
  title: { es: "Balde de fichas", en: "Token bucket" },
  hint: { es: "Mueve los controles", en: "Drag the sliders" },
  model: "bucket",
  params: [{ id: "refill", label: { es: "Recarga", en: "Refill" }, min: 0.5, max: 6, step: 0.5, value: 2 }],
  parts: [
    { id: "base", kind: "box", at: [0, 0, 0], size: [130, 260, 8], radius: 7, bevel: 1.4, tone: "lo", shadow: true },
    // …
  ],
};

export default spec;
```

The full reference is in [spec.md](spec.md). A complete example, with 40 parts and its model, is in
[`examples/token-bucket`](../../examples/token-bucket).

## 3. Use the component

```astro
---
import Figure from "isofig/astro";
import bucket from "../figures/bucket";
---

<Figure spec={bucket} lang="en" n={1} />
```

| Prop | Purpose |
|---|---|
| `spec` | The `FigureSpec`. |
| `lang` | Language of the texts (`"es"`, `"en"`…). If a translation is missing, it falls back to English. |
| `n` | Number shown as "Fig. n". |
| `class` | Extra class for the container. |
| `instance` | Name of this copy in the DOM. It is generated for you by default ([section 6](#6-the-same-figure-several-times)). |
| `orbit` | Adds the controls and the drag to turn the figure ([section 7](#7-turning-and-enlarging-the-figure)). |
| `load` | When the runtime downloads: `"visible"` (default), `"idle"` or `"eager"` ([section 5](#5-when-each-thing-downloads)). |
| `overrides` | `{ values, presets, hide, title, caption }`: changes initial values, presets, controls and texts without touching the spec ([section 8](#8-changing-a-figure-without-touching-its-spec)). |
| `zoom` | `false` removes the "Enlarge" chip ([section 7](#7-turning-and-enlarging-the-figure)). |
| `theme` | `false` if your site already loads `isofig/theme.css` ([section 9](#9-theme)). |

Any other attribute (`id`, `data-*`, `transition:persist`…) is passed to the container. If the spec has an error (an
`on` that points to a part that doesn't exist, a duplicate id), or an `overrides` doesn't fit, the build fails. Audit
warnings (floating parts, parts passing through each other, excess weight) are printed in the build console.

## 4. Bring it to life with a model

Without a model, parameters can move groups with `bind` (see [spec.md](spec.md#bind)). If the figure simulates
something over time, write a model and register it under the same name as `spec.model`.

Registration goes in a `<script>` of the component that uses the figure, with `models()` and one `import()` per
model. That way Astro splits each model into its own file and the browser only requests it when the figure gets close:

```astro
---
// src/components/Bucket.astro: one figure = one component
import Figure from "isofig/astro";
import bucket from "../figures/bucket";
---

<Figure spec={bucket} lang="en" {...Astro.props} />

<script>
  import { models } from "isofig/astro/client";
  models({ bucket: () => import("../figures/bucket.model.ts") });
</script>
```

> **Why it isn't a prop.** A `model={() => import("./model.ts")}` on `<Figure>` would run on the server: Astro does
> not serialize functions, and the `import()` ends up in the server bundle, not the browser one. The `<script>` is the
> only thing Astro bundles for the client, which is why registration lives there.

```ts
// src/figures/bucket.model.ts
import type { Model } from "isofig/runtime";

interface State { tokens: number }

const model: Model<State, { refill: number }> = {
  init: () => ({ tokens: 8 }),
  step(s, dt, p) {
    s.tokens = Math.min(8, s.tokens + p.refill * dt);
  },
  view(s) {
    return {
      groups: { "coin-0": { o: s.tokens >= 1 ? 1 : 0 } },
      readout: `${Math.floor(s.tokens)}/8`,
    };
  },
};

export default model;
```

- `init` creates the state. `step` advances it by `dt` seconds and only runs while the figure is playing.
- `view` says what each group shows: `t` (offset in the world), `r` (rotation in degrees, if the group has
  `spin`) and `o` (opacity). Values are interpolated automatically; use `snap: true` when the model already
  produces continuous motion.
- `ctx.pressed`, `ctx.changed` and `ctx.say` tell what the reader touched and announce events (see [spec.md](spec.md)).
- `models()` accepts loaders that return the module (with `export default`) or the model itself.
- Registration order doesn't matter. If you prefer to load the model up front, `register("bucket", model)` from
  `isofig/runtime` in a `<script>` still works: the figure waits for the model.
- If nobody registers the model, the figure stays still and the console warns after 3 seconds.

## 5. When each thing downloads

The HTML already carries the drawn figure, with its controls hidden (`hidden`): until it mounts there is nothing the
reader could move or lose. Everything else downloads with `import()`:

| What | When | Weight (gzip) |
|---|---|---|
| `<Figure>` bootstrap | With the page; only if it has a figure | ~2 KB |
| Runtime and model | According to `load` | ~3 KB + the model |
| Orbit (`isofig/orbit`) | When the pointer hovers, focuses or touches the figure | ~6.8 KB |
| Enlarge (`isofig/zoom`) | When "Enlarge" is pressed | ~0.8 KB |

- `load="visible"` (default): when it gets within 600 px of the screen, or when the pointer hovers, focuses or touches the figure.
- `load="idle"`: when the browser is idle (2 s at most). For figures that are visible when the page opens.
- `load="eager"`: right away.

## 6. The same figure several times

The SVG ids (`-t`, `-d`, the repeated parts in `<defs>`) and the `name` of the radios come from the spec. If the same
figure appears twice on a page, `<Figure>` gives each copy its own name: the first keeps the spec id (its markup does
not change) and the rest become `bucket-2`, `bucket-3`…

```astro
<Figure spec={bucket} />                          <!-- ids: bucket-t, bucket-p0… -->
<Figure spec={bucket} />                          <!-- ids: bucket-2-t, bucket-2-p0… -->
<Figure spec={bucket} instance="bucket-trial" />  <!-- the name you choose -->
```

An explicit `instance` that another copy on the page already uses is a build error. Outside Astro,
`renderFigure(spec, { instance })` does the same: it only changes the `id`s and the `name`s; `data-isofig` and the
runtime JSON stay those of the spec.

## 7. Turning and enlarging the figure

`orbit` adds the turn buttons and the drag. The turn redraws the scene in the browser, so the spec travels in the page
(as a `<script type="application/json">`): about 1.6 KB gzip per figure with orbit for the example token bucket
(40 parts). The orbit code downloads only when the reader uses it.

The "Enlarge" chip appears on every mounted figure and opens the drawing in a large dialog, with labels that are
readable on a phone. `<Figure>` enables `isofig/zoom` for you (it downloads only if someone presses the chip);
`zoom={false}` removes the chip. The dialog adds no ids: it uses `aria-label` and the same SVG, not a copy.

## 8. Changing a figure without touching its spec

A site may want other initial values, other presets, or to hide a control without editing the shared spec:

```astro
<Figure
  spec={bucket}
  overrides={{
    values: { refill: 4 },
    presets: [{ label: "No refill", values: { refill: 0.5 }, note: "Watch the tube empty." }],
    hide: ["rate"],
    title: "This chapter's bucket",
  }}
/>
```

| Field | Effect |
|---|---|
| `values` | Initial value of each parameter, by id. |
| `presets` | **Replaces** the spec's presets. |
| `hide` | Ids of parameters whose control isn't shown (the model still receives them). |
| `title`, `caption` | Texts (a string or `{ es, en }`). |

`applyOverrides(spec, overrides, { lang })` does the same and can be used on its own (it is pure and doesn't touch the
original spec). What it changes is checked with `validateSpec`: the same codes and the same messages (`en` or `es`, see
[validate.md](validate.md)). If something doesn't fit, it throws an `OverridesError` with every problem in
`error.issues` (code, severity and `path`): a value outside `min`–`max` or off its `step`, a 2 on a toggle, an index
outside a choice, a preset without `label` or `note`, or one that sets a parameter that doesn't exist or presses
something that isn't an action. The two cases `validateSpec` cannot see (an id that is not a parameter, and an initial
value for an action) have their own codes: `override-unknown-param` and `override-action-value`. A problem the spec
already had, and the change doesn't touch, is not thrown.

```ts
import { applyOverrides } from "isofig";

applyOverrides(bucket, { values: { refill: 7 } });
// OverridesError: applyOverrides «token-bucket»:
//   - values.refill: 'refill' starts at 7, outside its range 0.5 to 6: the slider would show 6.
```

`<Figure>` passes its `lang`, so the build error comes out in the figure's language.

## 9. Theme

All colors are `--isofig-*` CSS variables. To connect them to your site's tokens:

```css
.isofig {
  --isofig-card: var(--surface);
  --isofig-ink: var(--ink);
  --isofig-accent: var(--accent);
}
```

The theme rules sit inside `:where()`, so any selector of yours with one class wins over them. The dark theme is enabled with `prefers-color-scheme: dark` or with `data-theme="dark"` on `<html>`.
`data-theme="light"` forces the light one.

**Where the theme CSS goes.** `<Figure>` inlines it in a `<style>` tag at the start of the first figure of each page
(about 2.8 KB gzip per page). All three options were tried in an Astro 7 project with `<ClientRouter />` (Chromium and
WebKit, with the stylesheet delayed 500 ms):

| Way | Pages without a figure | After navigating with `ClientRouter` |
|---|---|---|
| `import "isofig/theme.css"` in the component | Get it if they *import* the component even when they don't draw it (a wrapper, an MDX component map) | No flash (the router preloads it) |
| `<link>` to `theme.css?url` in the body | Don't get it | The figure shows **unstyled** until the stylesheet arrives |
| Inline `<style>`, once per page (what `<Figure>` does) | Don't get it | No flash |

If your site already loads the theme in its layout (for example to cache it across pages), pass `theme={false}` and
`import "isofig/theme.css"` wherever you like.

## 10. View transitions

`<Figure>` works with `<ClientRouter />` without extra code. It looks for new figures on every `astro:page-load` and,
before each page change (`astro:before-swap`), stops only the ones Astro is about to remove.

With `transition:persist` the figure stays alive across navigation: the same DOM node, its animation and its state.

```astro
<Figure spec={bucket} load="eager" transition:persist="bucket" />
```

Use the same name on both pages. Wrapping it also works: `<div transition:persist="bucket"><Figure … /></div>`.

## 11. Check before publishing

```sh
npx isofig check src/figures/bucket.ts --lang en --strict
npx isofig build src/figures/bucket.ts --format page --model src/figures/bucket.model.ts -o preview.html
```

`check` prints the weight and the warnings (it fails with `--strict` if there are any). `page` builds a
standalone page to view in the browser or capture headless.

To measure the weight from your own build code, use `isofig/node`. It is the only entry that needs Node
(`node:zlib`); `isofig` and `isofig/runtime` run in the browser too.

```ts
import { renderFigure } from "isofig";
import { checkBudget, measure } from "isofig/node";

const figure = renderFigure(spec);
const size = measure(figure.html); // { bytes, gzip }
for (const warning of checkBudget(spec, size)) console.warn(warning); // over `spec.budget` (40 KB by default)
```

## Common problems

| Symptom | Cause |
|---|---|
| The figure doesn't move | The name in `models()` or `register` doesn't match `spec.model`, or the user has reduced motion enabled (it starts paused: try the button). If nobody registered the model, the console says so. |
| Two copies of the figure share controls or ids | You called `renderFigure` by hand with the same spec: pass a different `instance` to each copy (`<Figure>` does it for you). |
| The theme CSS reaches pages without figures | You imported `isofig/theme.css` in a layout, or passed `theme={false}`. Remove the import or leave `theme` at its default. |
| A part is drawn in front of another that should hide it | The order is computed at rest. Avoid having a moving part cross behind another; split the part or change its path. |
| `No cached compile metadata` when building | You installed isofig with `file:` and a symlink outside the project. Use `npm pack` and the tarball, or publish it. |
