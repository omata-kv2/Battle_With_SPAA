export const $=s=>document.querySelector(s);
export function progress(n,t){$('#loadFill').style.width=n+'%';$('#loadText').textContent=t+' '+n+'%'}
export function loading(){$('#startOverlay').classList.add('visible');$('#loadArea').classList.remove('hidden');$('#tapStartBtn').disabled=true;$('#tapStartBtn').textContent='LOADING…';}
export function loadError(t){$('#loadText').textContent='エラー：'+t;$('#tapStartBtn').disabled=false;$('#tapStartBtn').textContent='RETRY'}
export function hideStartScreen(){$('#startOverlay').classList.remove('visible')}

export function showEndScreen(win, score, earnedGold, isCoop=false, customDetail=''){
  $('#endOverlay').classList.add('visible');
  $('#endEyebrow').textContent = win ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED';
  $('#endTitle').innerHTML = win ? 'MISSION<br>COMPLETE' : 'MISSION<br>FAILED';
  const modeStr = isCoop ? '【共闘モード】' : '';
  if(customDetail){
    $('#endText').textContent = `${modeStr}${customDetail}
スコア: ${score.toLocaleString()} / 獲得ゴールド: +${earnedGold.toLocaleString()} G`;
  } else {
    $('#endText').textContent = win
      ? `${modeStr}全ウェーブを突破。世界平和は守られた！
スコア: ${score.toLocaleString()} / 獲得ゴールド: +${earnedGold.toLocaleString()} G`
      : `${modeStr}世界平和ゲージが尽きた。再挑戦しよう。
スコア: ${score.toLocaleString()} / 獲得ゴールド: +${earnedGold.toLocaleString()} G`;
  }
}

export function hideEndScreen(){$('#endOverlay').classList.remove('visible')}

export function setModeUI(mode, equippedSkin, isCoop=false, isHost=true, battleGameMode='FALL_MISSILE'){
  document.body.classList.toggle('mode-battle', mode === 'battle');

  const battleElements = document.querySelectorAll('.battle-only');
  battleElements.forEach(el => {
    if(mode === 'battle') el.classList.remove('hidden-mode');
    else el.classList.add('hidden-mode');
  });

  // AIR STRIKE時はレティクルと射撃ボタンを非表示
  const reticle = $('#reticle');
  const fireWrap = $('#fireWrap');
  if(mode === 'battle' && battleGameMode === 'AIR_STRIKE'){
    if(reticle) reticle.classList.add('hidden-mode');
    if(fireWrap) fireWrap.classList.add('hidden-mode');
  }
  
  const modeBanner = $('#modeBanner');
  if(mode === 'home'){
    const coopInfo = isCoop ? ' [共闘ルーム接続中]' : '';
    modeBanner.textContent = `HOME BASE — 装備中: ${equippedSkin.label}${coopInfo}`;
    modeBanner.classList.remove('hidden-mode');
  } else if(mode === 'skin'){
    modeBanner.textContent = `HANGAR — 中央青: 1秒接触で機体変更パネル / 東緑: 機体ショップ`;
    modeBanner.classList.remove('hidden-mode');
  } else {
    modeBanner.classList.add('hidden-mode');
  }
}

let toastTimer = null;
export function showToast(msg, duration=3200){
  const el = $('#toastBanner');
  if(!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('hidden');
  }, duration);
}

export function updateHoldGauge(ratio){
  const wrap = $('#holdGaugeWrap');
  if(ratio <= 0){
    wrap.classList.add('hidden');
  } else {
    wrap.classList.remove('hidden');
    $('#holdGaugeFill').style.width = Math.min(100, Math.round(ratio * 100)) + '%';
  }
}

export function setHudLabels(l1, l2, l3){
  const s1 = $('#stat1Label');
  const s2 = $('#stat2Label');
  const s3 = $('#stat3Label');
  if(s1) s1.textContent = l1;
  if(s2) s2.textContent = l2;
  if(s3) s3.textContent = l3;
}

export function hud(w, r, p, maxWave=5){
  setHudLabels('WAVE', 'TARGETS', 'PEACE');
  $('#wave').textContent = `${w} / ${maxWave}`;
  $('#remaining').textContent = r;
  $('#peace').textContent = Math.round(p) + '%';
}

export function airStrikeHud(altitudeM, survivedM, scoreVal){
  setHudLabels('ALTITUDE', 'SURVIVED', 'SCORE');
  $('#wave').textContent = `${Math.max(0, Math.round(altitudeM))}m`;
  $('#remaining').textContent = `${Math.max(0, Math.round(survivedM))}m`;
  $('#peace').textContent = scoreVal.toLocaleString();
}

export function announce(t){$('#announce').textContent=t}
