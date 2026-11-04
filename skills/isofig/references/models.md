# Models, controls, presets and `bind`

A **model** is a small pure object, `{ init, step, view }`, registered under the figure's `spec.model`. Write one only
when something happens over time. If the controls just move groups, use `bind` (last section) and skip the model.

## Shape

```ts
import type { Model } from "isofig/runtime";

interface State { pods: number[]; wanted: number } // seconds left until each pod is ready; -1 = no pod

const model: Model<State, { replicas: number }> = {
  init: (p) => ({ pods: [0, 0, 0, 0].map((_, i) => (i < p.replicas ? 0 : -1)), wanted: p.replicas }),
  step(s, dt, p, ctx) {
    if (ctx.changed("replicas")) s.wanted = p.replicas;     // the control changed
    if (ctx.pressed("delete")) {                             // the button, or a preset with press: ["delete"]
      const up = s.pods.findIndex((t) => t === 0);
      if (up >= 0) {
        s.pods[up] = -1;
        ctx.say("A pod was deleted: the Deployment creates another"); // an event, once
      }
    }
    s.pods = s.pods.map((t) => (t > 0 ? Math.max(0, t - dt) : t));
    const alive = s.pods.filter((t) => t >= 0).length;
    if (alive < s.wanted) s.pods[s.pods.findIndex((t) => t < 0)] = 2;
  },
  view(s) {
    const groups: Record<string, { o: number; s?: "warn" }> = {};
    s.pods.forEach((t, i) => (groups[`pod-${i}`] = { o: t >= 0 ? 1 : 0, ...(t > 0 ? { s: "warn" as const } : {}) }));
    return { groups, readout: `${s.pods.filter((t) => t === 0).length}/${s.wanted} pods ready` };
  },
};
export default model;
```

- `init(params, ctx)` creates the state; `step(state, dt, params, ctx)` advances `dt` seconds and only runs while the
  figure plays; `view(state)` says what each group shows: `t` (offset in the world), `r` (degrees, for a group with
  `spin`), `o` (opacity), `s` (`"ok" | "warn" | "fail"`) and `snap`. Values are interpolated; use `snap: true` only
  when the model already produces continuous motion.
- **Truth first.** The readout and the motion come from the real numbers; the model is the source of what the reader
  sees. Use a seeded generator for any randomness, as `examples/token-bucket/model.ts` does: `check` runs the model in
  Node and two visits must look alike.
- **Names must match.** Every group the model writes must exist as a `group` in `parts` (`model-group-unknown`), and
  every group with hidden parts, an `extent` or a `spin` must be written by the model (`group-never-driven`).
- **Shared measures live in their own file** that both the spec and the model import. A model that imports the spec
  file makes the bundler ship the whole spec to the browser along with the model.

## Events and changes, without bookkeeping

| You want | Use | Not |
|---|---|---|
| Announce "the breaker tripped" once | `ctx.say(text)` | A `lastSaid` in the state, or a dedupe helper |
| Know a control moved | `ctx.changed(id)` | A copy of the parameter in the state to compare |
| Know a button was pressed | `ctx.pressed(id)` | A counter copied from the parameter |

`ctx.pressed` and `ctx.changed` are true during the step after the press or the change, whether the reader used the
control or a preset did. `ctx.say` follows the runtime's rules: quiet until the reader touches the figure, waits for 1.5 s
of silence, never talks over a preset's note, at most twice per interaction, never repeats the last thing it said, and if
the readout echo talks over it, it is said afterwards. `view.say` still works; prefer `ctx.say`.

## Reduced motion: `motion.settle`

With reduced motion a figure starts paused. A paused first frame often says nothing (an empty queue), so give the figure
`motion: { tau: 0.2, settle: 6 }`: the runtime then simulates 6 seconds at once on mount and after every control or preset
(presets simulate 8 if `settle` is unset) and shows that state. Pick the time the figure needs to reach a state worth
looking at. The model does not compute the final state by hand and does not silence `say`. `ctx.reducedMotion` is live
if the reader changes the system setting. A preset with `reset` always gives the same result.

## Presets: "Try to break it"

```ts
presets: [
  { label: "Delete a pod", values: {}, press: ["delete"], note: "One pod disappears and a new one starts a moment later." },
  { label: "Scale to 4", values: { replicas: 4 }, note: "The Deployment starts a fourth pod to match what you asked for." },
],
```

- A preset is a way to break the thing on purpose. It sets `values`, shows its `note` and announces it to screen readers;
  `reset: true` restarts the model with those values; `press: [ids]` presses `action` parameters after the values (and
  after `reset`).
- **It must change what the reader sees.** `isofig check --model --presets` presses every preset after half the
  simulated time and compares the next seconds with not pressing it: `preset-same-view` means it does nothing visible.
  Change a value that moves something, add a `press`, or delete the preset. Two presets with the same effect are one.
  A preset that restores the starting state may legitimately say "same view": it is the only exception.
- **The note says what to watch** after pressing, in a full sentence. Never "now press «Delete»": that is what `press`
  is for.
- Values sit inside the range and on the step (`preset-value-off-step`).

## Rows that share groups: `repeat.from` and `pool`

A second row of the same family needs its own part ids but the same group names, and often numbers that continue the
first row. `repeat.from` is the first value of `{i}` (0 by default); the kit does it for you:

```ts
...pool({ id: "row", count: 14, step: [0, -14, 0], piece }),
...pool({ id: "row-high", group: "row", count: 14, from: 14, step: [0, -14, 0], piece: { ...piece, at: [43, 214, 26] } }),
groups: groupsOf("row", 28), // row-0 … row-27
```

Without `from` both rows would answer to `row-0…13` and the model could not reach the rest.

## Controls

| `kind` | Value | Use it for |
|---|---|---|
| (default) slider | `min`…`max` in `step`s | A quantity: rate, size, latency |
| `toggle` | 0 or 1 | On/off: a breaker, a switch |
| `choice` | The index of `options` | A strategy: round robin, least connections |
| `action` | A button that adds 1 | An event: delete a pod, send a request (read it with `ctx.pressed`) |

- **The start value sits on its step and in range.** A slider snaps to its step counted from `min`: a `0.5`–`6` slider
  with no `step` (so step 1) cannot land on `2.5`, and the slider would show one number while the model uses another
  (`param-value-off-step`, `param-value-out-of-range`). The same goes for a preset's values.
- `unit` short for the eye ("req/s"), `spoken` long for screen readers. A parameter with `texts` (one per integer value)
  shows them in the readout as `{id}`.
- `label` and `note` always set: `param-label-missing`, `preset-note-missing`.

## `bind`: no model

For a figure that only answers to its controls:

```ts
bind: [
  { group: "carriage", param: "load", move: [0, 1.2, 0] },   // × the parameter's value
  { group: "needle", param: "load", spin: 3 },                // degrees per unit
  { group: "lamp", param: "on", fade: true },                 // the value (0–1) as opacity
]
```

Several binds on one group add up, and they add to what a model sets. `win: [a, b]` moves the group only while the
parameter crosses that window; `keep: [1, 3]` with a choice fades the group when the choice is not in the list.

## `tracks`: no model, a loop

A group that travels through points in a loop, with no model, for something that circulates (a belt, a carousel).
Syntax, `hide` and an example are in `maps.md`. Do not write a model just to make something go round.
