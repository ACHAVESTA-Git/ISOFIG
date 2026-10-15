# isofig

**Explain a technical idea as a small, crafted machine you can play with.**
Isometric SVG generated at build time, a 1.7 KB runtime, Astro and Angular adapters, and a Claude Code skill
that writes the figure for you.

[Español](README.es.md) · [Astro guide](docs/en/astro.md) · [Angular guide](docs/en/angular.md) ·
[Spec reference](docs/en/spec.md) · [Credits](NOTICE.md)

![A token bucket rate limiter drawn as a coin tube, a dispenser and carts on a rail with a gate](docs/assets/token-bucket-light.png)

<sub>`examples/token-bucket`: 40 parts, **13 KB gzip** for the whole figure. Carts that find a coin pass the gate;
the rest go to the reject tray.</sub>

## Why

A diagram with boxes and arrows says *what* a system has. A machine shows *how it works*: you watch the tube run
out of coins, you push the traffic slider and the gate starts rejecting. isofig makes those machines cheap enough
to put on every page of a course or a docs site.

| | |
|---|---|
| **Figures are data** | A typed spec (or JSON) with parts, moving groups and controls. No drawing code. |
| **Light** | SVG is built ahead of time. Relative coordinates in tenths, one path per tone, dots as zero-length strokes. Default budget: 40 KB gzip per figure, enforced by `isofig check`. |
| **Calm, honest motion** | Groups move by `transform`, never by redrawing. A pure model drives the readout and the motion from the same numbers. |
| **Accessible by default** | Pause button, native range inputs with `aria-valuetext`, `prefers-reduced-motion` starts paused, nothing runs offscreen. |
| **Themeable** | Every colour is a `--isofig-*` CSS variable. Light and dark included. |
| **Audited** | Build warns about floating parts, parts sunk into each other, ambiguous paint order and weight. |

## Quick start (Astro)

```sh
npm i isofig
```

```astro
---
import Figure from "isofig/astro";
import bucket from "../figures/bucket";
---
<Figure spec={bucket} lang="en" n={1} />
```

Full guide: [docs/en/astro.md](docs/en/astro.md).

## Quick start (Angular 19+)

```sh
npm i isofig
npx isofig add angular src/app/isofig
npx isofig build figures/bucket.ts --format module -o src/app/figures/bucket.figure.ts
```

```ts
@Component({
  imports: [IsofigFigure],
  template: `<isofig-figure [figure]="figure" [model]="model" />`,
})
```

Full guide: [docs/en/angular.md](docs/en/angular.md).

## With Claude Code

Copy `skill/` to `~/.claude/skills/isofig` (or `.claude/skills/isofig` in a project) and ask:

```text
/isofig explain how a circuit breaker works, interactive, for our Astro docs
```

The skill invents the machine, writes the spec and the model, runs `isofig check`, looks at screenshots in both
themes and iterates.

## CLI

```text
isofig build <spec> [-o file] [--format html|module|json|page] [--lang en] [--n 1] [--model file]
isofig check <spec> [--lang en] [--strict]
isofig add angular <dir>
```

## Limits

- Solids are prisms and cylinders (convex plans). No pipes, lathe bodies, shaders or true 3D in v0.1.
- Paint order is solved at rest; moving parts should travel where they don't pass behind something else.
- It draws machines and instruments, not charts, people or maps.

## Credits

Inspired by [anatomy](https://github.com/wheresryan22/anatomy) by @wheresryan22 (MIT). See [NOTICE.md](NOTICE.md).

## License

[MIT](LICENSE)
