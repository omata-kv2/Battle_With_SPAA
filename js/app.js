import * as T from './libs/three.module.js';
import { CONFIG } from './config.js';
import { state, getEquippedSkin, getDifficultyById, loadGameData, saveGameData, resetMatchInventoryUsage, addFriendByCode, importSaveCode, onPlayerLevelUp } from './state.js';
import {
  $, progress, loading, loadError, hideStartScreen, showEndScreen, hideEndScreen,
  setModeUI, showToast, updateHoldGauge, resetWhiteFade, initInventoryBar, updateInventoryBar, updatePlayerPlate, updateTestDpsUI, updateCameraToggleButton
} from './ui.js';
import { initInputControls, resetMovementInputs } from './controls.js';
import {
  closeAllModals, openCoopModal, openBattleSetupModal, renderBattleSetupModal,
  openSkinSelectModal, confirmSkinSelection, openUpgradeModal, openSkinStoreModal,
  openYajuSetupModal, openYajuBossSetupModal, openYajuIpadWarnModal, switchStoreTab,
  openTransferChoiceModal, openTransferImportModal, renderCoopFriendsList, openPlayWarsSetupModal
} from './modals.js';
import { resetCombatState, updateCombatSystem, initLaserTurretDeployState } from './player.js';
import { useInventoryItem } from './items.js';
import { initGlobalSfx, playSfx } from './sfx.js';
import { initPdaEvents, bindPdaCallbacks } from './pda.js';
import { buildTestRoomWorld } from './map-test.js';
import { clearEnemiesAndFx, updateEnemiesAndWave } from './enemies.js';
import { initFallMissileMode, updateFallMissileMode } from './mode-fall-missile.js';
import { resetYajuState, updateYajuMazeMode, startYajuNormalMode, startYajuBossMode, bindYajuCallbacks } from './mode-yaju-maze.js';
import { initPlayWarsMode, updatePlayWarsMode, canStandPlayWars, PLAY_WARS_LIMIT, pwState } from './mode-play-wars.js';
import { EXPERIMENTAL_3D_SKINS } from './vehicles/VehicleConfig.js';
import { loadVehicleAssets } from './vehicles/VehicleLoader.js';
import { createVehicleController } from './vehicles/VehicleController.js';
import { buildHomeWorld } from './map-home.js';
import { buildSkinWorld } from './map-skin.js';
import { buildWorld, normalizeModel } from './map-fall-missile.js';
import {
  coopState, bindMultiplayerCallbacks, resetCoopMatchFlags, sendCoop, getCoopContext,
  initiateCoopBattleRequest, cancelOutgoingBattleInvite, respondToBattleInvite,
  clearRemoteVisuals, createRemotePlayerMesh,
  syncCoopFrame, ensureLobbyInitialized,
  sendGlobalChatMessage, publishCoopRecruit, cancelMyCoopRecruit,
  leaveCoopRoom, createCoopRoom, joinCoopRoom
} from './multiplayer.js';

function resize(){
  if(!state.renderer || !state.camera) return;
  const w = innerWidth, h = innerHeight;
  state.renderer.setSize(w, h, false);
  state.camera.aspect = w / h;
  state.camera.updateProjectionMatrix();
}

async function syncPlayerVehicleMesh(){
  if(!state.scene) return;
  if(state.playerVehicle && state.playerVehicle.root){
    state.scene.remove(state.playerVehicle.root);
    state.playerVehicle = null;
  }
  const skinId = state.selectedSkinId || 'Origin';
  if(!EXPERIMENTAL_3D_SKINS.has(skinId)) return;

  try{
    const assets = await loadVehicleAssets(state.vehicleLoader, skinId);
    if(!state.scene || state.selectedSkinId !== skinId) return;
    const vehicle = createVehicleController(assets);
    vehicle.setHullYaw(state.yaw);
    state.scene.add(vehicle.root);
    state.playerVehicle = vehicle;
    vehicle.update({
      dt: 0.016,
      x: state.x,
      y: -2.0 + (state.activeBattleMode === 'PLAY_WARS' ? (state.y || 0) : 0),
      z: state.z,
      moveDx: 0,
      moveDz: 0,
      cameraYaw: state.yaw,
      cameraPitch: state.pitch,
      visible: state.cameraMode === 'third'
    });
  }catch(e){
    console.warn('3D機体ロードエラー:', e);
  }
}

function clearScene(){
  if(!state.scene) return;
  if(state.skinController && typeof state.skinController.dispose === 'function'){
    state.skinController.dispose();
    state.skinController = null;
  }
  clearEnemiesAndFx();
  resetCombatState();
  while(state.scene.children.length > 0){
    state.scene.remove(state.scene.children[0]);
  }
  state.target = null;
  state.playerVehicle = null;
  state.homeController = null;
  state.skinController = null;
  state.testController = null;
  clearRemoteVisuals();
}

