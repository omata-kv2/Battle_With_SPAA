import * as T from './libs/three.module.js';
import { GLTFLoader } from './libs/examples/jsm/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import {
  $, progress, loading, loadError, hideStartScreen, showEndScreen, hideEndScreen,
  triggerWhiteFadeOut, resetWhiteFade, setModeUI, updateHoldGauge, updateSkillButtonUI,
  updateFireButtonUI, announce
} from './ui.js';
import {
  state, getEquippedSkin, getEffectiveStats, getDifficultyById, loadGameData, saveGameData
} from './state.js';
import { makeTarget, prepareModel } from './map-fall-missile.js';
import { buildHomeStage } from './map-home.js';
import { buildSkinStage } from './map-skin.js';
import { resetCombatState } from './player.js';
import { startFallMissileBattle, updateFallMissileMode } from './mode-fall-missile.js';
import { startAirStrikeBattle, updateAirStrikeFrame, generateAirStrikeMissionData } from './mode-air-strike.js';
import {
  coopState, bindMultiplayerCallbacks, sendCoop, getCoopContext,
  clearRemoteVisuals, createRemotePlayerMesh, initRemoteAirStrikeCraft,
  syncCoopFrame, ensureLobbyInitialized, expandChat, collapseChat,
  sendGlobalChatMessage, publishCoopRecruit, cancelMyCoopRecruit,
  leaveCoopRoom, createCoopRoom, joinCoopRoom
} from './multiplayer.js';
import {
  closeAllModals, openCoopModal, openBattleSetupModal, renderBattleSetupModal,
  openSkinSelectModal, renderSkinSelectList, confirmSkinSelection,
  openUpgradeModal, openSkinStoreModal
} from './modals.js';
import { initInputControls } from './controls.js';

function clearScene(){
  if(!state.scene) return;
  while(state.scene.children.length > 0){
    state.scene.remove(state.scene.children[0]);
  }
  state.enemies.length = 0;
  state.fx.length = 0;
  state.airStrikeState = null;
  clearRemoteVisuals();
  resetCombatState();
}

export async function initEngineAndEnterHome(){
  if(state.ready){
    checkUsernameAndEnterHome();
    return;
  }
  loading();
  try{
    progress(10, '3Dエンジンを初期化中');
    state.renderer = new T.WebGLRenderer({ canvas: $('#scene'), antialias: false, powerPreference: 'low-power' });
    state.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, CONFIG.MAX_PIXEL_RATIO));
    state.renderer.setSize(innerWidth, innerHeight, false);
    state.renderer.outputColorSpace = T.SRGBColorSpace;
    state.scene = new T.Scene();
    state.camera = new T.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 240);
    state.target = makeTarget(T);

    progress(35, '3Dモデルを読み込み中');
    const loader = new GLTFLoader();
    const loadOne = async (path) => {
      try { const gltf = await loader.loadAsync(path); return gltf.scene; }
      catch(err){ return null; }
    };
    const [missile, fighter] = await Promise.all([loadOne('assets/Kh-35.glb'), loadOne('assets/SU-27.glb')]);
    if(missile) state.modelTemplates.missile = prepareModel(T, missile, 1.9, true);
    if(fighter) state.modelTemplates.fighter = prepareModel(T, fighter, 3.6, false);

    progress(90, 'ホームマップを構築中');
    requestAnimationFrame(() => {
      progress(100, '完了');
      state.ready = true;
      $('#game').classList.add('loaded');
      if(!state.loop){ state.loop = true; animate(); }
      checkUsernameAndEnterHome();
    });
  } catch(e){
    console.error(e);
    loadError(e?.message || 'WebGLを初期化できませんでした');
  }
}

function checkUsernameAndEnterHome(){
  if(!state.username){
    state.modalOpen = true;
    $('#startOverlay').classList.remove('visible');
    $('#usernameModal').classList.add('visible');
  } else {
    enterHome();
  }
}

