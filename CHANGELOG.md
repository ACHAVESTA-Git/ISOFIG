# Changelog

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
