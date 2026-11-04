import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { messageLang, PREFIXES } from "../core/issues.ts";
import { derivePalette, type DerivedPalette } from "../core/palette/derive.ts";
import { paletteCss, paletteJson, reportTable } from "../core/palette/format.ts";
import { lin, measureSet, type SetMeasure } from "../core/palette/guarantees.ts";
import { MATERIALS } from "../core/palette/sets.ts";
import { MODES, THEME, type Mode } from "../core/palette/theme.ts";

export interface PaletteOptions {
  base?: string;
  format?: string;
  report?: boolean;
  out?: string;
  /** Idioma de los prefijos («warning» o «aviso»). */
  lang?: string;
}

/** `isofig palette`: los roles de una marca, como CSS o JSON, y si se pide, la tabla de garantías (por stderr). */
export function runPalette(opts: PaletteOptions): number {
  const base = opts.base ?? THEME.light.accent;
  let d: DerivedPalette;
  try {
    d = derivePalette(base);
  } catch (e) {
    console.error(`${PREFIXES[messageLang(opts.lang)].error}: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  const text = opts.format === "json" ? JSON.stringify(paletteJson(d), null, 2) + "\n" : paletteCss(d);
  if (opts.out) {
    mkdirSync(dirname(resolve(opts.out)), { recursive: true });
    writeFileSync(opts.out, text);
  } else process.stdout.write(text);
  if (opts.report) {
    const materials = {} as Record<Mode, SetMeasure>;
    for (const mode of MODES) materials[mode] = measureSet(MATERIALS.map((p) => ({ name: p.name, color: lin(p.lch[mode]) })), mode);
    console.error(reportTable(d.measures, `isofig palette · roles from ${d.base}`));
    console.error("\n" + reportTable(materials, "materials (fixed)"));
  }
  for (const mode of MODES) for (const f of d.measures[mode].failures) console.warn(`${PREFIXES[messageLang(opts.lang)].warning} (${mode}): ${f}`);
  return d.ok ? 0 : 1;
}
