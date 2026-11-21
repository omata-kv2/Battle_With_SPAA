import * as T from './libs/three.module.js';
import {GLTFLoader} from './libs/examples/jsm/loaders/GLTFLoader.js';
import {CONFIG} from './config.js';
import {$,progress,loading,loadError,hideStartScreen,showEndScreen,hideEndScreen,triggerWhiteFadeOut,resetWhiteFade,setModeUI,showToast,updateHoldGauge,updateChargeGauge,updateSkillButtonUI,updateFireButtonUI,hud,airStrikeHud,announce} from './ui.js';
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
let unlockedSkins=['Origin'];
let selectedSkinId='Origin';
let pendingSelectedSkinId='Origin';
let skinUpgrades={};

let homeController=null,skinController=null;
let triggerCooldown=0,panelHoldTime=0,lastFrameTime=performance.now();
const pendingShotTimers=new Set();

// ゲームモード & 難易度設定状態
let selectedBattleMode = null;   // 'FALL_MISSILE' | 'AIR_STRIKE'
let selectedDifficultyId = null; // 'easy' | 'normal' | 'hard' | 'very_hard' | 'hardcore' | 'insane'
let activeBattleMode = 'FALL_MISSILE';
let activeDifficulty = CONFIG.DIFFICULTIES[0];

// ==========================================
// V4.6 機体固有能力 & 特殊攻撃（光線柱・曲線追尾弾・4頂点・チャージ・散弾・タレット）状態
// ==========================================
const combatState = {
  skillActiveTimer: 0,       // 固有能力の残り持続秒数
  skillCooldownTimer: 0,     // 固有能力の残りクールダウン秒数
  attackCooldownTimer: 0,    // 通常攻撃の残りクールダウン秒数
  isCharging: false,         // Explosion 溜め中フラグ
  chargeElapsed: 0,          // Explosion 溜め経過秒数
  fireHeld: false,           // 射撃ボタン/スペースキー押下中フラグ
  autoFireTimer: 0,          // 連続発射タイマー
  turrets: [],               // RapidFire 固有能力 AdditionalTurre で設置されたタレット一覧
  laserActiveTimer: 0,       // Laser 光線柱の残り照射秒数
  laserTickTimer: 0,         // Laser 継続ダメージ判定タイマー
  laserRadiusMult: 1.0,      // Laser 光線半径倍率（NeverStopper中は1.25〜1.7）
  laserBeamGroup: null,      // Laser 光線柱の3Dメッシュグループ
  homingProjectiles: []      // Automatic 60°スプリンクラー曲線自動追尾弾一覧
};

function clearPendingShots(){
  for(const tid of pendingShotTimers){
    clearTimeout(tid);
  }
  pendingShotTimers.clear();
}

function clearLaserVisual(){
  if(combatState.laserBeamGroup && scene){
    scene.remove(combatState.laserBeamGroup);
  }
  combatState.laserBeamGroup = null;
}

function resetCombatState(){
  clearPendingShots();
  combatState.skillActiveTimer = 0;
  combatState.skillCooldownTimer = 0;
  combatState.attackCooldownTimer = 0;
  combatState.isCharging = false;
  combatState.chargeElapsed = 0;
  combatState.fireHeld = false;
  combatState.autoFireTimer = 0;
  combatState.laserActiveTimer = 0;
  combatState.laserTickTimer = 0;
  combatState.laserRadiusMult = 1.0;
  clearLaserVisual();

  for(const t of combatState.turrets){
    if(t.mesh && scene) scene.remove(t.mesh);
  }
  combatState.turrets.length = 0;

  for(const hp of combatState.homingProjectiles){
    if(hp.mesh && scene) scene.remove(hp.mesh);
  }
  combatState.homingProjectiles.length = 0;

  updateChargeGauge(0);
}

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
// 機体データ・アップグレード・固有能力計算・セーブ/ロード
// ==========================================
function migrateSkinId(id){
  if(!id) return 'Origin';
  if(CONFIG.LEGACY_SKIN_MAP[id]) return CONFIG.LEGACY_SKIN_MAP[id];
  return id;
}

function getSkinUpgrade(skinId){
  const normId = migrateSkinId(skinId);
  if(!skinUpgrades[normId]){
    skinUpgrades[normId] = {
      atk: 1, def: 1, hp: 1, rate: 1, score: 1, blast: 1,
      duration: 1, volley: 1, vertexShots: 1,
      faith: 1, gayPower: 1, saint: 1,
      skill: 1
    };
  }
  const u = skinUpgrades[normId];
  const keysList = ['atk', 'def', 'hp', 'rate', 'score', 'blast', 'duration', 'volley', 'vertexShots', 'faith', 'gayPower', 'saint', 'skill'];
  for(const k of keysList){
    if(typeof u[k] !== 'number') u[k] = 1;
  }
  return u;
}

function getEquippedSkin(){
  return CONFIG.SKINS.find(s=>s.id===selectedSkinId) || CONFIG.SKINS[0];
}

function getEffectiveStats(skin){
  const upg = getSkinUpgrade(skin.id);
  const skillLv = Math.max(1, Math.min(skin.skill.maxLv || 10, upg.skill));

  // V4.6全体変更: 防御力は1レベルごとに +1 上昇、体力は1レベルごとに +10 上昇
  // Beast専用アップグレード（信仰力・GAY力・聖人力）反映
  const faithBonus = skin.id === 'Beast' ? (upg.faith - 1) * 2 : 0;
  const saintHpBonus = skin.id === 'Beast' ? (upg.saint - 1) * 20 : 0;
  const saintShotBonus = skin.id === 'Beast' ? (upg.saint - 1) * 1 : 0;
  const gayScoreBonus = skin.id === 'Beast' ? (upg.gayPower - 1) * 0.10 : 0;

  const effectiveAtk = skin.stats.baseAtk + (upg.atk - 1) * 1 + faithBonus;
  const effectiveDef = 0 + (upg.def - 1) * 1 + faithBonus;
  const effectiveHp  = 100 + (upg.hp - 1) * 10 + saintHpBonus;
  const rawRate      = skin.stats.baseRate + (upg.rate - 1) * 0.5;
  const shotCount    = Math.max(1, Math.floor(rawRate) + saintShotBonus);

  // 獲得スコア上昇: 通常は1レベルごと +5%、BeastのGAY力は1レベルごと +10%
  const scoreMult    = skin.stats.scoreMult + (upg.score - 1) * 0.05 + gayScoreBonus;

  // Explosion: 爆発範囲半径(m) 初期1m、1レベルごと +0.2m
  const blastRadiusM = (skin.baseBlastRadiusM || 1.0) + (upg.blast - 1) * 0.2;

  // Laser: 光線持続時間（初期3.0s、1lvごと +0.2s、Max Lv10）
  const laserDurationSec = Number(((skin.baseLaserDuration || 3.0) + (upg.duration - 1) * 0.2).toFixed(1));

  // Automatic: 発射弾数（初期2発、弾数増加Lv10で11発）
  const autoVolleyCount = (skin.baseVolleyCount || 2) + (upg.volley - 1);

  // Wirbelwind: 各頂点の発射数（基本1発 + vertexShots追加分、Lv5で各頂点に+5発追加）
  const wirbelVertexShots = 1 + upg.vertexShots;

  // 各固有能力のレベル別数値
  // 1. OriginBurst: lv1=5体 〜 lv10=30体
  const originBurstTargets = Math.round(5 + (skillLv - 1) * (25 / 9));
  // 2. AdditionalTurre: lv1=連射力1 〜 lv10=連射力10
  const turretFireRate = skillLv;
  // 3. FewCharger: lv1=0.5秒短縮 〜 lv10=1.4秒短縮
  const fewChargerReduction = Number((0.5 + (skillLv - 1) * 0.1).toFixed(1));
  // 4. InfinityBarrel: lv1=1.1倍 〜 lv10=2.0倍
  const infinitySpreadMult = Number((1.1 + (skillLv - 1) * (0.9 / 9)).toFixed(2));
  // 5. NeverStopper: 持続時間 10 + skillLv*0.5（最大15秒）、光線半径倍率 1.2 + skillLv*0.05（最大1.7倍）
  const neverStopperDuration = Number(Math.min(15.0, 10.0 + skillLv * 0.5).toFixed(1));
  const neverStopperRadiusMult = Number(Math.min(1.7, 1.2 + skillLv * 0.05).toFixed(2));
  // 6. MultiBurst: 追加弾獲得（lv1: +1発 〜 lv10: +10発）
  const multiBurstExtraShots = skillLv;
  // 7. GermanTech: 上空の飛翔体破壊数（lv1: 12個 〜 lv10: 30個）
  const germanTechTargets = Math.round(12 + (skillLv - 1) * (18 / 9));
  // 8. BeastEyesPower: クールダウン（lv1: 1.0秒 〜 lv10: 0秒）
  const beastEyesCooldown = skillLv >= 10 ? 0 : Number(Math.max(0.1, 1.0 - (skillLv - 1) * 0.1).toFixed(1));

  return {
    atk: effectiveAtk,
    def: effectiveDef,
    hp: effectiveHp,
    rawRate,
    shotCount,
    scoreMult,
    blastRadiusM,
    laserDurationSec,
    autoVolleyCount,
    wirbelVertexShots,
    skillLv,
    originBurstTargets,
    turretFireRate,
    fewChargerReduction,
    infinitySpreadMult,
    neverStopperDuration,
    neverStopperRadiusMult,
    multiBurstExtraShots,
    germanTechTargets,
    beastEyesCooldown
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
  if(savedGold!==null){
    const parsedGold = parseInt(savedGold, 10);
    if(!Number.isNaN(parsedGold)) gold = parsedGold;
  }
  
  const savedUnlocked=localStorage.getItem('spaa_unlocked_skins');
  if(savedUnlocked){
    try{
      const arr=JSON.parse(savedUnlocked);
      if(Array.isArray(arr) && arr.length>0){
        unlockedSkins = Array.from(new Set(arr.map(migrateSkinId)));
      }
    }catch(e){}
  }
  if(!unlockedSkins.includes('Origin')) unlockedSkins.unshift('Origin');

  const savedSelected=localStorage.getItem('spaa_selected_skin');
  if(savedSelected){
    const migrated = migrateSkinId(savedSelected);
    if(unlockedSkins.includes(migrated)){
      selectedSkinId = migrated;
    }
  }

  const savedUpgrades=localStorage.getItem('spaa_skin_upgrades');
  if(savedUpgrades){
    try{
      const obj=JSON.parse(savedUpgrades);
      if(obj && typeof obj==='object'){
        const migratedObj = {};
        for(const [k, v] of Object.entries(obj)){
          migratedObj[migrateSkinId(k)] = v;
        }
        skinUpgrades = migratedObj;
      }
    }catch(e){}
  }
}

function saveGameData(){
  localStorage.setItem('spaa_username', username);
  localStorage.setItem('spaa_gold', String(gold));
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
  resetCombatState();
}

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
          出撃機体: <b>${getEquippedSkin().name}</b>（固有能力: <b>${getEquippedSkin().skill.name}</b>）
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
  const eff = getEffectiveStats(skin);
  setModeUI('battle', skin, isCoop, isHost, activeBattleMode);
  updateSkillButtonUI(skin.skill.name, eff.skillLv, 'ready', 0);

  if(skin.attackType === 'explosion'){
    updateFireButtonUI('CHARGE\n1.5s', '');
  } else if(skin.attackType === 'scatter'){
    updateFireButtonUI('SCATTER', '');
  } else if(skin.attackType === 'laser'){
    updateFireButtonUI(`LASER\n${eff.laserDurationSec}s`, '');
  } else if(skin.attackType === 'automatic'){
    updateFireButtonUI(`AUTO\n×${eff.autoVolleyCount}`, '');
  } else if(skin.attackType === 'wirbelwind'){
    updateFireButtonUI('4-QUAD', '');
  } else if(skin.attackType === 'beast'){
    updateFireButtonUI('BEAST', '');
  } else {
    updateFireButtonUI('PULSE', '');
  }

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
  announce(`${modeLabel}[${activeDifficulty.name}] WAVE ${wave} / ${getMaxWaves()} — [${skin.name}]`);
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

  flameGroup.rotation.x = -Math.PI / 2;
  flameGroup.userData.outerCone = outerCone;
  flameGroup.userData.innerCone = innerCone;
  return flameGroup;
}