export function enterHome(){
  resetMovementInputs();
  resetWhiteFade();
  hideEndScreen();
  closeAllModals();

  resetYajuState();
  resetMatchInventoryUsage();
  updateInventoryBar();
  if(state.renderer){
    state.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, CONFIG.MAX_PIXEL_RATIO));
    resize();
  }
  // バトル用のキャッシュ・状態・ソロ一時切替フラグを完全クリア
  coopState.battleSoloOverride = false;
  resetCoopMatchFlags();
  state.score = 0;
  state.earnedGoldInMatch = 0;
  state.wave = 1;
  state.peace = 100;
  state.spawned = 0;
  state.tick = 0;
  state.wait = 0;

  state.gameMode = 'home';
  state.activeBattleMode = 'FALL_MISSILE';
  state.x = 0;
  state.y = 0;
  state.vy = 0;
  state.z = 9;
  state.yaw = 0;
  state.pitch = -0.05;
  state.triggerCooldown = 35;
  state.panelHoldTime = 0;
  state.portalHoldTime = 0;
  state.portalHoldTarget = null;
  state.testDpsHistory = [];
  updateTestDpsUI(0);
  updateHoldGauge(0);

  clearScene();
  state.homeController = buildHomeWorld(T, state.scene, state.gold, state.yajuCoins);

  if(coopState.isCoop){
    createRemotePlayerMesh();
  }

  setModeUI('home', getEquippedSkin(), coopState.isCoop, coopState.isHost);
  syncPlayerVehicleMesh();
  ensureLobbyInitialized();
}

export function enterTestRoom(){
  resetMovementInputs();
  resetWhiteFade();
  hideEndScreen();
  closeAllModals();
  state.gameMode = 'test';
  state.x = 0;
  state.y = 0;
  state.vy = 0;
  state.z = 8;
  state.yaw = 0;
  state.pitch = -0.04;
  state.triggerCooldown = 35;
  state.panelHoldTime = 0;
  state.portalHoldTime = 0;
  state.portalHoldTarget = null;
  state.testDpsHistory = [];
  updateTestDpsUI(0);
  updateHoldGauge(0);

  clearScene();
  state.testController = buildTestRoomWorld(T, state.scene);
  const eqSkin = getEquippedSkin();
  setModeUI('test', eqSkin, coopState.isCoop, coopState.isHost);
  syncPlayerVehicleMesh();
  if(eqSkin.attackType === 'laser'){
    initLaserTurretDeployState(state.skinUpgrades[eqSkin.id]?.laserTurretCount || 1);
  }
}

export function enterSkinRoom(){
  resetMovementInputs();
  resetWhiteFade();
  hideEndScreen();
  closeAllModals();
  state.gameMode = 'skin';
  state.x = 0;
  state.y = 0;
  state.vy = 0;
  state.z = 11;
  state.yaw = 0;
  state.pitch = -0.04;
  state.triggerCooldown = 35;
  state.panelHoldTime = 0;
  state.portalHoldTime = 0;
  state.portalHoldTarget = null;
  state.testDpsHistory = [];
  updateTestDpsUI(0);
  updateHoldGauge(0);

  clearScene();
  state.skinController = buildSkinWorld(T, state.scene, state.unlockedSkins, state.selectedSkinId, state.vehicleLoader);
  setModeUI('skin', getEquippedSkin(), coopState.isCoop, coopState.isHost);
  syncPlayerVehicleMesh();
}

export function startBattle(mode = 'FALL_MISSILE', diffId = 'easy', missionData = null){
  // 2回目以降の開始および「もう一度リトライ」時に確実に終了画面と全モーダルを閉じる
  resetMovementInputs();
  resetWhiteFade();
  hideEndScreen();
  closeAllModals();

  // 前回ゲームのキャッシュ・スコア・敵・状態フラグを徹底クリア
  resetCoopMatchFlags();
  state.score = 0;
  state.earnedGoldInMatch = 0;
  state.wave = 1;
  state.peace = 100;
  state.spawned = 0;
  state.tick = 0;
  state.wait = 0;
  state.panelHoldTime = 0;
  state.portalHoldTime = 0;
  state.portalHoldTarget = null;
  state.testDpsHistory = [];
  state.triggerCooldown = 0;
  updateHoldGauge(0);
  resetMatchInventoryUsage();
  updateInventoryBar();

  state.gameMode = 'battle';
  state.activeBattleMode = mode;
  state.activeDifficulty = getDifficultyById(diffId);

  clearScene();

  const effectiveCtx = getCoopContext();

  if(mode === 'YAJU_MAZE'){
    startYajuNormalMode(missionData?.yajuSettings || { compass: true, progressiveEnemies: true });
    if(effectiveCtx.isCoop){
      createRemotePlayerMesh();
    }
    return;
  }

  if(mode === 'YAJU_BOSS'){
    startYajuBossMode(missionData?.bossId || 'boss_world_enemy', diffId || 'easy');
    if(effectiveCtx.isCoop){
      createRemotePlayerMesh();
    }
    return;
  }

  if(mode === 'PLAY_WARS'){
    if(effectiveCtx.isCoop && !effectiveCtx.isHost && state.selectedPlayWarsGuestSkinId){
      state.selectedPlayWarsSkinId = state.selectedPlayWarsGuestSkinId;
    }
    initPlayWarsMode(diffId || 'easy', missionData, effectiveCtx);
    if(effectiveCtx.isCoop){
      createRemotePlayerMesh();
    }
    syncPlayerVehicleMesh();
    return;
  }

  initFallMissileMode((dObj) => {
    state.target = buildWorld(T, state.scene, dObj);
  }, effectiveCtx);
  if(effectiveCtx.isCoop){
    createRemotePlayerMesh();
  }
  syncPlayerVehicleMesh();
}

