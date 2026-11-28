import { CONFIG, SHOP_ITEMS } from './config.js';
import { YAJU_BOSSES, YAJU_BOSS_DIFFICULTIES, YAJU_REWARDS } from './yaju-config.js';
import { PLAY_WARS_DIFFICULTIES } from './mode-play-wars.js';
import { state, getSkinUpgrade, getEquippedSkin, getEffectiveStats, getDifficultyById, saveGameData } from './state.js';
import { $, setModeUI, updateHoldGauge } from './ui.js';
import { playSfx } from './sfx.js';
import { resetMovementInputs } from './controls.js';
import { coopState, hasActiveRecruit } from './multiplayer.js';

export function closeAllModals(){
  state.modalOpen = false;
  state.panelHoldTime = 0;
  updateHoldGauge(0);
  const modals = [
    '#skinSelectModal',
    '#skinStoreModal',
    '#skinUpgradeModal',
    '#coopModal',
    '#usernameModal',
    '#battleSetupModal',
    '#coopWaitModal',
    '#coopInviteModal',
    '#yajuSetupModal',
    '#yajuBossSetupModal',
    '#yajuIpadWarnModal',
    '#playWarsSetupModal',
    '#pdaModal',
    '#gachaRatesModal',
    '#transferChoiceModal',
    '#transferImportModal'
  ];
  modals.forEach(id => {
    const el = $(id);
    if(el) el.classList.remove('visible');
  });
  $('#gachaScreen')?.classList.add('hidden');
}

function formatCoopModeLabel(mode, diffId, missionData){
  if(mode === 'YAJU_MAZE') return 'YAJUMAZE（迷路脱出）';
  if(mode === 'YAJU_BOSS'){
    const b = YAJU_BOSSES.find(x => x.id === missionData?.bossId);
    const d = YAJU_BOSS_DIFFICULTIES.find(x => x.id === diffId);
    return `YAJUMAZE ボス戦（${b ? b.name : 'BOSS'} / ${d ? d.name : diffId}）`;
  }
  if(mode === 'PLAY_WARS') return 'PlayWars（プレイヤー対決）';
  const diffObj = getDifficultyById(diffId);
  return `FALL MISSILE（${diffObj.name}）`;
}

export function openCoopWaitModal(mode, diffId, missionData = null){
  resetMovementInputs();
  closeAllModals();
  state.modalOpen = true;
  const modeLabel = formatCoopModeLabel(mode, diffId, missionData);
  const descEl = $('#coopWaitDesc');
  if(descEl){
    descEl.textContent = `【${modeLabel}】の参加要請を送信しました。相手が「参加」すると共闘で開始し、「拒否」するとソロモードで開始します。`;
  }
  const el = $('#coopWaitModal');
  if(el) el.classList.add('visible');
}

export function closeCoopWaitModal(){
  const el = $('#coopWaitModal');
  if(el) el.classList.remove('visible');
  state.modalOpen = false;
}

function renderCoopInvitePlayWarsSkins(){
  const wrap = $('#coopInvitePlayWarsSkinWrap');
  const list = $('#coopInvitePlayWarsSkinList');
  if(!wrap || !list) return;
  list.innerHTML = '';
  const allowed = CONFIG.SKINS.filter(s => state.unlockedSkins.includes(s.id));
  if(!allowed.some(s => s.id === state.selectedPlayWarsGuestSkinId)){
    state.selectedPlayWarsGuestSkinId = allowed[0] ? allowed[0].id : 'Origin';
  }
  allowed.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'diff-btn' + (state.selectedPlayWarsGuestSkinId === s.id ? ' selected' : '');
    btn.innerHTML = `<strong>${s.name}</strong><span>HP100 / DEF10</span>`;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      state.selectedPlayWarsGuestSkinId = s.id;
      renderCoopInvitePlayWarsSkins();
    });
    list.appendChild(btn);
  });
}

export function openCoopInviteModal(inviteData){
  resetMovementInputs();
  closeAllModals();
  state.modalOpen = true;
  const modeLabel = formatCoopModeLabel(inviteData.mode, inviteData.diffId, inviteData.missionData);
  const sender = inviteData.senderName || 'フレンド';
  const descEl = $('#coopInviteDesc');
  const sumEl = $('#coopInviteSummary');
  if(descEl){
    descEl.textContent = `${sender} が出撃準備を完了しました！参加しますか？`;
  }
  if(sumEl){
    sumEl.innerHTML = `モード: <b>${modeLabel}</b><br>※「拒否」を選ぶと相手のみソロモードで開始します。`;
  }
  const pwWrap = $('#coopInvitePlayWarsSkinWrap');
  if(pwWrap){
    const isPw = inviteData.mode === 'PLAY_WARS';
    pwWrap.classList.toggle('hidden', !isPw);
    if(isPw) renderCoopInvitePlayWarsSkins();
  }
  const el = $('#coopInviteModal');
  if(el) el.classList.add('visible');
}

