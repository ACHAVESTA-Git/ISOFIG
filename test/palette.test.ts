import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contrast, deltaE, hexOf, lchOfColor, parseColor, simulate } from "../src/core/palette/color.ts";
import { derivePalette } from "../src/core/palette/derive.ts";
import { legendOf, paintsUsed } from "../src/core/palette/figure.ts";
import { paletteCss, paletteJson, themeBlock } from "../src/core/palette/format.ts";
import { lin, measureSet, reservedOf } from "../src/core/palette/guarantees.ts";
import { MATERIAL_NAMES, PAINT_NAMES, RESERVED, ROLE_NAMES } from "../src/core/palette/names.ts";
import { MATERIALS, PAINT, PAINTS, ROLES } from "../src/core/palette/sets.ts";
import { MODES, THEME } from "../src/core/palette/theme.ts";
import { renderFigure } from "../src/core/render.ts";
import { validateSpec } from "../src/core/validate.ts";
import type { FigureSpec, Part } from "../src/core/spec.ts";
import tokenBucket from "../examples/token-bucket/spec.ts";

const css = readFileSync(new URL("../src/theme/theme.css", import.meta.url), "utf8");

const box = (id: string, x: number, extra: Partial<Part> = {}): Part =>
  ({ id, kind: "box", at: [x, 0, 0], size: [10, 10, 6], ...extra }) as Part;
const figure = (parts: Part[], more: Partial<FigureSpec> = {}): FigureSpec => ({ id: "f", title: "t", parts, ...more });

test("la conversión a OKLab respeta los extremos y vuelve al mismo hex", () => {
  assert.ok(Math.abs(lchOfColor("#ffffff")[0] - 1) < 1e-4);
  assert.ok(lchOfColor("#000000")[0] < 1e-4);
  for (const hex of ["#2fb58b", "#d4583f", "#1d1e1c", "#99c2ed"]) assert.equal(hexOf(parseColor(hex)), hex);
  const [L, C, h] = lchOfColor("#2fb58b");
  assert.ok(Math.abs(L - 0.692) < 0.002 && Math.abs(C - 0.129) < 0.002 && Math.abs(h - 167) < 1);
  assert.equal(hexOf(parseColor("oklch(69.2% .129 167)")), hexOf(parseColor("oklch(0.692 0.129 167)")));
});

test("contraste WCAG y simulación de daltonismo", () => {
  assert.ok(Math.abs(contrast(parseColor("#000"), parseColor("#fff")) - 21) < 1e-9);
  const grey = parseColor("#808080");
  for (const v of ["protan", "deutan", "tritan"] as const) {
    assert.ok(simulate(grey, v).every((c, i) => Math.abs(c - grey[i]) < 0.01), `${v} deja el gris casi igual`);
  }
  const red = parseColor("#c0392b");
  const green = parseColor("#6b8e23");
  assert.ok(deltaE(red, green) > 20);
  assert.ok(deltaE(red, green, "deutan") < deltaE(red, green) / 2, "rojo y verde se acercan con deuteranopía");
});

test("los dos juegos cumplen sus garantías en claro y en oscuro", () => {
  for (const mode of MODES) {
    const roles = measureSet(ROLES.map((p) => ({ name: p.name, color: lin(p.lch[mode]) })), mode, reservedOf(mode).slice(0, 1));
    assert.deepEqual(roles.failures, [], `roles en ${mode}`);
    const materials = measureSet(MATERIALS.map((p) => ({ name: p.name, color: lin(p.lch[mode]) })), mode);
    assert.deepEqual(materials.failures, [], `materiales en ${mode}`);
  }
});

test("los roles son más sobrios que el acento", () => {
  for (const mode of MODES) {
    const accent = lchOfColor(THEME[mode].accent)[1];
    for (const r of ROLES) assert.ok(r.lch[mode][1] < accent, `${r.name} en ${mode}`);
  }
});

test("theme.css lleva el bloque de pinturas generado y los mismos colores base que el espejo del tema", () => {
  assert.ok(css.includes(themeBlock()), "regenera el bloque con themeBlock() si cambiaste sets.ts");
  for (const [mode, sel] of [["light", /^:where\(\.isofig\) \{([\s\S]*?)\n\}/m], ["dark", /:where\(:root\[data-theme="dark"\] \.isofig\) \{([\s\S]*?)\n\}/m]] as const) {
    const block = sel.exec(css)![1];
    for (const [k, v] of Object.entries(THEME[mode])) {
      if (k === "ok" || k === "warn" || k === "fail" || k === "accent" || k === "paper" || k === "card" || k === "edge" || k === "light" || k === "shade") {
        assert.match(block, new RegExp(`--isofig-${k}: ${v};`), `${mode} ${k}`);
      }
    }
  }
});

