import * as T from './libs/three.module.js';
import {GLTFLoader} from './libs/examples/jsm/loaders/GLTFLoader.js';
import {CONFIG} from './config.js';
import {$,progress,loading,loadError,hideStartScreen,showEndScreen,hideEndScreen,triggerWhiteFadeOut,resetWhiteFade,setModeUI,showToast,updateHoldGauge,hud,airStrikeHud,announce} from './ui.js';
import {buildStage,makeTarget,spawn,prepareModel,generateAirStrikeMissionData,buildAirStrikeStage} from './stage-builder.js';
import {buildHomeStage} from './home-builder.js';
import {buildSkinStage} from './skin-builder.js';

let renderer,scene,camera,target,ready=false,loop=false;
let gameMode='start'; // 'start' | 'home' | 'skin' | 'battle' | 'end'
let modalOpen=false;

const modelTemplates={missile:null,fighter:null};
const enemies=[],fx=[],keys={},move={x:0,y:0};
let wave=1,peace=100,spawned=0,tick=0,wait=0,score=0,earnedGoldInMatch=0,gold=0;
let yaw=0,pitch=-.05,x=0,y=0,z=9;

let username='';
let unlockedSkins=['first'];
let selectedSkinId='first';
let pendingSelectedSkinId='first';
let skinUpgrades={};

let homeController=null,skinController=null;
let triggerCooldown=0,panelHoldTime=0,lastFrameTime=performance.now();

// ゲームモード & 難易度設定状態
let selectedBattleMode = null;   // 'FALL_MISSILE' | 'AIR_STRIKE'
let selectedDifficultyId = null; // 'easy' | 'normal' | 'hard' | 'very_hard' | 'hardcore' | 'insane'
let activeBattleMode = 'FALL_MISSILE';
let activeDifficulty = CONFIG.DIFFICULTIES[0];

// AIR STRIKE 専用状態
let airStrikeState = null;

// オンライン共闘（PeerJS）関連変数
let peer=null, conn=null;
let isCoop=false, isHost=false;
let coopRoomCode=null;
let remotePlayerMesh=null;
let remoteNameSprite=null;
let remoteCurrentName='';
let remoteAirStrikeCraft=null;
let remotePos={x:0, y:0, z:9, yaw:0, username:'', airStrikePhase:'countdown', airStrikeFinished:false};
let coopStarting=false;
let syncTick=0;

// ==========================================
// 全体チャット & 共闘募集システム
// ==========================================
const LOBBY_HUB_ID = 'spaa-global-lobby-hub-v42';
let lobbyPeer = null;
let lobbyHubConn = null;
let isLobbyHub = false;
let lobbyInitialized = false;
let lobbyReconnectTimer = null;
let lobbyHeartbeatTimer = null;
const lobbyClients = new Map();
const activeRecruits = new Map();
const seenMessageIds = new Set();
let myActiveRecruitId = null;
let chatExpanded = false;
let hasUnreadChat = false;

function formatChatTimestamp(date = new Date()){
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `（${yyyy}-${mm}-${dd}-${hh}:${min}）`;
}

function setChatUnread(unread){
  hasUnreadChat = unread;
  const dot = $('#chatUnreadDot');
  if(!dot) return;
  if(unread && !chatExpanded){
    dot.classList.remove('hidden');
  } else {
    dot.classList.add('hidden');
  }
}

function expandChat(){
  chatExpanded = true;
  const wrap = $('#globalChatWrap');
  const toggleBtn = $('#chatToggleBtn');
  const panel = $('#chatPanel');
  if(wrap){
    wrap.classList.remove('chat-collapsed');
    wrap.classList.add('chat-expanded');
  }
  if(toggleBtn) toggleBtn.classList.add('hidden');
  if(panel) panel.classList.remove('hidden');
  setChatUnread(false);

  const list = $('#chatMessages');
  if(list) list.scrollTop = list.scrollHeight;
}

function collapseChat(){
  chatExpanded = false;
  const wrap = $('#globalChatWrap');
  const toggleBtn = $('#chatToggleBtn');
  const panel = $('#chatPanel');
  if(wrap){
    wrap.classList.add('chat-collapsed');
    wrap.classList.remove('chat-expanded');
  }
  if(panel) panel.classList.add('hidden');
  if(toggleBtn) toggleBtn.classList.remove('hidden');
}

function updateChatEmptyHint(){
  const list = $('#chatMessages');
  if(!list) return;
  const hasItems = list.querySelectorAll('.chat-msg').length > 0;
  let hint = list.querySelector('.chat-empty-hint');
  if(!hasItems){
    if(!hint){
      hint = document.createElement('div');
      hint.className = 'chat-empty-hint';
      hint.textContent = 'メッセージはまだありません';
      list.appendChild(hint);
    }
  } else if(hint){
    hint.remove();
  }
}

function appendChatMessageToUI({ msgId, sender, text, timestamp }){
  if(msgId && seenMessageIds.has(msgId)) return;
  if(msgId) seenMessageIds.add(msgId);

  const list = $('#chatMessages');
  if(!list) return;

  const item = document.createElement('div');
  item.className = 'chat-msg';
  if(msgId) item.dataset.msgId = msgId;

  const senderSpan = document.createElement('span');
  senderSpan.className = 'chat-sender';
  senderSpan.textContent = `${sender}:`;

  const bodySpan = document.createElement('span');
  bodySpan.className = 'chat-body';
  bodySpan.textContent = text;

  const timeSpan = document.createElement('span');
  timeSpan.className = 'chat-time';
  timeSpan.textContent = timestamp;

  item.appendChild(senderSpan);
  item.appendChild(bodySpan);
  item.appendChild(timeSpan);
  list.appendChild(item);

  updateChatEmptyHint();
  list.scrollTop = list.scrollHeight;

  if(!chatExpanded){
    setChatUnread(true);
  }
}

function appendOrUpdateRecruitToUI(rec){
  if(!rec || !rec.recruitId) return;
  activeRecruits.set(rec.recruitId, rec);

  const list = $('#chatMessages');
  if(!list) return;

  const existing = list.querySelector(`.chat-msg.recruit-msg[data-recruit-id="${rec.recruitId}"]`);
  if(existing) return;

  const item = document.createElement('div');
  item.className = 'chat-msg recruit-msg';
  item.dataset.recruitId = rec.recruitId;

  const badge = document.createElement('div');
  badge.className = 'recruit-badge';
  badge.textContent = '📢 共闘メンバー募集中';

  const body = document.createElement('div');
  body.className = 'recruit-body';

  const hostB = document.createElement('b');
  hostB.textContent = rec.hostName;
  body.appendChild(hostB);
  body.appendChild(document.createTextNode(' が共闘を募集しています！'));
  body.appendChild(document.createElement('br'));
  body.appendChild(document.createTextNode('ルームID: '));

  const codeChip = document.createElement('span');
  codeChip.className = 'recruit-code-chip';
  codeChip.textContent = rec.code;
  body.appendChild(codeChip);

  const fillBtn = document.createElement('button');
  fillBtn.type = 'button';
  fillBtn.className = 'recruit-fill-btn';
  fillBtn.textContent = '参加欄へ入力';
  fillBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const joinInput = $('#joinCodeInput');
    if(joinInput) joinInput.value = rec.code;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(rec.code).catch(()=>{});
    }
    showToast(`ルームID「${rec.code}」を参加入力欄にセットしました`);
  });
  body.appendChild(document.createTextNode(' '));
  body.appendChild(fillBtn);

  const timeSpan = document.createElement('span');
  timeSpan.className = 'chat-time';
  timeSpan.textContent = rec.timestamp;

  item.appendChild(badge);
  item.appendChild(body);
  item.appendChild(timeSpan);
  list.appendChild(item);

  updateChatEmptyHint();
  list.scrollTop = list.scrollHeight;

  if(!chatExpanded){
    setChatUnread(true);
  }
}

function removeRecruitFromUI(recruitId){
  if(!recruitId) return;
  activeRecruits.delete(recruitId);
  const list = $('#chatMessages');
  if(!list) return;
  const el = list.querySelector(`.chat-msg.recruit-msg[data-recruit-id="${recruitId}"]`);
  if(el){
    el.remove();
    updateChatEmptyHint();
  }
}

function updateLobbyOnlineCountUI(count){
  const el = $('#chatOnlineCount');
  if(el) el.textContent = `(オンライン: ${Math.max(1, count)}人)`;
}

