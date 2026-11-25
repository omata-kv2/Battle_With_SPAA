import * as T from './libs/three.module.js';
import { state, getEquippedSkin, getEffectiveStats, getSkinUpgrade } from './state.js';
import {
  showToast, updateChargeGauge, updateSkillButtonUI, updateFireButtonUI,
  hideFireButton, clearLaserAttackButtons, renderLaserAttackButtons, updateLaserAttackButtonState,
  showExplosionChargeMeter, updateExplosionChargeMeter
} from './ui.js';
import { applyEnemyDamage, burst, burstWhiteStrong } from './enemies.js';
import { getYajuTargetMeshes, applyYajuPlayerDamage } from './mode-yaju-maze.js';

function isCombatActiveMode(){
  return state.gameMode === 'test' || (state.gameMode === 'battle' && (state.activeBattleMode === 'FALL_MISSILE' || state.activeBattleMode === 'YAJU_BOSS'));
}

function getCombatEnemies(){
  if(state.gameMode === 'test') return (state.testController && state.testController.dummyMesh) ? [state.testController.dummyMesh] : [];
  return state.activeBattleMode === 'YAJU_BOSS' ? getYajuTargetMeshes() : state.enemies;
}

function getTargetWorldPos(obj){
  const v = new T.Vector3();
  if(obj && obj.getWorldPosition) obj.getWorldPosition(v);
  return v;
}

const pendingShotTimers = new Set();

export const combatState = {
  skillActiveTimer: 0,
  skillCooldownTimer: 0,
  attackCooldownTimer: 0,
  isCharging: false,
  chargeElapsed: 0,
  fireHeld: false,
  autoFireTimer: 0,
  turrets: [],
  remoteTurrets: [],
  laserDeployState: {
    maxCount: 1,
    deployedCount: 0,
    isDeployedComplete: false,
    plannedSlots: [],
    turrets: []
  },
  remoteLaserState: {
    turrets: []
  },
  homingProjectiles: []
};

export function clearPendingShots(){
  for(const tid of pendingShotTimers){
    clearTimeout(tid);
  }
  pendingShotTimers.clear();
}

export function clearLaserTurretsAndBeams(){
  const ds = combatState.laserDeployState;
  for(const lt of ds.turrets){
    if(lt.beamGroup && state.scene){
      state.scene.remove(lt.beamGroup);
    }
    if(lt.mesh && state.scene){
      state.scene.remove(lt.mesh);
    }
  }
  ds.turrets.length = 0;
  ds.plannedSlots.length = 0;
  ds.deployedCount = 0;
  ds.isDeployedComplete = false;
  clearLaserAttackButtons();
}

export function clearRemoteCombatVisuals(){
  for(const rt of combatState.remoteTurrets){
    if(rt.mesh && state.scene) state.scene.remove(rt.mesh);
  }
  combatState.remoteTurrets.length = 0;

  for(const rlt of combatState.remoteLaserState.turrets){
    if(rlt.beamGroup && state.scene) state.scene.remove(rlt.beamGroup);
    if(rlt.mesh && state.scene) state.scene.remove(rlt.mesh);
  }
  combatState.remoteLaserState.turrets.length = 0;
}

export function resetCombatState(){
  clearPendingShots();
  combatState.skillActiveTimer = 0;
  combatState.skillCooldownTimer = 0;
  combatState.attackCooldownTimer = 0;
  combatState.isCharging = false;
  combatState.chargeElapsed = 0;
  combatState.fireHeld = false;
  combatState.autoFireTimer = 0;

  clearLaserTurretsAndBeams();
  clearRemoteCombatVisuals();

  for(const t of combatState.turrets){
    if(t.mesh && state.scene) state.scene.remove(t.mesh);
  }
  combatState.turrets.length = 0;

  for(const hp of combatState.homingProjectiles){
    if(hp.mesh && state.scene) state.scene.remove(hp.mesh);
  }
  combatState.homingProjectiles.length = 0;

  updateChargeGauge(0);
  updateExplosionChargeMeter(0, false, false, 0);
}

function computeEquidistantMapPositions(count){
  const mapBound = 15.2;
  const positions = [];
  if(count <= 1){
    const rx = (Math.random() - 0.5) * 18.0;
    const rz = (Math.random() - 0.5) * 18.0;
    positions.push({ x: rx, z: rz });
    return positions;
  }

  const radius = count === 2 ? 6.8 : (count === 3 ? 7.6 : (count === 4 ? 8.2 : 8.8));
  const maxCenterOffset = Math.max(1.5, mapBound - radius);
  const cx = (Math.random() * 2 - 1) * maxCenterOffset;
  const cz = (Math.random() * 2 - 1) * maxCenterOffset;
  const baseAngle = Math.random() * Math.PI * 2;

  for(let i = 0; i < count; i++){
    const angle = baseAngle + (i / count) * Math.PI * 2;
    const px = T.MathUtils.clamp(cx + Math.cos(angle) * radius, -mapBound, mapBound);
    const pz = T.MathUtils.clamp(cz + Math.sin(angle) * radius, -mapBound, mapBound);
    positions.push({ x: px, z: pz });
  }
  return positions;
}

function makeMkLabelSprite(text, strokeCol = '#ff4d6d'){
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(18, 6, 12, 0.85)';
  ctx.strokeStyle = strokeCol;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(10, 10, 236, 76, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 50);

  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  const mat = new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new T.Sprite(mat);
  sprite.scale.set(1.5, 0.56, 1);
  return sprite;
}

