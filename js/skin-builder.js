// v2.7: 図面準拠10x10マスのスキンルーム（①〜⑧展示台座・未解放鎖＆ロック・中央パネル・東端スキンストア）

function createPedestalTexture(T, skin, isUnlocked, isSelected, previewImg){
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 背景パネル
  ctx.fillStyle = isSelected ? '#12384d' : (isUnlocked ? '#1b263b' : '#14141c');
  ctx.fillRect(0, 0, 512, 512);

  // 外枠
  ctx.strokeStyle = isSelected ? '#00f5d4' : (isUnlocked ? '#6ee5ff' : '#555566');
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 498, 498);

  // プレビュー画像がある場合は描画、なければカラーエンブレムを描画
  if(previewImg){
    ctx.drawImage(previewImg, 64, 56, 384, 260);
  } else {
    const hexColor = '#' + skin.color.toString(16).padStart(6, '0');
    ctx.fillStyle = hexColor;
    ctx.beginPath();
    ctx.arc(256, 185, 86, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = '#071522';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Lv.${skin.lv}`, 256, 185);
  }

  // スキン名とステータス表示
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Lv.${skin.lv} : ${skin.name}`, 256, 345);

  ctx.font = 'bold 28px system-ui, sans-serif';
  if(isSelected){
    ctx.fillStyle = '#00f5d4';
    ctx.fillText('★ 現在装備中 ★', 256, 405);
  } else if(isUnlocked){
    ctx.fillStyle = '#8beeff';
    ctx.fillText('解放済み（中央パネルで選択）', 256, 405);
  } else {
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`未解放 : ${skin.price.toLocaleString()} G`, 256, 405);
  }

  ctx.fillStyle = '#b9dce9';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(skin.stats.desc, 256, 455);

  // 未購入（ロック状態）の場合、正方形の周りに鎖⛓️とロック🔒を描画
  if(!isUnlocked){
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.fillRect(0, 0, 512, 512);

    // 対角線・外周に鎖（⛓️）を描画
    ctx.font = '44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for(let i = 0; i <= 8; i++){
      const p = 32 + i * 56;
      ctx.fillText('⛓️', p, 28);
      ctx.fillText('⛓️', p, 484);
      ctx.fillText('⛓️', 28, p);
      ctx.fillText('⛓️', 484, p);
      // クロス鎖
      ctx.fillText('⛓️', p, p);
      ctx.fillText('⛓️', 512 - p, p);
    }

    // 中央に大きな鍵マーク🔒
    ctx.font = '110px system-ui, sans-serif';
    ctx.fillText('🔒', 256, 220);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText(`LOCKED (${skin.price.toLocaleString()} G)`, 256, 330);
  }

  const tex = new T.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeFloorZone(T, width, depth, color, title, sub){
  const group = new T.Group();

  const pad = new T.Mesh(
    new T.BoxGeometry(width, 0.16, depth),
    new T.MeshStandardMaterial({color, transparent: true, opacity: 0.72, emissive: color, emissiveIntensity: 0.35})
  );
  pad.position.y = 0.08;
  group.add(pad);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(7, 21, 34, 0.88)';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 246);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, sub ? 95 : 128);

  if(sub){
    ctx.fillStyle = '#8beeff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(sub, 256, 172);
  }

  const sprite = new T.Sprite(new T.SpriteMaterial({map: new T.CanvasTexture(canvas), transparent: true}));
  sprite.scale.set(3.6, 1.8, 1);
  sprite.position.y = 2.1;
  group.add(sprite);

  return group;
}

