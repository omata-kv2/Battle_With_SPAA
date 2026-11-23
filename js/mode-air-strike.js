import * as T from './libs/three.module.js';
import { CONFIG } from './config.js';
import { state, getEquippedSkin, getEffectiveStats } from './state.js';
import { announce, airStrikeHud, setModeUI, showToast, triggerWhiteFadeOut } from './ui.js';
import { burst } from './enemies.js';
import { buildAirStrikeWorld } from './map-air-strike.js';

export function generateAirStrikeMissionData(cfg, diffObj){
  const angle = Math.random() * Math.PI * 2;
  const dist = 34 + Math.random() * 58;
  const targetX = Math.cos(angle) * dist;
  const targetZ = Math.sin(angle) * dist;

  const count = diffObj ? diffObj.obstacleCount : 24;
  const shapes = ['box', 'cylinder', 'ring', 'cross', 'blade'];
  const obstacles = [];

  for(let i = 0; i < count; i++){
    const t = 0.14 + (i / Math.max(1, count)) * 0.76 + (Math.random() - 0.5) * 0.06;
    const clampedT = Math.max(0.12, Math.min(0.92, t));
    const py = cfg.AIR_STRIKE.START_Y * (1 - clampedT) + 2.5;
    const baseAxisX = targetX * clampedT;
    const baseAxisZ = targetZ * clampedT;
    const spreadR = 6 + (1 - clampedT) * 26;
    const ang = Math.random() * Math.PI * 2;
    const rad = (0.18 + Math.random() * 0.82) * spreadR;

    const px = baseAxisX + Math.cos(ang) * rad;
    const pz = baseAxisZ + Math.sin(ang) * rad;

    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const size = 2.6 + Math.random() * 4.4;
    const rotSpeedX = (Math.random() - 0.5) * 1.4;
    const rotSpeedY = (Math.random() - 0.5) * 1.8;
    const rotSpeedZ = (Math.random() - 0.5) * 1.4;
    const moveAmp = Math.random() < 0.45 ? (1.8 + Math.random() * 4.2) : 0;
    const moveFreq = 0.8 + Math.random() * 1.6;
    const movePhase = Math.random() * Math.PI * 2;

    obstacles.push({
      shape,
      x: px,
      y: py,
      z: pz,
      size,
      rotSpeedX,
      rotSpeedY,
      rotSpeedZ,
      moveAmp,
      moveFreq,
      movePhase
    });
  }

  return {
    targetX,
    targetZ,
    obstacles
  };
}

export function createAirStrikePlayerActor(isRemote = false, labelName = '', makeTextSpriteFn = null){
  const root = new T.Group();

  const jetGroup = new T.Group();
  if(state.modelTemplates.fighter){
    const jetClone = state.modelTemplates.fighter.clone(true);
    jetClone.scale.setScalar(1.35);
    jetGroup.add(jetClone);
  } else {
    const body = new T.Mesh(
      new T.ConeGeometry(0.9, 4.2, 6),
      new T.MeshStandardMaterial({ color: isRemote ? 0x3b82f6 : 0x64748b, metalness: 0.7, roughness: 0.3 })
    );
    body.rotation.x = Math.PI / 2;
    jetGroup.add(body);
  }
  jetGroup.position.set(0, 1.35, 0);
  root.add(jetGroup);

  const missileHolder = new T.Group();
  if(state.modelTemplates.missile){
    const mClone = state.modelTemplates.missile.clone(true);
    mClone.scale.setScalar(0.95);
    missileHolder.add(mClone);
  } else {
    const mBody = new T.Mesh(
      new T.CylinderGeometry(0.24, 0.28, 2.8, 12),
      new T.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.65, roughness: 0.25 })
    );
    const nose = new T.Mesh(
      new T.ConeGeometry(0.24, 0.7, 12),
      new T.MeshBasicMaterial({ color: 0xff4d6d })
    );
    nose.position.y = -1.75;
    nose.rotation.x = Math.PI;
    missileHolder.add(mBody, nose);
  }
  missileHolder.position.set(0, 0.25, 0);
  root.add(missileHolder);

  const flameGroup = new T.Group();
  const outerFlame = new T.Mesh(
    new T.ConeGeometry(0.32, 1.5, 10),
    new T.MeshBasicMaterial({ color: 0xff6b00, transparent: true, opacity: 0.85 })
  );
  outerFlame.position.set(0, 1.85, 0);
  const innerFlame = new T.Mesh(
    new T.ConeGeometry(0.16, 0.95, 8),
    new T.MeshBasicMaterial({ color: 0xfff066, transparent: true, opacity: 0.95 })
  );
  innerFlame.position.set(0, 1.6, 0);
  flameGroup.add(outerFlame, innerFlame);
  flameGroup.visible = false;
  missileHolder.add(flameGroup);

  let nameSprite = null;
  if(isRemote && makeTextSpriteFn){
    nameSprite = makeTextSpriteFn(T, labelName || '僚機', 'rgba(10,30,45,0.85)', '#38c8f0');
    nameSprite.position.set(0, 2.2, 0);
    root.add(nameSprite);
  }

  state.scene.add(root);
  return {
    root,
    jetGroup,
    missileHolder,
    flameGroup,
    nameSprite,
    jetDetached: false,
    jetVel: new T.Vector3(0, 0.15, -0.75)
  };
}

