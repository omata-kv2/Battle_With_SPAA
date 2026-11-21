import { makeTarget } from './map-fall-missile.js';
export { makeTarget };

export function generateAirStrikeMissionData(CONFIG, diff){
  const targetAngle = Math.random() * Math.PI * 2;
  const targetDist = 8 + Math.random() * 14;
  const targetPos = {
    x: Number((Math.cos(targetAngle) * targetDist).toFixed(2)),
    z: Number((Math.sin(targetAngle) * targetDist).toFixed(2))
  };

  const count = diff ? diff.obstacleCount : 20;
  const kinds = ['sphere', 'box', 'rod', 'cross', 'ring'];
  const obstacles = [];

  for(let i = 0; i < count; i++){
    const kind = kinds[i % kinds.length];
    const py = 5 + ((i + 0.5) / count) * 39;
    const baseX = (Math.random() - 0.5) * 38;
    const baseZ = (Math.random() - 0.5) * 38;
    const moveRoll = Math.random();
    const moveType = moveRoll < 0.35 ? 'slide' : (moveRoll < 0.6 ? 'orbit' : 'static');

    const obs = {
      kind,
      px: baseX,
      py,
      pz: baseZ,
      baseX,
      baseZ,
      rx: kind === 'rod' ? (Math.random() - 0.5) * 1.2 : 0,
      ry: Math.random() * Math.PI * 2,
      rz: kind === 'rod' ? (Math.random() - 0.5) * 1.2 : 0,
      rotSpeedY: (Math.random() - 0.5) * 1.6,
      moveType,
      moveSpeed: 0.7 + Math.random() * 1.1,
      movePhase: Math.random() * Math.PI * 2,
      moveAmp: 2.5 + Math.random() * 4.5,
      moveDirX: Math.cos(i),
      moveDirZ: Math.sin(i),
      orbitRadius: 2.2 + Math.random() * 3.5,
      r: 1.4 + Math.random() * 1.4,
      sx: 2.2 + Math.random() * 2.6,
      sy: 1.2 + Math.random() * 1.4,
      sz: 2.2 + Math.random() * 2.6,
      length: 5.5 + Math.random() * 4.5,
      radius: 0.38 + Math.random() * 0.25,
      ringRadius: 2.8 + Math.random() * 1.8,
      tubeThickness: 0.55
    };
    obstacles.push(obs);
  }

  return { targetPos, obstacles };
}

export function buildAirStrikeStage(T, scene, diff, obstacles, targetPos){
  const groundHex = diff ? diff.groundHex : '#1b3a4b';
  const skyHex = diff ? diff.skyHex : '#0a1e30';
  scene.background = new T.Color(skyHex);
  scene.fog = new T.FogExp2(skyHex, 0.007);

  scene.add(new T.HemisphereLight(0xd8f3dc, 0x1b4332, 1.2));
  const dir = new T.DirectionalLight(0xffffff, 1.3);
  dir.position.set(20, 60, 20);
  scene.add(dir);

  const ground = new T.Mesh(
    new T.PlaneGeometry(110, 110),
    new T.MeshStandardMaterial({ color: groundHex, roughness: 0.85 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  const grid = new T.GridHelper(90, 30, 0x00f5d4, 0x264653);
  grid.position.y = 0.02;
  scene.add(grid);

  // 地上目標ビーコン
  const targetGroup = new T.Group();
  targetGroup.position.set(targetPos.x, 0.05, targetPos.z);

  const outerRing = new T.Mesh(
    new T.RingGeometry(2.4, 3.2, 32),
    new T.MeshBasicMaterial({ color: 0xff4d6d, side: T.DoubleSide })
  );
  outerRing.rotation.x = -Math.PI / 2;
  targetGroup.add(outerRing);

  const innerDisc = new T.Mesh(
    new T.CircleGeometry(1.4, 24),
    new T.MeshBasicMaterial({ color: 0xffd23f, side: T.DoubleSide })
  );
  innerDisc.rotation.x = -Math.PI / 2;
  innerDisc.position.y = 0.02;
  targetGroup.add(innerDisc);

  const beaconPillar = new T.Mesh(
    new T.CylinderGeometry(0.25, 0.6, 52, 12, 1, true),
    new T.MeshBasicMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.22, side: T.DoubleSide })
  );
  beaconPillar.position.y = 26;
  targetGroup.add(beaconPillar);

  scene.add(targetGroup);

  const obsMat = new T.MeshStandardMaterial({
    color: 0xff7b54,
    emissive: 0x3d1308,
    roughness: 0.4,
    metalness: 0.35
  });

  const obstacleMeshes = obstacles.map((obs) => {
    let mesh;
    if(obs.kind === 'sphere'){
      mesh = new T.Mesh(new T.SphereGeometry(obs.r, 14, 12), obsMat);
    } else if(obs.kind === 'box'){
      mesh = new T.Mesh(new T.BoxGeometry(obs.sx, obs.sy, obs.sz), obsMat);
    } else if(obs.kind === 'rod'){
      mesh = new T.Mesh(new T.CylinderGeometry(obs.radius, obs.radius, obs.length, 10), obsMat);
    } else if(obs.kind === 'cross'){
      mesh = new T.Group();
      const bar1 = new T.Mesh(new T.CylinderGeometry(obs.radius, obs.radius, obs.length, 10), obsMat);
      bar1.rotation.z = Math.PI / 2;
      const bar2 = new T.Mesh(new T.CylinderGeometry(obs.radius, obs.radius, obs.length, 10), obsMat);
      bar2.rotation.x = Math.PI / 2;
      mesh.add(bar1, bar2);
    } else {
      mesh = new T.Mesh(new T.TorusGeometry(obs.ringRadius, obs.tubeThickness * 0.5, 10, 24), obsMat);
      mesh.rotation.x = Math.PI / 2;
    }
    mesh.position.set(obs.px, obs.py, obs.pz);
    mesh.rotation.set(obs.rx || 0, obs.ry || 0, obs.rz || 0);
    scene.add(mesh);
    return mesh;
  });

  return { obstacleMeshes, targetGroup };
}
