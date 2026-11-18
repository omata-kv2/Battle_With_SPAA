// v2.5: ホーム機能、ステージ選択、スコア・通貨設定、キャラクターデータ追加
export const CONFIG={
  COUNTS:[6,9,12,15,18],
  SPEEDS:[.083,.098,.113,.128,.143],
  FIGHTER_SPEED_MULTIPLIER:1.3,
  MOVE_SPEED:.19,
  MAX_PIXEL_RATIO:1.25,
  MAX_ENEMIES:24,
  SCORE_MISSILE: 10,
  SCORE_FIGHTER: 100,
  STAGES:[
    {name: '第1ステージ: 迎撃訓練'},
    {name: '第2ステージ: 航空警戒'},
    {name: '第3ステージ: 厳戒空域'},
    {name: '第4ステージ: 激戦防衛線'},
    {name: '第5ステージ: 最終決戦'}
  ],
  CHARACTERS:[
    {id: 'default', name: '標準SPAA', price: 0, unlocked: true},
    {id: 'heavy', name: 'ヘビーSPAA', price: 2500, unlocked: false},
    {id: 'elite', name: 'エリートSPAA', price: 5000, unlocked: false},
    {id: 'master', name: 'マスターSPAA', price: 10000, unlocked: false}
  ]
};
