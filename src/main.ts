import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createMeadow } from './scenes/meadow';
import { createAlpine } from './scenes/alpine';
import { createDesert } from './scenes/desert';
import { createCoast } from './scenes/coast';
import { waitForTerrainTextures } from './scenes/nature';
import { Soundscape } from './audio';
import './style.css';

const icon = (path: string) => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${path}"/></svg>`;
const icons = {
  arrow: icon('M4 12h15m-6-6 6 6-6 6'), sound: icon('m10 5-5 4H2v6h3l5 4V5Zm5 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14'),
  muted: icon('m10 5-5 4H2v6h3l5 4V5Zm5 4 6 6m0-6-6 6'), full:icon('M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5'),
  reset:icon('M4 10a8 8 0 1 1 1 7M4 4v6h6'), pause:icon('M9 5v14M15 5v14'), play:icon('m8 5 11 7-11 7V5Z'),
  eye:icon('M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0'),
  camera:icon('M4 6h4l2-3h4l2 3h4v14H4V6Zm12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0'),
  close:icon('m6 6 12 12M18 6 6 18'), pin:icon('M12 21s7-8 7-13A7 7 0 0 0 5 8c0 5 7 13 7 13Zm2-13a2 2 0 1 1-4 0 2 2 0 0 1 4 0'),
};
const scenes = [
  {id:'coast', title:'Lofoten Coast', line:'Lofoten<br>Coast.', zh:'罗弗敦海岸', country:'挪威 · 豪克兰湾', biome:'北极圈海岸', code:'NO', region:'NORWEGIAN SEA', coords:'68°12′ N / 13°32′ E', elevation:'潮汐与群山之间', time:'15:06', description:'海水推向白沙，浪花沿岸线慢慢展开。\n让目光越过海面，去往挪威海的深蓝。', label:'HAUKLAND BEACH · NORWAY', create:createCoast},
  {id:'meadow', title:'Faroe Islands', line:'Faroe<br>Islands.', zh:'法罗群岛', country:'丹麦 · 北大西洋', biome:'北欧草甸', code:'FO', region:'NORTH ATLANTIC', coords:'62°05′ N / 06°55′ W', elevation:'海风与草甸', time:'16:24', description:'越过起伏的草甸，海风抵达山谷。\n在北大西洋的边缘，留一段时间给旷野。', label:'GÁSADALUR · FAROE ISLANDS', create:createMeadow},
  {id:'alpine', title:'The Swiss Alps', line:'The Swiss<br>Alps.', zh:'阿尔卑斯山', country:'瑞士 · 采尔马特', biome:'冰川山地', code:'CH', region:'CENTRAL EUROPE', coords:'45°58′ N / 07°39′ E', elevation:'雪线之上', time:'10:18', description:'岩壁向天空生长，积雪沿着山脊留下。\n湖面映着阿尔卑斯山，也映着此刻的安静。', label:'MATTERHORN REGION · SWITZERLAND', create:createAlpine},
  {id:'desert', title:'The Sahara', line:'The<br>Sahara.', zh:'撒哈拉沙漠', country:'摩洛哥 · 梅尔祖卡', biome:'风成沙丘', code:'MA', region:'NORTH AFRICA', coords:'31°06′ N / 04°01′ W', elevation:'风留下的曲线', time:'17:48', description:'沙丘随光线显露纹理，脊线向远方延伸。\n在撒哈拉，没有两阵完全相同的风。', label:'ERG CHEBBI · MOROCCO', create:createDesert},
];
const $ = <T extends HTMLElement = HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
$('#app').innerHTML = `
  <div id="viewport" aria-label="可拖动观察和缩放的真实地貌灵感三维风景"></div>
  <div class="cinema-shade" aria-hidden="true"></div>
  <header class="header chrome"><a class="brand" href="./" aria-label="栖游首页">roam<span class="brand-dot">.</span><span class="brand-cn">栖游</span></a><nav aria-label="主导航"><span class="nav-current">地球漫游计划 <sup>VOL. 02</sup></span><button id="journal-open">旅行手记 <span id="journal-badge">00</span></button><button id="about-open">关于旅途</button></nav><div class="header-tools"><button class="icon-button" id="sound" aria-label="开启环境音" aria-pressed="false" title="开启环境音">${icons.muted}</button><button class="icon-button fullscreen" id="fullscreen" aria-label="全屏浏览" title="全屏浏览">${icons.full}</button></div></header>
  <main>
    <div class="location-meta chrome"><span class="location-cross">+</span><div><span id="region">${scenes[0].region}</span><span id="coordinates">${scenes[0].coords}</span></div><span class="live-scene">3D EXPLORATION</span></div>
    <section class="hero chrome" aria-labelledby="hero-title"><div class="eyebrow"><span id="world-number">01</span><span class="eyebrow-line"></span><span id="hero-place">${scenes[0].country}</span></div><h1 id="hero-title">${scenes[0].line}</h1><div class="hero-subtitle"><h2 id="hero-zh">${scenes[0].zh}</h2><span>/</span><span id="hero-biome">${scenes[0].biome}</span></div><p id="hero-description">${scenes[0].description.replace('\n','<br>')}</p><button id="start" class="explore-button"><span>探索这片风景</span>${icons.arrow}</button></section>
    <aside class="field-notes chrome"><span class="field-kicker">FIELD NOTES — <span id="field-code">${scenes[0].code}</span></span><h3 id="field-title">${scenes[0].elevation}</h3><div class="field-divider"></div><div class="field-row"><span>风景印记</span><span id="collection-count">00 / 03</span></div><p id="collection-hint">进入探索，发现三处观察点。</p><button id="view-toggle" class="text-button">${icons.eye} 纯净视野 <span>↗</span></button></aside>
    <div id="markers" aria-label="风景观察点"></div>
    <div class="scene-tools chrome"><span class="interaction-hint">拖动观察 · 滚轮缩放</span><span class="tools-separator"></span><button class="icon-button" id="drift" aria-label="开启镜头巡游" aria-pressed="false" title="镜头巡游">${icons.play}</button><button class="icon-button" id="motion" aria-label="暂停自然动态" aria-pressed="true" title="暂停自然动态">${icons.pause}</button><button class="icon-button" id="reset" aria-label="重置视角" title="重置视角">${icons.reset}</button><button class="icon-button" id="capture" aria-label="保存风景照片" title="保存风景照片">${icons.camera}</button></div>
    <section class="destinations chrome" aria-label="选择目的地"><div class="destinations-label"><span>CHOOSE YOUR<br>HORIZON</span><span>04 DESTINATIONS</span></div><div class="destination-list" role="group" aria-label="目的地">${scenes.map((s,i)=>`<button class="destination ${i===0?'selected':''}" data-scene="${i}" aria-pressed="${i===0}"><span class="destination-number">0${i+1}</span><span class="destination-copy"><strong>${s.zh}</strong><span>${s.title.toUpperCase()}</span></span><span class="destination-check" id="progress-${i}"></span><span class="destination-arrow">↗</span></button>`).join('')}</div></section>
  </main>
  <footer class="chrome"><span>REAL PLACES. UNHURRIED MOMENTS.</span><span id="location-label">${scenes[0].label}</span><button id="help-open">操作指南 <span>↗</span></button></footer>
  <button id="clean-exit" class="clean-exit" aria-hidden="true">${icons.eye} 返回界面</button>
  <div class="scene-fade" id="scene-fade" aria-hidden="true"></div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <div class="loading" id="loading"><span class="loading-brand">roam.</span><div class="loading-line"><span></span></div><p id="loading-status">正在抵达，世界的另一面。</p><small>FOUR PLACES. ONE PLANET.</small></div>
  <dialog id="journal" aria-labelledby="journal-title"><button class="dialog-close icon-button" aria-label="关闭旅行手记">${icons.close}</button><span class="section-kicker">YOUR FIELD JOURNAL</span><h2 id="journal-title">把远方，留在手记里。</h2><p class="journal-summary"><span id="journal-total">0</span> / 12 处风景印记</p><div id="journal-content"></div><p class="dialog-footnote">记录保存在此浏览器。无需账号，随时回来。</p><button class="text-button" id="reset-progress">重新探索</button></dialog>
  <dialog id="help" aria-labelledby="help-title"><button class="dialog-close icon-button" aria-label="关闭操作指南">${icons.close}</button><span class="section-kicker">A SLOWER WAY TO SEE</span><h2 id="help-title">给风景，多一点时间。</h2><div class="help-steps"><p><b>01</b><span><strong>选择一处远方</strong>下方切换四个目的地，键盘 1–4 也可以。</span></p><p><b>02</b><span><strong>换一个观察角度</strong>拖动观察、滚轮缩放，手机单指拖动、双指缩放。相机限制在安全的观景区域。</span></p><p><b>03</b><span><strong>留下风景印记</strong>点击「探索这片风景」后，寻找画面里的编号观察点。每个目的地有 3 处。</span></p><p><b>04</b><span><strong>只看山海</strong>开启纯净视野，或点击相机按钮保存当前画面。自然动态和镜头巡游可分别暂停。</span></p></div><p class="dialog-footnote">空格：镜头巡游 · Esc：退出纯净视野<br>环境音默认关闭，右上角可开启。</p><button class="solid-button" id="help-done">出发 ${icons.arrow}</button></dialog>
  <dialog id="about" aria-labelledby="about-title"><button class="dialog-close icon-button" aria-label="关闭关于旅途">${icons.close}</button><span class="section-kicker">ROAM / THE EARTH COLLECTION</span><h2 id="about-title">从真实的地方，<br>开始一场漫游。</h2><p class="about-copy">北大西洋的草甸、阿尔卑斯的雪峰、撒哈拉的沙丘，以及挪威海的浪。四处自然风景，是这次旅途的起点。</p><p class="about-copy">这些三维场景参考当地地貌进行创作，坐标指向灵感地点，不是当地精确测绘或实时天气。地表与天空使用 Poly Haven 的 CC0 实景素材。</p><a class="credit-link" href="https://polyhaven.com" target="_blank" rel="noreferrer">素材鸣谢 · Poly Haven ↗</a></dialog>
`;
document.body.dataset.scene=scenes[0].id;
let toastTimer=0;
function toast(message:string){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('#toast').classList.remove('visible'),3800);}
const collected=new Set<string>();
try{const saved:unknown=JSON.parse(localStorage.getItem('roam-earth-journal-v2')||'[]');if(Array.isArray(saved))saved.forEach(v=>{if(typeof v==='string'&&/^(meadow|alpine|desert|coast)-[0-2]$/.test(v))collected.add(v);});}catch{/* Browser storage is optional. */}
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const sound=new Soundscape();
let activeIndex=0,exploring=false,naturalMotion=true,drifting=false,clean=false;
function showDialog(selector:string){$(selector).classList.remove('closing');$<HTMLDialogElement>(selector).showModal();}
for(const dialog of document.querySelectorAll<HTMLDialogElement>('dialog')){
  dialog.querySelector('.dialog-close')!.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
}
$('#journal-open').addEventListener('click',()=>showDialog('#journal'));
$('#help-open').addEventListener('click',()=>showDialog('#help'));
$('#about-open').addEventListener('click',()=>showDialog('#about'));
$('#sound').addEventListener('click',async()=>{try{const enabled=await sound.toggle();$('#sound').innerHTML=enabled?icons.sound:icons.muted;$('#sound').setAttribute('aria-pressed',String(enabled));$('#sound').setAttribute('aria-label',enabled?'关闭环境音':'开启环境音');$('#sound').title=enabled?'关闭环境音':'开启环境音';toast(enabled?'环境音已开启。':'环境音已关闭。');}catch{toast('此浏览器暂不支持环境音。');}});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器暂不支持全屏。');}});
function setClean(value:boolean){clean=value;$('#markers').inert=value||!exploring;document.body.classList.toggle('clean-view',value);for(const item of document.querySelectorAll<HTMLElement>('.chrome'))item.inert=value;$('#clean-exit').tabIndex=value?0:-1;if(value){$('#clean-exit').removeAttribute('aria-hidden');$('#clean-exit').focus();}else{$('#view-toggle').focus();$('#clean-exit').setAttribute('aria-hidden','true');}}
$('#view-toggle').addEventListener('click',()=>setClean(true));$('#clean-exit').addEventListener('click',()=>setClean(false));$('#clean-exit').tabIndex=-1;

