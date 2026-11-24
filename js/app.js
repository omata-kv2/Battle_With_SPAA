ーimport * as T from './libs/three.module.js';
import { CONFIG } from './config.js';
import { state, getEquippedSkin, getDifficultyById, loadGameData, saveGameData, resetMatchInventoryUsage } from './state.js';
import {
  $, progress, loading, loadError, hideStartScreen, showEndScreen, hideEndScreen,
  setModeUI, showToast, updateHoldGauge, resetWhiteFade, initInventoryBar, updateInventoryBar
} from './ui.js';
import { initInputControls, resetMovementInputs } from './controls.js';
import {
  closeAllModals, openCoopModal, openBattleSetupModal, renderBattleSetupModal,
  openSkinSelectModal, confirmSkinSelection, openUpgradeModal, openSkinStoreModal,
  openYajuSetupModal, openYajuBossSetupModal, openYajuIpadWarnModal, switchStoreTab
} from './modals.js';
import { resetCombatState, updateCombatSystem } from './player.js';
import { useInventoryItem } from './items.js';
import { clearEnemiesAndFx, updateEnemiesAndWave } from './enemies.js';
import { initFallMissileMode, updateFallMissileMode } from './mode-fall-missile.js';
import { initAirStrikeMode, updateAirStrikeMode, generateAirStrikeMissionData } from './mode-air-strike.js';
import { resetYajuState, updateYajuMazeMode, startYajuNormalMode, startYajuBossMode, bindYajuCallbacks } from './mode-yaju-maze.js';
import { buildHomeWorld } from './map-home.js';
import { buildSkinWorld } from './map-skin.js';
import { buildWorld, normalizeModel } from './map-fall-missile.js';
import {
  coopState, bindMultiplayerCallbacks, resetCoopMatchFlags, sendCoop, getCoopContext,
  initiateCoopBattleRequest, cancelOutgoingBattleInvite, respondToBattleInvite,
  clearRemoteVisuals, createRemotePlayerMesh, initRemoteAirStrikeCraft,
  syncCoopFrame, ensureLobbyInitialized, expandChat, collapseChat,
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

function clearScene(){
  if(!state.scene) return;
  clearEnemiesAndFx();
  resetCombatState();
  while(state.scene.children.length > 0){
    state.scene.remove(state.scene.children[0]);
  }
  state.target = null;
  state.homeController = null;
  state.skinController = null;
  state.airStrikeState = null;
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
  state.z = 9;
  state.yaw = 0;
  state.pitch = -0.05;
  state.triggerCooldown = 35;
  state.panelHoldTime = 0;
  updateHoldGauge(0);

  clearScene();
  state.homeController = buildHomeWorld(T, state.scene, state.gold, state.yajuCoins);

  if(coopState.isCoop){
    createRemotePlayerMesh();
  }

  setModeUI('home', getEquippedSkin(), coopState.isCoop, coopState.isHost);
  ensureLobbyInitialized();
}

export function enterSkinRoom(){
  resetMovementInputs();
  resetWhiteFade();
  hideEndScreen();
  closeAllModals();
  state.gameMode = 'skin';
  state.x = 0;
  state.y = 0;
  state.z = 7;
  state.yaw = 0;
  state.pitch = -0.04;
  state.triggerCooldown = 35;
  state.panelHoldTime = 0;
  updateHoldGauge(0);

  clearScene();
  state.skinController = buildSkinWorld(T, state.scene, state.unlockedSkins, state.selectedSkinId);
  setModeUI('skin', getEquippedSkin(), coopState.isCoop, coopState.isHost);
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
  state.triggerCooldown = 0;
  updateHoldGauge(0);
  resetMatchInventoryUsage();
  updateInventoryBar();

  state.gameMode = 'battle';
  state.activeBattleMode = mode;
  state.activeDifficulty = getDifficultyById(diffId);

  clearScene();

  const effectiveCtx = getCoopContext();

  if(mode === 'AIR_STRIKE'){
    initAirStrikeMode(missionData, effectiveCtx);
    if(effectiveCtx.isCoop){
      initRemoteAirStrikeCraft(CONFIG.AIR_STRIKE.START_Y, 0);
    }
  } else {
    initFallMissileMode((dObj) => {
      state.target = buildWorld(T, state.scene, dObj);
    }, effectiveCtx);
    if(effectiveCtx.isCoop){
      createRemotePlayerMesh();
    }
  }
}

export function finishBattle(win){
  if(state.gameMode === 'end') return;
  resetMovementInputs();
  resetWhiteFade();
  clearEnemiesAndFx();
  resetCombatState();
  state.gameMode = 'end';
  state.gold += state.earnedGoldInMatch;
  saveGameData();

  const effectiveCtx = getCoopContext();
  let detail = '';
  if(state.activeBattleMode === 'AIR_STRIKE' && state.airStrikeState){
    const as = state.airStrikeState;
    detail = `あなたの降下記録: <b>${as.survivedM}m</b>（${as.localHitTarget ? '目標着弾成功' : '目標外/衝突'}）`;
    if(effectiveCtx.isCoop){
      detail += `<br>フレンドの降下記録: <b>${coopState.remotePos.remoteSurvivedM}m</b>（${coopState.remotePos.remoteHitTarget ? '目標着弾成功' : '目標外/衝突'}）`;
    }
  }

  // バトル終了後、ソロ一時切替フラグを元に戻す
  coopState.battleSoloOverride = false;
  resetCoopMatchFlags();

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
      state.modalOpen = true;
      $('#usernameModal').classList.add('visible');
    } else {
      enterHome();
    }
  }catch(err){
    console.error(err);
    loadError(err.message || err);
  }
}