export function initAirStrikeMode(missionData, coopCtx = {}){
  state.activeBattleMode = 'AIR_STRIKE';
  state.score = 0;
  state.earnedGoldInMatch = 0;
  state.wave = 1;
  state.peace = 100;

  const diffObj = state.activeDifficulty || CONFIG.DIFFICULTIES[0];
  const data = missionData || generateAirStrikeMissionData(CONFIG, diffObj);

  const worldRefs = buildAirStrikeWorld(T, state.scene, diffObj, data);

  const spawnX = coopCtx.isCoop ? (coopCtx.isHost ? -4.0 : 4.0) : 0;
  const spawnY = CONFIG.AIR_STRIKE.START_Y;
  const spawnZ = 0;

  state.x = spawnX;
  state.y = spawnY;
  state.z = spawnZ;
  state.yaw = Math.atan2(-data.targetX, -data.targetZ);
  state.pitch = -0.35;

  const localActor = createAirStrikePlayerActor(false);
  localActor.root.position.set(spawnX, spawnY, spawnZ);

  state.airStrikeState = {
    phase: 'countdown',
    countdownTimer: CONFIG.AIR_STRIKE.LAUNCH_DELAY_SEC,
    altitudeM: CONFIG.AIR_STRIKE.START_ALTITUDE_M,
    survivedM: 0,
    targetX: data.targetX,
    targetZ: data.targetZ,
    obstacles: worldRefs.obstacles,
    beacon: worldRefs.beacon,
    localActor,
    localFinished: false,
    localHitTarget: false,
    localFinalScore: 0,
    elapsedTime: 0
  };

  const skin = getEquippedSkin();
  setModeUI('battle', skin, coopCtx.isCoop, coopCtx.isHost, 'AIR_STRIKE');
  announce('AIR STRIKE — 戦闘機発進準備中… 3秒後にミサイル切り離し！');
  airStrikeHud(100, 0, 0);
}

