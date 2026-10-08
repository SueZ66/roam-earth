import { Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { assetManager, trackLandscapeAsset } from './nature';

export interface ScanPlacement { x:number; z:number; size:number; yaw?:number; }
let scans: Promise<Mesh[]> | undefined;

function loadScans() {
  if(!scans) scans=new GLTFLoader(assetManager)
    .loadAsync(new URL('models/rock-moss/rock-moss.gltf',document.baseURI).href)
    .then(gltf=>{
      const result:Mesh[]=[];gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(object=>{
        if(!(object instanceof Mesh))return;
        const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
        geometry.computeBoundingBox();const box=geometry.boundingBox!,size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
        geometry.translate(-center.x,-box.min.y,-center.z);
        const width=Math.max(size.x,size.z);geometry.scale(1/width,1/width,1/width);
        const material=(object.material as MeshStandardMaterial).clone();
        material.name=`Photogrammetry / ${object.name}`;material.envMapIntensity=.75;
        if(material.map)material.map.anisotropy=16;
        if(material.normalMap)material.normalMap.anisotropy=8;
        result.push(new Mesh(geometry,material));
      });
      if(!result.length)throw new Error('No scanned rock geometry');
      return result;
    });
  return scans;
}

/** True scanned geometry/UVs near the camera, batched by prototype. */
export function addScannedRocks(group:Group,placements:ScanPlacement[],height:(x:number,z:number)=>number) {
  const content=new Group();content.name='摄影测量 · 苔藓岩石';group.add(content);
  const promise=loadScans().then(prototypes=>{
    prototypes.forEach((prototype,variant)=>{
      const selected=placements.filter((_,i)=>i%prototypes.length===variant);
      if(!selected.length)return;
      const mesh=new InstancedMesh(prototype.geometry,prototype.material,selected.length);
      const matrix=new Matrix4(),rotation=new Quaternion();
      selected.forEach((p,i)=>{
        rotation.setFromAxisAngle(new Vector3(0,1,0),p.yaw??i*2.399);
        matrix.compose(new Vector3(p.x,height(p.x,p.z)-p.size*.08,p.z),rotation,new Vector3(p.size,p.size,p.size));
        mesh.setMatrixAt(i,matrix);
      });
      mesh.castShadow=mesh.receiveShadow=true;content.add(mesh);
    });
    content.updateMatrixWorld(true);
  });
  trackLandscapeAsset(promise,'photogrammetry-rocks');
}
