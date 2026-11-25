import { CONFIG } from './config.js';
import { state, getEquippedSkin, getEffectiveStats } from './state.js';
import { announce, hud, setModeUI, updateSkillButtonUI } from './ui.js';
import { clearEnemiesAndFx, getMaxWaves, waveTotal } from './enemies.js';
import { resetCombatState, updateCombatSystem, initLaserTurretDeployState } from './player.js';

export function initFallMissileMode(buildBattleWorldFn, coopCtx = {}){
  state.activeBattleMode = 'FALL_MISSILE';
  state.wave = 1;
  state.peace = 100;
  state.spawned = 0;
  state.tick = 0;
  state.wait = 0;
  state.score = 0;
  state.earnedGoldInMatch = 0;
  state.x = 0;
  state.y = 0;
  state.z = 9;
  state.yaw = 0;
  state.pitch = -0.05;

  clearEnemiesAndFx();
  resetCombatState();

  const diffObj = state.activeDifficulty || CONFIG.DIFFICULTIES[0];
  buildBattleWorldFn(diffObj);

  const skin = getEquippedSkin();
  const eff = getEffectiveStats(skin);
  setModeUI('battle', skin, coopCtx.isCoop, coopCtx.isHost, 'FALL_MISSILE');
  updateSkillButtonUI(skin.skill.name, eff.skillLv, 'ready', 0);

  if(skin.attackType === 'laser'){
    initLaserTurretDeployState(eff.laserTurretCount);
    announce(`WAVE 1 / ${getMaxWaves()} — 右下のボタンでタレットを${eff.laserTurretCount}基設置せよ！`);
  } else {
    announce(`WAVE 1 / ${getMaxWaves()} (${diffObj.name}) — ${skin.name} 出撃`);
  }
  hud(1, waveTotal(1, coopCtx.isCoop), 100, getMaxWaves());
}

export function updateFallMissileMode(dt, coopCtx = {}, finishBattleCb = null){
  updateCombatSystem(dt, coopCtx);
}
