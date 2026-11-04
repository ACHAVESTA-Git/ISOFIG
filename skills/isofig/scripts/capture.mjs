#!/usr/bin/env node
// Screenshots a figure the way a reader meets it: 390 px (phone) and 1280 px, light and dark, and with the
// "Enlarge" dialog open. Needs Playwright in the current project (npm i -D playwright && npx playwright install chromium).
//
//   node capture.mjs <page.html | url> [--out shots] [--selector "[data-isofig]"] [--wait 600] [--browser <chrome path>]
//
// <page.html> comes from `isofig build <spec> --format page`. Light and dark are switched here (data-theme on
// <html>), so one page is enough. Then LOOK at every PNG: a green check does not fix what the eye does not believe.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", default: "shots" },
    selector: { type: "string", default: "[data-isofig]" },
    wait: { type: "string", default: "600" },
    browser: { type: "string" },
  },
});
const [target] = positionals;
if (!target) {
  console.error("usage: node capture.mjs <page.html | url> [--out shots] [--selector '[data-isofig]'] [--wait 600] [--browser <path>]");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = createRequire(resolve("package.json"))("playwright"));
} catch {
  console.error("Playwright is not installed in this project: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const url = /^(https?|file):/.test(target) ? target : pathToFileURL(resolve(target)).href;
mkdirSync(values.out, { recursive: true });
const browser = await chromium.launch(values.browser ? { executablePath: values.browser } : {});
const written = [];
const problems = [];

async function open(width, height, theme) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1 });
  page.on("pageerror", (e) => problems.push(`${width}/${theme}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`${width}/${theme}: ${m.text()}`));
  await page.goto(url);
  await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
  await page.waitForTimeout(Number(values.wait));
  return page;
}

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"]) {
    const page = await open(width, 900, theme);
    const figure = page.locator(values.selector).first();
    if (!(await figure.count())) {
      problems.push(`no element matches ${values.selector}`);
      await page.close();
      continue;
    }
    const file = `${values.out}/${width}-${theme}.png`;
    await figure.screenshot({ path: file });
    written.push(file);
    if (width === 390) {
      // La vista ampliada es lo que lee un celular: se comprueba que el rótulo más pequeño se lea ahí.
      const chip = figure.locator(".isofig-zoom");
      if (await chip.isVisible().catch(() => false)) {
        await chip.click();
        await page.locator("dialog[open]").waitFor({ timeout: 3000 }).catch(() => problems.push("the Enlarge dialog did not open"));
        await page.waitForTimeout(300);
        const zoomed = `${values.out}/390-${theme}-enlarged.png`;
        await page.screenshot({ path: zoomed });
        written.push(zoomed);
      } else problems.push("no visible Enlarge chip (is the figure mounted? was it built with zoom: false?)");
    }
    await page.close();
  }
}
await browser.close();

console.log(written.join("\n"));
if (problems.length) console.error(`\nproblems:\n- ${problems.join("\n- ")}`);
process.exit(problems.length ? 1 : 0);
