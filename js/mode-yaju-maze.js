import * as T from './libs/three.module.js';
import { state, getEquippedSkin, getEffectiveStats, saveGameData } from './state.js';
import {
  YAJU_CONFIG, YAJU_BOSSES, YAJU_BOSS_DIFFICULTIES, YAJU_REWARDS,
  YAJU_CHASER_IMAGES, YAJU_BOOM_IMAGE, YAJU_IZAN_IMAGE, YAJU_NEEDLE_COLORS
} from './yaju-config.js';
import {
  cellWorld, isWallAt, canStand, lineOfSight, findPathAStar, getElevationHeightAt
} from './yaju-collision.js';
import {
  generateYajuMaze, buildYajuMazeScene, setupYajuMapRockets,
  buildYajuBossScene, buildYajuDeadStage
} from './yaju-world.js';
import { $, showToast, setModeUI, showExplosionChargeMeter } from './ui.js';
import { resetCombatState, initLaserTurretDeployState } from './player.js';

const texLoader = new T.TextureLoader();

let enemyTextureNormal = null;
let enemyTextureBoom = null;
let izanTexture = null;
let preloadedVideo = null;
let messageTimer = null;
let yajuCallbacks = {
  enterHome: null,
  openBossSetup: null
};

export const yajuState = {
  active: false,
  subMode: 'normal', // 'normal' | 'boss_world_enemy' | 'boss_beast_king' | 'deadstage'
  bossDiff: YAJU_BOSS_DIFFICULTIES[0],
  settings: {
    compass: true,
    progressiveEnemies: true
  },
  currentFloor: 1,
  hasRocketFromPreviousFloor: false,
  rocketAmmo: 0,
  stamina: YAJU_CONFIG.maxStamina,
  playerHp: YAJU_CONFIG.playerMaxHp,
  sprintHeld: false,
  isDashing: false,
  dashTimer: 0,
  dashCooldownTimer: 0,
  isSlowed: false,
  slowTimer: 0,
  invulnerableTimer: 0,
  maze: null,
  goalMesh: null,
  playerPos: new T.Vector3(0, 1.4, 0),
  enemies: [],
  projectiles: [],
  mapRocketItems: [],
  pointLightsList: [],
  elevationsList: [],
  trapsList: [],
  deadStageTimer: 0,
  clearStageActive: false,
  clearStageTimer: 0,
  clearStageDeleted: false,
  clearBossTitle: '',
  running: false,
  ended: false,
  isTransitioningToDeadStage: false
};

export function bindYajuCallbacks(cbs){
  yajuCallbacks = { ...yajuCallbacks, ...cbs };
}

function el(id){
  return document.getElementById(id);
}

function playYajuAudio(id, vol = 1.0){
  const a = el(id);
  if(a){
    a.currentTime = 0;
    a.volume = vol;
    a.play().catch(() => {});
  }
}

function startYarimasuneLoop(){
  const a = el('bgm-yarimasune');
  if(a){
    a.loop = true;
    a.volume = 1.0;
    a.currentTime = 0;
    a.play().catch(() => {});
  }
}

function stopYarimasuneLoop(){
  const a = el('bgm-yarimasune');
  if(a){
    a.pause();
    a.currentTime = 0;
  }
}

export function stopYajuMedia(){
  stopYarimasuneLoop();
  const video = el('yaju-capture-video');
  if(video){
    video.pause();
    video.currentTime = 0;
    video.style.display = 'none';
  }
  const block = el('yaju-catch-block-overlay');
  if(block && block.parentNode) block.parentNode.removeChild(block);
}

function unlockAndPreloadVideo(){
  if(!preloadedVideo){
    preloadedVideo = document.createElement('video');
    preloadedVideo.id = 'yaju-capture-video';
    preloadedVideo.src = './assets/videos/inmuking.mp4';
    preloadedVideo.playsInline = true;
    preloadedVideo.muted = false;
    preloadedVideo.preload = 'auto';
    preloadedVideo.setAttribute('playsinline', '');
    preloadedVideo.setAttribute('webkit-playsinline', '');
    preloadedVideo.style.cssText = 'display:none;position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;z-index:9999;background:#000;pointer-events:auto;';
    document.body.appendChild(preloadedVideo);
  }
  preloadedVideo.pause();
  preloadedVideo.currentTime = 0;
}

function playCaptureVideoDirectly(onEndedCallback){
  stopYarimasuneLoop();
  let video = el('yaju-capture-video');
  if(!video){
    unlockAndPreloadVideo();
    video = el('yaju-capture-video');
  }

  video.style.display = 'block';
  video.currentTime = 0;
  video.muted = false;

  const p = video.play();
  if(p !== undefined){
    p.catch(() => {
      video.muted = true;
      video.play().then(() => { video.muted = false; }).catch(() => {});
    });
  }

  const blockOverlay = document.createElement('div');
  blockOverlay.id = 'yaju-catch-block-overlay';
  blockOverlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;pointer-events:auto;';
  document.body.appendChild(blockOverlay);

  const ctrlEl = el('yajuControls');
  if(ctrlEl) ctrlEl.classList.add('hidden');

  setTimeout(() => {
    video.pause();
    video.style.display = 'none';
    if(blockOverlay.parentNode) blockOverlay.parentNode.removeChild(blockOverlay);
    if(onEndedCallback) onEndedCallback();
  }, YAJU_CONFIG.captureWaitTime * 1000);
}

function showYajuMessage(text){
  const msgEl = el('yajuMessage');
  if(!msgEl) return;
  msgEl.textContent = text;
  msgEl.style.opacity = '1';
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    const m = el('yajuMessage');
    if(m) m.style.opacity = '0';
  }, 3200);
}

function createEnemyMaterial(mapTex){
  return new T.MeshBasicMaterial({
    map: mapTex || null,
    color: mapTex ? 0xffffff : 0xaa2222,
    transparent: true,
    side: T.DoubleSide,
    depthWrite: false
  });
}

function ensureYajuTextures(){
  if(!enemyTextureNormal){
    texLoader.load(YAJU_CHASER_IMAGES[0], tex => {
      tex.colorSpace = T.SRGBColorSpace;
      enemyTextureNormal = tex;
      for(const e of yajuState.enemies){
        if(e.planeMesh && e.state !== 'booming'){
          e.planeMesh.material = createEnemyMaterial(tex);
        }
      }
    }, undefined, () => {});
  }
  if(!enemyTextureBoom){
    texLoader.load(YAJU_BOOM_IMAGE, tex => {
      tex.colorSpace = T.SRGBColorSpace;
      enemyTextureBoom = tex;
    }, undefined, () => {});
  }
}

function updateBossHpUI(bossObj){
  const panel = el('yajuBossHpPanel');
  const fill = el('yajuBossHpFill');
  const text = el('yajuBossHpText');
  const label = el('yajuBossHpLabel');
  if(!panel || !fill || !text || !bossObj) return;
  const hpVal = Math.max(0, Math.ceil(bossObj.hp));
  const maxHp = bossObj.maxHp || 100;
  if(label){
    label.textContent = bossObj.isWorldEnemy ? 'WORLD ENEMY HP' : '獣王 HP';
  }
  fill.style.width = `${(hpVal / maxHp) * 100}%`;
  text.textContent = `${hpVal} / ${maxHp}`;
}

function updateRocketUI(){
  const hudImg = el('yajuRocketHud');
  const btn = el('yajuRocketBtn');
  const countEl = el('yajuRocketCount');
  const meter = el('explosionChargeMeter');
  const show = yajuState.active && !yajuState.ended && yajuState.subMode !== 'deadstage' && yajuState.rocketAmmo > 0;

  if(hudImg) hudImg.classList.toggle('hidden', !show);
  if(btn) btn.classList.toggle('hidden', !show);
  if(countEl) countEl.textContent = String(yajuState.rocketAmmo);
  if(meter) meter.classList.toggle('yaju-rocket-offset', show);
}

