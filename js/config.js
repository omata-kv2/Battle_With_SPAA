export const CONFIG = {
  MAX_PIXEL_RATIO: 2,
  MOVE_SPEED: 0.25,
  HOME_MOVE_SPEED: 0.20,
  MAX_ENEMIES: 18,
  SCORE_MISSILE: 100,
  SCORE_FIGHTER: 500,
  COUNTS: [8, 12, 16, 20, 25, 30, 36, 42, 50, 60],
  FIGHTER_COUNTS: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12],
  LEGACY_SKIN_MAP: {
    'origin': 'Origin',
    'rapid': 'RapidFire',
    'explosion': 'Explosion',
    'scatter': 'Scatter',
    'laser': 'Laser',
    'automatic': 'Automatic',
    'wirbelwind': 'Wirbelwind',
    'beast': 'Beast'
  },
  DIFFICULTIES: [
    { id: 'easy',      name: 'EASY',      jpName: '初級', waves: 5,  enemyMult: 1.0, speedMult: 0.85, obstacleCount: 16, groundHex: '#1b3a4b', skyHex: '#2fafde', desc: '基本防衛演習。敵速度・数ともに標準的。' },
    { id: 'normal',    name: 'NORMAL',    jpName: '中級', waves: 6,  enemyMult: 1.2, speedMult: 1.0,  obstacleCount: 24, groundHex: '#243b2c', skyHex: '#2fafde', desc: '実戦レベルの迎撃戦。戦闘機も混在。' },
    { id: 'hard',      name: 'HARD',      jpName: '上級', waves: 7,  enemyMult: 1.45,speedMult: 1.18, obstacleCount: 34, groundHex: '#3d2c1e', skyHex: '#b332c2', desc: '高密度飽和攻撃。素早い判断が必要。' },
    { id: 'very_hard', name: 'VERY HARD', jpName: '超級', waves: 8,  enemyMult: 1.75,speedMult: 1.35, obstacleCount: 44, groundHex: '#3d1e2c', skyHex: '#b332c2', desc: '猛攻フェーズ。機体強化が推奨される。' },
    { id: 'hardcore',  name: 'HARDCORE',  jpName: '弩級', waves: 9,  enemyMult: 2.1, speedMult: 1.55, obstacleCount: 56, groundHex: '#2b193d', skyHex: '#ad1717', desc: '容赦なき弾幕と高速飛翔体の嵐。' },
    { id: 'insane',    name: 'INSANE',    jpName: '超弩級', waves: 10, enemyMult: 2.5, speedMult: 1.8,  obstacleCount: 70, groundHex: '#3a0f14', skyHex: '#ad1717', desc: '人類最終防衛線。全10WAVEの極限戦。' }
  ],
  AIR_STRIKE: {
    START_Y: 50,
    START_ALTITUDE_M: 100,
    LAUNCH_DELAY_SEC: 3.0,
    DESCENT_SPEED_MPS: 18.0,
    TARGET_RADIUS: 3.2,
    SCORE_PER_METER: 20,
    CAM_RADIUS: 6.5
  },
  SKINS: [
    {
      id: 'Origin', order: 1, name: 'Origin', price: 0, color: 0x00f5d4,
      attackType: 'standard',
      stats: { baseAtk: 2, baseRate: 1.0, scoreMult: 1.0, moveMult: 1.0, beamColor: 0x00f5d4, beamRadius: 2.7, desc: 'バランス型の初期パルス迎撃機体。' },
      upgrades: [
        { key: 'atk', maxLv: 50 },
        { key: 'def', maxLv: 50 },
        { key: 'hp',  maxLv: 50 },
        { key: 'rate',maxLv: 10 },
        { key: 'score',maxLv: 25 }
      ],
      skill: { id: 'OriginBurst', name: 'OriginBurst', cooldown: 18, duration: 0, maxLv: 10, desc: '上空の飛翔体を最大5〜30体即座に一掃する。' }
    },
    {
      id: 'RapidFire', order: 2, name: 'RapidFire', price: 8100, color: 0x4de680,
      attackType: 'standard',
      stats: { baseAtk: 1, baseRate: 3.0, scoreMult: 1.05, moveMult: 1.1, beamColor: 0x4de680, beamRadius: 2.5, desc: '圧倒的な手数で弾幕を張る連射特化機体。' },
      upgrades: [
        { key: 'atk', maxLv: 50 },
        { key: 'def', maxLv: 50 },
        { key: 'hp',  maxLv: 50 },
        { key: 'rate',maxLv: 25 },
        { key: 'turretCount', maxLv: 5 },
        { key: 'score',maxLv: 20 }
      ],
      skill: { id: 'AdditionalTurre', name: 'AdditionalTurre', cooldown: 20, duration: 10, maxLv: 10, desc: 'マップ内に本体と同等の攻撃力・連射力を持つ自動迎撃タレットを均等距離で複数設置する。' }
    },
    {
      id: 'Explosion', order: 3, name: 'Explosion', price: 12660 , color: 0xff9233,
      attackType: 'explosion', chargeTime: 3.0, baseBlastRadiusM: 0,
      stats: { baseAtk: 8, baseRate: 1.0, scoreMult: 1.1, moveMult: 0.95, beamColor: 0xff9233, beamRadius: 3.0, desc: '最大3.0秒チャージで爆発半径(秒数×5m・最大15m+強化分)が拡大し、離すと爆破する重砲機体。' },
      upgrades: [
        { key: 'atk', maxLv: 50 },
        { key: 'blast', maxLv: 10 },
        { key: 'def', maxLv: 50 },
        { key: 'hp',  maxLv: 50 },
        { key: 'score',maxLv: 25 }
      ],
      skill: { id: 'FewCharger', name: 'FewCharger', cooldown: 20, duration: 10, maxLv: 10, desc: '10秒間、最大3.0秒チャージまでの必要時間を0.5〜1.4秒短縮する。' }
    },
    {
      id: 'Scatter', order: 4, name: 'Scatter', price: 81000, color: 0x38c8f0,
      attackType: 'scatter', attackCooldown: 0.5, pelletCount: 7, baseSpreadAngle: 0.25,
      stats: { baseAtk: 2, baseRate: 1.0, scoreMult: 1.1, moveMult: 1.08, beamColor: 0x38c8f0, beamRadius: 2.2, desc: '7方向の広角散弾で複数の飛翔体を同時に撃ち落とす。' },
      upgrades: [
        { key: 'atk', maxLv: 50 },
        { key: 'def', maxLv: 50 },
        { key: 'hp',  maxLv: 50 },
        { key: 'score',maxLv: 25 }
      ],
      skill: { id: 'InfinityBarrel', name: 'InfinityBarrel', cooldown: 20, duration: 10, maxLv: 10, desc: '10秒間クールダウン0秒＆拡散範囲が1.1〜2.0倍に拡大。' }
    },
    {
      id: 'Laser', order: 5, name: 'Laser', price: 114514, color: 0xff4d6d,
      attackType: 'laser', attackCooldown: 1.0, baseLaserDuration: 3.0,
      stats: { baseAtk: 2, baseRate: 1.0, scoreMult: 1.15, moveMult: 1.0, beamColor: 0xff4d6d, beamRadius: 1.4, desc: 'マップに四角錐タレットを均等配置し、Mk.1〜Mk.5の個別ボタンから視点先へ赤色レーザーを照射する。' },
      upgrades: [
        { key: 'atk', maxLv: 10 },
        { key: 'laserTurretCount', maxLv: 5 },
        { key: 'duration', maxLv: 10 },
        { key: 'def', maxLv: 50 },
        { key: 'hp',  maxLv: 50 },
        { key: 'score',maxLv: 25 }
      ],
      skill: { id: 'NeverStopper', name: 'NeverStopper', cooldown: 26, duration: 12, maxLv: 10, desc: '10〜15秒間全タレットから光線半径1.25〜1.7倍の赤色レーザーを一斉照射する。' }
    },
    {
      id: 'Automatic', order: 6, name: 'Automatic', price: 364364, color: 0xc77dff,
      attackType: 'automatic', attackCooldown: 1.0, baseVolleyCount: 2,
      stats: { baseAtk: 3, baseRate: 1.0, scoreMult: 1.2, moveMult: 1.05, beamColor: 0xc77dff, beamRadius: 2.4, desc: 'スプリンクラー展開から敵を自動追尾する誘導弾を発射。' },
      upgrades: [
        { key: 'atk', maxLv: 25 },
        { key: 'volley', maxLv: 10 },
        { key: 'def', maxLv: 50 },
        { key: 'hp',  maxLv: 50 },
        { key: 'score',maxLv: 25 }
      ],
      skill: { id: 'MultiBurst', name: 'MultiBurst', cooldown: 20, duration: 10, maxLv: 10, desc: '10秒間、戦闘機優先追尾＆追加弾を+1〜+10発獲得する。' }
    },
    {
      id: 'Wirbelwind', order: 7, name: 'Wirbelwind', price: 810810, color: 0xffd23f,
      attackType: 'wirbelwind', squareSize: 0.75,
      stats: { baseAtk: 2, baseRate: 1.0, scoreMult: 1.25, moveMult: 1.02, beamColor: 0xffd23f, beamRadius: 2.5, desc: '4門の対空砲（4頂点）から一斉斉射を行う重対空戦車仕様。' },
      upgrades: [
        { key: 'atk', maxLv: 10 },
        { key: 'vertexShots', maxLv: 5 },
        { key: 'def', maxLv: 50 },
        { key: 'hp',  maxLv: 50 },
        { key: 'score',maxLv: 25 }
      ],
      skill: { id: 'GermanTech', name: 'GermanTech', cooldown: 20, duration: 0, maxLv: 10, desc: '上空の飛翔体を最大12〜30個、精密対空砲撃で破壊する。' }
    },
    {
      id: 'Beast', order: 8, name: 'Beast', price: 1919810, color: 0xffffff,
      attackType: 'beast',
      stats: { baseAtk: 5, baseRate: 1.0, scoreMult: 1.5, moveMult: 1.2, beamColor: 0xffffff, beamRadius: 3.1, desc: 'クールダウンなしの純白光弾と超越的ステータスを持つ究極機体。' },
      upgrades: [
        { key: 'faith', maxLv: 50 },
        { key: 'gayPower', maxLv: 25 },
        { key: 'saint', maxLv: 15 }
      ],
      skill: { id: 'BeastEyesPower', name: 'BeastEyesPower', cooldown: 1.0, duration: 0, maxLv: 10, desc: '出現中の全飛翔体を完全消滅させる（Lv10でCD 0秒）。' }
    }
  ]
};

