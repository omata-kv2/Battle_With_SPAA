import * as T from './libs/three.module.js';
import {GLTFLoader} from './libs/examples/jsm/loaders/GLTFLoader.js';
import {CONFIG} from './config.js';
import {$,progress,loading,loadError,hideStartScreen,showEndScreen,hideEndScreen,setModeUI,updateHoldGauge,hud,announce} from './ui.js';
import {buildStage,makeTarget,spawn,prepareModel} from './stage-builder.js';
import {buildHomeStage} from './home-builder.js';
import {buildSkinStage} from './skin-builder.js';

let renderer,scene,camera,target,ready=false,loop=false;
let gameMode='start'; // 'start' | 'home' | 'skin' | 'battle' | 'end'
let modalOpen=false; // パネル操作中フラグ（他の操作をロック）

const modelTemplates={missile:null,fighter:null};
const enemies=[],fx=[],keys={},move={x:0,y:0};
let wave=1,peace=100,spawned=0,tick=0,wait=0,score=0,earnedGoldInMatch=0,gold=0;
let yaw=0,pitch=-.05,x=0,z=9;

// スキン進行データ（ローカルストレージ保存対象）
let unlockedSkins=['first'];
let selectedSkinId='first';
let pendingSelectedSkinId='first';

let homeController=null,skinController=null;
let triggerCooldown=0,panelHoldTime=0,lastFrameTime=performance.now();

function getEquippedSkin(){
  return CONFIG.SKINS.find(s=>s.id===selectedSkinId) || CONFIG.SKINS[0];
}

function loadGameData(){
  const savedGold=localStorage.getItem('spaa_gold');
  if(savedGold!==null) gold=parseInt(savedGold,10);
  
  const savedUnlocked=localStorage.getItem('spaa_unlocked_skins');
  if(savedUnlocked){
    try{
      const arr=JSON.parse(savedUnlocked);
      if(Array.isArray(arr) && arr.length>0) unlockedSkins=arr;
    }catch(e){}
  }
  if(!unlockedSkins.includes('first')) unlockedSkins.unshift('first');

  const savedSelected=localStorage.getItem('spaa_selected_skin');
  if(savedSelected && unlockedSkins.includes(savedSelected)){
    selectedSkinId=savedSelected;
  }
}

function saveGameData(){
  localStorage.setItem('spaa_gold', gold);
  localStorage.setItem('spaa_unlocked_skins', JSON.stringify(unlockedSkins));
  localStorage.setItem('spaa_selected_skin', selectedSkinId);
}

function clearScene(){
  if(!scene)return;
  while(scene.children.length>0){
    scene.remove(scene.children[0]);
  }
  enemies.length=0;
  fx.length=0;
}

async function initEngineAndEnterHome(){
  if(ready){
    enterHome();
    return;
  }
  loading();
  try{
    progress(10,'3Dエンジンを初期化中');
    renderer=new T.WebGLRenderer({canvas:$('#scene'),antialias:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,CONFIG.MAX_PIXEL_RATIO));
    renderer.setSize(innerWidth,innerHeight,false);
    renderer.outputColorSpace=T.SRGBColorSpace;
    scene=new T.Scene();
    camera=new T.PerspectiveCamera(70,innerWidth/innerHeight,.1,120);
    target=makeTarget(T);
    
    progress(35,'3Dモデルを読み込み中');
    const loader=new GLTFLoader();
    const loadOne=async(path,label)=>{try{const gltf=await loader.loadAsync(path);return gltf.scene;}catch(err){console.warn(label+' GLBを読み込めません。簡易モデルを使用します。',err);return null;}};
    const [missile,fighter]=await Promise.all([loadOne('assets/Kh-35.glb','飛来物'),loadOne('assets/SU-27.glb','戦闘機')]);
    if(missile)modelTemplates.missile=prepareModel(T,missile,1.9);
    if(fighter)modelTemplates.fighter=prepareModel(T,fighter,3.6);
    
    progress(90,'ホームマップを構築中');
    requestAnimationFrame(()=>{
      progress(100,'完了');
      ready=true;
      $('#game').classList.add('loaded');
      if(!loop){loop=true;animate();}
      enterHome();
    });
  }catch(e){
    console.error(e);
    loadError(e?.message||'WebGLを初期化できませんでした');
  }
}

