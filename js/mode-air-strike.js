import * as T from './libs/three.module.js';
import { CONFIG } from './config.js';
import { state, getEquippedSkin, saveGameData } from './state.js';
import { announce, airStrikeHud, triggerWhiteFadeOut, showEndScreen } from './ui.js';
import { makeTarget, generateAirStrikeMissionData, buildAirStrikeStage } from './map-air-strike.js';
import { burst } from './enemies.js';

export { generateAirStrikeMissionData };

function createExhaustFlameGroup(){
  const flameGroup = new T.Group();
  const outerCone = new T.Mesh(
    new T.ConeGeometry(0.24, 1.15, 10),
    new T.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.88 })
  );
  outerCone.position.y = 0.55;
  flameGroup.add(outerCone);

  const innerCone = new T.Mesh(
    new T.ConeGeometry(0.13, 0.75, 8),
    new T.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.96 })
  );
  innerCone.position.y = 0.38;
  flameGroup.add(innerCone);

  flameGroup.rotation.x = -Math.PI / 2;
  flameGroup.userData.outerCone = outerCone;
  flameGroup.userData.innerCone = innerCone;
  return flameGroup;
}

export function createAirStrikePlayerActor(isRemote = false, labelName = '', makeTextSpriteFn = null){
  const root = new T.Group();

  const jetTemplate = state.modelTemplates.fighter || makeTarget(T);
  const jetMesh = jetTemplate.clone(true);
  jetMesh.scale.multiplyScalar(1.35);
  root.add(jetMesh);

  const missileHolder = new T.Group();
  const missileTemplate = state.modelTemplates.missile || makeTarget(T);
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
  if(isRemote && makeTextSpriteFn){
    nameSprite = makeTextSpriteFn(T, labelName || 'フレンド');
    nameSprite.position.set(0, 2.2, 0);
    root.add(nameSprite);
  }

  state.scene.add(root);
  return { root, jetMesh, missileHolder, flameGroup, nameSprite };
}

export function startAirStrikeBattle(sharedMissionData = null, coopCtx = {}, initRemoteCraftFn = null){
  const missionData = sharedMissionData || generateAirStrikeMissionData(CONFIG, state.activeDifficulty);
  const targetPos = missionData.targetPos;
  const obstacles = missionData.obstacles;
  const stageObjs = buildAirStrikeStage(T, state.scene, state.activeDifficulty, obstacles, targetPos);

  const spawnX = coopCtx.isCoop ? (coopCtx.isHost ? -4.0 : 4.0) : 0.0;
  const spawnY = CONFIG.AIR_STRIKE.START_Y;
  const spawnZ = 0.0;

  state.x = spawnX;
  state.y = spawnY;
  state.z = spawnZ;
  state.yaw = Math.atan2(spawnX - targetPos.x, spawnZ - targetPos.z);
  state.pitch = 0.46;

  const myActor = createAirStrikePlayerActor(false, state.username);
  myActor.root.position.set(state.x, state.y, state.z);

  if(coopCtx.isCoop && initRemoteCraftFn){
    initRemoteCraftFn(spawnY, spawnZ);
  }

  state.airStrikeState = {
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

  announce(`【AIR STRIKE - ${state.activeDifficulty.name}】発射まで 3... ランダム目標を探せ！`);
  airStrikeHud(CONFIG.AIR_STRIKE.START_ALTITUDE_M, 0, 0);
}

function updateAirStrikeDynamicObstacles(dt, totalTime){
  if(!state.airStrikeState) return;
  const { obstacles, obstacleMeshes } = state.airStrikeState;

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
      if(Math.hypot(px - obs.px, py - obs.py, pz - obs.pz) < obs.r + missileRadius) return obs;
    } else if(obs.kind === 'box'){
      const dx = px - obs.px;
      const dy = py - obs.py;
      const dz = pz - obs.pz;
      const ry = -(obs.ry || 0);
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const lx = dx * cosY - dz * sinY;
      const lz = dx * sinY + dz * cosY;

      if(Math.abs(lx) <= obs.sx * 0.5 + missileRadius && Math.abs(dy) <= obs.sy * 0.5 + missileRadius && Math.abs(lz) <= obs.sz * 0.5 + missileRadius){
        return obs;
      }
    } else if(obs.kind === 'rod'){
      if(checkRodSegmentHit(px, py, pz, obs.px, obs.py, obs.pz, obs.rx, obs.ry, obs.rz, obs.length, obs.radius, missileRadius)){
        return obs;
      }
    } else if(obs.kind === 'cross'){
      const ry = obs.ry || 0;
      if(checkRodSegmentHit(px, py, pz, obs.px, obs.py, obs.pz, 0, ry, Math.PI / 2, obs.length, obs.radius, missileRadius)) return obs;
      if(checkRodSegmentHit(px, py, pz, obs.px, obs.py, obs.pz, Math.PI / 2, ry, 0, obs.length, obs.radius, missileRadius)) return obs;
    } else if(obs.kind === 'ring'){
      if(Math.abs(py - obs.py) <= obs.tubeThickness * 0.5 + missileRadius){
        const radialDist = Math.hypot(px - obs.px, pz - obs.pz);
        const halfTube = obs.tubeThickness * 0.5 + missileRadius;
        if(Math.abs(radialDist - obs.ringRadius) <= halfTube) return obs;
      }
    }
  }
  return null;
}

