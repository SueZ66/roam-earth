import * as THREE from 'three';
import { createTerrain, fbm, noise2, seeded, terrainMaterial } from './nature';
import type { Landscape } from './types';

/** Erg Chebbi: long wind-cut crests at the edge of the Sahara. */
export function createDesert(): Landscape {
  const group = new THREE.Group();
  group.name = 'Sahara · Erg Chebbi';
  const height = (x: number, z: number) => {
    const warp = fbm(x * 0.002, z * 0.002, 3) * 58;
    const phase = (x * 0.81 + z * 0.39 + warp) * 0.017;
    const dune = Math.sin(phase) + 0.3 * Math.sin(phase * 2 + 0.65);
    const envelope = 34 + 17 * Math.sin(z * 0.002 + 1.2);
    const secondary = Math.sin(x * -0.005 + z * 0.012 + 1.6) * 22;
    const distant = Math.exp(-Math.pow((z + 1100) / 330, 2)) * (130 + fbm(x * 0.006, z * 0.008, 5) * 60);
    return 38 + dune * envelope + secondary + distant + noise2(x * 0.033, z * 0.033) * 0.8;
  };
  const sand = terrainMaterial('sand', 0xffd49c, 3);
  sand.normalScale.set(0.24, 0.24);
  sand.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vDuneWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDuneWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 vDuneWorld;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float ripple = sin(vDuneWorld.x * 4.2 + sin(vDuneWorld.z * 0.8) * 1.8 + vDuneWorld.z * 1.1);
      float fade = 1.0 - smoothstep(90.0, 250.0, distance(cameraPosition, vDuneWorld));
      diffuseColor.rgb *= 1.0 + ripple * 0.05 * fade;
    `);
  };
  const terrain = createTerrain({width:3200,depth:3400,centerZ:-700,segments:310,height,material:sand,
    color:(x,y,z,slope) => new THREE.Color().setRGB(0.98 + noise2(x * .006,z * .006)*.02, 0.94 + slope*.04, 0.88 + slope*.06),
  });
  group.add(terrain);
  // Widely spaced erosion stones give a natural size reference without toy props.
  const random = seeded(458);
  const rockGeo = new THREE.SphereGeometry(1, 9, 7);
  const vertices = rockGeo.getAttribute('position');
  for(let i=0;i<vertices.count;i++){const k=1+noise2(vertices.getX(i)*3,vertices.getZ(i)*3)*.25;vertices.setXYZ(i,vertices.getX(i)*k,vertices.getY(i)*k,vertices.getZ(i)*k);}
  rockGeo.computeVertexNormals(); rockGeo.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(vertices.count*3).fill(1),3));
  const rocks = new THREE.InstancedMesh(rockGeo,terrainMaterial('rock',0x91705b),100);
  const dummy = new THREE.Object3D();
  for(let i=0;i<100;i++){const x=-470+random()*1000,z=-600+random()*1050,s=.3+random()*1.8;dummy.position.set(x,height(x,z)+s*.2,z);dummy.scale.set(s*1.6,s*.6,s);dummy.rotation.set(random(),random()*6,random());dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}
  rocks.castShadow=true;rocks.receiveShadow=true;group.add(rocks);
  const marks = [[70,175],[80,0],[110,-750]];
  return {group,heightAt:height,collectibles:marks.map(([x,z],i)=>({position:new THREE.Vector3(x,height(x,z)+18,z),name:['流沙之脊','风蚀纹理','远方的山'][i],message:['沙丘的脊线，记录着风经过的方向。','一阵风，用整片沙海写下时间。','在摩洛哥的沙海边缘，远山划定了地平线。'][i]})),
    view:{position:new THREE.Vector3(160,158,420),target:new THREE.Vector3(0,40,-400),fov:53,minDistance:660,maxDistance:1080,azimuthRange:.38,polarRange:.065},
    atmosphere:{fogColor:0xd5be9c,fogDensity:.00057,sunPosition:new THREE.Vector3(-600,480,620),sunColor:0xffd1a0,sunIntensity:3.4,exposure:1.08,skyRotation:1.4},
    update:()=>{},
  };
}
