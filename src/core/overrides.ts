import { formatIssue, makeIssue, type Issue } from "./issues.ts";
import type { FigureSpec, PresetSpec, Text } from "./spec.ts";
import { validateSpec } from "./validate.ts";
import { closest, isObj, listOf } from "./validate-shared.ts";

/** Lo que un sitio cambia de una figura sin tocar su spec: valores iniciales, desvíos, controles y textos. */
export interface FigureOverrides {
  /** Valor inicial de cada parámetro, por id. */
  values?: Record<string, number>;
  /** Sustituye por completo los desvíos (`presets`) de la spec. */
  presets?: PresetSpec[];
  /** Ids de parámetros cuyo control no se muestra (el modelo los sigue recibiendo). */
  hide?: string[];
  title?: Text;
  caption?: Text;
}

export interface OverridesOptions {
  /** Idioma de los mensajes: `en` (por defecto) o `es`, como en `validateSpec`. */
  lang?: string;
}

/** Lo que lanza `applyOverrides`: el mensaje junta todos los problemas y `issues` los trae con su código y su `path`. */
export class OverridesError extends Error {
  issues: Issue[];
  constructor(figure: string, issues: Issue[]) {
    super(`applyOverrides «${figure}»:\n  - ${issues.map(formatIssue).join("\n  - ")}`);
    this.name = "OverridesError";
    this.issues = issues;
  }
}

/**
 * Devuelve una copia de la spec con los cambios aplicados, o la misma spec si no hay nada que aplicar. Es pura: no
 * toca la original. Lo que se cambia se revisa con `validateSpec` (mismos códigos y mensajes, en y es): un valor fuera
 * de rango o de paso, un desvío sin `label` o que fija un parámetro que no existe. Se añaden dos códigos propios, para
 * lo que `validateSpec` no puede ver: un id que no es un parámetro y un valor inicial para una acción. Si algo no
 * encaja lanza un `OverridesError` con todos los problemas.
 */
export function applyOverrides(spec: FigureSpec, overrides: FigureOverrides = {}, options: OverridesOptions = {}): FigureSpec {
  const lang = options.lang ?? "en";
  const params = spec.params ?? [];
  const at = new Map(params.map((p, i) => [p.id, i]));
  const ids = [...at.keys()];
  const own: Issue[] = [];
  const unknown = (where: string, path: string, param: string) =>
    own.push(makeIssue(lang, "override-unknown-param", path, { where, param, suggest: closest(param, ids) ?? "", known: listOf(ids) }));

  // Cada valor nuevo se pone en su parámetro; los que no pueden aplicarse se dicen aquí y no pasan a la revisión.
  const values = new Map<number, number>();
  for (const [id, value] of Object.entries(overrides.values ?? {})) {
    const i = at.get(id);
    if (i === undefined) unknown("overrides.values", `values.${id}`, id);
    else if (params[i].kind === "action") own.push(makeIssue(lang, "override-action-value", `values.${id}`, { param: id }));
    else values.set(i, value);
  }
  const hide = new Set<number>();
  (overrides.hide ?? []).forEach((id, k) => {
    const i = at.get(id);
    if (i === undefined) unknown("overrides.hide", `hide[${k}]`, id);
    else hide.add(i);
  });

  const next: FigureSpec = { ...spec };
  if (values.size || hide.size) {
    next.params = params.map((p, i) => ({ ...p, ...(values.has(i) ? { value: values.get(i)! } : {}), ...(hide.has(i) ? { hidden: true } : {}) }));
  }
  if (overrides.presets) next.presets = overrides.presets.map((p) => (isObj(p) && isObj(p.values) ? { ...p, values: { ...p.values } } : p));
  if (overrides.title !== undefined) next.title = overrides.title;
  if (overrides.caption !== undefined) next.caption = overrides.caption;

  // Solo se miran los campos que este cambio tocó: lo que ya estuviera mal en la spec es asunto de `validateSpec`.
  const changed = new Map([...values.keys()].map((i) => [`params[${i}].value`, `values.${params[i].id}`]));
  const found =
    changed.size || overrides.presets
      ? validateSpec(next, { lang })
          .filter((i) => i.severity !== "info" && (changed.has(i.path) || (overrides.presets && /^presets(\[|$)/.test(i.path))))
          .map((i) => ({ ...i, path: changed.get(i.path) ?? i.path }))
      : [];
  const issues = [...own, ...found];
  if (issues.length) throw new OverridesError(spec.id, issues);

  const touched = values.size || hide.size || overrides.presets || overrides.title !== undefined || overrides.caption !== undefined;
  return touched ? next : spec;
}
