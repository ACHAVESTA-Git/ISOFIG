export { renderFigure, type Rendered, type RenderOptions, type RuntimeData } from "./render.ts";
export { textOf } from "./spec.ts";
export { validateSpec, type ValidateOptions } from "./validate.ts";
export { formatIssue, ISSUE_SEVERITIES, type Issue, type IssueCode, type Severity } from "./issues.ts";
export { LABEL_MIN_PX, LABEL_WIDTHS, type LabelOptions } from "./audit.ts";
export { checkModel, type CheckModelOptions } from "./check.ts";
export { applyOverrides, OverridesError, type FigureOverrides, type OverridesOptions } from "./overrides.ts";
export { fromCompose, type ComposeFile } from "./importers/compose.ts";
export { assemble, assembleTree, type Assembled, type AssembleOptions, type Catalog, type CatalogResult, type TreeProblem } from "./tree.ts";
export type * from "./spec.ts";
export { makeCamera, fitCamera, project, depthOf } from "./camera.ts";
export { legendOf, derivePalette, ROLES, MATERIALS, LIMITS, type LegendEntry, type DerivedPalette, type PaintDef } from "./palette/index.ts";

import type { FigureSpec } from "./spec.ts";

/** Identidad con tipos: ayuda al editor a autocompletar una spec. */
export const defineFigure = (spec: FigureSpec): FigureSpec => spec;
