import { MeshStandardMaterial } from 'three';
import { surfaceTexture } from './nature';

type Ground = 'grass' | 'rock' | 'sand' | 'snow';
type Biome = 'coast' | 'meadow' | 'alpine' | 'desert';
interface SurfaceOptions {
  biome: Biome;
  tint?: number;
  /** Metres covered by the primary texture, independent of mesh UVs. */
  scale?: number;
  normalStrength?: number;
}

// Whiteout normal blending retains the geometric normal even on vertical walls.
// All three PBR channels use the same projection and the same layer masks.
const surfaceGLSL = /* glsl */`
  varying vec3 vGroundPosition;
  varying vec3 vGroundNormal;
  struct GroundSurface { vec3 color; vec3 normal; float roughness; };
  float groundHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float groundNoise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(groundHash(i),groundHash(i+vec2(1.,0.)),f.x),
      mix(groundHash(i+vec2(0.,1.)),groundHash(i+vec2(1.,1.)),f.x),f.y);
  }
  vec3 groundTri(sampler2D tex,vec3 p,vec3 w) {
    return texture2D(tex,p.zy).rgb*w.x + texture2D(tex,p.xz).rgb*w.y + texture2D(tex,p.xy).rgb*w.z;
  }
  GroundSurface groundLayer(sampler2D albedo,sampler2D normalTex,sampler2D roughTex,
    vec3 p,vec3 weights,vec3 geometricNormal,float strength) {
    GroundSurface s;
    // Incommensurate second scale breaks photographic repeats without hard tile borders.
    vec3 large=groundTri(albedo,p*.371+vec3(17.7,43.3,9.2),weights);
    s.color=mix(groundTri(albedo,p,weights),large,.31);
    vec3 nx=texture2D(normalTex,p.zy).xyz*2.0-1.0;
    vec3 ny=texture2D(normalTex,p.xz).xyz*2.0-1.0;
    vec3 nz=texture2D(normalTex,p.xy).xyz*2.0-1.0;
    nx.xy*=strength;ny.xy*=strength;nz.xy*=strength;
    nx=vec3(nx.xy+geometricNormal.zy,abs(nx.z)*geometricNormal.x);
    ny=vec3(ny.xy+geometricNormal.xz,abs(ny.z)*geometricNormal.y);
    nz=vec3(nz.xy+geometricNormal.xy,abs(nz.z)*geometricNormal.z);
    s.normal=normalize(nx.zyx*weights.x+ny.xzy*weights.y+nz*weights.z);
    s.roughness=clamp(groundTri(roughTex,p,weights).g*.65+.30,.33,.99);
    return s;
  }
  GroundSurface groundMix(GroundSurface a,GroundSurface b,float t) {
    GroundSurface s;s.color=mix(a.color,b.color,t);
    s.normal=normalize(mix(a.normal,b.normal,t));s.roughness=mix(a.roughness,b.roughness,t);return s;
  }
`;