function broadcastFromHub(payload, excludePeerId = null){
  if(!isLobbyHub) return;
  for(const [pid, client] of lobbyClients.entries()){
    if(excludePeerId && pid === excludePeerId) continue;
    if(client.conn && client.conn.open){
      client.conn.send(payload);
    }
  }
  updateLobbyOnlineCountUI(lobbyClients.size + 1);
}

function handleHubIncomingData(senderPeerId, data){
  if(!data || !data.type) return;
  const clientInfo = lobbyClients.get(senderPeerId);
  if(clientInfo) clientInfo.lastSeen = Date.now();

  if(data.type === 'heartbeat'){
    if(clientInfo && clientInfo.conn && clientInfo.conn.open){
      clientInfo.conn.send({ type: 'heartbeatAck' });
    }
  } else if(data.type === 'chatMsg'){
    appendChatMessageToUI(data.payload);
    broadcastFromHub({ type: 'chatMsg', payload: data.payload }, senderPeerId);
  } else if(data.type === 'recruitStart'){
    const rec = { ...data.payload, ownerLobbyId: senderPeerId };
    appendOrUpdateRecruitToUI(rec);
    broadcastFromHub({ type: 'recruitStart', payload: rec }, senderPeerId);
  } else if(data.type === 'recruitRemove'){
    removeRecruitFromUI(data.recruitId);
    broadcastFromHub({ type: 'recruitRemove', recruitId: data.recruitId }, senderPeerId);
  }
}

function removeRecruitsByOwner(ownerLobbyId){
  const toRemove = [];
  for(const [rid, rec] of activeRecruits.entries()){
    if(rec.ownerLobbyId === ownerLobbyId){
      toRemove.push(rid);
    }
  }
  for(const rid of toRemove){
    removeRecruitFromUI(rid);
    if(isLobbyHub){
      broadcastFromHub({ type: 'recruitRemove', recruitId: rid });
    }
  }
}

function scheduleLobbyReconnect(){
  if(lobbyReconnectTimer) return;
  const delay = 300 + Math.floor(Math.random() * 1400);
  lobbyReconnectTimer = setTimeout(() => {
    lobbyReconnectTimer = null;
    initGlobalLobby();
  }, delay);
}

function initGlobalLobby(){
  if(lobbyHeartbeatTimer){
    clearInterval(lobbyHeartbeatTimer);
    lobbyHeartbeatTimer = null;
  }
  if(lobbyPeer){
    try { lobbyPeer.destroy(); } catch(e){}
    lobbyPeer = null;
  }
  lobbyHubConn = null;
  lobbyClients.clear();
  isLobbyHub = false;

  updateChatEmptyHint();

  const tryHubPeer = new Peer(LOBBY_HUB_ID);

  tryHubPeer.on('open', () => {
    lobbyPeer = tryHubPeer;
    isLobbyHub = true;
    updateLobbyOnlineCountUI(1);

    if(myActiveRecruitId && activeRecruits.has(myActiveRecruitId)){
      const myRec = activeRecruits.get(myActiveRecruitId);
      myRec.ownerLobbyId = LOBBY_HUB_ID;
      activeRecruits.set(myActiveRecruitId, myRec);
    }

    lobbyPeer.on('connection', (c) => {
      lobbyClients.set(c.peer, { conn: c, lastSeen: Date.now() });

      c.on('open', () => {
        updateLobbyOnlineCountUI(lobbyClients.size + 1);
        c.send({
          type: 'lobbyWelcome',
          recruits: Array.from(activeRecruits.values()),
          onlineCount: lobbyClients.size + 1
        });
        broadcastFromHub({ type: 'onlineCount', count: lobbyClients.size + 1 }, c.peer);
      });

      c.on('data', (data) => {
        handleHubIncomingData(c.peer, data);
      });

      const onClientDrop = () => {
        lobbyClients.delete(c.peer);
        removeRecruitsByOwner(c.peer);
        updateLobbyOnlineCountUI(lobbyClients.size + 1);
        broadcastFromHub({ type: 'onlineCount', count: lobbyClients.size + 1 });
      };

      c.on('close', onClientDrop);
      c.on('error', onClientDrop);
    });

    lobbyHeartbeatTimer = setInterval(() => {
      const now = Date.now();
      for(const [pid, client] of Array.from(lobbyClients.entries())){
        if(now - client.lastSeen > 12000){
          try { client.conn.close(); } catch(e){}
          lobbyClients.delete(pid);
          removeRecruitsByOwner(pid);
          updateLobbyOnlineCountUI(lobbyClients.size + 1);
          broadcastFromHub({ type: 'onlineCount', count: lobbyClients.size + 1 });
        } else if(client.conn && client.conn.open){
          client.conn.send({ type: 'ping' });
        }
      }
    }, 4000);
  });

  tryHubPeer.on('error', (err) => {
    if(err && err.type === 'unavailable-id'){
      try { tryHubPeer.destroy(); } catch(e){}
      connectAsLobbyGuest();
    } else {
      scheduleLobbyReconnect();
    }
  });
}

function connectAsLobbyGuest(){
  const randId = 'spaa-lobby-guest-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 10000);
  const guestPeer = new Peer(randId);
  lobbyPeer = guestPeer;
  isLobbyHub = false;

  guestPeer.on('open', () => {
    const c = guestPeer.connect(LOBBY_HUB_ID, { reliable: true });
    lobbyHubConn = c;

    c.on('open', () => {
      updateLobbyOnlineCountUI(2);
      if(myActiveRecruitId && activeRecruits.has(myActiveRecruitId)){
        const myRec = activeRecruits.get(myActiveRecruitId);
        myRec.ownerLobbyId = guestPeer.id;
        c.send({ type: 'recruitStart', payload: myRec });
      }
    });

    c.on('data', (data) => {
      if(!data || !data.type) return;
      if(data.type === 'ping'){
        if(c.open) c.send({ type: 'heartbeat' });
      } else if(data.type === 'lobbyWelcome'){
        updateLobbyOnlineCountUI(data.onlineCount || 2);
        const serverRecruitIds = new Set((data.recruits || []).map(r => r.recruitId));
        for(const rid of Array.from(activeRecruits.keys())){
          if(rid !== myActiveRecruitId && !serverRecruitIds.has(rid)){
            removeRecruitFromUI(rid);
          }
        }
        for(const rec of (data.recruits || [])){
          appendOrUpdateRecruitToUI(rec);
        }
      } else if(data.type === 'onlineCount'){
        updateLobbyOnlineCountUI(data.count || 1);
      } else if(data.type === 'chatMsg'){
        appendChatMessageToUI(data.payload);
      } else if(data.type === 'recruitStart'){
        appendOrUpdateRecruitToUI(data.payload);
      } else if(data.type === 'recruitRemove'){
        removeRecruitFromUI(data.recruitId);
      }
    });

    const onHubLost = () => {
      lobbyHubConn = null;
      scheduleLobbyReconnect();
    };
    c.on('close', onHubLost);
    c.on('error', onHubLost);

    lobbyHeartbeatTimer = setInterval(() => {
      if(lobbyHubConn && lobbyHubConn.open){
        lobbyHubConn.send({ type: 'heartbeat' });
      }
    }, 3500);
  });

  guestPeer.on('error', () => {
    scheduleLobbyReconnect();
  });
}

function sendGlobalChatMessage(){
  const input = $('#chatInput');
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;

  const senderName = username || 'ゲスト';
  const payload = {
    msgId: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
    sender: senderName,
    text: text,
    timestamp: formatChatTimestamp(new Date())
  };

  input.value = '';
  appendChatMessageToUI(payload);

  if(isLobbyHub){
    broadcastFromHub({ type: 'chatMsg', payload });
  } else if(lobbyHubConn && lobbyHubConn.open){
    lobbyHubConn.send({ type: 'chatMsg', payload });
  }
}

function publishCoopRecruit(){
  if(!isHost || !coopRoomCode){
    showToast('先に「4桁ルームIDを発行する」を押してください');
    return;
  }

  if(myActiveRecruitId){
    cancelMyCoopRecruit(true);
  }

  const recruitId = 'rec_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  myActiveRecruitId = recruitId;

  const rec = {
    recruitId,
    ownerLobbyId: lobbyPeer ? lobbyPeer.id : 'local',
    hostName: username || 'ホスト',
    code: coopRoomCode,
    timestamp: formatChatTimestamp(new Date())
  };

  appendOrUpdateRecruitToUI(rec);

  if(isLobbyHub){
    broadcastFromHub({ type: 'recruitStart', payload: rec });
  } else if(lobbyHubConn && lobbyHubConn.open){
    lobbyHubConn.send({ type: 'recruitStart', payload: rec });
  }

  const recruitBtn = $('#recruitCoopBtn');
  const cancelBtn = $('#cancelRecruitBtn');
  if(recruitBtn) recruitBtn.textContent = '募集中（再投稿する）';
  if(cancelBtn) cancelBtn.style.display = 'block';
  $('#coopStatusText').textContent = `ステータス: 全体チャットで募集中（ID: ${coopRoomCode}）モーダルを閉じても待機できます`;
  showToast('全体チャットに共闘募集を掲載しました！');
}

