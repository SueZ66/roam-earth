import * as THREE from 'three';
import { createTerrain, fbm, noise2, seeded } from './nature';
import { detailMaterial, landscapeMaterial } from './surface';
import type { Landscape } from './types';

/** Erg Chebbi: long wind-cut crests at the edge of the Sahara. */
export function createDesert(): Landscape {
  const group = new THREE.Group();
  group.name = 'Sahara · Erg Chebbi';
  const height = (x: number, z: number) => {
    const warp = fbm(x * 0.002, z * 0.002, 3) * 58 + Math.sin(z * .0045) * 22;
    const phase = (x * 0.81 + z * 0.39 + warp) * 0.017;
    const dune = Math.sin(phase) + 0.3 * Math.sin(phase * 2 + 0.65)
      + .075 * Math.sin(phase * 3 + 1.1);
    const envelope = 34 + 17 * Math.sin(z * 0.002 + 1.2);
    const secondary = Math.sin(x * -0.005 + z * 0.012 + 1.6) * 22;
    const distant = Math.exp(-Math.pow((z + 1100) / 330, 2)) * (130 + fbm(x * 0.006, z * 0.008, 5) * 60);
    // Lower, wind-scoured secondary ridges interrupt the main dune rhythm.
    const windward = Math.max(0, Math.cos(phase - .4));
    const rippledApron = Math.sin(x * .046 + z * .021 + fbm(x * .01, z * .01, 3) * 1.5)
      * windward * 1.25;
    return 38 + dune * envelope + secondary + distant + rippledApron + noise2(x * 0.033, z * 0.033) * 0.35;
  };
  const sand = landscapeMaterial({biome:'desert',tint:0xffd9ab,scale:11,normalStrength:.52});
  const terrain = createTerrain({width:3200,depth:3400,centerZ:-700,segments:336,height,material:sand,
    color:(x,y,z,slope) => new THREE.Color().setRGB(0.98 + noise2(x * .006,z * .006)*.02, 0.94 + slope*.04, 0.88 + slope*.06),
  });
  group.add(terrain);
  // Widely spaced erosion stones give a natural size reference without toy props.
  const random = seeded(458);
  const rockGeo = new THREE.IcosahedronGeometry(1, 2);
  const vertices = rockGeo.getAttribute('position');
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
    const k=1+fbm(x*3+z,y*4,3)*.18;
    // Erosion flattens the upwind face and leaves three intersecting facets.
    vertices.setXYZ(i,Math.min(x*k,.71+z*.19),Math.min(y*k,.62-x*.17),z*k);
  }
  rockGeo.computeVertexNormals(); rockGeo.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(vertices.count*3).fill(1),3));
  const rocks = new THREE.InstancedMesh(rockGeo,detailMaterial('rock',0x99755b,2.7),145);
  const dummy = new THREE.Object3D();
  for(let i=0;i<rocks.count;i++){
    const x=-360+random()*820,z=-480+random()*900,s=.25+Math.pow(random(),2)*2.4;
    dummy.position.set(x,height(x,z)-s*.12,z);dummy.scale.set(s*1.6,s*.7,s);
    dummy.rotation.set(random()*.3,random()*6,random()*.18);dummy.updateMatrix();
    rocks.setMatrixAt(i,dummy.matrix);rocks.setColorAt(i,new THREE.Color().setScalar(.68+random()*.35));
  }
  rocks.castShadow=true;rocks.receiveShadow=true;group.add(rocks);
  const pebbleGeometry=new THREE.IcosahedronGeometry(1,0);
  pebbleGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(pebbleGeometry.getAttribute('position').count*3).fill(1),3));
  const pebbles=new THREE.InstancedMesh(pebbleGeometry,detailMaterial('rock',0x876f54,.7),520);
  for(let i=0;i<pebbles.count;i++){
    const x=-150+random()*430,z=80+random()*340,size=.035+random()**3*.29;
    dummy.position.set(x,height(x,z)-size*.12,z);dummy.scale.set(size*1.4,size*.42,size);
    dummy.rotation.set(random(),random()*6.28,random());dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);
    pebbles.setColorAt(i,new THREE.Color().setScalar(.7+random()*.4));
  }
  pebbles.receiveShadow=true;group.add(pebbles);
  const marks = [[70,175],[80,0],[110,-750]];
  return {group,heightAt:height,collectibles:marks.map(([x,z],i)=>({position:new THREE.Vector3(x,height(x,z)+18,z),name:['流沙之脊','风蚀纹理','远方的山'][i],message:['沙丘的脊线，记录着风经过的方向。','一阵风，用整片沙海写下时间。','在摩洛哥的沙海边缘，远山划定了地平线。'][i]})),
    view:{position:new THREE.Vector3(160,158,420),target:new THREE.Vector3(0,40,-400),fov:53,minDistance:660,maxDistance:1080,azimuthRange:.38,polarRange:.065},
    atmosphere:{fogColor:0xd5be9c,fogDensity:.00057,sunPosition:new THREE.Vector3(-600,480,620),sunColor:0xffd1a0,sunIntensity:3.4,exposure:1.08,skyRotation:1.4},
    update:()=>{},
  };
}
