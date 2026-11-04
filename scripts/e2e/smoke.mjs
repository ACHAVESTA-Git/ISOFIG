// Corre dentro del proyecto de scripts/e2e.sh, con el paquete instalado desde su .tgz.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as core from "isofig";
import * as runtime from "isofig/runtime";
import * as orbit from "isofig/orbit";
import * as kit from "isofig/kit";
import * as zoom from "isofig/zoom";
import * as node from "isofig/node";
import * as astroClient from "isofig/astro/client";
import pkg from "isofig/package.json" with { type: "json" };

const exports = (mod, ...names) => {
  for (const name of names) assert.equal(typeof mod[name], "function", `falta ${name}`);
};
exports(core, "renderFigure", "validateSpec", "applyOverrides", "checkModel", "fromCompose", "derivePalette", "defineFigure");
exports(runtime, "mount", "mountAll", "unmountAll", "register", "zoomOnDemand", "orbitOnDemand", "retarget");
exports(orbit, "enableOrbit");
exports(zoom, "openZoom");
exports(kit, "bench", "plinth", "labelPlate", "ruler", "screws", "pool", "groupsOf");
exports(node, "measure", "checkBudget", "budgetIssues");
exports(astroClient, "models", "scan", "start");
console.log("entradas: isofig, runtime, orbit, zoom, kit, node, astro/client");

assert.match(pkg.version, /^\d+\.\d+\.\d+/);
const css = readFileSync(fileURLToPath(import.meta.resolve("isofig/theme.css")), "utf8");
assert.ok(css.includes(".isofig"), "isofig/theme.css no tiene .isofig");
assert.match(fileURLToPath(import.meta.resolve("isofig/astro")), /node_modules\/isofig\/src\/astro\/Figure\.astro$/);
console.log(`isofig ${pkg.version}: theme.css (${css.length} B) y el componente de Astro se resuelven`);

for (const blocked of ["isofig/angular", "isofig/src/theme/theme.css", "isofig/dist/core/render.js"]) {
  await assert.rejects(() => import(blocked), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }, `${blocked} debería estar cerrado`);
}
console.log("cerradas: isofig/angular, rutas internas de src/ y dist/");

// El núcleo dibuja sin Node: lo que mide el gzip y el presupuesto vive en isofig/node.
const fig = core.renderFigure({ id: "x", title: "x", width: 100, height: 100, parts: [{ id: "b", kind: "box", at: [0, 0, 0], size: [10, 10, 10] }], budget: 0.001 });
assert.deepEqual(fig.errors, []);
assert.equal("gzip" in fig, false, "Rendered ya no trae gzip");
const measured = node.measure(fig.html);
assert.equal(measured.bytes, fig.bytes);
assert.ok(measured.gzip > 0 && measured.gzip < measured.bytes);
assert.equal(node.checkBudget({ budget: 0.001 }, measured).length, 1, "el aviso de peso sale de isofig/node");
console.log("renderFigure sin Node, measure y checkBudget en isofig/node");