function cancelMyCoopRecruit(silent = false){
  if(!myActiveRecruitId) return;
  const rid = myActiveRecruitId;
  myActiveRecruitId = null;

  removeRecruitFromUI(rid);

  if(isLobbyHub){
    broadcastFromHub({ type: 'recruitRemove', recruitId: rid });
  } else if(lobbyHubConn && lobbyHubConn.open){
    lobbyHubConn.send({ type: 'recruitRemove', recruitId: rid });
  }

  const recruitBtn = $('#recruitCoopBtn');
  const cancelBtn = $('#cancelRecruitBtn');
  if(recruitBtn){
    recruitBtn.textContent = '全体チャットで募集する';
    recruitBtn.disabled = !(isHost && coopRoomCode);
  }
  if(cancelBtn) cancelBtn.style.display = 'none';
  if(!silent){
    $('#coopStatusText').textContent = coopRoomCode
      ? `ステータス: ルーム作成完了（ID: ${coopRoomCode}）`
      : 'ステータス: 待機中';
  }
}

window.addEventListener('beforeunload', () => {
  if(myActiveRecruitId){
    const rid = myActiveRecruitId;
    if(isLobbyHub){
      broadcastFromHub({ type: 'recruitRemove', recruitId: rid });
    } else if(lobbyHubConn && lobbyHubConn.open){
      lobbyHubConn.send({ type: 'recruitRemove', recruitId: rid });
    }
  }
  if(lobbyPeer){
    try { lobbyPeer.destroy(); } catch(e){}
  }
});

// ==========================================
// 機体データ・アップグレード・セーブ/ロード
// ==========================================
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
  sprite.scale.set(1.8, 0.9, 1);
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
  remoteNameSprite=null;
  remoteCurrentName='';
  remoteAirStrikeCraft=null;
  airStrikeState=null;
}

// プレイヤーの向いた方向に正面を向ける立方体（スキン）生成
function createRemotePlayerMesh(isRemoteHost, nameStr){
  const rootGroup = new T.Group();

  const bodyGroup = new T.Group();
  const geo = new T.BoxGeometry(0.75, 0.75, 0.75);
  const color = isRemoteHost ? 0xff3333 : 0x3366ff;
  const mat = new T.MeshStandardMaterial({color, roughness:0.4, metalness:0.2});
  const mesh = new T.Mesh(geo, mat);
  mesh.position.y = 0.375;
  bodyGroup.add(mesh);

  const visor = new T.Mesh(
    new T.BoxGeometry(0.52, 0.22, 0.08),
    new T.MeshBasicMaterial({color: 0x00f5d4})
  );
  visor.position.set(0, 0.46, -0.38);
  bodyGroup.add(visor);

  const nosePointer = new T.Mesh(
    new T.ConeGeometry(0.14, 0.28, 4),
    new T.MeshBasicMaterial({color: 0xffd700})
  );
  nosePointer.rotation.x = -Math.PI / 2;
  nosePointer.position.set(0, 0.22, -0.46);
  bodyGroup.add(nosePointer);

  rootGroup.add(bodyGroup);
  rootGroup.userData.bodyGroup = bodyGroup;

  const displayName = nameStr || (isRemoteHost ? 'ホスト' : 'ゲスト');
  const s = makeTextSprite(T, displayName);
  s.position.set(0, 1.25, 0);
  rootGroup.add(s);
  remoteNameSprite = s;
  remoteCurrentName = displayName;

  scene.add(rootGroup);
  return rootGroup;
}

function updateRemoteNameLabel(newName){
  if(!remotePlayerMesh || !newName || newName === remoteCurrentName) return;
  if(remoteNameSprite){
    remotePlayerMesh.remove(remoteNameSprite);
    if(remoteNameSprite.material.map) remoteNameSprite.material.map.dispose();
    remoteNameSprite.material.dispose();
  }
  const s = makeTextSprite(T, newName);
  s.position.set(0, 1.25, 0);
  remotePlayerMesh.add(s);
  remoteNameSprite = s;
  remoteCurrentName = newName;
}

// ==========================================
// エンジン初期化 & 画面遷移
// ==========================================
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
    camera=new T.PerspectiveCamera(70,innerWidth/innerHeight,.1,240);
    target=makeTarget(T);
    
    progress(35,'3Dモデルを読み込み中');
    const loader=new GLTFLoader();
    const loadOne=async(path)=>{try{const gltf=await loader.loadAsync(path);return gltf.scene;}catch(err){return null;}};
    const [missile,fighter]=await Promise.all([loadOne('assets/Kh-35.glb'),loadOne('assets/SU-27.glb')]);
    // 全ゲームモード共通：ミサイル(Kh-35.glb)の上下の向きを反転 (flipVertical = true)
    if(missile)modelTemplates.missile=prepareModel(T,missile,1.9,true);
    if(fighter)modelTemplates.fighter=prepareModel(T,fighter,3.6,false);
    
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
  y=0;
  z=homeController.spawnPos.z;
  yaw=0;
  pitch=-0.04;
  triggerCooldown=45;
  panelHoldTime=0;
  updateHoldGauge(0);

  if(!lobbyInitialized){
    lobbyInitialized = true;
    initGlobalLobby();
  }

  if(isCoop){
    remotePlayerMesh = createRemotePlayerMesh(!isHost, remotePos.username);
  }
}

function enterSkinRoom(){
  closeAllModals();
  clearScene();
  gameMode='skin';
  setModeUI('skin', getEquippedSkin(), isCoop, isHost);
  skinController=buildSkinStage(T,scene,CONFIG.SKINS,unlockedSkins,selectedSkinId);
  x=skinController.spawnPos.x;
  y=0;
  z=skinController.spawnPos.z;
  yaw=skinController.spawnYaw;
  pitch=-0.04;
  triggerCooldown=45;
  panelHoldTime=0;
  updateHoldGauge(0);
}

// ==========================================
// ゲームモード＆難易度選択モーダル
// ==========================================
function openBattleSetupModal(){
  resetMovementInputs();
  modalOpen = true;
  selectedBattleMode = null;
  selectedDifficultyId = null;

  renderBattleSetupModal();
  $('#battleSetupModal').classList.add('visible');
}

function renderBattleSetupModal(){
  document.querySelectorAll('.setup-mode-btn').forEach(btn => {
    const m = btn.dataset.mode;
    btn.classList.toggle('selected', m === selectedBattleMode);
  });

  const modeChosen = !!selectedBattleMode;
  const lockHint = $('#diffLockHint');
  if(lockHint){
    lockHint.textContent = modeChosen
      ? '（難易度を選択してください）'
      : '（※先にゲームモードを選択してください）';
  }

  const grid = $('#difficultyBtnGrid');
  if(grid){
    grid.innerHTML = '';
    CONFIG.DIFFICULTIES.forEach(diff => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'setup-diff-btn' + (selectedDifficultyId === diff.id ? ' selected' : '');
      btn.disabled = !modeChosen;

      const waveText = selectedBattleMode === 'FALL_MISSILE' ? ` / ${diff.waves} WAVE` : '';
      btn.innerHTML = `
        <span>${diff.name}（${diff.jpName}）${waveText}</span>
        <span class="diff-swatches" title="床色 / 空色">
          <span class="diff-dot" style="background:${diff.groundHex}" title="床色"></span>
          <span class="diff-dot" style="background:${diff.skyHex}" title="空色"></span>
        </span>
      `;

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if(!selectedBattleMode) return;
        selectedDifficultyId = diff.id;
        renderBattleSetupModal();
      });

      grid.appendChild(btn);
    });
  }

  const preview = $('#setupPreviewBox');
  const startBtn = $('#confirmStartBattleBtn');
  const diffObj = CONFIG.DIFFICULTIES.find(d => d.id === selectedDifficultyId);

  if(startBtn){
    startBtn.disabled = !(selectedBattleMode && diffObj);
  }

  if(preview){
    if(!selectedBattleMode){
      preview.innerHTML = '① まず上の <b>FALL MISSILE</b> または <b>AIR STRIKE</b> を選択してください。';
    } else if(!diffObj){
      const modeName = selectedBattleMode === 'FALL_MISSILE' ? 'FALL MISSILE（地上迎撃防衛）' : 'AIR STRIKE（空挺ミサイル降下）';
      preview.innerHTML = `選択中モード: <b>${modeName}</b><br>② 次に難易度（EASY〜INSANE）を選択してください。`;
    } else {
      if(selectedBattleMode === 'FALL_MISSILE'){
        preview.innerHTML = `
          <b>【FALL MISSILE】 ${diffObj.name}（${diffObj.jpName}）</b><br>
          全 <b>${diffObj.waves} WAVE</b> 制 / ${diffObj.desc}<br>
          後半WAVEほど敵出現数が急増します。
        `;
      } else {
        preview.innerHTML = `
          <b>【AIR STRIKE】 ${diffObj.name}（${diffObj.jpName}）</b><br>
          ランダム配置の地上目標へ誘導 / 複雑障害物: 約<b>${diffObj.obstacleCount}個</b><br>
          ${diffObj.desc} / スコア: <b>20 × 生き残ったm</b>
        `;
      }
    }
  }
}

