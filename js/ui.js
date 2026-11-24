import { SHOP_ITEMS } from './config.js';
import { state } from './state.js';
export const $ = (sel) => document.querySelector(sel);

let explosionTicksBuilt = false;

export function ensureExplosionMeterTicks(){
  if(explosionTicksBuilt) return;
  const ticksWrap = $('#expMeterTicks');
  if(!ticksWrap) return;
  ticksWrap.innerHTML = '';
  for(let i = 0; i <= 30; i++){
    const pct = (i / 30) * 100;
    const isMajor = (i % 10 === 0);
    const tick = document.createElement('div');
    tick.className = 'exp-tick ' + (isMajor ? 'major' : 'minor');
    tick.style.bottom = `${pct}%`;
    ticksWrap.appendChild(tick);

    if(isMajor){
      const lbl = document.createElement('span');
      lbl.className = 'exp-tick-label';
      lbl.style.bottom = `${pct}%`;
      lbl.textContent = `${(i / 10).toFixed(1)}`;
      ticksWrap.appendChild(lbl);
    }
  }
  explosionTicksBuilt = true;
}

export function showExplosionChargeMeter(visible){
  const el = $('#explosionChargeMeter');
  if(!el) return;
  if(visible){
    ensureExplosionMeterTicks();
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

export function updateExplosionChargeMeter(chargedSec, isCharging, isMaxCharged, bonusRadiusM = 0){
  const liquid = $('#expMeterLiquid');
  const frame = $('#expMeterFrame');
  const readout = $('#expMeterReadout');
  const radiusEl = $('#expMeterRadius');
  if(!liquid || !frame) return;

  const clamped = Math.max(0, Math.min(3.0, chargedSec));
  const pct = isCharging ? (clamped / 3.0) * 100 : 0;
  liquid.style.height = `${pct}%`;

  if(isCharging && isMaxCharged){
    frame.classList.add('max-charged');
  } else {
    frame.classList.remove('max-charged');
  }

  if(readout){
    readout.textContent = isCharging ? `${clamped.toFixed(1)}s` : '0.0s';
  }
  if(radiusEl){
    const baseR = isCharging ? (clamped * 5) : 0;
    const totalR = baseR + (isCharging ? bonusRadiusM : 0);
    radiusEl.textContent = `${totalR.toFixed(1)}m`;
  }
}

export function progress(pct, text){
  const area = $('#loadArea');
  const fill = $('#loadFill');
  const txt = $('#loadText');
  if(area) area.classList.remove('hidden');
  if(fill) fill.style.width = `${pct}%`;
  if(txt) txt.textContent = text;
}

export function loading(){
  progress(5, 'システム起動中...');
}

export function loadError(msg){
  const txt = $('#loadText');
  if(txt){
    txt.textContent = `エラー: ${msg}`;
    txt.style.color = '#ff4d6d';
  }
}

export function hideStartScreen(){
  const el = $('#startOverlay');
  if(el){
    el.classList.remove('visible');
    el.classList.add('hidden');
  }
}

export function showEndScreen(win, score, earnedGold, isCoop, detailText = ''){
  const endEl = $('#endOverlay');
  if(!endEl) return;
  resetWhiteFade();
  showExplosionChargeMeter(false);
  $('#endEyebrow').textContent = win ? 'WORLD PEACE RESTORED' : 'DEFENSE LINE BREACHED';
  $('#endTitle').innerHTML = win ? 'MISSION<br>COMPLETE' : 'MISSION<br>FAILED';
  const coopBonusStr = isCoop ? '（共闘ボーナス込）' : '';
  const extra = detailText ? `<br>${detailText}` : '';
  $('#endText').innerHTML = `スコア: <b>${score.toLocaleString()}</b> / 獲得ゴールド: <b>+${earnedGold.toLocaleString()} G</b>${coopBonusStr}${extra}`;
  endEl.classList.remove('hidden');
  endEl.classList.add('visible');
}

export function hideEndScreen(){
  const endEl = $('#endOverlay');
  if(endEl){
    endEl.classList.remove('visible');
    endEl.classList.add('hidden');
  }
}

export function triggerWhiteFadeOut(cb){
  const ov = $('#whiteFadeOverlay');
  if(!ov){
    if(cb) cb();
    return;
  }
  ov.classList.add('active');
  setTimeout(() => {
    if(cb) cb();
  }, 1900);
}

export function resetWhiteFade(){
  const ov = $('#whiteFadeOverlay');
  if(ov) ov.classList.remove('active');
}

export function setModeUI(mode, skin, isCoop, isHost, battleMode = 'FALL_MISSILE'){
  const banner = $('#modeBanner');
  const battleEls = document.querySelectorAll('.battle-only');
  const fireWrap = $('#fireWrap');

  if(mode === 'home'){
    const stickEl = $('#stick');
    if(stickEl) stickEl.classList.remove('hidden-mode');
<<<<<<< HEAD
    showInventoryBar(false);
=======
>>>>>>> b4907ccc94f051a25c4a34e4408bd8a11f6783e2
    clearLaserAttackButtons();
    showExplosionChargeMeter(false);
    if(banner){
      banner.classList.remove('hidden-mode');
      const coopTag = isCoop ? (isHost ? ' [共闘ホスト]' : ' [共闘ゲスト]') : '';
      banner.textContent = `HOME BASE — 装備機体: ${skin ? skin.name : 'Origin'}${coopTag}`;
    }
    battleEls.forEach(el => el.classList.add('hidden-mode'));
  } else if(mode === 'skin'){
    const stickEl = $('#stick');
    if(stickEl) stickEl.classList.remove('hidden-mode');
<<<<<<< HEAD
    showInventoryBar(false);
=======
>>>>>>> b4907ccc94f051a25c4a34e4408bd8a11f6783e2
    clearLaserAttackButtons();
    showExplosionChargeMeter(false);
    if(banner){
      banner.classList.remove('hidden-mode');
      banner.textContent = `UNIT HANGAR — 装備中: ${skin ? skin.name : 'Origin'}`;
    }
    battleEls.forEach(el => el.classList.add('hidden-mode'));
  } else if(mode === 'battle'){
    showInventoryBar(battleMode !== 'YAJU_DEAD');
    updateInventoryBar();
    if(banner) banner.classList.add('hidden-mode');
    const skillBtn = $('#skillBtn');
    if(skillBtn) skillBtn.classList.remove('hidden-mode');
    battleEls.forEach(el => el.classList.remove('hidden-mode'));
    if(battleMode === 'AIR_STRIKE'){
      showExplosionChargeMeter(false);
      if(fireWrap) fireWrap.classList.add('hidden-mode');
      const ret = $('#reticle');
      if(ret) ret.classList.add('hidden-mode');
      $('#stat1Label').textContent = 'ALTITUDE';
      $('#stat2Label').textContent = 'SURVIVED';
      $('#stat3Label').textContent = 'SCORE';
    } else if(battleMode === 'YAJU_MAZE' || battleMode === 'YAJU_DEAD'){
      showExplosionChargeMeter(false);
      battleEls.forEach(el => el.classList.add('hidden-mode'));
      const stickEl = $('#stick');
      if(stickEl) stickEl.classList.toggle('hidden-mode', battleMode === 'YAJU_DEAD');
    } else if(battleMode === 'YAJU_BOSS'){
      const stickEl = $('#stick');
      if(stickEl) stickEl.classList.remove('hidden-mode');
      const headerEl = $('header.battle-only');
      const announceEl = $('#announce');
      if(headerEl) headerEl.classList.add('hidden-mode');
      if(announceEl) announceEl.classList.add('hidden-mode');
      if(skillBtn) skillBtn.classList.add('hidden-mode');
      showExplosionChargeMeter(skin && skin.attackType === 'explosion');
    } else {
      const stickEl = $('#stick');
      if(stickEl) stickEl.classList.remove('hidden-mode');
      showExplosionChargeMeter(skin && skin.attackType === 'explosion');
      $('#stat1Label').textContent = 'WAVE';
      $('#stat2Label').textContent = 'TARGETS';
      $('#stat3Label').textContent = 'PEACE';
    }
  }
}

let toastTimer = null;
export function showToast(msg, durationMs = 2600){
  const el = $('#toastBanner');
  if(!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('hidden');
  }, durationMs);
}

export function updateHoldGauge(ratio){
  const wrap = $('#holdGaugeWrap');
  const fill = $('#holdGaugeFill');
  if(!wrap || !fill) return;
  if(ratio <= 0){
    wrap.classList.add('hidden');
    fill.style.width = '0%';
  } else {
    wrap.classList.remove('hidden');
    fill.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
  }
}

export function updateChargeGauge(ratio, labelText = 'CHARGING…'){
  const wrap = $('#chargeGaugeWrap');
  const fill = $('#chargeGaugeFill');
  const lbl = $('#chargeLabel');
  if(!wrap || !fill) return;
  if(ratio <= 0){
    wrap.classList.add('hidden');
    fill.style.width = '0%';
  } else {
    wrap.classList.remove('hidden');
    if(lbl) lbl.textContent = labelText;
    fill.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
  }
}

export function updateSkillButtonUI(skillName, skillLv, status, remainSec){
  const btn = $('#skillBtn');
  const nameEl = $('#skillBtnName');
  const subEl = $('#skillBtnSub');
  if(!btn || !nameEl || !subEl) return;
  nameEl.textContent = `${skillName} Lv.${skillLv}`;
  btn.classList.remove('active', 'cooldown');
  if(status === 'active'){
    btn.classList.add('active');
    subEl.textContent = `ACTIVE ${remainSec.toFixed(1)}s`;
  } else if(status === 'cooldown'){
    btn.classList.add('cooldown');
    subEl.textContent = `CD ${remainSec.toFixed(1)}s`;
  } else {
    subEl.textContent = 'READY';
  }
}

export function updateFireButtonUI(label, stateClass = ''){
  const btn = $('#fire');
  if(!btn) return;
  btn.classList.remove('hidden', 'charging', 'laser-active', 'infinity', 'cooldown', 'deploy-mode');
  btn.textContent = label;
  if(stateClass) btn.classList.add(stateClass);
}

export function hideFireButton(){
  const btn = $('#fire');
  if(btn) btn.classList.add('hidden');
}

export function clearLaserAttackButtons(){
  const stack = $('#laserAttackStack');
  if(stack){
    stack.innerHTML = '';
    stack.classList.add('hidden');
  }
}

export function renderLaserAttackButtons(turretCount, onTriggerMk){
  const stack = $('#laserAttackStack');
  if(!stack) return;
  stack.innerHTML = '';
  stack.classList.remove('hidden');
  for(let i = 1; i <= turretCount; i++){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `laserMkBtn_${i}`;
    btn.className = 'laser-mk-btn';
    btn.innerHTML = `<span class="mk-title">Mk.${i}攻撃</span><span class="mk-sub">READY</span>`;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if(onTriggerMk) onTriggerMk(i);
    });
    stack.appendChild(btn);
  }
}

