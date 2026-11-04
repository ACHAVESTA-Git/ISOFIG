import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOverrides, OverridesError, type FigureOverrides } from "../src/core/overrides.ts";
import { ISSUE_SEVERITIES, makeIssue } from "../src/core/issues.ts";
import { renderFigure } from "../src/core/render.ts";
import { validateSpec } from "../src/core/validate.ts";
import * as api from "../src/core/index.ts";
import type { FigureSpec, PresetSpec } from "../src/core/spec.ts";

const spec: FigureSpec = {
  id: "bomba",
  title: "Bomba",
  caption: "Pie original.",
  params: [
    { id: "caudal", label: "Caudal", min: 0.5, max: 6, step: 0.5, value: 2 },
    { id: "luz", label: "Luz", kind: "toggle", min: 0, max: 1, value: 0 },
    { id: "modo", label: "Modo", kind: "choice", options: ["a", "b", "c"], min: 0, max: 2, value: 0 },
    { id: "purgar", label: "Purgar", kind: "action", min: 0, max: 99, value: 0 },
    { id: "fijo", label: "Fijo", min: 0, max: 9, value: 4, hidden: true },
  ],
  presets: [{ label: "Original", values: { caudal: 1 }, note: "La de la spec." }],
  parts: [{ id: "a", kind: "box", at: [0, 0, 0], size: [4, 4, 4] }],
};

/** El error que lanza applyOverrides: sus problemas con código y path, y el mensaje que los junta. */
const fail = (overrides: FigureOverrides, lang?: string) => {
  try {
    applyOverrides(spec, overrides, { lang });
  } catch (e) {
    assert.ok(e instanceof OverridesError);
    return { issues: e.issues, message: e.message, codes: e.issues.map((i) => `${i.code}@${i.path}`) };
  }
  return assert.fail("debía lanzar");
};

test("applyOverrides y OverridesError se exportan desde isofig", () => {
  assert.equal(api.applyOverrides, applyOverrides);
  assert.equal(api.OverridesError, OverridesError);
});

test("cambia valores iniciales, sustituye desvíos y no toca la spec original", () => {
  const frozen = structuredClone(spec);
  const out = applyOverrides(spec, {
    values: { caudal: 4.5, luz: 1, modo: 2 },
    presets: [{ label: "Rápido", values: { caudal: 6 }, note: "Sube.", reset: true }],
  });
  assert.deepEqual(spec, frozen);
  assert.deepEqual(out.params?.map((p) => p.value), [4.5, 1, 2, 0, 4]);
  assert.deepEqual(out.presets, [{ label: "Rápido", values: { caudal: 6 }, note: "Sube.", reset: true }]);
  assert.equal(out.id, "bomba");
  // La copia no comparte objetos con lo que entró ni con la original.
  assert.notEqual(out.params?.[0], spec.params?.[0]);
  assert.equal(out.parts, spec.parts);
});

test("sin nada que aplicar devuelve la misma spec", () => {
  assert.equal(applyOverrides(spec, {}), spec);
  assert.equal(applyOverrides(spec), spec);
});

test("oculta controles y cambia título y pie; el render lo refleja", () => {
  const out = applyOverrides(spec, { hide: ["caudal"], title: { es: "Otra", en: "Other" }, caption: "Pie nuevo." });
  const r = renderFigure(out, { lang: "es" });
  assert.doesNotMatch(r.html, /data-param="caudal"/);
  assert.match(r.html, /data-param="luz"/);
  assert.match(r.html, /Otra/);
  assert.match(r.html, /Pie nuevo\./);
  assert.equal(r.data.params[0].value, 2, "oculto no es quitado: el modelo lo recibe");
});

test("el valor nuevo llega al control y al JSON del runtime", () => {
  const r = renderFigure(applyOverrides(spec, { values: { caudal: 5 } }));
  assert.match(r.html, /data-param="caudal" min="0.5" max="6" step="0.5" value="5"/);
  assert.equal(r.data.params[0].value, 5);
});

test("rango y paso salen con los códigos y mensajes de validateSpec, en inglés y en español", () => {
  assert.deepEqual(fail({ values: { caudal: 7 } }).codes, ["param-value-out-of-range@values.caudal"]);
  assert.deepEqual(fail({ values: { caudal: 0 } }).codes, ["param-value-out-of-range@values.caudal"]);
  assert.deepEqual(fail({ values: { caudal: 2.3 } }).codes, ["param-value-off-step@values.caudal"]);
  // Sin step el paso es 1.
  assert.deepEqual(fail({ values: { fijo: 2.5 } }).codes, ["param-value-off-step@values.fijo"]);
  for (const lang of ["en", "es"]) {
    const direct = validateSpec({ ...spec, params: spec.params!.map((p) => (p.id === "caudal" ? { ...p, value: 7 } : p)) }, { lang }).find((i) => i.code === "param-value-out-of-range")!;
    assert.equal(fail({ values: { caudal: 7 } }, lang).issues[0].message, direct.message);
  }
  assert.match(fail({ values: { caudal: 7 } }).message, /'caudal' starts at 7, outside its range 0\.5 to 6: the slider would show 6/);
  assert.match(fail({ values: { caudal: 7 } }, "es").message, /«caudal» arranca en 7, fuera de su rango 0\.5 a 6: el deslizante mostraría 6/);
  assert.doesNotThrow(() => applyOverrides(spec, { values: { caudal: 6 } }));
  assert.doesNotThrow(() => applyOverrides(spec, { values: { caudal: 0.5 } }));
  // 0.1 + 0.2 no es 0.3 en coma flotante: no debe dar falso error.
  const fine: FigureSpec = { ...spec, params: [{ id: "x", label: "x", min: 0, max: 1, step: 0.1, value: 0 }] };
  assert.doesNotThrow(() => applyOverrides(fine, { values: { x: 0.1 + 0.2 } }));
});

