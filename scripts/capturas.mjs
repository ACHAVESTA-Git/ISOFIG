#!/usr/bin/env node
// Genera los PNG de docs/assets/: cada ejemplo de examples/*/spec.* en estilo estándar y de lujo, claro y oscuro.
//
//   PLAYWRIGHT_PATH=/ruta/a/node_modules/playwright npm run screenshots
//
// Playwright no es dependencia del paquete: se le pasa la ruta de uno ya instalado en PLAYWRIGHT_PATH. Si su Chromium
// no coincide con la versión instalada, ISOFIG_CHROME apunta al ejecutable que se debe usar. ISOFIG_LANG=es dibuja
// los rótulos en español (por defecto, inglés, como el README). Con ffmpeg en el PATH, cada PNG se reduce a una paleta
// de 256 colores (el dibujo es plano: no se nota y pesa una cuarta parte); sin él se dejan como salen.
//
// Nombres estables, uno por combinación:
//   <ejemplo>-<tema>.png         estilo estándar  (los que ya enlaza el README: token-bucket-light.png…)
//   <ejemplo>-luxe-<tema>.png    estilo de lujo   (token-bucket-luxe-dark.png…)
// Los ejemplos que se desarman (el control «Desarmar» de una spec anidada) suman, en lujo y oscuro, dos más: la
// mitad del despiece y el despiece completo (motor-v8-luxe-dark-half.png, motor-v8-luxe-dark-exploded.png). La imagen
// sin sufijo es la figura armada.
// Usa la galería (scripts/galeria.mjs) con ?bare y ?advance=5: las figuras con modelo salen siempre en el mismo
// instante de la simulación y con el movimiento reducido, así que dos ejecuciones dan la misma imagen.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lang = process.env.ISOFIG_LANG === "es" ? "es" : "en";
const ADVANCE = 5;
const WIDTH = 840;

const where = process.env.PLAYWRIGHT_PATH;
if (!where) {
  console.error("Falta PLAYWRIGHT_PATH: la ruta de un Playwright instalado (…/node_modules/playwright). No es dependencia del paquete.");
  process.exit(1);
}
const entry = ["index.mjs", "index.js"].map((f) => join(where, f)).find(existsSync);
if (!entry) {
  console.error(`PLAYWRIGHT_PATH=${where} no tiene index.mjs ni index.js.`);
  process.exit(1);
}
const { chromium } = await import(pathToFileURL(entry).href);

const work = mkdtempSync(join(tmpdir(), "isofig-capturas-"));
const gallery = join(work, "index.html");
execFileSync(process.execPath, [join(root, "scripts/galeria.mjs"), "--lang", lang, "--out", gallery], { stdio: ["ignore", "ignore", "inherit"] });

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

/** Paleta de 256 colores con difusión de error: el dibujo es plano y los degradados de la tarjeta, suaves. */
function shrink(file) {
  const small = `${file}.small.png`;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a", "-frames:v", "1", small]);
  if (statSync(small).size < statSync(file).size) renameSync(small, file);
  else rmSync(small);
}

const browser = await chromium.launch(process.env.ISOFIG_CHROME ? { executablePath: process.env.ISOFIG_CHROME } : {});
const out = join(root, "docs/assets");
mkdirSync(out, { recursive: true });
let total = 0;
let count = 0;
try {
  for (const style of ["standard", "luxe"]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, colorScheme: theme, reducedMotion: "reduce", deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on("pageerror", (e) => console.error(`error de página: ${e.message}`));
      await page.goto(`${pathToFileURL(gallery).href}?bare&style=${style === "luxe" ? "luxe" : "std"}&theme=${theme}&advance=${ADVANCE}`);
      await page.waitForFunction(() => [...document.querySelectorAll("[data-isofig]")].every((el) => el.querySelector(".isofig-controls:not([hidden])") || !el.querySelector(".isofig-controls")));
      await page.evaluate(() => document.fonts.ready);
      const ids = await page.$$eval("[data-isofig]", (els) => els.map((el) => el.dataset.isofig));
      for (const id of ids) {
        const file = join(out, `${id}${style === "luxe" ? "-luxe" : ""}-${theme}.png`);
        await page.locator(`[data-isofig="${id}"]`).screenshot({ path: file, animations: "disabled" });
        if (hasFfmpeg) shrink(file);
        total += statSync(file).size;
        count++;
        console.error(`${file.replace(`${root}/`, "")}  ${kb(statSync(file).size)}`);
        // El despiece: la figura ya está armada (la imagen de arriba); se mueve el control a la mitad y al final.
        const apart = page.locator(`[data-isofig="${id}"] input[data-param="explode"]`);
        if (style === "luxe" && theme === "dark" && (await apart.count())) {
          const max = Number(await apart.getAttribute("max"));
          for (const [suffix, value] of [["half", Math.round(max / 2)], ["exploded", max]]) {
            await apart.fill(String(value));
            // Sin el aro de foco que deja `fill` en el control.
            await apart.evaluate((el) => el.blur());
            const shot = join(out, `${id}-luxe-dark-${suffix}.png`);
            await page.locator(`[data-isofig="${id}"]`).screenshot({ path: shot, animations: "disabled" });
            if (hasFfmpeg) shrink(shot);
            total += statSync(shot).size;
            count++;
            console.error(`${shot.replace(`${root}/`, "")}  ${kb(statSync(shot).size)}`);
          }
          await apart.fill("0");
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
console.error(`${count} imágenes, ${kb(total)} en total${hasFfmpeg ? "" : " (sin ffmpeg: no se optimizaron)"}`);