async function boot(){
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<760?1.5:1.75));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.domElement.setAttribute('aria-label','三维实景风景，可拖动观察和缩放');
  $('#viewport').appendChild(renderer.domElement);
  const world=new THREE.Scene();
  world.background=new THREE.Color(0xa8bbc4);
  const camera=new THREE.PerspectiveCamera(54,1,0.8,6500);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.rotateSpeed=.3;controls.zoomSpeed=.55;
  const hemi=new THREE.HemisphereLight(0xc2d7e4,0x615b45,.8);world.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff3de,2.8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-450,right:450,top:450,bottom:-450,near:1,far:2100});sun.shadow.normalBias=.45;sun.shadow.bias=-.00015;world.add(sun);world.add(sun.target);
  $('#loading-status').textContent='正在展开山脊、海岸和地平线。';
  const landscapes=scenes.map(s=>s.create());
  world.add(landscapes[0].group);
  let sky:THREE.DataTexture|undefined;
  try{
    sky=await new HDRLoader().loadAsync(new URL('textures/sky.hdr',document.baseURI).href);
    sky.mapping=THREE.EquirectangularReflectionMapping;
    const pmrem=new THREE.PMREMGenerator(renderer);const environment=pmrem.fromEquirectangular(sky);
    world.environment=environment.texture;world.environmentIntensity=.52;world.background=sky;world.backgroundIntensity=.75;world.backgroundBlurriness=.02;pmrem.dispose();
  }catch{toast('天空素材未载入，已使用基础天空。');}
  const failed=await waitForTerrainTextures();if(failed.length)toast('部分地表素材未载入，可刷新页面重试。');
  let elapsed=0,realElapsed=0,lastProjection=0;
  const initialCamera=new THREE.Vector3(),baseOffset=new THREE.Vector3(),projected=new THREE.Vector3();
  const raycaster=new THREE.Raycaster();const direction=new THREE.Vector3();
  const markerPositions:THREE.Vector3[]=[];
  let visibility=[true,true,true];
  const occluders:THREE.Object3D[][]=landscapes.map(landscape=>{const list:THREE.Object3D[]=[];landscape.group.traverse(object=>{if(object instanceof THREE.Mesh&&!object.userData.noOcclusion&&!(object as unknown as {isWater?:boolean}).isWater&&!(object instanceof THREE.InstancedMesh))list.push(object);});return list;});
  function setDrift(value:boolean){drifting=value;$('#drift').innerHTML=value?icons.pause:icons.play;$('#drift').setAttribute('aria-pressed',String(value));$('#drift').setAttribute('aria-label',value?'暂停镜头巡游':'开启镜头巡游');if(value)baseOffset.copy(camera.position).sub(controls.target);}
  controls.addEventListener('start',()=>setDrift(false));
  function applyView(){
    const l=landscapes[activeIndex],view=l.view!;
    controls.target.copy(view.target);initialCamera.copy(view.position);camera.position.copy(view.position);
    const spherical=new THREE.Spherical().setFromVector3(view.position.clone().sub(view.target));
    controls.minDistance=view.minDistance??spherical.radius*.82;controls.maxDistance=view.maxDistance??spherical.radius*1.22;
    controls.minPolarAngle=Math.max(.1,spherical.phi-(view.polarRange??.06));controls.maxPolarAngle=Math.min(Math.PI-.1,spherical.phi+(view.polarRange??.035));
    controls.minAzimuthAngle=spherical.theta-(view.azimuthRange??.36);controls.maxAzimuthAngle=spherical.theta+(view.azimuthRange??.36);
    controls.update();baseOffset.copy(camera.position).sub(controls.target);
    const a=l.atmosphere!;world.fog=new THREE.FogExp2(a.fogColor,a.fogDensity);sun.position.copy(a.sunPosition);sun.color.set(a.sunColor??0xfff3de);sun.intensity=a.sunIntensity??2.6;
    sun.target.position.copy(view.target);renderer.toneMappingExposure=a.exposure??.86;world.backgroundRotation.y=a.skyRotation??0;world.environmentRotation.y=a.skyRotation??0;
    for(const object of l.group.children){if((object as unknown as {isWater?:boolean}).isWater){const w=object as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;w.material.uniforms.sunDirection.value.copy(a.sunPosition).normalize();w.material.uniforms.sunColor.value.copy(sun.color);}}
    resize();
  }
  function updateJournal(){
    scenes.forEach((scene,i)=>{const count=[...collected].filter(k=>k.startsWith(`${scene.id}-`)).length;$(`#progress-${i}`).textContent=count===3?'✓':'';});
    const count=[...collected].filter(k=>k.startsWith(`${scenes[activeIndex].id}-`)).length;
    $('#collection-count').textContent=`0${count} / 03`;
    $('#collection-hint').textContent=count===3?'这一片远方，已写入旅行手记。':exploring?'点击画面里的编号，记录观察点。':'进入探索，发现三处观察点。';
    $('#journal-total').textContent=String(collected.size);$('#journal-badge').textContent=String(collected.size).padStart(2,'0');
    $('#journal-content').innerHTML=scenes.map((scene,i)=>`<section class="journal-scene"><h3><span>0${i+1}</span>${scene.zh}<small>${scene.title}</small></h3>${landscapes[i].collectibles.map((spot,j)=>`<div class="journal-entry ${collected.has(`${scene.id}-${j}`)?'found':''}"><span>${collected.has(`${scene.id}-${j}`)?'✓':'—'}</span><p><strong>${collected.has(`${scene.id}-${j}`)?spot.name:'尚未抵达的观察点'}</strong><small>${collected.has(`${scene.id}-${j}`)?spot.message:'在这片风景里，寻找属于你的视角。'}</small></p></div>`).join('')}</section>`).join('');
  }
  function collect(index:number){
    const key=`${scenes[activeIndex].id}-${index}`;if(collected.has(key))return;
    collected.add(key);try{localStorage.setItem('roam-earth-journal-v2',JSON.stringify([...collected]));}catch{/* Optional storage. */}
    const button=$<HTMLButtonElement>(`#fragment-${index}`);button.classList.add('collected');button.disabled=true;sound.chime(index);
    updateJournal();const spot=landscapes[activeIndex].collectibles[index];toast(collected.size===12?'四处远方，十二个瞬间。此行已完整收藏。':`已记录 · ${spot.name}`);
    if(document.activeElement===button)$('#journal-open').focus();
  }
  function createMarkers(){
    visibility=[true,true,true];lastProjection=-1;markerPositions.length=0;
    $('#markers').inert=!exploring||clean;
    $('#markers').innerHTML=landscapes[activeIndex].collectibles.map((spot,i)=>`<button id="fragment-${i}" class="fragment ${collected.has(`${scenes[activeIndex].id}-${i}`)?'collected':''}" ${collected.has(`${scenes[activeIndex].id}-${i}`)?'disabled':''} aria-label="记录${spot.name}"><span class="fragment-number">0${i+1}</span><span class="fragment-title">${spot.name}</span><span class="fragment-plus">+</span></button>`).join('');
    landscapes[activeIndex].collectibles.forEach((spot,i)=>{markerPositions.push(spot.position.clone());$(`#fragment-${i}`).addEventListener('click',()=>collect(i));});
  }
  function startExploring(){exploring=true;$('#markers').inert=false;document.body.classList.add('exploring');$('#start').innerHTML=`<span>查看旅行手记</span>${icons.arrow}`;updateJournal();toast('观察画面里的 01、02、03，留下你的风景印记。');}
  let switching=false;
  async function setScene(index:number){
    if(index===activeIndex||switching)return;switching=true;setDrift(false);
    $('#scene-fade').classList.add('active');if(!reducedMotion)await new Promise(resolve=>setTimeout(resolve,240));
    world.remove(landscapes[activeIndex].group);activeIndex=index;world.add(landscapes[index].group);
    const scene=scenes[index];document.body.dataset.scene=scene.id;
    $('#hero-title').innerHTML=scene.line;$('#hero-place').textContent=scene.country;$('#hero-zh').textContent=scene.zh;$('#hero-biome').textContent=scene.biome;
    $('#hero-description').innerHTML=scene.description.replace('\n','<br>');$('#world-number').textContent=`0${index+1}`;$('#region').textContent=scene.region;$('#coordinates').textContent=scene.coords;
    $('#field-code').textContent=scene.code;$('#field-title').textContent=scene.elevation;$('#location-label').textContent=scene.label;
    document.querySelectorAll<HTMLButtonElement>('.destination').forEach((button,i)=>{button.classList.toggle('selected',i===index);button.setAttribute('aria-pressed',String(i===index));});
    applyView();createMarkers();updateJournal();renderer.render(world,camera);$('#scene-fade').classList.remove('active');switching=false;
  }
  function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.fov=(landscapes[activeIndex].view?.fov??54)+(w<760?12:0);camera.clearViewOffset();camera.updateProjectionMatrix();$('.interaction-hint').textContent=w<760?'单指观察 · 双指缩放':'拖动观察 · 滚轮缩放';}
  window.addEventListener('resize',resize);
  $('#start').addEventListener('click',()=>exploring?showDialog('#journal'):startExploring());
  $('#help-done').addEventListener('click',()=>{$<HTMLDialogElement>('#help').close();startExploring();});
  document.querySelectorAll<HTMLButtonElement>('.destination').forEach(button=>button.addEventListener('click',()=>void setScene(Number(button.dataset.scene))));
  $('#drift').addEventListener('click',()=>setDrift(!drifting));
  $('#motion').addEventListener('click',()=>{naturalMotion=!naturalMotion;$('#motion').innerHTML=naturalMotion?icons.pause:icons.play;$('#motion').setAttribute('aria-pressed',String(naturalMotion));$('#motion').setAttribute('aria-label',naturalMotion?'暂停自然动态':'播放自然动态');$('#motion').title=naturalMotion?'暂停自然动态':'播放自然动态';toast(naturalMotion?'风与水，继续流动。':'自然动态已暂停。');});
  $('#reset').addEventListener('click',()=>{setDrift(false);applyView();toast('已回到初始观景位置。');});
  $('#capture').addEventListener('click',()=>{renderer.render(world,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download=`roam-${scenes[activeIndex].id}.png`;a.click();toast('当前风景已生成照片。');});
  let resetPending=false;
  $('#reset-progress').addEventListener('click',()=>{if(!resetPending){resetPending=true;$('#reset-progress').textContent='再次点击，清空全部印记';setTimeout(()=>{resetPending=false;$('#reset-progress').textContent='重新探索';},4000);return;}collected.clear();try{localStorage.removeItem('roam-earth-journal-v2');}catch{/* optional */}resetPending=false;$('#reset-progress').textContent='重新探索';createMarkers();updateJournal();toast('新的旅程，从此刻开始。');});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&clean){setClean(false);return;}const target=event.target as HTMLElement;if(document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(target.tagName)||target.isContentEditable||event.ctrlKey||event.altKey||event.metaKey)return;if(['1','2','3','4'].includes(event.key))void setScene(Number(event.key)-1);if(event.code==='Space'&&!/BUTTON|A/.test(target.tagName)){event.preventDefault();setDrift(!drifting);}});
  applyView();createMarkers();updateJournal();
  const clock=new THREE.Clock();
  let lastDraw=0;
  function frame(now=0){
    requestAnimationFrame(frame);if(document.hidden){clock.getDelta();return;}
    if(now-lastDraw<1000/30)return;lastDraw=now;
    const delta=Math.min(clock.getDelta(),.05);realElapsed+=delta;if(naturalMotion)elapsed+=delta;
    landscapes[activeIndex].update(elapsed,naturalMotion?delta:0);
    if(drifting&&!document.querySelector('dialog[open]'))camera.position.copy(baseOffset).applyAxisAngle(new THREE.Vector3(0,1,0),Math.sin(realElapsed*.085)*.13).add(controls.target);
    controls.update();
    const ground=landscapes[activeIndex].heightAt?.(camera.position.x,camera.position.z);
    if(ground!==undefined&&camera.position.y<Math.max(ground+4,4)){camera.position.y=Math.max(ground+4,4);camera.lookAt(controls.target);}
    renderer.render(world,camera);
    if(!exploring||clean)return;
    const checkOcclusion=realElapsed-lastProjection>.24;
    markerPositions.forEach((position,i)=>{
      const marker=$<HTMLButtonElement>(`#fragment-${i}`);if(marker.disabled)return;
      if(checkOcclusion){direction.copy(position).sub(camera.position);const distance=direction.length();raycaster.set(camera.position,direction.normalize());raycaster.far=distance-2;visibility[i]=raycaster.intersectObjects(occluders[activeIndex],false).length===0;}
      projected.copy(position).project(camera);const x=(projected.x*.5+.5)*innerWidth,y=(-projected.y*.5+.5)*innerHeight;
      marker.style.left=`${x}px`;marker.style.top=`${y}px`;
      const visible=visibility[i]&&projected.z<1&&projected.z>-1&&x>24&&x<innerWidth-30&&y>100&&y<innerHeight-(innerWidth<760?185:145);
      marker.classList.toggle('occluded',!visible);marker.setAttribute('aria-hidden',String(!visible));marker.tabIndex=visible?0:-1;
    });if(checkOcclusion)lastProjection=realElapsed;
  }
  frame();
  $('#loading').classList.add('loaded');setTimeout(()=>$('#loading').remove(),650);
}
boot().catch(error=>{console.error(error);$('#loading').innerHTML='<span class="loading-brand">roam.</span><h2>暂时未能展开这片风景</h2><p>请检查浏览器的 WebGL 2 与硬件加速是否开启。</p><button class="solid-button" id="retry">重新载入</button>';$('#retry').addEventListener('click',()=>location.reload());});
