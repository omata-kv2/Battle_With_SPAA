import * as T from '../libs/three.module.js';
import { DEFAULT_VEHICLE_CONFIG, getVehicleAssetPaths } from './VehicleConfig.js';
import { showToast } from '../ui.js';

function createFallbackHull(skinId = 'Origin'){
  const isWirbel = skinId === 'Wirbelwind';
  const isExp = skinId === 'Explosion';
  const group = new T.Group();
  group.name = `${skinId}_Hull_Fallback`;

  if(isExp){
    const bodyMat = new T.MeshStandardMaterial({ color: 0x451a08, roughness: 0.38, metalness: 0.72 });
    const trackMat = new T.MeshStandardMaterial({ color: 0x111518, roughness: 0.85, metalness: 0.2 });

    // 1:1比率・高さ1.25倍の車体
    const chassis = new T.Mesh(new T.BoxGeometry(2.9, 1.15, 3.4), bodyMat);
    chassis.position.set(0, 0.95, 0);
    group.add(chassis);

    [-1.58, 1.58].forEach((tx) => {
      const track = new T.Mesh(new T.BoxGeometry(0.6, 0.95, 3.65), trackMat);
      track.position.set(tx, 0.48, 0);
      group.add(track);
    });
    return group;
  }

  if(skinId === 'Scatter'){
    const bodyMat = new T.MeshStandardMaterial({ color: 0x1e4d2b, roughness: 0.42, metalness: 0.55 });
    const trackMat = new T.MeshStandardMaterial({ color: 0x121619, roughness: 0.85, metalness: 0.2 });
    const yellowMat = new T.MeshBasicMaterial({ color: 0xffd23f });

    const chassis = new T.Mesh(new T.BoxGeometry(2.6, 0.85, 4.9), bodyMat);
    chassis.position.set(0, 0.72, 0);
    group.add(chassis);

    [-1.45, 1.45].forEach((tx) => {
      const track = new T.Mesh(new T.BoxGeometry(0.54, 0.72, 5.1), trackMat);
      track.position.set(tx, 0.36, 0);
      group.add(track);
    });

    const line = new T.Mesh(new T.BoxGeometry(2.0, 0.08, 0.08), yellowMat);
    line.position.set(0, 0.9, -2.48);
    group.add(line);
    return group;
  }

  const bodyMat = isWirbel
    ? new T.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.25, metalness: 0.85 })
    : new T.MeshStandardMaterial({ color: 0x264653, roughness: 0.55, metalness: 0.35 });
  const trackMat = new T.MeshStandardMaterial({ color: 0x16222a, roughness: 0.85, metalness: 0.2 });
  const accentMat = new T.MeshBasicMaterial({ color: isWirbel ? 0xff2244 : 0x00f5d4 });

  const chassis = new T.Mesh(new T.BoxGeometry(2.35, 0.85, 4.9), bodyMat);
  chassis.position.set(0, 0.72, 0);
  group.add(chassis);

  const glacis = new T.Mesh(new T.BoxGeometry(2.2, 0.45, 0.9), bodyMat);
  glacis.position.set(0, 0.92, -2.15);
  glacis.rotation.x = 0.25;
  group.add(glacis);

  [-1.28, 1.28].forEach((tx) => {
    const track = new T.Mesh(new T.BoxGeometry(0.52, 0.72, 5.2), trackMat);
    track.position.set(tx, 0.36, 0);
    group.add(track);
  });

  const frontStrip = new T.Mesh(new T.BoxGeometry(1.6, 0.08, 0.08), accentMat);
  frontStrip.position.set(0, 0.88, -2.55);
  group.add(frontStrip);

  return group;
}

