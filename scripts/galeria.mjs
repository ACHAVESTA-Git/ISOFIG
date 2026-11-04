#!/usr/bin/env node
// Genera examples/galeria/index.html: un solo archivo que funciona sin servidor y sin red.
//
//   npm run gallery [-- --lang en] [-- --out ruta.html]
//
// Cada ejemplo de examples/*/spec.* se dibuja con renderFigure (con su modelo, si examples/<ejemplo>/model.ts existe) y
// el runtime, el zoom y el giro se empaquetan en línea con esbuild. Los import() dinámicos quedan dentro del archivo:
// esbuild los convierte en inicializaciones diferidas, así que el giro y el zoom solo corren al tocarlos.
// Requiere esbuild (`npx --no-install esbuild`); no se versiona el resultado.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({ options: { lang: { type: "string", default: "es" }, out: { type: "string" } } });
const lang = values.lang === "en" ? "en" : "es";
const out = resolve(root, values.out ?? "examples/galeria/index.html");

const { assemble, renderFigure, textOf } = await import(pathToFileURL(join(root, "src/core/index.ts")).href);
const { catalog } = await import(pathToFileURL(join(root, "src/kit/index.ts")).href);
// Una spec con `map` se compila con resolveMap (src/core/map): se carga solo si el repositorio lo trae.
const mapFile = join(root, "src/core/map/index.ts");
const resolveMap = existsSync(mapFile) ? (await import(pathToFileURL(mapFile).href)).resolveMap : undefined;

const esbuild = (args, input) => execFileSync("npx", ["--no-install", "esbuild", ...args], { cwd: root, input, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["pipe", "pipe", "pipe"] });
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Un script en línea no puede contener `</script`: dentro de JS o de JSON, `<\/` vale lo mismo.
const inline = (s) => s.replace(/<\/(script|style)/gi, "<\\/$1");

/* ── El orden de la galería (los ejemplos que no están aquí van después, por nombre) y qué enseña cada uno. ──────── */
const ORDER = ["token-bucket", "motor-v8", "motor-cohete", "compose", "mapa-tienda", "mapa-pedido", "mapa-uml"];
const rank = (name) => (ORDER.includes(name) ? ORDER.indexOf(name) : ORDER.length);

/* Los que no están en NOTES usan el título de su spec y la primera frase de su `caption`. */
const NOTES = {
  "token-bucket": {
    es: "Cómo un limitador de tasa deja pasar las ráfagas cortas pero rechaza el exceso sostenido: cada petición necesita una ficha y las fichas se reponen a ritmo fijo.",
    en: "How a rate limiter lets short bursts through but rejects sustained excess: every request needs a token, and tokens refill at a fixed rate.",
  },
  "motor-v8": {
    es: "Cómo se arma un V8 de competición y en qué orden se desarma: dos bancadas de cuatro cilindros comparten un cigüeñal plano. Sale primero lo de fuera; el cárter y el tren alternativo, al final.",
    en: "How a racing V8 goes together and in what order it comes apart: two banks of four cylinders share a flat-plane crankshaft. The outside comes off first; the oil pan and the rotating assembly, last.",
    touchEs: "Desármalo paso a paso con «Desarmar», elige una pieza en «Pieza» para ver qué hace, gira el dibujo arrastrándolo y usa «Ampliar» para leer los rótulos.",
    touchEn: "Take it apart step by step with “Take apart”, pick a part under “Part” to see what it does, drag the drawing to turn it and use “Enlarge” to read the labels.",
  },
  "motor-cohete": {
    es: "Cómo un motor cohete convierte propelentes en empuje: la turbobomba los lleva a la cámara, los gases se aceleran en la garganta y la tobera los expande. El cardán orienta todo el motor.",
    en: "How a rocket engine turns propellant into thrust: the turbopump feeds the chamber, the gas speeds up through the throat and the nozzle expands it. The gimbal steers the whole engine.",
    touchEs: "Desármalo de arriba abajo con «Desarmar», elige una pieza en «Pieza» para leer qué hace, gira el dibujo arrastrándolo y usa «Ampliar» para leer los rótulos.",
    touchEn: "Take it apart from the top with “Take apart”, pick a part under “Part” to read what it does, drag the drawing to turn it and use “Enlarge” to read the labels.",
  },
  compose: {
    title: { es: "Docker Compose", en: "Docker Compose" },
    es: "De qué depende cada servicio de un docker-compose: qué necesita cada uno (otros servicios, volúmenes, redes), dibujado como una máquina.",
    en: "What each service of a docker-compose depends on: what each one needs (other services, volumes, networks), drawn as a machine.",
  },
  "mapa-tienda": {
    es: "El camino de una compra en una tienda en línea: la CDN entrega lo estático, el balanceador reparte entre tres servidores, el caché responde lo repetido y la cola saca los correos del camino.",
    en: "The path of a purchase in an online shop: the CDN serves what is static, the balancer spreads requests over three servers, the cache answers what repeats and the queue takes the emails off the path.",
  },
  "mapa-pedido": {
    es: "Qué pasa con un pedido: se paga, se reserva el stock, espera en la cola y sale el envío; si el pago se rechaza, el cliente recibe un aviso y el stock no se toca.",
    en: "What happens to an order: it is paid, the stock is reserved, it waits in the queue and the shipment leaves; if the payment is rejected, the customer gets a notice and the stock is untouched.",
  },
  "mapa-uml": {
    es: "Un diagrama de clases como archivadores: un cliente hace pedidos, el pedido se compone de líneas y se paga con un pago abstracto, con tarjeta o contra entrega.",
    en: "A class diagram as filing cabinets: a customer places orders, an order is made of lines and is paid with an abstract payment, by card or cash on delivery.",
  },
};