export function closeCoopInviteModal(){
  const el = $('#coopInviteModal');
  if(el) el.classList.remove('visible');
  state.modalOpen = false;
}

export function openCoopModal(){
  resetMovementInputs();
  renderCoopFriendsList();
  renderCoopFriendsList();
  state.modalOpen = true;
  const leaveBtn = $('#leaveCoopRoomBtn');
  if(leaveBtn) leaveBtn.style.display = (coopState.isCoop || coopState.coopRoomCode) ? 'block' : 'none';
  const recruitBtn = $('#recruitCoopBtn');
  if(recruitBtn) recruitBtn.disabled = !(coopState.isHost && coopState.coopRoomCode && !coopState.isCoop);
  const cancelBtn = $('#cancelRecruitBtn');
  if(cancelBtn) cancelBtn.style.display = hasActiveRecruit() ? 'block' : 'none';
  $('#coopModal').classList.add('visible');
}

export function openBattleSetupModal(){
  resetMovementInputs();
  state.modalOpen = true;
  state.selectedBattleMode = null;
  state.selectedDifficultyId = null;
  renderBattleSetupModal();
  $('#battleSetupModal').classList.add('visible');
}

export function renderBattleSetupModal(){
  document.querySelectorAll('.setup-mode-btn').forEach(btn => {
    const m = btn.dataset.mode;
    btn.classList.toggle('selected', m === state.selectedBattleMode);
  });

  const modeChosen = !!state.selectedBattleMode;
  const lockHint = $('#diffLockHint');
  if(lockHint){
    lockHint.textContent = modeChosen
      ? '（難易度を選択してください）'
      : '（※先にゲームモードを選択してください）';
  }

  const grid = $('#difficultyBtnGrid');
  if(grid){
    grid.innerHTML = '';
    CONFIG.DIFFICULTIES.forEach(diff => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'setup-diff-btn' + (state.selectedDifficultyId === diff.id ? ' selected' : '');
      btn.disabled = !modeChosen;

      const waveText = state.selectedBattleMode === 'FALL_MISSILE' ? ` / ${diff.waves} WAVE` : '';
      btn.innerHTML = `
        <span>${diff.name}（${diff.jpName}）${waveText}</span>
        <span class="diff-swatches" title="床色 / 空色">
          <span class="diff-dot" style="background:${diff.groundHex}" title="床色"></span>
          <span class="diff-dot" style="background:${diff.skyHex}" title="空色"></span>
        </span>
      `;

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if(!state.selectedBattleMode) return;
        state.selectedDifficultyId = diff.id;
        renderBattleSetupModal();
      });

      grid.appendChild(btn);
    });
  }

  const preview = $('#setupPreviewBox');
  const startBtn = $('#confirmStartBattleBtn');
  const diffObj = CONFIG.DIFFICULTIES.find(d => d.id === state.selectedDifficultyId);

  if(startBtn){
    startBtn.disabled = !(state.selectedBattleMode && diffObj);
  }

  if(preview){
    if(!state.selectedBattleMode){
      preview.innerHTML = '① まず上の <b>FALL MISSILE</b> または <b>AIR STRIKE</b> を選択してください。';
    } else if(!diffObj){
      const modeName = state.selectedBattleMode === 'FALL_MISSILE' ? 'FALL MISSILE（地上迎撃防衛）' : 'AIR STRIKE（空挺ミサイル降下）';
      preview.innerHTML = `選択中モード: <b>${modeName}</b><br>② 次に難易度（EASY〜INSANE）を選択してください。`;
    } else {
      if(state.selectedBattleMode === 'FALL_MISSILE'){
        preview.innerHTML = `
          <b>【FALL MISSILE】 ${diffObj.name}（${diffObj.jpName}）</b><br>
          全 <b>${diffObj.waves} WAVE</b> 制 / ${diffObj.desc}<br>
          出撃機体: <b>${getEquippedSkin().name}</b>（固有能力: <b>${getEquippedSkin().skill.name}</b>）
        `;
      } else {
        preview.innerHTML = `
          <b>【AIR STRIKE】 ${diffObj.name}（${diffObj.jpName}）</b><br>
          ランダム配置の地上目標へ誘導 / 複雑障害物: 約<b>${diffObj.obstacleCount}個</b><br>
          ${diffObj.desc} / スコア: <b>20 × 生き残ったm</b>
        `;
      }
    }
  }
}

