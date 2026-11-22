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

  yaw: 0,
  pitch: -0.05,
  x: 0,
  y: 0,
  z: 9,

  username: '',
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

  const blastRadiusM = (skin.baseBlastRadiusM || 1.0) + (upg.blast - 1) * 0.2;
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
}

export function saveGameData(){
  localStorage.setItem('spaa_username', state.username);
  localStorage.setItem('spaa_gold', String(state.gold));
  localStorage.setItem('spaa_unlocked_skins', JSON.stringify(state.unlockedSkins));
  localStorage.setItem('spaa_selected_skin', state.selectedSkinId);
  localStorage.setItem('spaa_skin_upgrades', JSON.stringify(state.skinUpgrades));
}
