import * as T from './libs/three.module.js';
import { state, getEquippedSkin } from './state.js';

const SKIN_PIVOTS = {
  Origin:     { turret: [0, 1.24, -0.15], gun: [0, 0.62, -0.62], gunPitchMin: 0, gunPitchMax: Math.PI / 2 },
  Wirbelwind: { turret: [0, 1.24, -0.15], gun: [0, 0.62, -0.62], gunPitchMin: 0, gunPitchMax: Math.PI / 2 },
  Explosion:  { turret: [0, 1.60, -0.13], gun: [0, 0.0, 0.0],    gunPitchMin: -Math.PI / 4, gunPitchMax: Math.PI / 3, noTurret: true },
  Scatter:    { turret: [0, 1.18, -0.22], gun: [0, 0.56, 0.92],  gunPitchMin: 0, gunPitchMax: Math.PI / 2 },
  RapidFire:  { turret: [0, 1.18, -0.18], gun: [0, 1.62, 0.05],  gunPitchMin: 0, gunPitchMax: Math.PI / 2 }
};

const templateCache = new Map();
const loadingPromises = new Map();
const camRaycaster = new T.Raycaster();
const tmpPivot = new T.Vector3();
const tmpBackDir = new T.Vector3();

function markAsPlayerModel(obj){
  obj.traverse((child) => {
    child.userData.isPlayerModel = true;
    child.userData.ignoreCamRay = true;
  });
}

function buildFallbackTankGroup(skin){
  const root = new T.Group();
  root.name = `FallbackRoot_${skin.id}`;
  const col = skin.color || 0x4de680;

  const hullMat = new T.MeshStandardMaterial({ color: 0x3b4450, metalness: 0.75, roughness: 0.35 });
  const trackMat = new T.MeshStandardMaterial({ color: 0x111419, metalness: 0.5, roughness: 0.6 });
  const accentMat = new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.45, metalness: 0.4, roughness: 0.25 });

  const hullRoot = new T.Group();
  const hullMesh = new T.Mesh(new T.BoxGeometry(2.2, 0.72, 3.6), hullMat);
  hullMesh.position.y = 0.55;
  hullRoot.add(hullMesh);

  for(const sx of [-1.2, 1.2]){
    const trk = new T.Mesh(new T.BoxGeometry(0.42, 0.55, 3.8), trackMat);
    trk.position.set(sx, 0.35, 0);
    hullRoot.add(trk);
  }
  const strip = new T.Mesh(new T.BoxGeometry(1.6, 0.08, 0.08), accentMat);
  strip.position.set(0, 0.72, -1.82);
  hullRoot.add(strip);
  root.add(hullRoot);

  const turretPivot = new T.Group();
  turretPivot.position.set(0, 1.05, -0.1);
  const turretMesh = new T.Mesh(new T.CylinderGeometry(0.85, 1.0, 0.65, 12), hullMat);
  turretMesh.position.y = 0.32;
  turretPivot.add(turretMesh);
  hullRoot.add(turretPivot);

  const gunPivot = new T.Group();
  gunPivot.position.set(0, 0.42, -0.5);
  const barrel = new T.Mesh(new T.CylinderGeometry(0.09, 0.11, 2.2, 16), accentMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -1.0;
  gunPivot.add(barrel);
  turretPivot.add(gunPivot);

  markAsPlayerModel(root);
  return { root, hullRoot, turretPivot, gunPivot, cfg: { gunPitchMin: 0, gunPitchMax: Math.PI / 2 } };
}

const SKIN_VEHICLE_DIR = {
  Origin: 'vehicle_01',
  RapidFire: 'vehicle_02',
  Explosion: 'vehicle_03',
  Scatter: 'vehicle_04',
  Laser: 'vehicle_05',
  Automatic: 'vehicle_06',
  Wirbelwind: 'vehicle_07',
  Beast: 'vehicle_08'
};

