import { makeTextSprite } from './multiplayer.js';

export function buildHomeStage(T, scene, gold){
  scene.background = new T.Color(0x091c2e);
  scene.fog = new T.FogExp2(0x091c2e, 0.018);

  scene.add(new T.HemisphereLight(0xcaf0f8, 0x102a43, 1.25));
  const dir = new T.DirectionalLight(0xffffff, 1.1);
  dir.position.set(12, 24, 15);
  scene.add(dir);

  const floor = new T.Mesh(
    new T.PlaneGeometry(24, 24),
    new T.MeshStandardMaterial({ color: 0x132f48, roughness: 0.8 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2;
  scene.add(floor);

  const grid = new T.GridHelper(22, 22, 0x00f5d4, 0x1e4668);
  grid.position.y = -1.18;
  scene.add(grid);

  const portals = [
    { id: 'gamestart', x: 0,  z: -6.5, color: 0x38c8f0, label: '出撃ゲート' },
    { id: 'skin',      x: -6, z: 0,    color: 0xffd23f, label: '機体格納庫' },
    { id: 'coop',      x: 6,  z: 0,    color: 0x4de680, label: 'フレンド共闘' }
  ];

  const triggers = [];
  for(const p of portals){
    const ring = new T.Mesh(
      new T.RingGeometry(1.1, 1.5, 32),
      new T.MeshBasicMaterial({ color: p.color, side: T.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, -1.15, p.z);
    scene.add(ring);

    const pillar = new T.Mesh(
      new T.CylinderGeometry(1.15, 1.15, 2.4, 24, 1, true),
      new T.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.18, side: T.DoubleSide })
    );
    pillar.position.set(p.x, 0.05, p.z);
    scene.add(pillar);

    const sign = makeTextSprite(T, p.label);
    sign.position.set(p.x, 1.75, p.z);
    scene.add(sign);

    triggers.push({ id: p.id, x: p.x, z: p.z, radius: 1.55 });
  }

  const goldBoard = makeTextSprite(T, `GOLD: ${gold.toLocaleString()} G`, 'rgba(20,24,10,0.88)', '#ffd23f');
  goldBoard.position.set(0, 2.5, -8.5);
  goldBoard.scale.set(2.8, 1.1, 1);
  scene.add(goldBoard);

  return {
    spawnPos: { x: 0, z: 6.5 },
    triggers
  };
}