function placeGoalFixed(openCells){
  const targetX = YAJU_CONFIG.mazeCells - 2;
  const targetZ = YAJU_CONFIG.mazeCells - 2;
  let bestCell = { x: targetX, z: targetZ };
  if(yajuState.maze[targetZ][targetX] === 1){
    let minDist = Infinity;
    for(const c of openCells){
      const d = Math.hypot(c.x - targetX, c.z - targetZ);
      if(d < minDist){ minDist = d; bestCell = c; }
    }
  }

  yajuState.maze[bestCell.z][bestCell.x] = 0;
  const gp = cellWorld(bestCell.x, bestCell.z, yajuState.maze.length);

  let rotY = 0;
  const offsetDist = (YAJU_CONFIG.cellSize / 2) - 0.2;
  const finalPos = new T.Vector3(gp.x, 0, gp.z);

  if(yajuState.maze[bestCell.z - 1]?.[bestCell.x] === 1){ rotY = 0; finalPos.z -= offsetDist; }
  else if(yajuState.maze[bestCell.z + 1]?.[bestCell.x] === 1){ rotY = Math.PI; finalPos.z += offsetDist; }
  else if(yajuState.maze[bestCell.z][bestCell.x - 1] === 1){ rotY = Math.PI / 2; finalPos.x -= offsetDist; }
  else if(yajuState.maze[bestCell.z][bestCell.x + 1] === 1){ rotY = -Math.PI / 2; finalPos.x += offsetDist; }

  const goalMesh = new T.Group();
  goalMesh.position.copy(finalPos);
  goalMesh.rotation.y = rotY;

  const frameMat = new T.MeshStandardMaterial({ color: 0x4b4637, roughness: 0.85 });
  const doorMat = new T.MeshStandardMaterial({ color: 0x6f755f, roughness: 0.7 });
  const leftPost = new T.Mesh(new T.BoxGeometry(0.18, 2.5, 0.22), frameMat);
  leftPost.position.set(-0.78, 1.25, 0);
  goalMesh.add(leftPost);
  const rightPost = leftPost.clone();
  rightPost.position.x = 0.78;
  goalMesh.add(rightPost);
  const lintel = new T.Mesh(new T.BoxGeometry(1.72, 0.2, 0.24), frameMat);
  lintel.position.set(0, 2.45, 0);
  goalMesh.add(lintel);
  const door = new T.Mesh(new T.BoxGeometry(1.35, 2.3, 0.12), doorMat);
  door.position.set(0, 1.15, -0.04);
  goalMesh.add(door);

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 128;
  signCanvas.height = 48;
  const signCtx = signCanvas.getContext('2d');
  signCtx.fillStyle = '#183c2a';
  signCtx.fillRect(0, 0, 128, 48);
  signCtx.strokeStyle = '#d7e8c9';
  signCtx.lineWidth = 4;
  signCtx.strokeRect(2, 2, 124, 44);
  signCtx.fillStyle = '#f0f4df';
  signCtx.font = 'bold 24px Arial';
  signCtx.textAlign = 'center';
  signCtx.fillText(yajuState.currentFloor === YAJU_CONFIG.maxFloors ? 'FINAL EXIT' : `EXIT ${yajuState.currentFloor}F`, 64, 32);
  const signTex = new T.CanvasTexture(signCanvas);
  const sign = new T.Mesh(new T.PlaneGeometry(1.0, 0.38), new T.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, 2.1, 0.09);
  goalMesh.add(sign);

  const glow = new T.PointLight(0x8aff9d, 2.0, 10);
  glow.position.set(0, 2.1, 0.5);
  goalMesh.add(glow);
  state.scene.add(goalMesh);
  yajuState.goalMesh = goalMesh;
}

function spawnNormalChaserAt(x, z, id, isBossMinion = false){
  const stepH = getElevationHeightAt(x, z, [...yajuState.elevationsList, ...yajuState.trapsList]);
  const group = new T.Group();
  group.position.set(x, stepH, z);
  state.scene.add(group);

  const planeMesh = new T.Mesh(new T.PlaneGeometry(2.0, 2.0), createEnemyMaterial(enemyTextureNormal));
  planeMesh.position.y = 1.0;
  group.add(planeMesh);

  const enemyObj = {
    id,
    group,
    planeMesh,
    state: isBossMinion ? 'chase' : 'patrol',
    target: null,
    isBossMinion,
    hp: 1,
    maxHp: 1,
    attackCooldown: 0,
    path: [],
    pathIndex: 0,
    repathTimer: 0,
    color: YAJU_NEEDLE_COLORS[id % YAJU_NEEDLE_COLORS.length]
  };
  planeMesh.userData.id = `yaju_${id}`;
  planeMesh.userData.yajuEnemy = enemyObj;
  yajuState.enemies.push(enemyObj);
  return enemyObj;
}

function updateRadarUI(totalEnemies){
  const radarCircle = el('yajuRadar');
  if(!radarCircle) return;
  radarCircle.innerHTML = '';
  if(!yajuState.settings.compass) return;

  for(let i = 0; i < totalEnemies; i++){
    const needle = document.createElement('div');
    needle.id = `yaju-radar-needle-${i}`;
    needle.className = 'yaju-needle';
    needle.style.backgroundColor = YAJU_NEEDLE_COLORS[i % YAJU_NEEDLE_COLORS.length];
    radarCircle.appendChild(needle);
  }
}

function setupEnemies(openCells, spawnPos){
  for(const eObj of yajuState.enemies){
    if(eObj.group && state.scene) state.scene.remove(eObj.group);
  }
  yajuState.enemies = [];

  const diffHp = yajuState.bossDiff ? yajuState.bossDiff.hp : 100;

  if(yajuState.subMode === 'boss_beast_king'){
    const ep = { x: 0, z: -10 };
    const stepH = getElevationHeightAt(ep.x, ep.z, [...yajuState.elevationsList, ...yajuState.trapsList]);
    const group = new T.Group();
    group.position.set(ep.x, stepH, ep.z);
    state.scene.add(group);

    const planeMesh = new T.Mesh(new T.PlaneGeometry(4.0, 4.0), createEnemyMaterial(enemyTextureNormal));
    planeMesh.position.y = 2.0;
    group.add(planeMesh);

    const beastKing = {
      id: 0,
      group,
      planeMesh,
      state: 'chase',
      hp: diffHp,
      maxHp: diffHp,
      isBeastKing: true,
      attackCooldown: 0,
      bossDashTimer: 0,
      bossDashActive: false,
      hasDamagedThisDash: false,
      color: '#ff0000'
    };
    planeMesh.userData.id = 'yaju_boss_beast_king';
    planeMesh.userData.yajuEnemy = beastKing;
    yajuState.enemies.push(beastKing);
    updateBossHpUI(beastKing);
    return;
  }

  if(yajuState.subMode === 'boss_world_enemy'){
    const cubeSize = YAJU_CONFIG.wallHeight;
    const group = new T.Group();
    group.position.set(0, 0, 0);
    state.scene.add(group);

    const cubeMat = new T.MeshBasicMaterial({
      map: izanTexture || null,
      color: izanTexture ? 0xffffff : 0x552288
    });
    const cubeGeo = new T.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cubeMesh = new T.Mesh(cubeGeo, cubeMat);
    cubeMesh.position.y = cubeSize / 2;
    group.add(cubeMesh);

    if(!izanTexture){
      texLoader.load(YAJU_IZAN_IMAGE, tex => {
        tex.colorSpace = T.SRGBColorSpace;
        izanTexture = tex;
        cubeMat.map = tex;
        cubeMat.color.setHex(0xffffff);
        cubeMat.needsUpdate = true;
      }, undefined, () => {});
    }

    const worldEnemy = {
      id: 0,
      group,
      cubeMesh,
      planeMesh: null,
      state: 'boss_turret',
      hp: diffHp,
      maxHp: diffHp,
      isWorldEnemy: true,
      cubeSize,
      halfExtent: cubeSize / 2,
      shootTimer: 3.0,
      spawnMinionTimer: 10.0,
      spinTimer: 2.0,
      attackCooldown: 0,
      dashHitCooldown: false,
      color: '#00aaff'
    };
    cubeMesh.userData.id = 'yaju_boss_world_enemy';
    cubeMesh.userData.yajuEnemy = worldEnemy;
    yajuState.enemies.push(worldEnemy);
    updateBossHpUI(worldEnemy);

    spawnNormalChaserAt(0, 0, 1, true);
    spawnNormalChaserAt(0, 0, 2, true);
    showYajuMessage('World Enemyが家臣を2体産出した！');
    return;
  }

  const totalEnemies = yajuState.settings.progressiveEnemies ? yajuState.currentFloor : 1;
  for(let i = 0; i < totalEnemies; i++){
    const candidates = openCells.filter(c => {
      const p = cellWorld(c.x, c.z, yajuState.maze.length);
      return Math.hypot(p.x - spawnPos.x, p.z - spawnPos.z) >= 4;
    });
    const spawnCellPos = candidates[Math.floor(Math.random() * candidates.length)] || openCells[0];
    const ep = cellWorld(spawnCellPos.x, spawnCellPos.z, yajuState.maze.length);
    spawnNormalChaserAt(ep.x, ep.z, i, false);
  }
  updateRadarUI(totalEnemies);
}