async function load3PartGlbSkin(skinId, LoaderCls){
  if(templateCache.has(skinId)) return templateCache.get(skinId);
  if(loadingPromises.has(skinId)) return loadingPromises.get(skinId);

  const p = (async () => {
    const skin = getEquippedSkin();
    let cfg = SKIN_PIVOTS[skinId] || SKIN_PIVOTS.RapidFire;
    if(!LoaderCls){
      const fb = buildFallbackTankGroup(skin);
      templateCache.set(skinId, fb);
      return fb;
    }

    const loader = new LoaderCls();
    const vDir = SKIN_VEHICLE_DIR[skinId] || skinId;
    const base = `./assets/vehicles/${vDir}`;
    try{
      let vCfg = null;
      try{
        const res = await fetch(`${base}/config.json`, { cache: 'no-store' });
        if(res.ok) vCfg = await res.json();
      }catch(_cfgErr){}

      const hullFile = vCfg?.parts?.hull || `${skinId}_hull.glb`;
      const turretFile = vCfg?.parts?.turret || `${skinId}_turret.glb`;
      const gunFile = vCfg?.parts?.gun || `${skinId}_gun.glb`;
      const turretOffset = vCfg?.offsets?.turret || cfg.turret;
      const gunOffset = vCfg?.offsets?.gun || cfg.gun;
      const modelScale = typeof vCfg?.scale === 'number' ? vCfg.scale : 0.68;
      if(vCfg?.limits){
        cfg = {
          ...cfg,
          gunPitchMin: vCfg.limits.gunPitchMinRad ?? cfg.gunPitchMin,
          gunPitchMax: vCfg.limits.gunPitchMaxRad ?? cfg.gunPitchMax
        };
      }

      const hullGltf = await loader.loadAsync(`${base}/${hullFile}`);
      const gunGltf = await loader.loadAsync(`${base}/${gunFile}`);
      let turretScene = null;
      if(!cfg.noTurret && turretFile){
        const turretGltf = await loader.loadAsync(`${base}/${turretFile}`);
        turretScene = turretGltf.scene;
      }

      const root = new T.Group();
      root.name = `${skinId}Root`;
      const hullRoot = new T.Group();
      hullRoot.name = 'HullRoot';
      root.add(hullRoot);
      hullRoot.add(hullGltf.scene);

      const turretPivot = new T.Group();
      turretPivot.name = 'TurretPivot';
      turretPivot.position.set(...turretOffset);
      hullRoot.add(turretPivot);
      if(turretScene) turretPivot.add(turretScene);

      const gunPivot = new T.Group();
      gunPivot.name = 'GunPivot';
      gunPivot.position.set(...gunOffset);
      turretPivot.add(gunPivot);
      gunPivot.add(gunGltf.scene);

      root.scale.set(modelScale, modelScale, modelScale);
      markAsPlayerModel(root);

      const bundle = { root, hullRoot, turretPivot, gunPivot, cfg };
      templateCache.set(skinId, bundle);
      return bundle;
    }catch(_e){
      const fb = buildFallbackTankGroup(skin);
      templateCache.set(skinId, fb);
      return fb;
    }
  })();

  loadingPromises.set(skinId, p);
  return p;
}

export async function ensurePlayerSkin3DLoaded(LoaderCls){
  const skin = getEquippedSkin();
  const skinId = skin?.id || 'Origin';
  if(state.playerModelSkinId === skinId && state.playerModelRoot){
    if(state.scene && !state.playerModelRoot.parent){
      state.scene.add(state.playerModelRoot);
    }
    return;
  }

  if(state.playerModelRoot && state.playerModelRoot.parent){
    state.playerModelRoot.parent.remove(state.playerModelRoot);
  }

  const bundle = await load3PartGlbSkin(skinId, LoaderCls);
  if(!bundle) return;

  state.playerModelSkinId = skinId;
  state.playerModelRoot = bundle.root;
  state.playerHullPivot = bundle.hullRoot;
  state.playerTurretPivot = bundle.turretPivot;
  state.playerGunPivot = bundle.gunPivot;
  state.playerModelCfg = bundle.cfg;

  if(state.scene){
    state.scene.add(bundle.root);
  }
}

export function setPlayerSkin3DVisibility(visible){
  if(state.playerModelRoot){
    state.playerModelRoot.visible = !!visible;
  }
}

export function syncPlayerSkin3DPose(dt, x, y, z, yaw, pitch, moveX = 0, moveZ = 0){
  if(!state.playerModelRoot) return;
  if(state.scene && !state.playerModelRoot.parent){
    state.scene.add(state.playerModelRoot);
  }
  state.playerModelRoot.position.set(x, y, z);

  // Smoothly align hull yaw toward movement direction, or gently follow camera yaw
  const moveLen = Math.hypot(moveX, moveZ);
  if(moveLen > 0.002){
    const targetBodyYaw = Math.atan2(-moveX, -moveZ);
    let diff = targetBodyYaw - (state.playerBodyYaw || 0);
    while(diff > Math.PI) diff -= Math.PI * 2;
    while(diff < -Math.PI) diff += Math.PI * 2;
    state.playerBodyYaw = (state.playerBodyYaw || 0) + diff * Math.min(1, dt * 8);
  }

  if(state.playerHullPivot){
    state.playerHullPivot.rotation.y = state.playerBodyYaw || 0;
  }
  if(state.playerTurretPivot){
    state.playerTurretPivot.rotation.y = yaw - (state.playerBodyYaw || 0);
  }
  if(state.playerGunPivot){
    const cfg = state.playerModelCfg || SKIN_PIVOTS.RapidFire;
    state.playerGunPivot.rotation.x = T.MathUtils.clamp(
      pitch,
      cfg.gunPitchMin ?? 0,
      cfg.gunPitchMax ?? Math.PI / 2
    );
  }
}

