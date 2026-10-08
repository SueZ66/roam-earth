import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial,
  Quaternion, ShaderMaterial, Vector3,
} from 'three';
import { createTerrain, createWater, fbm, seeded, terrainMaterial } from './nature';
import type { Landscape } from './types';

/** A continuous coastal landscape inspired by Haukland, Lofoten, Norway. */
export function createCoast(): Landscape {
  const group = new Group();
  group.name = '罗弗敦 · 豪克兰湾';
  const random = seeded(6808);
  const shoreX = (z: number) => -65 + 95 * Math.tanh((z + 80) / 300)
    + 28 * Math.exp(-(((z + 400) / 180) ** 2));
  const peak = (x: number, z: number, cx: number, cz: number, sx: number, sz: number, h: number) => {
    const dx = (x - cx) / sx;
    const dz = (z - cz) / sz;
    const r = Math.sqrt(dx * dx + dz * dz);
    return h * Math.pow(Math.max(0, 1 - r), 1.05);
  };
  const height = (x: number, z: number) => {
    const inland = shoreX(z) - x;
    if (inland < 0) return Math.max(-20, inland * 0.16);
    const foothill = Math.max(0, inland - 90) * 0.055;
    const warpedX = x + fbm(x * 0.007, z * 0.007, 3) * 30;
    const warpedZ = z + fbm(x * 0.005 + 91, z * 0.005, 3) * 35;
    const mountain = Math.max(
      peak(warpedX, warpedZ, -365, -505, 260, 405, 395),
      peak(warpedX, warpedZ, -650, -800, 360, 510, 535),
      peak(warpedX, warpedZ, -250, -940, 235, 280, 310),
      peak(warpedX, warpedZ, -1030, -1090, 430, 530, 490),
    );
    const detail = fbm(x * 0.032, z * 0.032, 5) * Math.min(22, mountain * 0.14);
    const land = Math.min(1, inland / 80);
    return inland * 0.038 + foothill + Math.max(0, mountain + detail) * land
      + fbm(x * 0.052, z * 0.052, 3) * Math.min(1.1, inland * 0.012);
  };

  // One continuous surface: local ground textures blend with elevation and slope.
  const terrainMat = terrainMaterial('grass', 0xf0f0e5);
  const rockTexMat = terrainMaterial('rock');
  const sandTexMat = terrainMaterial('sand');
  terrainMat.onBeforeCompile = (shader) => {
    shader.uniforms.coastRock = { value: rockTexMat.map };
    shader.uniforms.coastSand = { value: sandTexMat.map };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCoastWorld;\nvarying vec3 vCoastNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCoastWorld = (modelMatrix * vec4(position, 1.0)).xyz;\nvCoastNormal = normalize(mat3(modelMatrix) * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCoastWorld;\nvarying vec3 vCoastNormal;\nuniform sampler2D coastRock;\nuniform sampler2D coastSand;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 grassSample = texture2D(map, vMapUv);
          vec4 rockSample = texture2D(coastRock, vMapUv * 0.76);
          vec4 sandSample = texture2D(coastSand, vMapUv * 2.4);
          float coastSlope = 1.0 - normalize(vCoastNormal).y;
          float crag = smoothstep(0.17, 0.39, coastSlope);
          crag = max(crag, smoothstep(270.0, 470.0, vCoastWorld.y) * 0.55);
          vec4 groundSample = mix(grassSample, rockSample, crag);
          float beach = 1.0 - smoothstep(3.2, 7.8, vCoastWorld.y);
          groundSample = mix(groundSample, sandSample, beach);
          float wetSand = (1.0 - smoothstep(0.0, 1.7, vCoastWorld.y)) * beach;
          groundSample.rgb *= 1.0 - wetSand * 0.26;
          diffuseColor *= groundSample;
        #endif
      `);
  };
  terrainMat.customProgramCacheKey = () => 'lofoten-ground-v1';
  group.add(createTerrain({
    width: 2500, depth: 2600, centerX: -650, centerZ: -600,
    segments: 224, height, material: terrainMat,
    color: (x, y, z) => {
      const n = fbm(x * 0.012, z * 0.012, 3);
      return new Color().setRGB(0.90 + n * 0.06, 0.93 + n * 0.05, 0.87 + n * 0.055)
        .multiplyScalar(y < 6 ? 1.07 : 1);
    },
  }));

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
  const surfSteps = 360;
  const ribbonSteps = 4;
  for (let i = 0; i <= surfSteps; i++) {
    const z = 560 - i / surfSteps * 1680;
    for (let j = 0; j <= ribbonSteps; j++) {
      const outward = j / ribbonSteps * 24;
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
      void main() {
        float x = vSurf.x;
        float swell = sin(x * .68 + time * 1.18 + sin(vSurf.y * .05) * .65);
        float breaker = pow(max(0.0, swell), 14.0);
        float edge = smoothstep(0.0, 1.7, x) * (1.0 - smoothstep(5.0, 24.0, x));
        float flecks = .50 + .50 * sin(vSurf.y * 3.12 + sin(x * 5.1)) * sin(vSurf.y * .73 - x * 2.3);
        float alpha = (breaker * .36 + exp(-x * .5) * .15) * edge * flecks;
        gl_FragColor = vec4(.87, .94, .92, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const surf = new Mesh(surfGeometry, surfMaterial);
  surf.renderOrder = 2;
  group.add(surf);

  // Weathered granite along the high-tide mark and a few offshore skerries.
  const rockGeometry = new IcosahedronGeometry(1, 2);
  const rockPosition = rockGeometry.getAttribute('position');
  const rockColors: number[] = [];
  for (let i = 0; i < rockPosition.count; i++) {
    const x = rockPosition.getX(i), y = rockPosition.getY(i), z = rockPosition.getZ(i);
    const rough = 1 + fbm(x * 3.6 + 17, z * 3.6 + y * 2.8, 3) * 0.28;
    rockPosition.setXYZ(i, x * rough, y * rough, z * rough);
    const v = 0.83 + Math.max(0, y) * 0.13;
    rockColors.push(v, v, v * 0.98);
  }
  rockGeometry.setAttribute('color', new Float32BufferAttribute(rockColors, 3));
  rockGeometry.computeVertexNormals();
  const rocks = new InstancedMesh(rockGeometry, terrainMaterial('rock', 0xbec4c0, 1), 64);
  const transform = new Matrix4();
  for (let i = 0; i < 64; i++) {
    const z = i < 10 ? 90 + random() * 95 : -650 + random() * 1070;
    const inland = 8 + random() * 44;
    const x = shoreX(z) - inland;
    const scale = i < 10 ? 2 + random() * 4 : 0.6 + random() * 2.8;
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), random() * Math.PI * 2);
    transform.compose(new Vector3(x, height(x, z) + scale * 0.16, z), q,
      new Vector3(scale * (0.8 + random()), scale * 0.6, scale * (0.7 + random() * 0.8)));
    rocks.setMatrixAt(i, transform);
  }
  rocks.receiveShadow = true;
  rocks.castShadow = true;
  group.add(rocks);

  // A low distant headland gives the open water a real horizon and a sense of scale.
  const islandHeight = (x: number, z: number) => {
    const ridge = Math.max(
      peak(x, z, 490, -1530, 230, 145, 145),
      peak(x, z, 680, -1570, 160, 150, 188),
      peak(x, z, 870, -1580, 210, 190, 103),
    );
    return ridge > 0 ? ridge + fbm(x * 0.04, z * 0.04, 3) * Math.min(10, ridge * 0.16) - 4 : -10;
  };
  group.add(createTerrain({
    width: 1000, depth: 650, centerX: 650, centerZ: -1550, segments: 80,
    height: islandHeight, material: terrainMaterial('rock', 0x849893),
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
      { position: new Vector3(-47, 8, -25), name: '北极白沙', message: '豪克兰湾的浅色细沙与清澈海水，让北极圈内也拥有一片明亮海岸。' },
      { position: new Vector3(118, 5, -140), name: '大西洋涌浪', message: '波浪越过挪威海，在浅湾中变得透亮，抵岸时化作一道细细的白沫。' },
      { position: new Vector3(-210, 70, -265), name: '海岸山脊', message: '罗弗敦陡峭的古老岩峰从海面拔起，冰川曾沿着山谷雕刻出岛屿的轮廓。' },
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
