import type { FigureSpec } from "../../src/core/spec.ts";

const CAP = 8;
const COIN_Z = 14;
const COIN_STEP = 3.4;
const MAG: [number, number] = [36, 58];
const RAIL_X = 86;

export const layout = { CAP, COIN_Z, COIN_STEP, MAG, RAIL_X, NOZZLE_Z: 62, CART_Y: 18, SPLIT_Y: 112, GATE_Y: 136, END_Y: 226 };

const spec: FigureSpec = {
  id: "token-bucket",
  title: { en: "Token bucket", es: "Balde de fichas (token bucket)" },
  hint: { en: "Drag the sliders: refill vs. traffic", es: "Mueve los controles: recarga contra tráfico" },
  caption: {
    en: "Each request needs a token to pass the gate. Tokens refill at a fixed rate up to the bucket's capacity, so short bursts pass and sustained excess is rejected.",
    es: "Cada petición necesita una ficha para cruzar la compuerta. Las fichas se reponen a ritmo fijo hasta llenar el tubo: las ráfagas cortas pasan y el exceso sostenido se rechaza.",
  },
  width: 680,
  height: 430,
  pad: 18,
  camera: { azimuth: 38, elevation: 30 },
  model: "token-bucket",
  params: [
    { id: "refill", label: { en: "Refill", es: "Recarga" }, min: 0.5, max: 6, step: 0.5, value: 2, unit: { en: "tok/s", es: "fichas/s" } },
    { id: "rate", label: { en: "Traffic", es: "Tráfico" }, min: 0.5, max: 8, step: 0.5, value: 3, unit: "req/s" },
  ],
  groups: {
    refill: { extent: [[0, 0, -48]] },
    gate: { extent: [[0, 0, 18]] },
    ...Object.fromEntries([...Array(6).keys()].map((i) => [`cart-${i}`, { extent: [[0, 210, 0], [24, 94, 0]] }])),
  },
  parts: [
    { id: "foot", kind: "cylinder", at: [12, 12, 0], r: 5, h: 3, tone: "lo", bevel: 0.6, repeat: { count: 2, step: [106, 0, 0] } },
    { id: "foot-r", kind: "cylinder", at: [12, 248, 0], r: 5, h: 3, tone: "lo", bevel: 0.6, repeat: { count: 2, step: [106, 0, 0] } },
    { id: "base", kind: "box", at: [0, 0, 3], size: [130, 260, 8], radius: 7, bevel: 1.4, tone: "lo", shadow: true, mount: ["foot-0", "foot-1", "foot-r-0", "foot-r-1"] },
    { id: "base-screws", kind: "dots", on: "base", points: [[6, 6, 11], [124, 6, 11], [6, 254, 11], [124, 254, 11]] },

    { id: "ruler", kind: "box", at: [122, 20, 11], size: [6, 220, 1], radius: 1, tone: "mid" },
    { id: "ruler-ticks", kind: "ticks", on: "ruler", from: [122, 24, 12], along: [0, 4.25, 0], count: 51, every: 5, toward: [1, 0, 0], size: [2, 4] },

    { id: "plate", kind: "box", at: [10, 196, 11], size: [32, 50, 1.2], radius: 2, bevel: 0.4, tone: "hi" },
    { id: "plate-rules", kind: "line", on: "plate", points: [[18, 204, 12.2], [18, 238, 12.2]] },
    { id: "plate-rules-2", kind: "line", on: "plate", points: [[24, 204, 12.2], [24, 230, 12.2]] },
    { id: "plate-rules-3", kind: "line", on: "plate", points: [[30, 204, 12.2], [30, 222, 12.2]] },
    { id: "plate-screws", kind: "dots", on: "plate", points: [[13, 199, 12.2], [39, 199, 12.2], [13, 243, 12.2], [39, 243, 12.2]] },

    { id: "pedestal", kind: "cylinder", at: [MAG[0], MAG[1], 11], r: 19, h: 3, bevel: 0.8, tone: "mid" },
    { id: "ped-screws", kind: "dots", on: "pedestal", points: [[MAG[0] + 16, MAG[1], 14], [MAG[0] - 16, MAG[1], 14], [MAG[0], MAG[1] + 16, 14], [MAG[0], MAG[1] - 16, 14]] },
    { id: "post-back", kind: "cylinder", at: [MAG[0] - 17, MAG[1] - 4, 14], r: 2, h: 40, tone: "mid", mount: ["pedestal"] },
    { id: "post-left", kind: "cylinder", at: [MAG[0] + 4, MAG[1] - 17, 14], r: 2, h: 40, tone: "mid", mount: ["pedestal"] },
    { id: "post-right", kind: "cylinder", at: [MAG[0] - 4, MAG[1] + 17, 14], r: 2, h: 40, tone: "mid", mount: ["pedestal"] },
    { id: "knob-back", kind: "cylinder", at: [MAG[0] - 17, MAG[1] - 4, 54], r: 2.8, h: 2.4, bevel: 0.6, tone: "hi" },
    { id: "knob-left", kind: "cylinder", at: [MAG[0] + 4, MAG[1] - 17, 54], r: 2.8, h: 2.4, bevel: 0.6, tone: "hi" },
    { id: "knob-right", kind: "cylinder", at: [MAG[0] - 4, MAG[1] + 17, 54], r: 2.8, h: 2.4, bevel: 0.6, tone: "hi" },
    { id: "coin-{i}", kind: "cylinder", at: [MAG[0], MAG[1], COIN_Z], r: 14, h: 3, bevel: 0.7, tone: "lit", group: "coin-{i}", repeat: { count: CAP, step: [0, 0, COIN_STEP] }, mount: ["post-back", "post-left", "post-right"] },

    { id: "tower", kind: "box", at: [4, MAG[1] - 6, 11], size: [8, 12, 64], radius: 1, bevel: 0.6, tone: "mid", mount: ["base"] },
    { id: "tower-seams", kind: "line", on: "tower", points: [[12, MAG[1] - 6, 30], [12, MAG[1] + 6, 30]] },
    { id: "arm", kind: "box", at: [4, MAG[1] - 7, 75], size: [40, 14, 6], radius: 1.5, bevel: 0.8, tone: "mid", mount: ["tower"] },
    { id: "arm-screws", kind: "dots", on: "arm", points: [[8, MAG[1], 81], [40, MAG[1] - 4, 81], [40, MAG[1] + 4, 81]] },
    { id: "nozzle", kind: "cylinder", at: [MAG[0], MAG[1], 67], r: 6, h: 8, bevel: 0.6, tone: "hi", mount: ["arm"] },
    { id: "refill", kind: "cylinder", at: [MAG[0], MAG[1], 62], r: 14, h: 3, bevel: 0.7, tone: "lit", group: "refill", hidden: true, float: true },
    { id: "spent-{i}", kind: "cylinder", at: [MAG[0], MAG[1], 46], r: 9, h: 2.4, bevel: 0.6, tone: "lit", group: "spent-{i}", hidden: true, float: true, repeat: { count: 4, step: [0, 0, 0] } },

    { id: "rail", kind: "box", at: [RAIL_X, 14, 11], size: [8, 236, 3], radius: 1, bevel: 0.6, tone: "mid" },
    { id: "rail-groove", kind: "line", on: "rail", points: [[RAIL_X + 4, 18, 14], [RAIL_X + 4, 246, 14]] },
    { id: "stop", kind: "box", at: [RAIL_X - 2, 250, 11], size: [12, 6, 10], radius: 1, bevel: 0.8, tone: "hi" },
    { id: "pillar-a", kind: "box", at: [RAIL_X - 8, 132, 11], size: [5, 8, 30], radius: 1, bevel: 0.6, tone: "mid" },
    { id: "pillar-b", kind: "box", at: [RAIL_X + 11, 132, 11], size: [5, 8, 30], radius: 1, bevel: 0.6, tone: "mid" },
    { id: "lintel", kind: "box", at: [RAIL_X - 9, 131, 41], size: [26, 10, 5], radius: 1.5, bevel: 0.8, tone: "mid", mount: ["pillar-a", "pillar-b"] },
    { id: "lintel-screws", kind: "dots", on: "lintel", points: [[RAIL_X - 5, 136, 46], [RAIL_X + 13, 136, 46]] },
    { id: "gate", kind: "box", at: [RAIL_X - 3, 135, 14], size: [14, 2.4, 16], radius: 0.6, tone: "hi", group: "gate", mount: ["pillar-a", "pillar-b", "rail"] },
    { id: "gate-ribs", kind: "line", on: "gate", points: [[RAIL_X - 3, 137.4, 22], [RAIL_X + 11, 137.4, 22]] },

    { id: "tray", kind: "box", at: [100, 92, 11], size: [20, 40, 2], radius: 2, bevel: 0.5, tone: "lo" },
    { id: "tray-wall", kind: "box", at: [118, 92, 13], size: [3, 40, 5], radius: 1, tone: "mid", mount: ["tray"] },
    { id: "tray-ribs", kind: "ticks", on: "tray", from: [103, 96, 13], along: [0, 4, 0], count: 9, toward: [1, 0, 0], size: [12, 12] },

    { id: "cart-{i}", kind: "box", at: [RAIL_X - 1, 18, 14], size: [10, 14, 8], radius: 2, bevel: 0.9, tone: "hi", group: "cart-{i}", hidden: true, repeat: { count: 6, step: [0, 0, 0] } },
  ],
};

export default spec;
