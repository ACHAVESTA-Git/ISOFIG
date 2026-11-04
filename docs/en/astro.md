# isofig with Astro

The `Figure` component generates the SVG at build time. The page receives the figure's HTML, the theme CSS and a
~1.7 KB gzip runtime that only works while the figure is on screen.

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

The component imports `isofig/theme.css` (the theme's only public path), so the CSS only reaches pages that have a figure. If the spec has an
error (an `on` that points to a part that doesn't exist, a duplicate id), the build fails. Audit warnings
(floating parts, parts passing through each other, excess weight) are printed in the build console.

## 4. Bring it to life with a model

Without a model, parameters can move groups with `bind` (see [spec.md](spec.md#bind)). If the figure simulates
something over time, write a model and register it under the same name as `spec.model`:

```astro
<script>
  import { register } from "isofig/runtime";
  import bucket from "../figures/bucket.model";
  register("bucket", bucket);
</script>
```

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
- Registration order doesn't matter: if the figure mounts first, it waits for the model.

## 5. Theme

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

## 6. View transitions

The runtime remounts figures on `astro:page-load`, so they work with `<ClientRouter />` without extra code.

## 7. Check before publishing

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
| The figure doesn't move | The name in `register` doesn't match `spec.model`, or the user has reduced motion enabled (it starts paused: try the button). |
| A part is drawn in front of another that should hide it | The order is computed at rest. Avoid having a moving part cross behind another; split the part or change its path. |
| `No cached compile metadata` when building | You installed isofig with `file:` and a symlink outside the project. Use `npm pack` and the tarball, or publish it. |
