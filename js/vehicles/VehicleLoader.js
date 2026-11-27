import * as T from '../libs/three.module.js';
import { DEFAULT_VEHICLE_CONFIG, getVehicleAssetPaths } from './VehicleConfig.js';
import { showToast } from '../ui.js';

function createFallbackHull(){
  const group = new T.Group();
  group.name = 'Origin_Hull_Fallback';

  const bodyMat = new T.MeshStandardMaterial({ color: 0x264653, roughness: 0.55, metalness: 0.35 });
  const trackMat = new T.MeshStandardMaterial({ color: 0x16222a, roughness: 0.85, metalness: 0.2 });
  const accentMat = new T.MeshBasicMaterial({ color: 0x00f5d4 });

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

function createFallbackTurret(){
  const group = new T.Group();
  group.name = 'Origin_Turret_Fallback';

  const turretMat = new T.MeshStandardMaterial({ color: 0x2f5d6e, roughness: 0.48, metalness: 0.4 });
  const trimMat = new T.MeshStandardMaterial({ color: 0x193442, roughness: 0.5, metalness: 0.5 });

  const mainBox = new T.Mesh(new T.BoxGeometry(2.2, 1.05, 2.6), turretMat);
  mainBox.position.set(0, 0.55, 0);
  group.add(mainBox);

  const bustle = new T.Mesh(new T.BoxGeometry(1.85, 0.85, 0.7), trimMat);
  bustle.position.set(0, 0.62, 1.45);
  group.add(bustle);

  return group;
}

function createFallbackGun(){
  const group = new T.Group();
  group.name = 'Origin_Gun_Fallback';

  const gunMat = new T.MeshStandardMaterial({ color: 0x456b7d, roughness: 0.35, metalness: 0.65 });
  const muzzleMat = new T.MeshStandardMaterial({ color: 0x111a20, roughness: 0.4, metalness: 0.7 });

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

async function tryLoadGlbFromCandidates(loader, candidates, fallbackBuilder){
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
  return { scene: fallbackBuilder(), isFallback: true, loadedUrl: null, error: lastErr };
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
    tryLoadGlbFromCandidates(loader, paths.hullCandidates, createFallbackHull),
    tryLoadGlbFromCandidates(loader, paths.turretCandidates, createFallbackTurret),
    tryLoadGlbFromCandidates(loader, paths.gunCandidates, createFallbackGun)
  ]);

  const usingFallback = hullRes.isFallback || turretRes.isFallback || gunRes.isFallback;
  if(usingFallback){
    const reason = hullRes.error || turretRes.error || gunRes.error || 'unknown';
    showToast(`3D機体フォールバック: ${reason}`, 4500);
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