function getDifficultyById(id){
  return CONFIG.DIFFICULTIES.find(d => d.id === id) || CONFIG.DIFFICULTIES[0];
}

// ==========================================
// バトル開始（FALL MISSILE / AIR STRIKE 共通エントリー）
// ==========================================
function startBattle(modeArg = null, diffIdArg = null, sharedMissionData = null){
  closeAllModals();
  resetWhiteFade();
  clearScene();
  gameMode = 'battle';

  activeBattleMode = modeArg || selectedBattleMode || 'FALL_MISSILE';
  activeDifficulty = getDifficultyById(diffIdArg || selectedDifficultyId || 'easy');

  const skin = getEquippedSkin();
  setModeUI('battle', skin, isCoop, isHost, activeBattleMode);

  wave = 1;
  peace = 100;
  spawned = 0;
  tick = 0;
  wait = 0;
  score = 0;
  earnedGoldInMatch = 0;

  if(activeBattleMode === 'AIR_STRIKE'){
    startAirStrikeBattle(skin, sharedMissionData);
  } else {
    startFallMissileBattle(skin);
  }
}

// ------------------------------------------
// モードA: FALL MISSILE
// ------------------------------------------
function startFallMissileBattle(skin){
  buildStage(T, scene, activeDifficulty);
  x = 0;
  y = 0;
  z = 8;
  yaw = 0;
  pitch = 0.35;
  beginWave();
  updateBattleHud();

  if(isCoop){
    remotePlayerMesh = createRemotePlayerMesh(!isHost, remotePos.username);
  }
}

function getMaxWaves(){
  return activeDifficulty ? activeDifficulty.waves : 5;
}

function beginWave(){
  const skin = getEquippedSkin();
  spawned = 0;
  tick = 0;
  wait = 0;
  const modeLabel = isCoop ? '【共闘】' : '';
  announce(`${modeLabel}[${activeDifficulty.name}] WAVE ${wave} / ${getMaxWaves()} — [${skin.label}]`);
}

function waveTotal(){
  const idx = Math.min(wave - 1, CONFIG.COUNTS.length - 1);
  const diffMult = activeDifficulty ? activeDifficulty.enemyMult : 1.0;
  const missileCount = Math.round(CONFIG.COUNTS[idx] * diffMult);
  const baseFighter = CONFIG.FIGHTER_COUNTS[idx] || 0;
  const fighterCount = isCoop ? baseFighter * 3 : baseFighter;
  return missileCount + fighterCount;
}

function waveMissileCount(){
  const idx = Math.min(wave - 1, CONFIG.COUNTS.length - 1);
  const diffMult = activeDifficulty ? activeDifficulty.enemyMult : 1.0;
  return Math.round(CONFIG.COUNTS[idx] * diffMult);
}

function updateBattleHud(){
  hud(wave, Math.max(0, enemies.length + waveTotal() - spawned), peace, getMaxWaves());
}

// ------------------------------------------
// モードB: AIR STRIKE
// ------------------------------------------
function createExhaustFlameGroup(){
  const flameGroup = new T.Group();
  const outerMat = new T.MeshBasicMaterial({
    color: 0xff5500,
    transparent: true,
    opacity: 0.88
  });
  const outerCone = new T.Mesh(new T.ConeGeometry(0.24, 1.15, 10), outerMat);
  outerCone.position.y = 0.55;
  flameGroup.add(outerCone);

  const innerMat = new T.MeshBasicMaterial({
    color: 0xfff3b0,
    transparent: true,
    opacity: 0.96
  });
  const innerCone = new T.Mesh(new T.ConeGeometry(0.13, 0.75, 8), innerMat);
  innerCone.position.y = 0.38;
  flameGroup.add(innerCone);

  // ConeGeometry(+Y尖り)をローカル -Z（ミサイル後方）向きへ回転
  flameGroup.rotation.x = -Math.PI / 2;
  flameGroup.userData.outerCone = outerCone;
  flameGroup.userData.innerCone = innerCone;
  return flameGroup;
}

function createAirStrikePlayerActor(isRemote = false, labelName = ''){
  const root = new T.Group();

  // 高度100m地点の母機 SU-27.glb
  const jetTemplate = modelTemplates.fighter || makeTarget(T);
  const jetMesh = jetTemplate.clone(true);
  jetMesh.scale.multiplyScalar(1.35);
  root.add(jetMesh);

  // ミサイル本体グループ（上下反転済み Kh-35.glb）
  const missileHolder = new T.Group();
  const missileTemplate = modelTemplates.missile || makeTarget(T);
  const missileMesh = missileTemplate.clone(true);
  missileMesh.scale.multiplyScalar(1.2);
  missileHolder.add(missileMesh);

  // ミサイルの真後ろ（ローカル -Z 側）から噴射する炎
  const flameGroup = createExhaustFlameGroup();
  flameGroup.position.set(0, 0, -0.95);
  flameGroup.visible = false;
  missileHolder.add(flameGroup);

  missileHolder.position.set(0, -1.1, 0);
  root.add(missileHolder);

  let nameSprite = null;
  if(isRemote){
    nameSprite = makeTextSprite(T, labelName || 'フレンド');
    nameSprite.position.set(0, 2.2, 0);
    root.add(nameSprite);
  }

  scene.add(root);
  return {
    root,
    jetMesh,
    missileHolder,
    flameGroup,
    nameSprite
  };
}

function startAirStrikeBattle(skin, sharedMissionData = null){
  const missionData = sharedMissionData || generateAirStrikeMissionData(CONFIG, activeDifficulty);
  const targetPos = missionData.targetPos;
  const obstacles = missionData.obstacles;
  const stageObjs = buildAirStrikeStage(T, scene, activeDifficulty, obstacles, targetPos);

  // 共闘時は被らないように横にずらしてスポーン
  const spawnX = isCoop ? (isHost ? -4.0 : 4.0) : 0.0;
  const spawnY = CONFIG.AIR_STRIKE.START_Y; // 50 (= 100m)
  const spawnZ = 0.0;

  x = spawnX;
  y = spawnY;
  z = spawnZ;
  // 初期カメラが目標方向を視認しやすい角度＆少し上から見下ろす仰角にセット
  yaw = Math.atan2(spawnX - targetPos.x, spawnZ - targetPos.z);
  pitch = 0.46;

  const myActor = createAirStrikePlayerActor(false, username);
  myActor.root.position.set(x, y, z);

  if(isCoop){
    const remoteSpawnX = isHost ? 4.0 : -4.0;
    remotePos.x = remoteSpawnX;
    remotePos.y = spawnY;
    remotePos.z = spawnZ;
    remotePos.airStrikePhase = 'countdown';
    remotePos.airStrikeFinished = false;
    remoteAirStrikeCraft = createAirStrikePlayerActor(true, remotePos.username || (isHost ? 'ゲスト' : 'ホスト'));
    remoteAirStrikeCraft.root.position.set(remoteSpawnX, spawnY, spawnZ);
  }

  airStrikeState = {
    phase: 'countdown', // 'countdown' (0〜3秒) | 'flying' (発射後降下中) | 'finished'
    elapsed: 0,
    flightTime: 0,
    jetPos: new T.Vector3(spawnX, spawnY, spawnZ),
    targetPos,
    myActor,
    obstacles,
    obstacleMeshes: stageObjs.obstacleMeshes,
    targetGroup: stageObjs.targetGroup,
    survivedM: 0,
    hitTarget: false,
    crashed: false,
    finishReason: ''
  };

  announce(`【AIR STRIKE - ${activeDifficulty.name}】発射まで 3... ランダム目標を探せ！`);
  airStrikeHud(CONFIG.AIR_STRIKE.START_ALTITUDE_M, 0, 0);
}

