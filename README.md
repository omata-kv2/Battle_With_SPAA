# Cooking With SPAA

スマートフォン・iPad・PC向けの、架空のSFエネルギー防衛アーケードゲームの初期プロトタイプです。

## 起動方法
GitHub Pagesで公開するか、ローカルサーバーで開いてください。ES Modulesを使用するため、`index.html`を直接ファイルとして開くのではなくHTTP経由で起動します。

## GitHub Pages
1. このZIPの中身をGitHubリポジトリのルートにアップロード
2. Settings → Pages
3. Deploy from a branch → `main` / `/(root)` を選択
4. 保存後、公開URLを開く

## 操作
- 画面上のターゲットをタップ／クリック：エネルギーパルス
- ENERGY PULSE：画面中央方向へパルス
- PC・タッチ端末対応

## ファイル
- `index.html`：画面構造
- `style.css`：HUDとメニュー
- `game.js`：Three.jsゲーム処理
- `assets/enemy_shell.glb`：敵の架空展示モデル

※敵は架空のオブジェクト、攻撃表現は非現実的なエネルギーパルスです。実在の兵器の挙動や照準機構は再現していません。
