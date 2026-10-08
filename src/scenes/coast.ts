import { BufferGeometry, Color, DoubleSide, Euler, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, Quaternion, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { createWater, fbm, seeded } from './nature';
import { detailMaterial, landscapeMaterial } from './surface';
import { coastDem, coastElevations, sampleCoastElevation } from './coast-dem';
import type { Landscape } from './types';
import { addScannedRocks } from './scanned-rocks';

/** Real Haukland/Mannen DEM proportions. Norwegian terrain data © Kartverket (CC BY 4.0).
 * Local metres: east +X, south +Z. No vertical exaggeration. Beach details/seabed are authored.
 * Provenance and reproducible processing: public/terrain/coast-sources.json.
 */
export function createCoast(): Landscape {
  const group = new Group(); group.name = '罗弗敦 · 豪克兰湾';
  const random = seeded(682001353), samples = coastElevations();
  const { width, height: rows, step, minX, minZ } = coastDem;
  const distance = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) distance[i] = samples[i] > 8 ? 0 : 1e6;
  const diagonal = step * Math.SQRT2;
  for (let z = 0; z < rows; z++) for (let x = 0; x < width; x++) {
    const i = z * width + x;
    if (x) distance[i] = Math.min(distance[i], distance[i - 1] + step);
    if (z) distance[i] = Math.min(distance[i], distance[i - width] + step);
    if (x && z) distance[i] = Math.min(distance[i], distance[i - width - 1] + diagonal);
    if (x < width - 1 && z) distance[i] = Math.min(distance[i], distance[i - width + 1] + diagonal);
  }
  for (let z = rows - 1; z >= 0; z--) for (let x = width - 1; x >= 0; x--) {
    const i = z * width + x;
    if (x < width - 1) distance[i] = Math.min(distance[i], distance[i + 1] + step);
    if (z < rows - 1) distance[i] = Math.min(distance[i], distance[i + width] + step);
    if (x && z < rows - 1) distance[i] = Math.min(distance[i], distance[i + width - 1] + diagonal);
    if (x < width - 1 && z < rows - 1) distance[i] = Math.min(distance[i], distance[i + width + 1] + diagonal);
  }
  const sampleDistance = (x: number, z: number) => {
    const u = Math.max(0, Math.min(width - 1.001, (x - minX) / step)), v = Math.max(0, Math.min(rows - 1.001, (z - minZ) / step));
    const ix = Math.floor(u), iz = Math.floor(v), fx = u - ix, fz = v - iz, i = iz * width + ix;
    return (distance[i] * (1 - fx) + distance[i + 1] * fx) * (1 - fz) + (distance[i + width] * (1 - fx) + distance[i + width + 1] * fx) * fz;
  };
  const heightAt = (x: number, z: number) => {
    const h = sampleCoastElevation(x, z);
    const ocean = Math.max(0, 1 - h / 1.6) * Math.min(28, sampleDistance(x, z) * .095);
    return h - .62 - ocean + fbm(x * .118, z * .134, 3) * Math.min(.85, Math.max(0, h - 12) * .014);
  };
  const patch = { minX: 0, maxX: 310, minZ: 400, maxZ: 750 };
  const makeGround = (x0: number, z0: number, w: number, d: number, nx: number, nz: number, fine: boolean) => {
    const positions = new Float32Array((nx + 1) * (nz + 1) * 3), colors = new Float32Array(positions.length), indices: number[] = [];
    for (let z = 0; z <= nz; z++) for (let x = 0; x <= nx; x++) {
      const wx = x0 + x / nx * w, wz = z0 + z / nz * d, i = z * (nx + 1) + x, h = heightAt(wx, wz);
      const ripple = fine ? Math.sin(wx * 1.7 + wz * .59 + fbm(wx * .11, wz * .13, 2) * 2.4) * .016 * Math.min(1, Math.max(0, h - 1) / 4) : 0;
      positions.set([wx, h + (fine ? .035 : 0) + ripple, wz], i * 3);
      const tone = fine ? 1 - Math.exp(-((h - 1.35) ** 2) / .07) * .11 : .976 + fbm(wx * .009, wz * .009, 3) * .03;
      colors.set([tone, tone, tone * .996], i * 3);
    }
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
      const a = z * (nx + 1) + x, b = a + nx + 1, wx = x0 + x / nx * w, wz = z0 + z / nz * d;
      if ([a, a + 1, b, b + 1].every(i => positions[i * 3 + 1] < -7)) continue;
      if (!fine && wx > patch.minX + step && wx + step < patch.maxX - step && wz > patch.minZ + step && wz + step < patch.maxZ - step) continue;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    const material = landscapeMaterial({ biome: 'coast', scale: fine ? 16 : 25, normalStrength: fine ? .58 : .72 });
    if (fine) { material.polygonOffset = true; material.polygonOffsetFactor = -1; material.polygonOffsetUnits = -1; }
    const mesh = new Mesh(geometry, material); mesh.receiveShadow = true;
    mesh.name = fine ? '近景潮间带 · 0.9米沙地' : 'Haukland / Mannen · 真实高程地貌'; group.add(mesh);
  };
  makeGround(minX, minZ, (width - 1) * step, (rows - 1) * step, width - 1, rows - 1, false);
  makeGround(patch.minX, patch.minZ, patch.maxX - patch.minX, patch.maxZ - patch.minZ, 344, 328, true);

  const water = createWater({ size: 5800, height: .12, color: 0x247779, amplitude: .24, distortion: 3.3,
    sunDirection: new Vector3(-.7, .60, -.32).normalize(), bathymetry: { height: heightAt, bounds: [-1900, -450, 550, 1150] } });
  const wp = water.geometry.getAttribute('position');
  const concentrate = (p: number) => { const t = Math.abs(p) / 2900; return Math.sign(p) * (t <= .8 ? t * 1050 : 840 + ((t - .8) / .2) ** 1.4 * 2060); };
  for (let i = 0; i < wp.count; i++) wp.setXY(i, concentrate(wp.getX(i)) - 650, concentrate(wp.getY(i)) - 220);
  wp.needsUpdate = true; water.geometry.computeBoundingSphere(); group.add(water);

  // Marching squares extracts the actual irregular shoreline, with a narrow seaward surf ribbon.
  const fp: number[] = [], fu: number[] = [], fi: number[] = [], contour = .12;
  // Use the final metre-valued surface (including seabed shaping), not raw DEM units.
  const coastSurface = (group.children[0] as Mesh).geometry.getAttribute('position');
  for (let z = 0; z < rows - 1; z++) for (let x = 0; x < width - 1; x++) {
    const wx = minX + x * step, wz = minZ + z * step;
    if (Math.hypot(wx + 550, wz - 180) > 2500) continue;
    const i = z * width + x, values = [coastSurface.getY(i), coastSurface.getY(i + 1), coastSurface.getY(i + width + 1), coastSurface.getY(i + width)];
    if (values.every(v => v <= contour) || values.every(v => v > contour)) continue;
    const corners = [[wx, wz], [wx + step, wz], [wx + step, wz + step], [wx, wz + step]], points: Vector3[] = [];
    for (let edge = 0; edge < 4; edge++) {
      const next = (edge + 1) % 4; if ((values[edge] > contour) === (values[next] > contour)) continue;
      const t = (contour - values[edge]) / (values[next] - values[edge]);
      points.push(new Vector3(corners[edge][0] + (corners[next][0] - corners[edge][0]) * t, .33, corners[edge][1] + (corners[next][1] - corners[edge][1]) * t));
    }
    for (let j = 0; j + 1 < points.length; j += 2) {
      const a = points[j], b = points[j + 1], c = a.clone().add(b).multiplyScalar(.5);
      const normal = new Vector3(heightAt(c.x - 5, c.z) - heightAt(c.x + 5, c.z), 0, heightAt(c.x, c.z - 5) - heightAt(c.x, c.z + 5)).normalize();
      const base = fp.length / 3;
      for (let k = 0; k <= 4; k++) for (const p of [a, b]) { fp.push(p.x + normal.x * k * 3, .33, p.z + normal.z * k * 3); fu.push(k * 3, p.x * .57 + p.z * .83); }
      for (let k = 0; k < 4; k++) { const v = base + k * 2; fi.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
    }
  }
  const foamGeometry = new BufferGeometry(); foamGeometry.setAttribute('position', new Float32BufferAttribute(fp, 3)); foamGeometry.setAttribute('uv', new Float32BufferAttribute(fu, 2)); foamGeometry.setIndex(fi);
  const foamMaterial = new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide, uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vSurf;varying vec2 vCoast;uniform float time;void main(){vSurf=uv;vCoast=position.xz;vec3 p=position;p.y+=sin(p.x*.053+p.z*.024+time*.73)*.06;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
    fragmentShader: [
      'varying vec2 vSurf;varying vec2 vCoast;uniform float time;',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}',
      'void main(){float x=vSurf.x;float coast=noise(vCoast*.016);float wave=pow(max(0.,sin(x*.76+time*.83+coast*3.6)),13.);',
      'float lace=smoothstep(.22,.69,noise(vCoast*2.7+time*.033)+noise(vCoast*.72)*.26);float edge=smoothstep(0.,.8,x)*(1.-smoothstep(3.,12.,x));',
      'float wash=exp(-x*.60)*(.5+.5*sin(time*.39+coast*5.));float alpha=(wave*.44+wash*.10)*edge*lace*(.25+coast*.65);gl_FragColor=vec4(.91,.94,.91,alpha);',
      '#include <tonemapping_fragment>', '#include <colorspace_fragment>', '}',
    ].join('\n'),
  });
  const foam = new Mesh(foamGeometry, foamMaterial); foam.name = '真实潮线 · 破碎浪沫'; foam.renderOrder = 2; foam.userData.noOcclusion = true; group.add(foam);

  // Weathered, physically sized granite. Only twelve foreground stones use the dense prototype.
  const makeStone = (variant: number, fine: boolean) => {
    const geo = fine ? new SphereGeometry(1, 40, 28) : new IcosahedronGeometry(1, 2), p = geo.getAttribute('position'), c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = 1 + fbm(x * 3.8 + variant * 13, z * 3.6 + y * 2.7, 5) * .19;
      const split = Math.exp(-((y + x * .25 - z * .09 - .14) ** 2) * 700) * .065;
      p.setXYZ(i, Math.min(.85 + y * .12, x * r) - split, Math.max(-.66, Math.min(.72 - x * .12 + z * .09, y * r)), Math.min(.86 - x * .07, z * r));
      const tone = .97 + fbm(x * 9 + variant, z * 8 + y * 5, 3) * .07 - split * 1.2; c.set([tone, tone, tone * .994], i * 3);
    }
    geo.setAttribute('color', new Float32BufferAttribute(c, 3)); geo.computeVertexNormals(); return geo;
  };
  const stoneMaterial = detailMaterial('rock', 0xffffff, 2), matrix = new Matrix4(), q = new Quaternion(), pos = new Vector3(), scale = new Vector3();
  const heroLocations = [[136,582,.55],[128,566,.38],[116,548,.82],[97,525,.44],[110,568,.36],[122,578,.42],
    [157,594,.58],[150,572,.42],[85,514,.62],[137,560,.33],[76,492,.51],[135,596,.26]];
  for (let variant = 0; variant < 3; variant++) {
    const list = heroLocations.filter((_,i) => i % 3 === variant), stones = new InstancedMesh(makeStone(variant, true), stoneMaterial, list.length);
    list.forEach(([x,z,size],i) => {
      pos.set(x,heightAt(x,z)+size*.23,z); q.setFromEuler(new Euler(random()*.24,random()*Math.PI*2,random()*.22)); scale.set(size*(1.28+variant*.13),size*.78,size);
      stones.setMatrixAt(i,matrix.compose(pos,q,scale)); stones.setColorAt(i,new Color().setScalar(1-Math.max(0,1-heightAt(x,z)/2)*.23));
    });
    stones.name='近景裂隙花岗岩 '+(variant+1); stones.receiveShadow=true; stones.castShadow=true; group.add(stones);
  }
  const rocks=new InstancedMesh(makeStone(5,false),stoneMaterial,270); let count=0;
  for(let attempt=0;attempt<8000&&count<rocks.count;attempt++){
    const x=-2230+random()*2410,z=-140+random()*535,y=heightAt(x,z);if(y<-.2||y>18||(x> -160&&z>115&&z<345))continue;
    const size=.35+random()**2*2.7;pos.set(x,y+size*.14,z);q.setFromEuler(new Euler(random()*.5,random()*Math.PI*2,random()*.6));scale.set(size*1.35,size*.65,size);
    rocks.setMatrixAt(count,matrix.compose(pos,q,scale));rocks.setColorAt(count++,new Color().setScalar(.80+random()*.20));
  }
  rocks.count=count;rocks.name='岸边冲蚀块石';rocks.receiveShadow=true;rocks.castShadow=true;group.add(rocks);
  const pebbleGeo=new IcosahedronGeometry(1,1);pebbleGeo.setAttribute('color',new Float32BufferAttribute(new Float32Array(pebbleGeo.getAttribute('position').count*3).fill(1),3));
  const pebbles=new InstancedMesh(pebbleGeo,detailMaterial('rock',0xf5f3ee,2),1350);count=0;
  for(let attempt=0;attempt<16000&&count<pebbles.count;attempt++){
    const x=35+random()*260,z=430+random()*285,y=heightAt(x,z);if(y<.8||y>7.3||fbm(x*.08,z*.06,3)<-.06||random()<.42)continue;
    const size=.025+random()**3*.17;pos.set(x,y+size*.24+.06,z);q.setFromEuler(new Euler(random()*.35,random()*Math.PI*2,random()*.2));scale.set(size*1.35,size*.54,size);
    pebbles.setMatrixAt(count,matrix.compose(pos,q,scale));pebbles.setColorAt(count++,new Color().setScalar(.61+random()*.38));
  }
  pebbles.count=count;pebbles.name='不均匀潮线卵石';pebbles.receiveShadow=true;group.add(pebbles);
  addScannedRocks(group,[
    {x:129,z:594,size:1.35,yaw:.7},{x:120,z:590,size:.78,yaw:2.3},
    {x:127,z:617,size:1.1,yaw:4.1},{x:112,z:557,size:1.6,yaw:1.4},
  ],heightAt);

  return {group,heightAt,
    view:{position:new Vector3(145,Math.max(4,heightAt(145,610)+5),610),target:new Vector3(-1400,15,0),fov:55,minDistance:1050,maxDistance:2000,azimuthRange:.18,polarRange:.065},
    atmosphere:{fogColor:0xb9c9cb,fogDensity:.00012,sunPosition:new Vector3(-1250,1400,-1000),sunColor:0xfff6e9,sunIntensity:2.45,exposure:1.03,skyRotation:1.13},
    collectibles:[
      {position:new Vector3(-750,heightAt(-750,80)+10,80),name:'北极白沙',message:'豪克兰湾真实海岸轮廓：低缓的浅色沙滩，被古老的花岗岩山脊环抱。'},
      {position:new Vector3(-980,6,320),name:'大西洋涌浪',message:'挪威海的涌浪进入浅湾，在潮线前分裂成细小的白沫。'},
      {position:new Vector3(-1180,heightAt(-1180,-130)+25,-130),name:'海岸山脊',message:'主要山势参考豪克兰湾和曼嫩山周边的公开高程资料，保留真实的地貌比例。'},
    ],
    update:elapsed=>{water.material.uniforms.time.value=elapsed*.66;foamMaterial.uniforms.time.value=elapsed;},
  };
}