// 動的障害物の位置・回転更新
function updateAirStrikeDynamicObstacles(dt, totalTime){
  if(!airStrikeState) return;
  const { obstacles, obstacleMeshes } = airStrikeState;

  for(let i = 0; i < obstacles.length; i++){
    const obs = obstacles[i];
    const mesh = obstacleMeshes[i];

    // 回転更新
    if(obs.rotSpeedY){
      obs.ry = (obs.ry || 0) + obs.rotSpeedY * dt;
    }

    // 移動更新（決定論的時刻 totalTime ベースで共闘同期も完全一致）
    if(obs.moveType === 'slide'){
      const offset = Math.sin(totalTime * obs.moveSpeed + (obs.movePhase || 0)) * obs.moveAmp;
      obs.px = obs.baseX + (obs.moveDirX || 1) * offset;
      obs.pz = obs.baseZ + (obs.moveDirZ || 0) * offset;
    } else if(obs.moveType === 'orbit'){
      const a = totalTime * obs.moveSpeed + (obs.movePhase || 0);
      obs.px = obs.baseX + Math.cos(a) * obs.orbitRadius;
      obs.pz = obs.baseZ + Math.sin(a) * obs.orbitRadius;
    }

    if(mesh){
      mesh.position.set(obs.px, obs.py, obs.pz);
      mesh.rotation.set(obs.rx || 0, obs.ry || 0, obs.rz || 0);
    }
  }
}

// 棒状線分と点の最短距離判定ヘルパー
function checkRodSegmentHit(px, py, pz, cx, cy, cz, rx, ry, rz, length, radius, missileRadius){
  const euler = new T.Euler(rx || 0, ry || 0, rz || 0, 'XYZ');
  const axis = new T.Vector3(0, 1, 0).applyEuler(euler).normalize();
  const halfLen = length * 0.5;
  const p0 = new T.Vector3(cx, cy, cz).addScaledVector(axis, -halfLen);
  const p1 = new T.Vector3(cx, cy, cz).addScaledVector(axis, halfLen);
  const pt = new T.Vector3(px, py, pz);

  const seg = p1.clone().sub(p0);
  const lenSq = seg.lengthSq() || 1;
  const t = T.MathUtils.clamp(pt.clone().sub(p0).dot(seg) / lenSq, 0, 1);
  const closest = p0.addScaledVector(seg, t);

  return pt.distanceTo(closest) <= radius + missileRadius;
}

// 複雑障害物との3D衝突判定（直方体・球体・棒状・十字ブレード・中空リング）
function checkAirStrikeCollision(px, py, pz, obstacles){
  const missileRadius = 0.52;

  for(const obs of obstacles){
    // 粗いバウンディング高さチェックで高速枝刈り
    if(Math.abs(py - obs.py) > 6.5) continue;

    if(obs.kind === 'sphere'){
      const dist = Math.hypot(px - obs.px, py - obs.py, pz - obs.pz);
      if(dist < obs.r + missileRadius) return obs;
    } else if(obs.kind === 'box'){
      const dx = px - obs.px;
      const dy = py - obs.py;
      const dz = pz - obs.pz;
      const ry = -(obs.ry || 0);
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const lx = dx * cosY - dz * sinY;
      const lz = dx * sinY + dz * cosY;

      const hx = obs.sx * 0.5 + missileRadius;
      const hy = obs.sy * 0.5 + missileRadius;
      const hz = obs.sz * 0.5 + missileRadius;

      if(Math.abs(lx) <= hx && Math.abs(dy) <= hy && Math.abs(lz) <= hz){
        return obs;
      }
    } else if(obs.kind === 'rod'){
      if(checkRodSegmentHit(px, py, pz, obs.px, obs.py, obs.pz, obs.rx, obs.ry, obs.rz, obs.length, obs.radius, missileRadius)){
        return obs;
      }
    } else if(obs.kind === 'cross'){
      // 水平X軸バー & 水平Z軸バー（Y軸回転適用）
      const ry = obs.ry || 0;
      if(checkRodSegmentHit(px, py, pz, obs.px, obs.py, obs.pz, 0, ry, Math.PI / 2, obs.length, obs.radius, missileRadius)){
        return obs;
      }
      if(checkRodSegmentHit(px, py, pz, obs.px, obs.py, obs.pz, Math.PI / 2, ry, 0, obs.length, obs.radius, missileRadius)){
        return obs;
      }
    } else if(obs.kind === 'ring'){
      // 中空ゲートリング（中心穴を通過できるが、リング外周枠に当たると衝突）
      if(Math.abs(py - obs.py) <= obs.tubeThickness * 0.5 + missileRadius){
        const radialDist = Math.hypot(px - obs.px, pz - obs.pz);
        const halfTube = obs.tubeThickness * 0.5 + missileRadius;
        if(Math.abs(radialDist - obs.ringRadius) <= halfTube){
          return obs;
        }
      }
    }
  }
  return null;
}

