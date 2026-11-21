import * as T from './libs/three.module.js';
import { state, getEquippedSkin } from './state.js';
import { $, showToast, setModeUI, hud } from './ui.js';
import { spawn } from './map-fall-missile.js';
import { applyEnemyDamage, burst, getMaxWaves } from './enemies.js';
import { createAirStrikePlayerActor, finalizeAirStrikeResult } from './mode-air-strike.js';

export const coopState = {
  peer: null,
  conn: null,
  isCoop: false,
  isHost: false,
  coopRoomCode: null,
  remotePlayerMesh: null,
  remoteNameSprite: null,
  remoteCurrentName: '',
  remoteAirStrikeCraft: null,
  remotePos: { x: 0, y: 0, z: 9, yaw: 0, username: '', airStrikePhase: 'countdown', airStrikeFinished: false },
  coopStarting: false
};

let appCallbacks = {
  startBattle: null,
  enterHome: null,
  finishBattle: null
};

export function bindMultiplayerCallbacks(cbs){
  appCallbacks = { ...appCallbacks, ...cbs };
}

export function sendCoop(payload){
  if(coopState.conn && coopState.conn.open){
    coopState.conn.send(payload);
  }
}

export function getCoopContext(){
  return {
    isCoop: coopState.isCoop,
    isHost: coopState.isHost,
    remotePos: coopState.remotePos,
    sendCoop
  };
}

export function makeTextSprite(TModule, text, bgColor = 'rgba(10,30,45,0.85)', textColor = '#ffffff'){
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

  const tex = new TModule.CanvasTexture(canvas);
  const mat = new TModule.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new TModule.Sprite(mat);
  sprite.scale.set(1.8, 0.9, 1);
  return sprite;
}

export function clearRemoteVisuals(){
  coopState.remotePlayerMesh = null;
  coopState.remoteNameSprite = null;
  coopState.remoteCurrentName = '';
  coopState.remoteAirStrikeCraft = null;
}

