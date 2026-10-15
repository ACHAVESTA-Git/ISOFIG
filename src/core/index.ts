export { renderFigure, type Rendered, type RenderOptions, type RuntimeData } from "./render.ts";
export { textOf } from "./spec.ts";
export type * from "./spec.ts";
export { makeCamera, fitCamera, project, depthOf } from "./camera.ts";

import type { FigureSpec } from "./spec.ts";

/** Identidad con tipos: ayuda al editor a autocompletar una spec. */
export const defineFigure = (spec: FigureSpec): FigureSpec => spec;