function createAirStrikePlayerActor(isRemote = false, labelName = ''){
  const root = new T.Group();

  const jetTemplate = modelTemplates.fighter || makeTarget(T);
  const jetMesh = jetTemplate.clone(true);
  jetMesh.scale.multiplyScalar(1.35);
  root.add(jetMesh);

  const missileHolder = new T.Group();
  const missileTemplate = modelTemplates.missile || makeTarget(T);
  const missileMesh = missileTemplate.clone(true);
  missileMesh.scale.multiplyScalar(1.2);
  missileHolder.add(missileMesh);

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

  const spawnX = isCoop ? (isHost ? -4.0 : 4.0) : 0.0;
  const spawnY = CONFIG.AIR_STRIKE.START_Y;
  const spawnZ = 0.0;

  x = spawnX;
  y = spawnY;
  z = spawnZ;
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
    phase: 'countdown',
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

function updateAirStrikeDynamicObstacles(dt, totalTime){
  if(!airStrikeState) return;
  const { obstacles, obstacleMeshes } = airStrikeState;

  for(let i = 0; i < obstacles.length; i++){
    const obs = obstacles[i];
    const mesh = obstacleMeshes[i];

    if(obs.rotSpeedY){
      obs.ry = (obs.ry || 0) + obs.rotSpeedY * dt;
    }

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

function checkAirStrikeCollision(px, py, pz, obstacles){
  const missileRadius = 0.52;

  for(const obs of obstacles){
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
      const ry = obs.ry || 0;
      if(checkRodSegmentHit(px, py, pz, obs.px, obs.py, obs.pz, 0, ry, Math.PI / 2, obs.length, obs.radius, missileRadius)){
        return obs;
      }
      if(checkRodSegmentHit(px, py, pz, obs.px, obs.py, obs.pz, Math.PI / 2, ry, 0, obs.length, obs.radius, missileRadius)){
        return obs;
      }
    } else if(obs.kind === 'ring'){
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

  if(st.targetGroup){
    st.targetGroup.rotation.y += dt * 1.6;
  }

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
    const vyUnits = -(CONFIG.AIR_STRIKE.DESCENT_SPEED_MPS * 0.5);
    x = T.MathUtils.clamp(x + vx * dt, -28, 28);
    z = T.MathUtils.clamp(z + vz * dt, -28, 28);
    y = Math.max(0, y + vyUnits * dt);

    st.jetPos.z -= 1.5 * dt;
    st.myActor.jetMesh.position.set(st.jetPos.x - x, st.jetPos.y - y, st.jetPos.z - z);

    st.myActor.root.position.set(x, y, z);
    st.myActor.missileHolder.position.set(0, 0, 0);
    st.myActor.missileHolder.lookAt(x + vx * 0.35, y + vyUnits * 1.2, z + vz * 0.35);

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

    const currentAltM = Math.max(0, Math.min(100, y * 2));
    st.survivedM = Math.max(0, Math.min(100, Math.round(100 - currentAltM)));
    const liveScore = CONFIG.AIR_STRIKE.SCORE_PER_METER * st.survivedM;
    airStrikeHud(currentAltM, st.survivedM, liveScore);

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
// V4.6 固有能力発動 & 各機体特殊システム（Laser光線柱 / Automatic追尾弾 / Wirbelwind / Beast）
// ==========================================
function spawnAdditionalTurret(turretRate){
  const forward = new T.Vector3(0, 0, -1).applyAxisAngle(new T.Vector3(0, 1, 0), yaw);
  const tx = T.MathUtils.clamp(x + forward.x * 2.5, -17, 17);
  const tz = T.MathUtils.clamp(z + forward.z * 2.5, -17, 17);
  const groundY = -2.0;
  const pyramidH = 1.15;

  const group = new T.Group();
  group.position.set(tx, groundY, tz);

  const ring = new T.Mesh(
    new T.RingGeometry(0.62, 0.85, 4),
    new T.MeshBasicMaterial({color: 0x00f5d4, side: T.DoubleSide})
  );
  ring.rotation.x = -Math.PI / 2;
  ring.rotation.z = Math.PI / 4;
  ring.position.y = 0.03;
  group.add(ring);

  const pyramid = new T.Mesh(
    new T.ConeGeometry(0.68, pyramidH, 4),
    new T.MeshStandardMaterial({
      color: 0x4de680,
      emissive: 0x166534,
      emissiveIntensity: 0.45,
      metalness: 0.5,
      roughness: 0.3
    })
  );
  pyramid.position.y = pyramidH / 2;
  pyramid.rotation.y = Math.PI / 4;
  group.add(pyramid);

  const apexOrb = new T.Mesh(
    new T.SphereGeometry(0.14, 8, 8),
    new T.MeshBasicMaterial({color: 0xffffff})
  );
  apexOrb.position.set(0, pyramidH, 0);
  group.add(apexOrb);

  scene.add(group);
  burst(new T.Vector3(tx, groundY + pyramidH, tz), 0x4de680);

  combatState.turrets.push({
    mesh: group,
    apexOrb,
    apexWorld: new T.Vector3(tx, groundY + pyramidH, tz),
    life: 10.0,
    fireRate: turretRate,
    fireTimer: 0
  });
}

// Laser: 視認性確保のため通常の弾発射位置よりも目線の少し前方下から光線の柱を発生させる
function getLaserStartOrigin(){
  const forward = new T.Vector3();
  camera.getWorldDirection(forward);
  const up = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  // 目線の少し先（1.4m前方）かつ少し下（0.24m下）から発生させて視界の邪魔にならないようにする
  return camera.position.clone()
    .addScaledVector(forward, 1.4)
    .addScaledVector(up, -0.24);
}

function startLaserBeam(durationSec, radiusMult = 1.0){
  combatState.laserActiveTimer = durationSec;
  combatState.laserTickTimer = 0;
  combatState.laserRadiusMult = radiusMult;

  if(!combatState.laserBeamGroup){
    const grp = new T.Group();
    const coreMat = new T.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92
    });
    const coreCyl = new T.Mesh(new T.CylinderGeometry(0.11, 0.14, 1, 12), coreMat);

    const auraMat = new T.MeshBasicMaterial({
      color: 0xff4d6d,
      transparent: true,
      opacity: 0.45
    });
    const auraCyl = new T.Mesh(new T.CylinderGeometry(0.28, 0.34, 1, 12), auraMat);

    const muzzleSphere = new T.Mesh(
      new T.SphereGeometry(0.24, 10, 10),
      new T.MeshBasicMaterial({color: 0xff8fa3})
    );

    grp.add(coreCyl, auraCyl, muzzleSphere);
    grp.userData.coreCyl = coreCyl;
    grp.userData.auraCyl = auraCyl;
    grp.userData.muzzleSphere = muzzleSphere;
    scene.add(grp);
    combatState.laserBeamGroup = grp;
  }

  // 発動直後に即1回判定を行う
  applyLaserColumnDamage();
}

function applyLaserColumnDamage(){
  const skin = getEquippedSkin();
  const eff = getEffectiveStats(skin);
  const origin = getLaserStartOrigin();
  const dir = new T.Vector3();
  camera.getWorldDirection(dir);

  const hitRadius = skin.stats.beamRadius * combatState.laserRadiusMult;
  const ray = new T.Raycaster(origin, dir, 0, 130);

  // 光線柱に触れている上空の飛翔体すべてにダメージ
  const targetsHit = [];
  for(const e of enemies){
    const c = new T.Vector3();
    new T.Box3().setFromObject(e).getCenter(c);
    const dist = ray.ray.distanceToPoint(c);
    if(dist < hitRadius){
      targetsHit.push(e);
    }
  }

  for(const hitEn of targetsHit){
    if(!enemies.includes(hitEn)) continue;
    if(isCoop && !isHost){
      burst(hitEn.position, 0xff4d6d);
      if(conn && conn.open){
        conn.send({
          type: 'clientHit',
          enemyId: hitEn.userData.id,
          dmg: eff.atk,
          beamColor: 0xff4d6d,
          scoreMult: eff.scoreMult
        });
      }
    } else {
      applyEnemyDamage(hitEn, eff.atk, 0xff4d6d, eff.scoreMult, false);
    }
  }
}

function destroyTargetsList(targetsToDestroy, beamColor, eff){
  const originPt = camera.position.clone().add(new T.Vector3(0, -0.3, 0));
  let destroyedCount = 0;

  for(const en of targetsToDestroy){
    if(!enemies.includes(en)) continue;
    const targetPos = en.position.clone();

    const beam = new T.Mesh(
      new T.CylinderGeometry(0.06, 0.12, 1, 6),
      new T.MeshBasicMaterial({color: beamColor})
    );
    beam.position.copy(originPt).add(targetPos).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), targetPos.clone().sub(originPt).normalize());
    beam.scale.y = originPt.distanceTo(targetPos);
    scene.add(beam);
    fx.push({m: beam, life: 14});

    if(isCoop && !isHost){
      burst(targetPos, beamColor);
      if(conn && conn.open){
        conn.send({
          type: 'clientHit',
          enemyId: en.userData.id,
          dmg: 9999,
          beamColor: beamColor,
          scoreMult: eff.scoreMult
        });
      }
    } else {
      applyEnemyDamage(en, 9999, beamColor, eff.scoreMult, false);
    }
    destroyedCount++;
  }
  return destroyedCount;
}

function activateUnitSkill(){
  if(gameMode !== 'battle' || activeBattleMode !== 'FALL_MISSILE' || modalOpen) return;
  if(combatState.skillCooldownTimer > 0 || combatState.skillActiveTimer > 0){
    return;
  }

  const skin = getEquippedSkin();
  const eff = getEffectiveStats(skin);
  const skill = skin.skill;

  // BeastEyesPower は Lv10 でクールダウン0秒
  const actualCooldown = (skill.id === 'BeastEyesPower') ? eff.beastEyesCooldown : skill.cooldown;
  combatState.skillCooldownTimer = actualCooldown;

  if(skill.id === 'NeverStopper'){
    // NeverStopper: 能力使用時、10秒〜15秒間光線を持続させ、光線の半径を1.25倍〜1.7倍にする
    combatState.skillActiveTimer = eff.neverStopperDuration;
    combatState.attackCooldownTimer = 0;
    startLaserBeam(eff.neverStopperDuration, eff.neverStopperRadiusMult);
    showToast(`【NeverStopper Lv.${eff.skillLv}】${eff.neverStopperDuration}秒間光線柱持続（半径${eff.neverStopperRadiusMult}倍）！`);
    return;
  }

  if(skill.duration > 0){
    combatState.skillActiveTimer = skill.duration;
  }

  if(skill.id === 'OriginBurst'){
    const maxClear = eff.originBurstTargets;
    const sorted = [...enemies].sort((a, b) => a.position.y - b.position.y).slice(0, maxClear);
    const destroyedCount = destroyTargetsList(sorted, 0x00f5d4, eff);
    showToast(`【OriginBurst Lv.${eff.skillLv}】上空の飛翔体 ${destroyedCount}体（上限${maxClear}体）を一掃！`);
  } else if(skill.id === 'AdditionalTurre'){
    spawnAdditionalTurret(eff.turretFireRate);
    showToast(`【AdditionalTurre Lv.${eff.skillLv}】追加タレット設置！（10秒間 / 連射力${eff.turretFireRate}）`);
  } else if(skill.id === 'FewCharger'){
    const newCharge = Math.max(0.05, skin.chargeTime - eff.fewChargerReduction);
    showToast(`【FewCharger Lv.${eff.skillLv}】10秒間 溜め時間 -${eff.fewChargerReduction}秒（${newCharge.toFixed(1)}秒）！`);
  } else if(skill.id === 'InfinityBarrel'){
    combatState.attackCooldownTimer = 0;
    showToast(`【InfinityBarrel Lv.${eff.skillLv}】10秒間 撃ち放題＆拡散範囲 ${eff.infinitySpreadMult}倍！`);
  } else if(skill.id === 'MultiBurst'){
    // MultiBurst: 10秒間、戦闘機を優先して攻撃する弾に変更＆追加弾獲得（Lv1:+1発〜Lv10:+10発）
    showToast(`【MultiBurst Lv.${eff.skillLv}】10秒間 戦闘機優先追尾＆追加弾 +${eff.multiBurstExtraShots}発！`);
  } else if(skill.id === 'GermanTech'){
    // GermanTech: 上空の飛翔体を破壊（Lv1:12個 〜 Lv10:30個）
    const maxClear = eff.germanTechTargets;
    const sorted = [...enemies].sort((a, b) => a.position.y - b.position.y).slice(0, maxClear);
    const destroyedCount = destroyTargetsList(sorted, 0x00f5d4, eff);
    showToast(`【GermanTech Lv.${eff.skillLv}】上空の飛翔体 ${destroyedCount}個（上限${maxClear}個）を撃破！`);
  } else if(skill.id === 'BeastEyesPower'){
    // BeastEyesPower: 出現した飛翔体を全て破壊（Lv1:CD 1秒 〜 Lv10:CDなし）
    const allTargets = [...enemies];
    const destroyedCount = destroyTargetsList(allTargets, 0xffffff, eff);
    const cdText = actualCooldown === 0 ? 'CDなし' : `CD ${actualCooldown}秒`;
    showToast(`【BeastEyesPower Lv.${eff.skillLv}】出現中の全飛翔体 ${destroyedCount}体を完全消滅！（${cdText}）`);
  }
}

function updateCombatSystem(dt){
  if(gameMode !== 'battle' || activeBattleMode !== 'FALL_MISSILE') return;

  const skin = getEquippedSkin();
  const eff = getEffectiveStats(skin);

  // 1. 固有能力タイマー & ボタンUI更新
  if(combatState.skillActiveTimer > 0){
    combatState.skillActiveTimer = Math.max(0, combatState.skillActiveTimer - dt);
  }
  if(combatState.skillCooldownTimer > 0){
    combatState.skillCooldownTimer = Math.max(0, combatState.skillCooldownTimer - dt);
  }

  if(combatState.skillActiveTimer > 0){
    updateSkillButtonUI(skin.skill.name, eff.skillLv, 'active', combatState.skillActiveTimer);
  } else if(combatState.skillCooldownTimer > 0){
    updateSkillButtonUI(skin.skill.name, eff.skillLv, 'cooldown', combatState.skillCooldownTimer);
  } else {
    updateSkillButtonUI(skin.skill.name, eff.skillLv, 'ready', 0);
  }

  // 2. 通常攻撃クールダウン更新（Scatter: 0.5s / Laser: 1.0s / Automatic: 1.0s）
  const isInfinityActive = (skin.skill.id === 'InfinityBarrel' && combatState.skillActiveTimer > 0);
  if(isInfinityActive){
    combatState.attackCooldownTimer = 0;
  } else if(combatState.attackCooldownTimer > 0 && combatState.laserActiveTimer <= 0){
    combatState.attackCooldownTimer = Math.max(0, combatState.attackCooldownTimer - dt);
  }

  // 3. 機体タイプ別の継続処理 & UI更新
  if(skin.attackType === 'laser'){
    if(combatState.laserActiveTimer > 0){
      combatState.laserActiveTimer = Math.max(0, combatState.laserActiveTimer - dt);
      const totalDur = (skin.skill.id === 'NeverStopper' && combatState.skillActiveTimer > 0)
        ? eff.neverStopperDuration
        : eff.laserDurationSec;
      const ratio = Math.min(1, combatState.laserActiveTimer / Math.max(0.1, totalDur));
      updateChargeGauge(ratio, `LASER BEAMING ${combatState.laserActiveTimer.toFixed(1)}s`);
      updateFireButtonUI(`照射中\n${combatState.laserActiveTimer.toFixed(1)}s`, 'laser-active');

      // 光線柱メッシュを現在の目線の先へ追従更新
      if(combatState.laserBeamGroup){
        const origin = getLaserStartOrigin();
        const dir = new T.Vector3();
        camera.getWorldDirection(dir);
        const beamLen = 95;
        const endPt = origin.clone().addScaledVector(dir, beamLen);

        combatState.laserBeamGroup.position.copy(origin).add(endPt).multiplyScalar(0.5);
        combatState.laserBeamGroup.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);

        const rScale = combatState.laserRadiusMult;
        const pulse = 0.92 + Math.sin(syncTick * 0.6) * 0.12;
        combatState.laserBeamGroup.userData.coreCyl.scale.set(rScale * pulse, beamLen, rScale * pulse);
        combatState.laserBeamGroup.userData.auraCyl.scale.set(rScale * pulse, beamLen, rScale * pulse);
        combatState.laserBeamGroup.userData.muzzleSphere.position.set(0, -beamLen * 0.5, 0);
        combatState.laserBeamGroup.userData.muzzleSphere.scale.setScalar(rScale * pulse);
      }

      // 0.25秒ごとに光線内の飛翔体へ継続ダメージ
      combatState.laserTickTimer += dt;
      if(combatState.laserTickTimer >= 0.25){
        combatState.laserTickTimer = 0;
        applyLaserColumnDamage();
      }

      // 照射時間が終了したら1秒のクールダウンに入る
      if(combatState.laserActiveTimer <= 0){
        clearLaserVisual();
        combatState.laserRadiusMult = 1.0;
        combatState.attackCooldownTimer = skin.attackCooldown || 1.0;
      }
    } else {
      clearLaserVisual();
      updateChargeGauge(0);
      if(combatState.attackCooldownTimer > 0){
        updateFireButtonUI(`CD\n${combatState.attackCooldownTimer.toFixed(1)}s`, 'cooldown');
      } else {
        updateFireButtonUI(`LASER\n${eff.laserDurationSec}s`, '');
        if(combatState.fireHeld){
          startLaserBeam(eff.laserDurationSec, 1.0);
        }
      }
    }
  } else if(skin.attackType === 'explosion'){
    const reduction = (skin.skill.id === 'FewCharger' && combatState.skillActiveTimer > 0)
      ? eff.fewChargerReduction
      : 0;
    const reqCharge = Math.max(0.05, skin.chargeTime - reduction);

    if(combatState.isCharging){
      combatState.chargeElapsed += dt;
      const ratio = Math.min(1, combatState.chargeElapsed / reqCharge);
      updateChargeGauge(ratio, `CHARGING ${combatState.chargeElapsed.toFixed(1)}s / ${reqCharge.toFixed(1)}s`);
      updateFireButtonUI(`溜め中\n${Math.round(ratio * 100)}%`, 'charging');

      if(combatState.chargeElapsed >= reqCharge){
        combatState.isCharging = false;
        combatState.chargeElapsed = 0;
        updateChargeGauge(0);
        executeExplosionAttack(skin, eff);
      }
    } else {
      updateChargeGauge(0);
      updateFireButtonUI(`CHARGE\n${reqCharge.toFixed(1)}s`, '');
    }
  } else if(skin.attackType === 'scatter'){
    updateChargeGauge(0);
    if(isInfinityActive){
      updateFireButtonUI('FREE\nFIRE!', 'infinity');
      if(combatState.fireHeld){
        combatState.autoFireTimer += dt;
        if(combatState.autoFireTimer >= 0.08){
          combatState.autoFireTimer = 0;
          executeScatterAttack(skin, eff, true);
        }
      }
    } else if(combatState.attackCooldownTimer > 0){
      updateFireButtonUI(`CD\n${combatState.attackCooldownTimer.toFixed(1)}s`, 'cooldown');
    } else {
      updateFireButtonUI('SCATTER', '');
      if(combatState.fireHeld){
        executeScatterAttack(skin, eff, false);
      }
    }
  } else if(skin.attackType === 'automatic'){
    updateChargeGauge(0);
    const isMultiBurst = (skin.skill.id === 'MultiBurst' && combatState.skillActiveTimer > 0);
    const totalVolley = eff.autoVolleyCount + (isMultiBurst ? eff.multiBurstExtraShots : 0);
    if(combatState.attackCooldownTimer > 0){
      updateFireButtonUI(`CD\n${combatState.attackCooldownTimer.toFixed(1)}s`, 'cooldown');
    } else {
      updateFireButtonUI(`AUTO\n×${totalVolley}`, isMultiBurst ? 'infinity' : '');
      if(combatState.fireHeld){
        executeAutomaticVolley(skin, eff);
      }
    }
  } else if(skin.attackType === 'beast'){
    updateChargeGauge(0);
    updateFireButtonUI('BEAST', '');
    // クールダウンなし連射対応
    if(combatState.fireHeld){
      combatState.autoFireTimer += dt;
      if(combatState.autoFireTimer >= 0.07){
        combatState.autoFireTimer = 0;
        executeBeastAttack(skin, eff);
      }
    }
  } else {
    updateChargeGauge(0);
    updateFireButtonUI(skin.attackType === 'wirbelwind' ? '4-QUAD' : 'PULSE', '');
  }

  // 4. Automatic 曲線自動追尾弾の飛行・誘導更新
  updateHomingProjectiles(dt, eff);

  // 5. RapidFire 固有能力 AdditionalTurre タレット更新
  for(let i = combatState.turrets.length - 1; i >= 0; i--){
    const tr = combatState.turrets[i];
    tr.life -= dt;
    tr.apexOrb.rotation.y += dt * 4;
    tr.apexOrb.scale.setScalar(0.9 + Math.sin(syncTick * 0.35) * 0.2);

    if(tr.life <= 0){
      burst(tr.apexWorld, 0x4de680);
      scene.remove(tr.mesh);
      combatState.turrets.splice(i, 1);
      continue;
    }

    const interval = 1.0 / Math.max(1, tr.fireRate);
    tr.fireTimer += dt;
    while(tr.fireTimer >= interval){
      tr.fireTimer -= interval;
      fireTurretHomingPulse(tr.apexWorld, eff);
    }
  }
}