function clearStageObjects(){
  if(!state.scene) return;
  while(state.scene.children.length > 0){
    state.scene.remove(state.scene.children[0]);
  }
  yajuState.enemies = [];
  yajuState.projectiles = [];
  yajuState.mapRocketItems = [];
  yajuState.elevationsList = [];
  yajuState.trapsList = [];
  yajuState.pointLightsList = [];
  yajuState.goalMesh = null;
}

export function resetYajuState(){
  stopYajuMedia();
  yajuState.active = false;
  yajuState.running = false;
  yajuState.ended = false;
  yajuState.isTransitioningToDeadStage = false;
  yajuState.clearStageActive = false;
  yajuState.sprintHeld = false;
  yajuState.isDashing = false;
  yajuState.enemies = [];
  yajuState.projectiles = [];
  yajuState.mapRocketItems = [];
  yajuState.elevationsList = [];
  yajuState.trapsList = [];
  yajuState.pointLightsList = [];
  yajuState.goalMesh = null;

  const hudEl = el('yajuHud');
  const endEl = el('yajuEndOverlay');
  const meter = el('explosionChargeMeter');
  if(hudEl) hudEl.classList.add('hidden');
  if(endEl) endEl.classList.add('hidden');
  if(meter) meter.classList.remove('yaju-rocket-offset');
}

function initYajuStage(subMode){
  stopYajuMedia();
  resetCombatState();

  yajuState.active = true;
  yajuState.subMode = subMode;
  yajuState.running = false;
  yajuState.ended = false;
  yajuState.isTransitioningToDeadStage = false;
  yajuState.clearStageActive = false;
  yajuState.clearStageTimer = 0;
  yajuState.clearStageDeleted = false;
  yajuState.isDashing = false;
  yajuState.dashTimer = 0;
  yajuState.dashCooldownTimer = 0;
  yajuState.isSlowed = false;
  yajuState.slowTimer = 0;
  yajuState.sprintHeld = false;

  clearStageObjects();

  const hudEl = el('yajuHud');
  const endEl = el('yajuEndOverlay');
  if(endEl) endEl.classList.add('hidden');
  if(hudEl) hudEl.classList.remove('hidden');

  const isBoss = subMode === 'boss_world_enemy' || subMode === 'boss_beast_king';
  const isDead = subMode === 'deadstage';

  if(isBoss){
    state.gameMode = 'battle';
    state.activeBattleMode = 'YAJU_BOSS';
    const eqSkin = getEquippedSkin();
    setModeUI('battle', eqSkin, false, false, 'YAJU_BOSS');
    if(eqSkin.attackType === 'laser'){
      const eff = getEffectiveStats(eqSkin);
      initLaserTurretDeployState(eff.laserTurretCount);
    }

    const built = buildYajuBossScene(T, state.scene, subMode);
    yajuState.maze = built.maze;
    yajuState.pointLightsList = built.pointLightsList;
    yajuState.elevationsList = built.elevations;
    yajuState.trapsList = built.traps;
    yajuState.mapRocketItems = built.bossRockets;

    const cornerPos = cellWorld(1, 1, 10);
    const startStepH = getElevationHeightAt(cornerPos.x, cornerPos.z, [...yajuState.elevationsList, ...yajuState.trapsList]);
    yajuState.playerPos.set(cornerPos.x, 1.4 + startStepH, cornerPos.z);
    state.x = yajuState.playerPos.x;
    state.y = yajuState.playerPos.y;
    state.z = yajuState.playerPos.z;
    state.yaw = Math.atan2(-cornerPos.x, -cornerPos.z) + Math.PI;
    state.pitch = 0;

    yajuState.playerHp = YAJU_CONFIG.playerMaxHp;
    yajuState.rocketAmmo = 3;

    setupEnemies([], cornerPos);

    el('yajuStaminaPanel')?.classList.add('hidden');
    el('yajuHpPanel')?.classList.remove('hidden');
    el('yajuBossHpPanel')?.classList.remove('hidden');
    el('yajuCompassContainer')?.classList.add('hidden');
    el('yajuSprintBtn')?.classList.add('hidden');
    el('yajuDashWrap')?.classList.remove('hidden');
    el('yajuControls')?.classList.remove('hidden');
    el('yajuFloorDisplay').textContent = subMode === 'boss_world_enemy' ? 'WORLD ENEMY' : '獣王';
    el('yajuHpFill').style.width = '100%';
    el('yajuHpText').textContent = `${YAJU_CONFIG.playerMaxHp} / ${YAJU_CONFIG.playerMaxHp}`;
    updateRocketUI();
  } else if(isDead){
    state.gameMode = 'battle';
    state.activeBattleMode = 'YAJU_DEAD';
    setModeUI('battle', null, false, false, 'YAJU_DEAD');
    showExplosionChargeMeter(false);

    startYarimasuneLoop();
    buildYajuDeadStage(T, state.scene);
    yajuState.maze = null;
    yajuState.playerPos.set(0, 1.4, 0);
    state.camera.position.copy(yajuState.playerPos);

    yajuState.enemies = [];
    const deadAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    const startRadius = 8.0;
    for(let i = 0; i < 4; i++){
      const group = new T.Group();
      const angle = deadAngles[i];
      group.position.set(Math.cos(angle) * startRadius, 0, Math.sin(angle) * startRadius);
      state.scene.add(group);
      const planeMesh = new T.Mesh(new T.PlaneGeometry(2.0, 2.0), createEnemyMaterial(enemyTextureNormal));
      planeMesh.position.y = 1.0;
      group.add(planeMesh);
      yajuState.enemies.push({ group, planeMesh, state: 'deadstage_approach', angle, startDist: startRadius });
    }

    yajuState.deadStageTimer = 6.0;
    el('yajuStaminaPanel')?.classList.add('hidden');
    el('yajuHpPanel')?.classList.add('hidden');
    el('yajuBossHpPanel')?.classList.add('hidden');
    el('yajuCompassContainer')?.classList.add('hidden');
    el('yajuControls')?.classList.add('hidden');
    el('yajuFloorDisplay').textContent = 'DEAD STAGE';
    updateRocketUI();
  } else {
    state.gameMode = 'battle';
    state.activeBattleMode = 'YAJU_MAZE';
    setModeUI('battle', null, false, false, 'YAJU_MAZE');

    yajuState.maze = generateYajuMaze(YAJU_CONFIG.mazeCells);
    const built = buildYajuMazeScene(T, state.scene, yajuState.maze);
    yajuState.pointLightsList = built.pointLightsList;
    yajuState.elevationsList = built.elevations;
    yajuState.trapsList = built.traps;

    const open = [];
    for(let z = 1; z < yajuState.maze.length - 1; z++){
      for(let x = 1; x < yajuState.maze.length - 1; x++){
        if(yajuState.maze[z][x] === 0) open.push({ x, z });
      }
    }

    const spawnPos = cellWorld(1, 1, yajuState.maze.length);
    yajuState.playerPos.set(spawnPos.x, 1.4, spawnPos.z);
    state.x = yajuState.playerPos.x;
    state.y = yajuState.playerPos.y;
    state.z = yajuState.playerPos.z;
    state.yaw = 0;
    state.pitch = 0;

    placeGoalFixed(open);

    yajuState.stamina = YAJU_CONFIG.maxStamina;
    yajuState.rocketAmmo = yajuState.hasRocketFromPreviousFloor ? YAJU_CONFIG.maxRocketAmmo : 0;
    yajuState.mapRocketItems = setupYajuMapRockets(T, state.scene, open, yajuState.maze.length, spawnPos, yajuState.elevationsList);
    setupEnemies(open, spawnPos);

    el('yajuHpPanel')?.classList.add('hidden');
    el('yajuBossHpPanel')?.classList.add('hidden');
    el('yajuStaminaPanel')?.classList.remove('hidden');
    el('yajuCompassContainer')?.classList.toggle('hidden', !yajuState.settings.compass);
    el('yajuSprintBtn')?.classList.remove('hidden');
    el('yajuDashWrap')?.classList.remove('hidden');
    el('yajuControls')?.classList.remove('hidden');
    el('yajuFloorDisplay').textContent = `${yajuState.currentFloor}F`;
    updateRocketUI();
  }

  ensureYajuTextures();
  yajuState.invulnerableTimer = YAJU_CONFIG.invulnerableDuration;
  yajuState.running = true;
}