function updateAirStrikeFrame(dt){
  if(!airStrikeState) return;
  const st = airStrikeState;

  st.flightTime += dt;
  updateAirStrikeDynamicObstacles(dt, st.flightTime);

  // 地上目標の回転演出
  if(st.targetGroup){
    st.targetGroup.rotation.y += dt * 1.6;
  }

  // 入力方向（プレイヤーの視点 yaw に合わせた X / Z 軸移動）
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - move.y;
  const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + move.x;
  const forward = new T.Vector3(0, 0, -1).applyAxisAngle(new T.Vector3(0, 1, 0), yaw);
  const right = new T.Vector3(1, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), yaw);

  const skin = getEquippedSkin();
  const horizSpeed = 12.2 * skin.stats.moveMult;
  const vx = (forward.x * f + right.x * s) * horizSpeed;
  const vz = (forward.z * f + right.z * s) * horizSpeed;

  if(st.phase === 'countdown'){
    st.elapsed += dt;
    const remain = Math.max(0, CONFIG.AIR_STRIKE.LAUNCH_DELAY_SEC - st.elapsed);
    announce(`【AIR STRIKE】発射まで ${Math.ceil(remain)} 秒...（目標を探して位置調整）`);

    x = T.MathUtils.clamp(x + vx * dt, -26, 26);
    z = T.MathUtils.clamp(z + vz * dt, -26, 26);
    y = CONFIG.AIR_STRIKE.START_Y;
    st.jetPos.set(x, y, z);

    st.myActor.root.position.set(x, y, z);
    st.myActor.jetMesh.rotation.y = yaw;
    st.myActor.missileHolder.position.set(0, -1.15, 0);
    st.myActor.missileHolder.lookAt(x, y - 10, z);

    airStrikeHud(100, 0, 0);

    if(st.elapsed >= CONFIG.AIR_STRIKE.LAUNCH_DELAY_SEC){
      st.phase = 'flying';
      y = CONFIG.AIR_STRIKE.START_Y - 1.2;
      st.myActor.flameGroup.visible = true;
      burst(new T.Vector3(x, y + 0.8, z), 0xffaa00);
      announce('MISSILE LAUNCH! 複雑障害物を避けて地上目標へ誘導せよ！');
    }
  } else if(st.phase === 'flying'){
    // 常に5m/s（= 2.5 units/s）で下へ降下し続ける
    const vyUnits = -(CONFIG.AIR_STRIKE.DESCENT_SPEED_MPS * 0.5);
    x = T.MathUtils.clamp(x + vx * dt, -28, 28);
    z = T.MathUtils.clamp(z + vz * dt, -28, 28);
    y = Math.max(0, y + vyUnits * dt);

    // 母機SU-27は高度100m上空を維持
    st.jetPos.z -= 1.5 * dt;
    st.myActor.jetMesh.position.set(st.jetPos.x - x, st.jetPos.y - y, st.jetPos.z - z);

    // ミサイル本体（上下反転済み Kh-35.glb）は常に下を正面に向けつつ、進行方向に機首を合わせる
    st.myActor.root.position.set(x, y, z);
    st.myActor.missileHolder.position.set(0, 0, 0);
    st.myActor.missileHolder.lookAt(x + vx * 0.35, y + vyUnits * 1.2, z + vz * 0.35);

    // 後ろから出る噴射炎アニメーション＆炎パーティクル
    const flicker = 0.8 + Math.random() * 0.55;
    st.myActor.flameGroup.scale.set(1, 1, flicker);
    if(syncTick % 2 === 0){
      st.myActor.missileHolder.updateMatrixWorld(true);
      const exhaustPos = st.myActor.missileHolder.localToWorld(new T.Vector3(0, 0, -0.95));
      const pMesh = new T.Mesh(
        new T.SphereGeometry(0.16, 6, 5),
        new T.MeshBasicMaterial({color: Math.random() < 0.5 ? 0xff6b00 : 0xffd166})
      );
      pMesh.position.copy(exhaustPos);
      scene.add(pMesh);
      fx.push({
        m: pMesh,
        life: 14,
        v: new T.Vector3((Math.random() - 0.5) * 0.06, 0.14 + Math.random() * 0.08, (Math.random() - 0.5) * 0.06)
      });
    }

    // 生存距離（生き残ったm）計算
    const currentAltM = Math.max(0, Math.min(100, y * 2));
    st.survivedM = Math.max(0, Math.min(100, Math.round(100 - currentAltM)));
    const liveScore = CONFIG.AIR_STRIKE.SCORE_PER_METER * st.survivedM;
    airStrikeHud(currentAltM, st.survivedM, liveScore);

    // 障害物との衝突チェック
    const hitObs = checkAirStrikeCollision(x, y, z, st.obstacles);
    if(hitObs){
      st.phase = 'finished';
      st.crashed = true;
      st.finishReason = `障害物に衝突！（高度 ${Math.round(currentAltM)}m / 生き残り ${st.survivedM}m）`;
      st.myActor.flameGroup.visible = false;
      st.myActor.missileHolder.visible = false;
      burst(new T.Vector3(x, y, z), 0xff3300);
      onAirStrikeLocalComplete();
      return;
    }

    // 地上(y <= 0.5)到達チェック
    if(y <= 0.5){
      st.phase = 'finished';
      st.survivedM = 100;
      const distToTarget = Math.hypot(x - st.targetPos.x, z - st.targetPos.z);
      st.hitTarget = distToTarget <= CONFIG.AIR_STRIKE.TARGET_RADIUS;
      st.finishReason = st.hitTarget
        ? `地上目標に直撃成功！（生き残り 100m）`
        : `地上着弾（目標から ${Math.round(distToTarget * 2)}m 逸脱 / 生き残り 100m）`;
      st.myActor.flameGroup.visible = false;
      st.myActor.missileHolder.visible = false;
      burst(new T.Vector3(x, 0.6, z), st.hitTarget ? 0x00f5d4 : 0xffaa00);
      onAirStrikeLocalComplete();
      return;
    }
  }

  // 三人称視点カメラ追従（360°全周：水平yaw＋上下pitchの球面軌道で一定距離・全方向を見渡せる）
  let focusX = x, focusY = y, focusZ = z;
  if(st.phase === 'finished' && isCoop && !remotePos.airStrikeFinished){
    focusX = remotePos.x;
    focusY = remotePos.y;
    focusZ = remotePos.z;
  }

  const orbitRadius = CONFIG.AIR_STRIKE.CAM_RADIUS;
  const elev = T.MathUtils.clamp(pitch, -1.48, 1.48);
  const horizDist = Math.cos(elev) * orbitRadius;
  const vertOffset = Math.sin(elev) * orbitRadius;

  camera.position.set(
    focusX + Math.sin(yaw) * horizDist,
    Math.max(0.45, focusY + vertOffset),
    focusZ + Math.cos(yaw) * horizDist
  );
  camera.lookAt(focusX, focusY, focusZ);
}

function onAirStrikeLocalComplete(){
  if(!airStrikeState) return;
  const finalScore = CONFIG.AIR_STRIKE.SCORE_PER_METER * airStrikeState.survivedM;
  score = finalScore;
  earnedGoldInMatch = finalScore;

  if(isCoop && conn && conn.open){
    conn.send({
      type: 'airStrikeDone',
      survivedM: airStrikeState.survivedM,
      hitTarget: airStrikeState.hitTarget,
      score: finalScore
    });
    if(!remotePos.airStrikeFinished){
      announce(`${airStrikeState.finishReason} — フレンドの降下完了を待機中...`);
      return;
    }
  }

  finalizeAirStrikeResult();
}

function finalizeAirStrikeResult(){
  if(!airStrikeState || gameMode === 'end') return;
  gameMode = 'end';
  const mySurvived = airStrikeState.survivedM;
  const myScore = CONFIG.AIR_STRIKE.SCORE_PER_METER * mySurvived;
  score = myScore;
  earnedGoldInMatch = myScore;
  gold += earnedGoldInMatch;
  saveGameData();

  const win = airStrikeState.hitTarget;
  const detail = airStrikeState.finishReason;
  if(win){
    triggerWhiteFadeOut(() => {
      showEndScreen(true, score, earnedGoldInMatch, isCoop, detail);
    });
  } else {
    showEndScreen(false, score, earnedGoldInMatch, isCoop, detail);
  }
}

// ==========================================
// FALL MISSILE 射撃・ダメージ・リザルト
// ==========================================
function applyEnemyDamage(enemyObj, dmg, beamColor, skinScoreMult, fromRemote=false){
  if(!enemyObj) return;
  enemyObj.userData.hp -= dmg;
  burst(enemyObj.position, beamColor);

  if(enemyObj.userData.hp <= 0){
    scene.remove(enemyObj);
    const idx = enemies.indexOf(enemyObj);
    if(idx !== -1) enemies.splice(idx, 1);

    if(!fromRemote){
      const basePts=(enemyObj.userData.kind==='fighter')?CONFIG.SCORE_FIGHTER:CONFIG.SCORE_MISSILE;
      const gained=Math.round(basePts * skinScoreMult);
      score+=gained;
      if(!isCoop){
        earnedGoldInMatch+=gained;
        gold+=gained;
        saveGameData();
      } else if(isHost && conn && conn.open){
        conn.send({type: 'enemyDestroyed', enemyId: enemyObj.userData.id, score: score});
      }
    }
  }
}

function fireSingleBeam(skin, effectiveStats, spreadYaw=0, spreadPitch=0){
  if(gameMode!=='battle' || activeBattleMode!=='FALL_MISSILE' || modalOpen) return;

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
    if(isCoop && !isHost){
      burst(hit.position, skin.stats.beamColor);
      if(conn && conn.open){
        conn.send({
          type: 'clientHit',
          enemyId: hit.userData.id,
          dmg: effectiveStats.atk,
          beamColor: skin.stats.beamColor,
          scoreMult: skin.stats.scoreMult
        });
      }
    } else {
      applyEnemyDamage(hit, effectiveStats.atk, skin.stats.beamColor, skin.stats.scoreMult, false);
    }
  }
}

function shoot(){
  if(gameMode!=='battle' || activeBattleMode!=='FALL_MISSILE' || modalOpen)return;
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
  if(gameMode === 'end') return;
  gameMode='end';
  if(isCoop){
    earnedGoldInMatch = Math.round(score * 1.5);
    gold += earnedGoldInMatch;
    saveGameData();
  }
  if(win){
    triggerWhiteFadeOut(() => {
      showEndScreen(true, score, earnedGoldInMatch, isCoop);
    });
  } else {
    showEndScreen(false, score, earnedGoldInMatch, isCoop);
  }
}

function abortBattle(){
  if(gameMode !== 'battle') return;
  if(isCoop && conn && conn.open){
    conn.send({type: 'abortBattle'});
  }
  enterHome();
}

function leaveCoopRoom(){
  cancelMyCoopRecruit(true);
  if(conn && conn.open){
    try { conn.send({type: 'leaveCoop'}); } catch(e){}
    try { conn.close(); } catch(e){}
  }
  if(peer){
    try { peer.destroy(); } catch(e){}
  }
  isCoop = false;
  isHost = false;
  coopRoomCode = null;
  conn = null;
  peer = null;
  remotePos = {x:0, y:0, z:9, yaw:0, username:'', airStrikePhase:'countdown', airStrikeFinished:false};
  $('#roomCodeDisplay').textContent = '未発行';
  const recruitBtn = $('#recruitCoopBtn');
  if(recruitBtn){
    recruitBtn.disabled = true;
    recruitBtn.textContent = '全体チャットで募集する';
  }
  const cancelBtn = $('#cancelRecruitBtn');
  if(cancelBtn) cancelBtn.style.display = 'none';
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
  $('#battleSetupModal').classList.remove('visible');
  triggerCooldown=50;
}

