// v4.6: FALL MISSILE & AIR STRIKE ステージ構築・ミサイル上下反転・ランダム目標＆複雑障害物生成
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
  const nose = new T.Mesh(
    new T.ConeGeometry(.24, .45, 8),
    new T.MeshStandardMaterial({color: 0xff4d6d, metalness: .4, roughness: .4})
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.z = .65;
  g.add(nose);
  const ring = new T.Mesh(
    new T.TorusGeometry(.34, .055, 6, 12),
    new T.MeshBasicMaterial({color: 0x73e8ff})
  );
  ring.position.z = -.25;
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

export function prepareModel(T, source, targetLength, flipVertical=false){
  const model = source.clone(true);
  model.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(model);
  const size = box.getSize(new T.Vector3());
  const center = box.getCenter(new T.Vector3());
  const longest = Math.max(size.x, size.y, size.z) || 1;
  const wrapper = new T.Group();
  model.position.sub(center);
  model.scale.multiplyScalar(targetLength / longest);
  if(flipVertical){
    model.rotation.x = Math.PI;
  }
  wrapper.add(model);
  wrapper.userData.modelReady = true;
  return wrapper;
}

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

export function generateAirStrikeMissionData(config, diffCfg){
  const minDist = config.AIR_STRIKE.TARGET_MIN_DIST;
  const maxDist = config.AIR_STRIKE.TARGET_MAX_DIST;
  const angle = Math.random() * Math.PI * 2;
  const dist = minDist + Math.random() * (maxDist - minDist);
  const targetPos = {
    x: Math.round(Math.cos(angle) * dist * 10) / 10,
    z: Math.round(Math.sin(angle) * dist * 10) / 10
  };

  const count = diffCfg ? diffCfg.obstacleCount : 48;
  const movingRatio = diffCfg ? diffCfg.movingRatio : 0.3;
  const speedFactor = diffCfg ? diffCfg.speedFactor : 1.0;
  const minY = config.AIR_STRIKE.OBSTACLE_MIN_Y;
  const maxY = config.AIR_STRIKE.OBSTACLE_MAX_Y;
  const list = [];

  const kinds = ['box', 'sphere', 'rod', 'cross', 'ring'];
  const colors = [0xff4d6d, 0xff9233, 0xffd23f, 0x38c8f0, 0xc77dff, 0x00f5d4];

  const routeLayers = [39, 32, 25, 18, 11];
  routeLayers.forEach((ly, idx) => {
    const progressRatio = (idx + 1) / (routeLayers.length + 1);
    const cx = targetPos.x * progressRatio + (Math.random() - 0.5) * 4.5;
    const cz = targetPos.z * progressRatio + (Math.random() - 0.5) * 4.5;
    const color = colors[idx % colors.length];

    if(idx % 2 === 0){
      list.push({
        id: 'route_cross_' + idx,
        kind: 'cross',
        px: cx, py: ly, pz: cz,
        baseX: cx, baseY: ly, baseZ: cz,
        length: 11.5 + (speedFactor * 1.4),
        radius: 0.58,
        rx: 0, ry: Math.random() * Math.PI, rz: 0,
        rotSpeedY: (idx % 2 === 0 ? 1 : -1) * (1.1 + Math.random() * 0.8) * speedFactor,
        moveType: 'none',
        color
      });
    } else {
      const perpAngle = angle + Math.PI / 2;
      list.push({
        id: 'route_wall_' + idx,
        kind: 'box',
        px: cx, py: ly, pz: cz,
        baseX: cx, baseY: ly, baseZ: cz,
        sx: 6.8 + speedFactor * 0.8,
        sy: 1.5,
        sz: 1.8,
        rx: 0, ry: perpAngle, rz: 0,
        rotSpeedY: 0,
        moveType: 'slide',
        moveDirX: Math.cos(perpAngle),
        moveDirZ: Math.sin(perpAngle),
        moveAmp: 6.5,
        moveSpeed: (1.5 + Math.random() * 0.8) * speedFactor,
        movePhase: Math.random() * Math.PI * 2,
        color
      });
    }
  });

  list.push({
    id: 'target_guard_ring_high',
    kind: 'ring',
    px: targetPos.x, py: 17, pz: targetPos.z,
    baseX: targetPos.x, baseY: 17, baseZ: targetPos.z,
    ringRadius: 4.4,
    tubeThickness: 0.75,
    rx: 0, ry: 0, rz: 0,
    rotSpeedY: 1.4 * speedFactor,
    moveType: 'orbit',
    orbitRadius: 2.2,
    moveSpeed: 1.3 * speedFactor,
    movePhase: 0,
    color: 0xff2a55
  });

  list.push({
    id: 'target_guard_cross_low',
    kind: 'cross',
    px: targetPos.x, py: 9.5, pz: targetPos.z,
    baseX: targetPos.x, baseY: 9.5, baseZ: targetPos.z,
    length: 10.5,
    radius: 0.55,
    rx: 0, ry: 0.4, rz: 0,
    rotSpeedY: -1.6 * speedFactor,
    moveType: 'none',
    color: 0xffd700
  });

  for(let i = 0; i < count; i++){
    const kind = kinds[i % kinds.length];
    const t = (i + Math.random()) / count;
    const py = maxY - t * (maxY - minY);

    const centerMix = Math.random();
    const anchorX = targetPos.x * centerMix;
    const anchorZ = targetPos.z * centerMix;
    const px = anchorX + (Math.random() - 0.5) * 34;
    const pz = anchorZ + (Math.random() - 0.5) * 34;

    if(py > 42.5 && Math.hypot(px, pz) < 6.0){
      continue;
    }

    const color = colors[Math.floor(Math.random() * colors.length)];
    const isMoving = Math.random() < movingRatio;
    const moveType = isMoving ? (Math.random() < 0.65 ? 'slide' : 'orbit') : 'none';
    const moveAngle = Math.random() * Math.PI * 2;
    const moveAmp = 3.0 + Math.random() * 5.0;
    const moveSpeed = (1.1 + Math.random() * 1.1) * speedFactor;
    const movePhase = Math.random() * Math.PI * 2;

    if(kind === 'box'){
      const sx = 2.0 + Math.random() * 3.8;
      const sy = 1.3 + Math.random() * 2.4;
      const sz = 2.0 + Math.random() * 3.8;
      const ry = Math.random() * Math.PI;
      list.push({
        id: 'obs_' + i,
        kind: 'box',
        px, py, pz,
        baseX: px, baseY: py, baseZ: pz,
        sx, sy, sz,
        rx: 0, ry, rz: 0,
        rotSpeedY: isMoving ? (Math.random() - 0.5) * 1.4 * speedFactor : 0,
        moveType,
        moveDirX: Math.cos(moveAngle),
        moveDirZ: Math.sin(moveAngle),
        moveAmp,
        orbitRadius: 2.5 + Math.random() * 3.0,
        moveSpeed,
        movePhase,
        color
      });
    } else if(kind === 'sphere'){
      const r = 1.2 + Math.random() * 1.45;
      list.push({
        id: 'obs_' + i,
        kind: 'sphere',
        px, py, pz,
        baseX: px, baseY: py, baseZ: pz,
        r,
        rx: 0, ry: 0, rz: 0,
        rotSpeedY: 0,
        moveType,
        moveDirX: Math.cos(moveAngle),
        moveDirZ: Math.sin(moveAngle),
        moveAmp,
        orbitRadius: 2.8 + Math.random() * 3.2,
        moveSpeed,
        movePhase,
        color
      });
    } else if(kind === 'rod'){
      const length = 6.5 + Math.random() * 7.0;
      const radius = 0.46 + Math.random() * 0.25;
      const rx = (Math.random() - 0.5) * 0.7;
      const ry = Math.random() * Math.PI;
      const rz = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
      list.push({
        id: 'obs_' + i,
        kind: 'rod',
        px, py, pz,
        baseX: px, baseY: py, baseZ: pz,
        length, radius,
        rx, ry, rz,
        rotSpeedY: (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 1.2) * speedFactor,
        moveType,
        moveDirX: Math.cos(moveAngle),
        moveDirZ: Math.sin(moveAngle),
        moveAmp,
        orbitRadius: 2.2 + Math.random() * 2.5,
        moveSpeed,
        movePhase,
        color
      });
    } else if(kind === 'cross'){
      const length = 7.5 + Math.random() * 5.5;
      const radius = 0.45 + Math.random() * 0.2;
      const ry = Math.random() * Math.PI;
      list.push({
        id: 'obs_' + i,
        kind: 'cross',
        px, py, pz,
        baseX: px, baseY: py, baseZ: pz,
        length, radius,
        rx: 0, ry, rz: 0,
        rotSpeedY: (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random() * 1.3) * speedFactor,
        moveType,
        moveDirX: Math.cos(moveAngle),
        moveDirZ: Math.sin(moveAngle),
        moveAmp: moveAmp * 0.75,
        orbitRadius: 2.0 + Math.random() * 2.0,
        moveSpeed,
        movePhase,
        color
      });
    } else {
      const ringRadius = 3.2 + Math.random() * 1.8;
      const tubeThickness = 0.62;
      const ry = Math.random() * Math.PI;
      list.push({
        id: 'obs_' + i,
        kind: 'ring',
        px, py, pz,
        baseX: px, baseY: py, baseZ: pz,
        ringRadius,
        tubeThickness,
        rx: 0, ry, rz: 0,
        rotSpeedY: (Math.random() < 0.5 ? 1 : -1) * (0.9 + Math.random() * 1.1) * speedFactor,
        moveType,
        moveDirX: Math.cos(moveAngle),
        moveDirZ: Math.sin(moveAngle),
        moveAmp: moveAmp * 0.8,
        orbitRadius: 2.2 + Math.random() * 2.2,
        moveSpeed,
        movePhase,
        color
      });
    }
  }

  return { targetPos, obstacles: list };
}

export function buildAirStrikeStage(T, scene, diffCfg, obstacleList, targetPos){
  const skyHex = diffCfg ? diffCfg.skyColor : 0x80c5e1;
  const groundHex = diffCfg ? diffCfg.groundColor : 0x8fd694;

  scene.background = new T.Color(skyHex);
  scene.fog = new T.Fog(skyHex, 65, 185);

  scene.add(new T.HemisphereLight(0xffffff, 0x33495b, 1.8));
  const sun = new T.DirectionalLight(0xffffff, 1.5);
  sun.position.set(12, 65, 18);
  scene.add(sun);

  const ground = new T.Mesh(
    new T.PlaneGeometry(200, 200),
    new T.MeshStandardMaterial({color: groundHex, roughness: 0.9})
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  const grid = new T.GridHelper(200, 100, 0xffffff, 0x334455);
  grid.position.y = 0.02;
  grid.material.opacity = 0.25;
  grid.material.transparent = true;
  scene.add(grid);

  const tx = targetPos ? targetPos.x : 0;
  const tz = targetPos ? targetPos.z : 0;

  const targetGroup = new T.Group();
  targetGroup.position.set(tx, 0.05, tz);

  const outerRing = new T.Mesh(
    new T.RingGeometry(3.4, 4.5, 32),
    new T.MeshBasicMaterial({color: 0xff2a55, side: T.DoubleSide})
  );
  outerRing.rotation.x = -Math.PI / 2;
  targetGroup.add(outerRing);

  const innerRing = new T.Mesh(
    new T.RingGeometry(1.4, 2.4, 32),
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

  const beacon = new T.Mesh(
    new T.CylinderGeometry(0.45, 0.45, 56, 12, 1, true),
    new T.MeshBasicMaterial({color: 0xff4d6d, transparent: true, opacity: 0.28, side: T.DoubleSide})
  );
  beacon.position.y = 28;
  targetGroup.add(beacon);

  scene.add(targetGroup);

  const obstacleMeshes = [];
  for(const obs of obstacleList){
    let obj3d = null;
    const mat = new T.MeshStandardMaterial({
      color: obs.color,
      roughness: 0.4,
      metalness: 0.38
    });

    if(obs.kind === 'box'){
      obj3d = new T.Mesh(new T.BoxGeometry(obs.sx, obs.sy, obs.sz), mat);
    } else if(obs.kind === 'sphere'){
      obj3d = new T.Mesh(new T.SphereGeometry(obs.r, 14, 12), mat);
    } else if(obs.kind === 'rod'){
      obj3d = new T.Mesh(new T.CylinderGeometry(obs.radius, obs.radius, obs.length, 10), mat);
    } else if(obs.kind === 'cross'){
      const grp = new T.Group();
      const barA = new T.Mesh(new T.CylinderGeometry(obs.radius, obs.radius, obs.length, 10), mat);
      barA.rotation.z = Math.PI / 2;
      const barB = new T.Mesh(new T.CylinderGeometry(obs.radius, obs.radius, obs.length, 10), mat);
      barB.rotation.x = Math.PI / 2;
      const hub = new T.Mesh(new T.SphereGeometry(obs.radius * 1.45, 10, 8), mat);
      grp.add(barA, barB, hub);
      obj3d = grp;
    } else if(obs.kind === 'ring'){
      const grp = new T.Group();
      const segCount = 8;
      const segLen = (2 * Math.PI * obs.ringRadius) / segCount * 1.05;
      for(let s = 0; s < segCount; s++){
        const a = (s / segCount) * Math.PI * 2;
        const seg = new T.Mesh(
          new T.BoxGeometry(segLen, obs.tubeThickness, obs.tubeThickness),
          mat
        );
        seg.position.set(Math.cos(a) * obs.ringRadius, 0, Math.sin(a) * obs.ringRadius);
        seg.rotation.y = -a + Math.PI / 2;
        grp.add(seg);
      }
      obj3d = grp;
    }

    if(obj3d){
      obj3d.position.set(obs.px, obs.py, obs.pz);
      obj3d.rotation.set(obs.rx || 0, obs.ry || 0, obs.rz || 0);
      obj3d.userData.obs = obs;
      scene.add(obj3d);
      obstacleMeshes.push(obj3d);
    }
  }

  return { targetGroup, obstacleMeshes };
}
