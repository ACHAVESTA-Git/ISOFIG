import { box, cyl, dots, line, prism, rectPlan, ROLE, ticks } from "../parts.ts";
import type { GlyphFn } from "./kit.ts";

/** Un globo sobre su pie: la red de entrega que está cerca de todos. */
export const cdn: GlyphFn = () => {
  const radii = [6.8, 10.9, 13, 13.9, 13.9, 13, 10.9, 6.8];
  const z0 = 7;
  const step = 3.5;
  return {
    d: 30,
    w: 30,
    h: z0 + step * radii.length,
    parts: [
      cyl("foot", [15, 15, 0], 11, 2.5, { tone: "lo", bevel: 0.6 }),
      cyl("stem", [15, 15, 2.5], 2.6, z0 - 2.5, { tone: "mid" }),
      ...radii.map((r, i) => cyl(`ball-${i}`, [15, 15, z0 + step * i], r, step, { paint: ROLE, bevel: 0.5 })),
      cyl("equator", [15, 15, z0 + step * 4 - 0.6], 14.6, 1.2, { tone: "hi", bevel: 0.3 }),
    ],
  };
};

/** Un carrusel de reparto: la plataforma gira y un brazo deja cada paquete en su carril. */
export const balancer: GlyphFn = () => {
  const [cx, cy] = [23, 23];
  const lane = (deg: number, i: number) => {
    const a = (deg * Math.PI) / 180;
    return prism(`vane-${i}`, rectPlan(cx + 11.2 * Math.cos(a), cy + 11.2 * Math.sin(a), 12.4, 2.2, deg), 5.5, 6, { tone: "hi" });
  };
  const parcel = (deg: number, i: number) => {
    const a = (deg * Math.PI) / 180;
    return box(`parcel-${i}`, [cx + 11.5 * Math.cos(a) - 2.8, cy + 11.5 * Math.sin(a) - 2.8, 5.5], [5.6, 5.6, 5], { paint: ROLE, radius: 0.8, bevel: 0.4 });
  };
  return {
    d: 46,
    w: 46,
    h: 26,
    parts: [
      cyl("base", [cx, cy, 0], 22, 3, { tone: "lo", bevel: 0.6 }),
      dots("studs", "base", Array.from({ length: 10 }, (_, i): [number, number, number] => [cx + 19.8 * Math.cos((i * Math.PI) / 5), cy + 19.8 * Math.sin((i * Math.PI) / 5), 3])),
      cyl("plate", [cx, cy, 3], 17.5, 2.5, { tone: "mid", bevel: 0.5 }),
      lane(90, 0),
      lane(210, 1),
      lane(330, 2),
      parcel(30, 0),
      parcel(150, 1),
      parcel(270, 2),
      cyl("hub", [cx, cy, 5.5], 4.4, 13, { tone: "hi", bevel: 0.8 }),
      prism("arm", rectPlan(cx + 5, cy + 5, 28, 4.6, 35), 18.5, 2.6, { paint: ROLE, bevel: 0.5 }),
    ],
  };
};

/** Un portal con barrera: todo lo que entra pasa por aquí y se levanta a quien corresponde. */
export const gateway: GlyphFn = () => ({
  d: 18,
  w: 52,
  h: 38,
  parts: [
    box("post-l", [3, 0, 0], [12, 7, 33], { paint: ROLE, radius: 1.4, bevel: 0.7 }),
    box("post-r", [3, 45, 0], [12, 7, 33], { paint: ROLE, radius: 1.4, bevel: 0.7 }),
    box("lintel", [1, 0, 33], [16, 52, 5], { paint: ROLE, radius: 1.6, bevel: 0.8 }),
    box("arm", [8, 7, 16], [2.6, 38, 3.6], { tone: "hi", radius: 1, bevel: 0.4 }),
    ticks("stripes", "arm", { from: [10.6, 9, 16], along: [0, 5, 0], count: 7, toward: [0, 0, 1], every: 1, size: [3.6, 3.6] }),
    cyl("lamp", [9, 26, 38], 2.2, 2.6, { tone: "lit", bevel: 0.5 }),
    line("seam", "lintel", [[17, 4, 38], [17, 48, 38]]),
  ],
});
