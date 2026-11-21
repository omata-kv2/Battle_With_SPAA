import { makeTextSprite } from './multiplayer.js';

export function buildSkinStage(T, scene, skins, unlockedSkins, selectedSkinId){
  scene.background = new T.Color(0x0b1929);
  scene.fog = new T.FogExp2(0x0b1929, 0.02);

  scene.add(new T.HemisphereLight(0xe0fbfc, 0x1d3557, 1.3));
  const dir = new T.DirectionalLight(0xffffff, 1.2);
  dir.position.set(10, 22, 12);
  scene.add(dir);

  const floor = new T.Mesh(
    new T.PlaneGeometry(24, 24),
    new T.MeshStandardMaterial({ color: 0x162b40, roughness: 0.75 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2;
  scene.add(floor);

  const grid = new T.GridHelper(22, 22, 0xffd23f, 0x22415e);
  grid.position.y = -1.18;
  scene.add(grid);

  const pedestalMeshes = [];
  skins.forEach((skin, idx) => {
    const px = -7 + idx * 2.0;
    const pz = -5.5;
    const base = new T.Mesh(
      new T.CylinderGeometry(0.65, 0.78, 0.35, 16),
      new T.MeshStandardMaterial({ color: 0x243b53 })
    );
    base.position.set(px, -1.0, pz);
    scene.add(base);

    const orb = new T.Mesh(
      new T.OctahedronGeometry(0.45, 0),
      new T.MeshStandardMaterial({ color: skin.color, emissive: skin.color, emissiveIntensity: 0.35 })
    );
    orb.position.set(px, -0.25, pz);
    scene.add(orb);

    const tag = makeTextSprite(T, skin.name);
    tag.position.set(px, 0.65, pz);
    tag.scale.set(1.3, 0.65, 1);
    scene.add(tag);

    pedestalMeshes.push({ skinId: skin.id, orb, base });
  });

  const refreshPedestals = (unlocked, selectedId) => {
    for(const item of pedestalMeshes){
      const isUnl = unlocked.includes(item.skinId);
      const isSel = item.skinId === selectedId;
      item.orb.visible = isUnl;
      item.base.material.color.setHex(isSel ? 0x00f5d4 : 0x243b53);
    }
  };
  refreshPedestals(unlockedSkins, selectedSkinId);

  const zones = {
    backHome:    { x: 0,  z: 7.2, halfX: 2.2, halfZ: 1.4, color: 0x38c8f0, label: 'ホームへ戻る' },
    selectPanel: { x: -5, z: 2.0, halfX: 1.8, halfZ: 1.8, color: 0x00f5d4, label: '機体装備・強化' },
    store:       { x: 5,  z: 2.0, halfX: 1.8, halfZ: 1.8, color: 0xffd23f, label: '機体ショップ' }
  };

  for(const zKey of Object.keys(zones)){
    const zObj = zones[zKey];
    const pad = new T.Mesh(
      new T.PlaneGeometry(zObj.halfX * 2, zObj.halfZ * 2),
      new T.MeshBasicMaterial({ color: zObj.color, transparent: true, opacity: 0.28, side: T.DoubleSide })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(zObj.x, -1.16, zObj.z);
    scene.add(pad);

    const label = makeTextSprite(T, zObj.label);
    label.position.set(zObj.x, 0.8, zObj.z);
    scene.add(label);
  }

  return {
    spawnPos: { x: 0, z: 3.5 },
    spawnYaw: 0,
    zones,
    refreshPedestals
  };
}