export function enterHome(){
  hideStartScreen();
  hideEndScreen();
  closeAllModals();
  clearScene();
  state.gameMode = 'home';
  setModeUI('home', getEquippedSkin(), coopState.isCoop, coopState.isHost);
  state.homeController = buildHomeStage(T, state.scene, state.gold);
  state.x = state.homeController.spawnPos.x;
  state.y = 0;
  state.z = state.homeController.spawnPos.z;
  state.yaw = 0;
  state.pitch = -0.04;
  state.triggerCooldown = 45;
  state.panelHoldTime = 0;
  updateHoldGauge(0);

  ensureLobbyInitialized();

  if(coopState.isCoop){
    createRemotePlayerMesh();
  }
}

export function enterSkinRoom(){
  closeAllModals();
  clearScene();
  state.gameMode = 'skin';
  setModeUI('skin', getEquippedSkin(), coopState.isCoop, coopState.isHost);
  state.skinController = buildSkinStage(T, state.scene, CONFIG.SKINS, state.unlockedSkins, state.selectedSkinId);
  state.x = state.skinController.spawnPos.x;
  state.y = 0;
  state.z = state.skinController.spawnPos.z;
  state.yaw = state.skinController.spawnYaw;
  state.pitch = -0.04;
  state.triggerCooldown = 45;
  state.panelHoldTime = 0;
  updateHoldGauge(0);
}

