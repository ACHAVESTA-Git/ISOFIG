import type { Camera } from "./camera.ts";
import { makeIssue, type Issue } from "./issues.ts";
import type { Item } from "./items.ts";
import { cross, dot } from "./math.ts";
import { FACES } from "./scene.ts";
import { textOf } from "./spec.ts";

const TOUCH = 0.6;
const SUNK = 0.8;

const gap = (a: Item, b: Item, i: number) => Math.max(a.box.min[i] - b.box.max[i], b.box.min[i] - a.box.max[i]);
const depthInside = (a: Item, b: Item, i: number) =>
  Math.min(a.box.max[i], b.box.max[i]) - Math.max(a.box.min[i], b.box.min[i]);

/**
 * Revisión barata sobre cajas: piezas que flotan sin tocar nada y piezas hundidas unas en otras.
 * Los grupos ocultos al inicio (piezas de un depósito, por ejemplo) no cuentan.
 */
export function audit(items: Item[], lang = "en", apart?: (a: Item, b: Item) => boolean): Issue[] {
  const live = items.filter((i) => !i.hidden);
  const out: Issue[] = [];
  for (const a of live) {
    if (a.float || a.box.min[2] <= 0.01) continue;
    const touches = live.some((b) => b !== a && [0, 1, 2].every((i) => gap(a, b, i) <= TOUCH));
    if (!touches) out.push(makeIssue(lang, "part-floats", `parts[${a.source}]`, { id: a.id }));
  }
  for (let x = 0; x < live.length; x++) {
    for (let y = x + 1; y < live.length; y++) {
      const a = live[x];
      const b = live[y];
      if (a.mount.includes(b.id) || b.mount.includes(a.id)) continue;
      // Las cajas de una pieza inclinada exageran: `apart` mira sus caras antes de decir que se atraviesan.
      if ([0, 1, 2].every((i) => depthInside(a, b, i) > SUNK) && !apart?.(a, b)) {
        out.push(makeIssue(lang, "parts-overlap", `parts[${a.source}]`, { a: a.id, b: b.id }));
      }
    }
  }
  return out.slice(0, 40);
}

/**
 * Ancho al que se mide cada rótulo, en px de pantalla del SVG: el de un celular de 390 px (medido: 326) y el de la vista
 * ampliada que abre el chip «Ampliar» (unos 1150).
 */
export const LABEL_WIDTHS = { phone: 326, zoomed: 1150 };

/**
 * Mínimos legibles, en px de la letra. El de la vista ampliada (9) deja fuera los rótulos que ni ampliados se leen.
 * Medido en 114 figuras con rótulos: ampliada, la mediana llega a 11,7 px y el 10 % menor queda bajo 8,2 px; con 9
 * avisan 34 figuras y con 11, 65: demasiadas para el contenido que ya existe. El del celular (9) es solo informativo:
 * ahí las 114 quedan bajo 9 px, así que se resume.
 */
export const LABEL_MIN_PX = { zoomed: 9, phone: 9 };

export interface LabelOptions {
  /** Ancho de la figura en pantalla, en px, en un celular y en la vista ampliada. */
  widths?: { phone?: number; zoomed?: number };
  /** Mínimos de legibilidad, en px, en la vista ampliada y en el celular. */
  min?: { zoomed?: number; phone?: number };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Un rótulo de un nodo girado que cae en una cara de espaldas a la cámara o casi de canto se leería al revés o no se vería. */
function labelsAway(items: Item[], cam: Camera, lang: string): Issue[] {
  return items.flatMap((item) =>
    item.details.flatMap((d, k) =>
      d.kind === "label" && d.axes && dot(cross(d.axes[1], d.axes[0]), cam.view) < 0.2
        ? [makeIssue(lang, "label-faces-away", `parts[${item.detailSource[k]}]`, { id: d.id })]
        : [],
    ),
  );
}

/**
 * El tamaño que cada rótulo tiene en pantalla: `size × escala de la cámara × (ancho en pantalla / ancho del viewBox)`,
 * por el acortamiento de su cara (un rótulo tumbado en el piso se ve más bajo que uno de pie). Coincide con lo medido
 * en el navegador. Avisa si alguno queda bajo el mínimo incluso ampliado; si solo queda bajo en el celular, resume.
 */
export function auditLabels(items: Item[], cam: Camera, viewBoxWidth: number, lang = "en", options: LabelOptions = {}): Issue[] {
  return [...labelsAway(items, cam, lang), ...labelSizes(items, cam, viewBoxWidth, lang, options)];
}

function labelSizes(items: Item[], cam: Camera, viewBoxWidth: number, lang: string, options: LabelOptions): Issue[] {
  const widths = { ...LABEL_WIDTHS, ...options.widths };
  const min = { ...LABEL_MIN_PX, ...options.min };
  const labels = items.flatMap((item) =>
    item.details.flatMap((d, k) => {
      if (d.kind !== "label") return [];
      const [, down] = d.axes ?? FACES[d.face ?? "top"];
      const size = d.size ?? 6;
      const px = size * cam.scale * Math.hypot(dot(cam.right, down), dot(cam.down, down));
      const label = { id: d.id, text: textOf(d.text, lang) || d.id, size, phone: (px * widths.phone) / viewBoxWidth, zoomed: (px * widths.zoomed) / viewBoxWidth, source: item.detailSource[k] };
      return [label];
    }),
  );
  type Label = (typeof labels)[number];
  const smallest = (by: (l: Label) => number, limit: number) => {
    const small = labels.filter((l) => by(l) < limit);
    return small.length ? { small, worst: small.reduce((a, b) => (by(b) < by(a) ? b : a)) } : undefined;
  };
  const zoomed = smallest((l) => l.zoomed, min.zoomed);
  if (zoomed) {
    const { small, worst } = zoomed;
    return [
      makeIssue(lang, "label-unreadable", `parts[${worst.source}].size`, {
        count: small.length, total: labels.length, min: min.zoomed, text: worst.text,
        zoomed: r1(worst.zoomed), mobile: r1(worst.phone), need: Math.ceil((worst.size * min.zoomed * 10) / worst.zoomed) / 10,
      }),
    ];
  }
  const phone = smallest((l) => l.phone, min.phone);
  if (!phone) return [];
  const { small, worst } = phone;
  return [makeIssue(lang, "label-small-mobile", `parts[${worst.source}].size`, { count: small.length, total: labels.length, min: min.phone, text: worst.text, mobile: r1(worst.phone) })];
}
