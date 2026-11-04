# Luxe style

`isofig/themes/luxe.css` is an **optional** style for figures: sober and expensive, like a Swiss watch dial or the brochure
of a racing car. It changes nothing until you turn it on, uses no web fonts or external services, and weighs **1.7 KB**
(minified and gzipped; 10 KB as a file). It has two variants that follow the theme just like the standard one:

| Variant | When | What it is |
|---|---|---|
| **Atelier** | light | Ivory paper, espresso ink, fine graphite edges and a brass accent. |
| **Nocturne** | dark | Deep black lacquer, fine champagne edges and a gold accent. |

Luxe does not cost legibility: the palette guarantees (text ≥ 4.5:1, edges ≥ 3:1, ΔE between paints, color blindness
included) still hold with these colors, and a test checks them (see below).

## Turning it on

Load the sheet **after** `theme.css` and put the `isofig-luxe` class on the figure or on any ancestor:

```astro
---
import "isofig/theme.css";
import "isofig/themes/luxe.css";
---
<body class="isofig-luxe">          <!-- every figure on the page -->
  <Figure spec={spec} />
</body>
```

```html
<figure class="isofig isofig-luxe" data-isofig="…">…</figure>   <!-- this one only -->
```

- **It goes after `theme.css`.** The luxe rules have the same specificity as the theme's and win by order. If the sheet
  loads first it does not apply and the figure looks standard.
- **It follows the theme.** With `prefers-color-scheme: dark` or `data-theme="dark"` on `<html>` you get Nocturne;
  `data-theme="light"` forces Atelier. The class may also sit on `<html>`.
- **The "Enlarge" dialog inherits it**, because it lives inside the figure.
- Without the class the sheet does nothing, and the SVG is the same with or without it: it is only CSS.

## What changes

- **The card:** a faint glow at the top left, a vignette in the corners and a fine inner edge line (background paint and
  inner shadow, so the size does not change). The radius goes up to 22 px.
- **The title** in the system serif (`ui-serif`, `"New York"`, `"Iowan Old Style"`, `Georgia`) with a small accent
  diamond in front; on a narrow card (under 26 rem) it drops a notch and the diamond goes away. The same goes for the
  "Enlarge" dialog and the caption (`figcaption`). The **readout** stays in mono with `tabular-nums` (and slashed zeros).
- **Part edges** in a finer line (0.6 instead of 0.7): graphite in Atelier, champagne in Nocturne.
- **Chips and controls:** pills with a hairline, a focus ring in the accent color and a gold slider thumb, lit from the
  top left, on a hairline rail. The touch target is still 24 px. A long group of options (the "Part" list of a take-apart
  figure) wraps with 20 px corners rather than turning into an oval.
- **Materials**, richer: copper burns, lacquer is wine-colored, steel leans blue, brass is satin. Faces are shaded with a
  warm light and shadow, not grey ones.
- **Forced colors** (`forced-colors`): no shadows or gradients, the hairline becomes a real border.

## Variables

All of them sit in `:where()` (specificity 0), like those of `theme.css`: a rule of yours with one class
(`.isofig { … }`), written **after** `luxe.css`, beats them. The card and control rules have specificity 0,1,0, the same as
`theme.css`.

The theme tokens it redefines (see [theme.md](theme.md) for what each one paints):

| Variable | Atelier (light) | Nocturne (dark) |
|---|---|---|
| `--isofig-paper` | `#f3ecde` | `#0a090b` |
| `--isofig-card` | `#faf7ee` | `#131215` |
| `--isofig-ink`, `--isofig-ink-soft` | `#2a1e18`, `#6a5948` | `#f2e9d6`, `#b8aa90` |
| `--isofig-edge` | `#2f2b27` | `#d8c79b` |
| `--isofig-lo`, `--isofig-mid`, `--isofig-hi` | `#e3d9c3`, `#eee6d3`, `#fffcf2` | `#19181b`, `#222024`, `#2e2b31` |
| `--isofig-accent` | `#ad811f` (brass) | `#e2bc5f` (gold) |
| `--isofig-light`, `--isofig-shade` | `#fffdf6`, `#85755f` | `#58525a`, `#000000` |
| `--isofig-chip`, `--isofig-halo` | `#efe7d5`, `#3a2a1c24` | `#1f1d22`, `#000000b3` |
| `--isofig-ok`, `--isofig-warn`, `--isofig-fail` | `#19966e`, `#f79c40`, `#b71a18` | `#62d0a4`, `#f38835`, `#fc7b6f` |
| `--isofig-ink-on-color`, `--isofig-on-accent` | `#1f150e` | (the same) |
| `--isofig-focus` | the accent | the accent |
| `--isofig-radius` | `22px` | (the same) |