export function startBattle(modeArg = null, diffIdArg = null, sharedMissionData = null){
  closeAllModals();
  resetWhiteFade();
  clearScene();
  state.gameMode = 'battle';

  state.activeBattleMode = modeArg || state.selectedBattleMode || 'FALL_MISSILE';
  state.activeDifficulty = getDifficultyById(diffIdArg || state.selectedDifficultyId || 'easy');

  const skin = getEquippedSkin();
  const eff = getEffectiveStats(skin);
  setModeUI('battle', skin, coopState.isCoop, coopState.isHost, state.activeBattleMode);
  updateSkillButtonUI(skin.skill.name, eff.skillLv, 'ready', 0);

  if(skin.attackType === 'explosion'){
    updateFireButtonUI('CHARGE
1.5s', '');
  } else if(skin.attackType === 'scatter'){
    updateFireButtonUI('SCATTER', '');
  } else if(skin.attackType === 'laser'){
    updateFireButtonUI(`LASER
${eff.laserDurationSec}s`, '');
  } else if(skin.attackType === 'automatic'){
    updateFireButtonUI(`AUTO
×${eff.autoVolleyCount}`, '');
  } else if(skin.attackType === 'wirbelwind'){
    updateFireButtonUI('4-QUAD', '');
  } else if(skin.attackType === 'beast'){
    updateFireButtonUI('BEAST', '');
  } else {
    updateFireButtonUI('PULSE', '');
  }

  state.wave = 1;
  state.peace = 100;
  state.spawned = 0;
  state.tick = 0;
  state.wait = 0;
  state.score = 0;
  state.earnedGoldInMatch = 0;

  const coopCtx = getCoopContext();
  if(state.activeBattleMode === 'AIR_STRIKE'){
    startAirStrikeBattle(sharedMissionData, coopCtx, initRemoteAirStrikeCraft);
  } else {
    startFallMissileBattle(coopCtx, createRemotePlayerMesh);
  }
}

export function finishBattle(win){
  if(state.gameMode === 'end') return;
  state.gameMode = 'end';
  resetCombatState();
  if(coopState.isCoop){
    state.earnedGoldInMatch = Math.round(state.score * 1.5);
    state.gold += state.earnedGoldInMatch;
    saveGameData();
  }
  if(win){
    triggerWhiteFadeOut(() => {
      showEndScreen(true, state.score, state.earnedGoldInMatch, coopState.isCoop);
    });
  } else {
    showEndScreen(false, state.score, state.earnedGoldInMatch, coopState.isCoop);
  }
}

export function abortBattle(){
  if(state.gameMode !== 'battle') return;
  if(coopState.isCoop){
    sendCoop({ type: 'abortBattle' });
  }
  enterHome();
}

function update(dt){
  state.syncTick++;
  const coopCtx = getCoopContext();

  if(state.gameMode === 'battle' && state.activeBattleMode === 'AIR_STRIKE'){
    updateAirStrikeFrame(dt, coopCtx);
    syncCoopFrame();
    return;
  }

  const f = (state.keys.KeyW || state.keys.ArrowUp ? 1 : 0) - (state.keys.KeyS || state.keys.ArrowDown ? 1 : 0) - state.move.y;
  const s = (state.keys.KeyD || state.keys.ArrowRight ? 1 : 0) - (state.keys.KeyA || state.keys.ArrowLeft ? 1 : 0) + state.move.x;
  const forward = new T.Vector3(0, 0, -1).applyAxisAngle(new T.Vector3(0, 1, 0), state.yaw);
  const right = new T.Vector3(1, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), state.yaw);

  const skin = getEquippedSkin();
  const speed = (state.gameMode === 'battle' ? CONFIG.MOVE_SPEED * skin.stats.moveMult : CONFIG.HOME_MOVE_SPEED);
  const limit = (state.gameMode === 'battle' ? 18 : 9.2);

  state.x = T.MathUtils.clamp(state.x + (forward.x * f + right.x * s) * speed, -limit, limit);
  state.z = T.MathUtils.clamp(state.z + (forward.z * f + right.z * s) * speed, -limit, limit);
  state.camera.position.set(state.x, 0.15, state.z);
  state.camera.rotation.order = 'YXZ';
  state.camera.rotation.set(state.pitch, state.yaw, 0);

  syncCoopFrame();

  if(state.triggerCooldown > 0) state.triggerCooldown--;

  if(state.gameMode === 'home' && state.homeController && !state.modalOpen && state.triggerCooldown === 0){
    for(const tr of state.homeController.triggers){
      if(Math.hypot(state.x - tr.x, state.z - tr.z) < tr.radius){
        if(tr.id === 'gamestart'){
          if(coopState.isCoop && !coopState.isHost){
            announce('共闘モード中：ホストがモード・難易度を選択するのを待機中...');
          } else {
            openBattleSetupModal();
          }
          return;
        } else if(tr.id === 'skin'){
          enterSkinRoom();
          return;
        } else if(tr.id === 'coop'){
          state.triggerCooldown = 60;
          openCoopModal();
          return;
        }
      }
    }
  }

  if(state.gameMode === 'skin' && state.skinController && !state.modalOpen){
    const zones = state.skinController.zones;
    if(state.triggerCooldown === 0 && Math.abs(state.x - zones.backHome.x) < zones.backHome.halfX && Math.abs(state.z - zones.backHome.z) < zones.backHome.halfZ){
      enterHome();
      return;
    }
    if(state.triggerCooldown === 0 && Math.abs(state.x - zones.store.x) < zones.store.halfX && Math.abs(state.z - zones.store.z) < zones.store.halfZ){
      openSkinStoreModal();
      return;
    }
    const inSelectZone = Math.abs(state.x - zones.selectPanel.x) < zones.selectPanel.halfX && Math.abs(state.z - zones.selectPanel.z) < zones.selectPanel.halfZ;
    if(inSelectZone && state.triggerCooldown === 0){
      state.panelHoldTime += dt;
      updateHoldGauge(state.panelHoldTime / 1.0);
      if(state.panelHoldTime >= 1.0){
        state.panelHoldTime = 0;
        updateHoldGauge(0);
        openSkinSelectModal();
        return;
      }
    } else if(state.panelHoldTime > 0){
      state.panelHoldTime = 0;
      updateHoldGauge(0);
    }
  }

  if(state.gameMode === 'battle' && state.activeBattleMode === 'FALL_MISSILE'){
    updateFallMissileMode(dt, coopCtx, finishBattle);
  }
}