export function updateAirStrikeFrame(dt, coopCtx = {}){
  if(!state.airStrikeState) return;
  const st = state.airStrikeState;

  st.flightTime += dt;
  updateAirStrikeDynamicObstacles(dt, st.flightTime);

  if(st.targetGroup){
    st.targetGroup.rotation.y += dt * 1.6;
  }

  const f = (state.keys.KeyW || state.keys.ArrowUp ? 1 : 0) - (state.keys.KeyS || state.keys.ArrowDown ? 1 : 0) - state.move.y;
  const s = (state.keys.KeyD || state.keys.ArrowRight ? 1 : 0) - (state.keys.KeyA || state.keys.ArrowLeft ? 1 : 0) + state.move.x;
  const forward = new T.Vector3(0, 0, -1).applyAxisAngle(new T.Vector3(0, 1, 0), state.yaw);
  const right = new T.Vector3(1, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), state.yaw);

  const skin = getEquippedSkin();
  const horizSpeed = 12.2 * skin.stats.moveMult;
  const vx = (forward.x * f + right.x * s) * horizSpeed;
  const vz = (forward.z * f + right.z * s) * horizSpeed;

  if(st.phase === 'countdown'){
    st.elapsed += dt;
    const remain = Math.max(0, CONFIG.AIR_STRIKE.LAUNCH_DELAY_SEC - st.elapsed);
    announce(`【AIR STRIKE】発射まで ${Math.ceil(remain)} 秒...（目標を探して位置調整）`);

    state.x = T.MathUtils.clamp(state.x + vx * dt, -26, 26);
    state.z = T.MathUtils.clamp(state.z + vz * dt, -26, 26);
    state.y = CONFIG.AIR_STRIKE.START_Y;
    st.jetPos.set(state.x, state.y, state.z);

    st.myActor.root.position.set(state.x, state.y, state.z);
    st.myActor.jetMesh.rotation.y = state.yaw;
    st.myActor.missileHolder.position.set(0, -1.15, 0);
    st.myActor.missileHolder.lookAt(state.x, state.y - 10, state.z);

    airStrikeHud(100, 0, 0);

    if(st.elapsed >= CONFIG.AIR_STRIKE.LAUNCH_DELAY_SEC){
      st.phase = 'flying';
      state.y = CONFIG.AIR_STRIKE.START_Y - 1.2;
      st.myActor.flameGroup.visible = true;
      burst(new T.Vector3(state.x, state.y + 0.8, state.z), 0xffaa00);
      announce('MISSILE LAUNCH! 複雑障害物を避けて地上目標へ誘導せよ！');
    }
  } else if(st.phase === 'flying'){
    const vyUnits = -(CONFIG.AIR_STRIKE.DESCENT_SPEED_MPS * 0.5);
    state.x = T.MathUtils.clamp(state.x + vx * dt, -28, 28);
    state.z = T.MathUtils.clamp(state.z + vz * dt, -28, 28);
    state.y = Math.max(0, state.y + vyUnits * dt);

    st.jetPos.z -= 1.5 * dt;
    st.myActor.jetMesh.position.set(st.jetPos.x - state.x, st.jetPos.y - state.y, st.jetPos.z - state.z);

    st.myActor.root.position.set(state.x, state.y, state.z);
    st.myActor.missileHolder.position.set(0, 0, 0);
    st.myActor.missileHolder.lookAt(state.x + vx * 0.35, state.y + vyUnits * 1.2, state.z + vz * 0.35);

    const flicker = 0.8 + Math.random() * 0.55;
    st.myActor.flameGroup.scale.set(1, 1, flicker);
    if(state.syncTick % 2 === 0){
      st.myActor.missileHolder.updateMatrixWorld(true);
      const exhaustPos = st.myActor.missileHolder.localToWorld(new T.Vector3(0, 0, -0.95));
      const pMesh = new T.Mesh(
        new T.SphereGeometry(0.16, 6, 5),
        new T.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xff6b00 : 0xffd166 })
      );
      pMesh.position.copy(exhaustPos);
      state.scene.add(pMesh);
      state.fx.push({
        m: pMesh,
        life: 14,
        v: new T.Vector3((Math.random() - 0.5) * 0.06, 0.14 + Math.random() * 0.08, (Math.random() - 0.5) * 0.06)
      });
    }

    const currentAltM = Math.max(0, Math.min(100, state.y * 2));
    st.survivedM = Math.max(0, Math.min(100, Math.round(100 - currentAltM)));
    const liveScore = CONFIG.AIR_STRIKE.SCORE_PER_METER * st.survivedM;
    airStrikeHud(currentAltM, st.survivedM, liveScore);

    const hitObs = checkAirStrikeCollision(state.x, state.y, state.z, st.obstacles);
    if(hitObs){
      st.phase = 'finished';
      st.crashed = true;
      st.finishReason = `障害物に衝突！（高度 ${Math.round(currentAltM)}m / 生き残り ${st.survivedM}m）`;
      st.myActor.flameGroup.visible = false;
      st.myActor.missileHolder.visible = false;
      burst(new T.Vector3(state.x, state.y, state.z), 0xff3300);
      onAirStrikeLocalComplete(coopCtx);
      return;
    }

    if(state.y <= 0.5){
      st.phase = 'finished';
      st.survivedM = 100;
      const distToTarget = Math.hypot(state.x - st.targetPos.x, state.z - st.targetPos.z);
      st.hitTarget = distToTarget <= CONFIG.AIR_STRIKE.TARGET_RADIUS;
      st.finishReason = st.hitTarget
        ? `地上目標に直撃成功！（生き残り 100m）`
        : `地上着弾（目標から ${Math.round(distToTarget * 2)}m 逸脱 / 生き残り 100m）`;
      st.myActor.flameGroup.visible = false;
      st.myActor.missileHolder.visible = false;
      burst(new T.Vector3(state.x, 0.6, state.z), st.hitTarget ? 0x00f5d4 : 0xffaa00);
      onAirStrikeLocalComplete(coopCtx);
      return;
    }
  }

  let focusX = state.x, focusY = state.y, focusZ = state.z;
  if(st.phase === 'finished' && coopCtx.isCoop && coopCtx.remotePos && !coopCtx.remotePos.airStrikeFinished){
    focusX = coopCtx.remotePos.x;
    focusY = coopCtx.remotePos.y;
    focusZ = coopCtx.remotePos.z;
  }

  const orbitRadius = CONFIG.AIR_STRIKE.CAM_RADIUS;
  const elev = T.MathUtils.clamp(state.pitch, -1.48, 1.48);
  const horizDist = Math.cos(elev) * orbitRadius;
  const vertOffset = Math.sin(elev) * orbitRadius;

  state.camera.position.set(
    focusX + Math.sin(state.yaw) * horizDist,
    Math.max(0.45, focusY + vertOffset),
    focusZ + Math.cos(state.yaw) * horizDist
  );
  state.camera.lookAt(focusX, focusY, focusZ);
}

