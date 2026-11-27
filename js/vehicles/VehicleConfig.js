export const VEHICLE_FOLDER_MAP = {
  Origin: 'vehicle_01',
  RapidFire: 'vehicle_02',
  Explosion: 'vehicle_03',
  Scatter: 'vehicle_04',
  Laser: 'vehicle_05',
  Automatic: 'vehicle_06',
  Wirbelwind: 'vehicle_07',
  Beast: 'vehicle_08'
};

// 3D機体システム適用機体（Origin, Explosion, Wirbelwind）
export const EXPERIMENTAL_3D_SKINS = new Set(['Origin', 'RapidFire', 'Explosion', 'Scatter', 'Wirbelwind']);

export const DEFAULT_VEHICLE_CONFIG = {
  hasTurret: true,
  isStaffMode: false,
  turretPivot: [0, 1.24, -0.15],
  gunPivot: [0, 0.62, -0.62],
  staffPivot: [0, 1.6, -0.121],
  minElevation: 0,
  maxElevation: Math.PI / 2,
  scale: 1.0,
  hullTurnSpeed: 9.0
};

export function getVehicleFolderCandidates(skinId = 'Origin'){
  const baseFolder = VEHICLE_FOLDER_MAP[skinId] || 'vehicle_01';
  const pluralFolder = baseFolder.replace(/^vehicle_/, 'vehicles_');
  return [
    `./assets/vehicles/${pluralFolder}`,
    `./assets/vehicles/${baseFolder}`,
    `./assets/vehicles/${skinId}`,
    `./assets/models/${skinId}`
  ];
}

export function getVehicleAssetPaths(skinId = 'Origin'){
  const dirs = getVehicleFolderCandidates(skinId);
  return {
    dirs,
    configCandidates: dirs.map(d => `${d}/config.json`),
    hullCandidates: [
      ...dirs.map(d => `${d}/hull.glb`),
      ...dirs.map(d => `${d}/${skinId}_hull.glb`),
      `./assets/models/${skinId}_hull.glb`
    ],
    turretCandidates: [
      ...dirs.map(d => `${d}/turret.glb`),
      ...dirs.map(d => `${d}/${skinId}_turret.glb`),
      `./assets/models/${skinId}_turret.glb`
    ],
    gunCandidates: [
      ...dirs.map(d => `${d}/gun.glb`),
      ...dirs.map(d => `${d}/${skinId}_gun.glb`),
      `./assets/models/${skinId}_gun.glb`
    ]
  };
}
