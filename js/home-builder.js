// v4.3: ホームマップ構築
function makeTextSprite(T, text, subtext='', bgColor='rgba(10,30,45,0.85)', textColor='#ffffff'){
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#6ee5ff';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  
  ctx.fillStyle = textColor;
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  if(subtext){
    ctx.fillText(text, canvas.width / 2, canvas.height * 0.38);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText(subtext, canvas.width / 2, canvas.height * 0.72);
  } else {
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  
  const tex = new T.CanvasTexture(canvas);
  const mat = new T.SpriteMaterial({map: tex, transparent: true});
  const sprite = new T.Sprite(mat);
  sprite.scale.set(3.2, 1.6, 1);
  return sprite;
}

function makeWallBoard(T, text, subtext=''){
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = 'rgba(8, 23, 34, 0.92)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  
  ctx.fillStyle = '#8eddf6';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height * 0.35);
  
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(subtext, canvas.width / 2, canvas.height * 0.72);
  
  const tex = new T.CanvasTexture(canvas);
  const geo = new T.PlaneGeometry(4.4, 2.2);
  const mat = new T.MeshBasicMaterial({map: tex, side: T.FrontSide});
  return new T.Mesh(geo, mat);
}

export function buildHomeStage(T, scene, gold){
  scene.background = new T.Color(0x0b1f30);
  scene.fog = new T.Fog(0x0b1f30, 25, 65);
  
  scene.add(new T.HemisphereLight(0xdaf5ff, 0x1b3344, 1.6));
  const dirLight = new T.DirectionalLight(0xffffff, 1.4);
  dirLight.position.set(5, 15, 8);
  scene.add(dirLight);

  const cellSize = 2;
  const gridCount = 10;
  const totalSize = cellSize * gridCount;

  const floor = new T.Mesh(
    new T.PlaneGeometry(totalSize, totalSize),
    new T.MeshStandardMaterial({color: 0x1c3b4d, roughness: 0.8})
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new T.GridHelper(totalSize, gridCount, 0x6ee5ff, 0x35627a);
  grid.position.y = 0.01;
  scene.add(grid);

  const wallMat = new T.MeshStandardMaterial({color: 0x112736, roughness: 0.7, metalness: 0.3});
  const wallHeight = 4.5;
  
  const northWall = new T.Mesh(new T.BoxGeometry(totalSize + 0.6, wallHeight, 0.4), wallMat);
  northWall.position.set(0, wallHeight / 2, -10.2);
  scene.add(northWall);

  const southWall = new T.Mesh(new T.BoxGeometry(totalSize + 0.6, wallHeight, 0.4), wallMat);
  southWall.position.set(0, wallHeight / 2, 10.2);
  scene.add(southWall);

  const westWall = new T.Mesh(new T.BoxGeometry(0.4, wallHeight, totalSize + 0.6), wallMat);
  westWall.position.set(-10.2, wallHeight / 2, 0);
  scene.add(westWall);

  const eastWall = new T.Mesh(new T.BoxGeometry(0.4, wallHeight, totalSize + 0.6), wallMat);
  eastWall.position.set(10.2, wallHeight / 2, 0);
  scene.add(eastWall);

  // STARTポータル
  const startPillar = new T.Mesh(
    new T.BoxGeometry(1.8, 3.2, 1.8),
    new T.MeshStandardMaterial({color: 0x00e5ff, transparent: true, opacity: 0.55, emissive: 0x0088aa, emissiveIntensity: 0.4})
  );
  startPillar.position.set(0, 1.6, -9);
  scene.add(startPillar);

  const startLabel = makeTextSprite(T, 'GAME START', '', 'rgba(0, 60, 80, 0.85)', '#8beeff');
  startLabel.position.set(0, 3.9, -9);
  scene.add(startLabel);

  // 機体変更・機体ショップポータル
  const skinPillar = new T.Mesh(
    new T.BoxGeometry(1.8, 3.2, 1.8),
    new T.MeshStandardMaterial({color: 0xffaa00, transparent: true, opacity: 0.55, emissive: 0xaa6600, emissiveIntensity: 0.4})
  );
  skinPillar.position.set(9, 1.6, 0);
  scene.add(skinPillar);

  const skinLabel = makeTextSprite(T, '機体変更・ショップ', '', 'rgba(70, 45, 0, 0.85)', '#ffd700');
  skinLabel.position.set(9, 3.9, 0);
  scene.add(skinLabel);

  // フレンド共闘ポータル
  const coopPillar = new T.Mesh(
    new T.BoxGeometry(1.8, 3.2, 1.8),
    new T.MeshStandardMaterial({color: 0xcc00ff, transparent: true, opacity: 0.6, emissive: 0x660088, emissiveIntensity: 0.5})
  );
  coopPillar.position.set(-9, 1.6, 0);
  scene.add(coopPillar);

  const coopLabel = makeTextSprite(T, 'フレンド共闘', '', 'rgba(50, 0, 70, 0.85)', '#ff88ff');
  coopLabel.position.set(-9, 3.9, 0);
  scene.add(coopLabel);

  const goldBoard = makeWallBoard(T, '所持ゴールド', `${gold} G`);
  goldBoard.position.set(-9.95, 2.8, 4);
  goldBoard.rotation.y = Math.PI / 2;
  scene.add(goldBoard);

  return {
    spawnPos: {x: 0, z: 9},
    triggers: [
      {id: 'gamestart', x: 0, z: -9, radius: 1.45},
      {id: 'skin', x: 9, z: 0, radius: 1.45},
      {id: 'coop', x: -9, z: 0, radius: 1.45}
    ]
  };
}
