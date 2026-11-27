import { SHOP_ITEMS } from './config.js';
import { state, saveGameData, getEquippedSkin, getRequiredXpForLevel, exportSaveCode } from './state.js';
import { $, updateInventoryBar, showToast } from './ui.js';
import { playSfx } from './sfx.js';
import { resetMovementInputs } from './controls.js';
import { closeAllModals, openSkinStoreModal, openCoopModal } from './modals.js';
import { expandChat, collapseChat } from './multiplayer.js';

const HOME_PORTALS_MAP = [
  { id: 'playwars', name: 'PlayWars', color: '#c77dff', x: -12.8, z: -20.3, tx: -12.8, tz: -17.0, yaw: 0 },
  { id: 'battle', name: '出撃ゲート', color: '#00f5d4', x: -4.6, z: -20.3, tx: -4.6, tz: -17.0, yaw: 0 },
  { id: 'yaju',   name: 'YAJUMAZE',   color: '#ff4d6d', x: 4.6,  z: -20.3, tx: 4.6,  tz: -17.0, yaw: 0 },
  { id: 'skin',   name: '機体格納庫', color: '#ff9233', x: 20.3, z: -4.2,  tx: 17.0, tz: -4.2,  yaw: -Math.PI / 2 },
  { id: 'test',   name: 'テストルーム', color: '#a8ff60', x: 20.3, z: 4.2, tx: 17.0, tz: 4.2,   yaw: -Math.PI / 2 },
  { id: 'coop',   name: 'フレンド共闘', color: '#38c8f0', x: -20.3, z: 0,   tx: -17.0, tz: 0,    yaw: Math.PI / 2 },
  { id: 'store',  name: 'ストア',     color: '#ffd23f', x: 0,    z: 20.3,  tx: 0,    tz: 17.0,  yaw: Math.PI }
];

let selectedSlotIndex = 0;
let pendingMapPortal = null;
let mysteryTimers = [];
let gachaBusy = false;

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
  playSfx('pda_open', 0.75);
  $('#pdaModal')?.classList.add('visible');
}

export function closePdaModal(){
  if(gachaBusy) return;
  collapseChat();
  $('#pdaModal')?.classList.remove('visible');
  state.modalOpen = false;
  pendingMapPortal = null;
}

export function switchPdaView(view){
  if(gachaBusy) return;
  const views = ['home', 'map', 'bag', 'chat', 'player'];
  views.forEach(v => {
    const el = $(`#pdaView_${v}`);
    if(el) el.classList.toggle('hidden', v !== view);
  });

  if(view === 'chat'){
    expandChat();
  } else {
    collapseChat();
  }

  const backBtn = $('#pdaBackBtn');
  const titleEl = $('#pdaHeaderTitle');
  if(backBtn) backBtn.classList.toggle('hidden', view === 'home');

  const titles = {
    home: 'SPAA TACTICAL TERMINAL',
    map: 'マップ（ホームベース）',
    bag: '持ち物（インベントリ設定）',
    chat: '全体チャット',
    gacha: 'YAJUガチャ',
    player: 'プレイヤー詳細'
  };
  if(titleEl) titleEl.textContent = titles[view] || '情報機器';

  if(view === 'map') renderPdaMap();
  if(view === 'bag') renderPdaBag();
  if(view === 'player') renderPdaPlayer();
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

const GACHA_BANNERS = [
  {
    id: 'yaju',
    name: 'YAJUガチャ',
    subtitle: '1回 100Y / 10連 1,000Y',
    featured: [
      { rarity: 'UR', name: '電磁防御システム', desc: 'YAJU系で8秒間無敵 / FallMissileで敵7秒停止', icon: '🛡️', imgPaths: ['./assets/gacha/emp_shield.png'] },
      { rarity: 'UR', name: '獣神化パワーストーン', desc: '使用した試合の報酬・XP獲得数が2倍', icon: '💎', imgPaths: ['./assets/gacha/beast_god_stone.png'] },
      { rarity: 'USSR', name: '水素爆弾', desc: '敵を7秒間停止＆敵全体に1000ダメージ', icon: '☢️', imgPaths: ['./assets/USSR.png', './assets/gacha/USSR.png', './assets/chasers/USSR.png'] },
      { rarity: 'yajUR', name: '野獣型原子爆弾', desc: '敵を7秒間停止＆1000ダメージの究極兵器', icon: '👑', imgPaths: ['./assets/chasers/inmu_king.png', './assets/inmu_king.png'] }
    ]
  }
];

let activeBannerId = 'yaju';
let showcaseTimer = null;
let showcaseIndex = 0;

function sleepMs(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setGachaUiDisabled(disabled){
  gachaBusy = disabled;
  ['#gachaSingleBtn', '#gachaMultiBtn', '#gachaBackToPdaBtn', '#gachaRatesBtn', '#gachaSidebarToggleBtn'].forEach(sel => {
    const el = $(sel);
    if(el) el.disabled = disabled;
  });
}

function updateGachaCurrencyUI(){
  const gEl = $('#gachaGoldVal');
  const cEl = $('#gachaCoinVal');
  if(gEl) gEl.textContent = (state.gold || 0).toLocaleString();
  if(cEl) cEl.textContent = (state.yajuCoins || 0).toLocaleString();
}

function renderGachaBannerList(){
  const listEl = $('#gachaBannerList');
  if(!listEl) return;
  listEl.innerHTML = '';
  GACHA_BANNERS.forEach(b => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gacha-banner-item' + (b.id === activeBannerId ? ' active' : '');
    btn.innerHTML = `<strong>${b.name}</strong><span>${b.subtitle}</span>`;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if(gachaBusy) return;
      activeBannerId = b.id;
      const titleEl = $('#gachaActiveTitle');
      if(titleEl) titleEl.textContent = b.name;
      renderGachaBannerList();
      startGachaShowcaseLoop();
    });
    listEl.appendChild(btn);
  });
}