export function finishBattle(win){
  if(state.gameMode === 'end') return;
  resetMovementInputs();
  resetWhiteFade();
  clearEnemiesAndFx();
  resetCombatState();
  state.gameMode = 'end';
  const finalGoldEarned = state.beastGodActive ? state.earnedGoldInMatch * 2 : state.earnedGoldInMatch;
  state.earnedGoldInMatch = finalGoldEarned;
  state.gold += finalGoldEarned;
  saveGameData();

  const effectiveCtx = getCoopContext();
  let detail = '';

  // バトル終了後、ソロ一時切替フラグを元に戻す
  coopState.battleSoloOverride = false;
  resetCoopMatchFlags();

  if(win) playSfx('spaa_clear', 0.85);
  showEndScreen(win, state.score, state.earnedGoldInMatch, effectiveCtx.isCoop, detail);
}

// マルチプレイ用コールバックをバインド
bindMultiplayerCallbacks({
  startBattle,
  enterHome,
  finishBattle
});

bindYajuCallbacks({
  enterHome,
  openBossSetup: openYajuBossSetupModal
});

bindPdaCallbacks({
  enterTestRoom
});

async function resolveGLTFLoaderClass(){
  try{
    const mod = await import('./libs/GLTFLoader.js');
    if(mod && mod.GLTFLoader) return mod.GLTFLoader;
  }catch(_e){}

  try{
    const threeAbs = new URL('./libs/three.module.js', import.meta.url).href;
    let bufBlobUrl = null;
    try{
      const bufRes = await fetch('./js/libs/BufferGeometryUtils.js', { cache: 'no-store' });
      if(bufRes.ok){
        let bufCode = await bufRes.text();
        bufCode = bufCode.replace(/from\s+['"][^'"]*three\.module\.js['"]/g, `from "${threeAbs}"`);
        bufCode = bufCode.replace(/from\s+['"]three['"]/g, `from "${threeAbs}"`);
        bufBlobUrl = URL.createObjectURL(new Blob([bufCode], { type: 'application/javascript' }));
      }
    }catch(_eb){}

    const res = await fetch('./js/libs/GLTFLoader.js', { cache: 'no-store' });
    if(res.ok){
      let code = await res.text();
      if(/export\s+(class|{|\*)/.test(code)){
        code = code.replace(/from\s+['"][^'"]*three\.module\.js['"]/g, `from "${threeAbs}"`);
        code = code.replace(/from\s+['"]three['"]/g, `from "${threeAbs}"`);
        if(bufBlobUrl){
          code = code.replace(/from\s+['"][^'"]*BufferGeometryUtils\.js['"]/g, `from "${bufBlobUrl}"`);
        }
        const blobUrl = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
        try{
          const mod2 = await import(blobUrl);
          if(mod2 && mod2.GLTFLoader) return mod2.GLTFLoader;
        }finally{
          URL.revokeObjectURL(blobUrl);
          if(bufBlobUrl) URL.revokeObjectURL(bufBlobUrl);
        }
      } else {
        if(bufBlobUrl) URL.revokeObjectURL(bufBlobUrl);
        globalThis.THREE = globalThis.THREE || { ...T };
        await new Promise((resolve, reject) => {
          const sc = document.createElement('script');
          sc.src = './js/libs/GLTFLoader.js';
          sc.onload = resolve;
          sc.onerror = reject;
          document.head.appendChild(sc);
        });
        if(globalThis.THREE && globalThis.THREE.GLTFLoader) return globalThis.THREE.GLTFLoader;
      }
    }
  }catch(_e2){}
  return null;
}

async function load3DAssets(){
  try{
    const LoaderCls = await resolveGLTFLoaderClass();
    if(!LoaderCls) throw new Error('GLTFLoaderを読み込めませんでした');
    const loader = new LoaderCls();
    state.vehicleLoader = loader;
    progress(32, 'Kh-35 ミサイルモデル読み込み中...');
    const mGltf = await loader.loadAsync('./assets/Kh-35.glb');
    state.modelTemplates.missile = normalizeModel(
      T,
      mGltf.scene,
      2.6,
      new T.Vector3(0, -1, 0),
      new T.Vector3(0, 0, 1)
    );

    progress(64, 'SU-27 戦闘機モデル読み込み中...');
    const fGltf = await loader.loadAsync('./assets/SU-27.glb');
    state.modelTemplates.fighter = normalizeModel(
      T,
      fGltf.scene,
      4.4,
      new T.Vector3(0, 0, -1),
      new T.Vector3(0, 1, 0)
    );
  }catch(e){
    console.warn('3Dモデル読み込みフォールバック使用:', e);
    showToast('3Dモデル読込失敗のため簡易表示を使用中', 3200);
  }
}

async function init(){
  try{
    loading();
    loadGameData();
    initInputControls(getCoopContext);
    initInventoryBar((itemId) => useInventoryItem(itemId, getCoopContext()));
    initPdaEvents();
    initGlobalSfx();
    onPlayerLevelUp((lvUp) => updatePlayerPlate(lvUp));
    state.onSkinChanged = () => syncPlayerVehicleMesh();

    progress(15, '3Dレンダラー初期化中...');
    state.renderer = new T.WebGLRenderer({ canvas: $('#scene'), antialias: true, powerPreference: 'high-performance' });
    state.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, CONFIG.MAX_PIXEL_RATIO));
    state.renderer.outputColorSpace = T.SRGBColorSpace;
    state.renderer.toneMapping = T.ACESFilmicToneMapping;
    state.renderer.toneMappingExposure = 1.1;

    state.scene = new T.Scene();
    state.camera = new T.PerspectiveCamera(60, innerWidth / innerHeight, .1, 320);

    addEventListener('resize', resize);
    resize();

    await load3DAssets();

    progress(100, '起動完了');
    $('#game').classList.remove('not-loaded');
    hideStartScreen();

    state.ready = true;
    state.lastFrameTime = performance.now();
    if(!state.loop){
      state.loop = true;
      requestAnimationFrame(loop);
    }

    if(!state.username){
      openTransferChoiceModal();
    } else {
      enterHome();
    }
  }catch(err){
    console.error(err);
    loadError(err.message || err);
  }
}

function moveAndCam(dt){
  const isPlayWars = state.gameMode === 'battle' && state.activeBattleMode === 'PLAY_WARS';
  const skin = getEquippedSkin();
  let baseSpd = (state.gameMode === 'battle' || state.gameMode === 'test')
    ? CONFIG.MOVE_SPEED * (skin.stats.moveMult || 1.0)
    : CONFIG.HOME_MOVE_SPEED;
  if(isPlayWars) baseSpd *= 1.5;
  if(state.speedBuffTimer > 0) baseSpd *= 1.5;
  const spd = baseSpd * (dt * 60);

  const mx = (state.keys.KeyD || state.keys.ArrowRight ? 1 : 0) - (state.keys.KeyA || state.keys.ArrowLeft ? 1 : 0) + state.move.x;
  const mz = (state.keys.KeyS || state.keys.ArrowDown ? 1 : 0) - (state.keys.KeyW || state.keys.ArrowUp ? 1 : 0) + state.move.y;
  const s = Math.sin(state.yaw), c = Math.cos(state.yaw);

  const dx = (mx * c + mz * s) * spd;
  const dz = (mz * c - mx * s) * spd;
  state.lastMoveDelta = { dx, dz };

  if(isPlayWars){
    if(canStandPlayWars(state.x + dx, state.z, 0.65)) state.x += dx;
    if(canStandPlayWars(state.x, state.z + dz, 0.65)) state.z += dz;
    state.x = T.MathUtils.clamp(state.x, -PLAY_WARS_LIMIT, PLAY_WARS_LIMIT);
    state.z = T.MathUtils.clamp(state.z, -PLAY_WARS_LIMIT, PLAY_WARS_LIMIT);
    if(state.keys.Space && state.y <= 0.01){
      state.vy = 8.5;
    }
    state.vy = (state.vy || 0) - 22.0 * dt;
    state.y += state.vy * dt;
    if(state.y <= 0){
      state.y = 0;
      state.vy = 0;
    }
  } else {
    state.x += dx;
    state.z += dz;
    const limitX = state.gameMode === 'home' ? 19.0 : (state.gameMode === 'skin' ? 39.0 : (state.gameMode === 'test' ? 17.0 : 16.0));
    const limitZ = state.gameMode === 'home' ? 19.0 : (state.gameMode === 'skin' ? 20.0 : (state.gameMode === 'test' ? 17.0 : 16.0));
    state.x = T.MathUtils.clamp(state.x, -limitX, limitX);
    state.z = T.MathUtils.clamp(state.z, -limitZ, limitZ);
  }

  if(state.gameMode === 'home' || state.gameMode === 'skin' || state.gameMode === 'test' ||
     (state.gameMode === 'battle' && (state.activeBattleMode === 'FALL_MISSILE' || state.activeBattleMode === 'PLAY_WARS'))){
    const yOff = isPlayWars ? state.y : 0;
    let useThirdPerson = (state.cameraMode === 'third' && !!state.playerVehicle);
    if(useThirdPerson){
      const camDist = 7.5;
      const cosP = Math.cos(state.pitch);
      const sinP = Math.sin(state.pitch);
      const sinY = Math.sin(state.yaw);
      const cosY = Math.cos(state.yaw);

      const ox = state.x;
      const oy = 0.45 + yOff;
      const oz = state.z;
      const desiredX = ox + sinY * cosP * camDist;
      const desiredY = Math.max(-1.0, oy - sinP * camDist);
      const desiredZ = oz + cosY * cosP * camDist;

      const rdx = desiredX - ox;
      const rdy = desiredY - oy;
      const rdz = desiredZ - oz;

      // 内側壁際境界（壁を通り抜けない）
      const wallLimX = state.gameMode === 'home' ? 19.6
        : (state.gameMode === 'skin' ? 40.5
        : (state.gameMode === 'test' ? 17.6
        : (isPlayWars ? 46.0 : 16.5)));
      const wallLimZ = state.gameMode === 'home' ? 19.6
        : (state.gameMode === 'skin' ? 21.5
        : (state.gameMode === 'test' ? 17.6
        : (isPlayWars ? 46.0 : 16.5)));

      let tMax = 1.0;
      if(rdx > 0.0001 && ox + rdx > wallLimX) tMax = Math.min(tMax, (wallLimX - ox) / rdx);
      if(rdx < -0.0001 && ox + rdx < -wallLimX) tMax = Math.min(tMax, (-wallLimX - ox) / rdx);
      if(rdz > 0.0001 && oz + rdz > wallLimZ) tMax = Math.min(tMax, (wallLimZ - oz) / rdz);
      if(rdz < -0.0001 && oz + rdz < -wallLimZ) tMax = Math.min(tMax, (-wallLimZ - oz) / rdz);

      // PlayWarsでは障害物手前でも止める
      if(isPlayWars && pwState && Array.isArray(pwState.obstacles)){
        const steps = 16;
        for(let sIdx = 1; sIdx <= steps; sIdx++){
          const st = (sIdx / steps) * tMax;
          const sx = ox + rdx * st;
          const sy = oy + rdy * st;
          const sz = oz + rdz * st;
          let hitOb = false;
          for(const ob of pwState.obstacles){
            if(sy <= ob.h + 0.3 && Math.abs(sx - ob.x) < ob.hw + 0.4 && Math.abs(sz - ob.z) < ob.hd + 0.4){
              hitOb = true;
              break;
            }
          }
          if(hitOb){
            tMax = ((sIdx - 1) / steps) * tMax;
            break;
          }
        }
      }

      tMax = Math.max(0, tMax);
      const finalCx = ox + rdx * tMax;
      const finalCy = Math.max(-1.0, oy + rdy * tMax);
      const finalCz = oz + rdz * tMax;
      const effDist = Math.hypot(finalCx - ox, finalCz - oz);

      if(state.autoFirstPersonOnClose && effDist < 2.6){
        useThirdPerson = false;
        state.camera.position.set(state.x, 1.65 + yOff, state.z);
      } else {
        state.camera.position.set(finalCx, finalCy, finalCz);
      }
    } else {
      state.camera.position.set(state.x, 1.65 + yOff, state.z);
    }
    state.camera.rotation.order = 'YXZ';
    state.camera.rotation.y = state.yaw;
    state.camera.rotation.x = state.pitch;

    if(state.playerVehicle){
      state.playerVehicle.update({
        dt,
        x: state.x,
        y: -2.0 + yOff,
        z: state.z,
        moveDx: dx,
        moveDz: dz,
        cameraYaw: state.yaw,
        cameraPitch: state.pitch,
        visible: useThirdPerson
      });
    }
  }
}

function loop(now){
  requestAnimationFrame(loop);
  if(!state.ready) return;

  const dt = Math.min(0.05, Math.max(0.001, (now - state.lastFrameTime) / 1000));
  state.lastFrameTime = now;
  state.syncTick++;

  if(state.powerBuffTimer > 0) state.powerBuffTimer = Math.max(0, state.powerBuffTimer - dt);
  if(state.speedBuffTimer > 0) state.speedBuffTimer = Math.max(0, state.speedBuffTimer - dt);
  if(!state.modalOpen && (state.gameMode === 'home' || state.gameMode === 'skin' || state.gameMode === 'test' || (state.gameMode === 'battle' && (state.activeBattleMode === 'FALL_MISSILE' || state.activeBattleMode === 'PLAY_WARS')))){
    moveAndCam(dt);
  }

  syncCoopFrame();

  if(state.gameMode === 'home' && state.homeController){
    state.homeController.update(state.syncTick);
    if(state.triggerCooldown > 0){
      state.triggerCooldown--;
      state.portalHoldTime = 0;
      state.portalHoldTarget = null;
    } else if(!state.modalOpen){
      const hit = state.homeController.checkPortal(state.x, state.z);
      if(hit){
        if(state.portalHoldTarget !== hit){
          state.portalHoldTarget = hit;
          state.portalHoldTime = 0;
        }
        state.portalHoldTime += dt;
        if(state.portalHoldTime >= 0.5){
          state.portalHoldTime = 0;
          state.portalHoldTarget = null;
          if(hit === 'playwars'){
            playSfx('portal', 0.75);
            state.triggerCooldown = 45;
            openPlayWarsSetupModal();
          } else if(hit === 'battle'){
            playSfx('portal', 0.75);
            state.triggerCooldown = 45;
            openBattleSetupModal();
          } else if(hit === 'yaju'){
            playSfx('portal', 0.75);
            state.triggerCooldown = 45;
            openYajuSetupModal();
          } else if(hit === 'skin'){
            playSfx('portal', 0.75);
            enterSkinRoom();
          } else if(hit === 'test'){
            playSfx('portal', 0.75);
            enterTestRoom();
          } else if(hit === 'coop'){
            playSfx('portal', 0.75);
            state.triggerCooldown = 45;
            openCoopModal();
          } else if(hit === 'store'){
            playSfx('portal', 0.75);
            state.triggerCooldown = 45;
            openSkinStoreModal('items');
          }
        }
      } else {
        state.portalHoldTime = 0;
        state.portalHoldTarget = null;
      }
    }
  } else if(state.gameMode === 'skin' && state.skinController){
    state.skinController.update(state.syncTick);
    if(state.triggerCooldown > 0){
      state.triggerCooldown--;
      state.panelHoldTime = 0;
      state.portalHoldTime = 0;
      state.portalHoldTarget = null;
      updateHoldGauge(0);
    } else if(!state.modalOpen){
      const zone = state.skinController.checkZone(state.x, state.z);
      if(zone === 'backHome'){
        state.panelHoldTime = 0;
        updateHoldGauge(0);
        if(state.portalHoldTarget !== 'skin_backHome'){
          state.portalHoldTarget = 'skin_backHome';
          state.portalHoldTime = 0;
        }
        state.portalHoldTime += dt;
        if(state.portalHoldTime >= 0.5){
          state.portalHoldTime = 0;
          state.portalHoldTarget = null;
          enterHome();
        }
      } else if(zone === 'selectPanel'){
        state.portalHoldTime = 0;
        state.portalHoldTarget = null;
        state.panelHoldTime += dt;
        updateHoldGauge(state.panelHoldTime / 0.5);
        if(state.panelHoldTime >= 0.5){
          state.panelHoldTime = 0;
          updateHoldGauge(0);
          openSkinSelectModal();
        }
      } else {
        state.panelHoldTime = 0;
        state.portalHoldTime = 0;
        state.portalHoldTarget = null;
        updateHoldGauge(0);
      }
    }
  } else if(state.gameMode === 'test' && state.testController){
    state.testController.update(dt, state.syncTick);
    updateCombatSystem(dt, {});
    const dpsNow = performance.now();
    if(!Array.isArray(state.testDpsHistory)) state.testDpsHistory = [];
    const cutoff = dpsNow - 1000;
    while(state.testDpsHistory.length > 0 && state.testDpsHistory[0].t < cutoff){
      state.testDpsHistory.shift();
    }
    let dpsSum = 0;
    for(const item of state.testDpsHistory) dpsSum += item.dmg;
    updateTestDpsUI(dpsSum);
    if(state.triggerCooldown > 0){
      state.triggerCooldown--;
      state.portalHoldTime = 0;
      state.portalHoldTarget = null;
    } else if(!state.modalOpen){
      const zone = state.testController.checkZone(state.x, state.z);
      if(zone === 'backHome'){
        if(state.portalHoldTarget !== 'test_backHome'){
          state.portalHoldTarget = 'test_backHome';
          state.portalHoldTime = 0;
        }
        state.portalHoldTime += dt;
        if(state.portalHoldTime >= 0.5){
          state.portalHoldTime = 0;
          state.portalHoldTarget = null;
          enterHome();
        }
      } else {
        state.portalHoldTime = 0;
        state.portalHoldTarget = null;
      }
    }
  } else if(state.gameMode === 'battle'){
    const effectiveCtx = getCoopContext();
    if(state.activeBattleMode === 'FALL_MISSILE'){
      updateFallMissileMode(dt, effectiveCtx, finishBattle);
      updateEnemiesAndWave(dt, effectiveCtx, finishBattle);

    } else if(state.activeBattleMode === 'PLAY_WARS'){
      updatePlayWarsMode(dt);
      updateCombatSystem(dt, effectiveCtx);
    } else if(state.activeBattleMode === 'YAJU_MAZE' || state.activeBattleMode === 'YAJU_BOSS' || state.activeBattleMode === 'YAJU_DEAD'){
      updateYajuMazeMode(dt);
      if(state.activeBattleMode === 'YAJU_BOSS'){
        updateCombatSystem(dt, {});
      }
    }
  }

  for(let i = state.fx.length - 1; i >= 0; i--){
    const f = state.fx[i];
    if(f.v) f.m.position.add(f.v);
    f.life--;
    if(f.m.material && f.m.material.transparent){
      f.m.material.opacity *= 0.92;
    }
    if(f.life <= 0){
      state.scene.remove(f.m);
      state.fx.splice(i, 1);
    }
  }

  state.renderer.render(state.scene, state.camera);
}

// ==========================================
// UIボタンイベントバインド
// ==========================================
let startTriggered = false;
const handleTapStart = (e) => {
  if(e) e.preventDefault();
  if(startTriggered) return;
  startTriggered = true;
  const btn = $('#tapStartBtn');
  if(btn) btn.style.display = 'none';
  init();
};
$('#tapStartBtn')?.addEventListener('pointerdown', handleTapStart);
$('#tapStartBtn')?.addEventListener('touchend', handleTapStart);
$('#tapStartBtn')?.addEventListener('click', handleTapStart);

$('#saveUsernameBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const val = ($('#usernameInput').value || '').trim();
  state.username = val || 'パルス防衛官';
  saveGameData();
  closeAllModals();
  enterHome();
});

document.querySelectorAll('.setup-mode-btn').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    state.selectedBattleMode = btn.dataset.mode;
    renderBattleSetupModal();
  });
});