export function updateAirStrikeMode(dt, coopCtx = {}, finishBattleCb = null){
  const as = state.airStrikeState;
  if(!as) return;

  as.elapsedTime += dt;

  if(as.beacon){
    as.beacon.ringOuter.rotation.z += dt * 1.6;
    as.beacon.ringInner.rotation.z -= dt * 2.4;
    as.beacon.pillar.material.opacity = 0.16 + Math.sin(as.elapsedTime * 5) * 0.08;
  }

  for(const ob of as.obstacles){
    ob.mesh.rotation.x += ob.rotSpeedX * dt;
    ob.mesh.rotation.y += ob.rotSpeedY * dt;
    ob.mesh.rotation.z += ob.rotSpeedZ * dt;
    if(ob.moveAmp > 0){
      ob.mesh.position.x = ob.baseX + Math.sin(as.elapsedTime * ob.moveFreq + ob.movePhase) * ob.moveAmp;
    }
  }

  const actor = as.localActor;

  if(as.phase === 'countdown'){
    as.countdownTimer = Math.max(0, as.countdownTimer - dt);
    const secStr = Math.ceil(as.countdownTimer);
    announce(`切り離しまで ${secStr} 秒… 目標地点（光柱）を確認せよ！`);

    state.x += Math.sin(state.yaw) * -4.0 * dt;
    state.z += Math.cos(state.yaw) * -4.0 * dt;
    actor.root.position.set(state.x, state.y, state.z);
    actor.jetGroup.rotation.y = state.yaw;
    actor.missileHolder.rotation.y = state.yaw;

    if(as.countdownTimer <= 0){
      as.phase = 'flying';
      actor.jetDetached = true;
      actor.flameGroup.visible = true;
      burst(new T.Vector3(state.x, state.y + 0.5, state.z), 0xff9233);
      announce('ミサイル発射！スティック・視点操作で障害物を回避し、目標へ着弾させろ！');
    }
  } else if(as.phase === 'flying'){
    if(actor.jetDetached){
      actor.jetGroup.position.y += 6.5 * dt;
      actor.jetGroup.position.z -= 18.0 * dt;
    }

    const skin = getEquippedSkin();
    const eff = getEffectiveStats(skin);
    const steerSpeed = 24.0 * (skin.stats.moveMult || 1.0);

    const mx = (state.keys.KeyD || state.keys.ArrowRight ? 1 : 0) - (state.keys.KeyA || state.keys.ArrowLeft ? 1 : 0) + state.move.x;
    const mz = (state.keys.KeyS || state.keys.ArrowDown ? 1 : 0) - (state.keys.KeyW || state.keys.ArrowUp ? 1 : 0) + state.move.y;

    const fwdX = -Math.sin(state.yaw);
    const fwdZ = -Math.cos(state.yaw);
    const rightX = Math.cos(state.yaw);
    const rightZ = -Math.sin(state.yaw);

    const forwardInput = -mz;
    const baseCruise = 11.5;
    const totalFwd = baseCruise + forwardInput * steerSpeed * 0.75;
    const totalRight = mx * steerSpeed;

    state.x += (fwdX * totalFwd + rightX * totalRight) * dt;
    state.z += (fwdZ * totalFwd + rightZ * totalRight) * dt;

    state.x = T.MathUtils.clamp(state.x, -125, 125);
    state.z = T.MathUtils.clamp(state.z, -125, 125);

    const speedMult = (state.activeDifficulty && state.activeDifficulty.speedMult) ? state.activeDifficulty.speedMult : 1.0;
    const descentRateWorld = (CONFIG.AIR_STRIKE.DESCENT_SPEED_MPS * 0.5) * (0.85 + speedMult * 0.25);
    state.y = Math.max(0, state.y - descentRateWorld * dt);

    as.altitudeM = Math.max(0, (state.y / CONFIG.AIR_STRIKE.START_Y) * CONFIG.AIR_STRIKE.START_ALTITUDE_M);
    as.survivedM = Math.min(100, Math.max(0, Math.round(CONFIG.AIR_STRIKE.START_ALTITUDE_M - as.altitudeM)));
    const liveScore = Math.round(as.survivedM * CONFIG.AIR_STRIKE.SCORE_PER_METER * eff.scoreMult);

    airStrikeHud(as.altitudeM, as.survivedM, liveScore);

    actor.root.position.set(state.x, state.y, state.z);
    actor.missileHolder.position.set(0, 0, 0);
    actor.missileHolder.rotation.y = state.yaw;
    actor.missileHolder.rotation.z = T.MathUtils.clamp(-mx * 0.45, -0.55, 0.55);
    actor.missileHolder.rotation.x = T.MathUtils.clamp(forwardInput * 0.35 - 0.18, -0.55, 0.45);
    actor.flameGroup.scale.setScalar(0.85 + Math.sin(as.elapsedTime * 35) * 0.22);

    const missilePos = new T.Vector3(state.x, state.y, state.z);
    for(const ob of as.obstacles){
      if(missilePos.distanceTo(ob.mesh.position) <= (ob.hitRadius + 0.65)){
        burst(missilePos, 0xff4d6d);
        completeLocalAirStrike(false, as.survivedM, coopCtx, finishBattleCb);
        return;
      }
    }

    if(state.y <= 0.15){
      const distToTarget = Math.hypot(state.x - as.targetX, state.z - as.targetZ);
      if(distToTarget <= CONFIG.AIR_STRIKE.TARGET_RADIUS){
        burst(missilePos, 0x00f5d4);
        burst(missilePos, 0xffd23f);
        completeLocalAirStrike(true, 100, coopCtx, finishBattleCb);
      } else {
        burst(missilePos, 0xff4d6d);
        completeLocalAirStrike(false, 100, coopCtx, finishBattleCb);
      }
      return;
    }
  }

  const camDist = CONFIG.AIR_STRIKE.CAM_RADIUS;
  const cx = state.x + Math.sin(state.yaw) * Math.cos(state.pitch) * camDist;
  const cy = Math.max(0.8, state.y - Math.sin(state.pitch) * camDist + 1.2);
  const cz = state.z + Math.cos(state.yaw) * Math.cos(state.pitch) * camDist;

  state.camera.position.set(cx, cy, cz);
  state.camera.lookAt(state.x, Math.max(0, state.y - 0.5), state.z);
}

