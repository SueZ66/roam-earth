import {
  BufferGeometry, Color, DoubleSide, Euler, Float32BufferAttribute, Group,
  IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial,
  Quaternion, ShaderMaterial, Vector3,
} from 'three';
import { createTerrain, createWater, fbm, seeded } from './nature';
import { detailMaterial, landscapeMaterial } from './surface';
import type { Landscape } from './types';

/** A continuous coastal landscape inspired by Haukland, Lofoten, Norway. */
export function createCoast(): Landscape {
  const group = new Group();
  group.name = '罗弗敦 · 豪克兰湾';
  const random = seeded(6808);
  const shoreX = (z: number) => -65 + 95 * Math.tanh((z + 80) / 300)
    + 28 * Math.exp(-(((z + 400) / 180) ** 2)) + fbm(z * 0.009, 49, 3) * 5;
  type RidgePoint = [number, number, number];
  const mainRidge: RidgePoint[] = [
    [-1510, -1580, 0], [-1140, -1280, 380], [-945, -1070, 460],
    [-745, -880, 520], [-670, -725, 478], [-558, -647, 332],
    [-452, -585, 380], [-371, -505, 398], [-315, -431, 257],
    [-265, -315, 109], [-245, -176, 0],
  ];
  const backRidge: RidgePoint[] = [
    [-950, -1690, 0], [-610, -1325, 375], [-435, -1150, 318],
    [-315, -1025, 342], [-223, -900, 224], [-191, -723, 0],
  ];
  const shoulderRidge: RidgePoint[] = [
    [-490, -650, 0], [-429, -527, 276], [-330, -405, 200],
    [-211, -325, 70], [-185, -230, 0],
  ];
  const ridgeHeight = (x: number, z: number, nodes: RidgePoint[], seaWidth: number, landWidth: number) => {
    let result = 0;
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const lengthSquared = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSquared));
      const px = a[0] + dx * t, pz = a[1] + dz * t;
      const cross = (x - px) * dz - (z - pz) * dx;
      const width = cross >= 0 ? seaWidth : landWidth;
      const distance = Math.hypot(x - px, z - pz) / width;
      if (distance >= 1) continue;
      const crown = a[2] + (b[2] - a[2]) * t;
      // Uneven saddles interrupt the crest; seaward faces break more steeply.
      const saddle = Math.sin(t * Math.PI) * (12 + Math.sin(i * 3.1) * 18);
      const crossSection = Math.pow(1 - distance, cross >= 0 ? 0.82 : 1.58);
      result = Math.max(result, Math.max(0, crown + saddle) * crossSection);
    }
    return result;
  };
  const height = (x: number, z: number) => {
    const inland = shoreX(z) - x;
    if (inland < 0) return Math.max(-20, inland * 0.16);
    const foothill = Math.max(0, inland - 90) * 0.055;
    const warpedX = x + fbm(x * 0.005, z * 0.008, 3) * 21;
    const warpedZ = z + fbm(x * 0.006 + 91, z * 0.008, 3) * 24;
    const mountain = Math.max(
      ridgeHeight(warpedX, warpedZ, mainRidge, 184, 405),
      ridgeHeight(warpedX, warpedZ, backRidge, 155, 274),
      ridgeHeight(warpedX, warpedZ, shoulderRidge, 122, 168),
    );
    const detail = fbm(x * 0.024, z * 0.033, 4) * Math.min(32, mountain * 0.21);
    const drainage = Math.sin((z + x * 0.36 + fbm(x * 0.004, z * 0.011, 3) * 34) * 0.039);
    const erosion = Math.exp(-Math.abs(drainage) * 7.3) * Math.min(26, mountain * 0.16);
    const strata = Math.sin((mountain + z * 0.09) * 0.10) * Math.min(3.8, mountain * 0.024);
    const land = Math.min(1, inland / 80);
    return inland * 0.038 + foothill + Math.max(0, mountain + detail - erosion + strata) * land
      + fbm(x * 0.052, z * 0.052, 3) * Math.min(1.1, inland * 0.012);
  };

  const terrainMat = landscapeMaterial({ biome: 'coast', scale: 23, normalStrength: 0.80 });
  const mainland = createTerrain({
    width: 2500, depth: 2600, centerX: -650, centerZ: -600,
    segments: 280, height, material: terrainMat,
    color: (x, y, z) => {
      const n = fbm(x * 0.012, z * 0.012, 3);
      return new Color().setRGB(0.96 + n * 0.035, 0.97 + n * 0.03, 0.945 + n * 0.035)
        .multiplyScalar(y < 6 ? 1.07 : 1);
    },
  });
  mainland.name = '破碎岩脊与侵蚀沟谷';
  group.add(mainland);

  // Replace the low-resolution tidal strip with a locally detailed sand surface.
  const mainPosition = mainland.geometry.getAttribute('position');
  const mainIndex = mainland.geometry.index!;
  const retainedTriangles: number[] = [];
  const insideSandPatch = (index: number) => {
    const z = mainPosition.getZ(index);
    const inland = shoreX(z) - mainPosition.getX(index);
    return z > -495 && z < 465 && inland > -7 && inland < 86;
  };
  for (let i = 0; i < mainIndex.count; i += 3) {
    const a = mainIndex.getX(i), b = mainIndex.getX(i + 1), c = mainIndex.getX(i + 2);
    if (!(insideSandPatch(a) && insideSandPatch(b) && insideSandPatch(c))) retainedTriangles.push(a, b, c);
  }
  mainland.geometry.setIndex(retainedTriangles);
  const sandPosition: number[] = [], sandColor: number[] = [], sandIndex: number[] = [];
  const sandRows = 280, sandColumns = 24;
  for (let row = 0; row <= sandRows; row++) {
    const z = 490 - row / sandRows * 1010;
    for (let column = 0; column <= sandColumns; column++) {
      const inland = -18 + column / sandColumns * 124;
      const x = shoreX(z) - inland;
      const ripples = Math.sin(inland * 1.2 + fbm(z * .02, inland * .1, 2) * 2) * .035;
      sandPosition.push(x, height(x, z) + .075 + ripples, z);
      sandColor.push(1.0, 1.0, .995);
    }
  }
  for (let row = 0; row < sandRows; row++) for (let column = 0; column < sandColumns; column++) {
    const a = row * (sandColumns + 1) + column, b = a + sandColumns + 1;
    sandIndex.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const sandGeometry = new BufferGeometry();
  sandGeometry.setAttribute('position', new Float32BufferAttribute(sandPosition, 3));
  sandGeometry.setAttribute('color', new Float32BufferAttribute(sandColor, 3));
  sandGeometry.setIndex(sandIndex);
  sandGeometry.computeVertexNormals();
  const sandMaterial = landscapeMaterial({ biome: 'coast', scale: 14, normalStrength: .56 });
  sandMaterial.polygonOffset = true;
  sandMaterial.polygonOffsetFactor = -1;
  sandMaterial.polygonOffsetUnits = -1;
  const sand = new Mesh(sandGeometry, sandMaterial);
  sand.name = '局部细分潮汐沙台';
  sand.receiveShadow = true;
  group.add(sand);

  const water = createWater({
    size: 6500, height: 0.12, color: 0x177e88,
    amplitude: 0.44, distortion: 4.6, sunDirection: new Vector3(-0.7, 0.75, -0.3).normalize(),
  });
  // Keep the long ocean horizon, while resolving the 45–65 m swells in the bay.
  // Uniform spacing across the entire ocean would undersample the visible waves.
  const waterPosition = water.geometry.getAttribute('position');
  const concentrateOceanGrid = (coordinate: number) => {
    const u = Math.abs(coordinate) / 3250;
    const distance = u <= 0.8 ? u * 800 : 640 + Math.pow((u - 0.8) / 0.2, 1.6) * 2610;
    return Math.sign(coordinate) * distance;
  };
  for (let i = 0; i < waterPosition.count; i++) {
    waterPosition.setXY(i, concentrateOceanGrid(waterPosition.getX(i)), concentrateOceanGrid(waterPosition.getY(i)));
  }
  waterPosition.needsUpdate = true;
  water.geometry.computeBoundingSphere();
  group.add(water);

  // A feathered surf ribbon follows the actual sand / sea boundary.
  const surfVertices: number[] = [];
  const surfUvs: number[] = [];
  const surfIndices: number[] = [];
  const surfSteps = 420;
  const ribbonSteps = 10;
  for (let i = 0; i <= surfSteps; i++) {
    const z = 560 - i / surfSteps * 1680;
    for (let j = 0; j <= ribbonSteps; j++) {
      const outward = j / ribbonSteps * 30;
      surfVertices.push(shoreX(z) + outward, 0.46, z);
      surfUvs.push(outward, z);
    }
  }
  for (let i = 0; i < surfSteps; i++) {
    for (let j = 0; j < ribbonSteps; j++) {
      const a = i * (ribbonSteps + 1) + j;
      const b = a + ribbonSteps + 1;
      surfIndices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const surfGeometry = new BufferGeometry();
  surfGeometry.setAttribute('position', new Float32BufferAttribute(surfVertices, 3));
  surfGeometry.setAttribute('uv', new Float32BufferAttribute(surfUvs, 2));
  surfGeometry.setIndex(surfIndices);
  const surfMaterial = new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec2 vSurf;
      uniform float time;
      void main() {
        vSurf = uv;
        vec3 p = position;
        p.y += sin(p.z * .056 + time * .7) * .10;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vSurf;
      uniform float time;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float foamNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
      }
      void main() {
        float x = vSurf.x;
        float along = foamNoise(vec2(vSurf.y * .029, 4.0));
        float phase = x * .41 + time * .96 + along * 2.8;
        float breaker = pow(max(0.0, sin(phase)), 18.0);
        float detail = foamNoise(vec2(vSurf.y * 1.3, x * 2.4 - time * .11));
        float breakup = foamNoise(vec2(vSurf.y * .20 + time * .02, x * .7));
        float edge = smoothstep(0.0, 1.1, x) * (1.0 - smoothstep(7.0, 30.0, x));
        float lace = smoothstep(.28, .66, detail + breakup * .27);
        float backwash = exp(-x * .22) * (.5 + .5 * sin(time * .47 + along * 5.0));
        float alpha = (breaker * .49 + backwash * .14) * edge * lace * (.52 + breakup * .48);
        gl_FragColor = vec4(.87, .94, .92, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const surf = new Mesh(surfGeometry, surfMaterial);
  surf.renderOrder = 2;
  group.add(surf);

  // Three fractured shapes make separate angular slabs, worn blocks and narrow fins.
  const makeGranite = (variant: number, detail: number) => {
    const geometry = new IcosahedronGeometry(1, detail);
    const position = geometry.getAttribute('position');
    const colors: number[] = [];
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const crag = 1 + fbm(x * 3.9 + variant * 31, z * 3.4 + y * 2.7, 4) * .30;
      const cutX = Math.min(.78 + y * .15, Math.max(-.82, x * crag + y * .10));
      const cutY = Math.max(-.64, Math.min(.65 - x * .18 + z * .09, y * crag));
      const cutZ = Math.max(-.80 - y * .06, Math.min(.84 + x * .11, z * crag));
      position.setXYZ(i, cutX, cutY, cutZ);
      const fissure = Math.exp(-Math.abs(y + x * .18 - .15) * 36) * .13;
      const shade = .84 + Math.max(0, y) * .12 - fissure;
      colors.push(shade, shade * .99, shade * .965);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  };
  const transform = new Matrix4();
  const rotation = new Quaternion();
  const stoneMaterial = detailMaterial('rock', 0xf5f5ed, 3.3);
  for (let variant = 0; variant < 3; variant++) {
    const rocks = new InstancedMesh(makeGranite(variant, 4), stoneMaterial, 38);
    rocks.name = `海蚀花岗岩 ${variant + 1}`;
    for (let i = 0; i < 38; i++) {
      const close = i < 11;
      const z = close ? 60 + random() * 150 : -660 + random() * 1100;
      const inland = close ? -2 + random() * 42 : 5 + random() * 47;
      const x = shoreX(z) - inland;
      const scale = close ? 1.7 + random() * 3.4 : .7 + random() * 2.5;
      rotation.setFromEuler(new Euler(random() * .28 - .14, random() * Math.PI * 2, random() * .35 - .17));
      transform.compose(new Vector3(x, height(x, z) + scale * .22, z), rotation,
        new Vector3(scale * (variant === 0 ? 1.5 : .95), scale * (variant === 2 ? 1.1 : .60), scale * (.8 + random() * .65)));
      rocks.setMatrixAt(i, transform);
      const wet = inland < 6 ? .70 : .89 + random() * .11;
      rocks.setColorAt(i, new Color(wet, wet, wet * .99));
    }
    rocks.receiveShadow = true;
    rocks.castShadow = true;
    group.add(rocks);
  }

  // Scree fans gather below the broken seaward faces instead of filling the beach.
  const scree = new InstancedMesh(makeGranite(7, 1), stoneMaterial, 420);
  scree.name = '坡脚侵蚀碎石';
  for (let i = 0; i < 420; i++) {
    const z = -690 + random() * 505;
    const x = shoreX(z) - (90 + random() * 155);
    const y = height(x, z);
    const scale = .55 + Math.pow(random(), 2.5) * 2.8;
    rotation.setFromEuler(new Euler(random() * .6, random() * Math.PI * 2, random() * .8));
    transform.compose(new Vector3(x, y + scale * .16, z), rotation,
      new Vector3(scale * 1.2, scale * .54, scale * (.7 + random())));
    scree.setMatrixAt(i, transform);
    const c = .76 + random() * .24;
    scree.setColorAt(i, new Color(c, c * .99, c * .97));
  }
  scree.receiveShadow = true;
  group.add(scree);

  const shingle = new InstancedMesh(makeGranite(12, 1), stoneMaterial, 380);
  shingle.name = '高潮线细砾';
  for (let i = 0; i < 380; i++) {
    const z = -300 + random() * 735;
    const inland = 16 + Math.sin(z * .031) * 5 + random() * 10;
    const x = shoreX(z) - inland;
    const scale = .09 + random() * .30;
    rotation.setFromEuler(new Euler(random() * .2, random() * Math.PI * 2, random() * .2));
    transform.compose(new Vector3(x, height(x, z) + scale * .1, z), rotation,
      new Vector3(scale * 1.4, scale * .5, scale));
    shingle.setMatrixAt(i, transform);
    const c = .62 + random() * .30;
    shingle.setColorAt(i, new Color(c, c * .98, c * .91));
  }
  shingle.receiveShadow = true;
  group.add(shingle);

  // A low distant headland gives the open water a real horizon and a sense of scale.
  const islandHeight = (x: number, z: number) => {
    const ridge = ridgeHeight(x, z, [
      [290, -1530, 0], [445, -1512, 126], [565, -1541, 103],
      [680, -1580, 178], [773, -1564, 86], [880, -1611, 105], [1090, -1630, 0],
    ], 129, 178);
    return ridge > 0 ? ridge + fbm(x * 0.04, z * 0.04, 3) * Math.min(10, ridge * 0.16) - 4 : -10;
  };
  group.add(createTerrain({
    width: 1000, depth: 650, centerX: 650, centerZ: -1550, segments: 96,
    height: islandHeight, material: landscapeMaterial({ biome: 'coast', tint: 0xf2f4f0, scale: 27, normalStrength: .75 }),
  }));

  // Seabirds are small silhouettes with gently articulated wings, not scene props.
  const birdGeometry = new BufferGeometry();
  birdGeometry.setAttribute('position', new Float32BufferAttribute([
    0, 0, .3, -1.7, .16, -.08, -.30, 0, -.16,
    0, 0, .3, .30, 0, -.16, 1.7, .16, -.08,
  ], 3));
  birdGeometry.computeVertexNormals();
  const birds = new InstancedMesh(birdGeometry, new MeshStandardMaterial({
    color: 0x65706e, roughness: 1, side: DoubleSide,
  }), 7);
  const birdTracks = Array.from({ length: 7 }, (_, i) => ({
    x: -65 + i * 19, y: 30 + random() * 18, z: -270 - random() * 180,
    phase: random() * Math.PI * 2, speed: 0.08 + random() * 0.06,
  }));
  birds.frustumCulled = false;
  group.add(birds);

  return {
    heightAt: height,
    group,
    view: {
      position: new Vector3(90, 24, 160), target: new Vector3(-30, 25, -390),
      fov: 58, minDistance: 300, maxDistance: 880, azimuthRange: 0.34, polarRange: 0.14,
    },
    atmosphere: {
      fogColor: 0xa8c7cf, fogDensity: 0.00031,
      sunPosition: new Vector3(-900, 1050, -450), sunColor: 0xfff4df,
      sunIntensity: 2.25, exposure: 1.12, skyRotation: 0.8,
    },
    collectibles: [
      { position: new Vector3(-106, 10, -320), name: '北极白沙', message: '豪克兰湾的浅色细沙与清澈海水，让北极圈内也拥有一片明亮海岸。' },
      { position: new Vector3(70, 6, -270), name: '大西洋涌浪', message: '波浪越过挪威海，在浅湾中变得透亮，抵岸时化作一道细细的白沫。' },
      { position: new Vector3(-245, height(-245, -835) + 20, -835), name: '海岸山脊', message: '罗弗敦陡峭的古老岩峰从海面拔起，冰川曾沿着山谷雕刻出岛屿的轮廓。' },
    ],
    update: (elapsed) => {
      water.material.uniforms.time.value = elapsed * 0.72;
      surfMaterial.uniforms.time.value = elapsed;
      birdTracks.forEach((bird, i) => {
        const a = elapsed * bird.speed + bird.phase;
        const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -a);
        transform.compose(
          new Vector3(bird.x + Math.sin(a) * 40, bird.y + Math.sin(a * 1.7) * 3, bird.z + Math.cos(a) * 28),
          q, new Vector3(1, .7 + Math.sin(elapsed * 2.1 + bird.phase) * .35, 1),
        );
        birds.setMatrixAt(i, transform);
      });
      birds.instanceMatrix.needsUpdate = true;
    },
  };
}
