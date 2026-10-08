import * as THREE from 'three';
import { fbm, noise2, seeded } from './nature';
import { detailMaterial, landscapeMaterial } from './surface';
import { focusedTerrain } from './photographic-terrain';
import type { Landscape } from './types';

/** Wind-built transverse dunes: long stoss slopes meet 32° slip faces along
 * narrow, meandering crests. No sinusoidal mountain field or isolated cones. */
export function createDesert(): Landscape {
  const group = new THREE.Group();
  group.name = 'Erg Chebbi — wind, sand and stone';
  const random = seeded(458);
  const smooth = (a: number, b: number, n: number) => {
    const t = Math.max(0, Math.min(1, (n - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const duneRelief = (x: number, z: number) => {
    const u = x * 0.925 + z * 0.38;
    const v = z * 0.925 - x * 0.38;
    const far = smooth(-600, -1650, z);
    // Nearest crest, rather than floor(), ensures a neighbour enters this
    // window only after its finite-support profile has already fallen to zero.
    const centreIndex = Math.round(u / 365);
    let crestHeight = 0;
    const neighbours = far > 0 ? 2 : 1;
    for (let j = centreIndex - neighbours; j <= centreIndex + neighbours; j++) {
      const meander = Math.sin(v * 0.0027 + j * 1.73) * 48
        + fbm(v * 0.0031 + j * 17.8, j * 0.41, 3) * 54
        + far * (Math.sin(v * 0.0043 + j * 1.7) * 27 + Math.sin(v * 0.009 - j * 0.8) * 10);
      const along = u - (j * 365 + meander);
      const baseHeight = 70 + Math.sin(j * 2.37) * 13 + fbm(v * 0.002 + j * 3.4, j * 0.17, 3) * 18
        + smooth(-700, -2500, z) * 44;
      // Beyond the near crests, alternating main peaks and lower shoulders
      // break the skyline into uneven dune groups rather than level ridges.
      const phase = v * 0.0048 + j * 1.93;
      const primary = Math.max(0, Math.cos(phase)) ** 1.6;
      const shoulder = Math.max(0, Math.cos(phase * 1.73 - j * 0.63 + 1.2)) ** 2;
      const prominence = (0.52 + primary * 0.82 + shoulder * 0.24)
        * (0.92 + Math.sin(j * 2.71 + 0.4) * 0.08);
      const tall = baseHeight * (1 + far * (prominence - 1));
      const baseApron = 272 + fbm(v * 0.0022, j * 7.17, 2) * 49;
      // Taller distant peaks spread their windward aprons, retaining a credible
      // sand slope. The wider neighbour window keeps these overlaps continuous.
      const apron = baseApron + far * Math.max(0, tall / 0.36 - baseApron);
      const slip = tall / 0.625;
      // The crest is a genuine slope discontinuity; only adjacent mesh normals
      // interpolate across its thin edge against the shadowed slip face.
      const profile = along < 0
        ? Math.pow(Math.max(0, 1 + along / apron), 1.36)
        : Math.pow(Math.max(0, 1 - along / slip), 1.045);
      crestHeight = Math.max(crestHeight, profile * tall);
    }
    return crestHeight;
  };
  const height = (x: number, z: number) => {
    const floor = 17 + fbm(x * 0.0008 + 41, z * 0.0008 - 26, 3) * 9;
    const relief = duneRelief(x, z);
    const apronRidges = noise2(x * 0.022 + z * 0.011, z * 0.006) * 0.34
      * (1 - smooth(9, 30, relief));
    return floor + relief + apronRidges;
  };
  const sand = landscapeMaterial({ biome: 'desert', tint: 0xfff4e4, scale: 18, normalStrength: 0.72 });
  const terrain = focusedTerrain({
    minX: -2450, maxX: 2750, minZ: -4100, maxZ: 1550,
    focusX: 135, focusZ: 365, segments: 480, concentration: 0.105,
    height, material: sand,
    color: (x, _y, z, slope) => {
      const variation = noise2(x * 0.006, z * 0.006) * 0.015;
      return new THREE.Color().setRGB(0.985 + variation, 0.98 + variation - slope * 0.012, 0.955 + variation);
    },
  });
  terrain.mesh.castShadow = true;
  group.add(terrain.mesh);
  const dummy = new THREE.Object3D();
  const boulderMaterial = detailMaterial('rock', 0xa89b87, 2.0);

  // Ventifacts cluster on deflation floors. Three prototypes differ in both
  // fracture planes and bedding, with scanned rock detail at a true metre scale.
  for (let variant = 0; variant < 3; variant++) {
    const geometry = new THREE.IcosahedronGeometry(1, 5);
    const vertices = geometry.getAttribute('position');
    const colors = new Float32Array(vertices.count * 3);
    for (let n = 0; n < vertices.count; n++) {
      const x = vertices.getX(n), y = vertices.getY(n), z = vertices.getZ(n);
      const weathering = 1 + fbm(x * 4.5 + variant * 9, y * 4.7 + z, 4) * 0.19;
      const bedding = Math.pow(Math.abs(Math.sin(y * (8.5 + variant) + x * 0.9)), 16) * 0.041;
      vertices.setXYZ(n,
        Math.min(x * weathering, 0.61 + z * (0.17 + variant * 0.08)) * (1 - bedding),
        Math.min(y * weathering, 0.66 - x * 0.24 + z * 0.11),
        Math.max(z * weathering, -0.79 + x * 0.12) * (1 - bedding));
      const patina = 0.88 + fbm(x * 2.2 + variant * 3, z * 2.2, 3) * 0.08;
      colors.set([patina, patina * 0.97, patina * 0.90], n * 3);
    }
    geometry.computeVertexNormals();
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const rocks = new THREE.InstancedMesh(geometry, boulderMaterial, 34);
    let placed = 0;
    while (placed < rocks.count) {
      const x = -410 + random() * 1030, z = -310 + random() * 910;
      if (duneRelief(x, z) > 15) continue;
      const size = 0.28 + random() ** 2.4 * 2.9;
      dummy.position.set(x, terrain.sample(x, z) - size * 0.19, z);
      dummy.scale.set(size * (1.2 + random() * 0.8), size * 0.55, size * (0.8 + random() * 0.5));
      dummy.rotation.set(random() * 0.15, random() * 6.28, random() * 0.12);
      dummy.updateMatrix();
      rocks.setMatrixAt(placed, dummy.matrix);
      rocks.setColorAt(placed, new THREE.Color().setScalar(0.71 + random() * 0.3));
      placed++;
    }
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    group.add(rocks);
  }
  const pebbleGeometry = new THREE.IcosahedronGeometry(1, 1);
  pebbleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pebbleGeometry.getAttribute('position').count * 3).fill(1), 3));
  const pebbles = new THREE.InstancedMesh(pebbleGeometry, detailMaterial('rock', 0x948673, 0.7), 1150);
  let pebble = 0;
  while (pebble < pebbles.count) {
    const x = -180 + random() * 580, z = 20 + random() * 530;
    if (duneRelief(x, z) > 20 || noise2(x * 0.059, z * 0.059) < -0.12) continue;
    const size = 0.025 + random() ** 3 * 0.24;
    dummy.position.set(x, terrain.sample(x, z) - size * 0.17, z);
    dummy.scale.set(size * 1.5, size * 0.39, size);
    dummy.rotation.set(random(), random() * 6.28, random());
    dummy.updateMatrix();
    pebbles.setMatrixAt(pebble, dummy.matrix);
    pebbles.setColorAt(pebble, new THREE.Color().setScalar(0.68 + random() * 0.34));
    pebble++;
  }
  pebbles.receiveShadow = true;
  group.add(pebbles);
  const cameraPosition = new THREE.Vector3(160, height(160, 420) + 7.5, 420);
  const marks = [[70, 175], [80, 0], [130, -500]];
  return {
    group, heightAt: height,
    collectibles: marks.map(([x, z], i) => ({
      position: new THREE.Vector3(x, height(x, z) + 18, z),
      name: ['流沙之脊', '风蚀纹理', '远方的山'][i],
      message: ['沙丘的脊线，记录着风经过的方向。', '一阵风，用整片沙海写下时间。', '在摩洛哥的沙海边缘，远山划定了地平线。'][i],
    })),
    view: {
      position: cameraPosition, target: new THREE.Vector3(0, 58, -550), fov: 52,
      minDistance: 815, maxDistance: 1250, azimuthRange: 0.34, polarRange: 0.055,
    },
    atmosphere: {
      fogColor: 0xd8c7b2, fogDensity: 0.00023,
      sunPosition: new THREE.Vector3(-1100, 520, 470), sunColor: 0xffeddb,
      sunIntensity: 3.2, exposure: 0.97, skyRotation: 1.4,
    },
    update: () => {},
  };
}
