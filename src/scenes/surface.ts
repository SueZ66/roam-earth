import { MeshStandardMaterial } from 'three';
import { pbrTexture } from './nature';

type Ground = 'grass' | 'rock' | 'sand' | 'snow' | 'dune';
type Biome = 'coast' | 'meadow' | 'alpine' | 'desert';
interface SurfaceOptions {
  biome: Biome;
  tint?: number;
  /** Macro variation size. Microtextures retain their measured physical scale. */
  scale?: number;
  normalStrength?: number;
  shoreline?: number;
  snowLine?: [number, number];
  meadowLine?: [number, number];
}
// Provider dimensions in metres. A 2m rock scan must not become a 30m boulder.
const physicalSize: Record<Ground, number> = { grass:90, rock:2.001, sand:1.87, dune:2, snow:2 };

const surfaceGLSL = /* glsl */`
  varying vec3 vGroundPosition;
  varying vec3 vGroundNormal;
  struct GroundSurface { vec3 color; vec3 normal; float roughness; float ao; float height; };
  float groundHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float groundNoise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(groundHash(i),groundHash(i+vec2(1.,0.)),f.x),
      mix(groundHash(i+vec2(0.,1.)),groundHash(i+vec2(1.,1.)),f.x),f.y);
  }
  vec2 groundOffset(vec2 p) { return vec2(groundHash(p+19.2),groundHash(p+71.5))*11.3; }
  GroundSurface groundPlane(sampler2D albedo,sampler2D normalTex,sampler2D surfaceTex,
    vec2 uv,vec3 viewRay,float strength,float relief) {
    // Triangular stochastic tiling. Unlike a slowly changing offset, each tile
    // receives independent coordinates, eliminating the repeated aerial-grass grid.
    vec2 skew=mat2(1.,0.,-.57735027,1.15470054)*(uv*.8);
    vec2 cell=floor(skew), f=fract(skew),i0,i1,i2;vec3 w;
    if(f.x+f.y<1.){i0=cell;i1=cell+vec2(1.,0.);i2=cell+vec2(0.,1.);w=vec3(1.-f.x-f.y,f.x,f.y);}
    else{i0=cell+vec2(1.);i1=cell+vec2(0.,1.);i2=cell+vec2(1.,0.);w=vec3(f.x+f.y-1.,1.-f.x,1.-f.y);}
    w=pow(max(w,vec3(0.)),vec3(5.));w/=dot(w,vec3(1.));
    vec2 a=uv+groundOffset(i0),b=uv+groundOffset(i1),c=uv+groundOffset(i2);
    vec2 dx=dFdx(uv),dy=dFdy(uv);
    if(relief>.00001) {
      float h=textureGrad(surfaceTex,a,dx,dy).b*w.x+textureGrad(surfaceTex,b,dx,dy).b*w.y+textureGrad(surfaceTex,c,dx,dy).b*w.z-.5;
      vec2 shift=clamp(viewRay.xy/max(abs(viewRay.z),.28),vec2(-2.4),vec2(2.4))*h*relief;
      a-=shift;b-=shift;c-=shift;
    }
    GroundSurface s;
    s.color=textureGrad(albedo,a,dx,dy).rgb*w.x+textureGrad(albedo,b,dx,dy).rgb*w.y+textureGrad(albedo,c,dx,dy).rgb*w.z;
    vec3 packed=textureGrad(surfaceTex,a,dx,dy).rgb*w.x+textureGrad(surfaceTex,b,dx,dy).rgb*w.y+textureGrad(surfaceTex,c,dx,dy).rgb*w.z;
    s.normal=(textureGrad(normalTex,a,dx,dy).xyz*w.x+textureGrad(normalTex,b,dx,dy).xyz*w.y+textureGrad(normalTex,c,dx,dy).xyz*w.z)*2.-1.;
    s.normal.xy*=strength;s.normal=normalize(s.normal);
    s.ao=mix(.36,1.,packed.r);s.roughness=clamp(packed.g,.30,.99);s.height=packed.b;
    return s;
  }
  GroundSurface groundLayer(sampler2D albedo,sampler2D normalTex,sampler2D surfaceTex,
    vec3 p,vec3 weights,vec3 n,vec3 eye,float strength,float relief) {
    GroundSurface s;s.color=vec3(0);s.normal=vec3(0);s.roughness=0.;s.ao=0.;s.height=0.;
    vec3 side=sign(n);side=vec3(side.x==0.?1.:side.x,side.y==0.?1.:side.y,side.z==0.?1.:side.z);
    if(weights.x>.001) {
      GroundSurface a=groundPlane(albedo,normalTex,surfaceTex,vec2(-p.z*side.x,p.y),vec3(-eye.z*side.x,eye.y,eye.x),strength,relief);
      a.normal=vec3(abs(a.normal.z)*n.x,a.normal.y+n.y,-a.normal.x*side.x+n.z);
      s.color+=a.color*weights.x;s.normal+=a.normal*weights.x;s.roughness+=a.roughness*weights.x;s.ao+=a.ao*weights.x;s.height+=a.height*weights.x;
    }
    if(weights.y>.001) {
      GroundSurface a=groundPlane(albedo,normalTex,surfaceTex,vec2(p.x,-p.z*side.y),vec3(eye.x,-eye.z*side.y,eye.y),strength,relief);
      a.normal=vec3(a.normal.x+n.x,abs(a.normal.z)*n.y,-a.normal.y*side.y+n.z);
      s.color+=a.color*weights.y;s.normal+=a.normal*weights.y;s.roughness+=a.roughness*weights.y;s.ao+=a.ao*weights.y;s.height+=a.height*weights.y;
    }
    if(weights.z>.001) {
      GroundSurface a=groundPlane(albedo,normalTex,surfaceTex,vec2(p.x*side.z,p.y),vec3(eye.x*side.z,eye.y,eye.z),strength,relief);
      a.normal=vec3(a.normal.x*side.z+n.x,a.normal.y+n.y,abs(a.normal.z)*n.z);
      s.color+=a.color*weights.z;s.normal+=a.normal*weights.z;s.roughness+=a.roughness*weights.z;s.ao+=a.ao*weights.z;s.height+=a.height*weights.z;
    }
    s.normal=normalize(s.normal);return s;
  }
  GroundSurface groundMix(GroundSurface a,GroundSurface b,float t,float depth) {
    t=clamp(t+(b.height-a.height)*depth*4.*t*(1.-t),0.,1.);
    GroundSurface s;s.color=mix(a.color,b.color,t);
    s.normal=normalize(mix(a.normal,b.normal,t));s.roughness=mix(a.roughness,b.roughness,t);
    s.ao=mix(a.ao,b.ao,t);s.height=mix(a.height,b.height,t);return s;
  }
`;