export function openSkinSelectModal(){
  resetMovementInputs();
  state.modalOpen = true;
  state.pendingSelectedSkinId = state.selectedSkinId;
  renderSkinSelectList();
  $('#skinSelectModal').classList.add('visible');
}

export function renderSkinSelectList(){
  const container = $('#unlockedSkinsList');
  container.innerHTML = '';
  CONFIG.SKINS.filter(s => state.unlockedSkins.includes(s.id)).forEach(skin => {
    const eff = getEffectiveStats(skin);
    const card = document.createElement('div');
    card.className = 'skin-card' + (skin.id === state.pendingSelectedSkinId ? ' selected' : '');
    const hex = '#' + skin.color.toString(16).padStart(6, '0');
    const textCol = '#071522';

    let statSummary = '';
    if(skin.attackType === 'explosion'){
      statSummary = `攻撃力:${eff.atk} / スコア倍率:${eff.scoreMult.toFixed(2)}x / 追加爆発範囲:+${eff.bonusBlastRadiusM.toFixed(2)}m (最大${(15 + eff.bonusBlastRadiusM).toFixed(1)}m)`;
    } else if(skin.attackType === 'scatter'){
      statSummary = `攻撃力:${eff.atk}×7散弾 / 体力:${eff.hp} / スコア倍率:${eff.scoreMult.toFixed(2)}x`;
    } else if(skin.attackType === 'laser'){
      statSummary = `光線攻撃力:${eff.atk} / タレット数:${eff.laserTurretCount}基 / 照射時間:${eff.laserDurationSec}s`;
    } else if(skin.attackType === 'automatic'){
      statSummary = `攻撃力:${eff.atk} / 防御力:${eff.def} / 体力:${eff.hp} / 同時発射:${eff.autoVolleyCount}発`;
    } else if(skin.attackType === 'wirbelwind'){
      statSummary = `攻撃力:${eff.atk} / スコア倍率:${eff.scoreMult.toFixed(2)}x / 各頂点:${eff.wirbelVertexShots}発(計${eff.wirbelVertexShots * 4}発)`;
    } else if(skin.attackType === 'beast'){
      statSummary = `攻撃力:${eff.atk} / 防御力:${eff.def} / 体力:${eff.hp} / 同時弾数:${eff.shotCount}発 / スコア:${eff.scoreMult.toFixed(2)}x`;
    } else if(skin.id === 'RapidFire'){
      statSummary = `攻撃力:${eff.atk} / 連射数:${eff.shotCount}発 / スキルタレット:${eff.rapidTurretCount}基`;
    } else {
      statSummary = `攻撃力:${eff.atk} / 防御力:${eff.def} / 体力:${eff.hp}`;
    }

    card.innerHTML = `
      <div class="skin-swatch" style="background:${hex};color:${textCol}">#${skin.order}</div>
      <div class="skin-info">
        <div class="skin-title">${skin.name}</div>
        <div class="skin-desc">${statSummary}</div>
        <div class="skin-skill-tag">固有能力: ${skin.skill.name} Lv.${eff.skillLv}</div>
      </div>
      <div class="skin-badge">${skin.id === state.pendingSelectedSkinId ? '選択中' : '選択する'}</div>
    `;
    card.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      state.pendingSelectedSkinId = skin.id;
      renderSkinSelectList();
    });
    container.appendChild(card);
  });
  $('#gachaScreen')?.classList.add('hidden');
}

export function confirmSkinSelection(){
  state.selectedSkinId = state.pendingSelectedSkinId;
  saveGameData();
  if(state.skinController) state.skinController.refreshPedestals(state.unlockedSkins, state.selectedSkinId);
  if(typeof state.onSkinChanged === 'function') state.onSkinChanged();
  setModeUI(state.gameMode, getEquippedSkin(), coopState.isCoop, coopState.isHost);
  closeAllModals();
  state.triggerCooldown = 45;
}