// ==========================================
// Automatic 専用：1発目は視線正面、2発目以降は60°スプリンクラー射出＆被り回避高追尾
// ==========================================
function executeAutomaticVolley(skin, eff){
  combatState.attackCooldownTimer = skin.attackCooldown || 1.0;

  const isMultiBurst = (skin.skill.id === 'MultiBurst' && combatState.skillActiveTimer > 0);
  const totalShots = eff.autoVolleyCount + (isMultiBurst ? eff.multiBurstExtraShots : 0);

  const forward = new T.Vector3();
  camera.getWorldDirection(forward);
  const upRef = Math.abs(forward.y) > 0.92 ? new T.Vector3(0, 0, -1) : new T.Vector3(0, 1, 0);
  const right = new T.Vector3().crossVectors(forward, upRef).normalize();
  const camUp = new T.Vector3().crossVectors(right, forward).normalize();

  const origin = camera.position.clone().addScaledVector(forward, 0.85).addScaledVector(camUp, -0.18);

  // ターゲット候補のソート（MultiBurst中は戦闘機を最優先、通常時は最も近い飛翔体順）
  const sortedEnemies = [...enemies].sort((a, b) => {
    if(isMultiBurst){
      const aF = a.userData.kind === 'fighter' ? 0 : 1;
      const bF = b.userData.kind === 'fighter' ? 0 : 1;
      if(aF !== bF) return aF - bF;
    }
    return origin.distanceTo(a.position) - origin.distanceTo(b.position);
  });

  const assignedSet = new Set();
  const coneAngleRad = Math.PI / 3; // 視線から60°の角度

  for(let i = 0; i < totalShots; i++){
    let launchDir;
    if(i === 0){
      // 1発目は視線正面に飛んでいく
      launchDir = forward.clone().normalize();
    } else {
      // 2発目以降はスプリンクラーのように視線から60°の角度で放射状に発射
      const azimuth = ((i - 1) / Math.max(1, totalShots - 1)) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const radialVec = right.clone().multiplyScalar(Math.cos(azimuth))
        .addScaledVector(camUp, Math.sin(azimuth))
        .normalize();
      launchDir = forward.clone().multiplyScalar(Math.cos(coneAngleRad))
        .addScaledVector(radialVec, Math.sin(coneAngleRad))
        .normalize();
    }

    // 2発目以降は弾同士が狙う飛翔体が被りにくいよう未割り当ての飛翔体を優先選定
    let chosenTarget = null;
    for(const cand of sortedEnemies){
      if(!assignedSet.has(cand.userData.id)){
        chosenTarget = cand;
        assignedSet.add(cand.userData.id);
        break;
      }
    }
    if(!chosenTarget && sortedEnemies.length > 0){
      chosenTarget = sortedEnemies[i % sortedEnemies.length];
    }

    const projGroup = new T.Group();
    const core = new T.Mesh(
      new T.SphereGeometry(0.16, 8, 8),
      new T.MeshBasicMaterial({color: isMultiBurst ? 0xff4d6d : 0xe0aaff})
    );
    const halo = new T.Mesh(
      new T.SphereGeometry(0.27, 8, 8),
      new T.MeshBasicMaterial({color: 0xc77dff, transparent: true, opacity: 0.45})
    );
    projGroup.add(core, halo);
    projGroup.position.copy(origin);
    scene.add(projGroup);

    combatState.homingProjectiles.push({
      mesh: projGroup,
      pos: origin.clone(),
      vel: launchDir.multiplyScalar(32.0),
      targetEnemy: chosenTarget,
      assignedIdsSnapshot: new Set(assignedSet),
      isFighterPriority: isMultiBurst,
      dmg: eff.atk,
      life: 3.5,
      age: 0
    });
  }
}