And the ones it adds, which only exist with the style:

| Variable | What it is |
|---|---|
| `--isofig-luxe-serif` | The font stack of the title and the caption. |
| `--isofig-luxe-line` | The hairline: edge of the card, the chips and the controls. |
| `--isofig-luxe-track` | The slider rail. |
| `--isofig-luxe-glow` | The glow at the top left of the card. |
| `--isofig-luxe-sheen` | The one-line highlight on the card's top edge. |
| `--isofig-luxe-vignette` | The darkening of the corners. |

The accent is not the standard theme's green, and that has a consequence: the states (`ok`, `warn`, `fail`) and the gold
materials cannot look like it. That is why luxe moves brass (from bright gold to satin brass), the yellow of `data` in
dark and the orange of `warn`.

### Materials

The engraved-text ink is espresso or ivory, not grey; and the colors change:

| Material | Light | Dark |
|---|---|---|
| `aluminium` | `oklch(91% .008 250)` | `oklch(82% .008 246)` |
| `steel` | `oklch(69% .035 245)` | `oklch(58% .035 240)` |
| `iron` | `oklch(50% .015 245)` | `oklch(45% .012 246)` |
| `copper` | `oklch(53% .12 42)` | `oklch(54% .11 40)` |
| `brass` | `oklch(84% .09 96)` | `oklch(70% .095 93)` |
| `rubber` | `oklch(21% .008 60)` | `oklch(20% .006 66)` |
| `carbon` | `oklch(37% .03 262)` | `oklch(31% .03 255)` |
| `glass` | `oklch(80% .06 205)` | `oklch(73% .07 195)` |
| `lacquer` | `oklch(41% .14 22)` | `oklch(44% .15 24)` |

Of the map roles only `data` changes, in dark (`oklch(90% .045 92)`, light sand): the usual yellow would blur into the
gold accent. The rest stays as in `theme.css`.

## Guarantees

`test/luxe.test.ts` reads `luxe.css`, resolves the cascade with `theme.css` (Atelier holds in both modes; Nocturne
overrides it in dark) and measures with the functions in `src/core/palette`. What it measures today, worst case:

| What | Required minimum | Atelier | Nocturne |
|---|---|---|---|
| Engraved text on the top face (materials / roles) | 4.5:1 | 4.78 / 8.81 | 4.52 / 5.24 |
| Declared ink of every paint on its top face | 4.5:1 | 4.78 | 4.52 |
| Edge against paper and card (materials / roles) | 3:1 | 3.35 / 3.21 | 3.34 / 3.79 |
| ΔE between paints, typical vision (materials / roles) | 10 | 11.7 / 10.1 | 11.1 / 11.8 |
| ΔE between paints, with color blindness (materials / roles) | 6 | 7.1 / 6.5 | 6.6 / 7.0 |
| Every paint against the accent, typical vision | 10 | ≥ 10 | ≥ 10 |
| Ink on the accent, on the top face and on the selected chip | 4.5:1 | 8.78 and 5.07 | 5.85 and 9.89 |
| Ink on `ok`, `warn`, `fail` | 4.5:1 | 6.33 or more | 4.64 or more |
| Accent against `ok`, `warn`, `fail` (typical / color blindness) | 10 / 6 | 15 / 8.5 | 11.9 / 7.7 |
| Ink and soft ink on card, paper and chip | 7:1 and 4.5:1 | 13.8 and 5.4 | 15.5 and 7.3 |
| Accent (focus ring, thumb) against the card and the paper | 3:1 | 3.30 and 3.01 | 10.3 and 11.0 |

The checks are **all against all**, with protanopia, deuteranopia and tritanopia simulated (Machado, Oliveira and
Fernandes 2009), like those of the standard theme. The test also requires every selector in `luxe.css` to start with
`:where(` and forbids `@import`, `url()` and `@font-face`.

## Deriving your own style

`luxe.css` is a recipe, not a special case: any style with the same shape works the same way.

