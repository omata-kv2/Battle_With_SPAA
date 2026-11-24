import * as T from './libs/three.module.js';
import { CONFIG } from './config.js';
import { state, getEquippedSkin, getDifficultyById } from './state.js';
import { $, showToast, setModeUI, hud } from './ui.js';
import { spawn } from './map-fall-missile.js';
import { applyEnemyDamage, burst, getMaxWaves } from './enemies.js';
import { createAirStrikePlayerActor, finalizeAirStrikeResult, generateAirStrikeMissionData } from './mode-air-strike.js';
import { openCoopWaitModal, closeCoopWaitModal, openCoopInviteModal, closeCoopInviteModal } from './modals.js';
import {
  spawnShortGradientProjectile, spawnDetonationEffect, spawnRemoteRapidTurrets,
  spawnRemoteLaserTurret, updateRemoteLaserBeams, spawnRemoteAutomaticVolley
} from './player.js';

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
  remotePos: {
    x: 0,
    y: 0,
    z: 9,
    yaw: 0,
    pitch: 0,
    username: '',
    airStrikePhase: 'countdown',
    airStrikeFinished: false,
    remoteSurvivedM: 0,
    remoteHitTarget: false
  },
  // 出撃待機・参加要請・ソロ一時切替管理
  pendingOutgoingInvite: null, // { mode, diffId, missionData }
  pendingIncomingInvite: null, // { mode, diffId, missionData, senderName, fromHost }
  battleSoloOverride: false
};

let appCallbacks = {
  startBattle: null,
  enterHome: null,
  finishBattle: null
};

export function bindMultiplayerCallbacks(cbs){
  appCallbacks = { ...appCallbacks, ...cbs };
}

export function resetCoopMatchFlags(){
  coopState.pendingOutgoingInvite = null;
  coopState.pendingIncomingInvite = null;
  coopState.remotePos.airStrikePhase = 'countdown';
  coopState.remotePos.airStrikeFinished = false;
  coopState.remotePos.remoteSurvivedM = 0;
  coopState.remotePos.remoteHitTarget = false;
}

export function sendCoop(payload){
  if(coopState.conn && coopState.conn.open){
    coopState.conn.send(payload);
  }
}

export function getCoopContext(){
  const effectiveCoop = coopState.isCoop && !coopState.battleSoloOverride;
  return {
    isCoop: effectiveCoop,
    isHost: effectiveCoop ? coopState.isHost : false,
    remotePos: coopState.remotePos,
    sendCoop: effectiveCoop ? sendCoop : null
  };
}

// 共闘中に出撃スタートボタンを押した際のフロー制御（待機・参加要請・被り時ホスト優先強制合流）
export function initiateCoopBattleRequest(chosenMode, chosenDiffId, sharedMission){
  if(!coopState.isCoop || !coopState.conn || !coopState.conn.open){
    coopState.battleSoloOverride = false;
    resetCoopMatchFlags();
    if(appCallbacks.startBattle){
      appCallbacks.startBattle(chosenMode, chosenDiffId, sharedMission);
    }
    return;
  }

  // すでに相手からの参加要請が届いている状態で自分もスタートを押した場合（被り発生！）
  if(coopState.pendingIncomingInvite){
    const incoming = coopState.pendingIncomingInvite;
    coopState.pendingIncomingInvite = null;
    closeCoopInviteModal();

    if(coopState.isHost){
      // 自分がホスト：ホスト側の設定を最優先し、相手（参加者）のマップをリセットさせて強制合流
      coopState.battleSoloOverride = false;
      resetCoopMatchFlags();
      sendCoop({
        type: 'forceMergeBattle',
        mode: chosenMode,
        diffId: chosenDiffId,
        missionData: sharedMission
      });
      showToast('出撃が重なったため、ホスト側の設定で強制合流しました！');
      if(appCallbacks.startBattle){
        appCallbacks.startBattle(chosenMode, chosenDiffId, sharedMission);
      }
    } else {
      // 自分が参加者（ゲスト）：自分が建てた設定・マップを破棄し、ホスト側のゲームへ強制合流
      coopState.battleSoloOverride = false;
      resetCoopMatchFlags();
      sendCoop({ type: 'ackForceMerge' });
      showToast('ホスト側のゲーム設定が優先されたため、ホストの戦場へ強制合流します！');
      if(appCallbacks.startBattle){
        appCallbacks.startBattle(incoming.mode, incoming.diffId, incoming.missionData);
      }
    }
    return;
  }

  // 通常の待機開始＆相手へ参加要請を送信
  coopState.battleSoloOverride = false;
  coopState.pendingOutgoingInvite = {
    mode: chosenMode,
    diffId: chosenDiffId,
    missionData: sharedMission
  };
  openCoopWaitModal(chosenMode, chosenDiffId);

  sendCoop({
    type: 'battleInvite',
    mode: chosenMode,
    diffId: chosenDiffId,
    missionData: sharedMission,
    senderName: state.username || (coopState.isHost ? 'ホスト' : 'ゲスト'),
    fromHost: coopState.isHost
  });
}

