import {
  CanvasTexture,
  Color,
  DoubleSide,
  Euler,
  Group,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTerrain, createWater, fbm, noise2, seeded, terrainMaterial } from './nature';
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

  // Four unequal faces and off-axis ridges preserve the recognisable, leaning alpine silhouette.
  function peak(x: number, z: number, cx: number, cz: number, radius: number, height: number, angle: number) {
    const dx = x - cx;
    const dz = z - cz;
    const rx = dx * Math.cos(angle) - dz * Math.sin(angle);
    const rz = dx * Math.sin(angle) + dz * Math.cos(angle);
    const distance = Math.max(Math.abs(rx) * 0.89 + Math.abs(rz) * 0.17, Math.abs(rz) * 1.09 + Math.abs(rx) * 0.27);
    const envelope = Math.max(0, 1 - distance / radius);
    const relief = fbm(x * 0.024, z * 0.024, 5) * 38;
    const couloirs = (1 - Math.abs(noise2(rx * 0.033 + rz * 0.013, rz * 0.014))) * 11;
    return Math.max(0, Math.pow(envelope, 1.72) * height + (relief - couloirs) * smoothstep(0, 0.25, envelope));
  }

  function lakeRadius(x: number, z: number) {
    return Math.hypot((x + 14) / 173, (z - 36) / 218) + fbm(x * 0.014 + 43, z * 0.014, 3) * 0.11;
  }
  function heightAt(x: number, z: number) {
    const foothills = Math.max(0, fbm(x * 0.0026 + 8, z * 0.0026 + 18, 5)) * 80;
    let height = 12 + foothills + fbm(x * 0.016, z * 0.016, 4) * 6;
    height += Math.max(
      peak(x, z, -78, -468, 401, 425, 0.31),
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

  const rock = terrainMaterial('rock', 0xd9dedc);
  const grass = terrainMaterial('grass', 0xffffff);
  const snow = terrainMaterial('snow', 0xffffff);
  rock.normalScale.set(0.34, 0.34);
  rock.roughness = 0.96;
  // Actual local photographic textures, projected in three directions over steep mountain faces.
  // Snow gathers on ledges; altitude, aspect and irregular weathering break up the snow line.
  rock.onBeforeCompile = (shader) => {
    shader.uniforms.alpineGrass = { value: grass.map };
    shader.uniforms.alpineSnow = { value: snow.map };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vAlpinePosition;
        varying vec3 vAlpineNormal;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vAlpinePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vAlpineNormal = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vAlpinePosition;
        varying vec3 vAlpineNormal;
        uniform sampler2D alpineGrass;
        uniform sampler2D alpineSnow;
        float alpineHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float alpineNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(alpineHash(i),alpineHash(i+vec2(1.,0.)),f.x),mix(alpineHash(i+vec2(0.,1.)),alpineHash(i+vec2(1.,1.)),f.x),f.y);
        }
        vec3 alpineTri(sampler2D t, vec3 p, vec3 w) {
          return texture2D(t,p.yz).rgb*w.x + texture2D(t,p.xz).rgb*w.y + texture2D(t,p.xy).rgb*w.z;
        }`)
      .replace('#include <map_fragment>', `
        vec3 terrainNormal = normalize(vAlpineNormal);
        vec3 weights = pow(abs(terrainNormal), vec3(5.0));
        weights /= weights.x + weights.y + weights.z;
        vec3 position = vAlpinePosition;
        float weathering = alpineNoise(position.xz * 0.036) * 0.65 + alpineNoise(position.xz * 0.13) * 0.35;
        vec3 rockColor = alpineTri(map, position / 24.0, weights);
        vec3 grassColor = alpineTri(alpineGrass, position / 28.0, weights) * vec3(0.8,0.87,0.74);
        vec3 snowColor = min(vec3(1.0), alpineTri(alpineSnow, position / 19.0, weights) * 1.4 + vec3(0.2,0.23,0.26));
        float grassy = (1.0-smoothstep(46.0,125.0,position.y)) * smoothstep(0.48,0.89,terrainNormal.y);
        grassy *= smoothstep(8.0,18.0,position.y) * (0.65 + weathering*0.35);
        float snowHeight = position.y + (weathering-0.5)*82.0 + terrainNormal.z*23.0;
        float snowy = smoothstep(118.0,205.0,snowHeight) * smoothstep(0.17,0.59,terrainNormal.y);
        vec3 groundColor = mix(rockColor, grassColor, grassy);
        groundColor = mix(groundColor, snowColor, snowy);
        diffuseColor.rgb *= groundColor;
      `);
  };
  rock.customProgramCacheKey = () => 'alpine-triplanar-slope-snow-v1';
  const terrain = createTerrain({
    width: 2600,
    depth: 2600,
    centerZ: -310,
    segments: 324,
    height: heightAt,
    material: rock,
    color: (_x, y, _z, slope) => new Color().setScalar(0.90 + Math.min(1, y / 450) * 0.10 - slope * 0.025),
  });
  terrain.castShadow = false;
  group.add(terrain);

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
  const treePlacements: Array<{ x: number; z: number; y: number; size: number; angle: number }> = [];
  for (let attempt = 0; attempt < 4300 && treePlacements.length < 900; attempt++) {
    const x = (random() - 0.5) * 1150;
    const z = -360 + random() * 980;
    const y = heightAt(x, z);
    const gradient = Math.hypot(heightAt(x + 1, z) - y, heightAt(x, z + 1) - y);
    if (y < 10.5 || y > 105 || gradient > 0.8 || lakeRadius(x, z) < 1.04) continue;
    if (x > -60 && x < 135 && z > 140 && z < 310) continue;
    if (random() < Math.max(0, y - 45) / 90) continue;
    treePlacements.push({ x, z, y, size: 5 + random() * 10, angle: random() * Math.PI });
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

  const stoneGeometry = new IcosahedronGeometry(1, 1);
  const stonePositions = stoneGeometry.getAttribute('position');
  for (let i = 0; i < stonePositions.count; i++) {
    const x = stonePositions.getX(i), y = stonePositions.getY(i), z = stonePositions.getZ(i);
    const deformation = 1 + noise2(x * 3 + z, y * 4) * 0.22;
    stonePositions.setXYZ(i, x * deformation, y * deformation, z * deformation);
  }
  stoneGeometry.computeVertexNormals();
  stoneGeometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(stonePositions.count * 3).fill(1), 3));
  const stoneMaterial = terrainMaterial('rock', 0xc4c6b7, 0.7);
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

  return {
    heightAt,
    group,
    collectibles: [
      { position: new Vector3(-70, 17, -100), name: '冰川湖畔', message: '细碎的岩粉悬浮在融水中，留下阿尔卑斯湖泊特有的青绿色。' },
      { position: new Vector3(-60, heightAt(-60, -320) + 22, -320), name: '马特洪峰', message: '以瑞士马特洪峰为灵感：冰川侵蚀塑造了锐利的山脊与不对称岩壁。' },
      { position: new Vector3(179, heightAt(179, -48) + 15, -48), name: '林线之间', message: '针叶林沿山坡生长；越过林线，只剩岩石、积雪与风。' },
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
