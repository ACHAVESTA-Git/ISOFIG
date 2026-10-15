# Changelog

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
