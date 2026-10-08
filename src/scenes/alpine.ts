import {
  BufferGeometry, Color, DoubleSide, Euler, Float32BufferAttribute, Group,
  IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial,
  PlaneGeometry, Quaternion, Uint32BufferAttribute, Vector3,
} from 'three';
import { createWater, fbm, noise2, seeded } from './nature';
import { detailMaterial, landscapeMaterial } from './surface';
import { alpineElevation } from './alpine-dem';
import type { Landscape } from './types';
import { addScannedRocks } from './scanned-rocks';

/** A photographic landscape study using public DEM relief, with an art-directed lake foreground.
 * Real-world metres; DEM controls the massif. Summit crest and foreground are art-directed refinements.
 * DEM provenance and caveats are in public/terrain/alpine-dem-source.json.
 */
export function createAlpine(): Landscape {
  const group = new Group(); group.name = 'Matterhorn from Riffelsee · DEM landscape study';
  const random = seeded(7431);
  const smoothstep = (a: number, b: number, n: number) => {
    const t = Math.min(1, Math.max(0, (n - a) / (b - a))); return t * t * (3 - 2 * t);
  };
  const lakeAltitude = 2757;
  const lakeCenterZ = -64;
  const shoreOutline: Array<[number, number]> = [
    [-28, 9], [-10, 13], [2, 6], [14, 10], [23, 1], [30, -8], [25, -20], [35, -29],
    [46, -31], [48, -51], [39, -65], [43, -83], [36, -107], [19, -126], [3, -130],
    [-13, -116], [-28, -123], [-40, -110], [-35, -95], [-48, -83], [-51, -61],
    [-45, -42], [-49, -24], [-38, -12],
  ];
  function lakeRadius(x: number, z: number) {
    if (Math.hypot(x, z - lakeCenterZ) > 340) return 1 + Math.hypot(x, z - lakeCenterZ) / 45;
    let distance = Infinity, inside = false;
    for (let i = 0, j = shoreOutline.length - 1; i < shoreOutline.length; j = i++) {
      const a = shoreOutline[j], b = shoreOutline[i], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      distance = Math.min(distance, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return 1 + (inside ? -distance : distance) / 45 + noise2(x * .13 + 21, z * .13 - 7) * .007;
  }
  function mountainRelief(x: number, z: number, dem: number) {
    const dx = x, dz = z + 8052, radius = Math.hypot(dx, dz);
    const weight = (1 - smoothstep(390, 1000, radius)) * smoothstep(690, 1250, dem);
    if (weight <= 0) return dem;
    const u = dx * .981 - dz * .195, v = dx * .195 + dz * .981;
    // The known 4,478 m summit and three unequal faces recover the sharp crest blurred by DEM sampling.
    // Erosion is artistic relief at 10–50 m wavelengths, subordinate to the public-data massif.
    const faces = Math.max(u * 2.52 + v * .26, -u * 1.88 + v * .18, v * 1.39 - u * .13, -v * 1.82 + u * .2);
    const crest = 1721 - faces;
    const faceFlow = u > 0 ? u + v * .27 : u - v * .42;
    const channelNoise = noise2(faceFlow * .031 + 11, v * .006 + 3);
    const grooves = Math.pow(Math.max(0, channelNoise + .24), 2) * 48;
    const fractures = fbm(u * .071 + v * .014, v * .031, 3) * 8;
    const erosion = (grooves + fractures) * smoothstep(36, 145, radius);
    return dem * (1 - weight) + (crest - erosion) * weight;
  }
  function heightAt(x: number, z: number) {
    const dem = mountainRelief(x, z, alpineElevation(x, z) - lakeAltitude);
    const radius = lakeRadius(x, z), signedShoreDistance = (radius - 1) * 45;
    const localWeight = 1 - smoothstep(55, 155, signedShoreDistance);
    if (localWeight <= 0 || Math.hypot(x, z - lakeCenterZ) > 340) return dem;
    // Each cove has its own gently rising bank rather than a uniform elliptical bowl.
    const bankSlope = .086 + noise2(x * .027 + 9, z * .025) * .025;
    const basin = signedShoreDistance < 0 ? -3.7 * (1 - Math.exp(signedShoreDistance * .09)) : signedShoreDistance * bankSlope;
    const bankRelief = fbm(x * .10, z * .10, 3) * .56 * smoothstep(1.5, 9, signedShoreDistance);
    const gravelRelief = noise2(x * .87, z * .87) * .12 * smoothstep(.7, 3.5, signedShoreDistance);
    const lowMound = Math.exp(-((x + 27) ** 2 / 380 + (z + 8) ** 2 / 520)) * 1.35;
    return dem * (1 - localWeight) + (basin + bankRelief + gravelRelief + lowMound) * localWeight;
  }

  const groundMaterial = landscapeMaterial({
    biome: 'alpine', tint: 0xf0f1ed, scale: 24, normalStrength: .67,
    snowLine: [430, 820], shoreline: 0, meadowLine: [80, 340],
  });
  const groundColor = (x: number, y: number, z: number, slope: number) => {
    const macro = fbm(x * .0008 + 15, z * .0008, 3);
    const dryMeadow = (1 - smoothstep(70, 310, y)) * (1 - smoothstep(.25, .65, slope));
    return new Color().setRGB(.94 + macro * .035, .94 - dryMeadow * .022 + macro * .025, .95 - dryMeadow * .065 + macro * .025);
  };
  // One nonuniform, continuous grid replaces overlapping LOD meshes completely.
  // Every region shares boundary vertices/normals: no skirts, holes, depth fighting or grey seam strips.
  function axis(ranges: Array<[number, number, number]>) {
    const values: number[] = [];
    for (const [from, to, segments] of ranges) for (let i = 0; i < segments; i++) values.push(from + (to - from) * i / segments);
    values.push(ranges[ranges.length - 1][1]); return values;
  }
  const xs = axis([[-6000,-1100,64],[-1100,-340,48],[-340,-90,64],[-90,90,240],[90,340,64],[340,1100,48],[1100,6000,64]]);
  const zs = axis([[-11500,-9400,32],[-9400,-7000,240],[-7000,-500,160],[-500,-180,60],[-180,100,240],[100,230,28],[230,2000,32]]);
  const vertices = new Float32Array(xs.length * zs.length * 3), uvs = new Float32Array(xs.length * zs.length * 2);
  const indices = new Uint32Array((xs.length - 1) * (zs.length - 1) * 6);
  let cell = 0;
  for (let iz = 0; iz < zs.length; iz++) for (let ix = 0; ix < xs.length; ix++) {
    const index = iz * xs.length + ix, x = xs[ix], z = zs[iz];
    vertices[index*3] = x; vertices[index*3+1] = heightAt(x,z); vertices[index*3+2] = z;
    uvs[index*2] = x/28; uvs[index*2+1] = z/28;
    if (ix < xs.length-1 && iz < zs.length-1) {
      const a = index, b = index + xs.length;
      indices.set([a,b,a+1,b,b+1,a+1],cell); cell += 6;
    }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2)); geometry.setIndex(new Uint32BufferAttribute(indices,1)); geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal'), colors = new Float32Array(vertices.length);
  for (let i=0;i<normals.count;i++) {
    const c=groundColor(vertices[i*3],vertices[i*3+1],vertices[i*3+2],1-Math.max(0,normals.getY(i)));
    colors.set([c.r,c.g,c.b],i*3);
  }
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3)); geometry.computeBoundingSphere();
  const terrain = new Mesh(geometry,groundMaterial); terrain.name = 'Continuous DEM and crest refinement · seamless adaptive grid';
  terrain.castShadow = terrain.receiveShadow = true; group.add(terrain);

  // A bounded lake mesh prevents the reflective water plane leaking into lower DEM valleys.
  const lake = createWater({ size: 230, height: 0, color: 0x274c50, amplitude: .015, distortion: .35,
    bathymetry: { height: heightAt, bounds: [-85, -180, 85, 55] }, bottomColor: 0x7d8371,
    sunDirection: new Vector3(-.5, .78, .4).normalize() });
  lake.position.z = lakeCenterZ; lake.material.uniforms.size.value = 1.0;
  const waterGeometry = new PlaneGeometry(170, 230, 128, 160);
  const waterPositions = waterGeometry.getAttribute('position'), waterIndex = waterGeometry.getIndex()!;
  const wetTriangles: number[] = [];
  for (let i = 0; i < waterIndex.count; i += 3) {
    const a = waterIndex.getX(i), b = waterIndex.getX(i + 1), c = waterIndex.getX(i + 2);
    const x = (waterPositions.getX(a) + waterPositions.getX(b) + waterPositions.getX(c)) / 3;
    const z = lakeCenterZ - (waterPositions.getY(a) + waterPositions.getY(b) + waterPositions.getY(c)) / 3;
    if (lakeRadius(x, z) < 1.06) wetTriangles.push(a, b, c);
  }
  waterGeometry.setIndex(wetTriangles); lake.geometry.dispose(); lake.geometry = waterGeometry; group.add(lake);

  // Irregular, flattened gneiss fragments: a few larger stones anchor the photograph, then graded scree.
  const matrix = new Matrix4(), quaternion = new Quaternion(), position = new Vector3(), scale = new Vector3();
  function rockGeometry(variant: number, detail: number) {
    const geometry = new IcosahedronGeometry(1, detail); const vertices = geometry.getAttribute('position');
    const colors: number[] = [];
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
      const fracture = 1 + fbm(x * 2.8 + variant * 8, z * 3.1 + y * 1.6, 4) * .32;
      const layer = Math.sin(y * 10 + x * 1.7 + variant) * .018;
      vertices.setXYZ(i, x * fracture * (1 + y * .09), Math.max(-.62, y * fracture + layer), z * fracture * .86);
      const grain = .91 + noise2(x * 7 + variant, z * 7 + y) * .045; colors.push(grain, grain, grain * .985);
    }
    geometry.computeVertexNormals(); geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); return geometry;
  }
  const foregroundStones = [
    [-14, 21, 1.65], [12, 15, 1.35], [-32, 16, 1.1], [33, -14, 2.6], [-45, -18, .9],
    [27, -8, .46], [-23, 30, .62], [18, 28, .35], [43, -63, 1.15], [-40, -99, .72],
    [16, -137, .85], [-18, -143, .70], [8, 21, .48], [-9, 19, .68], [39, 8, 1.5],
  ];
  addScannedRocks(group,foregroundStones.map(([x,z,size],i)=>({x,z,size:size*1.55,yaw:i*2.399})),heightAt);
  const scree = new InstancedMesh(rockGeometry(5, 1), detailMaterial('rock', 0xc7cec6, 2), 1500);
  for (let i = 0; i < scree.count; i++) {
    const segment = Math.floor(random() * shoreOutline.length), a = shoreOutline[segment], b = shoreOutline[(segment + 1) % shoreOutline.length];
    const t = random(), spread = Math.pow(random(), 1.6) * 15;
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const x = a[0] + dx * t - dz / length * spread, z = a[1] + dz * t + dx / length * spread;
    const size = .035 + Math.pow(random(), 2.4) * .40, y = heightAt(x, z);
    position.set(x, y + size * .2, z); quaternion.setFromEuler(new Euler(random(), random() * 6.28, random() * .4));
    matrix.compose(position, quaternion, new Vector3(size * (1.2 + random() * .8), size * .55, size)); scree.setMatrixAt(i, matrix);
    const damp = 1 - smoothstep(0, 1.2, y), shade = .89 + random() * .14 - damp * .22;
    scree.setColorAt(i, new Color().setRGB(shade, shade, shade * .98));
  }
  scree.receiveShadow = true; scree.castShadow = false; group.add(scree);

  // At 2,757 m the lake lies above the tree line: low sedges and ochre alpine turf replace the fake forest.
  const bladeVertices: number[] = [], bladeColors: number[] = [];
  for (let blade = 0; blade < 6; blade++) {
    const angle = blade / 6 * Math.PI * 2 + random() * .5, h = .11 + random() * .18;
    const x = Math.cos(angle) * .05, z = Math.sin(angle) * .05, dx = Math.cos(angle + 1.57) * .008, dz = Math.sin(angle + 1.57) * .008;
    bladeVertices.push(x - dx, 0, z - dz, x + dx, 0, z + dz, x + dx * .7, h * .55, z + dz * .7,
      x - dx, 0, z - dz, x + dx * .7, h * .55, z + dz * .7, x + Math.cos(angle) * .047, h, z + Math.sin(angle) * .047);
    const tone = new Color(['#797c48', '#91905a', '#677346', '#a29a6c', '#727544'][blade % 5]);
    for (let vertex = 0; vertex < 6; vertex++) bladeColors.push(tone.r, tone.g, tone.b);
  }
  const sedgeGeometry = new BufferGeometry(); sedgeGeometry.setAttribute('position', new Float32BufferAttribute(bladeVertices, 3));
  sedgeGeometry.setAttribute('color', new Float32BufferAttribute(bladeColors, 3)); sedgeGeometry.computeVertexNormals();
  const sedgeMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 1, side: DoubleSide, color: 0xe5e6d8 });
  const wind = { value: 0 };
  sedgeMaterial.onBeforeCompile = shader => {
    shader.uniforms.alpineWind = wind;
    shader.vertexShader = 'uniform float alpineWind;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(alpineWind*1.4+instanceMatrix[3].x*.32+instanceMatrix[3].z*.17)*position.y*position.y*.20;');
  };
  const sedges = new InstancedMesh(sedgeGeometry, sedgeMaterial, 7500); let sedgeCount = 0;
  for (let attempt = 0; attempt < 55000 && sedgeCount < 7500; attempt++) {
    const foreground = random() < .72;
    const x = (random() - .5) * (foreground ? 112 : 220), z = foreground ? -16 + random() * 70 : -190 + random() * 300, y = heightAt(x, z);
    if (lakeRadius(x, z) < 1.07 || y < .35 || y > 40 || fbm(x * .046, z * .046, 3) < -.15) continue;
    const slope = Math.hypot(heightAt(x + .25, z) - y, heightAt(x, z + .25) - y) * 4;
    if (slope > 1.2) continue;
    const s = .55 + random() * 1.4;
    matrix.compose(new Vector3(x, y - .018, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), random() * 6.28), new Vector3(s, s, s));
    sedges.setMatrixAt(sedgeCount++, matrix);
  }
  sedges.count = sedgeCount; sedges.receiveShadow = true; sedges.castShadow = false; group.add(sedges);

  const cameraY = heightAt(0, 27) + 2.2;
  return {
    group, heightAt,
    collectibles: [
      { position: new Vector3(-8, 2.8, -94), name: '湖面倒影', message: '利菲尔湖位于海拔约2757米的高山地带，平静水面映出远处山体。近岸为艺术化重建。' },
      { position: new Vector3(-160, heightAt(-160, -8020) + 100, -8020), name: '马特洪峰', message: '远山轮廓参考公开高程数据，保留主峰与相连山脊的真实尺度关系；并非精确扫描。' },
      { position: new Vector3(13, heightAt(13, -150) + 3.8, -150), name: '高山草甸', message: '这里已经越过林线。低矮莎草、碎石与裸岩，适应着短暂的高山夏季。' },
    ],
    view: {
      position: new Vector3(0, cameraY, 27), target: new Vector3(0, cameraY + 3, -110),
      fov: 40, minDistance: 117, maxDistance: 175, azimuthRange: .24, polarRange: .035,
    },
    atmosphere: {
      fogColor: 0xbdcbd2, fogDensity: .000027,
      sunPosition: new Vector3(-520, 760, 380), sunColor: 0xfff3e2,
      sunIntensity: 2.65, exposure: 1.0, skyRotation: .9,
    },
    update(elapsed: number) {
      lake.material.uniforms.time.value = elapsed * .23; wind.value = elapsed;
    },
  };
}
