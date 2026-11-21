import * as T from './libs/three.module.js';
import { state } from './state.js';
import { buildStage } from './map-fall-missile.js';
import { beginWave, updateBattleHud, updateEnemiesFrame } from './enemies.js';
import { updateCombatSystem } from './player.js';

export function startFallMissileBattle(coopCtx, createRemoteMeshFn){
  buildStage(T, state.scene, state.activeDifficulty);
  state.x = 0;
  state.y = 0;
  state.z = 8;
  state.yaw = 0;
  state.pitch = 0.35;
  beginWave(coopCtx.isCoop);
  updateBattleHud(coopCtx.isCoop);

  if(coopCtx.isCoop && createRemoteMeshFn){
    createRemoteMeshFn();
  }
}

export function updateFallMissileMode(dt, coopCtx, onBattleFinish){
  updateCombatSystem(dt, coopCtx);
  updateEnemiesFrame({
    isCoop: coopCtx.isCoop,
    isHost: coopCtx.isHost,
    sendCoop: coopCtx.sendCoop,
    onBattleFinish
  });
}