export function cancelOutgoingBattleInvite(){
  if(!coopState.pendingOutgoingInvite) return;
  coopState.pendingOutgoingInvite = null;
  closeCoopWaitModal();
  sendCoop({ type: 'battleInviteCancelled' });
  showToast('出撃待機をキャンセルしました');
}

export function respondToBattleInvite(accept){
  const inv = coopState.pendingIncomingInvite;
  coopState.pendingIncomingInvite = null;
  closeCoopInviteModal();

  if(!inv) return;

  if(accept){
    coopState.battleSoloOverride = false;
    resetCoopMatchFlags();
    sendCoop({ type: 'battleInviteAccepted' });
    if(appCallbacks.startBattle){
      appCallbacks.startBattle(inv.mode, inv.diffId, inv.missionData);
    }
  } else {
    sendCoop({ type: 'battleInviteDeclined' });
    showToast('参加要請を拒否しました（相手はソロモードで出撃します）');
  }
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
  if(coopState.battleSoloOverride) return;

  if(state.gameMode === 'battle' && state.activeBattleMode === 'AIR_STRIKE'){
    if(state.syncTick % 2 === 0){
      sendCoop({
        type: 'pos',
        x: state.x,
        y: state.y,
        z: state.z,
        yaw: state.yaw,
        pitch: state.pitch,
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
        coopState.remoteAirStrikeCraft.missileHolder.rotation.y = coopState.remotePos.yaw || 0;
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
    let opened = false;
    const openTimeout = setTimeout(() => {
      if(!opened){
        try { c.close(); } catch(e){}
        lobbyHubConn = null;
        scheduleLobbyReconnect();
      }
    }, 4500);

    c.on('open', () => {
      opened = true;
      clearTimeout(openTimeout);
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

  let delivered = false;
  if(isLobbyHub){
    broadcastFromHub({ type: 'chatMsg', payload });
    delivered = true;
  } else if(lobbyHubConn && lobbyHubConn.open){
    lobbyHubConn.send({ type: 'chatMsg', payload });
    delivered = true;
  }
  if(coopState.isCoop && coopState.conn && coopState.conn.open){
    coopState.conn.send({ type: 'chatMsg', payload });
    delivered = true;
  }
  if(!delivered){
    showToast('全体ロビーへ再接続中です…', 2200);
    scheduleLobbyReconnect();
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
  } else {
    showToast('全体ロビー接続待ちのため自動再接続します…', 2400);
    scheduleLobbyReconnect();
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
// PeerJS 共闘ルーム接続・切断・全同期制御
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
  coopState.battleSoloOverride = false;
  resetCoopMatchFlags();

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
    coopState.battleSoloOverride = false;
    resetCoopMatchFlags();

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

    if(data.type === 'chatMsg' && data.payload){
      appendChatMessageToUI(data.payload);
    } else if(data.type === 'hello'){
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
      if(typeof data.pitch === 'number') coopState.remotePos.pitch = data.pitch;
      if(data.airStrikePhase) coopState.remotePos.airStrikePhase = data.airStrikePhase;
      if(data.username && data.username !== coopState.remotePos.username){
        coopState.remotePos.username = data.username;
        updateRemoteNameLabel(data.username);
      }
    } else if(data.type === 'battleInvite'){
      // 出撃参加要請を受信！
      // もし自分もすでに待機中（2人同時にスタートを押して被った）場合
      if(coopState.pendingOutgoingInvite){
        const myOut = coopState.pendingOutgoingInvite;
        coopState.pendingOutgoingInvite = null;
        closeCoopWaitModal();

        if(coopState.isHost){
          // ホスト優先！ホスト側の設定で参加者を強制合流させる
          coopState.battleSoloOverride = false;
          resetCoopMatchFlags();
          sendCoop({
            type: 'forceMergeBattle',
            mode: myOut.mode,
            diffId: myOut.diffId,
            missionData: myOut.missionData
          });
          showToast('出撃が重なったため、ホスト側の設定で強制合流しました！');
          if(appCallbacks.startBattle){
            appCallbacks.startBattle(myOut.mode, myOut.diffId, myOut.missionData);
          }
        } else {
          // 参加者（ゲスト）：自分が作った設定・マップを破棄してホスト側のゲームへ強制合流
          coopState.battleSoloOverride = false;
          resetCoopMatchFlags();
          showToast('ホスト側のゲーム設定が優先されたため、ホストの戦場へ強制合流します！');
          if(appCallbacks.startBattle){
            appCallbacks.startBattle(data.mode, data.diffId, data.missionData);
          }
        }
        return;
      }

      // 自分が待機中でなければ、専用の参加要請画面（参加 / 拒否）を表示
      coopState.pendingIncomingInvite = {
        mode: data.mode,
        diffId: data.diffId,
        missionData: data.missionData,
        senderName: data.senderName,
        fromHost: !!data.fromHost
      };
      openCoopInviteModal(coopState.pendingIncomingInvite);
    } else if(data.type === 'battleInviteCancelled'){
      if(coopState.pendingIncomingInvite){
        coopState.pendingIncomingInvite = null;
        closeCoopInviteModal();
        showToast('相手が出撃待機をキャンセルしました');
      }
    } else if(data.type === 'battleInviteAccepted'){
      const out = coopState.pendingOutgoingInvite;
      coopState.pendingOutgoingInvite = null;
      closeCoopWaitModal();
      if(out){
        coopState.battleSoloOverride = false;
        resetCoopMatchFlags();
        showToast('フレンドが参加しました！共闘バトル開始！');
        if(appCallbacks.startBattle){
          appCallbacks.startBattle(out.mode, out.diffId, out.missionData);
        }
      }
    } else if(data.type === 'battleInviteDeclined'){
      const out = coopState.pendingOutgoingInvite;
      coopState.pendingOutgoingInvite = null;
      closeCoopWaitModal();
      if(out){
        // 拒否された場合：先にステージに入った自分だけのソロモードで開始
        coopState.battleSoloOverride = true;
        resetCoopMatchFlags();
        showToast('参加要請が拒否されたため、ソロモードでゲームを開始します！');
        if(appCallbacks.startBattle){
          appCallbacks.startBattle(out.mode, out.diffId, out.missionData);
        }
      }
    } else if(data.type === 'forceMergeBattle'){
      // ホストからの強制合流命令：参加側の設定・マップをクリアしてホスト側マップのみ開始
      coopState.pendingOutgoingInvite = null;
      coopState.pendingIncomingInvite = null;
      closeCoopWaitModal();
      closeCoopInviteModal();
      coopState.battleSoloOverride = false;
      resetCoopMatchFlags();
      showToast('ホスト側のゲーム設定が優先され、ホストのゲームへ合流しました！');
      if(appCallbacks.startBattle){
        appCallbacks.startBattle(data.mode, data.diffId, data.missionData);
      }
    } else if(data.type === 'startBattle'){
      coopState.pendingOutgoingInvite = null;
      coopState.pendingIncomingInvite = null;
      closeCoopWaitModal();
      closeCoopInviteModal();
      coopState.battleSoloOverride = false;
      resetCoopMatchFlags();
      if(appCallbacks.startBattle){
        appCallbacks.startBattle(data.mode || 'FALL_MISSILE', data.diffId || 'easy', data.missionData || null);
      }
    } else if(data.type === 'requestRetry'){
      // ゲストがリトライを押した際、ホストが受け取って双方リトライ開始
      if(coopState.isHost){
        const sharedMission = state.activeBattleMode === 'AIR_STRIKE'
          ? generateAirStrikeMissionData(CONFIG, state.activeDifficulty)
          : null;
        coopState.battleSoloOverride = false;
        resetCoopMatchFlags();
        sendCoop({
          type: 'startBattle',
          mode: state.activeBattleMode,
          diffId: state.activeDifficulty.id,
          missionData: sharedMission
        });
        if(appCallbacks.startBattle){
          appCallbacks.startBattle(state.activeBattleMode, state.activeDifficulty.id, sharedMission);
        }
      }
    } else if(data.type === 'abortBattle'){
      if(!coopState.battleSoloOverride){
        state.score = 0;
        state.earnedGoldInMatch = 0;
        state.wave = 1;
        state.peace = 100;
        state.spawned = 0;
        state.tick = 0;
        state.wait = 0;
        state.airStrikeState = null;
        resetCoopMatchFlags();
        if(appCallbacks.enterHome) appCallbacks.enterHome();
      }
    } else if(data.type === 'leaveCoop'){
      showToast('フレンドが共闘ルームから退出しました');
      leaveCoopRoom();
      if(state.gameMode === 'battle' && appCallbacks.enterHome) appCallbacks.enterHome();
    } else if(data.type === 'spawnEnemy'){
      if(!coopState.isHost && !coopState.battleSoloOverride && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        const e = spawn(T, state.scene, state.target, state.wave, {}, data.payload.kind, state.modelTemplates, true, data.payload);
        state.enemies.push(e);
      }
    } else if(data.type === 'syncBattleState'){
      if(!coopState.isHost && !coopState.battleSoloOverride && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
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
      if(coopState.isHost && !coopState.battleSoloOverride && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        const en = state.enemies.find(x => x.userData.id === data.enemyId);
        if(en) applyEnemyDamage(en, data.dmg, data.beamColor, data.scoreMult, getCoopContext(), true);
      }
    } else if(data.type === 'destroyEnemy'){
      if(!coopState.isHost && !coopState.battleSoloOverride && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        const idx = state.enemies.findIndex(x => x.userData.id === data.enemyId);
        if(idx >= 0){
          const en = state.enemies[idx];
          burst(en.position, data.beamColor || 0x00f5d4);
          state.scene.remove(en);
          state.enemies.splice(idx, 1);
          hud(state.wave, data.remaining, state.peace, getMaxWaves());
        }
      }
    } else if(data.type === 'battleEnd'){
      if(!coopState.isHost && !coopState.battleSoloOverride && state.gameMode === 'battle' && appCallbacks.finishBattle){
        appCallbacks.finishBattle(data.win);
      }
    } else if(data.type === 'airStrikeFinished'){
      if(!coopState.battleSoloOverride && state.gameMode === 'battle' && state.activeBattleMode === 'AIR_STRIKE' && state.airStrikeState){
        coopState.remotePos.airStrikeFinished = true;
        coopState.remotePos.remoteSurvivedM = data.survivedM || 0;
        coopState.remotePos.remoteHitTarget = !!data.hitTarget;
        if(coopState.remoteAirStrikeCraft){
          coopState.remoteAirStrikeCraft.flameGroup.visible = false;
          burst(coopState.remoteAirStrikeCraft.root.position, data.hitTarget ? 0x00f5d4 : 0xff4d6d);
        }
        if(state.airStrikeState.localFinished){
          finalizeAirStrikeResult(getCoopContext(), appCallbacks.finishBattle);
        } else {
          showToast(`${coopState.remotePos.username || 'フレンド'} が降下終了（記録: ${data.survivedM}m）`);
        }
      }
    } else if(data.type === 'syncShotVisual'){
      // 他プレイヤーの弾・弾道を自分のマップにも描画
      if(!coopState.battleSoloOverride && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        const sPt = new T.Vector3(data.sx, data.sy, data.sz);
        const ePt = new T.Vector3(data.ex, data.ey, data.ez);
        spawnShortGradientProjectile(sPt, ePt, data.beamColor || 0x00f5d4, data.radiusScale || 1.0, null);
      }
    } else if(data.type === 'syncDetonation'){
      // 他プレイヤーの爆発エフェクトを自分のマップにも描画
      if(!coopState.battleSoloOverride && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        const iPt = new T.Vector3(data.ix, data.iy, data.iz);
        spawnDetonationEffect(iPt, data.blastWorldRadius || 3.0, data.mainColor || 0xff9233, null);
      }
    } else if(data.type === 'syncRapidTurrets'){
      // 他プレイヤーの RapidFire 設置タレットを自分のマップにも描画
      if(!coopState.battleSoloOverride && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        spawnRemoteRapidTurrets(data.positions, data.durationSec || 10);
      }
    } else if(data.type === 'syncLaserTurretDeploy'){
      // 他プレイヤーの Laser 四角錐タレット設置を自分のマップにも描画
      if(!coopState.battleSoloOverride && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        spawnRemoteLaserTurret(data.x, data.z, data.mkNumber || 1);
      }
    } else if(data.type === 'syncLaserBeams'){
      // 他プレイヤーの Laser 赤色レーザー照射をリアルタイム同期描画
      if(!coopState.battleSoloOverride && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        updateRemoteLaserBeams(data.beams || []);
      }
    } else if(data.type === 'syncAutomaticVolley'){
      // 他プレイヤーの Automatic 追尾ミサイル弾をリアルタイム同期描画
      if(!coopState.battleSoloOverride && state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
        spawnRemoteAutomaticVolley(data);
      }
    }
  });

  const handleDisconnect = () => {
    const wasInBattle = (state.gameMode === 'battle' && !coopState.battleSoloOverride);
    coopState.isCoop = false;
    coopState.isHost = false;
    coopState.conn = null;
    coopState.battleSoloOverride = false;
    resetCoopMatchFlags();
    if(coopState.remotePlayerMesh && state.scene){
      state.scene.remove(coopState.remotePlayerMesh);
      coopState.remotePlayerMesh = null;
    }
    if(coopState.remoteAirStrikeCraft && state.scene){
      state.scene.remove(coopState.remoteAirStrikeCraft.root);
      coopState.remoteAirStrikeCraft = null;
    }
    $('#coopStatusText').textContent = 'ステータス: フレンドとの接続が切れました';
    const leaveBtn = $('#leaveCoopRoomBtn');
    if(leaveBtn) leaveBtn.style.display = 'none';
    showToast('フレンドとの接続が切断されました');
    if(wasInBattle && appCallbacks.enterHome) appCallbacks.enterHome();
  };

  connection.on('close', handleDisconnect);
  connection.on('error', handleDisconnect);
}

export function createCoopRoom(){
  if(coopState.peer) coopState.peer.destroy();
  const code = String(Math.floor(1000 + Math.random() * 9000));
  coopState.coopRoomCode = code;
  coopState.isHost = true;
  coopState.isCoop = false;
  coopState.battleSoloOverride = false;
  resetCoopMatchFlags();

  $('#roomCodeDisplay').textContent = `ID: ${code}`;
  $('#coopStatusText').textContent = 'ステータス: フレンドの参加を待機中...';

  const recruitBtn = $('#recruitCoopBtn');
  if(recruitBtn){
    recruitBtn.disabled = false;
    recruitBtn.textContent = '全体チャットで募集する';
  }
  const leaveBtn = $('#leaveCoopRoomBtn');
  if(leaveBtn) leaveBtn.style.display = 'block';

  const p = new Peer('spaa-coop-' + code);
  coopState.peer = p;

  p.on('connection', (c) => {
    if(coopState.conn && coopState.conn.open){
      c.close();
      return;
    }
    setupCoopDataHandlers(c);
  });

  p.on('error', (err) => {
    $('#coopStatusText').textContent = `ステータス: 通信エラー (${err.type})`;
  });
}

export function joinCoopRoom(){
  const raw = ($('#joinCodeInput').value || '').trim();
  if(!/^\d{4}$/.test(raw)){
    $('#coopStatusText').textContent = 'ステータス: 4桁の数字を入力してください';
    return;
  }
  if(coopState.peer) coopState.peer.destroy();
  coopState.isHost = false;
  coopState.isCoop = false;
  coopState.coopRoomCode = raw;
  coopState.battleSoloOverride = false;
  resetCoopMatchFlags();
  $('#coopStatusText').textContent = `ステータス: ルーム ${raw} に接続中...`;

  const p = new Peer();
  coopState.peer = p;

  p.on('open', () => {
    const c = p.connect('spaa-coop-' + raw, { reliable: true });
    setupCoopDataHandlers(c);
  });

  p.on('error', (err) => {
    $('#coopStatusText').textContent = `ステータス: 接続失敗 (${err.type})`;
  });
}
