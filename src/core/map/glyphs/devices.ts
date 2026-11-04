import { box, cyl, dots, line, ROLE, ticks } from "../parts.ts";
import type { GlyphFn } from "./kit.ts";

/** Dos personas de ajedrez: una detrás y una delante, para que se lea «gente» y no «un punto». */
export const user: GlyphFn = () => {
  const pawn = (id: string, cx: number, cy: number, body: number, head: number) => [
    cyl(`${id}-base`, [cx, cy, 0], 8, 2.5, { tone: "lo", bevel: 0.6 }),
    cyl(`${id}-body`, [cx, cy, 2.5], 6 + body / 14, body, { paint: ROLE, bevel: 3 }),
    cyl(`${id}-head`, [cx, cy, 2.5 + body], 5 + head / 12, head, { paint: ROLE, bevel: 2 }),
  ];
  return { d: 26, w: 40, h: 28, parts: [...pawn("a", 11, 12, 14, 5.5), ...pawn("b", 17, 28, 17, 6)] };
};

/** Un celular de pie en su soporte, con la pantalla hacia el lector. */
export const phone: GlyphFn = () => ({
  d: 22,
  w: 26,
  h: 36,
  parts: [
    box("stand", [2, 3, 0], [18, 20, 2.5], { tone: "lo", radius: 2, bevel: 0.6 }),
    box("body", [9, 6, 2.5], [3.6, 14, 32], { paint: ROLE, radius: 2.4, bevel: 0.6 }),
    box("screen", [12.6, 7.2, 5.5], [0.5, 11.6, 25.5], { tone: "lo", radius: 0.6 }),
    ticks("ui", "screen", { from: [13.1, 8.6, 27.5], along: [0, 0, -3.4], count: 6, toward: [0, 1, 0], every: 1, size: [8.8, 8.8] }),
    dots("camera", "body", [[12.6, 13, 31.4]]),
    line("home", "body", [[12.6, 11, 4], [12.6, 15, 4]], true),
  ],
});

/** Un portátil abierto: el teclado con sus teclas y la tapa de pie con la pantalla hacia el lector. */
export const laptop: GlyphFn = () => ({
  d: 34,
  w: 46,
  h: 30,
  parts: [
    box("deck", [0, 0, 0], [34, 46, 2.5], { paint: ROLE, radius: 2, bevel: 0.6 }),
    box("lid", [0, 2, 2.5], [2.6, 42, 26], { paint: ROLE, radius: 1.6, bevel: 0.5 }),
    box("screen", [2.6, 4.4, 4.8], [0.5, 37.2, 21.4], { tone: "lo", radius: 0.8 }),
    ticks("ui", "screen", { from: [3.1, 7, 22], along: [0, 0, -3.6], count: 5, toward: [0, 1, 0], every: 1, size: [16, 16] }),
    ticks("key-rows", "deck", { from: [10, 5, 2.5], along: [4.6, 0, 0], count: 4, toward: [0, 1, 0], size: [36, 36] }),
    ticks("key-cols", "deck", { from: [8, 8.5, 2.5], along: [0, 3.5, 0], count: 10, toward: [1, 0, 0], size: [15.5, 15.5] }),
    line("pad", "deck", [[27, 17, 2.5], [27, 29, 2.5], [32, 29, 2.5], [32, 17, 2.5], [27, 17, 2.5]]),
  ],
});

/** Una ventana de navegador de pie: la barra con sus tres luces, la dirección y el contenido. */
export const browser: GlyphFn = () => ({
  d: 12,
  w: 56,
  h: 36,
  parts: [
    box("foot", [0, 14, 0], [12, 28, 2], { tone: "lo", radius: 1.5, bevel: 0.4 }),
    box("frame", [3, 0, 2], [4.4, 56, 34], { paint: ROLE, radius: 2.6, bevel: 0.6 }),
    box("bar", [7.4, 2.4, 28.6], [0.6, 51.2, 4.8], { tone: "mid", radius: 1 }),
    dots("lights", "bar", [[8, 6, 31], [8, 9.4, 31], [8, 12.8, 31]]),
    box("url", [8, 17, 29.4], [0.5, 30, 3.2], { tone: "hi", radius: 1.4 }),
    box("hero", [7.4, 3.6, 5], [0.6, 20, 20], { tone: "lo", radius: 1.4 }),
    box("card-a", [7.4, 26, 14.4], [0.6, 26, 10], { tone: "lo", radius: 1.4 }),
    ticks("text", "frame", { from: [8, 26.4, 11.4], along: [0, 0, -3.4], count: 3, toward: [0, 1, 0], every: 1, size: [22, 18] }),
  ],
});