function getUpgradeItemMeta(skin, upgKey){
  const eff = getEffectiveStats(skin);
  if(upgKey === 'atk'){
    const label = skin.id === 'Laser' ? '光線攻撃力' : '攻撃力';
    return { title: label, desc: `現在の${label}: ${eff.atk}（+1 / Lv）`, swatch: skin.id === 'Laser' ? 'BEAM' : 'ATK', color: '#ff4d6d' };
  }
  if(upgKey === 'def'){
    return { title: '防御力', desc: `現在の防御力: ${eff.def}（+1 / Lv・ダメージ軽減）`, swatch: 'DEF', color: '#38c8f0' };
  }
  if(upgKey === 'hp'){
    return { title: '体力', desc: `現在の最大体力: ${eff.hp}（+10 / Lv）`, swatch: 'HP', color: '#00f5d4' };
  }
  if(upgKey === 'rate'){
    return { title: '連射速度', desc: `現在の連射速度: ${eff.rawRate.toFixed(1)}（発射数: ${eff.shotCount}発 / +0.5 / Lv）`, swatch: 'RATE', color: '#4de680' };
  }
  if(upgKey === 'score'){
    return { title: 'スコア獲得上昇', desc: `現在の獲得スコア倍率: ${eff.scoreMult.toFixed(2)}倍（+5% / Lv）`, swatch: 'SCORE', color: '#ffd23f' };
  }
  if(upgKey === 'blast'){
    return { title: '爆発範囲増加', desc: `現在の追加爆発半径: +${eff.bonusBlastRadiusM.toFixed(2)}m（Lv.1: 0m / 最大Lv.10: +5.0m・計算後に加算）`, swatch: 'BLAST', color: '#ff9233' };
  }
  if(upgKey === 'duration'){
    return { title: '光線持続時間', desc: `現在の光線持続時間: ${eff.laserDurationSec.toFixed(1)}秒（初期3.0秒 / +0.2秒 / Lv）`, swatch: 'TIME', color: '#ff8fa3' };
  }
  if(upgKey === 'volley'){
    return { title: '弾数増加', desc: `現在の同時発射数: ${eff.autoVolleyCount}発（Lv.10で11発同時発射）`, swatch: 'VOLLEY', color: '#c77dff' };
  }
  if(upgKey === 'turretCount'){
    return { title: 'タレット数増加', desc: `現在の同時設置タレット数: ${eff.rapidTurretCount}基（初期1基 / 最大5基・攻撃力＆連射力は本体と同値）`, swatch: 'TURRET', color: '#4de680' };
  }
  if(upgKey === 'laserTurretCount'){
    return { title: 'タレット数増加', desc: `現在の設置可能タレット数: ${eff.laserTurretCount}基（初期1基 / 最大5基・Mk.1〜Mk.${eff.laserTurretCount}攻撃対応）`, swatch: 'TURRET', color: '#ff4d6d' };
  }
  if(upgKey === 'vertexShots'){
    const upg = getSkinUpgrade('Wirbelwind');
    return { title: '各頂点の弾発射数上昇', desc: `現在の追加発射数: +${upg.vertexShots}発/頂点（各頂点${eff.wirbelVertexShots}発・計${eff.wirbelVertexShots * 4}発）`, swatch: '4-QUAD', color: '#00f5d4' };
  }
  if(upgKey === 'faith'){
    return { title: '信仰力', desc: `現在の攻撃力:${eff.atk} / 防御力:${eff.def}（1Lvごとに攻撃力+2＆防御力+2）`, swatch: 'FAITH', color: '#ffffff' };
  }
  if(upgKey === 'gayPower'){
    return { title: 'GAY力', desc: `現在の獲得スコア倍率: ${eff.scoreMult.toFixed(2)}倍（1Lvごとに+10%上昇・通常より高倍率）`, swatch: 'GAY', color: '#ff66cc' };
  }
  if(upgKey === 'saint'){
    return { title: '聖人力', desc: `現在体力:${eff.hp} / 同時弾数:${eff.shotCount}発（1Lvごとに体力+20・弾数+1・拡散強化）`, swatch: 'SAINT', color: '#ffe066' };
  }
  return { title: upgKey, desc: '', swatch: 'UPG', color: '#8beeff' };
}

export function openUpgradeModal(){
  resetMovementInputs();
  $('#skinSelectModal').classList.remove('visible');
  state.modalOpen = true;
  renderUpgradeList();
  $('#skinUpgradeModal').classList.add('visible');
}

