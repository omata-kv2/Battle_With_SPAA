export const $=s=>document.querySelector(s);
export function progress(n,t){$('#loadFill').style.width=n+'%';$('#loadText').textContent=t+' '+n+'%'}
export function loading(){$('#startOverlay').classList.add('visible');$('#loadArea').classList.remove('hidden');$('#tapStartBtn').disabled=true;$('#tapStartBtn').textContent='LOADING…';}
export function loadError(t){$('#loadText').textContent='エラー：'+t;$('#tapStartBtn').disabled=false;$('#tapStartBtn').textContent='RETRY'}
export function hideStartScreen(){$('#startOverlay').classList.remove('visible')}
export function showEndScreen(win,score,earnedGold){
  $('#endOverlay').classList.add('visible');
  $('#endEyebrow').textContent=win?'WORLD PEACE RESTORED':'DEFENSE SYSTEM OFFLINE';
  $('#endTitle').innerHTML=win?'MISSION<br>COMPLETE':'MISSION<br>FAILED';
  $('#endText').textContent=win?`全5ウェーブを突破。世界平和は守られた！
スコア: ${score} / 獲得ゴールド: +${earnedGold}G`:'世界平和ゲージが尽きた。再挑戦しよう。';
}
export function hideEndScreen(){$('#endOverlay').classList.remove('visible')}
export function setModeUI(mode, equippedSkin){
  const battleElements = document.querySelectorAll('.battle-only');
  battleElements.forEach(el => {
    if(mode === 'battle') el.classList.remove('hidden-mode');
    else el.classList.add('hidden-mode');
  });
  
  const modeBanner = $('#modeBanner');
  if(mode === 'home'){
    modeBanner.textContent = `HOME BASE (10×10) — 装備中: ${equippedSkin.label}`;
    modeBanner.classList.remove('hidden-mode');
  } else if(mode === 'skin'){
    modeBanner.textContent = `SKIN ROOM — 中央青: 1秒接触で装備選択 / 東緑: ストア購入`;
    modeBanner.classList.remove('hidden-mode');
  } else {
    modeBanner.classList.add('hidden-mode');
  }
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