export function updateLaserAttackButtonState(mkIndex, status, remainSec = 0){
  const btn = $(`#laserMkBtn_${mkIndex}`);
  if(!btn) return;
  const sub = btn.querySelector('.mk-sub');
  btn.classList.remove('active', 'cooldown');
  if(status === 'active'){
    btn.classList.add('active');
    if(sub) sub.textContent = `照射中 ${remainSec.toFixed(1)}s`;
  } else if(status === 'cooldown'){
    btn.classList.add('cooldown');
    if(sub) sub.textContent = `CD ${remainSec.toFixed(1)}s`;
  } else {
    if(sub) sub.textContent = 'READY';
  }
}

export function hud(wave, remaining, peace, maxWaves = 5){
  const wEl = $('#wave');
  const rEl = $('#remaining');
  const pEl = $('#peace');
  if(wEl) wEl.textContent = `${wave} / ${maxWaves}`;
  if(rEl) rEl.textContent = String(remaining);
  if(pEl) pEl.textContent = `${peace}%`;
}

export function airStrikeHud(altitudeM, survivedM, scoreVal){
  const wEl = $('#wave');
  const rEl = $('#remaining');
  const pEl = $('#peace');
  if(wEl) wEl.textContent = `${Math.round(altitudeM)}m`;
  if(rEl) rEl.textContent = `${survivedM}m`;
  if(pEl) pEl.textContent = `${scoreVal.toLocaleString()}`;
}