export function renderUpgradeList(){
  const skin = CONFIG.SKINS.find(s => s.id === state.pendingSelectedSkinId) || getEquippedSkin();
  const upg = getSkinUpgrade(skin.id);
  const eff = getEffectiveStats(skin);
  $('#upgradeSkinTitle').textContent = `${skin.name} の強化`;
  $('#upgradeGoldVal').textContent = state.gold.toLocaleString();
  const container = $('#upgradeItemsList');
  container.innerHTML = '';

  const baseCost = skin.upgradeBaseCost || 2000;
  const stepCost = skin.upgradeStepCost || 500;

  skin.upgrades.forEach(uDef => {
    const curLv = upg[uDef.key] || 1;
    const isMax = curLv >= uDef.maxLv;
    const cost = baseCost + (curLv - 1) * stepCost;
    const meta = getUpgradeItemMeta(skin, uDef.key);

    const card = document.createElement('div');
    card.className = 'skin-card';
    card.innerHTML = `
      <div class="skin-swatch" style="background:${meta.color};color:#071522">${meta.swatch}</div>
      <div class="skin-info">
        <div class="skin-title">${meta.title} (Lv.${curLv} / ${uDef.maxLv})</div>
        <div class="skin-desc">${meta.desc}</div>
      </div>
      <button class="buy-btn" type="button" ${isMax || state.gold < cost ? 'disabled' : ''}>${isMax ? 'MAX' : cost.toLocaleString() + ' G'}</button>
    `;
    const btn = card.querySelector('button');
    if(!isMax && state.gold >= cost){
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if(state.gold >= cost && upg[uDef.key] < uDef.maxLv){
          state.gold -= cost;
          upg[uDef.key]++;
          saveGameData();
          renderUpgradeList();
        }
      });
    }
    container.appendChild(card);
  });

  const skill = skin.skill;
  const sMax = skill.maxLv || 10;
  const sCur = upg.skill || 1;
  const sIsMax = sCur >= sMax;
  const sCost = 3000 + (sCur - 1) * 1500;

  let skillEffectDetail = '';
  if(skill.id === 'OriginBurst'){
    skillEffectDetail = `現在効果: 最大 ${eff.originBurstTargets}体 一掃（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'AdditionalTurre'){
    skillEffectDetail = `現在効果: ${eff.additionalTurreDuration}秒間 タレット${eff.rapidTurretCount}基を均等配置（攻撃力${eff.atk} / 連射速度${eff.rawRate.toFixed(1)}・本体同値）`;
  } else if(skill.id === 'FewCharger'){
    skillEffectDetail = `現在効果: 10秒間 最大チャージ必要時間 -${eff.fewChargerReduction}秒（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'InfinityBarrel'){
    skillEffectDetail = `現在効果: 10秒間CD0秒＆拡散範囲 ${eff.infinitySpreadMult}倍（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'NeverStopper'){
    skillEffectDetail = `現在効果: ${eff.neverStopperDuration}秒間光線持続＆半径 ${eff.neverStopperRadiusMult}倍（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'MultiBurst'){
    skillEffectDetail = `現在効果: 10秒間戦闘機優先追尾＆追加弾 +${eff.multiBurstExtraShots}発（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'GermanTech'){
    skillEffectDetail = `現在効果: 上空の飛翔体を最大 ${eff.germanTechTargets}個 破壊（CD ${skill.cooldown}秒）`;
  } else if(skill.id === 'BeastEyesPower'){
    const cdStr = eff.beastEyesCooldown === 0 ? 'クールダウンなし' : `CD ${eff.beastEyesCooldown}秒`;
    skillEffectDetail = `現在効果: 出現した飛翔体を全て破壊（${cdStr}）`;
  }

  const skillCard = document.createElement('div');
  skillCard.className = 'skin-card skill-upgrade-card';
  skillCard.innerHTML = `
    <div class="skin-swatch" style="background:#ffd700;color:#071522">SKILL</div>
    <div class="skin-info">
      <div class="skin-title">【固有能力】${skill.name} (Lv.${sCur} / ${sMax})</div>
      <div class="skin-desc">${skill.desc}<br><b>${skillEffectDetail}</b></div>
    </div>
    <button class="buy-btn" type="button" ${sIsMax || state.gold < sCost ? 'disabled' : ''}>${sIsMax ? 'MAX' : sCost.toLocaleString() + ' G'}</button>
  `;
  const sBtn = skillCard.querySelector('button');
  if(!sIsMax && state.gold >= sCost){
    sBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if(state.gold >= sCost && upg.skill < sMax){
        state.gold -= sCost;
        upg.skill++;
        saveGameData();
        renderUpgradeList();
      }
    });
  }
  container.appendChild(skillCard);
}

let currentStoreTab = 'items';

export function openSkinStoreModal(defaultTab = 'items'){
  resetMovementInputs();
  state.modalOpen = true;
  switchStoreTab(defaultTab);
  $('#skinStoreModal').classList.add('visible');
}

export function switchStoreTab(tab = 'items'){
  currentStoreTab = tab === 'units' ? 'units' : 'items';
  const itemBtn = $('#tabItemShopBtn');
  const unitBtn = $('#tabUnitShopBtn');
  const itemsList = $('#storeItemsList');
  const skinsList = $('#storeSkinsList');
  const titleEl = $('#storeModalTitle');
  const subEl = $('#storeModalSub');

  if(itemBtn) itemBtn.classList.toggle('active', currentStoreTab === 'items');
  if(unitBtn) unitBtn.classList.toggle('active', currentStoreTab === 'units');
  if(itemsList) itemsList.classList.toggle('hidden', currentStoreTab !== 'items');
  if(skinsList) skinsList.classList.toggle('hidden', currentStoreTab !== 'units');

  if(currentStoreTab === 'items'){
    if(titleEl) titleEl.textContent = 'アイテムショップ';
    if(subEl) subEl.textContent = 'ゴールドやYAJUコインで戦闘用アイテムを購入できます（複数所持可）';
    renderItemShopList();
  } else {
    if(titleEl) titleEl.textContent = '機体購入';
    if(subEl) subEl.textContent = 'ゴールドを消費して新しい機体のロックを解除できます';
    renderSkinStoreList();
  }
}

export function renderItemShopList(){
  const gEl = $('#storeGoldVal');
  const yEl = $('#storeYajuCoinVal');
  if(gEl) gEl.textContent = state.gold.toLocaleString();
  if(yEl) yEl.textContent = (state.yajuCoins || 0).toLocaleString();

  const container = $('#storeItemsList');
  if(!container) return;
  container.innerHTML = '';

  SHOP_ITEMS.forEach(item => {
    const owned = (state.inventory && state.inventory[item.id]) || 0;
    const isYaju = item.currency === 'yaju';
    const balance = isYaju ? (state.yajuCoins || 0) : state.gold;
    const canAfford = balance >= item.price;
    const unitLabel = isYaju ? 'Y' : 'G';

    const card = document.createElement('div');
    card.className = 'skin-card';
    card.innerHTML = `
      <div class="skin-swatch" style="background:${item.color};color:#071522">${item.shortName}</div>
      <div class="skin-info">
        <div class="skin-title">${item.name}</div>
        <div class="skin-desc">${item.desc}</div>
        <div class="skin-skill-tag">所持数: ${owned}個</div>
      </div>
      <button class="buy-btn" type="button" ${canAfford ? '' : 'disabled'}>${item.price.toLocaleString()} ${unitLabel} で購入</button>
    `;
    const btn = card.querySelector('button');
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if(isYaju){
        if((state.yajuCoins || 0) >= item.price){
          state.yajuCoins -= item.price;
          state.inventory[item.id] = (state.inventory[item.id] || 0) + 1;
        }
      } else {
        if(state.gold >= item.price){
          state.gold -= item.price;
          state.inventory[item.id] = (state.inventory[item.id] || 0) + 1;
        }
      }
      playSfx('purchase', 0.8);
      saveGameData();
      if(state.homeController && state.homeController.refreshCurrencyPanels){
        state.homeController.refreshCurrencyPanels(state.gold, state.yajuCoins);
      }
      renderItemShopList();
    });
    container.appendChild(card);
  });
  $('#gachaScreen')?.classList.add('hidden');
}

export function renderSkinStoreList(){
  const gEl = $('#storeGoldVal');
  const yEl = $('#storeYajuCoinVal');
  if(gEl) gEl.textContent = state.gold.toLocaleString();
  if(yEl) yEl.textContent = (state.yajuCoins || 0).toLocaleString();

  const container = $('#storeSkinsList');
  container.innerHTML = '';
  CONFIG.SKINS.forEach(skin => {
    const isUnlocked = state.unlockedSkins.includes(skin.id);
    const canAfford = state.gold >= skin.price;
    const hex = '#' + skin.color.toString(16).padStart(6, '0');
    const card = document.createElement('div');
    card.className = 'skin-card';
    card.innerHTML = `
      <div class="skin-swatch" style="background:${hex};color:#071522">#${skin.order}</div>
      <div class="skin-info">
        <div class="skin-title">${skin.name}</div>
        <div class="skin-desc">${skin.stats.desc}</div>
        <div class="skin-skill-tag">固有能力: ${skin.skill.name}</div>
      </div>
      ${isUnlocked ? '<div class="badge-unlocked">解放済み</div>' : `<button class="buy-btn" type="button" ${canAfford ? '' : 'disabled'}>${skin.price.toLocaleString()} G で購入</button>`}
    `;
    if(!isUnlocked){
      const btn = card.querySelector('button');
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if(state.gold >= skin.price && !state.unlockedSkins.includes(skin.id)){
          state.gold -= skin.price;
          state.unlockedSkins.push(skin.id);
          playSfx('purchase', 0.8);
          saveGameData();
          if(state.skinController) state.skinController.refreshPedestals(state.unlockedSkins, state.selectedSkinId);
          if(state.homeController && state.homeController.refreshCurrencyPanels){
            state.homeController.refreshCurrencyPanels(state.gold, state.yajuCoins);
          }
          renderSkinStoreList();
        }
      });
    }
    container.appendChild(card);
  });
  $('#gachaScreen')?.classList.add('hidden');
}

export function getSelectedDiffObj(){
  return getDifficultyById(state.selectedDifficultyId);
}


export function openYajuSetupModal(){
  resetMovementInputs();
  closeAllModals();
  state.modalOpen = true;
  $('#yajuSetupModal')?.classList.add('visible');
}

export function openYajuBossSetupModal(){
  resetMovementInputs();
  closeAllModals();
  state.modalOpen = true;
  state.selectedYajuBossId = null;
  state.selectedYajuDiffId = null;
  renderYajuBossSetupModal();
  $('#yajuBossSetupModal')?.classList.add('visible');
}

export function renderYajuBossSetupModal(){
  const bossGrid = $('#yajuBossBtnGrid');
  if(bossGrid){
    bossGrid.innerHTML = '';
    YAJU_BOSSES.forEach(boss => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'setup-mode-btn' + (state.selectedYajuBossId === boss.id ? ' selected' : '');
      btn.innerHTML = `<strong>${boss.name}</strong><span>${boss.desc}</span>`;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        state.selectedYajuBossId = boss.id;
        renderYajuBossSetupModal();
      });
      bossGrid.appendChild(btn);
    });
  }

  const bossChosen = !!state.selectedYajuBossId;
  const hint = $('#yajuDiffLockHint');
  if(hint){
    hint.textContent = bossChosen
      ? '（難易度を選択してください）'
      : '（※先にボスを選択してください）';
  }

  const diffGrid = $('#yajuBossDiffGrid');
  if(diffGrid){
    diffGrid.innerHTML = '';
    YAJU_BOSS_DIFFICULTIES.forEach(diff => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'setup-diff-btn' + (state.selectedYajuDiffId === diff.id ? ' selected' : '');
      btn.disabled = !bossChosen;
      btn.innerHTML = `<span>${diff.name}</span><span style="font-size:10px;color:#ffd23f;">HP:${diff.hp} / ${diff.atkMult.toFixed(1)}倍</span>`;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if(!state.selectedYajuBossId) return;
        state.selectedYajuDiffId = diff.id;
        renderYajuBossSetupModal();
      });
      diffGrid.appendChild(btn);
    });
  }

  const bossObj = YAJU_BOSSES.find(b => b.id === state.selectedYajuBossId);
  const diffObj = YAJU_BOSS_DIFFICULTIES.find(d => d.id === state.selectedYajuDiffId);
  const startBtn = $('#yajuBossStartBtn');
  if(startBtn) startBtn.disabled = !(bossObj && diffObj);

  const preview = $('#yajuBossPreviewBox');
  if(preview){
    if(!bossObj){
      preview.innerHTML = '① まず上の <b>world enemy</b> または <b>獣王</b> を選択してください。';
    } else if(!diffObj){
      preview.innerHTML = `選択中ボス: <b>${bossObj.name}</b><br>② 次に難易度（イージー〜INSANE）を選択してください。`;
    } else {
      const rewardCoins = Math.round(YAJU_REWARDS.BOSS_BASE_COINS * diffObj.atkMult);
      preview.innerHTML = `<b>【${bossObj.name}】 ${diffObj.name}</b><br>ボス体力: <b>${diffObj.hp}</b> / 敵攻撃力倍率: <b>${diffObj.atkMult.toFixed(1)}倍</b><br>討伐報酬: <b>YAJUコイン +${rewardCoins}枚</b>`;
    }
  }
}

export function openYajuIpadWarnModal(){
  resetMovementInputs();
  closeAllModals();
  state.modalOpen = true;
  $('#yajuIpadWarnModal')?.classList.add('visible');
}

export function openTransferChoiceModal(){
  resetMovementInputs();
  closeAllModals();
  state.modalOpen = true;
  $('#transferChoiceModal')?.classList.add('visible');
}

export function openTransferImportModal(){
  resetMovementInputs();
  closeAllModals();
  state.modalOpen = true;
  const msgEl = $('#transferImportMsg');
  if(msgEl) msgEl.textContent = '';
  $('#transferImportModal')?.classList.add('visible');
}

export function renderCoopFriendsList(){
  const listEl = $('#coopFriendsList');
  if(!listEl) return;
  const friends = state.friends || [];
  if(friends.length === 0){
    listEl.innerHTML = '<div class="chat-empty-hint" style="padding:8px;">登録されたフレンドはいません</div>';
    return;
  }
  listEl.innerHTML = friends.map(f => `
    <div class="skin-card" style="padding:7px 10px;">
      <div class="skin-info">
        <div class="skin-title">${f.name}</div>
        <div class="skin-desc">${f.code}</div>
      </div>
    </div>
  `).join('');
}


export function openPlayWarsSetupModal(){
  resetMovementInputs();
  closeAllModals();
  state.modalOpen = true;
  if(!state.unlockedSkins.includes(state.selectedPlayWarsSkinId)){
    const firstAllowed = CONFIG.SKINS.find(s => state.unlockedSkins.includes(s.id));
    state.selectedPlayWarsSkinId = firstAllowed ? firstAllowed.id : 'Origin';
  }
  if(!state.selectedPlayWarsDiffId) state.selectedPlayWarsDiffId = 'easy';
  renderPlayWarsSetupModal();
  $('#playWarsSetupModal')?.classList.add('visible');
}

export function renderPlayWarsSetupModal(){
  const skinGrid = $('#playWarsSkinGrid');
  const diffGrid = $('#playWarsDiffGrid');
  const preview = $('#playWarsPreviewBox');

  if(skinGrid){
    skinGrid.innerHTML = '';
    CONFIG.SKINS.forEach(s => {
      const unlocked = state.unlockedSkins.includes(s.id);
      const usable = unlocked;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'diff-btn' + (state.selectedPlayWarsSkinId === s.id ? ' selected' : '');
      btn.disabled = !usable;
      btn.innerHTML = `<strong>${s.name}</strong><span>${unlocked ? '使用可' : '未購入'}</span>`;
      if(usable){
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          state.selectedPlayWarsSkinId = s.id;
          renderPlayWarsSetupModal();
        });
      }
      skinGrid.appendChild(btn);
    });
  }

  if(diffGrid){
    diffGrid.innerHTML = '';
    PLAY_WARS_DIFFICULTIES.forEach(d => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'diff-btn' + (state.selectedPlayWarsDiffId === d.id ? ' selected' : '');
      btn.innerHTML = `<strong>${d.name}</strong><span>${d.mult.toFixed(1)}倍 / 勝利+${Math.round(200 * d.mult)}Y</span>`;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        state.selectedPlayWarsDiffId = d.id;
        renderPlayWarsSetupModal();
      });
      diffGrid.appendChild(btn);
    });
  }

  if(preview){
    const dObj = PLAY_WARS_DIFFICULTIES.find(d => d.id === state.selectedPlayWarsDiffId) || PLAY_WARS_DIFFICULTIES[0];
    preview.innerHTML = `選択機体: <b>${state.selectedPlayWarsSkinId}</b>（HP 100 / DEF 10固定・必殺不可）<br>ソロAI難易度: <b>${dObj.name}</b>（AI勝利: <b>+200Y×${dObj.mult.toFixed(1)}=+${Math.round(200 * dObj.mult)}Y</b> / 共闘PvP勝利: <b>+100Y</b>）`;
  }
}
