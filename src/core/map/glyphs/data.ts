import { box, cyl, dots, line, prism, ROLE, ticks } from "../parts.ts";
import { facing, stadium, type GlyphFn } from "./kit.ts";

/** Una pila de discos: lo que se escribe queda grabado y no se pierde al apagar. */
export const database: GlyphFn = ({ az }) => {
  const [cx, cy, r] = [17, 17, 15.5];
  const disk = 9;
  const gap = 1.3;
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const z = i * (disk + gap);
    parts.push(cyl(`disk-${i}`, [cx, cy, z], r, disk, { paint: ROLE, bevel: 0.8 }));
    const led = [facing(cx, cy, r, az, -16), facing(cx, cy, r, az, 4)].map(([x, y]): [number, number, number] => [x, y, z + disk / 2]);
    parts.push(dots(`leds-${i}`, `disk-${i}`, led));
    if (i < 2) parts.push(cyl(`spacer-${i}`, [cx, cy, z + disk], r - 1.6, gap, { tone: "lo" }));
  }
  return { d: 34, w: 34, h: 3 * disk + 2 * gap, parts };
};

/** Dos módulos de memoria en su zócalo: rápidos, cerca del que los usa, y se vacían si se corta la luz. */
export const cache: GlyphFn = () => {
  const stick = (i: number) => {
    const x = 4 + i * 11;
    return [
      box(`stick-${i}`, [x, 4, 3.5], [2.6, 38, 17], { paint: ROLE, radius: 1, bevel: 0.4 }),
      ...[0, 1, 2].map((k) => box(`chip-${i}-${k}`, [x + 2.6, 7.5 + k * 11.5, 8.5], [0.8, 9, 8], { tone: "lo", radius: 0.8 })),
      line(`gold-${i}`, `stick-${i}`, [[x + 2.6, 5, 4.6], [x + 2.6, 41, 4.6]], true),
    ];
  };
  return {
    d: 26,
    w: 46,
    h: 21,
    parts: [box("socket", [0, 0, 0], [26, 46, 3.5], { tone: "lo", radius: 2, bevel: 0.6 }), ...stick(0), ...stick(1)],
  };
};

/** Una cinta transportadora con paquetes: lo que llega espera su turno y sale en el mismo orden. */
export const queue: GlyphFn = () => ({
  d: 26,
  w: 56,
  h: 16,
  parts: [
    box("frame", [1, 1, 0], [24, 54, 4], { paint: ROLE, radius: 2.4, bevel: 0.8 }),
    prism("belt", stadium(13, 28, 52, 17), 4, 2.4, { tone: "lo", bevel: 0.5 }),
    ticks("cleats", "belt", { from: [5.2, 8, 6.4], along: [0, 4, 0], count: 13, toward: [1, 0, 0], size: [15.6, 15.6] }),
    ...[0, 1, 2].flatMap((i) => [
      box(`parcel-${i}`, [4.4, 9 + i * 14, 6.4], [8.4, 9.2, 7.4], { paint: ROLE, radius: 1.2, bevel: 0.5 }),
      line(`tape-${i}`, `parcel-${i}`, [[4.4, 13.6 + i * 14, 13.8], [12.8, 13.6 + i * 14, 13.8]], true),
    ]),
  ],
});

/** Un balde con archivos asomados: se guarda lo que sea, tal cual, sin estructura. */
export const storage: GlyphFn = () => {
  const [cx, cy] = [17, 17];
  const tiers = [10, 11.6, 13.2, 14.8];
  return {
    d: 34,
    w: 34,
    h: 36,
    parts: [
      ...tiers.map((r, i) => cyl(`tier-${i}`, [cx, cy, i * 6], r, 6, { paint: ROLE, bevel: 0.5 })),
      cyl("rim", [cx, cy, 24], 15.8, 2.6, { tone: "hi", bevel: 0.5 }),
      cyl("fill", [cx, cy, 26.6], 13, 0.8, { tone: "lo" }),
      box("file-0", [13, 10, 27.4], [1.4, 7, 9], { tone: "hi", radius: 0.5 }),
      box("file-1", [16, 17, 27.4], [1.4, 7, 7], { tone: "hi", radius: 0.5 }),
      box("file-2", [14, 23, 27.4], [1.4, 6, 8.5], { tone: "hi", radius: 0.5 }),
    ],
  };
};

/** Una nube: algo que no es nuestro y que usamos desde fuera. */
export const external: GlyphFn = () => ({
  d: 34,
  w: 54,
  h: 15,
  parts: [
    box("base", [0, 0, 0], [34, 54, 5], { paint: ROLE, radius: 15, bevel: 1 }),
    cyl("puff-0", [9, 10, 5], 7, 5.5, { paint: ROLE, bevel: 1.4 }),
    cyl("puff-1", [19, 27, 5], 11, 9, { paint: ROLE, bevel: 2, mount: ["puff-0", "puff-2"] }),
    cyl("puff-2", [9, 44, 5], 7, 5, { paint: ROLE, bevel: 1.4 }),
  ],
});