const TEXT = {
  es: {
    title: "isofig · galería",
    eyebrow: "isofig 0.9 · galería",
    h1: "Máquinas isométricas que explican ideas técnicas",
    lead: "Cada figura es un SVG que se dibuja al compilar; un runtime de {rt} lo anima. Aquí están todas con el estilo estándar y con el de lujo, en claro y en oscuro. Tócalas.",
    style: "Estilo", std: "Estándar", luxe: "Lujo",
    theme: "Tema", light: "Claro", dark: "Oscuro",
    index: "Figuras", teaches: "Enseña", touch: "Toca",
    footer: "Todo va en este archivo: figuras, runtime, zoom y giro. No pide nada a la red. Se regenera con",
    move: "mueve", toggle: "activa", choice: "elige", action: "pulsa", preset: "prueba", pause: "pausa y reanuda con", apart: "desármala paso a paso con", pick: "elige una pieza en", turn: "gira el dibujo arrastrándolo", zoom: "usa «{zoom}» para leer los rótulos",
    or: "o", and: "y", open: "«", close: "»", zoomLabel: "Ampliar", pauseLabel: "Pausar",
  },
  en: {
    title: "isofig · gallery",
    eyebrow: "isofig 0.9 · gallery",
    h1: "Isometric machines that explain technical ideas",
    lead: "Every figure is an SVG drawn at build time, animated by a {rt} runtime. Here they all are in the standard style and in the luxe one, light and dark. Touch them.",
    style: "Style", std: "Standard", luxe: "Luxe",
    theme: "Theme", light: "Light", dark: "Dark",
    index: "Figures", teaches: "Teaches", touch: "Touch",
    footer: "Everything is in this file: figures, runtime, zoom and turn. It asks the network for nothing. Regenerate it with",
    move: "drag", toggle: "switch", choice: "pick", action: "press", preset: "try", pause: "pause and resume with", apart: "take it apart step by step with", pick: "pick a part under", turn: "drag the drawing to turn it", zoom: "use “{zoom}” to read the labels",
    or: "or", and: "and", open: "“", close: "”", zoomLabel: "Enlarge", pauseLabel: "Pause",
  },
}[lang];

/* ── Los ejemplos ──────────────────────────────────────────────────────────────────────────────────────────────── */
async function loadExamples() {
  const dir = join(root, "examples");
  const found = [];
  const names = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "galeria").map((d) => d.name);
  for (const name of names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) {
    const file = ["spec.ts", "spec.json", "spec.mjs", "spec.js"].map((f) => join(dir, name, f)).find(existsSync);
    if (!file) continue;
    let spec;
    if (file.endsWith(".json")) spec = JSON.parse(readFileSync(file, "utf8"));
    else {
      const mod = await import(pathToFileURL(file).href);
      spec = mod.default ?? mod.spec;
    }
    if (!spec) throw new Error(`${file} no exporta una spec`);
    const model = ["model.ts", "model.mjs", "model.js"].map((f) => join(dir, name, f)).find(existsSync);
    found.push({ name, spec, model });
  }
  return found;
}

const quoted = (labels) => labels.map((l) => `${TEXT.open}${l}${TEXT.close}`);
const list = (labels, word = TEXT.and) => (labels.length < 2 ? quoted(labels).join("") : `${quoted(labels.slice(0, -1)).join(", ")} ${word} ${quoted(labels.slice(-1))[0]}`);

