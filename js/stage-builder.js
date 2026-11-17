export function buildStage(T,scene){
  scene.background=new T.Color(0x80c5e1);scene.fog=new T.Fog(0x80c5e1,40,95);
  scene.add(new T.HemisphereLight(0xdaf5ff,0x33495b,1.7));
  const sun=new T.DirectionalLight(0xffffff,1.5);sun.position.set(-4,10,7);scene.add(sun);
  const ground=new T.Mesh(new T.PlaneGeometry(120,120),new T.MeshStandardMaterial({color:0x536d60,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-2;scene.add(ground);
  const grid=new T.GridHelper(120,60,0x78958b,0x647f76);grid.position.y=-1.98;scene.add(grid);
  const platform=new T.Mesh(new T.CylinderGeometry(1.5,1.8,.35,12),new T.MeshStandardMaterial({color:0x253d4a,metalness:.45,roughness:.55}));platform.position.set(0,-1.72,5);scene.add(platform);
  for(let i=0;i<8;i++){const h=2+Math.random()*4;const b=new T.Mesh(new T.BoxGeometry(1.5,h,1.5),new T.MeshStandardMaterial({color:0x526d78,roughness:.9}));b.position.set((Math.random()-.5)*55,-2+h/2,-15-Math.random()*45);scene.add(b)}
}
export function makeTarget(T){const g=new T.Group();
  const body=new T.Mesh(new T.CapsuleGeometry(.24,.95,3,8),new T.MeshStandardMaterial({color:0xaebdc7,metalness:.35,roughness:.5}));body.rotation.x=Math.PI/2;g.add(body);
  const ring=new T.Mesh(new T.TorusGeometry(.34,.055,6,12),new T.MeshBasicMaterial({color:0x73e8ff}));ring.position.z=.15;g.add(ring);return g;
}
export function spawn(T,scene,target,wave,config){const e=target.clone(true);e.position.set((Math.random()-.5)*24,3+Math.random()*9,-(22+Math.random()*22));e.userData.speed=config.SPEEDS[wave-1]*(.7+Math.random()*.6);e.userData.phase=Math.random()*6;scene.add(e);return e}
