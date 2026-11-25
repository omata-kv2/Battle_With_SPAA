import { SHOP_ITEMS } from './config.js';
import { state, saveGameData } from './state.js';
import { $, updateInventoryBar, showToast } from './ui.js';
import { resetMovementInputs } from './controls.js';
import { closeAllModals, openSkinStoreModal, openCoopModal } from './modals.js';

const HOME_PORTALS_MAP = [
  { id: 'battle', name: '出撃ゲート', color: '#00f5d4', x: -4.6, z: -20.3, tx: -4.6, tz: -17.0, yaw: 0 },
  { id: 'yaju',   name: 'YAJUMAZE',   color: '#ff4d6d', x: 4.6,  z: -20.3, tx: 4.6,  tz: -17.0, yaw: 0 },
  { id: 'skin',   name: '機体格納庫', color: '#ff9233', x: 20.3, z: 0,     tx: 17.0, tz: 0,     yaw: -Math.PI / 2 },
  { id: 'coop',   name: 'フレンド共闘', color: '#38c8f0', x: -20.3, z: 0,   tx: -17.0, tz: 0,    yaw: Math.PI / 2 },
  { id: 'store',  name: 'ストア',     color: '#ffd23f', x: 0,    z: 20.3,  tx: 0,    tz: 17.0,  yaw: Math.PI }
];

let selectedSlotIndex = 0;
let pendingMapPortal = null;
let mysteryTimers = [];

function clearMysteryTimers(){
  for(const tid of mysteryTimers) clearTimeout(tid);
  mysteryTimers = [];
}

export function openPdaModal(initialView = 'home'){
  if(state.gameMode !== 'home') return;
  resetMovementInputs();
  closeAllModals();
  state.modalOpen = true;
  switchPdaView(initialView);
  $('#pdaModal')?.classList.add('visible');
}

export function closePdaModal(){
  $('#pdaModal')?.classList.remove('visible');
  state.modalOpen = false;
  pendingMapPortal = null;
}

export function switchPdaView(view){
  const views = ['home', 'map', 'bag', 'gacha'];
  views.forEach(v => {
    const el = $(`#pdaView_${v}`);
    if(el) el.classList.toggle('hidden', v !== view);
  });

  const backBtn = $('#pdaBackBtn');
  const titleEl = $('#pdaHeaderTitle');
  if(backBtn) backBtn.classList.toggle('hidden', view === 'home');

  const titles = {
    home: '情報機器 — HOME',
    map: 'マップ（ホームベース）',
    bag: '持ち物（インベントリ設定）',
    gacha: 'ガチャ（試験導入版）'
  };
  if(titleEl) titleEl.textContent = titles[view] || '情報機器';

  if(view === 'map') renderPdaMap();
  if(view === 'bag') renderPdaBag();
  if(view === 'gacha') renderPdaGacha();
}

function renderPdaMap(){
  const canvas = $('#pdaMapCanvas');
  const confirmBox = $('#pdaMapConfirmBox');
  const legendBox = $('#pdaMapLegend');
  if(confirmBox){
    confirmBox.classList.toggle('hidden', !pendingMapPortal);
    if(pendingMapPortal){
      $('#pdaMapConfirmText').textContent = `${pendingMapPortal.name}ポータルへ移動しますか？`;
    }
  }

  if(canvas){
    const size = 240;
    const toPx = (val) => ((val + 21) / 42) * size;
    canvas.innerHTML = '';

    // プレイヤー現在地
    const pDot = document.createElement('div');
    pDot.className = 'pda-map-player';
    pDot.style.left = `${toPx(state.x)}px`;
    pDot.style.top = `${toPx(state.z)}px`;
    pDot.title = '現在地';
    canvas.appendChild(pDot);

    HOME_PORTALS_MAP.forEach(pt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pda-map-portal-dot';
      btn.style.left = `${toPx(pt.x)}px`;
      btn.style.top = `${toPx(pt.z)}px`;
      btn.style.background = pt.color;
      btn.style.boxShadow = `0 0 10px ${pt.color}`;
      btn.title = pt.name;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pendingMapPortal = pt;
        renderPdaMap();
      });
      canvas.appendChild(btn);
    });
  }

  if(legendBox){
    legendBox.innerHTML = HOME_PORTALS_MAP.map(pt =>
      `<span class="pda-legend-item"><i style="background:${pt.color}"></i>${pt.name}</span>`
    ).join('');
  }
}

