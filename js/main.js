import * as T from './libs/three.module.js';
import {GLTFLoader} from './libs/examples/jsm/loaders/GLTFLoader.js';
import {CONFIG} from './config.js';
import {$,progress,loading,loadError,hideStartScreen,showEndScreen,hideEndScreen,setModeUI,updateHoldGauge,hud,announce} from './ui.js';
import {buildStage,makeTarget,spawn,prepareModel} from './stage-builder.js';
import {buildHomeStage} from './home-builder.js';
import {buildSkinStage} from './skin-builder.js';

let renderer,scene,camera,target,ready=false,loop=false;
let gameMode='start'; // 'start' | 'home' | 'skin' | 'battle' | 'end'
let modalOpen=false;

const modelTemplates={missile:null,fighter:null};
const enemies=[],fx=[],keys={},move={x:0,y:0};
let wave=1,peace=100,spawned=0,tick=0,wait=0,score=0,earnedGoldInMatch=0,gold=0;
let yaw=0,pitch=-.05,x=0,z=9;

let username='';
let unlockedSkins=['first'];
let selectedSkinId='first';
let pendingSelectedSkinId='first';
let skinUpgrades={};

let homeController=null,skinController=null;
let triggerCooldown=0,panelHoldTime=0,lastFrameTime=performance.now();

// オンライン共闘（PeerJS）関連変数
let peer=null, conn=null;
let isCoop=false, isHost=false;
let coopRoomCode=null;
let remotePlayerMesh=null;
let localPlayerMesh=null;
let remoteNameSprite=null;
let localNameSprite=null;
let remotePos={x:0, z:9, yaw:0, username:''};
let coopStarting=false;

function getSkinUpgrade(skinId){
  if(!skinUpgrades[skinId]){
    skinUpgrades[skinId] = { atk: 1, def: 1, hp: 1, rate: 1 };
  }
  return skinUpgrades[skinId];
}

function getEquippedSkin(){
  return CONFIG.SKINS.find(s=>s.id===selectedSkinId) || CONFIG.SKINS[0];
}

function getEffectiveStats(skin){
  const upg = getSkinUpgrade(skin.id);
  const effectiveAtk = skin.stats.baseAtk + (upg.atk - 1) * 1;
  const effectiveDef = 0 + (upg.def - 1) * 1;
  const effectiveHp  = 100 + (upg.hp - 1) * 1;
  const rawRate      = skin.stats.baseRate + (upg.rate - 1) * 0.5;
  const shotCount    = Math.max(1, Math.floor(rawRate));
  return {
    atk: effectiveAtk,
    def: effectiveDef,
    hp: effectiveHp,
    rawRate: rawRate,
    shotCount: shotCount
  };
}

function makeTextSprite(T, text, bgColor='rgba(10,30,45,0.85)', textColor='#ffffff'){
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#6ee5ff';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  
  ctx.fillStyle = textColor;
  ctx.font = 'bold 38px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const tex = new T.CanvasTexture(canvas);
  const mat = new T.SpriteMaterial({map: tex, transparent: true});
  const sprite = new T.Sprite(mat);
  sprite.scale.set(2.0, 1.0, 1);
  return sprite;
}

function loadGameData(){
  const savedUsername=localStorage.getItem('spaa_username');
  if(savedUsername!==null) username=savedUsername;

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

  const savedUpgrades=localStorage.getItem('spaa_skin_upgrades');
  if(savedUpgrades){
    try{
      const obj=JSON.parse(savedUpgrades);
      if(obj && typeof obj==='object') skinUpgrades=obj;
    }catch(e){}
  }
}

function saveGameData(){
  localStorage.setItem('spaa_username', username);
  localStorage.setItem('spaa_gold', gold);
  localStorage.setItem('spaa_unlocked_skins', JSON.stringify(unlockedSkins));
  localStorage.setItem('spaa_selected_skin', selectedSkinId);
  localStorage.setItem('spaa_skin_upgrades', JSON.stringify(skinUpgrades));
}

function clearScene(){
  if(!scene)return;
  while(scene.children.length>0){
    scene.remove(scene.children[0]);
  }
  enemies.length=0;
  fx.length=0;
  remotePlayerMesh=null;
  localPlayerMesh=null;
  remoteNameSprite=null;
  localNameSprite=null;
}