$('#cancelSetupBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  closeAllModals();
  state.triggerCooldown = 45;
});

$('#confirmStartBattleBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if(!state.selectedBattleMode || !state.selectedDifficultyId) return;

  const chosenMode = state.selectedBattleMode;
  const chosenDiff = state.selectedDifficultyId;
  const diffObj = getDifficultyById(chosenDiff);

  closeAllModals();

  const sharedMission = null;

  if(coopState.isCoop && coopState.conn && coopState.conn.open){
    // 共闘中は即座に始めず待機状態に入り、相手へ参加要請を送信
    initiateCoopBattleRequest(chosenMode, chosenDiff, sharedMission);
    return;
  }

  coopState.battleSoloOverride = false;
  startBattle(chosenMode, chosenDiff, sharedMission);
});

// 出撃待機キャンセルボタン
$('#cancelCoopWaitBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  cancelOutgoingBattleInvite();
  state.triggerCooldown = 45;
});

// 参加要請モーダル：「参加する」／「拒否」
$('#acceptCoopInviteBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  respondToBattleInvite(true);
});

$('#declineCoopInviteBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  respondToBattleInvite(false);
});

$('#abortBattleBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const wasEffectiveCoop = coopState.isCoop && !coopState.battleSoloOverride;
  if(wasEffectiveCoop){
    sendCoop({ type: 'abortBattle' });
  }
  enterHome();
});