function updateHomingProjectiles(dt, eff){
  for(let i = combatState.homingProjectiles.length - 1; i >= 0; i--){
    const p = combatState.homingProjectiles[i];
    p.age += dt;
    p.life -= dt;

    if(p.life <= 0){
      scene.remove(p.mesh);
      combatState.homingProjectiles.splice(i, 1);
      continue;
    }

    // ターゲットが既に破壊されていた場合、他の弾と被りにくい飛翔体を再探索
    if(!p.targetEnemy || !enemies.includes(p.targetEnemy)){
      const otherTargeted = new Set(
        combatState.homingProjectiles
          .filter(other => other !== p && other.targetEnemy && enemies.includes(other.targetEnemy))
          .map(other => other.targetEnemy.userData.id)
      );
      const candidates = [...enemies].sort((a, b) => {
        if(p.isFighterPriority){
          const aF = a.userData.kind === 'fighter' ? 0 : 1;
          const bF = b.userData.kind === 'fighter' ? 0 : 1;
          if(aF !== bF) return aF - bF;
        }
        return p.pos.distanceTo(a.position) - p.pos.distanceTo(b.position);
      });
      p.targetEnemy = candidates.find(c => !otherTargeted.has(c.userData.id)) || candidates[0] || null;
    }

    const speed = 38.0;
    if(p.targetEnemy && enemies.includes(p.targetEnemy)){
      const targetCenter = new T.Vector3();
      new T.Box3().setFromObject(p.targetEnemy).getCenter(targetCenter);
      const desiredDir = targetCenter.clone().sub(p.pos).normalize();

      // 発射直後(0.14s)は60°スプリンクラー展開を見せつつ、その後強力に自動追尾旋回
      const turnRate = p.age < 0.14 ? 4.5 : 16.0;
      const curDir = p.vel.clone().normalize();
      curDir.lerp(desiredDir, Math.min(1, turnRate * dt)).normalize();
      p.vel.copy(curDir).multiplyScalar(speed);

      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      // 航跡パーティクル
      if(syncTick % 2 === 0){
        const trail = new T.Mesh(
          new T.SphereGeometry(0.08, 5, 5),
          new T.MeshBasicMaterial({color: 0xc77dff, transparent: true, opacity: 0.7})
        );
        trail.position.copy(p.pos);
        scene.add(trail);
        fx.push({m: trail, life: 7});
      }

      if(p.pos.distanceTo(targetCenter) <= 1.45){
        if(isCoop && !isHost){
          burst(targetCenter, 0xc77dff);
          if(conn && conn.open){
            conn.send({
              type: 'clientHit',
              enemyId: p.targetEnemy.userData.id,
              dmg: p.dmg,
              beamColor: 0xc77dff,
              scoreMult: eff.scoreMult
            });
          }
        } else {
          applyEnemyDamage(p.targetEnemy, p.dmg, 0xc77dff, eff.scoreMult, false);
        }
        scene.remove(p.mesh);
        combatState.homingProjectiles.splice(i, 1);
      }
    } else {
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
    }
  }
}

function fireTurretHomingPulse(apexOrigin, eff){
  if(enemies.length === 0) return;

  let bestEnemy = null;
  let bestScore = Infinity;
  for(const e of enemies){
    const c = new T.Vector3();
    new T.Box3().setFromObject(e).getCenter(c);
    const dist = apexOrigin.distanceTo(c);
    const threatScore = c.y * 1.4 + dist * 0.35;
    if(threatScore < bestScore){
      bestScore = threatScore;
      bestEnemy = e;
    }
  }

  if(!bestEnemy) return;
  const targetCenter = new T.Vector3();
  new T.Box3().setFromObject(bestEnemy).getCenter(targetCenter);

  const jitter = new T.Vector3(
    (Math.random() - 0.5) * 0.25,
    (Math.random() - 0.5) * 0.25,
    (Math.random() - 0.5) * 0.25
  );
  const aimPoint = targetCenter.clone().add(jitter);
  const dir = aimPoint.clone().sub(apexOrigin).normalize();

  const beam = new T.Mesh(
    new T.CylinderGeometry(0.032, 0.06, 1, 6),
    new T.MeshBasicMaterial({color: 0x4de680})
  );
  beam.position.copy(apexOrigin).add(aimPoint).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
  beam.scale.y = apexOrigin.distanceTo(aimPoint);
  scene.add(beam);
  fx.push({m: beam, life: 7});

  if(isCoop && !isHost){
    burst(targetCenter, 0x4de680);
    if(conn && conn.open){
      conn.send({
        type: 'clientHit',
        enemyId: bestEnemy.userData.id,
        dmg: 1,
        beamColor: 0x4de680,
        scoreMult: eff.scoreMult
      });
    }
  } else {
    applyEnemyDamage(bestEnemy, 1, 0x4de680, eff.scoreMult, false);
  }
}

// ==========================================
// FALL MISSILE 射撃（Standard / Explosion / Scatter / Laser / Automatic / Wirbelwind / Beast）
// ==========================================
function applyEnemyDamage(enemyObj, dmg, beamColor, skinScoreMult, fromRemote=false, strongWhiteFx=false){
  if(!enemyObj) return;
  enemyObj.userData.hp -= dmg;
  if(strongWhiteFx){
    burstWhiteStrong(enemyObj.position);
  } else {
    burst(enemyObj.position, beamColor);
  }

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

function fireSingleBeam(skin, effectiveStats, spreadYaw=0, spreadPitch=0, overrideDmg=null, overrideRadius=null, customOrigin=null, strongWhiteFx=false){
  if(gameMode!=='battle' || activeBattleMode!=='FALL_MISSILE' || modalOpen) return null;

  const d=new T.Vector3();
  camera.getWorldDirection(d);

  if(spreadYaw !== 0 || spreadPitch !== 0){
    const euler = new T.Euler(spreadPitch, spreadYaw, 0, 'YXZ');
    d.applyEuler(euler).normalize();
  }

  const originPos = customOrigin ? customOrigin.clone() : camera.position.clone();
  const hitRadius = overrideRadius !== null ? overrideRadius : skin.stats.beamRadius;
  const dmg = overrideDmg !== null ? overrideDmg : effectiveStats.atk;

  const ray=new T.Raycaster(originPos,d,0,125);
  let hit=null,best=Infinity;
  for(const e of enemies){
    const c=new T.Vector3();
    new T.Box3().setFromObject(e).getCenter(c);
    const dist=ray.ray.distanceToPoint(c),along=originPos.distanceTo(c);
    if(dist<hitRadius && along<best){hit=e;best=along}
  }
  const a=originPos.clone(),b=hit?hit.position.clone():a.clone().add(d.clone().multiplyScalar(48));
  const beamRadiusScale = hitRadius / 2.7;
  const beam=new T.Mesh(
    new T.CylinderGeometry(.035 * beamRadiusScale, .07 * beamRadiusScale, 1, 6),
    new T.MeshBasicMaterial({color: skin.stats.beamColor})
  );
  beam.position.copy(a).add(b).multiplyScalar(.5);
  beam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());
  beam.scale.y=a.distanceTo(b);
  scene.add(beam);
  fx.push({m:beam,life:8});

  if(strongWhiteFx){
    // Beast専用: 銃口付近にも強い白色パーティクルを発生
    const muzzlePt = a.clone().addScaledVector(d, 1.1);
    for(let k=0;k<4;k++){
      const wm = new T.Mesh(new T.SphereGeometry(0.11, 6, 5), new T.MeshBasicMaterial({color: 0xffffff}));
      wm.position.copy(muzzlePt);
      scene.add(wm);
      fx.push({m: wm, life: 12, v: new T.Vector3((Math.random()-0.5)*0.18, (Math.random()-0.5)*0.18, (Math.random()-0.5)*0.18)});
    }
  }
  
  if(hit){
    if(isCoop && !isHost){
      if(strongWhiteFx) burstWhiteStrong(hit.position);
      else burst(hit.position, skin.stats.beamColor);
      if(conn && conn.open){
        conn.send({
          type: 'clientHit',
          enemyId: hit.userData.id,
          dmg: dmg,
          beamColor: skin.stats.beamColor,
          scoreMult: effectiveStats.scoreMult
        });
      }
    } else {
      applyEnemyDamage(hit, dmg, skin.stats.beamColor, effectiveStats.scoreMult, false, strongWhiteFx);
    }
  }
  return hit;
}