function createPlayerMesh(isHostPlayer, nameStr){
  const group = new T.Group();
  const geo = new T.BoxGeometry(1.0, 1.0, 1.0);
  const color = isHostPlayer ? 0xff3333 : 0x3366ff;
  const mat = new T.MeshStandardMaterial({color, roughness:0.4, metalness:0.2});
  const mesh = new T.Mesh(geo, mat);
  mesh.position.y = 0.5;
  group.add(mesh);

  if(nameStr){
    const s = makeTextSprite(T, nameStr);
    s.position.set(0, 1.4, 0);
    group.add(s);
  }

  scene.add(group);
  return group;
}

async function initEngineAndEnterHome(){
  if(ready){
    checkUsernameAndEnterHome();
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
    camera=new T.PerspectiveCamera(70,innerWidth/innerHeight,.1,160);
    target=makeTarget(T);
    
    progress(35,'3Dモデルを読み込み中');
    const loader=new GLTFLoader();
    const loadOne=async(path,label)=>{try{const gltf=await loader.loadAsync(path);return gltf.scene;}catch(err){return null;}};
    const [missile,fighter]=await Promise.all([loadOne('assets/Kh-35.glb','飛来物'),loadOne('assets/SU-27.glb','戦闘機')]);
    if(missile)modelTemplates.missile=prepareModel(T,missile,1.9);
    if(fighter)modelTemplates.fighter=prepareModel(T,fighter,3.6);
    
    progress(90,'ホームマップを構築中');
    requestAnimationFrame(()=>{
      progress(100,'完了');
      ready=true;
      $('#game').classList.add('loaded');
      if(!loop){loop=true;animate();}
      checkUsernameAndEnterHome();
    });
  }catch(e){
    console.error(e);
    loadError(e?.message||'WebGLを初期化できませんでした');
  }
}

function checkUsernameAndEnterHome(){
  if(!username){
    modalOpen=true;
    $('#startOverlay').classList.remove('visible');
    $('#usernameModal').classList.add('visible');
  } else {
    enterHome();
  }
}

function enterHome(){
  hideStartScreen();
  hideEndScreen();
  closeAllModals();
  clearScene();
  gameMode='home';
  setModeUI('home', getEquippedSkin(), isCoop, isHost);
  homeController=buildHomeStage(T,scene,gold);
  x=homeController.spawnPos.x;
  z=homeController.spawnPos.z;
  yaw=0;
  pitch=-0.04;
  triggerCooldown=45;
  panelHoldTime=0;
  updateHoldGauge(0);

  // 共闘モード時：参加者はホストのホームルームにテレポート・同期され、視点・移動操作が正常に保証される
  if(isCoop){
    localPlayerMesh = createPlayerMesh(isHost, username);
    remotePlayerMesh = createPlayerMesh(!isHost, remotePos.username || (isHost ? 'ゲスト' : 'ホスト'));
  }
}

function enterSkinRoom(){
  closeAllModals();
  clearScene();
  gameMode='skin';
  setModeUI('skin', getEquippedSkin(), isCoop, isHost);
  skinController=buildSkinStage(T,scene,CONFIG.SKINS,unlockedSkins,selectedSkinId);
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
  setModeUI('battle', skin, isCoop, isHost);
  buildStage(T,scene);
  wave=1;peace=100;spawned=0;tick=0;wait=0;score=0;earnedGoldInMatch=0;
  x=0;z=8;yaw=0;pitch=0.35;
  beginWave();
  updateBattleHud();

  if(isCoop){
    localPlayerMesh = createPlayerMesh(isHost, username);
    remotePlayerMesh = createPlayerMesh(!isHost, remotePos.username || (isHost ? 'ゲスト' : 'ホスト'));
  }
}

function beginWave(){
  const skin=getEquippedSkin();
  spawned=0;tick=0;wait=0;
  const modeLabel = isCoop ? '【共闘】' : '';
  announce(`${modeLabel}WAVE ${wave} — [${skin.label}]`);
}

function waveTotal(){
  const baseFighter = wave===2?1:(wave===5?2:0);
  const fighterCount = isCoop ? baseFighter * 5 : baseFighter;
  return CONFIG.COUNTS[wave-1] + fighterCount;
}

function updateBattleHud(){hud(wave,Math.max(0,enemies.length+waveTotal()-spawned),peace)}

