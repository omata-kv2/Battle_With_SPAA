import * as T from './libs/three.module.js';
import {GLTFLoader} from './libs/examples/jsm/loaders/GLTFLoader.js';
import {CONFIG} from './config.js';
import {$,progress,loading,loadError,hideMenu,hud,announce,endScreen} from './ui.js';
import {buildStage,makeTarget,spawn,prepareModel} from './stage-builder.js';
let renderer,scene,camera,target,ready=false,playing=false,loop=false;
const modelTemplates={missile:null,fighter:null};
const enemies=[],fx=[],keys={},move={x:0,y:0};
let wave=1,peace=100,spawned=0,tick=0,wait=0,score=0,yaw=0,pitch=-.08,x=0,z=5,mouse=false,lastX=0,lastY=0,touch=null;
async function init(){if(ready){startGame();return}loading();$('#start').disabled=true;try{
  progress(8,'ローカルThree.jsを確認');
  renderer=new T.WebGLRenderer({canvas:$('#scene'),antialias:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,CONFIG.MAX_PIXEL_RATIO));renderer.setSize(innerWidth,innerHeight,false);renderer.outputColorSpace=T.SRGBColorSpace;
  scene=new T.Scene();camera=new T.PerspectiveCamera(70,innerWidth/innerHeight,.1,120);buildStage(T,scene);target=makeTarget(T);
  progress(28,'3Dモデルを読み込み');
  const loader=new GLTFLoader();
  const loadOne=async(path,label)=>{try{const gltf=await loader.loadAsync(path);return gltf.scene;}catch(err){console.warn(label+' GLBを読み込めません。簡易モデルを使用します。',err);return null;}};
  const [missile,fighter]=await Promise.all([loadOne('assets/Kh-35.glb','飛来物'),loadOne('assets/SU-27.glb','戦闘機')]);
  if(missile)modelTemplates.missile=prepareModel(T,missile,.95)
  if(fighter)modelTemplates.fighter=prepareModel(T,fighter,1.8)
  progress(82,'ステージを準備');requestAnimationFrame(()=>{progress(100,'準備完了');ready=true;$('#start').disabled=false;if(!loop){loop=true;animate()}setTimeout(startGame,250)});
}catch(e){console.error(e);loadError(e?.message||'WebGLを初期化できませんでした')}}
function startGame(){if(!ready)return;for(const e of enemies)scene.remove(e);enemies.length=0;for(const a of fx)scene.remove(a.m);fx.length=0;wave=1;peace=100;spawned=0;tick=0;wait=0;score=0;x=0;z=5;yaw=0;pitch=-.08;playing=true;hideMenu();beginWave();update()}
function beginWave(){spawned=0;tick=0;wait=0;announce(`WAVE ${wave} — INCOMING`)}
function waveTotal(){return CONFIG.COUNTS[wave-1]+(wave===2?1:(wave===5?2:0))}
function update(){hud(wave,Math.max(0,enemies.length+waveTotal()-spawned),peace)}
function shoot(){if(!playing)return;const d=new T.Vector3();camera.getWorldDirection(d);const ray=new T.Raycaster(camera.position.clone(),d,0,85);let hit=null,best=Infinity;for(const e of enemies){const c=new T.Vector3();new T.Box3().setFromObject(e).getCenter(c);const dist=ray.ray.distanceToPoint(c),along=camera.position.distanceTo(c);if(dist<2.7&&along<best){hit=e;best=along}}
  const a=camera.position.clone(),b=hit?hit.position.clone():a.clone().add(d.multiplyScalar(30));const beam=new T.Mesh(new T.CylinderGeometry(.035,.07,1,6),new T.MeshBasicMaterial({color:0x8beeff}));beam.position.copy(a).add(b).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());beam.scale.y=a.distanceTo(b);scene.add(beam);fx.push({m:beam,life:8});if(hit){burst(hit.position);scene.remove(hit);enemies.splice(enemies.indexOf(hit),1);score++}}