// Explosion 専用：1.5秒溜め完了後の範囲爆破攻撃
function executeExplosionAttack(skin, eff){
  const d = new T.Vector3();
  camera.getWorldDirection(d);

  const ray = new T.Raycaster(camera.position.clone(), d, 0, 130);
  let hit = null, best = Infinity;
  for(const e of enemies){
    const c = new T.Vector3();
    new T.Box3().setFromObject(e).getCenter(c);
    const dist = ray.ray.distanceToPoint(c), along = camera.position.distanceTo(c);
    if(dist < skin.stats.beamRadius && along < best){
      hit = e;
      best = along;
    }
  }

  const origin = camera.position.clone();
  const impactPt = hit ? hit.position.clone() : origin.clone().add(d.clone().multiplyScalar(45));

  const beam = new T.Mesh(
    new T.CylinderGeometry(0.08, 0.16, 1, 8),
    new T.MeshBasicMaterial({color: 0xff9233})
  );
  beam.position.copy(origin).add(impactPt).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), impactPt.clone().sub(origin).normalize());
  beam.scale.y = origin.distanceTo(impactPt);
  scene.add(beam);
  fx.push({m: beam, life: 12});

  if(hit){
    const blastWorldRadius = eff.blastRadiusM * 1.35;

    const sphereFx = new T.Mesh(
      new T.SphereGeometry(blastWorldRadius, 14, 12),
      new T.MeshBasicMaterial({color: 0xff6b00, transparent: true, opacity: 0.55})
    );
    sphereFx.position.copy(impactPt);
    scene.add(sphereFx);
    fx.push({m: sphereFx, life: 14});

    const affected = [];
    for(const e of enemies){
      if(e === hit || e.position.distanceTo(impactPt) <= blastWorldRadius){
        affected.push(e);
      }
    }

    for(const targetEn of affected){
      if(!enemies.includes(targetEn)) continue;
      if(isCoop && !isHost){
        burst(targetEn.position, 0xff9233);
        if(conn && conn.open){
          conn.send({
            type: 'clientHit',
            enemyId: targetEn.userData.id,
            dmg: eff.atk,
            beamColor: 0xff9233,
            scoreMult: eff.scoreMult
          });
        }
      } else {
        applyEnemyDamage(targetEn, eff.atk, 0xff9233, eff.scoreMult, false);
      }
    }
  }
}