function makeSurface(biome: Biome | Ground, tint: number, scale: number, strength: number) {
  const layers: Ground[] = biome === 'coast' ? ['grass','rock','sand']
    : biome === 'alpine' ? ['rock','grass','snow']
      : biome === 'meadow' ? ['grass','rock'] : [biome === 'desert' ? 'sand' : biome];
  const material = new MeshStandardMaterial({color:tint,roughness:1,metalness:0,vertexColors:true});
  material.name = `${biome}-triplanar-pbr`;
  // Queue now, before the application's asset-ready promise is awaited.
  const maps = layers.map(kind=>({
    color:surfaceTexture(`${kind}-diff`,true), normal:surfaceTexture(`${kind}-normal`),
    rough:surfaceTexture(`${kind}-rough`),
  }));
  material.onBeforeCompile = shader => {
    maps.forEach((map,i)=>{
      shader.uniforms[`groundColor${i}`]={value:map.color};
      shader.uniforms[`groundNormal${i}`]={value:map.normal};
      shader.uniforms[`groundRough${i}`]={value:map.rough};
    });
    const declarations=maps.map((_,i)=>`uniform sampler2D groundColor${i},groundNormal${i},groundRough${i};`).join('\n');
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
    const sample=(i:number,multiplier=1,normal=1)=>`groundLayer(groundColor${i},groundNormal${i},groundRough${i},groundP*${multiplier.toFixed(3)},groundW,groundN,${(strength*normal).toFixed(3)})`;
    let blend='';
    if(biome==='coast') blend=/* glsl */`
      float rocky=smoothstep(.18,.42,groundSlope+(groundPatch-.5)*.13);
      rocky=max(rocky,smoothstep(285.,480.,groundY)*.5);
      if(rocky>.015) {GroundSurface rock=${sample(1,.86)};rock.color*=vec3(.86,.88,.86)*(1.-strata*.10);ground=groundMix(ground,rock,rocky);}
      float beach=1.-smoothstep(3.0,8.5,groundY+(groundPatch-.5)*2.5);
      if(beach>.015) {GroundSurface sand=${sample(2,2,.32)};sand.color*=vec3(1.07,1.04,.94);ground=groundMix(ground,sand,beach);}
      float wet=(1.-smoothstep(.4,3.3,groundY))*beach;
      ground.color*=1.-wet*.32;ground.roughness=mix(ground.roughness,.26,wet*.85);
    `;
    if(biome==='meadow') blend=/* glsl */`
      ground.color*=mix(vec3(.84,1.0,.75),vec3(1.03,.96,.73),groundPatch*.62);
      float rockBand=pow(.5+.5*sin(groundY*.19+groundPatch*3.),14.)*.18;
      float rocky=max(smoothstep(.34,.62,groundSlope+(groundPatch-.5)*.12),rockBand*smoothstep(.19,.45,groundSlope));
      if(rocky>.015) {GroundSurface rock=${sample(1,.72)};rock.color*=vec3(.30,.34,.32)*(1.-strata*.13);ground=groundMix(ground,rock,rocky);}
      ground.roughness=mix(ground.roughness,.82,(1.-groundPatch)*.2);
    `;
    if(biome==='alpine') blend=/* glsl */`
      ground.color*=vec3(.69,.73,.76)*(1.-strata*.10);
      float grass=(1.-smoothstep(46.,120.,groundY))*smoothstep(.55,.9,groundN.y)*smoothstep(9.,20.,groundY);
      if(grass>.015) {GroundSurface meadow=${sample(1,.88,.72)};meadow.color*=vec3(.80,.91,.65);ground=groundMix(ground,meadow,grass);}
      float snowHeight=groundY+(groundPatch-.5)*85.+groundN.z*18.;
      float snow=smoothstep(133.,218.,snowHeight)*smoothstep(.30,.73,groundN.y+(micro-.5)*.13);
      snow=max(snow,smoothstep(315.,410.,snowHeight)*smoothstep(.08,.42,groundN.y)*.72);
      if(snow>.015) {GroundSurface ice=${sample(2,1.55,.19)};ice.color=mix(ice.color,vec3(.88,.93,.98),.23);ice.roughness=mix(.62,.87,groundPatch);ground=groundMix(ground,ice,snow);}
      float wet=(1.-smoothstep(7.2,11.,groundY))*step(6.5,groundY);ground.color*=1.-wet*.2;ground.roughness=mix(ground.roughness,.36,wet*.75);
    `;
    if(biome==='desert') blend=/* glsl */`
      ground.color*=mix(vec3(1.04,.99,.90),vec3(1.08,.93,.77),groundPatch*.46);
      // Millimetre ripples fade by screen footprint, preventing distant moire.
      vec2 rippleUV=vGroundPosition.xz;
      float phase=rippleUV.x*2.8+rippleUV.y*1.25+sin(rippleUV.y*.27)*1.9+groundNoise(rippleUV*.055)*3.;
      float footprint=fwidth(phase);
      float detailFade=(1.-smoothstep(.7,2.8,footprint))*(1.-smoothstep(110.,390.,distance(cameraPosition,vGroundPosition)));
      ground.color*=1.+sin(phase)*.075*detailFade;
      ground.normal=normalize(ground.normal+vec3(-.13,0.,-.058)*cos(phase)*detailFade);
      ground.roughness=clamp(ground.roughness+.10,.78,1.);
    `;
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>\n${declarations}\n${surfaceGLSL}`)
      .replace('#include <map_fragment>',/* glsl */`
        vec3 groundN=normalize(vGroundNormal);
        vec3 groundW=pow(abs(groundN),vec3(4.));groundW/=dot(groundW,vec3(1.));
        float groundPatch=groundNoise(vGroundPosition.xz*.008)+groundNoise(vGroundPosition.xz*.029)*.24;
        groundPatch=clamp(groundPatch/1.24,0.,1.);
        float micro=groundNoise(vGroundPosition.xz*.13);
        vec3 groundP=vGroundPosition/${scale.toFixed(3)};
        float groundY=vGroundPosition.y;
        float groundSlope=1.-max(groundN.y,0.);
        float strata=pow(.5+.5*sin(groundY*.19+vGroundPosition.x*.011
          +groundNoise(vGroundPosition.xz*.016)*8.+groundNoise(vGroundPosition.xy*.07)*2.),10.);
        GroundSurface ground=${sample(0,1,biome==='desert'?.25:1)};
        ${blend}
        ground.color*=.92+groundPatch*.16;
        diffuseColor.rgb*=ground.color;
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor=clamp(ground.roughness*roughness,.12,1.);')
      .replace('#include <normal_fragment_maps>',/* glsl */`
        normal=normalize(mat3(viewMatrix)*ground.normal);
        #ifdef DOUBLE_SIDED
          normal*=faceDirection;
        #endif
      `);
  };
  material.customProgramCacheKey=()=>`earth-surface-v3-${biome}-${scale}-${strength}`;
  return material;
}

export function landscapeMaterial(options: SurfaceOptions) {
  return makeSurface(options.biome,options.tint??0xffffff,options.scale??24,options.normalStrength??.72);
}

/** World-space PBR detail for static or instanced boulders; no spherical UV seam. */
export function detailMaterial(kind: Ground, tint=0xffffff, scale=3) {
  return makeSurface(kind,tint,scale,.85);
}
