import * as T from '../libs/three.module.js';
import { DEFAULT_VEHICLE_CONFIG, getVehicleAssetPaths } from './VehicleConfig.js';
import { showToast } from '../ui.js';

function createFallbackHull(skinId = 'Origin'){
  const isWirbel = skinId === 'Wirbelwind';
  const group = new T.Group();
  group.name = `${skinId}_Hull_Fallback`;

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
  const group = new T.Group();
  group.name = `${skinId}_Gun_Fallback`;

  const gunMat = isWirbel
    ? new T.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.25, metalness: 0.82 })
    : new T.MeshStandardMaterial({ color: 0x456b7d, roughness: 0.35, metalness: 0.65 });
  const muzzleMat = new T.MeshStandardMaterial({ color: 0x111a20, roughness: 0.4, metalness: 0.7 });

  if(isWirbel){
    // 4連装20mm対空砲 (2列×2段)
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
  let cfg = { ...DEFAULT_VEHICLE_CONFIG };

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

  const [hullRes, turretRes, gunRes] = await Promise.all([
    tryLoadGlbFromCandidates(loader, paths.hullCandidates, createFallbackHull, skinId),
    tryLoadGlbFromCandidates(loader, paths.turretCandidates, createFallbackTurret, skinId),
    tryLoadGlbFromCandidates(loader, paths.gunCandidates, createFallbackGun, skinId)
  ]);

  const usingFallback = hullRes.isFallback || turretRes.isFallback || gunRes.isFallback;
  if(usingFallback){
    const reason = hullRes.error || turretRes.error || gunRes.error || 'unknown';
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
