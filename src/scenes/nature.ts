import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

export const assetManager = new THREE.LoadingManager();
const textures = new Map<string, THREE.Texture>();
const pending: Promise<void>[] = [];
const failedAssets: string[] = [];
// Choose once before constructing landscapes; mobile never downloads 4K maps.
export const mobileQuality = typeof window !== 'undefined' &&
  (window.matchMedia('(max-width: 760px)').matches || window.matchMedia('(pointer: coarse)').matches);

export function pbrTexture(name: string, color = false) {
  const key = `pbr-${name}-${color}`;
  if (textures.has(key)) return textures.get(key)!;
  let complete: () => void = () => {};
  pending.push(new Promise<void>(resolve => { complete = resolve; }));
  const tier = mobileQuality ? 'mobile' : 'desktop';
  const value = new THREE.TextureLoader(assetManager).load(new URL(`textures/pbr/${tier}/${name}.webp`, document.baseURI).href,
    () => complete(), undefined, () => { failedAssets.push(name); complete(); });
  value.wrapS = value.wrapT = THREE.RepeatWrapping;
  value.anisotropy = mobileQuality ? 4 : 16;
  value.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  textures.set(key, value);
  return value;
}

export function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
const hash = (x: number, z: number) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };
export function noise2(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z); let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), fx), THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), fx), fz) * 2 - 1;
}
export function fbm(x: number, z: number, octaves = 5) {
  let sum = 0, amplitude = 0.5, total = 0;
  for (let i = 0; i < octaves; i++) { sum += noise2(x, z) * amplitude; total += amplitude; x = x * 2.03 + 13.2; z = z * 2.03 - 9.4; amplitude *= 0.5; }
  return sum / total;
}

export function surfaceTexture(name: string, color = false, repeat = 1) {
  const key = `${name}-${repeat}`;
  if (textures.has(key)) return textures.get(key)!;
  let complete: () => void = () => {};
  pending.push(new Promise<void>(resolve => { complete = resolve; }));
  const value = new THREE.TextureLoader(assetManager).load(new URL(`textures/${name}.jpg`, document.baseURI).href, () => complete(), undefined, () => { failedAssets.push(name); complete(); });
  value.wrapS = value.wrapT = THREE.RepeatWrapping;
  value.repeat.setScalar(repeat);
  value.anisotropy = 8;
  value.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  textures.set(key, value);
  return value;
}

export async function waitForTerrainTextures() { await Promise.all(pending); return failedAssets; }

export function trackLandscapeAsset(promise: Promise<unknown>, name: string) {
  pending.push(promise.then(()=>{},()=>{failedAssets.push(name);}));
}

export function terrainMaterial(kind: 'grass' | 'rock' | 'sand' | 'snow', tint = 0xffffff, repeat = 1) {
  return new THREE.MeshStandardMaterial({
    color: tint, map: surfaceTexture(`${kind}-diff`, true, repeat),
    normalMap: surfaceTexture(`${kind}-normal`, false, repeat),
    roughnessMap: surfaceTexture(`${kind}-rough`, false, repeat),
    normalScale: new THREE.Vector2(kind === 'sand' ? 0.6 : 1.2, kind === 'sand' ? 0.6 : 1.2),
    roughness: kind === 'snow' ? 0.73 : 0.94, metalness: 0, vertexColors: true,
  });
}

interface TerrainOptions {
  width: number; depth: number; segments?: number; centerX?: number; centerZ?: number;
  height: (x: number, z: number) => number;
  material: THREE.Material;
  color?: (x: number, y: number, z: number, slope: number) => THREE.Color;
}

