import * as T from './libs/three.module.js';
import { SHOP_ITEMS } from './config.js';
import { state, saveGameData } from './state.js';
import { showToast, updateInventoryBar, triggerBlueWhiteFadeOut } from './ui.js';
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
  }
}
