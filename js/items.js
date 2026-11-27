import * as T from './libs/three.module.js';
import { SHOP_ITEMS } from './config.js';
import { YAJU_CONFIG } from './yaju-config.js';
import { state, saveGameData } from './state.js';
import { showToast, updateInventoryBar, triggerBlueWhiteFadeOut } from './ui.js';
import { playSfx } from './sfx.js';
import { applyEnemyDamage } from './enemies.js';
import { yajuState, applyYajuGlobalNuke, activateYajuEmpShield } from './mode-yaju-maze.js';

export function spawnEmpArcFxAt(pos){
  if(!state.scene || !pos) return;
  const ring = new T.Mesh(
    new T.TorusGeometry(0.95, 0.06, 6, 18),
    new T.MeshBasicMaterial({ color: 0x38c8f0, transparent: true, opacity: 0.9 })
  );
  ring.position.copy(pos);
  ring.rotation.x = Math.random() * Math.PI;
  ring.rotation.y = Math.random() * Math.PI;
  state.scene.add(ring);
  state.fx.push({ m: ring, life: 14, v: new T.Vector3(0, 0.02, 0) });

  for(let i = 0; i < 3; i++){
    const spark = new T.Mesh(
      new T.SphereGeometry(0.11, 5, 5),
      new T.MeshBasicMaterial({ color: i % 2 === 0 ? 0x7ef9e8 : 0x38c8f0, transparent: true, opacity: 0.95 })
    );
    spark.position.copy(pos).add(new T.Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4));
    state.scene.add(spark);
    state.fx.push({
      m: spark,
      life: 10,
      v: new T.Vector3((Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.14)
    });
  }
}

export function useInventoryItem(itemId, coopCtx = {}){
  if(state.gameMode !== 'battle' || state.modalOpen) return;
  if(state.activeBattleMode === 'YAJU_DEAD') return;

  const itemDef = SHOP_ITEMS.find(it => it.id === itemId);
  if(!itemDef) return;

  const count = state.inventory[itemId] || 0;
  if(count <= 0) return;

  if(state.usedItemsInMatch[itemId]){
    showToast(`${itemDef.name}は1ゲームにつき1回のみ使用できます`);
    return;
  }

  state.inventory[itemId] = count - 1;
  state.usedItemsInMatch[itemId] = true;
  playSfx('item_use', 0.8);
  saveGameData();
  updateInventoryBar();

  const isYaju = state.activeBattleMode === 'YAJU_MAZE' || state.activeBattleMode === 'YAJU_BOSS';

  if(itemId === 'emp_shield'){
    if(isYaju){
      activateYajuEmpShield(8.0);
      showToast('電磁防御システム発動！8秒間無敵！');
    } else {
      state.enemyFreezeTimer = 7.0;
      state.enemyFreezeType = 'emp';
      for(const e of state.enemies){
        spawnEmpArcFxAt(e.position);
      }
      showToast('電磁防御システム発動！敵の動きを7秒間停止！');
    }
    return;
  }

  if(itemId === 'hydrogen_bomb' || itemId === 'yaju_nuke'){
    triggerBlueWhiteFadeOut();
    if(isYaju){
      applyYajuGlobalNuke(1000, 7.0);
    } else {
      state.enemyFreezeTimer = 7.0;
      state.enemyFreezeType = 'nuke';
      const targets = [...state.enemies];
      for(const en of targets){
        applyEnemyDamage(en, 1000, 0x7ef9e8, 1.0, coopCtx);
      }
    }
    showToast(`${itemDef.name}炸裂！敵7秒停止＆1000ダメージ！`);
    return;
  }

  if(itemId === 'hp_full'){
    if(state.activeBattleMode === 'YAJU_BOSS'){
      yajuState.playerHp = YAJU_CONFIG.playerMaxHp;
      const fill = document.getElementById('yajuHpFill');
      const txt = document.getElementById('yajuHpText');
      if(fill) fill.style.width = '100%';
      if(txt) txt.textContent = `${YAJU_CONFIG.playerMaxHp} / ${YAJU_CONFIG.playerMaxHp}`;
    } else {
      state.peace = 100;
    }
    showToast('HP完全回復ストーン使用！体力全回復！');
    return;
  }

  if(itemId === 'hp_half'){
    if(state.activeBattleMode === 'YAJU_BOSS'){
      yajuState.playerHp = Math.min(YAJU_CONFIG.playerMaxHp, yajuState.playerHp + Math.ceil(YAJU_CONFIG.playerMaxHp / 2));
      const fill = document.getElementById('yajuHpFill');
      const txt = document.getElementById('yajuHpText');
      if(fill) fill.style.width = `${(yajuState.playerHp / YAJU_CONFIG.playerMaxHp) * 100}%`;
      if(txt) txt.textContent = `${Math.ceil(yajuState.playerHp)} / ${YAJU_CONFIG.playerMaxHp}`;
    } else {
      state.peace = Math.min(100, state.peace + 50);
    }
    showToast('HP半分回復ストーン使用！体力半分回復！');
    return;
  }

  if(itemId === 'power_double'){
    state.powerBuffTimer = 10.0;
    showToast('火力2倍ストーン発動！10秒間ダメージ2倍！');
    return;
  }

  if(itemId === 'speed_up'){
    state.speedBuffTimer = 10.0;
    showToast('移動速度上昇ストーン発動！10秒間移動速度1.5倍！');
    return;
  }

  if(itemId === 'beast_god_stone'){
    state.beastGodActive = true;
    showToast('獣神化パワーストーン発動！この試合の報酬・XP獲得2倍！');
  }
}
