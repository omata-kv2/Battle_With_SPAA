export const $ = (sel) => document.querySelector(sel);

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
    clearLaserAttackButtons();
    if(banner){
      banner.classList.remove('hidden-mode');
      const coopTag = isCoop ? (isHost ? ' [共闘ホスト]' : ' [共闘ゲスト]') : '';
      banner.textContent = `HOME BASE — 装備機体: ${skin ? skin.name : 'Origin'}${coopTag}`;
    }
    battleEls.forEach(el => el.classList.add('hidden-mode'));
  } else if(mode === 'skin'){
    clearLaserAttackButtons();
    if(banner){
      banner.classList.remove('hidden-mode');
      banner.textContent = `UNIT HANGAR — 装備中: ${skin ? skin.name : 'Origin'}`;
    }
    battleEls.forEach(el => el.classList.add('hidden-mode'));
  } else if(mode === 'battle'){
    if(banner) banner.classList.add('hidden-mode');
    battleEls.forEach(el => el.classList.remove('hidden-mode'));
    if(battleMode === 'AIR_STRIKE'){
      if(fireWrap) fireWrap.classList.add('hidden-mode');
      const ret = $('#reticle');
      if(ret) ret.classList.add('hidden-mode');
      $('#stat1Label').textContent = 'ALTITUDE';
      $('#stat2Label').textContent = 'SURVIVED';
      $('#stat3Label').textContent = 'SCORE';
    } else {
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