$('#retryBattleBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const mode = state.activeBattleMode || 'FALL_MISSILE';
  const diffId = (state.activeDifficulty && state.activeDifficulty.id) ? state.activeDifficulty.id : 'easy';
  const diffObj = getDifficultyById(diffId);

  if(coopState.isCoop && coopState.conn && coopState.conn.open){
    if(coopState.isHost){
      const sharedMission = null;
      coopState.battleSoloOverride = false;
      resetCoopMatchFlags();
      sendCoop({
        type: 'startBattle',
        mode,
        diffId,
        missionData: sharedMission
      });
      startBattle(mode, diffId, sharedMission);
    } else {
      // ゲストがリトライを押した場合はホストへ再戦要求を送信し、双方リトライ
      showToast('ホストへリトライをリクエストしました…');
      sendCoop({ type: 'requestRetry' });
    }
    return;
  }

  coopState.battleSoloOverride = false;
  const soloMission = null;
  startBattle(mode, diffId, soloMission);
});

$('#returnHomeBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  enterHome();
});

// 機体選択・強化・ショップモーダル
$('#confirmSkinBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  confirmSkinSelection();
});
$('#openUpgradeBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  openUpgradeModal();
});
$('#closeUpgradeBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  $('#skinUpgradeModal').classList.remove('visible');
  openSkinSelectModal();
});
$('#closeStoreBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  closeAllModals();
  state.triggerCooldown = 45;
});

