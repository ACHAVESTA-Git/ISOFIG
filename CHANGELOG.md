# Changelog

## 0.10.2 · 2026-11-04

- isofig is on npm: `npm i isofig`, published by its author. The README, the guides, the Claude Code skill and `SECURITY.md` install from npm again; the CLI keeps running as `npx --no-install isofig`.

## 0.10.1 · 2026-11-04

- Security: the Claude Code skill and the guides no longer run `npm i isofig` or `npx isofig`. That name is not published on npm by this project, so whoever registered it would run code on every plugin user's machine. Installs now come from this repository pinned to a tag (`npm i github:ACHAVESTA-Git/ISOFIG#v0.10.1`) and the CLI runs with `npx --no-install`, which never downloads a package. Added `SECURITY.md`.
- The package now ships `examples/muscle-car` and `examples/sistema-oseo`, which the skill cites; a test checks that every example the skill and the guides cite is in `files`.

## 0.10.0 · 2026-11-04

Feedback from the first outside review: picking a part now flies the camera to it, figures turn a full 360°, nodes
get Unity-style rotation, three teardown bugs are gone, and two demos show isofig beyond software.

### Picking a part
- Picking an entry in the parts list zooms the camera onto it with an animated `viewBox`, paints it in front of everything (even when it sits inside another part) and leaves the rest at 35 % instead of 20 %; "All" returns to the full frame. The frame follows the part when the teardown moves or the figure turns, and nothing outside it spills over the controls.
- Fixed: dimmed parts never got their color back, so every pick left the figure more see-through.
- Fixed: turning a taken-apart figure showed it assembled while dragging; the runtime now applies the current pose in the same frame the orbit redraws.
- The runtime grows from 3.6 to 4.3 KB gzipped (with the arrow keys of the 360° turn); its budget moves from 4096 to 4608 B.

### Three axes per node
- Nodes take `rotate: [x, y, z]` in degrees, turning around their own `at` (extrinsic x, then y, then z; z is vertical) and carrying their parts and children, like a Unity `Transform`.
- `explode` is in the parent's space, so a part leaves along its turned parent's axis.
- Boxes and prisms are drawn truly turned, labels stay glued to their face, and figures without `rotate` render byte for byte as before. New findings `rotate-radians` and `label-faces-away`.

### A full 360° turn
- Orbit turns a full circle by default (`range` still limits it); arrow keys turn 15° and change elevation 5° with the drawing focused; releasing the drag keeps turning with inertia and brakes, with no inertia under reduced motion.
- The camera scale shrinks just enough to fit the whole teardown from any angle and never exceeds the initial one.
- Details engraved on faces that look away are no longer drawn; lid labels seen from behind turn to read upright.

### New solids
- `sphere` (`at` is the center, `r`) and `capsule` (a cylinder with a half sphere at each end: `at`, `r`, `h`, `axis`; `h: 0` is a sphere), drawn as a circle and a stadium with six tone layers, same light and edge as other solids.
- `paint`, `tone`, states, `explode`, `repeat`, orbit and `reorder` work unchanged; `shadow` gives a round halo and the frame fits the exact circle.
- Paint order and audit use the exact silhouette and a separating-plane test for round parts, so parallel tilted capsules no longer report false collisions.

### Faster turning
- Each teardown pose reuses the rest pose's paint-order decisions for parts that moved together, and the ready list is kept instead of rescanned: `drawScene` runs about twice as fast with byte-identical output (V8 36 → 19 ms, skeleton 76 → 37 ms in Node; in Chrome the V8 turns at ~40 fps instead of ~24).
- While the camera moves the scene is drawn as a draft and only the shown pose's paint order is computed; it redraws in full when it stops. Chrome while dragging, from 0.9.1 to 0.10.0: V8 42 → 17 ms per frame (24 → 58 fps), skeleton 92 → 28 ms.
- Budgets: orbit 10.5 KB, core 44 KB.

### Validation
- `check` accepts `"{key}"` placeholders in the numbers of `defs`, as the nesting guide already showed; a `with` that fills one with text is reported on the template.