function renderShowcaseItem(item){
  const slide = $('#gachaBgSlide');
  if(!slide || !item) return;
  slide.classList.add('fading');
  setTimeout(() => {
    slide.innerHTML = '';
    const rClass = `rarity-${item.rarity.toLowerCase()}`;
    const fallbackCard = () => {
      slide.innerHTML = `
        <div class="gacha-showcase-card ${rClass}">
          <div class="gacha-showcase-icon">${item.icon || '✨'}</div>
          <div class="gacha-showcase-rarity">FEATURED ${item.rarity}</div>
          <div class="gacha-showcase-title">${item.name}</div>
          <div class="gacha-showcase-desc">${item.desc}</div>
        </div>
      `;
    };
    if(item.imgPaths && item.imgPaths.length > 0){
      const img = document.createElement('img');
      img.className = 'gacha-bg-img';
      img.alt = item.name;
      let idx = 0;
      const tryImg = () => {
        if(idx >= item.imgPaths.length){
          fallbackCard();
          return;
        }
        img.src = item.imgPaths[idx++];
      };
      img.onerror = tryImg;
      img.onload = () => {
        if(img.naturalWidth <= 1){
          tryImg();
        }
      };
      slide.appendChild(img);
      tryImg();
    } else {
      fallbackCard();
    }
    slide.classList.remove('fading');
  }, 260);
}

function startGachaShowcaseLoop(){
  if(showcaseTimer){
    clearInterval(showcaseTimer);
    showcaseTimer = null;
  }
  const banner = GACHA_BANNERS.find(b => b.id === activeBannerId) || GACHA_BANNERS[0];
  const items = banner?.featured || [];
  if(items.length === 0) return;
  showcaseIndex = 0;
  renderShowcaseItem(items[0]);
  showcaseTimer = setInterval(() => {
    showcaseIndex = (showcaseIndex + 1) % items.length;
    renderShowcaseItem(items[showcaseIndex]);
  }, 5000);
}

function stopGachaShowcaseLoop(){
  if(showcaseTimer){
    clearInterval(showcaseTimer);
    showcaseTimer = null;
  }
}

function unlockGachaAudio(){
  ['#gacha-audio-ussr', '#gacha-audio-yajur'].forEach(sel => {
    const el = $(sel);
    if(!el) return;
    try{
      el.muted = true;
      const p = el.play();
      if(p && p.then){
        p.then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = false;
        }).catch(() => {
          el.muted = false;
        });
      } else {
        el.pause();
        el.currentTime = 0;
        el.muted = false;
      }
    }catch(_e){
      el.muted = false;
    }
  });
}