function createFallbackTurret(skinId = 'Origin'){
  const isWirbel = skinId === 'Wirbelwind';
  const group = new T.Group();
  group.name = `${skinId}_Turret_Fallback`;

  if(skinId === 'Scatter'){
    const turretMat = new T.MeshStandardMaterial({ color: 0x245e35, roughness: 0.4, metalness: 0.58 });
    const yellowMat = new T.MeshBasicMaterial({ color: 0xffd23f });
    const base = new T.Mesh(new T.BoxGeometry(2.05, 0.75, 2.05), turretMat);
    base.position.set(0, 0.42, 0);
    group.add(base);
    const optic = new T.Mesh(new T.BoxGeometry(0.45, 0.22, 0.25), yellowMat);
    optic.position.set(0, 0.72, -0.95);
    group.add(optic);
    return group;
  }

  const turretMat = isWirbel
    ? new T.MeshStandardMaterial({ color: 0xe6b830, roughness: 0.22, metalness: 0.88 })
    : new T.MeshStandardMaterial({ color: 0x2f5d6e, roughness: 0.48, metalness: 0.4 });
  const trimMat = isWirbel
    ? new T.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.3, metalness: 0.8 })
    : new T.MeshStandardMaterial({ color: 0x193442, roughness: 0.5, metalness: 0.5 });

  if(isWirbel){
    const poly = new T.Mesh(new T.CylinderGeometry(1.38, 1.48, 1.15, 9), turretMat);
    poly.position.set(0, 0.58, 0);
    group.add(poly);
  } else {
    const mainBox = new T.Mesh(new T.BoxGeometry(2.2, 1.05, 2.6), turretMat);
    mainBox.position.set(0, 0.55, 0);
    group.add(mainBox);

    const bustle = new T.Mesh(new T.BoxGeometry(1.85, 0.85, 0.7), trimMat);
    bustle.position.set(0, 0.62, 1.45);
    group.add(bustle);
  }

  return group;
}

function createFallbackGun(skinId = 'Origin'){
  const isWirbel = skinId === 'Wirbelwind';
  const isExp = skinId === 'Explosion';
  const group = new T.Group();
  group.name = `${skinId}_Gun_Fallback`;

  if(isExp){
    // 上向き(+Y)に伸びる杖＋金リング2本＋赤水晶(#bf0606)
    const shaftMat = new T.MeshStandardMaterial({ color: 0x3b1f14, roughness: 0.45, metalness: 0.35 });
    const goldMat = new T.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.25, metalness: 0.85 });
    const crystalMat = new T.MeshBasicMaterial({ color: 0xbf0606 });

    const shaft = new T.Mesh(new T.CylinderGeometry(0.08, 0.11, 3.6, 12), shaftMat);
    shaft.position.set(0, 1.8, 0);
    group.add(shaft);

    [2.7, 3.25].forEach((ry) => {
      const ring = new T.Mesh(new T.TorusGeometry(0.16, 0.035, 8, 18), goldMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, ry, 0);
      group.add(ring);
    });

    const crystal = new T.Mesh(new T.OctahedronGeometry(0.28, 0), crystalMat);
    crystal.position.set(0, 3.9, 0);
    group.add(crystal);
    return group;
  }

  if(skinId === 'Scatter'){
    const podMat = new T.MeshStandardMaterial({ color: 0x1e4d2b, roughness: 0.38, metalness: 0.62 });
    const muzzleMat = new T.MeshStandardMaterial({ color: 0x101417, roughness: 0.5, metalness: 0.5 });
    const pod = new T.Mesh(new T.BoxGeometry(2.0, 1.05, 2.3), podMat);
    pod.position.set(0, 0.48, -0.85);
    group.add(pod);
    const frontPlate = new T.Mesh(new T.BoxGeometry(1.88, 0.92, 0.08), muzzleMat);
    frontPlate.position.set(0, 0.48, -2.02);
    group.add(frontPlate);
    return group;
  }

  const gunMat = isWirbel
    ? new T.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.25, metalness: 0.82 })
    : new T.MeshStandardMaterial({ color: 0x456b7d, roughness: 0.35, metalness: 0.65 });
  const muzzleMat = new T.MeshStandardMaterial({ color: 0x111a20, roughness: 0.4, metalness: 0.7 });

  if(isWirbel){
    const offsets = [
      [-0.24, 0.24],
      [0.24, 0.24],
      [-0.24, -0.02],
      [0.24, -0.02]
    ];
    const mount = new T.Mesh(new T.BoxGeometry(0.76, 0.5, 0.5), gunMat);
    mount.position.set(0, 0.11, -0.1);
    group.add(mount);

    for(const [ox, oy] of offsets){
      const barrel = new T.Mesh(new T.CylinderGeometry(0.055, 0.065, 2.15, 12), gunMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(ox, oy, -1.25);
      group.add(barrel);

      const nozzle = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.22, 12), muzzleMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(ox, oy, -2.35);
      group.add(nozzle);
    }
  } else {
    const breech = new T.Mesh(new T.BoxGeometry(0.36, 0.42, 0.55), gunMat);
    breech.position.set(0, 0.12, -0.15);
    group.add(breech);

    const barrel = new T.Mesh(new T.CylinderGeometry(0.11, 0.13, 2.45, 16), gunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.12, -1.45);
    group.add(barrel);

    const nozzle = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.28, 16), muzzleMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0.12, -2.65);
    group.add(nozzle);
  }

  return group;
}

