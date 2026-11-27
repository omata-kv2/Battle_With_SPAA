export function buildAirStrikeWorld(T, scene, diffObj, missionData){
  const skyHex = diffObj ? diffObj.skyHex : '#0a1e30';
  const groundHex = diffObj ? diffObj.groundHex : '#1b3a4b';

  scene.background = new T.Color(skyHex);
  scene.fog = new T.FogExp2(skyHex, 0.0028);

  scene.add(new T.HemisphereLight(0xd9f7ff, 0x1a2836, 1.4));
  const dir = new T.DirectionalLight(0xfff5e0, 1.85);
  dir.position.set(35, 80, 28);
  scene.add(dir);

  const ground = new T.Mesh(
    new T.PlaneGeometry(340, 340),
    new T.MeshStandardMaterial({ color: groundHex, roughness: 0.88, metalness: 0.08 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  const grid = new T.GridHelper(320, 64, 0x38c8f0, 0x1e3f5a);
  grid.position.y = 0.03;
  scene.add(grid);

  const tx = missionData.targetX;
  const tz = missionData.targetZ;

  const targetGroup = new T.Group();
  targetGroup.position.set(tx, 0.08, tz);

  const ringOuter = new T.Mesh(
    new T.RingGeometry(2.6, 3.3, 36),
    new T.MeshBasicMaterial({ color: 0xff4d6d, side: T.DoubleSide })
  );
  ringOuter.rotation.x = -Math.PI / 2;
  targetGroup.add(ringOuter);

  const ringInner = new T.Mesh(
    new T.RingGeometry(1.1, 1.65, 36),
    new T.MeshBasicMaterial({ color: 0xffd23f, side: T.DoubleSide })
  );
  ringInner.rotation.x = -Math.PI / 2;
  ringInner.position.y = 0.02;
  targetGroup.add(ringInner);

  const pillar = new T.Mesh(
    new T.CylinderGeometry(2.4, 2.4, 110, 24, 1, true),
    new T.MeshBasicMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.2, side: T.DoubleSide, depthWrite: false })
  );
  pillar.position.y = 55;
  targetGroup.add(pillar);

  scene.add(targetGroup);

  const obstacles = [];
  const obMat1 = new T.MeshStandardMaterial({ color: 0x64748b, metalness: 0.65, roughness: 0.35 });
  const obMat2 = new T.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x78350f, emissiveIntensity: 0.35, metalness: 0.5, roughness: 0.4 });

  for(const item of missionData.obstacles){
    const obGroup = new T.Group();
    obGroup.position.set(item.x, item.y, item.z);

    if(item.shape === 'box'){
      const m = new T.Mesh(new T.BoxGeometry(item.size, item.size * 0.75, item.size), obMat1);
      obGroup.add(m);
    } else if(item.shape === 'cylinder'){
      const m = new T.Mesh(new T.CylinderGeometry(item.size * 0.45, item.size * 0.45, item.size * 1.4, 14), obMat2);
      obGroup.add(m);
    } else if(item.shape === 'ring'){
      const m = new T.Mesh(new T.TorusGeometry(item.size * 0.65, item.size * 0.16, 10, 22), obMat2);
      obGroup.add(m);
    } else if(item.shape === 'cross'){
      const b1 = new T.Mesh(new T.BoxGeometry(item.size * 1.5, item.size * 0.32, item.size * 0.32), obMat1);
      const b2 = new T.Mesh(new T.BoxGeometry(item.size * 0.32, item.size * 1.5, item.size * 0.32), obMat2);
      obGroup.add(b1, b2);
    } else {
      const b1 = new T.Mesh(new T.BoxGeometry(item.size * 1.6, item.size * 0.22, item.size * 0.45), obMat2);
      const b2 = new T.Mesh(new T.BoxGeometry(item.size * 0.45, item.size * 0.22, item.size * 1.6), obMat1);
      obGroup.add(b1, b2);
    }

    scene.add(obGroup);
    obstacles.push({
      mesh: obGroup,
      baseX: item.x,
      hitRadius: item.size * 0.55,
      rotSpeedX: item.rotSpeedX,
      rotSpeedY: item.rotSpeedY,
      rotSpeedZ: item.rotSpeedZ,
      moveAmp: item.moveAmp,
      moveFreq: item.moveFreq,
      movePhase: item.movePhase
    });
  }

  return {
    beacon: { targetGroup, ringOuter, ringInner, pillar },
    obstacles
  };
}
