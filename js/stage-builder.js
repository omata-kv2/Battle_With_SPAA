// v4.3: FALL MISSILE & AIR STRIKE ステージ構築・スポーン・障害物生成
export function buildStage(T, scene, diffCfg){
  const skyHex = diffCfg ? diffCfg.skyColor : 0x80c5e1;
  const groundHex = diffCfg ? diffCfg.groundColor : 0x536d60;

  scene.background = new T.Color(skyHex);
  scene.fog = new T.Fog(skyHex, 55, 145);
  scene.add(new T.HemisphereLight(0xdaf5ff, 0x33495b, 1.7));
  const sun = new T.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-4, 25, 7);
  scene.add(sun);

  const ground = new T.Mesh(
    new T.PlaneGeometry(140, 140),
    new T.MeshStandardMaterial({color: groundHex, roughness: 0.92})
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  scene.add(ground);

  const grid = new T.GridHelper(140, 70, 0xffffff, 0x445566);
  grid.position.y = -1.98;
  grid.material.opacity = 0.25;
  grid.material.transparent = true;
  scene.add(grid);

  const platform = new T.Mesh(
    new T.CylinderGeometry(1.5, 1.8, .35, 12),
    new T.MeshStandardMaterial({color: 0x253d4a, metalness: .45, roughness: .55})
  );
  platform.position.set(0, -1.72, 5);
  scene.add(platform);

  for(let i = 0; i < 8; i++){
    const h = 2 + Math.random() * 4;
    const b = new T.Mesh(
      new T.BoxGeometry(1.5, h, 1.5),
      new T.MeshStandardMaterial({color: 0x526d78, roughness: .9})
    );
    b.position.set((Math.random() - .5) * 65, -2 + h / 2, (Math.random() - .5) * 65);
    if(Math.hypot(b.position.x, b.position.z) > 14) scene.add(b);
  }
}