function makeSurface(biome: Biome | Ground, tint: number, scale: number, strength: number, options?: SurfaceOptions) {
  const layers: Ground[] = biome === 'coast' ? ['grass','rock','sand']
    : biome === 'alpine' ? ['rock','grass','snow']
      : biome === 'meadow' ? ['grass','rock'] : [biome === 'desert' ? 'dune' : biome];
  const material = new MeshStandardMaterial({color:tint,roughness:1,metalness:0,vertexColors:true});
  material.name = `${biome}-measured-scan-pbr`;
  const maps = layers.map(kind=>({
    color:pbrTexture(`${kind}-diff`,true), normal:pbrTexture(`${kind}-normal`), packed:pbrTexture(`${kind}-surface`),
  }));
  const cliff=biome==='coast'||biome==='alpine'||biome==='meadow'
    ? {color:pbrTexture('cliff-diff',true),normal:pbrTexture('cliff-normal'),packed:pbrTexture('cliff-surface')}:undefined;
  const shoreline=(options?.shoreline??(biome==='alpine'?7:0)).toFixed(3);
  const snowLine=options?.snowLine??[133,218], meadowLine=options?.meadowLine??[46,120];
  material.onBeforeCompile = shader => {
    maps.forEach((map,i)=>{
      shader.uniforms[`groundColor${i}`]={value:map.color};
      shader.uniforms[`groundNormal${i}`]={value:map.normal};
      shader.uniforms[`groundPacked${i}`]={value:map.packed};
    });
    let declarations=maps.map((_,i)=>`uniform sampler2D groundColor${i},groundNormal${i},groundPacked${i};`).join('\n');
    if(cliff){
      shader.uniforms.cliffColor={value:cliff.color};shader.uniforms.cliffNormal={value:cliff.normal};shader.uniforms.cliffPacked={value:cliff.packed};
      declarations+='\nuniform sampler2D cliffColor,cliffNormal,cliffPacked;';
    }
    const cliffGLSL=cliff?/* glsl */`
      GroundSurface geologicalRock(GroundSurface grain,vec3 weights,vec3 n,vec3 eye){
        GroundSurface rock=groundLayer(cliffColor,cliffNormal,cliffPacked,vGroundPosition/90.,weights,n,eye,.72,0.);
        float grey=dot(rock.color,vec3(.2126,.7152,.0722));
        rock.color=mix(rock.color,vec3(grey)*vec3(.99,1.,1.01),.77);
        rock.color*=1.28;
        float microShade=clamp(dot(grain.color,vec3(.2126,.7152,.0722))*6.+.58,.65,1.26);
        rock.color*=mix(1.,microShade,.28);
        rock.normal=normalize(rock.normal+(grain.normal-n)*.62);
        rock.roughness=mix(rock.roughness,grain.roughness,.45);
        // Keep metre-scale stones at the shore; the aerial scan supplies distant strata.
        grain.color*=1.8;
        return groundMix(grain,rock,smoothstep(25.,180.,distance(cameraPosition,vGroundPosition)),.15);
      }
    `:'';
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vGroundPosition; varying vec3 vGroundNormal;')
      .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
        vec4 surfacePosition=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          surfacePosition=instanceMatrix*surfacePosition;
        #endif
        vGroundPosition=(modelMatrix*surfacePosition).xyz;
        vGroundNormal=inverseTransformDirection(transformedNormal,viewMatrix);
      `);
    const sample=(i:number,normal=1)=>{
      const kind=layers[i],size=physicalSize[kind];
      const relief=kind==='rock'?.045:kind==='grass'?.009:.003;
      const grain=`groundLayer(groundColor${i},groundNormal${i},groundPacked${i},vGroundPosition/${size.toFixed(4)},groundW,groundN,groundEye,${(strength*normal).toFixed(3)},nearRelief*${relief})`;
      return kind==='rock'&&cliff?`geologicalRock(${grain},groundW,groundN,groundEye)`:grain;
    };
    let blend='';
    if(biome==='coast') blend=/* glsl */`
      float rocky=smoothstep(.15,.40,groundSlope+(groundPatch-.5)*.18);
      rocky=max(rocky,smoothstep(370.,650.,groundY)*.6);
      if(rocky>.01) {GroundSurface rock=${sample(1)};ground=groundMix(ground,rock,rocky,.7);}
      float beach=1.-smoothstep(3.,10.,groundY+(groundPatch-.5)*3.);
      if(beach>.01) {GroundSurface sand=${sample(2,.45)};sand.color*=vec3(1.75,1.70,1.51);ground=groundMix(ground,sand,beach,.45);}
      float wet=(1.-smoothstep(.5,2.6,groundY))*beach;
      ground.color*=1.-wet*.29;ground.roughness=mix(ground.roughness,.20,wet*.85);
    `;
    if(biome==='meadow') blend=/* glsl */`
      ground.color*=mix(vec3(.72,1.06,.64),vec3(.92,1.02,.68),groundPatch);
      float rocky=smoothstep(.26,.56,groundSlope+(groundPatch-.5)*.19);
      if(rocky>.01) {GroundSurface rock=${sample(1)};rock.color*=vec3(.79,.83,.82);ground=groundMix(ground,rock,rocky,.7);}
      ground.roughness=max(.75,ground.roughness);
    `;
    if(biome==='alpine') blend=/* glsl */`
      float grass=(1.-smoothstep(${meadowLine[0].toFixed(2)},${meadowLine[1].toFixed(2)},groundY))*smoothstep(.55,.92,groundN.y)*smoothstep(.15,1.4,groundY);
      if(grass>.01) {GroundSurface meadow=${sample(1,.75)};meadow.color*=vec3(.99,.94,.74);ground=groundMix(ground,meadow,grass*.88,.6);}
      float snowHeight=groundY+(groundPatch-.5)*${((snowLine[1]-snowLine[0])*.8).toFixed(2)}+groundN.z*38.;
      float snow=smoothstep(${snowLine[0].toFixed(2)},${snowLine[1].toFixed(2)},snowHeight)*smoothstep(.49,.86,groundN.y+(micro-.5)*.16);
      snow*=smoothstep(.12,.58,groundPatch+groundN.z*.15);
      snow=max(snow,smoothstep(${(snowLine[1]*1.45).toFixed(2)},${(snowLine[1]*1.95).toFixed(2)},snowHeight)*smoothstep(.36,.68,groundN.y)*.38);
      if(snow>.01) {GroundSurface ice=${sample(2,.27)};ice.color=mix(ice.color,vec3(.82,.88,.95),.10);ice.roughness=clamp(ice.roughness,.55,.90);ground=groundMix(ground,ice,snow,.9);}
      float wet=(1.-smoothstep(.2,1.4,groundY))*step(-.8,groundY);ground.color*=1.-wet*.28;ground.roughness=mix(ground.roughness,.27,wet*.8);
    `;
    if(biome==='desert') blend=/* glsl */`
      ground.color*=mix(vec3(1.72,1.25,.77),vec3(1.84,1.19,.64),groundPatch*.45);
      vec2 rippleUV=vGroundPosition.xz;
      float phase=rippleUV.x*22.+rippleUV.y*9.8+sin(rippleUV.y*1.1)*1.5+groundNoise(rippleUV*.27)*4.;
      float detailFade=(1.-smoothstep(.8,3.5,fwidth(phase)))*(1.-smoothstep(28.,140.,distance(cameraPosition,vGroundPosition)));
      ground.color*=1.+sin(phase)*.045*detailFade;
      ground.normal=normalize(ground.normal+vec3(-.16,0.,-.07)*cos(phase)*detailFade);
      ground.roughness=clamp(ground.roughness,.78,.98);
    `;
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>\n${declarations}\n${surfaceGLSL}\n${cliffGLSL}`)
      .replace('#include <map_fragment>',/* glsl */`
        vec3 groundN=normalize(vGroundNormal);
        vec3 groundW=pow(abs(groundN),vec3(6.));groundW/=dot(groundW,vec3(1.));
        vec3 groundEye=normalize(cameraPosition-vGroundPosition);
        float nearRelief=1.-smoothstep(35.,120.,distance(cameraPosition,vGroundPosition));
        float groundPatch=groundNoise(vGroundPosition.xz/${(scale*5).toFixed(3)})*.76+groundNoise(vGroundPosition.xz/${(scale*.9).toFixed(3)})*.24;
        float micro=mix(.5,groundNoise(vGroundPosition.xz*.17),1.-smoothstep(.3,1.,length(fwidth(vGroundPosition.xz*.17))));
        float groundY=vGroundPosition.y-${shoreline};
        float groundSlope=1.-max(groundN.y,0.);
        GroundSurface ground=${sample(0,biome==='desert'?.32:1)};
        ${blend}
        ${biome==='rock'?'ground.color*=1.8;':''}
        ground.color*=.94+groundPatch*.12;
        diffuseColor.rgb*=ground.color;
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor=clamp(ground.roughness*roughness,.14,1.);')
      .replace('#include <normal_fragment_maps>',/* glsl */`
        normal=normalize(mat3(viewMatrix)*ground.normal);
        #ifdef DOUBLE_SIDED
          normal*=faceDirection;
        #endif
      `)
      .replace('#include <aomap_fragment>',/* glsl */`
        reflectedLight.indirectDiffuse*=ground.ao;
        reflectedLight.indirectSpecular*=mix(ground.ao,1.,roughnessFactor*.6);
      `);
  };
  material.customProgramCacheKey=()=>`earth-scan-v5-${biome}-${scale}-${strength}-${shoreline}-${snowLine}-${meadowLine}`;
  return material;
}

export function landscapeMaterial(options: SurfaceOptions) {
  return makeSurface(options.biome,options.tint??0xffffff,options.scale??24,options.normalStrength??.7,options);
}

/** Measured scans retain consistent size across terrain and instanced stones. */
export function detailMaterial(kind: Ground, tint=0xffffff, scale=3) {
  return makeSurface(kind,tint,scale,.72);
}