// フレンド共闘モーダル
$('#createRoomBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  createCoopRoom();
});
$('#recruitCoopBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  publishCoopRecruit();
});
$('#cancelRecruitBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  cancelMyCoopRecruit(false);
});
$('#joinRoomBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  joinCoopRoom();
});
$('#leaveCoopRoomBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  leaveCoopRoom();
});
$('#closeCoopBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  closeAllModals();
  state.triggerCooldown = 45;
});

// 全体チャットUI（情報機器内に統合）
$('#chatSendBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  sendGlobalChatMessage();
});
$('#chatInput')?.addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){
    e.preventDefault();
    sendGlobalChatMessage();
  }
});


// YAJUMAZE 設定・ボス戦モーダル
let pendingYajuNormalSettings = { compass: true, progressiveEnemies: true };

$('#yajuStartNormalBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  pendingYajuNormalSettings = {
    compass: !!$('#yajuSettingCompass')?.checked,
    progressiveEnemies: !!$('#yajuSettingProgressive')?.checked
  };
  openYajuIpadWarnModal();
});

$('#yajuIpadConfirmBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  closeAllModals();
  resetMatchInventoryUsage();
  updateInventoryBar();
  if(coopState.isCoop && coopState.conn && coopState.conn.open){
    initiateCoopBattleRequest('YAJU_MAZE', 'normal', { yajuSettings: pendingYajuNormalSettings });
    return;
  }
  coopState.battleSoloOverride = false;
  startBattle('YAJU_MAZE', 'normal', { yajuSettings: pendingYajuNormalSettings });
});