function fireSingleBeam(skin, effectiveStats, spreadYaw=0, spreadPitch=0){
  if(gameMode!=='battle' || modalOpen) return;

  const d=new T.Vector3();
  camera.getWorldDirection(d);

  if(spreadYaw !== 0 || spreadPitch !== 0){
    const euler = new T.Euler(spreadPitch, spreadYaw, 0, 'YXZ');
    d.applyEuler(euler).normalize();
  }

  const ray=new T.Raycaster(camera.position.clone(),d,0,120);
  let hit=null,best=Infinity;
  for(const e of enemies){
    const c=new T.Vector3();
    new T.Box3().setFromObject(e).getCenter(c);
    const dist=ray.ray.distanceToPoint(c),along=camera.position.distanceTo(c);
    if(dist<skin.stats.beamRadius && along<best){hit=e;best=along}
  }
  const a=camera.position.clone(),b=hit?hit.position.clone():a.clone().add(d.multiplyScalar(45));
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
    hit.userData.hp -= effectiveStats.atk;
    burst(hit.position, skin.stats.beamColor);

    if(hit.userData.hp <= 0){
      scene.remove(hit);
      const idx = enemies.indexOf(hit);
      if(idx !== -1) enemies.splice(idx, 1);

      const basePts=(hit.userData.kind==='fighter')?CONFIG.SCORE_FIGHTER:CONFIG.SCORE_MISSILE;
      const gained=Math.round(basePts * skin.stats.scoreMult);
      score+=gained;
      if(!isCoop){
        earnedGoldInMatch+=gained;
        gold+=gained;
        saveGameData();
      }

      if(isCoop && conn && conn.open){
        conn.send({type: 'hit', scoreGained: gained});
      }
    }
  }
}

function shoot(){
  if(gameMode!=='battle' || modalOpen)return;
  const skin=getEquippedSkin();
  const effectiveStats=getEffectiveStats(skin);
  const count = effectiveStats.shotCount;

  fireSingleBeam(skin, effectiveStats, 0, 0);

  for(let i = 1; i < count; i++){
    const angleOffset = (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * 0.045;
    const pitchOffset = ((i % 3) - 1) * 0.025;
    setTimeout(() => {
      fireSingleBeam(skin, effectiveStats, angleOffset, pitchOffset);
    }, i * 100);
  }
}

function burst(p, colorHex=0x78e7ff){
  for(let i=0;i<6;i++){
    const m=new T.Mesh(new T.SphereGeometry(.12,6,5),new T.MeshBasicMaterial({color:i%2?colorHex:0xffffff}));
    m.position.copy(p);
    scene.add(m);
    fx.push({m,life:20,v:new T.Vector3((Math.random()-.5)*.2,Math.random()*.15,(Math.random()-.5)*.2)});
  }
}

function finishBattle(win){
  gameMode='end';
  if(isCoop){
    earnedGoldInMatch = Math.round(score * 0.8);
    gold += earnedGoldInMatch;
    saveGameData();
  }
  showEndScreen(win,score,earnedGoldInMatch, isCoop);
}

function abortBattle(){
  if(gameMode !== 'battle') return;
  if(isCoop && conn && conn.open){
    conn.send({type: 'abortBattle'});
  }
  enterHome();
}

// 共闘ルーム退出機能：共闘中に得たゴールド数を自分のローカルストレージ（元ワールド）に加算して退出
function leaveCoopRoom(){
  if(!isCoop) return;
  if(conn && conn.open){
    conn.send({type: 'leaveCoop'});
    conn.close();
  }
  if(peer){
    peer.destroy();
  }
  isCoop = false;
  isHost = false;
  conn = null;
  peer = null;
  $('#leaveCoopRoomBtn').style.display = 'none';
  $('#coopStatusText').textContent = 'ステータス: 共闘ルームから退出しました';
  saveGameData();
  enterHome();
}

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
  $('#skinUpgradeModal').classList.remove('visible');
  $('#coopModal').classList.remove('visible');
  $('#usernameModal').classList.remove('visible');
  triggerCooldown=50;
}