// Scatter 専用：1発1ダメージ〜の広角スプリンクラー散弾
function executeScatterAttack(skin, eff, isInfinityActive){
  if(!isInfinityActive){
    combatState.attackCooldownTimer = skin.attackCooldown || 0.5;
  }

  const pelletCount = isInfinityActive ? 10 : (skin.pelletCount || 7);
  const spreadMult = isInfinityActive ? eff.infinitySpreadMult : 1.0;
  const maxSpread = (skin.baseSpreadAngle || 0.25) * spreadMult;

  for(let i = 0; i < pelletCount; i++){
    const theta = (i / pelletCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
    const rad = (0.25 + Math.random() * 0.75) * maxSpread;
    const sYaw = Math.cos(theta) * rad;
    const sPitch = Math.sin(theta) * rad;
    fireSingleBeam(skin, eff, sYaw, sPitch, eff.atk, 1.9);
  }
}

// Wirbelwind 専用：視線中央から 0.75 × 0.75 の正方形の4頂点からそれぞれ発射
function executeWirbelwindAttack(skin, eff){
  const forward = new T.Vector3();
  camera.getWorldDirection(forward);
  const right = new T.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

  // 正方形の中心を視線の少し先（1.2m前方）に設定し、視認しやすくする
  const centerOrigin = camera.position.clone().addScaledVector(forward, 1.2);
  const half = (skin.squareSize || 0.75) * 0.5; // 0.375

  const vertices = [
    centerOrigin.clone().addScaledVector(right, -half).addScaledVector(up,  half), // 左上
    centerOrigin.clone().addScaledVector(right,  half).addScaledVector(up,  half), // 右上
    centerOrigin.clone().addScaledVector(right, -half).addScaledVector(up, -half), // 左下
    centerOrigin.clone().addScaledVector(right,  half).addScaledVector(up, -half)  // 右下
  ];

  const shotsPerVertex = eff.wirbelVertexShots; // 1 + vertexShots (Lv5で+5発追加)

  for(let s = 0; s < shotsPerVertex; s++){
    const delayMs = s * 55;
    const spreadY = s === 0 ? 0 : ((s % 2 === 1 ? 1 : -1) * Math.ceil(s / 2) * 0.018);
    const spreadP = s === 0 ? 0 : (((s % 3) - 1) * 0.015);
    const tid = setTimeout(() => {
      pendingShotTimers.delete(tid);
      if(gameMode !== 'battle' || activeBattleMode !== 'FALL_MISSILE') return;
      for(const vOrigin of vertices){
        fireSingleBeam(skin, eff, spreadY, spreadP, eff.atk, skin.stats.beamRadius, vOrigin);
      }
    }, delayMs);
    pendingShotTimers.add(tid);
  }
}

// Beast 専用：クールダウンなしの真っ白な弾＋聖人力による発射数増加＆拡散能力
function executeBeastAttack(skin, eff){
  const totalShots = eff.shotCount; // 聖人力1Lvごとに+1発
  const upg = getSkinUpgrade('Beast');
  const saintLv = upg.saint || 1;
  // 聖人力Lvが上がるほど拡散範囲も広がる
  const maxSpread = saintLv > 1 ? Math.min(0.42, 0.04 + (saintLv - 1) * 0.008) : 0;

  // 描画負荷を抑えつつ高レベルでもダメージ総量を維持
  const visualCount = Math.min(28, totalShots);
  const dmgPerBeam = eff.atk * (totalShots / visualCount);

  fireSingleBeam(skin, eff, 0, 0, dmgPerBeam, skin.stats.beamRadius, null, true);

  for(let i = 1; i < visualCount; i++){
    const theta = (i / visualCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const rad = (0.2 + Math.random() * 0.8) * maxSpread;
    const sYaw = Math.cos(theta) * rad;
    const sPitch = Math.sin(theta) * rad;
    fireSingleBeam(skin, eff, sYaw, sPitch, dmgPerBeam, skin.stats.beamRadius, null, true);
  }
}

function shoot(){
  if(gameMode!=='battle' || activeBattleMode!=='FALL_MISSILE' || modalOpen) return;
  const skin = getEquippedSkin();
  const effectiveStats = getEffectiveStats(skin);

  if(skin.attackType === 'laser'){
    if(combatState.laserActiveTimer > 0 || combatState.attackCooldownTimer > 0){
      return;
    }
    startLaserBeam(effectiveStats.laserDurationSec, 1.0);
    return;
  }

  if(skin.attackType === 'explosion'){
    if(!combatState.isCharging){
      combatState.isCharging = true;
      combatState.chargeElapsed = 0;
    }
    return;
  }

  if(skin.attackType === 'scatter'){
    const isInfinityActive = (skin.skill.id === 'InfinityBarrel' && combatState.skillActiveTimer > 0);
    if(!isInfinityActive && combatState.attackCooldownTimer > 0){
      return;
    }
    executeScatterAttack(skin, effectiveStats, isInfinityActive);
    return;
  }

  if(skin.attackType === 'automatic'){
    if(combatState.attackCooldownTimer > 0){
      return;
    }
    executeAutomaticVolley(skin, effectiveStats);
    return;
  }

  if(skin.attackType === 'wirbelwind'){
    executeWirbelwindAttack(skin, effectiveStats);
    return;
  }

  if(skin.attackType === 'beast'){
    executeBeastAttack(skin, effectiveStats);
    return;
  }

  // 通常パルス機体（Origin, RapidFire）
  const count = effectiveStats.shotCount;
  fireSingleBeam(skin, effectiveStats, 0, 0);

  for(let i = 1; i < count; i++){
    const angleOffset = (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * 0.045;
    const pitchOffset = ((i % 3) - 1) * 0.025;
    const tid = setTimeout(() => {
      pendingShotTimers.delete(tid);
      if(gameMode !== 'battle' || activeBattleMode !== 'FALL_MISSILE') return;
      fireSingleBeam(skin, effectiveStats, angleOffset, pitchOffset);
    }, i * 85);
    pendingShotTimers.add(tid);
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

// Beast専用：強力な純白パーティクル演出
function burstWhiteStrong(p){
  for(let i=0;i<14;i++){
    const radius = i % 3 === 0 ? 0.24 : 0.15;
    const m=new T.Mesh(new T.SphereGeometry(radius, 8, 6), new T.MeshBasicMaterial({color: 0xffffff}));
    m.position.copy(p);
    scene.add(m);
    fx.push({
      m,
      life: 28,
      v: new T.Vector3((Math.random()-.5)*.36, (Math.random()-.2)*.32, (Math.random()-.5)*.36)
    });
  }
}

function finishBattle(win){
  if(gameMode === 'end') return;
  gameMode='end';
  resetCombatState();
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
  conn = null;
  peer = null;
  isCoop = false;
  isHost = false;
  coopRoomCode = null;
  coopStarting = false;

  if(remotePlayerMesh && scene){
    scene.remove(remotePlayerMesh);
    remotePlayerMesh = null;
  }
  if(remoteAirStrikeCraft && scene){
    scene.remove(remoteAirStrikeCraft.root);
    remoteAirStrikeCraft = null;
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

  if(gameMode === 'home'){
    setModeUI('home', getEquippedSkin(), false, false);
  }
  showToast('共闘ルームから退出しました');
}

// ==========================================
// オンライン共闘（PeerJS）通信制御
// ==========================================
function setupCoopDataHandlers(connection){
  conn = connection;
  conn.on('open', () => {
    isCoop = true;
    coopStarting = false;

    if(myActiveRecruitId){
      cancelMyCoopRecruit(true);
    }

    $('#coopStatusText').textContent = 'ステータス: フレンド接続完了！（北の青いポータルからモード選択して共闘開始）';
    const leaveBtn = $('#leaveCoopRoomBtn');
    if(leaveBtn) leaveBtn.style.display = 'block';
    const recruitBtn = $('#recruitCoopBtn');
    if(recruitBtn) recruitBtn.disabled = true;

    conn.send({
      type: 'hello',
      username: username || (isHost ? 'ホスト' : 'ゲスト')
    });

    if(gameMode === 'home'){
      setModeUI('home', getEquippedSkin(), true, isHost);
      if(!remotePlayerMesh) remotePlayerMesh = createRemotePlayerMesh(!isHost, remotePos.username);
    }
  });

  conn.on('data', (data) => {
    if(!data || !data.type) return;

    if(data.type === 'hello'){
      remotePos.username = data.username;
      updateRemoteNameLabel(data.username);
      if(remoteAirStrikeCraft && remoteAirStrikeCraft.nameSprite){
        remoteAirStrikeCraft.root.remove(remoteAirStrikeCraft.nameSprite);
        remoteAirStrikeCraft.nameSprite = makeTextSprite(T, data.username);
        remoteAirStrikeCraft.nameSprite.position.set(0, 2.2, 0);
        remoteAirStrikeCraft.root.add(remoteAirStrikeCraft.nameSprite);
      }
      showToast(`${data.username} が共闘ルームに参加しました！`);
    } else if(data.type === 'pos'){
      remotePos.x = data.x;
      remotePos.y = data.y || 0;
      remotePos.z = data.z;
      remotePos.yaw = data.yaw;
      if(data.airStrikePhase) remotePos.airStrikePhase = data.airStrikePhase;
      if(data.username && data.username !== remotePos.username){
        remotePos.username = data.username;
        updateRemoteNameLabel(data.username);
      }
    } else if(data.type === 'startBattle'){
      startBattle(data.mode || 'FALL_MISSILE', data.diffId || 'easy', data.missionData || null);
    } else if(data.type === 'abortBattle'){
      enterHome();
    } else if(data.type === 'leaveCoop'){
      showToast('フレンドが共闘ルームから退出しました');
      leaveCoopRoom();
      if(gameMode === 'battle'){
        enterHome();
      }
    } else if(data.type === 'spawnEnemy'){
      if(!isHost && gameMode === 'battle' && activeBattleMode === 'FALL_MISSILE'){
        const e = spawn(T, scene, target, wave, CONFIG, data.payload.kind, modelTemplates, true, data.payload);
        enemies.push(e);
      }
    } else if(data.type === 'syncBattleState'){
      if(!isHost && gameMode === 'battle' && activeBattleMode === 'FALL_MISSILE'){
        wave = data.wave;
        peace = data.peace;
        score = data.score;
        hud(wave, data.remaining, peace, getMaxWaves());
        for(const s of data.enemies){
          const en = enemies.find(x => x.userData.id === s.id);
          if(en){
            en.position.set(s.px, s.py, s.pz);
            en.userData.hp = s.hp;
          }
        }
      }
    } else if(data.type === 'clientHit'){
      if(isHost && gameMode === 'battle' && activeBattleMode === 'FALL_MISSILE'){
        const en = enemies.find(x => x.userData.id === data.enemyId);
        if(en){
          applyEnemyDamage(en, data.dmg, data.beamColor, data.scoreMult, false);
        }
      }
    } else if(data.type === 'enemyDestroyed'){
      if(!isHost && gameMode === 'battle' && activeBattleMode === 'FALL_MISSILE'){
        const en = enemies.find(x => x.userData.id === data.enemyId);
        if(en){
          burst(en.position, 0xffaa00);
          scene.remove(en);
          const idx = enemies.indexOf(en);
          if(idx !== -1) enemies.splice(idx, 1);
        }
        score = data.score;
      }
    } else if(data.type === 'battleEnd'){
      if(!isHost && gameMode === 'battle' && activeBattleMode === 'FALL_MISSILE'){
        score = data.score;
        finishBattle(data.win);
      }
    } else if(data.type === 'airStrikeDone'){
      remotePos.airStrikeFinished = true;
      remotePos.remoteSurvivedM = data.survivedM;
      remotePos.remoteHitTarget = data.hitTarget;
      if(remoteAirStrikeCraft){
        remoteAirStrikeCraft.flameGroup.visible = false;
        remoteAirStrikeCraft.missileHolder.visible = false;
      }
      if(airStrikeState && airStrikeState.phase === 'finished'){
        finalizeAirStrikeResult();
      }
    }
  });

  conn.on('close', () => {
    isCoop = false;
    conn = null;
    if(remotePlayerMesh && scene){
      scene.remove(remotePlayerMesh);
      remotePlayerMesh = null;
    }
    if(remoteAirStrikeCraft && scene){
      scene.remove(remoteAirStrikeCraft.root);
      remoteAirStrikeCraft = null;
    }
    $('#coopStatusText').textContent = 'ステータス: 通信が切断されました';
    const leaveBtn = $('#leaveCoopRoomBtn');
    if(leaveBtn) leaveBtn.style.display = 'none';
  });
}

function createCoopRoom(){
  cancelMyCoopRecruit(true);
  if(peer) { try { peer.destroy(); } catch(e){} }
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  coopRoomCode = code;
  isHost = true;
  const peerId = 'spaa-coop-' + code;
  $('#coopStatusText').textContent = 'ステータス: ルーム生成中...';
  const recruitBtn = $('#recruitCoopBtn');
  if(recruitBtn) recruitBtn.disabled = true;

  peer = new Peer(peerId);
  peer.on('open', () => {
    $('#roomCodeDisplay').textContent = code;
    $('#coopStatusText').textContent = 'ステータス: ルーム作成完了！全体チャット募集またはID共有で待機中...';
    if(recruitBtn){
      recruitBtn.disabled = false;
      recruitBtn.textContent = '全体チャットで募集する';
    }
    const leaveBtn = $('#leaveCoopRoomBtn');
    if(leaveBtn) leaveBtn.style.display = 'block';
  });
  peer.on('connection', (c) => {
    setupCoopDataHandlers(c);
  });
  peer.on('error', (err) => {
    if(err && err.type === 'unavailable-id'){
      createCoopRoom();
      return;
    }
    $('#coopStatusText').textContent = 'エラー: ' + err.message;
  });
}

function joinCoopRoom(){
  const code = $('#joinCodeInput').value.trim();
  if(code.length !== 4) {
    $('#coopStatusText').textContent = 'エラー: 4桁の数字を入力してください';
    return;
  }
  cancelMyCoopRecruit(true);
  if(peer) { try { peer.destroy(); } catch(e){} }
  isHost = false;
  coopRoomCode = code;
  $('#coopStatusText').textContent = 'ステータス: ルーム ' + code + ' に接続中...';

  peer = new Peer();
  peer.on('open', () => {
    const c = peer.connect('spaa-coop-' + code);
    setupCoopDataHandlers(c);
  });
  peer.on('error', () => {
    $('#coopStatusText').textContent = '接続エラー: ルームが見つかりません';
  });
}

// ==========================================
// モーダル制御（機体選択・アップグレード・ショップ・共闘）
// ==========================================
function openCoopModal(){
  resetMovementInputs();
  modalOpen = true;
  const leaveBtn = $('#leaveCoopRoomBtn');
  if(leaveBtn) leaveBtn.style.display = (isCoop || coopRoomCode) ? 'block' : 'none';
  const recruitBtn = $('#recruitCoopBtn');
  if(recruitBtn) recruitBtn.disabled = !(isHost && coopRoomCode && !isCoop);
  const cancelBtn = $('#cancelRecruitBtn');
  if(cancelBtn) cancelBtn.style.display = myActiveRecruitId ? 'block' : 'none';
  $('#coopModal').classList.add('visible');
}

function closeAllModals(){
  modalOpen=false;
  panelHoldTime=0;
  updateHoldGauge(0);
  const modals=['#skinSelectModal','#skinStoreModal','#skinUpgradeModal','#coopModal','#usernameModal','#battleSetupModal'];
  modals.forEach(id=>{
    const el=$(id);
    if(el) el.classList.remove('visible');
  });
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
  CONFIG.SKINS.filter(s=>unlockedSkins.includes(s.id)).forEach(skin=>{
    const eff = getEffectiveStats(skin);
    const card=document.createElement('div');
    card.className='skin-card'+(skin.id===pendingSelectedSkinId?' selected':'');
    const hex='#'+skin.color.toString(16).padStart(6,'0');
    const textCol = '#071522';

    let statSummary = '';
    if(skin.attackType === 'explosion'){
      statSummary = `攻撃力:${eff.atk} / スコア倍率:${eff.scoreMult.toFixed(2)}x / 爆発範囲:${eff.blastRadiusM.toFixed(1)}m`;
    } else if(skin.attackType === 'scatter'){
      statSummary = `攻撃力:${eff.atk}×7散弾 / 体力:${eff.hp} / スコア倍率:${eff.scoreMult.toFixed(2)}x`;
    } else if(skin.attackType === 'laser'){
      statSummary = `光線攻撃力:${eff.atk} / スコア倍率:${eff.scoreMult.toFixed(2)}x / 照射時間:${eff.laserDurationSec}s`;
    } else if(skin.attackType === 'automatic'){
      statSummary = `攻撃力:${eff.atk} / 防御力:${eff.def} / 体力:${eff.hp} / 同時発射:${eff.autoVolleyCount}発`;
    } else if(skin.attackType === 'wirbelwind'){
      statSummary = `攻撃力:${eff.atk} / スコア倍率:${eff.scoreMult.toFixed(2)}x / 各頂点:${eff.wirbelVertexShots}発(計${eff.wirbelVertexShots * 4}発)`;
    } else if(skin.attackType === 'beast'){
      statSummary = `攻撃力:${eff.atk} / 防御力:${eff.def} / 体力:${eff.hp} / 同時弾数:${eff.shotCount}発 / スコア:${eff.scoreMult.toFixed(2)}x`;
    } else if(skin.id === 'RapidFire'){
      statSummary = `連射数:${eff.shotCount}発 / 防御力:${eff.def} / 体力:${eff.hp}`;
    } else {
      statSummary = `攻撃力:${eff.atk} / 防御力:${eff.def} / 体力:${eff.hp}`;
    }

    card.innerHTML=`
      <div class="skin-swatch" style="background:${hex};color:${textCol}">#${skin.order}</div>
      <div class="skin-info">
        <div class="skin-title">${skin.name}</div>
        <div class="skin-desc">${statSummary}</div>
        <div class="skin-skill-tag">固有能力: ${skin.skill.name} Lv.${eff.skillLv}</div>
      </div>
      <div class="skin-badge">${skin.id===pendingSelectedSkinId?'選択中':'選択する'}</div>
    `;
    card.addEventListener('pointerdown',(e)=>{
      e.preventDefault();
      pendingSelectedSkinId=skin.id;
      renderSkinSelectList();
    });
    container.appendChild(card);
  });
}

function confirmSkinSelection(){
  selectedSkinId=pendingSelectedSkinId;
  saveGameData();
  if(skinController)skinController.refreshPedestals(unlockedSkins,selectedSkinId);
  setModeUI(gameMode, getEquippedSkin(), isCoop, isHost);
  closeAllModals();
  triggerCooldown=45;
}

function getUpgradeItemMeta(skin, upgKey){
  const eff = getEffectiveStats(skin);
  if(upgKey === 'atk'){
    const label = skin.id === 'Laser' ? '光線攻撃力' : '攻撃力';
    return {
      title: label,
      desc: `現在の${label}: ${eff.atk}（+1 / Lv）`,
      swatch: skin.id === 'Laser' ? 'BEAM' : 'ATK',
      color: '#ff4d6d'
    };
  }
  if(upgKey === 'def'){
    return {
      title: '防御力',
      desc: `現在の防御力: ${eff.def}（+1 / Lv・ダメージ軽減）`,
      swatch: 'DEF',
      color: '#38c8f0'
    };
  }
  if(upgKey === 'hp'){
    return {
      title: '体力',
      desc: `現在の最大体力: ${eff.hp}（+10 / Lv）`,
      swatch: 'HP',
      color: '#00f5d4'
    };
  }
  if(upgKey === 'rate'){
    return {
      title: '連射速度',
      desc: `現在の連射速度: ${eff.rawRate.toFixed(1)}（発射数: ${eff.shotCount}発 / +0.5 / Lv）`,
      swatch: 'RATE',
      color: '#4de680'
    };
  }
  if(upgKey === 'score'){
    return {
      title: 'スコア獲得上昇',
      desc: `現在の獲得スコア倍率: ${eff.scoreMult.toFixed(2)}倍（+5% / Lv）`,
      swatch: 'SCORE',
      color: '#ffd23f'
    };
  }
  if(upgKey === 'blast'){
    return {
      title: '爆発範囲上昇',
      desc: `現在の爆発半径: ${eff.blastRadiusM.toFixed(1)}m（初期1.0m / +0.2m / Lv）`,
      swatch: 'BLAST',
      color: '#ff9233'
    };
  }
  if(upgKey === 'duration'){
    return {
      title: '光線持続時間',
      desc: `現在の光線持続時間: ${eff.laserDurationSec.toFixed(1)}秒（初期3.0秒 / +0.2秒 / Lv）`,
      swatch: 'TIME',
      color: '#ff8fa3'
    };
  }
  if(upgKey === 'volley'){
    return {
      title: '弾数増加',
      desc: `現在の同時発射数: ${eff.autoVolleyCount}発（Lv.10で11発同時発射）`,
      swatch: 'VOLLEY',
      color: '#c77dff'
    };
  }
  if(upgKey === 'vertexShots'){
    const upg = getSkinUpgrade('Wirbelwind');
    return {
      title: '各頂点の弾発射数上昇',
      desc: `現在の追加発射数: +${upg.vertexShots}発/頂点（各頂点${eff.wirbelVertexShots}発・計${eff.wirbelVertexShots * 4}発）`,
      swatch: '4-QUAD',
      color: '#00f5d4'
    };
  }
  if(upgKey === 'faith'){
    return {
      title: '信仰力',
      desc: `現在の攻撃力:${eff.atk} / 防御力:${eff.def}（1Lvごとに攻撃力+2＆防御力+2）`,
      swatch: 'FAITH',
      color: '#ffffff'
    };
  }
  if(upgKey === 'gayPower'){
    return {
      title: 'GAY力',
      desc: `現在の獲得スコア倍率: ${eff.scoreMult.toFixed(2)}倍（1Lvごとに+10%上昇・通常より高倍率）`,
      swatch: 'GAY',
      color: '#ff66cc'
    };
  }
  if(upgKey === 'saint'){
    return {
      title: '聖人力',
      desc: `現在体力:${eff.hp} / 同時弾数:${eff.shotCount}発（1Lvごとに体力+20・弾数+1・拡散強化）`,
      swatch: 'SAINT',
      color: '#ffe066'
    };
  }
  return { title: upgKey, desc: '', swatch: 'UPG', color: '#8beeff' };
}

function openUpgradeModal(){
  resetMovementInputs();
  $('#skinSelectModal').classList.remove('visible');
  modalOpen=true;
  renderUpgradeList();
  $('#skinUpgradeModal').classList.add('visible');
}

function renderUpgradeList(){
  const skin=CONFIG.SKINS.find(s=>s.id===pendingSelectedSkinId) || getEquippedSkin();
  const upg=getSkinUpgrade(skin.id);
  const eff=getEffectiveStats(skin);
  $('#upgradeSkinTitle').textContent=`${skin.name} の強化`;
  $('#upgradeGoldVal').textContent=gold.toLocaleString();
  const container=$('#upgradeItemsList');
  container.innerHTML='';

  const baseCost = skin.upgradeBaseCost || 2000;
  const stepCost = skin.upgradeStepCost || 500;

  // 1. 機体固有のステータスアップグレード一覧
  skin.upgrades.forEach(uDef => {
    const curLv = upg[uDef.key] || 1;
    const isMax = curLv >= uDef.maxLv;
    const cost = baseCost + (curLv - 1) * stepCost;
    const meta = getUpgradeItemMeta(skin, uDef.key);

    const card=document.createElement('div');
    card.className='skin-card';
    card.innerHTML=`
      <div class="skin-swatch" style="background:${meta.color};color:#071522">${meta.swatch}</div>
      <div class="skin-info">
        <div class="skin-title">${meta.title} (Lv.${curLv} / ${uDef.maxLv})</div>
        <div class="skin-desc">${meta.desc}</div>
      </div>
      <button class="buy-btn" type="button" ${isMax||gold<cost?'disabled':''}>${isMax?'MAX':cost.toLocaleString()+' G'}</button>
    `;
    const btn=card.querySelector('button');
    if(!isMax && gold>=cost){
      btn.addEventListener('pointerdown',(e)=>{
        e.preventDefault();
        if(gold>=cost && upg[uDef.key]<uDef.maxLv){
          gold-=cost;
          upg[uDef.key]++;
          saveGameData();
          renderUpgradeList();
        }
      });
    }
    container.appendChild(card);
  });

  // 2. 固有能力（Skill）のレベルアップカード（全機体共通で最大Lv.10）
  const skill = skin.skill;
  const sMax = skill.maxLv || 10;
  const sCur = upg.skill || 1;
  const sIsMax = sCur >= sMax;
  const sCost = 3000 + (sCur - 1) * 1500;

  let skillEffectDetail = '';
  if(skill.id === 'OriginBurst'){
    skillEffectDetail = `現在効果: 最大 ${eff.originBurstTargets}体 一掃（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'AdditionalTurre'){
    skillEffectDetail = `現在効果: 10秒間タレット設置・連射力 ${eff.turretFireRate}（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'FewCharger'){
    skillEffectDetail = `現在効果: 10秒間溜め時間 -${eff.fewChargerReduction}秒（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'InfinityBarrel'){
    skillEffectDetail = `現在効果: 10秒間CD0秒＆拡散範囲 ${eff.infinitySpreadMult}倍（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'NeverStopper'){
    skillEffectDetail = `現在効果: ${eff.neverStopperDuration}秒間光線持続＆半径 ${eff.neverStopperRadiusMult}倍（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'MultiBurst'){
    skillEffectDetail = `現在効果: 10秒間戦闘機優先追尾＆追加弾 +${eff.multiBurstExtraShots}発（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'GermanTech'){
    skillEffectDetail = `現在効果: 上空の飛翔体を最大 ${eff.germanTechTargets}個 破壊（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'BeastEyesPower'){
    const cdStr = eff.beastEyesCooldown === 0 ? 'クールダウンなし' : `CD ${eff.beastEyesCooldown}秒`;
    skillEffectDetail = `現在効果: 出現した飛翔体を全て破壊（${cdStr}）`;
  }

  const skillCard = document.createElement('div');
  skillCard.className = 'skin-card skill-upgrade-card';
  skillCard.innerHTML = `
    <div class="skin-swatch" style="background:#ffd700;color:#071522">SKILL</div>
    <div class="skin-info">
      <div class="skin-title">【固有能力】${skill.name} (Lv.${sCur} / ${sMax})</div>
      <div class="skin-desc">${skill.desc}<br><b>${skillEffectDetail}</b></div>
    </div>
    <button class="buy-btn" type="button" ${sIsMax||gold<sCost?'disabled':''}>${sIsMax?'MAX':sCost.toLocaleString()+' G'}</button>
  `;
  const sBtn = skillCard.querySelector('button');
  if(!sIsMax && gold>=sCost){
    sBtn.addEventListener('pointerdown',(e)=>{
      e.preventDefault();
      if(gold>=sCost && upg.skill<sMax){
        gold-=sCost;
        upg.skill++;
        saveGameData();
        renderUpgradeList();
      }
    });
  }
  container.appendChild(skillCard);
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
    const hex='#'+skin.color.toString(16).padStart(6,'0');
    const card=document.createElement('div');
    card.className='skin-card';
    card.innerHTML=`
      <div class="skin-swatch" style="background:${hex};color:#071522">#${skin.order}</div>
      <div class="skin-info">
        <div class="skin-title">${skin.name}</div>
        <div class="skin-desc">${skin.stats.desc}</div>
        <div class="skin-skill-tag">固有能力: ${skin.skill.name}</div>
      </div>
      ${isUnlocked?'<div class="badge-unlocked">解放済み</div>':`<button class="buy-btn" type="button" ${canAfford?'':'disabled'}>${skin.price.toLocaleString()} G で購入</button>`}
    `;
    if(!isUnlocked){
      const btn=card.querySelector('button');
      btn.addEventListener('pointerdown',(e)=>{
        e.preventDefault();
        if(gold>=skin.price && !unlockedSkins.includes(skin.id)){
          gold-=skin.price;
          unlockedSkins.push(skin.id);
          saveGameData();
          if(skinController)skinController.refreshPedestals(unlockedSkins,selectedSkinId);
          renderSkinStoreList();
        }
      });
    }
    container.appendChild(card);
  });
}

// ==========================================
// 毎フレーム更新 & 移動制御
// ==========================================
function update(dt){
  syncTick++;

  if(gameMode === 'battle' && activeBattleMode === 'AIR_STRIKE'){
    updateAirStrikeFrame(dt);

    if(isCoop && conn && conn.open){
      if(syncTick % 2 === 0){
        conn.send({
          type: 'pos',
          x, y, z, yaw,
          username,
          airStrikePhase: airStrikeState ? airStrikeState.phase : 'countdown'
        });
      }
      if(remoteAirStrikeCraft){
        remoteAirStrikeCraft.root.position.lerp(new T.Vector3(remotePos.x, remotePos.y, remotePos.z), 0.35);
        if(remotePos.airStrikePhase === 'flying' && !remotePos.airStrikeFinished){
          remoteAirStrikeCraft.flameGroup.visible = true;
          remoteAirStrikeCraft.missileHolder.position.set(0, 0, 0);
        }
      }
    }
    return;
  }

  const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-move.y;
  const s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+move.x;
  const forward=new T.Vector3(0,0,-1).applyAxisAngle(new T.Vector3(0,1,0),yaw);
  const right=new T.Vector3(1,0,0).applyAxisAngle(new T.Vector3(0,1,0),yaw);
  
  const skin=getEquippedSkin();
  const speed=(gameMode==='battle'?CONFIG.MOVE_SPEED*skin.stats.moveMult:CONFIG.HOME_MOVE_SPEED);
  const limit=(gameMode==='battle'?18:9.2);

  x=T.MathUtils.clamp(x+(forward.x*f+right.x*s)*speed,-limit,limit);
  z=T.MathUtils.clamp(z+(forward.z*f+right.z*s)*speed,-limit,limit);
  camera.position.set(x,.15,z);
  camera.rotation.order='YXZ';
  camera.rotation.set(pitch,yaw,0);

  if(isCoop && conn && conn.open){
    if(syncTick % 3 === 0){
      conn.send({type: 'pos', x, y: 0, z, yaw, username});
    }
    if(remotePlayerMesh){
      remotePlayerMesh.position.lerp(new T.Vector3(remotePos.x, 0, remotePos.z), 0.3);
      if(remotePlayerMesh.userData.bodyGroup){
        remotePlayerMesh.userData.bodyGroup.rotation.y = remotePos.yaw;
      }
    }
  }

  if(triggerCooldown>0)triggerCooldown--;

  if(gameMode==='home' && homeController && !modalOpen && triggerCooldown===0){
    for(const tr of homeController.triggers){
      if(Math.hypot(x-tr.x,z-tr.z)<tr.radius){
        if(tr.id==='gamestart'){
          if(isCoop && !isHost){
            announce('共闘モード中：ホストがモード・難易度を選択するのを待機中...');
          } else {
            openBattleSetupModal();
          }
          return;
        }else if(tr.id==='skin'){
          enterSkinRoom();
          return;
        }else if(tr.id==='coop'){
          triggerCooldown = 60;
          openCoopModal();
          return;
        }
      }
    }
  }

  if(gameMode==='skin' && skinController && !modalOpen){
    const zones=skinController.zones;
    if(triggerCooldown===0 && Math.abs(x-zones.backHome.x)<zones.backHome.halfX && Math.abs(z-zones.backHome.z)<zones.backHome.halfZ){
      enterHome();
      return;
    }
    if(triggerCooldown===0 && Math.abs(x-zones.store.x)<zones.store.halfX && Math.abs(z-zones.store.z)<zones.store.halfZ){
      openSkinStoreModal();
      return;
    }
    const inSelectZone=Math.abs(x-zones.selectPanel.x)<zones.selectPanel.halfX && Math.abs(z-zones.selectPanel.z)<zones.selectPanel.halfZ;
    if(inSelectZone && triggerCooldown===0){
      panelHoldTime+=dt;
      updateHoldGauge(panelHoldTime/1.0);
      if(panelHoldTime>=1.0){
        panelHoldTime=0;
        updateHoldGauge(0);
        openSkinSelectModal();
        return;
      }
    }else{
      if(panelHoldTime>0){
        panelHoldTime=0;
        updateHoldGauge(0);
      }
    }
  }

  if(gameMode==='battle' && activeBattleMode==='FALL_MISSILE'){
    updateCombatSystem(dt);

    const eff = getEffectiveStats(skin);
    const maxWaves = getMaxWaves();
    const diffSpeedMult = activeDifficulty ? activeDifficulty.speedMult : 1.0;

    if(!isCoop || isHost){
      if(spawned<waveTotal() && enemies.length<CONFIG.MAX_ENEMIES && ++tick>34){
        tick=0;
        const mCount = waveMissileCount();
        const type=(spawned<mCount)?'missile':'fighter';
        const e = spawn(T,scene,target,wave,CONFIG,type,modelTemplates,isCoop,null,diffSpeedMult);
        enemies.push(e);
        spawned++;

        if(isCoop && isHost && conn && conn.open && e.userData.syncPayload){
          conn.send({type: 'spawnEnemy', payload: e.userData.syncPayload});
        }
      }

      const enemySyncData = [];
      for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i];
        e.userData.phase+=.04;
        if(e.userData.kind==='fighter'){
          e.position.add(e.userData.velocity);
          e.position.y+=Math.sin(e.userData.phase)*.015;
          if(Math.hypot(e.position.x, e.position.z) < 2.2){
            scene.remove(e);
            enemies.splice(i,1);
            // 防御力1あたり0.5ダメージ軽減（最低1ダメージ保証）
            const dmgToPeace = Math.max(1, 20 - Math.floor(eff.def * 0.5));
            peace=Math.max(0, peace - dmgToPeace);
            if(peace<=0){
              if(isCoop && isHost && conn && conn.open) conn.send({type: 'battleEnd', win: false, score});
              return finishBattle(false);
            }
            continue;
          }
        }else{
          e.position.add(e.userData.velocity);
          e.rotation.z+=.02;
          if(e.position.y <= -1.5){
            scene.remove(e);
            enemies.splice(i,1);
            const dmgToPeace = Math.max(1, 14 - Math.floor(eff.def * 0.5));
            peace=Math.max(0, peace - dmgToPeace);
            if(peace<=0){
              if(isCoop && isHost && conn && conn.open) conn.send({type: 'battleEnd', win: false, score});
              return finishBattle(false);
            }
            continue;
          }
        }
        enemySyncData.push({id: e.userData.id, px: e.position.x, py: e.position.y, pz: e.position.z, hp: e.userData.hp});
      }

      if(isCoop && isHost && conn && conn.open && syncTick % 3 === 0){
        conn.send({
          type: 'syncBattleState',
          wave, peace, score,
          remaining: Math.max(0, enemies.length + waveTotal() - spawned),
          enemies: enemySyncData
        });
      }

      updateBattleHud();
      if(spawned>=waveTotal() && !enemies.length && ++wait>50){
        if(wave < maxWaves){
          wave++;
          beginWave();
        } else {
          if(isCoop && isHost && conn && conn.open) conn.send({type: 'battleEnd', win: true, score});
          finishBattle(true);
        }
      }
    } else {
      for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i];
        e.position.add(e.userData.velocity);
      }
    }
  }
}

function animate(){
  requestAnimationFrame(animate);
  const now=performance.now();
  const dt=Math.min((now-lastFrameTime)/1000,0.1);
  lastFrameTime=now;
  
  update(dt);
  
  for(let i=fx.length-1;i>=0;i--){
    const p=fx[i];
    if(p.v)p.m.position.add(p.v);
    if(--p.life<=0){
      if(scene)scene.remove(p.m);
      fx.splice(i,1);
    }
  }
  if(renderer&&scene&&camera)renderer.render(scene,camera);
}

// ==========================================
// 入力イベント制御（スティック・視点・射撃・固有能力・チャット）
// ==========================================
let stickId=null,lookId=null,lx=0,ly=0;
function resetMovementInputs(){
  stickId=null;
  lookId=null;
  move.x=0;
  move.y=0;
  $('#stickKnob').style.transform='translate(0px,0px)';
  for(const k in keys)keys[k]=false;
  combatState.fireHeld = false;
  combatState.isCharging = false;
  combatState.chargeElapsed = 0;
  updateChargeGauge(0);
}

function setStick(cx,cy){
  const r=$('#stick').getBoundingClientRect(),dx=cx-(r.left+r.width/2),dy=cy-(r.top+r.height/2),max=r.width*.34,d=Math.min(Math.hypot(dx,dy),max),a=Math.atan2(dy,dx);
  move.x=Math.cos(a)*(d/max);
  move.y=Math.sin(a)*(d/max);
  $('#stickKnob').style.transform=`translate(${Math.cos(a)*d}px,${Math.sin(a)*d}px)`;
}

function handleFirePressStart(){
  if(gameMode !== 'battle' || activeBattleMode !== 'FALL_MISSILE' || modalOpen) return;
  combatState.fireHeld = true;
  combatState.autoFireTimer = 0;
  shoot();
}

function handleFirePressEnd(){
  combatState.fireHeld = false;
  combatState.autoFireTimer = 0;
  if(combatState.isCharging){
    combatState.isCharging = false;
    combatState.chargeElapsed = 0;
    updateChargeGauge(0);
  }
}

$('#stick').addEventListener('pointerdown',e=>{if(modalOpen)return;e.preventDefault();stickId=e.pointerId;$('#stick').setPointerCapture(e.pointerId);setStick(e.clientX,e.clientY)});
$('#stick').addEventListener('pointermove',e=>{if(e.pointerId===stickId)setStick(e.clientX,e.clientY)});
const endStick=e=>{if(e.pointerId===stickId){stickId=null;move.x=move.y=0;$('#stickKnob').style.transform='translate(0px,0px)'}};
$('#stick').addEventListener('pointerup',endStick);$('#stick').addEventListener('pointercancel',endStick);

$('#lookSurface').addEventListener('pointerdown',e=>{if(modalOpen)return;if(lookId===null){lookId=e.pointerId;lx=e.clientX;ly=e.clientY;$('#lookSurface').setPointerCapture(e.pointerId)}});
$('#lookSurface').addEventListener('pointermove',e=>{
  if(e.pointerId!==lookId||modalOpen)return;
  yaw-=(e.clientX-lx)*.005;
  pitch=T.MathUtils.clamp(pitch-(e.clientY-ly)*.004,-1.45,1.45);
  lx=e.clientX;
  ly=e.clientY;
});
const endLook=e=>{if(e.pointerId===lookId)lookId=null};
$('#lookSurface').addEventListener('pointerup',endLook);$('#lookSurface').addEventListener('pointercancel',endLook);

const fireBtn = $('#fire');
fireBtn.addEventListener('pointerdown', e => {
  e.preventDefault();
  handleFirePressStart();
});
fireBtn.addEventListener('pointerup', e => {
  e.preventDefault();
  handleFirePressEnd();
});
fireBtn.addEventListener('pointercancel', () => {
  handleFirePressEnd();
});
fireBtn.addEventListener('pointerleave', () => {
  if(combatState.fireHeld) handleFirePressEnd();
});

const skillBtn = $('#skillBtn');
if(skillBtn){
  skillBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    activateUnitSkill();
  });
}

$('#abortBattleBtn').addEventListener('pointerdown',e=>{e.preventDefault();abortBattle()});

const startBtn=$('#tapStartBtn');
let startTriggered=false;
const triggerStart=(e)=>{if(e)e.preventDefault();if(startTriggered)return;startTriggered=true;initEngineAndEnterHome();};
startBtn.addEventListener('pointerdown',triggerStart);
startBtn.addEventListener('click',triggerStart);

$('#saveUsernameBtn').addEventListener('pointerdown',e=>{
  e.preventDefault();
  const val=$('#usernameInput').value.trim();
  username=val||'ゲスト';
  saveGameData();
  enterHome();
});

document.querySelectorAll('.setup-mode-btn').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    selectedBattleMode = btn.dataset.mode;
    renderBattleSetupModal();
  });
});

$('#cancelSetupBtn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  closeAllModals();
  triggerCooldown = 45;
});

$('#confirmStartBattleBtn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if(!selectedBattleMode || !selectedDifficultyId) return;

  const chosenMode = selectedBattleMode;
  const chosenDiffId = selectedDifficultyId;
  const diffObj = getDifficultyById(chosenDiffId);
  const sharedMission = chosenMode === 'AIR_STRIKE'
    ? generateAirStrikeMissionData(CONFIG, diffObj)
    : null;

  if(isCoop && isHost && conn && conn.open){
    if(coopStarting) return;
    coopStarting = true;
    conn.send({
      type: 'startBattle',
      mode: chosenMode,
      diffId: chosenDiffId,
      missionData: sharedMission
    });
    startBattle(chosenMode, chosenDiffId, sharedMission);
  } else {
    startBattle(chosenMode, chosenDiffId, sharedMission);
  }
});

$('#confirmSkinBtn').addEventListener('pointerdown',e=>{e.preventDefault();confirmSkinSelection()});
$('#openUpgradeBtn').addEventListener('pointerdown',e=>{e.preventDefault();openUpgradeModal()});
$('#closeUpgradeBtn').addEventListener('pointerdown',e=>{
  e.preventDefault();
  $('#skinUpgradeModal').classList.remove('visible');
  renderSkinSelectList();
  $('#skinSelectModal').classList.add('visible');
});
$('#closeStoreBtn').addEventListener('pointerdown',e=>{e.preventDefault();closeAllModals();triggerCooldown=45});

$('#createRoomBtn').addEventListener('pointerdown',e=>{e.preventDefault();createCoopRoom()});
$('#recruitCoopBtn').addEventListener('pointerdown',e=>{e.preventDefault();publishCoopRecruit()});
$('#cancelRecruitBtn').addEventListener('pointerdown',e=>{e.preventDefault();cancelMyCoopRecruit(false)});
$('#joinRoomBtn').addEventListener('pointerdown',e=>{e.preventDefault();joinCoopRoom()});
$('#leaveCoopRoomBtn').addEventListener('pointerdown',e=>{e.preventDefault();leaveCoopRoom()});
$('#closeCoopBtn').addEventListener('pointerdown',e=>{e.preventDefault();closeAllModals();triggerCooldown=45});

const chatToggleBtn = $('#chatToggleBtn');
if(chatToggleBtn){
  chatToggleBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    expandChat();
  });
}
const chatMinimizeBtn = $('#chatMinimizeBtn');
if(chatMinimizeBtn){
  chatMinimizeBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    collapseChat();
  });
}
const chatSendBtn = $('#chatSendBtn');
if(chatSendBtn){
  chatSendBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    sendGlobalChatMessage();
  });
}
const chatInput = $('#chatInput');
if(chatInput){
  chatInput.addEventListener('keydown', e => {
    e.stopPropagation();
    if(e.key === 'Enter'){
      e.preventDefault();
      sendGlobalChatMessage();
    }
  });
}

$('#retryBattleBtn').addEventListener('pointerdown',e=>{
  e.preventDefault();
  const sharedMission = activeBattleMode === 'AIR_STRIKE'
    ? generateAirStrikeMissionData(CONFIG, activeDifficulty)
    : null;
  if(isCoop && isHost && conn && conn.open){
    conn.send({
      type: 'startBattle',
      mode: activeBattleMode,
      diffId: activeDifficulty.id,
      missionData: sharedMission
    });
  }
  startBattle(activeBattleMode, activeDifficulty.id, sharedMission);
});
$('#returnHomeBtn').addEventListener('pointerdown',e=>{e.preventDefault();enterHome()});

addEventListener('keydown',e=>{
  if(document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')){
    return;
  }
  if(!modalOpen){
    keys[e.code]=true;
    if(e.code==='Space' && !e.repeat){
      handleFirePressStart();
    }
    if((e.code==='KeyE' || e.code==='KeyQ') && !e.repeat){
      activateUnitSkill();
    }
  }
});
addEventListener('keyup',e=>{
  keys[e.code]=false;
  if(e.code==='Space'){
    handleFirePressEnd();
  }
});
addEventListener('resize',()=>{if(!renderer)return;renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()});

loadGameData();
