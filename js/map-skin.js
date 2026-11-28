import { CONFIG } from './config.js';

export function buildSkinWorld(T, scene, unlockedSkins = ['Origin'], selectedSkinId = 'Origin'){
  scene.background = new T.Color(0x4c96e0);
  scene.fog = new T.FogExp2(0x4c96e0, 0.01);

  scene.add(new T.HemisphereLight(0xbbeeff, 0x162430, 1.4));
  const dir = new T.DirectionalLight(0xffffff, 1.5);
  dir.position.set(10, 22, 10);
  scene.add(dir);

  const floor = new T.Mesh(
    new T.PlaneGeometry(38, 38),
    new T.MeshStandardMaterial({ color: 0xb9b9bd, roughness: 0.65, metalness: 0.2 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  scene.add(floor);

  const grid = new T.GridHelper(38, 19, 0xff9233, 0x1e3f5a);
  grid.position.y = -1.98;
  scene.add(grid);

  const backHomeGroup = new T.Group();
  backHomeGroup.position.set(0, -2, 12);
  const backRing = new T.Mesh(
    new T.RingGeometry(1.6, 2.2, 32),
    new T.MeshBasicMaterial({ color: 0x00f5d4, side: T.DoubleSide })
  );
  backRing.rotation.x = -Math.PI / 2;
  backRing.position.y = 0.04;
  backHomeGroup.add(backRing);

  const cBack = document.createElement('canvas');
  cBack.width = 420;
  cBack.height = 120;
  const ctxB = cBack.getContext('2d');
  ctxB.fillStyle = 'rgba(7,21,34,0.88)';
  ctxB.fillRect(0, 0, 420, 120);
  ctxB.strokeStyle = '#00f5d4';
  ctxB.lineWidth = 6;
  ctxB.strokeRect(3, 3, 414, 114);
  ctxB.fillStyle = '#fff';
  ctxB.font = 'bold 36px sans-serif';
  ctxB.textAlign = 'center';
  ctxB.fillText('ホームへ戻る', 210, 72);
  const sprB = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cBack), transparent: true }));
  sprB.scale.set(3.8, 1.1, 1);
  sprB.position.set(0, 2.3, 0);
  backHomeGroup.add(sprB);
  scene.add(backHomeGroup);

  function createConsole(title, colorHex, x, z){
    const g = new T.Group();
    g.position.set(x, -2, z);
    const desk = new T.Mesh(
      new T.BoxGeometry(2.6, 1.3, 1.4),
      new T.MeshStandardMaterial({ color: 0x1b3a54, roughness: 0.4, metalness: 0.5 })
    );
    desk.position.y = 0.65;
    g.add(desk);

    const holo = new T.Mesh(
      new T.OctahedronGeometry(0.45, 0),
      new T.MeshBasicMaterial({ color: colorHex, wireframe: true })
    );
    holo.position.y = 1.9;
    g.add(holo);

    const cv = document.createElement('canvas');
    cv.width = 440;
    cv.height = 120;
    const cx = cv.getContext('2d');
    cx.fillStyle = 'rgba(7,21,34,0.88)';
    cx.fillRect(0, 0, 440, 120);
    cx.strokeStyle = '#' + colorHex.toString(16).padStart(6, '0');
    cx.lineWidth = 6;
    cx.strokeRect(3, 3, 434, 114);
    cx.fillStyle = '#fff';
    cx.font = 'bold 34px sans-serif';
    cx.textAlign = 'center';
    cx.fillText(title, 220, 72);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), transparent: true }));
    sp.scale.set(3.8, 1.05, 1);
    sp.position.y = 2.9;
    g.add(sp);

    scene.add(g);
    return { group: g, holo, x, z, radius: 2.3 };
  }

  const selectConsole = createConsole('機体選択・強化パネル', 0x00f5d4, 0, 4);

  const pedestals = [];
  const totalSkins = CONFIG.SKINS.length;
  CONFIG.SKINS.forEach((skin, idx) => {
    const angle = ((idx - (totalSkins - 1) / 2) / totalSkins) * Math.PI * 0.92;
    const radius = 10.5;
    const px = Math.sin(angle) * radius;
    const pz = -Math.cos(angle) * radius + 1.5;

    const pGroup = new T.Group();
    pGroup.position.set(px, -2, pz);

    const base = new T.Mesh(
      new T.CylinderGeometry(1.15, 1.35, 0.45, 20),
      new T.MeshStandardMaterial({ color: 0x1a334a, metalness: 0.5, roughness: 0.4 })
    );
    base.position.y = 0.225;
    pGroup.add(base);

    const ring = new T.Mesh(
      new T.RingGeometry(1.2, 1.42, 24),
      new T.MeshBasicMaterial({ color: skin.color, side: T.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.46;
    pGroup.add(ring);

    const coreModel = new T.Mesh(
      new T.OctahedronGeometry(0.75, 1),
      new T.MeshStandardMaterial({ color: skin.color, emissive: skin.color, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.3 })
    );
    coreModel.position.y = 1.65;
    pGroup.add(coreModel);

    const cv = document.createElement('canvas');
    cv.width = 360;
    cv.height = 110;
    const cx = cv.getContext('2d');
    cx.fillStyle = 'rgba(7,21,34,0.85)';
    cx.fillRect(0, 0, 360, 110);
    cx.fillStyle = '#fff';
    cx.font = 'bold 34px sans-serif';
    cx.textAlign = 'center';
    cx.fillText(skin.name, 180, 52);
    cx.fillStyle = '#8fb4cc';
    cx.font = '24px sans-serif';
    cx.fillText(unlockedSkins.includes(skin.id) ? (skin.id === selectedSkinId ? '【装備中】' : '解放済み') : `${skin.price} G`, 180, 90);

    const labelTex = new T.CanvasTexture(cv);
    const labelSpr = new T.Sprite(new T.SpriteMaterial({ map: labelTex, transparent: true }));
    labelSpr.scale.set(2.8, 0.85, 1);
    labelSpr.position.y = 2.95;
    pGroup.add(labelSpr);

    scene.add(pGroup);
    pedestals.push({ skin, pGroup, coreModel, ring, labelCanvas: cv, labelTex });
  });

  function refreshPedestals(curUnlocked, curSelected){
    pedestals.forEach(item => {
      const isUnl = curUnlocked.includes(item.skin.id);
      const isSel = item.skin.id === curSelected;
      item.coreModel.material.opacity = isUnl ? 1.0 : 0.28;
      item.coreModel.material.transparent = !isUnl;
      item.ring.material.color.setHex(isSel ? 0xffd23f : (isUnl ? item.skin.color : 0x3b5266));

      const cx = item.labelCanvas.getContext('2d');
      cx.clearRect(0, 0, 360, 110);
      cx.fillStyle = 'rgba(7,21,34,0.88)';
      cx.fillRect(0, 0, 360, 110);
      cx.fillStyle = isSel ? '#ffd23f' : '#fff';
      cx.font = 'bold 34px sans-serif';
      cx.textAlign = 'center';
      cx.fillText(item.skin.name, 180, 52);
      cx.fillStyle = isSel ? '#00f5d4' : (isUnl ? '#8beeff' : '#8fb4cc');
      cx.font = '24px sans-serif';
      cx.fillText(isSel ? '【装備中】' : (isUnl ? '解放済み' : `${item.skin.price} G`), 180, 90);
      item.labelTex.needsUpdate = true;
    });
  }

  refreshPedestals(unlockedSkins, selectedSkinId);

  return {
    refreshPedestals,
    update(tick){
      selectConsole.holo.rotation.y += 0.03;
      pedestals.forEach((p, idx) => {
        p.coreModel.rotation.y += 0.025;
        p.coreModel.position.y = 1.65 + Math.sin(tick * 0.05 + idx) * 0.12;
      });
    },
    checkZone(px, pz){
      if(Math.hypot(px - 0, pz - 12) < 2.2) return 'backHome';
      if(Math.hypot(px - selectConsole.x, pz - selectConsole.z) < selectConsole.radius) return 'selectPanel';
      return null;
    }
  };
}