function collectWallMeshes(scene, explicitWalls){
  if(Array.isArray(explicitWalls) && explicitWalls.length > 0){
    return explicitWalls;
  }
  const walls = [];
  if(!scene) return walls;
  scene.traverse((obj) => {
    if(!obj.isMesh || !obj.visible) return;
    if(obj.userData?.isPlayerModel || obj.userData?.ignoreCamRay || obj.userData?.isEnemy || obj.userData?.isFx) return;
    if(obj.geometry && obj.geometry.type === 'PlaneGeometry' && Math.abs(obj.rotation.x) > 1.2) return;
    walls.push(obj);
  });
  return walls;
}

/**
 * Updates camera for either FPS or TPS with wall collision (camera never passes through walls)
 * and optional auto-switch to 1st-person when pushed close to the vehicle.
 */
export function updateGameCameraWithWallCollision({
  anchorX,
  anchorY,
  anchorZ,
  yaw,
  pitch,
  walls = null,
  roomLimit = null,
  tpsDistance = 5.8,
  autoFpsThreshold = 1.95
}){
  if(!state.camera) return;

  if(state.cameraViewMode === 'fps'){
    state.autoSwitchedToFps = false;
    setPlayerSkin3DVisibility(false);
    state.camera.position.set(anchorX, anchorY, anchorZ);
    state.camera.rotation.order = 'YXZ';
    state.camera.rotation.y = yaw;
    state.camera.rotation.x = pitch;
    return;
  }

  // TPS mode: pivot slightly above the tank center
  tmpPivot.set(anchorX, anchorY + 0.55, anchorZ);
  const cp = Math.cos(pitch);
  tmpBackDir.set(
    Math.sin(yaw) * cp,
    -Math.sin(pitch),
    Math.cos(yaw) * cp
  ).normalize();

  let hitDist = tpsDistance;

  // 1. Raycast against wall/obstacle meshes in scene
  const wallList = collectWallMeshes(state.scene, walls);
  if(wallList.length > 0){
    camRaycaster.set(tmpPivot, tmpBackDir);
    camRaycaster.near = 0.05;
    camRaycaster.far = tpsDistance;
    const hits = camRaycaster.intersectObjects(wallList, false);
    if(hits.length > 0){
      hitDist = Math.min(hitDist, Math.max(0.25, hits[0].distance - 0.35));
    }
  }

  // 2. Also clamp against known outer room boundary walls if provided
  if(typeof roomLimit === 'number' && roomLimit > 0){
    const wallBoundary = roomLimit + 0.85;
    const checkAxis = (originVal, dirVal) => {
      if(Math.abs(dirVal) < 1e-5) return Infinity;
      const tPos = (wallBoundary - originVal) / dirVal;
      const tNeg = (-wallBoundary - originVal) / dirVal;
      let tMin = Infinity;
      if(tPos > 0.05) tMin = Math.min(tMin, tPos);
      if(tNeg > 0.05) tMin = Math.min(tMin, tNeg);
      return tMin;
    };
    const tx = checkAxis(tmpPivot.x, tmpBackDir.x);
    const tz = checkAxis(tmpPivot.z, tmpBackDir.z);
    const boundDist = Math.min(tx, tz);
    if(boundDist < hitDist){
      hitDist = Math.max(0.25, boundDist - 0.35);
    }
  }

  // Prevent camera from dipping below ground
  if(tmpBackDir.y < -0.05){
    const groundT = (0.35 - tmpPivot.y) / tmpBackDir.y;
    if(groundT > 0.05 && groundT < hitDist){
      hitDist = Math.max(0.25, groundT);
    }
  }

  // 3. Auto-switch to 1st-person when camera gets close to the vehicle
  if(state.autoFirstPersonNearWall){
    if(hitDist < autoFpsThreshold){
      state.autoSwitchedToFps = true;
    } else if(state.autoSwitchedToFps && hitDist > autoFpsThreshold + 0.55){
      state.autoSwitchedToFps = false;
    }
  } else {
    state.autoSwitchedToFps = false;
  }

  if(state.autoSwitchedToFps){
    setPlayerSkin3DVisibility(false);
    state.camera.position.set(anchorX, anchorY, anchorZ);
  } else {
    setPlayerSkin3DVisibility(true);
    state.camera.position.copy(tmpPivot).addScaledVector(tmpBackDir, hitDist);
  }

  state.camera.rotation.order = 'YXZ';
  state.camera.rotation.y = yaw;
  state.camera.rotation.x = pitch;
}
