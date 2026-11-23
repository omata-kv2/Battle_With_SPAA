import { YAJU_CONFIG, YAJU_ROCKET_IMAGE } from './yaju-config.js';
import { cellWorld } from './yaju-collision.js';

function resizeTextureImage(image, maxSize = YAJU_CONFIG.maxTextureSize){
  if(!image || (image.width <= maxSize && image.height <= maxSize)) return image;
  const canvas = document.createElement('canvas');
  let w = image.width;
  let h = image.height;
  if(w > h){
    if(w > maxSize){ h = Math.round(h * (maxSize / w)); w = maxSize; }
  } else {
    if(h > maxSize){ w = Math.round(w * (maxSize / h)); h = maxSize; }
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, w, h);
  return canvas;
}

export function generateYajuMaze(size = YAJU_CONFIG.mazeCells){
  const grid = Array.from({ length: size }, () => Array(size).fill(1));
  const stack = [[1, 1]];
  grid[1][1] = 0;
  const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]];
  while(stack.length){
    const [x, z] = stack[stack.length - 1];
    const choices = dirs.filter(([dx, dz]) => {
      const nx = x + dx;
      const nz = z + dz;
      return nx > 0 && nz > 0 && nx < size - 1 && nz < size - 1 && grid[nz][nx] === 1;
    });
    if(!choices.length){ stack.pop(); continue; }
    const [dx, dz] = choices[Math.floor(Math.random() * choices.length)];
    grid[z + dz / 2][x + dx / 2] = 0;
    grid[z + dz][x + dx] = 0;
    stack.push([x + dx, z + dz]);
  }

  for(let z = 1; z < size - 1; z++){
    for(let x = 1; x < size - 1; x++){
      if(grid[z][x] !== 1 || Math.random() > 0.35) continue;
      const horizontal = grid[z][x - 1] === 0 && grid[z][x + 1] === 0;
      const vertical = grid[z - 1][x] === 0 && grid[z + 1][x] === 0;
      if(horizontal || vertical) grid[z][x] = 0;
    }
  }

  grid[1][1] = 0; grid[1][2] = 0; grid[2][1] = 0;
  grid[size - 2][size - 2] = 0; grid[size - 2][size - 3] = 0; grid[size - 3][size - 2] = 0;
  return grid;
}

function createStepsAndTraps(T, scene, maze){
  const openCells = [];
  for(let z = 2; z < maze.length - 2; z++){
    for(let x = 2; x < maze.length - 2; x++){
      if(maze[z][x] === 0 && !(x <= 2 && z <= 2) && !(x >= maze.length - 3 && z >= maze.length - 3)){
        openCells.push({ x, z });
      }
    }
  }

  const totalCount = Math.floor(Math.random() * (YAJU_CONFIG.totalElevationObjectsMax - YAJU_CONFIG.totalElevationObjectsMin + 1)) + YAJU_CONFIG.totalElevationObjectsMin;
  const usedCells = new Set();
  const elevations = [];
  const traps = [];

  const stepMat = new T.MeshStandardMaterial({ color: 0xaaa080, roughness: 0.85 });
  const trapMat = new T.MeshStandardMaterial({ color: 0xbb9368, roughness: 0.80 });

  let remaining = totalCount;
  while(remaining > 0 && openCells.length > 0){
    const idx = Math.floor(Math.random() * openCells.length);
    const baseCell = openCells.splice(idx, 1)[0];
    const key = `${baseCell.x},${baseCell.z}`;
    if(usedCells.has(key)) continue;

    const isTrap = Math.random() < YAJU_CONFIG.trapProbability;
    usedCells.add(key);
    const p1 = cellWorld(baseCell.x, baseCell.z, maze.length);
    const h1 = YAJU_CONFIG.stepHeight1;
    const mesh1 = new T.Mesh(new T.BoxGeometry(YAJU_CONFIG.cellSize, h1, YAJU_CONFIG.cellSize), isTrap ? trapMat : stepMat);
    mesh1.position.set(p1.x, h1 / 2, p1.z);
    scene.add(mesh1);

    const obj1 = { mesh: mesh1, position: p1, height: h1, steps: 1, isTrap, cell: baseCell, active: true };
    if(isTrap) traps.push(obj1);
    else elevations.push(obj1);
    remaining--;

    if(remaining > 0){
      const neighbors = [
        { x: baseCell.x + 1, z: baseCell.z }, { x: baseCell.x - 1, z: baseCell.z },
        { x: baseCell.x, z: baseCell.z + 1 }, { x: baseCell.x, z: baseCell.z - 1 }
      ].filter(c => maze[c.z]?.[c.x] === 0 && !usedCells.has(`${c.x},${c.z}`));

      if(neighbors.length > 0){
        const nCell = neighbors[Math.floor(Math.random() * neighbors.length)];
        const nKey = `${nCell.x},${nCell.z}`;
        usedCells.add(nKey);

        const isTrap2 = Math.random() < YAJU_CONFIG.trapProbability;
        const p2 = cellWorld(nCell.x, nCell.z, maze.length);
        const h2 = YAJU_CONFIG.stepHeight2;
        const mesh2 = new T.Mesh(new T.BoxGeometry(YAJU_CONFIG.cellSize, h2, YAJU_CONFIG.cellSize), isTrap2 ? trapMat : stepMat);
        mesh2.position.set(p2.x, h2 / 2, p2.z);
        scene.add(mesh2);

        const obj2 = { mesh: mesh2, position: p2, height: h2, steps: 2, isTrap: isTrap2, cell: nCell, active: true };
        if(isTrap2) traps.push(obj2);
        else elevations.push(obj2);
        remaining--;
      }
    }
  }

  return { elevations, traps };
}

