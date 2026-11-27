import * as T from './libs/three.module.js';
import { CONFIG } from './config.js';
import { state, getEquippedSkin, saveGameData } from './state.js';
import { $, setModeUI, showToast, showEndScreen } from './ui.js';
import { playSfx } from './sfx.js';
import { resetCombatState } from './player.js';
import { getCoopContext, coopState } from './multiplayer.js';

export const PLAY_WARS_DIFFICULTIES = [
  { id: 'easy',   name: 'イージー', mult: 1.0, aiFireCd: 1.35, aiSpeed: 0.95, aiAcc: 0.72 },
  { id: 'normal', name: 'ノーマル', mult: 2.0, aiFireCd: 0.95, aiSpeed: 1.15, aiAcc: 0.82 },
  { id: 'hard',   name: 'ハード',   mult: 3.0, aiFireCd: 0.65, aiSpeed: 1.32, aiAcc: 0.90 },
  { id: 'insane', name: 'INSANE',   mult: 4.0, aiFireCd: 0.42, aiSpeed: 1.48, aiAcc: 0.96 }
];

export const PLAY_WARS_LIMIT = 45.0;
export const PLAY_WARS_PLAYER_HP = 100;
export const PLAY_WARS_PLAYER_DEF = 10;

export const pwState = {
  active: false,
  ended: false,
  isPvp: false,
  diff: PLAY_WARS_DIFFICULTIES[0],
  localHp: PLAY_WARS_PLAYER_HP,
  enemyHp: PLAY_WARS_PLAYER_HP,
  localSkinId: 'Origin',
  enemySkinId: 'Origin',
  obstacles: [],
  projectiles: [],
  aiGroup: null,
  aiMesh: null,
  aiPos: new T.Vector3(38, 0, 38),
  aiVelY: 0,
  aiFireTimer: 1.0,
  aiStrafeDir: 1,
  aiStrafeTimer: 1.5,
  pvpHitbox: null
};

export function getPlayWarsDifficultyById(id){
  return PLAY_WARS_DIFFICULTIES.find(d => d.id === id) || PLAY_WARS_DIFFICULTIES[0];
}

function updatePlayWarsHud(){
  const myFill = $('#pwMyHpFill');
  const myTxt = $('#pwMyHpText');
  const enFill = $('#pwEnemyHpFill');
  const enTxt = $('#pwEnemyHpText');
  const enLbl = $('#pwEnemyLabel');
  if(myFill) myFill.style.width = `${Math.max(0, Math.min(100, pwState.localHp))}%`;
  if(myTxt) myTxt.textContent = `${Math.max(0, Math.ceil(pwState.localHp))} / ${PLAY_WARS_PLAYER_HP}`;
  if(enFill) enFill.style.width = `${Math.max(0, Math.min(100, pwState.enemyHp))}%`;
  if(enTxt) enTxt.textContent = `${Math.max(0, Math.ceil(pwState.enemyHp))} / ${PLAY_WARS_PLAYER_HP}`;
  if(enLbl) enLbl.textContent = pwState.isPvp ? (coopState.remotePos?.username || 'RIVAL PLAYER') : `AI (${pwState.diff.name})`;
}

export function canStandPlayWars(x, z, radius = 0.65){
  if(Math.abs(x) > PLAY_WARS_LIMIT || Math.abs(z) > PLAY_WARS_LIMIT) return false;
  for(const ob of pwState.obstacles){
    if(Math.abs(x - ob.x) < ob.hw + radius && Math.abs(z - ob.z) < ob.hd + radius){
      return false;
    }
  }
  return true;
}

export function hasPlayWarsLOS(p1, p2){
  const steps = 18;
  for(let i = 1; i < steps; i++){
    const t = i / steps;
    const x = p1.x + (p2.x - p1.x) * t;
    const y = p1.y + (p2.y - p1.y) * t;
    const z = p1.z + (p2.z - p1.z) * t;
    for(const ob of pwState.obstacles){
      if(y <= ob.h && Math.abs(x - ob.x) < ob.hw && Math.abs(z - ob.z) < ob.hd){
        return false;
      }
    }
  }
  return true;
}