export function announce(msg){
  const el = $('#announce');
  if(el) el.textContent = msg;
}

let invBarInitialized = false;
export function initInventoryBar(onUseItem){
  if(invBarInitialized) return;
  invBarInitialized = true;
  SHOP_ITEMS.forEach((item, idx) => {
    const slot = $(`#invSlot_${idx}`);
    if(!slot) return;
    slot.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if(onUseItem) onUseItem(item.id);
    });
  });
  updateInventoryBar();
}

export function showInventoryBar(visible){
  const bar = $('#itemInventoryBar');
  if(bar) bar.classList.toggle('hidden', !visible);
}

export function updateInventoryBar(){
  SHOP_ITEMS.forEach((item, idx) => {
    const slot = $(`#invSlot_${idx}`);
    if(!slot) return;
    const nameEl = slot.querySelector('.inv-name');
    const cntEl = slot.querySelector('.inv-count');
    const count = (state.inventory && state.inventory[item.id]) || 0;
    const used = !!(state.usedItemsInMatch && state.usedItemsInMatch[item.id]);

    slot.classList.remove('inv-empty', 'inv-used');
    if(count <= 0 && !used){
      slot.classList.add('inv-empty');
      if(nameEl) nameEl.textContent = item.shortName;
      if(cntEl) cntEl.classList.add('hidden');
    } else if(used){
      slot.classList.add('inv-used');
      if(nameEl) nameEl.textContent = '使用済';
      if(cntEl){
        if(count > 0){
          cntEl.textContent = String(count);
          cntEl.classList.remove('hidden');
        } else {
          cntEl.classList.add('hidden');
        }
      }
    } else {
      if(nameEl){
        nameEl.textContent = item.shortName;
        nameEl.style.color = item.color;
      }
      if(cntEl){
        cntEl.textContent = String(count);
        cntEl.classList.remove('hidden');
      }
    }
  });
}

export function triggerBlueWhiteFadeOut(){
  const ov = $('#blueWhiteFadeOverlay');
  if(!ov) return;
  ov.classList.remove('fading');
  void ov.offsetWidth;
  ov.classList.add('fading');
}