export function openGachaScreen(){
  if(state.gameMode !== 'home') return;
  resetMovementInputs();
  closeAllModals();
  state.modalOpen = true;
  updateGachaCurrencyUI();
  renderGachaBannerList();
  const msgEl = $('#gachaMsg');
  const wrapEl = $('#gachaResultsWrap');
  const gridEl = $('#gachaResultsGrid');
  if(msgEl) msgEl.textContent = '';
  if(wrapEl) wrapEl.classList.add('hidden');
  if(gridEl) gridEl.innerHTML = '';
  $('#gachaScreen')?.classList.remove('hidden');
  startGachaShowcaseLoop();
  playSfx('pda_open', 0.7);
}

export function closeGachaScreen(returnToPda = true){
  if(gachaBusy) return;
  stopGachaShowcaseLoop();
  $('#gachaRatesModal')?.classList.remove('visible');
  $('#gachaScreen')?.classList.add('hidden');
  state.modalOpen = false;
  if(returnToPda){
    openPdaModal('home');
  }
}

function rollGachaOnce(){
  const r = Math.random();
  if(r < 0.70){
    return { rarity: 'R', kind: 'gold', amount: 5000, name: '5,000 G' };
  }
  if(r < 0.95){
    if(Math.random() < 0.20){
      return { rarity: 'SR', kind: 'gold', amount: 10000, name: '10,000 G' };
    }
    const srStones = [
      { itemId: 'hp_full', name: '全回復石' },
      { itemId: 'hp_half', name: '半分回復石' },
      { itemId: 'power_double', name: '火力2倍石' },
      { itemId: 'speed_up', name: '移動速度上昇石' }
    ];
    const picked = srStones[Math.floor(Math.random() * srStones.length)];
    return { rarity: 'SR', kind: 'item', itemId: picked.itemId, name: picked.name };
  }
  if(r < 0.99){
    if(Math.random() < 0.20){
      return { rarity: 'UR', kind: 'gold', amount: 15000, name: '15,000 G' };
    }
    const urItems = [
      { itemId: 'emp_shield', name: '電磁防御' },
      { itemId: 'beast_god_stone', name: '獣神化石' }
    ];
    const picked = urItems[Math.floor(Math.random() * urItems.length)];
    return { rarity: 'UR', kind: 'item', itemId: picked.itemId, name: picked.name };
  }
  if(r < 0.995){
    return { rarity: 'USSR', kind: 'item', itemId: 'hydrogen_bomb', name: '水素爆弾' };
  }
  return { rarity: 'yajUR', kind: 'item', itemId: 'yaju_nuke', name: '野獣原爆' };
}

function buildGachaCardElement(reward, revealed = true){
  const card = document.createElement('div');
  if(!revealed){
    card.className = 'gacha-card gacha-card-unrevealed';
    card.textContent = '?';
    return card;
  }
  const rClass = `gacha-card-${reward.rarity.toLowerCase()}`;
  card.className = `gacha-card ${rClass}`;
  if(reward.rarity === 'yajUR'){
    card.innerHTML = `
      <div class="gacha-card-yajur-inner">
        <span class="gacha-card-rarity">${reward.rarity}</span>
        <strong class="gacha-card-name">${reward.name}</strong>
      </div>
    `;
  } else {
    card.innerHTML = `
      <span class="gacha-card-rarity">${reward.rarity}</span>
      <strong class="gacha-card-name">${reward.name}</strong>
    `;
  }
  return card;
}

function loadWithFallback(el, paths, onFail){
  let idx = 0;
  const tryNext = () => {
    if(idx >= paths.length){
      if(onFail) onFail();
      return;
    }
    el.src = paths[idx++];
  };
  el.onerror = tryNext;
  tryNext();
}

