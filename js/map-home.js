export function buildHomeWorld(T, scene, gold = 0, yajuCoins = 0){
  scene.background = new T.Color(0x4c96e0);
  scene.fog = new T.FogExp2(0x4c96e0, 0.008);

  scene.add(new T.HemisphereLight(0xaadfff, 0x1b2d3e, 1.35));
  const sun = new T.DirectionalLight(0xfff4d8, 1.6);
  sun.position.set(14, 24, 12);
  scene.add(sun);

  const floor = new T.Mesh(
    new T.PlaneGeometry(42, 42),
    new T.MeshStandardMaterial({ color: 0x090c2e, roughness: 0.72, metalness: 0.15 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  scene.add(floor);

  const grid = new T.GridHelper(42, 21, 0x38c8f0, 0x1f496b);
  grid.position.y = -1.98;
  scene.add(grid);

  const wallMat = new T.MeshStandardMaterial({ color: 0x050621, roughness: 0.65, metalness: 0.25 });
  // js/map-home.js 23〜28行目
  const wallConfigs = [
  { w: 42, h: 8, d: 1, x: 0, y: 2, z: -21 },
  { w: 42, h: 8, d: 1, x: 0, y: 2, z: 21 },
  { w: 1, h: 8, d: 42, x: -21, y: 2, z: 0 },
  { w: 1, h: 8, d: 42, x: 21, y: 2, z: 0 }
  ];
  for(const wc of wallConfigs){
    const w = new T.Mesh(new T.BoxGeometry(wc.w, wc.h, wc.d), wallMat);
    w.position.set(wc.x, wc.y, wc.z);
    scene.add(w);
  }

  let goldSprite = null;
  let yajuSprite = null;

  function makeCurrencySprite(text, borderHex, textColor, yPos){
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const font = 'bold 40px sans-serif';
    ctx.font = font;
    const measured = ctx.measureText(text).width;
    const w = Math.max(380, Math.ceil(measured + 88));
    const h = 96;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = 'rgba(7, 21, 34, 0.90)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    ctx.font = font;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);

    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true }));
    const worldH = 1.05;
    const worldW = (w / h) * worldH;
    sprite.scale.set(worldW, worldH, 1);
    sprite.position.set(0, yPos, -6.5);
    scene.add(sprite);
    return sprite;
  }

  function refreshCurrencyPanels(curGold = 0, curYaju = 0){
    if(goldSprite) scene.remove(goldSprite);
    if(yajuSprite) scene.remove(yajuSprite);
    goldSprite = makeCurrencySprite(`Gold: ${Number(curGold || 0).toLocaleString()} G`, '#ffd23f', '#ffd23f', 5.05);
    yajuSprite = makeCurrencySprite(`YAJUコイン: ${Number(curYaju || 0).toLocaleString()}枚`, '#ff4d6d', '#ff9ebb', 6.30);
  }

  refreshCurrencyPanels(gold, yajuCoins);

  function createPortal(title, subtitle, colorHex, x, z, rotY = 0, isCoopGate = false){
    const group = new T.Group();
    group.position.set(x, -2, z);
    group.rotation.y = rotY;

    const baseRing = new T.Mesh(
      new T.RingGeometry(1.7, 2.35, 32),
      new T.MeshBasicMaterial({ color: colorHex, side: T.DoubleSide })
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.04;
    group.add(baseRing);

    const pillarGeo = new T.BoxGeometry(0.32, 3.6, 0.32);
    const pillarMat = new T.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.45 });
    const leftP = new T.Mesh(pillarGeo, pillarMat);
    leftP.position.set(-1.7, 1.8, 0);
    const rightP = new T.Mesh(pillarGeo, pillarMat);
    rightP.position.set(1.7, 1.8, 0);
    const topBar = new T.Mesh(new T.BoxGeometry(3.8, 0.35, 0.35), pillarMat);
    topBar.position.set(0, 3.65, 0);
    group.add(leftP, rightP, topBar);

    const curtain = new T.Mesh(
      new T.PlaneGeometry(3.1, 3.4),
      new T.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.24, side: T.DoubleSide })
    );
    curtain.position.set(0, 1.75, 0);
    group.add(curtain);

    if(isCoopGate){
      const emblem = new T.Mesh(
        new T.OctahedronGeometry(0.42, 0),
        new T.MeshBasicMaterial({ color: 0xffd23f, wireframe: true })
      );
      emblem.position.set(0, 4.35, 0);
      group.add(emblem);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(7, 21, 34, 0.88)';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#' + colorHex.toString(16).padStart(6, '0');
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 504, 152);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 68);
    ctx.fillStyle = '#9be8ff';
    ctx.font = '26px sans-serif';
    ctx.fillText(subtitle, 256, 122);

    const tex = new T.CanvasTexture(canvas);
    const sign = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true }));
    sign.scale.set(4.6, 1.45, 1);
    sign.position.set(0, 4.75, 0);
    group.add(sign);

    scene.add(group);
    return { group, baseRing, curtain, x, z, radius: 2.65 };
  }

  // 全ポータルを壁際（壁内面±20.5にゲートがギリギリ接する位置・正面は壁と平行）に配置
  const playWarsPortal = createPortal('PlayWars', '機体対決・AI/PvP戦', 0xc77dff, -12.8, -20.3, 0);
  const battlePortal = createPortal('出撃ゲート', 'モード・難易度を選択して出撃', 0x00f5d4, -4.6, -20.3, 0);
  const yajuPortal = createPortal('YAJUMAZE', '迷路脱出＆ボス挑戦', 0xff4d6d, 4.6, -20.3, 0);
  const skinPortal = createPortal('機体格納庫', '機体選択・強化へ', 0xff9233, 20.3, -4.2, -Math.PI / 2);
  const testPortal = createPortal('テストルーム', '試し撃ち・スキル練習', 0xa8ff60, 20.3, 4.2, -Math.PI / 2);
  const coopPortal = createPortal('フレンド共闘', 'ルーム作成・参加で2人共闘', 0x38c8f0, -20.3, 0, Math.PI / 2, true);
  const storePortal = createPortal('ストア', 'アイテム・機体購入ショップ', 0xffd23f, 0, 20.3, Math.PI);

  return {
    refreshCurrencyPanels,
    update(tick){
      playWarsPortal.curtain.material.opacity = 0.2 + Math.sin(tick * 0.06 + 0.3) * 0.08;
      battlePortal.curtain.material.opacity = 0.2 + Math.sin(tick * 0.06) * 0.08;
      yajuPortal.curtain.material.opacity = 0.2 + Math.sin(tick * 0.06 + 0.6) * 0.08;
      skinPortal.curtain.material.opacity = 0.2 + Math.cos(tick * 0.06) * 0.08;
      coopPortal.curtain.material.opacity = 0.2 + Math.sin(tick * 0.06 + 1.2) * 0.08;
      storePortal.curtain.material.opacity = 0.2 + Math.cos(tick * 0.06 + 0.8) * 0.08;
      testPortal.curtain.material.opacity = 0.2 + Math.sin(tick * 0.06 + 1.8) * 0.08;
    },
    checkPortal(px, pz){
      if(Math.hypot(px - playWarsPortal.x, pz - playWarsPortal.z) < playWarsPortal.radius) return 'playwars';
      if(Math.hypot(px - battlePortal.x, pz - battlePortal.z) < battlePortal.radius) return 'battle';
      if(Math.hypot(px - yajuPortal.x, pz - yajuPortal.z) < yajuPortal.radius) return 'yaju';
      if(Math.hypot(px - skinPortal.x, pz - skinPortal.z) < skinPortal.radius) return 'skin';
      if(Math.hypot(px - coopPortal.x, pz - coopPortal.z) < coopPortal.radius) return 'coop';
      if(Math.hypot(px - storePortal.x, pz - storePortal.z) < storePortal.radius) return 'store';
      if(Math.hypot(px - testPortal.x, pz - testPortal.z) < testPortal.radius) return 'test';
      return null;
    }
  };
}
