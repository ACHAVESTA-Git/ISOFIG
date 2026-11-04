import { checkKeys, checkVector, isNum, isObj, show, type Reporter } from "./validate-shared.ts";

const TRACK_KEYS = ["group", "path", "period", "delay", "loop", "hide"] as const;

/** Los recorridos de `tracks`: qué grupo mueven, por dónde, cada cuánto. El grupo se comprueba al dibujar, con las piezas ya armadas. */
export function validateTracks(rep: Reporter, tracks: unknown, groups: Set<string> | undefined): void {
  if (tracks === undefined) return;
  if (!Array.isArray(tracks)) return void rep.add("type-invalid", "tracks", { field: "tracks", expected: "list", got: show(tracks) });
  tracks.forEach((t, i) => {
    const path = `tracks[${i}]`;
    if (!isObj(t)) return void rep.add("type-invalid", path, { field: path, expected: "object", got: show(t) });
    checkKeys(rep, t, TRACK_KEYS, path);
    const group = typeof t["group"] === "string" ? t["group"] : "";
    if (!group) rep.add("field-missing", `${path}.group`, { id: path, kind: "track", field: "group" });
    else if (groups && !groups.has(group)) rep.add("track-group-unknown", `${path}.group`, { group });
    const pts = t["path"];
    if (!Array.isArray(pts)) rep.add("track-path-short", `${path}.path`, { group, got: 0 });
    else {
      const ok = pts.map((p, j) => checkVector(rep, p, `${path}.path[${j}]`, `path[${j}]`));
      const good = pts.filter((_, j) => ok[j]) as number[][];
      const distinct = good.filter((p, j) => j === 0 || Math.hypot(p[0] - good[j - 1][0], p[1] - good[j - 1][1], p[2] - good[j - 1][2]) > 1e-6);
      if (distinct.length < 2 && ok.every(Boolean)) rep.add("track-path-short", `${path}.path`, { group, got: distinct.length });
    }
    if (!(isNum(t["period"]) && t["period"] > 0)) rep.add("track-period-invalid", `${path}.period`, { group, got: show(t["period"]) });
    if (t["delay"] !== undefined && !(isNum(t["delay"]) && t["delay"] >= 0)) rep.add("track-delay-invalid", `${path}.delay`, { group, got: show(t["delay"]) });
    if (t["loop"] !== undefined && typeof t["loop"] !== "boolean") rep.add("type-invalid", `${path}.loop`, { field: "loop", expected: "boolean", got: show(t["loop"]) });
  });
}

/** Se completa con el compilador de mapas. */
export function validateMap(_rep: Reporter, _map: unknown): void {}
