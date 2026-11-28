import * as T from '../libs/three.module.js';
import { DEFAULT_VEHICLE_CONFIG, getVehicleAssetPaths } from './VehicleConfig.js';
import { showToast } from '../ui.js';

function createFallbackHull(skinId = 'Origin'){
  const isWirbel = skinId === 'Wirbelwind';
  const isExp = skinId === 'Explosion';
  const group = new T.Group();
  group.name = `${skinId}_Hull_Fallback`;

  if(isExp){
    const redCamo = new T.MeshStandardMaterial({ color: 0x9e1b1b, roughness: 0.35, metalness: 0.6 });
    const trackMat = new T.MeshStandardMaterial({ color: 0x111518, roughness: 0.85, metalness: 0.2 });
    const yellowMat = new T.MeshBasicMaterial({ color: 0xffd23f });

    const chassis = new T.Mesh(new T.BoxGeometry(2.7, 0.95, 5.4), redCamo);
    chassis.position.set(0, 0.75, 0);
    group.add(chassis);
    [-1.52, 1.52].forEach((tx) => {
      const track = new T.Mesh(new T.BoxGeometry(0.54, 0.75, 5.6), trackMat);
      track.position.set(tx, 0.38, 0);
      group.add(track);
    });
    const light = new T.Mesh(new T.BoxGeometry(2.1, 0.08, 0.08), yellowMat);
    light.position.set(0, 0.95, -2.72);
    group.add(light);
    return group;
  }
  if(skinId === 'Laser'){
    const copperMat = new T.MeshStandardMaterial({ color: 0xc86428, roughness: 0.32, metalness: 0.78 });
    const trackMat = new T.MeshStandardMaterial({ color: 0x111518, roughness: 0.85, metalness: 0.2 });
    const limeMat = new T.MeshBasicMaterial({ color: 0xa8ff60 });

    const chassis = new T.Mesh(new T.BoxGeometry(2.65, 0.82, 4.9), copperMat);
    chassis.position.set(0, 0.72, 0);
    group.add(chassis);
    [-1.48, 1.48].forEach((tx) => {
      const track = new T.Mesh(new T.BoxGeometry(0.52, 0.7, 5.0), trackMat);
      track.position.set(tx, 0.35, 0);
      group.add(track);
    });
    const glow = new T.Mesh(new T.BoxGeometry(2.0, 0.08, 0.08), limeMat);
    glow.position.set(0, 0.88, -2.48);
    group.add(glow);
    return group;
  }

  if(skinId === 'RapidFire'){
    const bodyMat = new T.MeshStandardMaterial({ color: 0xb8c2cc, roughness: 0.28, metalness: 0.82 });
    const trackMat = new T.MeshStandardMaterial({ color: 0x121619, roughness: 0.85, metalness: 0.2 });
    const redMat = new T.MeshBasicMaterial({ color: 0xff2244 });
    const chassis = new T.Mesh(new T.BoxGeometry(2.55, 0.85, 4.9), bodyMat);
    chassis.position.set(0, 0.72, 0);
    group.add(chassis);
    [-1.42, 1.42].forEach((tx) => {
      const track = new T.Mesh(new T.BoxGeometry(0.54, 0.72, 5.1), trackMat);
      track.position.set(tx, 0.36, 0);
      group.add(track);
    });
    const line = new T.Mesh(new T.BoxGeometry(1.9, 0.08, 0.08), redMat);
    line.position.set(0, 0.9, -2.48);
    group.add(line);
    return group;
  }

  if(skinId === 'Beast'){
    const snowMat = new T.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.45, metalness: 0.25 });
    const grayMat = new T.MeshStandardMaterial({ color: 0xcfd8e3, roughness: 0.5, metalness: 0.25 });
    const trackMat = new T.MeshStandardMaterial({ color: 0x121518, roughness: 0.85, metalness: 0.2 });
    const redMat = new T.MeshBasicMaterial({ color: 0xff2244 });

    const chassis = new T.Mesh(new T.BoxGeometry(2.6, 0.9, 5.2), snowMat);
    chassis.position.set(0, 0.72, 0);
    group.add(chassis);
    const sideArmor = new T.Mesh(new T.BoxGeometry(2.85, 0.45, 4.4), grayMat);
    sideArmor.position.set(0, 0.78, 0);
    group.add(sideArmor);
    [-1.48, 1.48].forEach((tx) => {
      const track = new T.Mesh(new T.BoxGeometry(0.5, 0.72, 5.3), trackMat);
      track.position.set(tx, 0.36, 0);
      group.add(track);
    });
    const glow = new T.Mesh(new T.BoxGeometry(1.9, 0.08, 0.08), redMat);
    glow.position.set(0, 0.92, -2.62);
    group.add(glow);
    return group;
  }

  if(skinId === 'Automatic'){
    const blackMat = new T.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.32, metalness: 0.78 });
    const trackMat = new T.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.85, metalness: 0.2 });
    const redMat = new T.MeshBasicMaterial({ color: 0xff2244 });

    const chassis = new T.Mesh(new T.BoxGeometry(2.65, 0.92, 4.8), blackMat);
    chassis.position.set(0, 0.74, 0);
    group.add(chassis);
    [-1.46, 1.46].forEach((tx) => {
      const track = new T.Mesh(new T.BoxGeometry(0.5, 0.72, 5.0), trackMat);
      track.position.set(tx, 0.36, 0);
      group.add(track);
    });
    const redLine = new T.Mesh(new T.BoxGeometry(2.2, 0.06, 0.06), redMat);
    redLine.position.set(0, 0.95, -2.42);
    group.add(redLine);
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

  if(skinId === 'RapidFire'){
    const turretMat = new T.MeshStandardMaterial({ color: 0xc2ccd6, roughness: 0.26, metalness: 0.84 });
    const redMat = new T.MeshBasicMaterial({ color: 0xff2244 });
    const base = new T.Mesh(new T.BoxGeometry(2.0, 0.65, 2.0), turretMat);
    base.position.set(0, 0.35, 0);
    group.add(base);
    [-0.78, 0.78].forEach((sx) => {
      const tower = new T.Mesh(new T.BoxGeometry(0.42, 1.55, 1.15), turretMat);
      tower.position.set(sx, 1.25, 0);
      group.add(tower);
    });
    const strip = new T.Mesh(new T.BoxGeometry(1.8, 0.08, 0.08), redMat);
    strip.position.set(0, 0.65, -1.02);
    group.add(strip);
    return group;
  }

  if(skinId === 'Beast'){
    const snowMat = new T.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.42, metalness: 0.28 });
    const redMat = new T.MeshBasicMaterial({ color: 0xff2244 });
    const turret = new T.Mesh(new T.BoxGeometry(2.05, 0.85, 2.5), snowMat);
    turret.position.set(0, 0.45, 0);
    group.add(turret);
    const sight = new T.Mesh(new T.BoxGeometry(0.42, 0.28, 0.42), redMat);
    sight.position.set(0.35, 0.98, -0.2);
    group.add(sight);
    return group;
  }

  if(skinId === 'Automatic'){
    const blackMat = new T.MeshStandardMaterial({ color: 0x1d222b, roughness: 0.3, metalness: 0.8 });
    const flirMat = new T.MeshBasicMaterial({ color: 0x22dd66 });
    const redMat = new T.MeshBasicMaterial({ color: 0xff2244 });
    const base = new T.Mesh(new T.BoxGeometry(1.75, 0.85, 2.0), blackMat);
    base.position.set(0, 0.45, 0);
    group.add(base);
    const flir = new T.Mesh(new T.BoxGeometry(0.45, 0.32, 0.45), flirMat);
    flir.position.set(0, 0.52, -1.02);
    group.add(flir);
    const radar = new T.Mesh(new T.BoxGeometry(0.95, 0.25, 0.25), redMat);
    radar.position.set(0, 1.05, 0.45);
    group.add(radar);
    return group;
  }

  if(skinId === 'Explosion'){
    const redCamo = new T.MeshStandardMaterial({ color: 0x8c1616, roughness: 0.35, metalness: 0.62 });
    const yellowMat = new T.MeshBasicMaterial({ color: 0xffd23f });
    const turret = new T.Mesh(new T.BoxGeometry(2.2, 0.95, 3.0), redCamo);
    turret.position.set(0, 0.5, 0.2);
    group.add(turret);
    const line = new T.Mesh(new T.BoxGeometry(2.24, 0.07, 2.8), yellowMat);
    line.position.set(0, 0.78, 0.2);
    group.add(line);
    return group;
  }
  if(skinId === 'Laser'){
    const blackMat = new T.MeshStandardMaterial({ color: 0x181c22, roughness: 0.35, metalness: 0.72 });
    const base = new T.Mesh(new T.BoxGeometry(1.9, 0.65, 1.9), blackMat);
    base.position.set(0, 0.35, 0);
    group.add(base);
    [-0.85, 0.85].forEach((sx) => {
      const yoke = new T.Mesh(new T.BoxGeometry(0.28, 0.95, 0.8), blackMat);
      yoke.position.set(sx, 0.75, 0);
      group.add(yoke);
    });
    return group;
  }
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
    const gunMat = new T.MeshStandardMaterial({ color: 0x6b1818, roughness: 0.35, metalness: 0.72 });
    const muzzleMat = new T.MeshStandardMaterial({ color: 0x16191e, roughness: 0.4, metalness: 0.75 });
    const mantlet = new T.Mesh(new T.BoxGeometry(0.7, 0.55, 0.75), gunMat);
    mantlet.position.set(0, 0, -0.15);
    group.add(mantlet);
    const barrel = new T.Mesh(new T.CylinderGeometry(0.12, 0.14, 4.2, 14), gunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -2.35);
    group.add(barrel);
    const brake = new T.Mesh(new T.BoxGeometry(0.42, 0.28, 0.45), muzzleMat);
    brake.position.set(0, 0, -4.5);
    group.add(brake);
    return group;
  }
  if(skinId === 'Laser'){
    const blackMat = new T.MeshStandardMaterial({ color: 0x161a20, roughness: 0.32, metalness: 0.78 });
    const cyanLens = new T.MeshBasicMaterial({ color: 0x00f5d4 });
    const body = new T.Mesh(new T.BoxGeometry(1.1, 0.85, 2.8), blackMat);
    body.position.set(0, 0, -0.8);
    group.add(body);
    const lens = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.12, 16), cyanLens);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, -2.22);
    group.add(lens);
    return group;
  }

  if(skinId === 'RapidFire'){
    const frameMat = new T.MeshStandardMaterial({ color: 0xaab4be, roughness: 0.3, metalness: 0.8 });
    const barrelMat = new T.MeshStandardMaterial({ color: 0x181e24, roughness: 0.35, metalness: 0.75 });
    const drum = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 0.9, 14), frameMat);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, -0.55, 0.1);
    group.add(drum);
    const shroud = new T.Mesh(new T.CylinderGeometry(0.26, 0.28, 2.7, 14), barrelMat);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(0, 0, -1.45);
    group.add(shroud);
    return group;
  }

  if(skinId === 'Beast'){
    const barrelMat = new T.MeshStandardMaterial({ color: 0x222830, roughness: 0.35, metalness: 0.7 });
    const podMat = new T.MeshStandardMaterial({ color: 0x161a20, roughness: 0.4, metalness: 0.75 });
    const mainGun = new T.Mesh(new T.CylinderGeometry(0.09, 0.11, 2.7, 12), barrelMat);
    mainGun.rotation.x = Math.PI / 2;
    mainGun.position.set(0, 0.1, -1.25);
    group.add(mainGun);
    const pod = new T.Mesh(new T.BoxGeometry(0.55, 0.48, 1.45), podMat);
    pod.position.set(-0.78, 0.14, -0.35);
    group.add(pod);
    return group;
  }

  if(skinId === 'Automatic'){
    const podMat = new T.MeshStandardMaterial({ color: 0x1b2028, roughness: 0.32, metalness: 0.78 });
    const redMat = new T.MeshBasicMaterial({ color: 0xff2244 });
    [-1.15, 1.15].forEach((px) => {
      const pod = new T.Mesh(new T.BoxGeometry(0.68, 0.68, 2.2), podMat);
      pod.position.set(px, 0.08, -0.35);
      group.add(pod);
      const trim = new T.Mesh(new T.BoxGeometry(0.7, 0.06, 2.22), redMat);
      trim.position.set(px, 0.44, -0.35);
      group.add(trim);
    });
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

export async function loadVehicleAssets(passedLoader, skinId = 'Origin', options = {}){
  const loader = await ensureGLTFLoader(passedLoader);
  const paths = getVehicleAssetPaths(skinId);
  let cfg = {
    ...DEFAULT_VEHICLE_CONFIG,
    ...(skinId === 'Explosion' ? { turretPivot: [0, 1.2, 0.35], gunPivot: [0, 0.62, -1.1], scale: 0.68 } : {}),
    ...(skinId === 'RapidFire' ? { turretPivot: [0, 1.18, -0.18], gunPivot: [0, 1.62, 0.05] } : {}),
    ...(skinId === 'Laser' ? { turretPivot: [0, 1.12, 0.58], gunPivot: [0, 0.82, 0.0], scale: 0.68 } : {}),
    ...(skinId === 'Automatic' ? { turretPivot: [0, 1.12, -0.08], gunPivot: [0, 0.62, -0.06], scale: 0.68 } : {}),
    ...(skinId === 'Beast' ? { turretPivot: [0, 1.2, -0.1], gunPivot: [0, 0.44, -0.82], scale: 0.68 } : {})
  };

  let cfgDir = null;
  for(const cfgUrl of paths.configCandidates){
    try{
      const res = await fetch(cfgUrl, { cache: 'no-store' });
      if(res.ok){
        const parsed = await res.json();
        if(parsed && typeof parsed === 'object'){
          cfg = { ...cfg, ...parsed };
          if(parsed.offsets){
            if(Array.isArray(parsed.offsets.turret)) cfg.turretPivot = parsed.offsets.turret;
            if(Array.isArray(parsed.offsets.gun)) cfg.gunPivot = parsed.offsets.gun;
          }
          if(parsed.limits){
            if(typeof parsed.limits.gunPitchMinRad === 'number') cfg.minElevation = parsed.limits.gunPitchMinRad;
            if(typeof parsed.limits.gunPitchMaxRad === 'number') cfg.maxElevation = parsed.limits.gunPitchMaxRad;
          }
          cfgDir = cfgUrl.slice(0, cfgUrl.lastIndexOf('/'));
          break;
        }
      }
    }catch(_e){}
  }

  if(cfg.parts && cfgDir){
    if(cfg.parts.hull) paths.hullCandidates.unshift(`${cfgDir}/${cfg.parts.hull}`);
    if(cfg.parts.turret) paths.turretCandidates.unshift(`${cfgDir}/${cfg.parts.turret}`);
    if(cfg.parts.gun) paths.gunCandidates.unshift(`${cfgDir}/${cfg.parts.gun}`);
  }

  const hullPromise = tryLoadGlbFromCandidates(loader, paths.hullCandidates, createFallbackHull, skinId);
  const gunPromise = tryLoadGlbFromCandidates(loader, paths.gunCandidates, createFallbackGun, skinId);
  const turretPromise = cfg.hasTurret
    ? tryLoadGlbFromCandidates(loader, paths.turretCandidates, createFallbackTurret, skinId)
    : Promise.resolve({ scene: null, isFallback: false, loadedUrl: null, error: null });

  const [hullRes, turretRes, gunRes] = await Promise.all([hullPromise, turretPromise, gunPromise]);

  const usingFallback = hullRes.isFallback || (cfg.hasTurret && turretRes.isFallback) || gunRes.isFallback;
  if(usingFallback && !options.silent){
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