test("sin paint el SVG no cambia; con paint la pieza lleva su atributo corto", () => {
  const plain = renderFigure(tokenBucket, { lang: "es" });
  assert.doesNotMatch(plain.html, /data-paint|style="--isofig/);
  const r = renderFigure(figure([box("a", 0, { paint: "steel" }), box("b", 14, { paint: "data", tone: "hi" })]));
  assert.match(r.svg, /<(g|use)[^>]* class="mid" data-paint="steel"/);
  assert.match(r.svg, /<(g|use)[^>]* class="hi" data-paint="data"/);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(validateSpec(figure([box("a", 0, { paint: "steel" })])).filter((i) => i.severity !== "info"), []);
});

test("el acento gana sobre la pintura y las copias con use también llevan la pintura", () => {
  const r = renderFigure(figure([box("a", 0, { paint: "steel", tone: "lit" })]));
  assert.match(r.svg, /<g class="lit">/);
  const rep = renderFigure(
    figure([{ id: "c-{i}", kind: "box", at: [0, 0, 0], size: [20, 20, 14], radius: 3, bevel: 1, paint: "copper", repeat: { count: 3, step: [0, 30, 0] } } as Part]),
  );
  assert.equal((rep.svg.match(/<use [^>]*data-paint="copper"/g) ?? []).length, 3);
});

test("el CSS deja ganar al estado y tiñe el canto con la pintura", () => {
  assert.match(css, /\.isofig-art \[data-paint\] \{\n {2}--c: var\(--sc, var\(--pc\)\);/);
  assert.match(css, /\.isofig-art \[data-paint\]:not\(\[data-state\]\) \{ --fx: var\(--pi\); \}/);
  for (const p of [...ROLES, ...MATERIALS]) assert.match(css, new RegExp(`\\[data-paint="${p.name}"\\] \\{ --pc: var\\(--isofig-paint-${p.name}\\)`));
});

const codes = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);

test("validateSpec avisa una pintura desconocida o de estado, y no se dibuja", () => {
  const spec = figure([box("a", 0, { paint: "stel" }), box("b", 14, { paint: "warn" })]);
  const issues = validateSpec(spec, { lang: "es" });
  const unknown = issues.find((i) => i.code === "paint-unknown")!;
  assert.equal(unknown.path, "parts[0].paint");
  assert.match(unknown.message, /«a» pinta con «stel», que no es un rol ni un material; ¿querías «steel»\?/);
  assert.equal(issues.find((i) => i.code === "paint-is-state")!.path, "parts[1].paint");
  const r = renderFigure(spec);
  assert.doesNotMatch(r.svg, /data-paint/);
  assert.ok(codes(r).includes("paint-unknown") && codes(r).includes("paint-is-state"));
  assert.match(r.issues.find((i) => i.code === "paint-is-state")!.message, /state color 'warn'/);
});

test("una pintura propia declarada en palette.use se dibuja con sus variables en línea", () => {
  const spec = figure([box("a", 0, { paint: "auth" })], { palette: { use: ["auth", "Mal!"] } });
  const r = renderFigure(spec);
  assert.match(r.svg, /data-paint="auth" style="--pc:var\(--isofig-paint-auth\);--pi:var\(--isofig-paint-auth-ink,var\(--isofig-ink\)\)"/);
  assert.ok(!codes(r).includes("paint-unknown"));
  assert.equal(r.issues.find((i) => i.code === "palette-use-invalid")!.path, "palette.use[1]");
  assert.deepEqual(legendOf(spec, "es"), [{ name: "auth", kind: "role", label: "auth", color: "var(--isofig-paint-auth)" }]);
});

test("más de seis colores se avisa; los grises cuentan como uno", () => {
  const roles = ROLES.map((p, i) => box(p.name, i * 14, { paint: p.name }));
  const r = renderFigure(figure([...roles, box("acc", 120, { tone: "lit" })]), { lang: "es" });
  assert.match(r.issues.find((i) => i.code === "palette-too-many-colors")!.message, /La figura usa 8 colores/);
  const metals = ["aluminium", "steel", "iron", "carbon", "rubber", "copper", "brass"].map((n, i) => box(n, i * 14, { paint: n }));
  assert.ok(!codes(renderFigure(figure(metals))).includes("palette-too-many-colors"));
});

test("dos pinturas que no se distinguen se avisan con su visión y su tema", () => {
  const r = renderFigure(figure([box("a", 0, { paint: "data" }), box("b", 14, { paint: "brass" })]), { lang: "es" });
  const issue = r.issues.find((i) => i.code === "paint-indistinct")!;
  assert.match(issue.message, /«data» y «brass» no se distinguen bien con .+ en el tema oscuro \(ΔE [\d.]+; mínimo \d+\)/);
  const ok = renderFigure(figure(ROLES.slice(0, 5).map((p, i) => box(p.name, i * 14, { paint: p.name }))));
  assert.ok(!codes(ok).some((c) => c.startsWith("paint") || c.startsWith("palette")), ok.warnings.join("\n"));
});

test("un rótulo en la cara lateral de una pintura oscura se avisa si no contrasta", () => {
  const parts: Part[] = [
    box("a", 0, { paint: "lacquer", size: [20, 20, 12] } as Partial<Part>),
    { id: "a-t", kind: "label", on: "a", at: [20.05, 4, 9], text: "laca", face: "x", size: 4 } as Part,
    box("b", 30, { paint: "lacquer", size: [20, 20, 12] } as Partial<Part>),
    { id: "b-t", kind: "label", on: "b", at: [34, 4, 12.05], text: "laca", size: 4 } as Part,
  ];
  const r = renderFigure(figure(parts));
  const low = r.issues.filter((i) => i.code === "paint-text-contrast");
  assert.equal(low.length, 1);
  assert.equal(low[0].path, "parts[1]");
  assert.match(low[0].message, /The label 'a-t' on 'a' \(lacquer\) has a contrast of [\d.]+:1 in the light theme/);
});

test("con la base por defecto salen los roles del tema; con otra marca, roles que cumplen", () => {
  const d = derivePalette(THEME.light.accent);
  for (const mode of MODES) assert.deepEqual(d.roles[mode].map((r) => r.lch), ROLES.map((r) => r.lch[mode]));
  for (const base of ["#3b82f6", "#e4572e", "#8b5cf6", "#ffcc00", "#16a34a", "#111111", "oklch(60% .15 330)"]) {
    const p = derivePalette(base);
    assert.ok(p.ok, `${base}: ${[...p.measures.light.failures, ...p.measures.dark.failures].join("; ")}`);
  }
  assert.deepEqual(derivePalette("#3B82F6").roles, derivePalette("#3b82f6").roles);
});

test("palette.base pone los roles en el figure y la leyenda los nombra en su idioma", () => {
  const spec = figure([box("a", 0, { paint: "client" }), box("b", 14, { paint: "data" }), box("c", 28, { paint: "steel" })], {
    palette: { base: "#3b82f6", use: ["data", "client"] },
  });
  const r = renderFigure(spec, { lang: "es" });
  assert.match(r.html, /<figure class="isofig" data-isofig="f" style="--isofig-paint-client:light-dark\(oklch\(/);
  assert.match(r.html, /--isofig-paint-client-ink:/);
  assert.doesNotMatch(r.html, /--isofig-paint-steel/);
  assert.deepEqual(paintsUsed(spec), ["data", "client", "steel"]);
  assert.deepEqual(
    legendOf(spec, "es").map((e) => [e.name, e.label, e.kind]),
    [["data", "datos", "role"], ["client", "cliente", "role"], ["steel", "acero", "material"]],
  );
  assert.equal(legendOf(spec, "pt")[0].label, "data");
  assert.equal(legendOf(spec, "en")[2].color, "var(--isofig-paint-steel)");
});

test("una base inválida se avisa y deja los roles del tema", () => {
  const r = renderFigure(figure([box("a", 0, { paint: "client" })], { palette: { base: "verde" } }), { lang: "es" });
  assert.doesNotMatch(r.html, /style="--isofig/);
  const issue = r.issues.find((i) => i.code === "palette-base-invalid")!;
  assert.equal(issue.path, "palette.base");
  assert.match(issue.message, /palette\.base debe ser un color/);
});

test("isofig palette da CSS y JSON con las medidas", () => {
  const d = derivePalette("#e4572e");
  const out = paletteCss(d);
  assert.match(out, /^\/\* isofig palette --base #e4572e \*\/\n\.isofig \{\n {2}--isofig-paint-client: light-dark\(oklch/);
  const json = paletteJson(d);
  assert.equal(json.ok, true);
  assert.equal(Object.keys(json.light).length, ROLES.length);
  assert.ok(json.dark["data"].text >= 4.5);
});

test("names.ts y sets.ts nombran las mismas pinturas, en el mismo orden (el giro solo lleva los nombres)", () => {
  assert.deepEqual(ROLES.map((p) => p.name), [...ROLE_NAMES]);
  assert.deepEqual(MATERIALS.map((p) => p.name), [...MATERIAL_NAMES]);
  assert.deepEqual([...PAINT_NAMES].sort(), PAINTS.map((p) => p.name).sort());
  assert.deepEqual([...PAINT_NAMES].sort(), [...PAINT.keys()].sort());
  assert.equal(RESERVED.some((n) => PAINT_NAMES.has(n)), false, "un estado no es una pintura");
});