function createLaserPyramidTurretMesh(tx, tz, mkNumber, labelPrefix = ''){
  const groundY = state.activeBattleMode === 'YAJU_BOSS' ? 0.0 : -2.0;
  const pyramidH = 1.35;

  const group = new T.Group();
  group.position.set(tx, groundY, tz);

  const ring = new T.Mesh(
    new T.RingGeometry(0.68, 0.94, 4),
    new T.MeshBasicMaterial({ color: 0xff4d6d, side: T.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.rotation.z = Math.PI / 4;
  ring.position.y = 0.03;
  group.add(ring);

  const pyramid = new T.Mesh(
    new T.ConeGeometry(0.76, pyramidH, 4),
    new T.MeshStandardMaterial({
      color: 0xff4d6d,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.55,
      metalness: 0.55,
      roughness: 0.28
    })
  );
  pyramid.position.y = pyramidH / 2;
  pyramid.rotation.y = Math.PI / 4;
  group.add(pyramid);

  const apexOrb = new T.Mesh(
    new T.SphereGeometry(0.16, 10, 10),
    new T.MeshBasicMaterial({ color: 0xffccd5 })
  );
  apexOrb.position.set(0, pyramidH, 0);
  group.add(apexOrb);

  const labelSprite = makeMkLabelSprite(`${labelPrefix}Mk.${mkNumber}`);
  labelSprite.position.set(0, pyramidH + 0.55, 0);
  group.add(labelSprite);

  if(state.scene) state.scene.add(group);
  const apexWorld = new T.Vector3(tx, groundY + pyramidH, tz);
  burst(apexWorld, 0xff4d6d);

  return { group, apexOrb, apexWorld };
}

export function initLaserTurretDeployState(maxCount){
  clearLaserTurretsAndBeams();
  const ds = combatState.laserDeployState;
  const count = Math.max(1, Math.min(5, maxCount || 1));
  ds.maxCount = count;
  ds.deployedCount = 0;
  ds.isDeployedComplete = false;

  const coords = computeEquidistantMapPositions(count);
  const mkNumbers = Array.from({ length: count }, (_, idx) => idx + 1);
  for(let i = mkNumbers.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [mkNumbers[i], mkNumbers[j]] = [mkNumbers[j], mkNumbers[i]];
  }

  ds.plannedSlots = coords.map((pos, idx) => ({
    x: pos.x,
    z: pos.z,
    mkNumber: mkNumbers[idx]
  }));

  updateFireButtonUI(`タレット設置\n(0 / ${count})`, 'deploy-mode');
}

function deployNextLaserTurret(coopCtx = {}){
  const ds = combatState.laserDeployState;
  if(ds.isDeployedComplete || ds.deployedCount >= ds.maxCount) return;

  const slot = ds.plannedSlots[ds.deployedCount];
  const { group, apexOrb, apexWorld } = createLaserPyramidTurretMesh(slot.x, slot.z, slot.mkNumber);

  ds.turrets.push({
    mkNumber: slot.mkNumber,
    mesh: group,
    apexOrb,
    apexWorld,
    activeTimer: 0,
    cooldownTimer: 0,
    tickTimer: 0,
    beamGroup: null
  });

  if(coopCtx.isCoop && coopCtx.sendCoop){
    coopCtx.sendCoop({
      type: 'syncLaserTurretDeploy',
      x: slot.x,
      z: slot.z,
      mkNumber: slot.mkNumber
    });
  }

  ds.deployedCount++;

  if(ds.deployedCount < ds.maxCount){
    updateFireButtonUI(`タレット設置\n(${ds.deployedCount} / ${ds.maxCount})`, 'deploy-mode');
    showToast(`タレット設置 (${ds.deployedCount}/${ds.maxCount}) — 番号「Mk.${slot.mkNumber}」割り当て！`);
  } else {
    ds.isDeployedComplete = true;
    hideFireButton();
    renderLaserAttackButtons(ds.maxCount, (mkNum) => {
      triggerLaserTurretAttack(mkNum, coopCtx);
    });
    showToast(`全${ds.maxCount}基のタレット配置完了！「Mk.1〜Mk.${ds.maxCount}攻撃」ボタン解放！`);
  }
}

export function spawnRemoteLaserTurret(x, z, mkNumber){
  if(!state.scene || !isCombatActiveMode()) return;
  const { group, apexOrb, apexWorld } = createLaserPyramidTurretMesh(x, z, mkNumber, '僚機 ');
  combatState.remoteLaserState.turrets.push({
    mkNumber,
    mesh: group,
    apexOrb,
    apexWorld,
    beamGroup: null
  });
}

function ensureLaserBeamMeshForTurret(lt){
  if(lt.beamGroup) return lt.beamGroup;
  const grp = new T.Group();
  const coreCyl = new T.Mesh(
    new T.CylinderGeometry(0.08, 0.11, 1, 10),
    new T.MeshBasicMaterial({ color: 0xffccd5, transparent: true, opacity: 0.95 })
  );
  const auraCyl = new T.Mesh(
    new T.CylinderGeometry(0.22, 0.28, 1, 10),
    new T.MeshBasicMaterial({ color: 0xff1e42, transparent: true, opacity: 0.58 })
  );
  const muzzleSphere = new T.Mesh(
    new T.SphereGeometry(0.22, 10, 10),
    new T.MeshBasicMaterial({ color: 0xff4d6d })
  );
  grp.add(coreCyl, auraCyl, muzzleSphere);
  grp.userData.coreCyl = coreCyl;
  grp.userData.auraCyl = auraCyl;
  grp.userData.muzzleSphere = muzzleSphere;
  if(state.scene) state.scene.add(grp);
  lt.beamGroup = grp;
  return grp;
}

function removeLaserBeamMeshForTurret(lt){
  if(lt.beamGroup && state.scene){
    state.scene.remove(lt.beamGroup);
  }
  lt.beamGroup = null;
}

export function updateRemoteLaserBeams(activeBeams){
  if(!state.scene || !isCombatActiveMode()) return;
  const activeMap = new Map();
  for(const b of (activeBeams || [])){
    activeMap.set(b.mkNumber, b);
  }

  for(const rlt of combatState.remoteLaserState.turrets){
    const info = activeMap.get(rlt.mkNumber);
    if(info){
      const beamGrp = ensureLaserBeamMeshForTurret(rlt);
      const startPt = rlt.apexWorld;
      const aimPt = new T.Vector3(info.aimX, info.aimY, info.aimZ);
      const dir = aimPt.clone().sub(startPt).normalize();
      const beamLen = 135;
      const endPt = startPt.clone().addScaledVector(dir, beamLen);

      beamGrp.position.copy(startPt).add(endPt).multiplyScalar(0.5);
      beamGrp.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
      const rScale = info.radiusMult || 1.0;
      beamGrp.userData.coreCyl.scale.set(rScale, beamLen, rScale);
      beamGrp.userData.auraCyl.scale.set(rScale, beamLen, rScale);
      beamGrp.userData.muzzleSphere.position.set(0, -beamLen * 0.5, 0);
      beamGrp.userData.muzzleSphere.scale.setScalar(rScale);
    } else {
      removeLaserBeamMeshForTurret(rlt);
    }
  }
}

function getCrosshairAimPoint(){
  const camOrigin = state.camera.position.clone();
  const camDir = new T.Vector3();
  state.camera.getWorldDirection(camDir);

  const ray = new T.Raycaster(camOrigin, camDir, 0, 130);
  let bestEnemyPos = null;
  let bestDistAlong = Infinity;

  const _enemies = getCombatEnemies();
  for(const e of _enemies){
    const box = new T.Box3().setFromObject(e);
    const c = new T.Vector3();
    box.getCenter(c);
    const perpDist = ray.ray.distanceToPoint(c);
    const along = camOrigin.distanceTo(c);
    if((perpDist < 2.2 || ray.ray.intersectsBox(box)) && along < bestDistAlong){
      bestDistAlong = along;
      bestEnemyPos = c;
    }
  }

  return bestEnemyPos || camOrigin.addScaledVector(camDir, 75);
}

function applyTurretLaserContactDamage(lt, aimPt, radiusMult, coopCtx){
  const skin = getEquippedSkin();
  const eff = getEffectiveStats(skin);
  const startPt = lt.apexWorld;
  const dir = aimPt.clone().sub(startPt).normalize();
  const maxLen = 135;
  const segEnd = startPt.clone().addScaledVector(dir, maxLen);
  const lineSeg = new T.Line3(startPt, segEnd);
  const hitRadius = (skin.stats.beamRadius || 1.4) * radiusMult;

  const closestPt = new T.Vector3();
  const targetsHit = [];

  const _enemies = getCombatEnemies();
  for(const e of _enemies){
    const c = new T.Vector3();
    new T.Box3().setFromObject(e).getCenter(c);
    lineSeg.closestPointToPoint(c, true, closestPt);
    if(closestPt.distanceTo(c) <= hitRadius){
      targetsHit.push(e);
    }
  }

  for(const hitEn of targetsHit){
    if(!_enemies.includes(hitEn)) continue;
    dealHitToEnemy(hitEn, eff.atk, 0xff4d6d, eff.scoreMult, coopCtx, false);
  }
}

function triggerLaserTurretAttack(mkNumber, coopCtx = {}){
  if(!isCombatActiveMode() || state.modalOpen) return;
  const ds = combatState.laserDeployState;
  if(!ds.isDeployedComplete) return;

  const lt = ds.turrets.find(t => t.mkNumber === mkNumber);
  if(!lt) return;
  if(lt.activeTimer > 0 || lt.cooldownTimer > 0) return;

  const skin = getEquippedSkin();
  const eff = getEffectiveStats(skin);
  lt.activeTimer = eff.laserDurationSec;
  lt.tickTimer = 0;
  ensureLaserBeamMeshForTurret(lt);

  const aimPt = getCrosshairAimPoint();
  applyTurretLaserContactDamage(lt, aimPt, 1.0, coopCtx);
  updateLaserAttackButtonState(mkNumber, 'active', lt.activeTimer);
}

function dealHitToEnemy(enemyObj, rawDmg, beamColor, scoreMult, coopCtx, strongWhiteFx = false){
  const dmg = (state.powerBuffTimer > 0) ? rawDmg * 2 : rawDmg;
  if(state.gameMode === 'test'){
    const hitPos = getTargetWorldPos(enemyObj);
    if(strongWhiteFx) burstWhiteStrong(hitPos);
    else burst(hitPos, beamColor);
    if(!Array.isArray(state.testDpsHistory)) state.testDpsHistory = [];
    state.testDpsHistory.push({ t: performance.now(), dmg });
    if(state.testController && state.testController.onDummyHit) state.testController.onDummyHit(dmg);
    return;
  }
  if(state.activeBattleMode === 'YAJU_BOSS'){
    const hitPos = getTargetWorldPos(enemyObj);
    if(strongWhiteFx) burstWhiteStrong(hitPos);
    else burst(hitPos, beamColor);
    applyYajuPlayerDamage(enemyObj, dmg);
    return;
  }
  if(coopCtx.isCoop && !coopCtx.isHost){
    if(strongWhiteFx) burstWhiteStrong(enemyObj.position);
    else burst(enemyObj.position, beamColor);
    if(coopCtx.sendCoop){
      coopCtx.sendCoop({
        type: 'clientHit',
        enemyId: enemyObj.userData.id,
        dmg,
        beamColor,
        scoreMult
      });
    }
  } else {
    applyEnemyDamage(enemyObj, dmg, beamColor, scoreMult, {
      isCoop: coopCtx.isCoop,
      isHost: coopCtx.isHost,
      sendCoop: coopCtx.sendCoop,
      fromRemote: false,
      strongWhiteFx
    });
  }
}

function createPyramidTurretVisual(tx, tz, mainColor = 0x4de680, ringColor = 0x00f5d4){
  const groundY = -2.0;
  const pyramidH = 1.15;
  const group = new T.Group();
  group.position.set(tx, groundY, tz);

  const ring = new T.Mesh(
    new T.RingGeometry(0.62, 0.85, 4),
    new T.MeshBasicMaterial({ color: ringColor, side: T.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.rotation.z = Math.PI / 4;
  ring.position.y = 0.03;
  group.add(ring);

  const pyramid = new T.Mesh(
    new T.ConeGeometry(0.68, pyramidH, 4),
    new T.MeshStandardMaterial({
      color: mainColor,
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
    new T.MeshBasicMaterial({ color: 0xffffff })
  );
  apexOrb.position.set(0, pyramidH, 0);
  group.add(apexOrb);

  if(state.scene) state.scene.add(group);
  const apexWorld = new T.Vector3(tx, groundY + pyramidH, tz);
  burst(apexWorld, mainColor);
  return { group, apexOrb, apexWorld };
}

function spawnAdditionalTurrets(turretCount, durationSec, playerAtk, playerFireRate, coopCtx = {}){
  for(const oldT of combatState.turrets){
    if(oldT.mesh && state.scene) state.scene.remove(oldT.mesh);
  }
  combatState.turrets.length = 0;

  const positions = computeEquidistantMapPositions(turretCount);

  for(let i = 0; i < positions.length; i++){
    const { x: tx, z: tz } = positions[i];
    const { group, apexOrb, apexWorld } = createPyramidTurretVisual(tx, tz, 0x4de680, 0x00f5d4);

    combatState.turrets.push({
      mesh: group,
      apexOrb,
      apexWorld,
      life: durationSec,
      atk: playerAtk,
      fireRate: playerFireRate,
      fireTimer: 0
    });
  }

  if(coopCtx.isCoop && coopCtx.sendCoop){
    coopCtx.sendCoop({
      type: 'syncRapidTurrets',
      positions,
      durationSec
    });
  }
}

export function spawnRemoteRapidTurrets(positions, durationSec){
  if(!state.scene || !isCombatActiveMode()) return;
  for(const oldRt of combatState.remoteTurrets){
    if(oldRt.mesh && state.scene) state.scene.remove(oldRt.mesh);
  }
  combatState.remoteTurrets.length = 0;

  for(const pos of (positions || [])){
    const { group, apexOrb, apexWorld } = createPyramidTurretVisual(pos.x, pos.z, 0x38c8f0, 0x00f5d4);
    combatState.remoteTurrets.push({
      mesh: group,
      apexOrb,
      apexWorld,
      life: durationSec
    });
  }
}

function destroyTargetsList(targetsToDestroy, beamColor, eff, coopCtx){
  const originPt = state.camera.position.clone().add(new T.Vector3(0, -0.3, 0));
  let destroyedCount = 0;

  for(const en of targetsToDestroy){
    if(!state.enemies.includes(en)) continue;
    const targetPos = en.position.clone();

    spawnShortGradientProjectile(originPt, targetPos, beamColor, 1.0, coopCtx);

    dealHitToEnemy(en, 9999, beamColor, eff.scoreMult, coopCtx, false);
    destroyedCount++;
  }
  return destroyedCount;
}

export function activateUnitSkill(coopCtx = {}){
  if(!isCombatActiveMode() || state.modalOpen) return;
  if(combatState.skillCooldownTimer > 0 || combatState.skillActiveTimer > 0) return;

  const skin = getEquippedSkin();
  const eff = getEffectiveStats(skin);
  const skill = skin.skill;

  const actualCooldown = (skill.id === 'BeastEyesPower') ? eff.beastEyesCooldown : skill.cooldown;
  combatState.skillCooldownTimer = actualCooldown;

  if(skill.id === 'NeverStopper'){
    const ds = combatState.laserDeployState;
    while(!ds.isDeployedComplete && ds.deployedCount < ds.maxCount){
      deployNextLaserTurret(coopCtx);
    }
    combatState.skillActiveTimer = eff.neverStopperDuration;
    for(const lt of ds.turrets){
      lt.activeTimer = Math.max(lt.activeTimer, eff.neverStopperDuration);
      lt.cooldownTimer = 0;
      lt.tickTimer = 0;
      ensureLaserBeamMeshForTurret(lt);
    }
    showToast(`【NeverStopper Lv.${eff.skillLv}】全${ds.turrets.length}基から${eff.neverStopperDuration}秒間・強化赤色レーザー一斉照射！`);
    return;
  }

  if(skill.id === 'AdditionalTurre'){
    const dur = eff.additionalTurreDuration;
    combatState.skillActiveTimer = dur;
    spawnAdditionalTurrets(eff.rapidTurretCount, dur, eff.atk, eff.rawRate, coopCtx);
    showToast(`【AdditionalTurre Lv.${eff.skillLv}】タレット${eff.rapidTurretCount}基を均等配置！（${dur}秒 / 攻撃力${eff.atk}・連射${eff.rawRate.toFixed(1)}）`);
    return;
  }

  if(skill.duration > 0){
    combatState.skillActiveTimer = skill.duration;
  }

  if(skill.id === 'OriginBurst'){
    const maxClear = eff.originBurstTargets;
    const sorted = [...state.enemies].sort((a, b) => a.position.y - b.position.y).slice(0, maxClear);
    const destroyedCount = destroyTargetsList(sorted, 0x00f5d4, eff, coopCtx);
    showToast(`【OriginBurst Lv.${eff.skillLv}】上空の飛翔体 ${destroyedCount}体（上限${maxClear}体）を一掃！`);
  } else if(skill.id === 'FewCharger'){
    const maxTime = Math.max(0.5, 3.0 - eff.fewChargerReduction);
    showToast(`【FewCharger Lv.${eff.skillLv}】10秒間 最大チャージ時間を ${maxTime.toFixed(1)}秒 に短縮！`);
  } else if(skill.id === 'InfinityBarrel'){
    combatState.attackCooldownTimer = 0;
    showToast(`【InfinityBarrel Lv.${eff.skillLv}】10秒間 撃ち放題＆拡散範囲 ${eff.infinitySpreadMult}倍！`);
  } else if(skill.id === 'MultiBurst'){
    showToast(`【MultiBurst Lv.${eff.skillLv}】10秒間 戦闘機優先追尾＆追加弾 +${eff.multiBurstExtraShots}発！`);
  } else if(skill.id === 'GermanTech'){
    const maxClear = eff.germanTechTargets;
    const sorted = [...state.enemies].sort((a, b) => a.position.y - b.position.y).slice(0, maxClear);
    const destroyedCount = destroyTargetsList(sorted, 0x00f5d4, eff, coopCtx);
    showToast(`【GermanTech Lv.${eff.skillLv}】上空の飛翔体 ${destroyedCount}個（上限${maxClear}個）を撃破！`);
  } else if(skill.id === 'BeastEyesPower'){
    const allTargets = [...state.enemies];
    const destroyedCount = destroyTargetsList(allTargets, 0xffffff, eff, coopCtx);
    const cdText = actualCooldown === 0 ? 'CDなし' : `CD ${actualCooldown}秒`;
    showToast(`【BeastEyesPower Lv.${eff.skillLv}】出現中の全飛翔体 ${destroyedCount}体を完全消滅！（${cdText}）`);
  }
}

function getDefaultMuzzleOrigin(rightOffset = 0.22, downOffset = 0.34){
  const forward = new T.Vector3();
  state.camera.getWorldDirection(forward);
  const right = new T.Vector3(1, 0, 0).applyQuaternion(state.camera.quaternion);
  const up = new T.Vector3(0, 1, 0).applyQuaternion(state.camera.quaternion);
  return state.camera.position.clone()
    .addScaledVector(forward, 1.05)
    .addScaledVector(right, rightOffset)
    .addScaledVector(up, -downOffset);
}

// Laser と Automatic 以外の機体用：弾に近いほど色が濃く、離れると透明に近づく短い弾道トレイル
export function spawnShortGradientProjectile(startPt, endPt, beamColor, radiusScale = 1.0, coopCtx = null){
  if(!state.scene) return;
  const totalVec = endPt.clone().sub(startPt);
  const dist = totalVec.length();
  if(dist < 0.05) return;
  const dir = totalVec.clone().normalize();

  const slugGroup = new T.Group();

  // 先頭の弾体（最も濃いコア＋オーラ）
  const slugCore = new T.Mesh(
    new T.SphereGeometry(0.17 * radiusScale, 8, 8),
    new T.MeshBasicMaterial({ color: 0xffffff })
  );
  const slugAura = new T.Mesh(
    new T.SphereGeometry(0.30 * radiusScale, 8, 8),
    new T.MeshBasicMaterial({ color: beamColor, transparent: true, opacity: 0.92 })
  );
  slugGroup.add(slugCore, slugAura);

  // 弾の直後から後方へ伸びる短いグラデーション軌跡（全4段階、離れるほど細く透明になる）
  const trailSegments = [
    { len: 1.05, rTop: 0.14, rBot: 0.11, opacity: 0.72, offsetBack: 0.55 },
    { len: 1.15, rTop: 0.11, rBot: 0.08, opacity: 0.44, offsetBack: 1.60 },
    { len: 1.15, rTop: 0.08, rBot: 0.05, opacity: 0.21, offsetBack: 2.70 },
    { len: 1.05, rTop: 0.05, rBot: 0.02, opacity: 0.07, offsetBack: 3.75 }
  ];

  for(const seg of trailSegments){
    const segMesh = new T.Mesh(
      new T.CylinderGeometry(seg.rTop * radiusScale, seg.rBot * radiusScale, seg.len, 7),
      new T.MeshBasicMaterial({
        color: beamColor,
        transparent: true,
        opacity: seg.opacity,
        depthWrite: false
      })
    );
    // ローカル +Y 方向が進行方向になるよう回転させるため、後方は -Y
    segMesh.position.set(0, -seg.offsetBack, 0);
    slugGroup.add(segMesh);
  }

  slugGroup.position.copy(startPt);
  slugGroup.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
  state.scene.add(slugGroup);

  const travelFrames = Math.max(5, Math.min(9, Math.round(dist / 7.5)));
  const stepVec = totalVec.clone().divideScalar(travelFrames);
  state.fx.push({ m: slugGroup, life: travelFrames, v: stepVec });

  if(coopCtx && coopCtx.isCoop && coopCtx.sendCoop){
    coopCtx.sendCoop({
      type: 'syncShotVisual',
      sx: startPt.x, sy: startPt.y, sz: startPt.z,
      ex: endPt.x, ey: endPt.y, ez: endPt.z,
      beamColor,
      radiusScale
    });
  }
}

export function spawnDetonationEffect(impactPt, blastWorldRadius, mainColor = 0xff9233, coopCtx = null){
  if(!state.scene) return;
  const flashCore = new T.Mesh(
    new T.SphereGeometry(Math.max(0.55, blastWorldRadius * 0.52), 14, 12),
    new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })
  );
  flashCore.position.copy(impactPt);
  state.scene.add(flashCore);
  state.fx.push({ m: flashCore, life: 12 });

  const blastSphere = new T.Mesh(
    new T.SphereGeometry(blastWorldRadius, 18, 14),
    new T.MeshBasicMaterial({ color: mainColor, transparent: true, opacity: 0.48 })
  );
  blastSphere.position.copy(impactPt);
  state.scene.add(blastSphere);
  state.fx.push({ m: blastSphere, life: 18 });

  const ring1 = new T.Mesh(
    new T.RingGeometry(blastWorldRadius * 0.65, blastWorldRadius * 1.12, 24),
    new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: T.DoubleSide })
  );
  ring1.position.copy(impactPt);
  ring1.rotation.x = Math.PI / 2;
  state.scene.add(ring1);
  state.fx.push({ m: ring1, life: 18 });

  const ring2 = new T.Mesh(
    new T.RingGeometry(blastWorldRadius * 0.55, blastWorldRadius * 1.05, 24),
    new T.MeshBasicMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.75, side: T.DoubleSide })
  );
  ring2.position.copy(impactPt);
  ring2.lookAt(state.camera.position);
  state.scene.add(ring2);
  state.fx.push({ m: ring2, life: 16 });

  const sparkCount = 18;
  for(let i = 0; i < sparkCount; i++){
    const sparkColor = i % 3 === 0 ? 0xffffff : (i % 3 === 1 ? 0xffd23f : mainColor);
    const spark = new T.Mesh(
      new T.SphereGeometry(0.18 + Math.random() * 0.14, 7, 6),
      new T.MeshBasicMaterial({ color: sparkColor })
    );
    spark.position.copy(impactPt);
    state.scene.add(spark);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const spd = (0.16 + Math.random() * 0.28) * Math.max(0.8, blastWorldRadius * 0.45);
    state.fx.push({
      m: spark,
      life: 22,
      v: new T.Vector3(
        Math.sin(phi) * Math.cos(theta) * spd,
        Math.cos(phi) * spd,
        Math.sin(phi) * Math.sin(theta) * spd
      )
    });
  }

  if(coopCtx && coopCtx.isCoop && coopCtx.sendCoop){
    coopCtx.sendCoop({
      type: 'syncDetonation',
      ix: impactPt.x, iy: impactPt.y, iz: impactPt.z,
      blastWorldRadius,
      mainColor
    });
  }
}

export function fireSingleBeam(skin, effectiveStats, spreadYaw = 0, spreadPitch = 0, overrideDmg = null, overrideRadius = null, customOrigin = null, strongWhiteFx = false, coopCtx = {}){
  if(!isCombatActiveMode() || state.modalOpen) return null;

  const d = new T.Vector3();
  state.camera.getWorldDirection(d);

  if(spreadYaw !== 0 || spreadPitch !== 0){
    const euler = new T.Euler(spreadPitch, spreadYaw, 0, 'YXZ');
    d.applyEuler(euler).normalize();
  }

  const rayOrigin = customOrigin ? customOrigin.clone() : state.camera.position.clone();
  const visualOrigin = customOrigin ? customOrigin.clone() : getDefaultMuzzleOrigin(0.22, 0.34);

  const hitRadius = overrideRadius !== null ? overrideRadius : skin.stats.beamRadius;
  const dmg = overrideDmg !== null ? overrideDmg : effectiveStats.atk;
  const beamColor = (skin.stats && skin.stats.beamColor != null) ? skin.stats.beamColor : (skin.color || 0x00f5d4);

  const ray = new T.Raycaster(rayOrigin, d, 0, 125);
  let hit = null, best = Infinity;
  const _enemies = getCombatEnemies();
  for(const e of _enemies){
    const box = new T.Box3().setFromObject(e);
    const c = new T.Vector3();
    box.getCenter(c);
    const dist = ray.ray.distanceToPoint(c), along = rayOrigin.distanceTo(c);
    if((dist < hitRadius || ray.ray.intersectsBox(box)) && along < best){ hit = e; best = along; }
  }

  const endPt = hit ? getTargetWorldPos(hit) : rayOrigin.clone().add(d.clone().multiplyScalar(55));
  const beamRadiusScale = Math.max(0.85, hitRadius / 2.4);
  spawnShortGradientProjectile(visualOrigin, endPt, beamColor, beamRadiusScale, coopCtx);

  if(strongWhiteFx){
    for(let k = 0; k < 5; k++){
      const wm = new T.Mesh(new T.SphereGeometry(0.13, 6, 5), new T.MeshBasicMaterial({ color: 0xffffff }));
      wm.position.copy(visualOrigin);
      state.scene.add(wm);
      state.fx.push({ m: wm, life: 13, v: new T.Vector3((Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.22) });
    }
  }

  if(hit){
    dealHitToEnemy(hit, dmg, beamColor, effectiveStats.scoreMult, coopCtx, strongWhiteFx);
  }
  return hit;
}

function getExplosionEffectiveChargedSec(skin, eff){
  const reduction = (skin.skill.id === 'FewCharger' && combatState.skillActiveTimer > 0)
    ? eff.fewChargerReduction
    : 0;
  const maxChargeSec = Math.max(0.5, (skin.chargeTime || 3.0) - reduction);
  const ratio = Math.min(1, combatState.chargeElapsed / maxChargeSec);
  // 0.1秒単位に正規化（0.0〜3.0s）
  const rawSteps = Math.floor(ratio * 30 + 1e-6);
  const quantizedSec = Number((rawSteps / 10).toFixed(1));
  const isMax = ratio >= 1.0;
  return { quantizedSec, isMax, maxChargeSec };
}

export function releaseExplosionCharge(coopCtx = {}){
  if(!combatState.isCharging) return;
  const skin = getEquippedSkin();
  const eff = getEffectiveStats(skin);
  const { quantizedSec } = getExplosionEffectiveChargedSec(skin, eff);

  combatState.isCharging = false;
  combatState.chargeElapsed = 0;
  updateChargeGauge(0);
  updateExplosionChargeMeter(0, false, false, eff.bonusBlastRadiusM);

  if(!isCombatActiveMode() || state.modalOpen) return;
  if(skin.attackType !== 'explosion') return;

  // 最小単位0.1秒として、秒数(0.1秒ごと増やす) × 5(定数) + アップグレード加算分
  const finalChargedSec = Math.max(0.1, quantizedSec);
  const totalRadiusM = Number((finalChargedSec * 5 + eff.bonusBlastRadiusM).toFixed(2));
  executeExplosionAttack(skin, eff, totalRadiusM, coopCtx);
}

function executeExplosionAttack(skin, eff, totalRadiusM, coopCtx){
  const d = new T.Vector3();
  state.camera.getWorldDirection(d);

  const rayOrigin = state.camera.position.clone();
  const visualOrigin = getDefaultMuzzleOrigin(0.0, 0.38);
  const beamColor = (skin.stats && skin.stats.beamColor != null) ? skin.stats.beamColor : 0xff9233;

  const ray = new T.Raycaster(rayOrigin, d, 0, 130);
  let hit = null, best = Infinity;
  const _enemies = getCombatEnemies();
  for(const e of _enemies){
    const box = new T.Box3().setFromObject(e);
    const c = new T.Vector3();
    box.getCenter(c);
    const dist = ray.ray.distanceToPoint(c), along = rayOrigin.distanceTo(c);
    if((dist < skin.stats.beamRadius || ray.ray.intersectsBox(box)) && along < best){ hit = e; best = along; }
  }

  const impactPt = hit ? getTargetWorldPos(hit) : rayOrigin.clone().add(d.clone().multiplyScalar(52));
  spawnShortGradientProjectile(visualOrigin, impactPt, beamColor, 1.35, coopCtx);

  const blastWorldRadius = Math.max(0.85, totalRadiusM * 1.45);
  spawnDetonationEffect(impactPt, blastWorldRadius, beamColor, coopCtx);

  const affected = _enemies.filter(e => e === hit || getTargetWorldPos(e).distanceTo(impactPt) <= blastWorldRadius);
  for(const targetEn of affected){
    if(!_enemies.includes(targetEn)) continue;
    dealHitToEnemy(targetEn, eff.atk, beamColor, eff.scoreMult, coopCtx, false);
  }
}

function executeScatterAttack(skin, eff, isInfinityActive, coopCtx){
  if(!isInfinityActive){
    combatState.attackCooldownTimer = skin.attackCooldown || 0.5;
  }

  const pelletCount = isInfinityActive ? 10 : (skin.pelletCount || 7);
  const spreadMult = isInfinityActive ? eff.infinitySpreadMult : 1.0;
  const maxSpread = (skin.baseSpreadAngle || 0.25) * spreadMult;

  for(let i = 0; i < pelletCount; i++){
    const theta = (i / pelletCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
    const rad = (0.25 + Math.random() * 0.75) * maxSpread;
    fireSingleBeam(skin, eff, Math.cos(theta) * rad, Math.sin(theta) * rad, eff.atk, 1.9, null, false, coopCtx);
  }
}

function spawnAutomaticProjectilesFromData(origin, launchDirs, targetIds, isFighterPriority, dmg){
  if(!state.scene) return;
  for(let i = 0; i < launchDirs.length; i++){
    const dir = launchDirs[i].clone().normalize();
    const tid = targetIds[i] || null;
    const chosenTarget = tid ? (state.enemies.find(e => e.userData.id === tid) || null) : null;

    const projGroup = new T.Group();
    const core = new T.Mesh(
      new T.SphereGeometry(0.16, 8, 8),
      new T.MeshBasicMaterial({ color: isFighterPriority ? 0xff4d6d : 0xe0aaff })
    );
    const halo = new T.Mesh(
      new T.SphereGeometry(0.27, 8, 8),
      new T.MeshBasicMaterial({ color: 0xc77dff, transparent: true, opacity: 0.45 })
    );
    projGroup.add(core, halo);
    projGroup.position.copy(origin);
    state.scene.add(projGroup);

    combatState.homingProjectiles.push({
      mesh: projGroup,
      pos: origin.clone(),
      vel: dir.multiplyScalar(32.0),
      targetEnemy: chosenTarget,
      isFighterPriority,
      dmg,
      life: 3.5,
      age: 0
    });
  }
}

export function spawnRemoteAutomaticVolley(payload){
  if(!state.scene || !isCombatActiveMode()) return;
  const origin = new T.Vector3(payload.ox, payload.oy, payload.oz);
  const dirs = (payload.dirs || []).map(d => new T.Vector3(d.x, d.y, d.z));
  spawnAutomaticProjectilesFromData(origin, dirs, payload.targetIds || [], !!payload.isFighterPriority, 0);
}

function executeAutomaticVolley(skin, eff, coopCtx = {}){
  combatState.attackCooldownTimer = skin.attackCooldown || 1.0;

  const isMultiBurst = (skin.skill.id === 'MultiBurst' && combatState.skillActiveTimer > 0);
  const totalShots = eff.autoVolleyCount + (isMultiBurst ? eff.multiBurstExtraShots : 0);

  const forward = new T.Vector3();
  state.camera.getWorldDirection(forward);
  const upRef = Math.abs(forward.y) > 0.92 ? new T.Vector3(0, 0, -1) : new T.Vector3(0, 1, 0);
  const right = new T.Vector3().crossVectors(forward, upRef).normalize();
  const camUp = new T.Vector3().crossVectors(right, forward).normalize();

  const origin = state.camera.position.clone().addScaledVector(forward, 0.85).addScaledVector(camUp, -0.18);

  const sortedEnemies = [...getCombatEnemies()].sort((a, b) => {
    if(isMultiBurst){
      const aF = a.userData.kind === 'fighter' ? 0 : 1;
      const bF = b.userData.kind === 'fighter' ? 0 : 1;
      if(aF !== bF) return aF - bF;
    }
    return origin.distanceTo(getTargetWorldPos(a)) - origin.distanceTo(getTargetWorldPos(b));
  });

  const assignedSet = new Set();
  const coneAngleRad = Math.PI / 3;
  const launchDirs = [];
  const targetIds = [];

  for(let i = 0; i < totalShots; i++){
    let launchDir;
    if(i === 0){
      launchDir = forward.clone().normalize();
    } else {
      const azimuth = ((i - 1) / Math.max(1, totalShots - 1)) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const radialVec = right.clone().multiplyScalar(Math.cos(azimuth))
        .addScaledVector(camUp, Math.sin(azimuth))
        .normalize();
      launchDir = forward.clone().multiplyScalar(Math.cos(coneAngleRad))
        .addScaledVector(radialVec, Math.sin(coneAngleRad))
        .normalize();
    }

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

    launchDirs.push(launchDir);
    targetIds.push(chosenTarget ? chosenTarget.userData.id : null);
  }

  spawnAutomaticProjectilesFromData(origin, launchDirs, targetIds, isMultiBurst, eff.atk);

  if(coopCtx.isCoop && coopCtx.sendCoop){
    coopCtx.sendCoop({
      type: 'syncAutomaticVolley',
      ox: origin.x, oy: origin.y, oz: origin.z,
      dirs: launchDirs.map(v => ({ x: v.x, y: v.y, z: v.z })),
      targetIds,
      isFighterPriority: isMultiBurst
    });
  }
}

function updateHomingProjectiles(dt, eff, coopCtx){
  for(let i = combatState.homingProjectiles.length - 1; i >= 0; i--){
    const p = combatState.homingProjectiles[i];
    p.age += dt;
    p.life -= dt;

    if(p.life <= 0){
      if(state.scene) state.scene.remove(p.mesh);
      combatState.homingProjectiles.splice(i, 1);
      continue;
    }

    const _curEnemies = getCombatEnemies();
    if(!p.targetEnemy || !_curEnemies.includes(p.targetEnemy)){
      const otherTargeted = new Set(
        combatState.homingProjectiles
          .filter(other => other !== p && other.targetEnemy && _curEnemies.includes(other.targetEnemy))
          .map(other => other.targetEnemy.userData.id)
      );
      const candidates = [..._curEnemies].sort((a, b) => {
        if(p.isFighterPriority){
          const aF = a.userData.kind === 'fighter' ? 0 : 1;
          const bF = b.userData.kind === 'fighter' ? 0 : 1;
          if(aF !== bF) return aF - bF;
        }
        return p.pos.distanceTo(getTargetWorldPos(a)) - p.pos.distanceTo(getTargetWorldPos(b));
      });
      p.targetEnemy = candidates.find(c => !otherTargeted.has(c.userData.id)) || candidates[0] || null;
    }

    const speed = 38.0;
    if(p.targetEnemy && _curEnemies.includes(p.targetEnemy)){
      const targetCenter = new T.Vector3();
      new T.Box3().setFromObject(p.targetEnemy).getCenter(targetCenter);
      const desiredDir = targetCenter.clone().sub(p.pos).normalize();

      const turnRate = p.age < 0.14 ? 4.5 : 16.0;
      const curDir = p.vel.clone().normalize();
      curDir.lerp(desiredDir, Math.min(1, turnRate * dt)).normalize();
      p.vel.copy(curDir).multiplyScalar(speed);

      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      if(state.syncTick % 2 === 0 && state.scene){
        const trail = new T.Mesh(
          new T.SphereGeometry(0.08, 5, 5),
          new T.MeshBasicMaterial({ color: 0xc77dff, transparent: true, opacity: 0.7 })
        );
        trail.position.copy(p.pos);
        state.scene.add(trail);
        state.fx.push({ m: trail, life: 7 });
      }

      if(p.pos.distanceTo(targetCenter) <= 1.45){
        if(p.dmg > 0){
          dealHitToEnemy(p.targetEnemy, p.dmg, 0xc77dff, eff.scoreMult, coopCtx, false);
        }
        if(state.scene) state.scene.remove(p.mesh);
        combatState.homingProjectiles.splice(i, 1);
      }
    } else {
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
    }
  }
}

function fireTurretHomingPulse(apexOrigin, turretAtk, eff, coopCtx){
  const _enemies = getCombatEnemies();
  if(_enemies.length === 0) return;

  let bestEnemy = null;
  let bestScore = Infinity;
  for(const e of _enemies){
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
    (Math.random() - 0.5) * 0.22,
    (Math.random() - 0.5) * 0.22,
    (Math.random() - 0.5) * 0.22
  );
  const aimPoint = targetCenter.clone().add(jitter);
  spawnShortGradientProjectile(apexOrigin, aimPoint, 0x4de680, 0.85, coopCtx);

  dealHitToEnemy(bestEnemy, turretAtk, 0x4de680, eff.scoreMult, coopCtx, false);
}

function executeWirbelwindAttack(skin, eff, coopCtx){
  const forward = new T.Vector3();
  state.camera.getWorldDirection(forward);
  const right = new T.Vector3(1, 0, 0).applyQuaternion(state.camera.quaternion);
  const up = new T.Vector3(0, 1, 0).applyQuaternion(state.camera.quaternion);

  const centerOrigin = state.camera.position.clone().addScaledVector(forward, 1.2);
  const half = (skin.squareSize || 0.75) * 0.5;

  const vertices = [
    centerOrigin.clone().addScaledVector(right, -half).addScaledVector(up,  half),
    centerOrigin.clone().addScaledVector(right,  half).addScaledVector(up,  half),
    centerOrigin.clone().addScaledVector(right, -half).addScaledVector(up, -half),
    centerOrigin.clone().addScaledVector(right,  half).addScaledVector(up, -half)
  ];

  const shotsPerVertex = eff.wirbelVertexShots;

  for(let s = 0; s < shotsPerVertex; s++){
    const delayMs = s * 55;
    const spreadY = s === 0 ? 0 : ((s % 2 === 1 ? 1 : -1) * Math.ceil(s / 2) * 0.018);
    const spreadP = s === 0 ? 0 : (((s % 3) - 1) * 0.015);
    const tid = setTimeout(() => {
      pendingShotTimers.delete(tid);
      if(!isCombatActiveMode()) return;
      for(const vOrigin of vertices){
        fireSingleBeam(skin, eff, spreadY, spreadP, eff.atk, skin.stats.beamRadius, vOrigin, false, coopCtx);
      }
    }, delayMs);
    pendingShotTimers.add(tid);
  }
}

function executeBeastAttack(skin, eff, coopCtx){
  const totalShots = eff.shotCount;
  const upg = getSkinUpgrade('Beast');
  const saintLv = upg.saint || 1;
  const maxSpread = saintLv > 1 ? Math.min(0.42, 0.04 + (saintLv - 1) * 0.008) : 0;

  const visualCount = Math.min(28, totalShots);
  const dmgPerBeam = eff.atk * (totalShots / visualCount);

  fireSingleBeam(skin, eff, 0, 0, dmgPerBeam, skin.stats.beamRadius, null, true, coopCtx);

  for(let i = 1; i < visualCount; i++){
    const theta = (i / visualCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const rad = (0.2 + Math.random() * 0.8) * maxSpread;
    fireSingleBeam(skin, eff, Math.cos(theta) * rad, Math.sin(theta) * rad, dmgPerBeam, skin.stats.beamRadius, null, true, coopCtx);
  }
}

export function shoot(coopCtx = {}){
  if(!isCombatActiveMode() || state.modalOpen) return;
  const skin = getEquippedSkin();
  const effectiveStats = getEffectiveStats(skin);

  if(skin.attackType === 'laser'){
    if(!combatState.laserDeployState.isDeployedComplete){
      deployNextLaserTurret(coopCtx);
    }
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
    if(!isInfinityActive && combatState.attackCooldownTimer > 0) return;
    executeScatterAttack(skin, effectiveStats, isInfinityActive, coopCtx);
    return;
  }

  if(skin.attackType === 'automatic'){
    if(combatState.attackCooldownTimer > 0) return;
    executeAutomaticVolley(skin, effectiveStats, coopCtx);
    return;
  }

  if(skin.attackType === 'wirbelwind'){
    executeWirbelwindAttack(skin, effectiveStats, coopCtx);
    return;
  }

  if(skin.attackType === 'beast'){
    executeBeastAttack(skin, effectiveStats, coopCtx);
    return;
  }

  const count = effectiveStats.shotCount;
  fireSingleBeam(skin, effectiveStats, 0, 0, null, null, null, false, coopCtx);

  for(let i = 1; i < count; i++){
    const angleOffset = (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * 0.045;
    const pitchOffset = ((i % 3) - 1) * 0.025;
    const tid = setTimeout(() => {
      pendingShotTimers.delete(tid);
      if(!isCombatActiveMode()) return;
      fireSingleBeam(skin, effectiveStats, angleOffset, pitchOffset, null, null, null, false, coopCtx);
    }, i * 85);
    pendingShotTimers.add(tid);
  }
}

export function updateCombatSystem(dt, coopCtx = {}){
  if(!isCombatActiveMode()) return;

  const skin = getEquippedSkin();
  const eff = getEffectiveStats(skin);

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

  const isInfinityActive = (skin.skill.id === 'InfinityBarrel' && combatState.skillActiveTimer > 0);
  if(isInfinityActive){
    combatState.attackCooldownTimer = 0;
  } else if(combatState.attackCooldownTimer > 0){
    combatState.attackCooldownTimer = Math.max(0, combatState.attackCooldownTimer - dt);
  }

  if(skin.attackType === 'laser'){
    updateChargeGauge(0);
    showExplosionChargeMeter(false);
    const ds = combatState.laserDeployState;
    const isNeverStopper = (skin.skill.id === 'NeverStopper' && combatState.skillActiveTimer > 0);
    const radiusMult = isNeverStopper ? eff.neverStopperRadiusMult : 1.0;

    if(ds.isDeployedComplete){
      const aimPt = getCrosshairAimPoint();
      const activeBeamSyncList = [];

      for(const lt of ds.turrets){
        lt.apexOrb.rotation.y += dt * 4;
        lt.apexOrb.scale.setScalar(0.95 + Math.sin(state.syncTick * 0.35 + lt.mkNumber) * 0.2);

        if(lt.activeTimer > 0){
          lt.activeTimer = Math.max(0, lt.activeTimer - dt);
          updateLaserAttackButtonState(lt.mkNumber, 'active', lt.activeTimer);

          const beamGrp = ensureLaserBeamMeshForTurret(lt);
          const startPt = lt.apexWorld;
          const dir = aimPt.clone().sub(startPt).normalize();
          const beamLen = 135;
          const endPt = startPt.clone().addScaledVector(dir, beamLen);

          beamGrp.position.copy(startPt).add(endPt).multiplyScalar(0.5);
          beamGrp.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);

          const pulse = 0.92 + Math.sin(state.syncTick * 0.65 + lt.mkNumber) * 0.14;
          const rScale = radiusMult * pulse;
          beamGrp.userData.coreCyl.scale.set(rScale, beamLen, rScale);
          beamGrp.userData.auraCyl.scale.set(rScale, beamLen, rScale);
          beamGrp.userData.muzzleSphere.position.set(0, -beamLen * 0.5, 0);
          beamGrp.userData.muzzleSphere.scale.setScalar(rScale);

          activeBeamSyncList.push({
            mkNumber: lt.mkNumber,
            aimX: aimPt.x,
            aimY: aimPt.y,
            aimZ: aimPt.z,
            radiusMult: rScale
          });

          lt.tickTimer += dt;
          while(lt.tickTimer >= 0.1){
            lt.tickTimer -= 0.1;
            applyTurretLaserContactDamage(lt, aimPt, radiusMult, coopCtx);
          }

          if(lt.activeTimer <= 0){
            removeLaserBeamMeshForTurret(lt);
            lt.cooldownTimer = 1.0;
            updateLaserAttackButtonState(lt.mkNumber, 'cooldown', lt.cooldownTimer);
          }
        } else if(lt.cooldownTimer > 0){
          removeLaserBeamMeshForTurret(lt);
          lt.cooldownTimer = Math.max(0, lt.cooldownTimer - dt);
          if(lt.cooldownTimer > 0){
            updateLaserAttackButtonState(lt.mkNumber, 'cooldown', lt.cooldownTimer);
          } else {
            updateLaserAttackButtonState(lt.mkNumber, 'ready', 0);
          }
        } else {
          removeLaserBeamMeshForTurret(lt);
          updateLaserAttackButtonState(lt.mkNumber, 'ready', 0);
        }
      }

      if(coopCtx.isCoop && coopCtx.sendCoop && state.syncTick % 2 === 0){
        coopCtx.sendCoop({
          type: 'syncLaserBeams',
          beams: activeBeamSyncList
        });
      }
    }
  } else if(skin.attackType === 'explosion'){
    updateChargeGauge(0);
    showExplosionChargeMeter(true);

    if(combatState.isCharging){
      combatState.chargeElapsed += dt;
      const { quantizedSec, isMax, maxChargeSec } = getExplosionEffectiveChargedSec(skin, eff);
      if(combatState.chargeElapsed > maxChargeSec){
        combatState.chargeElapsed = maxChargeSec;
      }

      updateExplosionChargeMeter(quantizedSec, true, isMax, eff.bonusBlastRadiusM);
      if(isMax){
        updateFireButtonUI('MAX\n離して発射', 'charging');
      } else {
        updateFireButtonUI(`溜め中\n${quantizedSec.toFixed(1)}s`, 'charging');
      }
    } else {
      updateExplosionChargeMeter(0, false, false, eff.bonusBlastRadiusM);
      updateFireButtonUI('CHARGE\nMAX 3.0s', '');
    }
  } else if(skin.attackType === 'scatter'){
    updateChargeGauge(0);
    showExplosionChargeMeter(false);
    if(isInfinityActive){
      updateFireButtonUI('FREE\nFIRE!', 'infinity');
      if(combatState.fireHeld){
        combatState.autoFireTimer += dt;
        if(combatState.autoFireTimer >= 0.08){
          combatState.autoFireTimer = 0;
          executeScatterAttack(skin, eff, true, coopCtx);
        }
      }
    } else if(combatState.attackCooldownTimer > 0){
      updateFireButtonUI(`CD\n${combatState.attackCooldownTimer.toFixed(1)}s`, 'cooldown');
    } else {
      updateFireButtonUI('SCATTER', '');
      if(combatState.fireHeld){
        executeScatterAttack(skin, eff, false, coopCtx);
      }
    }
  } else if(skin.attackType === 'automatic'){
    updateChargeGauge(0);
    showExplosionChargeMeter(false);
    const isMultiBurst = (skin.skill.id === 'MultiBurst' && combatState.skillActiveTimer > 0);
    const totalVolley = eff.autoVolleyCount + (isMultiBurst ? eff.multiBurstExtraShots : 0);
    if(combatState.attackCooldownTimer > 0){
      updateFireButtonUI(`CD\n${combatState.attackCooldownTimer.toFixed(1)}s`, 'cooldown');
    } else {
      updateFireButtonUI(`AUTO\n×${totalVolley}`, isMultiBurst ? 'infinity' : '');
      if(combatState.fireHeld){
        executeAutomaticVolley(skin, eff, coopCtx);
      }
    }
  } else if(skin.attackType === 'beast'){
    updateChargeGauge(0);
    showExplosionChargeMeter(false);
    updateFireButtonUI('BEAST', '');
    if(combatState.fireHeld){
      combatState.autoFireTimer += dt;
      if(combatState.autoFireTimer >= 0.07){
        combatState.autoFireTimer = 0;
        executeBeastAttack(skin, eff, coopCtx);
      }
    }
  } else {
    updateChargeGauge(0);
    showExplosionChargeMeter(false);
    updateFireButtonUI(skin.attackType === 'wirbelwind' ? '4-QUAD' : 'PULSE', '');
  }

  updateHomingProjectiles(dt, eff, coopCtx);

  for(let i = combatState.turrets.length - 1; i >= 0; i--){
    const tr = combatState.turrets[i];
    tr.life -= dt;
    tr.apexOrb.rotation.y += dt * 4;
    tr.apexOrb.scale.setScalar(0.9 + Math.sin(state.syncTick * 0.35) * 0.2);

    if(tr.life <= 0){
      burst(tr.apexWorld, 0x4de680);
      if(state.scene) state.scene.remove(tr.mesh);
      combatState.turrets.splice(i, 1);
      continue;
    }

    const curFireRate = Math.max(0.5, eff.rawRate);
    const curAtk = eff.atk;
    const interval = 1.0 / curFireRate;
    tr.fireTimer += dt;
    while(tr.fireTimer >= interval){
      tr.fireTimer -= interval;
      fireTurretHomingPulse(tr.apexWorld, curAtk, eff, coopCtx);
    }
  }

  for(let i = combatState.remoteTurrets.length - 1; i >= 0; i--){
    const rt = combatState.remoteTurrets[i];
    rt.life -= dt;
    rt.apexOrb.rotation.y += dt * 4;
    rt.apexOrb.scale.setScalar(0.9 + Math.sin(state.syncTick * 0.35) * 0.2);
    if(rt.life <= 0){
      burst(rt.apexWorld, 0x38c8f0);
      if(state.scene) state.scene.remove(rt.mesh);
      combatState.remoteTurrets.splice(i, 1);
    }
  }

  for(const rlt of combatState.remoteLaserState.turrets){
    rlt.apexOrb.rotation.y += dt * 4;
    rlt.apexOrb.scale.setScalar(0.95 + Math.sin(state.syncTick * 0.35 + rlt.mkNumber) * 0.2);
  }
}
