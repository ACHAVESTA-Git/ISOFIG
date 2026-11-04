# Color

isofig draws almost everything in grey on purpose: grey is structure, and a single accent (`tone: "lit"`) marks the
subject. Since 0.9 a part can also carry a **paint** (`paint`): a **material** for machines or a **role** for maps. Both
sets come measured: engraved text reads, edges show and two colors of the same set stay apart, also with color
blindness.

## When to use color and when not

- **Paint parts, not the stage.** The base, rails and stands stay `lo` or `mid`. A large painted base glares in the
  dark theme and steals attention from the subject.
- **One accent.** `lit` is still the only strong color: the subject. Roles are more sober than the accent (chroma
  ≤ 0.09 against 0.13) so the eye goes first to what matters. `lit` wins over `paint`.
- **States are not paint.** `ok`, `warn` and `fail` are set by the model while it runs and win over the paint.
  Painting with them gives the `paint-is-state` warning.
- **Six colors at most.** Counting roles, colored materials and the accent; the greys (aluminium, steel, iron, carbon,
  rubber, external) count as one. More than six gives `palette-too-many-colors`.
- **Color never goes alone.** Label the parts and, on a map, draw the legend with `legendOf(spec, lang)`. With color
  blindness the green accent looks like a light grey: in a machine the subject also stands out because it moves.
- **Machines with materials, maps with roles.** Do not mix both sets in one figure: `data` and `brass`, for instance,
  are both golden in the dark theme. If you mix them, `paint-indistinct` tells you.

## How a part is painted

```ts
{ id: "db", kind: "box", at: [0, 0, 6], size: [40, 30, 14], tone: "hi", paint: "data" }
```

The part carries `data-paint="data"` on its `<g>` (or its `<use>`) and takes its color from `--isofig-paint-data`.
Faces are shaded as always (`--ft`, `--f0`…), the edge is tinted with the paint and engraved text uses
`--isofig-paint-data-ink`, the light or dark ink that contrasts with that top face. Without `paint`, the SVG is
identical to 0.8. In a tree (`root`), children inherit the `paint` of their node.

The tokens live in `theme.css` with `light-dark()`, which follows `color-scheme`; the theme sets it on `.isofig` with
the same selectors as the rest of the dark mode. To change a color, redefine the variable:

```css
.isofig { --isofig-paint-data: light-dark(oklch(92% .07 95), oklch(78% .09 92)); }
```

**Your own paints.** A name outside the sets is valid when it is in `palette.use` and your CSS defines
`--isofig-paint-<name>` (and, if you want, `--isofig-paint-<name>-ink`). The part carries both variables inline. isofig
cannot measure their guarantees: measure them with `isofig palette --report` on your brand color.

## Roles (maps)

Categories that must stay apart. Stepped in lightness: with a single L, seven hues collapse under deuteranopia (ΔE of
1 to 2). In the dark theme a dark yellow turns olive, so `data` rises to gold with dark ink.

| Name | | Light | Dark | Ink (light / dark) |
|---|---|---|---|---|
| `client` | client | `oklch(80% .075 250)` #99c2ed | `oklch(43% .085 248)` #25537c | dark / light |
| `edge` | edge | `oklch(69% .075 286)` #9795c8 | `oklch(32% .09 284)` #2f2a5e | dark / light |
| `compute` | compute | `oklch(89% .055 208)` #b1e6ee | `oklch(53% .085 200)` #167a7f | dark / light |
| `data` | data | `oklch(93% .075 92)` #fae7af | `oklch(79% .09 90)` #d1b876 | dark / dark |
| `messaging` | messaging | `oklch(77% .075 348)` #d9a1bd | `oklch(40% .09 354)` #6c314b | dark / light |
| `storage` | storage | `oklch(84% .075 56)` #f1bf9c | `oklch(52% .09 40)` #955640 | dark / light |
| `external` | external | `oklch(63% .012 85)` #8c8981 | `oklch(26% .012 85)` #27241e | dark / light |

## Materials (machines)

Recognized as in a workshop: the greys by their lightness (aluminium, steel, iron, carbon, rubber), copper, brass and
lacquer by their hue, glass by its tint.

