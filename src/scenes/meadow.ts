import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial,
  PlaneGeometry, Quaternion, Vector3,
} from 'three';
import { createTerrain, createWater, fbm, seeded, terrainMaterial } from './nature';
import type { Landscape } from './types';

/** A landscape study inspired by the long, treeless valleys of the Faroe Islands.
 * The geography is procedural, rather than a claim to reproduce survey data. */
export function createMeadow(): Landscape {
  const group = new Group();
  group.name = 'Faroe Islands — Atlantic grasslands';
  const random = seeded(19061);
  const gaussian = (value: number, width: number) => Math.exp(-((value / width) ** 2));
  const smooth = (a: number, b: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const cottageX = -79;
  const cottageZ = -94;
  const rawHeight = (x: number, z: number) => {
    // Wide glacial floor, with an open north-facing inlet beyond the pass.
    const floor = 8 + (z + 500) * 0.044;
    const leftSpine = -442 + 74 * Math.sin((z + 90) * 0.0034);
    const rightSpine = 475 + 77 * Math.sin(z * 0.0027);
    const leftMass = 390 * gaussian(x - leftSpine, 235)
      * (0.47 + 0.53 * gaussian(z + 370, 590));
    const rightMass = 457 * gaussian(x - rightSpine, 259)
      * (0.31 + 0.69 * gaussian(z + 790, 575));
    const farHeadland = 302 * gaussian(x + 656, 450) * gaussian(z + 1300, 415);
    const mass = leftMass + rightMass + farHeadland;
    const crag = fbm(x * 0.008, z * 0.008, 5) * (4 + mass * 0.075);
    // Parallel erosion channels cut the volcanic slopes without angular cones.
    const grooves = Math.pow(Math.abs(Math.sin(z * 0.042 + fbm(x * 0.009, z * 0.009, 3) * 3.5)), 3)
      * mass * 0.039;
    const foreground = 9 * gaussian(x - 85, 210) * gaussian(z - 185, 220)
      + 10 * gaussian(x + 165, 145) * gaussian(z - 115, 180);
    return floor + mass + crag - grooves + foreground;
  };
  const cottageY = rawHeight(cottageX, cottageZ);
  const height = (x: number, z: number) => {
    const flatten = 1 - smooth(7, 18, Math.hypot(x - cottageX, z - cottageZ));
    return rawHeight(x, z) * (1 - flatten) + cottageY * flatten;
  };
  const footpathX = (z: number) => 17 + 34 * Math.sin((z + 74) * 0.009)
    - 61 * gaussian(z + 92, 135);

  const groundMaterial = terrainMaterial('grass', 0xb0d8af, 1.6);
  const basaltMaterial = terrainMaterial('rock', 0x888c84, 1.2);
  const ground = createTerrain({
    width: 2520, depth: 2600, segments: 272, centerZ: -465,
    height, material: groundMaterial,
    color: (x, y, z, slope) => {
      const moisture = fbm(x * 0.008, z * 0.008, 3) * 0.085;
      const dry = smooth(160, 440, y) * 0.08;
      const cliff = smooth(0.38, 0.65, slope);
      return new Color().setRGB(
        0.76 + moisture + dry - cliff * 0.06,
        0.91 + moisture - dry - cliff * 0.03,
        0.80 + moisture - dry + cliff * 0.04,
      );
    },
  });
  // Basalt appears on steep faces and in thin stratified bands. Both layers use
  // photographed surface maps; the rock mask follows the actual terrain normal.
  const groundPositions = ground.geometry.getAttribute('position');
  const groundNormals = ground.geometry.getAttribute('normal');
  const rockMask = new Float32Array(groundPositions.count);
  for (let n = 0; n < rockMask.length; n++) {
    const y = groundPositions.getY(n);
    const slope = 1 - groundNormals.getY(n);
    const steep = smooth(0.38, 0.65, slope);
    const bands = Math.pow(Math.abs(Math.sin(y * 0.061)), 20) * smooth(72, 230, y) * 0.14
      * smooth(0.21, 0.5, slope);
    rockMask[n] = Math.max(steep, bands);
  }
  ground.geometry.setAttribute('basaltWeight', new Float32BufferAttribute(rockMask, 1));
  const originalGroundCompile = groundMaterial.onBeforeCompile;
  groundMaterial.onBeforeCompile = (shader, renderer) => {
    originalGroundCompile.call(groundMaterial, shader, renderer);
    shader.uniforms.basaltMap = { value: basaltMaterial.map };
    shader.vertexShader = `attribute float basaltWeight; varying float vBasaltWeight;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBasaltWeight = basaltWeight;');
    shader.fragmentShader = `uniform sampler2D basaltMap; varying float vBasaltWeight;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        vec3 volcanicRock = texture2D(basaltMap, vMapUv * 0.57).rgb * vec3(0.20, 0.24, 0.22);
        diffuseColor.rgb = mix(diffuseColor.rgb, volcanicRock, vBasaltWeight * 0.94);
      `);
  };
  groundMaterial.customProgramCacheKey = () => 'faroe-grass-basalt-v2';
  group.add(ground);
  // Sample the actual rendered triangles so the narrow trail and tiny blades
  // cannot float above or disappear below the coarser distant-landscape mesh.
  const surfaceHeight = (x: number, z: number) => {
    const gx = (x + 1260) / 2520 * 272;
    const gz = (z + 1765) / 2600 * 272;
    const ix = Math.max(0, Math.min(271, Math.floor(gx)));
    const iz = Math.max(0, Math.min(271, Math.floor(gz)));
    const u = gx - ix, v = gz - iz;
    const a = iz * 273 + ix;
    const ha = groundPositions.getY(a), hb = groundPositions.getY(a + 273);
    const hd = groundPositions.getY(a + 1), hc = groundPositions.getY(a + 274);
    return u + v <= 1 ? ha * (1 - u - v) + hd * u + hb * v
      : hc * (u + v - 1) + hb * (1 - u) + hd * (1 - v);
  };

  const sea = createWater({ size: 5200, height: -0.7, color: 0x28424b, amplitude: 0.2, distortion: 1.15,
    sunDirection: new Vector3(-0.55, 0.64, 0.23) });
  sea.geometry.dispose();
  sea.geometry = new PlaneGeometry(5200, 5200, 48, 48);
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
    const half0 = 0.73 + 0.16 * Math.sin(z0 * 0.05);
    const half1 = 0.73 + 0.16 * Math.sin(z1 * 0.05);
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
  const boulderGeometry = new IcosahedronGeometry(1, 2);
  const boulderPositions = boulderGeometry.getAttribute('position');
  for (let n = 0; n < boulderPositions.count; n++) {
    const x = boulderPositions.getX(n), y = boulderPositions.getY(n), z = boulderPositions.getZ(n);
    const erosion = 1 + fbm(x * 3 + z, y * 3 - z, 3) * 0.25;
    boulderPositions.setXYZ(n, x * erosion, y * erosion, z * erosion);
  }
  boulderGeometry.computeVertexNormals();
  boulderGeometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(boulderPositions.count * 3).fill(1), 3));
  const boulders = new InstancedMesh(boulderGeometry, basaltMaterial, 115);
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const position = new Vector3();
  const scale = new Vector3();
  for (let n = 0; n < boulders.count; n++) {
    const x = n < 48 ? -200 + random() * 370 : (random() < 0.5 ? -1 : 1) * (140 + random() * 305);
    const z = n < 48 ? 58 + random() * 193 : -820 + random() * 970;
    const size = n < 48 ? 0.35 + random() ** 2 * 2.0 : 1.3 + random() ** 2 * 4.4;
    position.set(x, surfaceHeight(x, z) - size * 0.14, z);
    quaternion.setFromAxisAngle(up, random() * Math.PI * 2);
    scale.set(size * (0.9 + random()), size * (0.45 + random() * 0.45), size * (0.75 + random()));
    matrix.compose(position, quaternion, scale);
    boulders.setMatrixAt(n, matrix);
    boulders.setColorAt(n, new Color().setScalar(0.69 + random() * 0.32));
  }
  boulders.castShadow = true;
  boulders.receiveShadow = true;
  group.add(boulders);

  // Five irregular, curved blades form a tuft. 2,800 instanced tufts animate
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
      [dx * (spread + bend), h, dz * (spread + bend)],
    ];
    const base = blades.length / 3;
    for (let n = 0; n < vertices.length; n++) {
      blades.push(...vertices[n]);
      const tip = n === 4 ? 1 : n > 1 ? 0.6 : 0;
      bladeColors.push(0.17 + tip * 0.05, 0.27 + tip * 0.07, 0.095 + tip * 0.035);
    }
    bladeIndices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3, base + 2, base + 4, base + 3);
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
  const grasses = new InstancedMesh(grassGeometry, grassMaterial, 2800);
  let tuft = 0;
  while (tuft < grasses.count) {
    const near = tuft < 2200;
    const x = near ? 65 + (random() - 0.5) * 185 : (random() - 0.5) * 380;
    const z = near ? 65 + random() * 212 : -185 + random() * 350;
    if (Math.abs(x - footpathX(z)) < 1.1 || Math.hypot(x - cottageX, z - cottageZ) < 10) continue;
    const tuftScale = 0.67 + random() * 0.92;
    position.set(x, surfaceHeight(x, z) - 0.012, z);
    quaternion.setFromAxisAngle(up, random() * Math.PI * 2);
    scale.set(tuftScale, tuftScale * (0.83 + random() * 0.4), tuftScale);
    matrix.compose(position, quaternion, scale);
    grasses.setMatrixAt(tuft, matrix);
    grasses.setColorAt(tuft, new Color().setScalar(0.8 + random() * 0.3));
    tuft++;
  }
  grasses.receiveShadow = true;
  group.add(grasses);

  // A modest tarred-timber cottage with a thick living turf roof. Its scale is
  // architectural (9 × 6 metres), so the surrounding fells remain monumental.
  const cottage = new Group();
  cottage.position.set(cottageX, cottageY, cottageZ);
  const wood = new MeshStandardMaterial({ color: 0x242724, roughness: 0.93 });
  const frame = new MeshStandardMaterial({ color: 0xbcbcae, roughness: 0.86 });
  const glass = new MeshStandardMaterial({ color: 0x39494b, roughness: 0.16, metalness: 0.24 });
  const chimneyMaterial = new MeshStandardMaterial({ color: 0x5a5d56, roughness: 0.92 });
  const turf = terrainMaterial('grass', 0x8cab85, 0.25);
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
  const gableGeometry = new BufferGeometry();
  gableGeometry.setAttribute('position', new Float32BufferAttribute([
    -4.5, 3.5, 3.01, 4.5, 3.5, 3.01, 0, 6, 3.01,
    4.5, 3.5, -3.01, -4.5, 3.5, -3.01, 0, 6, -3.01,
  ], 3));
  gableGeometry.computeVertexNormals();
  cottage.add(new Mesh(gableGeometry, wood));
  for (const sign of [-1, 1]) {
    const roof = box(5.52, 0.37, 7.0, sign * 2.33, 4.79, 0, turf);
    roof.rotation.z = sign * -0.507;
    const edge = box(5.7, 0.2, 0.16, sign * 2.35, 4.76, 3.56, wood);
    edge.rotation.z = sign * -0.507;
  }
  box(0.75, 2.7, 0.85, 2.7, 5.65, -1.6, chimneyMaterial);
  box(1.0, 0.16, 1.1, 2.7, 7.04, -1.6, chimneyMaterial);
  box(1.32, 2.52, 0.14, 0.5, 1.38, 3.05, frame);
  box(1.05, 2.31, 0.18, 0.5, 1.36, 3.15, wood);
  for (const x of [-2.5, 2.75]) {
    box(1.54, 1.51, 0.14, x, 2.07, 3.05, frame);
    box(1.3, 1.27, 0.08, x, 2.07, 3.14, glass);
    box(0.065, 1.31, 0.06, x, 2.07, 3.2, frame);
    box(1.34, 0.065, 0.06, x, 2.07, 3.2, frame);
  }
  group.add(cottage);

  const cameraX = 72;
  const cameraZ = 233;
  return {
    heightAt: height,
    group,
    collectibles: [
      { position: new Vector3(cottageX, cottageY + 10.5, cottageZ), name: '草顶人家', message: '法罗群岛的草皮屋顶，让建筑也长成山坡的一部分。' },
      { position: new Vector3(footpathX(-265), height(footpathX(-265), -265) + 12, -265), name: '北纬六十二度', message: '从北大西洋吹来的风，沿着没有树木的山谷长驱而入。' },
      { position: new Vector3(-179, height(-179, -455) + 16, -455), name: '玄武岩的年轮', message: '层层深色岩带，记录着这片火山群岛古老的地质时间。' },
    ],
    view: {
      position: new Vector3(cameraX, height(cameraX, cameraZ) + 11.2, cameraZ),
      target: new Vector3(-31, 113, -570), fov: 53,
      minDistance: 475, maxDistance: 1040, azimuthRange: 0.49, polarRange: 0.20,
    },
    atmosphere: {
      fogColor: 0xb9c4c4, fogDensity: 0.00054,
      sunPosition: new Vector3(-620, 710, 255), sunColor: 0xfff4dc,
      sunIntensity: 2.5, exposure: 0.94, skyRotation: 0.83,
    },
    update: (elapsed: number) => {
      windUniform.value = elapsed;
      sea.material.uniforms.time.value = elapsed * 0.48;
    },
  };
}