function openCoopModal(){
  resetMovementInputs();
  modalOpen=true;
  if(isCoop){
    $('#leaveCoopRoomBtn').style.display = 'block';
    $('#coopStatusText').textContent = 'ステータス: 共闘ルーム接続中';
  } else {
    $('#leaveCoopRoomBtn').style.display = 'none';
    $('#coopStatusText').textContent = 'ステータス: 待機中';
  }
  $('#coopModal').classList.add('visible');
}

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
    const eff = getEffectiveStats(skin);
    item.innerHTML=`
      <div class="skin-swatch" style="background:${hex}">Lv.${skin.lv}</div>
      <div class="skin-info">
        <div class="skin-title">${skin.name}</div>
        <div class="skin-desc">攻撃:${eff.atk} / 連射:${eff.rawRate} (${eff.shotCount}連) / ${skin.stats.desc}</div>
      </div>
      <div class="skin-badge">${pendingSelectedSkinId===skin.id ? '選択中' : 'タップで選択'}</div>
    `;
    item.addEventListener('pointerdown',(e)=>{
      e.preventDefault();
      pendingSelectedSkinId=skin.id;
      renderSkinSelectList();
    });
    container.appendChild(item);
  });
}

function openSkinUpgradeModal(){
  const targetSkin = CONFIG.SKINS.find(s=>s.id===pendingSelectedSkinId) || getEquippedSkin();
  $('#skinSelectModal').classList.remove('visible');
  $('#skinUpgradeModal').classList.add('visible');
  renderSkinUpgradeList(targetSkin);
}

