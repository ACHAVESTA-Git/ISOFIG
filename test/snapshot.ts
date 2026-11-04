import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SNAPSHOTS = join(resolve(dirname(fileURLToPath(import.meta.url))), "snapshots");

/** Un SVG o HTML con una etiqueta por línea: así git y el informe de diferencias muestran qué pieza cambió. */
export const pretty = (markup: string): string => markup.replace(/></g, ">\n<") + "\n";

interface Change {
  type: "-" | "+" | " ";
  line: string;
  at: [number, number];
}

/** Las líneas que sobran (-), las que faltan (+) y las comunes, con el número de línea en cada archivo. */
function changes(want: string[], got: string[]): Change[] | null {
  let head = 0;
  while (head < want.length && head < got.length && want[head] === got[head]) head++;
  let tail = 0;
  while (tail < want.length - head && tail < got.length - head && want[want.length - 1 - tail] === got[got.length - 1 - tail]) tail++;
  const a = want.slice(head, want.length - tail);
  const b = got.slice(head, got.length - tail);
  // Si lo que cambió es enorme, el algoritmo exacto cuesta más de lo que ayuda: se resume.
  if (a.length * b.length > 4_000_000) return null;
  const width = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * width + j] = a[i] === b[j] ? lcs[(i + 1) * width + j + 1]! + 1 : Math.max(lcs[(i + 1) * width + j]!, lcs[i * width + j + 1]!);
    }
  }
  const out: Change[] = want.slice(0, head).map((line, i) => ({ type: " ", line, at: [i + 1, i + 1] }));
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const at: [number, number] = [head + i + 1, head + j + 1];
    if (i < a.length && j < b.length && a[i] === b[j]) out.push({ type: " ", line: a[i++]!, at }), j++;
    else if (i < a.length && (j === b.length || lcs[(i + 1) * width + j]! >= lcs[i * width + j + 1]!)) out.push({ type: "-", line: a[i++]!, at });
    else out.push({ type: "+", line: b[j++]!, at });
  }
  for (let k = 0; k < tail; k++) out.push({ type: " ", line: want[want.length - tail + k]!, at: [want.length - tail + k + 1, got.length - tail + k + 1] });
  return out;
}

const clip = (s: string, n = 160): string => (s.length > n ? `${s.slice(0, n)}… (+${s.length - n})` : s);

/** Las diferencias en hunks con dos líneas de contexto: `-` es lo esperado, `+` lo que salió. */
export function diffText(want: string, got: string, hunks = 6): string {
  const w = want.split("\n");
  const g = got.split("\n");
  const all = changes(w, g);
  if (!all) return `Cambió demasiado para listarlo: ${w.length} líneas esperadas, ${g.length} obtenidas.`;
  const shown = new Set<number>();
  all.forEach((c, k) => {
    if (c.type !== " ") for (let d = -2; d <= 2; d++) shown.add(k + d);
  });
  const lines: string[] = [];
  let count = 0;
  let last = -2;
  let skipped = 0;
  all.forEach((c, k) => {
    if (!shown.has(k)) return;
    if (k !== last + 1) {
      if (++count > hunks) return void skipped++;
      lines.push(`@@ esperado ${c.at[0]}, obtenido ${c.at[1]} @@`);
    }
    last = k;
    if (count <= hunks) lines.push(`${c.type} ${clip(c.line)}`);
  });
  const removed = all.filter((c) => c.type === "-").length;
  const added = all.filter((c) => c.type === "+").length;
  return [`${removed} líneas distintas en lo esperado, ${added} en lo obtenido:`, ...lines, skipped ? `… y ${skipped} bloques más` : ""].filter(Boolean).join("\n");
}

/**
 * Compara `actual` con `test/snapshots/<name>`. Con `UPDATE_SNAPSHOTS=1` lo escribe en lugar de comparar; sin archivo
 * (o con otro contenido) falla con las líneas que cambian.
 */
export function expectSnapshot(name: string, actual: string): void {
  const file = join(SNAPSHOTS, name);
  if (process.env["UPDATE_SNAPSHOTS"]) {
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file) || readFileSync(file, "utf8") !== actual) writeFileSync(file, actual);
    return;
  }
  assert.ok(existsSync(file), `Falta la instantánea test/snapshots/${name}. Si el ejemplo es nuevo, créala con UPDATE_SNAPSHOTS=1 npm test`);
  const want = readFileSync(file, "utf8");
  if (want === actual) return;
  assert.fail(`${name} cambió.\n${diffText(want, actual)}\nSi el cambio es a propósito: UPDATE_SNAPSHOTS=1 npm test, y revisa el diff de git.`);
}