$('#yajuIpadCancelBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  closeAllModals();
  enterHome();
});

$('#yajuOpenBossSetupBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  openYajuBossSetupModal();
});

$('#yajuCancelSetupBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  closeAllModals();
  state.triggerCooldown = 45;
});

$('#yajuCancelBossSetupBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  openYajuSetupModal();
});

$('#yajuBossStartBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if(!state.selectedYajuBossId || !state.selectedYajuDiffId) return;
  const bossId = state.selectedYajuBossId;
  const diffId = state.selectedYajuDiffId;
  closeAllModals();
  resetMatchInventoryUsage();
  updateInventoryBar();
  if(coopState.isCoop && coopState.conn && coopState.conn.open){
    initiateCoopBattleRequest('YAJU_BOSS', diffId, { bossId, diffId });
    return;
  }
  coopState.battleSoloOverride = false;
  startBattle('YAJU_BOSS', diffId, { bossId, diffId });
});

$('#tabItemShopBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  switchStoreTab('items');
});
$('#tabUnitShopBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  switchStoreTab('units');
});

// 初回引き継ぎフロー & フレンド追加イベント
$('#openTransferImportBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  openTransferImportModal();
});
$('#startNewPlayerBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  closeAllModals();
  state.modalOpen = true;
  $('#usernameModal')?.classList.add('visible');
});
$('#backTransferChoiceBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  openTransferChoiceModal();
});
$('#confirmTransferImportBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const raw = $('#transferImportInput')?.value || '';
  const res = importSaveCode(raw);
  const msgEl = $('#transferImportMsg');
  if(!res.ok){
    if(msgEl) msgEl.textContent = res.msg;
    return;
  }
  closeAllModals();
  showToast(res.msg);
  enterHome();
});