export function buildSkinStage(T, scene, skins, unlockedIds, selectedId){
  scene.background = new T.Color(0x131726);
  scene.fog = new T.Fog(0x131726, 28, 70);

  scene.add(new T.HemisphereLight(0xdaf5ff, 0x1e2538, 1.7));
  const dirLight = new T.DirectionalLight(0xffffff, 1.4);
  dirLight.position.set(6, 16, 6);
  scene.add(dirLight);

  // 10x10マス構成（1マス = 2x2ユニット、全体 20x20、座標 -10 ~ +10）
  // 上が東(+X)、下が西(-X)、左が北(-Z)、右が南(+Z)
  const totalSize = 20;
  const floor = new T.Mesh(
    new T.PlaneGeometry(totalSize, totalSize),
    new T.MeshStandardMaterial({color: 0x1f273d, roughness: 0.85})
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new T.GridHelper(totalSize, 10, 0x6ee5ff, 0x354463);
  grid.position.y = 0.01;
  scene.add(grid);

  // 周囲の壁
  const wallMat = new T.MeshStandardMaterial({color: 0x101524, roughness: 0.7});
  const wallHeight = 4.6;
  const walls = [
    {w: totalSize + 0.6, h: wallHeight, d: 0.4, x: 0, z: -10.2}, // 北壁
    {w: totalSize + 0.6, h: wallHeight, d: 0.4, x: 0, z: 10.2},  // 南壁
    {w: 0.4, h: wallHeight, d: totalSize + 0.6, x: -10.2, z: 0}, // 西壁（下側）
    {w: 0.4, h: wallHeight, d: totalSize + 0.6, x: 10.2, z: 0}   // 東壁（上側）
  ];
  for(const w of walls){
    const m = new T.Mesh(new T.BoxGeometry(w.w, w.h, w.d), wallMat);
    m.position.set(w.x, w.h / 2, w.z);
    scene.add(m);
  }

  // ①〜⑧のスキン展示台座（図面通り左右4段ずつ、2x2マス分=3.6x3.6サイズ）
  // ①(lv1): 西下・左(北) -> x = -8, z = -8
  // ②(lv2): 西下・右(南) -> x = -8, z = +8
  // ③(lv3): 中下・左(北) -> x = -3, z = -8
  // ④(lv4): 中下・右(南) -> x = -3, z = +8
  // ⑤(lv5): 中上・左(北) -> x = +2.5, z = -8
  // ⑥(lv6): 中上・右(南) -> x = +2.5, z = +8
  // ⑦(lv7): 東上・左(北) -> x = +8, z = -8
  // ⑧(lv8): 東上・右(南) -> x = +8, z = +8
  const slotCoords = [
    {x: -8.0, z: -8.0, rotY: 0},          // ① lv1 (北側列・マップ中央向き)
    {x: -8.0, z:  8.0, rotY: Math.PI},    // ② lv2 (南側列・マップ中央向き)
    {x: -2.7, z: -8.0, rotY: 0},          // ③ lv3
    {x: -2.7, z:  8.0, rotY: Math.PI},    // ④ lv4
    {x:  2.7, z: -8.0, rotY: 0},          // ⑤ lv5
    {x:  2.7, z:  8.0, rotY: Math.PI},    // ⑥ lv6
    {x:  8.0, z: -8.0, rotY: 0},          // ⑦ lv7
    {x:  8.0, z:  8.0, rotY: Math.PI}     // ⑧ lv8
  ];

  const pedestalMeshes = {};

  skins.forEach((skin, idx) => {
    const slot = slotCoords[idx];
    const isUnlocked = unlockedIds.includes(skin.id);
    const isSelected = selectedId === skin.id;

    // 2x2マスの展示台ベース
    const base = new T.Mesh(
      new T.BoxGeometry(3.6, 0.3, 3.6),
      new T.MeshStandardMaterial({color: 0x2a3652, metalness: 0.4, roughness: 0.5})
    );
    base.position.set(slot.x, 0.15, slot.z);
    scene.add(base);

    // 展示用正方形パネル（ロック時は鎖⛓️＆🔒で覆われる）
    const tex = createPedestalTexture(T, skin, isUnlocked, isSelected, null);
    const board = new T.Mesh(
      new T.BoxGeometry(3.2, 3.2, 0.25),
      new T.MeshBasicMaterial({map: tex})
    );
    board.position.set(slot.x, 1.95, slot.z);
    board.rotation.y = slot.rotY;
    scene.add(board);

    // 未解放時用の立体鎖フレーム（3D表現でもロック感を強調）
    const lockFrameGroup = new T.Group();
    const chainMat = new T.MeshStandardMaterial({color: 0x8899aa, metalness: 0.85, roughness: 0.25});
    const bar1 = new T.Mesh(new T.BoxGeometry(3.4, 0.18, 0.36), chainMat);
    bar1.rotation.z = Math.PI / 4;
    const bar2 = new T.Mesh(new T.BoxGeometry(3.4, 0.18, 0.36), chainMat);
    bar2.rotation.z = -Math.PI / 4;
    lockFrameGroup.add(bar1, bar2);
    lockFrameGroup.position.set(slot.x, 1.95, slot.z);
    lockFrameGroup.rotation.y = slot.rotY;
    lockFrameGroup.visible = !isUnlocked;
    scene.add(lockFrameGroup);

    // PNG画像が配置されていれば非同期で読み込んでテクスチャ更新
    const img = new Image();
    img.onload = () => {
      const updatedTex = createPedestalTexture(T, skin, unlockedIds.includes(skin.id), selectedId === skin.id, img);
      board.material.map = updatedTex;
      board.material.needsUpdate = true;
    };
    img.src = skin.previewPath;

    pedestalMeshes[skin.id] = {board, lockFrameGroup, img: null};
  });

  // 【中央青色ゾーン】スキン変更パネル（1秒以上触れるとUI呼び出し）
  const selectPanelZone = makeFloorZone(T, 2.2, 3.8, 0x2563eb, 'スキン変更パネル', '1秒間触れてスキン選択');
  selectPanelZone.position.set(-2.0, 0, 0);
  scene.add(selectPanelZone);

  // 【東端(図の上部)緑色ゾーン】スキンストア（東辺中央2マス幅: x = +8.8, z = 0）
  const storeZone = makeFloorZone(T, 2.2, 3.8, 0x10b981, 'スキンストア', '触れてスキンを購入・解放');
  storeZone.position.set(8.8, 0, 0);
  scene.add(storeZone);

  // 【西端南寄り】ホームへ戻るゲート（x = -9.0, z = 3.5）
  const backZone = makeFloorZone(T, 1.8, 2.2, 0x06b6d4, 'ホームへ戻る', '触れてホーム基地へ');
  backZone.position.set(-9.0, 0, 3.5);
  scene.add(backZone);

  return {
    // プレイヤーは西の端中央のマスに東を向いてスポーン
    spawnPos: {x: -9.0, z: 0},
    spawnYaw: -Math.PI / 2, // 東(+X方向)を向く
    zones: {
      selectPanel: {x: -2.0, z: 0, halfX: 1.3, halfZ: 2.0},
      store: {x: 8.8, z: 0, halfX: 1.3, halfZ: 2.0},
      backHome: {x: -9.0, z: 3.5, halfX: 1.1, halfZ: 1.3}
    },
    refreshPedestals(newUnlockedIds, newSelectedId){
      skins.forEach(skin => {
        const entry = pedestalMeshes[skin.id];
        if(!entry) return;
        const isUnlocked = newUnlockedIds.includes(skin.id);
        const isSelected = newSelectedId === skin.id;
        entry.lockFrameGroup.visible = !isUnlocked;
        const tex = createPedestalTexture(T, skin, isUnlocked, isSelected, null);
        entry.board.material.map = tex;
        entry.board.material.needsUpdate = true;
      });
    }
  };
}