function loadMazeTextures(T, loader, size, floorMat, ceilingMat, wallMat){
  loader.load('./assets/textures/wall.jpeg', tex => {
    if(tex && tex.image){
      tex.image = resizeTextureImage(tex.image, YAJU_CONFIG.maxTextureSize);
      tex.needsUpdate = true;
      wallMat.map = tex;
      wallMat.needsUpdate = true;
    }
  }, undefined, () => {});
  loader.load('./assets/textures/floor.jpeg', tex => {
    if(tex && tex.image){
      tex.image = resizeTextureImage(tex.image, YAJU_CONFIG.maxTextureSize);
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(size / 2, size / 2);
      tex.needsUpdate = true;
      floorMat.map = tex;
      floorMat.needsUpdate = true;
    }
  }, undefined, () => {});
  loader.load('./assets/textures/ceiling.jpeg', tex => {
    if(tex && tex.image){
      tex.image = resizeTextureImage(tex.image, YAJU_CONFIG.maxTextureSize);
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(size / 2, size / 2);
      tex.needsUpdate = true;
      ceilingMat.map = tex;
      ceilingMat.needsUpdate = true;
    }
  }, undefined, () => {});
}

export function buildYajuMazeScene(T, scene, maze){
  const loader = new T.TextureLoader();
  scene.background = new T.Color(0x0a0a08);
  scene.fog = new T.Fog(0x0a0a08, YAJU_CONFIG.fogNear, YAJU_CONFIG.fogFar);

  scene.add(new T.HemisphereLight(0xaaaaaa, 0x444444, 2.0));
  const dirLight = new T.DirectionalLight(0x999988, 0.4);
  dirLight.position.set(5, 12, 4);
  scene.add(dirLight);

  const carpetCanvas = document.createElement('canvas');
  carpetCanvas.width = 128;
  carpetCanvas.height = 128;
  const carpetCtx = carpetCanvas.getContext('2d');
  carpetCtx.fillStyle = '#555040';
  carpetCtx.fillRect(0, 0, 128, 128);
  for(let i = 0; i < 800; i++){
    const v = 70 + Math.floor(Math.random() * 30);
    carpetCtx.fillStyle = `rgba(${v},${v - 5},${v - 15},${Math.random() * 0.2})`;
    carpetCtx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const carpetTexture = new T.CanvasTexture(carpetCanvas);
  carpetTexture.wrapS = carpetTexture.wrapT = T.RepeatWrapping;
  carpetTexture.repeat.set(maze.length / 2, maze.length / 2);

  const floorMat = new T.MeshStandardMaterial({ map: carpetTexture, color: 0xcccccc, roughness: 0.9 });
  const ceilingMat = new T.MeshStandardMaterial({ color: 0x777060, roughness: 0.9 });
  const wallMat = new T.MeshStandardMaterial({ color: 0xaaa080, roughness: 0.9 });
  loadMazeTextures(T, loader, maze.length, floorMat, ceilingMat, wallMat);

  const floor = new T.Mesh(new T.PlaneGeometry(maze.length * YAJU_CONFIG.cellSize, maze.length * YAJU_CONFIG.cellSize), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const ceiling = new T.Mesh(new T.PlaneGeometry(maze.length * YAJU_CONFIG.cellSize, maze.length * YAJU_CONFIG.cellSize), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = YAJU_CONFIG.wallHeight;
  scene.add(ceiling);

  let wallCount = 0;
  for(let z = 0; z < maze.length; z++){
    for(let x = 0; x < maze.length; x++){
      if(maze[z][x] === 1) wallCount++;
    }
  }

  const wallGeo = new T.BoxGeometry(YAJU_CONFIG.cellSize, YAJU_CONFIG.wallHeight, YAJU_CONFIG.cellSize);
  const wallInstancedMesh = new T.InstancedMesh(wallGeo, wallMat, wallCount);
  let wIdx = 0;
  const dummy = new T.Object3D();

  for(let z = 0; z < maze.length; z++){
    for(let x = 0; x < maze.length; x++){
      if(maze[z][x] === 1){
        const p = cellWorld(x, z, maze.length);
        dummy.position.set(p.x, YAJU_CONFIG.wallHeight / 2, p.z);
        dummy.updateMatrix();
        wallInstancedMesh.setMatrixAt(wIdx++, dummy.matrix);
      }
    }
  }
  scene.add(wallInstancedMesh);

  const { elevations, traps } = createStepsAndTraps(T, scene, maze);

  const pointLightsList = [];
  for(let z = 1; z < maze.length - 1; z += 2){
    for(let x = 1; x < maze.length - 1; x += 2){
      if(maze[z][x] === 0){
        const p = cellWorld(x, z, maze.length);
        const isRedLight = Math.random() < 0.4;
        const lightColor = isRedLight ? 0xff3333 : 0xfffae6;
        const lampEmissive = isRedLight ? 0x661111 : 0x444433;

        const lampMat = new T.MeshStandardMaterial({
          color: lightColor,
          emissive: lampEmissive,
          emissiveIntensity: 0.3,
          roughness: 0.8
        });
        const lampMesh = new T.Mesh(new T.BoxGeometry(1.2, 0.06, 0.4), lampMat);
        lampMesh.position.set(p.x, YAJU_CONFIG.wallHeight - 0.04, p.z);
        scene.add(lampMesh);

        const baseInt = isRedLight ? 12.0 : 15.0;
        const pl = new T.PointLight(lightColor, baseInt, 18.0);
        pl.position.set(p.x, YAJU_CONFIG.wallHeight - 0.8, p.z);
        scene.add(pl);

        pointLightsList.push({
          position: new T.Vector3(p.x, YAJU_CONFIG.wallHeight - 0.8, p.z),
          light: pl,
          lampMesh,
          baseIntensity: baseInt
        });
      }
    }
  }

  return { pointLightsList, elevations, traps };
}

export function setupYajuMapRockets(T, scene, openCells, mazeLength, spawnPos, elevations = []){
  const loader = new T.TextureLoader();
  const mapItems = [];
  const count = 1 + Math.floor(Math.random() * 2);

  const candidates = openCells.filter(c => {
    const p = cellWorld(c.x, c.z, mazeLength);
    return Math.hypot(p.x - spawnPos.x, p.z - spawnPos.z) >= YAJU_CONFIG.rocketSpawnMinDist;
  });
  const pool = candidates.length ? candidates : openCells;

  const createItems = (texture) => {
    for(let i = 0; i < count; i++){
      const cell = pool[Math.floor(Math.random() * pool.length)];
      const rPos = cellWorld(cell.x, cell.z, mazeLength);

      let targetElevationHeight = 0.8;
      for(const el of elevations){
        if(Math.abs(rPos.x - el.position.x) < 0.5 && Math.abs(rPos.z - el.position.z) < 0.5){
          targetElevationHeight = el.height + 0.5;
          break;
        }
      }
      rPos.y = targetElevationHeight;

      const mat = texture
        ? new T.MeshBasicMaterial({ map: texture, transparent: true, side: T.DoubleSide })
        : new T.MeshBasicMaterial({ color: 0x00aaff, side: T.DoubleSide });
      const geo = new T.PlaneGeometry(1.2, 1.2);
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(rPos.x, rPos.y, rPos.z);
      scene.add(mesh);

      const blueLight = new T.PointLight(0x00aaff, 4.0, 12);
      blueLight.position.set(rPos.x, rPos.y + 0.3, rPos.z);
      scene.add(blueLight);

      mapItems.push({ mesh, light: blueLight, cell, active: true });
    }
  };

  loader.load(YAJU_ROCKET_IMAGE, texture => {
    texture.colorSpace = T.SRGBColorSpace;
    texture.needsUpdate = true;
    createItems(texture);
  }, undefined, () => {
    createItems(null);
  });

  return mapItems;
}

export function buildYajuBossScene(T, scene, bossType){
  const loader = new T.TextureLoader();
  const size = 10;
  const maze = Array.from({ length: size }, (_, z) =>
    Array.from({ length: size }, (_, x) =>
      (z === 0 || z === size - 1 || x === 0 || x === size - 1) ? 1 : 0
    )
  );

  scene.background = new T.Color(0x0a0a08);
  scene.fog = new T.Fog(0x0a0a08, YAJU_CONFIG.fogNear, YAJU_CONFIG.fogFar);

  scene.add(new T.HemisphereLight(0xaaaaaa, 0x444444, 2.0));
  const dirLight = new T.DirectionalLight(0x999988, 0.4);
  dirLight.position.set(5, 12, 4);
  scene.add(dirLight);

  const floorMat = new T.MeshStandardMaterial({ color: 0x555040, roughness: 0.9 });
  const ceilingMat = new T.MeshStandardMaterial({ color: 0x777060, roughness: 0.9 });
  const wallMat = new T.MeshStandardMaterial({ color: 0xaaa080, roughness: 0.9 });
  loadMazeTextures(T, loader, size, floorMat, ceilingMat, wallMat);

  const floor = new T.Mesh(new T.PlaneGeometry(size * YAJU_CONFIG.cellSize, size * YAJU_CONFIG.cellSize), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const ceiling = new T.Mesh(new T.PlaneGeometry(size * YAJU_CONFIG.cellSize, size * YAJU_CONFIG.cellSize), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = YAJU_CONFIG.wallHeight;
  scene.add(ceiling);

  let wallCount = 0;
  for(let z = 0; z < size; z++){
    for(let x = 0; x < size; x++){
      if(maze[z][x] === 1) wallCount++;
    }
  }

  const wallGeo = new T.BoxGeometry(YAJU_CONFIG.cellSize, YAJU_CONFIG.wallHeight, YAJU_CONFIG.cellSize);
  const wallInstancedMesh = new T.InstancedMesh(wallGeo, wallMat, wallCount);
  let wIdx = 0;
  const dummy = new T.Object3D();

  for(let z = 0; z < size; z++){
    for(let x = 0; x < size; x++){
      if(maze[z][x] === 1){
        const p = cellWorld(x, z, size);
        dummy.position.set(p.x, YAJU_CONFIG.wallHeight / 2, p.z);
        dummy.updateMatrix();
        wallInstancedMesh.setMatrixAt(wIdx++, dummy.matrix);
      }
    }
  }
  scene.add(wallInstancedMesh);

  const pointLightsList = [];
  for(let z = 1; z < size - 1; z += 2){
    for(let x = 1; x < size - 1; x += 2){
      const p = cellWorld(x, z, size);
      const lightColor = 0xff3333;
      const lampEmissive = 0x661111;

      const lampMat = new T.MeshStandardMaterial({
        color: lightColor,
        emissive: lampEmissive,
        emissiveIntensity: 0.4,
        roughness: 0.8
      });
      const lampMesh = new T.Mesh(new T.BoxGeometry(1.2, 0.06, 0.4), lampMat);
      lampMesh.position.set(p.x, YAJU_CONFIG.wallHeight - 0.04, p.z);
      scene.add(lampMesh);

      const baseInt = 14.0;
      const pl = new T.PointLight(lightColor, baseInt, 18.0);
      pl.position.set(p.x, YAJU_CONFIG.wallHeight - 0.8, p.z);
      scene.add(pl);

      pointLightsList.push({
        position: new T.Vector3(p.x, YAJU_CONFIG.wallHeight - 0.8, p.z),
        light: pl,
        lampMesh,
        baseIntensity: baseInt
      });
    }
  }

  const elevations = [];
  const traps = [];
  const stepMat = new T.MeshStandardMaterial({ color: 0xaaa080, roughness: 0.85 });
  const trapMat = new T.MeshStandardMaterial({ color: 0xbb9368, roughness: 0.80 });

  const centerCoord = (size - 1) / 2;
  const validStepCells = [];
  const allInnerCells = [];

  for(let z = 1; z < size - 1; z++){
    for(let x = 1; x < size - 1; x++){
      allInnerCells.push({ x, z });
      if(x <= 2 && z <= 2) continue;
      if(bossType === 'boss_world_enemy'){
        const distFromCenter = Math.hypot(x - centerCoord, z - centerCoord);
        if(distFromCenter <= 2.2) continue;
      }
      validStepCells.push({ x, z });
    }
  }

  const usedCells = new Set();
  const targetObjCount = 8;
  for(let i = 0; i < targetObjCount && validStepCells.length > 0; i++){
    const idx = Math.floor(Math.random() * validStepCells.length);
    const cell = validStepCells.splice(idx, 1)[0];
    const key = `${cell.x},${cell.z}`;
    if(usedCells.has(key)) continue;
    usedCells.add(key);

    const isTrap = Math.random() < YAJU_CONFIG.trapProbability;
    const h = Math.random() < 0.5 ? YAJU_CONFIG.stepHeight1 : YAJU_CONFIG.stepHeight2;
    const p = cellWorld(cell.x, cell.z, size);
    const mesh = new T.Mesh(new T.BoxGeometry(YAJU_CONFIG.cellSize, h, YAJU_CONFIG.cellSize), isTrap ? trapMat : stepMat);
    mesh.position.set(p.x, h / 2, p.z);
    scene.add(mesh);

    const obj = { mesh, position: p, height: h, steps: h === YAJU_CONFIG.stepHeight1 ? 1 : 2, isTrap, cell, active: true };
    if(isTrap) traps.push(obj);
    else elevations.push(obj);
  }

  const bossRockets = [];
  const rocketPool = allInnerCells.filter(c => {
    if(c.x === 1 && c.z === 1) return false;
    if(bossType === 'boss_world_enemy' && Math.hypot(c.x - centerCoord, c.z - centerCoord) <= 2.0) return false;
    return true;
  });

  const spawnBossRockets = (texture) => {
    for(let i = 0; i < 3; i++){
      if(rocketPool.length === 0) break;
      const cell = rocketPool.splice(Math.floor(Math.random() * rocketPool.length), 1)[0];
      const rPos = cellWorld(cell.x, cell.z, size);

      let targetY = 0.8;
      for(const el of [...elevations, ...traps]){
        if(Math.abs(rPos.x - el.position.x) < 0.5 && Math.abs(rPos.z - el.position.z) < 0.5){
          targetY = el.height + 0.5;
          break;
        }
      }
      rPos.y = targetY;

      const mat = texture
        ? new T.MeshBasicMaterial({ map: texture, transparent: true, side: T.DoubleSide })
        : new T.MeshBasicMaterial({ color: 0x00aaff, side: T.DoubleSide });
      const geo = new T.PlaneGeometry(1.2, 1.2);
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(rPos.x, rPos.y, rPos.z);
      scene.add(mesh);

      const blueLight = new T.PointLight(0x00aaff, 4.0, 12);
      blueLight.position.set(rPos.x, rPos.y + 0.3, rPos.z);
      scene.add(blueLight);

      bossRockets.push({ mesh, light: blueLight, active: true });
    }
  };

  loader.load(YAJU_ROCKET_IMAGE, texture => {
    texture.colorSpace = T.SRGBColorSpace;
    texture.needsUpdate = true;
    spawnBossRockets(texture);
  }, undefined, () => {
    spawnBossRockets(null);
  });

  return { maze, pointLightsList, elevations, traps, bossRockets };
}

export function buildYajuDeadStage(T, scene){
  scene.background = new T.Color(0x000000);
  scene.fog = null;
  const enemiesGroup = new T.Group();
  scene.add(enemiesGroup);
  return { enemiesGroup };
}
