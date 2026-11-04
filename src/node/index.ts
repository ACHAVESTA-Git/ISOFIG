import { gzipSync } from "node:zlib";
import { makeIssue, type Issue } from "../core/issues.ts";

/** Presupuesto de una figura, en KB gzip, cuando la spec no trae `budget`. */
export const DEFAULT_BUDGET_KB = 40;

export interface Measure {
  /** Bytes UTF-8 del HTML. */
  bytes: number;
  /** Bytes del HTML comprimido con gzip al máximo, que es lo que viaja por la red. */
  gzip: number;
}

/**
 * Mide el HTML de una figura (`renderFigure(...).html`). Vive aparte del núcleo porque necesita Node (`node:zlib`) y
 * el núcleo tiene que poder entrar en un bundle de navegador.
 */
export function measure(html: string): Measure {
  return { bytes: Buffer.byteLength(html), gzip: gzipSync(html, { level: 9 }).length };
}

/** El aviso de peso como `Issue` (código `weight-over-budget`): vacío si el gzip cabe en `spec.budget` (o en 40 KB). */
export function budgetIssues(spec: { budget?: number }, measured: Measure, lang = "en"): Issue[] {
  const budget = spec.budget ?? DEFAULT_BUDGET_KB;
  if (measured.gzip <= budget * 1024) return [];
  return [makeIssue(lang, "weight-over-budget", "budget", { kb: (measured.gzip / 1024).toFixed(1), budget })];
}

/** Avisos de peso de una figura como texto: vacío si el gzip cabe en `spec.budget` (o en 40 KB). */
export const checkBudget = (spec: { budget?: number }, measured: Measure, lang = "en"): string[] => budgetIssues(spec, measured, lang).map((i) => i.message);