export function createRemotePlayerMesh(){
  if(!state.scene) return null;
  const isRemoteHost = !coopState.isHost;
  const nameStr = coopState.remotePos.username;
  const rootGroup = new T.Group();

  const bodyGroup = new T.Group();
  const geo = new T.BoxGeometry(0.75, 0.75, 0.75);
  const color = isRemoteHost ? 0xff3333 : 0x3366ff;
  const mat = new T.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
  const mesh = new T.Mesh(geo, mat);
  mesh.position.y = 0.375;
  bodyGroup.add(mesh);

  const visor = new T.Mesh(
    new T.BoxGeometry(0.52, 0.22, 0.08),
    new T.MeshBasicMaterial({ color: 0x00f5d4 })
  );
  visor.position.set(0, 0.46, -0.38);
  bodyGroup.add(visor);

  const nosePointer = new T.Mesh(
    new T.ConeGeometry(0.14, 0.28, 4),
    new T.MeshBasicMaterial({ color: 0xffd700 })
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
  coopState.remoteNameSprite = s;
  coopState.remoteCurrentName = displayName;

  state.scene.add(rootGroup);
  coopState.remotePlayerMesh = rootGroup;
  return rootGroup;
}

export function initRemoteAirStrikeCraft(spawnY, spawnZ){
  const remoteSpawnX = coopState.isHost ? 4.0 : -4.0;
  coopState.remotePos.x = remoteSpawnX;
  coopState.remotePos.y = spawnY;
  coopState.remotePos.z = spawnZ;
  coopState.remotePos.airStrikePhase = 'countdown';
  coopState.remotePos.airStrikeFinished = false;
  coopState.remoteAirStrikeCraft = createAirStrikePlayerActor(
    true,
    coopState.remotePos.username || (coopState.isHost ? 'ゲスト' : 'ホスト'),
    makeTextSprite
  );
  coopState.remoteAirStrikeCraft.root.position.set(remoteSpawnX, spawnY, spawnZ);
}

function updateRemoteNameLabel(newName){
  if(!coopState.remotePlayerMesh || !newName || newName === coopState.remoteCurrentName) return;
  if(coopState.remoteNameSprite){
    coopState.remotePlayerMesh.remove(coopState.remoteNameSprite);
    if(coopState.remoteNameSprite.material.map) coopState.remoteNameSprite.material.map.dispose();
    coopState.remoteNameSprite.material.dispose();
  }
  const s = makeTextSprite(T, newName);
  s.position.set(0, 1.25, 0);
  coopState.remotePlayerMesh.add(s);
  coopState.remoteNameSprite = s;
  coopState.remoteCurrentName = newName;
}

export function syncCoopFrame(){
  if(!coopState.isCoop || !coopState.conn || !coopState.conn.open) return;

  if(state.gameMode === 'battle' && state.activeBattleMode === 'AIR_STRIKE'){
    if(state.syncTick % 2 === 0){
      sendCoop({
        type: 'pos',
        x: state.x,
        y: state.y,
        z: state.z,
        yaw: state.yaw,
        username: state.username,
        airStrikePhase: state.airStrikeState ? state.airStrikeState.phase : 'countdown'
      });
    }
    if(coopState.remoteAirStrikeCraft){
      coopState.remoteAirStrikeCraft.root.position.lerp(
        new T.Vector3(coopState.remotePos.x, coopState.remotePos.y, coopState.remotePos.z),
        0.35
      );
      if(coopState.remotePos.airStrikePhase === 'flying' && !coopState.remotePos.airStrikeFinished){
        coopState.remoteAirStrikeCraft.flameGroup.visible = true;
        coopState.remoteAirStrikeCraft.missileHolder.position.set(0, 0, 0);
      }
    }
    return;
  }

  if(state.syncTick % 3 === 0){
    sendCoop({ type: 'pos', x: state.x, y: 0, z: state.z, yaw: state.yaw, username: state.username });
  }
  if(coopState.remotePlayerMesh){
    coopState.remotePlayerMesh.position.lerp(new T.Vector3(coopState.remotePos.x, 0, coopState.remotePos.z), 0.3);
    if(coopState.remotePlayerMesh.userData.bodyGroup){
      coopState.remotePlayerMesh.userData.bodyGroup.rotation.y = coopState.remotePos.yaw;
    }
  }
}

// ==========================================
// 全体チャット & 共闘募集ロビーシステム
// ==========================================
const LOBBY_HUB_ID = 'spaa-global-lobby-hub-v47';
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

export function hasActiveRecruit(){
  return !!myActiveRecruitId;
}

function formatChatTimestamp(date = new Date()){
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `（${yyyy}-${mm}-${dd}-${hh}:${min}）`;
}

function setChatUnread(unread){
  const dot = $('#chatUnreadDot');
  if(!dot) return;
  if(unread && !chatExpanded){
    dot.classList.remove('hidden');
  } else {
    dot.classList.add('hidden');
  }
}

export function expandChat(){
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

export function collapseChat(){
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

  if(!chatExpanded) setChatUnread(true);
}

function appendOrUpdateRecruitToUI(rec){
  if(!rec || !rec.recruitId) return;
  activeRecruits.set(rec.recruitId, rec);

  const list = $('#chatMessages');
  if(!list) return;
  if(list.querySelector(`.chat-msg.recruit-msg[data-recruit-id="${rec.recruitId}"]`)) return;

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
      navigator.clipboard.writeText(rec.code).catch(() => {});
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

  if(!chatExpanded) setChatUnread(true);
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
    if(rec.ownerLobbyId === ownerLobbyId) toRemove.push(rid);
  }
  for(const rid of toRemove){
    removeRecruitFromUI(rid);
    if(isLobbyHub) broadcastFromHub({ type: 'recruitRemove', recruitId: rid });
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

export function ensureLobbyInitialized(){
  if(!lobbyInitialized){
    lobbyInitialized = true;
    initGlobalLobby();
  }
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

      c.on('data', (data) => handleHubIncomingData(c.peer, data));

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
          if(rid !== myActiveRecruitId && !serverRecruitIds.has(rid)) removeRecruitFromUI(rid);
        }
        for(const rec of (data.recruits || [])) appendOrUpdateRecruitToUI(rec);
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

  guestPeer.on('error', () => scheduleLobbyReconnect());
}

export function sendGlobalChatMessage(){
  const input = $('#chatInput');
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;

  const senderName = state.username || 'ゲスト';
  const payload = {
    msgId: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
    sender: senderName,
    text,
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

export function publishCoopRecruit(){
  if(!coopState.isHost || !coopState.coopRoomCode){
    showToast('先に「4桁ルームIDを発行する」を押してください');
    return;
  }

  if(myActiveRecruitId) cancelMyCoopRecruit(true);

  const recruitId = 'rec_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  myActiveRecruitId = recruitId;

  const rec = {
    recruitId,
    ownerLobbyId: lobbyPeer ? lobbyPeer.id : 'local',
    hostName: state.username || 'ホスト',
    code: coopState.coopRoomCode,
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
  $('#coopStatusText').textContent = `ステータス: 全体チャットで募集中（ID: ${coopState.coopRoomCode}）モーダルを閉じても待機できます`;
  showToast('全体チャットに共闘募集を掲載しました！');
}

export function cancelMyCoopRecruit(silent = false){
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
    recruitBtn.disabled = !(coopState.isHost && coopState.coopRoomCode);
  }
  if(cancelBtn) cancelBtn.style.display = 'none';
  if(!silent){
    $('#coopStatusText').textContent = coopState.coopRoomCode
      ? `ステータス: ルーム作成完了（ID: ${coopState.coopRoomCode}）`
      : 'ステータス: 待機中';
  }
}

window.addEventListener('beforeunload', () => {
  if(myActiveRecruitId){
    const rid = myActiveRecruitId;
    if(isLobbyHub) broadcastFromHub({ type: 'recruitRemove', recruitId: rid });
    else if(lobbyHubConn && lobbyHubConn.open) lobbyHubConn.send({ type: 'recruitRemove', recruitId: rid });
  }
  if(lobbyPeer){
    try { lobbyPeer.destroy(); } catch(e){}
  }
});

// ==========================================
// PeerJS 共闘ルーム接続・切断制御
// ==========================================
export function leaveCoopRoom(){
  cancelMyCoopRecruit(true);
  if(coopState.conn && coopState.conn.open){
    try { coopState.conn.send({ type: 'leaveCoop' }); } catch(e){}
    try { coopState.conn.close(); } catch(e){}
  }
  if(coopState.peer){
    try { coopState.peer.destroy(); } catch(e){}
  }
  coopState.conn = null;
  coopState.peer = null;
  coopState.isCoop = false;
  coopState.isHost = false;
  coopState.coopRoomCode = null;
  coopState.coopStarting = false;

  if(coopState.remotePlayerMesh && state.scene){
    state.scene.remove(coopState.remotePlayerMesh);
    coopState.remotePlayerMesh = null;
  }
  if(coopState.remoteAirStrikeCraft && state.scene){
    state.scene.remove(coopState.remoteAirStrikeCraft.root);
    coopState.remoteAirStrikeCraft = null;
  }

  $('#roomCodeDisplay').textContent = '未発行';
  $('#coopStatusText').textContent = 'ステータス: ルームから退出しました';
  const leaveBtn = $('#leaveCoopRoomBtn');
  if(leaveBtn) leaveBtn.style.display = 'none';
  const recruitBtn = $('#recruitCoopBtn');
  if(recruitBtn){
    recruitBtn.disabled = true;
    recruitBtn.textContent = '全体チャットで募集する';
  }
  const cancelBtn = $('#cancelRecruitBtn');
  if(cancelBtn) cancelBtn.style.display = 'none';

  if(state.gameMode === 'home'){
    setModeUI('home', getEquippedSkin(), false, false);
  }
  showToast('共闘ルームから退出しました');
}

function setupCoopDataHandlers(connection){
  coopState.conn = connection;
  connection.on('open', () => {
    coopState.isCoop = true;
    coopState.coopStarting = false;

    if(myActiveRecruitId) cancelMyCoopRecruit(true);

    $('#coopStatusText').textContent = 'ステータス: フレンド接続完了！（北の青いポータルからモード選択して共闘開始）';
    const leaveBtn = $('#leaveCoopRoomBtn');
    if(leaveBtn) leaveBtn.style.display = 'block';
    const recruitBtn = $('#recruitCoopBtn');
    if(recruitBtn) recruitBtn.disabled = true;

    connection.send({
      type: 'hello',
      username: state.username || (coopState.isHost ? 'ホスト' : 'ゲスト')
    });

    if(state.gameMode === 'home'){
      setModeUI('home', getEquippedSkin(), true, coopState.isHost);
      if(!coopState.remotePlayerMesh) createRemotePlayerMesh();
    }
  });

  connection.on('data', (data) => {
    if(!data || !data.type) return;

    if(data.type === 'hello'){
      coopState.remotePos.username = data.username;
      updateRemoteNameLabel(data.username);
      if(coopState.remoteAirStrikeCraft && coopState.remoteAirStrikeCraft.nameSprite){
        coopState.remoteAirStrikeCraft.root.remove(coopState.remoteAirStrikeCraft.nameSprite);
        coopState.remoteAirStrikeCraft.nameSprite = makeTextSprite(T, data.username);
        coopState.remoteAirStrikeCraft.nameSprite.position.set(0, 2.2, 0);
        coopState.remoteAirStrikeCraft.root.add(coopState.remoteAirStrikeCraft.nameSprite);
      }
      showToast(`${data.username} が共闘ルームに参加しました！`);
    } else if(data.type === 'pos'){
      coopState.remotePos.x = data.x;
      coopState.remotePos.y = data.y || 0;
      coopState.remotePos.z = data.z;
      coopState.remotePos.yaw = data.yaw;
      if(data.airStrikePhase) coopState.remotePos.airStrikePhase = data.airStrikePhase;
      if(data.username && data.username !== coopState.remotePos.username){
        coopState.remotePos.username = data.username;
        updateRemoteNameLabel(data.username);
      }
    } else if(data.type === 'startBattle'){
      if(appCallbacks.startBattle){
        appCallbacks.startBattle(data.mode || 'FALL_MISSILE', data.diffId || 'easy', data.missionData || null);
      }
    } else if(data.type === 'abortBattle'){
      state.score = 0;
      state.earnedGoldInMatch = 0;
      state.wave = 1;
      state.peace = 100;
      state.spawned = 0;
      state.tick = 0;
      state.wait = 0;
      state.airStrikeState = null;
      if(appCallbacks.enterHome) appCallbacks.enterHome();
    } else if(data.type === 'leaveCoop'){
      showToast('フレンドが共闘ルームから退出しました');
      leaveCoopRoom();
      if(state.gameMode === 'battle' && appCallbacks.enterHome) appCallbacks.enterHome();
    } else if(data.type === 'spawnEnemy'){
      if(!coopState.isHost && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        const e = spawn(T, state.scene, state.target, state.wave, {}, data.payload.kind, state.modelTemplates, true, data.payload);
        state.enemies.push(e);
      }
    } else if(data.type === 'syncBattleState'){
      if(!coopState.isHost && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        state.wave = data.wave;
        state.peace = data.peace;
        state.score = data.score;
        hud(state.wave, data.remaining, state.peace, getMaxWaves());
        for(const s of data.enemies){
          const en = state.enemies.find(x => x.userData.id === s.id);
          if(en){
            en.position.set(s.px, s.py, s.pz);
            en.userData.hp = s.hp;
          }
        }
      }
    } else if(data.type === 'clientHit'){
      if(coopState.isHost && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        const en = state.enemies.find(x => x.userData.id === data.enemyId);
        if(en){
          applyEnemyDamage(en, data.dmg, data.beamColor, data.scoreMult, {
            isCoop: true,
            isHost: true,
            sendCoop,
            fromRemote: false
          });
        }
      }
    } else if(data.type === 'enemyDestroyed'){
      if(!coopState.isHost && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        const en = state.enemies.find(x => x.userData.id === data.enemyId);
        if(en){
          burst(en.position, 0xffaa00);
          state.scene.remove(en);
          const idx = state.enemies.indexOf(en);
          if(idx !== -1) state.enemies.splice(idx, 1);
        }
        state.score = data.score;
      }
    } else if(data.type === 'battleEnd'){
      if(!coopState.isHost && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        state.score = data.score;
        if(appCallbacks.finishBattle) appCallbacks.finishBattle(data.win);
      }
    } else if(data.type === 'airStrikeDone'){
      coopState.remotePos.airStrikeFinished = true;
      coopState.remotePos.remoteSurvivedM = data.survivedM;
      coopState.remotePos.remoteHitTarget = data.hitTarget;
      if(coopState.remoteAirStrikeCraft){
        coopState.remoteAirStrikeCraft.flameGroup.visible = false;
        coopState.remoteAirStrikeCraft.missileHolder.visible = false;
      }
      if(state.airStrikeState && state.airStrikeState.phase === 'finished'){
        finalizeAirStrikeResult(coopState.isCoop);
      }
    }
  });

  connection.on('close', () => {
    coopState.isCoop = false;
    coopState.conn = null;
    if(coopState.remotePlayerMesh && state.scene){
      state.scene.remove(coopState.remotePlayerMesh);
      coopState.remotePlayerMesh = null;
    }
    if(coopState.remoteAirStrikeCraft && state.scene){
      state.scene.remove(coopState.remoteAirStrikeCraft.root);
      coopState.remoteAirStrikeCraft = null;
    }
    $('#coopStatusText').textContent = 'ステータス: 通信が切断されました';
    const leaveBtn = $('#leaveCoopRoomBtn');
    if(leaveBtn) leaveBtn.style.display = 'none';
  });
}

export function createCoopRoom(){
  cancelMyCoopRecruit(true);
  if(coopState.peer){ try { coopState.peer.destroy(); } catch(e){} }
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  coopState.coopRoomCode = code;
  coopState.isHost = true;
  const peerId = 'spaa-coop-' + code;
  $('#coopStatusText').textContent = 'ステータス: ルーム生成中...';
  const recruitBtn = $('#recruitCoopBtn');
  if(recruitBtn) recruitBtn.disabled = true;

  coopState.peer = new Peer(peerId);
  coopState.peer.on('open', () => {
    $('#roomCodeDisplay').textContent = code;
    $('#coopStatusText').textContent = 'ステータス: ルーム作成完了！全体チャット募集またはID共有で待機中...';
    if(recruitBtn){
      recruitBtn.disabled = false;
      recruitBtn.textContent = '全体チャットで募集する';
    }
    const leaveBtn = $('#leaveCoopRoomBtn');
    if(leaveBtn) leaveBtn.style.display = 'block';
  });
  coopState.peer.on('connection', (c) => setupCoopDataHandlers(c));
  coopState.peer.on('error', (err) => {
    if(err && err.type === 'unavailable-id'){
      createCoopRoom();
      return;
    }
    $('#coopStatusText').textContent = 'エラー: ' + err.message;
  });
}

export function joinCoopRoom(){
  const code = $('#joinCodeInput').value.trim();
  if(code.length !== 4){
    $('#coopStatusText').textContent = 'エラー: 4桁の数字を入力してください';
    return;
  }
  cancelMyCoopRecruit(true);
  if(coopState.peer){ try { coopState.peer.destroy(); } catch(e){} }
  coopState.isHost = false;
  coopState.coopRoomCode = code;
  $('#coopStatusText').textContent = 'ステータス: ルーム ' + code + ' に接続中...';

  coopState.peer = new Peer();
  coopState.peer.on('open', () => {
    const c = coopState.peer.connect('spaa-coop-' + code);
    setupCoopDataHandlers(c);
  });
  coopState.peer.on('error', () => {
    $('#coopStatusText').textContent = '接続エラー: ルームが見つかりません';
  });
}
