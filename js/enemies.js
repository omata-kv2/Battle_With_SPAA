import * as T from './libs/three.module.js';
import { CONFIG } from './config.js';
import { state, getEquippedSkin, getEffectiveStats, saveGameData } from './state.js';
import { hud, announce } from './ui.js';
import { spawn } from './map-fall-missile.js';

export function burst(p, colorHex = 0x78e7ff){
  if(!state.scene) return;
  for(let i = 0; i < 6; i++){
    const m = new T.Mesh(
      new T.SphereGeometry(0.12, 6, 5),
      new T.MeshBasicMaterial({ color: i % 2 ? colorHex : 0xffffff })
    );
    m.position.copy(p);
    state.scene.add(m);
    state.fx.push({
      m,
      life: 20,
      v: new T.Vector3((Math.random() - 0.5) * 0.2, Math.random() * 0.15, (Math.random() - 0.5) * 0.2)
    });
  }
}

export function burstWhiteStrong(p){
  if(!state.scene) return;
  for(let i = 0; i < 14; i++){
    const radius = i % 3 === 0 ? 0.24 : 0.15;
    const m = new T.Mesh(
      new T.SphereGeometry(radius, 8, 6),
      new T.MeshBasicMaterial({ color: 0xffffff })
    );
    m.position.copy(p);
    state.scene.add(m);
    state.fx.push({
      m,
      life: 28,
      v: new T.Vector3((Math.random() - 0.5) * 0.36, (Math.random() - 0.2) * 0.32, (Math.random() - 0.5) * 0.36)
    });
  }
}

export function getMaxWaves(){
  return state.activeDifficulty ? state.activeDifficulty.waves : 5;
}

export function beginWave(isCoop = false){
  const skin = getEquippedSkin();
  state.spawned = 0;
  state.tick = 0;
  state.wait = 0;
  const modeLabel = isCoop ? '【共闘】' : '';
  announce(`${modeLabel}[${state.activeDifficulty.name}] WAVE ${state.wave} / ${getMaxWaves()} — [${skin.name}]`);
}

export function waveTotal(isCoop = false){
  const idx = Math.min(state.wave - 1, CONFIG.COUNTS.length - 1);
  const diffMult = state.activeDifficulty ? state.activeDifficulty.enemyMult : 1.0;
  const missileCount = Math.round(CONFIG.COUNTS[idx] * diffMult);
  const baseFighter = CONFIG.FIGHTER_COUNTS[idx] || 0;
  const fighterCount = isCoop ? baseFighter * 3 : baseFighter;
  return missileCount + fighterCount;
}

export function waveMissileCount(){
  const idx = Math.min(state.wave - 1, CONFIG.COUNTS.length - 1);
  const diffMult = state.activeDifficulty ? state.activeDifficulty.enemyMult : 1.0;
  return Math.round(CONFIG.COUNTS[idx] * diffMult);
}

export function updateBattleHud(isCoop = false){
  hud(state.wave, Math.max(0, state.enemies.length + waveTotal(isCoop) - state.spawned), state.peace, getMaxWaves());
}

export function applyEnemyDamage(enemyObj, dmg, beamColor, skinScoreMult, { isCoop = false, isHost = false, sendCoop = null, fromRemote = false, strongWhiteFx = false } = {}){
  if(!enemyObj) return;
  enemyObj.userData.hp -= dmg;
  if(strongWhiteFx){
    burstWhiteStrong(enemyObj.position);
  } else {
    burst(enemyObj.position, beamColor);
  }

  if(enemyObj.userData.hp <= 0){
    state.scene.remove(enemyObj);
    const idx = state.enemies.indexOf(enemyObj);
    if(idx !== -1) state.enemies.splice(idx, 1);

    if(!fromRemote){
      const basePts = (enemyObj.userData.kind === 'fighter') ? CONFIG.SCORE_FIGHTER : CONFIG.SCORE_MISSILE;
      const gained = Math.round(basePts * skinScoreMult);
      state.score += gained;
      if(!isCoop){
        state.earnedGoldInMatch += gained;
        state.gold += gained;
        saveGameData();
      } else if(isHost && sendCoop){
        sendCoop({ type: 'enemyDestroyed', enemyId: enemyObj.userData.id, score: state.score });
      }
    }
  }
}