export function confirmPdaMapMove(yes){
  if(!yes){
    pendingMapPortal = null;
    renderPdaMap();
    return;
  }
  if(pendingMapPortal){
    const pt = pendingMapPortal;
    pendingMapPortal = null;
    state.x = pt.tx;
    state.z = pt.tz;
    state.yaw = pt.yaw;
    state.pitch = -0.05;
    state.triggerCooldown = 20;
    closePdaModal();
    showToast(`${pt.name}ポータル前へ移動しました`);
  }
}

function renderPdaBag(){
  const slotsWrap = $('#pdaBagSlots');
  const listWrap = $('#pdaBagItemList');

  if(slotsWrap){
    slotsWrap.innerHTML = '';
    [0, 1, 2].forEach(idx => {
      const itemId = state.equippedItems[idx];
      const item = itemId ? SHOP_ITEMS.find(it => it.id === itemId) : null;
      const count = item ? (state.inventory[item.id] || 0) : 0;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pda-bag-slot' + (selectedSlotIndex === idx ? ' selected' : '');
      btn.innerHTML = `
        <span class="pda-slot-num">枠 ${idx + 1}</span>
        <strong style="color:${item ? item.color : '#8fb4cc'}">${item ? item.shortName : '未セット'}</strong>
        <small>${item ? `${count}個` : '空'}</small>
      `;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        selectedSlotIndex = idx;
        renderPdaBag();
      });
      slotsWrap.appendChild(btn);
    });
  }

  if(listWrap){
    listWrap.innerHTML = '';
    SHOP_ITEMS.forEach(item => {
      const count = state.inventory[item.id] || 0;
      const equippedAt = state.equippedItems.indexOf(item.id);
      const card = document.createElement('div');
      card.className = 'skin-card';
      card.innerHTML = `
        <div class="skin-swatch" style="background:${item.color};color:#071522">${item.shortName}</div>
        <div class="skin-info">
          <div class="skin-title">${item.name}（所持: ${count}個）</div>
          <div class="skin-desc">${item.desc}</div>
          <div class="skin-skill-tag">${equippedAt >= 0 ? `現在 枠${equippedAt + 1} にセット中` : '未セット'}</div>
        </div>
        <button type="button" class="buy-btn">枠${selectedSlotIndex + 1}にセット</button>
      `;
      card.querySelector('button').addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const prevIdx = state.equippedItems.indexOf(item.id);
        if(prevIdx >= 0 && prevIdx !== selectedSlotIndex){
          state.equippedItems[prevIdx] = state.equippedItems[selectedSlotIndex];
        }
        state.equippedItems[selectedSlotIndex] = item.id;
        saveGameData();
        updateInventoryBar();
        renderPdaBag();
      });
      listWrap.appendChild(card);
    });
  }
}

export function clearSelectedBagSlot(){
  state.equippedItems[selectedSlotIndex] = null;
  saveGameData();
  updateInventoryBar();
  renderPdaBag();
}

function renderPdaGacha(){
  const coinEl = $('#pdaGachaCoins');
  const msgEl = $('#pdaGachaMsg');
  if(coinEl) coinEl.textContent = (state.yajuCoins || 0).toLocaleString();
  if(msgEl) msgEl.textContent = '';
}

export function triggerPdaGachaTest(){
  const msgEl = $('#pdaGachaMsg');
  if(msgEl) msgEl.textContent = '試験導入版なので、まだ引けません';
}

let kingPreloadStarted = false;
export function preloadKingVideoInBackground(){
  if(kingPreloadStarted) return;
  const videoEl = $('#pdaKingVideo');
  if(!videoEl) return;
  kingPreloadStarted = true;
  if(!videoEl.getAttribute('src')) videoEl.src = 'https://github.com/omata-kv2/Battle_With_SPAA/releases/download/v1.0/KING.mp4';
  videoEl.preload = 'auto';
  try { videoEl.load(); } catch(_e){}
}