function enterHome(){
  hideStartScreen();
  hideEndScreen();
  closeAllModals();
  clearScene();
  gameMode='home';
  setModeUI('home', getEquippedSkin());
  homeController=buildHomeStage(T,scene,gold);
  x=homeController.spawnPos.x;
  z=homeController.spawnPos.z;
  yaw=0;
  pitch=-0.04;
  triggerCooldown=45;
  panelHoldTime=0;
  updateHoldGauge(0);
}

function enterSkinRoom(){
  closeAllModals();
  clearScene();
  gameMode='skin';
  setModeUI('skin', getEquippedSkin());
  skinController=buildSkinStage(T,scene,CONFIG.SKINS,unlockedSkins,selectedSkinId);
  // 西の端中央マスに東を向いてスポーン
  x=skinController.spawnPos.x;
  z=skinController.spawnPos.z;
  yaw=skinController.spawnYaw;
  pitch=-0.04;
  triggerCooldown=45;
  panelHoldTime=0;
  updateHoldGauge(0);
}

function startBattle(){
  closeAllModals();
  clearScene();
  gameMode='battle';
  const skin=getEquippedSkin();
  setModeUI('battle', skin);
  buildStage(T,scene);
  wave=1;peace=100;spawned=0;tick=0;wait=0;score=0;earnedGoldInMatch=0;
  x=0;z=5;yaw=0;pitch=-.08;
  beginWave();
  updateBattleHud();
}

function beginWave(){
  const skin=getEquippedSkin();
  spawned=0;tick=0;wait=0;
  announce(`WAVE ${wave} — [${skin.label}]`);
}
function waveTotal(){return CONFIG.COUNTS[wave-1]+(wave===2?1:(wave===5?2:0))}
function updateBattleHud(){hud(wave,Math.max(0,enemies.length+waveTotal()-spawned),peace)}

function shoot(){
  if(gameMode!=='battle' || modalOpen)return;
  const skin=getEquippedSkin();
  const d=new T.Vector3();
  camera.getWorldDirection(d);
  const ray=new T.Raycaster(camera.position.clone(),d,0,85);
  let hit=null,best=Infinity;
  for(const e of enemies){
    const c=new T.Vector3();
    new T.Box3().setFromObject(e).getCenter(c);
    const dist=ray.ray.distanceToPoint(c),along=camera.position.distanceTo(c);
    // スキン能力：ビーム当たり判定半径（beamRadius）が変化
    if(dist<skin.stats.beamRadius && along<best){hit=e;best=along}
  }
  const a=camera.position.clone(),b=hit?hit.position.clone():a.clone().add(d.multiplyScalar(30));
  const beamRadiusScale = skin.stats.beamRadius / 2.7;
  const beam=new T.Mesh(
    new T.CylinderGeometry(.035 * beamRadiusScale, .07 * beamRadiusScale, 1, 6),
    new T.MeshBasicMaterial({color: skin.stats.beamColor})
  );
  beam.position.copy(a).add(b).multiplyScalar(.5);
  beam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());
  beam.scale.y=a.distanceTo(b);
  scene.add(beam);
  fx.push({m:beam,life:8});
  
  if(hit){
    burst(hit.position, skin.stats.beamColor);
    scene.remove(hit);
    enemies.splice(enemies.indexOf(hit),1);
    const basePts=(hit.userData.kind==='fighter')?CONFIG.SCORE_FIGHTER:CONFIG.SCORE_MISSILE;
    // スキン能力：スコア＆ゴールド獲得倍率（scoreMult）が変化
    const gained=Math.round(basePts * skin.stats.scoreMult);
    score+=gained;
    earnedGoldInMatch+=gained;
    gold+=gained;
    saveGameData();
  }
}