function burst(p){for(let i=0;i<6;i++){const m=new T.Mesh(new T.SphereGeometry(.09,6,5),new T.MeshBasicMaterial({color:i%2?0x78e7ff:0xffffff}));m.position.copy(p);scene.add(m);fx.push({m,life:20,v:new T.Vector3((Math.random()-.5)*.15,Math.random()*.12,(Math.random()-.5)*.15)})}}
function finish(win){playing=false;endScreen(win,score)}
function look(dx,dy){yaw-=dx*.0032;pitch=T.MathUtils.clamp(pitch-dy*.0027,-Math.PI/2,Math.PI/2)}
function controls(){const c=$('#scene');$('#start').addEventListener('click',init);$('#fire').addEventListener('pointerdown',e=>{e.preventDefault();shoot()});
  let lookPointer=null,lastX=0,lastY=0; c.addEventListener('pointerdown',e=>{if(!playing)return;if(e.pointerType==='mouse'){lookPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;c.setPointerCapture(e.pointerId)}else if(e.clientX>innerWidth*.38 && e.target!==$('#fire')){lookPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;c.setPointerCapture(e.pointerId)}});
  c.addEventListener('pointermove',e=>{if(lookPointer===e.pointerId){look(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY}});const stopLook=e=>{if(lookPointer===e.pointerId)lookPointer=null};c.addEventListener('pointerup',stopLook);c.addEventListener('pointercancel',stopLook);
  const pad=$('#stick'),knob=$('#stickKnob');let stickId=null;function stickMove(e){const r=pad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,len=Math.hypot(dx,dy)||1,k=Math.min(1,max/len);move.x=dx/ max*k;move.y=dy/max*k;knob.style.transform=`translate(${move.x*max}px,${move.y*max}px)`}
  pad.addEventListener('pointerdown',e=>{e.preventDefault();stickId=e.pointerId;pad.setPointerCapture(e.pointerId);stickMove(e)});pad.addEventListener('pointermove',e=>{if(e.pointerId===stickId){e.preventDefault();stickMove(e)}});const resetStick=()=>{stickId=null;move.x=move.y=0;knob.style.transform='translate(0,0)'};pad.addEventListener('pointerup',resetStick);pad.addEventListener('pointercancel',resetStick);
  addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'){e.preventDefault();shoot()}});addEventListener('keyup',e=>keys[e.code]=false);addEventListener('blur',()=>{for(const k in keys)keys[k]=false;resetStick()});addEventListener('resize',()=>{if(renderer){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}});
  document.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('selectstart',e=>e.preventDefault());document.addEventListener('gesturestart',e=>e.preventDefault());document.addEventListener('touchmove',e=>{if(e.target!==pad)e.preventDefault()},{passive:false});
}
function animate(){requestAnimationFrame(animate);if(playing){const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-move.y,s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+move.x,sp=CONFIG.MOVE_SPEED;x+=(s*Math.cos(yaw)-f*Math.sin(yaw))*sp;z+=(s*Math.sin(yaw)-f*Math.cos(yaw))*sp;x=T.MathUtils.clamp(x,-12,12);z=T.MathUtils.clamp(z,-1,12);camera.position.set(x,1.25,z);camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;tick++;
  const fighterCount=wave===2?1:(wave===5?2:0),total=CONFIG.COUNTS[wave-1]+fighterCount;if(spawned<total&&tick>Math.max(13,40-wave*4)){if(enemies.length<CONFIG.MAX_ENEMIES){const isFighter=spawned>=CONFIG.COUNTS[wave-1];enemies.push(spawn(T,scene,target,wave,CONFIG,isFighter?'fighter':'missile',modelTemplates))}spawned++;tick=0}
  for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];e.position.z+=e.userData.speed;e.position.x+=Math.sin(performance.now()*.0007+e.userData.phase)*.012;e.rotation.z+=.0015;if(e.position.z>z+5){scene.remove(e);enemies.splice(i,1);peace-=wave<3?5:7}}
  if(peace<=0){peace=0;update();finish(false)}if(spawned===waveTotal()&&!enemies.length){wait++;announce(wave===5?'ALL WAVES CLEARED':'WAVE CLEARED');if(wait>85){if(wave===5)finish(true);else{wave++;beginWave()}}}update()}
  for(let i=fx.length-1;i>=0;i--){const a=fx[i];if(a.v)a.m.position.add(a.v);a.m.scale.multiplyScalar(.96);if(--a.life<=0){scene.remove(a.m);fx.splice(i,1)}}if(renderer&&scene&&camera)renderer.render(scene,camera)}
controls();