export function startYajuNormalMode(settings){
  yajuState.settings = {
    compass: !!settings.compass,
    progressiveEnemies: !!settings.progressiveEnemies
  };
  yajuState.currentFloor = 1;
  yajuState.hasRocketFromPreviousFloor = false;
  unlockAndPreloadVideo();
  initYajuStage('normal');
  playYajuAudio('se-start', 1.0);
}

export function startYajuBossMode(bossId, diffId){
  const diffObj = YAJU_BOSS_DIFFICULTIES.find(d => d.id === diffId) || YAJU_BOSS_DIFFICULTIES[0];
  yajuState.bossDiff = diffObj;
  unlockAndPreloadVideo();
  initYajuStage(bossId);
  playYajuAudio('se-start', 1.0);
}

export function triggerYajuDash(){
  if(!yajuState.active || !yajuState.running || yajuState.ended || yajuState.isDashing || yajuState.dashCooldownTimer > 0) return;
  if(yajuState.subMode === 'deadstage' || yajuState.clearStageActive || yajuState.isTransitioningToDeadStage) return;

  if(yajuState.subMode === 'normal'){
    if(yajuState.stamina < YAJU_CONFIG.dashStaminaCost){
      showYajuMessage('スタミナ不足！(消費: 10)');
      return;
    }
    yajuState.stamina -= YAJU_CONFIG.dashStaminaCost;
  }

  yajuState.isDashing = true;
  yajuState.dashTimer = YAJU_CONFIG.dashDuration;
  yajuState.dashCooldownTimer = YAJU_CONFIG.dashCooldown;

  playYajuAudio('se-totugeki', 1.0);
  setTimeout(() => {
    const a = el('se-totugeki');
    if(a){ a.pause(); a.currentTime = 0; }
  }, 4000);
  showYajuMessage('突進発動！(2秒間無敵突進＆接触爆破)');
}

export function shootYajuRocket(){
  if(!yajuState.active || !yajuState.running || yajuState.ended || yajuState.rocketAmmo <= 0) return;
  if(yajuState.subMode === 'deadstage' || yajuState.clearStageActive || yajuState.isTransitioningToDeadStage) return;

  yajuState.rocketAmmo--;
  updateRocketUI();

  const projectileMesh = new T.Mesh(
    new T.SphereGeometry(0.4, 8, 8),
    new T.MeshBasicMaterial({ color: 0xff5500 })
  );
  const dir = new T.Vector3();
  state.camera.getWorldDirection(dir);
  projectileMesh.position.copy(state.camera.position);
  state.scene.add(projectileMesh);

  yajuState.projectiles.push({
    mesh: projectileMesh,
    direction: dir,
    speed: YAJU_CONFIG.projectileSpeed,
    life: 4.0,
    isEnemyProjectile: false
  });
}

export function getYajuTargetMeshes(){
  const list = [];
  for(const eObj of yajuState.enemies){
    if(eObj.state === 'defeated' || eObj.state === 'booming') continue;
    if(eObj.isWorldEnemy && eObj.cubeMesh) list.push(eObj.cubeMesh);
    else if(eObj.planeMesh) list.push(eObj.planeMesh);
  }
  return list;
}

export function applyYajuPlayerDamage(targetMesh, dmg){
  const eObj = targetMesh && targetMesh.userData ? targetMesh.userData.yajuEnemy : null;
  if(!eObj || eObj.state === 'defeated' || eObj.state === 'booming') return;

  if(eObj.isWorldEnemy || eObj.isBeastKing){
    eObj.hp = Math.max(0, eObj.hp - dmg);
    updateBossHpUI(eObj);
    if(eObj.hp <= 0){
      const label = eObj.isWorldEnemy ? 'World Enemy' : '獣王';
      triggerClearStage(label);
    }
  } else {
    eObj.state = 'booming';
    eObj.repathTimer = 1.0;
    if(enemyTextureBoom && eObj.planeMesh){
      eObj.planeMesh.material = createEnemyMaterial(enemyTextureBoom);
    }
    playYajuAudio('se-boom', 1.0);
  }
}

function collidesWithWorldEnemy(x, z, radius){
  for(const eObj of yajuState.enemies){
    if(eObj.isWorldEnemy && eObj.state !== 'defeated'){
      const half = eObj.halfExtent + radius;
      if(Math.abs(x - eObj.group.position.x) < half && Math.abs(z - eObj.group.position.z) < half){
        return true;
      }
    }
  }
  return false;
}

function damagePlayer(amount, msg){
  if(yajuState.ended || yajuState.clearStageActive || yajuState.isTransitioningToDeadStage || yajuState.subMode === 'deadstage') return;
  yajuState.playerHp = Math.max(0, yajuState.playerHp - amount);

  const hpFill = el('yajuHpFill');
  const hpText = el('yajuHpText');
  if(hpFill) hpFill.style.width = `${(yajuState.playerHp / YAJU_CONFIG.playerMaxHp) * 100}%`;
  if(hpText) hpText.textContent = `${Math.ceil(yajuState.playerHp)} / ${YAJU_CONFIG.playerMaxHp}`;

  if(msg) showYajuMessage(msg);
  if(yajuState.playerHp <= 0){
    triggerDeadStage();
  }
}

function triggerDeadStage(){
  if(yajuState.ended || yajuState.isTransitioningToDeadStage || yajuState.subMode === 'deadstage') return;
  yajuState.isTransitioningToDeadStage = true;
  yajuState.running = false;
  for(const p of yajuState.projectiles){
    if(p.mesh && state.scene) state.scene.remove(p.mesh);
  }
  yajuState.projectiles = [];
  initYajuStage('deadstage');
}

