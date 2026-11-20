// v4.4: ゲーム設定（難易度6段階・WAVE10拡張・AIR STRIKE複雑障害物＆360°カメラ対応）
export const CONFIG={
  // FALL MISSILE: WAVE 1〜10 の基本ミサイル出現数（後半ほど増加幅が厳しめ）
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

  // AIR STRIKE 定数（1マス = 2.0m）
  AIR_STRIKE: {
    START_ALTITUDE_M: 100,   // 高さ50 = 100m
    START_Y: 50,             // y=50 (100m)
    DESCENT_SPEED_MPS: 5.0,  // 常に5m/sで降下 (= 2.5 units/s)
    LAUNCH_DELAY_SEC: 3.0,   // 3秒後に自動発射
    OBSTACLE_MIN_Y: 7,       // 高度14m (y=7)
    OBSTACLE_MAX_Y: 43,      // 高度86m (y=43)
    SCORE_PER_METER: 20,     // 20 × 生き残ったm
    CAM_RADIUS: 9.4,         // 360°全周カメラの一定距離
    TARGET_RADIUS: 4.5,      // 地上目標の命中判定半径
    TARGET_MIN_DIST: 8.5,    // スタート地点からの最小目標距離 (17m)
    TARGET_MAX_DIST: 18.5    // スタート地点からの最大目標距離 (37m)
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

  SKINS:[
    {
      lv: 1, id: 'first', name: 'first', label: 'Lv.1 first（初期）',
      price: 0, color: 0x38c8f0,
      modelPath: 'assets/skins/models/first.glb',
      previewPath: 'assets/skins/previews/first.png',
      stats: { moveMult: 1.0, beamRadius: 2.7, beamColor: 0x8beeff, scoreMult: 1.0, baseAtk: 1, baseRate: 1, desc: '攻撃1 / 連射1 / 標準バランス機' }
    },
    {
      lv: 2, id: 'second', name: 'second', label: 'Lv.2 second',
      price: 1600, color: 0x4de680,
      modelPath: 'assets/skins/models/second.glb',
      previewPath: 'assets/skins/previews/second.png',
      stats: { moveMult: 1.08, beamRadius: 2.9, beamColor: 0x4de680, scoreMult: 1.05, baseAtk: 1, baseRate: 1, desc: '攻撃1 / 連射1 / 移動+8%' }
    },
    {
      lv: 3, id: 'third', name: 'third', label: 'Lv.3 third',
      price: 2400, color: 0xffd23f,
      modelPath: 'assets/skins/models/third.glb',
      previewPath: 'assets/skins/previews/third.png',
      stats: { moveMult: 1.15, beamRadius: 3.1, beamColor: 0xffd23f, scoreMult: 1.1, baseAtk: 2, baseRate: 1, desc: '攻撃2 / 連射1 / 移動+15%' }
    },
    {
      lv: 4, id: 'fourth', name: 'fourth', label: 'Lv.4 fourth',
      price: 3200, color: 0xff9233,
      modelPath: 'assets/skins/models/fourth.glb',
      previewPath: 'assets/skins/previews/fourth.png',
      stats: { moveMult: 1.22, beamRadius: 3.3, beamColor: 0xff9233, scoreMult: 1.15, baseAtk: 2, baseRate: 2, desc: '攻撃2 / 連射2 / 移動+22%' }
    },
    {
      lv: 5, id: 'fifth', name: 'fifth', label: 'Lv.5 fifth',
      price: 4800, color: 0xff4d6d,
      modelPath: 'assets/skins/models/fifth.glb',
      previewPath: 'assets/skins/previews/fifth.png',
      stats: { moveMult: 1.30, beamRadius: 3.5, beamColor: 0xff4d6d, scoreMult: 1.25, baseAtk: 3, baseRate: 2, desc: '攻撃3 / 連射2 / 移動+30%' }
    },
    {
      lv: 6, id: 'sixth', name: 'sixth', label: 'Lv.6 sixth',
      price: 6400, color: 0xc77dff,
      modelPath: 'assets/skins/models/sixth.glb',
      previewPath: 'assets/skins/previews/sixth.png',
      stats: { moveMult: 1.38, beamRadius: 3.8, beamColor: 0xc77dff, scoreMult: 1.35, baseAtk: 3, baseRate: 2, desc: '攻撃3 / 連射2 / 広域パルス' }
    },
    {
      lv: 7, id: 'seventh', name: 'seventh', label: 'Lv.7 seventh',
      price: 8000, color: 0x00f5d4,
      modelPath: 'assets/skins/models/seventh.glb',
      previewPath: 'assets/skins/previews/seventh.png',
      stats: { moveMult: 1.46, beamRadius: 4.1, beamColor: 0x00f5d4, scoreMult: 1.5, baseAtk: 4, baseRate: 2, desc: '攻撃4 / 連射2 / 超広域パルス' }
    },
    {
      lv: 8, id: 'eighth', name: 'eighth', label: 'Lv.8 eighth',
      price: 10000, color: 0xffffff,
      modelPath: 'assets/skins/models/eighth.glb',
      previewPath: 'assets/skins/previews/eighth.png',
      stats: { moveMult: 1.60, beamRadius: 4.5, beamColor: 0xffe66d, scoreMult: 2.0, baseAtk: 4, baseRate: 2, desc: '攻撃4 / 連射2 / 全性能極限' }
    }
  ]
};