### Examples
- `examples/muscle-car`: a Camaro-style muscle car (13 parts, 9-step teardown) made only of boxes, cylinders, cones and prisms, in plain JSON; a schematic, no logos.
- `examples/sistema-oseo`: an adult human skeleton in anatomical position, arms hanging 7° from the shoulder and feet toeing out 10° with `rotate`, that comes apart bone by bone in seven steps, built from spheres, capsules and prisms (24 ribs, 24 vertebrae with 23 discs, 27-bone hands, 26-bone feet), with 12 pickable parts and short, checked notes in Spanish and English.

## 0.9.1 · 2026-11-04

- `npm i github:ACHAVESTA-Git/ISOFIG` builds the package: a `prepare` script compiles `dist/` when npm installs it from git (npm does not run `prepack` there).

## 0.9.0 · 2026-11-04

The upgrade before going public: nested JSON with teardown, maps made of real objects, color with guarantees, an
optional luxe style and a Claude Code plugin.

### Nested specs and teardown
- Nested specs: `root`/`defs` with local coordinates, subtree `repeat`, `use` from `defs` (with `{key}` templates) or a catalog (`isofig/kit` by default), and `on`/`mount` resolved from the node upwards; `assemble()` flattens them, and `renderFigure`, `drawScene`, `validateSpec` and the CLI take them as is.
- Declarative teardown: any node with `explode` gives the figure a stepped "Take apart" control, a parts list that fades the rest, and a readout per step; stages run outside-in or by `stage`.
- `bind`: several binds on one group add up, each with its own `win`dow; `keep` fades groups by choice; binds also apply on top of a model. Params take `texts` per value.
- Paint order is also computed per teardown pose (`reorder`, diffs only), and the runtime reorders the DOM at each threshold.
- New solids: `prism` with `axis: "x" | "y"`, `cylinder` with a vector axis, and `cone`.
- Examples: a racing V8 (215 parts) and a liquid-fuel rocket engine, in plain JSON.

### Maps, flows and UML
- Added `map` for topologies, flow maps and UML: 17 real objects (phone, rack, database as a stack of disks, queue as a conveyor, class as a filing cabinet with drawers…), nested containers, `flow`/`layers`/`grid` layouts, orthogonal ribbons, UML ends and multiplicities, animated packets, a legend and labels sized to read enlarged. Compiled by `isofig/map`; `renderFigure` takes `resolveMap` and `<Figure>` and the CLI pass it.
- Added `tracks`: groups that travel along a polyline with no model (`group`, `path`, `period`, `delay`, `loop`, `hide`).
- Added `isofig import mermaid` (flowchart and classDiagram); `isofig import compose` now builds a map with the same compiler.
- Added `ground` parts. Examples: an online shop topology, an order flow map and a shop's domain in UML.

### Color and style
- `paint` on parts and nodes: a role (`client`, `edge`, `compute`, `data`, `messaging`, `storage`, `external`) or a material (`aluminium`, `steel`, `iron`, `copper`, `brass`, `rubber`, `carbon`, `glass`, `lacquer`), in OKLCH with light and dark values; states and `lit` still win, and figures without `paint` render byte for byte as before.
- Measured guarantees in `src/core/palette` (OKLab, WCAG contrast, Machado color-blindness simulation, no dependencies): engraved text ≥ 4.5:1, edges ≥ 3:1, ΔE ≥ 10 (≥ 6 color blind) between any two paints of a set, in both themes.
- `palette: { base, use }` derives the roles from a brand color; `isofig palette --base <color> [--format css|json] [--report]`; `legendOf(spec, lang)`.
- Added `isofig/themes/luxe.css`, an optional luxe style (Atelier light, Nocturne dark) switched on with the `isofig-luxe` class; 1.7 KB gzipped, no web fonts, same guarantees.
- Theme tokens, dark variants and `--isofig-paint-*` sit in `:where()`: a project's `.isofig { … }` wins in any load order. Engraved text uses `--isofig-on-accent` and `--isofig-ink-on-color`; overriding `--fx` is no longer needed.
- The card is a size container; the readout reserves `--isofig-readout-lines`, so the card no longer jumps while the figure runs.

