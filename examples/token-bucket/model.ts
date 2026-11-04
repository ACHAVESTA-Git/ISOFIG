import type { GroupView, Model } from "isofig/runtime";

const CAP = 8;
const COIN_STEP = 3.4;
const NOZZLE_DROP = 62 - 14;
const CART_SPEED = 130;
const CART_Y = 18;
const SPLIT_Y = 112;
const END_Y = 226;
const SPENT_TO: [number, number, number] = [54, 78, -16];

type Phase = "idle" | "run" | "pass" | "reject" | "fade";

interface Cart {
  phase: Phase;
  y: number;
  x: number;
  o: number;
}

interface State {
  tokens: number;
  carts: Cart[];
  spent: number[];
  untilNext: number;
  gate: number;
  ok: number;
  rejected: number;
  seed: number;
}

const WORDS = {
  en: (t: number, ok: number, rej: number) => `${t}/${CAP} tokens · ${ok} passed · ${rej} rejected`,
  es: (t: number, ok: number, rej: number) => `${t}/${CAP} fichas · ${ok} pasan · ${rej} rechazadas`,
};

function jitter(s: State): number {
  s.seed = (s.seed * 1103515245 + 12345) % 2147483648;
  return 0.75 + (s.seed / 2147483648) * 0.5;
}

const model: Model<State, { refill: number; rate: number }> = {
  init: () => ({
    tokens: CAP,
    carts: [...Array(6)].map(() => ({ phase: "idle", y: CART_Y, x: 0, o: 0 })),
    spent: [-1, -1, -1, -1],
    untilNext: 0.4,
    gate: 0,
    ok: 0,
    rejected: 0,
    seed: 7,
  }),

  step(s, dt, p) {
    s.tokens = Math.min(CAP, s.tokens + p.refill * dt);
    s.gate = Math.max(0, s.gate - dt);
    s.spent = s.spent.map((t) => (t < 0 ? t : t + dt * 2.4 > 1 ? -1 : t + dt * 2.4));
    s.untilNext -= dt;
    if (s.untilNext <= 0) {
      s.untilNext = jitter(s) / p.rate;
      const free = s.carts.find((c) => c.phase === "idle");
      if (free) Object.assign(free, { phase: "run", y: CART_Y, x: 0, o: 1 });
    }
    for (const c of s.carts) {
      if (c.phase === "run") {
        c.y += CART_SPEED * dt;
        if (c.y >= SPLIT_Y) {
          c.y = SPLIT_Y;
          if (s.tokens >= 1) {
            s.tokens -= 1;
            s.ok++;
            s.gate = 0.45;
            c.phase = "pass";
            const slot = s.spent.indexOf(-1);
            if (slot >= 0) s.spent[slot] = 0;
          } else {
            s.rejected++;
            c.phase = "reject";
          }
        }
      } else if (c.phase === "pass") {
        c.y = Math.min(END_Y, c.y + CART_SPEED * dt);
        if (c.y >= END_Y) c.phase = "fade";
      } else if (c.phase === "reject") {
        c.x = Math.min(24, c.x + 90 * dt);
        if (c.x >= 24) c.phase = "fade";
      } else if (c.phase === "fade") {
        c.o -= dt * 2.5;
        if (c.o <= 0) Object.assign(c, { phase: "idle", o: 0, y: CART_Y, x: 0 });
      }
    }
  },

  view(s, _p, ctx) {
    const groups: Record<string, GroupView> = {};
    const whole = Math.floor(s.tokens);
    for (let i = 0; i < CAP; i++) groups[`coin-${i}`] = { o: i < whole ? 1 : 0, snap: true };
    const frac = s.tokens - whole;
    const full = whole >= CAP;
    const target = whole * COIN_STEP - NOZZLE_DROP;
    groups["refill"] = { t: [0, 0, frac * target], o: full ? 0 : Math.min(1, frac * 3), snap: true };
    s.spent.forEach((t, i) => {
      if (t < 0) {
        groups[`spent-${i}`] = { o: 0, snap: true };
        return;
      }
      const lift = Math.sin(t * Math.PI) * 14;
      groups[`spent-${i}`] = {
        t: [SPENT_TO[0] * t, SPENT_TO[1] * t, SPENT_TO[2] * t + lift + (whole * COIN_STEP - 32) * (1 - t)],
        o: 1 - t * t,
        snap: true,
      };
    });
    groups["gate"] = { t: [0, 0, s.gate > 0 ? 18 : 0] };
    s.carts.forEach((c, i) => {
      groups[`cart-${i}`] = { t: [c.x, c.y - CART_Y, 0], o: Math.max(0, c.o), snap: true };
    });
    const words = ctx.lang === "es" ? WORDS.es : WORDS.en;
    return { groups, readout: words(whole, s.ok, s.rejected) };
  },
};

export default model;