export function onAirStrikeLocalComplete(coopCtx = {}){
  if(!state.airStrikeState) return;
  const finalScore = CONFIG.AIR_STRIKE.SCORE_PER_METER * state.airStrikeState.survivedM;
  state.score = finalScore;
  state.earnedGoldInMatch = finalScore;

  if(coopCtx.isCoop && coopCtx.sendCoop){
    coopCtx.sendCoop({
      type: 'airStrikeDone',
      survivedM: state.airStrikeState.survivedM,
      hitTarget: state.airStrikeState.hitTarget,
      score: finalScore
    });
    if(coopCtx.remotePos && !coopCtx.remotePos.airStrikeFinished){
      announce(`${state.airStrikeState.finishReason} — フレンドの降下完了を待機中...`);
      return;
    }
  }

  finalizeAirStrikeResult(coopCtx.isCoop);
}

export function finalizeAirStrikeResult(isCoop = false){
  if(!state.airStrikeState || state.gameMode === 'end') return;
  state.gameMode = 'end';
  const mySurvived = state.airStrikeState.survivedM;
  const myScore = CONFIG.AIR_STRIKE.SCORE_PER_METER * mySurvived;
  state.score = myScore;
  state.earnedGoldInMatch = myScore;
  state.gold += state.earnedGoldInMatch;
  saveGameData();

  const win = state.airStrikeState.hitTarget;
  const detail = state.airStrikeState.finishReason;
  if(win){
    triggerWhiteFadeOut(() => {
      showEndScreen(true, state.score, state.earnedGoldInMatch, isCoop, detail);
    });
  } else {
    showEndScreen(false, state.score, state.earnedGoldInMatch, isCoop, detail);
  }
}
