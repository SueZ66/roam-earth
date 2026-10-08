import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial,
  PlaneGeometry, Quaternion, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWater, fbm, seeded, terrainMaterial } from './nature';
import { detailMaterial, landscapeMaterial } from './surface';
import { faroeHeight } from './faroe-elevation';
import { focusedTerrain } from './photographic-terrain';
import { addScannedRocks } from './scanned-rocks';
import type { Landscape } from './types';

/** Actual Vágar elevation anchors the geography. Vegetation, cottage and small
 * surface relief are authored scenery, not a surveyed reconstruction. */
export function createMeadow(): Landscape {
  const group = new Group();
  group.name = 'Faroe Islands — Atlantic grasslands';
  const random = seeded(19061);
  const gaussian = (value: number, width: number) => Math.exp(-((value / width) ** 2));
  const smooth = (a: number, b: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const cottageX = 24;
  const cottageZ = 70;
  const rawHeight = (x: number, z: number) => {
    const elevation = faroeHeight(x, z);
    if (elevation < 0.6) return -6;
    const land = smooth(0.6, 6, elevation);
    // Metre-scale tussocks and erosion remain subordinate to real valley walls,
    // saddles and cliff silhouettes rather than inventing new rounded peaks.
    const turf = fbm(x * 0.058, z * 0.058, 4) * 0.58;
    const crags = fbm(x * 0.021 + 17, z * 0.021, 4) * smooth(170, 480, elevation) * 3.8;
    return -6 * (1 - land) + (elevation + turf + crags) * land;
  };
  const cottageY = rawHeight(cottageX, cottageZ);
  const height = (x: number, z: number) => {
    const flatten = 1 - smooth(7, 18, Math.hypot(x - cottageX, z - cottageZ));
    return rawHeight(x, z) * (1 - flatten) + cottageY * flatten;
  };
  const footpathX = (z: number) => 17 + 34 * Math.sin((z + 74) * 0.009)
    - 16 * gaussian(z - 70, 120);

  const groundMaterial = landscapeMaterial({ biome: 'meadow', tint: 0xf4f6ee, scale: 32, normalStrength: 0.9 });
  const basaltMaterial = detailMaterial('rock', 0x8c9487, 2.0);
  const terrain = focusedTerrain({
    minX: -3850, maxX: 2450, minZ: -3900, maxZ: 2450,
    focusX: 42, focusZ: 140, segments: 448, concentration: 0.15,
    height, material: groundMaterial,
    color: (x, y, z, slope) => {
      const moisture = fbm(x * 0.017 + 26, z * 0.017 - 12, 4) * 0.055;
      const dry = smooth(160, 440, y) * 0.025;
      const cliff = smooth(0.38, 0.65, slope) * 0.025;
      return new Color().setRGB(
        0.93 + moisture + dry - cliff,
        0.98 + moisture - dry - cliff,
        0.90 + moisture - dry,
      );
    },
  });
  const ground = terrain.mesh;
  ground.castShadow = true;
  group.add(ground);
  const surfaceHeight = terrain.sample;

  const sea = createWater({ size: 12000, height: 0.15, color: 0x28424b, amplitude: 0.2, distortion: 1.15,
    sunDirection: new Vector3(-0.55, 0.64, 0.23) });
  sea.geometry.dispose();
  sea.geometry = new PlaneGeometry(12000, 12000, 48, 48);
  group.add(sea);

  // A worn walking trail follows the contours, becoming fine and intermittent
  // as it recedes into the valley. It provides a readable human scale.
  const pathPositions: number[] = [];
  const pathUV: number[] = [];
  const pathColors: number[] = [];
  const pathSteps = 460;
  for (let n = 0; n < pathSteps; n++) {
    const z0 = 305 - n / pathSteps * 900;
    const z1 = 305 - (n + 1) / pathSteps * 900;
    const half0 = 0.48 + 0.11 * Math.sin(z0 * 0.05);
    const half1 = 0.48 + 0.11 * Math.sin(z1 * 0.05);
    const verts = [
      [footpathX(z0) - half0, z0], [footpathX(z1) - half1, z1], [footpathX(z0) + half0, z0],
      [footpathX(z0) + half0, z0], [footpathX(z1) - half1, z1], [footpathX(z1) + half1, z1],
    ];
    for (const [x, z] of verts) {
      pathPositions.push(x, surfaceHeight(x, z) + 0.065, z);
      pathUV.push(x / 9, z / 9);
      pathColors.push(0.64, 0.57, 0.43);
    }
  }
  const pathGeometry = new BufferGeometry();
  pathGeometry.setAttribute('position', new Float32BufferAttribute(pathPositions, 3));
  pathGeometry.setAttribute('uv', new Float32BufferAttribute(pathUV, 2));
  pathGeometry.setAttribute('color', new Float32BufferAttribute(pathColors, 3));
  pathGeometry.computeVertexNormals();
  const pathMaterial = terrainMaterial('rock', 0xd9cda8, 1.4);
  const trail = new Mesh(pathGeometry, pathMaterial);
  trail.receiveShadow = true;
  group.add(trail);

  // Eroded boulders share one detailed geometry and a single instanced draw.
  const boulderGeometry = new IcosahedronGeometry(1, 5);
  const boulderPositions = boulderGeometry.getAttribute('position');
  for (let n = 0; n < boulderPositions.count; n++) {
    const x = boulderPositions.getX(n), y = boulderPositions.getY(n), z = boulderPositions.getZ(n);
    const joint = Math.pow(Math.abs(Math.sin(y * 12.8 + z * 0.36)), 18) * 0.08;
    const erosion = 1 + fbm(x * 4 + z, y * 4 - z, 4) * 0.27 - joint;
    boulderPositions.setXYZ(n, Math.min(x * erosion, 0.84 - z * 0.21),
      Math.min(y * erosion * 0.94, 0.80 + x * 0.14), z * erosion);
  }
  boulderGeometry.computeVertexNormals();
  boulderGeometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(boulderPositions.count * 3).fill(1), 3));
  const boulders = new InstancedMesh(boulderGeometry, basaltMaterial, 128);
  // These are general-purpose Poly Haven photogrammetry assets, not scans
  // captured in the Faroes. Four foreground pieces replace procedural rocks.
  const scannedRocks = [
    { x: 30, z: 112, size: 2.0, yaw: 0.6 },
    { x: 48, z: 96, size: 1.65, yaw: 2.1 },
    { x: 18, z: 72, size: 1.3, yaw: -0.8 },
    { x: 58, z: 55, size: 1.8, yaw: 1.3 },
  ];
  const inScannedRock = (x: number, z: number) => scannedRocks.some(rock => Math.hypot(x - rock.x, z - rock.z) < rock.size * 0.58);
  const proceduralRocks: { x: number; z: number; size: number; matrix: Matrix4; color: Color }[] = [];
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const position = new Vector3();
  const scale = new Vector3();
  for (let n = 0; n < boulders.count; n++) {
    const fan = n < 36 ? [91, 128, 24, 31] : n < 64 ? [-18, 15, 20, 33]
      : [[-260, -650, 43, 105], [430, -650, 52, 122], [700, -1050, 55, 140]][n % 3];
    const x = fan[0] + (random() - 0.5) * fan[2];
    const z = fan[1] + (random() - 0.5) * fan[3];
    const size = n < 64 ? 0.25 + random() ** 2 * 1.7 : 0.9 + random() ** 2 * 3.8;
    position.set(x, surfaceHeight(x, z) - size * 0.14, z);
    quaternion.setFromAxisAngle(up, random() * Math.PI * 2);
    scale.set(size * (0.9 + random()), size * (0.45 + random() * 0.45), size * (0.75 + random()));
    matrix.compose(position, quaternion, scale);
    const lichen = random();
    proceduralRocks.push({ x, z, size, matrix: matrix.clone(),
      color: new Color().setRGB(0.73 + lichen * 0.19, 0.76 + lichen * 0.22, 0.71 + lichen * 0.14) });
  }
  const replacedRocks = new Set<number>();
  for (const scan of scannedRocks) {
    let nearest = -1, nearestDistance = Infinity;
    proceduralRocks.forEach((rock, i) => {
      const distance = Math.hypot(rock.x - scan.x, rock.z - scan.z);
      if (!replacedRocks.has(i) && distance < nearestDistance) { nearest = i; nearestDistance = distance; }
    });
    if (nearest >= 0) replacedRocks.add(nearest);
  }
  let boulderCount = 0;
  proceduralRocks.forEach((rock, i) => {
    if (replacedRocks.has(i) || scannedRocks.some(scan => Math.hypot(rock.x - scan.x, rock.z - scan.z) < scan.size * 0.65 + rock.size * 2.1)) return;
    boulders.setMatrixAt(boulderCount, rock.matrix);
    boulders.setColorAt(boulderCount, rock.color);
    boulderCount++;
  });
  boulders.count = boulderCount;
  boulders.castShadow = true;
  boulders.receiveShadow = true;
  group.add(boulders);
  addScannedRocks(group, scannedRocks, surfaceHeight);

  // Five irregular, curved blades form a tuft. Fine fescue, upright wetland
  // rushes and low broad-leaf rosettes grow in separate, irregular communities.
  // All three share one wind program and need only three instanced draws.
  // together in the prevailing Atlantic wind, with a separate local flutter.
  const blades: number[] = [];
  const bladeColors: number[] = [];
  const bladeIndices: number[] = [];
  for (let blade = 0; blade < 5; blade++) {
    const angle = blade * 2.399 + random() * 0.4;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const spread = random() * 0.16;
    const h = 0.28 + random() * 0.25;
    const width = 0.02 + random() * 0.017;
    const bend = 0.13 + random() * 0.19;
    const vertices = [
      [dx * spread - dz * width, 0, dz * spread + dx * width],
      [dx * spread + dz * width, 0, dz * spread - dx * width],
      [dx * (spread + bend * 0.25) - dz * width * 0.55, h * 0.51, dz * (spread + bend * 0.25) + dx * width * 0.55],
      [dx * (spread + bend * 0.25) + dz * width * 0.55, h * 0.51, dz * (spread + bend * 0.25) - dx * width * 0.55],
      [dx * (spread + bend * 0.62) - dz * width * 0.25, h * 0.79, dz * (spread + bend * 0.62) + dx * width * 0.25],
      [dx * (spread + bend * 0.62) + dz * width * 0.25, h * 0.79, dz * (spread + bend * 0.62) - dx * width * 0.25],
      [dx * (spread + bend), h, dz * (spread + bend)],
    ];
    const base = blades.length / 3;
    for (let n = 0; n < vertices.length; n++) {
      blades.push(...vertices[n]);
      const tip = n === 6 ? 1 : n > 3 ? 0.82 : n > 1 ? 0.46 : 0;
      bladeColors.push(0.17 + tip * 0.05, 0.27 + tip * 0.07, 0.095 + tip * 0.035);
    }
    bladeIndices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3,
      base + 2, base + 4, base + 3, base + 3, base + 4, base + 5, base + 4, base + 6, base + 5);
  }
  const grassGeometry = new BufferGeometry();
  grassGeometry.setAttribute('position', new Float32BufferAttribute(blades, 3));
  grassGeometry.setAttribute('color', new Float32BufferAttribute(bladeColors, 3));
  grassGeometry.setIndex(bladeIndices);
  grassGeometry.computeVertexNormals();
  const windUniform = { value: 0 };
  const grassMaterial = new MeshStandardMaterial({ color: 0x849f71, roughness: 1, envMapIntensity: 0.25,
    side: DoubleSide, vertexColors: true });
  grassMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = windUniform;
    shader.vertexShader = `uniform float windTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 root = instanceMatrix[3].xyz;
      float gust = sin(root.x * 0.059 + root.z * 0.035 - windTime * 1.6);
      float flutter = sin(root.x * 0.21 - root.z * 0.19 + windTime * 3.2);
      float bend = position.y * position.y;
      transformed.x += bend * (0.28 + gust * 0.17 + flutter * 0.035);
      transformed.z += bend * (0.13 + gust * 0.07);
    `);
  };
  grassMaterial.customProgramCacheKey = () => 'faroe-grass-wind-v1';
  const grassPatches = Array.from({ length: 112 }, (_, i) => {
    const near = i < 82;
    const x = near ? 56 + (random() - 0.5) * 124 : -100 + random() * 330;
    const z = near ? 35 + random() * 122 : -150 + random() * 270;
    return { x, z, width: 0.65 + random() ** 2 * 3.8, stretch: 0.65 + random() * 1.1,
      moisture: fbm(x * 0.026 + 9, z * 0.026 - 24, 3) };
  });
  const withinPatch = (patch: typeof grassPatches[number]) => {
    const angle = random() * Math.PI * 2;
    const radius = Math.min(2.7, Math.sqrt(-2 * Math.log(Math.max(0.001, random())))) * patch.width * 0.46;
    return [patch.x + Math.cos(angle) * radius * patch.stretch, patch.z + Math.sin(angle) * radius];
  };
  const grasses = new InstancedMesh(grassGeometry, grassMaterial, 6500);
  let tuft = 0;
  while (tuft < grasses.count) {
    const patch = grassPatches[Math.floor(random() * (tuft < 4800 ? 82 : grassPatches.length))];
    const [x, z] = withinPatch(patch);
    const community = fbm(x * 0.31 + 4, z * 0.31 - 18, 3);
    if (Math.abs(x - footpathX(z)) < 0.75 || Math.hypot(x - cottageX, z - cottageZ) < 10
      || surfaceHeight(x, z) < 7 || community < -0.47 || inScannedRock(x, z)) continue;
    const tuftScale = 0.67 + random() * 0.92;
    position.set(x, surfaceHeight(x, z) - 0.012, z);
    quaternion.setFromAxisAngle(up, random() * Math.PI * 2);
    scale.set(tuftScale, tuftScale * (0.83 + random() * 0.4), tuftScale);
    matrix.compose(position, quaternion, scale);
    grasses.setMatrixAt(tuft, matrix);
    const damp = fbm(x * 0.026 + 9, z * 0.026 - 24, 3);
    grasses.setColorAt(tuft, new Color().setRGB(0.90 - damp * 0.16, 0.97 - damp * 0.035, 0.83 - damp * 0.12));
    tuft++;
  }
  grasses.receiveShadow = true;
  group.add(grasses);

  for (const wet of [true, false]) {
    const geometry = grassGeometry.clone();
    const points = geometry.getAttribute('position');
    for (let n = 0; n < points.count; n++) {
      points.setXYZ(n, points.getX(n) * (wet ? 0.46 : 1.72), points.getY(n) * (wet ? 1.4 : 0.41),
        points.getZ(n) * (wet ? 0.46 : 1.72));
    }
    geometry.computeVertexNormals();
    const plants = new InstancedMesh(geometry, grassMaterial, wet ? 1600 : 2200);
    const suitable = grassPatches.filter(patch => wet ? patch.moisture > 0.02 : patch.moisture < 0.12);
    const communities = suitable.length ? suitable : grassPatches;
    let n = 0;
    while (n < plants.count) {
      const [x, z] = withinPatch(communities[Math.floor(random() * communities.length)]);
      if (Math.abs(x - footpathX(z)) < 0.85
        || surfaceHeight(x, z) < 7 || Math.hypot(x - cottageX, z - cottageZ) < 10 || inScannedRock(x, z)) continue;
      const size = 0.55 + random() * 0.8;
      matrix.compose(position.set(x, surfaceHeight(x, z) - 0.015, z),
        quaternion.setFromAxisAngle(up, random() * Math.PI * 2), scale.set(size, size, size));
      plants.setMatrixAt(n, matrix);
      plants.setColorAt(n, new Color().setRGB(wet ? 0.68 : 0.97, wet ? 0.86 : 0.91, wet ? 0.63 : 0.75));
      n++;
    }
    plants.receiveShadow = true;
    group.add(plants);
  }

  // Salt and wind leave low, collapsed straw in the exposed patches between
  // fresh tussocks. Warm fibres stay sparse and below the live grass canopy.
  const strawGeometry = grassGeometry.clone();
  const strawPositions = strawGeometry.getAttribute('position');
  const strawColors = strawGeometry.getAttribute('color');
  for (let n = 0; n < strawPositions.count; n++) {
    strawPositions.setXYZ(n, strawPositions.getX(n) * 1.45, strawPositions.getY(n) * 0.52, strawPositions.getZ(n) * 1.45);
    strawColors.setXYZ(n, 0.41, 0.34, 0.21);
  }
  strawGeometry.computeVertexNormals();
  const strawMaterial = new MeshStandardMaterial({ color: 0xa99c7d, roughness: 1, envMapIntensity: 0.2,
    side: DoubleSide, vertexColors: true });
  strawMaterial.onBeforeCompile = grassMaterial.onBeforeCompile;
  strawMaterial.customProgramCacheKey = () => 'faroe-low-weathered-straw';
  const straw = new InstancedMesh(strawGeometry, strawMaterial, 620);
  const exposed = grassPatches.filter(patch => patch.moisture < -0.04);
  const strawPatches = exposed.length ? exposed : grassPatches;
  let strawIndex = 0;
  while (strawIndex < straw.count) {
    const [x, z] = withinPatch(strawPatches[Math.floor(random() * strawPatches.length)]);
    if (surfaceHeight(x, z) < 7
      || Math.abs(x - footpathX(z)) < 0.7 || Math.hypot(x - cottageX, z - cottageZ) < 10 || inScannedRock(x, z)) continue;
    const size = 0.6 + random() * 0.65;
    matrix.compose(position.set(x, surfaceHeight(x, z) - 0.01, z), quaternion.setFromAxisAngle(up, random() * 6.28), scale.set(size, size, size));
    straw.setMatrixAt(strawIndex, matrix);
    straw.setColorAt(strawIndex, new Color().setScalar(0.79 + random() * 0.22));
    strawIndex++;
  }
  straw.receiveShadow = true;
  group.add(straw);

  // Sparse sea-thrift-sized flowers: 4 cm heads on fine stems, never oversized
  // decorative daisies. Several heads and leaves remain one instanced object.
  const flowerVertices: number[] = [], flowerColors: number[] = [];
  const flowerTriangle = (a: number[], b: number[], c: number[], color: number[]) => {
    flowerVertices.push(...a, ...b, ...c);
    flowerColors.push(...color, ...color, ...color);
  };
  for (let stem = 0; stem < 2; stem++) {
    const bx = stem * 0.048, bz = stem * -0.035, h = 0.22 + stem * 0.075;
    const green = [0.15, 0.25, 0.08];
    flowerTriangle([bx - 0.005, 0, bz], [bx + 0.005, 0, bz], [bx + 0.018, h, bz], green);
    flowerTriangle([bx + 0.005, 0, bz], [bx + 0.026, h, bz], [bx + 0.018, h, bz], green);
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal * Math.PI * 0.4;
      const cx = bx + 0.022, radius = 0.036;
      const center = [cx, h, bz];
      const left = [cx + Math.cos(angle - 0.36) * radius, h + 0.005, bz + Math.sin(angle - 0.36) * radius];
      const tip = [cx + Math.cos(angle) * radius * 1.24, h - 0.004, bz + Math.sin(angle) * radius * 1.24];
      const right = [cx + Math.cos(angle + 0.36) * radius, h + 0.005, bz + Math.sin(angle + 0.36) * radius];
      const pink = [0.58, 0.31, 0.39];
      flowerTriangle(center, left, tip, pink);
      flowerTriangle(center, tip, right, pink);
    }
    flowerTriangle([bx, h * 0.28, bz], [bx - 0.066, h * 0.47, bz + 0.02], [bx, h * 0.34, bz + 0.025], green);
  }
  const flowerGeometry = new BufferGeometry();
  flowerGeometry.setAttribute('position', new Float32BufferAttribute(flowerVertices, 3));
  flowerGeometry.setAttribute('color', new Float32BufferAttribute(flowerColors, 3));
  flowerGeometry.computeVertexNormals();
  const flowerMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, envMapIntensity: 0.2, side: DoubleSide, vertexColors: true });
  flowerMaterial.onBeforeCompile = grassMaterial.onBeforeCompile;
  flowerMaterial.customProgramCacheKey = () => 'faroe-small-flower-wind';
  const flowers = new InstancedMesh(flowerGeometry, flowerMaterial, 240);
  for (let n = 0; n < flowers.count; n++) {
    const patch = [[52, 134], [32, 110], [87, 86]][n % 3];
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * 6;
    let x = patch[0] + Math.cos(angle) * radius, z = patch[1] + Math.sin(angle) * radius;
    if (Math.abs(x - footpathX(z)) < 1.2) x += 3.2;
    if (inScannedRock(x, z)) x += 3.5;
    const size = 0.7 + random() * 0.75;
    matrix.compose(position.set(x, surfaceHeight(x, z), z), quaternion.setFromAxisAngle(up, random() * 6.28), scale.set(size, size, size));
    flowers.setMatrixAt(n, matrix);
    flowers.setColorAt(n, new Color().setRGB(0.79 + random() * 0.17, 0.81 + random() * 0.14, 0.85 + random() * 0.14));
  }
  flowers.receiveShadow = true;
  group.add(flowers);

  // A modest tarred-timber cottage with a thick living turf roof. Its scale is
  // architectural (9 × 6 metres), so the surrounding fells remain monumental.
  const cottage = new Group();
  cottage.position.set(cottageX, cottageY, cottageZ);
  const wood = new MeshStandardMaterial({ color: 0x242724, roughness: 0.93 });
  const boards = new MeshStandardMaterial({ color: 0x444b41, roughness: 0.98, envMapIntensity: 0.4, vertexColors: true });
  boards.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec2 vBoardUv;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBoardUv = uv;');
    shader.fragmentShader = `varying vec2 vBoardUv;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        float grain = sin(vBoardUv.x * 174. + sin(vBoardUv.y * 15. + vBoardUv.x * 6.) * 2.);
        float weather = sin(vBoardUv.x * 43. + vBoardUv.y * 1.7) * .04;
        diffuseColor.rgb *= .92 + grain * .035 + weather;
      `);
  };
  boards.customProgramCacheKey = () => 'faroe-weathered-vertical-timber';
  const frame = new MeshStandardMaterial({ color: 0xbcbcae, roughness: 0.86 });
  const glass = new MeshStandardMaterial({ color: 0x39494b, roughness: 0.16, metalness: 0.24 });
  const chimneyMaterial = new MeshStandardMaterial({ color: 0x5a5d56, roughness: 0.92 });
  const turf = detailMaterial('grass', 0xa8c79e, 0.9);
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: MeshStandardMaterial) => {
    const geometry = new BoxGeometry(w, h, d);
    if (material.vertexColors) geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3));
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    cottage.add(mesh);
    return mesh;
  };
  box(9.5, 0.75, 6.4, 0, 0.1, 0, basaltMaterial);
  box(9, 3.45, 6, 0, 1.8, 0, wood);
  // Narrow boards project from the dark structural wall, leaving real joints
  // and weathered end grain. All are merged by material below, not drawn alone.
  const plank = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = box(w, h, d, x, y, z, boards);
    const tint = 0.68 + random() * 0.29;
    const color = mesh.geometry.getAttribute('color');
    for (let n = 0; n < color.count; n++) color.setXYZ(n, tint, tint * 1.01, tint * 0.97);
    return mesh;
  };
  for (let n = 0; n < 47; n++) {
    const x = -4.4 + n * 8.8 / 46;
    for (const side of [-1, 1]) {
      plank(0.177, 3.36, 0.048, x, 1.83, side * 3.04);
      const gableHeight = Math.max(0, 2.48 - Math.abs(x) * 0.555);
      if (gableHeight > 0.09) plank(0.177, gableHeight, 0.048, x, 3.49 + gableHeight * 0.5, side * 3.043);
    }
  }
  for (let n = 0; n < 32; n++) for (const side of [-1, 1]) {
    plank(0.048, 3.36, 0.17, side * 4.536, 1.83, -2.9 + n * 5.8 / 31);
  }
  // Hand-laid foundation courses and a worn threshold give the cottage weight.
  for (let course = 0; course < 2; course++) for (let n = 0; n < 13; n++) {
    box(0.63 + random() * 0.1, 0.28, 0.16, -4.45 + n * 0.72 + course * 0.13,
      -0.04 + course * 0.29, 3.25 + random() * 0.025, basaltMaterial);
  }
  const gableGeometry = new BufferGeometry();
  gableGeometry.setAttribute('position', new Float32BufferAttribute([
    -4.5, 3.5, 3.01, 4.5, 3.5, 3.01, 0, 6, 3.01,
    4.5, 3.5, -3.01, -4.5, 3.5, -3.01, 0, 6, -3.01,
  ], 3));
  gableGeometry.computeVertexNormals();
  cottage.add(new Mesh(gableGeometry, wood));
  for (const sign of [-1, 1]) {
    const roof = box(5.52, 0.37, 7.0, sign * 2.33, 4.79, 0, turf);
    roof.geometry.dispose();
    const sod = new BoxGeometry(5.52, 0.37, 7.0, 16, 1, 24);
    const sodPositions = sod.getAttribute('position');
    const sodColors = new Float32Array(sodPositions.count * 3);
    for (let n = 0; n < sodPositions.count; n++) {
      const x = sodPositions.getX(n), y = sodPositions.getY(n), z = sodPositions.getZ(n);
      const patch = fbm(x * 1.4 + sign * 14, z * 1.4, 3);
      if (y > 0) sodPositions.setY(n, y + patch * 0.058);
      sodColors.set([0.91 + patch * 0.09, 0.98 + patch * 0.07, 0.85 + patch * 0.08], n * 3);
    }
    sod.setAttribute('color', new Float32BufferAttribute(sodColors, 3));
    sod.computeVertexNormals();
    roof.geometry = sod;
    roof.rotation.z = sign * -0.507;
    const edge = box(5.7, 0.2, 0.16, sign * 2.35, 4.76, 3.56, wood);
    edge.rotation.z = sign * -0.507;
    box(0.17, 0.29, 7.18, sign * 4.79, 3.58, 0, boards);
  }
  box(0.75, 2.7, 0.85, 2.7, 5.65, -1.6, chimneyMaterial);
  box(1.0, 0.16, 1.1, 2.7, 7.04, -1.6, chimneyMaterial);
  box(1.32, 2.52, 0.14, 0.5, 1.38, 3.05, frame);
  box(1.05, 2.31, 0.18, 0.5, 1.36, 3.15, wood);
  for (let n = 0; n < 6; n++) plank(0.144, 2.23, 0.045, 0.08 + n * 0.169, 1.35, 3.255);
  box(1.41, 0.18, 0.64, 0.5, 0.18, 3.37, basaltMaterial);
  box(0.047, 0.26, 0.047, 0.89, 1.41, 3.3, chimneyMaterial);
  for (const x of [-2.5, 2.75]) {
    box(1.54, 1.51, 0.14, x, 2.07, 3.05, frame);
    box(1.3, 1.27, 0.08, x, 2.07, 3.14, glass);
    box(0.065, 1.31, 0.06, x, 2.07, 3.2, frame);
    box(1.34, 0.065, 0.06, x, 2.07, 3.2, frame);
    box(1.67, 0.105, 0.35, x, 1.30, 3.16, frame);
    box(1.72, 0.075, 0.19, x, 2.85, 3.14, boards);
  }
  // A rough chimney joint grid adds scale to the stone cap without bright lines.
  for (let n = 0; n < 7; n++) box(0.76, 0.033, 0.016, 2.7, 4.54 + n * 0.34, -1.168, wood);
  const houseBatches = new Map<MeshStandardMaterial, BufferGeometry[]>();
  for (const child of [...cottage.children]) {
    if (!(child instanceof Mesh)) continue;
    child.updateMatrix();
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(child.matrix);
    if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
    if (!geometry.getAttribute('color')) geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3));
    const material = child.material as MeshStandardMaterial;
    const batch = houseBatches.get(material) ?? [];
    batch.push(geometry);
    houseBatches.set(material, batch);
    child.geometry.dispose();
    cottage.remove(child);
  }
  for (const [material, geometries] of houseBatches) {
    const merged = mergeGeometries(geometries, false);
    if (merged) {
      const mesh = new Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      cottage.add(mesh);
    }
    for (const geometry of geometries) geometry.dispose();
  }
  const roofGrasses = new InstancedMesh(grassGeometry, grassMaterial, 260);
  for (let n = 0; n < roofGrasses.count; n++) {
    const x = (random() - 0.5) * 9.1, z = (random() - 0.5) * 6.9;
    const y = 6.318 - Math.abs(x) * Math.tan(0.507);
    const size = 0.3 + random() * 0.42;
    matrix.compose(position.set(x, y, z), quaternion.setFromAxisAngle(up, random() * 6.28), scale.set(size, size, size));
    roofGrasses.setMatrixAt(n, matrix);
    roofGrasses.setColorAt(n, new Color().setScalar(0.78 + random() * 0.23));
  }
  roofGrasses.receiveShadow = true;
  cottage.add(roofGrasses);
  group.add(cottage);

  const cameraX = 40;
  const cameraZ = 149;
  return {
    heightAt: height,
    group,
    collectibles: [
      { position: new Vector3(-30, height(-30, -150) + 16, -150), name: '草顶人家', message: '法罗群岛的草皮屋顶，让建筑也长成山坡的一部分。' },
      { position: new Vector3(footpathX(-265), height(footpathX(-265), -265) + 12, -265), name: '北纬六十二度', message: '从北大西洋吹来的风，沿着没有树木的山谷长驱而入。' },
      { position: new Vector3(60, height(60, -850) + 18, -850), name: '玄武岩的年轮', message: '层层深色岩带，记录着这片火山群岛古老的地质时间。' },
    ],
    view: {
      position: new Vector3(cameraX, height(cameraX, cameraZ) + 8.5, cameraZ),
      target: new Vector3(-20, 255, -1150), fov: 53,
      minDistance: 1000, maxDistance: 1580, azimuthRange: 0.35, polarRange: 0.10,
    },
    atmosphere: {
      fogColor: 0xbdc6c5, fogDensity: 0.00026,
      sunPosition: new Vector3(-750, 510, 350), sunColor: 0xfff4e1,
      sunIntensity: 2.8, exposure: 0.95, skyRotation: 0.83,
    },
    update: (elapsed: number) => {
      windUniform.value = elapsed;
      sea.material.uniforms.time.value = elapsed * 0.48;
    },
  };
}