export function updateEnemiesFrame({ isCoop, isHost, sendCoop, onBattleFinish }){
  const skin = getEquippedSkin();
  const eff = getEffectiveStats(skin);
  const maxWaves = getMaxWaves();
  const diffSpeedMult = state.activeDifficulty ? state.activeDifficulty.speedMult : 1.0;

  if(!isCoop || isHost){
    if(state.spawned < waveTotal(isCoop) && state.enemies.length < CONFIG.MAX_ENEMIES && ++state.tick > 34){
      state.tick = 0;
      const mCount = waveMissileCount();
      const type = (state.spawned < mCount) ? 'missile' : 'fighter';
      const e = spawn(T, state.scene, state.target, state.wave, CONFIG, type, state.modelTemplates, isCoop, null, diffSpeedMult);
      state.enemies.push(e);
      state.spawned++;

      if(isCoop && isHost && sendCoop && e.userData.syncPayload){
        sendCoop({ type: 'spawnEnemy', payload: e.userData.syncPayload });
      }
    }

    const enemySyncData = [];
    for(let i = state.enemies.length - 1; i >= 0; i--){
      const e = state.enemies[i];
      e.userData.phase += 0.04;
      if(e.userData.kind === 'fighter'){
        e.position.add(e.userData.velocity);
        e.position.y += Math.sin(e.userData.phase) * 0.015;
        if(Math.hypot(e.position.x, e.position.z) < 2.2){
          state.scene.remove(e);
          state.enemies.splice(i, 1);
          const dmgToPeace = Math.max(1, 20 - Math.floor(eff.def * 0.5));
          state.peace = Math.max(0, state.peace - dmgToPeace);
          if(state.peace <= 0){
            if(isCoop && isHost && sendCoop) sendCoop({ type: 'battleEnd', win: false, score: state.score });
            onBattleFinish(false);
            return;
          }
          continue;
        }
      } else {
        e.position.add(e.userData.velocity);
        e.rotation.z += 0.02;
        if(e.position.y <= -1.5){
          state.scene.remove(e);
          state.enemies.splice(i, 1);
          const dmgToPeace = Math.max(1, 14 - Math.floor(eff.def * 0.5));
          state.peace = Math.max(0, state.peace - dmgToPeace);
          if(state.peace <= 0){
            if(isCoop && isHost && sendCoop) sendCoop({ type: 'battleEnd', win: false, score: state.score });
            onBattleFinish(false);
            return;
          }
          continue;
        }
      }
      enemySyncData.push({ id: e.userData.id, px: e.position.x, py: e.position.y, pz: e.position.z, hp: e.userData.hp });
    }

    if(isCoop && isHost && sendCoop && state.syncTick % 3 === 0){
      sendCoop({
        type: 'syncBattleState',
        wave: state.wave,
        peace: state.peace,
        score: state.score,
        remaining: Math.max(0, state.enemies.length + waveTotal(isCoop) - state.spawned),
        enemies: enemySyncData
      });
    }

    updateBattleHud(isCoop);
    if(state.spawned >= waveTotal(isCoop) && !state.enemies.length && ++state.wait > 50){
      if(state.wave < maxWaves){
        state.wave++;
        beginWave(isCoop);
      } else {
        if(isCoop && isHost && sendCoop) sendCoop({ type: 'battleEnd', win: true, score: state.score });
        onBattleFinish(true);
      }
    }
  } else {
    for(let i = state.enemies.length - 1; i >= 0; i--){
      const e = state.enemies[i];
      e.position.add(e.userData.velocity);
    }
  }
}
