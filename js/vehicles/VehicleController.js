import * as T from '../libs/three.module.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function normalizeAngleDiff(target, current){
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

export function createVehicleController(assets){
  const cfg = assets.config || {};
  const turretPos = Array.isArray(cfg.turretPivot) ? cfg.turretPivot : [0, 1.24, -0.15];
  const gunPos = Array.isArray(cfg.gunPivot) ? cfg.gunPivot : [0, 0.62, -0.62];
  const minElevation = typeof cfg.minElevation === 'number' ? cfg.minElevation : 0;
  const maxElevation = typeof cfg.maxElevation === 'number' ? cfg.maxElevation : (Math.PI / 2);
  const hullTurnSpeed = typeof cfg.hullTurnSpeed === 'number' ? cfg.hullTurnSpeed : 9.0;
  const modelScale = typeof cfg.scale === 'number' ? cfg.scale : 1.0;

  const root = new T.Group();
  root.name = 'OriginRoot';
  root.scale.setScalar(modelScale);

  const hullRoot = new T.Group();
  hullRoot.name = 'HullRoot';
  root.add(hullRoot);
  if(assets.hullScene){
    assets.hullScene.name = 'Origin_Hull';
    hullRoot.add(assets.hullScene);
  }

  const turretPivot = new T.Group();
  turretPivot.name = 'TurretPivot';
  turretPivot.position.set(turretPos[0], turretPos[1], turretPos[2]);
  hullRoot.add(turretPivot);
  if(assets.turretScene){
    assets.turretScene.name = 'Origin_Turret';
    turretPivot.add(assets.turretScene);
  }

  const gunPivot = new T.Group();
  gunPivot.name = 'GunPivot';
  gunPivot.position.set(gunPos[0], gunPos[1], gunPos[2]);
  turretPivot.add(gunPivot);
  if(assets.gunScene){
    assets.gunScene.name = 'Origin_Gun';
    gunPivot.add(assets.gunScene);
  }

  let hullYaw = 0;

  function update({
    dt = 0.016,
    x = 0,
    y = -2,
    z = 0,
    moveDx = 0,
    moveDz = 0,
    cameraYaw = 0,
    cameraPitch = 0,
    visible = true
  } = {}){
    root.visible = !!visible;
    root.position.set(x, y, z);

    // 1. 移動スティック（および移動キー）を倒した方向へ車体(Hull)を向ける
    const moveMag = Math.hypot(moveDx, moveDz);
    if(moveMag > 0.0005){
      const targetHullYaw = Math.atan2(-moveDx, -moveDz);
      const diff = normalizeAngleDiff(targetHullYaw, hullYaw);
      const step = Math.min(1, hullTurnSpeed * Math.max(0.001, dt));
      hullYaw += diff * step;
    }
    hullRoot.rotation.y = hullYaw;

    // 2. 車体の子である砲塔(Turret)はプレイヤー視点操作の横軸(Yaw)のみに従う
    turretPivot.rotation.y = cameraYaw - hullYaw;

    // 3. 砲塔の子である砲(Gun)は視点操作の縦軸(Pitch: 上下のみ)に従う
    gunPivot.rotation.x = clamp(cameraPitch, minElevation, maxElevation);
  }

  return {
    root,
    hullRoot,
    turretPivot,
    gunPivot,
    update,
    setHullYaw(rad){ hullYaw = rad; hullRoot.rotation.y = rad; }
  };
}
