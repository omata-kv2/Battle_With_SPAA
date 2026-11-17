import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
const $=s=>document.querySelector(s), canvas=$('#scene');
let renderer,scene,camera,enemyTemplate=null,initialized=false,running=false;
let wave=1,peace=100,spawned=0,spawnClock=0,waveWait=0,cleared=0;
const enemies=[],shots=[],sparks=[],keys={},moveState={forward:false,back:false,left:false,right:false};
let yaw=0,pitch=-.08,playerX=0,playerZ=5,touchLook=null,mouseLook=false,lastX=0,lastY=0;
const counts=[12,18,24,30,36],speeds=[.055,.065,.075,.085,.095];
function progress(v,msg){$('#loadFill').style.width=v+'%';$('#loadText').textContent=msg+' '+Math.round(v)+'%'}
function loadGLB(){
 return new Promise(resolve=>{
  new GLTFLoader().load('./assets/enemy_shell.glb',g=>{enemyTemplate=g.scene;resolve(true)},undefined,()=>resolve(false));
 });
}
async function initialize(){
 if(initialized)return;
 try{
  progress(8,'3Dエンジン初期化');
  renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power',alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.35));
  renderer.setSize(innerWidth,innerHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x80c5e1);scene.fog=new THREE.Fog(0x80c5e1,40,95);
  camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,120);
  scene.add(new THREE.HemisphereLight(0xdaf5ff,0x33495b,1.7));
  const sun=new THREE.DirectionalLight(0xffffff,1.5);sun.position.set(-4,10,7);scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshStandardMaterial({color:0x536d60,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-2;scene.add(ground);
  const far=new THREE.Mesh(new THREE.CircleGeometry(38,32),new THREE.MeshBasicMaterial({color:0x7599a6,transparent:true,opacity:.35}));
  far.rotation.x=-Math.PI/2;far.position.set(0,-1.95,-35);scene.add(far);
  // Abstract, non-realistic energy console in the lower foreground.
  const consoleGroup=new THREE.Group();
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(.8,1,.35,10),new THREE.MeshStandardMaterial({color:0x253d4a,metalness:.5,roughness:.5}));
  plinth.position.y=-1.55;consoleGroup.add(plinth);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.55,.07,6,20),new THREE.MeshBasicMaterial({color:0x55dcff}));
  halo.rotation.x=Math.PI/2;halo.position.y=-1.28;consoleGroup.add(halo);scene.add(consoleGroup);
  progress(35,'敵モデル読み込み');
  await loadGLB();
  progress(75,'ステージ準備');
  initialized=true;
  progress(100,'準備完了');
  setTimeout(()=>{if(window.__spaaStartRequested)startGame()},250);
  animate();
 }catch(err){
  console.error(err);$('#loadText').textContent='読み込み失敗：ページを再読み込みしてください';
  $('#start').disabled=false;$('#start').textContent='RETRY';window.__spaaStartRequested=false;
 }
}
window.addEventListener('spaa-start-request',initialize);
function startGame(){
 if(!initialized||running)return;
 $('#overlay').classList.remove('visible');running=true;wave=1;peace=100;cleared=0;playerX=0;playerZ=5;
 for(const e of enemies)scene.remove(e);enemies.length=0;
 startWave();hud();
}
function startWave(){spawned=0;spawnClock=0;waveWait=0;$('#announce').textContent=`WAVE ${wave} — INCOMING`}
function hud(){$('#wave').textContent=`${wave} / 5`,$('#remaining').textContent=enemies.length+counts[wave-1]-spawned,$('#peace').textContent=Math.round(peace)+'%'}
function makeEnemy(){
 let o;
 if(enemyTemplate){o=enemyTemplate.clone(true);o.scale.setScalar(.34);o.rotation.y=Math.PI/2}
 else{
  o=new THREE.Group();
  const m=new THREE.Mesh(new THREE.CapsuleGeometry(.24,.95,3,8),new THREE.MeshStandardMaterial({color:0xaebdc7,metalness:.45}));
  m.rotation.x=Math.PI/2;o.add(m);
 }
 o.position.set((Math.random()-.5)*24,3+Math.random()*9,-(22+Math.random()*22));
 o.userData.speed=speeds[wave-1]*(.7+Math.random()*.6);o.userData.phase=Math.random()*6;
 scene.add(o);enemies.push(o);
}
function shoot(){
 if(!running)return;
 const dir=new THREE.Vector3();camera.getWorldDirection(dir);
 const origin=camera.position.clone();
 const ray=new THREE.Raycaster(origin,dir,0,75);
 let hit=null,dist=Infinity;
 for(const e of enemies){const box=new THREE.Box3().setFromObject(e);const p=new THREE.Vector3();box.getCenter(p);const d=ray.ray.distanceToPoint(p);if(d<2.8&&origin.distanceTo(p)<dist){hit=e;dist=origin.distanceTo(p)}}
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.07,1,6),new THREE.MeshBasicMaterial({color:0x8beeff}));
 const end=hit?hit.position.clone():origin.clone().add(dir.multiplyScalar(32));
 const start=origin.clone();beam.position.copy(start).add(end).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize());beam.scale.y=start.distanceTo(end);scene.add(beam);shots.push({mesh:beam,life:8});
 if(hit){burst(hit.position);scene.remove(hit);enemies.splice(enemies.indexOf(hit),1);cleared++}
}
function burst(pos){for(let i=0;i<7;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.09,6,5),new THREE.MeshBasicMaterial({color:i%2?0x78e7ff:0xffffff}));m.position.copy(pos);scene.add(m);sparks.push({mesh:m,v:new THREE.Vector3((Math.random()-.5)*.15,Math.random()*.12,(Math.random()-.5)*.15),life:22})}}
$('#fire').addEventListener('pointerdown',e=>{e.preventDefault();shoot()});
canvas.addEventListener('pointerdown',e=>{
 if(!running)return;
 if(e.pointerType==='mouse'){mouseLook=true;lastX=e.clientX;lastY=e.clientY}
 else if(e.clientX<innerWidth*.67){touchLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)}
});
canvas.addEventListener('pointermove',e=>{
 if(!running)return;
 if(e.pointerType==='mouse'&&mouseLook){const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;look(dx,dy)}
 else if(touchLook&&e.pointerId===touchLook.id){look(e.clientX-touchLook.x,e.clientY-touchLook.y);touchLook.x=e.clientX;touchLook.y=e.clientY}
});
function stopLook(){mouseLook=false;touchLook=null}
canvas.addEventListener('pointerup',stopLook);canvas.addEventListener('pointercancel',stopLook);
function look(dx,dy){yaw-=dx*.0032;pitch-=dy*.0027;pitch=Math.max(-.8,Math.min(.65,pitch))}
document.querySelectorAll('[data-move]').forEach(b=>{
 const k=b.dataset.move;
 const on=e=>{e.preventDefault();moveState[k]=true};const off=e=>{e.preventDefault();moveState[k]=false};
 b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off);
});
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'){e.preventDefault();shoot()}});
addEventListener('keyup',e=>keys[e.code]=false);
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
addEventListener('resize',resize);
function finish(win){
 running=false;$('#overlay').classList.add('visible');$('#loadArea').classList.add('hidden');
 $('.eyebrow').textContent=win?'WORLD PEACE RESTORED':'DEFENSE SYSTEM OFFLINE';
 $('h1').innerHTML=win?'MISSION<br>COMPLETE':'MISSION<br>FAILED';
 $('#overlayText').textContent=win?'全5ウェーブを突破。世界平和は守られた。':'世界平和ゲージが尽きた。再挑戦しよう。';
 $('#start').disabled=false;$('#start').textContent='PLAY AGAIN';$('#start').onclick=()=>{window.__spaaStartRequested=false;$('#start').onclick=null;$('#start').disabled=false;$('#start').textContent='START DEFENSE';window.__spaaStartRequested=true;startGame()};
}
function animate(){
 requestAnimationFrame(animate);if(!renderer)return;
 if(running){
  const forward=(keys.KeyW||keys.ArrowUp||moveState.forward?1:0)-(keys.KeyS||keys.ArrowDown||moveState.back?1:0);
  const side=(keys.KeyD||keys.ArrowRight||moveState.right?1:0)-(keys.KeyA||keys.ArrowLeft||moveState.left?1:0);
  const speed=.19,fx=-Math.sin(yaw),fz=-Math.cos(yaw);
  playerX+=(side*Math.cos(yaw)+forward*fx)*speed;playerZ+=(side*Math.sin(yaw)+forward*fz)*speed;
  playerX=THREE.MathUtils.clamp(playerX,-12,12);playerZ=THREE.MathUtils.clamp(playerZ,-1,12);
  camera.position.set(playerX,1.25,playerZ);
  camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
  spawnClock++;if(spawned<counts[wave-1]&&spawnClock>Math.max(13,40-wave*4)){makeEnemy();spawned++;spawnClock=0}
  for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];e.position.z+=e.userData.speed;e.position.x+=Math.sin(performance.now()*.0007+e.userData.phase)*.012;e.rotation.z+=.0015;if(e.position.z>playerZ+5){scene.remove(e);enemies.splice(i,1);peace-=wave<3?5:7}}
  if(peace<=0){peace=0;hud();finish(false)}
  if(spawned===counts[wave-1]&&enemies.length===0){waveWait++;$('#announce').textContent=wave===5?'ALL WAVES CLEARED':'WAVE CLEARED';if(waveWait>85){if(wave===5)finish(true);else{wave++;startWave()}}}
  hud();
 }
 for(let i=shots.length-1;i>=0;i--){if(--shots[i].life<=0){scene.remove(shots[i].mesh);shots.splice(i,1)}}
 for(let i=sparks.length-1;i>=0;i--){const s=sparks[i];s.mesh.position.add(s.v);s.mesh.scale.multiplyScalar(.96);if(--s.life<=0){scene.remove(s.mesh);sparks.splice(i,1)}}
 renderer.render(scene,camera);
}
