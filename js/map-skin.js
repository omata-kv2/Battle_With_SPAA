import { CONFIG } from './config.js';
import { loadVehicleAssets } from './vehicles/VehicleLoader.js';
import { createVehicleController } from './vehicles/VehicleController.js';

function createFloorFrame(T, colorHex, width = 5.8, depth = 7.0){
  const grp = new T.Group();
  const barMat = new T.MeshBasicMaterial({ color: colorHex });
  const t = 0.18;
  const h = 0.05;

  const front = new T.Mesh(new T.BoxGeometry(width, h, t), barMat);
  front.position.set(0, 0.03, depth / 2);
  const back = new T.Mesh(new T.BoxGeometry(width, h, t), barMat);
  back.position.set(0, 0.03, -depth / 2);
  const left = new T.Mesh(new T.BoxGeometry(t, h, depth), barMat);
  left.position.set(-width / 2, 0.03, 0);
  const right = new T.Mesh(new T.BoxGeometry(t, h, depth), barMat);
  right.position.set(width / 2, 0.03, 0);

  const floorTint = new T.Mesh(
    new T.PlaneGeometry(width - 0.3, depth - 0.3),
    new T.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.12, side: T.DoubleSide })
  );
  floorTint.rotation.x = -Math.PI / 2;
  floorTint.position.y = 0.015;

  grp.add(front, back, left, right, floorTint);
  return { group: grp, barMat, floorTint };
}

function createLockChainCage(T, width = 5.8, depth = 7.0){
  const cage = new T.Group();
  const chainHeight = 4.2;
  const ironMat = new T.MeshStandardMaterial({ color: 0x3b424c, roughness: 0.45, metalness: 0.78 });
  const linkAccentMat = new T.MeshBasicMaterial({ color: 0xff4d6d });

  const hw = width / 2;
  const hd = depth / 2;

  // 垂直の鎖柱（四隅＋各辺の中間、天井なし）
  const postPositions = [
    [-hw, -hd], [0, -hd], [hw, -hd],
    [-hw, 0],             [hw, 0],
    [-hw, hd],  [0, hd],  [hw, hd]
  ];
  for(const [px, pz] of postPositions){
    const post = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, chainHeight, 8), ironMat);
    post.position.set(px, chainHeight / 2, pz);
    cage.add(post);

    // 鎖の環（不動エフェクト）
    for(let ly = 0.45; ly <= chainHeight - 0.3; ly += 0.55){
      const link = new T.Mesh(new T.TorusGeometry(0.11, 0.028, 6, 10), ironMat);
      link.position.set(px, ly, pz);
      link.rotation.y = (Math.round(ly * 10) % 2 === 0) ? 0 : Math.PI / 2;
      cage.add(link);
    }
  }

  // 外周の横鎖バー（3段、上面は開放）
  [1.2, 2.5, 3.85].forEach((hy) => {
    const fBar = new T.Mesh(new T.BoxGeometry(width, 0.07, 0.07), ironMat);
    fBar.position.set(0, hy, hd);
    const bBar = new T.Mesh(new T.BoxGeometry(width, 0.07, 0.07), ironMat);
    bBar.position.set(0, hy, -hd);
    const lBar = new T.Mesh(new T.BoxGeometry(0.07, 0.07, depth), ironMat);
    lBar.position.set(-hw, hy, 0);
    const rBar = new T.Mesh(new T.BoxGeometry(0.07, 0.07, depth), ironMat);
    rBar.position.set(hw, hy, 0);
    cage.add(fBar, bBar, lBar, rBar);
  });

  // 前面の 🔒 マークスプライト
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 160;
  const cx = cv.getContext('2d');
  cx.fillStyle = 'rgba(22, 10, 18, 0.88)';
  cx.fillRect(18, 18, 220, 124);
  cx.strokeStyle = '#ff4d6d';
  cx.lineWidth = 6;
  cx.strokeRect(21, 21, 214, 118);
  cx.fillStyle = '#ffffff';
  cx.font = 'bold 58px sans-serif';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText('🔒', 128, 82);

  const lockTex = new T.CanvasTexture(cv);
  const lockSpr = new T.Sprite(new T.SpriteMaterial({ map: lockTex, transparent: true }));
  lockSpr.scale.set(1.8, 1.12, 1);
  lockSpr.position.set(0, 2.2, hd + 0.15);
  cage.add(lockSpr);

  // 赤い封印ライン
  const sealStrip = new T.Mesh(new T.BoxGeometry(width - 0.4, 0.04, 0.04), linkAccentMat);
  sealStrip.position.set(0, 3.85, hd + 0.05);
  cage.add(sealStrip);

  return cage;
}