/** «Toca: mueve «Recarga» y «Tráfico», prueba «Ráfaga», gira el dibujo arrastrándolo…» a partir de lo que declara la spec. */
function touchOf(spec, autoplay) {
  const by = { range: [], toggle: [], choice: [], action: [] };
  const parts = [];
  for (const p of spec.params ?? []) {
    if (p.hidden) continue;
    const label = textOf(p.label, lang);
    // Los controles que añade el despiece tienen su propia frase.
    if (p.id === "explode") parts.push(`${TEXT.apart} ${list([label])}`);
    else if (p.id === "pick") parts.push(`${TEXT.pick} ${list([label])}`);
    else by[p.kind ?? "range"]?.push(label);
  }
  for (const [kind, verb] of [["range", TEXT.move], ["toggle", TEXT.toggle], ["choice", TEXT.choice], ["action", TEXT.action]]) {
    if (by[kind].length) parts.push(`${verb} ${list(by[kind])}`);
  }
  const presets = (spec.presets ?? []).map((p) => textOf(p.label, lang));
  if (presets.length) parts.push(`${TEXT.preset} ${list(presets, TEXT.or)}`);
  if (autoplay) parts.push(`${TEXT.pause} ${list([TEXT.pauseLabel])}`);
  parts.push(TEXT.turn, TEXT.zoom.replace("{zoom}", TEXT.zoomLabel));
  const sentence = parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(", ")} ${TEXT.and} ${parts.at(-1)}`;
  return sentence[0].toUpperCase() + sentence.slice(1) + ".";
}

const firstSentence = (s) => (/^(.+?[.!?])(\s|$)/.exec(s)?.[1] ?? s);

/* ── El código del navegador: runtime, zoom, giro, modelos y los dos interruptores ─────────────────────────────── */
const toolbar = `
const root = document.documentElement;
const body = document.body;
const dark = matchMedia("(prefers-color-scheme: dark)");
const radios = (name) => [...document.querySelectorAll('input[name="' + name + '"]')];
const check = (name, value) => radios(name).forEach((r) => (r.checked = r.value === value));
const setStyle = (v) => { body.classList.toggle("isofig-luxe", v === "luxe"); check("g-style", v); };
const setTheme = (v) => { root.dataset.theme = v; check("g-theme", v); };
radios("g-style").forEach((r) => r.addEventListener("change", () => setStyle(r.value)));
radios("g-theme").forEach((r) => r.addEventListener("change", () => setTheme(r.value)));
// Mientras el lector no elija, el tema sigue al del sistema.
const follow = () => { if (!root.dataset.theme) check("g-theme", dark.matches ? "dark" : "light"); };
dark.addEventListener("change", follow);
setStyle(query.get("style") === "std" ? "std" : "luxe");
if (query.get("theme") === "dark" || query.get("theme") === "light") setTheme(query.get("theme")); else follow();
`;

function bundle(examples) {
  const imports = examples.filter((e) => e.model).map((e, i) => `import * as M${i} from ${JSON.stringify(e.model)};`);
  const registers = examples.filter((e) => e.model).map((e, i) => `register(${JSON.stringify(e.spec.model ?? e.spec.id)}, M${i}.default ?? M${i}.model);`);
  const entry = `