test("interruptores, selectores y valores que no son número", () => {
  assert.deepEqual(fail({ values: { luz: 2 } }).codes, ["toggle-value-invalid@values.luz"]);
  assert.deepEqual(fail({ values: { modo: 3 } }).codes, ["choice-value-invalid@values.modo"]);
  assert.deepEqual(fail({ values: { modo: 1.5 } }).codes, ["choice-value-invalid@values.modo"]);
  assert.deepEqual(fail({ values: { caudal: "3" as never } }).codes, ["param-number-invalid@values.caudal"]);
  assert.deepEqual(fail({ values: { caudal: NaN } }).codes, ["param-number-invalid@values.caudal"]);
});

test("un parámetro que no existe se nombra con una sugerencia y los que sí existen", () => {
  const { issues, message } = fail({ values: { caudall: 1 }, hide: ["nada"] });
  assert.deepEqual(issues.map((i) => [i.code, i.path, i.severity]), [
    ["override-unknown-param", "values.caudall", "error"],
    ["override-unknown-param", "hide[0]", "error"],
  ]);
  assert.match(message, /applyOverrides «bomba»/);
  assert.match(message, /overrides\.values names 'caudall', which is not a parameter of the figure; did you mean 'caudal'\? Parameters: caudal, luz, modo, purgar, fijo\./);
  assert.match(fail({ hide: ["nada"] }, "es").message, /overrides\.hide nombra «nada», que no es un parámetro de la figura\. Parámetros: caudal/);
});

test("una acción no tiene valor inicial", () => {
  assert.deepEqual(fail({ values: { purgar: 1 } }).codes, ["override-action-value@values.purgar"]);
  assert.match(fail({ values: { purgar: 1 } }, "es").message, /«purgar» es una acción: no tiene valor inicial/);
});

test("los desvíos nuevos se revisan como los de la spec", () => {
  const preset = (extra: Partial<PresetSpec>) => ({ label: "P", values: { caudal: 1 }, note: "n", ...extra }) as PresetSpec;
  assert.deepEqual(fail({ presets: [preset({ values: { caudal: 99 } })] }).codes, ["preset-value-out-of-range@presets[0].values.caudal"]);
  assert.deepEqual(fail({ presets: [preset({ values: { caudal: 1.2 } })] }).codes, ["preset-value-off-step@presets[0].values.caudal"]);
  assert.deepEqual(fail({ presets: [preset({ values: { nada: 1 } })] }).codes, ["preset-unknown-param@presets[0].values.nada"]);
  assert.deepEqual(fail({ presets: [preset({ label: "" })] }).codes, ["preset-label-missing@presets[0].label"]);
  assert.deepEqual(fail({ presets: [preset({ note: "" })] }).codes, ["preset-note-missing@presets[0].note"]);
  assert.deepEqual(fail({ presets: [preset({ values: {} })] }).codes, ["preset-no-effect@presets[0]"]);
  assert.deepEqual(fail({ presets: [{ ...preset({}), values: "x" } as never] }).codes, ["type-invalid@presets[0].values", "preset-no-effect@presets[0]"]);
  assert.match(fail({ presets: [preset({ values: { caudal: 99 } })] }, "es").message, /presets\[0\]\.values\.caudal: El desvío fija «caudal» en 99, fuera de su rango 0\.5 a 6/);
});

test("press debe nombrar acciones", () => {
  const pressing = (...press: string[]) => ({ label: "Purga", values: {}, note: "x", press }) as PresetSpec;
  assert.doesNotThrow(() => applyOverrides(spec, { presets: [pressing("purgar")] }));
  assert.deepEqual(fail({ presets: [pressing("caudal")] }).codes, ["preset-press-invalid@presets[0].press[0]"]);
  assert.deepEqual(fail({ presets: [pressing("nada")] }).codes, ["preset-press-invalid@presets[0].press[0]"]);
});

test("junta todos los problemas en un solo error", () => {
  const { issues, message } = fail({ values: { caudal: 9, luz: 5 }, hide: ["nada"] });
  assert.equal(issues.length, 3);
  assert.equal(message.split("\n").length, 4, message);
});

test("solo cuenta lo que el cambio tocó: un problema que ya traía la spec no lo lanza applyOverrides", () => {
  const sloppy: FigureSpec = { ...spec, params: spec.params!.map((p) => (p.id === "caudal" ? { ...p, value: 99 } : p)) };
  assert.ok(validateSpec(sloppy).some((i) => i.code === "param-value-out-of-range"));
  assert.doesNotThrow(() => applyOverrides(sloppy, { values: { luz: 1 } }));
  assert.throws(() => applyOverrides(sloppy, { values: { caudal: 98 } }), OverridesError);
});

test("los dos códigos propios existen con gravedad error y mensaje en los dos idiomas", () => {
  for (const code of ["override-unknown-param", "override-action-value"] as const) {
    assert.equal(ISSUE_SEVERITIES[code], "error");
    assert.notEqual(makeIssue("en", code, "x").message, makeIssue("es", code, "x").message);
  }
});

test("una spec sin parámetros dice que no hay ninguno", () => {
  const bare: FigureSpec = { id: "sola", title: "t", parts: [] };
  assert.throws(() => applyOverrides(bare, { values: { x: 1 } }), /Parameters: none\./);
  assert.throws(() => applyOverrides(bare, { values: { x: 1 } }, { lang: "es" }), /Parámetros: ninguno\./);
});
