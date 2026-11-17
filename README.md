# Cooking With SPAA v2.1

## GitHub更新
**すべてのファイルを置き換えてください。** ZIP内の構成をリポジトリのルートへそのままアップロードしてください。古い `game.js` は使用しません。

## 構成
- `index.html`：画面
- `style.css`：HUD・ロード画面・操作UI
- `js/main.js`：起動・ゲームループ・操作
- `js/config.js`：速度・ウェーブ数・各種設定
- `js/stage-builder.js`：ステージと敵モデル生成
- `js/ui.js`：ロード画面・HUD・メニュー
- `assets/enemy_shell.glb`：敵の外観モデル

## 操作
PC：マウスドラッグで視点、WASD／矢印キーで移動、Spaceで発射。iPad・スマホ：画面左側2/3をドラッグして視点、右側ボタンで移動・発射。

Three.jsはCDNから取得します。通信またはWebGLに問題がある場合は、0%で固まらずロード画面にエラーを表示します。GLBの取得に失敗した場合は簡易形状の敵でゲームを続行します。