import { mountAll, orbitOnDemand, register, zoomOnDemand } from ${JSON.stringify(join(root, "src/runtime/index.ts"))};
${imports.join("\n")}
${registers.join("\n")}
const specs = JSON.parse(document.getElementById("g-specs").textContent);
const query = new URLSearchParams(location.search);
// ?advance=5 arranca cada figura con 5 s ya simulados y ?bare deja solo las figuras: lo usa scripts/capturas.mjs.
const advance = query.get("advance");
if (advance) document.querySelectorAll("[data-isofig]").forEach((el) => (el.dataset.isofigAdvance = advance));
if (query.has("bare")) document.body.classList.add("g-bare");
zoomOnDemand(() => import(${JSON.stringify(join(root, "src/zoom/index.ts"))}));
mountAll();
document.querySelectorAll("[data-isofig]").forEach((el) => {
  const spec = specs[el.dataset.isofig];
  if (spec) orbitOnDemand(el, async () => (await import(${JSON.stringify(join(root, "src/orbit/index.ts"))})).enableOrbit(el, spec, { lang: ${JSON.stringify(lang)} }));
});
${toolbar}`;
  return esbuild(["--bundle", "--minify", "--format=esm", "--target=es2022", "--platform=browser", "--legal-comments=none", "--loader=ts",], entry);
}

const css = (text) => esbuild(["--loader=css", "--minify"], text);
const runtimeSize = () => {
  const js = esbuild([join(root, "src/runtime/index.ts"), "--bundle", "--minify", "--format=esm", "--target=es2022", "--platform=browser"]);
  return gzipSync(js, { level: 9 }).length;
};

/* ── La página ─────────────────────────────────────────────────────────────────────────────────────────────────── */
const PAGE_CSS = `
html{color-scheme:light}
html[data-theme=dark]{color-scheme:dark}
@media (prefers-color-scheme:dark){html:not([data-theme=light]){color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--isofig-paper);color:var(--isofig-ink);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.g-serif,h1,h2{font-family:var(--isofig-luxe-serif,var(--isofig-font))}
.g-wrap{width:min(1160px,100%);margin:0 auto;padding-inline:20px}
a{color:inherit}
:focus-visible{outline:2px solid var(--isofig-focus);outline-offset:2px}
.g-bar{position:sticky;top:0;z-index:5;background:color-mix(in oklab,var(--isofig-paper) 84%,transparent);-webkit-backdrop-filter:saturate(1.4) blur(14px);backdrop-filter:saturate(1.4) blur(14px);box-shadow:0 1px 0 var(--isofig-luxe-line,color-mix(in oklab,var(--isofig-ink) 14%,transparent))}
.g-bar .g-wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 20px;padding-block:10px}
.g-bar .isofig-param{padding:3px 5px 3px 12px;gap:4px}
.g-bar legend{margin-right:6px}
.g-brand{font:600 .78rem/1 var(--isofig-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--isofig-ink-soft)}
.g-toggles{display:flex;flex-wrap:wrap;gap:8px}
.g-hero{padding-block:clamp(36px,8vw,84px) clamp(20px,4vw,36px)}
.g-eyebrow{margin:0 0 14px;font:600 .74rem/1 var(--isofig-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--isofig-ink-soft)}
h1{margin:0;max-width:17ch;font-size:clamp(2.1rem,4.6vw + .5rem,3.5rem);font-weight:600;line-height:1.04;letter-spacing:-.018em;text-wrap:balance}
.g-lead{max-width:58ch;margin:18px 0 0;color:var(--isofig-ink-soft);font-size:1.06rem}
.g-index{display:flex;flex-wrap:wrap;gap:8px;margin:26px 0 0;padding:0;list-style:none}
.g-index a{display:inline-flex;align-items:center;gap:8px;min-height:32px;text-decoration:none}
.g-index b{font:600 .72rem var(--isofig-mono);color:var(--isofig-ink-soft)}
.g-fig{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;padding:clamp(28px,5vw,52px) 0;border-top:1px solid var(--isofig-luxe-line,color-mix(in oklab,var(--isofig-ink) 14%,transparent));scroll-margin-top:56px}
.g-num{margin:0 0 6px;font:600 .78rem/1 var(--isofig-mono);letter-spacing:.14em;color:var(--isofig-ink-soft)}
h2{margin:0 0 14px;font-size:clamp(1.35rem,1.6vw + 1rem,1.9rem);font-weight:600;line-height:1.15;letter-spacing:-.01em;text-wrap:balance}
.g-notes{margin:0;display:grid;gap:12px}
.g-notes dt{margin:0 0 2px;font:600 .7rem/1.3 var(--isofig-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--isofig-ink-soft)}
.g-notes dd{margin:0;max-width:46ch;font-size:.98rem}
.g-art{min-width:0}
.g-foot{margin-top:0;padding-block:36px 56px;border-top:1px solid var(--isofig-luxe-line,color-mix(in oklab,var(--isofig-ink) 14%,transparent));color:var(--isofig-ink-soft);font-size:.88rem}
.g-foot code{font-family:var(--isofig-mono);color:var(--isofig-ink)}
.g-foot p{margin:0 0 6px}
@media (min-width:1000px){
.g-fig{grid-template-columns:300px minmax(0,1fr);gap:44px}
.g-text{position:sticky;top:76px;align-self:start}
}
@media (max-width:520px){
.g-wrap{padding-inline:16px}
.g-bar .g-wrap{padding-block:7px}
.g-brand,.g-bar legend{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.g-toggles{width:100%;justify-content:space-between;gap:6px}
.g-bar .isofig-param{padding:3px 4px}
.g-bar .isofig-choice label{padding:0 10px}
}
.g-bare .g-bar,.g-bare .g-hero,.g-bare .g-text,.g-bare footer,.g-bare .isofig-n{display:none}
.g-bare main{width:840px;max-width:none}
.g-bare .g-fig{display:block;padding:0 0 28px;border:0}
@media print{.g-bar{display:none}}
`;

const examples = await loadExamples();
if (!examples.length) throw new Error("no hay ejemplos en examples/*/spec.*");

const figures = examples.map(({ name, spec }, i) => {
  const r = renderFigure(spec, { lang, n: i + 1, orbit: true, resolveMap });
  // El giro recibe la spec ya armada: así no carga el árbol, el catálogo ni los mapas en el navegador.
  const flat = spec.root || spec.map ? assemble(spec, { catalog, resolveMap }) : spec;
  const orbitSpec = flat;
  if (r.errors.length) throw new Error(`${name}: ${r.errors.join("; ")}`);
  for (const w of r.warnings) console.error(`aviso en ${name}: ${w}`);
  const title = NOTES[name]?.title?.[lang] ?? (textOf(spec.title, lang) || name);
  const note = NOTES[name]?.[lang] ?? firstSentence(textOf(spec.caption, lang)) ?? "";
  return { name, spec: orbitSpec, title, html: r.html, note, touch: NOTES[name]?.[lang === "es" ? "touchEs" : "touchEn"] ?? touchOf(flat, r.data.autoplay) };
});

const rtBytes = runtimeSize();
const js = bundle(examples);
const styles = css(
  [readFileSync(join(root, "src/theme/theme.css"), "utf8"), readFileSync(join(root, "src/theme/luxe.css"), "utf8"), PAGE_CSS].join("\n"),
);
const specs = JSON.stringify(Object.fromEntries(figures.map((f) => [f.spec.id, f.spec])));

const radio = (name, id, label, checked) =>
  `<label><input type="radio" name="${name}" value="${id}"${checked ? " checked" : ""}><span>${esc(label)}</span></label>`;

const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(TEXT.title)}</title>
<meta name="description" content="${esc(TEXT.h1)}">
<style>${inline(styles)}</style></head>
<body class="isofig isofig-luxe">
<div class="g-bar"><div class="g-wrap"><span class="g-brand">isofig</span><div class="g-toggles">
<fieldset class="isofig-param isofig-choice"><legend>${esc(TEXT.style)}</legend>${radio("g-style", "std", TEXT.std, false)}${radio("g-style", "luxe", TEXT.luxe, true)}</fieldset>
<fieldset class="isofig-param isofig-choice"><legend>${esc(TEXT.theme)}</legend>${radio("g-theme", "light", TEXT.light, true)}${radio("g-theme", "dark", TEXT.dark, false)}</fieldset>
</div></div></div>
<header class="g-wrap g-hero">
<p class="g-eyebrow">${esc(TEXT.eyebrow)}</p>
<h1>${esc(TEXT.h1)}</h1>
<p class="g-lead">${esc(TEXT.lead.replace("{rt}", kb(rtBytes)))}</p>
<nav aria-label="${esc(TEXT.index)}"><ul class="g-index">${figures.map((f, i) => `<li><a class="isofig-chip" href="#${esc(f.name)}"><b>${String(i + 1).padStart(2, "0")}</b>${esc(f.title)}</a></li>`).join("")}</ul></nav>
</header>
<main class="g-wrap">
${figures
  .map(
    (f, i) => `<section class="g-fig" id="${esc(f.name)}" aria-labelledby="h-${esc(f.name)}">
<div class="g-text"><p class="g-num">${String(i + 1).padStart(2, "0")} / ${String(figures.length).padStart(2, "0")}</p><h2 id="h-${esc(f.name)}">${esc(f.title)}</h2>
<dl class="g-notes"><div><dt>${esc(TEXT.teaches)}</dt><dd>${esc(f.note)}</dd></div><div><dt>${esc(TEXT.touch)}</dt><dd>${esc(f.touch)}</dd></div></dl></div>
<div class="g-art">${f.html}</div>
</section>`,
  )
  .join("\n")}
</main>
<footer class="g-wrap"><div class="g-foot"><p>${esc(TEXT.footer)} <code>npm run gallery</code>.</p></div></footer>
<script type="application/json" id="g-specs">${inline(specs)}</script>
<script type="module">${inline(js)}</script>
</body></html>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
const bytes = Buffer.byteLength(html);
console.error(`galería: ${figures.length} figuras → ${out}`);
console.error(`  ${kb(bytes)} (${kb(gzipSync(html, { level: 9 }).length)} gzip) · script ${kb(Buffer.byteLength(js))} (${kb(gzipSync(js, { level: 9 }).length)} gzip) · css ${kb(Buffer.byteLength(styles))} (${kb(gzipSync(styles, { level: 9 }).length)} gzip) · runtime ${kb(rtBytes)} gzip`);