function showYajuEndDialog({ eyebrow, title, text, buttons }){
  const ov = el('yajuEndOverlay');
  if(!ov) return;
  el('yajuEndEyebrow').textContent = eyebrow;
  el('yajuEndTitle').textContent = title;
  el('yajuEndText').innerHTML = text;

  const btnWrap = el('yajuEndButtons');
  btnWrap.innerHTML = '';
  for(const b of buttons){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = b.secondary ? 'action-btn secondary' : 'action-btn';
    btn.textContent = b.label;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.onClick();
    });
    btnWrap.appendChild(btn);
  }
  ov.classList.remove('hidden');
}

function finishDeadStageCaught(){
  if(yajuState.ended) return;
  yajuState.ended = true;
  yajuState.running = false;
  updateRocketUI();
  playCaptureVideoDirectly(() => {
    showYajuEndDialog({
      eyebrow: 'YAJUMAZE DEFEAT',
      title: 'DEAD CAUGHT',
      text: '無慈悲な死が訪れた…',
      buttons: [
        {
          label: 'ホームに戻る',
          onClick: () => {
            resetYajuState();
            if(yajuCallbacks.enterHome) yajuCallbacks.enterHome();
          }
        }
      ]
    });
  });
}

function triggerClearStage(bossName){
  if(yajuState.clearStageActive || yajuState.ended || yajuState.isTransitioningToDeadStage) return;
  yajuState.clearStageActive = true;
  yajuState.clearStageTimer = 0;
  yajuState.clearStageDeleted = false;
  yajuState.clearBossTitle = bossName;

  for(const p of yajuState.projectiles){
    if(p.mesh && state.scene) state.scene.remove(p.mesh);
  }
  yajuState.projectiles = [];

  if(state.scene){
    state.scene.background = new T.Color(0xffffff);
    state.scene.fog = new T.FogExp2(0xffffff, 0.01);
  }
}

function finishBossWin(bossName){
  if(yajuState.ended) return;
  yajuState.ended = true;
  yajuState.running = false;
  stopYarimasuneLoop();
  playYajuAudio('se-clear', 1.0);
  updateRocketUI();

  const mult = yajuState.bossDiff ? yajuState.bossDiff.atkMult : 1.0;
  const earnedCoins = Math.round(YAJU_REWARDS.BOSS_BASE_COINS * mult);
  state.yajuCoins = (state.yajuCoins || 0) + earnedCoins;
  saveGameData();

  showYajuEndDialog({
    eyebrow: 'BOSS STAGE CLEAR',
    title: 'BOSS DEFEATED!',
    text: `${bossName}（${yajuState.bossDiff.name}）を討伐した！<br>獲得YAJUコイン: <b>+${earnedCoins.toLocaleString()}枚</b>`,
    buttons: [
      {
        label: 'ホームに戻る',
        onClick: () => {
          resetYajuState();
          if(yajuCallbacks.enterHome) yajuCallbacks.enterHome();
        }
      }
    ]
  });
}

function finishYajuNormal(win){
  if(yajuState.ended) return;
  yajuState.ended = true;
  yajuState.running = false;
  stopYarimasuneLoop();
  updateRocketUI();

  if(win){
    playYajuAudio('se-clear', 1.0);
    if(yajuState.currentFloor < YAJU_CONFIG.maxFloors){
      showYajuEndDialog({
        eyebrow: 'YAJUMAZE',
        title: `${yajuState.currentFloor}F CLEARED!`,
        text: `第 ${yajuState.currentFloor} 階層を突破！次の階層へ進みます。`,
        buttons: [
          {
            label: '次の階層へ進む',
            onClick: () => {
              yajuState.currentFloor++;
              initYajuStage('normal');
              playYajuAudio('se-start', 1.0);
            }
          }
        ]
      });
    } else {
      const earned = YAJU_REWARDS.MAZE_CLEAR_COINS;
      state.yajuCoins = (state.yajuCoins || 0) + earned;
      saveGameData();

      showYajuEndDialog({
        eyebrow: 'YAJUMAZE COMPLETE',
        title: 'ALL CLEAR!!',
        text: `全5階層の迷路を完全脱出した！<br>獲得YAJUコイン: <b>+${earned.toLocaleString()}枚</b>`,
        buttons: [
          {
            label: 'ボス戦',
            onClick: () => {
              resetYajuState();
              if(yajuCallbacks.enterHome) yajuCallbacks.enterHome();
              if(yajuCallbacks.openBossSetup) yajuCallbacks.openBossSetup();
            }
          },
          {
            label: 'ホームに戻る',
            secondary: true,
            onClick: () => {
              resetYajuState();
              if(yajuCallbacks.enterHome) yajuCallbacks.enterHome();
            }
          }
        ]
      });
    }
  } else {
    playCaptureVideoDirectly(() => {
      showYajuEndDialog({
        eyebrow: 'YAJUMAZE',
        title: 'CAUGHT',
        text: `第 ${yajuState.currentFloor} 階層で追跡者に捕まった…`,
        buttons: [
          {
            label: '同じ階をやり直す',
            onClick: () => {
              initYajuStage('normal');
              playYajuAudio('se-restart', 1.0);
            }
          },
          {
            label: '1階からやり直す',
            secondary: true,
            onClick: () => {
              yajuState.currentFloor = 1;
              yajuState.hasRocketFromPreviousFloor = false;
              initYajuStage('normal');
              playYajuAudio('se-restart', 1.0);
            }
          },
          {
            label: 'ホームに戻る',
            secondary: true,
            onClick: () => {
              resetYajuState();
              if(yajuCallbacks.enterHome) yajuCallbacks.enterHome();
            }
          }
        ]
      });
    });
  }
}