function buildPlayWarsWorld(){
  const scene = state.scene;
  scene.background = new T.Color(0x091624);
  scene.fog = new T.FogExp2(0x091624, 0.006);

  scene.add(new T.HemisphereLight(0xbbeeff, 0x162430, 1.35));
  const dir = new T.DirectionalLight(0xffffff, 1.45);
  dir.position.set(24, 45, 20);
  scene.add(dir);

  const floor = new T.Mesh(
    new T.PlaneGeometry(96, 96),
    new T.MeshStandardMaterial({ color: 0x112538, roughness: 0.72, metalness: 0.2 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  scene.add(floor);

  const grid = new T.GridHelper(96, 32, 0xc77dff, 0x1e3f5a);
  grid.position.y = -1.98;
  scene.add(grid);

  // 高い外壁 (高さ 12m)
  const outerMat = new T.MeshStandardMaterial({ color: 0x0d1f30, roughness: 0.6, metalness: 0.35 });
  const outerWalls = [
    { w: 96, h: 12, d: 2, x: 0, y: 4, z: -48 },
    { w: 96, h: 12, d: 2, x: 0, y: 4, z: 48 },
    { w: 2, h: 12, d: 96, x: -48, y: 4, z: 0 },
    { w: 2, h: 12, d: 96, x: 48, y: 4, z: 0 }
  ];
  for(const wc of outerWalls){
    const m = new T.Mesh(new T.BoxGeometry(wc.w, wc.h, wc.d), outerMat);
    m.position.set(wc.x, wc.y, wc.z);
    scene.add(m);
  }

  // 障害物・高壁配置（対称レイアウト）
  pwState.obstacles = [];
  const obDefs = [
    { x: 0, z: 0, w: 6, h: 8, d: 6 },
    { x: -16, z: 0, w: 4, h: 6, d: 12 },
    { x: 16, z: 0, w: 4, h: 6, d: 12 },
    { x: 0, z: -18, w: 12, h: 6, d: 4 },
    { x: 0, z: 18, w: 12, h: 6, d: 4 },
    { x: -24, z: -20, w: 8, h: 5, d: 4 },
    { x: 24, z: 20, w: 8, h: 5, d: 4 },
    { x: -24, z: 20, w: 4, h: 5, d: 8 },
    { x: 24, z: -20, w: 4, h: 5, d: 8 },
    { x: -12, z: -32, w: 6, h: 4.5, d: 6 },
    { x: 12, z: 32, w: 6, h: 4.5, d: 6 },
    { x: -32, z: -10, w: 5, h: 4.5, d: 5 },
    { x: 32, z: 10, w: 5, h: 4.5, d: 5 },
    { x: -30, z: 28, w: 7, h: 6, d: 4 },
    { x: 30, z: -28, w: 7, h: 6, d: 4 }
  ];
  const obMat = new T.MeshStandardMaterial({ color: 0x1a3954, roughness: 0.45, metalness: 0.4 });
  const obEdgeMat = new T.MeshBasicMaterial({ color: 0xc77dff, wireframe: true, transparent: true, opacity: 0.28 });

  for(const od of obDefs){
    const box = new T.Mesh(new T.BoxGeometry(od.w, od.h, od.d), obMat);
    box.position.set(od.x, -2 + od.h / 2, od.z);
    scene.add(box);
    const wire = new T.Mesh(new T.BoxGeometry(od.w + 0.04, od.h + 0.04, od.d + 0.04), obEdgeMat);
    wire.position.copy(box.position);
    scene.add(wire);
    pwState.obstacles.push({ x: od.x, z: od.z, hw: od.w / 2, hd: od.d / 2, h: -2 + od.h });
  }
}

export function initPlayWarsMode(diffId = 'easy', missionData = null, coopCtx = {}){
  resetCombatState();
  pwState.active = true;
  pwState.ended = false;
  pwState.isPvp = !!(coopCtx && coopCtx.isCoop);
  pwState.diff = getPlayWarsDifficultyById(diffId);
  pwState.localHp = PLAY_WARS_PLAYER_HP;
  pwState.enemyHp = PLAY_WARS_PLAYER_HP;
  pwState.projectiles = [];

  const mySkinId = state.selectedPlayWarsSkinId && state.unlockedSkins.includes(state.selectedPlayWarsSkinId)
    ? state.selectedPlayWarsSkinId
    : 'Origin';
  state.selectedSkinId = mySkinId;
  pwState.localSkinId = mySkinId;

  buildPlayWarsWorld();

  // スポーンはマップの端と逆側
  const amSlot0 = !pwState.isPvp || coopCtx.isHost;
  const mySpawn = amSlot0 ? { x: -38, z: -38 } : { x: 38, z: 38 };
  const enSpawn = amSlot0 ? { x: 38, z: 38 } : { x: -38, z: -38 };

  state.x = mySpawn.x;
  state.y = 0;
  state.z = mySpawn.z;
  state.vy = 0;
  state.yaw = Math.atan2(mySpawn.x - enSpawn.x, mySpawn.z - enSpawn.z);
  state.pitch = 0;

  if(!pwState.isPvp){
    const pickedAiSkin = CONFIG.SKINS[0]; // Origin
    pwState.enemySkinId = 'Origin';
    pwState.aiPos.set(enSpawn.x, 0, enSpawn.z);
    pwState.aiVelY = 0;
    pwState.aiFireTimer = 1.2;

    const grp = new T.Group();
    grp.position.set(enSpawn.x, 0, enSpawn.z);
    const body = new T.Mesh(
      new T.CylinderGeometry(0.65, 0.78, 2.2, 12),
      new T.MeshStandardMaterial({ color: pickedAiSkin.color, emissive: pickedAiSkin.color, emissiveIntensity: 0.35 })
    );
    body.position.y = -0.9;
    body.userData = { id: 'playwars_ai', isPlayWarsTarget: true, kind: 'playwars' };
    grp.add(body);
    const head = new T.Mesh(
      new T.SphereGeometry(0.45, 10, 10),
      new T.MeshStandardMaterial({ color: 0xffd23f, emissive: 0x553d00, emissiveIntensity: 0.4 })
    );
    head.position.y = 0.45;
    head.userData = { id: 'playwars_ai', isPlayWarsTarget: true, kind: 'playwars' };
    grp.add(head);

    state.scene.add(grp);
    pwState.aiGroup = grp;
    pwState.aiMesh = body;
  } else {
    pwState.aiGroup = null;
    pwState.aiMesh = null;
    const hitbox = new T.Mesh(
      new T.CylinderGeometry(0.7, 0.7, 2.4, 10),
      new T.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.set(enSpawn.x, -0.8, enSpawn.z);
    hitbox.userData = { id: 'playwars_pvp_target', isPlayWarsTarget: true, kind: 'playwars' };
    state.scene.add(hitbox);
    pwState.pvpHitbox = hitbox;
  }

  const eqSkin = getEquippedSkin();
  setModeUI('battle', eqSkin, pwState.isPvp, coopCtx.isHost, 'PLAY_WARS');
  updatePlayWarsHud();
  showToast(pwState.isPvp ? 'PlayWars PvP 開始！' : `PlayWars AI戦 (${pwState.diff.name}) 開始！`);
}

export function getPlayWarsTargetMeshes(){
  if(!pwState.active || pwState.ended) return [];
  if(!pwState.isPvp && pwState.aiMesh) return [pwState.aiMesh];
  if(pwState.isPvp && pwState.pvpHitbox) return [pwState.pvpHitbox];
  return [];
}

function mitigatePlayWarsDamage(rawDmg){
  // 防御10を反映
  const reduced = rawDmg * (100 / (100 + PLAY_WARS_PLAYER_DEF * 4));
  return Math.max(1, Math.round(reduced));
}

export function applyPlayWarsPlayerAttack(rawDmg, coopCtx = {}){
  if(!pwState.active || pwState.ended) return;
  const dmg = mitigatePlayWarsDamage(rawDmg);
  if(!pwState.isPvp){
    pwState.enemyHp = Math.max(0, pwState.enemyHp - dmg);
    playSfx('enemy_hit', 0.65);
    updatePlayWarsHud();
    if(pwState.enemyHp <= 0){
      finishPlayWars(true);
    }
  } else if(coopCtx.sendCoop){
    playSfx('enemy_hit', 0.55);
    coopCtx.sendCoop({ type: 'playWarsHit', dmg: rawDmg });
  }
}

export function handleRemotePlayWarsHit(rawDmg){
  if(!pwState.active || pwState.ended) return;
  const dmg = mitigatePlayWarsDamage(rawDmg);
  pwState.localHp = Math.max(0, pwState.localHp - dmg);
  updatePlayWarsHud();
  const coopCtx = getCoopContext();
  if(coopCtx.sendCoop){
    coopCtx.sendCoop({ type: 'playWarsHpSync', hp: pwState.localHp });
  }
  if(pwState.localHp <= 0){
    if(coopCtx.sendCoop){
      coopCtx.sendCoop({ type: 'playWarsMatchEnd' });
    }
    finishPlayWars(false);
  }
}

export function handleRemotePlayWarsHpSync(hp){
  if(!pwState.active || pwState.ended) return;
  pwState.enemyHp = Math.max(0, hp);
  updatePlayWarsHud();
}

export function handleRemotePlayWarsWin(){
  if(!pwState.active || pwState.ended) return;
  pwState.enemyHp = 0;
  updatePlayWarsHud();
  finishPlayWars(true);
}

export function finishPlayWars(win){
  if(pwState.ended) return;
  pwState.ended = true;
  pwState.active = false;
  resetCombatState();

  let rewardY = 0;
  if(win){
    rewardY = pwState.isPvp ? 100 : Math.round(200 * pwState.diff.mult);
    state.yajuCoins = (state.yajuCoins || 0) + rewardY;
    saveGameData();
    playSfx('spaa_clear', 0.85);
  }

  const detail = win
    ? `獲得YAJUコイン: <b>+${rewardY.toLocaleString()} Y</b>（${pwState.isPvp ? '対人勝利報酬' : `AI ${pwState.diff.name} 勝利報酬`}）`
    : '相手に撃破されました…';
  showEndScreen(win, state.score || 0, 0, pwState.isPvp, detail);
}

function fireAiProjectile(){
  const origin = new T.Vector3(pwState.aiPos.x, pwState.aiPos.y + 0.1, pwState.aiPos.z);
  const target = new T.Vector3(state.x, state.y, state.z);
  const dir = target.sub(origin).normalize();
  const spread = (1.0 - pwState.diff.aiAcc) * 0.25;
  dir.x += (Math.random() - 0.5) * spread;
  dir.z += (Math.random() - 0.5) * spread;
  dir.normalize();

  const mesh = new T.Mesh(
    new T.SphereGeometry(0.14, 7, 7),
    new T.MeshBasicMaterial({ color: 0xff3344 })
  );
  mesh.position.copy(origin);
  state.scene.add(mesh);
  pwState.projectiles.push({ mesh, dir, speed: 34, life: 3.5 });
}

export function updatePlayWarsMode(dt){
  if(!pwState.active || pwState.ended) return;
  const coopCtx = getCoopContext();

  if(pwState.isPvp){
    if(pwState.pvpHitbox && coopCtx.remotePos){
      pwState.pvpHitbox.position.set(coopCtx.remotePos.x, (coopCtx.remotePos.y || 0) - 0.8, coopCtx.remotePos.z);
    }
    return;
  }

  // AI移動（追跡・逃走・障害物回避・ジャンプ）＆射撃
  if(pwState.aiGroup){
    const toPlayerX = state.x - pwState.aiPos.x;
    const toPlayerZ = state.z - pwState.aiPos.z;
    const dist = Math.hypot(toPlayerX, toPlayerZ);
    const hasLos = hasPlayWarsLOS(pwState.aiPos, { x: state.x, y: state.y, z: state.z });
    const discovered = hasLos || dist < 42;
    const baseSpd = 14.5 * pwState.diff.aiSpeed;

    pwState.aiStrafeTimer -= dt;
    if(pwState.aiStrafeTimer <= 0){
      pwState.aiStrafeTimer = Math.max(0.45, (1.4 - pwState.diff.mult * 0.18) + Math.random() * 0.8);
      pwState.aiStrafeDir = Math.random() < 0.5 ? 1 : -1;
      if(pwState.aiPos.y <= 0.01 && Math.random() < (0.15 * pwState.diff.mult)){
        pwState.aiVelY = 7.5;
      }
    }

    if(dist > 0.1 && discovered){
      const nx = toPlayerX / dist;
      const nz = toPlayerZ / dist;
      const sx = -nz * pwState.aiStrafeDir;
      const sz = nx * pwState.aiStrafeDir;
      // HPが低いまたは近すぎる時は逃走、それ以外は追跡＋ストレイフ
      const isEvading = pwState.enemyHp <= 35 || dist < 9.5;
      const fwdFactor = isEvading ? -0.85 : (dist > 18 ? 0.95 : 0.35);
      const strafeWeight = 0.65 + pwState.diff.mult * 0.1;

      const moveX = (nx * fwdFactor + sx * strafeWeight);
      const moveZ = (nz * fwdFactor + sz * strafeWeight);
      const mLen = Math.hypot(moveX, moveZ) || 1;
      const vx = (moveX / mLen) * baseSpd * dt;
      const vz = (moveZ / mLen) * baseSpd * dt;

      let moved = false;
      if(canStandPlayWars(pwState.aiPos.x + vx, pwState.aiPos.z, 0.75)){
        pwState.aiPos.x += vx;
        moved = true;
      }
      if(canStandPlayWars(pwState.aiPos.x, pwState.aiPos.z + vz, 0.75)){
        pwState.aiPos.z += vz;
        moved = true;
      }
      // 障害物に引っかかったら横方向へ抜ける
      if(!moved){
        const altX = sx * baseSpd * dt;
        const altZ = sz * baseSpd * dt;
        if(canStandPlayWars(pwState.aiPos.x + altX, pwState.aiPos.z, 0.75)) pwState.aiPos.x += altX;
        if(canStandPlayWars(pwState.aiPos.x, pwState.aiPos.z + altZ, 0.75)) pwState.aiPos.z += altZ;
        pwState.aiStrafeDir *= -1;
      }
    }

    // AIジャンプ物理
    pwState.aiVelY = (pwState.aiVelY || 0) - 22.0 * dt;
    pwState.aiPos.y += pwState.aiVelY * dt;
    if(pwState.aiPos.y <= 0){
      pwState.aiPos.y = 0;
      pwState.aiVelY = 0;
    }

    pwState.aiGroup.position.copy(pwState.aiPos);
    pwState.aiGroup.lookAt(state.x, pwState.aiPos.y, state.z);

    pwState.aiFireTimer -= dt;
    if(pwState.aiFireTimer <= 0){
      pwState.aiFireTimer = pwState.diff.aiFireCd;
      if(hasLos){
        fireAiProjectile();
      }
    }
  }

  // AI弾丸更新
  for(let i = pwState.projectiles.length - 1; i >= 0; i--){
    const p = pwState.projectiles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.dir, p.speed * dt);

    let remove = p.life <= 0 || Math.abs(p.mesh.position.x) > 48 || Math.abs(p.mesh.position.z) > 48;
    if(!remove){
      for(const ob of pwState.obstacles){
        if(p.mesh.position.y <= ob.h && Math.abs(p.mesh.position.x - ob.x) < ob.hw && Math.abs(p.mesh.position.z - ob.z) < ob.hd){
          remove = true;
          break;
        }
      }
    }
    if(!remove){
      const d = Math.hypot(p.mesh.position.x - state.x, p.mesh.position.z - state.z);
      if(d < 0.85 && Math.abs(p.mesh.position.y - state.y) < 1.3){
        remove = true;
        const rawAiDmg = Math.round(6 + pwState.diff.mult * 2);
        const dmg = mitigatePlayWarsDamage(rawAiDmg);
        pwState.localHp = Math.max(0, pwState.localHp - dmg);
        updatePlayWarsHud();
        if(pwState.localHp <= 0){
          finishPlayWars(false);
          return;
        }
      }
    }
    if(remove){
      state.scene.remove(p.mesh);
      pwState.projectiles.splice(i, 1);
    }
  }
}
