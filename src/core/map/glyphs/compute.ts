import { box, cyl, dots, prism, rectPlan, ROLE, ticks } from "../parts.ts";
import type { GlyphFn } from "./kit.ts";

/** Una caja con un engranaje encima: algo que trabaja con lo que le llega. */
export const service: GlyphFn = () => {
  const [cx, cy, z] = [17, 18, 17];
  const tooth = (deg: number, i: number) => {
    const a = (deg * Math.PI) / 180;
    return prism(`tooth-${i}`, rectPlan(cx + 9.4 * Math.cos(a), cy + 9.4 * Math.sin(a), 4.2, 3.6, deg), z, 4, { tone: "hi" });
  };
  return {
    d: 34,
    w: 36,
    h: 25,
    parts: [
      box("body", [0, 0, 0], [34, 36, z], { paint: ROLE, radius: 2, bevel: 0.8 }),
      box("panel", [34, 4, 3], [0.6, 28, 11], { tone: "lo", radius: 1 }),
      ticks("vents", "panel", { from: [34.6, 6, 5], along: [0, 2.6, 0], count: 7, toward: [0, 0, 1], every: 1, size: [7, 7] }),
      dots("led", "panel", [[34.6, 28, 12]]),
      cyl("gear", [cx, cy, z], 8, 4, { tone: "hi", bevel: 0.6, mount: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `tooth-${i}`) }),
      ...[0, 45, 90, 135, 180, 225, 270, 315].map(tooth),
      cyl("axle", [cx, cy, z + 4], 3, 1.8, { tone: "lo", bevel: 0.4 }),
    ],
  };
};

/** Un rack con tres unidades: una máquina de verdad, con sus ranuras y sus luces. */
export const server: GlyphFn = () => {
  const bay = (i: number) => {
    const z = 3 + i * 13.4;
    return [
      box(`bay-${i}`, [30, 3, z], [0.8, 30, 11.6], { tone: "lo", radius: 1, bevel: 0.3 }),
      ticks(`slots-${i}`, `bay-${i}`, { from: [30.8, 6, z + 2.4], along: [0, 2.2, 0], count: 9, toward: [0, 0, 1], every: 1, size: [6.6, 6.6] }),
      dots(`led-${i}`, `bay-${i}`, [[30.8, 29.2, z + 8.6]]),
    ];
  };
  return {
    d: 31,
    w: 36,
    h: 44,
    parts: [box("rack", [0, 0, 0], [30, 36, 44], { paint: ROLE, radius: 1.6, bevel: 0.8 }), ...[0, 1, 2].flatMap(bay)],
  };
};

/** Un chip con sus patas y una λ: una función que nace, hace lo suyo y se apaga. */
export const fn: GlyphFn = ({ s }) => ({
  d: 32,
  w: 32,
  h: 9,
  parts: [
    box("board", [0, 0, 0], [32, 32, 1.4], { tone: "lo", radius: 1.4 }),
    box("chip", [5, 5, 1.4], [22, 22, 4], { paint: ROLE, radius: 1.6, bevel: 0.6 }),
    box("die", [10, 10, 5.4], [12, 12, 1.4], { tone: "hi", radius: 1, bevel: 0.3 }),
    ticks("pins-n", "chip", { from: [5, 8, 3.4], along: [0, 3.2, 0], count: 6, toward: [-1, 0, 0], every: 1, size: [3.6, 3.6] }),
    ticks("pins-s", "chip", { from: [27, 8, 3.4], along: [0, 3.2, 0], count: 6, toward: [1, 0, 0], every: 1, size: [3.6, 3.6] }),
    ticks("pins-w", "chip", { from: [8, 5, 3.4], along: [3.2, 0, 0], count: 6, toward: [0, -1, 0], every: 1, size: [3.6, 3.6] }),
    ticks("pins-e", "chip", { from: [8, 27, 3.4], along: [3.2, 0, 0], count: 6, toward: [0, 1, 0], every: 1, size: [3.6, 3.6] }),
    dots("notch", "chip", [[8, 8, 5.4]]),
    { id: "lambda", kind: "label", on: "die", at: [16 + s * 0.3, 16, 6.8], text: "λ", size: s * 0.95, face: "top", align: "middle" },
  ],
});
