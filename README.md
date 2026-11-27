# Cooking With SPAA v5.1 — cooking-with-spaa × YAJU_ESCAPE 統合パッケージ

## 1. ディレクトリ・ファイル構成

```text
/
├── index.html
├── style.css
├── README.md
├── assets/
│   ├── Kh-35.glb            (ダミー)
│   ├── SU-27.glb            (ダミー)
│   ├── chasers/             (inmu_king.png, boom.png, izan.png ダミー)
│   ├── items/               (rocket.png ダミー)
│   ├── textures/            (wall.jpeg, floor.jpeg, ceiling.jpeg ダミー)
│   ├── sounds/              (yarimasune.mp3, 114514.mp3, boom.mp3, start.mp3, totugeki.mp3, restart.mp3, clear.mp3 ダミー)
│   └── videos/              (inmuking.mp4 ダミー)
└── js/
    ├── libs/                (three.module.js, GLTFLoader.js ダミー)
    ├── app.js               # エントリーポイント・メインループ・ポータル/モーダル制御
    ├── config.js            # SPAA設定・難易度・全8機体定義
    ├── state.js             # ゲーム状態管理・Gold/YAJUコイン LocalStorage永続化
    ├── ui.js                # HUD・YAJUMAZE/ボス戦UI切替制御
    ├── controls.js          # 仮想スティック・視点操作・YAJU突進/走る/ロケット入力
    ├── modals.js            # 出撃・機体・共闘・YAJUMAZE設定・ボス/難易度選択モーダル
    ├── player.js            # SPAA通常攻撃（YAJUボス戦対応）
    ├── enemies.js           # SPAA敵スポーン・WAVE管理
    ├── multiplayer.js       # PeerJS フレンド共闘同期
    ├── mode-fall-missile.js # FALL MISSILEモード
    ├── mode-air-strike.js   # AIR STRIKEモード
    ├── map-home.js          # ホームベース（YAJUMAZEポータル・Gold/YAJUコイン上空パネル）
    ├── map-skin.js          # 機体格納庫
    ├── map-fall-missile.js  # 地上防衛ステージ
    ├── map-air-strike.js    # 空挺降下ステージ
    ├── yaju-config.js       # YAJUMAZE設定・ボス(world enemy/獣王)・難易度(イージー〜INSANE)・報酬定義
    ├── yaju-collision.js    # 迷路判定・A*経路探索・視線/段差判定
    ├── yaju-world.js        # 迷路・ボスステージ・Dead Stage 3Dワールド構築
    └── mode-yaju-maze.js    # YAJUMAZE通常5階層・ボス戦・Dead Stage・コンパス・ロケット進行制御
```

## 2. v5.1 主な統合内容

1. **ホームベース「YAJUMAZEポータル」＆上空所持金/YAJUコインパネル**
   - 出撃ゲートの右隣に `YAJUMAZE` ポータルを設置し、接触でルール設定画面（`YAJUMAZE` タイトル、`累進YAJU数` / `各種コンパスの使用` スライドボタン、`この設定でスタート`、`ボス戦`）を表示。
   - ホーム上空に `Gold: 〜 G` パネルとその上に `YAJUコイン: n枚` パネルを配置（テキスト幅計測により横幅を自動調整）。
2. **ボス戦・難易度設定＆YAJUコイン報酬**
   - ボス2種（`world enemy` / `獣王`）× 難易度4段階（`イージー`: HP 100 / 1.0倍、`ノーマル`: HP 500 / 2.0倍、`ハード`: HP 1000 / 3.0倍、`INSANE`: HP 1919 / 4.0倍）。ボス選択後に難易度を選択し、両方選択で開始可能。
   - YAJUMAZE 5階層クリアで `YAJUコイン` +500枚（クリア画面に `ボス戦` / `ホームに戻る` の2ボタン配置）。ボス討伐で `200 × 難易度倍率` 枚を獲得し、`localStorage`（`spaa_yaju_coins`）に保存。
3. **操作系・戦闘・勝敗画面**
   - 移動・視点操作は `cooking-with-spaa` 方式に統一。ボス戦では装備機体の通常攻撃で攻撃し、ロケット発射ボタンは画面右端中央に小型丸型ボタンとして配置。
   - ボス戦勝利時はホワイトアウト後に獲得YAJUコイン数と `ホームに戻る` ボタンのみ表示。敗北時は `dead stage` イベント実行後、defeat画面に `ホームに戻る` ボタンのみ表示。
