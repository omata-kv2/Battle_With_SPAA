export const $=s=>document.querySelector(s);
export function progress(n,t){$('#loadFill').style.width=n+'%';$('#loadText').textContent=t+' '+n+'%'}
export function loading(){$('#startOverlay').classList.add('visible');$('#loadArea').classList.remove('hidden');$('#tapStartBtn').disabled=true;$('#tapStartBtn').textContent='LOADING…';}
export function loadError(t){$('#loadText').textContent='エラー：'+t;$('#tapStartBtn').disabled=false;$('#tapStartBtn').textContent='RETRY'}
export function hideStartScreen(){$('#startOverlay').classList.remove('visible')}
export function showEndScreen(win,score,earnedGold, isCoop=false){
  $('#endOverlay').classList.add('visible');
  $('#endEyebrow').textContent=win?'WORLD PEACE RESTORED':'DEFENSE SYSTEM OFFLINE';
  $('#endTitle').innerHTML=win?'MISSION<br>COMPLETE':'MISSION<br>FAILED';
  const modeStr = isCoop ? '【共闘モード】' : '';
  $('#endText').textContent=win?`${modeStr}全5ウェーブを突破。世界平和は守られた！\nスコア: ${score} / 獲得ゴールド: +${earnedGold}G`:'世界平和ゲージが尽きた。再挑戦しよう。';
}
export function hideEndScreen(){$('#endOverlay').classList.remove('visible')}
export function setModeUI(mode, equippedSkin, isCoop=false, isHost=true){
  document.body.classList.toggle('mode-battle', mode === 'battle');

  const battleElements = document.querySelectorAll('.battle-only');
  battleElements.forEach(el => {
    if(mode === 'battle') el.classList.remove('hidden-mode');
    else el.classList.add('hidden-mode');
  });
  
  const modeBanner = $('#modeBanner');
  if(mode === 'home'){
    const coopInfo = isCoop ? ' [共闘ルーム接続中]' : '';
    modeBanner.textContent = `HOME BASE — 装備中: ${equippedSkin.label}${coopInfo}`;
    modeBanner.classList.remove('hidden-mode');
  } else if(mode === 'skin'){
    modeBanner.textContent = `SKIN ROOM — 中央青: 1秒接触でスキン選択 / 東緑: ストア購入`;
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
export function hud(w,r,p){$('#wave').textContent=`${w} / 5`;$('#remaining').textContent=r;$('#peace').textContent=Math.round(p)+'%'}
export function announce(t){$('#announce').textContent=t}