```css
/* my-style.css: load it after theme.css */

/* Light: holds in both modes; dark overrides it */
:where(.my-style .isofig, .isofig.my-style) {
  --isofig-paper: #…;  --isofig-card: #…;  --isofig-ink: #…;  --isofig-ink-soft: #…;
  --isofig-edge: #…;   --isofig-lo: #…;    --isofig-mid: #…;  --isofig-hi: #…;
  --isofig-accent: #…; --isofig-light: #…; --isofig-shade: #…;
  --isofig-chip: #…;   --isofig-halo: #…;  --isofig-ink-on-color: #…; --isofig-on-accent: #…;
  --isofig-ok: #…;     --isofig-warn: #…;  --isofig-fail: #…;
}

/* Dark: both forms the theme understands (system preference and data-theme) */
@media (prefers-color-scheme: dark) {
  :where(:root:not([data-theme="light"]) :is(.my-style .isofig, .isofig.my-style)) { /* … */ }
}
:where(:root[data-theme="dark"] :is(.my-style .isofig, .isofig.my-style)) { /* … */ }

/* What is not a token, with :where() so specificity stays low */
:where(.my-style) .isofig-card { box-shadow: …; }
```

1. **A scope:** a class of yours (like `isofig-luxe`) on the figure or on an ancestor, so the style stays optional.
2. **Tokens in `:where()`**, and the sheet **after** `theme.css`. Define both modes with three rules: light,
   `@media (prefers-color-scheme: dark)` with `:not([data-theme="light"])`, and `[data-theme="dark"]`, as above. If you
   only care about one mode, define one.
3. **Ancestors and the figure itself:** `:where(.my-style .isofig, .isofig.my-style)`. If the class may sit on `<html>`,
   add `:root.my-style:not([data-theme="light"]) .isofig` to the dark rule, as `luxe.css` does.
4. **Do not invent extra colors:** `--isofig-accent` is enough for the subject. A gold accent means dulling the gold
   materials and roles, and a blue one, the blues. If you change the accent, recheck `ok`, `warn` and `fail`.
5. **Your own materials:** `--isofig-paint-<name>` with `light-dark()` and its `--isofig-paint-<name>-ink` (see
   [color.md](color.md)). Choose dark or light ink by the top face: the top face is the color mixed 40 % with
   `--isofig-light`.
6. **Measure it.** In a clone of the repository, copy `test/luxe.test.ts` and change the path and selectors: it reads a
   CSS file, resolves the cascade and measures with `measureSet(set, mode, reserved, theme)` from `src/core/palette`,
   which accepts your theme's colors as the fourth argument (`paper`, `card`, `edge`, `light`, `shade`, `accent`, `ok`,
   `warn`, `fail` and, if you change the inks, `inks`). `isofig palette --report` measures the standard theme and your
   brand's roles, not a style of your own.

Quick checks before measuring: 0.8 rem text on the card needs 4.5:1 (`--isofig-ink-soft`); the focus ring and the edge
need 3:1 against the card **and** the paper (the "Enlarge" dialog uses the paper); and the ink on the accent needs 4.5:1
against the accent's top face (mixed with the light) and against the flat accent (the selected chip).

## The gallery and the screenshots

```sh
npm run gallery        # examples/galeria/index.html
PLAYWRIGHT_PATH=…/node_modules/playwright npm run screenshots   # docs/assets/*.png
```

- `scripts/galeria.mjs` generates **a single HTML file** with every figure in `examples/*/spec.*` (and its model, if there
  is a `model.ts` next to it), with the runtime, the zoom and the turn bundled inline by esbuild; dynamic `import()`s
  stay inside the file as deferred initialisations, so the turn only runs when someone touches a figure. Nested specs
  (`motor-v8`, `motor-cohete`) bring their "Take apart" control and parts list. It works with no server and no network:
  double-click it. It has style (standard or luxe) and theme (light or dark) switches; `?style=std&theme=dark` sets them
  from the URL and `--lang en` generates it in English. The file is in `.gitignore`.
- `scripts/capturas.mjs` takes one PNG per example, style and theme into `docs/assets/`: `<example>-<theme>.png` for the
  standard style and `<example>-luxe-<theme>.png` for luxe. Figures that take apart add `-half` and `-exploded` in luxe and
  dark. Every figure is shot 5 s into its simulation with reduced motion, so two runs give the same image. Playwright is
  not a dependency: pass its path (`ISOFIG_CHROME` picks another Chromium). With `ffmpeg` on the PATH the PNGs are reduced
  to a 256-color palette and weigh half as much.
