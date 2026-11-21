// v4.6: 防御力+1/Lv変更、Laser・Automatic・Wirbelwind・Beast の完全固有仕様・固有能力実装
export const CONFIG={
  // FALL MISSILE: WAVE 1〜10 の基本ミサイル出現数
  COUNTS:[6, 10, 16, 23, 32, 42, 54, 68, 84, 102],
  // FALL MISSILE: WAVE 1〜10 の戦闘機追加数
  FIGHTER_COUNTS:[0, 1, 1, 2, 3, 4, 5, 6, 8, 10],
  SPEEDS:[.083, .096, .109, .122, .135, .148, .160, .172, .184, .196],
  FIGHTER_SPEED_MULTIPLIER:1.3,
  MOVE_SPEED:.19,
  HOME_MOVE_SPEED:.15,
  MAX_PIXEL_RATIO:1.25,
  MAX_ENEMIES:42,
  SCORE_MISSILE: 10,
  SCORE_FIGHTER: 100,

  // 旧IDから新IDへの互換変換マップ
  LEGACY_SKIN_MAP: {
    first: 'Origin',
    second: 'RapidFire',
    third: 'Explosion',
    fourth: 'Scatter',
    fifth: 'Laser',
    sixth: 'Automatic',
    seventh: 'Wirbelwind',
    eighth: 'Beast'
  },

  // AIR STRIKE 定数（1マス = 2.0m）
  AIR_STRIKE: {
    START_ALTITUDE_M: 100,
    START_Y: 50,
    DESCENT_SPEED_MPS: 5.0,
    LAUNCH_DELAY_SEC: 3.0,
    OBSTACLE_MIN_Y: 7,
    OBSTACLE_MAX_Y: 43,
    SCORE_PER_METER: 20,
    CAM_RADIUS: 9.4,
    TARGET_RADIUS: 4.5,
    TARGET_MIN_DIST: 8.5,
    TARGET_MAX_DIST: 18.5
  },

  // 全ゲームモード共通の6段階難易度
  DIFFICULTIES: [
    {
      id: 'easy',
      name: 'EASY',
      jpName: 'イージー',
      waves: 5,
      groundColor: 0x8fd694,
      groundHex: '#8fd694',
      skyColor: 0x80c5e1,
      skyHex: '#80c5e1',
      enemyMult: 1.0,
      speedMult: 1.0,
      obstacleCount: 44,
      movingRatio: 0.25,
      speedFactor: 0.85,
      desc: '床: 薄い緑 / 空: 空色 / 標準難易度'
    },
    {
      id: 'normal',
      name: 'NORMAL',
      jpName: 'ノーマル',
      waves: 6,
      groundColor: 0x8be0f5,
      groundHex: '#8be0f5',
      skyColor: 0x80c5e1,
      skyHex: '#80c5e1',
      enemyMult: 1.15,
      speedMult: 1.06,
      obstacleCount: 62,
      movingRatio: 0.42,
      speedFactor: 1.05,
      desc: '床: 薄い水色 / 空: 空色 / 回転・移動障害物増加'
    },
    {
      id: 'hard',
      name: 'HARD',
      jpName: 'ハード',
      waves: 7,
      groundColor: 0xffb86c,
      groundHex: '#ffb86c',
      skyColor: 0x80c5e1,
      skyHex: '#80c5e1',
      enemyMult: 1.3,
      speedMult: 1.12,
      obstacleCount: 82,
      movingRatio: 0.58,
      speedFactor: 1.25,
      desc: '床: 薄いオレンジ / 空: 空色 / 高密度立体空域'
    },
    {
      id: 'very_hard',
      name: 'VERY HARD',
      jpName: 'ベリーハード',
      waves: 8,
      groundColor: 0xff7b7b,
      groundHex: '#ff7b7b',
      skyColor: 0xb8282e,
      skyHex: '#b8282e',
      enemyMult: 1.45,
      speedMult: 1.18,
      obstacleCount: 102,
      movingRatio: 0.72,
      speedFactor: 1.45,
      desc: '床: 薄い赤 / 空: 赤色 / 猛攻要塞空域'
    },
    {
      id: 'hardcore',
      name: 'HARDCORE',
      jpName: 'ハードコア',
      waves: 9,
      groundColor: 0x8b0000,
      groundHex: '#8b0000',
      skyColor: 0x9e1920,
      skyHex: '#9e1920',
      enemyMult: 1.65,
      speedMult: 1.24,
      obstacleCount: 124,
      movingRatio: 0.85,
      speedFactor: 1.70,
      desc: '床: 濃赤色 / 空: 赤色 / 極限迷宮防衛網'
    },
    {
      id: 'insane',
      name: 'INSANE',
      jpName: 'INSANE',
      waves: 10,
      groundColor: 0x111216,
      groundHex: '#111216',
      skyColor: 0x8a1118,
      skyHex: '#8a1118',
      enemyMult: 1.9,
      speedMult: 1.30,
      obstacleCount: 148,
      movingRatio: 0.95,
      speedFactor: 2.0,
      desc: '床: 黒色 / 空: 赤色 / 最高難易度・超密度複合トラップ'
    }
  ],

  // 全8機体（Origin 〜 Beast）
  SKINS:[
    {
      order: 1,
      id: 'Origin',
      name: 'Origin',
      label: 'Origin（初期機体）',
      price: 0,
      color: 0x38c8f0,
      modelPath: 'assets/skins/models/Origin.glb',
      previewPath: 'assets/skins/previews/Origin.png',
      attackType: 'standard',
      attackCooldown: 0,
      chargeTime: 0,
      upgrades: [
        { key: 'atk', maxLv: 100 },
        { key: 'def', maxLv: 100 },
        { key: 'hp',  maxLv: 100 }
      ],
      skill: {
        id: 'OriginBurst',
        name: 'OriginBurst',
        cooldown: 20,
        duration: 0,
        maxLv: 10,
        desc: '上空の飛翔体を一掃（Lv1:最大5体 〜 Lv10:最大30体）'
      },
      stats: {
        moveMult: 1.0,
        beamRadius: 2.7,
        beamColor: 0x8beeff,
        scoreMult: 1.0,
        baseAtk: 1,
        baseRate: 1,
        desc: '初期バランス機 / 固有能力: OriginBurst'
      }
    },
    {
      order: 2,
      id: 'RapidFire',
      name: 'RapidFire',
      label: 'RapidFire',
      price: 10000,
      color: 0x4de680,
      modelPath: 'assets/skins/models/RapidFire.glb',
      previewPath: 'assets/skins/previews/RapidFire.png',
      attackType: 'standard',
      attackCooldown: 0,
      chargeTime: 0,
      upgrades: [
        { key: 'rate', maxLv: 50 },
        { key: 'def',  maxLv: 50 },
        { key: 'hp',   maxLv: 50 }
      ],
      skill: {
        id: 'AdditionalTurre',
        name: 'AdditionalTurre',
        cooldown: 30,
        duration: 10,
        maxLv: 10,
        desc: '目の前に10秒間四角錐タレットを設置し頂点から追尾射撃（連射力1〜10）'
      },
      stats: {
        moveMult: 1.08,
        beamRadius: 2.9,
        beamColor: 0x4de680,
        scoreMult: 1.0,
        baseAtk: 1,
        baseRate: 1,
        desc: '高速連射機 / 固有能力: AdditionalTurre'
      }
    },
    {
      order: 3,
      id: 'Explosion',
      name: 'Explosion',
      label: 'Explosion',
      price: 11000,
      color: 0xff9233,
      modelPath: 'assets/skins/models/Explosion.glb',
      previewPath: 'assets/skins/previews/Explosion.png',
      attackType: 'explosion',
      attackCooldown: 0,
      chargeTime: 1.5,
      baseBlastRadiusM: 1.0,
      upgrades: [
        { key: 'atk',   maxLv: 50 },
        { key: 'score', maxLv: 50 },
        { key: 'blast', maxLv: 20 }
      ],
      skill: {
        id: 'FewCharger',
        name: 'FewCharger',
        cooldown: 30,
        duration: 10,
        maxLv: 10,
        desc: '10秒間溜め時間を短縮（Lv1:-0.5秒 〜 Lv10:-1.4秒）'
      },
      stats: {
        moveMult: 1.05,
        beamRadius: 3.1,
        beamColor: 0xff9233,
        scoreMult: 1.0,
        baseAtk: 2,
        baseRate: 1,
        desc: '1.5秒溜め範囲爆破機 / 固有能力: FewCharger'
      }
    },
    {
      order: 4,
      id: 'Scatter',
      name: 'Scatter',
      label: 'Scatter',
      price: 12000,
      color: 0xffd23f,
      modelPath: 'assets/skins/models/Scatter.glb',
      previewPath: 'assets/skins/previews/Scatter.png',
      attackType: 'scatter',
      attackCooldown: 0.5,
      chargeTime: 0,
      pelletCount: 7,
      baseSpreadAngle: 0.25,
      upgrades: [
        { key: 'atk',   maxLv: 50 },
        { key: 'hp',    maxLv: 50 },
        { key: 'score', maxLv: 50 }
      ],
      skill: {
        id: 'InfinityBarrel',
        name: 'InfinityBarrel',
        cooldown: 30,
        duration: 10,
        maxLv: 10,
        desc: '10秒間攻撃CD0秒で撃ち放題＆拡散範囲1.1倍〜2倍拡大'
      },
      stats: {
        moveMult: 1.12,
        beamRadius: 2.5,
        beamColor: 0xffd23f,
        scoreMult: 1.0,
        baseAtk: 1,
        baseRate: 1,
        desc: '広角散弾スプリンクラー機 / 固有能力: InfinityBarrel'
      }
    },
    {
      order: 5,
      id: 'Laser',
      name: 'Laser',
      label: 'Laser',
      price: 15000,
      color: 0xff4d6d,
      modelPath: 'assets/skins/models/Laser.glb',
      previewPath: 'assets/skins/previews/Laser.png',
      attackType: 'laser',
      attackCooldown: 1.0,
      baseLaserDuration: 3.0,
      chargeTime: 0,
      upgrades: [
        { key: 'atk',      maxLv: 50 },
        { key: 'score',    maxLv: 50 },
        { key: 'duration', maxLv: 10 }
      ],
      skill: {
        id: 'NeverStopper',
        name: 'NeverStopper',
        cooldown: 10,
        duration: 10,
        maxLv: 10,
        desc: '光線を持続照射（Lv1:10.5秒〜Lv10:15秒）＆光線半径拡大（Lv1:1.25倍〜Lv10:1.7倍）'
      },
      stats: {
        moveMult: 1.20,
        beamRadius: 3.2,
        beamColor: 0xff4d6d,
        scoreMult: 1.0,
        baseAtk: 2,
        baseRate: 1,
        desc: '3秒連続照射光線柱機 / 固有能力: NeverStopper'
      }
    },
    {
      order: 6,
      id: 'Automatic',
      name: 'Automatic',
      label: 'Automatic',
      price: 20000,
      color: 0xc77dff,
      modelPath: 'assets/skins/models/Automatic.glb',
      previewPath: 'assets/skins/previews/Automatic.png',
      attackType: 'automatic',
      attackCooldown: 1.0,
      baseVolleyCount: 2,
      chargeTime: 0,
      upgrades: [
        { key: 'atk',    maxLv: 50 },
        { key: 'def',    maxLv: 50 },
        { key: 'hp',     maxLv: 50 },
        { key: 'volley', maxLv: 10 }
      ],
      skill: {
        id: 'MultiBurst',
        name: 'MultiBurst',
        cooldown: 20,
        duration: 10,
        maxLv: 10,
        desc: '10秒間戦闘機を優先追尾し追加弾を獲得（Lv1:+1発 〜 Lv10:+10発）'
      },
      stats: {
        moveMult: 1.28,
        beamRadius: 3.4,
        beamColor: 0xc77dff,
        scoreMult: 1.0,
        baseAtk: 2,
        baseRate: 1,
        desc: '60°スプリンクラー高追尾機 / 固有能力: MultiBurst'
      }
    },
    {
      order: 7,
      id: 'Wirbelwind',
      name: 'Wirbelwind',
      label: 'Wirbelwind',
      price: 20000,
      color: 0x00f5d4,
      modelPath: 'assets/skins/models/Wirbelwind.glb',
      previewPath: 'assets/skins/previews/Wirbelwind.png',
      attackType: 'wirbelwind',
      attackCooldown: 0,
      squareSize: 0.75,
      chargeTime: 0,
      upgrades: [
        { key: 'atk',         maxLv: 50 },
        { key: 'score',       maxLv: 50 },
        { key: 'vertexShots', maxLv: 5 }
      ],
      skill: {
        id: 'GermanTech',
        name: 'GermanTech',
        cooldown: 30,
        duration: 0,
        maxLv: 10,
        desc: '上空の飛翔体を一掃破壊（Lv1:12個 〜 Lv10:30個）'
      },
      stats: {
        moveMult: 1.36,
        beamRadius: 2.8,
        beamColor: 0x00f5d4,
        scoreMult: 1.0,
        baseAtk: 2,
        baseRate: 1,
        desc: '0.75×0.75正方形4頂点同時発射機 / 固有能力: GermanTech'
      }
    },
    {
      order: 8,
      id: 'Beast',
      name: 'Beast',
      label: 'Beast',
      price: 81000,
      color: 0xffffff,
      modelPath: 'assets/skins/models/Beast.glb',
      previewPath: 'assets/skins/previews/Beast.png',
      attackType: 'beast',
      attackCooldown: 0,
      chargeTime: 0,
      upgradeBaseCost: 1000,
      upgradeStepCost: 100,
      upgrades: [
        { key: 'faith',    maxLv: 810 },
        { key: 'gayPower', maxLv: 810 },
        { key: 'saint',    maxLv: 810 }
      ],
      skill: {
        id: 'BeastEyesPower',
        name: 'BeastEyesPower',
        cooldown: 1,
        duration: 0,
        maxLv: 10,
        desc: '出現した飛翔体を全て破壊（Lv1:CD 1秒 〜 Lv10:CDなし）'
      },
      stats: {
        moveMult: 1.50,
        beamRadius: 4.2,
        beamColor: 0xffffff,
        scoreMult: 1.0,
        baseAtk: 4,
        baseRate: 1,
        desc: '純白聖光・無冷却拡散機 / 固有能力: BeastEyesPower'
      }
    }
  ]
};
