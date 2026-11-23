export function buildHomeWorld(T, scene){
  scene.background = new T.Color(0x0b1f33);
  scene.fog = new T.FogExp2(0x0b1f33, 0.008);

  scene.add(new T.HemisphereLight(0xaadfff, 0x1b2d3e, 1.35));
  const sun = new T.DirectionalLight(0xfff4d8, 1.6);
  sun.position.set(14, 24, 12);
  scene.add(sun);

  const floor = new T.Mesh(
    new T.PlaneGeometry(42, 42),
    new T.MeshStandardMaterial({ color: 0x16324a, roughness: 0.72, metalness: 0.15 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  scene.add(floor);

  const grid = new T.GridHelper(42, 21, 0x38c8f0, 0x1f496b);
  grid.position.y = -1.98;
  scene.add(grid);

  const wallMat = new T.MeshStandardMaterial({ color: 0x10273b, roughness: 0.65, metalness: 0.25 });
  const wallConfigs = [
    { w: 42, h: 4, d: 1, x: 0, y: 0, z: -21 },
    { w: 42, h: 4, d: 1, x: 0, y: 0, z: 21 },
    { w: 1, h: 4, d: 42, x: -21, y: 0, z: 0 },
    { w: 1, h: 4, d: 42, x: 21, y: 0, z: 0 }
  ];
  for(const wc of wallConfigs){
    const w = new T.Mesh(new T.BoxGeometry(wc.w, wc.h, wc.d), wallMat);
    w.position.set(wc.x, wc.y, wc.z);
    scene.add(w);
  }

  function createPortal(title, subtitle, colorHex, x, z, isCoopGate = false){
    const group = new T.Group();
    group.position.set(x, -2, z);

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
    return { group, baseRing, curtain, x, z, radius: 2.35 };
  }

  const battlePortal = createPortal('出撃ゲート', 'モード・難易度を選択して出撃', 0x00f5d4, 0, -11);
  const skinPortal = createPortal('機体格納庫', '機体選択・強化・ショップへ', 0xff9233, 11, 0);
  const coopPortal = createPortal('フレンド共闘', 'ルーム作成・参加で2人共闘', 0x38c8f0, -11, 0, true);

  return {
    update(tick){
      battlePortal.curtain.material.opacity = 0.2 + Math.sin(tick * 0.06) * 0.08;
      skinPortal.curtain.material.opacity = 0.2 + Math.cos(tick * 0.06) * 0.08;
      coopPortal.curtain.material.opacity = 0.2 + Math.sin(tick * 0.06 + 1.2) * 0.08;
    },
    checkPortal(px, pz){
      if(Math.hypot(px - battlePortal.x, pz - battlePortal.z) < battlePortal.radius) return 'battle';
      if(Math.hypot(px - skinPortal.x, pz - skinPortal.z) < skinPortal.radius) return 'skin';
      if(Math.hypot(px - coopPortal.x, pz - coopPortal.z) < coopPortal.radius) return 'coop';
      return null;
    }
  };
}
