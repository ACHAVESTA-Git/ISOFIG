// Mide lo que pesa cada pieza que llega al navegador (minificada con esbuild y comprimida con gzip -9) y falla si
// alguna pasa su tope de size-budget.json. Se corre con `npm run size`, que antes compila `dist/`.
import { build, transform } from "esbuild";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gz = (code: string | Uint8Array): number => gzipSync(code, { level: 9 }).length;

/** Todo lo que entra en el bundle de la entrada, igual que `esbuild <archivo> --bundle --minify --format=esm | gzip -9`. */
async function bundled(entry: string): Promise<number> {
  const out = await build({ entryPoints: [join(root, entry)], bundle: true, minify: true, format: "esm", write: false, outfile: "out.js", logLevel: "error" });
  return gz(out.outputFiles[0]!.contents);
}

/** Solo el arranque: lo que se carga antes de que nadie pida el runtime, el modelo o el giro (sus `import()` son otros archivos). */
async function startup(entry: string): Promise<number> {
  const out = await build({ entryPoints: [join(root, entry)], bundle: true, minify: true, format: "esm", splitting: true, outdir: "out", write: false, logLevel: "error" });
  const main = out.outputFiles.find((f) => f.path.endsWith("/client.js"))!;
  return gz(main.contents);
}

const css = async (file: string): Promise<number> => gz((await transform(readFileSync(join(root, file), "utf8"), { loader: "css", minify: true })).code);

/** Cada medida, con el nombre que lleva en size-budget.json y qué mide. */
const MEASURES: { name: string; what: string; run: () => Promise<number> }[] = [
  { name: "runtime", what: "isofig/runtime", run: () => bundled("dist/runtime/index.js") },
  { name: "zoom", what: "isofig/zoom", run: () => bundled("dist/zoom/index.js") },
  { name: "orbit", what: "isofig/orbit (con drawScene)", run: () => bundled("dist/orbit/index.js") },
  { name: "kit", what: "isofig/kit", run: () => bundled("dist/kit/index.js") },
  { name: "map", what: "isofig/map (el compilador de mapas: objetos, reparto, rutas, leyenda)", run: () => bundled("dist/core/map/index.js") },
  { name: "core", what: "isofig (el núcleo, que también corre en el navegador)", run: () => bundled("dist/core/index.js") },
  { name: "astro-client", what: "arranque de isofig/astro/client", run: () => startup("dist/astro/client.js") },
  { name: "theme.css", what: "isofig/theme.css", run: () => css("src/theme/theme.css") },
];

const budget: Record<string, number> = JSON.parse(readFileSync(join(root, "size-budget.json"), "utf8")).limits;

if (!existsSync(join(root, "dist/runtime/index.js"))) {
  console.error("No hay dist/: corre `npm run build` primero (o `npm run size`, que lo hace).");
  process.exit(1);
}

const rows: { name: string; what: string; bytes: number; limit: number | undefined }[] = [];
for (const m of MEASURES) rows.push({ name: m.name, what: m.what, bytes: await m.run(), limit: budget[m.name] });

const width = Math.max(...rows.map((r) => r.name.length));
console.log(`${"pieza".padEnd(width)}  ${"bytes".padStart(6)}  ${"tope".padStart(6)}  ${"uso".padStart(5)}  qué mide (min + gzip)`);
const over: string[] = [];
for (const r of rows) {
  const used = r.limit ? `${Math.round((r.bytes / r.limit) * 100)} %` : "—";
  const mark = r.limit === undefined || r.bytes > r.limit ? "  ✖" : "";
  console.log(`${r.name.padEnd(width)}  ${String(r.bytes).padStart(6)}  ${String(r.limit ?? "—").padStart(6)}  ${used.padStart(5)}  ${r.what}${mark}`);
  if (r.limit === undefined) over.push(`${r.name}: no tiene tope en size-budget.json`);
  else if (r.bytes > r.limit) over.push(`${r.name}: ${r.bytes} B pasa su tope de ${r.limit} B por ${r.bytes - r.limit} B`);
}
for (const name of Object.keys(budget)) if (!rows.some((r) => r.name === name)) over.push(`${name}: está en size-budget.json pero ya no se mide`);

// En GitHub Actions, la tabla también va al resumen del job.
const summary = process.env["GITHUB_STEP_SUMMARY"];
if (summary) {
  const lines = ["| pieza | bytes | tope | uso |", "|---|---:|---:|---:|", ...rows.map((r) => `| ${r.name} | ${r.bytes} | ${r.limit ?? "—"} | ${r.limit ? Math.round((r.bytes / r.limit) * 100) + " %" : "—"} |`)];
  appendFileSync(summary, `### Peso (min + gzip)\n\n${lines.join("\n")}\n`);
}

if (over.length) {
  console.error(`\n${over.join("\n")}\nSi el aumento es a propósito, sube el tope en size-budget.json y dilo en el CHANGELOG.`);
  process.exit(1);
}