function moveYajuPlayer(dt){
  if(yajuState.subMode === 'deadstage' || yajuState.clearStageActive || yajuState.isTransitioningToDeadStage){
    state.camera.position.copy(yajuState.playerPos);
    state.camera.rotation.order = 'YXZ';
    state.camera.rotation.y = state.yaw;
    state.camera.rotation.x = state.pitch;
    return;
  }

  if(yajuState.isDashing){
    yajuState.dashTimer -= dt;
    if(yajuState.dashTimer <= 0) yajuState.isDashing = false;
  }

  const cdPath = el('yajuDashCdPath');
  const dashBtn = el('yajuDashBtn');
  if(yajuState.dashCooldownTimer > 0){
    yajuState.dashCooldownTimer = Math.max(0, yajuState.dashCooldownTimer - dt);
    const prog = (YAJU_CONFIG.dashCooldown - yajuState.dashCooldownTimer) / YAJU_CONFIG.dashCooldown;
    if(cdPath) cdPath.setAttribute('stroke-dasharray', `${prog * 100}, 100`);
    if(dashBtn) dashBtn.disabled = true;
  } else {
    if(cdPath) cdPath.setAttribute('stroke-dasharray', '100, 100');
    if(dashBtn) dashBtn.disabled = false;
  }

  if(yajuState.isSlowed){
    yajuState.slowTimer -= dt;
    if(yajuState.slowTimer <= 0) yajuState.isSlowed = false;
  }

  let mx = (state.keys.KeyD || state.keys.ArrowRight ? 1 : 0) - (state.keys.KeyA || state.keys.ArrowLeft ? 1 : 0) + state.move.x;
  let mz = (state.keys.KeyS || state.keys.ArrowDown ? 1 : 0) - (state.keys.KeyW || state.keys.ArrowUp ? 1 : 0) + state.move.y;
  const len = Math.hypot(mx, mz);
  if(len > 1){ mx /= len; mz /= len; }
  const isMoving = len > 0.05;

  let currentSpeed = YAJU_CONFIG.walkSpeed;
  if(yajuState.isDashing){
    currentSpeed = YAJU_CONFIG.dashSpeed;
  } else if(yajuState.subMode.startsWith('boss')){
    currentSpeed = YAJU_CONFIG.runSpeed;
  } else {
    const isRunning = (state.keys.ShiftLeft || state.keys.ShiftRight || yajuState.sprintHeld) && isMoving && yajuState.stamina > 0;
    if(isRunning){
      yajuState.stamina = Math.max(0, yajuState.stamina - YAJU_CONFIG.staminaUsePerSecond * dt);
      currentSpeed = YAJU_CONFIG.runSpeed;
    } else {
      yajuState.stamina = Math.min(YAJU_CONFIG.maxStamina, yajuState.stamina + YAJU_CONFIG.staminaRegenPerSecond * dt);
    }
  }

  if(yajuState.isSlowed) currentSpeed /= 2.0;

  if(yajuState.subMode === 'normal'){
    const sFill = el('yajuStaminaFill');
    const sText = el('yajuStaminaText');
    if(sFill) sFill.style.width = `${(yajuState.stamina / YAJU_CONFIG.maxStamina) * 100}%`;
    if(sText) sText.textContent = `${Math.ceil(yajuState.stamina)} / ${YAJU_CONFIG.maxStamina}`;
  } else {
    const hFill = el('yajuHpFill');
    const hText = el('yajuHpText');
    if(hFill) hFill.style.width = `${(yajuState.playerHp / YAJU_CONFIG.playerMaxHp) * 100}%`;
    if(hText) hText.textContent = `${Math.ceil(yajuState.playerHp)} / ${YAJU_CONFIG.playerMaxHp}`;
  }

  const s = Math.sin(state.yaw);
  const c = Math.cos(state.yaw);
  const dx = (mx * c + mz * s) * currentSpeed * dt;
  const dz = (mz * c - mx * s) * currentSpeed * dt;

  const nx = yajuState.playerPos.x + dx;
  const nz = yajuState.playerPos.z + dz;
  const currentMaze = yajuState.maze || Array.from({ length: 10 }, () => Array(10).fill(0));

  if(canStand(nx, yajuState.playerPos.z, YAJU_CONFIG.playerRadius, currentMaze) && !collidesWithWorldEnemy(nx, yajuState.playerPos.z, YAJU_CONFIG.playerRadius)){
    yajuState.playerPos.x = nx;
  }
  if(canStand(yajuState.playerPos.x, nz, YAJU_CONFIG.playerRadius, currentMaze) && !collidesWithWorldEnemy(yajuState.playerPos.x, nz, YAJU_CONFIG.playerRadius)){
    yajuState.playerPos.z = nz;
  }

  let currentStepHeight = 0;
  for(const elObj of yajuState.elevationsList){
    if(Math.abs(yajuState.playerPos.x - elObj.position.x) < YAJU_CONFIG.cellSize * 0.5 &&
       Math.abs(yajuState.playerPos.z - elObj.position.z) < YAJU_CONFIG.cellSize * 0.5){
      currentStepHeight = Math.max(currentStepHeight, elObj.height);
    }
  }
  for(const t of yajuState.trapsList){
    if(t.active && Math.abs(yajuState.playerPos.x - t.position.x) < YAJU_CONFIG.cellSize * 0.5 &&
       Math.abs(yajuState.playerPos.z - t.position.z) < YAJU_CONFIG.cellSize * 0.5){
      currentStepHeight = Math.max(currentStepHeight, t.height);
      if(!yajuState.isSlowed){
        yajuState.isSlowed = true;
        yajuState.slowTimer = YAJU_CONFIG.trapSlowDuration;
        showYajuMessage('トラップにかかった！(3秒間移動速度1/2)');
      }
    }
  }

  yajuState.playerPos.y = 1.4 + currentStepHeight;
  state.x = yajuState.playerPos.x;
  state.y = yajuState.playerPos.y;
  state.z = yajuState.playerPos.z;
  state.camera.position.copy(yajuState.playerPos);
  state.camera.rotation.order = 'YXZ';
  state.camera.rotation.y = state.yaw;
  state.camera.rotation.x = state.pitch;
}

function fireWorldEnemyBlueOrb(originPos){
  const projectileMesh = new T.Mesh(
    new T.SphereGeometry(0.45, 10, 10),
    new T.MeshBasicMaterial({ color: 0x0088ff })
  );
  const startPos = new T.Vector3(originPos.x, 1.5, originPos.z);
  const targetPos = new T.Vector3(yajuState.playerPos.x, 1.4, yajuState.playerPos.z);
  const dir = targetPos.sub(startPos).normalize();
  projectileMesh.position.copy(startPos).addScaledVector(dir, 2.5);
  state.scene.add(projectileMesh);

  yajuState.projectiles.push({
    mesh: projectileMesh,
    direction: dir,
    speed: YAJU_CONFIG.projectileSpeed,
    life: 5.0,
    isEnemyProjectile: true
  });
}

