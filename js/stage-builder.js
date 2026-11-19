export function buildStage(T,scene){
  scene.background=new T.Color(0x80c5e1);scene.fog=new T.Fog(0x80c5e1,55,140);
  scene.add(new T.HemisphereLight(0xdaf5ff,0x33495b,1.7));const sun=new T.DirectionalLight(0xffffff,1.5);sun.position.set(-4,25,7);scene.add(sun);
  const ground=new T.Mesh(new T.PlaneGeometry(140,140),new T.MeshStandardMaterial({color:0x536d60,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-2;scene.add(ground);
  const grid=new T.GridHelper(140,70,0x78958b,0x647f76);grid.position.y=-1.98;scene.add(grid);
  const platform=new T.Mesh(new T.CylinderGeometry(1.5,1.8,.35,12),new T.MeshStandardMaterial({color:0x253d4a,metalness:.45,roughness:.55}));platform.position.set(0,-1.72,5);scene.add(platform);
  for(let i=0;i<8;i++){const h=2+Math.random()*4;const b=new T.Mesh(new T.BoxGeometry(1.5,h,1.5),new T.MeshStandardMaterial({color:0x526d78,roughness:.9}));b.position.set((Math.random()-.5)*65,-2+h/2,(Math.random()-.5)*65);if(Math.hypot(b.position.x,b.position.z)>14)scene.add(b)}
}
export function makeTarget(T){const g=new T.Group();const body=new T.Mesh(new T.CapsuleGeometry(.24,.95,3,8),new T.MeshStandardMaterial({color:0xaebdc7,metalness:.35,roughness:.5}));body.rotation.x=Math.PI/2;g.add(body);const ring=new T.Mesh(new T.TorusGeometry(.34,.055,6,12),new T.MeshBasicMaterial({color:0x73e8ff}));ring.position.z=.15;g.add(ring);return g}
export function makeFighter(T){const g=new T.Group();const mat=new T.MeshStandardMaterial({color:0x879eae,metalness:.5,roughness:.4});const body=new T.Mesh(new T.ConeGeometry(.28,1.7,8),mat);body.rotation.x=-Math.PI/2;g.add(body);const wings=new T.Mesh(new T.BoxGeometry(2.0,.07,.55),mat);wings.position.z=.1;g.add(wings);const tail=new T.Mesh(new T.BoxGeometry(.75,.06,.28),mat);tail.position.set(0,.32,.62);g.add(tail);return g}
export function prepareModel(T,source,targetLength){
  const model=source.clone(true);
  model.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(model);
  const size=box.getSize(new T.Vector3());
  const center=box.getCenter(new T.Vector3());
  const longest=Math.max(size.x,size.y,size.z)||1;
  const wrapper=new T.Group();
  model.position.sub(center);
  model.scale.multiplyScalar(targetLength/longest);
  wrapper.add(model);
  wrapper.userData.modelReady=true;
  return wrapper;
}

// 1マス=2.0単位として計算。syncDataがある場合は参加者がホストのスポーン座標・速度を再現する
export function spawn(T,scene,target,wave,config,type='missile',models={}, isCoop=false, syncData=null){
  const source=type==='fighter'?(models.fighter||makeFighter(T)):(models.missile||target);
  const e=source.clone(true);

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

  const speedMult = isCoop ? 1.2 : 1.0;
  const baseSpeed = config.SPEEDS[wave-1]*(type==='fighter'?config.FIGHTER_SPEED_MULTIPLIER:1)*(.9+Math.random()*.2)*speedMult;
  const id = 'en_' + Date.now() + '_' + Math.floor(Math.random()*100000);
  e.userData.id = id;

  if(type==='missile'){
    const offsetX = (Math.random() - 0.5) * 8;
    const offsetZ = (Math.random() - 0.5) * 8;
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

  e.userData.phase=Math.random()*6;
  e.userData.kind=type;
  e.userData.syncPayload.phase = e.userData.phase;
  scene.add(e);
  return e;
}
