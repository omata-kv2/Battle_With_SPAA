export function normalizeModel(T, model, targetLength, desiredForward, desiredUp){
  const root = new T.Group();
  const wrapper = new T.Group();
  wrapper.add(model);

  const forward = desiredForward.clone().normalize();
  const up = desiredUp.clone().normalize();
  const right = new T.Vector3().crossVectors(up, forward).normalize();
  const orthoUp = new T.Vector3().crossVectors(forward, right).normalize();

  const basis = new T.Matrix4().makeBasis(right, orthoUp, forward);
  wrapper.quaternion.setFromRotationMatrix(basis).invert();
  root.add(wrapper);

  root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(wrapper);
  const size = new T.Vector3();
  const center = new T.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetLength / maxDim;
  wrapper.scale.setScalar(scale);

  root.updateMatrixWorld(true);
  const scaledBox = new T.Box3().setFromObject(wrapper);
  scaledBox.getCenter(center);
  wrapper.position.sub(center);

  return root;
}

export function buildWorld(T, scene, diffObj = null){
  const skyHex = diffObj ? diffObj.skyHex : '#0a1e30';
  const groundHex = diffObj ? diffObj.groundHex : '#1b3a4b';

  scene.background = new T.Color(skyHex);
  scene.fog = new T.FogExp2(skyHex, 0.0042);

  scene.add(new T.HemisphereLight(0xd9f7ff, 0x162635, 1.35));
  const dir = new T.DirectionalLight(0xfff1d6, 1.85);
  dir.position.set(18, 35, 16);
  scene.add(dir);

  const ground = new T.Mesh(
    new T.CircleGeometry(72, 48),
    new T.MeshStandardMaterial({ color: groundHex, roughness: 0.85, metalness: 0.1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  scene.add(ground);

  const grid = new T.GridHelper(64, 32, 0x00f5d4, 0x1c3d52);
  grid.position.y = -1.98;
  scene.add(grid);

  const coreGroup = new T.Group();
  coreGroup.position.set(0, -2, 0);

  const ringOuter = new T.Mesh(
    new T.RingGeometry(2.5, 3.1, 32),
    new T.MeshBasicMaterial({ color: 0x00f5d4, side: T.DoubleSide })
  );
  ringOuter.rotation.x = -Math.PI / 2;
  ringOuter.position.y = 0.04;
  coreGroup.add(ringOuter);

  const dome = new T.Mesh(
    new T.SphereGeometry(2.1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new T.MeshStandardMaterial({ color: 0x38c8f0, emissive: 0x0c4a6e, emissiveIntensity: 0.5, transparent: true, opacity: 0.72 })
  );
  coreGroup.add(dome);

  scene.add(coreGroup);
  return coreGroup;
}

let nextEnemySeq = 1;

export function spawn(T, scene, target, wave, _unused, kind, templates, fromSync = false, syncData = null, speedMult = 1.0){
  const g = new T.Group();

  if(kind === 'fighter'){
    if(templates && templates.fighter){
      g.add(templates.fighter.clone(true));
    } else {
      const body = new T.Mesh(new T.ConeGeometry(0.6, 2.8, 6), new T.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 }));
      body.rotation.x = Math.PI / 2;
      g.add(body);
    }
  } else {
    if(templates && templates.missile){
      g.add(templates.missile.clone(true));
    } else {
      const mBody = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, 2.2, 10), new T.MeshStandardMaterial({ color: 0xe2e8f0 }));
      g.add(mBody);
    }
  }

  let sx, sy, sz, tx, ty, tz, hp, spd, eid, phaseA;

  if(fromSync && syncData){
    sx = syncData.sx;
    sy = syncData.sy;
    sz = syncData.sz;
    tx = syncData.tx;
    ty = syncData.ty;
    tz = syncData.tz;
    hp = syncData.hp;
    spd = syncData.spd;
    eid = syncData.id;
    phaseA = syncData.a || 0;
  } else {
    const ang = Math.random() * Math.PI * 2;
    const rad = 18 + Math.random() * 26;
    sx = Math.cos(ang) * rad;
    sy = 36 + Math.random() * 14;
    sz = Math.sin(ang) * rad;

    tx = (Math.random() - 0.5) * 6;
    ty = 0;
    tz = (Math.random() - 0.5) * 6;

    const baseHp = kind === 'fighter' ? (3 + Math.floor(wave * 0.8)) : (1 + Math.floor(wave * 0.45));
    hp = Math.max(1, baseHp);
    const baseSpd = (kind === 'fighter' ? 0.13 : 0.105) + wave * 0.011;
    spd = baseSpd * speedMult;
    eid = `en_${Date.now()}_${nextEnemySeq++}`;
    phaseA = Math.random() * Math.PI * 2;
  }

  g.position.set(sx, sy, sz);
  const dest = new T.Vector3(tx, ty, tz);
  const v = dest.clone().sub(g.position).normalize().multiplyScalar(spd);
  g.lookAt(dest);

  g.userData = {
    id: eid,
    kind,
    hp,
    spd,
    sx, sy, sz,
    tx, ty, tz,
    v,
    a: phaseA
  };

  scene.add(g);
  return g;
}