function moveYajuEnemies(dt){
  if(yajuState.clearStageActive || yajuState.isTransitioningToDeadStage) return;

  if(yajuState.subMode === 'deadstage'){
    yajuState.deadStageTimer -= dt;
    const prog = 1.0 - T.MathUtils.clamp(yajuState.deadStageTimer / 6.0, 0, 1.0);
    const spiralAngularSpeed = Math.PI * 2;
    for(const eObj of yajuState.enemies){
      const currentDist = eObj.startDist * (1.0 - prog);
      const currentAngle = eObj.angle + spiralAngularSpeed * (6.0 - yajuState.deadStageTimer);
      eObj.group.position.set(Math.cos(currentAngle) * currentDist, 0, Math.sin(currentAngle) * currentDist);
    }
    if(yajuState.deadStageTimer <= 0){
      finishDeadStageCaught();
    }
    return;
  }

  const atkMult = yajuState.bossDiff ? yajuState.bossDiff.atkMult : 1.0;

  for(const eObj of yajuState.enemies){
    if(eObj.state === 'defeated') continue;

    if(eObj.state === 'booming'){
      eObj.repathTimer -= dt;
      if(eObj.repathTimer <= 0){
        eObj.state = 'defeated';
        eObj.group.visible = false;
        if(eObj.isBeastKing && eObj.hp <= 0){
          triggerClearStage('獣王');
          return;
        }
        if(eObj.isWorldEnemy && eObj.hp <= 0){
          triggerClearStage('World Enemy');
          return;
        }
      }
      continue;
    }

    if(eObj.isWorldEnemy){
      eObj.group.position.set(0, 0, 0);
      eObj.shootTimer -= dt;
      if(eObj.shootTimer <= 0){
        eObj.shootTimer = 3.0;
        fireWorldEnemyBlueOrb(eObj.group.position);
      }

      eObj.spawnMinionTimer -= dt;
      if(eObj.spawnMinionTimer <= 0){
        eObj.spawnMinionTimer = 10.0;
        eObj.spinTimer = 2.0;
        const baseId = yajuState.enemies.length;
        spawnNormalChaserAt(0, 0, baseId, true);
        spawnNormalChaserAt(0, 0, baseId + 1, true);
        showYajuMessage('World Enemyが家臣を2体産出した！');
      }

      if(eObj.spinTimer > 0){
        eObj.spinTimer -= dt;
        eObj.group.rotation.y -= (240 / 60) * Math.PI * 2 * dt;
      }

      const half = eObj.halfExtent + YAJU_CONFIG.playerRadius + 0.2;
      if(Math.abs(yajuState.playerPos.x) <= half && Math.abs(yajuState.playerPos.z) <= half){
        if(yajuState.isDashing && !eObj.dashHitCooldown){
          eObj.dashHitCooldown = true;
          eObj.hp = Math.max(0, eObj.hp - 15);
          updateBossHpUI(eObj);
          playYajuAudio('se-boom', 1.0);
          showYajuMessage(`World Enemyに突進ヒット！(-15 HP, 残りHP: ${Math.ceil(eObj.hp)})`);
          if(eObj.hp <= 0){
            triggerClearStage('World Enemy');
            return;
          }
        } else if(!yajuState.isDashing){
          eObj.attackCooldown = Math.max(0, (eObj.attackCooldown || 0) - dt);
          if(eObj.attackCooldown <= 0){
            eObj.attackCooldown = 1.5;
            const dmg = 4 * atkMult;
            damagePlayer(dmg, `World Enemyに触れてダメージを受けた！(-${dmg} HP)`);
            if(yajuState.isTransitioningToDeadStage || yajuState.subMode === 'deadstage') return;
          }
        }
      }
      if(!yajuState.isDashing) eObj.dashHitCooldown = false;
      continue;
    }

    if(eObj.isBeastKing){
      eObj.bossDashTimer += dt;
      if(!eObj.bossDashActive && eObj.bossDashTimer >= 10.0){
        eObj.bossDashActive = true;
        eObj.bossDashTimer = 0;
        showYajuMessage('獣王が突進してきた！！');
      } else if(eObj.bossDashActive && eObj.bossDashTimer >= 2.0){
        eObj.bossDashActive = false;
        eObj.bossDashTimer = 0;
      }

      const speed = eObj.bossDashActive ? 10.0 : 5.0;
      const dx = yajuState.playerPos.x - eObj.group.position.x;
      const dz = yajuState.playerPos.z - eObj.group.position.z;
      const len = Math.hypot(dx, dz);

      if(len > 0.1){
        eObj.group.position.x += (dx / len) * speed * dt;
        eObj.group.position.z += (dz / len) * speed * dt;
        eObj.group.rotation.y = Math.atan2(dx, dz);
      }
      eObj.group.position.y = getElevationHeightAt(eObj.group.position.x, eObj.group.position.z, [...yajuState.elevationsList, ...yajuState.trapsList]);

      if(eObj.bossDashActive){
        if(len < 3.0 && !eObj.hasDamagedThisDash){
          eObj.hasDamagedThisDash = true;
          const dmg = 5 * atkMult;
          damagePlayer(dmg, `獣王の突進を喰らった！(-${dmg} HP)`);
          if(yajuState.isTransitioningToDeadStage || yajuState.subMode === 'deadstage') return;
        }
      } else {
        eObj.hasDamagedThisDash = false;
      }

      eObj.attackCooldown = Math.max(0, eObj.attackCooldown - dt);
      if(len < YAJU_CONFIG.enemyCatchDistance && eObj.attackCooldown <= 0){
        eObj.attackCooldown = 1.5;
        const dmg = 4 * atkMult;
        damagePlayer(dmg, `獣王の攻撃を受けた！(-${dmg} HP)`);
        if(yajuState.isTransitioningToDeadStage || yajuState.subMode === 'deadstage') return;
      }
      continue;
    }

    const currentMaze = yajuState.maze || Array.from({ length: 10 }, () => Array(10).fill(0));
    const canSee = lineOfSight(eObj.group.position, yajuState.playerPos, currentMaze);
    const distToPlayer = Math.hypot(yajuState.playerPos.x - eObj.group.position.x, yajuState.playerPos.z - eObj.group.position.z);

    if(eObj.isBossMinion || (canSee && distToPlayer <= YAJU_CONFIG.enemyDetectDistance)){
      eObj.state = 'chase';
    }

    let targetWorldPos = null;
    if(eObj.state === 'chase'){
      targetWorldPos = yajuState.playerPos;
    } else {
      if(!eObj.target || Math.hypot(eObj.group.position.x - eObj.target.x, eObj.group.position.z - eObj.target.z) < 1.5){
        const sz = currentMaze.length;
        const rx = 1 + Math.floor(Math.random() * (sz - 2));
        const rz = 1 + Math.floor(Math.random() * (sz - 2));
        eObj.target = cellWorld(rx, rz, sz);
      }
      targetWorldPos = eObj.target;
    }

    if(targetWorldPos){
      eObj.repathTimer -= dt;
      if(eObj.repathTimer <= 0 || !eObj.path || eObj.path.length === 0){
        eObj.repathTimer = YAJU_CONFIG.enemyRepathInterval;
        eObj.path = findPathAStar(eObj.group.position, targetWorldPos, currentMaze, yajuState.elevationsList);
        eObj.pathIndex = 0;
      }

      let wp = eObj.path[eObj.pathIndex] || targetWorldPos;
      const wpDist = Math.hypot(wp.x - eObj.group.position.x, wp.z - eObj.group.position.z);
      if(wpDist < 0.6 && eObj.pathIndex < eObj.path.length - 1){
        eObj.pathIndex++;
        wp = eObj.path[eObj.pathIndex];
      }

      const moveSpeed = eObj.state === 'chase' ? YAJU_CONFIG.enemyChaseSpeed : YAJU_CONFIG.enemyWalkSpeed;
      const dx = wp.x - eObj.group.position.x;
      const dz = wp.z - eObj.group.position.z;
      const len = Math.hypot(dx, dz);
      if(len > 0.05){
        const dirX = dx / len;
        const dirZ = dz / len;
        const nextX = eObj.group.position.x + dirX * moveSpeed * dt;
        const nextZ = eObj.group.position.z + dirZ * moveSpeed * dt;

        if(canStand(nextX, eObj.group.position.z, YAJU_CONFIG.enemyRadius, currentMaze, yajuState.elevationsList, eObj.isBossMinion)){
          eObj.group.position.x = nextX;
        }
        if(canStand(eObj.group.position.x, nextZ, YAJU_CONFIG.enemyRadius, currentMaze, yajuState.elevationsList, eObj.isBossMinion)){
          eObj.group.position.z = nextZ;
        }
        eObj.group.position.y = getElevationHeightAt(eObj.group.position.x, eObj.group.position.z, [...yajuState.elevationsList, ...yajuState.trapsList]);
        eObj.group.rotation.y = Math.atan2(dirX, dirZ);
      }
    }

    if(distToPlayer < YAJU_CONFIG.enemyCatchDistance){
      if(yajuState.isDashing){
        eObj.state = 'booming';
        eObj.repathTimer = 1.0;
        if(enemyTextureBoom && eObj.planeMesh){
          eObj.planeMesh.material = createEnemyMaterial(enemyTextureBoom);
        }
        playYajuAudio('se-boom', 1.0);
        showYajuMessage('突進撃破！！');
      } else if(eObj.isBossMinion || yajuState.subMode.startsWith('boss')){
        eObj.attackCooldown = (eObj.attackCooldown || 0) - dt;
        if(eObj.attackCooldown <= 0){
          eObj.attackCooldown = 2.0;
          const dmg = 4 * atkMult;
          damagePlayer(dmg, `追跡者にダメージを受けた！(-${dmg} HP)`);
          if(yajuState.isTransitioningToDeadStage || yajuState.subMode === 'deadstage') return;
        }
      } else if(yajuState.invulnerableTimer <= 0){
        finishYajuNormal(false);
        return;
      }
    }
  }
}