export const SHOP_ITEMS = [
  {
    id: "emp_shield",
    name: "電磁防御システム",
    shortName: "電磁防御",
    price: 10000,
    currency: "yaju",
    color: "#38c8f0",
    desc: "YAJU系では8秒間無敵付与、FallMissileでは敵の動きを7秒間停止（電磁エフェクト付）。"
  },
  {
    id: "hydrogen_bomb",
    name: "水素爆弾",
    shortName: "水素爆弾",
    price: 100000,
    currency: "gold",
    color: "#7ef9e8",
    desc: "青白く3秒かけてフェードアウトし、敵を7秒間停止＆敵全体に1000ダメージ。"
  },
  {
    id: "yaju_nuke",
    name: "野獣型原子爆弾",
    shortName: "野獣原爆",
    price: 81000,
    currency: "yaju",
    color: "#ff9ebb",
    desc: "YAJUコインで購入可能。青白く3秒フェードアウトし、敵を7秒間停止＆1000ダメージ。"
  },
  {
    id: "hp_full",
    name: "HP完全回復ストーン",
    shortName: "全回復石",
    price: 15000,
    currency: "gold",
    color: "#4de680",
    desc: "HP（またはPEACE）を最大値まで完全回復する。"
  },
  {
    id: "hp_half",
    name: "HP半分回復ストーン",
    shortName: "半回復石",
    price: 10000,
    currency: "gold",
    color: "#9be8ff",
    desc: "HP（またはPEACE）を最大値の半分ぶん回復する。"
  },
  {
    id: "power_double",
    name: "火力2倍ストーン",
    shortName: "火力2倍",
    price: 20000,
    currency: "gold",
    color: "#ff9233",
    desc: "10秒間、すべての攻撃の与ダメージが2倍になる。"
  },
  {
    id: "speed_up",
    name: "移動速度上昇ストーン",
    shortName: "速度上昇",
    price: 12000,
    currency: "gold",
    color: "#ffd23f",
    desc: "10秒間、プレイヤーの移動速度が1.5倍になる。"
  },
  {
    id: "beast_god_stone",
    name: "獣神化パワーストーン",
    shortName: "獣神化石",
    price: 5000,
    currency: "yaju",
    color: "#c77dff",
    desc: "YAJUコイン限定。使用した試合の報酬（Gold・YAJUコイン・XP）獲得数が2倍（制限時間なし）。"
  }
];
