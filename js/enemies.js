import * as T from './libs/three.module.js';
import { CONFIG } from './config.js';
import { state, getEquippedSkin, getEffectiveStats, gainXp } from './state.js';
import { hud, announce } from './ui.js';
import { spawn } from './map-fall-missile.js';

export function getMaxWaves(){
  return (state.activeDifficulty && state.activeDifficulty.waves) ? state.activeDifficulty.waves : 5;
}

export function getEnemyMult(){
  return (state.activeDifficulty && state.activeDifficulty.enemyMult) ? state.activeDifficulty.enemyMult : 1.0;
}

export function getSpeedMult(){
  return (state.activeDifficulty && state.activeDifficulty.speedMult) ? state.activeDifficulty.speedMult : 1.0;
}

export function getWaveEnemyCounts(waveNum){
  const idx = Math.min(waveNum - 1, CONFIG.COUNTS.length - 1);
  const mult = getEnemyMult();
  const baseM = CONFIG.COUNTS[idx] || (8 + waveNum * 5);
  const baseF = CONFIG.FIGHTER_COUNTS[idx] || Math.max(0, waveNum - 1);
  return {
    missiles: Math.max(1, Math.round(baseM * mult)),
    fighters: Math.max(0, Math.round(baseF * mult))
  };
}

export function waveTotal(w, isCoop = false){
  const c = getWaveEnemyCounts(w);
  const base = c.missiles + c.fighters;
  return isCoop ? Math.ceil(base * 1.5) : base;
}

export function clearEnemiesAndFx(){
  if(state.scene){
    for(const e of state.enemies) state.scene.remove(e);
    for(const f of state.fx) state.scene.remove(f.m);
  }
  state.enemies.length = 0;
  state.fx.length = 0;
}

export function burst(p, col = 0xff9233){
  if(!state.scene) return;
  for(let i = 0; i < 14; i++){
    const m = new T.Mesh(new T.SphereGeometry(.17, 6, 5), new T.MeshBasicMaterial({ color: col }));
    m.position.copy(p);
    state.scene.add(m);
    state.fx.push({ m, life: 24, v: new T.Vector3((Math.random() - .5) * .36, Math.random() * .34, (Math.random() - .5) * .36) });
  }
}

export function burstWhiteStrong(p){
  if(!state.scene) return;
  for(let i = 0; i < 24; i++){
    const size = i % 3 === 0 ? 0.28 : 0.19;
    const m = new T.Mesh(new T.SphereGeometry(size, 7, 6), new T.MeshBasicMaterial({ color: 0xffffff }));
    m.position.copy(p);
    state.scene.add(m);
    state.fx.push({
      m,
      life: 28,
      v: new T.Vector3((Math.random() - .5) * .48, (Math.random() - .2) * .46, (Math.random() - .5) * .48)
    });
  }
}

export function spawnEnemy(isCoop = false){
  const c = getWaveEnemyCounts(state.wave);
  const fMax = isCoop ? Math.ceil(c.fighters * 1.5) : c.fighters;
  const fNow = state.enemies.filter(e => e.userData.kind === 'fighter').length;
  const kind = (fNow < fMax && Math.random() < .35) ? 'fighter' : 'missile';
  const e = spawn(T, state.scene, state.target, state.wave, {}, kind, state.modelTemplates, false, null, getSpeedMult());
  state.enemies.push(e);
  state.spawned++;
}

export function applyEnemyDamage(enemyObj, dmg, beamColor, scoreMult, coopCtx = {}, finishBattleCb = null){
  const { isCoop = false, isHost = false, sendCoop = null, fromRemote = false, strongWhiteFx = false } = coopCtx;
  if(!enemyObj || !state.enemies.includes(enemyObj)) return;

  enemyObj.userData.hp -= dmg;
  if(strongWhiteFx) burstWhiteStrong(enemyObj.position);
  else burst(enemyObj.position, beamColor);

  if(enemyObj.userData.hp <= 0){
    const idx = state.enemies.indexOf(enemyObj);
    if(idx >= 0){
      if(strongWhiteFx) burstWhiteStrong(enemyObj.position);
      else burst(enemyObj.position, 0xffd23f);

      const basePts = enemyObj.userData.kind === 'fighter' ? CONFIG.SCORE_FIGHTER : CONFIG.SCORE_MISSILE;
      const pts = Math.round(basePts * scoreMult);
      state.score += pts;
      state.earnedGoldInMatch += pts;
      gainXp(enemyObj.userData.kind === 'fighter' ? 50 : 10);

      const eid = enemyObj.userData.id;
      state.scene.remove(enemyObj);
      state.enemies.splice(idx, 1);

      const rem = waveTotal(state.wave, isCoop) - state.spawned + state.enemies.length;
      hud(state.wave, rem, state.peace, getMaxWaves());

      if(isCoop && isHost && !fromRemote && sendCoop){
        sendCoop({ type: 'destroyEnemy', enemyId: eid, beamColor, remaining: rem });
      }
    }
  }
}