export function startPdaMysterySequence(){
  clearMysteryTimers();
  const ov = $('#pdaMysteryOverlay');
  const statusEl = $('#pdaMysteryStatus');
  const videoEl = $('#pdaKingVideo');
  if(!ov || !statusEl || !videoEl) return;

  // 初期状態にリセット（背面待機）
  ov.classList.remove('hidden', 'fade-in', 'fade-out');
  ov.style.opacity = '0';
  statusEl.classList.add('hidden');
  videoEl.classList.add('hidden');
  videoEl.style.zIndex = '-1';
  videoEl.style.opacity = '1';
  videoEl.style.transition = '';

  // タップイベント内でiPad/iOS Safariの再生許可を事前アンロックし、バックグラウンド読込を継続
  if(!videoEl.getAttribute('src')) videoEl.src = 'https://github.com/omata-kv2/Battle_With_SPAA/releases/download/v1.0/KING.mp4';
  videoEl.preload = 'auto';
  try{
    videoEl.muted = true;
    const unlockP = videoEl.play();
    if(unlockP && unlockP.then){
      unlockP.then(() => {
        videoEl.pause();
        videoEl.currentTime = 0;
        videoEl.muted = false;
      }).catch(() => {
        videoEl.muted = false;
      });
    } else {
      videoEl.pause();
      videoEl.currentTime = 0;
      videoEl.muted = false;
    }
  }catch(_e){
    videoEl.muted = false;
  }

  // 1. 3秒かけて画面全体を暗くフェードアウト
  requestAnimationFrame(() => {
    ov.style.transition = 'opacity 3.0s linear';
    ov.style.opacity = '1';
  });

  const beginPlayback = () => {
    statusEl.classList.add('hidden');
    videoEl.classList.remove('hidden');
    videoEl.style.zIndex = '2';
    videoEl.muted = false;
    const p = videoEl.play();
    if(p !== undefined){
      p.catch(() => {
        videoEl.muted = true;
        videoEl.play().catch(() => {});
        const unmuteOnTap = () => {
          videoEl.muted = false;
          ov.removeEventListener('pointerdown', unmuteOnTap);
        };
        ov.addEventListener('pointerdown', unmuteOnTap);
      });
    }

    // 4. 再生開始から4分（240,000ms）経過後に暗くフェードアウトして情報機器へ戻る
    const t3 = setTimeout(() => {
      videoEl.style.transition = 'opacity 1.5s linear';
      videoEl.style.opacity = '0';
      const t4 = setTimeout(() => {
        videoEl.pause();
        videoEl.currentTime = 0;
        videoEl.style.opacity = '1';
        videoEl.style.transition = '';
        videoEl.classList.add('hidden');
        ov.classList.add('hidden');
        ov.style.opacity = '0';
        openPdaModal('home');
      }, 1600);
      mysteryTimers.push(t4);
    }, 240000);
    mysteryTimers.push(t3);
  };

  // 2. 3秒後：真っ暗になり終えたら「🎥動画を読み込んでいます…」をゆっくり点滅
  const t1 = setTimeout(() => {
    statusEl.classList.remove('hidden');
    if(videoEl.readyState < 2){
      try { videoEl.load(); } catch(_e){}
    }

    // 3. 最低3秒待機し、かつ動画が再生可能状態(readyState >= 2)になるまで待ってから再生開始
    let minWaitDone = false;
    let started = false;
    const tryStart = () => {
      if(started || !minWaitDone) return;
      if(videoEl.readyState >= 2){
        started = true;
        videoEl.removeEventListener('canplay', tryStart);
        videoEl.removeEventListener('loadeddata', tryStart);
        beginPlayback();
      }
    };
    videoEl.addEventListener('canplay', tryStart);
    videoEl.addEventListener('loadeddata', tryStart);

    const t2 = setTimeout(() => {
      minWaitDone = true;
      tryStart();
    }, 3000);
    // 大容量回線でも最大18秒で強制試行
    const tMax = setTimeout(() => {
      if(!started){
        started = true;
        videoEl.removeEventListener('canplay', tryStart);
        videoEl.removeEventListener('loadeddata', tryStart);
        beginPlayback();
      }
    }, 60000);
    mysteryTimers.push(t2, tMax);
  }, 3000);
  mysteryTimers.push(t1);
}

export function initPdaEvents(){
  preloadKingVideoInBackground();
  $('#pdaOpenBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openPdaModal('home');
  });
  $('#pdaCloseBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    closePdaModal();
  });
  $('#pdaBackBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pendingMapPortal = null;
    switchPdaView('home');
  });

  $('#pdaAppMapBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pendingMapPortal = null;
    switchPdaView('map');
  });
  $('#pdaAppBagBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    switchPdaView('bag');
  });
  $('#pdaAppStoreBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    closePdaModal();
    openSkinStoreModal('items');
  });
  $('#pdaAppGachaBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    switchPdaView('gacha');
  });
  $('#pdaAppFriendBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    closePdaModal();
    openCoopModal();
  });
  $('#pdaAppMysteryBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    closePdaModal();
    startPdaMysterySequence();
  });

  $('#pdaMapYesBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    confirmPdaMapMove(true);
  });
  $('#pdaMapNoBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    confirmPdaMapMove(false);
  });
  $('#pdaBagClearBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    clearSelectedBagSlot();
  });
  $('#pdaGachaSingleBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    triggerPdaGachaTest();
  });
  $('#pdaGachaMultiBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    triggerPdaGachaTest();
  });
}