export function makeTarget(T){
  const g = new T.Group();
  const body = new T.Mesh(
    new T.CapsuleGeometry(.24, .95, 3, 8),
    new T.MeshStandardMaterial({color: 0xaebdc7, metalness: .35, roughness: .5})
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const ring = new T.Mesh(
    new T.TorusGeometry(.34, .055, 6, 12),
    new T.MeshBasicMaterial({color: 0x73e8ff})
  );
  ring.position.z = .15;
  g.add(ring);
  return g;
}

export function makeFighter(T){
  const g = new T.Group();
  const mat = new T.MeshStandardMaterial({color: 0x879eae, metalness: .5, roughness: .4});
  const body = new T.Mesh(new T.ConeGeometry(.28, 1.7, 8), mat);
  body.rotation.x = -Math.PI / 2;
  g.add(body);
  const wings = new T.Mesh(new T.BoxGeometry(2.0, .07, .55), mat);
  wings.position.z = .1;
  g.add(wings);
  const tail = new T.Mesh(new T.BoxGeometry(.75, .06, .28), mat);
  tail.position.set(0, .32, .62);
  g.add(tail);
  return g;
}

export function prepareModel(T, source, targetLength){
  const model = source.clone(true);
  model.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(model);
  const size = box.getSize(new T.Vector3());
  const center = box.getCenter(new T.Vector3());
  const longest = Math.max(size.x, size.y, size.z) || 1;
  const wrapper = new T.Group();
  model.position.sub(center);
  model.scale.multiplyScalar(targetLength / longest);
  wrapper.add(model);
  wrapper.userData.modelReady = true;
  return wrapper;
}

// FALL MISSILE 用の敵スポーン（1マス=2.0単位）
export function spawn(T, scene, target, wave, config, type='missile', models={}, isCoop=false, syncData=null, diffSpeedMult=1.0){
  const source = type === 'fighter' ? (models.fighter || makeFighter(T)) : (models.missile || target);
  const e = source.clone(true);

  if(syncData){
    e.userData.id = syncData.id;
    e.position.set(syncData.px, syncData.py, syncData.pz);
    e.lookAt(syncData.lx, syncData.ly, syncData.lz);
    e.userData.velocity = new T.Vector3(syncData.vx, syncData.vy, syncData.vz);
    e.userData.hp = syncData.hp;
    e.userData.maxHp = syncData.maxHp;
    e.userData.kind = syncData.kind;
    e.userData.phase = syncData.phase || 0;
    scene.add(e);
    return e;
  }

  const waveIdx = Math.min(wave - 1, config.SPEEDS.length - 1);
  const speedMult = (isCoop ? 1.2 : 1.0) * diffSpeedMult;
  const baseSpeed = config.SPEEDS[waveIdx] * (type === 'fighter' ? config.FIGHTER_SPEED_MULTIPLIER : 1) * (.9 + Math.random() * .2) * speedMult;
  const id = 'en_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  e.userData.id = id;

  if(type === 'missile'){
    const offsetX = (Math.random() - 0.5) * 10;
    const offsetZ = (Math.random() - 0.5) * 10;
    e.position.set(offsetX, 50, offsetZ);
    e.lookAt(offsetX, -10, offsetZ);
    e.userData.velocity = new T.Vector3(0, -baseSpeed, 0);
    e.userData.hp = 1;
    e.userData.maxHp = 1;
    e.userData.syncPayload = {
      id, kind: 'missile',
      px: offsetX, py: 50, pz: offsetZ,
      lx: offsetX, ly: -10, lz: offsetZ,
      vx: 0, vy: -baseSpeed, vz: 0,
      hp: 1, maxHp: 1, phase: 0
    };
  } else {
    const dirIdx = Math.floor(Math.random() * 8);
    const angle = (dirIdx * Math.PI) / 4;
    const dist = 40;
    const sx = Math.cos(angle) * dist;
    const sz = Math.sin(angle) * dist;
    const sy = 14 + Math.random() * 8;
    e.position.set(sx, sy, sz);

    const targetPt = new T.Vector3(0, 10, 0);
    e.lookAt(targetPt);
    const dirVec = targetPt.clone().sub(e.position).normalize().multiplyScalar(baseSpeed);
    e.userData.velocity = dirVec;
    e.userData.hp = 2;
    e.userData.maxHp = 2;
    e.userData.syncPayload = {
      id, kind: 'fighter',
      px: sx, py: sy, pz: sz,
      lx: 0, ly: 10, lz: 0,
      vx: dirVec.x, vy: dirVec.y, vz: dirVec.z,
      hp: 2, maxHp: 2, phase: 0
    };
  }

  e.userData.phase = Math.random() * 6;
  e.userData.kind = type;
  e.userData.syncPayload.phase = e.userData.phase;
  scene.add(e);
  return e;
}

// ==========================================
// AIR STRIKE ステージ・地上目標・障害物データ生成
// ==========================================
export function generateAirStrikeObstacles(config, diffCfg){
  const count = diffCfg ? diffCfg.obstacleCount : 42;
  const minY = config.AIR_STRIKE.OBSTACLE_MIN_Y; // 10 (20m)
  const maxY = config.AIR_STRIKE.OBSTACLE_MAX_Y; // 40 (80m)
  const list = [];

  const kinds = ['box', 'sphere', 'rod'];
  const colors = [0xff4d6d, 0xff9233, 0xffd23f, 0x38c8f0, 0xc77dff, 0xe0fbfc];

  for(let i = 0; i < count; i++){
    const kind = kinds[i % kinds.length];
    // 高度80m(y=40)から20m(y=10)の間に均等＋ランダム分布
    const t = (i + Math.random()) / count;
    const py = maxY - t * (maxY - minY);
    const px = (Math.random() - 0.5) * 34;
    const pz = (Math.random() - 0.5) * 34;

    // 発射直後のスポーン地点(x=0, ±4, z=0, y>37.5)に即死配置しないよう回避
    if(py > 37.5 && Math.hypot(px, pz) < 6.5){
      continue;
    }

    const color = colors[Math.floor(Math.random() * colors.length)];

    if(kind === 'box'){
      const sx = 1.6 + Math.random() * 2.8;
      const sy = 1.2 + Math.random() * 2.2;
      const sz = 1.6 + Math.random() * 2.8;
      const ry = Math.random() * Math.PI;
      list.push({
        id: 'obs_' + i,
        kind: 'box',
        px, py, pz,
        sx, sy, sz,
        rx: 0, ry, rz: 0,
        color
      });
    } else if(kind === 'sphere'){
      const r = 1.05 + Math.random() * 1.15;
      list.push({
        id: 'obs_' + i,
        kind: 'sphere',
        px, py, pz,
        r,
        color
      });
    } else {
      // 棒状障害物（横・斜めに伸びるバー）
      const length = 5.5 + Math.random() * 6.0;
      const radius = 0.42 + Math.random() * 0.22;
      const rx = (Math.random() - 0.5) * 0.6;
      const ry = Math.random() * Math.PI;
      const rz = Math.PI / 2 + (Math.random() - 0.5) * 0.7;
      list.push({
        id: 'obs_' + i,
        kind: 'rod',
        px, py, pz,
        length, radius,
        rx, ry, rz,
        color
      });
    }
  }
  return list;
}

export function buildAirStrikeStage(T, scene, diffCfg, obstacleList){
  const skyHex = diffCfg ? diffCfg.skyColor : 0x80c5e1;
  const groundHex = diffCfg ? diffCfg.groundColor : 0x8fd694;

  scene.background = new T.Color(skyHex);
  scene.fog = new T.Fog(skyHex, 65, 175);

  scene.add(new T.HemisphereLight(0xffffff, 0x33495b, 1.8));
  const sun = new T.DirectionalLight(0xffffff, 1.5);
  sun.position.set(12, 65, 18);
  scene.add(sun);

  // 地上 (y = 0 = 0m)
  const ground = new T.Mesh(
    new T.PlaneGeometry(180, 180),
    new T.MeshStandardMaterial({color: groundHex, roughness: 0.9})
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  const grid = new T.GridHelper(180, 90, 0xffffff, 0x334455);
  grid.position.y = 0.02;
  grid.material.opacity = 0.25;
  grid.material.transparent = true;
  scene.add(grid);

  // 地上の目標物 (0, 0, 0)
  const targetGroup = new T.Group();
  targetGroup.position.set(0, 0.05, 0);

  const outerRing = new T.Mesh(
    new T.RingGeometry(3.6, 4.8, 32),
    new T.MeshBasicMaterial({color: 0xff2a55, side: T.DoubleSide})
  );
  outerRing.rotation.x = -Math.PI / 2;
  targetGroup.add(outerRing);

  const innerRing = new T.Mesh(
    new T.RingGeometry(1.5, 2.5, 32),
    new T.MeshBasicMaterial({color: 0xffd700, side: T.DoubleSide})
  );
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.02;
  targetGroup.add(innerRing);

  const coreBase = new T.Mesh(
    new T.CylinderGeometry(1.3, 1.6, 1.1, 16),
    new T.MeshStandardMaterial({color: 0x222b38, metalness: 0.6, roughness: 0.3})
  );
  coreBase.position.y = 0.55;
  targetGroup.add(coreBase);

  const coreDome = new T.Mesh(
    new T.SphereGeometry(0.95, 16, 12),
    new T.MeshStandardMaterial({color: 0xff2a55, emissive: 0xaa0022, emissiveIntensity: 0.6})
  );
  coreDome.position.y = 1.25;
  targetGroup.add(coreDome);

  // 上空から視認しやすいターゲットビーコン光柱
  const beacon = new T.Mesh(
    new T.CylinderGeometry(0.35, 0.35, 38, 12, 1, true),
    new T.MeshBasicMaterial({color: 0xff4d6d, transparent: true, opacity: 0.24, side: T.DoubleSide})
  );
  beacon.position.y = 19;
  targetGroup.add(beacon);

  scene.add(targetGroup);

  // 障害物メッシュ生成（高度80m〜20m）
  const obstacleMeshes = [];
  for(const obs of obstacleList){
    let mesh = null;
    const mat = new T.MeshStandardMaterial({
      color: obs.color,
      roughness: 0.45,
      metalness: 0.35
    });

    if(obs.kind === 'box'){
      mesh = new T.Mesh(new T.BoxGeometry(obs.sx, obs.sy, obs.sz), mat);
      mesh.position.set(obs.px, obs.py, obs.pz);
      mesh.rotation.set(obs.rx || 0, obs.ry || 0, obs.rz || 0);
    } else if(obs.kind === 'sphere'){
      mesh = new T.Mesh(new T.SphereGeometry(obs.r, 14, 12), mat);
      mesh.position.set(obs.px, obs.py, obs.pz);
    } else if(obs.kind === 'rod'){
      mesh = new T.Mesh(new T.CylinderGeometry(obs.radius, obs.radius, obs.length, 10), mat);
      mesh.position.set(obs.px, obs.py, obs.pz);
      mesh.rotation.set(obs.rx || 0, obs.ry || 0, obs.rz || 0);
    }

    if(mesh){
      mesh.userData.obs = obs;
      scene.add(mesh);
      obstacleMeshes.push(mesh);
    }
  }

  return { targetGroup, obstacleMeshes };
}
