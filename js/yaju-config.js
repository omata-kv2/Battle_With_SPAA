export const YAJU_CONFIG = {
  mazeCells: 15,
  cellSize: 4,
  wallHeight: 4.53,
  playerRadius: 0.45,
  enemyRadius: 0.5,
  walkSpeed: 3.2,
  runSpeed: 6.0,

  dashSpeed: 20.0,
  dashDuration: 2.0,
  dashCooldown: 5.0,
  dashStaminaCost: 10,

  maxStamina: 20,
  staminaUsePerSecond: 1,
  staminaRegenPerSecond: 1,

  enemyWalkSpeed: 4.5,
  enemyChaseSpeed: 5.8,

  enemyDetectDistance: 11,
  enemyFovDegrees: 360,
  enemyCatchDistance: 2.0,
  enemySpawnMinDistance: 8,
  enemySpawnMaxDistance: 16,
  enemyRepathInterval: 0.25,
  radarGreenDist: 24,
  radarYellowDist: 12,
  captureWaitTime: 28,

  totalElevationObjectsMin: 15,
  totalElevationObjectsMax: 25,
  trapProbability: 0.33,
  stepHeight1: 0.45,
  stepHeight2: 0.90,
  trapSlowDuration: 3.0,

  rocketSpawnMinDist: 6,
  rocketSpawnMaxDist: 14,
  rocketHitRadius: 1.2,
  projectileSpeed: 12.0,
  projectileHitRadius: 3.0,
  maxRocketAmmo: 2,

  maxTextureSize: 256,
  lightDrawDistance: 16.0,
  drawDistance: 32.0,
  fogNear: 10.0,
  fogFar: 32.0,

  maxFloors: 5,
  invulnerableDuration: 3.0,
  playerMaxHp: 20
};

export const YAJU_BOSSES = [
  { id: 'boss_world_enemy', name: 'world enemy', desc: 'マップ中央に鎮座し、青色弾頭と家臣で迎撃する巨塊。' },
  { id: 'boss_beast_king', name: '獣王', desc: '高速追跡と10秒ごとの猛突進を繰り出す王。' }
];

export const YAJU_BOSS_DIFFICULTIES = [
  { id: 'easy', name: 'イージー', hp: 100, atkMult: 1.0 },
  { id: 'normal', name: 'ノーマル', hp: 500, atkMult: 2.0 },
  { id: 'hard', name: 'ハード', hp: 1000, atkMult: 3.0 },
  { id: 'insane', name: 'INSANE', hp: 1919, atkMult: 4.0 }
];

export const YAJU_REWARDS = {
  MAZE_CLEAR_COINS: 500,
  BOSS_BASE_COINS: 200
};

export const YAJU_CHASER_IMAGES = ['./assets/chasers/inmu_king.png'];
export const YAJU_BOOM_IMAGE = './assets/chasers/boom.png';
export const YAJU_IZAN_IMAGE = './assets/chasers/izan.png';
export const YAJU_ROCKET_IMAGE = './assets/items/rocket.png';
export const YAJU_NEEDLE_COLORS = ['#ff0000', '#ff00ff', '#00ffff', '#ffff00', '#ff8800', '#00ff00', '#ffffff'];
