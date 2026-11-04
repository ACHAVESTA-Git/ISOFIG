# Verifying a figure

A figure is done when `isofig check` is clean **and** you have looked at it. The first catches what data can say
wrong; only the second catches what a reader would not believe. Full list of codes:
`node_modules/isofig/docs/en/validate.md`.

## 1. `isofig check`

```sh
npx isofig check figure.ts --model model.ts --presets --strict      # a machine with a model
npx isofig check figure.ts --strict                                 # no model: bind, tracks, an assembly or a map
npx isofig check figure.ts --model model.ts --presets --seconds 20  # a slower figure (12 s by default)
npx isofig check figure.ts --lang es --strict                       # messages (and error:/aviso:/nota: prefixes) in Spanish
```

- `--strict` fails on any warning, never on notes (`info`). Aim for **zero warnings**. Warnings marked ↑ in
  `validate.md` become errors in 1.0, so treat them all as errors from day one.
- With `--model` it runs the model in Node for `--seconds` simulated seconds; with `--presets` it also presses every
  preset after half of them and runs the figure on. `--presets` without `--model` is an error (`presets-need-model`).
- It also prints the weight (budget: 40 KB gzip) and the longest readout.

### What the findings mean and what to do

| Code | Means | Do |
|---|---|---|
| `label-unreadable` | A label under 9 px even enlarged | Raise `size` to the one reported, shorten, or use a `labelPlate` |
| `label-small-mobile` (note) | Small on a phone, fine enlarged | Nothing: that is what "Enlarge" is for |
| `readout-long` | Readout past 70 characters | Shorten it; else `--isofig-readout-lines` |
| `preset-same-view` | The preset changes nothing the reader sees | Change a value that moves something, add `press`, or delete it |
| `preset-no-effect`, `preset-note-missing`, `preset-press-invalid` | A preset with no values, no note, or pressing a non-action | Fix the preset |
| `model-group-unknown` | The model writes a group no part has | Align names (a typo, or a repeat that does not reach that number: `repeat.from`) |
| `group-never-driven`, `group-unused` | A group with hidden parts or an extent that nothing drives or uses | Drive it from the model, or remove it |
| `model-param-unknown`, `param-never-read` | The model reads a parameter the spec lacks; a control nobody reads | Declare it; or drop the control |
| `param-value-off-step`, `param-value-out-of-range` | The slider would show one number, the model use another | Put the start value on its `step` and in range |
| `bind-unknown-param`, `bind-unknown-group`, `bind-no-effect` | A `bind` pointing at nothing | Fix the id; make the bind move something |
| `part-floats` | A part touches nothing | Fix the geometry; `float` only for what hangs or flies |
| `parts-overlap` | Two parts sink more than 0.8 units into each other | Fix it; `mount` only if the fit is intended |
| `paint-order-ambiguous` | Two parts cannot be ordered by their boxes | See the table in `machines.md` |
| `palette-too-many-colors`, `paint-indistinct`, `paint-text-contrast`, `paint-is-state` | Color problems | `color-and-text.md` |
| `weight-over-budget` | Over `budget` KB gzip | Fewer, simpler parts; fewer curved segments |
| `unknown-key` | A field isofig does not know (a typo, or a newer version) | Fix the name |

## 2. Screenshots

Build one preview page and capture it. The script below needs Playwright in the project
(`npm i -D playwright && npx playwright install chromium`); it works from the project root.

```sh
npx isofig build figure.ts --format page --model model.ts --advance 4 -o preview.html
node <this skill's folder>/scripts/capture.mjs preview.html --out shots
```

`--advance 4` opens the page 4 simulated seconds in, because a headless capture does not reliably run the animation.
`--theme dark` builds the page dark, but the script switches light and dark itself, so one page is enough. Pass
`--browser <path>` if your Chromium is somewhere else and `--selector` to capture something other than the first figure.

It writes, in `shots/`:

| File | What it shows |
|---|---|
| `390-light.png`, `390-dark.png` | The card as a phone shows it (device scale 2) |
| `1280-light.png`, `1280-dark.png` | The card on a desktop |
| `390-light-enlarged.png`, `390-dark-enlarged.png` | The dialog the "Enlarge" chip opens, on the same phone |

It exits non-zero if the page logs an error or the chip is missing. For a figure in a running site, give it the URL
instead of the file (`node …/scripts/capture.mjs http://localhost:4321/page --selector "[data-isofig='bucket']"`).

No Playwright? Headless Chrome also works for the plain shots (not the chip):

```sh
chrome --headless --window-size=390,1000 --screenshot=390-light.png file://$PWD/preview.html
```

To see other states, build more pages with `--set id=value` (any control, including an assembly's `explode` and `pick`)
and capture each: every preset's values, the extremes of every slider, assembled and taken apart.

## 3. Look at every image

Read each PNG (the Read tool shows images) and answer, in this order:

1. **Is it instantly a real object?** If you have to read the caption to know what it is, it is too abstract.
2. **Rich at 1280, still reading at 390?** The machine fills 55–65 % of the card; the subject is the first thing the eye
   finds; nothing is a lonely slab.
3. **Does every line end on something, and does every part rest on another?** No part floats, none is sunk in another.
4. **Is every label legible in the enlarged shots?** Not cut by a face, not crossing another part.
5. **Does dark look right?** Edges visible, paint not glaring, the accent still the strongest thing, engraved text
   readable.
6. **Does the readout fit?** At most its reserved lines, the card height not jumping between captures.
7. **Does each preset show its change?** Capture the preset's state and compare it with the default.
8. **Does the motion tell the story?** With `--advance` at two or three values, does the state progress as the model
   says? Under reduced motion, does the settled state make sense?
9. **Assembly:** assembled, halfway and taken apart; each picked part against the rest; no part painted over the one
   that should hide it.
10. **Map:** roles stay apart in dark; the legend lists every color in use; every node name reads enlarged (at 390 px it
    cannot, by design); ribbons arrive by a visible side; packets switch off inside objects. More in `maps.md`.

Fix what you see, run `check` again, capture again. A green check does not fix what the eye does not believe.