export function createTerrain(options: TerrainOptions) {
  const { width, depth, segments = 256, centerX = 0, centerZ = 0 } = options;
  const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) + centerX, z = position.getZ(i) + centerZ;
    position.setXYZ(i, x, options.height(x, z), z);
    uv.setXY(i, x / 28, z / 28);
  }
  geometry.computeVertexNormals();
  const colors = new Float32Array(position.count * 3);
  const normal = geometry.getAttribute('normal');
  for (let i = 0; i < position.count; i++) {
    const c = options.color?.(position.getX(i), position.getY(i), position.getZ(i), 1 - Math.max(0, normal.getY(i))) ?? new THREE.Color(1, 1, 1);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, options.material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

let waterNormals: THREE.DataTexture | undefined;
function getWaterNormals() {
  if (waterNormals) return waterNormals;
  const size = 256, data = new Uint8Array(size * size * 4);
  // Periodic fractal height derivatives avoid the crosshatched pattern of crossed sine normals.
  const periodic = (u: number, v: number, cells: number) => {
    const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const value = (a: number, b: number) => hash(((a % cells) + cells) % cells, ((b % cells) + cells) % cells);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(value(ix, iy), value(ix + 1, iy), fx), THREE.MathUtils.lerp(value(ix, iy + 1), value(ix + 1, iy + 1), fx), fy);
  };
  const height = (u: number, v: number) => periodic(u, v, 8) * .5 + periodic(u, v, 16) * .26 + periodic(u, v, 32) * .14 + periodic(u, v, 64) * .06;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, d = 1 / size;
    const nx = (height(u - d, v) - height(u + d, v)) * 6;
    const ny = (height(u, v - d) - height(u, v + d)) * 6;
    const norm = new THREE.Vector3(nx, ny, 1).normalize();
    const i = (y * size + x) * 4;
    data[i] = (norm.x * 0.5 + 0.5) * 255; data[i + 1] = (norm.y * 0.5 + 0.5) * 255; data[i + 2] = (norm.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  waterNormals = new THREE.DataTexture(data, size, size);
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  waterNormals.magFilter = THREE.LinearFilter; waterNormals.minFilter = THREE.LinearMipmapLinearFilter;
  waterNormals.generateMipmaps = true; waterNormals.needsUpdate = true;
  return waterNormals;
}

export function createWater(options: {
  size?: number; height?: number; color?: number; amplitude?: number; distortion?: number;
  sunDirection?: THREE.Vector3; bottomColor?: number;
  bathymetry?: {height:(x:number,z:number)=>number;bounds:[number,number,number,number]};
} = {}) {
  const amplitude = options.amplitude ?? 0.35;
  const water = new Water(new THREE.PlaneGeometry(options.size ?? 3000, options.size ?? 3000, 160, 160), {
    textureWidth: mobileQuality?512:1024, textureHeight: mobileQuality?512:1024, waterNormals: getWaterNormals(),
    sunDirection: options.sunDirection ?? new THREE.Vector3(-0.5, 0.65, -0.4).normalize(),
    sunColor: 0xfff3df, waterColor: options.color ?? 0x135965, distortionScale: options.distortion ?? 3.4, fog: true,
  });
  water.rotation.x = -Math.PI / 2; water.position.y = options.height ?? 0;
  water.material.uniforms.size.value = 5.5;
  water.material.vertexShader = 'varying vec2 vWaveSlope;\n' + water.material.vertexShader;
  water.material.vertexShader = water.material.vertexShader.replace('void main() {', `void main() {
    vec3 wavePosition = position;
    float w0=position.x*.095+position.y*.034+time*1.1;
    float w1=position.y*.14-position.x*.022+time*1.46;
    float w2=position.x*.044-position.y*.069+time*.76;
    wavePosition.z += ${amplitude.toFixed(3)}*(sin(w0)+.48*sin(w1)+.27*sin(w2));
    vWaveSlope=${amplitude.toFixed(3)}*vec2(.095*cos(w0)-.01056*cos(w1)+.01188*cos(w2),
      .034*cos(w0)+.0672*cos(w1)-.01863*cos(w2));
  `).replaceAll('vec4( position, 1.0 )', 'vec4( wavePosition, 1.0 )');
  water.material.fragmentShader = 'varying vec2 vWaveSlope;\n' + water.material.fragmentShader;
  water.material.fragmentShader = water.material.fragmentShader
    .replace('float rf0 = 0.3;', 'float rf0 = 0.025;')
    .replace('vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',
      `float p0=worldPosition.x*.095-worldPosition.z*.034+time*1.1;
       float p1=-worldPosition.z*.14-worldPosition.x*.022+time*1.46;
       float p2=worldPosition.x*.044+worldPosition.z*.069+time*.76;
       vec2 slope=${amplitude.toFixed(3)}*vec2(.095*cos(p0)-.01056*cos(p1)+.01188*cos(p2),.034*cos(p0)+.0672*cos(p1)-.01863*cos(p2));
       vec3 surfaceNormal=normalize(vec3(-slope.x,1.,slope.y)+vec3(noise.x,0.,noise.y)*${Math.min(.85,(options.distortion??3.4)*.20+.12).toFixed(3)});`)
    .replace('100.0, 2.0, 0.5', '155.0, 1.5, 0.5')
    .replace('vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;',
      'vec3 scatter = max(.18,dot(surfaceNormal,eyeDirection))*waterColor;\nscatter *= .88 + .12*sin(worldPosition.x*.012+worldPosition.z*.018);');
  // A locally sampled sea/lake bed gives true coastline-dependent optical depth.
  // Sand remains visible in the shallows; wavelengths absorb at different rates.
  if(options.bathymetry){
    const {height,bounds}=options.bathymetry;
    const resolution=mobileQuality?256:512, data=new Uint8Array(resolution*resolution*4);
    for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
      const wx=bounds[0]+x/(resolution-1)*(bounds[2]-bounds[0]);
      const wz=bounds[1]+y/(resolution-1)*(bounds[3]-bounds[1]);
      const depth=THREE.MathUtils.clamp((options.height??0)-height(wx,wz),0,60);
      const n=Math.round(depth/60*65535),offset=(y*resolution+x)*4;
      data[offset]=n>>8;data[offset+1]=n&255;data[offset+2]=0;data[offset+3]=255;
    }
    const texture=new THREE.DataTexture(data,resolution,resolution);
    texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
    water.material.uniforms.bedDepth={value:texture};
    water.material.uniforms.bedBounds={value:new THREE.Vector4(...bounds)};
    water.material.uniforms.bottomColor={value:new THREE.Color(options.bottomColor??0xa7b19b)};
    water.material.fragmentShader='uniform sampler2D bedDepth; uniform vec4 bedBounds; uniform vec3 bottomColor;\n'+water.material.fragmentShader;
    water.material.fragmentShader=water.material.fragmentShader.replace('vec3 outgoingLight = albedo;',`
      vec2 bedUV=(worldPosition.xz-bedBounds.xy)/(bedBounds.zw-bedBounds.xy);
      vec2 depthPacked=texture2D(bedDepth,clamp(bedUV,0.,1.)).rg;
      float bedMeters=dot(depthPacked,vec2(256.*255.,255.))/65535.*60.;
      float withinBed=step(0.,bedUV.x)*step(0.,bedUV.y)*step(bedUV.x,1.)*step(bedUV.y,1.);
      bedMeters=mix(60.,bedMeters,withinBed);
      vec3 transmission=exp(-vec3(.23,.065,.045)*bedMeters/max(eyeDirection.y,.24));
      float caustic=.96+.04*sin(worldPosition.x*1.7+time)*sin(worldPosition.z*1.3-time*.7);
      vec3 shallow=bottomColor*transmission*caustic+waterColor*(1.-transmission);
      vec3 outgoingLight=mix(shallow,reflectionSample,reflectance)+specularLight*.28;
      ${amplitude>.1?`
        float breaker=pow(max(0.,sin(time*.83-bedMeters*3.4+noise.x*2.)),18.);
        float lace=smoothstep(-.25,.35,getNoise(worldPosition.xz*31.).x);
        float shoreFoam=breaker*lace*(1.-smoothstep(.4,2.6,bedMeters))*smoothstep(.02,.22,bedMeters);
        outgoingLight=mix(outgoingLight,vec3(.76,.83,.82),shoreFoam*.58);
      `:''}
    `);
  }else{
    water.material.fragmentShader=water.material.fragmentShader.replace('vec3 outgoingLight = albedo;',
      'vec3 outgoingLight=mix(scatter,reflectionSample,reflectance)+specularLight*.28;');
  }
  water.userData.noOcclusion = true;
  return water;
}