function moveAndCam(dt){
  const skin = getEquippedSkin();
  const baseSpd = state.gameMode === 'battle'
    ? CONFIG.MOVE_SPEED * (skin.stats.moveMult || 1.0)
    : CONFIG.HOME_MOVE_SPEED;
  const spd = baseSpd * (dt * 60);

  const mx = (state.keys.KeyD || state.keys.ArrowRight ? 1 : 0) - (state.keys.KeyA || state.keys.ArrowLeft ? 1 : 0) + state.move.x;
  const mz = (state.keys.KeyS || state.keys.ArrowDown ? 1 : 0) - (state.keys.KeyW || state.keys.ArrowUp ? 1 : 0) + state.move.y;
  const s = Math.sin(state.yaw), c = Math.cos(state.yaw);

  state.x += (mx * c + mz * s) * spd;
  state.z += (mz * c - mx * s) * spd;

  const limit = state.gameMode === 'home' ? 19.0 : (state.gameMode === 'skin' ? 17.0 : 16.0);
  state.x = T.MathUtils.clamp(state.x, -limit, limit);
  state.z = T.MathUtils.clamp(state.z, -limit, limit);

  if(state.gameMode === 'home'){
    state.camera.position.set(state.x, 1.65, state.z);
    state.camera.rotation.order = 'YXZ';
    state.camera.rotation.y = state.yaw;
    state.camera.rotation.x = state.pitch;
  } else if(state.gameMode === 'skin'){
    state.camera.position.set(state.x, 1.65, state.z);
    state.camera.rotation.order = 'YXZ';
    state.camera.rotation.y = state.yaw;
    state.camera.rotation.x = state.pitch;
  } else if(state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
    state.camera.position.set(state.x, 1.65, state.z);
    state.camera.rotation.order = 'YXZ';
    state.camera.rotation.y = state.yaw;
    state.camera.rotation.x = state.pitch;
  }
}

function loop(now){
  requestAnimationFrame(loop);
  if(!state.ready) return;

  const dt = Math.min(0.05, Math.max(0.001, (now - state.lastFrameTime) / 1000));
  state.lastFrameTime = now;
  state.syncTick++;

  if(!state.modalOpen && (state.gameMode === 'home' || state.gameMode === 'skin' || (state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'))){
    moveAndCam(dt);
  }

  syncCoopFrame();

  if(state.gameMode === 'home' && state.homeController){
    state.homeController.update(state.syncTick);
    if(state.triggerCooldown > 0){
      state.triggerCooldown--;
    } else if(!state.modalOpen){
      const hit = state.homeController.checkPortal(state.x, state.z);
      if(hit === 'battle'){
        state.triggerCooldown = 45;
        openBattleSetupModal();
      } else if(hit === 'yaju'){
        state.triggerCooldown = 45;
        openYajuSetupModal();
      } else if(hit === 'skin'){
        enterSkinRoom();
      } else if(hit === 'coop'){
        state.triggerCooldown = 45;
        openCoopModal();
      } else if(hit === 'store'){
        state.triggerCooldown = 45;
        openSkinStoreModal('items');
      }
    }
  } else if(state.gameMode === 'skin' && state.skinController){
    state.skinController.update(state.syncTick);
    if(state.triggerCooldown > 0){
      state.triggerCooldown--;
    } else if(!state.modalOpen){
      const zone = state.skinController.checkZone(state.x, state.z);
      if(zone === 'backHome'){
        enterHome();
      } else if(zone === 'selectPanel'){
        state.panelHoldTime += dt;
        updateHoldGauge(state.panelHoldTime / 2.0);
        if(state.panelHoldTime >= 2.0){
          state.panelHoldTime = 0;
          updateHoldGauge(0);
          openSkinSelectModal();
        }
      } else {
        state.panelHoldTime = 0;
        updateHoldGauge(0);
      }
    }
  } else if(state.gameMode === 'battle'){
    const effectiveCtx = getCoopContext();
    if(state.activeBattleMode === 'FALL_MISSILE'){
      updateFallMissileMode(dt, effectiveCtx, finishBattle);
      updateEnemiesAndWave(dt, effectiveCtx, finishBattle);
    } else if(state.activeBattleMode === 'AIR_STRIKE'){
      updateAirStrikeMode(dt, effectiveCtx, finishBattle);
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

  const sharedMission = chosenMode === 'AIR_STRIKE'
    ? generateAirStrikeMissionData(CONFIG, diffObj)
    : null;

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
      const sharedMission = mode === 'AIR_STRIKE'
        ? generateAirStrikeMissionData(CONFIG, diffObj)
        : null;
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
  const soloMission = mode === 'AIR_STRIKE'
    ? generateAirStrikeMissionData(CONFIG, diffObj)
    : null;
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

// 全体チャットUI
$('#chatToggleBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  expandChat();
});
$('#chatMinimizeBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  collapseChat();
});
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
  startYajuNormalMode(pendingYajuNormalSettings);
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
  startYajuBossMode(bossId, diffId);
});

$('#tabItemShopBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  switchStoreTab('items');
});
$('#tabUnitShopBtn')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  switchStoreTab('units');
});
