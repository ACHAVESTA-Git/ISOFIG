import { hexOf, oklchText, VISIONS, type Lch } from "./color.ts";
import type { DerivedPalette } from "./derive.ts";
import { LIMITS, inkFor, lin, worstOf, type SetMeasure } from "./guarantees.ts";
import { PAINTS } from "./sets.ts";
import { EDGE_MIX, INKS, MODES, type Mode } from "./theme.ts";

export interface PaintTokens {
  name: string;
  lch: Record<Mode, Lch>;
}

const both = (light: string, dark: string) => (light === dark ? light : `light-dark(${light}, ${dark})`);

/** Las dos variables de una pintura: su color y la tinta de su texto, cada una con su valor claro y oscuro. */
export function tokensOf(p: PaintTokens): [string, string][] {
  const ink = (m: Mode) => INKS[inkFor(lin(p.lch[m]), m).ink];
  return [
    [`--isofig-paint-${p.name}`, both(oklchText(p.lch.light), oklchText(p.lch.dark))],
    [`--isofig-paint-${p.name}-ink`, both(ink("light"), ink("dark"))],
  ];
}

/** El bloque de `theme.css`: tokens, `color-scheme` (del que depende `light-dark()`) y una regla por pintura. */
export function themeBlock(paints: PaintTokens[] = PAINTS): string {
  const tokens = paints.flatMap(tokensOf).map(([k, v]) => `  ${k}: ${v};`).join("\n");
  const rules = paints
    .map((p) => `.isofig-art [data-paint="${p.name}"] { --pc: var(--isofig-paint-${p.name}); --pi: var(--isofig-paint-${p.name}-ink); }`)
    .join("\n");
  return `/*
 * Pinturas (\`paint\`): materiales para máquinas y roles para mapas, en OKLCH, cada una con la tinta de su texto
 * grabado. Salen de src/core/palette; \`isofig palette --report\` mide sus garantías. light-dark() sigue a
 * color-scheme, que aquí acompaña al tema. El canto se tiñe con la pintura; un estado del modelo gana sobre ella.
 * Como los demás tokens, van en :where(): un \`.isofig { --isofig-paint-steel: … }\` o un \`color-scheme\` tuyo gana siempre.
 */
:where(.isofig) {
  color-scheme: light;
${tokens}
}
@media (prefers-color-scheme: dark) {
  :where(:root:not([data-theme="light"]) .isofig) { color-scheme: dark; }
}
:where(:root[data-theme="dark"] .isofig) { color-scheme: dark; }
.isofig-art [data-paint] {
  --c: var(--sc, var(--pc));
  --fe: color-mix(in oklab, var(--c), var(--isofig-edge) ${EDGE_MIX * 100}%);
}
.isofig-art [data-paint]:not([data-state]) { --fx: var(--pi); }
${rules}
`;
}

const rolesAsTokens = (d: DerivedPalette, names?: string[]): PaintTokens[] =>
  d.roles.light
    .map((r, i) => ({ name: r.name, lch: { light: r.lch, dark: d.roles.dark[i].lch } }))
    .filter((r) => !names || names.includes(r.name));

/** Las variables de los roles derivados, para el `style` del `<figure>`. */
export function figureStyle(d: DerivedPalette, names?: string[]): string {
  return rolesAsTokens(d, names)
    .flatMap(tokensOf)
    .map(([k, v]) => `${k}:${v.replaceAll(", ", ",")}`)
    .join(";");
}

/** Lo que imprime `isofig palette --format css`: un bloque para pegar después de `theme.css`. */
export function paletteCss(d: DerivedPalette): string {
  const tokens = rolesAsTokens(d).flatMap(tokensOf).map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return `/* isofig palette --base ${d.base}${d.ok ? "" : " (no cumple todas las garantías)"} */\n.isofig {\n${tokens}\n}\n`;
}

export function paletteJson(d: DerivedPalette) {
  const side = (mode: Mode) =>
    Object.fromEntries(
      d.roles[mode].map((r) => {
        const c = lin(r.lch);
        const m = d.measures[mode].paints.find((p) => p.name === r.name)!;
        return [r.name, { oklch: oklchText(r.lch), hex: hexOf(c), ink: INKS[m.ink], text: fix(m.text), edge: fix(m.edge), nearest: m.nearest }];
      }),
    );
  return { base: d.base, ok: d.ok, limits: LIMITS, light: side("light"), dark: side("dark") };
}

const fix = (v: number) => Math.round(v * 100) / 100;
const f1 = (v: number) => v.toFixed(1);

/** La tabla de `--report`: contraste, ΔE con la pintura más cercana en cada visión y distancia al acento. */
export function reportTable(measures: Record<Mode, SetMeasure>, title: string): string {
  const head = ["paint", "color", "ink", "text", "edge", ...VISIONS, "accent"];
  const lines = [title, `limits: text ≥ ${LIMITS.text}:1 · edge ≥ ${LIMITS.edge}:1 · ΔE ≥ ${LIMITS.normal} normal, ≥ ${LIMITS.cvd} protan/deutan/tritan (OKLab ×100)`];
  for (const mode of MODES) {
    const m = measures[mode];
    const rows = m.paints.map((p) => [
      p.name,
      p.hex,
      p.ink,
      f1(p.text),
      f1(p.edge),
      ...VISIONS.map((v) => `${f1(p.nearest[v].d)} ${p.nearest[v].other}`),
      p.reserved ? f1(Math.min(...VISIONS.map((v) => p.reserved![v].d))) : "–",
    ]);
    const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
    const fmt = (r: string[]) => "  " + r.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd();
    const w = worstOf(m);
    lines.push("", `${mode}`, fmt(head), ...rows.map(fmt));
    lines.push(
      `  worst: text ${f1(w.text)}:1 · edge ${f1(w.edge)}:1 · ΔE normal ${f1(w.normal)} · color blind ${f1(w.cvd)}` +
        (w.reserved !== undefined ? ` · accent ${f1(w.reserved)}` : "") +
        (m.failures.length ? ` · ${m.failures.length} failing` : " · all pass"),
    );
  }
  return lines.join("\n");
}