function updateYajuProjectiles(dt){
  if(yajuState.clearStageActive || yajuState.isTransitioningToDeadStage) return;
  const atkMult = yajuState.bossDiff ? yajuState.bossDiff.atkMult : 1.0;

  for(let i = yajuState.projectiles.length - 1; i >= 0; i--){
    const p = yajuState.projectiles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.direction, p.speed * dt);

    const currentMaze = yajuState.maze || Array.from({ length: 10 }, () => Array(10).fill(0));
    if(isWallAt(p.mesh.position.x, p.mesh.position.z, currentMaze) || p.life <= 0){
      state.scene.remove(p.mesh);
      yajuState.projectiles.splice(i, 1);
      continue;
    }

    if(p.isEnemyProjectile){
      const distToPlayer = Math.hypot(p.mesh.position.x - yajuState.playerPos.x, p.mesh.position.z - yajuState.playerPos.z);
      if(distToPlayer <= 1.2){
        state.scene.remove(p.mesh);
        yajuState.projectiles.splice(i, 1);
        if(!yajuState.isDashing){
          playYajuAudio('se-boom', 0.8);
          const dmg = 4 * atkMult;
          damagePlayer(dmg, `World Enemyの青色弾頭に被弾！(-${dmg} HP)`);
          if(yajuState.isTransitioningToDeadStage || yajuState.subMode === 'deadstage') return;
        }
      }
      continue;
    }

    for(const eObj of yajuState.enemies){
      if(eObj.state !== 'defeated' && eObj.state !== 'booming' && eObj.group.visible){
        let hit = false;
        if(eObj.isWorldEnemy){
          const half = eObj.halfExtent + 0.6;
          if(Math.abs(p.mesh.position.x - eObj.group.position.x) <= half &&
             Math.abs(p.mesh.position.z - eObj.group.position.z) <= half){
            hit = true;
          }
        } else if(Math.hypot(p.mesh.position.x - eObj.group.position.x, p.mesh.position.z - eObj.group.position.z) <= YAJU_CONFIG.projectileHitRadius){
          hit = true;
        }

        if(hit){
          if(eObj.isBeastKing || eObj.isWorldEnemy){
            const dmg = 20;
            eObj.hp = Math.max(0, eObj.hp - dmg);
            updateBossHpUI(eObj);
            playYajuAudio('se-boom', 1.0);
            const bossLabel = eObj.isWorldEnemy ? 'World Enemy' : '獣王';
            showYajuMessage(`${bossLabel}にロケット命中！(-${dmg} HP, 残りHP: ${Math.ceil(eObj.hp)})`);
            state.scene.remove(p.mesh);
            yajuState.projectiles.splice(i, 1);
            if(eObj.hp <= 0){
              triggerClearStage(bossLabel);
              return;
            }
            break;
          } else {
            eObj.state = 'booming';
            eObj.repathTimer = 1.0;
            if(enemyTextureBoom && eObj.planeMesh){
              eObj.planeMesh.material = createEnemyMaterial(enemyTextureBoom);
            }
            playYajuAudio('se-boom', 1.0);
            state.scene.remove(p.mesh);
            yajuState.projectiles.splice(i, 1);
            break;
          }
        }
      }
    }
  }
}

const camWorldPos = new T.Vector3();
const camWorldDir = new T.Vector3();
const tmpVec3 = new T.Vector3();

function updateOcclusionAndRockets(){
  if(yajuState.subMode === 'deadstage' || yajuState.clearStageActive || yajuState.isTransitioningToDeadStage) return;
  state.camera.getWorldPosition(camWorldPos);
  state.camera.getWorldDirection(camWorldDir);

  for(const item of yajuState.pointLightsList){
    const toLight = tmpVec3.subVectors(item.position, camWorldPos);
    const dist = toLight.length();
    const dot = camWorldDir.dot(toLight.normalize());
    if(dist <= YAJU_CONFIG.lightDrawDistance && dot > -0.2){
      item.light.intensity = item.baseIntensity * (1.0 - dist / YAJU_CONFIG.lightDrawDistance);
      item.lampMesh.visible = true;
    } else {
      item.light.intensity = 0;
      item.lampMesh.visible = false;
    }
  }

  for(const item of yajuState.mapRocketItems){
    if(item.active && item.mesh){
      item.mesh.lookAt(state.camera.position.x, item.mesh.position.y, state.camera.position.z);
      const dist = Math.hypot(yajuState.playerPos.x - item.mesh.position.x, yajuState.playerPos.z - item.mesh.position.z);
      if(dist <= YAJU_CONFIG.rocketHitRadius && (yajuState.subMode.startsWith('boss') || yajuState.rocketAmmo < YAJU_CONFIG.maxRocketAmmo)){
        item.active = false;
        state.scene.remove(item.mesh);
        if(item.light) state.scene.remove(item.light);
        if(yajuState.subMode.startsWith('boss')){
          yajuState.rocketAmmo++;
        } else {
          yajuState.rocketAmmo = YAJU_CONFIG.maxRocketAmmo;
          yajuState.hasRocketFromPreviousFloor = true;
        }
        updateRocketUI();
        showYajuMessage(`ロケットを入手した！（弾数${yajuState.rocketAmmo}発）`);
      }
    }
  }
}

function updateCompasses(){
  if(yajuState.ended || !yajuState.settings.compass || yajuState.subMode.startsWith('boss') || yajuState.subMode === 'deadstage') return;
  if(yajuState.goalMesh){
    const exitDx = yajuState.goalMesh.position.x - yajuState.playerPos.x;
    const exitDz = yajuState.goalMesh.position.z - yajuState.playerPos.z;
    const distEl = el('yajuExitDistance');
    const needleEl = el('yajuExitNeedle');
    if(distEl) distEl.textContent = Math.floor(Math.hypot(exitDx, exitDz)) + 'm';
    const exitAngle = Math.atan2(-exitDx, -exitDz) - state.yaw;
    if(needleEl) needleEl.style.transform = `translateX(-50%) rotate(${-exitAngle}rad)`;
  }

  let nearestDist = Infinity;
  for(let i = 0; i < yajuState.enemies.length; i++){
    const eObj = yajuState.enemies[i];
    const needle = el(`yaju-radar-needle-${i}`);
    if(!needle) continue;
    if(eObj.state === 'defeated'){
      needle.style.display = 'none';
      continue;
    }
    needle.style.display = 'block';
    const yajuDx = eObj.group.position.x - yajuState.playerPos.x;
    const yajuDz = eObj.group.position.z - yajuState.playerPos.z;
    const dist = Math.hypot(yajuDx, yajuDz);
    if(dist < nearestDist) nearestDist = dist;
    const yajuAngle = Math.atan2(-yajuDx, -yajuDz) - state.yaw;
    needle.style.transform = `translateX(-50%) rotate(${-yajuAngle}rad)`;
  }

  const radarEl = el('yajuRadar');
  if(radarEl){
    if(nearestDist <= YAJU_CONFIG.radarYellowDist) radarEl.style.borderColor = '#ff4444';
    else if(nearestDist <= YAJU_CONFIG.radarGreenDist) radarEl.style.borderColor = '#ffdd44';
    else radarEl.style.borderColor = '#82c78c';
  }
}

export function updateYajuMazeMode(dt){
  if(!yajuState.active || !yajuState.running || yajuState.ended || yajuState.isTransitioningToDeadStage) return;

  if(yajuState.clearStageActive){
    yajuState.clearStageTimer += dt;
    const prog = T.MathUtils.clamp(yajuState.clearStageTimer / 3.0, 0, 1);
    if(state.scene){
      state.scene.background = new T.Color(0xffffff);
      state.scene.fog = new T.FogExp2(0xffffff, 0.01 + Math.pow(prog, 2) * 2.5);
    }
    if(!yajuState.clearStageDeleted && prog >= 0.45){
      yajuState.clearStageDeleted = true;
      clearStageObjects();
    }
    if(yajuState.clearStageTimer >= 3.0){
      yajuState.clearStageActive = false;
      finishBossWin(yajuState.clearBossTitle);
    }
    return;
  }

  if(yajuState.invulnerableTimer > 0){
    yajuState.invulnerableTimer -= dt;
    if(yajuState.invulnerableTimer <= 0) showYajuMessage('無敵時間が終了した');
  }

  moveYajuPlayer(dt);
  moveYajuEnemies(dt);
  updateYajuProjectiles(dt);
  updateOcclusionAndRockets();

  for(const eObj of yajuState.enemies){
    if(eObj.planeMesh && eObj.state !== 'defeated'){
      eObj.planeMesh.lookAt(state.camera.position.x, eObj.group.position.y + (eObj.isBeastKing ? 2.0 : 1.0), state.camera.position.z);
    }
  }

  updateCompasses();

  if(yajuState.subMode === 'normal' && yajuState.goalMesh &&
     Math.hypot(yajuState.playerPos.x - yajuState.goalMesh.position.x, yajuState.playerPos.z - yajuState.goalMesh.position.z) < 1.35){
    finishYajuNormal(true);
  }
}
