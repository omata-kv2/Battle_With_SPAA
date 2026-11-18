// v2.7: 全8種スキン（lv1〜lv8）・価格設定・能力値・フォルダ構成対応
export const CONFIG={
  COUNTS:[6,9,12,15,18],
  SPEEDS:[.083,.098,.113,.128,.143],
  FIGHTER_SPEED_MULTIPLIER:1.3,
  MOVE_SPEED:.19,
  HOME_MOVE_SPEED:.15,
  MAX_PIXEL_RATIO:1.25,
  MAX_ENEMIES:24,
  SCORE_MISSILE: 10,
  SCORE_FIGHTER: 100,
  // lv1(初期)〜lv8の8種類のスキン設定（画像は初期除き7人の解放費用準拠）
  SKINS:[
    {
      lv: 1, id: 'first', name: 'first', label: 'Lv.1 first（初期）',
      price: 0, color: 0x38c8f0,
      modelPath: 'assets/skins/models/first.glb',
      previewPath: 'assets/skins/previews/first.png',
      stats: { moveMult: 1.0, beamRadius: 2.7, beamColor: 0x8beeff, scoreMult: 1.0, desc: '標準性能バランス機' }
    },
    {
      lv: 2, id: 'second', name: 'second', label: 'Lv.2 second',
      price: 1600, color: 0x4de680,
      modelPath: 'assets/skins/models/second.glb',
      previewPath: 'assets/skins/previews/second.png',
      stats: { moveMult: 1.08, beamRadius: 2.9, beamColor: 0x4de680, scoreMult: 1.05, desc: '移動速度+8% / 射撃判定拡大' }
    },
    {
      lv: 3, id: 'third', name: 'third', label: 'Lv.3 third',
      price: 2400, color: 0xffd23f,
      modelPath: 'assets/skins/models/third.glb',
      previewPath: 'assets/skins/previews/third.png',
      stats: { moveMult: 1.15, beamRadius: 3.1, beamColor: 0xffd23f, scoreMult: 1.1, desc: '移動速度+15% / ゴールド獲得+10%' }
    },
    {
      lv: 4, id: 'fourth', name: 'fourth', label: 'Lv.4 fourth',
      price: 3200, color: 0xff9233,
      modelPath: 'assets/skins/models/fourth.glb',
      previewPath: 'assets/skins/previews/fourth.png',
      stats: { moveMult: 1.22, beamRadius: 3.3, beamColor: 0xff9233, scoreMult: 1.15, desc: '移動速度+22% / ゴールド獲得+15%' }
    },
    {
      lv: 5, id: 'fifth', name: 'fifth', label: 'Lv.5 fifth',
      price: 4800, color: 0xff4d6d,
      modelPath: 'assets/skins/models/fifth.glb',
      previewPath: 'assets/skins/previews/fifth.png',
      stats: { moveMult: 1.30, beamRadius: 3.5, beamColor: 0xff4d6d, scoreMult: 1.25, desc: '移動速度+30% / ゴールド獲得+25%' }
    },
    {
      lv: 6, id: 'sixth', name: 'sixth', label: 'Lv.6 sixth',
      price: 6400, color: 0xc77dff,
      modelPath: 'assets/skins/models/sixth.glb',
      previewPath: 'assets/skins/previews/sixth.png',
      stats: { moveMult: 1.38, beamRadius: 3.8, beamColor: 0xc77dff, scoreMult: 1.35, desc: '移動速度+38% / 広域パルス / ゴールド+35%' }
    },
    {
      lv: 7, id: 'seventh', name: 'seventh', label: 'Lv.7 seventh',
      price: 8000, color: 0x00f5d4,
      modelPath: 'assets/skins/models/seventh.glb',
      previewPath: 'assets/skins/previews/seventh.png',
      stats: { moveMult: 1.46, beamRadius: 4.1, beamColor: 0x00f5d4, scoreMult: 1.5, desc: '移動速度+46% / 超広域パルス / ゴールド+50%' }
    },
    {
      lv: 8, id: 'eighth', name: 'eighth', label: 'Lv.8 eighth',
      price: 10000, color: 0xffffff,
      modelPath: 'assets/skins/models/eighth.glb',
      previewPath: 'assets/skins/previews/eighth.png',
      stats: { moveMult: 1.60, beamRadius: 4.5, beamColor: 0xffe66d, scoreMult: 2.0, desc: '最終形態：全性能極限＆ゴールド2倍' }
    }
  ]
};
