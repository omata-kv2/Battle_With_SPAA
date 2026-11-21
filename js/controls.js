import * as T from './libs/three.module.js';
import { state } from './state.js';
import { $, updateChargeGauge } from './ui.js';
import { combatState, shoot, activateUnitSkill } from './player.js';

let stickId = null;
let lookId = null;
let lx = 0;
let ly = 0;
let lastTouchEndTime = 0;

export function installTouchSelectionGuards(){
  // iPad / iOS Safari の長押しコンテキストメニュー・青選択範囲・ダブルタップズーム・ピンチ拡大を無効化
  document.addEventListener('contextmenu', (e) => {
    const tag = e.target && e.target.tagName;
    if(tag !== 'INPUT' && tag !== 'TEXTAREA'){
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('selectstart', (e) => {
    const tag = e.target && e.target.tagName;
    if(tag !== 'INPUT' && tag !== 'TEXTAREA'){
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

  document.addEventListener('touchstart', (e) => {
    if(e.touches.length > 1){
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    const tag = e.target && e.target.tagName;
    if(tag !== 'INPUT' && tag !== 'TEXTAREA' && (now - lastTouchEndTime <= 320)){
      e.preventDefault();
    }
    lastTouchEndTime = now;
  }, { passive: false });
}

export function resetMovementInputs(){
  stickId = null;
  lookId = null;
  state.move.x = 0;
  state.move.y = 0;
  const knob = $('#stickKnob');
  if(knob) knob.style.transform = 'translate(0px,0px)';
  for(const k in state.keys) state.keys[k] = false;
  combatState.fireHeld = false;
  combatState.isCharging = false;
  combatState.chargeElapsed = 0;
  updateChargeGauge(0);
}

function setStick(cx, cy){
  const stickEl = $('#stick');
  if(!stickEl) return;
  const r = stickEl.getBoundingClientRect();
  const dx = cx - (r.left + r.width / 2);
  const dy = cy - (r.top + r.height / 2);
  const max = r.width * 0.34;
  const d = Math.min(Math.hypot(dx, dy), max);
  const a = Math.atan2(dy, dx);
  state.move.x = Math.cos(a) * (d / max);
  state.move.y = Math.sin(a) * (d / max);
  const knob = $('#stickKnob');
  if(knob) knob.style.transform = `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px)`;
}

export function initInputControls(getCoopCtx){
  installTouchSelectionGuards();

  const handleFirePressStart = () => {
    if(state.gameMode !== 'battle' || state.activeBattleMode !== 'FALL_MISSILE' || state.modalOpen) return;
    combatState.fireHeld = true;
    combatState.autoFireTimer = 0;
    shoot(getCoopCtx());
  };

  const handleFirePressEnd = () => {
    combatState.fireHeld = false;
    combatState.autoFireTimer = 0;
    if(combatState.isCharging){
      combatState.isCharging = false;
      combatState.chargeElapsed = 0;
      updateChargeGauge(0);
    }
  };

  const stick = $('#stick');
  if(stick){
    stick.addEventListener('pointerdown', (e) => {
      if(state.modalOpen) return;
      e.preventDefault();
      stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      setStick(e.clientX, e.clientY);
    });
    stick.addEventListener('pointermove', (e) => {
      if(e.pointerId === stickId) setStick(e.clientX, e.clientY);
    });
    const endStick = (e) => {
      if(e.pointerId === stickId){
        stickId = null;
        state.move.x = 0;
        state.move.y = 0;
        const knob = $('#stickKnob');
        if(knob) knob.style.transform = 'translate(0px,0px)';
      }
    };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
  }

  const lookSurface = $('#lookSurface');
  if(lookSurface){
    lookSurface.addEventListener('pointerdown', (e) => {
      if(state.modalOpen) return;
      if(lookId === null){
        lookId = e.pointerId;
        lx = e.clientX;
        ly = e.clientY;
        lookSurface.setPointerCapture(e.pointerId);
      }
    });
    lookSurface.addEventListener('pointermove', (e) => {
      if(e.pointerId !== lookId || state.modalOpen) return;
      state.yaw -= (e.clientX - lx) * 0.005;
      state.pitch = T.MathUtils.clamp(state.pitch - (e.clientY - ly) * 0.004, -1.45, 1.45);
      lx = e.clientX;
      ly = e.clientY;
    });
    const endLook = (e) => {
      if(e.pointerId === lookId) lookId = null;
    };
    lookSurface.addEventListener('pointerup', endLook);
    lookSurface.addEventListener('pointercancel', endLook);
  }

  const fireBtn = $('#fire');
  if(fireBtn){
    fireBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handleFirePressStart();
    });
    fireBtn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      handleFirePressEnd();
    });
    fireBtn.addEventListener('pointercancel', handleFirePressEnd);
    fireBtn.addEventListener('pointerleave', () => {
      if(combatState.fireHeld) handleFirePressEnd();
    });
  }

  const skillBtn = $('#skillBtn');
  if(skillBtn){
    skillBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      activateUnitSkill(getCoopCtx());
    });
  }

  window.addEventListener('keydown', (e) => {
    if(document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')){
      return;
    }
    if(!state.modalOpen){
      state.keys[e.code] = true;
      if(e.code === 'Space' && !e.repeat){
        handleFirePressStart();
      }
      if((e.code === 'KeyE' || e.code === 'KeyQ') && !e.repeat){
        activateUnitSkill(getCoopCtx());
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    state.keys[e.code] = false;
    if(e.code === 'Space'){
      handleFirePressEnd();
    }
  });
}