function openCoopModal(){
  resetMovementInputs();
  modalOpen=true;
  const recruitBtn = $('#recruitCoopBtn');
  const cancelBtn = $('#cancelRecruitBtn');

  if(isHost && coopRoomCode){
    $('#roomCodeDisplay').textContent = coopRoomCode;
    if(recruitBtn){
      recruitBtn.disabled = false;
      recruitBtn.textContent = myActiveRecruitId ? '募集中（再投稿する）' : '全体チャットで募集する';
    }
    if(cancelBtn) cancelBtn.style.display = myActiveRecruitId ? 'block' : 'none';
    $('#leaveCoopRoomBtn').style.display = 'block';
    if(conn && conn.open){
      $('#coopStatusText').textContent = 'ステータス: 参加者が接続済み！GAME STARTポータルで出撃できます';
    } else if(myActiveRecruitId){
      $('#coopStatusText').textContent = `ステータス: 全体チャットで募集中（ID: ${coopRoomCode}）モーダルを閉じても待機できます`;
    } else {
      $('#coopStatusText').textContent = `ステータス: ルーム作成完了（ID: ${coopRoomCode}）参加者待ち...`;
    }
  } else if(isCoop){
    if(recruitBtn) recruitBtn.disabled = true;
    if(cancelBtn) cancelBtn.style.display = 'none';
    $('#leaveCoopRoomBtn').style.display = 'block';
    $('#coopStatusText').textContent = 'ステータス: 共闘ルーム接続中';
  } else {
    if(recruitBtn) recruitBtn.disabled = true;
    if(cancelBtn) cancelBtn.style.display = 'none';
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
  yaw -= dx * 0.0036;
  // AIR STRIKE モードでは上下方向もほぼ真上〜真下まで360°全周見渡せるようにする
  if(gameMode === 'battle' && activeBattleMode === 'AIR_STRIKE'){
    pitch = T.MathUtils.clamp(pitch + dy * 0.0034, -1.48, 1.48);
  } else {
    pitch = T.MathUtils.clamp(pitch - dy * 0.0027, -Math.PI / 2, Math.PI / 2);
  }
}

// ==========================================
// PeerJS 共闘ネットワーク設定
// ==========================================
function setupPeerNetwork(){
  if(peer){
    try { peer.destroy(); } catch(e){}
  }
  cancelMyCoopRecruit(true);

  const code = Math.floor(1000 + Math.random() * 9000).toString();
  coopRoomCode = code;
  isHost = true;

  peer = new Peer('spaa-' + code);
  peer.on('open', () => {
    $('#roomCodeDisplay').textContent = code;
    $('#coopStatusText').textContent = 'ステータス: ルーム作成完了。全体チャットで募集するか参加者待ち...';
    $('#leaveCoopRoomBtn').style.display = 'block';
    const recruitBtn = $('#recruitCoopBtn');
    if(recruitBtn){
      recruitBtn.disabled = false;
      recruitBtn.textContent = '全体チャットで募集する';
    }
    isCoop = true;
    setModeUI(gameMode, getEquippedSkin(), isCoop, isHost, activeBattleMode);
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
  if(peer){
    try { peer.destroy(); } catch(e){}
  }
  cancelMyCoopRecruit(true);

  isHost = false;
  coopRoomCode = code;
  const myRand = Math.floor(1000 + Math.random() * 9000);
  peer = new Peer('spaa-client-' + myRand);

  peer.on('open', () => {
    $('#coopStatusText').textContent = 'ステータス: 部屋に接続中...';
    conn = peer.connect('spaa-' + code);
    setupConnectionEvents();
  });

  peer.on('error', () => {
    $('#coopStatusText').textContent = '接続エラー: ルームが見つかりません（募集が終了した可能性があります）';
  });
}

function setupConnectionEvents(){
  if(!conn) return;
  conn.on('open', () => {
    isCoop = true;
    $('#coopStatusText').textContent = 'ステータス: 共闘ルームに接続成功！';
    $('#leaveCoopRoomBtn').style.display = 'block';
    setModeUI(gameMode, getEquippedSkin(), isCoop, isHost, activeBattleMode);
    
    conn.send({
      type: 'playerInfoSync',
      username: username,
      selectedSkinId: selectedSkinId,
      skinUpgrades: skinUpgrades,
      isHostSender: isHost
    });

    if(!isHost){
      setTimeout(() => {
        enterHome();
      }, 400);
    } else {
      if(gameMode === 'home' && !remotePlayerMesh){
        remotePlayerMesh = createRemotePlayerMesh(false, remotePos.username);
      }
      showToast('フレンドが共闘ルームに参加しました！');
    }
  });

  conn.on('data', (data) => {
    if(data.type === 'pos'){
      remotePos = { ...remotePos, ...data.pos };
      if(data.pos.username){
        updateRemoteNameLabel(data.pos.username);
      }
    } else if(data.type === 'playerInfoSync'){
      remotePos.username = data.username;
      updateRemoteNameLabel(data.username);
      if(isHost){
        showToast(`${data.username || 'フレンド'} がルームに参加しました！`);
      }
      if(isHost && conn && conn.open){
        conn.send({
          type: 'hostInfoReply',
          username: username,
          selectedSkinId: selectedSkinId
        });
      }
    } else if(data.type === 'hostInfoReply'){
      remotePos.username = data.username;
      updateRemoteNameLabel(data.username);
    } else if(data.type === 'startBattle'){
      startCoopBattleSequence(data.battleMode, data.difficultyId, data.missionData || null);
    } else if(data.type === 'airStrikeDone'){
      remotePos.airStrikeFinished = true;
      if(gameMode === 'battle' && activeBattleMode === 'AIR_STRIKE' && airStrikeState && airStrikeState.phase === 'finished'){
        finalizeAirStrikeResult();
      }
    } else if(data.type === 'spawnEnemy'){
      if(!isHost && gameMode === 'battle' && activeBattleMode === 'FALL_MISSILE'){
        const e = spawn(T, scene, target, wave, CONFIG, data.payload.kind, modelTemplates, true, data.payload, activeDifficulty.speedMult);
        enemies.push(e);
        spawned = data.spawned;
        updateBattleHud();
      }
    } else if(data.type === 'clientHit'){
      if(isHost && gameMode === 'battle' && activeBattleMode === 'FALL_MISSILE'){
        const targetEnemy = enemies.find(en => en.userData.id === data.enemyId);
        if(targetEnemy){
          applyEnemyDamage(targetEnemy, data.dmg, data.beamColor, data.scoreMult, false);
        }
      }
    } else if(data.type === 'enemyDestroyed'){
      if(!isHost && gameMode === 'battle' && activeBattleMode === 'FALL_MISSILE'){
        score = data.score;
        const idx = enemies.findIndex(en => en.userData.id === data.enemyId);
        if(idx !== -1){
          burst(enemies[idx].position, 0x78e7ff);
          scene.remove(enemies[idx]);
          enemies.splice(idx, 1);
        }
        updateBattleHud();
      }
    } else if(data.type === 'stageSync'){
      if(!isHost && gameMode === 'battle' && activeBattleMode === 'FALL_MISSILE'){
        wave = data.wave;
        peace = data.peace;
        score = data.score;
        spawned = data.spawned;
        if(Array.isArray(data.enemies)){
          const serverIds = new Set(data.enemies.map(se => se.id));
          for(let i = enemies.length - 1; i >= 0; i--){
            if(!serverIds.has(enemies[i].userData.id)){
              scene.remove(enemies[i]);
              enemies.splice(i, 1);
            }
          }
          for(const se of data.enemies){
            const localEn = enemies.find(en => en.userData.id === se.id);
            if(localEn){
              localEn.position.set(se.px, se.py, se.pz);
              localEn.userData.hp = se.hp;
            }
          }
        }
        updateBattleHud();
      }
    } else if(data.type === 'waveClearSync'){
      if(!isHost && gameMode === 'battle' && activeBattleMode === 'FALL_MISSILE'){
        wave = data.nextWave;
        beginWave();
        updateBattleHud();
      }
    } else if(data.type === 'battleFinishSync'){
      if(!isHost && gameMode === 'battle' && activeBattleMode === 'FALL_MISSILE'){
        score = data.score;
        peace = data.peace;
        updateBattleHud();
        finishBattle(data.win);
      }
    } else if(data.type === 'abortBattle' || data.type === 'leaveCoop'){
      leaveCoopRoom();
    }
  });

  conn.on('close', () => {
    leaveCoopRoom();
  });
}

function startCoopBattleSequence(modeArg, diffIdArg, sharedMissionData = null){
  if(coopStarting) return;
  coopStarting = true;
  closeAllModals();
  showToast(`共闘出撃 [${modeArg} / ${getDifficultyById(diffIdArg).name}] 5秒後に開始...`, 4800);
  setTimeout(() => {
    coopStarting = false;
    startBattle(modeArg, diffIdArg, sharedMissionData);
  }, 5000);
}

// ==========================================
// UI・操作イベント登録
// ==========================================
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

  addBtnHandler('#chatToggleBtn', () => expandChat());
  addBtnHandler('#chatMinimizeBtn', () => collapseChat());
  addBtnHandler('#chatSendBtn', () => sendGlobalChatMessage());

  const chatInput = $('#chatInput');
  if(chatInput){
    chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if(e.key === 'Enter'){
        e.preventDefault();
        sendGlobalChatMessage();
      }
    });
  }

  document.querySelectorAll('.setup-mode-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedBattleMode = btn.dataset.mode;
      renderBattleSetupModal();
    });
  });

  addBtnHandler('#cancelSetupBtn', () => closeAllModals());
  addBtnHandler('#confirmStartBattleBtn', () => {
    if(!selectedBattleMode || !selectedDifficultyId) return;
    const modeToRun = selectedBattleMode;
    const diffToRun = selectedDifficultyId;
    const diffObj = getDifficultyById(diffToRun);

    if(isCoop && isHost && conn && conn.open){
      const sharedMission = modeToRun === 'AIR_STRIKE'
        ? generateAirStrikeMissionData(CONFIG, diffObj)
        : null;
      conn.send({
        type: 'startBattle',
        battleMode: modeToRun,
        difficultyId: diffToRun,
        missionData: sharedMission
      });
      startCoopBattleSequence(modeToRun, diffToRun, sharedMission);
    } else {
      startBattle(modeToRun, diffToRun, null);
    }
  });

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
  addBtnHandler('#retryBattleBtn', () => {
    if(isCoop && !isHost){
      showToast('ホストがリトライするのを待っています...');
      return;
    }
    if(isCoop && isHost && conn && conn.open){
      const sharedMission = activeBattleMode === 'AIR_STRIKE'
        ? generateAirStrikeMissionData(CONFIG, activeDifficulty)
        : null;
      conn.send({
        type: 'startBattle',
        battleMode: activeBattleMode,
        difficultyId: activeDifficulty.id,
        missionData: sharedMission
      });
      startCoopBattleSequence(activeBattleMode, activeDifficulty.id, sharedMission);
    } else {
      startBattle(activeBattleMode, activeDifficulty.id, null);
    }
  });
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

  addBtnHandler('#createRoomBtn', () => setupPeerNetwork());
  addBtnHandler('#recruitCoopBtn', () => publishCoopRecruit());
  addBtnHandler('#cancelRecruitBtn', () => cancelMyCoopRecruit(false));

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
    if(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
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
  
  document.addEventListener('contextmenu',e=>{
    if(e.target && e.target.closest('#globalChatWrap, .modal-panel')) return;
    e.preventDefault();
  });
  document.addEventListener('selectstart',e=>{
    if(e.target && e.target.closest('#globalChatWrap, .modal-panel')) return;
    e.preventDefault();
  });
  document.addEventListener('gesturestart',e=>e.preventDefault());
  document.addEventListener('touchmove',e=>{
    if(modalOpen)return;
    if(!e.target.closest('#stick, #fire, #globalChatWrap'))e.preventDefault();
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
            showToast('参加者は部屋主が出撃設定を行うのを待ってください');
            return;
          }
          openBattleSetupModal();
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

// ==========================================
// メインアニメーションループ
// ==========================================
function animate(now=performance.now()){
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  syncTick++;

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

      handleTriggers(dt);
    } else if(gameMode==='battle'){
      if(activeBattleMode === 'AIR_STRIKE'){
        updateAirStrikeFrame(dt);
      } else {
        // FALL MISSILE モード
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

        if(!isCoop || isHost){
          tick++;
          const total = waveTotal();
          const missileCap = waveMissileCount();
          const maxW = getMaxWaves();
          const spawnInterval = Math.max(8, 38 - wave * 3);

          if(spawned < total && tick > spawnInterval){
            if(enemies.length < CONFIG.MAX_ENEMIES){
              const isFighter = spawned >= missileCap;
              const newEnemy = spawn(
                T, scene, target, wave, CONFIG,
                isFighter ? 'fighter' : 'missile',
                modelTemplates, isCoop, null,
                activeDifficulty.speedMult
              );
              enemies.push(newEnemy);
              spawned++;
              tick = 0;

              if(isCoop && isHost && conn && conn.open){
                conn.send({
                  type: 'spawnEnemy',
                  payload: newEnemy.userData.syncPayload,
                  spawned: spawned
                });
              }
            }
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
              peace -= wave < 4 ? 5 : 7;
            }
          }

          if(peace <= 0){
            peace = 0;
            updateBattleHud();
            if(isCoop && isHost && conn && conn.open){
              conn.send({type: 'battleFinishSync', win: false, score, peace});
            }
            finishBattle(false);
          } else if(spawned === waveTotal() && !enemies.length){
            wait++;
            announce(wave === maxW ? 'ALL WAVES CLEARED' : `WAVE ${wave} CLEARED`);
            if(wait > 75){
              if(wave >= maxW){
                if(isCoop && isHost && conn && conn.open){
                  conn.send({type: 'battleFinishSync', win: true, score, peace});
                }
                finishBattle(true);
              } else {
                wave++;
                beginWave();
                if(isCoop && isHost && conn && conn.open){
                  conn.send({type: 'waveClearSync', nextWave: wave});
                }
              }
            }
          }

          if(isCoop && isHost && conn && conn.open && syncTick % 6 === 0){
            conn.send({
              type: 'stageSync',
              wave,
              peace,
              score,
              spawned,
              enemies: enemies.map(en => ({
                id: en.userData.id,
                px: en.position.x,
                py: en.position.y,
                pz: en.position.z,
                hp: en.userData.hp
              }))
            });
          }
        } else {
          for(let i=enemies.length-1;i>=0;i--){
            const e=enemies[i];
            if(e.userData.velocity){
              e.position.add(e.userData.velocity);
            }
          }
          if(spawned===waveTotal()&&!enemies.length){
            announce(wave===getMaxWaves()?'ALL WAVES CLEARED':`WAVE ${wave} CLEARED`);
          }
        }

        updateBattleHud();
      }
    }
  }

  // 共闘相手の位置・向き同期
  if(isCoop){
    if(remotePlayerMesh){
      remotePlayerMesh.position.set(remotePos.x, 0, remotePos.z);
      if(remotePlayerMesh.userData.bodyGroup){
        remotePlayerMesh.userData.bodyGroup.rotation.y = remotePos.yaw || 0;
      }
    }
    if(remoteAirStrikeCraft && gameMode === 'battle' && activeBattleMode === 'AIR_STRIKE'){
      remoteAirStrikeCraft.root.position.set(remotePos.x, remotePos.y, remotePos.z);
      remoteAirStrikeCraft.jetMesh.rotation.y = remotePos.yaw || 0;
      if(remotePos.airStrikePhase === 'flying'){
        remoteAirStrikeCraft.flameGroup.visible = true;
        remoteAirStrikeCraft.missileHolder.position.set(0, 0, 0);
        remoteAirStrikeCraft.missileHolder.lookAt(remotePos.x, remotePos.y - 10, remotePos.z);
      } else {
        remoteAirStrikeCraft.flameGroup.visible = false;
        remoteAirStrikeCraft.missileHolder.position.set(0, -1.15, 0);
      }
      remoteAirStrikeCraft.root.visible = !remotePos.airStrikeFinished;
    }

    if(conn && conn.open && syncTick % 3 === 0){
      conn.send({
        type: 'pos',
        pos: {
          x,
          y,
          z,
          yaw,
          username,
          airStrikePhase: airStrikeState ? airStrikeState.phase : 'countdown',
          airStrikeFinished: airStrikeState ? (airStrikeState.phase === 'finished') : false
        }
      });
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
