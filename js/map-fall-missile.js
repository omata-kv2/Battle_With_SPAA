let enemyUidCounter = 1;

export function makeTarget(T){
  const g = new T.Group();
  const body = new T.Mesh(
    new T.CylinderGeometry(0.18, 0.24, 1.5, 8),
    new T.MeshStandardMaterial({ color: 0xd94e4e, metalness: 0.4, roughness: 0.35 })
  );
  const nose = new T.Mesh(
    new T.ConeGeometry(0.24, 0.55, 8),
    new T.MeshStandardMaterial({ color: 0xffd166 })
  );
  nose.position.y = -1.0;
  nose.rotation.x = Math.PI;
  g.add(body, nose);
  return g;
}

export function prepareModel(T, rawScene, targetLength, isMissile = true){
  const box = new T.Box3().setFromObject(rawScene);
  const size = new T.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetLength / maxDim;
  rawScene.scale.setScalar(scale);

  const center = new T.Vector3();
  new T.Box3().setFromObject(rawScene).getCenter(center);
  rawScene.position.sub(center);

  const holder = new T.Group();
  holder.add(rawScene);
  if(isMissile){
    holder.rotation.x = Math.PI / 2;
  }
  return holder;
}

export function buildStage(T, scene, diff){
  const groundHex = diff ? diff.groundHex : '#1b3a4b';
  const skyHex = diff ? diff.skyHex : '#0a1e30';
  scene.background = new T.Color(skyHex);
  scene.fog = new T.FogExp2(skyHex, 0.008);

  const hemi = new T.HemisphereLight(0xbde0fe, 0x1d3557, 1.15);
  scene.add(hemi);
  const dir = new T.DirectionalLight(0xffffff, 1.2);
  dir.position.set(25, 50, 20);
  scene.add(dir);

  const ground = new T.Mesh(
    new T.CircleGeometry(46, 48),
    new T.MeshStandardMaterial({ color: groundHex, roughness: 0.85 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.0;
  scene.add(ground);

  const grid = new T.GridHelper(44, 22, 0x00f5d4, 0x244c66);
  grid.position.y = -1.98;
  scene.add(grid);

  const corePad = new T.Mesh(
    new T.RingGeometry(2.0, 2.5, 32),
    new T.MeshBasicMaterial({ color: 0x00f5d4, side: T.DoubleSide })
  );
  corePad.rotation.x = -Math.PI / 2;
  corePad.position.y = -1.96;
  scene.add(corePad);
}

export function spawn(T, scene, fallbackTarget, wave, CONFIG, kind, templates, isCoop = false, syncPayload = null, diffSpeedMult = 1.0){
  let id, px, py, pz, vx, vy, vz, hp;

  if(syncPayload){
    ({ id, kind, px, py, pz, vx, vy, vz, hp } = syncPayload);
  } else {
    id = 'en_' + (enemyUidCounter++) + '_' + Math.floor(Math.random() * 10000);
    const angle = Math.random() * Math.PI * 2;
    if(kind === 'fighter'){
      const dist = 42 + Math.random() * 14;
      px = Math.cos(angle) * dist;
      pz = Math.sin(angle) * dist;
      py = 10 + Math.random() * 12;
      const spd = (0.11 + wave * 0.012) * diffSpeedMult;
      const dir = new T.Vector3(-px, -py * 0.75, -pz).normalize();
      vx = dir.x * spd;
      vy = dir.y * spd;
      vz = dir.z * spd;
      hp = 6 + Math.floor(wave * 1.5);
    } else {
      const dist = 4 + Math.random() * 16;
      px = Math.cos(angle) * dist;
      pz = Math.sin(angle) * dist;
      py = 36 + Math.random() * 16;
      const spd = (0.09 + wave * 0.014) * diffSpeedMult;
      vx = (Math.random() - 0.5) * 0.02;
      vy = -spd;
      vz = (Math.random() - 0.5) * 0.02;
      hp = 2 + Math.floor(wave * 0.8);
    }
  }

  const tpl = kind === 'fighter' ? templates.fighter : templates.missile;
  const mesh = tpl ? tpl.clone(true) : fallbackTarget.clone(true);
  mesh.position.set(px, py, pz);

  if(kind === 'fighter'){
    mesh.lookAt(px + vx * 10, py + vy * 10, pz + vz * 10);
  }

  const payload = { id, kind, px, py, pz, vx, vy, vz, hp };
  mesh.userData = {
    id,
    kind,
    hp,
    velocity: new T.Vector3(vx, vy, vz),
    phase: Math.random() * Math.PI * 2,
    syncPayload: payload
  };

  scene.add(mesh);
  return mesh;
}
