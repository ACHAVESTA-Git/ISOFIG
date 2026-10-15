import { dot, rad, type Vec2, type Vec3 } from "./math.ts";

export interface CameraOptions {
  azimuth?: number;
  elevation?: number;
}

export interface Camera {
  azimuth: number;
  elevation: number;
  right: Vec3;
  down: Vec3;
  view: Vec3;
  scale: number;
  ox: number;
  oy: number;
}

export function makeCamera(options: CameraOptions = {}, scale = 1, ox = 0, oy = 0): Camera {
  const azimuth = options.azimuth ?? 45;
  const elevation = options.elevation ?? 30;
  const a = rad(azimuth);
  const e = rad(elevation);
  return {
    azimuth,
    elevation,
    right: [-Math.sin(a), Math.cos(a), 0],
    down: [Math.cos(a) * Math.sin(e), Math.sin(a) * Math.sin(e), -Math.cos(e)],
    view: [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)],
    scale,
    ox,
    oy,
  };
}

export const project = (c: Camera, p: Vec3): Vec2 => [
  c.ox + c.scale * dot(p, c.right),
  c.oy + c.scale * dot(p, c.down),
];

/** Mayor es más cerca del lector. */
export const depthOf = (c: Camera, p: Vec3): number => dot(p, c.view);

export const facesViewer = (c: Camera, normal: Vec3): boolean => dot(normal, c.view) > 1e-6;

export function fitCamera(
  options: CameraOptions,
  points: Vec3[],
  width: number,
  height: number,
  pad: number,
): Camera {
  const unitCam = makeCamera(options);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) {
    const [x, y] = project(unitCam, p);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const scale = Math.min((width - 2 * pad) / Math.max(x1 - x0, 1e-6), (height - 2 * pad) / Math.max(y1 - y0, 1e-6));
  const ox = width / 2 - scale * (x0 + x1) / 2;
  const oy = height / 2 - scale * (y0 + y1) / 2;
  return makeCamera(options, scale, ox, oy);
}

/** Base de pantalla de los ejes del mundo, ya escalada: [rx, ry, rz, dx, dy, dz]. */
export const screenBasis = (c: Camera): number[] => [
  ...c.right.map((v) => v * c.scale),
  ...c.down.map((v) => v * c.scale),
];