function playGachaCutscene(rarity){
  return new Promise((resolve) => {
    const ov = $('#pdaGachaCutsceneOverlay');
    const imgEl = $('#pdaGachaCutsceneImg');
    const auraEl = $('#gachaCutsceneAura');
    const raysEl = $('#gachaCutsceneRays');
    const bannerEl = $('#gachaCutsceneBanner');
    const rarityEl = $('#gachaCutsceneRarity');
    const titleEl = $('#gachaCutsceneTitle');
    if(!ov || !imgEl){
      resolve();
      return;
    }

    let finished = false;
    const audioEl = rarity === 'USSR' ? $('#gacha-audio-ussr') : $('#gacha-audio-yajur');
    const timers = [];
    const finish = () => {
      if(finished) return;
      finished = true;
      timers.forEach(t => clearTimeout(t));
      if(audioEl){
        audioEl.onended = null;
        audioEl.onerror = null;
        try{ audioEl.pause(); audioEl.currentTime = 0; }catch(_e){}
      }
      imgEl.onerror = null;
      imgEl.classList.add('hidden');
      imgEl.style.opacity = '0';
      imgEl.style.transform = 'scale(0.55)';
      imgEl.style.transition = '';
      if(auraEl){ auraEl.className = 'gacha-cutscene-aura'; auraEl.style.opacity = '0'; }
      if(raysEl){ raysEl.style.opacity = '0'; }
      if(bannerEl){ bannerEl.classList.add('hidden'); }
      ov.classList.add('hidden');
      ov.style.opacity = '0';
      ov.style.transition = '';
      resolve();
    };

    // Reset overlay
    ov.classList.remove('hidden');
    ov.style.transition = '';
    ov.style.opacity = '0';
    imgEl.classList.add('hidden');
    imgEl.style.transition = '';
    imgEl.style.opacity = '0';
    imgEl.style.transform = 'scale(0.55)';
    if(auraEl){
      auraEl.className = `gacha-cutscene-aura ${rarity === 'USSR' ? 'ussr' : 'yajur'}`;
      auraEl.style.opacity = '0';
    }
    if(raysEl) raysEl.style.opacity = '0';
    if(bannerEl) bannerEl.classList.add('hidden');

    if(rarity === 'USSR'){
      loadWithFallback(imgEl, ['./assets/USSR.png', './assets/gacha/USSR.png', './assets/chasers/USSR.png']);
      if(rarityEl) rarityEl.textContent = 'USSR';
      if(titleEl) titleEl.textContent = '水素爆弾';
    } else {
      loadWithFallback(imgEl, ['./assets/chasers/inmu_king.png', './assets/inmu_king.png']);
      if(rarityEl) rarityEl.textContent = 'yajUR';
      if(titleEl) titleEl.textContent = '野獣型原子爆弾';
    }

    // 1. 1秒かけて暗転
    requestAnimationFrame(() => {
      ov.style.transition = 'opacity 1.0s linear';
      ov.style.opacity = '1';
    });

    // 2. 暗転完了(1s)後：オーラ＆集中線展開＋画像を2秒かけてフェードインしながら拡大して迫る
    timers.push(setTimeout(() => {
      if(auraEl) auraEl.style.opacity = '1';
      if(raysEl) raysEl.style.opacity = '0.85';
      if(bannerEl) bannerEl.classList.remove('hidden');
      imgEl.classList.remove('hidden');
      imgEl.style.opacity = '0';
      imgEl.style.transform = 'scale(0.55)';
      requestAnimationFrame(() => {
        imgEl.style.transition = 'opacity 2.0s ease-out, transform 2.0s cubic-bezier(.16,1,.3,1)';
        imgEl.style.opacity = '1';
        imgEl.style.transform = 'scale(1.12)';
      });
    }, 1000));

    if(rarity === 'USSR'){
      // 3. 暗転完了後から1秒後(t=2s)にUSSR.mp3を4秒再生
      timers.push(setTimeout(() => {
        if(audioEl){
          try{
            audioEl.muted = false;
            audioEl.currentTime = 0;
            audioEl.play().catch(() => {});
          }catch(_e){}
        }
      }, 2000));
      // 4. 画像フェードイン完了(t=3s)から1秒経過(t=4s)で操作可能に戻す（USSR.mp3は4秒再生後に停止）
      timers.push(setTimeout(() => {
        if(audioEl){
          setTimeout(() => {
            try{ audioEl.pause(); audioEl.currentTime = 0; }catch(_e){}
          }, 2000);
        }
        finish();
      }, 4000));
    } else {
      // yajUR: 暗転完了後から1秒後(t=2s)に114514.mp3を1回再生
      let minDone = false;
      let audioDone = false;
      const tryFinishYajur = () => {
        if(minDone && audioDone) finish();
      };
      if(audioEl){
        audioEl.onended = () => { audioDone = true; tryFinishYajur(); };
        audioEl.onerror = () => { audioDone = true; tryFinishYajur(); };
      } else {
        audioDone = true;
      }

      timers.push(setTimeout(() => {
        if(!audioEl){ audioDone = true; tryFinishYajur(); return; }
        try{
          audioEl.muted = false;
          audioEl.currentTime = 0;
          const p = audioEl.play();
          if(p && p.catch){
            p.catch(() => {
              audioDone = true;
              tryFinishYajur();
            });
          }
        }catch(_e){
          audioDone = true;
          tryFinishYajur();
        }
      }, 2000));

      timers.push(setTimeout(() => {
        minDone = true;
        tryFinishYajur();
      }, 4000));

      timers.push(setTimeout(() => finish(), 15000));
    }
  });
}