function burst(p, colorHex=0x78e7ff){
  for(let i=0;i<6;i++){
    const m=new T.Mesh(new T.SphereGeometry(.09,6,5),new T.MeshBasicMaterial({color:i%2?colorHex:0xffffff}));
    m.position.copy(p);
    scene.add(m);
    fx.push({m,life:20,v:new T.Vector3((Math.random()-.5)*.15,Math.random()*.12,(Math.random()-.5)*.15)});
  }
}

function finishBattle(win){
  gameMode='end';
  showEndScreen(win,score,earnedGoldInMatch);
}

/* ====== モーダルUI制御（パネル操作中は他の操作を完全ロック） ====== */
function resetMovementInputs(){
  for(const k in keys) keys[k]=false;
  move.x=0; move.y=0;
  const knob=$('#stickKnob');
  if(knob) knob.style.transform='translate(0,0)';
}

function closeAllModals(){
  modalOpen=false;
  $('#skinSelectModal').classList.remove('visible');
  $('#skinStoreModal').classList.remove('visible');
  triggerCooldown=50;
}

// 中央パネル（1秒以上接触）で呼び出されるスキン選択画面
function openSkinSelectModal(){
  resetMovementInputs();
  modalOpen=true;
  pendingSelectedSkinId=selectedSkinId;
  renderSkinSelectList();
  $('#skinSelectModal').classList.add('visible');
}

function renderSkinSelectList(){
  const container=$('#unlockedSkinsList');
  container.innerHTML='';
  const unlockedList=CONFIG.SKINS.filter(s=>unlockedSkins.includes(s.id));
  
  unlockedList.forEach(skin=>{
    const item=document.createElement('div');
    item.className='skin-card' + (pendingSelectedSkinId===skin.id ? ' selected' : '');
    const hex='#'+skin.color.toString(16).padStart(6,'0');
    item.innerHTML=`
      <div class="skin-swatch" style="background:${hex}">Lv.${skin.lv}</div>
      <div class="skin-info">
        <div class="skin-title">${skin.name}</div>
        <div class="skin-desc">${skin.stats.desc}</div>
      </div>
      <div class="skin-badge">${pendingSelectedSkinId===skin.id ? '選択中' : 'タップで選択'}</div>
    `;
    item.addEventListener('click',()=>{
      pendingSelectedSkinId=skin.id;
      renderSkinSelectList();
    });
    container.appendChild(item);
  });
}

// 東端スキンストアで呼び出される購入・解放画面
function openSkinStoreModal(){
  resetMovementInputs();
  modalOpen=true;
  renderSkinStoreList();
  $('#skinStoreModal').classList.add('visible');
}

function renderSkinStoreList(){
  $('#storeGoldVal').textContent=gold.toLocaleString();
  const container=$('#storeSkinsList');
  container.innerHTML='';
  
  CONFIG.SKINS.forEach(skin=>{
    const isUnlocked=unlockedSkins.includes(skin.id);
    const canAfford=gold>=skin.price;
    const item=document.createElement('div');
    item.className='skin-card' + (isUnlocked ? ' unlocked' : '');
    const hex='#'+skin.color.toString(16).padStart(6,'0');
    
    let actionHtml='';
    if(isUnlocked){
      actionHtml=`<span class="badge-unlocked">解放済</span>`;
    } else {
      actionHtml=`<button class="buy-btn" ${canAfford?'':'disabled'}>${skin.price.toLocaleString()} G で購入</button>`;
    }
    
    item.innerHTML=`
      <div class="skin-swatch" style="background:${hex}">${isUnlocked ? 'Lv.'+skin.lv : '🔒'}</div>
      <div class="skin-info">
        <div class="skin-title">Lv.${skin.lv} ${skin.name}</div>
        <div class="skin-desc">${skin.stats.desc}</div>
      </div>
      <div>${actionHtml}</div>
    `;
    
    if(!isUnlocked){
      const btn=item.querySelector('.buy-btn');
      btn.addEventListener('click',()=>{
        if(gold>=skin.price && !unlockedSkins.includes(skin.id)){
          gold-=skin.price;
          unlockedSkins.push(skin.id);
          saveGameData();
          if(skinController) skinController.refreshPedestals(unlockedSkins, selectedSkinId);
          renderSkinStoreList();
        }
      });
    }
    container.appendChild(item);
  });
}

