import {
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  Color,
  DoubleSide,
  Euler,
  Group,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTerrain, createWater, fbm, noise2, seeded } from './nature';
import { detailMaterial, landscapeMaterial } from './surface';
import type { Landscape } from './types';

/** A continuous, metre-scale landscape inspired by the Matterhorn and its glacial lakes. */
export function createAlpine(): Landscape {
  const group = new Group();
  group.name = 'swiss-alps-landscape';
  const random = seeded(7431);
  const smoothstep = (a: number, b: number, n: number) => {
    const t = Math.min(1, Math.max(0, (n - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  // The summit is a set of unequal intersecting rock faces, with a narrow fore-arête.
  // Angular drainage cuts converge towards the summit instead of making rounded noise mounds.
  function peak(x: number, z: number, cx: number, cz: number, radius: number, height: number, angle: number) {
    const dx = x - cx, dz = z - cz;
    const rx = dx * Math.cos(angle) - dz * Math.sin(angle);
    const rz = dx * Math.sin(angle) + dz * Math.cos(angle);
    const distance = Math.max(Math.abs(rx) * 0.88 + Math.abs(rz) * 0.19, Math.abs(rz) * 1.10 + Math.abs(rx) * 0.24);
    const envelope = Math.max(0, 1 - distance / radius);
    const drainage = Math.pow(0.5 + 0.5 * Math.sin(Math.atan2(rx, rz) * 19 + fbm(x * .014, z * .014, 3) * 1.7), 7);
    const relief = fbm(x * .026, z * .026, 4) * 22 - drainage * 24;
    return Math.max(0, Math.pow(envelope, 1.35) * height + relief * smoothstep(0, .27, envelope));
  }
  function matterhorn(x: number, z: number) {
    const dx = x + 88, dz = z + 489;
    const u = dx * .953 - dz * .303;
    const v = dx * .303 + dz * .953;
    const face = Math.max(u / 173, -u / 139, v / 339, -v / 196, (u * .81 + v * .59) / 263);
    const mask = Math.max(0, 1 - face);
    const pyramid = 427 * mask;
    const angular = Math.atan2(dx, dz);
    const drainage = Math.pow(.5 + .5 * Math.sin(angular * 26 + noise2(x * .011, z * .011) * 2.0), 9);
    const lowerFace = smoothstep(.05, .36, mask) * (1 - smoothstep(.85, 1, mask));
    const strataCoordinate = (pyramid + x * .19 + z * .095) / 16;
    const strata = (strataCoordinate - Math.floor(strataCoordinate) - .5) * 3.8;
    const crags = fbm(x * .037, z * .037, 4) * 7;
    const cutFace = pyramid + (strata + crags - drainage * 20) * lowerFace;
    // A long, fractured Hörnli-like ridge runs down the face towards the lake.
    const ridgeT = Math.max(0, Math.min(1, (z + 489) / 360));
    const ridgeAxis = -88 + ridgeT * 74 + Math.sin(ridgeT * 5.8) * 8;
    const ridgeWidth = 9 + ridgeT * 69;
    const ridgeEnvelope = Math.max(0, 1 - Math.abs(x - ridgeAxis) / ridgeWidth);
    const foreRidge = z > -489 && z < -129
      ? 397 * Math.pow(1 - ridgeT, 1.12) * ridgeEnvelope - drainage * 9 * lowerFace
      : 0;
    return Math.max(0, cutFace, foreRidge);
  }

  function lakeRadius(x: number, z: number) {
    return Math.hypot((x + 14) / 173, (z - 36) / 218) + fbm(x * 0.014 + 43, z * 0.014, 3) * 0.11;
  }
  function heightAt(x: number, z: number) {
    const foothills = Math.max(0, fbm(x * 0.0026 + 8, z * 0.0026 + 18, 5)) * 80;
    let height = 12 + foothills + fbm(x * 0.016, z * 0.016, 4) * 6;
    height += Math.max(
      matterhorn(x, z),
      peak(x, z, -94, -486, 442, 245, 0.28),
      peak(x, z, -540, -627, 515, 335, -0.3),
      peak(x, z, 431, -541, 460, 307, 0.55),
      peak(x, z, 45, -960, 485, 358, -0.58),
      peak(x, z, -885, -345, 380, 245, 0.38),
      peak(x, z, 802, -393, 437, 248, 0.15),
    );
    const basin = lakeRadius(x, z);
    const shoreline = smoothstep(0.78, 1.14, basin);
    const bed = -13 + Math.pow(Math.min(1, basin), 3) * 18 + noise2(x * 0.045, z * 0.045) * 0.7;
    height = bed * (1 - shoreline) + height * shoreline;
    // The overlook is broad enough to orbit a little without exposing a landscape edge.
    height += Math.exp(-((x - 150) ** 2 / 27000 + (z - 325) ** 2 / 19000)) * 17;
    return height;
  }

  const rock = landscapeMaterial({ biome: 'alpine', tint: 0xeff2ef, scale: 22, normalStrength: 0.8 });
  const terrain = createTerrain({
    width: 2600,
    depth: 2600,
    centerZ: -310,
    segments: 344,
    height: heightAt,
    material: rock,
    color: (x, y, z, slope) => {
      const bedding = .5 + .5 * Math.sin((y + x * .19 + z * .095) * .36);
      const exposed = smoothstep(.28, .75, slope) * smoothstep(70, 160, y);
      return new Color().setScalar(.95 - exposed * bedding * .04 + noise2(x * .01, z * .01) * .02);
    },
  });
  terrain.castShadow = true;
  group.add(terrain);
  // Match shoreline props to the rendered triangles, not just the analytical height field.
  const terrainPositions = terrain.geometry.getAttribute('position');
  function surfaceHeight(x: number, z: number) {
    const gx = Math.max(0, Math.min(343.99999, (x + 1300) / 2600 * 344));
    const gz = Math.max(0, Math.min(343.99999, (z + 1610) / 2600 * 344));
    const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz;
    const a = iz * 345 + ix, b = a + 345;
    return u + v <= 1
      ? terrainPositions.getY(a) * (1 - u - v) + terrainPositions.getY(a + 1) * u + terrainPositions.getY(b) * v
      : terrainPositions.getY(b + 1) * (u + v - 1) + terrainPositions.getY(b) * (1 - u) + terrainPositions.getY(a + 1) * (1 - v);
  }

  const lake = createWater({
    size: 880,
    height: 7,
    color: 0x367d84,
    amplitude: 0.07,
    distortion: 1.3,
    sunDirection: new Vector3(-0.48, 0.78, 0.5).normalize(),
  });
  lake.position.x = -14;
  lake.position.z = 35;
  group.add(lake);

  // Trace the true water contour, then feather a wet gravel ribbon into the dry shore.
  function waterEdge(angle: number) {
    let lo = .20, hi = 1.7;
    for (let step = 0; step < 17; step++) {
      const r = (lo + hi) * .5;
      const x = -14 + Math.cos(angle) * 173 * r, z = 36 + Math.sin(angle) * 218 * r;
      if (surfaceHeight(x, z) < 7.02) lo = r; else hi = r;
    }
    return (lo + hi) * .5;
  }
  const shoreVertices: number[] = [], shoreColors: number[] = [], shoreUvs: number[] = [], shoreIndices: number[] = [];
  const shoreSegments = 280, shoreRings = 5;
  for (let segment = 0; segment <= shoreSegments; segment++) {
    const a = segment / shoreSegments * Math.PI * 2, edge = waterEdge(a);
    const width = 3.6 + noise2(Math.cos(a) * 6, Math.sin(a) * 6) * 1.4;
    for (let ring = 0; ring < shoreRings; ring++) {
      const t = ring / (shoreRings - 1), radius = edge + (-1.1 + t * width) / 190;
      const x = -14 + Math.cos(a) * 173 * radius, z = 36 + Math.sin(a) * 218 * radius;
      const y = surfaceHeight(x, z);
      shoreVertices.push(x, y + .065, z); shoreUvs.push(x / 4, z / 4);
      const damp = 1 - smoothstep(7, 10.5, y);
      const shade = .90 - damp * .24 + noise2(x * .38, z * .38) * .035;
      shoreColors.push(shade * .93, shade, shade * .97);
      if (segment < shoreSegments && ring < shoreRings - 1) {
        const p = segment * shoreRings + ring, q = p + shoreRings;
        shoreIndices.push(p, q, p + 1, q, q + 1, p + 1);
      }
    }
  }
  const shoreGeometry = new BufferGeometry();
  shoreGeometry.setAttribute('position', new Float32BufferAttribute(shoreVertices, 3));
  shoreGeometry.setAttribute('color', new Float32BufferAttribute(shoreColors, 3));
  shoreGeometry.setAttribute('uv', new Float32BufferAttribute(shoreUvs, 2));
  shoreGeometry.setIndex(shoreIndices); shoreGeometry.computeVertexNormals();
  const wetGravel = detailMaterial('rock', 0xbcc7c0, 2.3);
  wetGravel.roughness = .54;
  const wetShore = new Mesh(shoreGeometry, wetGravel);
  wetShore.receiveShadow = true; wetShore.userData.noOcclusion = true; group.add(wetShore);


  // Individually drawn needles on crossed, alpha-tested cards create airy, uneven tree outlines.
  // All trees of one variant are instanced in a single draw call.
  function evergreenTexture(variant: number) {
    const rand = seeded(10501 + variant * 831);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#615b43';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(126, 505); ctx.lineTo(129, 20); ctx.stroke();
    for (let level = 0; level < 33; level++) {
      const y = 38 + level * 12.1;
      const reach = (15 + level * 2.75) * (0.65 + rand() * 0.44);
      for (const side of [-1, 1]) {
        const length = reach * (0.69 + rand() * 0.4);
        const rise = 8 + rand() * 14;
        for (let twig = 0; twig < 26; twig++) {
          const t = twig / 26;
          const x = 128 + side * t * length;
          const by = y + t * rise;
          ctx.strokeStyle = ['#263e32', '#334c39', '#3e5840', '#52674a', '#263c31'][Math.floor(rand() * 5)];
          ctx.lineWidth = 1.1 + rand() * 1.3;
          for (let needle = 0; needle < 3; needle++) {
            const needleLength = 6 + (1 - t) * 10 + rand() * 8;
            ctx.beginPath();
            ctx.moveTo(x + (rand() - 0.5) * 6, by + rand() * 5);
            ctx.lineTo(x + side * (2 + rand() * 6), by - needleLength);
            ctx.stroke();
          }
        }
      }
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  const treeCards = [0, Math.PI / 3, Math.PI * 2 / 3].map((angle) => {
    const card = new PlaneGeometry(0.56, 1, 1, 1);
    card.translate(0, 0.5, 0);
    card.rotateY(angle);
    return card;
  });
  const treeGeometry = mergeGeometries(treeCards)!;
  treeCards.forEach((card) => card.dispose());
  const foregroundTrees = [[142, 172, 13.5], [175, 116, 15], [203, 147, 11], [226, 58, 14], [-186, 75, 12], [-211, -3, 15.5], [193, -62, 13], [247, -113, 11.5], [277, 4, 14.5]];
  const treePlacements: Array<{ x: number; z: number; y: number; size: number; angle: number }> = [];
  for (let attempt = 0; attempt < 8000 && treePlacements.length < 1100; attempt++) {
    const x = (random() - 0.5) * 1150;
    const z = -360 + random() * 980;
    const y = heightAt(x, z);
    if (foregroundTrees.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 12)) continue;
    const gradient = Math.hypot(heightAt(x + 1, z) - y, heightAt(x, z + 1) - y);
    if (y < 10.5 || y > 118 || gradient > 1.05 || lakeRadius(x, z) < 1.035) continue;
    const grove = .5 + fbm(x * .016 + 51, z * .016 - 7, 3) * .75;
    const density = smoothstep(.18, .66, grove) * (1 - smoothstep(48, 116, y));
    if (random() > density) continue;
    if (x > -60 && x < 135 && z > 140 && z < 310) continue;
    const treeHeight = (5 + random() * 12) * (1 - smoothstep(55, 120, y) * .5);
    treePlacements.push({ x, z, y, size: treeHeight, angle: random() * Math.PI });
  }
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const position = new Vector3();
  const scale = new Vector3();
  for (let variant = 0; variant < 3; variant++) {
    const instances = treePlacements.filter((_tree, i) => i % 3 === variant);
    const treeMaterial = new MeshStandardMaterial({
      map: evergreenTexture(variant), alphaTest: 0.45, side: DoubleSide,
      roughness: 1, color: 0xd0d5c5,
    });
    const trees = new InstancedMesh(treeGeometry, treeMaterial, instances.length);
    instances.forEach((tree, index) => {
      position.set(tree.x, tree.y - 0.15, tree.z);
      quaternion.setFromEuler(new Euler(0, tree.angle, 0));
      scale.set(tree.size * (0.82 + random() * 0.30), tree.size, tree.size * (0.82 + random() * 0.3));
      trees.setMatrixAt(index, matrix.compose(position, quaternion, scale));
      trees.setColorAt(index, new Color().setScalar(0.78 + random() * 0.24));
    });
    trees.castShadow = true;
    trees.receiveShadow = true;
    trees.instanceMatrix.needsUpdate = true;
    group.add(trees);
  }


  // Nearby trees have real tapered trunks and 45 drooping branches, with small crossed needle sprays.
  // The detailed prototype is instanced only nine times; distant woods use the lighter cards above.
  const woodPieces: BufferGeometry[] = [], foliagePieces: BufferGeometry[] = [];
  const up = new Vector3(0, 1, 0);
  const trunkGeometry = new CylinderGeometry(.045, .25, 10.4, 8, 6);
  trunkGeometry.translate(0, 5.2, 0);
  const trunkPositions = trunkGeometry.getAttribute('position');
  for (let i = 0; i < trunkPositions.count; i++) {
    const y = trunkPositions.getY(i);
    trunkPositions.setX(i, trunkPositions.getX(i) + Math.pow(y / 10.4, 2) * .23);
  }
  trunkGeometry.computeVertexNormals(); woodPieces.push(trunkGeometry);
  const needleCanvas = document.createElement('canvas'); needleCanvas.width = 256; needleCanvas.height = 128;
  const needleContext = needleCanvas.getContext('2d')!; const needleRandom = seeded(24731);
  needleContext.lineCap = 'round';
  for (let shoot = 0; shoot < 7; shoot++) {
    const by = 38 + shoot * 8, bend = (shoot - 3) * 6;
    for (let n = 0; n < 64; n++) {
      const t = n / 64, x = 8 + t * 238, y = by + Math.sin(t * 2.8) * bend;
      needleContext.strokeStyle = ['#37503a', '#506346', '#68764f', '#314932'][Math.floor(needleRandom() * 4)];
      needleContext.lineWidth = .8 + needleRandom();
      const length = 4 + (1 - t) * 10 + needleRandom() * 6;
      needleContext.beginPath(); needleContext.moveTo(x, y); needleContext.lineTo(x + 4, y - length); needleContext.stroke();
      needleContext.beginPath(); needleContext.moveTo(x, y); needleContext.lineTo(x + 3, y + length * .75); needleContext.stroke();
    }
  }
  const needleTexture = new CanvasTexture(needleCanvas); needleTexture.colorSpace = SRGBColorSpace; needleTexture.anisotropy = 4;
  const branchRand = seeded(8083);
  for (let level = 0; level < 9; level++) {
    const y = 1.8 + level * .88, reach = 2.45 * Math.pow(1 - level / 10, .8);
    for (let arm = 0; arm < 5; arm++) {
      const phi = arm / 5 * Math.PI * 2 + level * 2.41 + branchRand() * .35;
      const length = reach * (.80 + branchRand() * .33);
      const start = new Vector3(.15 * y / 10, y, 0);
      const end = new Vector3(Math.cos(phi) * length, y - .37 + level * .025, Math.sin(phi) * length);
      const vector = end.clone().sub(start);
      const branch = new CylinderGeometry(.013, .046 * (1 - level / 12), vector.length(), 5, 1);
      branch.applyMatrix4(new Matrix4().compose(start.clone().add(end).multiplyScalar(.5), new Quaternion().setFromUnitVectors(up, vector.clone().normalize()), new Vector3(1, 1, 1)));
      woodPieces.push(branch);
      for (let spray = 0; spray < 4; spray++) {
        const t = .20 + spray * .25, center = start.clone().lerp(end, t);
        const width = (.8 + length * .23) * (1 - t * .22), height = .46 + (1 - t) * .26;
        for (const crossing of [0, Math.PI / 2]) {
          const card = new PlaneGeometry(width, height);
          const q = new Quaternion().setFromEuler(new Euler(.26 + branchRand() * .22, phi + crossing, (branchRand() - .5) * .4));
          card.applyMatrix4(new Matrix4().compose(center, q, new Vector3(1, 1, 1))); foliagePieces.push(card);
        }
      }
    }
  }
  const detailedWood = mergeGeometries(woodPieces)!, detailedFoliage = mergeGeometries(foliagePieces)!;
  woodPieces.forEach(g => g.dispose()); foliagePieces.forEach(g => g.dispose());
  const nearbyWood = new InstancedMesh(detailedWood, new MeshStandardMaterial({ color: 0x716756, roughness: .99 }), foregroundTrees.length);
  const nearbyFoliage = new InstancedMesh(detailedFoliage, new MeshStandardMaterial({ map: needleTexture, color: 0xd9dfca, alphaTest: .38, side: DoubleSide, roughness: 1 }), foregroundTrees.length);
  foregroundTrees.forEach(([x, z, size], i) => {
    quaternion.setFromEuler(new Euler(0, i * 2.37, (random() - .5) * .035));
    matrix.compose(new Vector3(x, heightAt(x, z) - .10, z), quaternion, new Vector3(size / 10.4, size / 10.4, size / 10.4));
    nearbyWood.setMatrixAt(i, matrix); nearbyFoliage.setMatrixAt(i, matrix);
    nearbyFoliage.setColorAt(i, new Color().setScalar(.88 + random() * .17));
  });
  nearbyWood.castShadow = nearbyFoliage.castShadow = true;
  nearbyWood.receiveShadow = nearbyFoliage.receiveShadow = true;
  group.add(nearbyWood, nearbyFoliage);

  const stoneGeometry = new IcosahedronGeometry(1, 1);
  const stonePositions = stoneGeometry.getAttribute('position');
  for (let i = 0; i < stonePositions.count; i++) {
    const x = stonePositions.getX(i), y = stonePositions.getY(i), z = stonePositions.getZ(i);
    const deformation = 1 + noise2(x * 3 + z, y * 4) * 0.22;
    stonePositions.setXYZ(i, x * deformation, y * deformation, z * deformation);
  }
  stoneGeometry.computeVertexNormals();
  stoneGeometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(stonePositions.count * 3).fill(1), 3));
  const stoneMaterial = detailMaterial('rock', 0xd4d8cf, 3.1);
  const stones = new InstancedMesh(stoneGeometry, stoneMaterial, 175);
  let stoneIndex = 0;
  for (let attempt = 0; attempt < 1300 && stoneIndex < 175; attempt++) {
    const x = (random() - 0.5) * 710;
    const z = -160 + random() * 550;
    const y = heightAt(x, z);
    if (y < 7.4 || y > 105) continue;
    const size = 0.6 + Math.pow(random(), 2) * 5.8;
    position.set(x, y - size * 0.27, z);
    scale.set(size * (1 + random() * 0.4), size * (0.5 + random() * 0.55), size);
    quaternion.setFromEuler(new Euler(random(), random() * 6.28, random() * 0.4));
    stones.setMatrixAt(stoneIndex, matrix.compose(position, quaternion, scale));
    stones.setColorAt(stoneIndex, new Color().setScalar(0.8 + random() * 0.3));
    stoneIndex++;
  }
  stones.count = stoneIndex;
  stones.castShadow = true;
  stones.receiveShadow = true;
  stones.instanceMatrix.needsUpdate = true;
  group.add(stones);

  const pebbleGeometry = new IcosahedronGeometry(1, 0);
  const pebblePositions = pebbleGeometry.getAttribute('position');
  for (let i = 0; i < pebblePositions.count; i++) {
    const x = pebblePositions.getX(i), y = pebblePositions.getY(i), z = pebblePositions.getZ(i);
    const k = .90 + noise2(x * 3 + y, z * 4) * .17; pebblePositions.setXYZ(i, x * k, y * k, z * k);
  }
  pebbleGeometry.computeVertexNormals();
  pebbleGeometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(pebblePositions.count * 3).fill(1), 3));
  const gravel = new InstancedMesh(pebbleGeometry, detailMaterial('rock', 0xd4dad2, 1.1), 1050);
  for (let i = 0; i < gravel.count; i++) {
    const a = random() * Math.PI * 2, edge = waterEdge(a), offset = -.3 + Math.pow(random(), 1.4) * 11;
    const radius = edge + offset / 190, x = -14 + Math.cos(a) * 173 * radius, z = 36 + Math.sin(a) * 218 * radius;
    const y = surfaceHeight(x, z), size = .12 + Math.pow(random(), 2.1) * .74;
    position.set(x, y + size * .18, z); quaternion.setFromEuler(new Euler(random() * .4, random() * 6.28, random() * .3));
    matrix.compose(position, quaternion, new Vector3(size * (1 + random() * .6), size * .46, size)); gravel.setMatrixAt(i, matrix);
    const damp = 1 - smoothstep(7, 10, y); gravel.setColorAt(i, new Color().setScalar(.92 - damp * .23 + random() * .1));
  }
  gravel.castShadow = false; gravel.receiveShadow = true; group.add(gravel);


  return {
    heightAt,
    group,
    collectibles: [
      { position: new Vector3(-35, 17, -100), name: '冰川湖畔', message: '细碎的岩粉悬浮在融水中，留下阿尔卑斯湖泊特有的青绿色。' },
      { position: new Vector3(-60, heightAt(-60, -320) + 22, -320), name: '马特洪峰', message: '以瑞士马特洪峰为灵感：冰川侵蚀塑造了锐利的山脊与不对称岩壁。' },
      { position: new Vector3(60, heightAt(60, -220) + 20, -220), name: '林线之间', message: '针叶林沿山坡生长；越过林线，只剩岩石、积雪与风。' },
    ],
    view: {
      position: new Vector3(103, 43, 244),
      target: new Vector3(-44, 126, -379),
      fov: 51,
      minDistance: 480,
      maxDistance: 850,
      azimuthRange: 0.43,
      polarRange: 0.10,
    },
    atmosphere: {
      fogColor: 0xb6c8cf,
      fogDensity: 0.00048,
      sunPosition: new Vector3(-470, 790, 420),
      sunColor: 0xfff1d8,
      sunIntensity: 3.0,
      exposure: 0.95,
      skyRotation: 0.7,
    },
    update(elapsed: number) {
      lake.material.uniforms.time.value = elapsed * 0.46;
    },
  };
}
