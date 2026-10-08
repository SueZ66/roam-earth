import { BufferGeometry, Color, Float32BufferAttribute, Mesh, Uint32BufferAttribute } from 'three';
import type { Material } from 'three';

/** A continuous mesh with metre-scale sampling near the photograph's foreground.
 * Coordinates remain world-space so triplanar PBR and props share one surface. */
export function focusedTerrain(options: {
  minX: number; maxX: number; minZ: number; maxZ: number;
  focusX: number; focusZ: number; segments: number; concentration?: number;
  height: (x: number, z: number) => number; material: Material;
  color?: (x: number, y: number, z: number, slope: number) => Color;
}) {
  const { segments: n, height, focusX, focusZ } = options;
  const linear = options.concentration ?? 0.17;
  const coordinate = (i: number, focus: number, low: number, high: number) => {
    const t = i / n * 2 - 1;
    const warped = Math.abs(t) * linear + Math.abs(t) ** 2.6 * (1 - linear);
    return focus + (t < 0 ? -(focus - low) : high - focus) * warped;
  };
  const xs = Array.from({ length: n + 1 }, (_, i) => coordinate(i, focusX, options.minX, options.maxX));
  const zs = Array.from({ length: n + 1 }, (_, i) => coordinate(i, focusZ, options.minZ, options.maxZ));
  const positions = new Float32Array((n + 1) ** 2 * 3);
  const uvs = new Float32Array((n + 1) ** 2 * 2);
  const indices = new Uint32Array(n * n * 6);
  for (let iz = 0; iz <= n; iz++) for (let ix = 0; ix <= n; ix++) {
    const i = iz * (n + 1) + ix, x = xs[ix], z = zs[iz];
    positions.set([x, height(x, z), z], i * 3);
    uvs.set([x / 24, z / 24], i * 2);
  }
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const a = iz * (n + 1) + ix, b = a + n + 1, d = a + 1, c = b + 1;
    indices.set([a, b, d, b, c, d], (iz * n + ix) * 6);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal'), colors = new Float32Array(positions.length);
  const white = new Color(1, 1, 1);
  for (let i = 0; i < positions.length / 3; i++) {
    const c = options.color?.(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], 1 - Math.max(0, normals.getY(i))) ?? white;
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, options.material);
  mesh.receiveShadow = true;
  const interval = (values: number[], point: number) => {
    let a = 0, b = values.length - 1;
    while (b - a > 1) { const mid = (a + b) >> 1; if (values[mid] <= point) a = mid; else b = mid; }
    return a;
  };
  const sample = (x: number, z: number) => {
    if (x < options.minX || x > options.maxX || z < options.minZ || z > options.maxZ) return height(x, z);
    const ix = interval(xs, x), iz = interval(zs, z);
    const u = (x - xs[ix]) / (xs[ix + 1] - xs[ix]), v = (z - zs[iz]) / (zs[iz + 1] - zs[iz]);
    const a = iz * (n + 1) + ix;
    const ha = positions[a * 3 + 1], hb = positions[(a + n + 1) * 3 + 1];
    const hd = positions[(a + 1) * 3 + 1], hc = positions[(a + n + 2) * 3 + 1];
    return u + v <= 1 ? ha * (1 - u - v) + hb * v + hd * u : hc * (u + v - 1) + hb * (1 - u) + hd * (1 - v);
  };
  return { mesh, sample };
}
