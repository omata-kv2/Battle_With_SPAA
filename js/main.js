import * as T from './libs/three.module.js';
import {GLTFLoader} from './libs/examples/jsm/loaders/GLTFLoader.js';
import {CONFIG} from './config.js';
import {$,progress,loading,loadError,hideStartScreen,showEndScreen,hideEndScreen,setModeUI,showToast,updateHoldGauge,hud,announce} from './ui.js';
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
let remoteNameSprite=null;
let remoteCurrentName='';
let remotePos={x:0, z:9, yaw:0, username:''};
let coopStarting=false;
let syncTick=0;

// ==========================================
// V4.2 全体チャット & 共闘募集システム
// ==========================================
const LOBBY_HUB_ID = 'spaa-global-lobby-hub-v42';
let lobbyPeer = null;
let lobbyHubConn = null;
let isLobbyHub = false;
let lobbyInitialized = false;
let lobbyReconnectTimer = null;
let lobbyHeartbeatTimer = null;
const lobbyClients = new Map(); // hub用: peerId -> { conn, lastSeen }
const activeRecruits = new Map(); // recruitId -> { recruitId, ownerLobbyId, hostName, code, timestamp }
const seenMessageIds = new Set(); // 重複描画防止用（ページロード毎に初期化）
let myActiveRecruitId = null;
let chatExpanded = false; // 初期は縮小状態
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

    // 自分が募集中ならハブ側オーナーIDを更新して登録
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

    // 4秒ごとにクライアント生存確認（タブ強制終了などでcloseが遅延した場合の保険）
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
      // 自分がすでに募集を出していた場合、新ハブへ即座に再登録（旧ハブの募集は引き継がれないため自動消滅する）
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
        // サーバー側に存在しない古い募集（切断済みハブの募集など）をローカルからも消去
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

  // 既に同じルームの募集が出ていれば一旦クリアして最新時刻で再掲載
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

// プレイヤーがブラウザを閉じる・リロードした瞬間に募集を全員のチャットから消去
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
// ゲーム本体ロジック
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
}

function createRemotePlayerMesh(isRemoteHost, nameStr){
  const group = new T.Group();
  const geo = new T.BoxGeometry(0.75, 0.75, 0.75);
  const color = isRemoteHost ? 0xff3333 : 0x3366ff;
  const mat = new T.MeshStandardMaterial({color, roughness:0.4, metalness:0.2});
  const mesh = new T.Mesh(geo, mat);
  mesh.position.y = 0.375;
  group.add(mesh);

  const displayName = nameStr || (isRemoteHost ? 'ホスト' : 'ゲスト');
  const s = makeTextSprite(T, displayName);
  s.position.set(0, 1.25, 0);
  group.add(s);
  remoteNameSprite = s;
  remoteCurrentName = displayName;

  scene.add(group);
  return group;
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
    remotePlayerMesh = createRemotePlayerMesh(!isHost, remotePos.username);
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
  if(gameMode === 'end') return;
  gameMode='end';
  if(isCoop){
    earnedGoldInMatch = Math.round(score * 1.5);
    gold += earnedGoldInMatch;
    saveGameData();
  }
  showEndScreen(win, score, earnedGoldInMatch, isCoop);
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
  remotePos = {x:0, z:9, yaw:0, username:''};
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
      $('#coopStatusText').textContent = 'ステータス: 参加者が接続済み！GAME STARTポータルで開始できます';
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
  yaw-=dx*.0032;
  pitch=T.MathUtils.clamp(pitch-dy*.0027,-Math.PI/2,Math.PI/2);
}