function look(dx,dy){
  if(modalOpen)return;
  yaw-=dx*.0032;
  pitch=T.MathUtils.clamp(pitch-dy*.0027,-Math.PI/2,Math.PI/2);
}

function controls(){
  $('#tapStartBtn').addEventListener('click',initEngineAndEnterHome);
  $('#returnHomeBtn').addEventListener('click',enterHome);
  $('#fire').addEventListener('pointerdown',e=>{e.preventDefault();shoot()});
  
  // スキン選択モーダル「完了」ボタン
  $('#confirmSkinBtn').addEventListener('click',()=>{
    selectedSkinId=pendingSelectedSkinId;
    saveGameData();
    if(skinController) skinController.refreshPedestals(unlockedSkins, selectedSkinId);
    setModeUI('skin', getEquippedSkin());
    closeAllModals();
  });

  // スキンストア「閉じる」ボタン
  $('#closeStoreBtn').addEventListener('click',()=>{
    closeAllModals();
  });

  const lookSurface=$('#lookSurface');
  let lookPointer=null,lastX=0,lastY=0;
  lookSurface.addEventListener('pointerdown',e=>{
    if(modalOpen || gameMode==='start' || gameMode==='end')return;
    lookPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;
    lookSurface.setPointerCapture(e.pointerId);
  });
  lookSurface.addEventListener('pointermove',e=>{
    if(modalOpen)return;
    if(lookPointer===e.pointerId){
      look(e.clientX-lastX,e.clientY-lastY);
      lastX=e.clientX;lastY=e.clientY;
    }
  });
  const stopLook=e=>{if(lookPointer===e.pointerId)lookPointer=null};
  lookSurface.addEventListener('pointerup',stopLook);
  lookSurface.addEventListener('pointercancel',stopLook);
  
  const pad=$('#stick'),knob=$('#stickKnob');let stickId=null;
  function stickMove(e){
    if(modalOpen)return;
    const r=pad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,len=Math.hypot(dx,dy)||1,k=Math.min(1,max/len);
    move.x=dx/max*k;move.y=dy/max*k;
    knob.style.transform=`translate(${move.x*max}px,${move.y*max}px)`;
  }
  pad.addEventListener('pointerdown',e=>{if(modalOpen)return;e.preventDefault();stickId=e.pointerId;pad.setPointerCapture(e.pointerId);stickMove(e)});
  pad.addEventListener('pointermove',e=>{if(modalOpen)return;if(e.pointerId===stickId){e.preventDefault();stickMove(e)}});
  const resetStick=()=>{stickId=null;move.x=move.y=0;knob.style.transform='translate(0,0)'};
  pad.addEventListener('pointerup',resetStick);
  pad.addEventListener('pointercancel',resetStick);
  
  addEventListener('keydown',e=>{
    if(modalOpen)return;
    keys[e.code]=true;
    if(e.code==='Space'){e.preventDefault();shoot()}
  });
  addEventListener('keyup',e=>keys[e.code]=false);
  addEventListener('blur',()=>{resetMovementInputs()});
  addEventListener('resize',()=>{
    if(renderer){
      renderer.setSize(innerWidth,innerHeight,false);
      camera.aspect=innerWidth/innerHeight;
      camera.updateProjectionMatrix();
    }
  });
  
  document.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('selectstart',e=>e.preventDefault());
  document.addEventListener('gesturestart',e=>e.preventDefault());
  document.addEventListener('touchmove',e=>{
    if(modalOpen)return;
    if(!e.target.closest('#stick, #fire'))e.preventDefault();
  },{passive:false});
}

function inZone(px, pz, zone){
  return Math.abs(px - zone.x) <= zone.halfX && Math.abs(pz - zone.z) <= zone.halfZ;
}

