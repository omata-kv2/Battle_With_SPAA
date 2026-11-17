export const $=s=>document.querySelector(s);
export function progress(n,t){$('#loadFill').style.width=n+'%';$('#loadText').textContent=t+' '+n+'%'}
export function loading(){$('#overlay').classList.add('visible');$('#loadArea').classList.remove('hidden');$('#start').disabled=true;$('#start').textContent='LOADING…';$('#overlayText').textContent='ゲームデータを準備しています。'}
export function loadError(t){$('#loadText').textContent='エラー：'+t;$('#overlayText').textContent='読み込みに失敗しました。通信状態・WebGL・GitHubの配置を確認してください。';$('#start').disabled=false;$('#start').textContent='RETRY'}
export function hideMenu(){$('#overlay').classList.remove('visible')}
export function hud(w,r,p){$('#wave').textContent=`${w} / 5`;$('#remaining').textContent=r;$('#peace').textContent=Math.round(p)+'%'}
export function announce(t){$('#announce').textContent=t}
export function endScreen(win,n){$('#overlay').classList.add('visible');$('#loadArea').classList.add('hidden');$('.eyebrow').textContent=win?'WORLD PEACE RESTORED':'DEFENSE SYSTEM OFFLINE';$('h1').innerHTML=win?'MISSION<br>COMPLETE':'MISSION<br>FAILED';$('#overlayText').textContent=win?'全5ウェーブを突破。世界平和は守られた。':'世界平和ゲージが尽きた。再挑戦しよう。';$('.tips').textContent='撃退したターゲット：'+n;$('#start').disabled=false;$('#start').textContent='PLAY AGAIN'}