// PeerJS 共闘ネットワーク設定 & ホスト・参加者相互ユーザネーム同期
function setupPeerNetwork(){
  if(peer){
    try { peer.destroy(); } catch(e){}
  }
  cancelMyCoopRecruit(true);

  const code = Math.floor(1000 + Math.random() * 9000).toString();
  coopRoomCode = code;
  isHost = true;

  peer = new Peer('spaa-' + code);
  peer.on('open', (id) => {
    $('#roomCodeDisplay').textContent = code;
    $('#coopStatusText').textContent = 'ステータス: ルーム作成完了。全体チャットで募集するか参加者待ち...';
    $('#leaveCoopRoomBtn').style.display = 'block';
    const recruitBtn = $('#recruitCoopBtn');
    if(recruitBtn){
      recruitBtn.disabled = false;
      recruitBtn.textContent = '全体チャットで募集する';
    }
    isCoop = true;
    setModeUI(gameMode, getEquippedSkin(), isCoop, isHost);
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

  peer.on('open', (id) => {
    $('#coopStatusText').textContent = 'ステータス: 部屋に接続中...';
    conn = peer.connect('spaa-' + code);
    setupConnectionEvents();
  });

  peer.on('error', (err) => {
    $('#coopStatusText').textContent = '接続エラー: ルームが見つかりません（募集が終了した可能性があります）';
  });
}

function setupConnectionEvents(){
  if(!conn) return;
  conn.on('open', () => {
    isCoop = true;
    $('#coopStatusText').textContent = 'ステータス: 共闘ルームに接続成功！';
    $('#leaveCoopRoomBtn').style.display = 'block';
    setModeUI(gameMode, getEquippedSkin(), isCoop, isHost);
    
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
      remotePos = data.pos;
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
      startCoopBattleSequence();
    } else if(data.type === 'spawnEnemy'){
      if(!isHost && gameMode === 'battle'){
        const e = spawn(T, scene, target, wave, CONFIG, data.payload.kind, modelTemplates, true, data.payload);
        enemies.push(e);
        spawned = data.spawned;
        updateBattleHud();
      }
    } else if(data.type === 'clientHit'){
      if(isHost && gameMode === 'battle'){
        const targetEnemy = enemies.find(en => en.userData.id === data.enemyId);
        if(targetEnemy){
          applyEnemyDamage(targetEnemy, data.dmg, data.beamColor, data.scoreMult, false);
        }
      }
    } else if(data.type === 'enemyDestroyed'){
      if(!isHost && gameMode === 'battle'){
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
      if(!isHost && gameMode === 'battle'){
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
      if(!isHost && gameMode === 'battle'){
        wave = data.nextWave;
        beginWave();
        updateBattleHud();
      }
    } else if(data.type === 'battleFinishSync'){
      if(!isHost && gameMode === 'battle'){
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

  // 全体チャットUIイベント
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
      announce('ホストがリトライするのを待っています...');
      return;
    }
    if(isCoop && isHost && conn && conn.open){
      conn.send({type: 'startBattle'});
      startCoopBattleSequence();
    } else {
      startBattle();
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

  addBtnHandler('#createRoomBtn', () => {
    setupPeerNetwork();
  });

  addBtnHandler('#recruitCoopBtn', () => {
    publishCoopRecruit();
  });

  addBtnHandler('#cancelRecruitBtn', () => {
    cancelMyCoopRecruit(false);
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

        if(spawned<total&&tick>Math.max(13,40-wave*4)){
          if(enemies.length<CONFIG.MAX_ENEMIES){
            const isFighter=spawned>=CONFIG.COUNTS[wave-1];
            const newEnemy = spawn(T,scene,target,wave,CONFIG,isFighter?'fighter':'missile',modelTemplates, isCoop, null);
            enemies.push(newEnemy);
            spawned++;
            tick=0;

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
            peace-=wave<3?5:7;
          }
        }

        if(peace<=0){
          peace=0;
          updateBattleHud();
          if(isCoop && isHost && conn && conn.open){
            conn.send({type: 'battleFinishSync', win: false, score, peace});
          }
          finishBattle(false);
        } else if(spawned===waveTotal()&&!enemies.length){
          wait++;
          announce(wave===5?'ALL WAVES CLEARED':'WAVE CLEARED');
          if(wait>85){
            if(wave===5){
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
          announce(wave===5?'ALL WAVES CLEARED':'WAVE CLEARED');
        }
      }

      updateBattleHud();
    }
  }

  if(isCoop && remotePlayerMesh){
    remotePlayerMesh.position.set(remotePos.x, 0, remotePos.z);
    if(conn && conn.open && syncTick % 3 === 0){
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