$('#addFriendBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const codeEl = $('#friendCodeInput');
  const nameEl = $('#friendNameInput');
  const res = addFriendByCode(codeEl ? codeEl.value : '', nameEl ? nameEl.value : '');
  showToast(res.msg);
  if(res.ok){
    if(codeEl) codeEl.value = '';
    if(nameEl) nameEl.value = '';
    renderCoopFriendsList();
  }
});

// PlayWars ジャンプ＆設定モーダルイベント
$('#jumpBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if(state.gameMode === 'battle' && state.activeBattleMode === 'PLAY_WARS' && state.y <= 0.01){
    state.vy = 8.5;
  }
});

$('#cancelPlayWarsBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  closeAllModals();
  state.triggerCooldown = 45;
});

$('#confirmPlayWarsBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const diffId = state.selectedPlayWarsDiffId || 'easy';
  const hostSkinId = state.selectedPlayWarsSkinId || 'Origin';
  closeAllModals();
  if(coopState.isCoop && coopState.conn && coopState.conn.open){
    initiateCoopBattleRequest('PLAY_WARS', diffId, { hostSkinId, diffId });
    return;
  }
  coopState.battleSoloOverride = false;
  startBattle('PLAY_WARS', diffId, { hostSkinId, diffId });
});

$('#camViewToggleBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  state.cameraMode = state.cameraMode === 'third' ? 'first' : 'third';
  updateCameraToggleButton(true, state.cameraMode);
  if(state.playerVehicle){
    state.playerVehicle.update({
      dt: 0.016,
      x: state.x,
      y: -2.0 + (state.activeBattleMode === 'PLAY_WARS' ? (state.y || 0) : 0),
      z: state.z,
      moveDx: 0,
      moveDz: 0,
      cameraYaw: state.yaw,
      cameraPitch: state.pitch,
      visible: state.cameraMode === 'third'
    });
  }
});