export async function triggerPdaGachaPull(count = 1){
  if(gachaBusy) return;
  const cost = count === 10 ? 1000 : 100;
  const msgEl = $('#gachaMsg');
  const wrapEl = $('#gachaResultsWrap');
  const gridEl = $('#gachaResultsGrid');

  if((state.yajuCoins || 0) < cost){
    if(msgEl) msgEl.textContent = `YAJUコインが足りません（必要: ${cost.toLocaleString()} Y）`;
    return;
  }

  state.yajuCoins -= cost;
  const rewards = [];
  for(let i = 0; i < count; i++){
    const rw = rollGachaOnce();
    rewards.push(rw);
    if(rw.kind === 'gold'){
      state.gold = (state.gold || 0) + rw.amount;
    } else if(rw.kind === 'item'){
      state.inventory[rw.itemId] = (state.inventory[rw.itemId] || 0) + 1;
    }
  }
  saveGameData();
  updateGachaCurrencyUI();
  state.homeController?.refreshCurrencyPanels?.(state.gold, state.yajuCoins);

  if(msgEl) msgEl.textContent = count === 10 ? '10連ガチャ結果' : 'ガチャ結果';
  if(!wrapEl || !gridEl) return;

  setGachaUiDisabled(true);
  wrapEl.classList.remove('hidden');
  gridEl.classList.toggle('single', count === 1);
  gridEl.innerHTML = '';

  const slots = rewards.map(() => {
    const c = buildGachaCardElement(null, false);
    gridEl.appendChild(c);
    return c;
  });

  try{
    for(let i = 0; i < rewards.length; i++){
      if(count === 10){
        await sleepMs(200);
      }
      const rw = rewards[i];
      const revealedCard = buildGachaCardElement(rw, true);
      slots[i].replaceWith(revealedCard);
      slots[i] = revealedCard;

      if(rw.rarity === 'USSR' || rw.rarity === 'yajUR'){
        await playGachaCutscene(rw.rarity);
      }
    }
  } finally {
    setGachaUiDisabled(false);
  }
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

  // 初期状態にリセット（display:noneにせず透明で背面待機させることで再生権を維持）
  ov.classList.remove('hidden', 'fade-in', 'fade-out');
  ov.style.opacity = '0';
  statusEl.classList.add('hidden');
  videoEl.classList.remove('hidden');
  videoEl.style.zIndex = '-1';
  videoEl.style.opacity = '0';
  videoEl.style.transition = '';

  // clickイベント内で音声付き再生権を事前アンロック（load()は再実行しない）
  if(!videoEl.getAttribute('src')) videoEl.src = 'https://github.com/omata-kv2/Battle_With_SPAA/releases/download/v1.0/KING.mp4';
  videoEl.preload = 'auto';
  try{
    videoEl.muted = false;
    const unlockP = videoEl.play();
    if(unlockP && unlockP.then){
      unlockP.then(() => {
        videoEl.pause();
        videoEl.currentTime = 0;
      }).catch(() => {});
    } else {
      videoEl.pause();
      videoEl.currentTime = 0;
    }
  }catch(_e){}

  // 1. 3秒かけて画面全体を暗くフェードアウト
  requestAnimationFrame(() => {
    ov.style.transition = 'opacity 3.0s linear';
    ov.style.opacity = '1';
  });

  const showVideoError = (msg) => {
    statusEl.classList.remove('hidden');
    statusEl.style.animation = 'none';
    statusEl.style.fontSize = '14px';
    statusEl.style.textAlign = 'center';
    statusEl.style.padding = '16px';
    statusEl.textContent = msg;
  };

  const onErr = () => {
    const code = videoEl.error ? videoEl.error.code : 'unknown';
    showVideoError(`動画の読み込みに失敗しました (Error code: ${code})\n学校のフィルタリングやURLアクセス制限の可能性があります。`);
  };
  videoEl.onerror = onErr;

  const beginPlayback = () => {
    if(videoEl.error){ onErr(); return; }
    statusEl.classList.add('hidden');
    videoEl.classList.remove('hidden');
    videoEl.style.zIndex = '2';
    videoEl.style.opacity = '1';
    videoEl.controls = false;
    videoEl.muted = false;
    const p = videoEl.play();
    if(p !== undefined){
      p.catch(() => {
        videoEl.muted = true;
        videoEl.play().catch(() => {
          videoEl.controls = true;
          showVideoError('▶ 画面をタップして動画を再生してください');
          const manualPlay = () => {
            statusEl.classList.add('hidden');
            videoEl.muted = false;
            videoEl.play().catch(() => {});
            ov.removeEventListener('pointerdown', manualPlay);
          };
          ov.addEventListener('pointerdown', manualPlay);
        });
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
    // ※再生権リセットを防ぐためここではload()を呼ばない

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

let pdaCallbacks = { enterTestRoom: null };
export function bindPdaCallbacks(cbs){ pdaCallbacks = { ...pdaCallbacks, ...cbs }; }

function renderPdaPlayer(){
  const lv = state.playerLevel || 1;
  const xp = state.playerXp || 0;
  const req = getRequiredXpForLevel(lv);
  if($('#pdaPlayerName')) $('#pdaPlayerName').textContent = state.username || '---';
  if($('#pdaPlayerCode')) $('#pdaPlayerCode').textContent = state.playerCode || 'SPAA------';
  if($('#pdaPlayerSkin')) $('#pdaPlayerSkin').textContent = getEquippedSkin().name;
  if($('#pdaPlayerLevel')) $('#pdaPlayerLevel').textContent = `Lv.${lv}`;
  if($('#pdaPlayerXpText')) $('#pdaPlayerXpText').textContent = `${xp} / ${req}`;
  if($('#pdaPlayerXpFill')) $('#pdaPlayerXpFill').style.width = `${Math.min(100, Math.round((xp / req) * 100))}%`;

  const friends = state.friends || [];
  if($('#pdaFriendCount')) $('#pdaFriendCount').textContent = String(friends.length);
  const fList = $('#pdaPlayerFriendsList');
  if(fList){
    fList.innerHTML = friends.length === 0
      ? '<span class="chat-empty-hint">フレンドはまだいません</span>'
      : friends.map(f => `<span class="pda-friend-chip">${f.name}</span>`).join('');
  }
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
    closePdaModal();
    openGachaScreen();
  });
  $('#pdaAppChatBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    switchPdaView('chat');
  });
  $('#pdaAppFriendBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    closePdaModal();
    openCoopModal();
  });
  $('#pdaAppMysteryBtn')?.addEventListener('click', (e) => {
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
  $('#gachaBackToPdaBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    closeGachaScreen(true);
  });
  $('#gachaSidebarToggleBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const sb = $('#gachaSidebar');
    const btn = $('#gachaSidebarToggleBtn');
    if(!sb || !btn) return;
    const isClosed = sb.classList.toggle('closed');
    sb.classList.toggle('open', !isClosed);
    btn.textContent = isClosed ? '▶' : '◀';
  });
  $('#gachaRatesBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    $('#gachaRatesModal')?.classList.add('visible');
  });
  $('#closeGachaRatesBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    $('#gachaRatesModal')?.classList.remove('visible');
  });
  $('#gachaSingleBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    unlockGachaAudio();
    triggerPdaGachaPull(1);
  });
  $('#gachaMultiBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    unlockGachaAudio();
    triggerPdaGachaPull(10);
  });

  $('#pdaAppPlayerBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    switchPdaView('player');
  });
  $('#pdaAppTestBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    closePdaModal();
    if(pdaCallbacks.enterTestRoom) pdaCallbacks.enterTestRoom();
  });
  $('#pdaIssueTransferBtn')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const box = $('#pdaTransferCodeBox');
    if(box) box.value = exportSaveCode();
    showToast('引き継ぎコードを発行しました');
  });
  $('#pdaCopyTransferBtn')?.addEventListener('pointerdown', async (e) => {
    e.preventDefault();
    const box = $('#pdaTransferCodeBox');
    if(!box || !box.value) return;
    try{
      await navigator.clipboard.writeText(box.value);
      showToast('引き継ぎコードをコピーしました');
    }catch(_e){
      box.select();
      document.execCommand('copy');
      showToast('引き継ぎコードをコピーしました');
    }
  });

}
