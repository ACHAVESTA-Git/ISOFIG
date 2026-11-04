# Maps and declarative paths

> **PENDING (isofig 0.9, maps branch).** This file holds only what the 0.9 contract fixes. It is completed when
> `feature/mapas-y-recorridos` is merged: the shape of `map` (nodes, links, flows, UML), the `tracks` syntax, the
> examples under `examples/mapa-*`, the check codes that belong to maps and what to look for in their screenshots.
> Until then, **do not invent `map` or `tracks` fields**: read `node_modules/isofig/docs/en/` for a maps guide, and if
> there is none, tell the user the maps guide is not in the installed version.

## What a map is

A map shows **topology, flow or UML**: who talks to whom, what crosses a system, how classes relate. It is one more
format of the same spec, not a different tool:

- The `map` field of a `FigureSpec` describes the topology in data; isofig **compiles it to a `root`** (a nested tree,
  see `assemblies.md`) and from there to the usual flat figure. So a map is drawn with the same parts, the same theme
  and the same audit as a machine.
- It is **not** a machine with a model. Do not write one to animate it: a flow is declared.
- `tracks` are **declarative paths**: a group that travels through points in a loop, with no model. They carry the
  movement of a flow (a request going round a system, parcels on a belt).

## When a map, when a machine

| The concept is | Use |
|---|---|
| A mechanism with a quantity that changes (a queue filling, a bucket emptying) | A machine with a model |
| What it is made of, to take apart | A nested assembly |
| Which pieces exist and how they connect or exchange things; a sequence of hops | A **map** |
| Classes, interfaces and their relations | A **map** (UML) |

If the user brings an architecture diagram or a sketch of boxes and arrows, that is usually a map: the boxes are the
concept, and the map is the object that carries them. Still pass the "when NOT" test in `SKILL.md`: a map that only
lists components with no flow, no capacity and nothing to follow is a table.

## Color on a map

Color is what tells the categories apart, so this is where `paint` has its **roles**:

| Role | Suggested use |
|---|---|
| `client` | Users, browsers, devices |
| `edge` | Gateways, CDNs, load balancers |
| `compute` | Services, workers, functions |
| `data` | Databases, caches |
| `messaging` | Queues, topics, streams |
| `storage` | Object stores, disks |
| `external` | Third parties, systems you do not own |

- Roles come measured (text, edges and every pair apart, also with color blindness): `color-and-text.md`.
- **Roles only, never materials** in a map: `data` and `brass` are both golden in the dark theme (`paint-indistinct`).
- **Six colors at most**; use the ones the figure needs, in the order they should read: `palette: { use: [...] }` also
  sets the legend order.
- **Color never goes alone.** Name the nodes and draw the legend: `legendOf(spec, lang)` returns the paints the figure
  uses (`{ name, kind, label, color }`).
- A brand color: `palette: { base: "#hex" }` derives the roles around it; check it with
  `npx isofig palette --base "#hex" --report`.

## Verifying a map

Same flow as everything else (`verify.md`): `isofig check <spec> --strict` with no warnings, then screenshots at 390 and
1280 px, light and dark, and with the "Enlarge" chip. A map has more labels than a machine, so the enlarged shot decides:
every node name must read at 9 px or more there. Also look at whether the roles stay apart in dark, and whether the
legend lists every color in use.

<!-- TODO(0.9-maps): fill in map fields, tracks syntax, examples, check codes and the density limit (how many nodes
     before a map stops reading at 1280 px). Remove the PENDING block above when done. -->