function handleTriggers(dt){
  if(modalOpen)return;
  if(triggerCooldown>0){triggerCooldown--;return;}
  
  if(gameMode==='home' && homeController){
    for(const tr of homeController.triggers){
      if(Math.hypot(x-tr.x,z-tr.z)<tr.radius){
        triggerCooldown=60;
        if(tr.id==='gamestart'){startBattle();return;}
        if(tr.id==='skin'){enterSkinRoom();return;}
      }
    }
  } else if(gameMode==='skin' && skinController){
    const zns=skinController.zones;
    // 1. ホームへ戻る
    if(inZone(x, z, zns.backHome)){
      triggerCooldown=60;
      enterHome();
      return;
    }
    // 2. スキンストア（東端）
    if(inZone(x, z, zns.store)){
      triggerCooldown=60;
      openSkinStoreModal();
      return;
    }
    // 3. 中央スキン変更パネル（1秒以上触れるとUI呼び出し）
    if(inZone(x, z, zns.selectPanel)){
      panelHoldTime += dt;
      updateHoldGauge(panelHoldTime / 1.0);
      if(panelHoldTime >= 1.0){
        panelHoldTime = 0;
        updateHoldGauge(0);
        openSkinSelectModal();
      }
    } else {
      if(panelHoldTime > 0){
        panelHoldTime = 0;
        updateHoldGauge(0);
      }
    }
  }
}

function animate(now=performance.now()){
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  if(!modalOpen){
    if(gameMode==='home' || gameMode==='skin'){
      const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-move.y;
      const s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+move.x;
      const sp=CONFIG.HOME_MOVE_SPEED;
      x+=(s*Math.cos(yaw)-f*Math.sin(yaw))*sp;
      z+=(s*Math.sin(yaw)-f*Math.cos(yaw))*sp;
      x=T.MathUtils.clamp(x,-9.3,9.3);
      z=T.MathUtils.clamp(z,-9.3,9.3);
      camera.position.set(x,1.65,z);
      camera.rotation.order='YXZ';
      camera.rotation.y=yaw;
      camera.rotation.x=pitch;
      handleTriggers(dt);
    } else if(gameMode==='battle'){
      const skin=getEquippedSkin();
      const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-move.y;
      const s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+move.x;
      // スキン能力：移動速度倍率（moveMult）を適用
      const sp=CONFIG.MOVE_SPEED * skin.stats.moveMult;
      x+=(s*Math.cos(yaw)-f*Math.sin(yaw))*sp;
      z+=(s*Math.sin(yaw)-f*Math.cos(yaw))*sp;
      x=T.MathUtils.clamp(x,-12,12);
      z=T.MathUtils.clamp(z,-1,12);
      camera.position.set(x,1.25,z);
      camera.rotation.order='YXZ';
      camera.rotation.y=yaw;
      camera.rotation.x=pitch;
      tick++;
      
      const fighterCount=wave===2?1:(wave===5?2:0),total=CONFIG.COUNTS[wave-1]+fighterCount;
      if(spawned<total&&tick>Math.max(13,40-wave*4)){
        if(enemies.length<CONFIG.MAX_ENEMIES){
          const isFighter=spawned>=CONFIG.COUNTS[wave-1];
          enemies.push(spawn(T,scene,target,wave,CONFIG,isFighter?'fighter':'missile',modelTemplates));
        }
        spawned++;tick=0;
      }
      for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i];
        e.position.z+=e.userData.speed;
        e.position.x+=Math.sin(performance.now()*.0007+e.userData.phase)*.012;
        e.rotation.z+=.0015;
        if(e.position.z>z+5){
          scene.remove(e);
          enemies.splice(i,1);
          peace-=wave<3?5:7;
        }
      }
      if(peace<=0){peace=0;updateBattleHud();finishBattle(false)}
      if(spawned===waveTotal()&&!enemies.length){
        wait++;
        announce(wave===5?'ALL WAVES CLEARED':'WAVE CLEARED');
        if(wait>85){
          if(wave===5)finishBattle(true);
          else{wave++;beginWave()}
        }
      }
      updateBattleHud();
    }
  }
  
  for(let i=fx.length-1;i>=0;i--){
    const a=fx[i];
    if(a.v)a.m.position.add(a.v);
    a.m.scale.multiplyScalar(.96);
    if(--a.life<=0){scene.remove(a.m);fx.splice(i,1)}
  }
  if(renderer&&scene&&camera)renderer.render(scene,camera);
}

loadGameData();
controls();
