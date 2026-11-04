# isofig with Angular (19 or later)

In Angular the figure is compiled before the bundler sees it. The isofig CLI turns the spec into a TypeScript
module with the HTML already generated; a standalone component displays and animates it. The isofig core doesn't
enter your bundle, only the runtime (~1.7 KB gzip).

Tested with Angular 22: standalone, signals, zoneless and `OnPush`.

## 1. Install

```sh
npm i isofig
npx isofig add angular src/app/isofig
```

`add angular` copies `isofig-figure.ts` into your project; that is the only way to install the component. The
package does not export it as a module (there is no `isofig/angular`), because Angular only compiles the
TypeScript that belongs to your project, not `.ts` files inside `node_modules`. The copy is yours: you can change
its selector or styles. It imports `isofig/runtime`, which does come from the package.

Add the theme in `angular.json`, under `architect.build.options.styles`:

```json
"styles": ["isofig/theme.css", "src/styles.css"]
```

`isofig/theme.css` is the theme's only public path. Don't point to `node_modules/isofig/src/theme/theme.css`: it
is an internal path and may change.

## 2. Write the spec

Keep the spec outside `src/app` (Angular doesn't need to compile it), for example in `figures/bucket.ts`. The
format is the same as in Astro: see [spec.md](spec.md) and [`examples/token-bucket`](../../examples/token-bucket).

## 3. Generate the module

```sh
npx isofig build figures/bucket.ts --format module --lang en -o src/app/figures/bucket.figure.ts
```

It's best to keep it as a script in `package.json` and run it before `ng build`:

```json
"scripts": {
  "figures": "isofig build figures/bucket.ts --format module --lang en -o src/app/figures/bucket.figure.ts",
  "prebuild": "npm run figures"
}
```

If Node warns `MODULE_TYPELESS_PACKAGE_JSON`, rename the spec to `.mts` or add `"type": "module"` to your
`package.json`. The warning doesn't affect the result.

## 4. Use the component

```ts
import { Component } from "@angular/core";
import { IsofigFigure } from "./isofig/isofig-figure";
import { figure } from "./figures/bucket.figure";
import bucket from "./figures/bucket.model";

@Component({
  selector: "app-limits",
  imports: [IsofigFigure],
  template: `<isofig-figure [figure]="figure" [model]="model" />`,
})
export class Limits {
  protected readonly figure = figure;
  protected readonly model = bucket;
}
```

| Input | Purpose |
|---|---|
| `figure` (required) | The object exported by the generated module. |
| `model` | The model that animates the figure. Without it, the spec's `bind` entries are used. |

The component mounts the runtime with `afterRenderEffect` (browser only, SSR-compatible), remounts it if the
inputs change and stops it on `DestroyRef`.

## 5. The model

Same as in Astro. Type the parameters so Angular's strict mode (`noPropertyAccessFromIndexSignature`) doesn't
complain:

```ts
import type { GroupView, Model } from "isofig/runtime";

const model: Model<State, { refill: number; rate: number }> = {
  init: () => ({ tokens: 8 }),
  step(s, dt, p) {
    s.tokens = Math.min(8, s.tokens + p.refill * dt);
  },
  view(s) {
    const groups: Record<string, GroupView> = {};
    groups["coin-0"] = { o: s.tokens >= 1 ? 1 : 0 };
    return { groups };
  },
};
```

## 6. Security

The component marks the HTML as trusted (`bypassSecurityTrustHtml`) because it comes from the isofig build of a
spec in your repository. **Don't pass it HTML that comes from the user or from an API.** The spec's texts are
escaped when the module is generated.

## 7. Theme

Same as in Astro (the theme is `isofig/theme.css`): override the `--isofig-*` variables in your `styles.css`. Dark mode follows
`prefers-color-scheme` or `data-theme="dark"` on `<html>`.

## Common problems

| Symptom | Cause |
|---|---|
| `TS2322 … readonly … not assignable` | You generated the module with an old version of the CLI. Generate it again. |
| `TS4111 Property 'x' comes from an index signature` in the model | Declare the parameters: `Model<State, { x: number }>`. |
| The figure has no colors | `isofig/theme.css` is missing from `styles` in `angular.json`. |
| It doesn't animate | Check the `model` input and the system's reduced motion setting (it starts paused). |