function renderSkinUpgradeList(skin){
  $('#upgradeGoldVal').textContent = gold.toLocaleString();
  $('#upgradeSkinTitle').textContent = `Lv.${skin.lv} ${skin.name} の強化`;
  const container = $('#upgradeItemsList');
  container.innerHTML = '';

  const upg = getSkinUpgrade(skin.id);
  const eff = getEffectiveStats(skin);

  const items = [
    {
      key: 'atk',
      name: '攻撃力',
      lv: upg.atk,
      valStr: `現在値: ${eff.atk} (1Lvごとに+1)`,
      color: '#ff4d6d'
    },
    {
      key: 'def',
      name: '防御力',
      lv: upg.def,
      valStr: `現在値: ${eff.def} (1Lvごとに+1 / 現在効力なし)`,
      color: '#4de680'
    },
    {
      key: 'hp',
      name: '体力',
      lv: upg.hp,
      valStr: `現在値: ${eff.hp} (1Lvごとに+1 / 現在効力なし)`,
      color: '#38c8f0'
    },
    {
      key: 'rate',
      name: '連射力',
      lv: upg.rate,
      valStr: `現在値: ${eff.rawRate} → 発射弾数: ${eff.shotCount}発 (1Lvごとに+0.5)`,
      color: '#ffd23f'
    }
  ];

  items.forEach(it => {
    const upgradeCount = it.lv - 1;
    const cost = 2000 + upgradeCount * 500;
    const canAfford = gold >= cost;

    const card = document.createElement('div');
    card.className = 'skin-card';
    card.innerHTML = `
      <div class="skin-swatch" style="background:${it.color}">Lv.${it.lv}</div>
      <div class="skin-info">
        <div class="skin-title">${it.name} (Lv.${it.lv} → Lv.${it.lv + 1})</div>
        <div class="skin-desc">${it.valStr}</div>
      </div>
      <div>
        <button class="buy-btn" ${canAfford ? '' : 'disabled'}>${cost.toLocaleString()} G で強化</button>
      </div>
    `;

    const btn = card.querySelector('.buy-btn');
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if(gold >= cost){
        gold -= cost;
        upg[it.key] += 1;
        saveGameData();
        renderSkinUpgradeList(skin);
      }
    });

    container.appendChild(card);
  });
}

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
      btn.addEventListener('pointerdown',(e)=>{
        e.preventDefault();
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

// PeerJS 共闘ネットワーク設定 & 参加者ホストルーム転送同期
function setupPeerNetwork(){
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  coopRoomCode = code;
  isHost = true;

  peer = new Peer('spaa-' + code);
  peer.on('open', (id) => {
    $('#roomCodeDisplay').textContent = code;
    $('#coopStatusText').textContent = 'ステータス: ルーム作成完了。参加者待ち...';
    $('#leaveCoopRoomBtn').style.display = 'block';
    isCoop = true;
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConnectionEvents();
    $('#coopStatusText').textContent = 'ステータス: 参加者が接続しました！共闘準備完了';
    isCoop = true;
    $('#leaveCoopRoomBtn').style.display = 'block';
  });

  peer.on('error', (err) => {
    $('#coopStatusText').textContent = 'エラー: ' + err.type;
  });
}

function joinPeerNetwork(code){
  isHost = false;
  coopRoomCode = code;
  const myRand = Math.floor(1000 + Math.random() * 9000);
  peer = new Peer('spaa-client-' + myRand);

  peer.on('open', (id) => {
    $('#coopStatusText').textContent = 'ステータス: 部屋に接続中...';
    conn = peer.connect('spaa-' + code);
    setupConnectionEvents();
  });

  peer.on('error', (err) => {
    $('#coopStatusText').textContent = '接続エラー: ルームが見つかりません';
  });
}

function setupConnectionEvents(){
  if(!conn) return;
  conn.on('open', () => {
    isCoop = true;
    $('#coopStatusText').textContent = 'ステータス: 共闘ルームに接続成功！ホストルームへ転送します';
    $('#leaveCoopRoomBtn').style.display = 'block';
    
    // 接続成功したら自身のユーザネーム・スキン情報・アップグレード情報をホストに送信し、自分もホストルームへ移動
    conn.send({
      type: 'joinSync',
      username: username,
      selectedSkinId: selectedSkinId,
      skinUpgrades: skinUpgrades,
      gold: gold,
      unlockedSkins: unlockedSkins
    });

    // 参加者をホストルーム（ホームベース）に強制移動し、視点・移動操作が正常に行えるようセットアップ
    setTimeout(() => {
      enterHome();
    }, 600);
  });

  conn.on('data', (data) => {
    if(data.type === 'pos'){
      remotePos = data.pos;
    } else if(data.type === 'joinSync'){
      // ホスト側：参加者からデータを受信した場合の同期保存
      if(isHost){
        remotePos.username = data.username;
        // ホスト側でも必要に応じローカルストレージにセーブ・同期
      }
    } else if(data.type === 'startBattle'){
      startCoopBattleSequence();
    } else if(data.type === 'hit'){
      score += data.scoreGained;
    } else if(data.type === 'abortBattle' || data.type === 'leaveCoop'){
      leaveCoopRoom();
    }
  });

  conn.on('close', () => {
    leaveCoopRoom();
  });
}

function startCoopBattleSequence(){
  if(coopStarting) return;
  coopStarting = true;
  announce('まもなく共闘バトル開始 (5秒前)...');
  setTimeout(() => {
    coopStarting = false;
    startBattle();
  }, 5000);
}

function controls(){
  const addBtnHandler = (selector, handler) => {
    const el = $(selector);
    if(el){
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handler(e);
      });
    }
  };

  addBtnHandler('#tapStartBtn', () => initEngineAndEnterHome());
  addBtnHandler('#saveUsernameBtn', () => {
    const val = $('#usernameInput').value.trim();
    if(val.length > 0 && val.length <= 10){
      username = val;
      saveGameData();
      closeAllModals();
      enterHome();
    } else {
      alert('ユーザネームは1〜10文字以内で入力してください。');
    }
  });

  addBtnHandler('#returnHomeBtn', () => enterHome());
  addBtnHandler('#abortBattleBtn', () => abortBattle());
  addBtnHandler('#retryBattleBtn', () => startBattle());
  addBtnHandler('#fire', () => shoot());
  addBtnHandler('#confirmSkinBtn', () => {
    selectedSkinId=pendingSelectedSkinId;
    saveGameData();
    if(skinController) skinController.refreshPedestals(unlockedSkins, selectedSkinId);
    setModeUI('skin', getEquippedSkin(), isCoop, isHost);
    closeAllModals();
  });
  addBtnHandler('#openUpgradeBtn', () => openSkinUpgradeModal());
  addBtnHandler('#closeUpgradeBtn', () => {
    $('#skinUpgradeModal').classList.remove('visible');
    $('#skinSelectModal').classList.add('visible');
    renderSkinSelectList();
  });
  addBtnHandler('#closeStoreBtn', () => closeAllModals());
  addBtnHandler('#closeCoopBtn', () => closeAllModals());
  addBtnHandler('#leaveCoopRoomBtn', () => leaveCoopRoom());

  addBtnHandler('#createRoomBtn', () => {
    setupPeerNetwork();
  });

  addBtnHandler('#joinRoomBtn', () => {
    const code = $('#joinCodeInput').value.trim();
    if(code.length === 4){
      joinPeerNetwork(code);
    } else {
      alert('4桁のルームIDを入力してください');
    }
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
    const r=pad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy;
    const max=r.width*.32*1.5;
    const len=Math.hypot(dx,dy)||1,k=Math.min(1,max/len);
    
    move.x=(dx/max)*k;
    move.y=(dy/max)*k;
    
    const visualMax=r.width*.32;
    knob.style.transform=`translate(${Math.max(-visualMax,Math.min(visualMax,move.x*visualMax))}px,${Math.max(-visualMax,Math.min(visualMax,move.y*visualMax))}px)`;
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
        if(tr.id==='gamestart'){
          if(isCoop && !isHost){
            announce('参加者は部屋主がスタートさせるのを待ってください');
            return;
          }
          if(isCoop && isHost && conn && conn.open){
            conn.send({type: 'startBattle'});
            startCoopBattleSequence();
          } else if(!isCoop){
            startBattle();
          }
          return;
        }
        if(tr.id==='skin'){enterSkinRoom();return;}
        if(tr.id==='coop'){openCoopModal();return;}
      }
    }
  } else if(gameMode==='skin' && skinController){
    const zns=skinController.zones;
    if(inZone(x, z, zns.backHome)){
      triggerCooldown=60;
      enterHome();
      return;
    }
    if(inZone(x, z, zns.store)){
      triggerCooldown=60;
      openSkinStoreModal();
      return;
    }
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
      
      const forward = new T.Vector3(0, 0, -1).applyAxisAngle(new T.Vector3(0, 1, 0), yaw);
      const right = new T.Vector3(1, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), yaw);
      
      x += (forward.x * f + right.x * s) * sp;
      z += (forward.z * f + right.z * s) * sp;
      
      x=T.MathUtils.clamp(x,-9.3,9.3);
      z=T.MathUtils.clamp(z,-9.3,9.3);
      camera.position.set(x,1.65,z);
      camera.rotation.order='YXZ';
      camera.rotation.y=yaw;
      camera.rotation.x=pitch;

      if(localPlayerMesh){
        localPlayerMesh.position.set(x, 0.5, z);
      }

      handleTriggers(dt);
    } else if(gameMode==='battle'){
      const skin=getEquippedSkin();
      const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-move.y;
      const s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+move.x;
      const sp=CONFIG.MOVE_SPEED * skin.stats.moveMult;
      
      const forward = new T.Vector3(0, 0, -1).applyAxisAngle(new T.Vector3(0, 1, 0), yaw);
      const right = new T.Vector3(1, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), yaw);
      
      x += (forward.x * f + right.x * s) * sp;
      z += (forward.z * f + right.z * s) * sp;
      
      x=T.MathUtils.clamp(x,-18,18);
      z=T.MathUtils.clamp(z,-18,18);
      camera.position.set(x,1.25,z);
      camera.rotation.order='YXZ';
      camera.rotation.y=yaw;
      camera.rotation.x=pitch;

      if(localPlayerMesh){
        localPlayerMesh.position.set(x, 0.5, z);
      }

      tick++;
      
      const baseFighter = wave===2?1:(wave===5?2:0);
      const fighterCount = isCoop ? baseFighter * 5 : baseFighter;
      const total = CONFIG.COUNTS[wave-1] + fighterCount;

      if(spawned<total&&tick>Math.max(13,40-wave*4)){
        if(enemies.length<CONFIG.MAX_ENEMIES){
          const isFighter=spawned>=CONFIG.COUNTS[wave-1];
          enemies.push(spawn(T,scene,target,wave,CONFIG,isFighter?'fighter':'missile',modelTemplates, isCoop));
        }
        spawned++;tick=0;
      }
      for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i];
        if(e.userData.velocity){
          e.position.add(e.userData.velocity);
        } else {
          e.position.z+=e.userData.speed;
        }

        let reachedTarget = false;
        if(e.userData.kind === 'missile'){
          if(e.position.y <= -1.5) reachedTarget = true;
        } else {
          if(Math.hypot(e.position.x, e.position.z) < 2.5 && e.position.y <= 10.5) reachedTarget = true;
        }

        if(reachedTarget){
          burst(e.position, 0xff4444);
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

  // 共闘相手の位置同期および頭上ユーザネームスプライトの更新
  if(isCoop && remotePlayerMesh){
    remotePlayerMesh.position.set(remotePos.x, 0.5, remotePos.z);
    if(conn && conn.open && tick % 3 === 0){
      conn.send({type: 'pos', pos: {x, z, yaw, username}});
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