async function ensureGLTFLoader(passedLoader){
  if(passedLoader && typeof passedLoader.loadAsync === 'function'){
    return passedLoader;
  }
  try{
    const mod = await import('../libs/GLTFLoader.js');
    if(mod && mod.GLTFLoader) return new mod.GLTFLoader();
  }catch(_e){}
  if(globalThis.THREE && globalThis.THREE.GLTFLoader){
    return new globalThis.THREE.GLTFLoader();
  }
  return null;
}

function parseGlbArrayBuffer(loader, buffer, basePath){
  return new Promise((resolve, reject) => {
    if(typeof loader.parse === 'function'){
      loader.parse(buffer, basePath, (gltf) => resolve(gltf), (err) => reject(err));
    } else {
      reject(new Error('GLTFLoader.parse unavailable'));
    }
  });
}

async function tryLoadGlbFromCandidates(loader, candidates, fallbackBuilder, skinId){
  let lastErr = 'GLTFLoader未初期化';
  if(loader){
    for(const url of candidates){
      try{
        const res = await fetch(url, { cache: 'no-store' });
        if(!res.ok){
          lastErr = `${url} -> HTTP ${res.status}`;
          continue;
        }
        const buf = await res.arrayBuffer();
        const basePath = url.slice(0, url.lastIndexOf('/') + 1);
        let gltf = null;
        if(typeof loader.parse === 'function'){
          gltf = await parseGlbArrayBuffer(loader, buf, basePath);
        } else if(typeof loader.loadAsync === 'function'){
          gltf = await loader.loadAsync(url);
        }
        if(gltf && gltf.scene){
          gltf.scene.traverse((obj) => {
            if(obj && obj.isMesh){
              obj.frustumCulled = false;
            }
          });
          return { scene: gltf.scene, isFallback: false, loadedUrl: url, error: null };
        }
        lastErr = `${url} -> scene空`;
      }catch(err){
        lastErr = `${url} -> ${err?.message || err}`;
        console.warn(`[VehicleLoader] 読込失敗 (${url}):`, err);
      }
    }
  }
  return { scene: fallbackBuilder(skinId), isFallback: true, loadedUrl: null, error: lastErr };
}

export async function loadVehicleAssets(passedLoader, skinId = 'Origin'){
  const loader = await ensureGLTFLoader(passedLoader);
  const paths = getVehicleAssetPaths(skinId);
  let cfg = {
    ...DEFAULT_VEHICLE_CONFIG,
    ...(skinId === 'Explosion' ? { hasTurret: false, isStaffMode: true, staffPivot: [0, 1.6, -0.121] } : {})
  };

  for(const cfgUrl of paths.configCandidates){
    try{
      const res = await fetch(cfgUrl, { cache: 'no-store' });
      if(res.ok){
        const parsed = await res.json();
        if(parsed && typeof parsed === 'object'){
          cfg = { ...cfg, ...parsed };
          break;
        }
      }
    }catch(_e){}
  }

  const hullPromise = tryLoadGlbFromCandidates(loader, paths.hullCandidates, createFallbackHull, skinId);
  const gunPromise = tryLoadGlbFromCandidates(loader, paths.gunCandidates, createFallbackGun, skinId);
  const turretPromise = cfg.hasTurret
    ? tryLoadGlbFromCandidates(loader, paths.turretCandidates, createFallbackTurret, skinId)
    : Promise.resolve({ scene: null, isFallback: false, loadedUrl: null, error: null });

  const [hullRes, turretRes, gunRes] = await Promise.all([hullPromise, turretPromise, gunPromise]);

  const usingFallback = hullRes.isFallback || (cfg.hasTurret && turretRes.isFallback) || gunRes.isFallback;
  if(usingFallback){
    const reason = hullRes.error || (cfg.hasTurret ? turretRes.error : null) || gunRes.error || 'unknown';
    showToast(`3D機体フォールバック (${skinId}): ${reason}`, 4500);
  }

  return {
    skinId,
    config: cfg,
    hullScene: hullRes.scene,
    turretScene: turretRes.scene,
    gunScene: gunRes.scene,
    usingDummyFallback: usingFallback
  };
}
