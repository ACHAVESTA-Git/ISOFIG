import type { Entry } from "../issues.ts";

const VISION = {
  en: { normal: "typical vision", protan: "protanopia", deutan: "deuteranopia", tritan: "tritanopia" },
  es: { normal: "visión típica", protan: "protanopía", deutan: "deuteranopía", tritan: "tritanopía" },
} as const;
const THEME = { en: { light: "light", dark: "dark" }, es: { light: "claro", dark: "oscuro" } } as const;

const vision = (l: "en" | "es", v: unknown) => VISION[l][v as keyof typeof VISION.en] ?? String(v);
const theme = (l: "en" | "es", v: unknown) => THEME[l][v as keyof typeof THEME.en] ?? String(v);

/** Los avisos de color: `issues.ts` los suma a su catálogo. Los emiten `validatePalette` y `paletteIssues`. */
export const PALETTE_MESSAGES = {
  "paint-unknown": {
    severity: "warning",
    en: (v, q) =>
      `${q(v.id)} is painted ${q(v.paint)}, which is neither a role nor a material${v.suggest ? `; did you mean ${q(v.suggest)}?` : "."} ` +
      `If your CSS defines --isofig-paint-${v.paint}, list it in palette.use.`,
    es: (v, q) =>
      `${q(v.id)} pinta con ${q(v.paint)}, que no es un rol ni un material${v.suggest ? `; ¿querías ${q(v.suggest)}?` : "."} ` +
      `Si tu CSS define --isofig-paint-${v.paint}, ponlo en palette.use.`,
  },
  "paint-is-state": {
    severity: "warning",
    en: (v, q) => `${q(v.id)} is painted with the state color ${q(v.paint)}: states are set by the model while it runs; use a role or a material.`,
    es: (v, q) => `${q(v.id)} pinta con el color de estado ${q(v.paint)}: los estados los pone el modelo mientras corre; usa un rol o un material.`,
  },
  "palette-base-invalid": {
    severity: "warning",
    en: (v) => `palette.base must be a color (#rrggbb or oklch(L C h)), got ${v.got}: the theme roles are used.`,
    es: (v) => `palette.base debe ser un color (#rrggbb u oklch(L C h)); llegó ${v.got}: se usan los roles del tema.`,
  },
  "palette-use-invalid": {
    severity: "warning",
    en: (v) => `palette.use: ${v.got} is not a paint name (lowercase letters, digits and hyphens).`,
    es: (v) => `palette.use: ${v.got} no es un nombre de pintura (minúsculas, dígitos y guiones).`,
  },
  "palette-roles-unmet": {
    severity: "warning",
    en: (v) => `The roles derived from palette.base ${v.base} miss ${v.count} guarantee(s): ${v.list}. Run isofig palette --base "${v.base}" --report.`,
    es: (v) => `Los roles derivados de palette.base ${v.base} no cumplen ${v.count} garantía(s): ${v.list}. Corre isofig palette --base "${v.base}" --report.`,
  },
  "palette-too-many-colors": {
    severity: "warning",
    en: (v) => `The figure uses ${v.count} colors (${v.list}): more than ${v.max} do not read at a glance. Merge roles or leave parts grey.`,
    es: (v) => `La figura usa ${v.count} colores (${v.list}): más de ${v.max} no se leen de un vistazo. Agrupa roles o deja piezas en gris.`,
  },
  "paint-indistinct": {
    severity: "warning",
    en: (v, q) => `${q(v.a)} and ${q(v.b)} are hard to tell apart with ${vision("en", v.vision)} in the ${theme("en", v.theme)} theme (ΔE ${v.value}; ${v.min} or more).`,
    es: (v, q) => `${q(v.a)} y ${q(v.b)} no se distinguen bien con ${vision("es", v.vision)} en el tema ${theme("es", v.theme)} (ΔE ${v.value}; mínimo ${v.min}).`,
  },
  "paint-text-contrast": {
    severity: "warning",
    en: (v, q) => `The label ${q(v.id)} on ${q(v.on)} (${v.paint}) has a contrast of ${v.value}:1 in the ${theme("en", v.theme)} theme (${v.min}:1 or more): engrave it on the top face.`,
    es: (v, q) => `El rótulo ${q(v.id)} sobre ${q(v.on)} (${v.paint}) tiene contraste ${v.value}:1 en el tema ${theme("es", v.theme)} (mínimo ${v.min}:1): grábalo en la tapa.`,
  },
} as const satisfies Record<string, Entry>;
