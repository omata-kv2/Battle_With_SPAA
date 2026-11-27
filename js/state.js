import { CONFIG } from './config.js';

export const state = {
  renderer: null,
  scene: null,
  camera: null,
  target: null,
  ready: false,
  loop: false,
  gameMode: 'start', // 'start' | 'home' | 'skin' | 'battle' | 'end'
  modalOpen: false,

  modelTemplates: { missile: null, fighter: null },
  enemies: [],
  fx: [],
  keys: {},
  move: { x: 0, y: 0 },

  wave: 1,
  peace: 100,
  spawned: 0,
  tick: 0,
  wait: 0,
  score: 0,
  earnedGoldInMatch: 0,
  gold: 0,
  yajuCoins: 0,
  inventory: { emp_shield: 0, hydrogen_bomb: 0, yaju_nuke: 0, hp_full: 0, hp_half: 0, power_double: 0, speed_up: 0, beast_god_stone: 0 },
  equippedItems: ['emp_shield', 'hydrogen_bomb', 'yaju_nuke'],
  usedItemsInMatch: {},
  powerBuffTimer: 0,
  speedBuffTimer: 0,
  beastGodActive: false,
  enemyFreezeTimer: 0,
  enemyFreezeType: null,

  yaw: 0,
  pitch: -0.05,
  x: 0,
  y: 0,
  z: 9,

  cameraViewMode: 'tps', // 'tps' | 'fps'
  autoFirstPersonNearWall: true,
  autoSwitchedToFps: false,
  gltfLoaderClass: null,
  playerModelSkinId: null,
  playerModelRoot: null,
  playerHullPivot: null,
  playerTurretPivot: null,
  playerGunPivot: null,
  playerModelCfg: null,
  playerBodyYaw: 0,

  username: '',
  playerCode: '',
  playerLevel: 1,
  playerXp: 0,
  friends: [],
  unlockedSkins: ['Origin'],
  selectedSkinId: 'Origin',
  pendingSelectedSkinId: 'Origin',
  skinUpgrades: {},

  homeController: null,
  skinController: null,
  triggerCooldown: 0,
  panelHoldTime: 0,
  lastFrameTime: performance.now(),
  syncTick: 0,

  selectedBattleMode: null,
  selectedDifficultyId: null,
  selectedYajuBossId: null,
  selectedYajuDiffId: null,
  activeBattleMode: 'FALL_MISSILE',
  activeDifficulty: CONFIG.DIFFICULTIES[0],
  airStrikeState: null
};

export function migrateSkinId(id){
  if(!id) return 'Origin';
  if(CONFIG.LEGACY_SKIN_MAP[id]) return CONFIG.LEGACY_SKIN_MAP[id];
  return id;
}

export function getSkinUpgrade(skinId){
  const normId = migrateSkinId(skinId);
  if(!state.skinUpgrades[normId]){
    state.skinUpgrades[normId] = {
      atk: 1, def: 1, hp: 1, rate: 1, score: 1, blast: 1,
      duration: 1, volley: 1, vertexShots: 1,
      turretCount: 1, laserTurretCount: 1,
      faith: 1, gayPower: 1, saint: 1,
      skill: 1
    };
  }
  const u = state.skinUpgrades[normId];
  const keysList = ['atk', 'def', 'hp', 'rate', 'score', 'blast', 'duration', 'volley', 'vertexShots', 'turretCount', 'laserTurretCount', 'faith', 'gayPower', 'saint', 'skill'];
  for(const k of keysList){
    if(typeof u[k] !== 'number') u[k] = 1;
  }
  return u;
}

export function getEquippedSkin(){
  return CONFIG.SKINS.find(s => s.id === state.selectedSkinId) || CONFIG.SKINS[0];
}

export function getDifficultyById(id){
  return CONFIG.DIFFICULTIES.find(d => d.id === id) || CONFIG.DIFFICULTIES[0];
}