export function buildSkinWorld(T, scene, unlockedSkins = ['Origin'], selectedSkinId = 'Origin', vehicleLoader = null){
  scene.background = new T.Color(0x4c96e0);
  scene.fog = new T.FogExp2(0x4c96e0, 0.006);

  scene.add(new T.HemisphereLight(0xbbeeff, 0x162430, 1.45));
  const dir = new T.DirectionalLight(0xffffff, 1.55);
  dir.position.set(14, 28, 16);
  scene.add(dir);

  // 横に十分広い格納庫 (84 × 46)、床色は 0xb9b9bd
  const floor = new T.Mesh(
    new T.PlaneGeometry(84, 46),
    new T.MeshStandardMaterial({ color: 0xb9b9bd, roughness: 0.65, metalness: 0.2 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  scene.add(floor);

  const grid = new T.GridHelper(84, 42, 0xff9233, 0x707882);
  grid.position.y = -1.98;
  scene.add(grid);

  // 外壁
  const wallMat = new T.MeshStandardMaterial({ color: 0x0f232e, roughness: 0.65, metalness: 0.25 });
  const wallConfigs = [
    { w: 84, h: 8, d: 1, x: 0, y: 2, z: -23 },
    { w: 84, h: 8, d: 1, x: 0, y: 2, z: 23 },
    { w: 1, h: 8, d: 46, x: -42, y: 2, z: 0 },
    { w: 1, h: 8, d: 46, x: 42, y: 2, z: 0 }
  ];
  for(const wc of wallConfigs){
    const w = new T.Mesh(new T.BoxGeometry(wc.w, wc.h, wc.d), wallMat);
    w.position.set(wc.x, wc.y, wc.z);
    scene.add(w);
  }

  // ホームへ戻るゲート（後方）
  const backHomeGroup = new T.Group();
  backHomeGroup.position.set(0, -2, 17.5);
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

  // 機体変更パネルは入って右側 (+X) に配置（正面の視界を遮らない）
  const selectConsole = createConsole('機体選択・強化パネル', 0x00f5d4, 8.5, 6.5);

  const pedestals = [];
  const spacingX = 7.4;
  const displayZ = -10.5;
  let disposed = false;

  CONFIG.SKINS.forEach((skin, idx) => {
    // 右(+X)から左(-X)にかけて 1, 2, 3, ..., 8 を並べる
    // idx=3(4番)が+3.7、idx=4(5番)が-3.7で、正面(x=0)が4と5の間になる
    const px = (3.5 - idx) * spacingX;
    const pz = displayZ;

    const pGroup = new T.Group();
    pGroup.position.set(px, -2, pz);

    const frameObj = createFloorFrame(T, skin.color, 5.8, 7.0);
    pGroup.add(frameObj.group);

    const lockCage = createLockChainCage(T, 5.8, 7.0);
    pGroup.add(lockCage);

    const modelHolder = new T.Group();
    pGroup.add(modelHolder);

    // 実寸の3D機体を読み込み配置（正面+Z向き）
    loadVehicleAssets(vehicleLoader, skin.id, { silent: true }).then((assets) => {
      if(disposed) return;
      const vc = createVehicleController(assets);
      vc.setHullYaw(Math.PI);
      vc.update({
        dt: 0.016,
        x: 0,
        y: 0,
        z: 0,
        moveDx: 0,
        moveDz: 0,
        cameraYaw: Math.PI,
        cameraPitch: 0.08,
        visible: true
      });
      modelHolder.add(vc.root);
    }).catch(() => {});

    const cv = document.createElement('canvas');
    cv.width = 380;
    cv.height = 115;
    const labelTex = new T.CanvasTexture(cv);
    const labelSpr = new T.Sprite(new T.SpriteMaterial({ map: labelTex, transparent: true }));
    labelSpr.scale.set(3.2, 0.96, 1);
    labelSpr.position.y = 4.65;
    pGroup.add(labelSpr);

    scene.add(pGroup);
    pedestals.push({ skin, idx, pGroup, frameObj, lockCage, labelCanvas: cv, labelTex });
  });

  function refreshPedestals(curUnlocked, curSelected){
    pedestals.forEach(item => {
      const isUnl = curUnlocked.includes(item.skin.id);
      const isSel = item.skin.id === curSelected;

      item.lockCage.visible = !isUnl;
      item.frameObj.barMat.color.setHex(isSel ? 0xffd23f : item.skin.color);
      item.frameObj.floorTint.material.opacity = isSel ? 0.24 : (isUnl ? 0.12 : 0.06);

      const cx = item.labelCanvas.getContext('2d');
      cx.clearRect(0, 0, 380, 115);
      cx.fillStyle = 'rgba(7,21,34,0.88)';
      cx.fillRect(0, 0, 380, 115);
      cx.strokeStyle = isSel ? '#ffd23f' : '#' + item.skin.color.toString(16).padStart(6, '0');
      cx.lineWidth = 4;
      cx.strokeRect(2, 2, 376, 111);

      cx.fillStyle = isSel ? '#ffd23f' : '#fff';
      cx.font = 'bold 34px sans-serif';
      cx.textAlign = 'center';
      cx.fillText(`${item.idx + 1}. ${item.skin.name}`, 190, 50);
      cx.fillStyle = isSel ? '#00f5d4' : (isUnl ? '#8beeff' : '#ff8899');
      cx.font = '24px sans-serif';
      cx.fillText(isSel ? '【装備中】' : (isUnl ? '解放済み' : `🔒 ${item.skin.price.toLocaleString()} G`), 190, 90);
      item.labelTex.needsUpdate = true;
    });
  }

  refreshPedestals(unlockedSkins, selectedSkinId);

  return {
    refreshPedestals,
    dispose(){ disposed = true; },
    update(tick){
      selectConsole.holo.rotation.y += 0.03;
    },
    checkZone(px, pz){
      if(Math.hypot(px - 0, pz - 17.5) < 2.2) return 'backHome';
      if(Math.hypot(px - selectConsole.x, pz - selectConsole.z) < selectConsole.radius) return 'selectPanel';
      return null;
    }
  };
}