### Runtime
- Presets take `press` (action ids pressed after the values). Models get `ctx.pressed(id)`, `ctx.changed(id)` and `ctx.say(text)`, which announces once with the 0.7/0.8.3 rules; `view.say` still works.
- `motion.settle`: with reduced motion, seconds simulated at once on mount and after every control or preset. The runtime follows live changes of `prefers-reduced-motion`.
- "Enlarge" chip: `zoomOnDemand(() => import("isofig/zoom"))` opens the live SVG in a focus-trapped dialog at ≥ 1150 px, where labels read at ≥ 11 px on a phone. `isofig/zoom` is 0.8 KB gzip; `renderFigure(spec, { zoom: false })` removes it.
- `unmountAll` clears `data-isofig-live`, so `transition:persist` figures mount again; `mountAll` releases figures that left the page.
- `isofig/orbit` takes the assembled spec (`assemble(spec)`) and keeps instance ids; it is 8.6 KB gzip and no longer ships the palette tables.

### Validation
- `validateSpec(spec, { lang })`: errors and warnings with stable codes, a JSON `path` and English or Spanish messages, for parts, controls, trees, maps, tracks and colors. `renderFigure` calls it, no longer throws on a broken spec, and returns `Rendered.issues`.
- `isofig check <spec> --model <model> --presets` runs the model and every preset and reports groups, presets and parameters that do nothing.
- The audit warns about labels under 9 px even in the enlarged view and notes those small on a phone.
- `repeat.from`: first value of `{i}`.
- Warnings that become errors in 1.0 are marked ↑ in the docs.

### Astro, kit and package
- `<Figure>` takes `orbit`, `load="visible|idle|eager"`, `instance`, `overrides`, `zoom` and `theme`; it loads the runtime, model and orbit with `import()` when the reader gets close, works with `transition:persist`, and inlines the theme CSS once per page, only where a figure is drawn. `isofig/astro/client` registers lazy models with `models()`.
- `RenderOptions.instance` changes DOM ids and radio names so the same figure can appear several times on a page. `applyOverrides(spec, overrides)` validates and merges values, presets, hidden controls and texts.
- Added `isofig/kit`: `bench`, `plinth`, `labelPlate`, `ruler`, `screws`, `pool` and `groupsOf`, plus a `catalog` so JSON can say `"use": "bench"`.
- The core no longer imports `node:zlib` or `Buffer`: `measure(html)` and `checkBudget` live in `isofig/node`. `./angular` is no longer exported (`isofig add angular <dir>`). Published examples import from the package name.
- `package.json`: `prepack`, `prepublishOnly`, `keywords`, `sideEffects`, `repository`, `homepage`, `bugs`; `CHANGELOG.md` and the examples are published.

### Claude Code plugin
- Packaged as a Claude Code plugin: `claude plugin marketplace add ACHAVESTA-Git/ISOFIG`, then `claude plugin install isofig@isofig`. The skill moved from `skill/` to `skills/isofig/`.
- One rewritten skill: when (and when not) to use isofig, machines, assemblies, maps, color and text rules measured by `check`, models with `ctx.say`/`pressed`/`settle`, and a mandatory check-and-look loop with a capture script.

### CLI, tests and CI
- Unknown commands, `--format` values and malformed `--set` fail before reading the spec (exit 1, with help); `--version`; help and prefixes follow `--lang`; the `stripTypeScriptTypes` warning is silenced; the page bundler handles `export async function`, `export *` and `export … from`.
- `npm run size` with `size-budget.json`; CI on Node 22.18, 24 and 26 with a packed-package test and Astro 5 and 7 builds; happy-dom runtime tests; per-example SVG snapshots (`UPDATE_SNAPSHOTS=1 npm test`).
- `npm run gallery` (every example in one offline HTML) and `npm run screenshots`.

## 0.8.3 · 2026-10-15

- `say`: at most two announcements per reader interaction; then the model stays quiet until the reader touches the figure again (models that name a changing id no longer talk forever).
- Orbit: a press released before the module loads no longer grabs the figure, a mouse moving with no button pressed releases it, and the turn buttons get `aria-disabled` at the limits.

## 0.8.2 · 2026-10-15