| Name | | Light | Dark | Ink (light / dark) |
|---|---|---|---|---|
| `aluminium` | aluminium | `oklch(91% .006 250)` #dee2e5 | `oklch(82% .006 246)` #c1c4c8 | dark / dark |
| `steel` | steel | `oklch(71% .02 245)` #98a3ad | `oklch(58% .024 239)` #6e7d87 | dark / light |
| `iron` | iron | `oklch(50% .012 240)` #5d646a | `oklch(45% .01 246)` #51565b | dark / light |
| `copper` | copper | `oklch(60% .11 50)` #b46b40 | `oklch(56% .097 45)` #a36142 | dark / light |
| `brass` | brass | `oklch(80% .1 88)` #d9ba70 | `oklch(77% .085 90)` #c9b274 | dark / dark |
| `rubber` | rubber | `oklch(23% .006 60)` #1f1c1a | `oklch(22% .005 66)` #1c1a18 | light / light |
| `carbon` | carbon | `oklch(37% .018 260)` #3a4049 | `oklch(33% .026 255)` #2c3643 | dark / light |
| `glass` | glass | `oklch(81% .05 200)` #9bcbce | `oklch(73% .065 195)` #76b5b4 | dark / dark |
| `lacquer` | lacquer | `oklch(52% .16 27)` #b33832 | `oklch(42% .128 29)` #852920 | dark / light |

## Guarantees

They are measured in `src/core/palette` (no dependencies, runs in the browser) and the tests require them, in the
light and the dark theme:

| What | Minimum | How |
|---|---|---|
| Text engraved on the top face | 4.5:1 | WCAG 2 contrast between the chosen ink and the top face (the color lightened 40 %, like `--ft`) |
| Edge against the paper and the card | 3:1 | WCAG 1.4.11: the edge is what draws the silhouette |
| Two paints of the set, typical vision | ΔE 10 | Euclidean distance in OKLab ×100 |
| Two paints of the set, color blind | ΔE 6 | The same, after simulating protanopia, deuteranopia and tritanopia (Machado, Oliveira and Fernandes 2009, severity 1) |
| Each role against the accent | ΔE 10 / 6 | So the subject is never mistaken for a category |

ΔE is measured on the part color (`--c`, the unshaded side face); the top face, lightened 40 %, keeps about 60 % of
that distance. A ΔE of 2 is barely noticeable; from 6 up it reads with labels next to it, and from 10 up, at a glance.
Every pair test is **all against all**, because on a map any role can sit next to any other.

## A brand color: `palette.base`

```ts
palette: { base: "#3b82f6", use: ["client", "compute", "data"] }
```

With `base`, the roles are derived around that color: the theme set turned in hue until the base falls in the gap of
the accent, with the same lightness and chroma for each role. If a guarantee fails with that turn, a deterministic
search shifts hues (up to ±45°), nudges L (up to ±0.06) or swaps the L or the hue of two roles until it holds; same
base, same roles. The variables go in the `style` of the `<figure>`, only for the roles the figure uses, with their
light and dark values in `light-dark()`. Without `base`, the theme ones are used. `use` also sets the legend order.

The base is taken as the accent: as is in the light theme and with the lightness of the theme's dark accent in the
dark one. Materials do not change with the base. A pastel base (L ≥ 0.8) may fail to separate some role from the
accent; the `palette-roles-unmet` warning says so.

## `isofig palette`

```sh
isofig palette --base "#e4572e"                 # the CSS block of the roles, to paste after theme.css
isofig palette --base "#e4572e" --format json   # values, ink, contrast and nearest neighbors
isofig palette --base "#e4572e" --report        # plus the table of guarantees on stderr
```

The table lists, per theme and role: the color, the ink, the text and edge contrast, the nearest paint with its ΔE for
each vision and the distance to the accent; at the bottom, the worst value of each guarantee. Without `--base` it uses
the theme accent. It exits with code 1 if a guarantee does not hold.

## Warnings

| Code | Where | What |
|---|---|---|
| `paint-unknown` | `validateSpec` | The paint is in no set and not in `palette.use` (with a «did you mean…?») |
| `paint-is-state` | `validateSpec` | Painting with `ok`, `warn` or `fail` |
| `palette-base-invalid`, `palette-use-invalid` | `validateSpec` | `base` is not a color; a name in `use` cannot be a variable name |
| `palette-roles-unmet` | drawing | The roles derived from `base` miss a guarantee |
| `palette-too-many-colors` | drawing | More than six colors |
| `paint-indistinct` | drawing | Two paints in use are hard to tell apart, with the vision and theme where it fails |
| `paint-text-contrast` | drawing | A label on a painted face stays under 4.5:1 (usually one on a side face) |

## Legend: `legendOf(spec, lang)`

Returns the paints the figure uses, those in `palette.use` first and in their order:

```ts
legendOf(spec, "en"); // [{ name: "data", kind: "role", label: "data", color: "var(--isofig-paint-data)" }, …]
```
