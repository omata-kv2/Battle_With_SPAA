# Cooking With SPAA (v4.3)

上空から降下するミサイルや戦闘機の迎撃、および高度100mからの空挺ミサイル降下作戦を楽しめる3D防衛・攻撃アクションゲームです。

## v4.3 アップデート内容
- **機体モデルの向き同期**: プレイヤーが向いている方向に合わせて立方体（機体スキン）の正面が回転するように改善。
- **名称変更**: 「スキン変更パネル」→「機体変更パネル」、「スキンショップ」→「機体ショップ」へ名称統一。
- **ゲームモード＆難易度選択システム**:
  - `GAME START` ポータル進入時にモード＆難易度選択モーダルを表示。
  - ゲームモード（`FALL MISSILE` / `AIR STRIKE`）を選択するまで難易度は選択不可、難易度を選択するまで出撃不可。
  - 全モード共通6段階難易度（`EASY` / `NORMAL` / `HARD` / `VERY HARD` / `HARDCORE` / `INSANE`）に応じてステージ床色・空色がリアルタイム変化。
- **FALL MISSILE モード拡張**:
  - 難易度に応じて最大Wave数が 5〜10 に増加し、後半Waveほど敵出現数が厳しく増加。
- **新ゲームモード「AIR STRIKE」追加**:
  - 高度100mの `SU-27.glb` から3秒後に `Kh-35.glb` を自動発射し、三人称視点で操作。
  - 常に 5m/s で降下しながら、高度80m〜20mに配置された障害物（直方体・球体・棒状）を回避して地上目標へ誘導。
  - スコア・獲得ゴールドは `20 × 生き残ったm` で精算。共闘モード時は横並び位置にスポーンして同時出撃。

## フォルダ構成
- `index.html` / `style.css` / `README.md`
- `js/main.js` / `js/ui.js` / `js/config.js` / `js/home-builder.js` / `js/skin-builder.js` / `js/stage-builder.js`
- `js/libs/three.module.js`（※別途配置済みのものを使用）
- `js/libs/examples/jsm/loaders/GLTFLoader.js`（※別途配置済みのものを使用）
- `assets/SU-27.glb`, `assets/Kh-35.glb`（※別途配置済みのものを使用）
