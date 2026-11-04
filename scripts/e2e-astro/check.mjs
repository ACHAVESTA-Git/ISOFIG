// Lee lo que `astro build` dejó en dist/ y comprueba lo que promete el adaptador. Uso: node check.mjs <dist>
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2] ?? "dist";
const page = (name) => readFileSync(join(dist, name, "index.html"), "utf8");
const home = readFileSync(join(dist, "index.html"), "utf8");
const count = (text, needle) => text.split(needle).length - 1;

// La misma figura dos veces: ids distintos por copia y un solo tema por página.
assert.equal(count(home, 'data-isofig="token-bucket"'), 2);
assert.equal(count(home, 'id="token-bucket-t"'), 1);
assert.equal(count(home, 'id="token-bucket-2-t"'), 1, "la segunda copia lleva su propio id");
assert.equal(count(home, "data-isofig-theme"), 1, "el tema va una sola vez por página");
assert.equal(count(home, 'data-isofig-load="idle"'), 1);
assert.equal(count(home, 'data-isofig-load="visible"'), 1);
assert.equal(count(home, 'class="isofig-spec"'), 1, "solo la copia con giro lleva su spec");
assert.equal(count(home, 'class="isofig-orbit"'), 1, "solo la copia con giro lleva sus botones de giro");
assert.equal(count(home, "data-zoom"), 2, "las dos copias tienen el chip «Ampliar»");

// Con ClientRouter y transition:persist la figura va en su sitio y carga ya.
const persistent = page("persistent");
assert.match(persistent, /data-astro-transition-persist="bucket"/);
assert.match(persistent, /data-isofig-load="eager"/);

// Una página sin figura no lleva nada de la biblioteca.
const plain = page("plain");
assert.equal(plain.includes("isofig"), false, "la página sin figura no trae marcado ni tema de isofig");

// El modelo viaja en su propio archivo, que la página pide al acercarse la figura, y el runtime en otro.
const assets = readdirSync(join(dist, "_astro")).filter((f) => f.endsWith(".js"));
const text = assets.map((f) => readFileSync(join(dist, "_astro", f), "utf8"));
assert.ok(text.some((t) => t.includes("isofigLive")), "falta el runtime en _astro/");
assert.ok(text.some((t) => t.includes("refill")), "falta el modelo de la figura en _astro/");
assert.ok(text.some((t) => t.includes("isofig-zoombox")), "falta isofig/zoom en _astro/");
assert.ok(text.some((t) => t.includes("isofig-grabbing")), "falta isofig/orbit en _astro/");
const eager = (name) => text.find((t) => t.includes(name));
assert.notEqual(eager("isofig-zoombox"), eager("isofigLive"), "el zoom no va dentro del runtime");

console.log(`dist/: ${readdirSync(dist).length} entradas, ${assets.length} archivos js; el adaptador hace lo que promete`);