- `repeat` also replaces `{i}` in `mount`.
- Labels take `align: "start" | "middle" | "end"`.
- `--set id=value` (repeatable) starts a control at another value in the preview.

## 0.8.1 · 2026-10-15

- On mount the runtime reads the current value of every control, so a reader who moved one before a lazy mount keeps it.

## 0.8.0 · 2026-10-15

- Orbit: `isofig/orbit` lets the reader drag a figure (or use the turn buttons) to see it from another angle. The scene is redrawn in the browser with its own projection, shading and paint order, and the runtime keeps animating it (`retarget`).
- `orbitOnDemand(el, load)` in the runtime loads the orbit only when needed: prefetch on hover or focus, enable on press. The orbit module is 5.7 KB gzip plus the spec; reading the page costs nothing extra.
- `renderFigure(spec, { orbit: true })` adds the turn buttons and the drag hint; `drawScene` is the browser-safe part of the core.
- `--format page --orbit` previews it.

## 0.7.0 · 2026-10-15

- Accessibility, from an audit of 37 lessons: `say` stays quiet until the reader touches the figure, waits for 1.5 s of silence and never talks over a preset note; changing a control announces the readout once.
- With reduced motion a preset shows its effect at once (8 s already simulated) instead of waiting for Play.
- Engraved text on accent or state faces uses `--isofig-ink-on-color`; the checked choice uses `--isofig-on-accent`; the focus ring uses `--isofig-focus`.
- The visible title is `aria-hidden` (the SVG `<title>` already names the figure); the preset note is always in the accessibility tree.

## 0.6.1 · 2026-10-15

- Faces at the same depth keep a stable order and coordinates drop float noise before rounding, so identical parts always produce identical markup (and share one `<use>`).

## 0.6.0 · 2026-10-15

- Identical parts are drawn once in `<defs>` and repeated with `<use>`; figures of the academy dropped from 10–22 KB to 7–10 KB gzip.
- Shades and edge colour are CSS variables set on each part (`--ft`, `--f0…--f3`, `--fe`), so they reach `<use>` copies; the state colour is `--sc`.
- `--format page` wraps every bundled file in its own scope, so two files can declare the same name.

## 0.5.0 · 2026-10-15

- Path coordinates are written in half pixels instead of tenths: figures are ~20 % lighter (gzip) with no visible change at 1× or 2×.

## 0.4.1 · 2026-10-15

- `hidden` on a param keeps its value for the model and skips its control.
- The preview bundles `export { x as default }`.

## 0.4.0 · 2026-10-15

- `kind: "action"`: a button the model counts, for one-off events such as deleting a pod.
- The runtime paints the first frame on mount, even before the IntersectionObserver reports.

## 0.3.0 · 2026-10-15

- `--format page` bundles the model's local imports, so a model that shares measures with its spec previews.
- `--advance <s>` (and `data-isofig-advance`) opens a figure already simulated, for headless screenshots.
- Paint-order cycle warnings name the parts involved.
- Docs: `label` parts and the compose importer in the spec reference.

## 0.2.0 · 2026-10-15

- Presets: buttons that set several params at once with a note for the reader (the "break it on purpose" path).
- Discrete controls: `kind: "toggle"` (a switch) and `kind: "choice"` (chips), besides the slider.
- State tones: a model can paint a group `ok`, `warn` or `fail` (`--isofig-ok/warn/fail`).
- `say`: one-off announcements for screen readers when something happens.

## 0.1.0 · 2026-10-15

- Core: isometric camera, prisms and cylinders with bevels, four-tone shading, topological paint order, compact SVG.
- Runtime (1.7 KB gzip): eased groups (translate, spin, opacity), models, reduced motion, pause, offscreen stop.
- Adapters: Astro component and a standalone Angular 19+ component (`isofig add angular`).
- CLI: `build` (html, module, json, page) and `check` with a weight budget and a box audit.
- Labels engraved on faces; `isofig import compose` turns `docker compose config --format json` into a figure.
- Accessibility: readout is not a live region, pause button without aria-pressed, locale-formatted values with a spoken unit, controls appear only with JavaScript.
- Example: token bucket rate limiter. Guides in English and Spanish. Claude Code skill.