function animate(){
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - state.lastFrameTime) / 1000, 0.1);
  state.lastFrameTime = now;

  update(dt);

  for(let i = state.fx.length - 1; i >= 0; i--){
    const p = state.fx[i];
    if(p.v) p.m.position.add(p.v);
    if(--p.life <= 0){
      if(state.scene) state.scene.remove(p.m);
      state.fx.splice(i, 1);
    }
  }
  if(state.renderer && state.scene && state.camera){
    state.renderer.render(state.scene, state.camera);
  }
}

function bindUIEvents(){
  initInputControls(getCoopContext);

  $('#abortBattleBtn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); abortBattle(); });

  const startBtn = $('#tapStartBtn');
  let startTriggered = false;
  const triggerStart = (e) => {
    if(e) e.preventDefault();
    if(startTriggered) return;
    startTriggered = true;
    initEngineAndEnterHome();
  };
  startBtn?.addEventListener('pointerdown', triggerStart);
  startBtn?.addEventListener('click', triggerStart);

  $('#saveUsernameBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const val = $('#usernameInput').value.trim();
    state.username = val || 'ゲスト';
    saveGameData();
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
    const chosenDiffId = state.selectedDifficultyId;
    const diffObj = getDifficultyById(chosenDiffId);
    const sharedMission = chosenMode === 'AIR_STRIKE'
      ? generateAirStrikeMissionData(CONFIG, diffObj)
      : null;

    if(coopState.isCoop && coopState.isHost){
      if(coopState.coopStarting) return;
      coopState.coopStarting = true;
      sendCoop({
        type: 'startBattle',
        mode: chosenMode,
        diffId: chosenDiffId,
        missionData: sharedMission
      });
      startBattle(chosenMode, chosenDiffId, sharedMission);
    } else {
      startBattle(chosenMode, chosenDiffId, sharedMission);
    }
  });

  $('#confirmSkinBtn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); confirmSkinSelection(); });
  $('#openUpgradeBtn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); openUpgradeModal(); });
  $('#closeUpgradeBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    $('#skinUpgradeModal').classList.remove('visible');
    renderSkinSelectList();
    $('#skinSelectModal').classList.add('visible');
  });
  $('#closeStoreBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    closeAllModals();
    state.triggerCooldown = 45;
  });

  $('#createRoomBtn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); createCoopRoom(); });
  $('#recruitCoopBtn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); publishCoopRecruit(); });
  $('#cancelRecruitBtn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); cancelMyCoopRecruit(false); });
  $('#joinRoomBtn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); joinCoopRoom(); });
  $('#leaveCoopRoomBtn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); leaveCoopRoom(); });
  $('#closeCoopBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    closeAllModals();
    state.triggerCooldown = 45;
  });

  $('#chatToggleBtn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); expandChat(); });
  $('#chatMinimizeBtn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); collapseChat(); });
  $('#chatSendBtn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); sendGlobalChatMessage(); });
  $('#chatInput')?.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if(e.key === 'Enter'){
      e.preventDefault();
      sendGlobalChatMessage();
    }
  });

  $('#retryBattleBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const sharedMission = state.activeBattleMode === 'AIR_STRIKE'
      ? generateAirStrikeMissionData(CONFIG, state.activeDifficulty)
      : null;
    if(coopState.isCoop && coopState.isHost){
      sendCoop({
        type: 'startBattle',
        mode: state.activeBattleMode,
        diffId: state.activeDifficulty.id,
        missionData: sharedMission
      });
    }
    startBattle(state.activeBattleMode, state.activeDifficulty.id, sharedMission);
  });

  $('#returnHomeBtn')?.addEventListener('pointerdown', (e) => { e.preventDefault(); enterHome(); });

  window.addEventListener('resize', () => {
    if(!state.renderer) return;
    state.renderer.setSize(innerWidth, innerHeight, false);
    state.camera.aspect = innerWidth / innerHeight;
    state.camera.updateProjectionMatrix();
  });
}

bindMultiplayerCallbacks({
  startBattle,
  enterHome,
  finishBattle
});

loadGameData();
bindUIEvents();