function completeLocalAirStrike(hitTarget, survivedM, coopCtx, finishBattleCb){
  const as = state.airStrikeState;
  if(!as || as.localFinished) return;

  as.localFinished = true;
  as.localHitTarget = hitTarget;
  as.survivedM = survivedM;
  as.phase = 'finished';
  as.localActor.flameGroup.visible = false;

  const skin = getEquippedSkin();
  const eff = getEffectiveStats(skin);
  const basePts = survivedM * CONFIG.AIR_STRIKE.SCORE_PER_METER;
  const clearBonus = hitTarget ? 1000 : 0;
  as.localFinalScore = Math.round((basePts + clearBonus) * eff.scoreMult);

  state.score = as.localFinalScore;
  state.earnedGoldInMatch = as.localFinalScore;

  if(coopCtx.isCoop && coopCtx.sendCoop){
    coopCtx.sendCoop({
      type: 'airStrikeFinished',
      survivedM,
      hitTarget,
      score: as.localFinalScore
    });

    if(!coopCtx.remotePos.airStrikeFinished){
      announce(hitTarget
        ? '目標着弾成功！フレンドの降下完了を待機中…'
        : `墜落（記録: ${survivedM}m）… フレンドの降下完了を待機中…`);
      showToast('フレンドの降下完了を待っています…');
      return;
    }
  }

  finalizeAirStrikeResult(coopCtx, finishBattleCb);
}

export function finalizeAirStrikeResult(coopCtx, finishBattleCb){
  const as = state.airStrikeState;
  if(!as) return;

  const anyWin = coopCtx.isCoop
    ? (as.localHitTarget || !!coopCtx.remotePos.airStrikeHitTarget)
    : as.localHitTarget;

  if(anyWin){
    announce('TARGET DESTROYED! 目標着弾成功！');
    triggerWhiteFadeOut(() => {
      if(finishBattleCb) finishBattleCb(true);
    });
  } else {
    announce('IMPACT FAILED — 目標外への着弾または障害物衝突');
    if(finishBattleCb) finishBattleCb(false);
  }
}
