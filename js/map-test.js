export function buildTestRoomWorld(T, scene){
  scene.background = new T.Color(0x4c96e0);
  scene.fog = new T.FogExp2(0x4c96e0, 0.01);

  scene.add(new T.HemisphereLight(0xc8f7ff, 0x162630, 1.45));
  const dir = new T.DirectionalLight(0xffffff, 1.5);
  dir.position.set(10, 22, 10);
  scene.add(dir);

  const floor = new T.Mesh(
    new T.PlaneGeometry(38, 38),
    new T.MeshStandardMaterial({ color: 0xbbbcbd, roughness: 0.68, metalness: 0.18 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  scene.add(floor);

  const grid = new T.GridHelper(38, 19, 0xa8ff60, 0x1f4956);
  grid.position.y = -1.98;
  scene.add(grid);

  const wallMat = new T.MeshStandardMaterial({ color: 0x0f232e, roughness: 0.65, metalness: 0.25 });
  const wallConfigs = [
    { w: 38, h: 4, d: 1, x: 0, y: 0, z: -19 },
    { w: 38, h: 4, d: 1, x: 0, y: 0, z: 19 },
    { w: 1, h: 4, d: 38, x: -19, y: 0, z: 0 },
    { w: 1, h: 4, d: 38, x: 19, y: 0, z: 0 }
  ];
  for(const wc of wallConfigs){
    const w = new T.Mesh(new T.BoxGeometry(wc.w, wc.h, wc.d), wallMat);
    w.position.set(wc.x, wc.y, wc.z);
    scene.add(w);
  }

  // ホームへ戻るゲート
  const backHomeGroup = new T.Group();
  backHomeGroup.position.set(0, -2, -16.5);
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

  // 部屋中央の敵ダミー
  const dummyGroup = new T.Group();
  dummyGroup.position.set(0, -2, 0);

  const baseRing = new T.Mesh(
    new T.RingGeometry(1.1, 1.45, 24),
    new T.MeshBasicMaterial({ color: 0xa8ff60, side: T.DoubleSide })
  );
  baseRing.rotation.x = -Math.PI / 2;
  baseRing.position.y = 0.04;
  dummyGroup.add(baseRing);

  const stand = new T.Mesh(
    new T.CylinderGeometry(0.35, 0.55, 1.1, 12),
    new T.MeshStandardMaterial({ color: 0x2b4352, roughness: 0.5, metalness: 0.4 })
  );
  stand.position.y = 0.55;
  dummyGroup.add(stand);

  const bodyMat = new T.MeshStandardMaterial({
    color: 0xff4d6d,
    emissive: 0x551020,
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.25
  });
  const dummyBody = new T.Mesh(new T.BoxGeometry(1.4, 2.0, 1.4), bodyMat);
  dummyBody.position.y = 2.1;
  dummyBody.userData = { id: 'test_dummy', isTestDummy: true, kind: 'dummy', hp: 999999 };
  dummyGroup.add(dummyBody);

  const head = new T.Mesh(
    new T.SphereGeometry(0.55, 12, 12),
    new T.MeshStandardMaterial({ color: 0xffd23f, emissive: 0x553d00, emissiveIntensity: 0.4 })
  );
  head.position.y = 3.55;
  dummyGroup.add(head);

  scene.add(dummyGroup);

  let dmgSprite = null;
  let dmgTimer = 0;

  function clearDamageSprite(){
    if(dmgSprite){
      scene.remove(dmgSprite);
      if(dmgSprite.material && dmgSprite.material.map) dmgSprite.material.map.dispose();
      if(dmgSprite.material) dmgSprite.material.dispose();
      dmgSprite = null;
    }
    dmgTimer = 0;
  }

  function showDummyDamage(dmgAmount){
    clearDamageSprite();
    const val = Math.round(dmgAmount);
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    ctx.font = '900 74px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#071522';
    ctx.strokeText(String(val), 128, 64);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(String(val), 128, 64);

    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    const mat = new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    dmgSprite = new T.Sprite(mat);
    dmgSprite.scale.set(2.4, 1.2, 1);
    dmgSprite.position.set(0, 2.55, 0);
    scene.add(dmgSprite);
    dmgTimer = 1.0;
  }

  return {
    dummyMesh: dummyBody,
    onDummyHit(dmg){
      showDummyDamage(dmg);
      bodyMat.emissiveIntensity = 0.95;
      setTimeout(() => { bodyMat.emissiveIntensity = 0.45; }, 110);
    },
    update(dt, tick){
      head.rotation.y += 0.03;
      dummyBody.position.y = 2.1 + Math.sin(tick * 0.05) * 0.08;
      if(dmgSprite){
        dmgTimer -= dt;
        dmgSprite.position.y += dt * 0.45;
        if(dmgTimer <= 0){
          clearDamageSprite();
        }
      }
    },
    checkZone(px, pz){
      if(Math.hypot(px - 0, pz - (-16.5)) < 2.2) return 'backHome';
      return null;
    }
  };
}