export function updateEnemiesAndWave(dt, coopCtx = {}, finishBattleCb = null){
  const { isCoop = false, isHost = false, sendCoop = null } = coopCtx;
  const maxWaves = getMaxWaves();
  const totalInWave = waveTotal(state.wave, isCoop);

  const isFrozen = state.enemyFreezeTimer > 0;
  if(isFrozen){
    state.enemyFreezeTimer = Math.max(0, state.enemyFreezeTimer - dt);
    if(state.enemyFreezeType === 'emp' && state.syncTick % 7 === 0 && state.scene){
      for(const e of state.enemies){
        const ring = new T.Mesh(
          new T.TorusGeometry(0.95, 0.05, 5, 14),
          new T.MeshBasicMaterial({ color: 0x38c8f0, transparent: true, opacity: 0.85 })
        );
        ring.position.copy(e.position);
        ring.rotation.x = Math.random() * Math.PI;
        ring.rotation.y = Math.random() * Math.PI;
        state.scene.add(ring);
        state.fx.push({ m: ring, life: 10 });
      }
    }
    if(state.enemyFreezeTimer <= 0) state.enemyFreezeType = null;
  }

  if(!isFrozen && (!isCoop || isHost)){
    state.tick++;
    const spawnInterval = Math.max(16, Math.round((56 - state.wave * 5) / getSpeedMult()));
    if(state.spawned < totalInWave && state.enemies.length < CONFIG.MAX_ENEMIES && state.tick > spawnInterval){
      spawnEnemy(isCoop);
      if(isCoop && isHost && sendCoop){
        const lastEn = state.enemies[state.enemies.length - 1];
        sendCoop({ type: 'spawnEnemy', payload: lastEn.userData });
      }
      state.tick = 0;
    }
  }

  if(!isFrozen){
  for(let i = state.enemies.length - 1; i >= 0; i--){
    const e = state.enemies[i], u = e.userData;
    e.position.add(u.v);
    if(u.kind === 'fighter'){
      u.a += .05;
      e.position.x += Math.sin(u.a) * .06;
      e.rotation.z = Math.sin(u.a) * .3;
    }

    if((!isCoop || isHost) && e.position.y <= 0){
      const skin = getEquippedSkin();
      const eff = getEffectiveStats(skin);
      const rawDmg = u.kind === 'fighter' ? 14 : 9;
      const reducedDmg = Math.max(1, rawDmg - eff.def);
      state.peace = Math.max(0, state.peace - reducedDmg);
      burst(e.position, 0xff4d6d);
      const eid = u.id;
      state.scene.remove(e);
      state.enemies.splice(i, 1);

      const remNow = totalInWave - state.spawned + state.enemies.length;
      if(isCoop && isHost && sendCoop){
        sendCoop({ type: 'destroyEnemy', enemyId: eid, beamColor: 0xff4d6d, remaining: remNow });
      }
      if(state.peace <= 0){
        if(isCoop && isHost && sendCoop) sendCoop({ type: 'battleEnd', win: false });
        if(finishBattleCb) finishBattleCb(false);
        return;
      }
    }
  }

  }
  const rem = totalInWave - state.spawned + state.enemies.length;
  hud(state.wave, rem, state.peace, maxWaves);

  if(isCoop && isHost && sendCoop && state.syncTick % 5 === 0){
    sendCoop({
      type: 'syncBattleState',
      wave: state.wave,
      peace: state.peace,
      score: state.score,
      remaining: rem,
      enemies: state.enemies.map(e => ({ id: e.userData.id, px: e.position.x, py: e.position.y, pz: e.position.z, hp: e.userData.hp }))
    });
  }

  if((!isCoop || isHost) && rem <= 0 && state.enemies.length === 0){
    state.wait++;
    if(state.wait === 1) announce(state.wave < maxWaves ? `WAVE ${state.wave} CLEAR` : 'ALL WAVES CLEAR');
    if(state.wait > 85){
      if(state.wave < maxWaves){
        state.wave++;
        state.spawned = 0;
        state.wait = 0;
        announce(`WAVE ${state.wave} / ${maxWaves} — INCOMING`);
      } else {
        if(isCoop && isHost && sendCoop) sendCoop({ type: 'battleEnd', win: true });
        if(finishBattleCb) finishBattleCb(true);
      }
    }
  }
}
