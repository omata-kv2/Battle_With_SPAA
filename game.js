import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

const canvas=document.querySelector('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x83c9e8);
scene.fog=new THREE.Fog(0x83c9e8,35,100);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,180);
camera.position.set(0,3.4,10);
camera.lookAt(0,1.4,-8);

scene.add(new THREE.HemisphereLight(0xdaf5ff,0x34485b,2.0));
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-5,12,7);scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:0x526d62,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=-1.8;scene.add(floor);
const horizon=new THREE.Mesh(new THREE.CylinderGeometry(48,48,12,48,1,true),new THREE.MeshBasicMaterial({color:0x638a9c,side:THREE.BackSide,transparent:true,opacity:.35}));
horizon.position.y=4;scene.add(horizon);

// Abstract player station: a stationary, non-realistic energy projector.
const station=new THREE.Group();
const base=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.4,.55,12),new THREE.MeshStandardMaterial({color:0x263d4b,metalness:.65,roughness:.4}));
base.position.y=-1.45;station.add(base);
const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.09,8,32),new THREE.MeshStandardMaterial({color:0x51dfff,emissive:0x087a9c,emissiveIntensity:1.4}));
ring.rotation.x=Math.PI/2;ring.position.y=-1.12;station.add(ring);
const orb=new THREE.Mesh(new THREE.SphereGeometry(.34,24,16),new THREE.MeshStandardMaterial({color:0x9ceeff,emissive:0x1b9fca,emissiveIntensity:2}));
orb.position.y=-.88;station.add(orb);scene.add(station);

let enemyTemplate=null;
new GLTFLoader().load('./assets/enemy_shell.glb',g=>{
 enemyTemplate=g.scene;
 enemyTemplate.scale.setScalar(.48);
 enemyTemplate.rotation.z=Math.PI/2;
},undefined,()=>{});
const fallback=new THREE.Group();
const core=new THREE.Mesh(new THREE.CapsuleGeometry(.28,1.8,4,12),new THREE.MeshStandardMaterial({color:0xaab8c2,metalness:.65,roughness:.3}));
core.rotation.x=Math.PI/2;fallback.add(core);
const glow=new THREE.Mesh(new THREE.SphereGeometry(.34,16,12),new THREE.MeshBasicMaterial({color:0x7beaff}));
glow.position.z=-1;fallback.add(glow);

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const targets=[],pulses=[],particles=[];
let running=false,wave=1,peace=100,spawned=0,cleared=0,spawnTimer=0,wavePause=0;
const waveCounts=[12,18,24,30,36];
const waveSpeeds=[.045,.055,.065,.075,.09];
const $=s=>document.querySelector(s);
function updateHUD(){
 $('#wave').textContent=`${wave} / 5`;
 $('#remaining').textContent=targets.length+(waveCounts[wave-1]-spawned);
 $('#peace').textContent=Math.max(0,Math.round(peace))+'%';
}
function makeTarget(){
 const obj=enemyTemplate?enemyTemplate.clone(true):fallback.clone(true);
 obj.position.set((Math.random()-.5)*18,5+Math.random()*7,-(18+Math.random()*24));
 obj.rotation.set(Math.random()*.2,Math.random()*Math.PI*2,Math.random()*.2);
 obj.userData.speed=waveSpeeds[wave-1]*(.75+Math.random()*.5);
 obj.userData.wobble=Math.random()*6;
 obj.userData.age=0;
 scene.add(obj);targets.push(obj);
}
function burst(pos){
 const geo=new THREE.SphereGeometry(.11,8,6);
 for(let i=0;i<9;i++){
  const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:i%2?0x8deaff:0xffffff,transparent:true}));
  m.position.copy(pos);scene.add(m);
  particles.push({mesh:m,v:new THREE.Vector3((Math.random()-.5)*.18,Math.random()*.16,(Math.random()-.5)*.18),life:28});
 }
}
function pulseAt(x,y){
 const p=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),new THREE.MeshBasicMaterial({color:0x9ff3ff}));
 p.position.copy(station.position);p.position.y=-.7;
 const dest=new THREE.Vector3(x,y,-12);
 pulses.push({mesh:p,dest,life:14});scene.add(p);
 // Arcade interaction: the selected screen point clears nearby fictional targets.
 const ndc=new THREE.Vector2((x/innerWidth)*2-1,-(y/innerHeight)*2+1);
 raycaster.setFromCamera(ndc,camera);
 const candidates=targets.map(t=>({t,d:raycaster.ray.distanceToPoint(t.position)})).filter(v=>v.d<2.1).sort((a,b)=>a.d-b.d);
 if(candidates.length){
  const t=candidates[0].t;burst(t.position);
  scene.remove(t);targets.splice(targets.indexOf(t),1);cleared++;
 }
}
function pointerFire(e){
 if(!running)return;
 const rect=canvas.getBoundingClientRect();
 pulseAt(e.clientX-rect.left,e.clientY-rect.top);
}
canvas.addEventListener('pointerdown',pointerFire);
$('#fire').addEventListener('pointerdown',e=>{e.preventDefault();if(running)pulseAt(innerWidth*.5,innerHeight*.42)});
function beginWave(){
 spawned=0;spawnTimer=0;wavePause=0;
 $('#message').textContent=`WAVE ${wave} — INCOMING`;
}
function start(){
 $('#overlay').classList.remove('show');running=true;wave=1;peace=100;cleared=0;targets.splice(0).forEach(t=>scene.remove(t));beginWave();updateHUD();
}
$('#start').addEventListener('click',start);
function endGame(win){
 running=false;$('#overlay').classList.add('show');
 $('.eyebrow').textContent=win?'WORLD PEACE RESTORED':'DEFENSE SYSTEM OFFLINE';
 $('h1').innerHTML=win?'MISSION<br>COMPLETE':'MISSION<br>FAILED';
 $('p').textContent=win?'全5ウェーブを突破。世界平和は守られた。': '世界平和ゲージが尽きてしまった。もう一度挑戦しよう。';
 $('.small').textContent=`撃退したターゲット：${cleared}`;
 $('#start').textContent='PLAY AGAIN';
}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
addEventListener('resize',resize);
function animate(){
 requestAnimationFrame(animate);
 const dt=1;
 if(running){
  spawnTimer++;
  if(spawned<waveCounts[wave-1]&&spawnTimer>Math.max(12,42-wave*4)){makeTarget();spawned++;spawnTimer=0}
  for(let i=targets.length-1;i>=0;i--){
   const t=targets[i];t.position.z+=t.userData.speed*dt;t.position.y+=Math.sin((t.userData.age++*.035)+t.userData.wobble)*.009;
   t.rotation.z+=.002;
   if(t.position.z>8){scene.remove(t);targets.splice(i,1);peace-=wave<=2?5:7}
  }
  if(peace<=0){peace=0;updateHUD();endGame(false)}
  if(spawned===waveCounts[wave-1]&&targets.length===0){
   wavePause++;
   $('#message').textContent=wave===5?'ALL WAVES CLEARED':'WAVE CLEARED';
   if(wavePause>100){if(wave===5)endGame(true);else{wave++;beginWave()}}
  }
  updateHUD();
 }
 for(let i=pulses.length-1;i>=0;i--){const p=pulses[i];p.mesh.position.lerp(p.dest,.18);p.life--;if(p.life<=0){scene.remove(p.mesh);pulses.splice(i,1)}}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.mesh.position.add(p.v);p.life--;p.mesh.scale.multiplyScalar(.96);if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1)}}
 renderer.render(scene,camera);
}
animate();