export function getEffectiveStats(skin){
  const upg = getSkinUpgrade(skin.id);
  const skillLv = Math.max(1, Math.min(skin.skill.maxLv || 10, upg.skill));

  const faithBonus = skin.id === 'Beast' ? (upg.faith - 1) * 2 : 0;
  const saintHpBonus = skin.id === 'Beast' ? (upg.saint - 1) * 20 : 0;
  const saintShotBonus = skin.id === 'Beast' ? (upg.saint - 1) * 1 : 0;
  const gayScoreBonus = skin.id === 'Beast' ? (upg.gayPower - 1) * 0.10 : 0;

  const effectiveAtk = skin.stats.baseAtk + (upg.atk - 1) * 1 + faithBonus;
  const effectiveDef = 0 + (upg.def - 1) * 1 + faithBonus;
  const effectiveHp  = 100 + (upg.hp - 1) * 10 + saintHpBonus;
  const rawRate      = skin.stats.baseRate + (upg.rate - 1) * 0.5;
  const shotCount    = Math.max(1, Math.floor(rawRate) + saintShotBonus);
  const scoreMult    = skin.stats.scoreMult + (upg.score - 1) * 0.05 + gayScoreBonus;

  // Explosion 爆発範囲増加アップグレード: Lv.1(初期値)=0m 〜 Lv.10(最大)=+5.0m
  const blastLvClamped = Math.max(1, Math.min(10, upg.blast || 1));
  const bonusBlastRadiusM = Number(((blastLvClamped - 1) * (5 / 9)).toFixed(2));
  const blastRadiusM = bonusBlastRadiusM;

  const laserDurationSec = Number(((skin.baseLaserDuration || 3.0) + (upg.duration - 1) * 0.2).toFixed(1));
  const autoVolleyCount = (skin.baseVolleyCount || 2) + (upg.volley - 1);
  const wirbelVertexShots = 1 + upg.vertexShots;

  const rapidTurretCount = Math.max(1, Math.min(5, upg.turretCount || 1));
  const laserTurretCount = Math.max(1, Math.min(5, upg.laserTurretCount || 1));
  const additionalTurreDuration = Number((10.0 + (skillLv - 1) * 1.0).toFixed(1));

  const originBurstTargets = Math.round(5 + (skillLv - 1) * (25 / 9));
  const turretFireRate = rawRate;
  const fewChargerReduction = Number((0.5 + (skillLv - 1) * 0.1).toFixed(1));
  const infinitySpreadMult = Number((1.1 + (skillLv - 1) * (0.9 / 9)).toFixed(2));
  const neverStopperDuration = Number(Math.min(15.0, 10.0 + skillLv * 0.5).toFixed(1));
  const neverStopperRadiusMult = Number(Math.min(1.7, 1.2 + skillLv * 0.05).toFixed(2));
  const multiBurstExtraShots = skillLv;
  const germanTechTargets = Math.round(12 + (skillLv - 1) * (18 / 9));
  const beastEyesCooldown = skillLv >= 10 ? 0 : Number(Math.max(0.1, 1.0 - (skillLv - 1) * 0.1).toFixed(1));

  return {
    atk: effectiveAtk,
    def: effectiveDef,
    hp: effectiveHp,
    rawRate,
    shotCount,
    scoreMult,
    bonusBlastRadiusM,
    blastRadiusM,
    laserDurationSec,
    autoVolleyCount,
    wirbelVertexShots,
    rapidTurretCount,
    laserTurretCount,
    additionalTurreDuration,
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

export function loadGameData(){
  const savedUsername = localStorage.getItem('spaa_username');
  if(savedUsername !== null) state.username = savedUsername;

  const savedGold = localStorage.getItem('spaa_gold');
  if(savedGold !== null){
    const parsedGold = parseInt(savedGold, 10);
    if(!Number.isNaN(parsedGold)) state.gold = parsedGold;
  }

  const savedYajuCoins = localStorage.getItem('spaa_yaju_coins');
  if(savedYajuCoins !== null){
    const parsedCoins = parseInt(savedYajuCoins, 10);
    if(!Number.isNaN(parsedCoins)) state.yajuCoins = parsedCoins;
  }

  const savedEquipped = localStorage.getItem('spaa_equipped_items');
  if(savedEquipped){
    try{
      const arr = JSON.parse(savedEquipped);
      if(Array.isArray(arr) && arr.length === 3){
        state.equippedItems = arr;
      }
    }catch(e){}
  }

  const savedCode = localStorage.getItem('spaa_player_code');
  if(savedCode) state.playerCode = savedCode;
  if(!state.playerCode) state.playerCode = generatePlayerCode();

  const savedLv = parseInt(localStorage.getItem('spaa_player_level'), 10);
  if(!Number.isNaN(savedLv) && savedLv >= 1) state.playerLevel = savedLv;

  const savedXp = parseInt(localStorage.getItem('spaa_player_xp'), 10);
  if(!Number.isNaN(savedXp) && savedXp >= 0) state.playerXp = savedXp;

  const savedFriends = localStorage.getItem('spaa_friends');
  if(savedFriends){
    try{
      const arr = JSON.parse(savedFriends);
      if(Array.isArray(arr)) state.friends = arr;
    }catch(e){}
  }

  const savedInv = localStorage.getItem('spaa_inventory');
  if(savedInv){
    try{
      const invObj = JSON.parse(savedInv);
      if(invObj && typeof invObj === 'object'){
        for(const [k, rawV] of Object.entries(invObj)){
          const v = parseInt(rawV, 10);
          if(!Number.isNaN(v) && v >= 0) state.inventory[k] = v;
        }
      }
    }catch(e){}
  }

  const savedUnlocked = localStorage.getItem('spaa_unlocked_skins');
  if(savedUnlocked){
    try{
      const arr = JSON.parse(savedUnlocked);
      if(Array.isArray(arr) && arr.length > 0){
        state.unlockedSkins = Array.from(new Set(arr.map(migrateSkinId)));
      }
    }catch(e){}
  }
  if(!state.unlockedSkins.includes('Origin')) state.unlockedSkins.unshift('Origin');

  const savedSelected = localStorage.getItem('spaa_selected_skin');
  if(savedSelected){
    const migrated = migrateSkinId(savedSelected);
    if(state.unlockedSkins.includes(migrated)){
      state.selectedSkinId = migrated;
    }
  }

  const savedUpgrades = localStorage.getItem('spaa_skin_upgrades');
  if(savedUpgrades){
    try{
      const obj = JSON.parse(savedUpgrades);
      if(obj && typeof obj === 'object'){
        const migratedObj = {};
        for(const [k, v] of Object.entries(obj)){
          migratedObj[migrateSkinId(k)] = v;
        }
        state.skinUpgrades = migratedObj;
      }
    }catch(e){}
  }

  const savedCamMode = localStorage.getItem('spaa_camera_view_mode');
  if(savedCamMode === 'fps' || savedCamMode === 'tps'){
    state.cameraViewMode = savedCamMode;
  }
  const savedAutoFps = localStorage.getItem('spaa_auto_fps_near_wall');
  if(savedAutoFps !== null){
    state.autoFirstPersonNearWall = (savedAutoFps === 'true');
  }
}

export function saveGameData(){
  localStorage.setItem('spaa_username', state.username);
  localStorage.setItem('spaa_gold', String(state.gold));
  localStorage.setItem('spaa_yaju_coins', String(state.yajuCoins || 0));
  localStorage.setItem('spaa_inventory', JSON.stringify(state.inventory));
  if(!state.playerCode) state.playerCode = generatePlayerCode();
  localStorage.setItem('spaa_player_code', state.playerCode);
  localStorage.setItem('spaa_player_level', String(state.playerLevel || 1));
  localStorage.setItem('spaa_player_xp', String(state.playerXp || 0));
  localStorage.setItem('spaa_friends', JSON.stringify(state.friends || []));
  localStorage.setItem('spaa_equipped_items', JSON.stringify(state.equippedItems));
  localStorage.setItem('spaa_unlocked_skins', JSON.stringify(state.unlockedSkins));
  localStorage.setItem('spaa_selected_skin', state.selectedSkinId);
  localStorage.setItem('spaa_skin_upgrades', JSON.stringify(state.skinUpgrades));
  localStorage.setItem('spaa_camera_view_mode', state.cameraViewMode || 'tps');
  localStorage.setItem('spaa_auto_fps_near_wall', String(!!state.autoFirstPersonNearWall));
}

export function resetMatchInventoryUsage(){
  state.usedItemsInMatch = {};
  state.enemyFreezeTimer = 0;
  state.enemyFreezeType = null;
  state.powerBuffTimer = 0;
  state.speedBuffTimer = 0;
  state.beastGodActive = false;
}

export function generatePlayerCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SPAA-';
  for(let i = 0; i < 6; i++){
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getRequiredXpForLevel(lv = state.playerLevel){
  return Math.max(1, lv) * 100;
}

let levelUpListeners = [];
export function onPlayerLevelUp(cb){
  levelUpListeners.push(cb);
}

export function gainXp(rawAmount){
  const mult = state.beastGodActive ? 2 : 1;
  const amount = Math.max(0, Math.round(rawAmount * mult));
  if(amount <= 0) return 0;

  state.playerXp = (state.playerXp || 0) + amount;
  let leveledUp = false;
  while(state.playerXp >= getRequiredXpForLevel(state.playerLevel)){
    state.playerXp -= getRequiredXpForLevel(state.playerLevel);
    state.playerLevel = (state.playerLevel || 1) + 1;
    leveledUp = true;
  }
  saveGameData();
  levelUpListeners.forEach(cb => cb(leveledUp));
  return amount;
}

export function addFriendByCode(codeRaw, nameRaw = ''){
  const code = (codeRaw || '').trim().toUpperCase();
  if(!code) return { ok: false, msg: 'プレイヤーコードを入力してください' };
  if(code === state.playerCode) return { ok: false, msg: '自分のコードは追加できません' };
  if(!Array.isArray(state.friends)) state.friends = [];
  if(state.friends.some(f => f.code === code)){
    return { ok: false, msg: 'すでにフレンド登録済みです' };
  }
  const name = (nameRaw || '').trim() || `プレイヤー(${code.slice(-4)})`;
  state.friends.push({ code, name });
  saveGameData();
  return { ok: true, msg: `${name} をフレンドに追加しました！` };
}

export function exportSaveCode(){
  if(!state.playerCode) state.playerCode = generatePlayerCode();
  const payload = {
    v: 54,
    u: state.username || '',
    c: state.playerCode,
    lv: state.playerLevel || 1,
    xp: state.playerXp || 0,
    g: state.gold || 0,
    y: state.yajuCoins || 0,
    us: state.unlockedSkins || ['Origin'],
    ss: state.selectedSkinId || 'Origin',
    su: state.skinUpgrades || {},
    inv: state.inventory || {},
    eq: state.equippedItems || ['emp_shield', 'hydrogen_bomb', 'yaju_nuke'],
    fr: state.friends || []
  };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for(const b of bytes) bin += String.fromCharCode(b);
  return 'SPAA54:' + btoa(bin);
}

export function importSaveCode(rawStr){
  const str = (rawStr || '').trim();
  if(!str.startsWith('SPAA54:')) return { ok: false, msg: '引き継ぎコードの形式が正しくありません' };
  try{
    const b64 = str.slice(7);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const d = JSON.parse(json);
    if(!d || typeof d !== 'object') throw new Error('invalid');

    state.username = d.u || 'パルス防衛官';
    state.playerCode = d.c || generatePlayerCode();
    state.playerLevel = Math.max(1, parseInt(d.lv, 10) || 1);
    state.playerXp = Math.max(0, parseInt(d.xp, 10) || 0);
    state.gold = Math.max(0, parseInt(d.g, 10) || 0);
    state.yajuCoins = Math.max(0, parseInt(d.y, 10) || 0);
    if(Array.isArray(d.us) && d.us.length > 0) state.unlockedSkins = Array.from(new Set(d.us.map(migrateSkinId)));
    if(!state.unlockedSkins.includes('Origin')) state.unlockedSkins.unshift('Origin');
    state.selectedSkinId = migrateSkinId(d.ss || 'Origin');
    if(d.su && typeof d.su === 'object') state.skinUpgrades = d.su;
    if(d.inv && typeof d.inv === 'object') state.inventory = { ...state.inventory, ...d.inv };
    if(Array.isArray(d.eq) && d.eq.length === 3) state.equippedItems = d.eq;
    if(Array.isArray(d.fr)) state.friends = d.fr;

    saveGameData();
    return { ok: true, msg: '引き継ぎデータを復元しました！' };
  }catch(e){
    return { ok: false, msg: '引き継ぎコードの復元に失敗しました' };
  }
}
