# Theme

The theme is a single file, `isofig/theme.css`, and everything you can change is an `--isofig-*` variable. This guide says
what each one controls, how to override it without fighting specificity, and what the card does so the readout does not
jump while the figure runs.

## Overriding a token

Every token sits inside `:where()`, at specificity 0, the dark-theme ones included. A rule of yours with a single class
always wins, whether it loads before or after the theme:

```css
.isofig {
  --isofig-card: var(--surface);
  --isofig-ink: var(--ink);
  --isofig-accent: var(--accent);
  --isofig-on-accent: var(--accent-contrast);
}
```

A value like that holds in light **and** dark, because it beats both sets of the theme. If you need a different one in each
theme, use `light-dark()` (the theme sets `color-scheme` on `.isofig` and switches it with the mode) or two rules:

```css
.isofig { --isofig-accent: light-dark(#0a7d5a, #4fe0b4); }

/* or, without light-dark() */
.isofig { --isofig-accent: #0a7d5a; }
:root[data-theme="dark"] .isofig { --isofig-accent: #4fe0b4; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .isofig { --isofig-accent: #4fe0b4; }
}
```

The dark theme turns on with `prefers-color-scheme: dark` or with `data-theme="dark"` on `<html>`; `data-theme="light"` forces
the light one. Rules on a wrapper (`.my-figure .isofig { … }`, specificity 0,2,0) keep winning, as before.

## What each variable controls

| Variable | What it paints |
|---|---|
| `--isofig-paper` | Background of the "Enlarge" dialog and, in `--format page`, of the page. |
| `--isofig-card` | Background of the card and of the "Enlarge" dialog bar. |
| `--isofig-ink`, `--isofig-ink-soft` | Main text (title, readout) and secondary text (hint, captions). |
| `--isofig-edge` | Edge of the parts and their stroke. |
| `--isofig-lo`, `--isofig-mid`, `--isofig-hi` | The three greys of the parts (`tone`). Faces come from mixing them with `--isofig-light` and `--isofig-shade`. |
| `--isofig-light`, `--isofig-shade` | The light and the dark end each face is shaded toward. |
| `--isofig-accent` | The `lit` part, the slider and the selected choice. |
| `--isofig-on-accent` | **Ink on the accent**: engraved text on a `lit` part and the label of the selected choice. |
| `--isofig-ok`, `--isofig-warn`, `--isofig-fail` | Color of the parts in each state (`data-state`). |
| `--isofig-ink-on-color` | **Ink on a state**: engraved text on an `ok`, `warn` or `fail` part. |
| `--isofig-halo`, `--isofig-chip` | Card shadow; background of chips and controls. |
| `--isofig-focus` | Focus outline (the accent by default). |
| `--isofig-radius`, `--isofig-font`, `--isofig-mono` | Card corners; typeface of the text and of the readout. |
| `--isofig-paint-<name>`, `--isofig-paint-<name>-ink` | Paint and ink of each material or role (see [color.md](color.md)). |
| `--isofig-readout-lines` | Lines the readout reserves (see below). Unset: 2, 3 or 4 depending on the card width. |
| `--isofig-zoom-width` | Width of the drawing in the "Enlarge" dialog (1150 px). |

### Ink on the accent and on states

Engraved text on a part (`.tx`) takes its color from `--fx`, an internal variable each part computes. Do not override it:
change the public variable that applies.

- On a `lit` part use `--isofig-on-accent`. It is the same ink the selected choice wears, which is also accent: if you
  change `--isofig-accent`, change this one with it.
- On a part with `data-state` use `--isofig-ink-on-color`. It does not depend on the accent: the three states share one
  ink. If a part is `lit` and also in a state, the state wins.
- A part with `paint` uses its paint's ink (`--isofig-paint-<name>-ink`), unless it is in a state.

Pick an ink that contrasts at least 4.5:1 with the color under it in both themes (for example, `npx isofig palette
--report` measures the theme's paints).

## Stable readout

In a figure with a model the readout (the text at the bottom right) changes several times a second and can go from one
line to four. If the card changes height with it, everything below jumps. The card avoids three causes:

1. **The height is reserved.** The readout always takes at least `--isofig-readout-lines` lines. Unset, that is 2, and in a
   narrow card 3 (up to 28 rem) or 4 (up to 20 rem), because fewer characters fit per line. With that, a readout of up to
   110 characters never changes the card height at any width; nine out of ten academy figures fit there.
2. **The width does not depend on the text.** The hint (`isofig-hint`) takes what its text measures, 34 % at most, and the
   readout the rest. Neither column changes with the value shown, so the text does not reflow.
3. **Numbers measure the same.** The readout uses the `--isofig-mono` typeface with `tabular-nums`: `9` and `10` do not
   move the rest of the line.

The reservation only applies when the figure has a readout or a model (`data-live`); a figure without a readout leaves no gap.

`isofig check --model` reports the longest readout of the model (`readout-longest`) and warns (`readout-long`) past 70
characters. Shorten it: **70 characters at most** fit in two lines even on a phone. If you cannot, reserve more lines for
that figure:

```css
[data-isofig="alarm-room"] { --isofig-readout-lines: 4; }
```

## Narrow card

The card is a container (`container: isofig-card / inline-size`) and the layout answers to **its** width, not to the
screen's: the same figure looks the same in a narrow desktop column as on a phone. At 40 rem wide or less:

- the readout moves to the top, full width and left-aligned; the hint drops below, smaller. In the DOM the hint stays
  first, so screen readers see no change;
- the slider gives up width before the value would break: "3000 ms" is never cut into two lines.

If you put the figure in a container that shrinks to its content (an `inline-block` or a flex child with no width), give
it a width: a card with contained `inline-size` cannot be sized by what is inside it.

## Classes you can touch

`isofig`, `isofig-card`, `isofig-top`, `isofig-title`, `isofig-art`, `isofig-bottom`, `isofig-hint`, `isofig-readout`,
`isofig-controls`, `isofig-chip`, `isofig-param`, `isofig-value`, `isofig-note`. Change them with two-class selectors
(`.my-figure .isofig-card { … }`) or with the variables above; do not rely on the drawing's internal selectors
(`.isofig-art .lit`, `--fx`, `--ft`…), which may change between versions.
